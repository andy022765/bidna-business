// Перевод РУССКОЙ линии на Андрея — свой, вместо системного transfer_to_number ElevenLabs.
// План и замеры: Pivot/golos/PLAN-B-PEREVOD.md (план Б). Образец — perevod.js (английская линия).
//
// ЗАЧЕМ. Системный перевод ждёт ответа 55 с, а телефон Андрея сам берёт трубку на ~30-й секунде
// (замер 28.09: три звонка подряд, 30–32 с, и после снятия переадресации у оператора — тоже).
// Twilio считает автоответчик ответом, отката нет, человек попадает на голосовую почту.
// Тайм-аут у системного перевода не задаётся — поля API принимает и молча выбрасывает.
//
// КАК. Вера зовёт инструмент perevod_na_andreya, тот приносит system__call_sid. Мы обновляем
// ЭТОТ звонок своим TwiML:
//   1) фраза голосом Веры «Соединяю с Андреем…» (запись /zvuk/soedinyayu.mp3);
//   2) <Dial timeout=20> на Андрея: сам он берёт за 6–12 с, телефон отвечает сам на ~30-й;
//   3) ШИРМА (<Number url>): после «алло» Андрей слышит, что это звонок с линии Веры, и жмёт 1.
//      Автоответчик цифру не нажмёт — его нога кончается, звонящего с почтой не соединяем;
//   4) итог (<Dial action>): не соединились — фраза отката голосом Веры и отбой. Соединились и
//      поговорили — просто отбой. Без action звонящий после разговора услышал бы «не ответил»:
//      по правилам <Dial> Twilio идёт к следующему глаголу, даже если разговор состоялся.
// Письмо Андрею с номером звонящего уходит как обычно — после звонка, из pismo.js.
//
// ЗАЩИТА. Вызов от Веры — секрет в заголовке, звонок должен идти НА нашу русскую линию и быть
// в работе. Ширму, её ответ и итог зовёт Twilio; в адресе метка k = HMAC(sid звонка) —
// чужой адрес не соберёт. Без метки ширма кладёт трубку, то есть ни с кем не соединяет.
//
// env: TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · GOLOS_PISMO_SECRET.
// Новых переменных НЕТ нарочно: у сайта Веры потолок 4 КБ на все переменные разом
// (reference-4kb-peremennyh-lambda). Номера ниже — не секрет, они и так в настройках агента.

const crypto = require('crypto');

const NASH_RU = '+14247811913';          // русская линия Веры
const KUDA = '+15614516864';             // Андрей
const BAZA = 'https://dezhurny-r4p8w2.netlify.app';
const PUT = '/.netlify/functions/perevod-ru';
const ZHDEM = 20;                        // секунд звона до отката

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const XML_H = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });
const twimlOtvet = (telo) => ({ statusCode: 200, headers: XML_H,
  body: `<?xml version="1.0" encoding="UTF-8"?><Response>${telo}</Response>` });

const SID_OK = /^CA[0-9a-f]{32}$/i;
const SAY = '<Say language="ru-RU" voice="Polly.Tatyana">';

function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Метка в адресах, которые зовёт Twilio. Ключ — тот же секрет, что у инструментов Веры.
function metka(sid) {
  const s = process.env.GOLOS_PISMO_SECRET || '';
  if (!s) return '';
  return crypto.createHmac('sha256', s).update('perevod-ru:' + sid).digest('hex').slice(0, 32);
}
function metkaVerna(sid, k) {
  const nado = metka(sid);
  // Сперва форма: иначе многобайтная «метка» той же длины в символах роняет timingSafeEqual (500).
  if (!nado || !SID_OK.test(sid || '') || typeof k !== 'string' || !/^[0-9a-f]{32}$/.test(k)) return false;
  return crypto.timingSafeEqual(Buffer.from(k), Buffer.from(nado));
}
const adres = (shag, sid, lishnee = '') =>
  `${BAZA}${PUT}?shag=${shag}&p=${sid}&k=${metka(sid)}${lishnee}`;

// Сводка звучит только Андрею, в ширме. Короткая, без разметки.
function chistaSvodka(s) {
  // Суррогаты (эмодзи) выкидываем до обрезки: половинка пары на границе 140 роняет encodeURIComponent.
  return String(s || '').replace(/[\uD800-\uDFFF]/g, '').replace(/[<>&"'`\\{}\[\]|]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 140);
}

function formaTwilio(event) {
  const syroe = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  return new URLSearchParams(syroe);
}

function ne(pochemu) {
  return { ok: false, perevedeno: false, pochemu,
    skazat: 'Андрей сейчас не может ответить. Ваш вопрос он увидит сегодня же.',
    dalshe: 'НЕ говори, что переводишь. Предложи письмо и возьми адрес почты, если письма ещё не было.' };
}

async function twilio(put, telo) {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const tok = process.env.TWILIO_AUTH_TOKEN || '';
  const osn = Buffer.from(`${sid}:${tok}`).toString('base64');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${put}`, {
    method: telo ? 'POST' : 'GET',
    headers: { Authorization: 'Basic ' + osn,
               ...(telo ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: telo ? new URLSearchParams(telo).toString() : undefined,
  });
  const text = await r.text();
  let d = null;
  try { d = JSON.parse(text); } catch (_) { d = { syroe: text.slice(0, 200) }; }
  return { kod: r.status, telo: d };
}

// ── 1. Вера просит перевести ────────────────────────────────────────────────
async function perevesti(event) {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}

  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret)
    return otvet(401, ne('secret'));

  const callSid = String(b.call_sid || '').trim();
  if (!SID_OK.test(callSid)) {
    console.log('[perevod-ru] call_sid не похож на настоящий:', callSid.slice(0, 40));
    return otvet(200, ne('net_sid'));
  }

  const { kod, telo } = await twilio(`/Calls/${callSid}.json`);
  if (kod !== 200) {
    console.log('[perevod-ru] звонок не прочитался:', kod, JSON.stringify(telo).slice(0, 150));
    return otvet(200, ne('net_zvonka'));
  }
  if (telo.to !== NASH_RU) {
    console.log('[perevod-ru] чужой звонок, не на русскую линию:', telo.to);
    return otvet(200, ne('chuzhoy'));
  }
  if (telo.status !== 'in-progress') {
    console.log('[perevod-ru] звонок уже не в работе:', telo.status);
    return otvet(200, ne('ne_v_rabote'));
  }

  const svodka = chistaSvodka(b.svodka);
  const shirma = adres('shirma', callSid, svodka ? '&s=' + encodeURIComponent(svodka) : '');
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Play>${BAZA}/zvuk/soedinyayu.mp3</Play>` +
    `<Dial timeout="${ZHDEM}" callerId="${NASH_RU}" action="${xml(adres('itog', callSid))}" method="POST">` +
    `<Number url="${xml(shirma)}" method="POST">${KUDA}</Number></Dial>` +
    `</Response>`;

  const upd = await twilio(`/Calls/${callSid}.json`, { Twiml: twiml });
  if (upd.kod !== 200) {
    console.log('[perevod-ru] Twilio отказал:', upd.kod, JSON.stringify(upd.telo).slice(0, 200));
    return otvet(200, ne('twilio'));
  }

  console.log('[perevod-ru] звонок', callSid, 'переводится на Андрея, ждём', ZHDEM, 'с');
  return otvet(200, {
    ok: true, perevedeno: true, call_sid: callSid, skazat: '',
    dalshe: 'Перевод пошёл. Больше ничего не говори и не задавай вопросов — дальше человек.',
  });
}

// ── 2. Ширма: Андрей снял трубку, слышит это только он ──────────────────────
function shirma(q) {
  const sid = q.p || '';
  if (!metkaVerna(sid, q.k)) {
    console.log('[perevod-ru] ширма без верной метки — кладём трубку');
    return twimlOtvet('<Hangup/>');
  }
  const svodka = chistaSvodka(q.s);
  const tekst = `Звонок с линии Веры.${svodka ? ' ' + svodka + '.' : ''} Нажмите один, чтобы принять.`;
  const kuda = xml(adres('prinyat', sid));
  return twimlOtvet(
    `<Gather numDigits="1" timeout="6" action="${kuda}" method="POST">${SAY}${xml(tekst)}</Say></Gather>` +
    `<Gather numDigits="1" timeout="5" action="${kuda}" method="POST">${SAY}Нажмите один, чтобы принять звонок.</Say></Gather>` +
    '<Hangup/>');
}

// ── 3. Андрей нажал цифру ───────────────────────────────────────────────────
// Любая цифра = живой человек: автоответчик не жмёт ничего, а промах мимо единицы
// не должен стоить клиента.
function prinyat(event, q) {
  if (!metkaVerna(q.p || '', q.k)) return twimlOtvet('<Hangup/>');
  const cifra = (formaTwilio(event).get('Digits') || '').trim();
  if (/^[0-9*#]$/.test(cifra)) {
    console.log('[perevod-ru] Андрей принял звонок', q.p, 'цифрой', cifra);
    return twimlOtvet('');                 // пустой ответ = ширма кончилась, соединяем
  }
  console.log('[perevod-ru] цифры нет:', JSON.stringify(cifra).slice(0, 10));
  return twimlOtvet('<Hangup/>');
}

// ── 4. Итог дозвона: соединились — отбой, нет — фраза отката ────────────────
// Метку здесь не требуем нарочно: ответ безвреден (фраза и отбой), а сломанная метка
// не должна оставить звонящего без отката.
function itog(event) {
  const f = formaTwilio(event);
  const soedinilis = String(f.get('DialBridged') || '').toLowerCase() === 'true';
  console.log('[perevod-ru] итог:', f.get('DialCallStatus'), 'bridged=', soedinilis);
  if (soedinilis) return twimlOtvet('<Hangup/>');
  return twimlOtvet(`<Play>${BAZA}/zvuk/ne-otvetil.mp3</Play><Hangup/>`);
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  if (q.shag === 'shirma') return shirma(q);
  if (q.shag === 'prinyat') return prinyat(event, q);
  if (q.shag === 'itog') return itog(event);
  return perevesti(event);
};
