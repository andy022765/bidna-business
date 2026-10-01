// Календарь Веры на Google: арифметика часов и два инструмента, на заглушках, без сети.
//
//   node Pivot/golos/proverka/test_kalendar_google.js
//
// Главное, что здесь проверяется, — НЕ вызовы Google, а наша сетка часов. Готовый календарь
// объявляет свободными три часа ночи и воскресенье: там просто нет события. Значит ошибка
// в сетке = Вера зовёт человека на четыре утра, и никакой вендор этого не поймает.
const path = require('path');
const KORENJ = path.join(__dirname, '..', 'site');
const gkal = require(path.join(KORENJ, 'kalendar-lib', 'gkal.js'));

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(56), ok ? 'ДА' : 'ПРОВАЛ', d); };

// ---------- 1. арифметика поясов ----------
const LA = 'America/Los_Angeles';
console.log('--- пояса и переход на летнее время ---');
// 15 января 2026, Лос-Анджелес: зима, UTC−8
p('зимой Лос-Анджелес это минус восемь',
  gkal.smeshchenie(new Date('2026-01-15T20:00:00Z'), LA) === -480,
  String(gkal.smeshchenie(new Date('2026-01-15T20:00:00Z'), LA)));
// 15 июля 2026: лето, UTC−7
p('летом Лос-Анджелес это минус семь',
  gkal.smeshchenie(new Date('2026-07-15T20:00:00Z'), LA) === -420,
  String(gkal.smeshchenie(new Date('2026-07-15T20:00:00Z'), LA)));

// 10:00 по местному зимой = 18:00 UTC; летом = 17:00 UTC. Если второго прохода нет — уедет на час.
p('10:00 местного зимой = 18:00 UTC',
  gkal.mestnoeVUTC(2026, 1, 15, 10, 0, LA).toISOString() === '2026-01-15T18:00:00.000Z',
  gkal.mestnoeVUTC(2026, 1, 15, 10, 0, LA).toISOString());
p('10:00 местного летом = 17:00 UTC',
  gkal.mestnoeVUTC(2026, 7, 15, 10, 0, LA).toISOString() === '2026-07-15T17:00:00.000Z',
  gkal.mestnoeVUTC(2026, 7, 15, 10, 0, LA).toISOString());

const m = gkal.mestnoe(new Date('2026-01-15T18:30:00Z'), LA);
p('обратный разбор: 10:30, четверг', m.chas === 10 && m.minuta === 30 && m.dn === 4,
  JSON.stringify(m));

// ---------- 2. сетка свободных окон ----------
console.log('\n--- сетка часов: ночь и выходные не предлагаем ---');
process.env.KALENDAR_ID = 'test@group.calendar.google.com';
process.env.KALENDAR_POYAS = LA;
process.env.KALENDAR_CHAS_OT = '10';
process.env.KALENDAR_CHAS_DO = '18';
process.env.KALENDAR_DNI = '1,2,3,4,5';
process.env.KALENDAR_DLINA_MIN = '30';
process.env.KALENDAR_ZAPAS_MIN = '15';
process.env.KALENDAR_NE_RANSHE_CHASOV = '3';
process.env.KALENDAR_VPERED_DNEY = '10';
// Ключ настоящий, но одноразовый: генерируем пару прямо здесь. Подпись JWT должна
// выполняться по-настоящему — с выдуманной строкой вместо ключа crypto падает
// «DECODER routines::unsupported», и путь подписи остался бы непроверенным.
const { generateKeyPairSync } = require('crypto');
const para = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.GOOGLE_SA_JSON = JSON.stringify({
  client_email: 'proba@test.iam.gserviceaccount.com',
  private_key: para.privateKey, private_key_id: 'proba' });

// Подменяем сеть: токен и freebusy отдаём сами.
let zanyato = [];
global.fetch = async (url, opt) => {
  if (String(url).includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
  if (String(url).includes('/freeBusy'))
    return { ok: true, status: 200, text: async () => JSON.stringify({
      calendars: { 'test@group.calendar.google.com': { busy: zanyato } } }) };
  return { ok: true, status: 200, text: async () => '{}' };
};

(async () => {
  const r = await gkal.svobodnye();
  p('окна нашлись', r.kod === 200 && r.okna.length > 0, 'окон ' + (r.okna || []).length);

  const chasy = r.okna.map(x => gkal.mestnoe(new Date(x), LA));
  p('ни одного окна раньше 10:00', chasy.every(c => c.chas >= 10), JSON.stringify(chasy.slice(0, 3)));
  p('ни одного окна с 18:00 и позже', chasy.every(c => c.chas < 18));
  p('ни одной субботы и воскресенья', chasy.every(c => c.dn <= 5));
  p('ближайшее окно не раньше чем через 3 часа',
    new Date(r.okna[0]).getTime() >= Date.now() + 3 * 3600e3 - 60000);

  // Занятость с запасом: событие 12:00–12:30 должно снять и 11:45-е, и 12:30-е окно.
  const den = r.okna[0].slice(0, 10);
  zanyato = [{ start: gkal.mestnoeVUTC(+den.slice(0, 4), +den.slice(5, 7), +den.slice(8, 10), 12, 0, LA).toISOString(),
               end: gkal.mestnoeVUTC(+den.slice(0, 4), +den.slice(5, 7), +den.slice(8, 10), 12, 30, LA).toISOString() }];
  const r2 = await gkal.svobodnye();
  const est12 = r2.okna.some(x => {
    const c = gkal.mestnoe(new Date(x), LA);
    return x.slice(0, 10) === den && c.chas === 12 && c.minuta === 0;
  });
  p('занятое время из окон убрано', !est12);
  const est1130 = r2.okna.some(x => {
    const c = gkal.mestnoe(new Date(x), LA);
    return x.slice(0, 10) === den && c.chas === 11 && c.minuta === 30;
  });
  p('запас 15 минут снял и окно вплотную перед занятым', !est1130);

  // Ошибка по календарю не должна читаться как «свободен целиком».
  global.fetch = async (url) => {
    if (String(url).includes('oauth2')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({
      calendars: { 'test@group.calendar.google.com': { errors: [{ reason: 'notFound' }] } } }) };
  };
  const r3 = await gkal.svobodnye();
  p('ошибка календаря — это отказ, а не «свободно»', r3.kod === 403, JSON.stringify(r3).slice(0, 80));


  // ---------- 3. занятость клиента: два календаря ----------
  // Вера пишет в НАШ календарь, а занятость обязана смотреть и в основной календарь
  // клиента. Иначе она запишет человека поверх его собственной встречи — и это
  // не мелкая ошибка, а сорванный день владельца.
  console.log('\n--- занятость клиента: смотрим оба календаря ---');
  process.env.KALENDAR_ZANYATOST = 'klient@example.com';
  let zanyatoKlienta = [], oshibkaKlienta = null, otvetPoKlientu = true;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2'))
      return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    const kal = { 'test@group.calendar.google.com': { busy: [] } };
    if (otvetPoKlientu) {
      kal['klient@example.com'] = oshibkaKlienta
        ? { errors: [{ reason: oshibkaKlienta }] }
        : { busy: zanyatoKlienta };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ calendars: kal }) };
  };

  const oba = await gkal.svobodnye();
  p('оба свободны — окна предлагаются', oba.kod === 200 && oba.okna.length > 0,
    'окон ' + (oba.okna || []).length);
  p('в запрос ушли ДВА календаря', oba.kalendarey === 2, String(oba.kalendarey));

  // Занимаем у клиента ровно первое предложенное окно.
  const pervoe = oba.okna[0];
  zanyatoKlienta = [{ start: pervoe,
                      end: new Date(new Date(pervoe).getTime() + 30 * 60000).toISOString() }];
  const sZanyatym = await gkal.svobodnye();
  p('занято у КЛИЕНТА — это окно не предлагаем',
    sZanyatym.kod === 200 && !sZanyatym.okna.includes(pervoe));
  p('остальные окна остались', sZanyatym.okna.length > 0, 'окон ' + sZanyatym.okna.length);

  zanyatoKlienta = [];
  oshibkaKlienta = 'notFound';
  const bezDostupa = await gkal.svobodnye();
  p('нет доступа к календарю клиента — отказ, а не «свободно»',
    bezDostupa.kod === 403 && /klient@example\.com/.test(bezDostupa.oshibka || ''),
    (bezDostupa.oshibka || '').slice(0, 70));

  oshibkaKlienta = null; otvetPoKlientu = false;
  const netVOtvete = await gkal.svobodnye();
  p('календаря нет в ответе Google — тоже отказ', netVOtvete.kod === 403,
    (netVOtvete.oshibka || '').slice(0, 70));

  otvetPoKlientu = true;
  delete process.env.KALENDAR_ZANYATOST;
  const bezKlienta = await gkal.svobodnye();
  p('без KALENDAR_ZANYATOST работает как раньше',
    bezKlienta.kod === 200 && bezKlienta.kalendarey === 1);

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ КАЛЕНДАРЯ ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
