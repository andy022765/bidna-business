// ОТЛОЖЕНО 29.09.2026. Календарная часть проверки после выкладки — перенесена из tests/test-zdorovie.js
// (живая zdorovie календарь больше не требует). Проверки те же: видит календарь, ничего не шлёт и не
// записывает, отбивает публичный календарь записей и ссылки на 404 основного сайта.
const F = require('./_zapis');
const test = require('node:test');
const assert = require('node:assert/strict');
const KZ = require('../lib/kartochka-zapis');
const ZZ = require('../lib/zdorovie-zapis');

test.beforeEach(() => F.sbros());
const proverka = () => ZZ.proverkaZapisi(KZ.vzyat('bid'));

test('всё подключено — календарная часть паспорта цела, три окна, ссылки открывают нашу страницу; писем и событий ноль', async () => {
  const d = await proverka();
  assert.equal(d.ok, true);
  assert.deepEqual(d.problemy, []);
  assert.equal(d.kalendar.okna.length, 3);
  assert.equal(d.ssylki.ok, true);
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(F.google.vstavki().length, 0);
});

test('календарь недоступен — ok:false и причина', async () => {
  F.google.nedostupny.add(F.ZANYATOST);
  const d = await proverka();
  assert.equal(d.ok, false);
  assert.match(d.kalendar.oshibka, /notFound/);
});

test('календарь записей открыт всем (как «Вера-демо») — ok:false: в событиях имена и почты людей', async () => {
  F.google.publichnye.add(F.KALENDAR);
  const d = await proverka();
  assert.equal(d.ok, false);
  assert.match(d.kalendar.oshibka, /ПУБЛИЧНЫЙ/);
  assert.equal(F.google.vstavki().length, 0);
});

test('ссылки из писем ведут на 404 основного сайта (нет прокси /zapis) — ok:false с понятной причиной', async () => {
  F.glavnyy.proksi = false;
  const d = await proverka();
  assert.equal(d.ok, false);
  assert.match(d.ssylki.oshibka, /нет прокси \/zapis/);
});
