// Приход роботов нейросетей на наши страницы: запись и отчёт. Ставится 23.09.2026.
// Отметки шлёт edge-функция netlify/edge-functions/boty.js — она единственная видит
// запрос к статической странице.
//
// ЗАПИСЬ: POST {poroda, bot, put} с заголовком x-boty-secret.
//   Ключ — <порода>|<бот>|<путь>|<день>, значение пустое. Считаем по именам ключей.
//   Append-only намеренно, как в ev.js: у Netlify Blobs нет атомарного инкремента,
//   а read-modify-write на общем документе терял бы отметки при одновременных заходах.
//   Повторный заход того же бота на тот же адрес в тот же день перезаписывает тот же ключ —
//   гонки нет, хранилище не растёт.
//
//   ЧИСЛО ЗАХОДОВ МЫ НАМЕРЕННО НЕ СЧИТАЕМ. Оно шумит и ничего не решает. Решает дата:
//   «12 октября ChatGPT впервые пришёл на /vera/ru/» — это событие, его кладут в отчёт.
//
// ОТЧЁТ: GET /.netlify/functions/boty?k=<BOTY_KEY>         → JSON
//        GET /.netlify/functions/boty?k=<BOTY_KEY>&view=1  → таблица в браузере

const { getStore } = require('@netlify/blobs');

const FALLBACK_KEY = 'bidna-boty-2026';
const FALLBACK_SECRET = 'bidna-boty-2026';
const STORE = 'boty-nejrosetej';

// Порода привязана к ИМЕНИ робота, а не к тому, что прислала edge-функция. Так старые
// отметки, записанные до 25.09 с прежним делением, читаются уже по новому правилу:
// OAI-SearchBot и прочий индекс уезжает из «живого вопроса» задним числом, а не остаётся
// врать в истории (contr-011). Живой вопрос — только имена на -User, другого признака нет.
const PORODA_BOTA = {
  'ChatGPT-User': 'vopros', 'Perplexity-User': 'vopros',
  'Claude-User': 'vopros', 'MistralAI-User': 'vopros',

  'OAI-SearchBot': 'poisk', 'PerplexityBot': 'poisk', 'Claude-SearchBot': 'poisk',
  'DuckAssistBot': 'poisk', 'Meta-ExternalFetcher': 'poisk', 'Google-CloudVertexBot': 'poisk',

  'GPTBot': 'obuchenie', 'ClaudeBot': 'obuchenie', 'anthropic-ai': 'obuchenie',
  'CCBot': 'obuchenie', 'Bytespider': 'obuchenie', 'meta-externalagent': 'obuchenie',
  'FacebookBot': 'obuchenie', 'Amazonbot': 'obuchenie', 'Applebot': 'obuchenie',
  'Diffbot': 'obuchenie', 'omgili': 'obuchenie', 'ImagesiftBot': 'obuchenie',
  'PanguBot': 'obuchenie', 'YouBot': 'obuchenie', 'cohere-ai': 'obuchenie',
  'Timpibot': 'obuchenie', 'AI2Bot': 'obuchenie',
};
// Белый список: публичную ручку нельзя засрать произвольными именами.
const BOTY = new Set(Object.keys(PORODA_BOTA));
const PORODY = { vopros: 'живой вопрос', poisk: 'поисковый индекс', obuchenie: 'обучение' };

const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

// Путь приводим к известному виду. Чужое — в «другое», чтобы одна кривая ссылка
// не наплодила тысячу ключей.
const NASHI = ['/', '/en', '/en/', '/llms.txt', '/sitemap.xml'];   // /en/ — английская главная с 29.09
const PAPKI = ['/visibility/', '/call-audit/', '/vera/', '/diagnostic/', '/business/', '/expert/', '/zvonki/', '/vidimost/', '/kejs/'];
function put_normalno(p) {
  const s = String(p || '/').split('?')[0].slice(0, 120);
  if (NASHI.includes(s)) return s;
  for (const d of PAPKI) if (s === d || s.startsWith(d)) return s;
  return 'другое';
}

function openStore() {
  try { return getStore({ name: STORE }); } catch (e) { /* ниже */ }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.NETLIFY_API_TOKEN, process.env.NETLIFY_AUTH_TOKEN,
                       process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_FUNCTIONS_TOKEN].filter(Boolean)) {
    try { return getStore({ name: STORE, siteID, token }); } catch (e) { /* дальше */ }
  }
  return null;
}

exports.handler = async (event) => {
  const store = openStore();

  if (event.httpMethod === 'POST') {
    const secret = process.env.BOTY_SECRET || FALLBACK_SECRET;
    if ((event.headers['x-boty-secret'] || '') !== secret) return { statusCode: 404, body: 'Not found' };
    if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };
    let d = {};
    try { d = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'bad json' }; }
    if (!PORODY[d.poroda] || !BOTY.has(d.bot)) return { statusCode: 400, body: 'unknown' };
    // День берём свой, а не из тела запроса: присланному времени доверять нечего.
    const den = new Date().toISOString().slice(0, 10);
    await store.set([PORODA_BOTA[d.bot], d.bot, put_normalno(d.put), den].join('|'), '');
    return { statusCode: 200, headers: JSONH, body: '{"ok":true}' };
  }

  const q = event.queryStringParameters || {};
  if (q.k !== (process.env.BOTY_KEY || FALLBACK_KEY)) return { statusCode: 404, body: 'Not found' };
  if (!store) return { statusCode: 200, headers: JSONH, body: '{"ok":false,"why":"store"}' };

  // Уборка. Только по ключу и только по явному префиксу — чтобы нельзя было снести
  // статистику одним случайным запросом. Нужна для своих же проверочных отметок:
  // тестовый заход «GPTBot» соврал бы в графе «впервые», а она здесь главная.
  if (q.purge) {
    const prefix = String(q.purge);
    if (prefix.length < 5) return { statusCode: 400, headers: JSONH, body: '{"ok":false,"why":"prefix"}' };
    const { blobs } = await store.list({ prefix });
    for (const b of blobs) await store.delete(b.key);
    return { statusCode: 200, headers: JSONH, body: JSON.stringify({ ok: true, ubrano: blobs.length, prefix }) };
  }

  const { blobs } = await store.list();
  const svod = { vopros: {}, poisk: {}, obuchenie: {} };
  for (const b of blobs) {
    const [staraya, bot, put, den] = String(b.key).split('|');
    const poroda = PORODA_BOTA[bot] || staraya;
    if (!svod[poroda] || !den) continue;
    const p = (svod[poroda][bot] = svod[poroda][bot] || {});
    const z = (p[put] = p[put] || { vpervye: den, posledniy: den, dnej: 0 });
    if (den < z.vpervye) z.vpervye = den;
    if (den > z.posledniy) z.posledniy = den;
    z.dnej++;
  }
  const pusto = !blobs.length;

  if (!q.view) return { statusCode: 200, headers: JSONH,
    body: JSON.stringify({ ok: true, otmetok: blobs.length, svod }, null, 1) };

  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  let h = `<!doctype html><meta charset="utf-8"><title>Роботы нейросетей</title>
<style>body{font:15px/1.5 -apple-system,system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 20px}
h2{margin:34px 0 6px}.p{color:#666;margin:0 0 14px}table{border-collapse:collapse;width:100%;margin-bottom:10px}
td,th{border-bottom:1px solid #e5e5e5;padding:7px 10px;text-align:left}th{font-weight:600;color:#666;font-size:13px}
b{font-variant-numeric:tabular-nums}.n{color:#999}</style>
<h1>Кто из роботов нейросетей нас читал</h1>
<p class="p">Отметок в хранилище: ${blobs.length}. Считаем не заходы, а дни: заходы шумят, даты — нет.</p>`;
  if (pusto) h += `<p class="n">Пока ни одной отметки. Это честный ответ, а не поломка: с момента установки
    ни один робот на наши страницы не приходил.</p>`;
  const POYASNENIE = {
    vopros: 'Движок пошёл за ответом, потому что человек прямо сейчас спросил. Это и есть видимость. '
          + 'Признак один — имя робота на -User.',
    poisk: 'Движок кладёт страницу в свой поисковый индекс, из которого потом соберёт ответ. '
         + 'Ближе живого вопроса, но это ещё не вопрос.',
    obuchenie: 'Обход, чтобы положить страницу в модель. Сигнал отложен на месяцы.',
  };
  for (const poroda of ['vopros', 'poisk', 'obuchenie']) {
    h += `<h2>${PORODY[poroda]}</h2><p class="p">${POYASNENIE[poroda]}</p>`;
    const boty = Object.keys(svod[poroda]).sort();
    if (!boty.length) { h += '<p class="n">— никого —</p>'; continue; }
    h += '<table><tr><th>Робот</th><th>Адрес</th><th>Впервые</th><th>Последний раз</th><th>Дней</th></tr>';
    for (const bot of boty)
      for (const put of Object.keys(svod[poroda][bot]).sort()) {
        const z = svod[poroda][bot][put];
        h += `<tr><td>${esc(bot)}</td><td>${esc(put)}</td><td><b>${z.vpervye}</b></td><td>${z.posledniy}</td><td>${z.dnej}</td></tr>`;
      }
    h += '</table>';
  }
  h += `<h2>Чего этот счётчик не видит</h2><p class="p">Google. Обзоры от ИИ и AI Mode отвечают
    из обычного индекса Googlebot, а <b>Google-Extended</b> — это только строка для robots.txt,
    отдельным User-Agent он не ходит. Отличить приход «под ответ нейросети» от обычной индексации
    у Google нельзя ничем. Если понадобится, меряем Google отдельно — прямыми замерами выдачи.</p>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: h };
};
