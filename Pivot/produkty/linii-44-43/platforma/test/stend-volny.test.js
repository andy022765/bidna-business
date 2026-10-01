'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');
const Z = require('../lib/care/zamena');
const otkaz = require('../netlify-functions/otkaz');
const volny = require('../netlify-functions/volny');
const nastoyashchiyDvizhok = typeof Z.sleduyushcheeDeystvie === 'function';
const opts = { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' };

test.before(async () => { await P.zasejat(P.st()); });

test('тишина 15 минут, до смены больше 2 ч — следующая волна другим сиделкам', opts, async () => {
  const st = P.st();
  const r = P.otvet(await otkaz.handler(P.instrument({ caller_id: '+17185550111', data_smeny: '2026-10-01', prichina: 'bolezn' }, P.KLYUCHI.DEMO_2)));
  assert.equal(r.ok, true);
  const o1 = await st.getJSON('otkazy/otk-sm-1-s-01');
  assert.equal(o1.volny.length, 1);
  P.vremya('2026-09-30T09:10:00-04:00');
  await volny.handler({});
  assert.equal((await st.getJSON('otkazy/otk-sm-1-s-01')).volny.length, 1, 'через 10 минут ждём');
  P.vremya('2026-09-30T09:16:00-04:00');
  await volny.handler({});
  const o2 = await st.getJSON('otkazy/otk-sm-1-s-01');
  assert.equal(o2.volny.length, 2, 'через 16 минут — вторая волна');
  const pervaya = new Set(o2.volny[0].sidelki);
  assert.ok(o2.volny[1].sidelki.every((s) => !pervaya.has(s)), 'вторая волна — другим людям');
  assert.equal(o2.eskalaciya_v, null);
});

test('до начала 2 часа или меньше, никто не взял — будим дежурного (один раз)', opts, async () => {
  const st = P.st();
  P.vremya('2026-10-01T16:05:00-04:00');     // смена sm-1 в 18:00
  await volny.handler({});
  const o = await st.getJSON('otkazy/otk-sm-1-s-01');
  assert.ok(o.eskalaciya_v, 'дежурный разбужен');
  const zh = await P.zhurnal(st, '2026-10-01');
  assert.equal(zh.filter((z) => z.chto === 'eskalaciya_zvonok').length, 1);
  P.vremya('2026-10-01T16:25:00-04:00');
  await volny.handler({});
  const zh2 = await P.zhurnal(st, '2026-10-01');
  assert.equal(zh2.filter((z) => z.chto === 'eskalaciya_zvonok').length, 1, 'второй раз не будим');
});

test('смена началась без замены — «не закрыта» в расписании и в отказе', opts, async () => {
  const st = P.st();
  P.vremya('2026-10-01T18:05:00-04:00');
  await volny.handler({});
  assert.equal((await st.getJSON('smeny/sm-1')).status, 'unfilled');
  const o = await st.getJSON('otkazy/otk-sm-1-s-01');
  assert.equal(o.zakrit, true);
  assert.ok(o.ne_zakryta_v);
});
