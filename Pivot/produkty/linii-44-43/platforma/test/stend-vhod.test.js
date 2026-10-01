'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T10:00:00-04:00');
const linii = require('../lib/linii');
const vhod = require('../netlify-functions/vhod');

const TWIML_EL = '<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://api.elevenlabs.io/x"/></Connect></Response>';
const zvonok = (sid, ot = '+17185550142', kuda = P.NOMER_NAYM) => vhod.handler(P.twilio('vhod', { CallSid: sid, From: ot, To: kuda }));
const sid = (n) => 'CA' + String(n).padStart(32, '0');
// Эталон — chasy() из care/progony/progon.py для «Wednesday, 15:40 30 September 2026» (так гонялись прогоны).
const KALENDAR_30_09 = 'Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; Saturday October 3; '
  + 'Sunday October 4; Monday October 5; Tuesday October 6; Wednesday October 7; Thursday October 8; Friday October 9; '
  + 'Saturday October 10; Sunday October 11; Monday October 12; Tuesday October 13';

test('без подписи — 403; номер не из linii.json — 403', async () => {
  const e = P.twilio('vhod', { CallSid: sid(1), From: '+17185550142', To: P.NOMER_NAYM }, { bezPodpisi: true });
  assert.equal((await vhod.handler(e)).statusCode, 403);
  assert.equal((await zvonok(sid(2), '+17185550142', '+17185550199')).statusCode, 403);
});

test('звонок на номер линии → register-call агента этой линии → TwiML ElevenLabs как есть', async () => {
  const f = P.podmenitFetch(() => P.response(200, TWIML_EL));
  try {
    const r = await zvonok(sid(3));
    assert.equal(r.statusCode, 200);
    assert.equal(r.body, TWIML_EL);
    assert.equal(f.vyzovy.length, 1);
    assert.equal(f.vyzovy[0].url, 'https://api.elevenlabs.io/v1/convai/twilio/register-call');
    const telo = JSON.parse(f.vyzovy[0].opts.body);
    // В тестовых настройках часов офиса нет (perevod.chasy = null) — ofis_seychas не передаём, календарь передаём.
    assert.deepEqual(telo, { agent_id: 'agent_test_naym_tel', from_number: '+17185550142', to_number: P.NOMER_NAYM, direction: 'inbound',
      conversation_initiation_client_data: { dynamic_variables: { kalendar: KALENDAR_30_09 } } });
    assert.equal(f.vyzovy[0].opts.headers['xi-api-key'], 'test-elevenlabs-key');
    // JSON-ответ {twiml} тоже понимаем
    const g = P.podmenitFetch(() => P.response(200, { twiml: TWIML_EL }));
    assert.equal((await zvonok(sid(4))).body, TWIML_EL);
    g.vernut();
  } finally { f.vernut(); }
});

test('ElevenLabs отказал или у линии нет агента — фраза на языке линии, а не тишина; есть резерв — в офис', async () => {
  const f = P.podmenitFetch(() => P.response(500, 'err'));
  try {
    const r = await zvonok(sid(5));
    assert.match(r.body, /<Say language="en-US" voice="Polly.Joanna">Sorry, we can(&apos;|')t take your call/);
    assert.match(r.body, /<Hangup\/>/);
    const n = P.nastroykiTest();
    n.brightside.rezerv_nomer = '+17185550188';
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
    const s = await zvonok(sid(6));
    assert.match(s.body, /<Dial timeout="25">\+17185550188<\/Dial>/);
  } finally { f.vernut(); linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); }
});

test('суточный предел — свой у клиента; повтор вебхука того же CallSid не считается; свои номера мимо предела', async () => {
  const n = P.nastroykiTest();
  n.brightside.limity.zvonkov_v_sutki = 5;   // из них 4 уже съели прошлые тесты этого файла
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  const f = P.podmenitFetch(() => P.response(200, TWIML_EL));
  try {
    const st = P.st();
    const bylo = ((await st.getJSON('schetchiki/2026-09-30')) || {}).zvonkov || 0;
    const rez = [];
    for (let i = 0; i < 5 - bylo; i++) rez.push(await zvonok(sid(100 + i)));
    assert.ok(rez.every((r) => r.body === TWIML_EL), 'до предела соединяем');
    assert.equal((await zvonok(sid(100))).body, TWIML_EL, 'повтор того же CallSid — соединяем, счётчик не трогаем');
    const sverh = await zvonok(sid(200));
    assert.match(sverh.body, /<Say/);
    assert.notEqual(sverh.body, TWIML_EL);
    process.env.ZVONKI_BEZ_KVOTY = '+17185550177';
    assert.equal((await zvonok(sid(201), '+17185550177')).body, TWIML_EL, 'свой номер обкатки — мимо предела');
  } finally { f.vernut(); delete process.env.ZVONKI_BEZ_KVOTY; linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); }
});

test('переменные агента: ofis_seychas по часам офиса клиента и kalendar на 14 дней — в register-call', async () => {
  const n = P.nastroykiTest();
  n.brightside.perevod.chasy = { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] };   // как в nastroyki.json
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  const f = P.podmenitFetch(() => P.response(200, TWIML_EL));
  // [момент звонка, ofis_seychas]: провалы пилота 30.09 — «закрыто» в среду 15:40 и перевод в 20:30.
  const sluchai = [
    ['2026-09-30T15:40:00-04:00', 'OPEN'], ['2026-09-30T20:30:00-04:00', 'CLOSED'],
    ['2026-10-02T16:59:00-04:00', 'OPEN'], ['2026-10-02T17:00:00-04:00', 'CLOSED'],
    ['2026-10-03T11:00:00-04:00', 'CLOSED'], ['2026-10-05T08:59:00-04:00', 'CLOSED'], ['2026-10-05T09:00:00-04:00', 'OPEN'],
    ['2026-12-02T09:30:00-05:00', 'OPEN'],   // зимнее время: 14:30 UTC
  ];
  try {
    let i = 300;
    for (const [kogda, ofis] of sluchai) {
      P.vremya(kogda);
      const r = await zvonok(sid(i++));
      assert.equal(r.body, TWIML_EL, kogda);
      const telo = JSON.parse(f.vyzovy[f.vyzovy.length - 1].opts.body);
      const dv = telo.conversation_initiation_client_data.dynamic_variables;
      assert.deepEqual(Object.keys(dv).sort(), ['kalendar', 'ofis_seychas']);
      assert.equal(dv.ofis_seychas, ofis, kogda);
      assert.equal(dv.kalendar.split('; ').length, 14);
      assert.ok(dv.kalendar.includes(' (today); '), kogda);
    }
    assert.equal(JSON.parse(f.vyzovy[0].opts.body).conversation_initiation_client_data.dynamic_variables.kalendar, KALENDAR_30_09);
    const zh = await P.zhurnal(P.st(), '2026-10-05');
    assert.ok(zh.some((z) => z.chto === 'zvonok_vhod' && z.detali.ofis_seychas === 'OPEN'), 'статус офиса — в журнал звонка');
  } finally {
    f.vernut();
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });
    P.vremya('2026-09-30T10:00:00-04:00');
  }
});

test('на стенде часы офиса заданы (nastroyki.json) — ofis_seychas уходит агенту', () => {
  const n = require('../nastroyki.json');
  assert.deepEqual(n.brightside.perevod.chasy, { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] });
  assert.equal(n.brightside.poyas, 'America/New_York');
});

test('расчёт переменных упал — соединяем без них (у агента пустые заглушки), звонок не теряем', async () => {
  const n = P.nastroykiTest();
  Object.defineProperty(n.brightside.perevod, 'chasy', { get() { throw new Error('проверка: настройки сломаны'); } });
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  const f = P.podmenitFetch(() => P.response(200, TWIML_EL));
  try {
    const r = await zvonok(sid(400));
    assert.equal(r.body, TWIML_EL);
    const telo = JSON.parse(f.vyzovy[0].opts.body);
    assert.equal(telo.conversation_initiation_client_data, undefined);
    assert.equal(telo.agent_id, 'agent_test_naym_tel');
  } finally { f.vernut(); linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); }
});

test('ElevenLabs не принял переменные (422) — один повтор без них; другая ошибка (500) — без повтора, фраза', async () => {
  let n = 0;
  const f = P.podmenitFetch(() => (++n === 1 ? P.response(422, { detail: 'проверка' }) : P.response(200, TWIML_EL)));
  try {
    const r = await zvonok(sid(500));
    assert.equal(r.body, TWIML_EL);
    assert.equal(f.vyzovy.length, 2);
    assert.ok(JSON.parse(f.vyzovy[0].opts.body).conversation_initiation_client_data, 'первый раз — с переменными');
    assert.equal(JSON.parse(f.vyzovy[1].opts.body).conversation_initiation_client_data, undefined, 'повтор — без них');
  } finally { f.vernut(); }
  const g = P.podmenitFetch(() => P.response(500, 'err'));
  try {
    const r = await zvonok(sid(501));
    assert.match(r.body, /<Say/);
    assert.equal(g.vyzovy.length, 1);
  } finally { g.vernut(); }
});

test('на стенде суточный предел входящих — 15 (nastroyki.json), исходящих — свой потолок', () => {
  const n = require('../nastroyki.json');
  assert.equal(n.brightside.limity.zvonkov_v_sutki, 15);
  assert.ok(n.brightside.limity.ishodyashchih_v_sutki > 0 && n.brightside.limity.ishodyashchih_v_sutki <= 15);
});

test('fail-closed: хранилище не поднялось или счётчик упал — линию не открываем, ElevenLabs не зовём; свой номер обкатки — соединяем', async () => {
  const H = require('../lib/hranilishche');
  const nastoyashchee = H.hranilishcheKlienta;
  const f = P.podmenitFetch(() => P.response(200, TWIML_EL));
  try {
    H.hranilishcheKlienta = () => null;   // Blobs не поднялся (нет токена, сбой сети)
    const r = await zvonok(sid(600));
    assert.equal(r.statusCode, 200);
    assert.match(r.body, /<Say language="en-US" voice="Polly.Joanna">Sorry, this line is temporarily unavailable\. Please call again later\.<\/Say><Hangup\/>/);
    assert.equal(f.vyzovy.length, 0, 'register-call не вызван: минуты ElevenLabs не тратим');

    H.hranilishcheKlienta = () => ({ zanyat: async () => { throw new Error('Blobs 500'); },
                                     obnovit: async () => { throw new Error('Blobs 500'); }, getJSON: async () => null });
    const s = await zvonok(sid(601));
    assert.match(s.body, /temporarily unavailable/);
    assert.equal(f.vyzovy.length, 0);

    const n = P.nastroykiTest();
    n.brightside.rezerv_nomer = '+17185550188';
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
    assert.match((await zvonok(sid(602))).body, /<Dial timeout="25">\+17185550188<\/Dial>/, 'у живого клиента — в его офис');
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });

    H.hranilishcheKlienta = () => null;
    process.env.ZVONKI_BEZ_KVOTY = '+17185550177';
    assert.equal((await zvonok(sid(603), '+17185550177')).body, TWIML_EL, 'свой номер обкатки предел не ест — соединяем');
    assert.equal(f.vyzovy.length, 1);
  } finally {
    H.hranilishcheKlienta = nastoyashchee;
    delete process.env.ZVONKI_BEZ_KVOTY;
    linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });
    f.vernut();
  }
});
