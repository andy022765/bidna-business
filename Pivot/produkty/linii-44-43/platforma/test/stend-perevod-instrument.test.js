'use strict';
// Функция perevod на ровно тот вход, что шлёт инструмент ElevenLabs perevod_careline_demo (создан 01.10, care/instrumenty/perevod.json):
// call_sid ← system__call_sid, conversation_id ← system__conversation_id, agent_id ← system__current_agent_id, svodka и yazyk — от модели.
// Карта линий — НАСТОЯЩАЯ (linii.json): обе линии CareLine DEMO на одном секрете CARELINE_DEMO_LINIYA_KLYUCH (здесь — тестовое значение),
// линию функция узнаёт по agent_id. Twilio подменён, сеть запрещена.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T10:00:00-04:00');   // среда, 10:00 по Нью-Йорку — часы офиса
const linii = require('../linii.json');
const L = require('../lib/linii');
const perevod = require('../netlify-functions/perevod');

const CARE = path.join(__dirname, '..', '..', 'care');
const INSTRUMENT = JSON.parse(fs.readFileSync(path.join(CARE, 'instrumenty', 'perevod.json'), 'utf8')).tool_config;
const EL = JSON.parse(fs.readFileSync(path.join(CARE, 'elevenlabs.json'), 'utf8'));
const KLYUCH = 'test-careline-demo-klyuch-0123456789abcdef';
const NOMER = '+19292099535';
const AGENT_NAYM = EL.agenty['care-hiring'].agent_id;
const AGENT_SIDELKI = EL.agenty['care-caregivers'].agent_id;
const CALL = 'CA' + 'b'.repeat(32);
const OFIS = { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] };
// Системные переменные ElevenLabs, которые можно класть в тело вебхука (документация dynamic variables, сверено 01.10).
const SISTEMNYE = new Set(['system__agent_id', 'system__current_agent_id', 'system__caller_id', 'system__called_number',
  'system__call_duration_secs', 'system__time_utc', 'system__time', 'system__timezone', 'system__conversation_id', 'system__call_sid']);

function nastroyki() {
  const n = P.nastroykiTest();
  n.brightside.perevod.chasy = OFIS;   // как в nastroyki.json
  return n;
}
function vklyuchit() {
  process.env.CARELINE_DEMO_LINIYA_KLYUCH = KLYUCH;
  L.ustanovit({ linii, nastroyki: nastroyki() });
}
test.before(vklyuchit);
test.after(() => { delete process.env.CARELINE_DEMO_LINIYA_KLYUCH; L.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); });

// Тело — как его собирает ElevenLabs: поле с dynamic_variable берётся из системных переменных разговора, остальное — от модели.
function telo(sistema, model) {
  const t = {};
  for (const [imya, opis] of Object.entries(INSTRUMENT.api_schema.request_body_schema.properties)) {
    t[imya] = opis.dynamic_variable ? sistema[opis.dynamic_variable] : model[imya];
  }
  return t;
}
const zvonok = (agent, model = {}, dop = {}) => telo(Object.assign({ system__call_sid: CALL, system__conversation_id: 'conv_test_perevod_el_0001',
  system__current_agent_id: agent }, dop), Object.assign({ svodka: 'Caller wants to talk about a job application', yazyk: 'en' }, model));
const vyzov = async (t, klyuch = KLYUCH) => P.otvet(await perevod.handler(P.instrument(t, klyuch)));
const poslednyaya = async (chto) => (await P.zhurnal(P.st(), '2026-09-30')).filter((x) => x.chto === chto).pop();

test('тело инструмента сходится с функцией: адрес, секрет линии, системные переменные, без nomer_linii', () => {
  assert.equal(INSTRUMENT.name, 'perevod_careline_demo');
  assert.equal(INSTRUMENT.api_schema.url, 'https://linii-demo-85fof.netlify.app/.netlify/functions/perevod');
  assert.equal(INSTRUMENT.api_schema.method, 'POST');
  assert.deepEqual(INSTRUMENT.api_schema.request_headers, { 'x-liniya-klyuch': { secret_id: EL.sekret.secret_id } });
  const sv = INSTRUMENT.api_schema.request_body_schema.properties;
  assert.equal(sv.call_sid.dynamic_variable, 'system__call_sid', 'функция обновляет звонок Twilio по его sid');
  assert.equal(sv.conversation_id.dynamic_variable, 'system__conversation_id');
  assert.equal(sv.agent_id.dynamic_variable, 'system__current_agent_id', 'после transfer_to_agent — агент сиделок, а не найма');
  for (const o of Object.values(sv)) if (o.dynamic_variable) assert.ok(SISTEMNYE.has(o.dynamic_variable), o.dynamic_variable);
  assert.deepEqual(sv.yazyk.enum, ['en', 'es', 'ru']);
  // nomer_linii (system__called_number) сузил бы выбор до линии найма — у обеих линий один номер, и сиделок не узнать
  assert.ok(!('nomer_linii' in sv) && !('called_number' in sv));
  assert.equal(INSTRUMENT.pre_tool_speech, 'off', 'перед переводом агент молчит: «соединяю» говорит TwiML');
  // и он создан и подключён (care/elevenlabs.json, sborka_agentov.py --primenit 01.10)
  assert.match(EL.perevod_vebhuk_id, /^tool_[a-z0-9]+$/);
  assert.equal(EL.instrumenty.perevod.id, EL.perevod_vebhuk_id);
  for (const a of Object.values(EL.agenty)) {
    assert.ok(a.instrumenty.includes('perevod_careline_demo'));
    assert.ok(!a.sistemnye.some((s) => s.startsWith('transfer_to_number')), 'системный transfer_to_number снят');
  }
  assert.equal(linii[NOMER].agent_id, AGENT_NAYM);
  assert.equal(linii['DEMO-2'].agent_id, AGENT_SIDELKI);
});

test('DRY_RUN (так стенд выкладывается): агент найма в часы офиса — Twilio не трогаем, агент принимает сообщение', async () => {
  const r = await vyzov(zvonok(AGENT_NAYM));
  assert.deepEqual([r.ok, r.dry_run, r.kod], [false, true, 'dry_run']);
  assert.match(r.dalshe, /Do NOT say you are transferring/);
  const z = await poslednyaya('perevod_dry_run');
  assert.equal(z.detali.liniya, 'care-hiring');
  assert.equal(z.detali.cepochka, 'k');
  assert.equal(z.detali.call_sid, CALL);
  assert.deepEqual(z.detali.komu, ['+17185550191', '+17185550192']);
});

test('после transfer_to_agent (system__current_agent_id = агент сиделок): ночью — цепочка дежурных', async () => {
  P.vremya('2026-09-30T23:10:00-04:00');
  try {
    const r = await vyzov(zvonok(AGENT_SIDELKI, { svodka: 'Caregiver locked out at the client home', yazyk: 'ru' }));
    assert.equal(r.dry_run, true);
    assert.match(r.dalshe, /НЕ говори, что переводишь/);
    const z = await poslednyaya('perevod_dry_run');
    assert.equal(z.detali.liniya, 'care-caregivers');
    assert.equal(z.detali.cepochka, 'd');
    assert.deepEqual(z.detali.komu, ['+17185550190']);
    const naym = await vyzov(zvonok(AGENT_NAYM, { yazyk: 'es' }));
    assert.equal(naym.kod, 'vne_chasov', 'линия найма ночью не переводит');
    assert.match(naym.soobshchenie, /no están disponibles/);
  } finally { P.vremya('2026-09-30T10:00:00-04:00'); }
});

test('вживую (Twilio подменён): линия сиделок на номере линии найма — звонок узнан, TwiML с ширмой, отметка в разговоре', async () => {
  process.env.DRY_RUN = '0';
  let twiml = null;
  const f = P.podmenitFetch((url, opts) => {
    if (opts.method === 'GET') return P.response(200, { sid: CALL, to: NOMER, status: 'in-progress' });
    twiml = new URLSearchParams(opts.body).get('Twiml');
    return P.response(200, { sid: CALL });
  });
  try {
    const r = await vyzov(zvonok(AGENT_SIDELKI, { svodka: 'Aide <b>DEMO</b> cannot make tonight shift', yazyk: 'es' },
      { system__conversation_id: 'conv_test_perevod_el_0002' }));
    assert.deepEqual([r.ok, r.perevedeno], [true, true]);
    assert.equal(f.vyzovy.length, 2);
    assert.match(f.vyzovy[0].url, new RegExp(`/Calls/${CALL}\\.json$`));
    assert.match(twiml, /<Say language="es-US" voice="Polly.Lupe">Le comunico con el coordinador, un momento.<\/Say>/);
    assert.match(twiml, new RegExp(`<Dial timeout="20" callerId="\\${NOMER}" action="[^"]*shag=itog[^"]*l=DEMO-2`));
    assert.match(twiml, /<Number url="[^"]*shag=shirma[^"]*" method="POST">\+17185550191<\/Number>/);
    assert.doesNotMatch(twiml, /<b>/);
    assert.equal((await P.st().getJSON('razgovory/conv_test_perevod_el_0002')).perevod, true);
  } finally { f.vernut(); process.env.DRY_RUN = '1'; }
});

test('текстовый прогон или веб-разговор: call_sid не подставлен — вживую отказ без запроса к Twilio, в DRY_RUN sid пустой', async () => {
  const bezSid = zvonok(AGENT_NAYM, {}, { system__call_sid: '{{system__call_sid}}' });
  const d = await vyzov(bezSid);
  assert.equal(d.dry_run, true);
  assert.equal((await poslednyaya('perevod_dry_run')).detali.call_sid, null);
  process.env.DRY_RUN = '0';
  const f = P.podmenitFetch(() => { throw new Error('к Twilio ходить нельзя'); });
  try {
    assert.equal((await vyzov(bezSid)).kod, 'net_sid');
    assert.equal((await vyzov(zvonok(AGENT_NAYM, {}, { system__call_sid: undefined }))).kod, 'net_sid');
    assert.equal(f.vyzovy.length, 0);
  } finally { f.vernut(); process.env.DRY_RUN = '1'; }
});

test('agent_id не подставлен — линия найма (первая по linii.json): ночью перевода нет, агент принимает сообщение', async () => {
  P.vremya('2026-09-30T23:10:00-04:00');
  try {
    const r = await vyzov(zvonok('{{system__current_agent_id}}'));
    assert.equal(r.kod, 'vne_chasov');
  } finally { P.vremya('2026-09-30T10:00:00-04:00'); }
});

test('чужой ключ — net_dostupa, журнал не тронут', async () => {
  const bylo = (await P.zhurnal(P.st(), '2026-09-30')).length;
  const r = await vyzov(zvonok(AGENT_NAYM), 'chuzhoy-klyuch-0123456789abcdef');
  assert.equal(r.kod, 'net_dostupa');
  assert.equal((await P.zhurnal(P.st(), '2026-09-30')).length, bylo);
});
