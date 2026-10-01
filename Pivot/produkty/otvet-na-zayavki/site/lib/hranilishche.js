// Хранилище Netlify Blobs для ответа на заявки. Один способ поднять его на весь сайт.
//
// ПОРЯДОК И ПОЧЕМУ ОН ТАКОЙ.
// 1. siteID + токен (EV_BLOBS_TOKEN или NETLIFY_API_TOKEN) — запросы идут в API Netlify напрямую,
//    строгая согласованность работает. Так живут pismo.js и kalendar-zapis.js у Веры, проверено выкаткой.
// 2. connectLambda(event) — без токена. ЛОВУШКА, пойманная чтением исходника @netlify/blobs:
//    connectLambda даёт только edgeURL без uncachedEdgeURL, и тогда getStore проходит, а ПЕРВЫЙ ЖЕ
//    get со строгой согласованностью бросает BlobsConsistencyError. Поэтому здесь согласованность
//    обычная (чтение может отставать до минуты) и в журнал пишется предупреждение.
// 3. Голый getStore — только для netlify dev. На живом сайте он бросает, и мы возвращаем null.
//
// Голый getStore на живом стенде — это тихий отказ (урок 26.09, feedback-test-proveryaet-usloviya):
// try/catch его глотает, а побочное действие не случается. Поэтому каждый отказ пишется в журнал.
//
// @netlify/blobs сюда ПЕРЕДАЁТ ФУНКЦИЯ (podklyuchit), как в gkal.js: так тест подставляет
// поддельный модуль, который ведёт себя как настоящий Netlify, а не «всегда работает».

let B = null;          // модуль @netlify/blobs
let sobytie = null;    // событие текущего вызова: из него берутся event.blobs и x-nf-site-id
const kesh = new Map();

function podklyuchit(modul) { B = modul; }
// Кэш сбрасываем на каждом вызове: в режиме connectLambda токен приходит в событии и может
// смениться у тёплого контейнера, а хранилище со старым токеном отвалится посреди записи.
function nachat(event) { sobytie = event || null; kesh.clear(); }

function token() { return process.env.EV_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || ''; }
function siteID() {
  const h = (sobytie && sobytie.headers) || {};
  return process.env.SITE_ID || process.env.NETLIFY_SITE_ID || h['x-nf-site-id'] || '';
}

function store(name) {
  if (kesh.has(name)) return kesh.get(name);
  if (!B) { console.log('[hran] модуль Blobs не подключён'); return null; }
  let s = null, rezhim = '';
  const t = token(), id = siteID();
  if (t && id) {
    try { s = B.getStore({ name, siteID: id, token: t, consistency: 'strong' }); rezhim = 'api'; }
    catch (e) { console.log('[hran] по токену не поднялось:', e.message); }
  }
  if (!s && sobytie && sobytie.blobs && B.connectLambda) {
    try {
      B.connectLambda(sobytie);
      s = B.getStore({ name });
      rezhim = 'lambda';
      console.log('[hran] ВНИМАНИЕ: без EV_BLOBS_TOKEN, чтение может отставать до минуты:', name);
    } catch (e) { console.log('[hran] connectLambda не помог:', e.message); }
  }
  if (!s) {
    try { s = B.getStore({ name, consistency: 'strong' }); rezhim = 'dev'; }
    catch (e) { console.log('[hran] хранилище не поднялось:', name, '—', e.message); }
  }
  if (s) { s.__rezhim = rezhim; kesh.set(name, s); }
  return s;
}

// Чтение JSON без исключений: битая запись не должна ронять запись на звонок.
async function vzyat(s, klyuch) {
  if (!s) return null;
  try {
    const v = await s.get(klyuch);
    if (v == null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch (e) { console.log('[hran] чтение упало:', klyuch, e.message); return null; }
}

async function polozhit(s, klyuch, obj) {
  if (!s) return false;
  try { await s.set(klyuch, JSON.stringify(obj)); return true; }
  catch (e) { console.log('[hran] запись упала:', klyuch, e.message); return false; }
}

// Записать, только если ключа ещё нет. Вернёт true — записали мы; false — ключ уже был.
// null — хранилище недоступно или запись упала: решать вызывающему (обычно — идти дальше
// и полагаться на вторую линию защиты, а не молча терять заявку).
async function pervym(s, klyuch, obj) {
  if (!s) return null;
  try {
    const r = await s.set(klyuch, JSON.stringify(obj), { onlyIfNew: true });
    if (r && r.modified === false) return false;
    return true;
  } catch (e) { console.log('[hran] условная запись упала:', klyuch, e.message); return null; }
}

async function ubrat(s, klyuch) {
  if (!s) return false;
  try { await s.delete(klyuch); return true; }
  catch (e) { console.log('[hran] удаление упало:', klyuch, e.message); return false; }
}

// Счётчик на сутки. Не атомарный: для потолков писем это допустимо (ошибка на единицу),
// для защиты слотов и дублей — нет, там pervym().
async function schetchik(s, klyuch) {
  if (!s) return { bylo: 0, ok: false };
  try {
    const bylo = parseInt((await s.get(klyuch)) || '0', 10) || 0;
    await s.set(klyuch, String(bylo + 1));
    return { bylo, ok: true };
  } catch (e) { console.log('[hran] счётчик упал:', klyuch, e.message); return { bylo: 0, ok: false }; }
}

function sbrosKesha() { kesh.clear(); }

module.exports = { podklyuchit, nachat, store, vzyat, polozhit, pervym, ubrat, schetchik, sbrosKesha };
