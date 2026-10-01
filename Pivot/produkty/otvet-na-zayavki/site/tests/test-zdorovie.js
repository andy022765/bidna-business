// Проверка после выкладки: закрыта секретом, ничего не шлёт, календарь НЕ требует (запись — в Calendly),
// видит битую ссылку на запись. Календарная часть прежней проверки — na-potom/tests/test-zdorovie-zapis.js.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fn = () => require(path.join(F.SITE, 'netlify-functions/zdorovie.js'));
const zdorovie = async () => JSON.parse((await fn().handler({ headers: { 'x-otvet-secret': F.SEKRET } })).body);

test.beforeEach(() => F.sbrosVsego());

test('без секрета — 401', async () => {
  assert.equal((await fn().handler({ headers: {} })).statusCode, 401);
  assert.equal((await fn().handler({ headers: { 'x-otvet-secret': 'не тот' } })).statusCode, 401);
  assert.equal(F.calendly.vyzovy.length, 0, 'без секрета наружу не ходим');
});

test('с секретом — паспорт цел, хранилище по токену, страница записи открывается; писем ноль, в Google ни одного запроса', async () => {
  const d = await zdorovie();
  assert.equal(d.ok, true);
  assert.deepEqual(d.kartochka.problemy, []);
  assert.equal(d.hranilishche, 'api');
  assert.equal(d.hranilishche_zapis, true);
  assert.deepEqual(d.zapis, { ok: true, ssylka: 'https://calendly.com/bizzinteldna/1hr', kod: 200 });
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(F.google.vyzovy.length, 0);
});

test('календарь не требуется: без календарных переменных и без ключа календаря — ok:true, в ответе про календарь ни слова', async () => {
  F.blobs.dannye.delete('kalendar-klyuch/sa');
  for (const v of ['OTVET_KALENDAR_ID', 'OTVET_KALENDAR_ZANYATOST', 'OTVET_BAZA_URL']) assert.equal(process.env[v], undefined);
  const d = await zdorovie();
  assert.equal(d.ok, true);
  assert.equal(d.kalendar, undefined);
  assert.equal(d.ssylki, undefined);
  assert.ok(!/KALENDAR|BAZA_URL/.test(JSON.stringify(d.peremennye)));
  assert.equal(F.google.vyzovy.length, 0);
});

test('страницы записи нет (404: опечатка, тип встречи удалён) — ok:false с понятной причиной', async () => {
  F.calendly.kod = 404;
  const d = await zdorovie();
  assert.equal(d.ok, false);
  assert.equal(d.zapis.ok, false);
  assert.match(d.zapis.oshibka, /ссылка ssylka_zapisi в паспорте битая/);
});

test('проверить страницу записи не удалось (403 защиты от ботов, сеть) — ok не роняем, просим открыть глазами', async () => {
  F.calendly.kod = 403;
  let d = await zdorovie();
  assert.equal(d.ok, true);
  assert.equal(d.zapis.ok, null);
  assert.match(d.zapis.oshibka, /откройте ссылку глазами/);
  F.calendly.kod = 200; F.calendly.padaet = true;
  d = await zdorovie();
  assert.equal(d.ok, true);
  assert.equal(d.zapis.ok, null);
  assert.match(d.zapis.oshibka, /ENOTFOUND/);
});

test('без ключа Resend или без хранилища — ok:false', async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await zdorovie()).ok, false);
  F.sbrosVsego();
  delete process.env.EV_BLOBS_TOKEN;
  const d = await zdorovie();
  assert.equal(d.hranilishche, 'НЕТ');
  assert.equal(d.ok, false);
});
