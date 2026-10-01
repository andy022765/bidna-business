'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T14:05:00-04:00');
const pult = require('../netlify-functions/pult');
const evv = require('../netlify-functions/evv');
const kandidat = require('../netlify-functions/kandidat');
const E = require('../lib/care/evv');

const get = (k, headers = {}) => pult.handler({ httpMethod: 'GET', path: '/.netlify/functions/pult', queryStringParameters: k === undefined ? {} : { k }, headers });
const CSV = [
  'Visit ID,Member ID,Caregiver Code,Procedure Code,Visit Date,Visit Start Time,Visit End Time',
  'V-1,c-01,s-02,T1019,2026-09-28,2026-09-28T09:00:00-04:00,',
  'V-2,c-01,s-02,T1019,2026-09-29,2026-09-29T09:00:00-04:00,2026-09-29T13:00:00-04:00',
].join('\r\n');
const zagruzit = (tekst, q = {}, headers = { 'content-type': 'text/csv; charset=utf-8' }) =>
  evv.handler({ httpMethod: 'POST', path: '/.netlify/functions/evv', queryStringParameters: q, headers, body: tekst });

test.before(async () => { await P.zasejat(P.st()); });

test('пульт: без ключа, с коротким и чужим ключом — 401 oshibka klyuch', async () => {
  for (const k of [undefined, 'short', 'x'.repeat(40)]) {
    const r = await get(k);
    assert.equal(r.statusCode, 401);
    assert.equal(P.otvet(r).oshibka, 'klyuch');
  }
  assert.equal((await pult.handler({ httpMethod: 'POST', queryStringParameters: { k: P.KLYUCHI.PULT } })).statusCode, 405);
});

test('пульт по ключу: снимок клиента (формат сборщика пульта) + обращения семей и журнал', async () => {
  const kand = P.otvet(await kandidat.handler(P.instrument({ imya: 'Pult DEMO', telefon: '+17185550181', sertifikat: 'HHA', podhodit: true, sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_pult_000001' })));
  const r = await get(P.KLYUCHI.PULT);
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['cache-control'], 'no-store');
  const d = P.otvet(r);
  assert.equal(d.ok, true);
  assert.equal(d.versiya, 1);
  assert.equal(d.demo, true);
  assert.equal(d.klient.id, 'brightside');
  assert.equal(d.klient.nazvanie, 'Brightside Home Care (DEMO)');
  assert.equal(d.sformirovano, '2026-09-30T14:05:00-04:00');
  assert.ok(d.kandidaty.some((k) => k.id === kand.id));
  assert.equal(d.segodnya.kandidaty.novyh, 1);
  assert.ok(Array.isArray(d.semi));
  assert.ok(Array.isArray(d.zhurnal) && d.zhurnal.some((z) => z.chto === 'kandidat_novyy'));
  assert.ok(!JSON.stringify(d).includes(P.KLYUCHI.PULT), 'ключа в ответе нет');
  const poZagolovku = await get(undefined, { 'x-pult-klyuch': P.KLYUCHI.PULT });
  assert.equal(poZagolovku.statusCode, 200);
});

test('EVV: чужой ключ — 401; пустой файл — 400; больше 5 МБ — 413', async () => {
  assert.equal((await zagruzit(CSV, { k: 'x'.repeat(40) })).statusCode, 401);
  assert.equal((await zagruzit('Visit ID\r\n', { k: P.KLYUCHI.PULT })).statusCode, 400);
  assert.equal((await zagruzit('Visit ID\n' + 'x'.repeat(5 * 1024 * 1024 + 10), { k: P.KLYUCHI.PULT })).statusCode, 413);
});

test('EVV: CSV → движок правил → прогон evv/<run_id> → ответ {ok, progon}; пульт показывает последний', async () => {
  const r = await zagruzit(CSV, { k: P.KLYUCHI.PULT, shtat: 'NY', fayl: 'visits sep.csv' });
  assert.equal(r.statusCode, 200, r.body);
  const { ok, progon } = P.otvet(r);
  assert.equal(ok, true);
  assert.match(progon.run_id, /^evv-20260930-1405-[0-9a-f]{4}$/);
  assert.equal(progon.shtat, 'NY');
  assert.equal(progon.strok, 2);
  assert.equal(progon.fayl, 'visits sep.csv');
  assert.equal(progon.zagruzheno, '2026-09-30T14:05:00-04:00');
  assert.ok(Array.isArray(progon.isklyucheniya));
  if (typeof E.proveritCsv === 'function') {
    assert.ok(progon.isklyucheniya.some((x) => x.vizit_id === 'V-1'), 'визит без отметки ухода найден');
  }
  const st = P.st();
  assert.equal((await st.getJSON(`evv/${progon.run_id}`)).strok, 2);
  const d = P.otvet(await get(P.KLYUCHI.PULT));
  assert.equal(d.evv.posledniy.run_id, progon.run_id);
  const j = await zagruzit(JSON.stringify({ csv: CSV, shtat: 'NC' }), { k: P.KLYUCHI.PULT }, { 'content-type': 'application/json' });
  assert.equal(P.otvet(j).progon.shtat, 'NC');
});

test('EVV: выгрузка без колонки даты визита — 400 с понятной фразой', { skip: typeof E.proveritCsv !== 'function' && 'движок EVV без proveritCsv' }, async () => {
  const r = await zagruzit('Visit ID,Caregiver Code\r\nV-9,s-02\r\n', { k: P.KLYUCHI.PULT });
  assert.equal(r.statusCode, 400);
  assert.match(P.otvet(r).soobshchenie, /no visit date column/);
});

test('EVV: авторизации клиентов агентства уходят движку с klient_id', () => {
  const a = evv._avtorizaciiIzKlientov(P.klientyAgentstva());
  assert.equal(a.length, 1);
  assert.equal(a[0].klient_id, 'c-01');
  assert.equal(a[0].kod_uslugi, 'T1019');
  assert.equal(a[0].klient_kod, 'BK-114');
});
