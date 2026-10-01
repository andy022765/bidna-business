// Прогон фейковых апдейтов Telegram через tg-vhod-background.js — без сети, без Blobs, без Anthropic.
//
//   node progon.mjs                 все файлы из updates/
//   node progon.mjs 02 08 sk4       только файлы, имя которых начинается с 02, 08 или содержит «sk4»
//   node progon.mjs --podrobno      у проваленных печатать лог функции и все вызовы Telegram
//
// Тестовые хуки — единый контракт с ядром (модули dogon-lib смотрят глобалы):
//   global.__DOGON_TEST_STORE__  — хранилище вместо Blobs (реализовано здесь, sozdatHranilishche);
//   global.__DOGON_FAKE_TG__     — массив: tg.js кладёт туда {method, body} вместо сети;
//   global.__DOGON_STUB_MODEL__  — async (messages, system) => объект ответа модели;
//   global.__DOGON_NOW__         — «сейчас» в мс;
//   global.__DOGON_BYSTRO__      — ожидание 6 с превращается в 0.
// Страховка сверх контракта: глобальный fetch подменён. Вызов api.telegram.org, мимо массива
// (например, сигнал ОШИБКА «прямым fetch», скептик №5), попадает в тот же список вызовов;
// api.anthropic.com отвечает той же заглушкой модели; всё остальное получает 503 и пишется в лог.
// Ни один случай не может уйти в настоящий Telegram или потратить деньги на модель.
//
// Формат файла updates/NN-*.json:
//   opisanie            что проверяем и откуда требование (SPEC §7.1 / скептик №)
//   podgotovka          {ключ Blobs: значение}; объекты кладутся JSON-строкой, строки как есть
//   env                 поверх переменных по умолчанию
//   update | updates    один апдейт или список; элемент списка — апдейт, {now, update} или {now, obkhod: true} —
//                       запуск обхода tg-dogon.js по расписанию (ревью 15.09 №12: «без ответа» и чистка)
//   parallelno          true — все updates запускаются одновременно (случай «три сообщения за 2 с»)
//   now                 базовое «сейчас», ISO; по умолчанию 2026-09-15T18:20:00Z (14:20 в Нью-Йорке)
//   sekret              заголовок секрета, по умолчанию совпадает с TG_WEBHOOK_SECRET
//   stub_model          ответ модели или список ответов по порядку вызовов; {"__oshibka": "..."} — модель падает
//   model_cherez_fetch  true — __DOGON_STUB_MODEL__ не задаём: mozgi.js идёт настоящим fetch на api.anthropic.com,
//                       перехватчик отвечает той же заглушкой (ошибка → 529). Проверяет сборку запроса и разбор ответа
//   tg_cherez_fetch     true — массив __DOGON_FAKE_TG__ не задаём, Telegram идёт настоящим fetch в перехватчик
//                       (нужно, чтобы вернуть ошибку или знать message_id ответа)
//   tg_oshibki          [{method, business: true|false, error_code, description}] — ответы-ошибки перехватчика
//   slomat_hranilishche true — любой вызов хранилища бросает исключение
//   slomat_posle_klientu true — запись в хранилище бросает, как только клиенту ушла хоть одна отправка
//
// Подстановки в podgotovka / env / update:
//   "@now", "@now-120s", "@now+24h", "@now-31d"   → мс;   "@unix", "@unix-2m" → секунды
//   {den} в ключах                                → YYYY-MM-DD (UTC) базового «сейчас»
//   "@posl_klientu_tekst" / "@posl_klientu_message_id" → текст / message_id последней отправки клиенту
//                                                    (message_id известен только в режиме tg_cherez_fetch)
//
// ozhidaem (всё необязательно; те же ключи можно дать в po_shagam для отдельного шага):
//   tg_metody [..]            каждый метод вызван хотя бы раз          tg_metody_net [..]  ни разу
//   net_tg true|false         ни одного вызова Telegram / хотя бы один
//   klientu N                 отправок клиенту (send* с business_connection_id, без sendChatAction), считая неудачные
//   klientu_knopki true       у отправки клиенту есть inline_keyboard
//   klientu_tekst_max N       каждый текст клиенту не длиннее N
//   tekst_soderzhit / tekst_ne_soderzhit [..]     подстроки в текстах клиенту (без учёта регистра)
//   gruppe_est true|false     были / не были сообщения в DOGON_GRUPPA
//   signal_soderzhit / signal_ne_soderzhit [..]   подстроки в текстах группы (без учёта регистра)
//   otpravleno_v [{chat_id, knopki, tekst_soderzhit}]  отправка в конкретный чат (личка бота и т. п.)
//   meta_chat N               чей meta смотреть (по умолчанию чат первого апдейта)
//   meta_status "..." | [..]  status в chat/<bc>/<chat>/meta
//   meta_polya {..}           частичное совпадение; сравнения "@>now", "@>now+23h", "@<=now", "@pusto",
//                             "@ne_pusto", "@pusto_ili_proshlo"; массив — каждый ожидаемый элемент найден
//   klyuchi_est / klyuchi_net [..]  ключи Blobs, * — любые знаки
//   znachenie {ключ: {..}}    частичное совпадение значения
//   hranilishche_soderzhit / tekst_ne_hranitsya [..]  подстрока в каком-либо / ни в одном значении Blobs
//   hranilishche_pusto true   в Blobs ни одного ключа
//   model_vyzovov N / model_vyzovov_max N
//   v_model_est / v_model_net [..]  подстроки во всём, что ушло в модель (messages + system)
//   zapros_modeli {..}        частичное совпадение с телом каждого запроса к Anthropic (только model_cherez_fetch)
//   po_shagam [{shag: n | shagi: [от, до], ...}]  проверки после конкретного шага (нумерация с 1)
//   brosaet true              обработчик ОБЯЗАН бросить исключение (ревью 15.09 №11: сбой до отправки клиенту
//                             уходит наружу, чтобы Netlify повторил фоновую функцию); число — сколько раз из всех шагов
//
// Проверяется всегда: обработчик не бросает исключение (кроме brosaet) и не висит дольше 20 с; токен бота и ключ
// Anthropic не попали ни в лог, ни в тело вызовов; клиенту без parse_mode и не длиннее 4096;
// readBusinessMessage не вызывается (SPEC §3); хранилищу не отдают объект вместо строки.

import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ZDES = dirname(fileURLToPath(import.meta.url));
const SAYT = resolve(ZDES, '../../../golos/site');
// DOGON_PROGON_FUNKCIYA — подменить функцию (самопроверка прогона на заглушке), по умолчанию боевой файл.
const FUNKCIYA = process.env.DOGON_PROGON_FUNKCIYA ? resolve(process.env.DOGON_PROGON_FUNKCIYA) : join(SAYT, 'netlify-functions/tg-vhod-background.js');
const PAPKA = join(ZDES, 'updates');
const OBKHOD = join(dirname(FUNKCIYA), 'tg-dogon.js');

const TOKEN = '777000:TEST-token-ne-dolzhen-popast-v-logi';
const KLYUCH_MODELI = 'sk-ant-test-ne-dolzhen-popast-v-logi';
const ENV_PO_UMOLCHANIYU = {
  TG_WEBHOOK_SECRET: 'test', DOGON_REZHIM: 'kod', DOGON_KOPII: '0', DOGON_GRUPPA: '-1001', DOGON_ADMINY: '111',
  TG_BOT_TOKEN: TOKEN, TG_USERNAME: 'business_int_dna', DOGON_PAUZA_CHASOV: '24', DOGON_DOGONYAT: '0',
  DOGON_POCHTA_POSLE: '0', DOGON_V_PISME: '0', DOGON_ANDREY_PISHET: '0', DOGON_VYZOVOV_V_SUTKI: '60',
  DOGON_MODEL: 'claude-sonnet-5', ANTHROPIC_API_KEY_DOGON: KLYUCH_MODELI,
};
// Чтобы ни одна ветка не дотянулась до настоящих Blobs.
const ENV_UBRAT = ['EV_BLOBS_TOKEN', 'NETLIFY_API_TOKEN', 'SITE_ID', 'NETLIFY_SITE_ID', 'NETLIFY_BLOBS_CONTEXT', 'ANTHROPIC_API_KEY'];
const NOW_PO_UMOLCHANIYU = '2026-09-15T18:20:00Z';
const OTVET_MODELI_PO_UMOLCHANIYU = {
  tekst: 'По телефону вы спрашивали про Дежурного. Что осталось непонятным?',
  ssylka: 'net', segment: 'biznes', tema: 'dezhurny', signal: 'net',
  dlya_vladelcev: 'Спросила, что осталось непонятным после звонка', ne_otvetila: '',
};
const SEND = new Set(['sendMessage', 'sendPhoto', 'sendDocument', 'sendVoice', 'sendAudio', 'sendVideo', 'sendVideoNote',
  'sendAnimation', 'sendSticker', 'sendMediaGroup', 'copyMessage', 'forwardMessage', 'sendPoll', 'sendContact', 'sendLocation']);

const argv = process.argv.slice(2);
const PODROBNO = argv.includes('--podrobno');
const FILTR = argv.filter((a) => !a.startsWith('--'));

// ---------- хранилище в памяти, контракт @netlify/blobs 8.2.0 ----------
// Внутри строки, как в настоящих Blobs: set(ключ, объект) там превращается в «[object Object]»,
// поэтому здесь это не молча, а замечание, валящее случай.
function sozdatHranilishche({ slomano = false, slomanoLi = null, zamechaniya = [] } = {}) {
  const data = new Map();
  let etag = 0;
  const bum = (op) => {
    if (slomano) throw new Error(`хранилище недоступно (тест: ${op})`);
    if (slomanoLi && op.startsWith('set') && slomanoLi()) throw new Error(`хранилище недоступно после отправки клиенту (тест: ${op})`);
  };
  const vStroku = (key, val) => {
    if (typeof val === 'string') return val;
    if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) return Buffer.from(val).toString('utf8');
    zamechaniya.push(`set("${key}") получил ${typeof val}, а не строку — в Blobs ляжет «${String(val).slice(0, 30)}»`);
    return String(val);
  };
  const razobrat = (key, v, type) => {
    if (type === 'json') return JSON.parse(v);
    if (type === 'arrayBuffer') return new TextEncoder().encode(v).buffer;
    if (type === 'blob') return new Blob([v]);
    if (type === 'stream') return new Blob([v]).stream();
    return v;
  };
  const store = {
    _data: data,
    async get(key, opts = {}) {
      bum('get'); await null;
      if (!data.has(key)) return null;
      return razobrat(key, data.get(key).v, opts.type);
    },
    async getWithMetadata(key, opts = {}) {
      bum('getWithMetadata'); await null;
      if (!data.has(key)) return null;
      const z = data.get(key);
      return { data: razobrat(key, z.v, opts.type), etag: z.etag, metadata: z.metadata || {} };
    },
    async getMetadata(key) {
      bum('getMetadata'); await null;
      if (!data.has(key)) return null;
      const z = data.get(key);
      return { etag: z.etag, metadata: z.metadata || {} };
    },
    async set(key, val, opts = {}) {
      bum('set'); await null;
      if (opts.onlyIfNew || opts.onlyIfMatch) zamechaniya.push(`set("${key}") с onlyIfNew/onlyIfMatch — в 8.2.0 этих опций нет, они молча игнорируются`);
      data.set(key, { v: vStroku(key, val), metadata: opts.metadata, etag: `"e${++etag}"` });
      return { modified: true, etag: `"e${etag}"` };
    },
    async setJSON(key, val, opts = {}) {
      bum('setJSON'); await null;
      if (opts.onlyIfNew || opts.onlyIfMatch) zamechaniya.push(`setJSON("${key}") с onlyIfNew/onlyIfMatch — в 8.2.0 этих опций нет`);
      data.set(key, { v: JSON.stringify(val), metadata: opts.metadata, etag: `"e${++etag}"` });
      return { modified: true, etag: `"e${etag}"` };
    },
    async delete(key) { bum('delete'); await null; data.delete(key); },
    list(opts = {}) {
      bum('list');
      const prefix = opts.prefix || '';
      const blobs = [...data.keys()].filter((k) => k.startsWith(prefix)).sort()
        .map((key) => ({ key, etag: data.get(key).etag }));
      const stranica = { blobs, directories: [] };
      if (opts.paginate) return (async function* () { yield stranica; })();
      return Promise.resolve(stranica);
    },
  };
  return store;
}

// ---------- время и подстановки ----------
const EDINICY = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
const RE_VREMYA = /^(now|unix)(?:([+-])(\d+(?:\.\d+)?)(ms|s|m|h|d))?$/;
function vremya(vyrazhenie, now) {
  const m = RE_VREMYA.exec(vyrazhenie);
  if (!m) return null;
  const sdvig = m[2] ? (m[2] === '-' ? -1 : 1) * parseFloat(m[3]) * EDINICY[m[4]] : 0;
  return m[1] === 'now' ? now + sdvig : Math.floor((now + sdvig) / 1000);
}
const den = (now) => new Date(now).toISOString().slice(0, 10);

function podstavit(x, now, sost) {
  if (typeof x === 'string') {
    if (x === '@posl_klientu_tekst') return sost ? poslKlientu(sost)?.tekst ?? x : x;
    if (x === '@posl_klientu_message_id') return sost ? poslKlientu(sost)?.result_id ?? x : x;
    if (x.startsWith('@')) { const v = vremya(x.slice(1), now); if (v !== null) return v; }
    return x.replaceAll('{den}', den(now));
  }
  if (Array.isArray(x)) return x.map((e) => podstavit(e, now, sost));
  if (x && typeof x === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(x)) out[k.replaceAll('{den}', den(now))] = podstavit(v, now, sost);
    return out;
  }
  return x;
}

// ---------- разбор вызовов Telegram ----------
const tekstVyzova = (v) => String(v.body?.text ?? v.body?.caption ?? '');
const klientskiy = (v) => SEND.has(v.method) && v.body && v.body.business_connection_id;
function gruppovoy(v, env) { return SEND.has(v.method) && v.body && String(v.body.chat_id) === String(env.DOGON_GRUPPA); }
function poslKlientu(sost) {
  const k = sost.vyzovy().filter(klientskiy);
  const v = k[k.length - 1];
  return v ? { tekst: tekstVyzova(v), result_id: v.result_id } : null;
}
function razobratTelo(body) {
  if (body == null) return {};
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch (_) { return Object.fromEntries(new URLSearchParams(body)); }
  }
  if (body instanceof URLSearchParams) return Object.fromEntries(body);
  if (typeof FormData !== 'undefined' && body instanceof FormData) return Object.fromEntries(body);
  return body;
}
const estKnopki = (body) => {
  let rm = body?.reply_markup;
  if (typeof rm === 'string') { try { rm = JSON.parse(rm); } catch (_) { rm = null; } }
  return !!(rm && Array.isArray(rm.inline_keyboard) && rm.inline_keyboard.length);
};

// ---------- перехват fetch ----------
function ustanovitFetch(sost) {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url && url.url ? url.url : url);
    const telo = razobratTelo(opts.body);
    if (u.startsWith('https://api.telegram.org/')) {
      const method = u.split('?')[0].split('/').pop();
      const zapis = { method, body: telo, cherez: 'fetch' };
      const oshibka = (sost.sluchay.tg_oshibki || []).find((o) => o.method === method &&
        (o.business === undefined || !!o.business === !!telo.business_connection_id));
      if (oshibka) {
        zapis.oshibka = oshibka.description;
        sost.dobavitVyzov(zapis);
        return new Response(JSON.stringify({ ok: false, error_code: oshibka.error_code, description: oshibka.description }),
          { status: oshibka.error_code, headers: { 'content-type': 'application/json' } });
      }
      const id = ++sost.schetchikId;
      zapis.result_id = id;
      sost.dobavitVyzov(zapis);
      let result = { message_id: id, date: Math.floor(sost.now / 1000), chat: { id: telo.chat_id } };
      if (method === 'createForumTopic') result = { message_thread_id: id, name: telo.name, icon_color: 7322096 };
      if (method === 'getBusinessConnection') result = { id: telo.business_connection_id, user: { id: 7000, is_bot: false, first_name: 'Business Intelligence DNA' },
        user_chat_id: 7000, date: Math.floor(sost.now / 1000), rights: { can_reply: true }, is_enabled: true };
      if (method === 'getMe') result = { id: 9999, is_bot: true, first_name: 'Вера', username: 'bidna_vera_bot' };
      if (['answerCallbackQuery', 'sendChatAction', 'deleteMessage', 'deleteForumTopic', 'setWebhook'].includes(method)) result = true;
      return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.startsWith('https://api.anthropic.com/')) {
      try {
        sost.zaprosyModeli.push(telo);
        const otvet = await sost.zaglushkaModeli(telo.messages, telo.system);
        return new Response(JSON.stringify({ id: 'msg_test', type: 'message', role: 'assistant', model: telo.model,
          content: [{ type: 'text', text: JSON.stringify(otvet) }], stop_reason: 'end_turn',
          usage: { input_tokens: 3000, output_tokens: 120, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }),
          { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: e.message } }),
          { status: 529, headers: { 'content-type': 'application/json' } });
      }
    }
    sost.vneshnie.push(u);
    return new Response('{"ok":false,"test":"внешний адрес закрыт прогоном"}', { status: 503, headers: { 'content-type': 'application/json' } });
  };
}

// ---------- сравнения ----------
const nizhe = (s) => String(s).toLowerCase().replaceAll('ё', 'е');
const pusto = (v) => v === null || v === undefined || v === '' || v === 0 || v === false;

function sovpadaet(ozh, fakt, now, put, prichiny) {
  if (typeof ozh === 'string' && ozh.startsWith('@')) {
    if (ozh === '@pusto') { if (!pusto(fakt)) prichiny.push(`${put}: ждали пусто, есть ${JSON.stringify(fakt)}`); return; }
    if (ozh === '@ne_pusto') { if (pusto(fakt)) prichiny.push(`${put}: ждали значение, пусто`); return; }
    if (ozh === '@pusto_ili_proshlo') {
      if (!pusto(fakt) && !(typeof fakt === 'number' && fakt <= now)) prichiny.push(`${put}: ждали пусто или в прошлом, есть ${JSON.stringify(fakt)} (now ${now})`);
      return;
    }
    const m = /^@(>=|<=|>|<)(.+)$/.exec(ozh);
    if (m) {
      const granica = vremya(m[2], now);
      const ok = typeof fakt === 'number' && granica !== null &&
        ({ '>': fakt > granica, '>=': fakt >= granica, '<': fakt < granica, '<=': fakt <= granica })[m[1]];
      if (!ok) prichiny.push(`${put}: ждали ${ozh} (${granica}), есть ${JSON.stringify(fakt)}`);
      return;
    }
  }
  if (Array.isArray(ozh)) {
    if (!Array.isArray(fakt)) { prichiny.push(`${put}: ждали массив, есть ${JSON.stringify(fakt)}`); return; }
    ozh.forEach((e, i) => {
      const nashli = fakt.some((f) => { const p = []; sovpadaet(e, f, now, '', p); return p.length === 0; });
      if (!nashli) prichiny.push(`${put}[${i}]: элемент ${JSON.stringify(e)} не найден в ${JSON.stringify(fakt).slice(0, 200)}`);
    });
    return;
  }
  if (ozh && typeof ozh === 'object') {
    if (!fakt || typeof fakt !== 'object') { prichiny.push(`${put}: ждали объект, есть ${JSON.stringify(fakt)}`); return; }
    for (const [k, v] of Object.entries(ozh)) sovpadaet(v, fakt[k], now, put ? `${put}.${k}` : k, prichiny);
    return;
  }
  // числа и строки: 5001 и "5001" считаем одним и тем же (chat_id в JSON бывает и тем, и другим)
  if (String(ozh) !== String(fakt)) prichiny.push(`${put}: ждали ${JSON.stringify(ozh)}, есть ${JSON.stringify(fakt)}`);
}

const globVRegexp = (g) => new RegExp('^' + g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');

function chitatJSON(store, key) {
  const z = store._data.get(key);
  if (!z) return undefined;
  try { return JSON.parse(z.v); } catch (_) { return z.v; }
}

function naytiMeta(store, chat) {
  const tochno = [...store._data.keys()].filter((k) => globVRegexp(`chat/*/${chat}/meta`).test(k));
  return tochno.length ? { key: tochno[0], val: chitatJSON(store, tochno[0]) } : null;
}

function proverit(ozh, { vyzovy, modelVyzovy, zaprosyModeli = [], store, env, now, chatPoUmolchaniyu }) {
  const p = [];
  const metody = vyzovy.map((v) => v.method);
  const klient = vyzovy.filter(klientskiy);
  const gruppa = vyzovy.filter((v) => gruppovoy(v, env));
  const tekstyKlientu = nizhe(klient.map(tekstVyzova).join('\n---\n'));
  const tekstyGruppy = nizhe(gruppa.map(tekstVyzova).join('\n---\n'));
  const vseZnacheniya = [...store._data.values()].map((z) => z.v).join('\n');
  const vModel = JSON.stringify(modelVyzovy);

  for (const m of ozh.tg_metody || []) if (!metody.includes(m)) p.push(`не вызван ${m} (были: ${[...new Set(metody)].join(', ') || 'ничего'})`);
  for (const m of ozh.tg_metody_net || []) if (metody.includes(m)) p.push(`вызван запрещённый ${m}`);
  if (ozh.net_tg === true && vyzovy.length) p.push(`ждали тишину в Telegram, а было ${vyzovy.length}: ${metody.join(', ')}`);
  if (ozh.net_tg === false && !vyzovy.length) p.push('ждали хоть один вызов Telegram, не было ни одного');
  if (ozh.klientu !== undefined && klient.length !== ozh.klientu)
    p.push(`клиенту отправлено ${klient.length}, ждали ${ozh.klientu}${klient.length ? ': «' + klient.map(tekstVyzova).join('» / «').slice(0, 160) + '»' : ''}`);
  if (ozh.klientu_knopki && !klient.some((v) => estKnopki(v.body))) p.push('у отправки клиенту нет inline-кнопок');
  if (ozh.klientu_tekst_max !== undefined) for (const v of klient) {
    if (tekstVyzova(v).length > ozh.klientu_tekst_max) p.push(`текст клиенту ${tekstVyzova(v).length} знаков > ${ozh.klientu_tekst_max}`);
  }
  for (const s of ozh.tekst_soderzhit || []) if (!tekstyKlientu.includes(nizhe(s))) p.push(`в тексте клиенту нет «${s}»`);
  for (const s of ozh.tekst_ne_soderzhit || []) if (tekstyKlientu.includes(nizhe(s))) p.push(`в тексте клиенту есть запрещённое «${s}»`);
  if (ozh.gruppe_est === true && !gruppa.length) p.push('в группу ничего не ушло');
  if (ozh.gruppe_est === false && gruppa.length) p.push(`в группу ушло лишнее: «${tekstVyzova(gruppa[0]).slice(0, 100)}»`);
  for (const s of ozh.signal_soderzhit || []) if (!tekstyGruppy.includes(nizhe(s)))
    p.push(`в группе нет «${s}»${gruppa.length ? ' (было: «' + gruppa.map(tekstVyzova).join('» / «').slice(0, 160) + '»)' : ''}`);
  for (const s of ozh.signal_ne_soderzhit || []) if (tekstyGruppy.includes(nizhe(s))) p.push(`в группе есть лишнее «${s}»`);
  for (const o of ozh.otpravleno_v || []) {
    const tuda = vyzovy.filter((v) => SEND.has(v.method) && String(v.body?.chat_id) === String(o.chat_id));
    if (!tuda.length) { p.push(`в чат ${o.chat_id} ничего не отправлено`); continue; }
    if (o.knopki && !tuda.some((v) => estKnopki(v.body))) p.push(`в чат ${o.chat_id} ушло без кнопок`);
    for (const s of o.tekst_soderzhit || []) if (!nizhe(tuda.map(tekstVyzova).join('\n')).includes(nizhe(s))) p.push(`в чат ${o.chat_id} нет «${s}»`);
  }

  if (ozh.meta_status !== undefined || ozh.meta_polya) {
    const chat = ozh.meta_chat ?? chatPoUmolchaniyu;
    const meta = naytiMeta(store, chat);
    if (!meta) p.push(`нет chat/<bc>/${chat}/meta`);
    else {
      if (typeof meta.val !== 'object' || meta.val === null) p.push(`${meta.key} не JSON: ${String(meta.val).slice(0, 60)}`);
      else {
        const dopustimo = [].concat(ozh.meta_status ?? []);
        if (dopustimo.length && !dopustimo.includes(meta.val.status)) p.push(`meta.status = ${meta.val.status}, ждали ${dopustimo.join(' | ')}`);
        if (ozh.meta_polya) sovpadaet(ozh.meta_polya, meta.val, now, 'meta', p);
      }
    }
  }
  const klyuchi = [...store._data.keys()];
  for (const g of ozh.klyuchi_est || []) { const re = globVRegexp(podstavit(g, now)); if (!klyuchi.some((k) => re.test(k))) p.push(`нет ключа ${g}`); }
  for (const g of ozh.klyuchi_net || []) { const re = globVRegexp(podstavit(g, now)); const k = klyuchi.find((x) => re.test(x)); if (k) p.push(`лишний ключ ${k}`); }
  for (const [k0, ozhZn] of Object.entries(ozh.znachenie || {})) {
    const k = podstavit(k0, now);
    const fakt = chitatJSON(store, k);
    if (fakt === undefined) p.push(`нет ключа ${k}`);
    else sovpadaet(ozhZn, fakt, now, k, p);
  }
  for (const s of ozh.hranilishche_soderzhit || []) if (!vseZnacheniya.includes(s)) p.push(`в Blobs нет «${s}»`);
  for (const s of ozh.tekst_ne_hranitsya || []) {
    const k = klyuchi.find((x) => store._data.get(x).v.includes(s));
    if (k) p.push(`в Blobs хранится «${s}» (ключ ${k})`);
  }
  if (ozh.hranilishche_pusto && klyuchi.length) p.push(`в Blobs появились ключи: ${klyuchi.slice(0, 5).join(', ')}`);
  if (ozh.model_vyzovov !== undefined && modelVyzovy.length !== ozh.model_vyzovov) p.push(`модель вызвана ${modelVyzovy.length} раз, ждали ${ozh.model_vyzovov}`);
  if (ozh.model_vyzovov_max !== undefined && modelVyzovy.length > ozh.model_vyzovov_max) p.push(`модель вызвана ${modelVyzovy.length} раз, потолок ${ozh.model_vyzovov_max}`);
  for (const s of ozh.v_model_est || []) if (!vModel.includes(s)) p.push(`в модель не ушло «${s}»${modelVyzovy.length ? '' : ' (модель не вызывалась)'}`);
  for (const s of ozh.v_model_net || []) if (vModel.includes(s)) p.push(`в модель утекло «${s}»`);
  if (ozh.zapros_modeli) {
    if (!zaprosyModeli.length) p.push('запросов к api.anthropic.com не было');
    zaprosyModeli.forEach((z, i) => sovpadaet(ozh.zapros_modeli, z, now, `запрос ${i + 1}`, p));
  }
  return p;
}

// ---------- один случай ----------
const ozhidat = (ms) => new Promise((r) => setTimeout(r, ms));

async function progonSluchaya(fayl) {
  const sluchay = JSON.parse(readFileSync(join(PAPKA, fayl), 'utf8'));
  const prichiny = [];
  if (!sluchay.opisanie || !sluchay.ozhidaem || !(sluchay.update || sluchay.updates)) {
    return { prichiny: ['файл без opisanie / ozhidaem / update(s)'], logi: [], vyzovy: [] };
  }
  const bazaNow = Date.parse(sluchay.now || NOW_PO_UMOLCHANIYU);
  const zamechaniya = [];
  let sostRef = null;
  const store = sozdatHranilishche({ slomano: !!sluchay.slomat_hranilishche, zamechaniya,
    slomanoLi: sluchay.slomat_posle_klientu ? () => !!sostRef && (sostRef.vyzovy() || []).some(klientskiy) : null });

  // подготовка кладётся в обход «сломанности»
  for (const [k, v] of Object.entries(podstavit(sluchay.podgotovka || {}, bazaNow))) {
    store._data.set(k, { v: typeof v === 'string' ? v : JSON.stringify(v), etag: '"p"' });
  }

  // env
  const staryyEnv = { ...process.env };
  for (const k of ENV_UBRAT) delete process.env[k];
  Object.assign(process.env, ENV_PO_UMOLCHANIYU, podstavit(sluchay.env || {}, bazaNow));
  const env = { ...process.env };

  // состояние прогона
  const sobstvennye = [];
  const sost = {
    sluchay, now: bazaNow, schetchikId: 700, vneshnie: [], zaprosyModeli: [],
    vyzovy: () => (sluchay.tg_cherez_fetch ? sobstvennye : global.__DOGON_FAKE_TG__),
    dobavitVyzov: (z) => (sluchay.tg_cherez_fetch ? sobstvennye : global.__DOGON_FAKE_TG__).push(z),
  };
  sostRef = sost;
  global.__DOGON_TEST_STORE__ = store;
  global.__DOGON_FAKE_TG__ = sluchay.tg_cherez_fetch ? undefined : [];
  global.__DOGON_FAKE_TG_OTVET__ = undefined;   // необязательный хук tg.js; ошибки Telegram здесь дают tg_oshibki
  global.__DOGON_BYSTRO__ = true;
  global.__DOGON_NOW__ = bazaNow;
  const modelVyzovy = [];
  const otvety = sluchay.stub_model ?? OTVET_MODELI_PO_UMOLCHANIYU;
  sost.zaglushkaModeli = async (messages, system) => {
    modelVyzovy.push({ messages, system });
    const o = Array.isArray(otvety) ? otvety[Math.min(modelVyzovy.length - 1, otvety.length - 1)] : otvety;
    if (o && o.__oshibka) throw new Error(o.__oshibka);
    return JSON.parse(JSON.stringify(o));
  };
  global.__DOGON_STUB_MODEL__ = sluchay.model_cherez_fetch ? undefined : sost.zaglushkaModeli;
  ustanovitFetch(sost);

  // лог функции — в буфер (и проверка, что токен туда не попал)
  const logi = [];
  const origKonsol = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  const zapisLoga = (...a) => logi.push(a.map((x) => (typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch (_) { return String(x); } })())).join(' '));
  for (const k of Object.keys(origKonsol)) console[k] = zapisLoga;

  // свежие модули: константы из env читаются заново
  for (const k of Object.keys(require.cache)) if (k.startsWith(SAYT) || k.startsWith(dirname(FUNKCIYA))) delete require.cache[k];

  const vosstanovit = () => {
    Object.assign(console, origKonsol);
    for (const k of Object.keys(process.env)) if (!(k in staryyEnv)) delete process.env[k];
    Object.assign(process.env, staryyEnv);
  };

  let handler, obkhodHandler = null;
  try {
    handler = require(FUNKCIYA).handler;
    if (typeof handler !== 'function') throw new Error('exports.handler не функция');
    if ((sluchay.updates || []).some((s) => s && s.obkhod)) obkhodHandler = require(OBKHOD).handler;
  } catch (e) {
    vosstanovit();
    const net = e.code === 'MODULE_NOT_FOUND';
    const kratko = e.message.split('\n')[0].split(SAYT).join('site');
    return { prichiny: [net ? `ядро не готово: ${kratko}` : `функция не загружается: ${kratko}`],
      logi, vyzovy: [], nevozmozhno: true };
  }

  const shagi = (sluchay.updates || [sluchay.update]).map((s) =>
    s && typeof s === 'object' && ('update' in s || s.obkhod) && !('update_id' in s) ? s : { update: s });
  const sekret = sluchay.sekret ?? env.TG_WEBHOOK_SECRET;
  let brosil = 0;
  const zhdemBroska = sluchay.ozhidaem.brosaet;
  const vyzvat = async (upd, obkhod = false) => {
    const event = obkhod
      ? { body: JSON.stringify({ next_run: new Date(sost.now + 600000).toISOString() }) }
      : { httpMethod: 'POST', headers: { 'x-telegram-bot-api-secret-token': sekret, 'content-type': 'application/json' },
        body: JSON.stringify(upd) };
    let taymer;
    const visit = new Promise((_, rej) => { taymer = setTimeout(() => rej(new Error('обработчик висит дольше 20 с')), 20000); });
    try { await Promise.race([Promise.resolve().then(() => (obkhod ? obkhodHandler : handler)(event)), visit]); }
    catch (e) {
      if (zhdemBroska && !/висит дольше/.test(e.message)) brosil++;
      else prichiny.push(`обработчик бросил исключение: ${e.message.split('\n')[0]}`);
    }
    finally { clearTimeout(taymer); }
  };

  const snimki = [];
  const chatPoUmolchaniyu = (() => {
    const u = (shagi.find((s) => s.update) || {}).update;
    if (!u) return null;
    const m = u.business_message || u.edited_business_message || u.deleted_business_messages;
    if (m) return m.chat.id;
    const d = u.callback_query?.data?.split(':');
    return d && d[2] ? d[2] : null;
  })();

  if (sluchay.parallelno) {
    await Promise.all(shagi.map((s) => vyzvat(podstavit(s.update, bazaNow, sost))));
  } else {
    for (const s of shagi) {
      const now = s.now ? podstavit(s.now, bazaNow) : bazaNow;
      sost.now = now;
      global.__DOGON_NOW__ = now;
      const doTg = sost.vyzovy().length, doModel = modelVyzovy.length;
      await vyzvat(s.obkhod ? null : podstavit(s.update, now, sost), !!s.obkhod);
      await ozhidat(5);
      snimki.push({ now, vyzovy: sost.vyzovy().slice(doTg), modelVyzovy: modelVyzovy.slice(doModel) });
      // проверки шага — сразу, пока хранилище в состоянии «после этого шага»
      for (const ps of sluchay.ozhidaem.po_shagam || []) {
        const nomer = snimki.length;
        const [ot, doo] = ps.shagi || [ps.shag, ps.shag];
        if (nomer < ot || nomer > doo) continue;
        const sn = snimki[nomer - 1];
        for (const r of proverit(ps, { vyzovy: sn.vyzovy, modelVyzovy: sn.modelVyzovy, store, env, now: sn.now, chatPoUmolchaniyu }))
          prichiny.push(`шаг ${nomer}: ${r}`);
      }
    }
  }
  await ozhidat(10);

  if (zhdemBroska === true && !brosil) prichiny.push('ждали исключение наружу (повтор Netlify), обработчик его проглотил');
  if (typeof zhdemBroska === 'number' && brosil !== zhdemBroska) prichiny.push(`исключений наружу ${brosil}, ждали ${zhdemBroska}`);
  const vyzovy = sost.vyzovy() || [];
  const itogNow = sost.now;
  prichiny.push(...proverit(sluchay.ozhidaem, { vyzovy, modelVyzovy, zaprosyModeli: sost.zaprosyModeli, store, env, now: itogNow, chatPoUmolchaniyu }));

  // проверки на всех случаях
  const vesLog = logi.join('\n');
  if (vesLog.includes(TOKEN) || vesLog.includes(TOKEN.split(':')[1])) prichiny.push('ТОКЕН БОТА В ЛОГЕ');
  if (vesLog.includes(KLYUCH_MODELI)) prichiny.push('КЛЮЧ ANTHROPIC В ЛОГЕ');
  const telaVyzovov = JSON.stringify(vyzovy);
  if (telaVyzovov.includes(TOKEN)) prichiny.push('токен бота в теле вызова Telegram');
  for (const v of vyzovy.filter(klientskiy)) {
    if (v.body.parse_mode) prichiny.push(`клиенту с parse_mode=${v.body.parse_mode} (SPEC: без parse_mode)`);
    if (tekstVyzova(v).length > 4096) prichiny.push(`текст клиенту ${tekstVyzova(v).length} > 4096`);
  }
  if (vyzovy.some((v) => v.method === 'readBusinessMessage')) prichiny.push('вызван readBusinessMessage (SPEC §3: не вызываем)');
  prichiny.push(...zamechaniya);

  vosstanovit();
  return { prichiny, logi, vyzovy, vneshnie: sost.vneshnie };
}

// ---------- главный цикл ----------
const fayly = readdirSync(PAPKA).filter((f) => f.endsWith('.json')).sort()
  .filter((f) => !FILTR.length || FILTR.some((x) => f.startsWith(x) || f.includes(x)));

const origLog = console.log;
const nastoyashchiyFetch = globalThis.fetch;
const itogi = [];
let yadroNeGotovo = null;
for (const f of fayly) {
  let r;
  try { r = await progonSluchaya(f); }
  catch (e) { r = { prichiny: [`прогон упал: ${e.stack?.split('\n').slice(0, 2).join(' | ')}`], logi: [], vyzovy: [] }; }
  if (r.nevozmozhno) yadroNeGotovo = r.prichiny[0];
  itogi.push({ f, ...r });
}
globalThis.fetch = nastoyashchiyFetch;

const shirina = Math.max(...itogi.map((i) => i.f.length), 10);
origLog(`\n${'файл'.padEnd(shirina)}  итог     причина`);
origLog('-'.repeat(shirina + 60));
for (const i of itogi) {
  const ok = i.prichiny.length === 0;
  origLog(`${i.f.padEnd(shirina)}  ${ok ? 'ПРОШЁЛ' : 'ПРОВАЛ'}   ${ok ? '' : i.prichiny[0].slice(0, 150)}${i.prichiny.length > 1 ? `  (+${i.prichiny.length - 1})` : ''}`);
}
const provaly = itogi.filter((i) => i.prichiny.length);
if (provaly.length && !yadroNeGotovo) {
  origLog('\nПодробно по провалам:');
  for (const i of provaly) {
    origLog(`\n● ${i.f}`);
    for (const p of i.prichiny) origLog(`   - ${p}`);
    if (i.vneshnie?.length) origLog(`   · внешние адреса (закрыты прогоном): ${[...new Set(i.vneshnie)].join(', ')}`);
    if (PODROBNO) {
      origLog(`   · вызовы Telegram: ${JSON.stringify(i.vyzovy.map((v) => ({ m: v.method, chat: v.body?.chat_id, t: tekstVyzova(v).slice(0, 80) })))}`);
      origLog(`   · лог функции:\n      ${i.logi.slice(-25).join('\n      ')}`);
    }
  }
}
if (yadroNeGotovo) origLog(`\n${yadroNeGotovo}\nВсе ${itogi.length} случаев засчитаны провалом — сверять нечего, пока нет ${FUNKCIYA}`);
origLog(`\nИтого: ${itogi.length - provaly.length} прошли, ${provaly.length} провалено из ${itogi.length}.`);
process.exit(provaly.length ? 1 : 0);
