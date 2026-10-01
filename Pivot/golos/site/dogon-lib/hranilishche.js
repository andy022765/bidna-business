// Хранилище Доводчика — Netlify Blobs 'dogon'. Та же манера, что hranilishche() в pismo.js:
// сперва окружение самой функции, не поднялось — запасной EV_BLOBS_TOKEN + SITE_ID.
//
// ПОЧЕМУ getStore ПЕРЕДАЁТСЯ СНАРУЖИ. Эта папка лежит рядом с netlify-functions, а не внутри.
// esbuild ищет пакеты от файла, который их требует: из dogon-lib/ он пошёл бы в site/node_modules,
// которого нет, и сборка упала бы на «Could not resolve @netlify/blobs». Поэтому пакет требует
// сама функция (она лежит рядом со своим node_modules) и отдаёт getStore сюда: podklyuchitBlobs().
//
// ВЕРСИЯ 8.2.0 — НЕ ОБНОВЛЯТЬ. В ней нет onlyIfNew/onlyIfMatch, поэтому все «записать, если нет»
// сделаны как get-затем-set. Это не атомарно: два вызова в одну и ту же миллисекунду могут оба
// решить, что ключа нет. Для нашего объёма (десятки чатов в сутки, Telegram не шлёт один апдейт
// параллельно) этого достаточно; вторая линия защиты — отметки v_rabote/gotovo и otvet/<id>.
//
// Тесты: global.__DOGON_TEST_STORE__ (get/set/setJSON/delete/list) подменяет Blobs целиком.

const IMYA = 'dogon';
let _getStore = null;

function podklyuchitBlobs(getStore) { if (typeof getStore === 'function') _getStore = getStore; }

function hranilishche(name = IMYA) {
  if (global.__DOGON_TEST_STORE__) return global.__DOGON_TEST_STORE__;
  if (!_getStore) { console.log('[dogon] getStore не подключён — функция забыла podklyuchitBlobs()'); return null; }
  const consistency = 'strong';
  try { return _getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return _getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

const pauza = (ms) => new Promise(r => setTimeout(r, ms));

// Blobs изредка отвечает 5xx на ровном месте. Три попытки с короткой паузой — дешевле потерянного сообщения.
async function sPovtorami(fn, popytok = 3) {
  let posl;
  for (let i = 0; i < popytok; i++) {
    try { return await fn(); }
    catch (e) { posl = e; if (i < popytok - 1) await pauza(global.__DOGON_BYSTRO__ ? 0 : 150 * (i + 1)); }
  }
  throw posl;
}

async function chitat(store, key) {
  return sPovtorami(async () => {
    const v = await store.get(key, { type: 'json' });
    if (v == null || v === '') return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return null; } }
    return v;
  });
}

async function pisat(store, key, val) {
  return sPovtorami(() => (typeof store.setJSON === 'function'
    ? store.setJSON(key, val)
    : store.set(key, JSON.stringify(val))));
}

// Сырая строка без разбора JSON: get(..., {type:'json'}) на значении вроде «bc-test-1» бросает,
// и sPovtorami трижды повторял бы заведомо неразбираемое чтение.
async function chitatTekst(store, key) {
  return sPovtorami(async () => {
    const v = await store.get(key);
    if (v == null) return null;
    return typeof v === 'string' ? v : String(v);
  });
}

// Пустые метки-счётчики, как в ev.js: ключ и есть событие.
async function pisatStroku(store, key, val = '') {
  return sPovtorami(() => store.set(key, val));
}

async function steret(store, key) {
  return sPovtorami(() => store.delete(key));
}

// list() в 8.2.0 отдаёт { blobs:[{key,etag}], directories }; тестовое хранилище может отдать массив.
async function spisok(store, prefix) {
  const r = await sPovtorami(() => store.list({ prefix }));
  const blobs = Array.isArray(r) ? r : (r && r.blobs) || [];
  return blobs.map(b => (typeof b === 'string' ? b : b.key)).filter(Boolean);
}

module.exports = { IMYA, podklyuchitBlobs, hranilishche, chitat, chitatTekst, pisat, pisatStroku, steret, spisok, sPovtorami, pauza };
