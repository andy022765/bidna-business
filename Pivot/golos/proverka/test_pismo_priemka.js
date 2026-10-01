// Две находки приёмки 22.09, которые закрывает сервер, а не промпт.
//   node test_pismo_priemka.js ../site/netlify-functions/pismo.js
//
// A. Мёртвый почтовый домен. conv_3201m34zv4fsem2vgy2bjafqryvj: распознаватель склеил
//    «businessintel.dadna.com», звонящий подтвердил чтение, письмо ушло в никуда.
//    dadna.com — припаркованный домен: отвечает на любой поддомен, MX = localhost.
//    DNS здесь НАСТОЯЩИЙ: проверяем ровно тот адрес, на котором сломались.
// B. Бронь «уже ушло» при отказе Resend. Отметка ставится до отправки; если Resend отказал,
//    а бронь осталась, следующий вызов отвечал «Письмо на этот адрес уже ушло» — неправда.
const path = process.argv[2];
if (!path) { console.log('укажи путь к pismo.js'); process.exit(2); }
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async (k) => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); },
    delete: async (k) => { mem.delete(k); } }) };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's'; process.env.RESEND_API_KEY = 'k';
let resendOk = true, pisem = 0;
global.fetch = async () => { pisem++; return { ok: resendOk, status: resendOk ? 200 : 422, text: async () => '{}' }; };
const { handler } = require(require('path').resolve(path));
let sdvig = 0; const realNow = Date.now; Date.now = () => realNow() + sdvig;
const call = async (body) => JSON.parse((await handler({ httpMethod: 'POST',
  headers: { 'x-golos-secret': 's' }, body: JSON.stringify(body) })).body);

let provalov = 0;
const proverit = (n, uslovie, podrobno = '') => {
  if (!uslovie) provalov++;
  console.log('  ' + n.padEnd(62), uslovie ? 'ДА' : 'ПРОВАЛ', podrobno);
};
const dvaShaga = async (email, razgovor) => {
  const r1 = await call({ email, shag: 'razbor', podtverdil: false, razgovor });
  sdvig += 15000;
  const r2 = await call({ email, shag: 'razbor', podtverdil: true, otvet: 'Да, верно', razgovor });
  return [r1, r2];
};

(async () => {
  console.log('\nA. мёртвый почтовый домен');
  let p0 = pisem;
  const a1 = await call({ email: 'andrii+priemka@businessintel.dadna.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_priemka0001' });
  proverit('businessintel.dadna.com: по буквам не зачитан', a1.otpravleno === false && !/по буквам/.test(a1.skazat || ''), `«${(a1.skazat || '').slice(0, 50)}»`);
  proverit('сказано, что адреса нет, и просят продиктовать заново', /не существует/.test(a1.skazat || ''));
  sdvig += 15000;
  const a2 = await call({ email: 'andrii+priemka@businessintel.dadna.com', shag: 'razbor', podtverdil: true, otvet: 'Да, теперь всё верно', razgovor: 'conv_priemka0001' });
  proverit('даже с «да, верно» письмо на мёртвый домен не уходит', a2.otpravleno === false && a2.ok !== true && pisem === p0, `писем +${pisem - p0}`);
  proverit('в ответе нет слов «отправила» / «ушло»', !/отправила|ушло/.test(a2.skazat || ''));
  const [, a3] = await dvaShaga('andrii+priemka-02@businessinteldna.com', 'conv_priemka0002');
  proverit('живой домен (наш): два шага, письмо ушло', a3.ok === true && pisem === p0 + 1, `писем +${pisem - p0}`);
  const [, a4] = await dvaShaga('someone@gmail.com', 'conv_priemka0003');
  proverit('живой домен (gmail): письмо ушло', a4.ok === true && pisem === p0 + 2);

  console.log('\nB. Resend отказал — бронь «уже ушло» снимается');
  resendOk = false; p0 = pisem;
  const [, b1] = await dvaShaga('otkaz@gmail.com', 'conv_priemka0004');
  proverit('Resend отказал: «письмо сейчас не уходит», не «ушло»', b1.ok === false && /не уходит/.test(b1.skazat || ''), `«${(b1.skazat || '').slice(0, 40)}»`);
  resendOk = true;
  const b2 = await call({ email: 'otkaz@gmail.com', shag: 'razbor', podtverdil: true, otvet: 'Да', razgovor: 'conv_priemka0004' });
  proverit('повторная попытка НЕ отвечает «уже ушло»', !/уже ушло/.test(b2.skazat || ''), `«${(b2.skazat || '').slice(0, 40)}»`);
  proverit('повторная попытка реально отправила письмо', b2.ok === true && pisem === p0 + 2, `писем +${pisem - p0}`);
  const b3 = await call({ email: 'otkaz@gmail.com', shag: 'razbor', podtverdil: true, otvet: 'Да', razgovor: 'conv_priemka0004' });
  proverit('после настоящей отправки дубль честно: «уже ушло», без второго письма', /уже ушло/.test(b3.skazat || '') && pisem === p0 + 2);


  console.log('\nВ. незнакомый домен — сначала по буквам');
  p0 = pisem; mem.clear();
  const v1 = await call({ email: 'ivan@anthropic.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_priemka0005' });
  proverit('чужой живой домен: просят продиктовать по буквам', /по буквам/.test(v1.skazat || '') && !/Проверю/.test(v1.skazat || ''), `«${(v1.skazat || '').slice(0, 45)}»`);
  const v2 = await call({ email: 'ivan@netflix.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_priemka0005' });
  proverit('после букв идёт обычное чтение адреса', /Проверю по буквам/.test(v2.skazat || ''), `«${(v2.skazat || '').slice(0, 45)}»`);
  sdvig += 15000;
  const v3 = await call({ email: 'ivan@netflix.com', shag: 'razbor', podtverdil: true, otvet: 'Да, верно', razgovor: 'conv_priemka0005' });
  proverit('подтверждение проходит, письмо уходит', v3.ok === true && pisem === p0 + 1, `писем +${pisem - p0}`);
  const g1 = await call({ email: 'ivanov42@gmail.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_priemka0006' });
  proverit('gmail: лишнего хода нет, сразу чтение по буквам', /Проверю по буквам/.test(g1.skazat || ''));
  const n1 = await call({ email: 'andrii+x@businessinteldna.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_priemka0007' });
  proverit('наш домен: лишнего хода нет', /Проверю по буквам/.test(n1.skazat || ''));
  console.log(provalov ? `\nПРОВАЛОВ: ${provalov}` : '\nВСЕ ПРОВЕРКИ ПРИЁМКИ ПРОШЛИ');
  process.exit(provalov ? 1 : 0);
})();
