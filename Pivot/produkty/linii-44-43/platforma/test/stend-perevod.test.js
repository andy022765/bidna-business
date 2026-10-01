'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T10:00:00-04:00');   // среда, 10:00 — часы офиса
const linii = require('../lib/linii');
const perevod = require('../netlify-functions/perevod');
const { metka } = require('../lib/podpisi');

const CALL = 'CA' + 'a'.repeat(32);
const qs = (o) => new URLSearchParams(o).toString();
const vyzov = async (telo, klyuch = P.KLYUCHI.TEL_1) => P.otvet(await perevod.handler(P.instrument(telo, klyuch)));
const m = (i, c = 'k', sekret = P.KLYUCHI.TEL_1) => metka(sekret, `perevod:${CALL}:${i}:${c}`);

function sChasami(chasy) {
  const n = P.nastroykiTest();
  n.brightside.perevod.chasy = chasy;
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
}
const vernut = () => linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() });
const OFIS = { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] };

test('инструмент в DRY_RUN: Twilio не трогаем, агент не обещает перевод, в журнале — куда перевели бы', async () => {
  const r = await vyzov({ call_sid: CALL, svodka: 'Maria, wants to reschedule', yazyk: 'en' });
  assert.equal(r.ok, false);
  assert.equal(r.dry_run, true);
  assert.match(r.dalshe, /Do NOT say you are transferring/);
  const zh = await P.zhurnal(P.st(), '2026-09-30');
  const z = zh.find((x) => x.chto === 'perevod_dry_run');
  assert.deepEqual(z.detali.komu, ['+17185550191', '+17185550192']);
  assert.equal(z.detali.cepochka, 'k');
});

test('вне часов офиса: линия найма — сообщение и перезвон; линия сиделок — дежурным (срочное)', async () => {
  sChasami(OFIS);
  P.vremya('2026-09-30T23:00:00-04:00');
  try {
    const naym = await vyzov({ call_sid: CALL, yazyk: 'es' });
    assert.equal(naym.kod, 'vne_chasov');
    assert.match(naym.soobshchenie, /no están disponibles/);
    const sidelki = await vyzov({ call_sid: CALL, yazyk: 'en', svodka: 'Caregiver locked out at client home' }, P.KLYUCHI.TEL_2);
    assert.equal(sidelki.dry_run, true);
    const zh = await P.zhurnal(P.st(), '2026-09-30');
    const z = zh.filter((x) => x.chto === 'perevod_dry_run').pop();
    assert.equal(z.detali.cepochka, 'd');
    assert.deepEqual(z.detali.komu, ['+17185550190'], 'ночью — цепочка дежурных');
  } finally { vernut(); P.vremya('2026-09-30T10:00:00-04:00'); }
});

test('без цепочки номеров — сообщение и перезвон', async () => {
  const n = P.nastroykiTest();
  n.brightside.perevod.cepochka = [];
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  try {
    const r = await vyzov({ call_sid: CALL, yazyk: 'ru' });
    assert.equal(r.kod, 'net_cepochki');
    assert.match(r.soobshchenie, /Координатор сейчас не может ответить/);
  } finally { vernut(); }
});

test('вживую (Twilio подменён): звонок на эту линию и в работе → TwiML «соединяю» + Dial 20 с + ширма', async () => {
  process.env.DRY_RUN = '0';
  let obnovlenie = null;
  const f = P.podmenitFetch((url, opts) => {
    if (opts.method === 'GET') return P.response(200, { sid: CALL, to: P.NOMER_NAYM, status: 'in-progress' });
    obnovlenie = new URLSearchParams(opts.body).get('Twiml');
    return P.response(200, { sid: CALL });
  });
  try {
    const r = await vyzov({ call_sid: CALL, svodka: 'Maria <b>DEMO</b>', yazyk: 'es', conversation_id: 'conv_test_perevod_0001' });
    assert.equal(r.ok, true);
    assert.equal(r.perevedeno, true);
    assert.equal(f.vyzovy.length, 2);
    assert.match(f.vyzovy[0].url, new RegExp(`/Calls/${CALL}\\.json$`));
    assert.match(obnovlenie, /<Say language="es-US" voice="Polly.Lupe">Le comunico con el coordinador, un momento.<\/Say>/);
    assert.match(obnovlenie, /<Dial timeout="20" callerId="\+17185550101" action="[^"]*shag=itog/);
    assert.match(obnovlenie, /<Number url="[^"]*shag=shirma[^"]*" method="POST">\+17185550191<\/Number>/);
    assert.doesNotMatch(obnovlenie, /<b>/, 'разметка из сводки не попадает в TwiML');
    assert.equal((await P.st().getJSON('razgovory/conv_test_perevod_0001')).perevod, true);
    const g = P.podmenitFetch(() => P.response(200, { sid: CALL, to: '+17185550199', status: 'in-progress' }));
    assert.equal((await vyzov({ call_sid: CALL, yazyk: 'en' })).kod, 'chuzhoy', 'звонок не на номер линии — отказ');
    const h = P.podmenitFetch(() => P.response(200, { sid: CALL, to: P.NOMER_NAYM, status: 'completed' }));
    assert.equal((await vyzov({ call_sid: CALL, yazyk: 'en' })).kod, 'ne_v_rabote');
    h.vernut(); g.vernut();
  } finally { f.vernut(); process.env.DRY_RUN = '1'; }
});

test('ширма: верная метка — сводка и «нажмите 1» на языке владельца; чужая или подменённая цепочка — отбой', async () => {
  const r = await perevod.handler(P.twilio('perevod', {}, { query: qs({ shag: 'shirma', l: P.NOMER_NAYM, p: CALL, i: '0', c: 'k', k: m(0), s: 'Maria DEMO wants to talk' }) }));
  assert.match(r.body, /<Gather numDigits="1" timeout="6"/);
  assert.match(r.body, /Call from the Brightside Home Care \(DEMO\) line\. Maria DEMO wants to talk\. Press 1 to accept\./);
  const chuzhaya = await perevod.handler(P.twilio('perevod', {}, { query: qs({ shag: 'shirma', l: P.NOMER_NAYM, p: CALL, i: '0', c: 'k', k: 'f'.repeat(32) }) }));
  assert.match(chuzhaya.body, /<Response><Hangup\/><\/Response>/);
  const podmena = await perevod.handler(P.twilio('perevod', {}, { query: qs({ shag: 'shirma', l: P.NOMER_NAYM, p: CALL, i: '0', c: 'd', k: m(0, 'k') }) }));
  assert.match(podmena.body, /<Hangup\/>/, 'метка привязана к цепочке');
});

test('нажал цифру — соединяем; нет цифры — отбой', async () => {
  const q = qs({ shag: 'prinyat', l: P.NOMER_NAYM, p: CALL, i: '0', c: 'k', k: m(0) });
  assert.match((await perevod.handler(P.twilio('perevod', { Digits: '1' }, { query: q }))).body, /<Response><\/Response>/);
  assert.match((await perevod.handler(P.twilio('perevod', { Digits: '' }, { query: q }))).body, /<Hangup\/>/);
});

test('итог: соединились — отбой; не взял — следующий в той же цепочке; цепочка кончилась — откат голосом линии', async () => {
  const itog = (i, k, polya, c = 'k') => perevod.handler(P.twilio('perevod', polya, { query: qs({ shag: 'itog', l: P.NOMER_NAYM, p: CALL, i: String(i), c, k, y: 'ru' }) }));
  assert.match((await itog(0, m(0), { DialBridged: 'true', DialCallStatus: 'completed' })).body, /<Response><Hangup\/><\/Response>/);
  const dalshe = await itog(0, m(0), { DialBridged: 'false', DialCallStatus: 'no-answer' });
  assert.match(dalshe.body, /<Number url="[^"]*shag=shirma[^"]*i=1[^"]*" method="POST">\+17185550192<\/Number>/);
  const konec = await itog(1, m(1), { DialBridged: 'false', DialCallStatus: 'no-answer' });
  assert.match(konec.body, /<Say language="ru-RU" voice="Polly.Tatyana">Сейчас не смогли ответить/);
  const bezMetki = await itog(0, 'f'.repeat(32), { DialBridged: 'false' });
  assert.doesNotMatch(bezMetki.body, /<Dial/, 'без метки номера цепочки наружу не отдаём');
  const dezh = await itog(0, m(0, 'd'), { DialBridged: 'false' }, 'd');
  assert.doesNotMatch(dezh.body, /<Dial/, 'у дежурных один номер — дальше откат');
});

test('побудка дежурного: нажал цифру — отказ помечен «принят»', async () => {
  const st = P.st();
  await st.setJSON('otkazy/otk-test-1', { id: 'otk-test-1', smena_id: 'sm-x', sidelka_id: 's-x', volny: [], otvety: [], eskalaciya_v: '2026-09-30T10:00:00-04:00' });
  const mb = metka(P.KLYUCHI.TEL_1, 'budit:otk-test-1:0');
  const q = qs({ shag: 'budit', l: P.NOMER_NAYM, o: 'otk-test-1', i: '0', m: mb });
  assert.match((await perevod.handler(P.twilio('perevod', {}, { query: q }))).body, /a shift is still unfilled/);
  const otv = await perevod.handler(P.twilio('perevod', { Digits: '1' }, { query: qs({ shag: 'budit-otvet', l: P.NOMER_NAYM, o: 'otk-test-1', i: '0', m: mb }) }));
  assert.match(otv.body, /marked as yours/);
  assert.equal((await st.getJSON('otkazy/otk-test-1')).eskalaciya.prinyal, '+17185550190');
});

test('режим номера-моста: без подписи или метки — 403; с ними — TwiML дозвона', async () => {
  const k = metka(P.KLYUCHI.TEL_1, `vhod-perevod:${P.NOMER_NAYM}`);
  const q = qs({ shag: 'vhod', l: P.NOMER_NAYM, k });
  const ok = await perevod.handler(P.twilio('perevod', { CallSid: CALL, From: '+17185550142', To: '+17185550150' }, { query: q }));
  assert.match(ok.body, /<Dial timeout="20"[^>]*><Number url="[^"]*shag=shirma/);
  const bez = await perevod.handler(P.twilio('perevod', { CallSid: CALL }, { query: q, bezPodpisi: true }));
  assert.equal(bez.statusCode, 403);
  const chuzhaya = await perevod.handler(P.twilio('perevod', { CallSid: CALL }, { query: qs({ shag: 'vhod', l: P.NOMER_NAYM, k: 'f'.repeat(32) }) }));
  assert.equal(chuzhaya.statusCode, 403);
});
