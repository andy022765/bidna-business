// ОТЛОЖЕНО 29.09.2026. Письмо с тремя окнами — то, что до решения «сразу Calendly» уходило
// человеку. Проверки перенесены из tests/test-zayavka.js как были (там теперь письмо с Calendly):
// три ссылки со своими окнами, пояс и время, английский вариант, письмо владельцу с окнами,
// честный ответ без времени, когда календарь не отвечает или не подключён, режим connectLambda.
const F = require('./_zapis');
const test = require('node:test');
const assert = require('node:assert/strict');
const KZ = require('../lib/kartochka-zapis');
const PZ = require('../lib/pisma-zapis');

test.beforeEach(() => F.sbros());

const vladelcu = (r) => PZ.pismoVladelcuOtvetSOknami(KZ.vzyat('bid'), r.lid,
  { otvet: { ok: true, kod: 200 }, ssylki: r.ssylki, kalendar_oshibka: r.kalendarOshibka, sekund: 2, pismo: r.pismo });

test('русская страница Веры: цены из паспорта, три ссылки со своими окнами, пояс Лос-Анджелеса, раскрытие автоматики', async () => {
  const r = await F.pismoSOknami();
  const p = r.pismo;
  const k = KZ.vzyat('bid');
  assert.equal(p.subject, k.teksty.tema_otveta_ru);
  assert.match(p.text, /^Здравствуйте, Анна!/);
  assert.ok(p.text.includes(k.teksty.vstuplenie_ru) && /запись на звонок/.test(k.teksty.vstuplenie_ru), 'вступление своей записи');
  for (const c of k.produkty.vera.ceny_ru) assert.ok(p.text.includes(c), 'нет строки цены: ' + c);
  const t = F.tokenyIzPisma(p);
  assert.equal(t.length, 3);
  assert.equal(new Set(t).size, 3);
  assert.ok(p.text.includes('https://businessinteldna.com/zapis?t=' + t[0]));
  assert.match(p.text, /по времени Лос-Анджелеса, 30 минут/);
  assert.match(p.text, /понедельник, 5 октября\D+11:00/);   // пн 11:00 по Лос-Анджелесу (в Нью-Йорке это было бы 14:00)
  assert.ok(p.text.includes(k.teksty.raskrytie_ru));
  assert.ok(p.html.includes('https://businessinteldna.com/zapis?t=' + t[2]));
  assert.ok(!p.text.includes('calendly'), 'в письме своей записи ссылки на Calendly нет');
  // Каждая ссылка — отдельный токен в хранилище со своим окном.
  const slots = t.map(x => F.blobs.vzyat('otvet', 't:bid:' + x).slot);
  assert.deepEqual(slots, ['2026-10-05T18:00:00.000Z', '2026-10-06T22:00:00.000Z', '2026-10-07T17:00:00.000Z']);
});

test('английская страница Веры → английское письмо, Pacific time', async () => {
  const { pismo: p } = await F.pismoSOknami({ stranica: '/vera/', imya: 'John' });
  const k = KZ.vzyat('bid');
  assert.equal(p.subject, k.teksty.tema_otveta_en);
  assert.match(p.text, /^Hi John,/);
  for (const c of k.produkty.vera.ceny_en) assert.ok(p.text.includes(c), c);
  assert.match(p.text, /Pacific time, 30 minutes/);
  assert.match(p.text, /Monday, October 5\D+11:00/);
});

test('письмо владельцу с окнами: какие окна предложены, текст ответа целиком, хэш склеенного паспорта', async () => {
  const r = await F.pismoSOknami({ telefon: '+1 (305) 555-0100' });
  const v = vladelcu(r);
  assert.match(v.subject, /^Заявка → ответ ушёл за 2 с: anna@example\.com$/);
  assert.match(v.text, /Интерес: Вера · язык ответа: ru/);
  assert.match(v.text, /Телефон: \+1 \(305\) 555-0100/);
  assert.match(v.text, /Предложили время \(по времени Лос-Анджелеса\):\n— понедельник, 5 октября\D+11:00/);
  assert.ok(v.text.includes(r.pismo.text));
  assert.ok(v.text.includes(KZ.vzyat('bid').__hesh));
});

test('календарь владельца не отвечает → письмо с ценами, но без времени; владельцу — «БЕЗ ВРЕМЕНИ» и причина', async () => {
  F.google.nedostupny.add(F.ZANYATOST);
  const r = await F.pismoSOknami();
  assert.equal(r.ssylki.length, 0);
  assert.equal(F.tokenyIzPisma(r.pismo).length, 0);
  assert.ok(r.pismo.text.includes(KZ.vzyat('bid').teksty.bez_okon_ru));
  assert.ok(r.pismo.text.includes(KZ.vzyat('bid').produkty.vera.ceny_ru[0]), 'цены на месте');
  const v = vladelcu(r);
  assert.match(v.subject, /БЕЗ ВРЕМЕНИ/);
  assert.match(v.text, /notFound/);
});

test('календарь не подключён (нет OTVET_KALENDAR_ID) → тот же честный ответ без времени, без запросов в Google', async () => {
  delete process.env.OTVET_KALENDAR_ID;
  const r = await F.pismoSOknami();
  assert.equal(F.google.vyzovy.length, 0);
  assert.equal(F.tokenyIzPisma(r.pismo).length, 0);
  assert.match(vladelcu(r).text, /нет OTVET_KALENDAR_ID/);
});

test('без токена хранилища, но с event.blobs: окна и ссылки через connectLambda без строгой согласованности', async () => {
  delete process.env.EV_BLOBS_TOKEN;
  const r = await F.pismoSOknami({}, { headers: {}, blobs: F.blobs.eventBlobs() });
  assert.equal(r.ssylki.length, 3, 'ссылки выданы и записаны');
  assert.equal(F.blobs.schet.strogoVLambda, 0, 'ни одного запроса со строгой согласованностью в режиме lambda');
});

test('хранилища нет совсем → ссылок нет (они бы не открылись), цены на месте', async () => {
  delete process.env.EV_BLOBS_TOKEN;
  const r = await F.pismoSOknami();
  assert.equal(F.tokenyIzPisma(r.pismo).length, 0);
  assert.ok(r.pismo.text.includes(KZ.vzyat('bid').produkty.vera.ceny_ru[0]));
});
