const Module = require('module'); const mem = new Map(); const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    set: async (k) => { mem.set(k, ''); },
    list: async () => ({ blobs: [...mem.keys()].map((key) => ({ key })) }) }) };
  return orig.call(this, req, ...a);
};
process.env.BOTY_SECRET = 's'; process.env.BOTY_KEY = 'kk';
const { handler } = require(process.argv[2]);
const post = (body, sec = 's') => handler({ httpMethod: 'POST', headers: { 'x-boty-secret': sec }, body: JSON.stringify(body) });
const get  = (q) => handler({ httpMethod: 'GET', queryStringParameters: q });
let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(60), ok ? 'ДА' : 'ПРОВАЛ', d); };
(async () => {
  p('без секрета запись не проходит', (await post({poroda:'vopros',bot:'GPTBot',put:'/'}, 'нет')).statusCode === 404);
  p('выдуманный робот отбит', (await post({poroda:'vopros',bot:'ЗлойБот',put:'/'})).statusCode === 400);
  p('выдуманная порода отбита', (await post({poroda:'хз',bot:'GPTBot',put:'/'})).statusCode === 400);
  await post({poroda:'poisk', bot:'PerplexityBot', put:'/vera/ru/'});
  await post({poroda:'poisk', bot:'PerplexityBot', put:'/vera/ru/'});   // тот же день
  p('повтор в тот же день НЕ плодит ключей', mem.size === 1, `ключей ${mem.size}`);
  await post({poroda:'obuchenie', bot:'GPTBot', put:'/visibility/'});
  await post({poroda:'vopros', bot:'ChatGPT-User', put:'/vera/ru/index.html?utm=x'});
  await post({poroda:'obuchenie', bot:'CCBot', put:'/чужое/левое/'});
  p('чужой путь схлопнут в «другое»', [...mem.keys()].some((k) => k.includes('|другое|')));
  p('хвост ?utm отрезан', [...mem.keys()].some((k) => k.includes('|/vera/ru/index.html|')));
  p('отчёт без ключа закрыт', (await get({})).statusCode === 404);
  const j = JSON.parse((await get({ k: 'kk' })).body);
  p('в «живом вопросе» только -User', Object.keys(j.svod.vopros).sort().join(',') === 'ChatGPT-User');
  p('поисковый индекс отделён от вопроса', Object.keys(j.svod.poisk).sort().join(',') === 'PerplexityBot');
  p('в «обучении» два робота', Object.keys(j.svod.obuchenie).sort().join(',') === 'CCBot,GPTBot');
  p('порода не перепутана: GPTBot не попал в живой вопрос', !j.svod.vopros.GPTBot);
  p('дата первого прихода записана', /^\d{4}-\d{2}-\d{2}$/.test(j.svod.poisk.PerplexityBot['/vera/ru/'].vpervye));
  // Отметки, записанные до 25.09 с прежним делением, лежат в хранилище с породой «vopros».
  // Читаться они обязаны уже по новому правилу, иначе история врёт в ту же сторону.
  mem.set(['vopros', 'OAI-SearchBot', '/vera/ru/', '2026-09-24'].join('|'), '');
  const j2 = JSON.parse((await get({ k: 'kk' })).body);
  p('старая отметка индекса читается как индекс', !!j2.svod.poisk['OAI-SearchBot'] && !j2.svod.vopros['OAI-SearchBot']);
  const h = await get({ k: 'kk', view: 1 });
  p('таблица отдаётся html', /text\/html/.test(h.headers['Content-Type']) && /живой вопрос/.test(h.body));
  p('в таблице три породы', /живой вопрос/.test(h.body) && /поисковый индекс/.test(h.body) && /обучение/.test(h.body));
  p('в таблице честно сказано, что Google не виден', /Google-Extended/.test(h.body) && /только строка для robots/.test(h.body));
  mem.clear();
  const pusto = await get({ k: 'kk', view: 1 });
  p('пустое хранилище: «ни одной отметки», а не поломка', /ни одной отметки/.test(pusto.body) && pusto.statusCode === 200);
  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ СЧЁТЧИКА ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
