// Счётчик событий воронки. Ставится 07.09.2026 — до этого на пути не было ни одного замера,
// и любая ревизия сайта работала вслепую.
//
// ЗАПИСЬ: POST {e:'list_open', seg:'business'} — пишет один блоб на событие.
//   Append-only намеренно: у Netlify Blobs нет атомарного инкремента, а read-modify-write
//   на общем документе терял бы события при одновременных заходах. Блобов много, но они
//   пустые (значение — пустая строка), а считаем мы по именам ключей.
//
// ЧТЕНИЕ: GET /.netlify/functions/ev?k=<EV_KEY>          → JSON
//         GET /.netlify/functions/ev?k=<EV_KEY>&view=1   → таблица в браузере
//         &days=30 — сколько дней назад смотреть (по умолчанию 14)
//
// Ключ чтения: переменная окружения EV_KEY. Если её нет, работает запасной ниже —
// чтобы замер начался сразу, не дожидаясь похода в консоль Netlify.

const { getStore } = require('@netlify/blobs');

const FALLBACK_KEY = 'bidna-voronka-2026';
const STORE = 'funnel-events';

// Белый список: чужой скрипт не сможет засрать хранилище произвольными именами.
const EVENTS = [
  'list_open',    // открыл страницу списка работ
  'list_submit',  // отправил три вопроса
  'list_done',    // список собрался и показан
  'lead',         // оставил контакты
  'pay_click',    // нажал «перейти к диагностике» со списка
  'oplata_open',  // открыл страницу оплаты
  'stripe_click', // ушёл на кассу Stripe
  'spasibo',      // вернулся со Stripe — оплата прошла
];
const SEGS = ['business', 'expert', 'other'];

const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function day(d) { return d.toISOString().slice(0, 10); }

// Сайт деплоится готовой папкой, без сборки, и Netlify в этом случае НЕ подкладывает
// NETLIFY_BLOBS_CONTEXT — авто-конфигурация блобов не срабатывает (проверено 07.09.2026:
// «The environment has not been configured to use Netlify Blobs»). Поэтому поднимаем
// хранилище явно, из того, что в среде есть: SITE_ID + токен.
function openStore() {
  const tries = [];
  try { return { store: getStore({ name: STORE }), how: 'auto' }; }
  catch (e) { tries.push('auto: ' + ((e && e.message) || e)); }

  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const tokens = [
    ['NETLIFY_API_TOKEN', process.env.NETLIFY_API_TOKEN],
    ['NETLIFY_AUTH_TOKEN', process.env.NETLIFY_AUTH_TOKEN],
    ['EV_BLOBS_TOKEN', process.env.EV_BLOBS_TOKEN],
    ['NETLIFY_FUNCTIONS_TOKEN', process.env.NETLIFY_FUNCTIONS_TOKEN],
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
  const storeErr = opened.err || null;
  if (!store) console.error('[ev] хранилище не поднялось:', storeErr);

  // ─────────────────────────────────────────────── чтение
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const key = process.env.EV_KEY || FALLBACK_KEY;
    if (q.k !== key) return { statusCode: 404, body: 'Not found' };

    if (q.debug) {
      return { statusCode: 200, headers: JSONH, body: JSON.stringify({
        storeErr: storeErr,
        how: opened.how,
        hasStore: !!store,
        ctx: !!process.env.NETLIFY_BLOBS_CONTEXT,
        siteId: !!(process.env.SITE_ID || process.env.NETLIFY_SITE_ID),
        node: process.version,
        keys: Object.keys(process.env).filter((k) => /BLOB|SITE|NETLIFY|DEPLOY/i.test(k)).sort(),
      }, null, 2) };
    }
    if (!store) return { statusCode: 200, headers: JSONH, body: JSON.stringify({ ok: false, storeErr: storeErr }) };

    // Чистка тестовых записей. Только по ключу и только по явному префиксу —
    // чтобы нельзя было снести статистику одним случайным запросом.
    if (q.purge) {
      const prefix = String(q.purge);
      if (prefix.length < 3) return { statusCode: 400, headers: JSONH, body: '{"ok":false,"why":"prefix"}' };
      const { blobs } = await store.list({ prefix });
      for (const b of blobs) await store.delete(b.key);
      return { statusCode: 200, headers: JSONH,
               body: JSON.stringify({ ok: true, purged: blobs.length, prefix }) };
    }

    const days = Math.min(90, Math.max(1, parseInt(q.days, 10) || 14));
    const from = new Date(Date.now() - (days - 1) * 864e5);
    const table = {};   // date -> seg -> event -> count
    const totals = {};  // seg -> event -> count

    try {
      const { blobs } = await store.list();
      for (const b of blobs) {
        // ключ: <date>/<seg>/<event>/<уникальный хвост>
        const p = b.key.split('/');
        if (p.length < 4) continue;
        const [d, seg, ev] = p;
        if (d < day(from)) continue;
        table[d] = table[d] || {};
        table[d][seg] = table[d][seg] || {};
        table[d][seg][ev] = (table[d][seg][ev] || 0) + 1;
        totals[seg] = totals[seg] || {};
        totals[seg][ev] = (totals[seg][ev] || 0) + 1;
      }
    } catch (e) {
      console.error('[ev] list упал:', e && e.message);
      return { statusCode: 200, headers: JSONH, body: '{"ok":false,"error":"list"}' };
    }

    if (!q.view) {
      return { statusCode: 200, headers: JSONH,
               body: JSON.stringify({ ok: true, days, totals, table }, null, 2) };
    }

    // человеческий вид: воронка по сегментам + разбивка по дням
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const row = (seg) => {
      const t = totals[seg] || {};
      const top = t.list_open || 0;
      const pct = (n) => (top ? ' <i>' + Math.round((n / top) * 100) + '%</i>' : '');
      return '<tr><th>' + esc(seg) + '</th>' +
        EVENTS.map((e) => '<td>' + (t[e] || 0) + (e === 'list_open' ? '' : pct(t[e] || 0)) + '</td>').join('') +
        '</tr>';
    };
    const dates = Object.keys(table).sort().reverse();
    const html =
      '<!doctype html><meta charset="utf-8"><title>Воронка · BIDNA</title>' +
      '<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;background:#0f1320;color:#e8ecf6;padding:28px;margin:0}' +
      'h1{font-size:20px;margin:0 0 4px}p.s{color:#8a93ab;margin:0 0 22px}' +
      'table{border-collapse:collapse;margin:0 0 30px;font-variant-numeric:tabular-nums}' +
      'th,td{border:1px solid rgba(255,255,255,.14);padding:7px 11px;text-align:right}' +
      'th{background:rgba(255,255,255,.06);text-align:left;font-weight:600;white-space:nowrap}' +
      'thead th{text-align:right;font-size:12px;color:#aeb5c9;letter-spacing:.04em}' +
      'i{font-style:normal;color:#7f8aa3;font-size:12px;margin-left:5px}' +
      'td:first-child{text-align:left}</style>' +
      '<h1>Воронка</h1><p class="s">За ' + days + ' дней. Проценты — от «открыл список».</p>' +
      '<table><thead><tr><th>сегмент</th>' + EVENTS.map((e) => '<th>' + e + '</th>').join('') +
      '</tr></thead><tbody>' + SEGS.filter((s) => totals[s]).map(row).join('') + '</tbody></table>' +
      '<h1>По дням</h1><p class="s">Свежие сверху.</p><table><thead><tr><th>дата</th><th>сегмент</th>' +
      EVENTS.map((e) => '<th>' + e + '</th>').join('') + '</tr></thead><tbody>' +
      dates.map((d) => Object.keys(table[d]).sort().map((seg) =>
        '<tr><th>' + esc(d) + '</th><td>' + esc(seg) + '</td>' +
        EVENTS.map((e) => '<td>' + (table[d][seg][e] || 0) + '</td>').join('') + '</tr>').join('')).join('') +
      '</tbody></table>';
    return { statusCode: 200,
             headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
             body: html };
  }

  // ─────────────────────────────────────────────── запись
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { /* пустое тело — ниже отсеется */ }

  const ev = String(b.e || '');
  if (!EVENTS.includes(ev)) return { statusCode: 400, headers: JSONH, body: '{"ok":false}' };
  const seg = SEGS.includes(b.seg) ? b.seg : 'other';

  if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };
  try {
    const tail = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    await store.set(day(new Date()) + '/' + seg + '/' + ev + '/' + tail, '');
  } catch (e) {
    console.error('[ev] set упал:', e && e.message);
    return { statusCode: 200, headers: JSONH, body: JSON.stringify({ ok: false, why: String((e && e.message) || e) }) };
  }
  // Отвечаем ok всегда: замер не должен ломать страницу, если хранилище недоступно.
  return { statusCode: 200, headers: JSONH, body: '{"ok":true}' };
};
