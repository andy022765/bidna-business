// Метка визита для Сборщика отзывов (патч 29.09.2026, Pivot/produkty/otzyvy/site/dlya-very).
// kalendar-zapis.js после записи ставит `otzyvy-vizit:<id события>` (конец визита, имя, язык — БЕЗ почты:
// названный при записи адрес никто не подтверждал), а в `zapis:<разговор>` — event_id. pismo.js после
// ушедшего подтверждения дописывает в метку адрес, на который оно РЕАЛЬНО ушло; второй, другой адрес
// в том же разговоре помечает метку pochta_neodnoznachna. Сбой метки не ломает ни запись, ни письмо.
// Хранилище поднимается ТАК ЖЕ, как на стенде: голый getStore бросает, с токеном отдаёт.
//     node Pivot/golos/proverka/test_otzyvy_metka.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
const Module = require('module');
const mem = new Map();
let lomatMetku = false;
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: (o = {}) => {
    if (!o.token) throw new Error('The environment has not been configured to use Netlify Blobs');
    return { get: async k => mem.get(k) ?? null,
             set: async (k, v) => { if (lomatMetku && k.startsWith('otzyvy-vizit:')) throw new Error('blobs write failed'); mem.set(k, v); },
             delete: async k => { mem.delete(k); } };
  } };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's';
process.env.EV_BLOBS_TOKEN = 'tok';
process.env.SITE_ID = 'site';
process.env.RESEND_API_KEY = 'k';
process.env.KALENDAR_ID = 'kal@group.calendar.google.com';
process.env.KALENDAR_POYAS = 'America/Los_Angeles';
const { generateKeyPairSync } = require('crypto');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.GOOGLE_SA_JSON = JSON.stringify({ client_email: 'a@b.iam.gserviceaccount.com', private_key: privateKey });

let nomer = 0, resendOk = true, pisma = [];
global.fetch = async (url, opt = {}) => {
  const u = String(url);
  if (u.includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }), text: async () => '{}' };
  if (u.includes('/freeBusy')) return { ok: true, status: 200,
    text: async () => JSON.stringify({ calendars: { 'kal@group.calendar.google.com': { busy: [] } } }) };
  if (u.includes('/events') && opt.method === 'POST') return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'ev_' + (++nomer) }) };
  if (u.includes('resend')) {
    if (!resendOk) return { ok: false, status: 500, text: async () => '{"message":"fail"}' };
    try { pisma.push(JSON.parse(opt.body)); } catch (_) {}
  }
  return { ok: true, status: 200, text: async () => '{}', json: async () => ({ Answer: [{ data: 'mx' }] }) };
};

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(66), ok ? 'ДА' : 'ПРОВАЛ', d); };
const metka = (id) => { const v = mem.get('otzyvy-vizit:' + id); return v ? JSON.parse(v) : null; };

(async () => {
  const zapisat = require(path.join(KOREN, 'netlify-functions', 'kalendar-zapis.js')).handler;
  const pismo = require(path.join(KOREN, 'netlify-functions', 'pismo.js')).handler;
  const { svobodnye, podklyuchitBlobs } = require(path.join(KOREN, 'kalendar-lib', 'gkal.js'));
  podklyuchitBlobs(require('@netlify/blobs').getStore);
  const okna = await svobodnye();
  if (!okna.okna || !okna.okna.length) { console.log('  свободных окон нет — тест бессмыслен'); process.exit(1); }
  const kogda = okna.okna[0];
  const zov = (f, telo) => f({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' }, body: JSON.stringify(telo) }).then(r => JSON.parse(r.body));

  // 1. Запись с почтой и разговором.
  const r1 = await zov(zapisat, { start_time: kogda, imya: 'Daniel Brooks', pochta: 'Daniel@Gmail.com', yazyk: 'en', razgovor: 'conv_otzyv000000001' });
  p('запись прошла', r1.zapisano === true);
  const m1 = metka(r1.id);
  p('метка визита по id события есть', !!m1, JSON.stringify(m1 || {}).slice(0, 80));
  p('конец визита = начало + длина встречи', m1 && m1.konec === new Date(Date.parse(kogda) + 30 * 60000).toISOString(), m1 && m1.konec);
  p('имя, язык линии, календарь; неподтверждённой почты в метке нет', m1 && !('pochta' in m1) && m1.imya === 'Daniel Brooks' && m1.yazyk === 'en' && m1.kalendar === 'kal@group.calendar.google.com');
  const z1 = JSON.parse(mem.get('zapis:conv_otzyv000000001') || '{}');
  p('в метке записи для pismo.js есть event_id', z1.event_id === r1.id, z1.event_id);
  p('прежние поля метки записи на месте', !!z1.slovami && !!z1.start_time);

  // 2. Без почты и без id разговора: метка визита есть, почты нет, метки zapis: нет.
  mem.clear();
  const r2 = await zov(zapisat, { start_time: kogda, imya: 'Анна', yazyk: 'ru', razgovor: '' });
  const m2 = metka(r2.id);
  p('без разговора — метка визита всё равно есть', !!m2);
  p('без почты — почты нет, язык ru', m2 && !m2.pochta && m2.yazyk === 'ru');
  p('без разговора метки zapis: нет, как и было', ![...mem.keys()].some(k => k.startsWith('zapis:')));

  // 3. Хранилище метки визита падает — запись проходит, как раньше.
  lomatMetku = true;
  const r3 = await zov(zapisat, { start_time: kogda, yazyk: 'en', razgovor: 'conv_otzyv000000003' });
  lomatMetku = false;
  p('сбой метки визита не ломает запись', r3.zapisano === true && !!mem.get('zapis:conv_otzyv000000003'));

  // 4. Подтверждение записи ушло — адрес дописан в метку, остальное сохранено.
  const realNow = Date.now; let sdvig = 0; Date.now = () => realNow() + sdvig;
  const dvaShaga = async (email, razgovor) => {
    await zov(pismo, { email, podtverdil: false, povod: 'prosil', shag: 'razbor', yazyk: 'en', razgovor });
    sdvig += 60000;
    return zov(pismo, { email, podtverdil: true, otvet: 'yes', povod: 'prosil', shag: 'razbor', yazyk: 'en', razgovor });
  };
  mem.clear(); pisma = [];
  const r4 = await zov(zapisat, { start_time: kogda, imya: 'Daniel', yazyk: 'en', razgovor: 'conv_otzyv000000004' });
  await dvaShaga('daniel@gmail.com', 'conv_otzyv000000004');
  const m4 = metka(r4.id);
  p('подтверждение ушло', pisma.length === 1 && /booked/i.test(pisma[0].subject || ''), pisma[0] && pisma[0].subject);
  p('в метке адрес, на который ушло подтверждение', m4 && m4.pochta === 'daniel@gmail.com' && m4.pochta_podtverzhdena === true);
  p('конец визита в метке сохранён', m4 && !!m4.konec);
  p('один адрес — метка однозначна', m4 && m4.pochta_neodnoznachna === false);

  // 4б. В том же разговоре письмо ушло на ДРУГОЙ адрес — метка неоднозначна, первый адрес не затёрт.
  sdvig += 25 * 60000;   // новое чтение по буквам: прошлое подтверждение адреса истекло
  await dvaShaga('colleague@gmail.com', 'conv_otzyv000000004');
  const m4b = metka(r4.id);
  p('второй адрес в разговоре — метка неоднозначна', m4b && m4b.pochta_neodnoznachna === true && m4b.pochta === 'daniel@gmail.com', JSON.stringify(m4b || {}).slice(0, 80));

  // 5. Письмо не ушло — адрес в метку не пишем.
  mem.clear(); pisma = []; resendOk = false;
  const r5 = await zov(zapisat, { start_time: kogda, yazyk: 'en', razgovor: 'conv_otzyv000000005' });
  await dvaShaga('daniel@gmail.com', 'conv_otzyv000000005');
  resendOk = true;
  const m5 = metka(r5.id);
  p('письмо не ушло — адреса в метке нет', m5 && !m5.pochta_podtverzhdena && !m5.pochta);

  // 6. Письмо-материалы без записи — метки визита не появляется.
  mem.clear(); pisma = [];
  await dvaShaga('daniel@gmail.com', 'conv_otzyv000000006');
  p('без записи метка визита не появляется', pisma.length === 1 && ![...mem.keys()].some(k => k.startsWith('otzyvy-vizit:')));

  console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
  process.exit(bed ? 1 : 0);
})();
