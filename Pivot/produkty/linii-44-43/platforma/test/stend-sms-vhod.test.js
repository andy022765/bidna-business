'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');
const Z = require('../lib/care/zamena');
const otkaz = require('../netlify-functions/otkaz');
const smsVhod = require('../netlify-functions/sms-vhod');
const nastoyashchiyDvizhok = typeof Z.sleduyushcheeDeystvie === 'function';

const sms = (ot, tekst, sid) => smsVhod.handler(P.twilio('sms-vhod', { From: ot, To: P.NOMER_SIDELKI, Body: tekst, MessageSid: sid || 'SM' + Math.random().toString(16).slice(2) }));
const telefonSidelki = (id) => P.sidelkiAgentstva().find((s) => s.id === id).telefon;

async function novyyOtkaz(smenaId, sidelkaId, start) {
  const st = P.st();
  await st.setJSON(`smeny/${smenaId}`, { id: smenaId, klient_id: 'c-01', sidelka_id: sidelkaId, start, end: start.replace(/T(\d\d)/, (m, h) => 'T' + String(+h + 4).padStart(2, '0')), status: 'scheduled' });
  const r = P.otvet(await otkaz.handler(P.instrument({ caller_id: telefonSidelki(sidelkaId), data_smeny: start.slice(0, 10), prichina: 'bolezn' }, P.KLYUCHI.TEL_2)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.nuzhno_utochnit, false, 'смена найдена однозначно');
  return st.getJSON(`otkazy/otk-${smenaId}-${sidelkaId}`);
}

test.before(async () => { await P.zasejat(P.st()); });

test('разбор ответов: ДА / YES / SÍ / НЕТ / NO / STOP / START / «не выйду»', () => {
  const r = smsVhod._razobrat;
  assert.deepEqual(r('ДА'), { tip: 'da', kod: null });
  assert.deepEqual(r('yes 12'), { tip: 'da', kod: '12' });
  assert.equal(r('Sí').tip, 'da');
  assert.equal(r('si!').tip, 'da');
  assert.equal(r('Д').tip, 'da');
  assert.deepEqual(r('нет 34'), { tip: 'net', kod: '34' });
  assert.equal(r('No thanks').tip, 'net');
  assert.equal(r('STOP').tip, 'stop');
  assert.equal(r(' стоп ').tip, 'stop');
  assert.equal(r('Start').tip, 'start');
  assert.equal(r('No puedo ir mañana').tip, 'otkaz');
  assert.equal(r("I'm sick today, can't make it").tip, 'otkaz');
  assert.equal(r('Не выйду завтра').tip, 'otkaz');
  assert.equal(r('hello?').tip, 'neizvestno');
});

test('без подписи Twilio — 403; чужой номер линии — пустой ответ', async () => {
  const e = P.twilio('sms-vhod', { From: '+17185550112', To: P.NOMER_SIDELKI, Body: 'YES' }, { bezPodpisi: true });
  assert.equal((await smsVhod.handler(e)).statusCode, 403);
  const chuzhaya = await smsVhod.handler(P.twilio('sms-vhod', { From: '+17185550112', To: '+17185550199', Body: 'YES' }));
  assert.equal(chuzhaya.statusCode, 200);
  assert.match(chuzhaya.body, /<Response><\/Response>/);
});

test('первое «ДА» закрепляет смену, второе «ДА» — «смена занята», закрепление не меняется', { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' }, async () => {
  const st = P.st();
  const o = await novyyOtkaz('sm-10', 's-01', '2026-10-06T09:00:00-04:00');
  const [pervaya, vtoraya] = o.volny[0].sidelki;
  assert.ok(pervaya && vtoraya, 'в волне минимум двое');
  const r1 = await sms(telefonSidelki(pervaya), 'ДА');
  assert.match(r1.body, /<Response><\/Response>/);
  let x = await st.getJSON(o && `otkazy/${o.id}`);
  assert.equal(x.zakreplena_za, pervaya);
  const smena = await st.getJSON('smeny/sm-10');
  assert.equal(smena.sidelka_id, pervaya);
  assert.equal(smena.status, 'filled');
  assert.equal(smena.sidelka_id_do_otkaza, 's-01');
  await sms(telefonSidelki(vtoraya), 'YES');
  x = await st.getJSON(`otkazy/${o.id}`);
  assert.equal(x.zakreplena_za, pervaya, 'второе ДА не перебило закрепление');
  const zh = await P.zhurnal(st, '2026-09-30');
  const komu = (id) => zh.filter((z) => z.chto === 'sms_dry_run' && z.detali.komu === telefonSidelki(id)).map((z) => z.detali.tekst);
  assert.ok(komu(pervaya).some((t) => /подтверждено|confirmed/i.test(t)), 'победителю — подтверждение');
  assert.ok(komu(vtoraya).some((t) => /уже закрыта|already been filled/i.test(t)), 'второй — «смена занята»');
  assert.ok(zh.some((z) => z.chto === 'pismo_dry_run' && /shift filled/.test(z.detali.tema)), 'координатору — письмо');
});

test('два «ДА» в одну секунду — закреплена ровно одна сиделка', { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' }, async () => {
  const st = P.st();
  const o = await novyyOtkaz('sm-11', 's-02', '2026-10-04T09:00:00-04:00');
  const volna = o.volny[0].sidelki;
  assert.ok(volna.length >= 2);
  await Promise.all(volna.map((id) => sms(telefonSidelki(id), 'YES')));
  const x = await st.getJSON(`otkazy/${o.id}`);
  assert.ok(volna.includes(x.zakreplena_za));
  const da = x.otvety.filter((a) => a.otvet === 'da');
  assert.equal(new Set(da.map((a) => a.sidelka_id)).size, volna.length, 'все ответы записаны, опоздавшие тоже');
  const zh = await P.zhurnal(st, '2026-09-30');
  for (const id of volna.filter((v) => v !== x.zakreplena_za)) {
    assert.ok(zh.some((z) => z.chto === 'sms_dry_run' && z.detali.komu === telefonSidelki(id) && /уже закрыта|already been filled|already been taken|уже занята/i.test(z.detali.tekst)),
      `опоздавшей ${id} — «смена занята»`);
  }
  assert.equal((await st.getJSON(`zakrep/sm-11`)).sidelka_id, x.zakreplena_za);
  assert.equal((await st.getJSON('smeny/sm-11')).sidelka_id, x.zakreplena_za);
});

test('«НЕТ» — ответ записан, предложение закрыто', { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' }, async () => {
  const st = P.st();
  const o = await novyyOtkaz('sm-12', 's-04', '2026-10-05T15:00:00-04:00');
  const kto = o.volny[0].sidelki[0];
  await sms(telefonSidelki(kto), 'нет');
  const x = await st.getJSON(`otkazy/${o.id}`);
  assert.ok(x.otvety.some((a) => a.sidelka_id === kto && a.otvet === 'net'));
  assert.equal(x.zakreplena_za, null);
  const pred = await st.getJSON(`predlozheniya/${telefonSidelki(kto)}`);
  assert.equal(pred.spisok.find((e) => e.otkaz_id === o.id).zakryto, true, 'предложение закрыто');
});

test('STOP снимает согласие (и в карточке сиделки), START возвращает; нестандартное «СТОП» — одно подтверждение', async () => {
  const st = P.st();
  const tel = telefonSidelki('s-05');
  await sms(tel, 'STOP');
  assert.equal((await st.getJSON(`soglasiya/${tel}`)).sms, false);
  assert.equal((await st.getJSON(`soglasiya/${tel}`)).istochnik, 'sms_stop');
  assert.equal((await st.getJSON('sidelki/s-05')).sms_soglasie, false);
  const otpravka = require('../lib/otpravka');
  assert.equal((await otpravka.sms(st, P.klient(), { komu: tel, tekst: 'offer', soglasie: true })).pochemu, 'otpiska');
  await sms(tel, 'START');
  assert.equal((await st.getJSON(`soglasiya/${tel}`)).sms, true);
  assert.equal((await st.getJSON('sidelki/s-05')).sms_soglasie, true);

  const tel7 = telefonSidelki('s-07');
  await sms(tel7, 'СТОП', 'SMstop7');
  assert.equal((await st.getJSON(`soglasiya/${tel7}`)).sms, false);
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.equal(zh.filter((z) => z.chto === 'sms_dry_run' && z.detali.komu === tel7 && /unsubscribed/.test(z.detali.tekst)).length, 1);
  const s = await st.getJSON(`soglasiya/${tel}`);
  assert.deepEqual(s.istoriya.map((h) => h.sms), [false, true], 'история согласий сохранена');
});

test('«ДА» без открытых предложений — вежливый ответ, ничего не меняется', async () => {
  const st = P.st();
  const tel = telefonSidelki('s-06');   // без согласия на SMS — предложений ей не слали
  await sms(tel, 'YES', 'SMnooffer1');
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.ok(zh.some((z) => z.chto === 'sms_dry_run' && z.detali.komu === tel && /no open shift offer|нет открытых|открытых предложений/i.test(z.detali.tekst)));
});

test('отказ текстом: одна смена в ближайшие 36 часов — отказ записан (канал sms), замена ищется', { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' }, async () => {
  const st = P.st();
  await st.setJSON('smeny/sm-13', { id: 'sm-13', klient_id: 'c-01', sidelka_id: 's-06', start: '2026-09-30T20:00:00-04:00', end: '2026-09-30T23:00:00-04:00', status: 'scheduled' });
  await sms(telefonSidelki('s-06'), "Sorry, I'm sick and can't make it tonight");
  const o = await st.getJSON('otkazy/otk-sm-13-s-06');
  assert.ok(o, 'отказ записан');
  assert.equal(o.kanal, 'sms');
  assert.ok(o.volny.length === 1);
});
