// ОТЛОЖЕНО 29.09.2026. Календарная часть паспорта (na-potom/kartochka/bid-zapis.json) и копия gkal.js.
// Перенесено из tests/test-kartochka.js: там теперь живой паспорт без календаря.
const F = require('./_zapis');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const K = require('../../lib/kartochka');
const KZ = require('../lib/kartochka-zapis');

const B = path.resolve(__dirname, '../../../../../..');   // Our Business (Andrii & Masha)
const GKAL_VERY = path.join(B, 'Pivot/golos/site/kalendar-lib/gkal.js');

test.beforeEach(() => F.sbros());

test('склеенный паспорт bid цел: календарь, встреча, тексты окон; живой паспорт при этом не тронут', () => {
  const k = KZ.vzyat('bid');
  assert.deepEqual(KZ.proveritZapis(k), []);
  assert.match(k.__hesh, /^[0-9a-f]{12}$/);
  assert.notEqual(k.__hesh, K.vzyat('bid').__hesh);
  assert.equal(k.kalendar.poyas, 'America/Los_Angeles');
  assert.match(k.teksty.vstuplenie_ru, /запись на звонок/, 'вступление своей записи поверх живого');
  assert.equal(k.teksty.raskrytie_ru, K.vzyat('bid').teksty.raskrytie_ru, 'общие тексты — из живого паспорта');
  assert.deepEqual(k.produkty, K.vzyat('bid').produkty, 'цены — из живого паспорта, одна правда');
  assert.equal(K.vzyat('bid').kalendar, undefined);
  assert.doesNotMatch(K.vzyat('bid').teksty.vstuplenie_ru, /запись на звонок\.$/);
});

test('кривая календарная часть ловится: пояс, число окон, нет текста подтверждения', () => {
  const k = JSON.parse(JSON.stringify(KZ.vzyat('bid')));
  k.kalendar.poyas = 'Mars/Olympus';
  k.kalendar.skolko_okon = 9;
  delete k.teksty.zapisano_en;
  const beda = KZ.proveritZapis(k);
  assert.ok(beda.includes('kalendar.poyas не пояс'));
  assert.ok(beda.includes('skolko_okon 1..5'));
  assert.ok(beda.includes('нет teksty.zapisano_en'));
});

test('настройки календаря идут из паспорта, ID — из переменной', () => {
  const d = KZ.dopKalendarya(KZ.vzyat('bid'));
  assert.equal(d.kalendar, F.KALENDAR);
  assert.deepEqual(d.zanyatost, [F.ZANYATOST]);
  assert.equal(d.poyas, 'America/Los_Angeles');   // решение Андрея 29.09: время Лос-Анджелеса, не Нью-Йорка
  assert.deepEqual([d.ot, d.do, d.dlina, d.zapas], [10, 18, 30, 15]);
});

test('gkal.js — побайтная копия календаря Веры (PLAN-V1: «gkal.js не трогаем»)', { skip: !fs.existsSync(GKAL_VERY) && 'нет исходника Веры' }, () => {
  const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  assert.equal(h(path.join(__dirname, '../lib/gkal.js')), h(GKAL_VERY),
    'na-potom/lib/gkal.js разошёлся с Pivot/golos/site/kalendar-lib/gkal.js — запусти na-potom/skripty/skopirovat-gkal.sh');
});
