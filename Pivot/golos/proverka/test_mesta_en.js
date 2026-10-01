// Быстрая проверка английской ветки mesta.js: русский путь и английский на одних заглушках.
const path = process.argv[2];
process.env.GOLOS_PISMO_SECRET = 's';
let left = 7, unknown = false;
global.fetch = async () => ({ json: async () => (unknown ? { unknown: true } : { left, valid: true }) });
const { handler } = require(path);
const call = (body) => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                                 body: JSON.stringify(body) }).then(r => JSON.parse(r.body));
let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(46), ok ? 'ДА' : 'ПРОВАЛ', d); };
(async () => {
  const ru = await call({});
  p('без yazyk — по-русски', ru.skazat === 'Осталось семь мест.', ru.skazat);
  const en = await call({ yazyk: 'en' });
  p('yazyk=en — по-английски', en.skazat === 'seven places left.', en.skazat);
  left = 1;
  p('единственное число по-английски', (await call({ yazyk: 'en' })).skazat === 'one place left.');
  left = 0;
  p('мест нет — английская фраза', /free places are gone/.test((await call({ yazyk: 'en' })).skazat));
  p('мест нет — русская фраза', /закончились/.test((await call({})).skazat));
  unknown = true;
  p('неизвестно — английская фраза', /limited number of places/.test((await call({ yazyk: 'en' })).skazat));
  p('неизвестно — русская фраза', /ограниченное число/.test((await call({})).skazat));
  const bezSekreta = await handler({ httpMethod: 'POST', headers: {}, body: '{"yazyk":"en"}' })
    .then(r => JSON.parse(r.body));
  p('без секрета — отказ по-английски', /can't check that/.test(bezSekreta.skazat), bezSekreta.skazat);
  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ МЕСТ ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
