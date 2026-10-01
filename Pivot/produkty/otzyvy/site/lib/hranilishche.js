// Хранилище Netlify Blobs для Сборщика отзывов. Устроено как в «ответе на заявки» (соседний
// продукт, проверено ревью 29.09), плюс две вещи: список ключей по префиксу и чтение ЧУЖОГО
// хранилища — меток визитов Веры в `golos-pisma` на её сайте. Туда мы только читаем.
//
// ПОРЯДОК ПОДЪЁМА И ПОЧЕМУ ОН ТАКОЙ.
// 1. siteID + токен (EV_BLOBS_TOKEN или NETLIFY_API_TOKEN) — запросы идут в API Netlify напрямую,
//    строгая согласованность работает. Так живут pismo.js и kalendar-zapis.js у Веры.
// 2. connectLambda(event) — без токена. Ловушка @netlify/blobs 10.7: строгая согласованность в этом
//    режиме бросает на первом же чтении, поэтому здесь согласованность обычная и пишется предупреждение.
// 3. Голый getStore — только для netlify dev. На живом сайте он бросает, и мы возвращаем null.
// Голый getStore на живом стенде — тихий отказ (урок 26.09): поэтому каждый отказ пишется в журнал.
//
// @netlify/blobs сюда ПЕРЕДАЁТ ФУНКЦИЯ (podklyuchit): тест подставляет поддельный модуль, который
// ведёт себя как настоящий Netlify, а не «всегда работает».

let B = null;
let sobytie = null;
const kesh = new Map();

function podklyuchit(modul) { B = modul; }
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

// Чужое хранилище (метки Веры на её сайте). Только по токену: connectLambda даёт доступ лишь
// к своему сайту. Нет токена — null, и планировщик честно пишет, что меток не видит.
function chuzhoy(name, chuzhoySite) {
  const kl = 'chuzhoy:' + chuzhoySite + ':' + name;
  if (kesh.has(kl)) return kesh.get(kl);
  if (!B) return null;
  const t = token();
  if (!t || !chuzhoySite) { console.log('[hran] чужое хранилище без токена или site_id не поднять:', name); return null; }
  let s = null;
  try { s = B.getStore({ name, siteID: chuzhoySite, token: t, consistency: 'strong' }); }
  catch (e) { console.log('[hran] чужое хранилище не поднялось:', name, e.message); }
  if (s) kesh.set(kl, s);
  return s;
}

async function vzyat(s, klyuch) {
  if (!s) return null;
  try {
    const v = await s.get(klyuch);
    if (v == null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch (e) { console.log('[hran] чтение упало:', klyuch, e.message); return null; }
}

// Как vzyat, но отличает «ключа нет» (null) от «прочитать не удалось» (undefined): там, где от ответа
// зависит, уйдёт ли письмо (отписка, «недавно просили»), сбой чтения нельзя путать с «нет записи».
async function vzyatStrogo(s, klyuch) {
  if (!s) return undefined;
  try {
    const v = await s.get(klyuch);
    if (v == null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch (e) { console.log('[hran] чтение упало (строго):', klyuch, e.message); return undefined; }
}

async function polozhit(s, klyuch, obj) {
  if (!s) return false;
  try { await s.set(klyuch, JSON.stringify(obj)); return true; }
  catch (e) { console.log('[hran] запись упала:', klyuch, e.message); return false; }
}

// Записать, только если ключа ещё нет. true — записали мы; false — ключ уже был; null — сбой.
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

// Ключи по префиксу. null — список не получен (решать вызывающему), [] — ключей нет.
async function spisok(s, prefix) {
  if (!s) return null;
  try {
    const r = await s.list({ prefix });
    return (r && r.blobs ? r.blobs : []).map(b => b.key);
  } catch (e) { console.log('[hran] список не получен:', prefix, e.message); return null; }
}

// Счётчик. Не атомарный: для потолков писем допустима ошибка на единицу, для дублей — нет, там pervym().
async function prochitatChislo(s, klyuch) {
  if (!s) return null;
  try { return parseInt((await s.get(klyuch)) || '0', 10) || 0; }
  catch (e) { console.log('[hran] счётчик не читается:', klyuch, e.message); return null; }
}
async function pribavit(s, klyuch) {
  if (!s) return false;
  try {
    const bylo = parseInt((await s.get(klyuch)) || '0', 10) || 0;
    await s.set(klyuch, String(bylo + 1));
    return true;
  } catch (e) { console.log('[hran] счётчик упал:', klyuch, e.message); return false; }
}

function sbrosKesha() { kesh.clear(); }

module.exports = { podklyuchit, nachat, store, chuzhoy, vzyat, vzyatStrogo, polozhit, pervym, ubrat, spisok,
                   prochitatChislo, pribavit, sbrosKesha };
