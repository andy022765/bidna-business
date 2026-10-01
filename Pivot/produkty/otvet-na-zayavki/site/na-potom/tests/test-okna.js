// ОТЛОЖЕНО 29.09.2026 вместе со своей записью (живой путь — Calendly). Тесты без изменений по сути.
//
// Три окна в разные дни: сетка часов, выходные, занятость владельца, перевод часов, отказ календаря.
const F = require('./_zapis');
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../lib/kartochka-zapis');
const O = require('../lib/tekst-okna');

const blobsModul = require(require.resolve('@netlify/blobs', { paths: [F.SITE] }));

const dop = () => K.dopKalendarya(K.vzyat('bid'));
test.beforeEach(() => F.sbros());

// Время по Лос-Анджелесу (решение Андрея 29.09). До 1 ноября там PDT = UTC−7, после — PST = UTC−8.
test('понедельник 08:00 → пн 11:00 (не раньше трёх часов), вт ближе к 15:00, ср 10:00 — три разных дня', async () => {
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.ok, true);
  assert.equal(r.poyas, 'America/Los_Angeles');
  assert.deepEqual(r.okna, ['2026-10-05T18:00:00.000Z', '2026-10-06T22:00:00.000Z', '2026-10-07T17:00:00.000Z']);
});

test('ключ календаря читается из хранилища по токену, хотя голый getStore бросает', async () => {
  // В подделке голый getStore бросает, как на живом стенде. Окна пришли — значит, gkal ушёл в запасной путь.
  assert.throws(() => blobsModul.getStore({ name: 'kalendar-klyuch' }), /not been configured/);
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.okna.length, 3);
});

test('пятница вечером: выходные пропускаются, окна пн/вт/ср', async () => {
  F.chasy.ustanovit('2026-10-09T23:00:00Z');   // пт 16:00 по Лос-Анджелесу, +3 ч = после 18:00
  const r = await O.triOkna(dop(), 3);
  assert.deepEqual(r.okna, ['2026-10-12T17:00:00.000Z', '2026-10-13T22:00:00.000Z', '2026-10-14T17:00:00.000Z']);
});

test('переход на зимнее время 1 ноября: 10:00 по Лос-Анджелесу это уже 18:00 UTC, а не 17:00', async () => {
  F.chasy.ustanovit('2026-10-30T23:00:00Z');   // пт 16:00 PDT (UTC−7); окна — уже после перевода, PST (UTC−8)
  const r = await O.triOkna(dop(), 3);
  assert.deepEqual(r.okna, ['2026-11-02T18:00:00.000Z', '2026-11-03T23:00:00.000Z', '2026-11-04T18:00:00.000Z']);
});

test('встреча в ОСНОВНОМ календаре владельца (только занятость) сдвигает окно с запасом 15 минут', async () => {
  F.google.zanyato.push({ kal: F.ZANYATOST, start: '2026-10-05T18:00:00Z', end: '2026-10-05T21:00:00Z' }); // пн 11:00–14:00 PDT
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.okna[0], '2026-10-05T21:30:00.000Z', 'пн 14:30: 14:00 занято запасом');
});

test('вторник занят целиком — второе окно уезжает на среду, третье на четверг', async () => {
  // Сутки вторника по Лос-Анджелесу: 00:00 PDT = 07:00 UTC.
  F.google.zanyato.push({ kal: F.KALENDAR, start: '2026-10-06T07:00:00Z', end: '2026-10-07T07:00:00Z' });
  const r = await O.triOkna(dop(), 3);
  assert.deepEqual(r.okna.map(x => x.slice(0, 10)), ['2026-10-05', '2026-10-07', '2026-10-08']);
});

test('календарь владельца без доступа → отказ целиком, ни одного окна (не «свободен весь день»)', async () => {
  F.google.nedostupny.add(F.ZANYATOST);
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.ok, false);
  assert.deepEqual(r.okna, []);
  assert.match(r.oshibka, /notFound/);
});

test('календарь, которого нет в ответе Google вовсе → тоже отказ', async () => {
  F.google.propadaet.add(F.ZANYATOST);
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.ok, false);
  assert.match(r.oshibka, /нет в ответе/);
});

test('на десять дней вперёд занято всё, кроме одного дня → одно окно, без выдумок', async () => {
  // Свободен только четверг 8 октября по Лос-Анджелесу (границы суток — 07:00 UTC).
  F.google.zanyato.push({ kal: F.KALENDAR, start: '2026-10-05T07:00:00Z', end: '2026-10-08T07:00:00Z' });
  F.google.zanyato.push({ kal: F.KALENDAR, start: '2026-10-09T07:00:00Z', end: '2026-10-20T07:00:00Z' });
  const r = await O.triOkna(dop(), 3);
  assert.equal(r.ok, true);
  assert.deepEqual(r.okna, ['2026-10-08T17:00:00.000Z']);   // чт 10:00 PDT
});

test('svobodnoLi: свободное окно — да; окно поверх встречи — нет; окно вне часов — нет', async () => {
  const d = dop();
  assert.deepEqual(await O.svobodnoLi(d, '2026-10-07T17:00:00.000Z'), { ok: true, svobodno: true });   // ср 10:00 PDT
  F.google.zanyato.push({ kal: F.ZANYATOST, start: '2026-10-07T17:00:00Z', end: '2026-10-07T17:30:00Z' });
  assert.deepEqual(await O.svobodnoLi(d, '2026-10-07T17:00:00.000Z'), { ok: true, svobodno: false });
  assert.deepEqual(await O.svobodnoLi(d, '2026-10-08T06:00:00.000Z'), { ok: true, svobodno: false }, 'ср 23:00 PDT — вне часов');
});

test('окна через неделю проверяются так же точно (svobodnye отдаёт только 12 первых — обходим)', async () => {
  const d = dop();
  assert.deepEqual(await O.svobodnoLi(d, '2026-10-13T22:30:00.000Z'), { ok: true, svobodno: true });   // вт 15:30 PDT
});
