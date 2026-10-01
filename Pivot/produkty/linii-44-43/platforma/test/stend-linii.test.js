'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
const linii = require('../lib/linii');

test('настоящий linii.json: номер найма CareLine DEMO и линия сиделок на том же номере', () => {
  const L = require('../linii.json');
  assert.deepEqual(Object.keys(L).sort(), ['+19292099535', 'DEMO-2']);
  assert.equal(L['+19292099535'].liniya, 'care-hiring');
  assert.equal(L['+19292099535'].agent_id, 'agent_2001m3sx90scf9msygm0e685h1yw');
  assert.equal(L['DEMO-2'].liniya, 'care-caregivers');
  assert.equal(L['DEMO-2'].agent_id, 'agent_5001m3sx8yr5ee1sne6p5b8zcmwk');
  assert.equal(L['DEMO-2'].nomer, '+19292099535');
  for (const l of Object.values(L)) {
    assert.equal(l.klient, 'brightside');
    assert.equal(l.klyuch_env, 'CARELINE_DEMO_LINIYA_KLYUCH');
    assert.ok('agent_id' in l && 'yazyk' in l);
    assert.ok(!/sk_|secret|token/i.test(JSON.stringify(l)), 'в linii.json нет секретов');
  }
  const N = require('../nastroyki.json');
  assert.ok(N.brightside && N.brightside.poyas === 'America/New_York');
  // часы — из листа правды агентства (агент называет их вслух)
  assert.deepEqual([N.brightside.kalendari.sobesedovanie.chas_ot, N.brightside.kalendari.sobesedovanie.chas_do], [10, 16]);
  assert.deepEqual(N.brightside.kalendari.ocenka.dni, [1, 2, 3, 4, 5]);
  assert.deepEqual([N.brightside.perevod.chasy.chas_ot, N.brightside.perevod.chasy.chas_do], [9, 17]);
});

test('настоящие файлы: общий секрет двух линий — клиент один, линию выбирает функция или агент', () => {
  linii.ustanovit({ linii: require('../linii.json'), nastroyki: require('../nastroyki.json') });
  process.env.CARELINE_DEMO_LINIYA_KLYUCH = 'test-careline-demo-klyuch-0123456789';
  try {
    const h = { 'x-liniya-klyuch': process.env.CARELINE_DEMO_LINIYA_KLYUCH };
    assert.equal(linii.opredelitLiniyu(h, {}, { predpochtenie: 'care-hiring' }).liniya.klyuch, '+19292099535');
    assert.equal(linii.opredelitLiniyu(h, {}, { predpochtenie: 'care-caregivers' }).liniya.klyuch, 'DEMO-2');
    assert.equal(linii.opredelitLiniyu(h, { agent_id: 'agent_5001m3sx8yr5ee1sne6p5b8zcmwk' }).liniya.klyuch, 'DEMO-2');
    assert.equal(linii.nomerLinii(linii.liniya('DEMO-2')), '+19292099535', 'у линии сиделок — номер линии найма');
    assert.equal(linii.poNomeru('+1 929 209 9535').liniya, 'care-hiring', 'входящий на номер — линия найма');
  } finally {
    delete process.env.CARELINE_DEMO_LINIYA_KLYUCH;
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });
  }
});

test('линия по секрету: DEMO-1 и DEMO-2 различаются, чужой и пустой — отказ', () => {
  assert.equal(linii.opredelitLiniyu({ 'x-liniya-klyuch': P.KLYUCHI.DEMO_1 }, {}).liniya.klyuch, 'DEMO-1');
  assert.equal(linii.opredelitLiniyu({ 'X-Liniya-Klyuch': P.KLYUCHI.DEMO_2 }, {}).liniya.klyuch, 'DEMO-2');
  assert.equal(linii.opredelitLiniyu({ 'x-liniya-klyuch': 'x'.repeat(40) }, {}).ok, false);
  assert.equal(linii.opredelitLiniyu({}, {}).ok, false);
  const r = linii.opredelitLiniyu({ 'x-liniya-klyuch': P.KLYUCHI.TEL_1 }, {});
  assert.equal(r.liniya.klyuch, P.NOMER_NAYM);
  assert.equal(r.klient.id, 'brightside');
});

test('системные поля сужают выбор и обязаны совпасть с линией секрета', () => {
  const h = { 'x-liniya-klyuch': P.KLYUCHI.TEL_1 };
  assert.equal(linii.opredelitLiniyu(h, { nomer_linii: '(718) 555-0101' }).ok, true);
  assert.equal(linii.opredelitLiniyu(h, { nomer_linii: P.NOMER_SIDELKI }).ok, false, 'номер чужой линии — отказ');
  assert.equal(linii.opredelitLiniyu(h, { agent_id: 'agent_test_sidelki_tel' }).ok, false, 'агент чужой линии — отказ');
  assert.equal(linii.opredelitLiniyu(h, { nomer_linii: '{{system__called_number}}' }).ok, true, 'неподставленная переменная — не помеха');
});

test('общий секрет у линий ОДНОГО клиента терпим, у РАЗНЫХ клиентов — отказ', () => {
  const nastroyki = P.nastroykiTest();
  nastroyki.drugoy = Object.assign({}, nastroyki.brightside, { nazvanie: 'Other (DEMO)' });
  const obshchiy = { 'X-1': { liniya: 'care-hiring', klient: 'brightside', agent_id: 'a1', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_DEMO_1' },
                     'X-2': { liniya: 'care-caregivers', klient: 'brightside', agent_id: 'a2', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_DEMO_1' } };
  linii.ustanovit({ linii: obshchiy, nastroyki });
  const r = linii.opredelitLiniyu({ 'x-liniya-klyuch': P.KLYUCHI.DEMO_1 }, {});
  assert.equal(r.ok, true);
  assert.equal(r.klient.id, 'brightside');
  assert.equal(r.liniya.neodnoznachno, true);
  assert.equal(linii.opredelitLiniyu({ 'x-liniya-klyuch': P.KLYUCHI.DEMO_1 }, { agent_id: 'a2' }).liniya.klyuch, 'X-2');
  linii.ustanovit({ linii: Object.assign({}, obshchiy, { 'X-3': { liniya: 'care-hiring', klient: 'drugoy', agent_id: 'a3', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_DEMO_1' } }), nastroyki });
  assert.equal(linii.opredelitLiniyu({ 'x-liniya-klyuch': P.KLYUCHI.DEMO_1 }, {}).ok, false);
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });
});

test('номер → линия, агент → линия, E.164', () => {
  assert.equal(linii.poNomeru('+1 (718) 555-0102').liniya, 'care-caregivers');
  assert.equal(linii.poNomeru('7185550101').liniya, 'care-hiring');
  assert.equal(linii.poNomeru('+15555550000'), null);
  assert.equal(linii.poAgentu('agent_test_naym').klyuch, 'DEMO-1');
  assert.equal(linii.poAgentu(''), null);
  assert.equal(linii.e164('(718) 555-0142'), '+17185550142');
  assert.equal(linii.e164('17185550142'), '+17185550142');
  assert.equal(linii.e164('+44 20 7946 0958'), '+442079460958');
  assert.equal(linii.e164('client:web'), null);
  assert.equal(linii.e164('555'), null);
  assert.equal(linii.nomerLinii(linii.liniya('DEMO-1')), null, 'у демо-линии номера ещё нет');
  assert.equal(linii.nomerLinii(linii.liniya(P.NOMER_NAYM)), P.NOMER_NAYM);
});

test('инструмент с чужим ключом отвечает HTTP 200 и {ok:false, soobshchenie}', async () => {
  const f = require('../netlify-functions/kandidat');
  const r = await f.handler(P.instrument({ imya: 'Test DEMO', telefon: '+17185550142', yazyk: 'es' }, 'x'.repeat(40)));
  assert.equal(r.statusCode, 200);
  const b = P.otvet(r);
  assert.equal(b.ok, false);
  assert.match(b.soobshchenie, /No puedo/);
  const g = await f.handler(Object.assign(P.instrument({}), { httpMethod: 'GET' }));
  assert.equal(g.statusCode, 405);
});
