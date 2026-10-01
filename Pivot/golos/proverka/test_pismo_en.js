// Английская ветка pismo.js. Ставится 25.09.2026, вместе с английской Верой.
//
//     node Pivot/golos/proverka/test_pismo_en.js Pivot/golos/site/netlify-functions/pismo.js
//
// Три вещи, и третья дороже первых двух:
//   1. адрес читается по-английски («at», «dot», буквы группами по три);
//   2. письмо уходит английское, с lang="en" и английской темой;
//   3. НИ ОДНОЙ русской фразы не осталось в том, что Вера произносит вслух.
// Третья проверка смотрит в сам исходник: собирает все литералы, отданные в otvet()
// и otvetSuhoy(), и требует пару в EN_FRAZY. Так новая фраза без перевода падает здесь,
// а не звучит по-русски в разговоре с американцем.
// С 26.09.2026 английская линия ТРЕБУЕТ поле povod: без него письмо не уходит вовсе
// (защита от продающего письма в ответ на жалобу). Поэтому во всех английских вызовах
// ниже стоит povod: 'prosil'. Отдельно повод проверяется в test_pismo_povod.js.
const fs = require('fs');
const path = process.argv[2];
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async k => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); } }) };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's';
process.env.RESEND_API_KEY = 'k';
let poslPismo = null;
global.fetch = async (url, opts) => {
  try { poslPismo = JSON.parse(opts.body); } catch (_) {}
  return { ok: true, status: 200, text: async () => '{}' };
};
const mod = require(path);
const { handler, _en } = mod;
const realNow = Date.now; let sdvig = 0; Date.now = () => realNow() + sdvig;

let provalov = 0;
const p = (n, uslovie, podrobno = '') => {
  if (!uslovie) provalov++;
  console.log('  ' + n.padEnd(58), uslovie ? 'ДА' : 'ПРОВАЛ', podrobno);
};
const call = (body) => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                                 body: JSON.stringify(body) })
  .then(r => JSON.parse(r.body));

(async () => {
  console.log('--- чтение адреса по-английски ---');
  const b = _en.poBukvamEn;
  p('gmail говорится словом', b('ab@gmail.com') === 'A B, at, gmail dot com', b('ab@gmail.com'));
  p('буквы группами по три', b('andrii@gmail.com').startsWith('A N D, R I I,'), b('andrii@gmail.com'));
  p('одиночный хвост приклеен к группе', !/, [A-Z]$/.test(b('abcd@gmail.com').split(', at,')[0]),
    b('abcd@gmail.com'));
  p('цифры словами, не числом', b('a1b23@gmail.com').includes('one') && b('a1b23@gmail.com').includes('two three'),
    b('a1b23@gmail.com'));
  p('точка и дефис словами', b('a.b-c@gmail.com').includes('dot') && b('a.b-c@gmail.com').includes('dash'),
    b('a.b-c@gmail.com'));
  p('незнакомый домен по буквам', b('x@acme-corp.io') === 'X, at, A C M E, dash, C O R P dot I O',
    b('x@acme-corp.io'));
  p('ни одной кириллицы в чтении', !/[а-яА-Я]/.test(b('a.b-1@acme.co.uk')), b('a.b-1@acme.co.uk'));

  console.log('\n--- разговор по-английски ---');
  const C = 'conv_en_1234567';
  const r1 = await call({ email: 'a.b@gmail.com', shag: 'razbor', razgovor: C, yazyk: 'en', povod: 'prosil' });
  p('шаг 1: зачитала по-английски', /^Let me read it back:/.test(r1.skazat || ''), (r1.skazat || '').slice(0, 70));
  p('шаг 1: письмо ещё не ушло', poslPismo === null);

  sdvig += 12000;
  const r2 = await call({ email: 'a.b@gmail.com', shag: 'razbor', podtverdil: true, razgovor: C, yazyk: 'en', povod: 'prosil' });
  p('шаг 2: сказала по-английски', /^Sent — please check/.test(r2.skazat || ''), (r2.skazat || '').slice(0, 60));
  p('тема письма английская', (poslPismo || {}).subject === 'Your work list — Business Intelligence DNA',
    (poslPismo || {}).subject);
  p('в письме lang="en"', ((poslPismo || {}).html || '').includes('<html lang="en">'));
  p('в письме нет кириллицы', !/[а-яА-Я]/.test((poslPismo || {}).html || ''));

  poslPismo = null;
  const r3 = await call({ email: 'a.b@gmail.com', shag: 'diagnostika', podtverdil: true, povtor: true,
                          razgovor: C, yazyk: 'en', povod: 'prosil' });
  p('повтор по-английски', /^Sent again\./.test(r3.skazat || ''), (r3.skazat || '').slice(0, 50));
  p('тема диагностики английская', (poslPismo || {}).subject === 'Your diagnostic link — Business Intelligence DNA',
    (poslPismo || {}).subject);

  const r4 = await call({ email: 'x@b..com', shag: 'razbor', podtverdil: false, razgovor: C, yazyk: 'en', povod: 'prosil' });
  p('кривой адрес — отказ по-английски', !/[а-яА-Я]/.test(r4.skazat || ''), (r4.skazat || '').slice(0, 60));

  console.log('\n--- русский путь не сдвинулся ---');
  const ru = await call({ email: 'a.b@gmail.com', shag: 'razbor', razgovor: 'conv_ru_7654321' });
  p('без yazyk — по-русски', /^Проверю по буквам:/.test(ru.skazat || ''), (ru.skazat || '').slice(0, 40));
  const krivoy = await call({ email: 'a.b@gmail.com', shag: 'razbor', razgovor: 'conv_ru_9999999', yazyk: 'ENGL' });
  p('чужое значение yazyk — по-русски', /^Проверю по буквам:/.test(krivoy.skazat || ''));

  console.log('\n--- в исходнике нет фразы без перевода ---');
  const src = fs.readFileSync(path, 'utf8');
  const frazy = new Set();
  for (const m of src.matchAll(/otvet\s*\(\s*\d+\s*,\s*(?:true|false)\s*,\s*(['"`])([^'"`]*?)\1/g)) frazy.add(m[2]);
  for (const m of src.matchAll(/otvetSuhoy\s*\(\s*(['"`])([^'"`]*?)\1/g)) frazy.add(m[2]);
  // Поля skazat и dalshe в обычных объектах ответа — их первая версия проверки НЕ видела,
  // и русское указание модели уехало на живую функцию. Нашлось прогоном, а не тестом.
  // Строки бывают склеены через +, поэтому сначала берём кусок, потом собираем литералы.
  for (const m of src.matchAll(/\b(?:skazat|dalshe)\s*:\s*((?:'(?:[^'\\]|\\.)*'\s*(?:\+\s*)?)+)/g)) {
    const celoe = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]).join('');
    if (celoe) frazy.add(celoe);
  }
  const bezPary = [...frazy].filter(f => /[а-яА-Я]/.test(f) && !_en.EN_FRAZY[f]);
  p(`фраз найдено ${frazy.size}, без английской пары`, bezPary.length === 0,
    bezPary.map(s => s.slice(0, 40)).join(' | '));

  console.log(provalov ? `\nПРОВАЛОВ: ${provalov}` : '\nВСЕ ПРОВЕРКИ АНГЛИЙСКОЙ ВЕТКИ ПРОШЛИ');
  process.exit(provalov ? 1 : 0);
})();
