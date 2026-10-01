'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T10:00:00-04:00');
const itog = require('../netlify-functions/itog');
const kandidat = require('../netlify-functions/kandidat');
const kalendar = require('../lib/kalendar');
const zapis = require('../netlify-functions/zapis');

function vebhuk(conv, dop = {}) {
  return {
    type: 'post_call_transcription',
    event_timestamp: 1790000000,
    data: Object.assign({
      agent_id: 'agent_test_naym',
      conversation_id: conv,
      status: 'done',
      transcript: [
        { role: 'agent', message: 'Hi, this is the AI assistant for Brightside Home Care. This call is recorded. How can I help?' },
        { role: 'user', message: 'I am looking for a home health aide job.' },
      ],
      metadata: { start_time_unix_secs: Math.floor(Date.parse('2026-09-30T09:40:00-04:00') / 1000), call_duration_secs: 187.4,
                  phone_call: { external_number: '+17185550142', agent_number: P.NOMER_NAYM } },
      analysis: { transcript_summary: 'Maria (DEMO) booked an interview.', call_successful: 'success', data_collection_results: {} },
      conversation_initiation_client_data: { dynamic_variables: { system__caller_id: '+17185550142', system__called_number: P.NOMER_NAYM } },
    }, dop),
  };
}

test('подпись: нет, чужая, протухшая — 401; не тот тип — пропуск', async () => {
  const telo = vebhuk('conv_test_itog_00000');
  const bez = P.elevenlabs(telo);
  delete bez.headers['elevenlabs-signature'];
  assert.equal((await itog.handler(bez)).statusCode, 401);
  assert.equal((await itog.handler(P.elevenlabs(telo, { sekret: 'chuzhoy' }))).statusCode, 401);
  assert.equal((await itog.handler(P.elevenlabs(telo, { tSek: Math.floor(Date.now() / 1000) - 7200 }))).statusCode, 401);
  const audio = await itog.handler(P.elevenlabs({ type: 'post_call_audio', data: { conversation_id: 'conv_test_itog_00000' } }));
  assert.equal(P.otvet(audio).propushcheno, 'post_call_audio');
});

test('итог: карточка звонка по контракту, намерение и итог — словарём пульта, согласия — в журнал', async () => {
  kalendar.ustanovitAdapter(kalendar.feykKalendar({ 'kal-sobesedovanie@test': {}, 'kal-ocenka@test': {} }));
  const conv = 'conv_test_itog_00001';
  const k = P.otvet(await kandidat.handler(P.instrument({ imya: 'Maria DEMO', telefon: '+17185550142', sertifikat: 'HHA', podhodit: true, sms_soglasie: false, yazyk: 'en', conversation_id: conv })));
  const z = P.otvet(await zapis.handler(P.instrument({ tip: 'sobesedovanie', start: '2026-10-01T12:00:00-04:00', imya: 'Maria DEMO', telefon: '+17185550142', conversation_id: conv })));
  assert.equal(z.ok, true);
  const r = await itog.handler(P.elevenlabs(vebhuk(conv)));
  assert.equal(r.statusCode, 200);
  const st = P.st();
  const zv = await st.getJSON(`zvonki/${conv}`);
  assert.equal(zv.conversation_id, conv);
  assert.equal(zv.liniya, 'care-hiring');
  assert.equal(zv.nachalo, '2026-09-30T09:40:00-04:00');
  assert.equal(zv.dlitelnost_s, 187);
  assert.equal(zv.yazyk, 'en');
  assert.equal(zv.namerenie, 'rabota');
  assert.equal(zv.itog, 'zapisan');
  assert.equal(zv.kratko, 'Maria (DEMO) booked an interview.');
  assert.deepEqual(zv.soglasiya, { zapis: true, ii: true });
  assert.equal(zv.raskrytie_ii, true);
  assert.equal(zv.kandidat_id, k.id);
  const s = await st.getJSON('soglasiya/+17185550142');
  assert.equal(s.zapis, true);
  assert.equal(s.ii, true);
  assert.equal((await st.getJSON(`kandidaty/${k.id}`)).soglasiya.ii, true);
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.equal(zh.filter((x) => x.chto === 'zvonok_itog' && x.obekt === `zvonki/${conv}`).length, 1);
});

test('повтор вебхука — без второй карточки и строки журнала', async () => {
  const conv = 'conv_test_itog_00001';
  const r = await itog.handler(P.elevenlabs(vebhuk(conv)));
  assert.equal(P.otvet(r).povtor, true);
  const zh = await P.zhurnal(P.st(), '2026-09-30');
  assert.equal(zh.filter((x) => x.chto === 'zvonok_itog' && x.obekt === `zvonki/${conv}`).length, 1);
  const para = await Promise.all([1, 2].map(() => itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00002')))));
  assert.equal(para.filter((x) => P.otvet(x).povtor).length, 1, 'из двух одновременных обработан один');
});

test('сброс без разговора, отказ от записи, раскрытие ИИ по-русски и по-испански', async () => {
  const st = P.st();
  await itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00003', { transcript: [{ role: 'agent', message: 'Hola, soy la asistente de inteligencia artificial de Brightside.' }] })));
  const a = await st.getJSON('zvonki/conv_test_itog_00003');
  assert.equal(a.itog, 'sbros');
  assert.equal(a.raskrytie_ii, true);
  await itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00004', {
    transcript: [{ role: 'agent', message: 'Здравствуйте, я ИИ-ассистент агентства. Разговор записывается.' }, { role: 'user', message: 'Нет, не хочу.' }],
    analysis: { transcript_summary: '', data_collection_results: { soglasie_zapis: { value: false } } },
  })));
  const b = await st.getJSON('zvonki/conv_test_itog_00004');
  assert.equal(b.raskrytie_ii, true);
  assert.equal(b.soglasiya.zapis, false);
  assert.equal(b.itog, 'net_soglasiya');
  await itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00005', { transcript: [{ role: 'agent', message: 'Hello, Brightside, how can I help?' }, { role: 'user', message: 'Hi' }] })));
  assert.equal((await st.getJSON('zvonki/conv_test_itog_00005')).raskrytie_ii, false, 'нет раскрытия — видно в карточке');
});

test('словарь агентов → словарь пульта; kratko агента; сообщение координатору — письмом (DRY_RUN — журнал), без дублей', async () => {
  const st = P.st();
  const conv = 'conv_test_itog_00007';
  const telo = vebhuk(conv, {
    analysis: { transcript_summary: 'Platform summary', call_successful: 'success', data_collection_results: {
      namerenie: { value: 'kandidat' }, itog: { value: 'perezvon' }, kratko: { value: 'Applicant asked for a callback tomorrow.' },
      imya: { value: 'Lena DEMO' }, soobshchenie: { value: 'Please call Lena back tomorrow morning about the HHA class.' } } },
  });
  await itog.handler(P.elevenlabs(telo));
  const zv = await st.getJSON(`zvonki/${conv}`);
  assert.equal(zv.namerenie, 'rabota', 'kandidat агента → rabota пульта');
  assert.equal(zv.namerenie_agenta, 'kandidat');
  assert.equal(zv.itog, 'perezvon');
  assert.equal(zv.kratko, 'Applicant asked for a callback tomorrow.');
  assert.equal(zv.soobshchenie, 'Please call Lena back tomorrow morning about the HHA class.');
  await itog.handler(P.elevenlabs(telo));   // повтор вебхука
  const zh = await P.zhurnal(st, '2026-09-30');
  const pisma = zh.filter((x) => x.chto === 'pismo_dry_run' && x.detali.klyuch === `soobshchenie:${conv}`);
  assert.equal(pisma.length, 1, 'одно письмо координатору');
  assert.deepEqual(pisma[0].detali.komu, ['coordinator@example.com']);
  assert.match(pisma[0].detali.text, /Please call Lena back/);
  await itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00008', { analysis: { data_collection_results: { namerenie: { value: 'spam' } } },
    transcript: [{ role: 'agent', message: 'Hi, this is the AI assistant.' }, { role: 'user', message: 'Buy my SEO services' }] })));
  assert.equal((await st.getJSON('zvonki/conv_test_itog_00008')).namerenie, 'drugoe');
});

test('агент не из linii.json — 200 и ничего не пишем', async () => {
  const r = await itog.handler(P.elevenlabs(vebhuk('conv_test_itog_00006', { agent_id: 'agent_chuzhoy',
    conversation_initiation_client_data: { dynamic_variables: {} }, metadata: {} })));
  assert.equal(r.statusCode, 200);
  assert.equal(P.otvet(r).pochemu, 'neizvestnyy_agent');
  assert.equal(await P.st().getJSON('zvonki/conv_test_itog_00006'), null);
});

test('секрет итога — только CARELINE_WEBHOOK_SECRET: имя секрета Веры (ELEVENLABS_WEBHOOK_SECRET) стенд не читает', async () => {
  const telo = vebhuk('conv_test_itog_00009');
  const bylo = process.env.CARELINE_WEBHOOK_SECRET;
  try {
    delete process.env.CARELINE_WEBHOOK_SECRET;
    process.env.ELEVENLABS_WEBHOOK_SECRET = P.EL_SEKRET;   // будто на стенд по ошибке залили переменную Веры
    assert.equal((await itog.handler(P.elevenlabs(telo))).statusCode, 401, 'без CARELINE_WEBHOOK_SECRET — отказ, даже с верной подписью');
    assert.equal(require('../lib/podpisi').elevenlabsPodpisVerna('{}', 't=1,v0=00').pochemu, 'секрет не задан');
    process.env.CARELINE_WEBHOOK_SECRET = P.EL_SEKRET;
    assert.equal((await itog.handler(P.elevenlabs(telo))).statusCode, 200);
  } finally {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    process.env.CARELINE_WEBHOOK_SECRET = bylo;
  }
});
