// Кому слать расшифровку разговора. Ставится 23.09.2026.
//
// ЗАЧЕМ ОТДЕЛЬНОЕ ХРАНИЛИЩЕ. Форма живёт на businessinteldna.com, разговор — на dezhurny.
// Это разные сайты, общей памяти у них нет. Адрес человека знает только первый,
// а расшифровку после звонка получает только второй.
//
// ПОЧЕМУ НЕ ПЕРЕДАТЬ ПОЧТУ ПРЯМО В ССЫЛКЕ. Адрес осел бы в истории браузера и в логах,
// а любой, кто получил такую ссылку, слал бы расшифровки на чужую почту. Поэтому
// в ссылку уходит короткий код, а сам адрес кладёт СЮДА наш сервер, с секретом.
// Эта ручка не принимает ничего от браузера — только от submission-created.js.
//
//   POST {metka, email} + заголовок x-vera-secret  → запомнить
//   GET  ?metka=...     + тот же заголовок         → отдать адрес
//
// env: VERA_ADRES_SECRET, EV_BLOBS_TOKEN / NETLIFY_API_TOKEN, SITE_ID.

const { getStore } = require('@netlify/blobs');

const STORE = 'vera-adresa';
const ZHIVET_DNEY = 14;                    // дольше расшифровку слать бессмысленно
const H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const POHOZH = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

function hranilishche() {
  try { return getStore({ name: STORE, consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: STORE, siteID, token, consistency: 'strong' }); } catch (_) {}
  }
  return null;
}

// Метку чистим жёстко: она приходит снаружи и становится именем ключа.
const chistaya = (m) => String(m || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

exports.handler = async (event) => {
  const secret = process.env.VERA_ADRES_SECRET || '';
  if (!secret || (event.headers['x-vera-secret'] || '') !== secret) {
    return { statusCode: 404, body: 'Not found' };
  }
  const store = hranilishche();
  if (!store) return { statusCode: 200, headers: H, body: '{"ok":false,"why":"store"}' };

  if (event.httpMethod === 'POST') {
    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (_) { return { statusCode: 400, body: 'bad json' }; }
    const metka = chistaya(b.metka);
    const email = String(b.email || '').trim();
    if (!metka || !POHOZH.test(email)) return { statusCode: 400, headers: H, body: '{"ok":false,"why":"vhod"}' };
    await store.setJSON(metka, { email, kogda: new Date().toISOString() });
    return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, metka }) };
  }

  const metka = chistaya((event.queryStringParameters || {}).metka);
  if (!metka) return { statusCode: 400, headers: H, body: '{"ok":false,"why":"metka"}' };
  const d = await store.get(metka, { type: 'json' });
  if (!d || !d.email) return { statusCode: 200, headers: H, body: '{"ok":false,"why":"net"}' };
  const dney = (Date.now() - Date.parse(d.kogda || 0)) / 86400000;
  if (!(dney >= 0) || dney > ZHIVET_DNEY) return { statusCode: 200, headers: H, body: '{"ok":false,"why":"staro"}' };
  return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true, email: d.email }) };
};
