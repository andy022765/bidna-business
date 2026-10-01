'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
const v = require('../lib/vremya');
const { F, fraza } = require('../lib/frazy');

test('время словами на EN / ES / RU в поясе клиента', () => {
  const d = new Date('2026-10-02T14:00:00Z');   // 10:00 в Нью-Йорке
  assert.equal(v.tekst(d, 'en'), 'Friday, October 2 at 10:00 AM');
  assert.equal(v.tekst(d, 'es'), 'viernes 2 de octubre a las 10:00 de la mañana');
  assert.equal(v.tekst(d, 'ru'), 'пятница, 2 октября, в 10:00');
  assert.equal(v.tekst(new Date('2026-10-02T17:00:00Z'), 'es'), 'viernes 2 de octubre a la 1:00 de la tarde');
  assert.equal(v.tekst(new Date('2026-10-02T23:30:00Z'), 'en'), 'Friday, October 2 at 7:30 PM');
  assert.equal(v.tekst(d, 'zz'), 'Friday, October 2 at 10:00 AM', 'чужой язык — английский');
});

test('ISO со смещением пояса: летом −04:00, зимой −05:00', () => {
  assert.equal(v.iso(new Date('2026-10-02T14:00:00Z')), '2026-10-02T10:00:00-04:00');
  assert.equal(v.iso(new Date('2026-12-02T14:00:00Z')), '2026-12-02T09:00:00-05:00');
  assert.equal(v.denKlyuch(new Date('2026-10-02T03:30:00Z')), '2026-10-01', 'ночь по UTC — ещё вчера в Нью-Йорке');
});

test('местный час → UTC в дни перевода часов (8 марта и 1 ноября 2026)', () => {
  assert.equal(v.mestnoeVUTC(2026, 3, 8, 9, 0).toISOString(), '2026-03-08T13:00:00.000Z');
  assert.equal(v.mestnoeVUTC(2026, 3, 7, 9, 0).toISOString(), '2026-03-07T14:00:00.000Z');
  assert.equal(v.mestnoeVUTC(2026, 11, 1, 9, 0).toISOString(), '2026-11-01T14:00:00.000Z');
  assert.equal(v.mestnoeVUTC(2026, 10, 31, 9, 0).toISOString(), '2026-10-31T13:00:00.000Z');
});

test('разбор времени от модели: с поясом — как есть, без пояса — местное время клиента', () => {
  assert.equal(v.razobratVremya('2026-10-02T10:00:00-04:00').toISOString(), '2026-10-02T14:00:00.000Z');
  assert.equal(v.razobratVremya('2026-10-02T14:00:00Z').toISOString(), '2026-10-02T14:00:00.000Z');
  assert.equal(v.razobratVremya('2026-10-02 10:00').toISOString(), '2026-10-02T14:00:00.000Z');
  assert.equal(v.razobratVremya('завтра в десять'), null);
  assert.equal(v.razobratDatu('2026-02-30'), null);
});

test('рабочие часы', () => {
  const okno = { chas_ot: 8, chas_do: 18, dni: [1, 2, 3, 4, 5] };
  assert.equal(v.vRabocheeVremya(new Date('2026-09-30T13:00:00Z'), okno), true);    // ср 9:00
  assert.equal(v.vRabocheeVremya(new Date('2026-09-30T23:00:00Z'), okno), false);   // ср 19:00
  assert.equal(v.vRabocheeVremya(new Date('2026-10-03T14:00:00Z'), okno), false);   // сб
});

test('у каждой фразы есть EN, ES и RU', () => {
  for (const [k, z] of Object.entries(F)) {
    for (const y of ['en', 'es', 'ru']) assert.ok(z[y] !== undefined, `нет ${y} у фразы ${k}`);
  }
  assert.match(fraza('okna', 'ru', ['a', 'b']), /Ближайшие варианты: a или b/);
  assert.match(fraza('otkaz_ok', 'es', 'lunes'), /Gracias por avisarnos/);
});

test('календарь для агента — ровно формат прогонов (chasy() в care/progony/progon.py): 14 дней, today/tomorrow, местная дата', () => {
  const K = (s) => v.kalendarDney(Date.parse(s));
  // Эталоны — вывод chasy() из progon.py для тех же моментов.
  assert.equal(K('2026-09-30T15:40:00-04:00'), 'Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; '
    + 'Saturday October 3; Sunday October 4; Monday October 5; Tuesday October 6; Wednesday October 7; Thursday October 8; '
    + 'Friday October 9; Saturday October 10; Sunday October 11; Monday October 12; Tuesday October 13');
  assert.ok(K('2026-09-30T23:30:00-04:00').startsWith('Wednesday September 30 (today); Thursday October 1 (tomorrow); '),
    '23:30 в Нью-Йорке — по UTC уже 1 октября, а сегодня всё ещё среда');
  assert.equal(K('2026-10-25T23:30:00-04:00'), 'Sunday October 25 (today); Monday October 26 (tomorrow); Tuesday October 27; '
    + 'Wednesday October 28; Thursday October 29; Friday October 30; Saturday October 31; Sunday November 1; Monday November 2; '
    + 'Tuesday November 3; Wednesday November 4; Thursday November 5; Friday November 6; Saturday November 7', 'перевод часов 1 ноября');
  assert.equal(K('2026-12-31T12:00:00-05:00'), 'Thursday December 31 (today); Friday January 1 (tomorrow); Saturday January 2; '
    + 'Sunday January 3; Monday January 4; Tuesday January 5; Wednesday January 6; Thursday January 7; Friday January 8; '
    + 'Saturday January 9; Sunday January 10; Monday January 11; Tuesday January 12; Wednesday January 13');
  assert.equal(v.denSdvig(Date.parse('2026-10-31T23:00:00-04:00'), 1), '2026-11-01');
  assert.equal(v.denSdvig(Date.parse('2026-11-01T23:30:00-05:00'), 0), '2026-11-01');
});

test('статус офиса: 09:00 ≤ t < 17:00, пн–пт, пояс клиента; часов в настройках нет — ofis_seychas не передаём', () => {
  const kl = { poyas: 'America/New_York', perevod: { chasy: { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] } } };
  const o = (s) => v.peremennyeZvonka(kl, Date.parse(s)).ofis_seychas;
  assert.equal(o('2026-09-30T15:40:00-04:00'), 'OPEN');
  assert.equal(o('2026-09-30T08:59:59-04:00'), 'CLOSED');
  assert.equal(o('2026-09-30T09:00:00-04:00'), 'OPEN');
  assert.equal(o('2026-09-30T16:59:00-04:00'), 'OPEN');
  assert.equal(o('2026-09-30T17:00:00-04:00'), 'CLOSED');
  assert.equal(o('2026-10-04T12:00:00-04:00'), 'CLOSED', 'воскресенье');
  assert.equal(o('2026-12-02T13:59:00Z'), 'CLOSED', 'зимой 8:59 EST');
  assert.equal(o('2026-12-02T14:00:00Z'), 'OPEN', 'зимой 9:00 EST');
  const bez = v.peremennyeZvonka({ poyas: 'America/New_York', perevod: { chasy: null } }, Date.parse('2026-09-30T15:40:00-04:00'));
  assert.deepEqual(Object.keys(bez), ['kalendar']);
  assert.equal(typeof bez.kalendar, 'string');
});

test('испанское время в конце предложения SMS — без двойной точки («a. m..»)', () => {
  const t = v.korotko(new Date('2026-10-01T14:00:00Z'), 'es');
  assert.equal(t, 'jue 1 oct, 10:00 a. m.');
  for (const s of [fraza('sms_zapis', 'es', 'A', t), fraza('sms_otkaz_prinyat', 'es', 'A', t), fraza('sms_kakaya_smena', 'es', 'A', '12: ' + t),
    fraza('sms_predlozhenie', 'es', 'A', t, '12'), fraza('napominanie_sms', 'es', 'A', 'entrevista', 'mañana, ' + t)]) {
    assert.doesNotMatch(s, /m\.\./, s);
  }
});
