// «Зеркало» — бесплатный артефакт на входе в воронку.
// Человек даёт ссылку на себя, мы реально открываем его страницу, ищем соседей по нише,
// открываем их — и показываем, какой фразой он себя описывает рядом с их фразами.
//
// ПОЧЕМУ ЧЕТЫРЕ ШАГА, А НЕ ОДИН ВЫЗОВ.
// Синхронная функция Netlify умирает на 40-й секунде (замеряли 05.09.2026: 28с — ок,
// 45с — 502 ровно на 40.3с). Вся работа с веб-поиском занимает ~50с и не влезает.
// Background-функции работают, но Blobs при CLI-деплое не инициализируются
// (MissingBlobsEnvironmentError) и потребовали бы отдельный токен Netlify.
// Поэтому цепочку ведёт браузер: четыре коротких шага по 5–18с.
// Побочный выигрыш: прогресс на экране честный — каждый шаг реально завершился
// и докладывает, что нашёл. Никаких заранее написанных строчек «идёт анализ».
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');

// Opus держим только там, где рождается текст для клиента. Поиск профиля и поиск соседей —
// это извлечение фактов, там Sonnet справляется не хуже и стоит кратно дешевле.
// «Зеркало» бесплатное и публичное, поэтому цена прогона — вопрос не жадности, а выживания.
// Главная статья расхода — не наши промпты, а результаты веб-поиска: один такой вызов
// вливает в модель 30–75 тысяч токенов. Поэтому модель под каждый шаг выбираем по задаче.
const MODEL_CHEAP = 'claude-haiku-4-5';  // вытащить шапку профиля из выдачи
const MODEL_FAST  = 'claude-sonnet-5';            // отличить живого соседа от агрегатора
const MODEL_DEEP  = 'claude-opus-5';              // вердикт: то, что читает человек
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* ---------- мелочи ---------- */
const clip = (v, n) => String(v == null ? '' : v).slice(0, n).trim();
const json = (code, obj, extra) => ({
  statusCode: code,
  headers: Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}),
  body: JSON.stringify(obj),
});

// Подпись: не пускаем дёргать дорогие шаги в обход первого.
// Секрет — отдельной env, иначе производный от ключа API (HMAC необратим, ключ не утекает).
const SECRET = process.env.MIRROR_SECRET || process.env.ANTHROPIC_API_KEY || 'bidna-dev';
const sign = (host, ts) =>
  crypto.createHmac('sha256', SECRET).update(`${host}|${ts}`).digest('hex').slice(0, 32);
// ДНЕВНАЯ КВОТА. Настоящий счётчик по IP требует общего хранилища: Netlify Blobs при нашем
// способе деплоя не поднимаются (проверено 05.09.2026, MissingBlobsEnvironmentError), а руками
// их заводить — значит класть токен от всего аккаунта Netlify в переменные сайта. Не стали.
// Поэтому здесь подписанная кука: она останавливает случайное и ленивое злоупотребление
// (перезагрузки, «а дай ещё разок»), но не скрипт, который чистит куки.
// ЖЁСТКИЙ ПОТОЛОК — лимит расходов в консоли Anthropic. Он и есть настоящая защита кошелька.
const DAILY_LIMIT = 5;
const today = () => new Date().toISOString().slice(0, 10);
const qsig = (n, d) => crypto.createHmac('sha256', SECRET).update(`q|${n}|${d}`).digest('hex').slice(0, 16);

function readQuota(event) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const m = raw.match(/bidna_q=([^;]+)/);
  if (!m) return 0;
  const [n, d, sig] = decodeURIComponent(m[1]).split('|');
  const cnt = parseInt(n, 10);
  if (!isFinite(cnt) || d !== today() || sig !== qsig(cnt, d)) return 0;   // чужая или вчерашняя
  return cnt;
}
const quotaCookie = (n) => ({
  'Set-Cookie': `bidna_q=${encodeURIComponent(`${n}|${today()}|${qsig(n, today())}`)}` +
                '; Path=/; Max-Age=86400; SameSite=Lax; Secure; HttpOnly',
});

const checkToken = (b) => {
  const ts = parseInt(b.ts, 10);
  if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;    // прогон идёт ~минуту
  return b.token === sign(String(b.host || ''), ts);
};

/* ---------- разбор чужой страницы ---------- */
function normalize(link) {
  let s = String(link || '').trim();
  if (!s) return null;
  s = s.replace(/^["'<]+|["'>]+$/g, '');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes('.')) return null;
    return u;
  } catch { return null; }
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–' };
const unent = (s) => String(s)
  .replace(/&(amp|lt|gt|quot|#39|nbsp|laquo|raquo|mdash|ndash);/g, (_, k) => ENT[k])
  .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(+d); } catch { return ' '; } });

const meta = (html, re) => { const m = html.match(re); return m ? unent(m[1]).trim() : ''; };

function extract(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const title = meta(html, /<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  const desc =
    meta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]{1,500}?)["']/i) ||
    meta(html, /<meta[^>]+content=["']([\s\S]{1,500}?)["'][^>]+name=["']description["']/i);
  const og =
    meta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]{1,500}?)["']/i) ||
    meta(html, /<meta[^>]+content=["']([\s\S]{1,500}?)["'][^>]+property=["']og:description["']/i);
  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]{1,300}?)<\/h1>/gi)]
    .map((m) => unent(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]{1,300}?)<\/h2>/gi)]
    .map((m) => unent(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12);
  // Снимаем теги ДВАЖДЫ: страницы вроде Instagram прячут разметку в экранированном виде
  // (&lt;script src="data:...base64,…&gt;), и после раскодирования сущностей она оживает.
  // Раньше этот мусор считался «текстом страницы» и проходил проверку на непустоту.
  const strip = (x) => x.replace(/<[^>]+>/g, ' ');
  const text = strip(unent(strip(body))).replace(/\s+/g, ' ').trim();
  return { title, desc, og, h1s, h2s, text };
}

// Четыре галочки, по которым сравниваем его со соседями.
// Соцсети отдают роботу пустой каркас: Instagram — 707 КБ скриптов и 9 символов текста.
// Это НЕ значит, что человека не видно. Родной web_fetch их не пускает (url_not_allowed),
// подставлять чужой User-Agent мы не будем — вместо этого достаём его описание веб-поиском
// из проиндексированных источников. Проверено 05.09.2026 на пяти реальных профилях.
const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|fb\.com|tiktok\.com|linkedin\.com|x\.com|twitter\.com|threads\.net|vk\.com)$/i;
const handleOf = (u) => {
  const seg = u.pathname.split('/').filter(Boolean);
  return seg.length ? seg[seg.length - 1].replace(/^@/, '') : '';
};

const RX = {
  price:   /(цена|цены|стоимост|прайс|тариф|сколько стоит|от\s*\d[\d\s]*\s*(₽|руб|\$|€|грн)|\d[\d\s]*\s*(₽|руб\.?|\$|€)\s*(\/|за)?\s*(м2|м²|час|мес|проект)?)/iu,
  process: /(как мы работаем|как проходит|этап\w*|шаг\s*1|порядок работ|процесс работы|что входит|регламент)/iu,
  proof:   /(кейс\w*|отзыв\w*|портфолио|примеры работ|наши работы|до и после|результаты клиент|благодарствен)/iu,
  verify:  /(лицензи\w*|сертификат\w*|инн\b|огрн\b|гаранти\w*\s*\d+|\d+\s*(лет|года|год)\s*(на рынке|опыт)|состоит в реестре|аккредит)/iu,
};
const signals = (t) => ({
  price: RX.price.test(t), process: RX.process.test(t), proof: RX.proof.test(t), verify: RX.verify.test(t),
});

async function grab(url, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'ru,en;q=0.8' },
    });
    if (!r.ok) return { ok: false, reason: 'http_' + r.status };
    const ct = r.headers.get('content-type') || '';
    if (!/html|text/i.test(ct)) return { ok: false, reason: 'not_html' };
    const html = (await r.text()).slice(0, 400000);
    const ex = extract(html);
    // Страница-заглушка или стена логина: текста почти нет.
    if (ex.text.length < 120 && !ex.desc && !ex.og) return { ok: false, reason: 'empty', ...ex };
    return { ok: true, ...ex };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally { clearTimeout(to); }
}

/* ---------- вызов модели ---------- */
function parseJson(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

// Стена Netlify — 40с. Поиск иногда уходит в разнос: на живых людях видели 115с на шаге
// «соседи» и 224с на шаге «профиль» (05.09.2026). Поэтому каждый вызов модели гоняем
// наперегонки с таймером: лучше вернуть неполный, но живой результат, чем 502.
const DEADLINE = 34000;   // стена 40с; за брошенный вызов деньги всё равно списываются
class Deadline extends Error {}
function withDeadline(promise, ms) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Deadline('deadline')), ms); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

// Цены за миллион токенов. Нужны не для бухгалтерии, а чтобы в логах Netlify было видно
// реальную стоимость прогона: 05.09.2026 мы уже один раз промахнулись с оценкой на порядок.
// Если Anthropic поменяет прайс — цифры здесь станут неточными, но порядок останется верным.
const PRICE = {
  // Сверено по актуальному прайсу 06.09.2026. Раньше стояло 15/75 и 3/15 —
  // из-за этого все наши замеры расходов были завышены втрое.
  'claude-opus-5':              { in: 5,  out: 25 },
  'claude-sonnet-5':            { in: 2,  out: 10 },
  'claude-haiku-4-5':  { in: 1,  out: 5  },
};
const money = (model, u) => {
  const p = PRICE[model]; if (!p || !u) return null;
  const i = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
  return (i * p.in + (u.output_tokens || 0) * p.out) / 1e6;
};

async function ask(client, opts) {
  const { model, ...rest } = opts;
  const use = model || MODEL_DEEP;
  // Серверный запасной маршрут поддерживает не всякая модель: Sonnet 5 на `fallbacks`
  // отвечает 400 «does not support the fallbacks parameter» (наступили 05.09.2026).
  // Поэтому подстраховку вешаем только туда, где она реально доступна.
  // ВОЗМОЖНОСТИ У МОДЕЛЕЙ РАЗНЫЕ, и API за лишний параметр отвечает 400-й ошибкой.
  // Собрали за один вечер 05.09.2026, каждую — отдельным падением:
  //   Sonnet 5  — «does not support the fallbacks parameter»
  //   Haiku 4.5 — «adaptive thinking is not supported on this model»
  //   Haiku 4.5 — «does not support the effort parameter»
  //   Haiku 4.5 — требует allowed_callers=["direct"] на серверных инструментах
  // Поэтому различия описаны здесь одной таблицей, а не рассыпаны по шагам.
  const CAN = {
    [MODEL_DEEP]:  { fallback: true,  thinking: true,  effort: true,  progTools: true },
    [MODEL_FAST]:  { fallback: false, thinking: true,  effort: true,  progTools: true },
    [MODEL_CHEAP]: { fallback: false, thinking: false, effort: false, progTools: false },
  };
  const can = CAN[use] || { fallback: false, thinking: false, effort: false, progTools: false };
  const req = { model: use, ...rest };
  if (can.fallback) {
    req.betas = ['server-side-fallback-2026-06-01'];
    req.fallbacks = [{ model: 'claude-opus-4-8' }];
  }
  if (can.thinking) req.thinking = { type: 'adaptive' };
  if (!can.effort) delete req.output_config;
  if (!can.progTools && Array.isArray(req.tools)) {
    req.tools = req.tools.map((t) => ({ ...t, allowed_callers: ['direct'] }));
  }
  const res = await client.beta.messages.create(req);
  if (res.stop_reason === 'refusal') throw new Error('refusal');
  const text = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const u = res.usage || {};
  const c = money(use, u);
  console.log('[mirror$]', use,
    'вход', (u.input_tokens || 0) + (u.cache_read_input_tokens || 0),
    'выход', u.output_tokens || 0,
    'поисков', (u.server_tool_use && u.server_tool_use.web_search_requests) || 0,
    c == null ? '' : '≈ $' + c.toFixed(4));
  return { text, usage: res.usage };
}

/* ---------- общий тон для клиентских текстов ---------- */
const TONE = `ЖЁСТКИЕ ПРАВИЛА (нарушение = брак).
- НИКАКИХ обещаний цифр и сроков результата. Нельзя «+30%», «в 2 раза», «за месяц», «окупится за».
  Можно только направление: продажи вырастут, затраты упадут, вас станет видно.
- Цитаты — ДОСЛОВНО из переданного текста. Если фразы нет в тексте — не цитируй её.
- Не выдумывать факты: ни цен, ни лицензий, ни клиентов, ни цифр, которых нет в исходниках.
- Не оскорблять. Мы показываем механизм, а не выносим приговор. Человек должен узнать себя,
  а не защищаться. Тон — как оператор с оператором: спокойно, коротко, без жалости и без лести.
- Без канцелярита («данный», «осуществляется», «является»), без восторгов, без эмодзи, без markdown.`;

/* ================= ШАГИ ================= */

// 1. Открываем его страницу. Мёртвая ссылка — это не ошибка, это самый сильный вывод.
async function stepPage(b, event) {
  const used = readQuota(event);
  if (used >= DAILY_LIMIT) return json(429, { error: 'quota', limit: DAILY_LIMIT });
  const u = normalize(b.link);
  if (!u) return json(400, { error: 'bad_link' });
  const host = u.hostname.replace(/^www\./, '');
  const ts = Date.now();
  const auth = { token: sign(host, ts), ts, host };
  const social = SOCIAL.test(host);
  const g = await grab(u.href, 8000);
  // У соцсетей планка выше: они отдают роботу пустой каркас, который формально «открылся».
  // Instagram давал ровно 120–123 символа мусора и проходил проверку. Ловим это здесь.
  const thin = !g.ok || (!g.desc && !g.og && (g.text || '').length < 400);
  const ck = quotaCookie(used + 1);
  if (social && thin) {
    // Соцсеть — не мёртвая ссылка. Третье состояние: содержимое добираем поиском.
    return json(200, { ...auth, ok: false, social: true, handle: handleOf(u),
                       url: u.href, reason: 'social', left: DAILY_LIMIT - used - 1 }, ck);
  }
  if (!g.ok) {
    return json(200, { ...auth, ok: false, social: false, url: u.href,
                       reason: g.reason, left: DAILY_LIMIT - used - 1 }, ck);
  }
  const text = clip(g.text, 6000);
  return json(200, {
    ...auth, ok: true, url: u.href,
    title: clip(g.title, 200), desc: clip(g.desc || g.og, 400),
    h1: clip(g.h1s[0] || '', 200), h2s: g.h2s.slice(0, 8),
    text, signals: signals(text + ' ' + g.title + ' ' + g.desc),
    left: DAILY_LIMIT - used - 1,
  }, ck);
}

// 1.5. Только для соцсетей: восстанавливаем, как человек себя описывает, по открытым источникам.
// Отдельным шагом, а не вместе с поиском соседей: один такой поиск занимает ~20с,
// вдвоём с соседями они не влезут в сорокасекундную стену Netlify.
async function stepSocial(client, b) {
  let text;
  try {
    ({ text } = await withDeadline(ask(client, {
    model: MODEL_CHEAP,
    max_tokens: 900,
    output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 1 }],
    system: 'Ты собираешь только факты из открытых источников. Ничего не додумываешь. ' +
            'Отвечаешь ТОЛЬКО валидным JSON, без markdown.',
    messages: [{ role: 'user', content:
`Профиль в соцсети: ${clip(b.url, 200)}
Хендл: ${clip(b.handle, 80)}
Человек о себе сказал: «${clip(b.what, 300) || '—'}».

Ищи так: сначала запрос по самому хендлу вместе с названием площадки
(например: ${clip(b.handle, 80)} instagram), затем — по хендлу вместе с тем, чем он занимается.
Шапка профиля обычно попадает в описание страницы в поисковой выдаче: оттуда её и бери.

Нужна ЕГО формулировка дословно, а не твой пересказ.

Верни строго:
{"found":true,"bio":"дословная шапка профиля, если нашлась","name":"имя, если нашлось",
 "audience":"размер аудитории, если указан — иначе пустая строка",
 "facts":["короткие проверяемые факты из открытых источников, максимум 4"]}

Если ничего не нашлось — {"found":false,"bio":"","name":"","audience":"","facts":[]}.
Ничего не выдумывай: пустое поле лучше догадки.` }],
    }), DEADLINE));
  } catch (err) {
    if (err instanceof Deadline) {
      console.log('[mirror] social: дедлайн');
      return json(200, { found: false, bio: '', name: '', audience: '', facts: [], slow: true });
    }
    throw err;
  }
  const out = parseJson(text);
  if (!out) {
    console.log('[mirror] social: не разобрался ответ:', String(text).slice(0, 300));
    return json(200, { found: false, bio: '', name: '', audience: '', facts: [], slow: true });
  }
  if (!out.found) console.log('[mirror] social: модель сказала «не нашёл»:', String(text).slice(0, 300));
  return json(200, {
    found: !!out.found, bio: clip(out.bio, 600), name: clip(out.name, 120),
    audience: clip(out.audience, 80),
    facts: (Array.isArray(out.facts) ? out.facts : []).slice(0, 4).map((f) => clip(f, 200)),
  });
}

// 2. Ищем соседей по нише. Единственный шаг, который ходит в интернет поиском.
async function stepRivals(client, b) {
  const facts = [
    `Как он себя описывает (его строка): «${clip(b.what, 300) || '—'}»`,
    b.title ? `Заголовок его страницы: «${clip(b.title, 200)}»` : '',
    b.desc ? `Описание его страницы: «${clip(b.desc, 400)}»` : '',
    b.host ? `Его адрес: ${clip(b.host, 100)}` : '',
    b.bio ? `Его шапка профиля (из открытых источников): «${clip(b.bio, 600)}»` : '',
    b.text ? `Текст его страницы:\n${clip(b.text, 2500)}` : '',
  ].filter(Boolean).join('\n');

  let text;
  try {
    ({ text } = await withDeadline(ask(client, {
    model: MODEL_FAST,
    max_tokens: 700,          // время ответа тянут выходные токены: на 2700 мы стабильно вылетали
    output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
    system: 'Ты аналитик рынка. Работаешь быстро: не больше двух поисковых запросов.',

    messages: [{ role: 'user', content:
`Вот человек и его страница:
${facts}

Задача:
1. Определи его нишу и гео (город/страну). Если гео не понять — поставь пустую строку и ищи без него.
2. Найди поиском 5 РЕАЛЬНЫХ прямых конкурентов — тех, кого его клиент увидит рядом с ним.
   Часть сайтов у нас не откроется, поэтому нужен запас: дай пять, мы возьмём живые.
   Только настоящие компании или практики с рабочими сайтами. НЕ агрегаторы (Авито, Профи.ру,
   Яндекс.Услуги, справочники, маркетплейсы, каталоги) — нам нужны прямые соседи.
   Не включай его самого.

Отвечай коротко: "snippet" — не длиннее 100 символов, "niche" — не длиннее 60.
Никаких пояснений до или после JSON.

Верни строго:
{"niche":"","geo":"","rivals":[{"name":"","url":"","snippet":""}]}` }],
    }), DEADLINE));
  } catch (err) {
    // Не успели — отдаём пустой список. Вердикт тогда говорит только про него самого,
    // это честнее и полезнее, чем ошибка на экране.
    if (err instanceof Deadline) {
      console.log('[mirror] rivals: дедлайн');
      return json(200, { niche: '', geo: '', rivals: [], slow: true });
    }
    throw err;
  }
  const out = parseJson(text);
  if (!out || !Array.isArray(out.rivals)) return json(200, { niche: '', geo: '', rivals: [], slow: true });
  const BAD = /(avito|profi\.ru|youla|yandex\.|2gis|zoon|flamp|hh\.ru|wildberries|ozon|tiu\.ru|blizko)/i;
  out.rivals = out.rivals.filter((r) => r && r.url && !BAD.test(r.url)).slice(0, 5);
  return json(200, { niche: clip(out.niche, 120), geo: clip(out.geo, 80), rivals: out.rivals });
}

// 3. Открываем страницы соседей сами — параллельно, быстро, без модели.
async function stepFetch(b) {
  const list = (Array.isArray(b.rivals) ? b.rivals : []).slice(0, 5);
  const got = await Promise.all(list.map(async (r) => {
    const u = normalize(r.url);
    if (!u) return { ...r, ok: false };
    const g = await grab(u.href, 7000);
    if (!g.ok) return { name: clip(r.name, 120), url: u.href, ok: false, snippet: clip(r.snippet, 300) };
    const t = clip(g.text, 3000);
    return {
      name: clip(r.name, 120), url: u.href, ok: true,
      title: clip(g.title, 200), desc: clip(g.desc || g.og, 400), h1: clip(g.h1s[0] || '', 200),
      text: t, signals: signals(t + ' ' + g.title + ' ' + g.desc),
    };
  }));
  // Берём три открывшихся. Мёртвые соседи нам не нужны — цитировать нечего.
  const live = got.filter((r) => r.ok).slice(0, 3);
  return json(200, { rivals: live, tried: got.length, opened: got.filter((r) => r.ok).length });
}

// 4. Сравниваем и собираем пять ходов. Без интернета — только то, что уже открыли.
async function stepVerdict(client, b) {
  const seg = b.segment === 'expert' ? 'эксперт-практик, продаёт себя' : 'владелец бизнеса';
  const me = b.me || {};
  const rivals = (Array.isArray(b.rivals) ? b.rivals : []).filter((r) => r && r.ok);

  const soc = b.social || {};
  const meBlock = me.ok
    ? `ЕГО СТРАНИЦА (${clip(b.host, 100)}):
Заголовок: «${clip(me.title, 200)}»
Описание: «${clip(me.desc, 400)}»
H1: «${clip(me.h1, 200)}»
Текст: ${clip(me.text, 1800)}
Галочки (наша проверка текста): цена=${!!me.signals?.price}, процесс=${!!me.signals?.process}, доказательства=${!!me.signals?.proof}, проверяемость=${!!me.signals?.verify}`
    : (me.social
      ? `ЕГО ПРИСУТСТВИЕ — ТОЛЬКО СОЦСЕТЬ (${clip(b.host, 100)}, хендл ${clip(me.handle, 80)}).
Страница отдаёт машине пустой каркас, поэтому её содержимое мы прочитать не можем —
ни мы, ни поисковый робот, ни AI-ассистент, к которому придёт его клиент.
Вот всё, что удалось собрать о нём из ОТКРЫТЫХ источников:
Имя: ${clip(soc.name, 120) || '—'}
Шапка профиля (дословно): «${clip(soc.bio, 600) || 'не нашлась'}»
Аудитория: ${clip(soc.audience, 80) || 'не указана'}
Факты: ${(soc.facts || []).join(' · ') || '—'}

ВАЖНО ПРО ТОН: не говори, что его «не видно» или что у него «ничего нет» — у него есть
аудитория и живой профиль. Факт в другом: за пределами ленты, там где клиент сравнивает
и где ищет машина, о нём почти нечего прочитать. Ни цены, ни устройства работы, ни
доказательств — только шапка на пару строк. Об этом и говори.`
      : `ЕГО СТРАНИЦА: НЕ ОТКРЫЛАСЬ (${clip(me.reason, 40)}). Ссылка: ${clip(b.host, 100)}.
Это важный факт: там, где клиент ищет его, он не находит ничего.`);

  const rivalBlock = rivals.length
    ? rivals.map((r, i) => `СОСЕД ${i + 1}: ${clip(r.name, 120)} (${clip(r.url, 200)})
Заголовок: «${clip(r.title, 200)}»
Описание: «${clip(r.desc, 400)}»
H1: «${clip(r.h1, 200)}»
Текст: ${clip(r.text, 900)}
Галочки: цена=${!!r.signals?.price}, процесс=${!!r.signals?.process}, доказательства=${!!r.signals?.proof}, проверяемость=${!!r.signals?.verify}`).join('\n\n')
    : 'СОСЕДЕЙ ОТКРЫТЬ НЕ УДАЛОСЬ. Сравнивать не с кем — говори только про него, честно.';

  const { text } = await withDeadline(ask(client, {
    model: MODEL_DEEP,
    max_tokens: 3500,
    output_config: { effort: 'medium' },
    system: `Ты — стратег Business Intelligence DNA. Человек оставил ссылку на себя, мы открыли
его страницу и страницы его соседей по нише. Ты показываешь ему зеркало: какой фразой он себя
описывает и что теми же словами говорят рядом.

Это бесплатный артефакт на входе. Его работа — чтобы человек узнал себя и захотел разобраться
глубже. Не продавай в лоб, не зови на созвон — это сделает сайт после тебя.

${TONE}

Отвечай ТОЛЬКО валидным JSON, без markdown и без пояснений.`,
    messages: [{ role: 'user', content:
`Сегмент: ${seg}.
Его строка о себе: «${clip(b.what, 300) || '—'}»
Ниша: ${clip(b.niche, 120) || '—'}. Гео: ${clip(b.geo, 80) || '—'}.

${meBlock}

${rivalBlock}

Собери пять ходов и верни строго такой JSON:

{
  "line": "одна фраза, которой он себя описывает — ДОСЛОВНО с его страницы или из его строки",
  "neighbors": [{"name":"", "line":"их фраза о себе — ДОСЛОВНО с их страницы"}],
  "echo": "1-2 предложения: что общего между его фразой и фразами соседей. Если по сути одно и то же — скажи прямо и спокойно.",
  "mechanism": "2-3 предложения. НЕ приговор, а механизм: что происходит в голове клиента, который видит эти четыре одинаковых описания подряд, и почему он в итоге выбирает по цене.",
  "table": [
    {"label":"Видна цена или вилка", "you":true, "them":[true,false,true]},
    {"label":"Понятно, как устроена работа", "you":false, "them":[true,true,false]},
    {"label":"Есть доказательства: кейсы, отзывы", "you":false, "them":[true,true,true]},
    {"label":"Есть что проверить: лицензии, сроки, гарантии", "you":false, "them":[false,true,true]}
  ],
  "direction": "3-4 предложения о будущем. Не «у вас проблема», а куда это чинится: как выглядит его страница и его поток клиентов, когда отличие названо. Направление, без цифр и сроков.",
  "howwefix": "ОДНА строка, максимум 20 слов: чем именно чиним под ЕГО разрыв. Цифрового сотрудника упоминай ТОЛЬКО если он правда ответ на его разрыв (поток заявок, ответы клиентам, разбор входящих). Если разрыв в позиционировании — пиши про формулировку и доказательства, не про AI.",
  "cliff": "одна фраза: мы увидели, какой из этих разрывов стоит ему дороже всего и с чего начинать — но это уже разговор предметный. НЕ раскрывай, какой именно и с чего."
}

Требования:
- "table": ровно 4 строки, "them" — массив ровно по числу соседей (${rivals.length}). Галочки бери
  из нашей проверки выше, не выдумывай. Если соседей нет — "them" пустой массив.
- "neighbors" — ровно ${rivals.length} штук, в том же порядке.
- Если его страница не открылась: "line" = его собственная строка о себе, а в "echo" и "mechanism"
  главным фактом сделай то, что по его ссылке клиент не находит ничего.
- Если присутствие только в соцсети: "line" = ДОСЛОВНО его шапка профиля (если нашлась),
  иначе его собственная строка. Галочки "you" ставь по тому, что реально видно снаружи:
  шапка на две строки почти всегда означает, что цены, устройства работы и проверяемых
  доказательств там нет. В "direction" говори про то, как сделать себя читаемым за пределами
  ленты, а не про то, что надо «больше постить».` }],
  }), DEADLINE);
  const out = parseJson(text);
  if (!out || !out.mechanism) return json(502, { error: 'bad_json' });
  return json(200, out);
}

/* ================= ВХОД ================= */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad_body' }); }
  if (b.website) return json(400, { error: 'bot' });          // honeypot

  const step = String(b.step || '');
  try {
    if (step === 'page') return await stepPage(b, event);

    if (!checkToken(b)) return json(403, { error: 'bad_token' });
    if (step === 'fetch') return await stepFetch(b);

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return json(503, { error: 'no_key' });
    const client = new Anthropic({ apiKey: key });

    if (step === 'social') return await stepSocial(client, b);
    if (step === 'rivals') return await stepRivals(client, b);
    if (step === 'verdict') return await stepVerdict(client, b);
    return json(400, { error: 'bad_step' });
  } catch (e) {
    console.error('[mirror]', step, e && e.status, e && e.message);
    return json(502, { error: 'failed', step });
  }
};
