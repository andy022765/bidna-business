// Счётчик трёх лендингов (видимость / приёмка / Вера), 22.09.2026.
//
// Отдельный файл, а не правка ev.js, по двум причинам. Первая: ev.js — общий файл полосы
// ГОЛОС, а в папке нет git, кто записал последним — тот и прав. Вторая: это другая воронка,
// со своими событиями и своими сегментами; мешать её с воронкой СПИСКА РАБОТ в одной
// таблице значит получить кашу, где ни одну цифру нельзя объяснить.
//
// ЗАПИСЬ: POST {e:'price', seg:'visibility-en'}
// ЧТЕНИЕ: GET /.netlify/functions/ev-lend?k=<EV_KEY>          → JSON
//         GET /.netlify/functions/ev-lend?k=<EV_KEY>&view=1   → таблица воронки
//         &days=30 — окно, по умолчанию 14
//
// Append-only: у Netlify Blobs нет атомарного инкремента, а read-modify-write на общем
// документе терял бы события при одновременных заходах. Блобы пустые, считаем имена ключей.

const { getStore } = require('@netlify/blobs');

const FALLBACK_KEY = 'bidna-voronka-2026';   // тот же ключ чтения, что у ev.js
const STORE = 'lending-events';

// Воронка по порядку. Порядок важен: в таблице колонки идут слева направо как шаги.
const EVENTS = [
  'view',        // страница открыта
  'scroll50',    // долистал до середины
  'price',       // доскроллил до блока цены — дошёл ли вообще до денег
  'cta',         // нажал кнопку-призыв
  'form_start',  // поставил курсор в первое поле
  'submit',      // отправил форму
  'thanks',      // открылась страница «спасибо» — Netlify заявку принял
  'lang',        // переключил язык
];

const SEGS = [
  'visibility-en', 'visibility-ru',
  'call-audit-en', 'call-audit-ru',
  'vera-en', 'vera-ru',
];

const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const day = (d) => d.toISOString().slice(0, 10);

// Сайт деплоится готовой папкой, без сборки, и Netlify тогда НЕ подкладывает
// NETLIFY_BLOBS_CONTEXT — авто-конфигурация блобов не срабатывает (проверено 07.09.2026).
// Поднимаем хранилище явно, из того, что в среде есть.
function openStore() {
  const tries = [];
  try { return { store: getStore({ name: STORE }), how: 'auto' }; }
  catch (e) { tries.push('auto: ' + ((e && e.message) || e)); }

  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const tokens = [
    ['NETLIFY_API_TOKEN', process.env.NETLIFY_API_TOKEN],
    ['NETLIFY_AUTH_TOKEN', process.env.NETLIFY_AUTH_TOKEN],
    ['EV_BLOBS_TOKEN', process.env.EV_BLOBS_TOKEN],
  ].filter((t) => t[1]);

  for (const [name, token] of tokens) {
    try { return { store: getStore({ name: STORE, siteID, token }), how: name }; }
    catch (e) { tries.push(name + ': ' + ((e && e.message) || e)); }
  }
  return { store: null, how: null, err: tries.join(' | ') };
}

exports.handler = async (event) => {
  const opened = openStore();
  const store = opened.store;

  // ────────────────────────────────────────────────────────────── чтение
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q.k !== (process.env.EV_KEY || FALLBACK_KEY)) return { statusCode: 404, body: 'Not found' };

    if (q.debug) {
      return { statusCode: 200, headers: JSONH, body: JSON.stringify({
        how: opened.how, hasStore: !!store, storeErr: opened.err || null,
        ctx: !!process.env.NETLIFY_BLOBS_CONTEXT,
        siteId: !!(process.env.SITE_ID || process.env.NETLIFY_SITE_ID),
        node: process.version, store: STORE, events: EVENTS, segs: SEGS,
      }, null, 2) };
    }
    if (!store) {
      return { statusCode: 200, headers: JSONH,
               body: JSON.stringify({ ok: false, storeErr: opened.err }) };
    }

    // Чистка тестовых записей: только по ключу и только по явному префиксу.
    if (q.purge) {
      const prefix = String(q.purge);
      if (prefix.length < 3) return { statusCode: 400, headers: JSONH, body: '{"ok":false,"why":"prefix"}' };
      const { blobs } = await store.list({ prefix });
      for (const b of blobs) await store.delete(b.key);
      return { statusCode: 200, headers: JSONH, body: JSON.stringify({ ok: true, purged: blobs.length }) };
    }

    const days = Math.min(90, Math.max(1, parseInt(q.days, 10) || 14));
    const from = day(new Date(Date.now() - (days - 1) * 864e5));
    const table = {};   // дата → сегмент → событие → сколько
    const totals = {};  // сегмент → событие → сколько

    try {
      const { blobs } = await store.list();
      for (const b of blobs) {
        const p = b.key.split('/');           // <дата>/<сегмент>/<событие>/<хвост>
        if (p.length < 4) continue;
        const [d, seg, ev] = p;
        if (d < from) continue;
        ((table[d] = table[d] || {})[seg] = table[d][seg] || {})[ev] = (table[d][seg][ev] || 0) + 1;
        (totals[seg] = totals[seg] || {})[ev] = (totals[seg][ev] || 0) + 1;
      }
    } catch (e) {
      console.error('[ev-lend] list упал:', e && e.message);
      return { statusCode: 200, headers: JSONH, body: '{"ok":false,"error":"list"}' };
    }

    if (!q.view) {
      return { statusCode: 200, headers: JSONH,
               body: JSON.stringify({ ok: true, days, totals, table }, null, 2) };
    }

    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const row = (seg) => {
      const t = totals[seg] || {};
      const top = t.view || 0;
      return '<tr><th>' + esc(seg) + '</th>' + EVENTS.map((e) => {
        const n = t[e] || 0;
        const pct = (top && e !== 'view') ? ' <i>' + Math.round((n / top) * 100) + '%</i>' : '';
        return '<td>' + n + pct + '</td>';
      }).join('') + '</tr>';
    };
    const dates = Object.keys(table).sort().reverse();
    const html =
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Воронка лендингов</title><style>' +
      'body{font:15px/1.5 -apple-system,sans-serif;margin:0;padding:24px 18px;background:#0a0e18;color:#eef1f7}' +
      'h1{font-size:19px;margin:28px 0 6px}h1:first-child{margin-top:0}' +
      'p.s{color:#6b768f;font-size:13px;margin:0 0 14px}' +
      'table{border-collapse:collapse;margin-bottom:10px;font-variant-numeric:tabular-nums}' +
      'th,td{border:1px solid #1e2940;padding:7px 10px;text-align:right;white-space:nowrap}' +
      'th{background:#0e1524;text-align:left;font-weight:600}' +
      'thead th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#97a1b8}' +
      'i{color:#6b768f;font-style:normal;font-size:12px}' +
      'div.w{overflow-x:auto}</style>' +
      '<h1>Всего за ' + days + ' дн.</h1><p class="s">Процент — от числа открытий страницы.</p>' +
      '<div class="w"><table><thead><tr><th>страница</th>' +
      EVENTS.map((e) => '<th>' + e + '</th>').join('') + '</tr></thead><tbody>' +
      SEGS.filter((s) => totals[s]).map(row).join('') + '</tbody></table></div>' +
      (Object.keys(totals).length ? '' : '<p class="s">Пока ни одного события.</p>') +
      '<h1>По дням</h1><p class="s">Свежие сверху.</p><div class="w"><table><thead><tr>' +
      '<th>дата</th><th>страница</th>' + EVENTS.map((e) => '<th>' + e + '</th>').join('') +
      '</tr></thead><tbody>' +
      dates.map((d) => Object.keys(table[d]).sort().map((seg) =>
        '<tr><th>' + esc(d) + '</th><td style="text-align:left">' + esc(seg) + '</td>' +
        EVENTS.map((e) => '<td>' + (table[d][seg][e] || 0) + '</td>').join('') + '</tr>'
      ).join('')).join('') + '</tbody></table></div>';
    return { statusCode: 200,
             headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
             body: html };
  }

  // ────────────────────────────────────────────────────────────── запись
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { /* пустое тело отсеется ниже */ }

  const ev = String(b.e || '');
  const seg = String(b.seg || '');
  if (!EVENTS.includes(ev) || !SEGS.includes(seg)) {
    return { statusCode: 400, headers: JSONH, body: '{"ok":false}' };
  }
  if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };

  try {
    const tail = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    await store.set(day(new Date()) + '/' + seg + '/' + ev + '/' + tail, '');
  } catch (e) {
    console.error('[ev-lend] set упал:', e && e.message);
    return { statusCode: 200, headers: JSONH, body: '{"ok":false}' };
  }
  // Отвечаем ok всегда: замер не имеет права ломать страницу.
  return { statusCode: 200, headers: JSONH, body: '{"ok":true}' };
};
