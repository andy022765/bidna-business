// Письмо владельцу после каждого звонка. ElevenLabs дёргает это сам, когда разговор
// закончился и расшифровка готова (post-call webhook).
//
// Почему отдельной функцией, а не внутри pismo.js: там стоит защита от дублей
// «одно письмо на адрес в сутки». Адрес владельца всегда один и тот же, и эта защита
// пропустила бы ему ОДИН звонок за день, а остальные молча съела. Здесь дублей нет
// по построению — только общий потолок на случай, если что-то зациклится.
//
// ДОВОДЧИК (15.09):
//   - дедуп повторного вебхука zvonok-obrabotan/<conv_id> = {s:'v_rabote'|'gotovo', t}: повтор ElevenLabs
//     больше не даёт владельцу второе письмо и не списывает минуты дважды. Повтор проходит, если прошло
//     больше 90 с, а gotovo так и нет — значит, первая попытка упала на полпути (урок скептика №5);
//   - связка с Telegram: ищем код, который pismo.js выдал в этом разговоре, и пишем zvonok/<conv_id>.
//     Подробно — у zapisatZvonok ниже.
//
// ПИСЬМО ВЛАДЕЛЬЦУ НЕ ЖДЁТ TELEGRAM (ревью 15.09 №5). До письма — только Blobs: дедуп (чтение и запись
// по 2 с каждое) и связка (код для строки «Код Telegram» и запись zvonok/*) — всё вместе не дольше
// DO_PISMA_MS = 5 с от начала вызова; не успели — письмо уходит без кода. Карточка в группу — ПОСЛЕ письма,
// не дольше 3 с, короткий таймаут Telegram и без ожидания 429. Не дошла — флаг kartochka_zvonka не ставится,
// и её дошлёт tg-vhod при следующем ответе в этом чате. Сколько живёт синхронная функция на нашем тарифе,
// не мерили (по документации Netlify бывало 10 с, на главном сайте упирались в 40), у ElevenLabs свой таймаут
// на вебхук — поэтому считаем от худшего: ни одна часть связки не держит письмо дольше 5 с.
//
// env: RESEND_API_KEY, GOLOS_VLADELEC (кому слать), ELEVENLABS_WEBHOOK_SECRET (подпись);
//      GOLOS_AGENTS (демо или телефон), DOGON_HRANIT_DNEY, DOGON_GRUPPA и TG_BOT_TOKEN (карточка в группу).

const crypto = require('crypto');

const JSON_H = { 'content-type': 'application/json' };
const OT = 'Business Intelligence DNA <hello@businessinteldna.com>';
const POTOLOK_V_SUTKI = +(process.env.GOLOS_PISEM_VLADELCU || 60);

const den = () => new Date().toISOString().slice(0, 10);

// Хранилище и сигналы Доводчика. Не поднялись — звонок обрабатывается как до 15.09.
let D = null;
try {
  const H = require('../dogon-lib/hranilishche');
  H.podklyuchitBlobs(require('@netlify/blobs').getStore);
  D = { H, M: require('../dogon-lib/meta'), S: require('../dogon-lib/signaly') };
} catch (e) { D = null; console.log('[zvonok] dogon-lib не поднялась, без связки с Telegram:', e.message); }

const DEN_MS = 24 * 3600 * 1000;
const CHAS_MS = 3600 * 1000;
const seychas = () => (typeof global.__DOGON_NOW__ === 'number' ? global.__DOGON_NOW__ : Date.now());
const sha256 = (s, n) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n);
const DEDUP_TAYMAUT_MS = 2000, SVYAZ_TAYMAUT_MS = 2500, KARTA_TAYMAUT_MS = 3000, DO_PISMA_MS = 5000;
const { performance } = require('perf_hooks');
const TAYMAUT = Symbol('taymaut');
function sTaymautom(p, ms) {
  let tm;
  const chasy = new Promise(r => { tm = setTimeout(() => r(TAYMAUT), ms); });
  return Promise.race([p, chasy]).finally(() => clearTimeout(tm));
}
// Скептик №7: некупившим 12 месяцев (privacy, раздел 11), а не 24.
const HRANIT_DNEY = () => +(process.env.DOGON_HRANIT_DNEY || 365);

function hranilishche(name) {
  try {
    const { getStore } = require('@netlify/blobs');
    const consistency = 'strong';
    try { return getStore({ name, consistency }); } catch (_) {}
    const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
    for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
      try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
    }
  } catch (_) {}
  return null;
}

// ElevenLabs подписывает тело: заголовок вида "t=<секунды>,v0=<hmac hex>".
// Без проверки эндпоинт открыт: кто угодно шлёт нам фальшивые звонки, а мы шлём письма.
function podpisVerna(raw, header, secret) {
  if (!secret) return { ok: false, pochemu: 'секрет не задан' };
  if (!header)  return { ok: false, pochemu: 'нет заголовка подписи' };
  const chasti = Object.fromEntries(header.split(',').map(x => x.split('=').map(s => s.trim())));
  const t = chasti.t, v0 = chasti.v0;
  if (!t || !v0) return { ok: false, pochemu: 'заголовок не разобрался' };
  const vozrast = Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10));
  if (!Number.isFinite(vozrast) || vozrast > 1800) return { ok: false, pochemu: 'подпись протухла' };
  const nash = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const a = Buffer.from(nash), b = Buffer.from(v0);
  const sovpalo = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok: sovpalo, pochemu: sovpalo ? '' : 'подпись не сошлась' };
}

const escape = v => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const mmss = sek => {
  const s = Math.max(0, Math.round(+sek || 0));
  return `${Math.floor(s / 60)} мин ${String(s % 60).padStart(2, '0')} с`;
};

// ---------- связка с Telegram ----------
// pismo.js кладёт код разговора в razgovor-kod/<conv_id>. Не нашли (демо, где платформа не подставила id,
// и код лёг по хэшу почты) — ищем по pochta/<sha256(почта)> среди писем за последний час (скептик №11).
async function najtiKodZvonka(store, conv, pochta) {
  if (conv) {
    const ukaz = await D.H.chitat(store, `razgovor-kod/${conv}`).catch(() => null);
    if (ukaz && ukaz.kod) {
      const z = await D.H.chitat(store, `kod/${ukaz.kod}`).catch(() => null);
      if (z) return { kod: ukaz.kod, zapis: z, kak: 'razgovor' };
    }
  }
  const email = String(pochta || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  const p = await D.H.chitat(store, `pochta/${sha256(email, 32)}`).catch(() => null);
  if (!p || !Array.isArray(p.kody)) return null;
  const t = seychas();
  for (const kod of p.kody) {
    const z = await D.H.chitat(store, `kod/${kod}`).catch(() => null);
    if (!z || z.email !== email) continue;
    if (t - (z.t_pisma || z.t || 0) > CHAS_MS) continue;
    if (z.razgovor && z.razgovor !== conv) continue;   // код чужого звонка с той же почтой
    return { kod, zapis: z, kak: 'pochta' };
  }
  return null;
}

// Телефон или демо на сайте. [не проверено] имена полей у ElevenLabs и Plivo: смотреть строку
// «[zvonok] ключи» в логе ближайшего звонка (SPEC §2 п. 3). Номер в v1 только храним.
function istochnikZvonka(d, meta, dv) {
  if (meta.phone_call || dv.system__caller_id || dv.system__called_number) return 'telefon';
  let agenty = {};
  try { agenty = JSON.parse(process.env.GOLOS_AGENTS || '{}'); } catch (_) {}
  if (meta.authorization_method === 'signed_url' || (d.agent_id && d.agent_id === agenty.demo)) return 'demo';
  return 'telefon';
}
// Что пишем (SPEC §2 с правками скептика и ревью 15.09):
//   - zvonok/<conv_id> — ТОЛЬКО когда код реально стоял в письме (kod.v_pisme) или это холостой прогон.
//     Скептик №7: иначе это новое хранилище расшифровок по всем звонкам, которого нет в privacy;
//     владельцу хватает письма. Реплик расшифровки не храним вовсе (№3, №10). Ревью №7: ни почты,
//     ни телефона, ни номера звонящего — ни модели, ни карточке они не нужны, а срок хранения у записи год.
//     Остаются имя (проверка «не назвала ли модель имя из карточки»), четыре поля, итог, источник, длительность;
//   - код нашёлся по почте — дописываем в kod/* id разговора и razgovor-kod/<conv_id>, чтобы чат нашёл звонок;
//   - привязанным к коду чатам ставим razgovor. Карточку в группу шлёт kartochkaVChaty — после письма.
// Только Blobs, без Telegram: вызывается до письма владельцу под таймаутом SVYAZ_TAYMAUT_MS.
async function zapisatZvonok({ store, conv, d, meta, sobrano, itog }) {
  const najden = await najtiKodZvonka(store, conv, sobrano.pochta);
  if (!najden) { console.log('[zvonok] кода Telegram в этом разговоре нет — zvonok/* не пишу'); return null; }
  const { kod, kak } = najden;
  let zapis = najden.zapis;
  if (zapis.udaleno_t) { console.log('[zvonok] код', kod, '— данные удалены по просьбе человека, не пишу'); return null; }
  if (!zapis.v_pisme && !zapis.suhoy) { console.log('[zvonok] код', kod, 'в письмо не попал (DOGON_V_PISME выкл) — zvonok/* не пишу'); return null; }
  if (!conv) { console.log('[zvonok] у звонка нет conversation_id — zvonok/* не к чему привязать'); return { kod, zapis }; }

  const t = seychas();
  const dv = (d.conversation_initiation_client_data && d.conversation_initiation_client_data.dynamic_variables) || {};
  const zvonok = {
    conv, agent_id: String(d.agent_id || ''), istochnik: istochnikZvonka(d, meta, dv),
    t: meta.start_time_unix_secs ? meta.start_time_unix_secs * 1000 : t,
    dlit: Math.round(+meta.call_duration_secs || 0),
    sobrano: { imya: sobrano.imya, zachem: sobrano.zachem, biznes: sobrano.biznes, obeshchali: sobrano.obeshchali, hvost: sobrano.hvost },
    itog: String(itog || '').slice(0, 3000),
    kod,
    exp: t + HRANIT_DNEY() * DEN_MS,
  };
  await D.H.pisat(store, `zvonok/${conv}`, zvonok);
  console.log('[zvonok] zvonok/* записан, код', kod, `(нашла по ${kak === 'pochta' ? 'почте' : 'id разговора'}, ${zvonok.istochnik})`);

  if (kak === 'pochta') {
    // Перечитываем свежую запись прямо перед правкой: tg-vhod мог только что дописать chaty.
    const svezh = await D.H.chitat(store, `kod/${kod}`).catch(() => null);
    if (svezh && !svezh.razgovor) {
      svezh.razgovor = conv;
      await D.H.pisat(store, `kod/${kod}`, svezh);
      zapis = svezh;
    }
    await D.H.pisat(store, `razgovor-kod/${conv}`, { kod, t, exp: zapis.exp || t + 30 * DEN_MS });
  }

  const chaty = [];
  for (const c of (Array.isArray(zapis.chaty) ? zapis.chaty : [])) {
    try {
      let nash = false;
      await D.M.obnovitMeta(store, c.bc, c.chat, (x) => {
        if (x.kod !== kod || x.status === 'udalen') return false;
        if (x.razgovor && x.razgovor !== conv) return false;
        nash = true;
        if (x.razgovor) return false;
        x.razgovor = conv;
      });
      if (nash) chaty.push(c);
    } catch (e) { console.log('[zvonok] чат не привязан к звонку:', e.message); }
  }
  return { conv, kod, zapis, zvonok, chaty };
}

// Карточка звонка в тему уже привязанного чата (человек написал, пока шёл звонок; SPEC §2 п. 5).
// Флаг kartochka_zvonka — только когда дошла: иначе дошлёт tg-vhod при следующем ответе.
async function kartochkaVChaty(store, { conv, zapis, zvonok, chaty }) {
  for (const c of chaty || []) {
    try {
      const m = await D.M.chitatMeta(store, c.bc, c.chat);
      if (!m || m.razgovor !== conv || m.kartochka_zvonka || m.status === 'udalen') continue;
      const doshlo = await D.S.signal('karta_zvonka', { meta: m, stroki: D.S.strokiKartochki(m, zapis, zvonok), bystro: true });
      if (doshlo) await D.M.obnovitMeta(store, c.bc, c.chat, (x) => { x.kartochka_zvonka = true; });
      else console.log('[zvonok] карточка не дошла — дошлёт tg-vhod при следующем ответе в чате');
    } catch (e) { console.log('[zvonok] карточка в чат не ушла:', e.message); }
  }
}

function telo({ kogda, dlit, sobrano, itog, dialog, ssylka, kod, potolok }) {
  const stroka = (k, v) => v
    ? `<tr><td style="padding:6px 14px 6px 0;color:#7C877F;white-space:nowrap;vertical-align:top">${escape(k)}</td>
         <td style="padding:6px 0;font-weight:600">${escape(v)}</td></tr>` : '';

  const repliki = (dialog || []).map(r => {
    const svoy = r.kto === 'agent';
    return `<div style="margin:0 0 9px">
      <div style="font:600 11px/1.4 -apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${svoy ? '#3E8F72' : '#96A199'}">${svoy ? 'Вера' : 'Звонивший'}</div>
      <div style="color:${svoy ? '#2E3A34' : '#161A17'}">${escape(r.text)}</div></div>`;
  }).join('');

  return `<!doctype html><html lang="ru"><body style="margin:0;background:#F6F8F5;padding:26px 14px;
font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#161A17">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E1E6E0;border-radius:14px;padding:24px 24px 26px">
  <div style="font:700 12px/1 -apple-system,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#3E8F72">Входящий звонок</div>
  <div style="font-size:20px;font-weight:700;margin:10px 0 4px">${escape(sobrano.imya || 'Имя не назвали')}</div>
  <div style="color:#7C877F;font-size:14px;margin-bottom:18px">${escape(kogda)} · ${escape(mmss(dlit))}</div>

  <table style="border-collapse:collapse;font-size:15px;margin-bottom:18px">
    ${stroka('Телефон', sobrano.telefon)}
    ${stroka('Почта', sobrano.pochta)}
    ${stroka('Зачем звонил', sobrano.zachem)}
    ${stroka('Что за бизнес', sobrano.biznes)}
    ${stroka('Что обещали', sobrano.obeshchali)}
    ${stroka('Осталось висеть', sobrano.hvost)}${stroka('Код Telegram', kod)}
  </table>

  ${itog ? `<div style="background:#F2F7F3;border-left:3px solid #55C79A;border-radius:0 8px 8px 0;padding:12px 14px;margin-bottom:20px">
    <div style="font:600 11px/1 -apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#7C877F;margin-bottom:7px">О чём говорили</div>
    <div>${escape(itog)}</div></div>` : ''}

  ${repliki ? `<details style="margin-bottom:18px">
    <summary style="cursor:pointer;font-weight:600;color:#3E8F72;font-size:14px">Расшифровка целиком</summary>
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid #E1E6E0;font-size:14px">${repliki}</div>
  </details>` : ''}

  ${ssylka ? `<div style="font-size:13px"><a href="${escape(ssylka)}" style="color:#3E8F72">Разговор у вендора</a></div>` : ''}
  ${potolok ? `<div style="margin-top:18px;padding:12px 14px;border:1px solid #C4675A;
    border-radius:8px;color:#C4675A;font-size:13px;font-weight:600">
    Это последнее письмо о звонках за сегодня: достигнут дневной предел в ${potolok}.
    Звонки принимаются как обычно и разговоры сохраняются, но писем о них сегодня
    больше не будет. Предел задаётся переменной GOLOS_PISEM_VLADELCU.
  </div>` : ''}
  <div style="margin-top:20px;padding-top:16px;border-top:1px solid #E1E6E0;color:#7C877F;font-size:13px">
    Письмо собрано автоматически по итогам звонка.
  </div>
</div></body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: JSON_H, body: '{}' };
  const start = performance.now();

  const raw = event.body || '';
  const h = event.headers || {};
  const sig = h['elevenlabs-signature'] || h['ElevenLabs-Signature'];
  const proverka = podpisVerna(raw, sig, process.env.ELEVENLABS_WEBHOOK_SECRET);
  if (!proverka.ok) {
    console.log('[zvonok] отбой:', proverka.pochemu);
    return { statusCode: 401, headers: JSON_H, body: '{}' };
  }

  let b = {};
  try { b = JSON.parse(raw); } catch (_) { return { statusCode: 400, headers: JSON_H, body: '{}' }; }
  if (b.type && b.type !== 'post_call_transcription') {
    console.log('[zvonok] пропускаю тип', b.type);
    return { statusCode: 200, headers: JSON_H, body: '{}' };
  }

  const d = b.data || b;
  const meta = d.metadata || {};
  const analiz = d.analysis || {};

  // Дедуп — после проверки типа, не раньше: post_call_audio приходит с тем же conversation_id
  // и, отметившись первым, съел бы письмо о звонке.
  // Blobs 8.2.0 без onlyIfNew: get-затем-set. Два повтора в одну миллисекунду — не наш объём.
  const conv = /^conv_[\w-]{6,80}$/.test(String(d.conversation_id || '')) ? String(d.conversation_id) : '';
  let dogon = D ? D.H.hranilishche() : null;
  const kDedup = conv ? `zvonok-obrabotan/${conv}` : '';
  if (dogon && kDedup) {
    try {
      const t = seychas();
      const byl = await sTaymautom(D.H.chitat(dogon, kDedup), DEDUP_TAYMAUT_MS);
      if (byl === TAYMAUT) throw new Error(`хранилище не ответило за ${DEDUP_TAYMAUT_MS} мс`);
      if (byl && (byl.s === 'gotovo' || t - (byl.t || 0) < 90 * 1000)) {
        console.log('[zvonok] повтор вебхука', conv, `(${byl.s}) — пропускаю`);
        return { statusCode: 200, headers: JSON_H, body: '{}' };
      }
      if (await sTaymautom(D.H.pisat(dogon, kDedup, { s: 'v_rabote', t, exp: t + 7 * DEN_MS }), DEDUP_TAYMAUT_MS) === TAYMAUT)
        throw new Error(`отметка не записалась за ${DEDUP_TAYMAUT_MS} мс`);
    } catch (e) {
      // лучше второе письмо владельцу, чем ни одного; и не ждём дальше мёртвое хранилище
      console.log('[zvonok] дедуп недоступен, обрабатываю без него:', e.message);
      dogon = null;
    }
  }
  const gotovo = async () => {
    if (!dogon || !kDedup) return;
    const t = seychas();
    try { if (await sTaymautom(D.H.pisat(dogon, kDedup, { s: 'gotovo', t, exp: t + 7 * DEN_MS }), DEDUP_TAYMAUT_MS) === TAYMAUT) throw new Error('таймаут'); }
    catch (e) { console.log('[zvonok] отметка «готово» не записана:', e.message); }
  };
  let svyaz = null;
  // Карточка — после письма (или после любого раннего выхода), и не дольше KARTA_TAYMAUT_MS.
  const kartochka = async () => {
    if (!dogon || !svyaz || !svyaz.chaty || !svyaz.chaty.length) return;
    try {
      if (await sTaymautom(kartochkaVChaty(dogon, svyaz), KARTA_TAYMAUT_MS) === TAYMAUT)
        console.log(`[zvonok] карточка не успела за ${KARTA_TAYMAUT_MS} мс — дошлёт tg-vhod`);
    } catch (e) { console.log('[zvonok] карточка:', e.message); }
  };
  const OK = async () => { await kartochka(); await gotovo(); return { statusCode: 200, headers: JSON_H, body: '{}' }; };

  // Поля, которые агент собрал сам по описанию в data_collection.
  const dc = analiz.data_collection_results || {};
  const vz = (imya) => {
    const v = dc[imya];
    if (v == null) return '';
    const z = (typeof v === 'object') ? (v.value ?? v.result ?? '') : v;
    return (z == null || z === 'null' || z === 'None') ? '' : String(z).trim();
  };
  // Номер звонящего. До 16.09 в письмо шёл только тот, что Вера записала со слов, — а его
  // человек может не назвать, назвать чужой или продиктовать с ошибкой. Определившийся номер
  // надёжнее: при переадресации оператор передаёт исходного звонящего в From, его и берём.
  // Если карьер звонящего номер не отдал, остаётся то, что записано со слов.
  const dvSys = (d.conversation_initiation_client_data && d.conversation_initiation_client_data.dynamic_variables) || {};
  const opredelilsya = String((meta.phone_call || {}).external_number || dvSys.system__caller_id || '').trim();
  const soSlov = vz('telefon');
  const hvostN = (s) => String(s).replace(/\D/g, '').slice(-10);
  const telefon = !opredelilsya ? soSlov
    : opredelilsya + (soSlov && hvostN(soSlov) !== hvostN(opredelilsya) ? ` (определился; со слов — ${soSlov})` : '');
  const sobrano = {
    imya:       vz('imya'),
    telefon,
    pochta:     vz('pochta'),
    zachem:     vz('zachem'),
    biznes:     vz('biznes'),
    obeshchali: vz('obeshchali'),
    hvost:      vz('hvost'),
  };

  const dialog = (d.transcript || []).map(r => ({
    kto: r.role === 'agent' ? 'agent' : 'user',
    text: r.message || '',
  })).filter(r => r.text);

  // Связка с Telegram, часть 1 (только Blobs). Имена ключей — без значений, в логах нет ни номера, ни почты.
  if (dogon) {
    const dv = (d.conversation_initiation_client_data && d.conversation_initiation_client_data.dynamic_variables) || {};
    console.log('[zvonok] ключи: metadata', Object.keys(meta).join(','), '· phone_call', Object.keys(meta.phone_call || {}).join(','),
                '· dynamic_variables', Object.keys(dv).join(','));
    // Сколько осталось до письма: дедуп мог уже съесть почти всё.
    const ostalos = Math.min(SVYAZ_TAYMAUT_MS, Math.round(DO_PISMA_MS - (performance.now() - start)));
    if (ostalos < 300) console.log('[zvonok] хранилище медленное, на связку времени нет — письмо владельцу без кода');
    else try {
      const r = await sTaymautom(zapisatZvonok({ store: dogon, conv, d, meta, sobrano, itog: analiz.transcript_summary || '' }), ostalos);
      if (r === TAYMAUT) console.log(`[zvonok] связка не успела за ${ostalos} мс — письмо владельцу без кода`);
      else svyaz = r;
    } catch (e) { console.log('[zvonok] связка с Telegram упала:', e.message); }
  }
  // Строка «Код Telegram» — только если код был в письме человеку; флаг выключен — письмо прежнее до байта.
  const kodVPisme = svyaz && svyaz.zapis && svyaz.zapis.v_pisme ? svyaz.kod : '';

  // Потолок писем за сутки. МОЛЧАЛИВЫЙ потолок — это дыра: у занятого сервиса шестьдесят
  // звонков в день норма, и с шестьдесят первого владелец просто перестаёт узнавать
  // о звонках, без предупреждения. Поймано 26.09 на собственной обкатке. Поэтому
  // в ПОСЛЕДНЕМ письме перед потолком дописываем строку, что дальше сегодня писем не будет.
  let posledneePeredPotolkom = false;
  const store = hranilishche('golos-zvonki');
  if (store) {
    try {
      const kl = `${den()}:__vsego`;
      const n = parseInt(await store.get(kl) || '0', 10);
      if (n >= POTOLOK_V_SUTKI) {
        console.log('[zvonok] дневной потолок писем достигнут');
        return OK();
      }
      posledneePeredPotolkom = n + 1 >= POTOLOK_V_SUTKI;
      await store.set(kl, String(n + 1));
    } catch (e) { console.log('[zvonok] счётчик недоступен:', e.message); }
  }

  // Поправляем месячный счётчик минут: при выдаче адреса мы заняли аванс,
  // теперь знаем настоящую длительность. Разница может быть и отрицательной —
  // так счётчик показывает правду, а не наши опасения.
  const REZERV = +(process.env.GOLOS_REZERV_MINUT || 6);
  const kvota = hranilishche('golos-kvota');   // то же хранилище, что у golos-url.js
  if (kvota) {
    try {
      const kMin = `${new Date().toISOString().slice(0, 7)}:__minut`;
      const bylo = parseFloat(await kvota.get(kMin) || '0');
      const fakt = Math.max(0, (+meta.call_duration_secs || 0) / 60);
      const stalo = Math.max(0, bylo - REZERV + fakt);
      await kvota.set(kMin, stalo.toFixed(2));
      console.log(`[zvonok] минуты: было ${bylo.toFixed(1)}, факт ${fakt.toFixed(1)}, стало ${stalo.toFixed(1)}`);
    } catch (e) { console.log('[zvonok] счётчик минут:', e.message); }
  }

  const komu = (process.env.GOLOS_VLADELEC || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!komu.length || !process.env.RESEND_API_KEY) {
    console.log('[zvonok] некому или нечем слать');
    return OK();
  }

  const nachalo = meta.start_time_unix_secs ? new Date(meta.start_time_unix_secs * 1000) : new Date();
  const kogda = nachalo.toLocaleString('ru-RU', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });
  const zagolovok = sobrano.imya
    ? `Звонок: ${sobrano.imya}${sobrano.telefon ? ' · ' + sobrano.telefon : ''}`
    : 'Входящий звонок';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: OT, to: komu,
        reply_to: sobrano.pochta ? [sobrano.pochta] : undefined,
        subject: zagolovok,
        html: telo({
          kogda, dlit: meta.call_duration_secs, sobrano,
          itog: analiz.transcript_summary || '',
          dialog,
          ssylka: d.conversation_id
            ? `https://elevenlabs.io/app/agents/history/${d.conversation_id}` : '',
          kod: kodVPisme,
          potolok: posledneePeredPotolkom ? POTOLOK_V_SUTKI : 0,
        }),
      }),
    });
    console.log('[zvonok] resend', r.status, (await r.text()).slice(0, 160));
  } catch (e) {
    console.log('[zvonok] упало:', e.message);
  }

  // ── расшифровка ЧЕЛОВЕКУ, который говорил (23.09.2026) ──────────────────────
  // Страница «спасибо» обещает дословно: «Расшифровку вашего собственного разговора
  // пришлём на почту, отметив вопросы, на которые она не ответила». Девять дней это
  // не делал никто, и Андрей спросил прямо: «почему у нас расшифровка руками?».
  //
  // Адрес в разговоре НЕ передаётся — в ссылке идёт короткий код, а сам адрес лежит
  // у vera-adres.js за секретом. Иначе почта осела бы в истории браузера, и любой
  // с этой ссылкой слал бы расшифровки куда угодно.
  //
  // Письмо двуязычное (решение Андрея 23.09): на какой странице человек оказался —
  // не доказательство того, на каком языке он читает.
  try {
    const metka = String(dvSys.metka_pochty || '').trim();
    if (metka && dialog.length) {
      const baza = process.env.URL || 'https://dezhurny-r4p8w2.netlify.app';
      const a = await fetch(baza + '/.netlify/functions/vera-adres?metka=' + encodeURIComponent(metka),
                            { headers: { 'x-vera-secret': process.env.VERA_ADRES_SECRET || '' } });
      const ad = a.ok ? await a.json() : null;
      if (!ad || !ad.ok || !ad.email) {
        console.log('[zvonok] метка есть, адреса нет:', (ad && ad.why) || 'ответа нет');
      } else {
        const stroki = dialog.map(r =>
          `<p style="margin:0 0 10px"><b style="color:${r.kto === 'agent' ? '#8a6d00' : '#555'}">` +
          `${r.kto === 'agent' ? 'Вера / Vera' : 'Вы / You'}:</b> ${escape(r.text)}</p>`).join('');
        const visit = sobrano.hvost
          ? `<div style="border-left:3px solid #d33;padding:8px 14px;margin:18px 0;background:#fff6f6">
               <p style="margin:0 0 6px"><b>На это она не ответила:</b> ${escape(sobrano.hvost)}</p>
               <p style="margin:0;color:#666"><b>She could not answer this.</b> В вашей установке
               этот ответ пишется в лист правды, и со следующего звонка он у неё есть.
               In your own setup this answer goes into the fact sheet, and from the next call she has it.</p>
             </div>`
          : `<p style="color:#666">Вопросов без ответа не осталось. · She answered everything you asked.</p>`;
        const pismo = `<div style="font:15px/1.6 -apple-system,system-ui,Segoe UI,sans-serif;max-width:640px;color:#111">
          <p>Вот расшифровка вашего разговора с Верой — ${escape(kogda)}, ${mmss(meta.call_duration_secs || 0)}.</p>
          <p style="color:#666">Here is the transcript of your conversation with Vera.</p>
          ${visit}
          <div style="border-top:1px solid #e5e5e5;padding-top:14px">${stroki}</div>
          <p style="color:#666;border-top:1px solid #e5e5e5;padding-top:14px;margin-top:18px">
            Вера отвечала по нашему листу правды, а не по вашему — поэтому про ваш бизнес она
            ничего не знала. В вашей установке лист правды ваш: цены, часы, услуги, чего вы не делаете.<br>
            Vera answered from our fact sheet, not yours, which is why she knew nothing about your
            business. In your own setup the fact sheet is yours.</p>
          <p style="color:#666">Business Intelligence DNA · support@businessinteldna.com</p>
        </div>`;
        const rc = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: 'Business Intelligence DNA <support@businessinteldna.com>',
            to: [ad.email], reply_to: ['support@businessinteldna.com'],
            subject: 'Расшифровка вашего разговора с Верой / Your conversation with Vera',
            html: pismo,
          }),
        });
        console.log('[zvonok] расшифровка человеку:', rc.status);
      }
    }
  } catch (e) {
    console.log('[zvonok] расшифровка человеку упала:', e.message);
  }
  return OK();
};
