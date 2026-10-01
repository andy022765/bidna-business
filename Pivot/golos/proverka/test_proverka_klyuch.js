// Служебный ключ у бесплатной проверки видимости: свои идут мимо суточных потолков,
// чужие — нет. Ставится 25.09.2026.
//
//   node Pivot/golos/proverka/test_proverka_klyuch.js
//
// Сеть подменена целиком: ни одного настоящего вызова OpenAI, ни цента расхода.
const path = require('path');
const KOREN = path.join(__dirname, '..', '..', '..');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async (k) => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); },
    list: async ({ prefix } = {}) => ({
      blobs: [...mem.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) }),
    delete: async (k) => { mem.delete(k); } }) };
  return orig.call(this, req, ...a);
};
process.env.OPENAI_API_KEY = 'x';
process.env.PROVERKA_NASH_KLYUCH = 'proba-klyuch-123';
process.env.PROVERKA_NA_GOSTYA = '2';
process.env.PROVERKA_VSEGO = '3';
let vyzovov = 0;
global.fetch = async () => {
  vyzovov++;
  // Форма ответа как у настоящего /v1/responses: тип элемента обязателен,
  // без него функция считает прогон пустым и отвечает «движок молчит».
  return { ok: true, json: async () => ({ output: [{ content: [
    { type: 'output_text', text: '1. Acme Roofing\n2. Best Roofs\n3. Sunrise Roofing' }] }] }) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'proverka.js'));

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(54), ok ? 'ДА' : 'ПРОВАЛ', d); };
const zvat = (telo, ip) => handler({ httpMethod: 'POST', headers: { 'client-ip': ip },
  body: JSON.stringify(telo) }).then((r) => JSON.parse(r.body));
const den = new Date().toISOString().slice(0, 10);
const skolko = (pref) => [...mem.keys()].filter((k) => k.startsWith(pref)).length;

(async () => {
  const gost = { trade: 'roofer', city: 'Tampa' };

  console.log('--- посетитель упирается в потолки ---');
  await zvat(gost, '1.1.1.1');
  await zvat(gost, '1.1.1.1');
  const tretiy = await zvat(gost, '1.1.1.1');
  p('третья проверка с того же адреса отбита', tretiy.pozzhe === true && tretiy.pochemu === 'gost',
    JSON.stringify(tretiy).slice(0, 60));

  await zvat(gost, '2.2.2.2');
  const sayt = await zvat(gost, '3.3.3.3');
  p('потолок сайта (3) отбивает следующего', sayt.pozzhe === true && sayt.pochemu === 'vsego',
    JSON.stringify(sayt).slice(0, 60));

  console.log('\n--- свои идут мимо потолков ---');
  const svoy = await zvat({ ...gost, k: 'proba-klyuch-123' }, '9.9.9.9');
  p('с ключом проверка проходит, хотя потолок сайта выбран', !svoy.pozzhe,
    JSON.stringify(svoy).slice(0, 70));
  const svoy2 = await zvat({ ...gost, k: 'proba-klyuch-123' }, '9.9.9.9');
  const svoy3 = await zvat({ ...gost, k: 'proba-klyuch-123' }, '9.9.9.9');
  p('три подряд с ключом — все прошли', !svoy2.pozzhe && !svoy3.pozzhe);

  p('свои отметки лежат отдельно', skolko(`${den}/svoi/`) === 3, 'своих ' + skolko(`${den}/svoi/`));
  p('счётчик посетителей от своих не вырос', skolko(`${den}/vse/`) === 3,
    'посетителей ' + skolko(`${den}/vse/`));

  console.log('\n--- чужой ключ не работает ---');
  const chuzhoy = await zvat({ ...gost, k: 'ne-tot-klyuch' }, '8.8.8.8');
  p('неверный ключ — обычный потолок', chuzhoy.pozzhe === true, JSON.stringify(chuzhoy).slice(0, 60));

  delete process.env.PROVERKA_NASH_KLYUCH;
  const bezKlyucha = await zvat({ ...gost, k: '' }, '7.7.7.7');
  p('ключ не задан в переменных — пустой k не открывает дверь', bezKlyucha.pozzhe === true);

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : `\nВСЕ ПРОВЕРКИ КЛЮЧА ПРОШЛИ (вызовов к модели: ${vyzovov}, все подменены)`);
  process.exit(bed ? 1 : 0);
})();
