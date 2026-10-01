// Ответы Маши по прозвону — хранятся У НАС, а не в её браузере.
//
// Зачем не localStorage: Андрей должен видеть ход прозвона, не спрашивая её, а записи
// разговоров всё равно лежат на нашей стороне. Держать половину данных у неё в Chrome,
// а половину у нас — значит однажды потерять половину.
//
// ЗАПИСЬ:  POST {k, i, pole, znachenie}          — одно поле одной карточки
//          POST {k, i, srazu:{...}}              — сразу несколько полей
// ЧТЕНИЕ:  GET  ?k=<ключ>                        — всё, JSON
//          GET  ?k=<ключ>&view=1                 — таблица в браузере
//          GET  ?k=<ключ>&tsv=1                  — выгрузка для таблиц
//
// Ключ — переменная PROZVON_KEY. Без неё работает запасной ниже, чтобы прозвон
// не встал из-за похода в консоль.

const { getStore } = require('@netlify/blobs');

// Ключ тот же, что у остальных точек прозвона: PROZVON_KLYUCH.
const ZAPASNOY_KLYUCH = null;
const STORE = 'prozvon';
const VSEGO = 56;

// Белый список полей: чужой запрос не насыплет произвольных ключей.
const POLYA = ['dozvon', 'kto', 'sek', 'cena', 'posylka', 'usluga', 'zapis', 'pochta',
               'imya_reshaet', 'chto', 'itog', 'zametka', 'plashka_ok', 'cifry',
               'call_sid', 'zapis_url', 'zapis_sek'];

const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function openStore() {
  try { return getStore({ name: STORE, consistency: 'strong' }); } catch (e) { /* ниже */ }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.NETLIFY_API_TOKEN, process.env.EV_BLOBS_TOKEN]) {
    if (!t) continue;
    try { return getStore({ name: STORE, siteID, token: t, consistency: 'strong' }); }
    catch (e) { /* дальше */ }
  }
  return null;
}

const klyuch = () => process.env.PROZVON_KLYUCH || ZAPASNOY_KLYUCH;
const chisto = (s, n) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

async function vse(store) {
  const out = {};
  if (!store) return out;
  const { blobs } = await store.list();
  await Promise.all((blobs || []).map(async (b) => {
    try { out[b.key] = JSON.parse(await store.get(b.key) || '{}'); } catch (e) { /* пропускаем */ }
  }));
  return out;
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const store = openStore();

  if (event.httpMethod === 'GET') {
    if (!klyuch() || q.k !== klyuch()) return { statusCode: 404, body: 'Not found' };
    if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };
    const d = await vse(store);

    if (q.tsv) {
      const sh = ['№'].concat(POLYA);
      const str = [sh.join('\t')];
      for (let i = 1; i <= VSEGO; i++) {
        const z = d[String(i)] || {};
        str.push([i].concat(POLYA.map((p) => (z[p] == null ? '' : String(z[p])))).join('\t'));
      }
      return { statusCode: 200, body: '﻿' + str.join('\n'),
               headers: { 'Content-Type': 'text/tab-separated-values; charset=utf-8' } };
    }

    if (q.view) {
      const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const sdelano = Object.values(d).filter((z) => z && z.itog).length;
      const interes = Object.values(d).filter((z) => z && z.itog === 'интересно').length;
      const ryady = [];
      for (let i = 1; i <= VSEGO; i++) {
        const z = d[String(i)];
        if (!z || !Object.keys(z).length) continue;
        ryady.push('<tr><td>' + i + '</td>' +
          ['kto', 'imya_reshaet', 'pochta', 'cifry', 'posylka', 'itog', 'zametka']
            .map((p) => '<td>' + esc(z[p] == null ? '' : z[p]) + '</td>').join('') +
          '<td>' + (z.zapis_url ? '<a href="' + esc(z.zapis_url) + '">запись</a>' : '') + '</td></tr>');
      }
      return { statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        body: '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>Прозвон — ход</title><style>body{font:15px/1.5 -apple-system,sans-serif;background:#0a0e18;' +
          'color:#eef1f7;margin:0;padding:22px 16px}h1{font-size:19px;margin:0 0 4px}' +
          'p.s{color:#6b768f;font-size:13px;margin:0 0 16px}table{border-collapse:collapse;width:100%}' +
          'th,td{border:1px solid #1e2940;padding:7px 9px;text-align:left;vertical-align:top;font-size:13.5px}' +
          'th{background:#0e1524;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#97a1b8}' +
          'a{color:#e3c88a}div.w{overflow-x:auto}</style>' +
          '<h1>Прозвон: сделано ' + sdelano + ' из ' + VSEGO + ', интересно ' + interes + '</h1>' +
          '<p class="s">Обновляется по ходу. Выгрузка: добавь <code>&amp;tsv=1</code> к адресу.</p>' +
          '<div class="w"><table><tr><th>№</th><th>итог</th><th>кто ответил</th>' +
          '<th>нажала</th><th>ложная посылка</th><th>почта</th><th>заметка</th><th>запись</th></tr>' +
          (ryady.join('') || '<tr><td colspan="8">Пока пусто.</td></tr>') + '</table></div>' };
    }

    return { statusCode: 200, headers: JSONH, body: JSON.stringify({ ok: true, d }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { /* ниже отсеется */ }
  if (!klyuch() || b.k !== klyuch()) return { statusCode: 404, body: 'Not found' };

  const i = parseInt(b.i, 10);
  if (!(i >= 1 && i <= VSEGO)) return { statusCode: 400, headers: JSONH, body: '{"ok":false}' };
  if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };

  let z = {};
  try { z = JSON.parse(await store.get(String(i)) || '{}'); } catch (e) { z = {}; }

  const polozhit = (p, v) => {
    if (!POLYA.includes(p)) return;
    z[p] = typeof v === 'boolean' ? v : chisto(v, 600);
  };
  if (b.srazu && typeof b.srazu === 'object') {
    for (const p of Object.keys(b.srazu)) polozhit(p, b.srazu[p]);
  } else {
    polozhit(b.pole, b.znachenie);
  }
  z.t = Date.now();

  try { await store.set(String(i), JSON.stringify(z)); }
  catch (e) {
    console.error('[prozvon] не записалось:', e && e.message);
    return { statusCode: 200, headers: JSONH, body: '{"ok":false}' };
  }
  return { statusCode: 200, headers: JSONH, body: '{"ok":true}' };
};
