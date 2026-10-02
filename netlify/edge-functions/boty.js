// Кто из роботов нейросетей приходил на наши страницы. Ставится 23.09.2026.
//
// ЗАЧЕМ ИМЕННО EDGE, А НЕ ОБЫЧНАЯ ФУНКЦИЯ: наши страницы статические. Запрос к ним
// не поднимает никакой функции, поэтому в логах функций прихода робота НЕТ и быть не может.
// Edge-функция — единственное место, где видно сам запрос к статике.
//
// ТРИ ПОРОДЫ, И МЕШАТЬ ИХ НЕЛЬЗЯ (23.09 было две; третья добавлена 25.09, contr-011):
//   обучение     — обход, чтобы положить страницу в модель. Сигнал отложен на месяцы.
//   поисковый индекс — движок складывает страницу в свой индекс, из которого потом
//                  соберёт ответ. Ближе живого вопроса, но это ещё не вопрос.
//   живой вопрос — движок пошёл за ответом ПРЯМО СЕЙЧАС, потому что кто-то спросил.
//                  Это и есть видимость, и она наступит раньше.
//
// ПРИЗНАК ЖИВОГО ВОПРОСА ОДИН: имя робота кончается на -User. Так устроено у всех
// четырёх движков, и другого признака нет. До 25.09 мы держали в живых вопросах ещё
// и OAI-SearchBot, PerplexityBot, Claude-SearchBot и прочих — это индекс, а не вопрос,
// и счётчик показывал видимость больше настоящей.
// Одной цифрой их складывать — значит потерять ровно тот сигнал, ради которого всё затевалось.
//
// СТРАНИЦУ НЕ ТРОГАЕМ. Ничего не возвращаем — Netlify отдаёт статику как обычно.
// onError: 'bypass' ниже — чтобы сломанный счётчик не уронил живой сайт. Счётчик
// не стоит ни одной страницы: при любой ошибке молча отдаём страницу и теряем одну отметку.

// Порядок важен: сперва -User, потом индекс — иначе имя совпадёт не с той породой.
const ZHIVOY_VOPROS = [
  'ChatGPT-User',       // человек спросил в ChatGPT, движок пошёл за ответом
  'Perplexity-User',    // человек спросил в Perplexity
  'Claude-User',        // человек спросил в Claude
  'MistralAI-User',     // человек спросил в Mistral
];
// Индекс, а не вопрос. Meta-ExternalFetcher и DuckAssistBot по описаниям вендоров ходят
// и под запрос человека — но имени на -User у них нет, проверить нечем, и в спорном случае
// мы занижаем видимость, а не завышаем.
const POISK = [
  'OAI-SearchBot',      // поисковый индекс ChatGPT
  'PerplexityBot',      // поисковый индекс Perplexity
  'Claude-SearchBot',   // поисковый индекс Claude
  'DuckAssistBot',      // ответы DuckDuckGo
  'Meta-ExternalFetcher',
  'Google-CloudVertexBot',
];
const OBUCHENIE = [
  'GPTBot',             // OpenAI, обучение
  'ClaudeBot',          // Anthropic, обучение
  'anthropic-ai',
  'CCBot',              // Common Crawl — кормит почти все модели
  'Bytespider',         // ByteDance
  'meta-externalagent',
  'FacebookBot',
  'Amazonbot',
  'Applebot',
  'Diffbot',
  'omgili',
  'ImagesiftBot',
  'PanguBot',
  'YouBot',
  'cohere-ai',
  'Timpibot',
  'AI2Bot',
];

function opoznat(ua) {
  const u = ua.toLowerCase();
  for (const b of ZHIVOY_VOPROS) if (u.includes(b.toLowerCase())) return ['vopros', b];
  for (const b of POISK) if (u.includes(b.toLowerCase())) return ['poisk', b];
  for (const b of OBUCHENIE) if (u.includes(b.toLowerCase())) return ['obuchenie', b];
  return null;
}

export default async (request, context) => {
  let bot = null;
  try { bot = opoznat(request.headers.get('user-agent') || ''); } catch (e) { return; }
  if (!bot) return;                       // обычный человек — уходим немедленно, ничего не делая

  try {
    const url = new URL(request.url);
    const secret = Netlify.env.get('BOTY_SECRET') || 'bidna-boty-2026';
    // waitUntil: отметка уходит ПОСЛЕ того, как страница отдана. Робот не ждёт нас ни миллисекунды.
    context.waitUntil(
      fetch(url.origin + '/.netlify/functions/boty', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-boty-secret': secret },
        body: JSON.stringify({ poroda: bot[0], bot: bot[1], put: url.pathname }),
      }).catch(() => {})
    );
  } catch (e) { /* счётчик не стоит ни одной страницы */ }
};

export const config = {
  path: [
    '/', '/en', '/en/',                          // /en/ — английская главная с 29.09
    '/llms.txt', '/sitemap.xml',                 // заход сюда — самый прямой признак, что нас читает машина
    '/zvonki/*',                                 // шесть страниц-ответов: написаны ровно для нейросетей
    '/vidimost/*', '/kejs/*',                    // шесть страниц про видимость и кейс Юли (01.10)
    '/visibility/*', '/call-audit/*', '/vera/*', '/diagnostic/*',
    '/business/*', '/expert/*',                  // старые страницы: точки отсчёта нет, но с сегодня считаем
  ],
  onError: 'bypass',
};
