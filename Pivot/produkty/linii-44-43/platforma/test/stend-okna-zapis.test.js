'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');   // среда, 9:00 в Нью-Йорке
const kalendar = require('../lib/kalendar');
const H = require('../lib/hranilishche');
const okna = require('../netlify-functions/okna');
const zapis = require('../netlify-functions/zapis');
const kandidat = require('../netlify-functions/kandidat');
const semya = require('../netlify-functions/semya');

const KAL = 'kal-sobesedovanie@test';
let feyk;
function novyyKalendar() {
  feyk = kalendar.feykKalendar({
    [KAL]: { zanyato: [{ ot: '2026-09-30T11:00:00-04:00', do: '2026-09-30T12:00:00-04:00' }] },
    'kal-ocenka@test': {},
  });
  kalendar.ustanovitAdapter(feyk);
}
const vyzov = async (f, telo, klyuch) => P.otvet(await f.handler(P.instrument(telo, klyuch)));
const nashi = () => feyk.kalendari[KAL].sobytiya;

test('окна: два ближайших, занятое с запасом пропущено, текст на языке звонящего', async () => {
  novyyKalendar();
  const r = await vyzov(okna, { tip: 'sobesedovanie', yazyk: 'en' });
  assert.equal(r.ok, true);
  assert.equal(r.okna.length, 2);
  // Раньше 11:00 нельзя (не раньше чем через 2 ч); 11:00–12:00 занято, запас 10 мин съедает и 12:00.
  assert.deepEqual(r.okna.map((o) => o.start), ['2026-09-30T12:30:00-04:00', '2026-09-30T13:00:00-04:00']);
  assert.equal(r.okna[0].end, '2026-09-30T13:00:00-04:00');
  assert.equal(r.okna[0].tekst, 'Wednesday, September 30 at 12:30 PM');
  assert.match(r.soobshchenie, /The nearest options are Wednesday/);
  const es = await vyzov(okna, { tip: 'sobesedovanie', yazyk: 'es' });
  assert.equal(es.okna[0].tekst, 'miércoles 30 de septiembre a las 12:30 de la tarde');
  const ru = await vyzov(okna, { tip: 'sobesedovanie', yazyk: 'ru' });
  assert.equal(ru.okna[0].tekst, 'среда, 30 сентября, в 12:30');
});

test('окна: data_s — с этого дня; выходные пропускаются; оценка — свой календарь и часы', async () => {
  novyyKalendar();
  const r = await vyzov(okna, { tip: 'sobesedovanie', data_s: '2026-10-03', yazyk: 'en' });   // суббота
  assert.equal(r.okna[0].start, '2026-10-05T10:00:00-04:00');
  const oc = await vyzov(okna, { tip: 'ocenka', yazyk: 'en' });
  assert.equal(oc.okna[0].start, '2026-09-30T13:00:00-04:00', 'оценка: не раньше чем через 4 ч, с 10 до 16');
  assert.equal(Date.parse(oc.okna[0].end) - Date.parse(oc.okna[0].start), 3600e3);
});

test('окна: календарь молчит или не подключён — честный отказ, а не «свободного нет»', async () => {
  novyyKalendar();
  feyk.otkaz = 'zanyatost';
  const r = await vyzov(okna, { tip: 'sobesedovanie', yazyk: 'en' });
  assert.equal(r.ok, false);
  assert.match(r.soobshchenie, /calendar isn't responding/);
  assert.match(r.dalshe, /Do NOT name or invent a time/);
  feyk.otkaz = null;
  feyk.kalendari[KAL].oshibka = 'notFound';   // freebusy вернул ошибку по календарю при общем 200
  assert.equal((await vyzov(okna, { tip: 'sobesedovanie', yazyk: 'en' })).ok, false);
  assert.equal((await vyzov(okna, { tip: 'chto-to', yazyk: 'en' })).kod, 'net_tipa');
});

test('запись: событие + карточка + письмо (ключ по встрече), без второго события и письма при повторе', async () => {
  novyyKalendar();
  const conv = 'conv_test_zapis_000001';
  await vyzov(kandidat, { imya: 'Maria DEMO', telefon: '+17185550142', sertifikat: 'HHA', podhodit: true, sms_soglasie: true, yazyk: 'en', conversation_id: conv });
  const telo = { tip: 'sobesedovanie', start: '2026-09-30T12:30:00-04:00', imya: 'Maria DEMO', telefon: '+17185550142',
                 email: 'maria.demo@example.com', conversation_id: conv };
  const r = await vyzov(zapis, telo);
  assert.equal(r.ok, true);
  assert.ok(r.event_id);
  assert.equal(r.start_tekst, 'Wednesday, September 30 at 12:30 PM');
  assert.equal(r.pismo, 'dry_run');
  assert.doesNotMatch(r.soobshchenie, /email/, 'в холостом режиме письмо не обещаем');
  assert.equal(nashi().length, 1);
  assert.equal(nashi()[0].privatnoe.razgovor, conv);
  assert.match(nashi()[0].summary, /Interview · Maria DEMO \(DEMO\)/);

  const st = P.st();
  const rz = await st.getJSON(`razgovory/${conv}`);
  const kart = await st.getJSON(`kandidaty/${rz.kandidat_id}`);
  assert.equal(kart.status, 'booked');
  assert.equal(kart.sobesedovanie.event_id, r.event_id);
  assert.equal(kart.sobesedovanie.start, '2026-09-30T12:30:00-04:00');
  assert.ok(kart.sobesedovanie.zapisano_v);

  const povtor = await vyzov(zapis, telo);
  assert.equal(povtor.ok, true);
  assert.equal(povtor.povtor, true);
  assert.equal(povtor.event_id, r.event_id);
  assert.equal(nashi().length, 1, 'второго события нет');
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.equal(zh.filter((z) => z.chto === 'pismo_dry_run' && z.detali.klyuch === `zapis:brightside:${r.event_id}`).length, 1, 'одно письмо на встречу');
  assert.equal(zh.filter((z) => z.chto === 'sms_dry_run').length, 1, 'SMS по согласию — одно');
});

test('запись: другой звонящий на занятое окно — отказ; время не из окон — отказ', async () => {
  const r = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-09-30T12:30:00-04:00', imya: 'Other DEMO', telefon: '+17185550143', conversation_id: 'conv_test_drugoy_000002' });
  assert.equal(r.ok, false);
  assert.equal(r.kod, 'net_v_raspisanii');
  assert.match(r.soobshchenie, /isn't among the free ones/);
  const noch = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-01T03:00:00-04:00', imya: 'X DEMO', telefon: '+17185550144', conversation_id: 'conv_test_noch_000003' });
  assert.equal(noch.kod, 'net_v_raspisanii');
  const krivo = await vyzov(zapis, { tip: 'sobesedovanie', start: 'tomorrow at ten', imya: 'X', telefon: '+17185550144' });
  assert.equal(krivo.ok, false);
});

test('запись: два звонящих на одно окно одновременно — ровно одна встреча', async () => {
  novyyKalendar();
  const start = '2026-10-01T10:00:00-04:00';
  const rez = await Promise.all([1, 2, 3].map((i) => vyzov(zapis, { tip: 'sobesedovanie', start, imya: `Person${i} DEMO`,
    telefon: `+1718555015${i}`, conversation_id: `conv_test_gonka_00000${i}` })));
  assert.equal(rez.filter((r) => r.ok).length, 1);
  assert.equal(nashi().filter((e) => e.start === Date.parse(start)).length, 1);
  for (const r of rez.filter((x) => !x.ok)) assert.ok(['zanyato', 'net_v_raspisanii'].includes(r.kod));
});

test('запись: замок подвёл и занятость отстаёт — сверка с календарём оставляет одну встречу', async () => {
  novyyKalendar();
  feyk.lag = true;                                         // freebusy «не видит» свежие события
  const nastoyashchee = H.hranilishcheKlienta;
  H.hranilishcheKlienta = (id) => {                        // хранилище, чей замок всегда «наш» (сбой бэкенда)
    const s = nastoyashchee(id);
    return Object.assign({}, s, { zamok: async () => ({ nash: true }) });
  };
  try {
    const start = '2026-10-01T11:00:00-04:00';
    const rez = await Promise.all([1, 2].map((i) => vyzov(zapis, { tip: 'sobesedovanie', start, imya: `Race${i} DEMO`,
      telefon: `+1718555016${i}`, conversation_id: `conv_test_sboy_00000${i}` })));
    assert.equal(rez.filter((r) => r.ok).length, 1, 'одна запись прошла');
    assert.equal(rez.find((r) => !r.ok).kod, 'zanyato');
    assert.equal(nashi().filter((e) => e.start === Date.parse(start)).length, 1, 'в календаре одна встреча');
  } finally { H.hranilishcheKlienta = nastoyashchee; feyk.lag = false; }
});

test('запись: перенос в том же разговоре — новая встреча, старая удалена', async () => {
  novyyKalendar();
  const conv = 'conv_test_perenos_00001';
  const a = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-02T10:30:00-04:00', imya: 'Move DEMO', telefon: '+17185550170', conversation_id: conv });
  const b = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-02T14:00:00-04:00', imya: 'Move DEMO', telefon: '+17185550170', conversation_id: conv });
  assert.equal(b.ok, true);
  assert.equal(b.pereneseno, true);
  assert.match(b.soobshchenie, /moved your appointment/);
  assert.deepEqual(nashi().map((e) => e.id), [b.event_id]);
  assert.notEqual(a.event_id, b.event_id);
});

test('запись: календарь отказал при создании — «не записала», замок окна снят', async () => {
  novyyKalendar();
  feyk.otkaz = 'sozdat';
  const telo = { tip: 'sobesedovanie', start: '2026-10-02T10:00:00-04:00', imya: 'Fail DEMO', telefon: '+17185550171', conversation_id: 'conv_test_fail_000001' };
  const r = await vyzov(zapis, telo);
  assert.equal(r.ok, false);
  assert.match(r.dalshe, /Do NOT say it is booked/);
  feyk.otkaz = null;
  assert.equal((await vyzov(zapis, telo)).ok, true, 'после сбоя окно снова доступно');
});

test('запись: yazyk в теле — start_tekst, soobshchenie, письмо и SMS на языке звонящего (es, ru)', async () => {
  novyyKalendar();
  const st = P.st();
  const conv = 'conv_test_yazyk_00001';
  await vyzov(kandidat, { imya: 'Lucia DEMO', telefon: '+17185550172', sertifikat: 'PCA', podhodit: true, sms_soglasie: true, yazyk: 'en', conversation_id: conv });
  const r = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-05T10:00:00-04:00', imya: 'Lucia DEMO', telefon: '+17185550172',
    email: 'lucia.demo@example.com', yazyk: 'es', conversation_id: conv });
  assert.equal(r.ok, true);
  assert.equal(r.start_tekst, 'lunes 5 de octubre a las 10:00 de la mañana');
  assert.equal(r.soobshchenie, 'Queda agendado para el lunes 5 de octubre a las 10:00 de la mañana.');
  const zh = await P.zhurnal(st, '2026-09-30');
  const pismo = zh.find((z) => z.chto === 'pismo_dry_run' && z.detali.klyuch === `zapis:brightside:${r.event_id}`);
  assert.match(pismo.detali.text, /^Hola, Lucia DEMO:/);
  assert.match(pismo.detali.tema, /su cita el lunes 5 de octubre/);
  const sms = zh.find((z) => z.chto === 'sms_dry_run' && z.detali.klyuch === `zapis-sms:brightside:${r.event_id}`);
  assert.match(sms.detali.tekst, /su cita es el lun 5 oct, 10:00 a\. m\. Responda STOP/, 'без двойной точки после «a. m.»');
  const ru = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-06T10:00:00-04:00', imya: 'Pavel DEMO', telefon: '+17185550173',
    yazyk: 'ru', conversation_id: 'conv_test_yazyk_00002' });
  assert.equal(ru.start_tekst, 'вторник, 6 октября, в 10:00');
  assert.equal(ru.soobshchenie, 'Записала вас: вторник, 6 октября, в 10:00.');
  const oshibka = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-06T03:00:00-04:00', imya: 'Pavel DEMO', telefon: '+17185550173',
    yazyk: 'es', conversation_id: 'conv_test_yazyk_00002' });
  assert.equal(oshibka.ok, false);
  assert.match(oshibka.soobshchenie, /^Ese horario no está entre los libres/);
});

test('запись без yazyk — язык карточки этого разговора; без карточки — английский; имя-заглушка — имя из карточки', async () => {
  novyyKalendar();
  const conv = 'conv_test_yazyk_00003';
  await vyzov(kandidat, { imya: 'Olena DEMO', telefon: '+17185550174', sertifikat: 'HHA', podhodit: true, sms_soglasie: false, yazyk: 'ru', conversation_id: conv });
  const r = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-07T10:00:00-04:00', imya: 'Caller', telefon: '+17185550174', conversation_id: conv });
  assert.equal(r.ok, true);
  assert.equal(r.start_tekst, 'среда, 7 октября, в 10:00');
  assert.match(nashi().find((e) => e.id === r.event_id).summary, /Interview · Olena DEMO/);
  const en = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-07T11:00:00-04:00', imya: 'Ben DEMO', telefon: '+17185550175',
    conversation_id: 'conv_test_yazyk_00004' });
  assert.equal(en.start_tekst, 'Wednesday, October 7 at 11:00 AM');
  assert.equal(en.soobshchenie, "You're booked for Wednesday, October 7 at 11:00 AM.");
});

test('запись оценки: почта из записи ложится в карточку семьи (kontakt.email) — для напоминания письмом', async () => {
  novyyKalendar();
  const conv = 'conv_test_ocenka_mail1';
  const s = await vyzov(semya, { imya: 'Rita DEMO', telefon: '+17185550176', rayon: 'Midwood', zip: '11230', oplata: 'private',
    srochnost: 'nedelya', yazyk: 'en', conversation_id: conv });
  const r = await vyzov(zapis, { tip: 'ocenka', start: '2026-10-05T13:00:00-04:00', imya: 'Rita DEMO', telefon: '+17185550176',
    email: 'rita.demo@example.com', conversation_id: conv });
  assert.equal(r.ok, true);
  const k = await P.st().getJSON(`semi/${s.id}`);
  assert.equal(k.kontakt.email, 'rita.demo@example.com');
  assert.equal(k.kontakt.imya, 'Rita DEMO');
  assert.equal(k.ocenka.event_id, r.event_id);
  assert.equal(k.status, 'booked');
});
