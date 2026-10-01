// Здоровье движков для стороннего сторожа. Ставится 26.09.2026.
//
// ЗАЧЕМ. 25.09 у OpenAI кончились деньги, и бесплатная проверка видимости перестала
// работать ДЛЯ ВСЕХ. Узнали случайно, через сутки. Автопополнение у Андрея было включено
// и молча не сработало. Сторож на это не смотрел: страница отдавала 200 и слово
// «buy.stripe.com» на месте — с виду всё живо.
//
// ПОЧЕМУ НЕ /v1/models. Он отвечает 200 и при нулевом балансе: списание проверяется
// только платным вызовом. Поэтому здесь настоящий вызов, но в один токен.
//
// ПОЧЕМУ КЭШ. Сторож стучит каждые пять минут — это 288 раз в сутки. Без кэша и с обычным
// запросом (веб-поиск) вышло бы около восьми долларов в день на один только сторож.
// Кэш на двенадцать минут: настоящих вызовов не больше ста двадцати в сутки, все по одному
// токену и без веб-поиска, это центы.
//
// ЧТО ОТДАЁТ: слово DVIZHKI-ZHIVY, когда живы все три. Хоть один молчит — слова нет,
// вместо него DVIZHKI-BEDA и имя виноватого. Сторож настроен на «слова нет — тревога».
//
// env: OPENAI_API_KEY · ANTHROPIC_API_KEY · PERPLEXITY_API_KEY · ZDOROVIE_KEY

const { getStore } = require('@netlify/blobs');

const KESH_MS = 12 * 60 * 1000;
const SROK_MS = 8000;
const HEAD = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

function hranilishche() {
  try { return getStore({ name: 'zdorovie', consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: 'zdorovie', siteID, token: t, consistency: 'strong' }); }
    catch (_) {}
  }
  return null;
}

async function sSrokom(p) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SROK_MS);
  try { return await p(ctrl.signal); } finally { clearTimeout(t); }
}

// Один токен, без веб-поиска. Модель та же, что в боевой проверке: чужое имя однажды
// протухнет и сторож закричит на здоровый сайт.
async function openai(signal) {
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + (process.env.OPENAI_API_KEY || ''),
               'content-type': 'application/json' },
    body: JSON.stringify({ model: 'chat-latest', input: 'ok', max_output_tokens: 16 }),
  });
  if (r.ok) return null;
  const t = await r.text();
  try { return (JSON.parse(t).error || {}).code || ('http-' + r.status); }
  catch (_) { return 'http-' + r.status; }
}

async function anthropic(signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '',
               'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1,
                           messages: [{ role: 'user', content: 'ok' }] }),
  });
  if (r.ok) return null;
  const t = await r.text();
  try { return (JSON.parse(t).error || {}).type || ('http-' + r.status); }
  catch (_) { return 'http-' + r.status; }
}

async function perplexity(signal) {
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST', signal,
    headers: { Authorization: 'Bearer ' + (process.env.PERPLEXITY_API_KEY || ''),
               'content-type': 'application/json' },
    // Шестнадцать, а не один: Perplexity отбивает меньшее прямым текстом —
    // «max_tokens must be at least 16». Проверено живьём 26.09.
    body: JSON.stringify({ model: 'sonar', max_tokens: 16,
                           messages: [{ role: 'user', content: 'ok' }] }),
  });
  if (r.ok) return null;
  const t = await r.text();
  try { return (JSON.parse(t).error || {}).message ? 'otkaz' : ('http-' + r.status); }
  catch (_) { return 'http-' + r.status; }
}

const DVIZHKI = [['openai', openai], ['anthropic', anthropic], ['perplexity', perplexity]];

async function proverit() {
  const bedy = [];
  await Promise.all(DVIZHKI.map(async ([imya, fn]) => {
    try {
      const beda = await sSrokom(fn);
      if (beda) bedy.push(imya + ':' + beda);
    } catch (e) {
      bedy.push(imya + ':' + ((e && e.name === 'AbortError') ? 'ne-uspel' : 'upalo'));
    }
  }));
  return bedy.sort();
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const klyuch = process.env.ZDOROVIE_KEY || '';
  const svoy = !!klyuch && q.k === klyuch;

  // Обычное чтение — БЕЗ ключа, нарочно: адрес живёт в стороннем сторожe, и класть туда
  // наш секрет незачем. Ответ не содержит ничего, кроме слова и имён движков.
  // Злоупотребить нечем: без ключа свежая проверка запускается не чаще раза в двенадцать
  // минут, то есть не больше ста двадцати вызовов в сутки по одному токену.
  // Принудительная проверка (svezho=1) — только по ключу.
  if (q.svezho && !svoy) return { statusCode: 403, headers: HEAD, body: 'нужен ключ' };

  const store = hranilishche();
  const teper = Date.now();

  if (!(q.svezho && svoy)) {
    try {
      const staroe = store && JSON.parse((await store.get('poslednee')) || 'null');
      if (staroe && teper - staroe.t < KESH_MS) {
        return { statusCode: 200, headers: HEAD, body: staroe.telo + '\nиз кэша' };
      }
    } catch (e) { console.log('[zdorovie] кэш не прочитался:', e && e.message); }
  }

  const bedy = await proverit();
  const telo = bedy.length
    ? 'DVIZHKI-BEDA ' + bedy.join(' ')
    : 'DVIZHKI-ZHIVY openai anthropic perplexity';
  try { if (store) await store.set('poslednee', JSON.stringify({ t: teper, telo })); }
  catch (e) { console.log('[zdorovie] кэш не записался:', e && e.message); }
  console.log('[zdorovie]', telo);
  return { statusCode: 200, headers: HEAD, body: telo };
};
