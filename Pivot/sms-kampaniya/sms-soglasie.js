// SMS-согласие: приём галочек со страниц /sms-consent/ (EN) и /sms-consent/ru/ (RU).
//
// ИСХОДНИК ЖИВЁТ В Pivot/sms-kampaniya/, в netlify-functions/ лежит его копия.
// Правите — правьте исходник и прогоняйте sobrat.py: он вписывает блок VERSII ниже
// и при сборке сайта падает, если копия в netlify-functions/ разошлась с исходником.
//
// ЗАЧЕМ СВОЯ ФУНКЦИЯ, А НЕ ФОРМА NETLIFY. submission-created.js срабатывает на ЛЮБУЮ
// форму Netlify, а незнакомое имя формы проваливается в ветку интейка: владельцу ушло бы
// «Новый интейк на диагностику», человеку с почтой — «Анкета получена». Здесь форм Netlify
// нет вообще (sobrat.py падает, если на странице появится data-netlify), и тот обработчик
// об этой странице не узнаёт.
//
// ЧТО ПИШЕМ. Согласие по TCPA доказывается записью: кто, когда, откуда и на КАКОЙ текст
// согласился. Поэтому в журнал идёт: номер, обе галочки, время сервера, IP, браузер,
// страница, реферер, версия текста и её отпечаток sha256. Сам текст каждой версии лежит
// в tekst-soglasiya.json и не меняется задним числом.
//
// ДВА ВХОДА. Со скриптом страница шлёт JSON и получает JSON. Без скрипта форма уходит
// обычным POST (application/x-www-form-urlencoded) — ответ 303 обратно на страницу с #якорем,
// который там показывает итог (CSS :target). Номер в адрес страницы не попадает ни в одном случае.
//
// ХРАНИЛИЩЕ — Netlify Blobs `sms-soglasiya`:
//   zapis/<день>/<время>-<случайное>  — журнал, только дописываем, никогда не перезаписываем;
//   nomer/<+1XXXXXXXXXX>              — последнее состояние номера (перед отправкой SMS
//                                       смотреть сюда: servis / dozhim / otozvano);
//   schetchik/<день>                  — потолок записей в сутки (V_SUTKI);
//   ip/<день>/<sha256(IP), 16 знаков> — потолок записей с одного адреса в сутки (S_ODNOGO_IP);
//   pisma/<день>                      — потолок писем владельцу в сутки (PISEM_V_SUTKI).
// Хранилище не поднялось или отказало — человеку честно говорим «не сохранилось», владельцу
// письмо-след. Сказать «сохранили» без записи значит остаться без доказательства согласия.
//
// ПИСЬМА ВЛАДЕЛЬЦУ — только когда выбор номера поменялся (новое согласие, другая галочка, отзыв)
// и не больше PISEM_V_SUTKI в сутки: у Resend общий суточный лимит, и скрипт, долбящий форму,
// не должен заглушить письма об анкетах и звонках Веры.
//
// ЧТЕНИЕ: GET ?zdorovie=1 — поднялось ли хранилище (пишет и читает пробу), без данных.
//         GET с заголовком x-sms-key: <SMS_KEY> — последние состояния номеров; ?vse=1 — весь журнал.
//         Ключ — только заголовком: в адресе он оседал бы в логах и истории браузера.
//         Нет переменной SMS_KEY (или короче 16 знаков) — чтение закрыто, 404.
//
// ПОДТВЕРЖДАЮЩЕЕ SMS после первой галочки — ВЫКЛЮЧЕНО, пока кампанию не одобрили.
// Включается переменной SMS_PODTVERZHDAT=1 плюс TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_MESSAGING_SERVICE_SID. До одобрения кампании не включать: неучтённый трафик
// 10DLC операторы режут, а номер копит плохую историю.

const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

// <<VERSII — блок пишет Pivot/sms-kampaniya/sobrat.py из tekst-soglasiya.json. Руками не править.
const VERSII = {
  "en-1.0": { "yazyk": "en", "sha256": "cb16cba5ae56f57324f892fa7bb34723dbcaa064cafbc2b967358295d4125458" },
  "ru-1.0": { "yazyk": "ru", "sha256": "0c16a767cd92b2b5b5a32dd8b3f04ffa2055500deee52ed3ff84b64ac0c27814" }
};
const PODTVERZHDENIE = {
  "en": "Business Intelligence DNA (Wealthboosterpro LLC): you're signed up for the texts you chose on our site. Up to 8 msgs/mo. Msg & data rates may apply. Reply HELP for help, STOP to cancel.",
  "ru": "Business Intelligence DNA (Wealthboosterpro LLC): вы подписались на SMS, которые выбрали на сайте. До 8 SMS в месяц. Оператор может брать плату по тарифу. HELP или ПОМОЩЬ — помощь, STOP или СТОП — отписка."
};
// VERSII>>

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const HRANILISHCHE = 'sms-soglasiya';
const V_SUTKI = 300;                 // потолок записей в сутки — от перебора и мусора
const S_ODNOGO_IP = 10;              // потолок записей с одного IP в сутки
const PISEM_V_SUTKI = 20;            // потолок писем владельцу о согласиях в сутки
const STRANICA = { en: '/sms-consent/', ru: '/sms-consent/ru/' };
const MAKS_TELA = 5000;
const POHOZH_NA_POCHTU = /^[a-z0-9+_.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const OTVET = {
  en: {
    nomer: 'Please enter a US mobile number, 10 digits.',
    pusto: 'Nothing to save.',
    pochta: 'Please check the email address, or leave it empty.',
    versiya: 'This page is out of date — please reload it and try again.',
    potolok: 'Too many requests today — please try again tomorrow or email support@businessinteldna.com.',
    net_hranilishcha: 'It did not save — please try again in a minute, or email support@businessinteldna.com.',
  },
  ru: {
    nomer: 'Введите мобильный номер США, 10 цифр.',
    pusto: 'Сохранять нечего.',
    pochta: 'Проверьте адрес почты или оставьте поле пустым.',
    versiya: 'Страница устарела — обновите её и попробуйте ещё раз.',
    potolok: 'Сегодня слишком много заявок — попробуйте завтра или напишите на support@businessinteldna.com.',
    net_hranilishcha: 'Не сохранилось — попробуйте через минуту или напишите на support@businessinteldna.com.',
  },
};

// Голый getStore({name}) на выкладке готовой папкой бросает «The environment has not been
// configured to use Netlify Blobs» — поэтому второй заход с SITE_ID и токеном, как везде.
function hranilishche() {
  const name = HRANILISHCHE, consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  console.error('[sms-soglasie] ХРАНИЛИЩЕ НЕ ПОДНЯЛОСЬ: нет SITE_ID/EV_BLOBS_TOKEN или они не подходят');
  return null;
}

// Только США: кампания 10DLC на другие страны не доставляет. Код зоны и код станции
// в плане нумерации Северной Америки не начинаются с 0 и 1.
function e164(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length !== 10 || d[0] < '2' || d[3] < '2') return null;
  return '+1' + d;
}

const krasivo = (t) => t ? `+1 (${t.slice(2, 5)}) ${t.slice(5, 8)}-${t.slice(8)}` : '';
const den = () => new Date().toISOString().slice(0, 10);
const obrezat = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function ipAdres(h) {
  return obrezat(h['x-nf-client-connection-ip'] || h['client-ip']
    || String(h['x-forwarded-for'] || '').split(',')[0], 64) || null;
}

function otvet(kod, telo) {
  return { statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) };
}

// Без скрипта: назад на страницу, итог — якорем (#sohraneno, #bez-sms, #pusto, #oshibka-nomer, #oshibka).
function nazad(yazyk, sluchay) {
  return {
    statusCode: 303,
    headers: { Location: (STRANICA[yazyk] || STRANICA.en) + '#' + sluchay, 'cache-control': 'no-store' },
    body: '',
  };
}

// Поля обычной формы → тот же вид, что присылает скрипт. Галочка без скрипта приходит как «on».
// Страницу и метку ?ot= берём из реферера: скрытых полей под них нет, заполнять их без JS нечем.
function izFormy(raw, h) {
  const p = new URLSearchParams(raw);
  let stranica = null, ot = '';
  try {
    const u = new URL(h.referer || h.referrer || '');
    stranica = u.origin + u.pathname;
    ot = u.searchParams.get('ot') || '';
  } catch (_) {}
  return {
    telefon: p.get('telefon') || '', pochta: p.get('pochta') || '',
    servis: p.get('servis') === 'on', dozhim: p.get('dozhim') === 'on',
    versiya: p.get('versiya') || '', yazyk: p.get('yazyk') || '',
    sayt: p.get('sayt') || '', stranica, ot,
  };
}

// Resend и кириллица: тело уходит JSON-ом с \uXXXX — тот же приём, что в submission-created.js.
// Письма-следы об отказе хранилища счётчиком в хранилище не посчитать — считаем в памяти
// тёплого экземпляра функции. Грубо, но скрипт, бьющий в сломанное хранилище, не выжжет Resend.
const avariynyh = { den: '', n: 0 };
async function pismoAvariynoe(tema, tekst) {
  const d = new Date().toISOString().slice(0, 10);
  if (avariynyh.den !== d) { avariynyh.den = d; avariynyh.n = 0; }
  if (++avariynyh.n > 5) { console.log('[sms-soglasie] аварийных писем за сутки > 5, не шлём:', tema); return 'potolok'; }
  return pismoVladelcu(tema, tekst);
}

async function pismoVladelcu(tema, tekst) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[sms-soglasie] RESEND_API_KEY нет, письмо не ушло:', tema); return 'net klyucha'; }
  const raw = JSON.stringify({
    from: 'Business Intelligence DNA <hello@businessinteldna.com>',
    to: [process.env.BIDNA_MAIL || 'support@businessinteldna.com'],
    subject: tema, text: tekst,
  });
  let body = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    body += c > 127 ? ('\\u' + ('000' + c.toString(16)).slice(-4)) : raw[i];
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body,
    });
    if (!r.ok) console.log('[sms-soglasie] Resend отказал:', r.status);
    return String(r.status);
  } catch (e) {
    console.log('[sms-soglasie] письмо упало:', e && e.message);
    return 'upalo';
  }
}

function sostoyaniePodtverzhdeniya() {
  if (process.env.SMS_PODTVERZHDAT !== '1') return 'vyklyucheno';
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN
      || !process.env.TWILIO_MESSAGING_SERVICE_SID) return 'net klyuchey';
  return 'vklyucheno';
}

async function podtverdit(tel, yazyk) {
  const s = sostoyaniePodtverzhdeniya();
  if (s !== 'vklyucheno') return s;
  const tekst = PODTVERZHDENIE[yazyk] || PODTVERZHDENIE.en;
  if (!tekst) return 'net teksta';
  const sid = process.env.TWILIO_ACCOUNT_SID;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: tel, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID, Body: tekst,
      }).toString(),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? 'otpravleno ' + (j.sid || '') : 'oshibka ' + r.status + ' ' + (j.code || '');
  } catch (e) {
    return 'upalo ' + (e && e.message);
  }
}

function sovpadaet(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function chitatJson(store, key) {
  const v = await store.get(key);
  if (!v) return null;
  try { return JSON.parse(v); } catch (_) { return null; }
}

async function vse(store, prefix) {
  const { blobs } = await store.list({ prefix });
  const out = [];
  for (const b of blobs || []) {
    const v = await chitatJson(store, b.key);
    if (v) out.push(Object.assign({ key: b.key }, v));
  }
  return out;
}

// ─────────────────────────────────────────────── чтение
async function chtenie(event) {
  const q = event.queryStringParameters || {};

  if (q.zdorovie) {
    const store = hranilishche();
    let pishet = false;
    if (store) {
      try {
        const metka = new Date().toISOString();
        await store.set('zdorovie/proba', metka);
        pishet = (await store.get('zdorovie/proba')) === metka;
      } catch (e) { console.error('[sms-soglasie] проба хранилища упала:', e && e.message); }
    }
    return otvet(200, {
      ok: pishet, hranilishche: !!store, pishet,
      versii: Object.keys(VERSII), podtverzhdenie: sostoyaniePodtverzhdeniya(),
      chtenie: (process.env.SMS_KEY || '').length >= 16 ? 'otkryto po klyuchu' : 'zakryto',
    });
  }

  const klyuch = process.env.SMS_KEY || '';
  const dano = (event.headers || {})['x-sms-key'];
  if (klyuch.length < 16 || !sovpadaet(dano, klyuch)) return { statusCode: 404, body: 'Not found' };
  const store = hranilishche();
  if (!store) return otvet(500, { ok: false, pochemu: 'hranilishche ne podnyalos' });
  const nomera = await vse(store, 'nomer/');
  const telo = { ok: true, nomerov: nomera.length, nomera };
  if (q.vse) telo.zhurnal = await vse(store, 'zapis/');
  return otvet(200, telo);
}

// ─────────────────────────────────────────────── запись
exports.handler = async (event) => {
  if (event.httpMethod === 'GET') return chtenie(event);
  if (event.httpMethod !== 'POST') return otvet(405, { ok: false });

  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (raw.length > MAKS_TELA) return otvet(413, { ok: false });
  const h = event.headers || {};
  const forma = /application\/x-www-form-urlencoded/i.test(h['content-type'] || '');
  let b;
  if (forma) b = izFormy(raw, h);
  else {
    try { b = JSON.parse(raw || '{}'); } catch (_) { return otvet(400, { ok: false }); }
    if (!b || typeof b !== 'object') return otvet(400, { ok: false });
  }
  const r = await priem(b, h);
  return forma ? nazad(r.yazyk, r.sluchay) : otvet(r.kod, r.telo);
};

// Приём согласия. Возвращает { kod, telo } для скрипта и { yazyk, sluchay } для формы без скрипта.
async function priem(b, h) {
  const versiya = obrezat(b.versiya, 20);
  const v = Object.prototype.hasOwnProperty.call(VERSII, versiya) ? VERSII[versiya] : null;
  const yazyk = v ? v.yazyk : (b.yazyk === 'ru' ? 'ru' : 'en');
  const T = OTVET[yazyk];
  const itog = (kod, telo, sluchay) => ({ kod, telo, yazyk, sluchay });
  // Незнакомая версия — не пишем: мы не можем доказать, какой текст человек видел.
  if (!v) return itog(400, { ok: false, pochemu: T.versiya }, 'oshibka');

  // Ловушка для роботов: поле спрятано от людей. Отвечаем «ок», ничего не пишем.
  if (obrezat(b.sayt, 200)) {
    console.log('[sms-soglasie] робот (заполнено скрытое поле) — не пишем');
    return itog(200, { ok: true }, 'sohraneno');
  }

  const servis = b.servis === true;
  const dozhim = b.dozhim === true;
  const tel = e164(b.telefon);
  if (!tel) {
    const pusto = !b.telefon && !servis && !dozhim;
    return itog(200, { ok: false, pochemu: pusto ? T.pusto : T.nomer }, pusto ? 'pusto' : 'oshibka-nomer');
  }

  const pochta = obrezat(b.pochta, 120).toLowerCase();
  if (pochta && !POHOZH_NA_POCHTU.test(pochta)) return itog(200, { ok: false, pochemu: T.pochta }, 'oshibka');

  const kogda = new Date().toISOString();
  const ip = ipAdres(h);
  const zapis = {
    telefon: tel,
    servis, dozhim,
    soglasie: servis || dozhim,
    pochta: pochta || null,
    kogda,
    ip,
    brauzer: obrezat(h['user-agent'], 300) || null,
    yazyk,
    versiya,
    tekst_sha256: v.sha256,
    stranica: /^https:\/\//.test(String(b.stranica || '')) ? obrezat(b.stranica, 300) : null,
    referer: obrezat(h.referer || h.referrer, 300) || null,
    ot: obrezat(b.ot, 40).replace(/[^a-z0-9_-]/gi, '') || null,
    sposob: 'web-checkbox',
  };
  const neSohranilos = () => itog(500, { ok: false, pochemu: T.net_hranilishcha }, 'oshibka');

  const store = hranilishche();
  if (!store) {
    // Письмо — не доказательство вместо журнала, но хотя бы след: время, номер, IP.
    await pismoAvariynoe('SMS: СОГЛАСИЕ НЕ ЗАПИСАНО — хранилище не поднялось',
      'Человек нажал «Сохранить», а записать некуда. Ему сказали «не сохранилось».\n\n' +
      JSON.stringify(zapis, null, 2));
    return neSohranilos();
  }

  let klyuchZapisi;
  let bylo = null;
  try {
    // Потолок с одного адреса — раньше общего: один скрипт не должен съесть сутки у всех.
    if (ip) {
      const kIp = `ip/${den()}/${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)}`;
      const nIp = parseInt((await store.get(kIp)) || '0', 10);
      if (nIp >= S_ODNOGO_IP) {
        console.log('[sms-soglasie] потолок с одного IP', S_ODNOGO_IP);
        return itog(429, { ok: false, pochemu: T.potolok }, 'oshibka');
      }
      await store.set(kIp, String(nIp + 1));
    }
    const kSchet = 'schetchik/' + den();
    const n = parseInt((await store.get(kSchet)) || '0', 10);
    if (n >= V_SUTKI) {
      console.log('[sms-soglasie] суточный потолок', V_SUTKI);
      return itog(429, { ok: false, pochemu: T.potolok }, 'oshibka');
    }
    await store.set(kSchet, String(n + 1));

    bylo = await chitatJson(store, 'nomer/' + tel);
    klyuchZapisi = `zapis/${den()}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await store.set(klyuchZapisi, JSON.stringify(zapis));
  } catch (e) {
    // getStore() токен не проверяет: неверный или отозванный токен вылетает только здесь.
    console.error('[sms-soglasie] запись в журнал упала:', e && e.message);
    await pismoAvariynoe('SMS: СОГЛАСИЕ НЕ ЗАПИСАНО — хранилище отказало',
      'Человек нажал «Сохранить», хранилище ответило ошибкой. Ему сказали «не сохранилось».\n' +
      'Ошибка: ' + ((e && e.message) || e) + '\n\n' + JSON.stringify(zapis, null, 2));
    return neSohranilos();
  }

  // Подтверждающее SMS — только когда номер впервые (или снова, после отзыва) дал согласие.
  const byloSoglasie = !!(bylo && (bylo.servis || bylo.dozhim) && !bylo.otozvano);
  let podtverzhdenie = 'ne nuzhno';
  if (zapis.soglasie && !byloSoglasie) podtverzhdenie = await podtverdit(tel, yazyk);

  const sostoyanie = {
    telefon: tel, servis, dozhim,
    otozvano: !zapis.soglasie,           // обе галочки сняты = отзыв согласия
    kogda, versiya, yazyk,
    pochta: pochta || (bylo && bylo.pochta) || null,
    zapis: klyuchZapisi,
    pervoe_soglasie: zapis.soglasie ? ((bylo && bylo.pervoe_soglasie) || kogda) : ((bylo && bylo.pervoe_soglasie) || null),
    podtverzhdenie: podtverzhdenie === 'ne nuzhno' ? ((bylo && bylo.podtverzhdenie) || null) : podtverzhdenie,
  };
  try {
    await store.set('nomer/' + tel, JSON.stringify(sostoyanie));
  } catch (e) {
    // Журнал уже записан — согласие доказуемо. Состояние восстановимо из журнала.
    console.error('[sms-soglasie] состояние номера не записалось (журнал есть):', e && e.message);
  }

  // Письмо владельцу — только когда выбор поменялся. Повтор того же выбора и первый «без SMS»
  // от номера, который раньше не соглашался, ничего не меняют: они есть в журнале.
  const prezhde = { servis: byloSoglasie && !!bylo.servis, dozhim: byloSoglasie && !!bylo.dozhim };
  const pomenyalos = prezhde.servis !== servis || prezhde.dozhim !== dozhim;
  let pismo = 'ne nuzhno';
  if (pomenyalos) {
    let nPisem = 0;
    const kPisma = 'pisma/' + den();
    try { nPisem = parseInt((await store.get(kPisma)) || '0', 10); await store.set(kPisma, String(nPisem + 1)); }
    catch (e) { console.error('[sms-soglasie] счётчик писем не прочитался:', e && e.message); }
    if (nPisem < PISEM_V_SUTKI) {
      const chto = zapis.soglasie
        ? [servis && 'по заявке и записи', dozhim && 'рекламные: повторные и предложения'].filter(Boolean).join(' + ')
          + (byloSoglasie ? ' (было: ' + [prezhde.servis && 'по заявке', prezhde.dozhim && 'рекламные'].filter(Boolean).join(' + ') + ')' : '')
        : 'БЕЗ SMS — ОТЗЫВ прежнего согласия';
      pismo = await pismoVladelcu(
        (zapis.soglasie ? 'SMS: согласие ' : 'SMS: отзыв ') + krasivo(tel),
        'Номер: ' + krasivo(tel) + '\nВыбрал: ' + chto + '\nПочта: ' + (pochta || '—') +
        '\nЯзык страницы: ' + yazyk + ', версия текста ' + versiya +
        '\nВремя: ' + kogda + '\nIP: ' + (zapis.ip || '—') + '\nОткуда: ' + (zapis.ot || '—') +
        '\nПодтверждающее SMS: ' + podtverzhdenie +
        '\n\nЗапись в журнале: ' + klyuchZapisi +
        '\n\nНапоминание: SMS шлём только номерам, которым ушло подтверждающее SMS (podtverzhdenie = otpravleno…);' +
        ' согласия, записанные до одобрения кампании, для рассылки не годятся.' +
        (nPisem + 1 === PISEM_V_SUTKI ? '\n\nЭто ' + PISEM_V_SUTKI + '-е письмо о согласиях за сутки: дальше сегодня писем не будет,' +
          ' новые записи смотрите в журнале.' : ''));
    } else {
      pismo = 'potolok';
      console.log('[sms-soglasie] потолок писем владельцу', PISEM_V_SUTKI);
    }
  }

  console.log('[sms-soglasie]', zapis.soglasie ? 'согласие' : 'отказ', tel.slice(0, 5) + '…', versiya, podtverzhdenie, 'письмо:', pismo);
  return itog(200, { ok: true, soglasie: zapis.soglasie }, zapis.soglasie ? 'sohraneno' : 'bez-sms');
}
