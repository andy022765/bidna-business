// Подтверждение записи обязано уходить ВСЕГДА, даже если сегодня на этот адрес уже уходило
// письмо-материалы. Ставится 26.09.2026 (Лос-Анджелес) после приёмки: человек записался
// (conv_1201m3g98ffgev4avvcrw7bvv63n), встреча в календаре появилась, письма он не получил,
// а Вера сказала «письмо уже ушло» про письмо, которого не было. Приглашение из календаря
// человеку не приходит вовсе, значит это письмо — единственное, чем он узнаёт о встрече.
//
//     node Pivot/golos/proverka/test_pismo_zapis.js
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
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(62), ok ? 'ДА' : 'ПРОВАЛ', d); };
const zov = (telo) => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                                body: JSON.stringify(telo) }).then(r => JSON.parse(r.body));

// Два шага, как в жизни: сперва чтение адреса по буквам, потом подтверждение.
async function dvaShaga(pochta, razgovor, yazyk = 'en') {
  await zov({ email: pochta, podtverdil: false, povod: 'prosil', shag: 'razbor', yazyk, razgovor });
  sdvig += 60000;
  return zov({ email: pochta, podtverdil: true, otvet: 'yes', povod: 'prosil',
               shag: 'razbor', yazyk, razgovor });
}

(async () => {
  const POCHTA = 'daniel@gmail.com';

  // --- 1. Утром взял материалы, днём записался: письмо о встрече обязано уйти.
  mem.clear(); pisma = [];
  await dvaShaga(POCHTA, 'conv_utrom0000');
  p('утреннее письмо-материалы ушло', pisma.length === 1, `писем ${pisma.length}`);

  mem.set('zapis:conv_dnem00000', JSON.stringify(
    { start_time: '2026-09-28T17:30:00.000Z', slovami: 'Monday, September 28 at 10:30 AM' }));
  const r = await dvaShaga(POCHTA, 'conv_dnem00000');
  p('письмо о записи НЕ съедено защитой от дублей', pisma.length === 2, `писем ${pisma.length}`);
  p('Вера не говорит «письмо уже ушло»', !/already gone|уже ушло/i.test(r.skazat || ''), r.skazat);
  const pz = pisma[1] || {};
  p('тема письма — про встречу, не про список работ',
    /booked/i.test(pz.subject || ''), pz.subject);
  p('в тексте стоит время встречи',
    (pz.html || '').includes('Monday, September 28 at 10:30 AM'));
  p('в тексте сказано, что встреча записана',
    /Your call is booked/i.test(pz.html || ''));

  // --- 2. Второе письмо-материалы в тот же день по-прежнему не уходит.
  mem.clear(); pisma = [];
  await dvaShaga(POCHTA, 'conv_pervyy0000');
  const r2 = await dvaShaga(POCHTA, 'conv_vtoroy0000');
  p('обычный дубль за сутки по-прежнему съедается', pisma.length === 1, `писем ${pisma.length}`);
  p('и про него Вера честно говорит «уже ушло»',
    /already gone/i.test(r2.skazat || ''), r2.skazat);

  // --- 3. Две записи в разных разговорах: оба подтверждения уходят.
  mem.clear(); pisma = [];
  mem.set('zapis:conv_pervaya000', JSON.stringify({ slovami: 'Monday, September 28 at 10:30 AM' }));
  await dvaShaga(POCHTA, 'conv_pervaya000');
  mem.set('zapis:conv_vtoraya000', JSON.stringify({ slovami: 'Tuesday, September 29 at 9:00 AM' }));
  await dvaShaga(POCHTA, 'conv_vtoraya000');
  p('две записи за день — два подтверждения', pisma.length === 2, `писем ${pisma.length}`);
  p('второе письмо про свою встречу, а не про первую',
    (pisma[1] || {}).html && pisma[1].html.includes('Tuesday, September 29 at 9:00 AM'));

  // Повтор по ТОЙ ЖЕ встрече — по-прежнему одно письмо.
  mem.clear(); pisma = [];
  mem.set('zapis:conv_odna00000a', JSON.stringify({ start_time: 'X', slovami: 'Monday at 10:30 AM' }));
  await dvaShaga(POCHTA, 'conv_odna00000a');
  mem.set('zapis:conv_odna00000b', JSON.stringify({ start_time: 'X', slovami: 'Monday at 10:30 AM' }));
  await dvaShaga(POCHTA, 'conv_odna00000b');
  p('повтор по той же встрече письма не дублирует', pisma.length === 1, `писем ${pisma.length}`);

  // --- 4. Русская линия: та же строка по-русски.
  mem.clear(); pisma = [];
  mem.set('zapis:conv_russkiy000', JSON.stringify({ slovami: 'понедельник, 28 сентября в 10:30' }));
  await dvaShaga(POCHTA, 'conv_russkiy000', 'ru');
  const pr = pisma[0] || {};
  p('по-русски тема про встречу', /записана/i.test(pr.subject || ''), pr.subject);
  p('по-русски время встречи в тексте',
    (pr.html || '').includes('понедельник, 28 сентября в 10:30'));

  // --- 5. Без метки записи письмо остаётся прежним до байта.
  mem.clear(); pisma = [];
  await dvaShaga(POCHTA, 'conv_bezzapisi0');
  const pb = pisma[0] || {};
  p('без записи тема прежняя', /work list/i.test(pb.subject || ''), pb.subject);
  p('без записи строки о встрече нет', !/is booked/i.test(pb.html || ''));

  console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
  process.exit(bed ? 1 : 0);
})();
