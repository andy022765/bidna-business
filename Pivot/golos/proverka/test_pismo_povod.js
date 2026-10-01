// Повод у письма: продающее письмо уходит ТОЛЬКО по prosil.
// Ставится 26.09.2026 (Лос-Анджелес) после обкатки: запрет «не вызывай инструмент
// при жалобе» модель нарушила дважды, и человек, сказавший «вы плохо сделали работу»,
// получил письмо «Your work list». Теперь это решает сервер, а не послушание модели.
//
//     node Pivot/golos/proverka/test_pismo_povod.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
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
process.env.GOLOS_VLADELEC = 'support@businessinteldna.com';
let pisma = [];
global.fetch = async (url, opts) => {
  if (String(url).includes('resend')) { try { pisma.push(JSON.parse(opts.body)); } catch (_) {} }
  return { ok: true, status: 200, text: async () => '{}',
           json: async () => ({ Answer: [{ data: 'mx' }] }) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'pismo.js'));
const realNow = Date.now; let sdvig = 0; Date.now = () => realNow() + sdvig;

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(60), ok ? 'ДА' : 'ПРОВАЛ', d); };
const zov = (telo) => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                                body: JSON.stringify(telo) }).then(r => JSON.parse(r.body));

// Два шага: сперва чтение по буквам, потом подтверждение. Между ними — пауза.
async function dvaShaga(pochta, povod, yazyk = 'en') {
  mem.clear(); pisma = [];
  await zov({ email: pochta, podtverdil: false, povod, yazyk });
  sdvig += 60000;
  return zov({ email: pochta, podtverdil: true, otvet: 'yes', povod, yazyk });
}
const komuUshlo = () => pisma.map(x => (x.to || []).join(','));

(async () => {
  console.log('--- prosil: письмо звонящему уходит ---');
  const a = await dvaShaga('kto1@gmail.com', 'prosil');
  // Успех pismo.js отдаёт полем ok, а не otpravleno: otpravleno: false бывает только
  // в отказах и на первом шаге. Проверять надо ok плюс адрес получателя.
  p('отправлено звонящему', a.ok === true && !('otpravleno' in a), JSON.stringify(a).slice(0, 70));
  p('вслух сказано, что письмо ушло', /Sent/i.test(a.skazat || ''), a.skazat || '');
  p('письмо ушло ровно на его адрес', komuUshlo().includes('kto1@gmail.com'), komuUshlo().join(' | '));

  console.log('\n--- zhaloba: звонящему НИЧЕГО, владельцу пометка ---');
  const zh = await dvaShaga('kto2@gmail.com', 'zhaloba');
  p('звонящему не отправлено', zh.otpravleno === false);
  p('его адреса среди получателей нет', !komuUshlo().includes('kto2@gmail.com'), komuUshlo().join(' | '));
  p('владельцу письмо ушло', komuUshlo().includes('support@businessinteldna.com'));
  const vl = pisma.find(x => (x.to || []).includes('support@businessinteldna.com')) || {};
  p('в теме пометка ЖАЛОБА', /ЖАЛОБА/.test(vl.subject || ''), vl.subject || '');
  p('в письме владельцу есть адрес звонящего', /kto2@gmail\.com/.test(vl.html || ''));
  p('Вере велено сказать, что напишет человек',
    /write to you personally/i.test(zh.skazat || ''), zh.skazat || '');

  console.log('\n--- vozvrat: то же самое ---');
  const vz = await dvaShaga('kto3@gmail.com', 'vozvrat');
  p('звонящему не отправлено', vz.otpravleno === false);
  p('его адреса среди получателей нет', !komuUshlo().includes('kto3@gmail.com'));
  const vl2 = pisma.find(x => (x.to || []).includes('support@businessinteldna.com')) || {};
  p('в теме пометка ВОЗВРАТ', /ВОЗВРАТ/.test(vl2.subject || ''), vl2.subject || '');

  console.log('\n--- по-русски жалоба звучит по-русски ---');
  const ru = await dvaShaga('kto4@gmail.com', 'zhaloba', 'ru');
  p('фраза русская', /Андрей и Маша напишут вам сами/.test(ru.skazat || ''), ru.skazat || '');

  console.log('\n--- повод не передали: не отправляем ничего ---');
  const net = await dvaShaga('kto5@gmail.com', undefined);
  p('ничего не отправлено', net.otpravleno === false);
  p('никому ни одного письма', pisma.length === 0, 'писем ' + pisma.length);
  p('Вера молчит, а не импровизирует', net.skazat === '', JSON.stringify(net.skazat));
  p('в dalshe названы все три повода',
    /prosil/.test(net.dalshe || '') && /zhaloba/.test(net.dalshe || '') && /vozvrat/.test(net.dalshe || ''));

  console.log('\n--- РУССКАЯ линия без повода продолжает работать ---');
  // Это главная защита от моей же правки: у русского otpravit_ssylku поля повода нет,
  // и потребуй сервер повода от всех — живая линия перестала бы отправлять письма.
  const ruBez = await dvaShaga('kto7@gmail.com', undefined, 'ru');
  p('русское письмо ушло и без повода', ruBez.ok === true, JSON.stringify(ruBez).slice(0, 70));
  p('ушло именно звонящему', komuUshlo().includes('kto7@gmail.com'), komuUshlo().join(' | '));
  p('а по-английски без повода — не ушло бы',
    (await dvaShaga('kto8@gmail.com', undefined, 'en')).otpravleno === false);

  console.log('\n--- жалоба блокируется на ЛЮБОМ языке ---');
  const ruZh = await dvaShaga('kto9@gmail.com', 'zhaloba', 'ru');
  p('русская жалоба звонящему письма не даёт',
    ruZh.otpravleno === false && !komuUshlo().includes('kto9@gmail.com'));

  console.log('\n--- чужой повод не проходит как prosil ---');
  const chuzhoy = await dvaShaga('kto6@gmail.com', 'reklama');
  p('выдуманный повод = как будто не передали', chuzhoy.otpravleno === false && pisma.length === 0);

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ПОВОДА ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
