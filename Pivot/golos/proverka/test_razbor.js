// Проверка фонового разбора видимости.
//   node test_razbor.js ../../../netlify-functions/razbor-background.js
// Движки и Resend подменены: настоящих денег не тратим, проверяем логику.
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (r, ...a) {
  if (r === '@netlify/blobs') return { getStore: () => ({
    list: async ({ prefix } = {}) => ({ blobs: [...mem.keys()].filter(k => !prefix || k.startsWith(prefix)).map(key => ({ key })) }),
    set: async (k, v) => { mem.set(k, v === undefined ? '' : v); },
  }) };
  return orig.call(this, r, ...a);
};
process.env.RAZBOR_SECRET = 's';
process.env.OPENAI_API_KEY = 'o';
process.env.ANTHROPIC_API_KEY = 'a';
process.env.PERPLEXITY_API_KEY = 'p';
process.env.RESEND_API_KEY = 'r';

let pisma = [], vyzovy = [], rezhim = 'vse-ok';
const perplexityOdnovremenno = { seychas: 0, maks: 0 };

global.fetch = async (u, o) => {
  const url = String(u);
  if (url.includes('resend')) {
    pisma.push(JSON.parse(o.body.replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))));
    return { ok: true, status: 200, text: async () => '{}' };
  }
  const dv = url.includes('openai') ? 'openai' : url.includes('anthropic') ? 'anthropic' : 'perplexity';
  vyzovy.push(dv);
  if (dv === 'perplexity') {
    perplexityOdnovremenno.seychas++;
    perplexityOdnovremenno.maks = Math.max(perplexityOdnovremenno.maks, perplexityOdnovremenno.seychas);
    await new Promise(r => setTimeout(r, 30));
    perplexityOdnovremenno.seychas--;
  }
  if (rezhim === 'vse-padayut') return { ok: false, status: 500 };
  if (rezhim === 'padaet-claude' && dv === 'anthropic') return { ok: false, status: 429 };
  // У каждого движка свой список — так видно, что мы считаем по движкам, а не в кучу.
  const spiski = {
    openai: '1. Steadfast Roofing\n2. Westfall Roofing\n3. Blue Sky Roofing',
    anthropic: '1. Steadfast Roofing\n2. Arry’s Roofing\n3. Roof Panda',
    perplexity: '1. Steadfast Roofing\n2. Westfall Roofing\n3. SCM Roofing',
  };
  const t = spiski[dv];
  if (dv === 'openai') return { ok: true, status: 200, json: async () => ({ output: [{ content: [{ type: 'output_text', text: t }] }] }) };
  if (dv === 'anthropic') return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: t }] }) };
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: t } }] }) };
};

const { handler } = require(require('path').resolve(process.argv[2]));
const zvat = (body, sec = 's', metod = 'POST') =>
  handler({ httpMethod: metod, headers: { 'x-razbor-secret': sec }, body: JSON.stringify(body) });
const VHOD = { email: 'ivan@shop.com', trade: 'roofing', city: 'Tampa', yaz: 'ru' };

let bed = 0;
const p = (n, ok, x = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(62), ok ? 'ДА' : 'ПРОВАЛ', x); };
const sbros = () => { pisma = []; vyzovy = []; mem.clear(); perplexityOdnovremenno.maks = 0; };

(async () => {
  p('чужой секрет не пускает', (await zvat(VHOD, 'нет')).statusCode === 404);
  p('GET закрыт', (await zvat(VHOD, 's', 'GET')).statusCode === 405);
  p('без почты не считаем', (await zvat({ ...VHOD, email: 'нет' })).statusCode === 400);
  p('без города не считаем', (await zvat({ ...VHOD, city: '' })).statusCode === 400);

  sbros();
  await zvat(VHOD);
  p('девять прогонов: три движка по три', vyzovy.length === 9, 'вызовов ' + vyzovy.length);
  p('каждый движок ровно трижды',
    ['openai', 'anthropic', 'perplexity'].every(d => vyzovy.filter(x => x === d).length === 3));
  p('Perplexity строго по очереди (иначе 429)', perplexityOdnovremenno.maks === 1, 'макс разом ' + perplexityOdnovremenno.maks);
  p('человеку ушло РОВНО одно письмо', pisma.length === 1, 'писем ' + pisma.length);
  const pi = pisma[0] || {};
  p('это разбор, а не подтверждение', /Кого называют вместо вас/.test(pi.subject || ''), (pi.subject || '').slice(0, 44));
  p('письмо двуязычное', /[А-Яа-я]{6,}/.test(pi.html || '') && /three engines/.test(pi.html || ''));
  p('имя из всех трёх движков стоит первым', /Steadfast Roofing/.test((pi.html || '').slice(0, 1400)));
  p('показан разброс по движкам', /ChatGPT: \d\/3/.test(pi.html || '') && /Claude: \d\/3/.test(pi.html || '') && /Perplexity: \d\/3/.test(pi.html || ''));
  p('посчитаны удачные прогоны', /9 из 9|удачных прогонов 9/.test(pi.html || ''));
  p('Google AI Mode не упоминается', !/Google/i.test(pi.html || ''));
  p('поля человека подставлены', /roofing/.test(pi.html || '') && /Tampa/.test(pi.html || ''));

  sbros(); rezhim = 'padaet-claude';
  await zvat(VHOD);
  p('падение одного движка не отменяет разбор', pisma.length === 1 && /Кого называют/.test(pisma[0].subject));
  p('в разборе честно: шесть прогонов из девяти', /6 из 9|удачных прогонов 6/.test(pisma[0].html || ''));

  sbros(); rezhim = 'vse-padayut';
  await zvat(VHOD);
  p('все упали: уходит письмо о задержке, а не молчание', pisma.length === 1 && /задерживается/.test(pisma[0].subject));
  p('в письме о задержке сказано, что запрос не потерян', /не потерян/.test(pisma[0].text || ''));
  p('и оно тоже двуязычное', /delayed/.test(pisma[0].text || '') && /[А-Яа-я]{6,}/.test(pisma[0].text || ''));

  sbros(); rezhim = 'vse-ok';
  const d = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 10; i++) mem.set(d + '/' + i, '');
  await zvat(VHOD);
  p('дневной потолок: не считаем, но пишем честно', vyzovy.length === 0 && pisma.length === 1 && /задерживается/.test(pisma[0].subject));

  sbros();
  await zvat({ ...VHOD, yaz: 'en' });
  p('английская форма: английский заголовок первым', /^Who gets named/.test(pisma[0].subject || ''), (pisma[0].subject || '').slice(0, 40));

  // Сведение одной фирмы под двумя именами — живая находка 23.09.
  sbros();
  const spiski2 = {
    openai: '1. JA Edwards of America\n2. Tampa Roofing',
    anthropic: '1. JA Edwards of America Roofing\n2. Tampa Roof Repair',
    perplexity: '1. JA Edwards of America, Inc.\n2. Tampa Roofing',
  };
  const staryFetch = global.fetch;
  global.fetch = async (u, o) => {
    const url = String(u);
    if (url.includes('resend')) { pisma.push(JSON.parse(o.body.replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))))); return { ok: true, status: 200, text: async () => '{}' }; }
    const dv = url.includes('openai') ? 'openai' : url.includes('anthropic') ? 'anthropic' : 'perplexity';
    const t = spiski2[dv];
    if (dv === 'openai') return { ok: true, status: 200, json: async () => ({ output: [{ content: [{ type: 'output_text', text: t }] }] }) };
    if (dv === 'anthropic') return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: t }] }) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: t } }] }) };
  };
  await zvat(VHOD);
  const h2 = pisma[0].html || '';
  const strok = (h2.match(/<tr>/g) || []).length - 1;
  p('одна фирма под тремя именами сведена в одну строку', strok === 3, 'строк ' + strok);
  p('и посчитана как 9 из 9', /JA Edwards[^<]*<\/b><\/td><td[^>]*>9 из 9/.test(h2.replace(/\s+/g,' ')), '');
  p('«Tampa Roofing» и «Tampa Roof Repair» НЕ слиты', /Tampa Roofing/.test(h2) && /Tampa Roof Repair/.test(h2));
  global.fetch = staryFetch;

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ РАЗБОРА ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
