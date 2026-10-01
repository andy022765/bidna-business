// Время отправки по поясу бизнеса: окно 9–19, переходы на зимнее и летнее время, разные пояса.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const V = F.lib('vremya');
const K = F.lib('kartochka');

const P = K.polnyy(K.PO_UMOLCHANIYU).pisma;   // окно 9–19, все дни
const iso = (t) => new Date(t).toISOString();

test('окно: 9:00 включительно, 19:00 уже нет', () => {
  const LA = 'America/Los_Angeles';
  assert.equal(V.vOkne(Date.parse('2026-10-05T16:00:00Z'), P, LA), true);    // 09:00 PDT
  assert.equal(V.vOkne(Date.parse('2026-10-05T15:59:00Z'), P, LA), false);   // 08:59
  assert.equal(V.vOkne(Date.parse('2026-10-06T01:59:00Z'), P, LA), true);    // 18:59
  assert.equal(V.vOkne(Date.parse('2026-10-06T02:00:00Z'), P, LA), false);   // 19:00
});

test('следующее окно: вечером — на завтра 9:00, ночью до 9 — сегодня 9:00, днём — сразу', () => {
  const LA = 'America/Los_Angeles';
  assert.equal(iso(V.sleduyushcheeOkno(Date.parse('2026-10-06T03:30:00Z'), P, LA)), '2026-10-06T16:00:00.000Z');   // 20:30 → завтра 9:00
  assert.equal(iso(V.sleduyushcheeOkno(Date.parse('2026-10-06T12:00:00Z'), P, LA)), '2026-10-06T16:00:00.000Z');   // 05:00 → 9:00
  assert.equal(V.sleduyushcheeOkno(Date.parse('2026-10-06T20:00:00Z'), P, LA), Date.parse('2026-10-06T20:00:00Z'));
});

test('переход на зимнее время (Лос-Анджелес, 1 ноября 2026): 9:00 PST = 17:00 UTC, а не 16:00', () => {
  const LA = 'America/Los_Angeles';
  // Субботний визит кончился в 18:00 PDT, +2 ч = 20:00 → утро воскресенья, когда часы уже переведены.
  const t = V.sleduyushcheeOkno(Date.parse('2026-11-01T03:00:00Z'), P, LA);
  assert.equal(iso(t), '2026-11-01T17:00:00.000Z');
  assert.equal(V.vOkne(Date.parse('2026-11-01T16:07:00Z'), P, LA), false, '08:07 PST — ещё рано');
});

test('переход на летнее время (Лос-Анджелес, 14 марта 2027): 9:00 PDT = 16:00 UTC', () => {
  const LA = 'America/Los_Angeles';
  const t = V.sleduyushcheeOkno(Date.parse('2027-03-14T04:00:00Z'), P, LA);   // суббота 20:00 PST
  assert.equal(iso(t), '2027-03-14T16:00:00.000Z');
});

test('Нью-Йорк и Берлин (переход 25.10.2026) считаются по своим правилам', () => {
  assert.equal(iso(V.sleduyushcheeOkno(Date.parse('2026-10-05T23:30:00Z'), P, 'America/New_York')), '2026-10-06T13:00:00.000Z');   // 19:30 EDT → 9:00 EDT
  assert.equal(iso(V.sleduyushcheeOkno(Date.parse('2026-10-24T18:00:00Z'), P, 'Europe/Berlin')), '2026-10-25T08:00:00.000Z');      // 20:00 CEST → 9:00 CET
});

test('дни недели: пропускаем запрещённые подряд, даже через выходные', () => {
  const budni = Object.assign({}, P, { dni: [1, 2, 3, 4, 5] });
  // Пятница 20:00 PDT (09.10.2026) → понедельник 9:00.
  assert.equal(iso(V.sleduyushcheeOkno(Date.parse('2026-10-10T03:00:00Z'), budni, 'America/Los_Angeles')), '2026-10-12T16:00:00.000Z');
});

test('местная дата у полуночи — по поясу бизнеса, не по UTC', () => {
  assert.equal(V.mestnyyDen(Date.parse('2026-10-06T06:30:00Z'), 'America/Los_Angeles'), '2026-10-05');
  assert.equal(V.mestnyyMesyac(Date.parse('2026-11-01T06:30:00Z'), 'America/Los_Angeles'), '2026-10');
  assert.equal(V.proshlyyMesyac('2027-01'), '2026-12');
});

test('планировщик в ночь перевода часов: субботний вечерний визит уходит в 9:07 PST, не в 8:07', async () => {
  F.sbrosVsego(); F.postavitPasport(); F.blobs.vklyuchit();
  const e = F.google.vizit('2026-10-31T17:00:00-07:00', '2026-10-31T18:00:00-07:00');
  F.blobs.metkaVery(e.id, { event_id: e.id, pochta: 'dst@example.com', pochta_podtverzhdena: true, yazyk: 'en' });
  F.chasy.ustanovit('2026-11-01T16:07:00Z'); await F.plan();   // 08:07 PST
  assert.equal(F.resend.pisma.length, 0);
  F.chasy.ustanovit('2026-11-01T17:07:00Z'); await F.plan();   // 09:07 PST
  assert.equal(F.resend.pisma.length, 1);
});

test('формат даты из формы: ISO, американский с am/pm, только дата (полдень); 31 февраля — нет', () => {
  const VZ = F.lib('vizity');
  const LA = 'America/Los_Angeles';
  assert.equal(iso(VZ.razobratVremya('2026-10-05 14:30', LA)), '2026-10-05T21:30:00.000Z');
  assert.equal(iso(VZ.razobratVremya('10/05/2026 2:30 pm', LA)), '2026-10-05T21:30:00.000Z');
  assert.equal(iso(VZ.razobratVremya('2026-10-05', LA)), '2026-10-05T19:00:00.000Z');
  assert.equal(VZ.razobratVremya('2026-02-31 10:00', LA), null);
  assert.equal(VZ.razobratVremya('завтра', LA), null);
});
