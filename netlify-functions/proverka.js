// Мгновенная проверка видимости. Один движок, один прогон, ответ на экран.
//
// ПОЧЕМУ ОДИН, А НЕ ДЕВЯТЬ. Синхронная функция Netlify умирает на сороковой секунде
// (замеряли 05.09.2026: 28с — ок, 45с — 502 ровно на 40.3). Девять прогонов по трём
// движкам это около минуты. Поэтому на экране — первый движок, остальные восемь
// уходят письмом. Ровно это и обещает страница.
//
// ДЕНЬГИ. Один вызов с веб-поиском стоит около трёх центов. На холодном трафике без
// потолка это дыра в кошельке, поэтому здесь ДВА ограничителя: на посетителя в сутки
// и общий на сутки. Упёрлись в потолок — отвечаем честно, что проверка придёт письмом.

const { getStore } = require('@netlify/blobs');

const DEADLINE = 30000;         // стена 40с; за брошенный вызов деньги всё равно спишут
const PROGONOV = Number(process.env.PROVERKA_PROGONOV || 3);   // три прогона ОДНОГО движка

// ТРИ, А НЕ ОДИН — И НЕ РАДИ КРАСОТЫ. Лендинг отдельным блоком говорит: два прогона
// одной программы через десять часов совпадают примерно на 28% по именам, поэтому
// «гоняем каждый движок по три раза и показываем разброс, а не одно число».
// Один прогон этого не показывает. Три — показывают прямо на экране, за те же секунды:
// замерено 22.09, четыре запроса разом уложились в 9.6 с при потолке 30.
// Три прогона одного движка параллельно проходят. Три прогона Perplexity разом — 429.

// Деньги. Один прогон ~$0.03, значит проверка ~$0.09. Месячный потолок по OpenAI
// у нас $18 (Pivot/agenty/smotritel/progon/progon.py), это около двухсот проверок
// в месяц. Отсюда и дневной потолок: поднимать — значит поднимать и потолок в консоли.
const NA_GOSTYA_V_SUTKI = Number(process.env.PROVERKA_NA_GOSTYA || 2);
const VSEGO_V_SUTKI = Number(process.env.PROVERKA_VSEGO || 10);
const STORE = 'proverka-kvota';

// СЛУЖЕБНЫЙ КЛЮЧ ДЛЯ СВОИХ (25.09.2026). Полоса ПИСЬМА делает первое касание тем же
// методом, что и посетитель сайта, и каждая их находка съедала место живого человека:
// суточных мест всего десять. Ключ снимает СУТОЧНЫЕ потолки — и только их.
// Денежный потолок остаётся общим: наши прогоны идут в тот же месячный лимит OpenAI,
// и это правильно, иначе мы перестанем видеть свой расход.
// Свои прогоны считаются отдельно (`<день>/svoi/…`) и в счёт посетителей НЕ идут.
const NASH_KLYUCH = () => String(process.env.PROVERKA_NASH_KLYUCH || '').trim();

// Свой вызов может попросить и полный разбор письмом — тот же, что уходит посетителю
// после формы. Секрет разбора остаётся на сервере: полосе ПИСЬМА второй ключ не нужен.
async function zapustitRazbor({ email, trade, city, yaz, klyuch }) {
  const sekret = process.env.RAZBOR_SECRET || '';
  if (!sekret) return 'нет RAZBOR_SECRET';
  try {
    const r = await fetch('https://businessinteldna.com/.netlify/functions/razbor-background', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-razbor-secret': sekret },
      body: JSON.stringify({ email, trade, city, yaz, k: klyuch }),
    });
    return String(r.status);
  } catch (e) {
    return 'упало: ' + (e && e.message);
  }
}

const MESTO = { type: 'approximate', country: 'US', timezone: 'America/New_York' };

const HEAD = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const den = () => new Date().toISOString().slice(0, 10);

function otvet(code, telo) {
  return { statusCode: code, headers: HEAD, body: JSON.stringify(telo) };
}

function openStore() {
  try { return getStore({ name: STORE }); } catch (e) { /* ниже */ }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.NETLIFY_API_TOKEN, process.env.EV_BLOBS_TOKEN]) {
    if (!t) continue;
    try { return getStore({ name: STORE, siteID, token: t }); } catch (e) { /* дальше */ }
  }
  return null;
}

// Квота через append-only: у Netlify Blobs нет атомарного инкремента, а read-modify-write
// на общем документе терял бы записи при одновременных заходах.
async function kvota(store, gost) {
  if (!store) return { mozhno: true, pochemu: 'без хранилища не считаем' };
  const d = den();
  try {
    const [moi, vse] = await Promise.all([
      store.list({ prefix: `${d}/gost/${gost}/` }),
      store.list({ prefix: `${d}/vse/` }),
    ]);
    if ((moi.blobs || []).length >= NA_GOSTYA_V_SUTKI) return { mozhno: false, pochemu: 'gost' };
    if ((vse.blobs || []).length >= VSEGO_V_SUTKI) return { mozhno: false, pochemu: 'vsego' };
    return { mozhno: true };
  } catch (e) {
    console.error('[proverka] квота не прочиталась:', e && e.message);
    return { mozhno: true, pochemu: 'квота недоступна' };
  }
}

// Отметка о нашем прогоне: нужна, чтобы знать свой расход, но потолков не трогает.
async function zanyatSvoim(store) {
  if (!store) return;
  try {
    await store.set(`${den()}/svoi/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, '');
  } catch (e) {
    console.error('[proverka] свой прогон не записался:', e && e.message);
  }
}

async function zanyat(store, gost) {
  if (!store) return;
  const d = den(), hvost = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  try {
    await Promise.all([
      store.set(`${d}/gost/${gost}/${hvost}`, ''),
      store.set(`${d}/vse/${hvost}`, ''),
    ]);
  } catch (e) { console.error('[proverka] квота не записалась:', e && e.message); }
}

const chisto = (s, max) => String(s || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);

// Имена компаний из нумерованного списка. Модель просят вернуть именно его.
function imena(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*(?:\d+[.)]|[-*•])\s*(.+?)\s*$/);
    if (!m) continue;
    let s = m[1].replace(/\*\*/g, '').replace(/\[(.+?)\]\(.*?\)/g, '$1');
    s = s.split(/\s[—–-]\s|:\s/)[0].trim();      // отрезаем пояснение после тире
    if (s.length >= 2 && s.length <= 80) out.push(s);
    if (out.length >= 8) break;
  }
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.OPENAI_API_KEY) return otvet(200, { pozzhe: true, pochemu: 'net-klyucha' });

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return otvet(400, { ok: false }); }
  const trade = chisto(b.trade, 60);
  const city = chisto(b.city, 60);
  if (trade.length < 2 || city.length < 2) return otvet(400, { ok: false, pochemu: 'pusto' });

  const h = event.headers || {};
  const gost = chisto(h['x-nf-client-connection-ip'] || h['client-ip'] || h['x-forwarded-for'] || 'net', 45)
    .split(',')[0].replace(/[^0-9a-f.:]/gi, '_');

  // Свой ключ принимаем и телом, и адресом: письмо шлёт полоса ПИСЬМА скриптом,
  // а руками проверять удобнее ссылкой.
  const q = event.queryStringParameters || {};
  const svoy = !!NASH_KLYUCH() && String(b.k || q.k || '').trim() === NASH_KLYUCH();

  const store = openStore();
  let razbor = null;
  if (svoy) {
    await zanyatSvoim(store);
    // Почту передали — значит нужен и полный разбор письмом. Ждать его не надо:
    // функция фоновая, отвечает сразу, письмо уходит само.
    const pochta = chisto(b.email, 120);
    if (/.+@.+\..+/.test(pochta)) {
      razbor = await zapustitRazbor({ email: pochta, trade, city,
                                      yaz: b.yaz === 'ru' ? 'ru' : 'en',
                                      klyuch: NASH_KLYUCH() });
      console.log('[proverka] свой разбор письмом запущен:', razbor, pochta);
    }
  } else {
    const k = await kvota(store, gost);
    if (!k.mozhno) return otvet(200, { pozzhe: true, pochemu: k.pochemu });
    await zanyat(store, gost);
  }

  // Вопрос ровно тот, который набрал бы покупатель. По-английски: он и ищет по-английски.
  const vopros =
    `Who is the best ${trade} in ${city}? Give me specific businesses I can call today.\n\n` +
    `Answer with a numbered list of business names only, up to eight, most recommended first. ` +
    `No preamble, no commentary, one name per line.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEADLINE);

  async function progon() {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
                 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'chat-latest',
        input: vopros,
        tools: [{ type: 'web_search', user_location: MESTO }],
        tool_choice: 'required',
      }),
    });
    if (!r.ok) throw new Error('openai ' + r.status);
    const d = await r.json();
    let text = '';
    for (const o of (d.output || [])) {
      for (const c of (o.content || [])) if (c.type === 'output_text') text += c.text + '\n';
    }
    return imena(text);
  }

  try {
    // Прогоны параллельно: последовательно три штуки в стену не влезут.
    const itogi = await Promise.allSettled(Array.from({ length: PROGONOV }, progon));
    const udachnyh = itogi.filter((x) => x.status === 'fulfilled' && x.value.length);
    if (!udachnyh.length) {
      const prichina = itogi.find((x) => x.status === 'rejected');
      console.error('[proverka] все прогоны мимо', prichina && prichina.reason && prichina.reason.message);
      return otvet(200, { pozzhe: true, pochemu: 'dvizhok' });
    }

    // Считаем, сколько прогонов из скольких назвали каждое имя. Это и есть разброс.
    const schet = new Map();
    for (const x of udachnyh) {
      for (const n of new Set(x.value)) {          // внутри одного прогона имя считаем один раз
        const k = n.toLowerCase();
        const e = schet.get(k) || { imya: n, raz: 0 };
        e.raz += 1; schet.set(k, e);
      }
    }
    const spisok = [...schet.values()].sort((a, b) => b.raz - a.raz).slice(0, 8);
    return otvet(200, { ok: true, dvizhok: 'ChatGPT', progonov: udachnyh.length,
                        imena: spisok, vopros: vopros.split('\n')[0],
                        razbor });   // null у посетителя; у своих — код запуска разбора
  } catch (e) {
    const pochemu = e && e.name === 'AbortError' ? 'ne-uspeli' : 'oshibka';
    console.error('[proverka]', pochemu, e && e.message);
    return otvet(200, { pozzhe: true, pochemu });
  } finally {
    clearTimeout(timer);
  }
};
