'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');
const kandidat = require('../netlify-functions/kandidat');
const semya = require('../netlify-functions/semya');
const vyzov = async (f, telo, klyuch) => P.otvet(await f.handler(P.instrument(telo, klyuch)));

test('кандидат: поля приведены к одному виду, статус new, согласие на SMS — в журнал согласий', async () => {
  const r = await vyzov(kandidat, {
    imya: '  Maria   Rodriguez DEMO ', telefon: '(718) 555-0142', email: 'Maria.Demo@Example.com', sertifikat: 'hha',
    rayon: 'Bensonhurst', zip: '11214-1234', transport: 'yes', grafik_dni: ['mon', 'Tuesday', 'sáb'], grafik_chasy: '8am-4pm',
    yazyki: ['English', 'es', 'Tagalog'], opyt_let: '3', pravo_na_rabotu: true, podhodit: true, sms_soglasie: true,
    yazyk: 'es', conversation_id: 'conv_test_kand_000001',
  });
  assert.equal(r.ok, true);
  assert.match(r.id, /^kand-20260930-[0-9a-f]{8}$/);
  assert.equal(r.soobshchenie, 'Guardado.');
  const st = P.st();
  const k = await st.getJSON(`kandidaty/${r.id}`);
  assert.equal(k.imya, 'Maria Rodriguez DEMO');
  assert.equal(k.telefon, '+17185550142');
  assert.equal(k.email, 'maria.demo@example.com');
  assert.equal(k.sertifikat, 'HHA');
  assert.equal(k.zip, '11214');
  assert.equal(k.transport, true);
  assert.deepEqual(k.grafik, { dni: ['mon', 'tue'], chasy: '8am-4pm' });
  assert.deepEqual(k.yazyki, ['en', 'es', 'tagalog']);
  assert.equal(k.opyt_let, 3);
  assert.equal(k.status, 'new');
  assert.equal(k.istochnik, 'call');
  assert.equal(k.created_at, '2026-09-30T09:00:00-04:00');
  assert.equal(k.soglasiya.sms, true);
  const s = await st.getJSON('soglasiya/+17185550142');
  assert.equal(s.sms, true);
  assert.equal(s.istochnik, 'call');
  assert.equal(s.istoriya.length, 1);
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.ok(zh.some((z) => z.chto === 'soglasie' && z.obekt === `kandidaty/${r.id}`));
  assert.ok(zh.some((z) => z.chto === 'kandidat_novyy'));
});

test('кандидат: повтор в том же разговоре и тот же телефон в другом — та же карточка', async () => {
  const a = await vyzov(kandidat, { imya: 'Anna DEMO', telefon: '+17185550143', sertifikat: 'PCA', podhodit: true, sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_kand_000002' });
  const b = await vyzov(kandidat, { imya: 'Anna DEMO', telefon: '+17185550143', sertifikat: 'PCA', podhodit: true, zip: '11229', sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_kand_000002' });
  const c = await vyzov(kandidat, { imya: 'Anna DEMO', telefon: '7185550143', sertifikat: 'HHA', podhodit: true, sms_soglasie: false, yazyk: 'ru', conversation_id: 'conv_test_kand_000003' });
  assert.equal(a.id, b.id);
  assert.equal(a.id, c.id);
  const k = await P.st().getJSON(`kandidaty/${a.id}`);
  assert.equal(k.zip, '11229', 'поле из второго вызова сохранилось');
  assert.equal(k.sertifikat, 'HHA');
  assert.equal(k.yazyk, 'ru');
});

test('кандидат: не прошёл требования → лист ожидания; нет телефона → просим повторить', async () => {
  const r = await vyzov(kandidat, { imya: 'Tom DEMO', telefon: '+17185550144', sertifikat: 'net', podhodit: false,
    prichina_otkaza: 'net_sertifikata', sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_kand_000004' });
  assert.equal(r.status, 'waitlist');
  const bez = await vyzov(kandidat, { imya: 'No Phone', telefon: '12', sertifikat: 'HHA', podhodit: true, yazyk: 'ru' });
  assert.equal(bez.ok, false);
  assert.match(bez.soobshchenie, /по цифрам/);
});

test('семья: оплата и срочность, часы в неделю, без медицинских полей; повтор — та же карточка', async () => {
  const telo = { imya: 'Olga DEMO', telefon: '+17185550145', rayon: 'Brighton Beach', zip: '11235', chasov_v_nedelyu: 20,
                 oplata: 'medicaid', srochnost: 'srochno', yazyk: 'ru', conversation_id: 'conv_test_sem_000001', diagnoz: 'нельзя' };
  const r = await vyzov(semya, telo);
  assert.equal(r.ok, true);
  assert.match(r.id, /^sem-/);
  const s = await P.st().getJSON(`semi/${r.id}`);
  assert.deepEqual(s.kontakt, { imya: 'Olga DEMO', telefon: '+17185550145' });
  assert.equal(s.chasy_v_nedelyu, 20);
  assert.equal(s.oplata, 'medicaid');
  assert.equal(s.srochnost, 'srochno');
  assert.equal(s.status, 'new');
  assert.equal(s.ocenka, null);
  assert.ok(!('diagnoz' in s), 'лишние поля не сохраняются');
  const povtor = await vyzov(semya, Object.assign({}, telo, { oplata: 'Long-term care insurance' }));
  assert.equal(povtor.id, r.id);
  assert.equal((await P.st().getJSON(`semi/${r.id}`)).oplata, 'ltc');
});

test('имя-заглушка: Caller, Unknown, N/A, пусто, Звонящий, Llamante… без учёта регистра; настоящие имена проходят', () => {
  const { imyaZaglushka } = require('../lib/kartochki');
  const zaglushki = ['Caller', 'caller', 'CALLER', 'Unknown', 'unknown caller', 'The Caller', 'N/A', 'n/a', 'NA', '', '   ', null,
    undefined, 'Звонящий', 'ЗВОНЯЩАЯ', 'Llamante', 'LLAMANTE', 'Persona que llama', 'Anónimo', 'Desconocido', 'Sin nombre',
    'Applicant', 'Candidate', 'No name', 'Not provided', 'Неизвестно', 'Без имени', 'Имя не указано', '{{system__caller_id}}',
    '+1 718 555 0142', 'Caller DEMO', 'DEMO', 'J', '[name]', 'Anonymous caller'];
  for (const z of zaglushki) assert.equal(imyaZaglushka(z), true, `заглушка: ${z}`);
  for (const i of ['Maria Rodriguez', 'Maria DEMO', 'Li Wu', 'Irina Petrova DEMO', "Anne-Marie O'Neil", 'José Núñez', 'Ирина Петрова', 'Mary Caller'])
    assert.equal(imyaZaglushka(i), false, `имя: ${i}`);
});

test('кандидат с именем-заглушкой — HTTP 200 {ok:false, net_imeni}, просьба назвать имя на языке звонящего; ничего не сохранено', async () => {
  const st = P.st();
  const kartDo = (await st.list('kandidaty/')).length;
  const sluchai = [['Caller', 'en', /first and last name/], ['Звонящий', 'ru', /имя и фамилия/], ['llamante', 'es', /nombre y apellido/],
    ['N/A', 'en', /spell it/], ['', 'es', /deletrear/], ['UNKNOWN', 'ru', /по буквам/]];
  for (const [imya, yazyk, re] of sluchai) {
    const r = await kandidat.handler(P.instrument({ imya, telefon: '+17185550146', sertifikat: 'net', podhodit: false,
      prichina_otkaza: 'net_sertifikata', sms_soglasie: false, yazyk, conversation_id: 'conv_test_zagl_000001' }));
    assert.equal(r.statusCode, 200);
    const b = P.otvet(r);
    assert.equal(b.ok, false, imya);
    assert.equal(b.kod, 'net_imeni');
    assert.match(b.soobshchenie, re);
    assert.ok(b.dalshe && !b.id);
  }
  assert.equal((await st.list('kandidaty/')).length, kartDo, 'новой карточки нет');
  assert.equal(await st.getJSON('indeks/telefon/kandidat/+17185550146'), null);
  assert.equal(await st.getJSON('razgovory/conv_test_zagl_000001'), null);
  assert.equal(await st.getJSON('soglasiya/+17185550146'), null);
  assert.ok((await P.zhurnal(st, '2026-09-30')).some((z) => z.chto === 'kandidat_bez_imeni'));
});

test('кандидат без вопросов отбора (нет sertifikat) — {ok:false, net_otbora}; после отбора — сохраняем, повтор без sertifikat — та же карточка', async () => {
  const st = P.st();
  const telo = { imya: 'Grace Thompson DEMO', telefon: '+17185550147', sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_otbor_000001' };
  const r = await vyzov(kandidat, telo);
  assert.equal(r.ok, false);
  assert.equal(r.kod, 'net_otbora');
  assert.match(r.soobshchenie, /couple of quick questions about your certificate and your schedule/);
  assert.match(r.dalshe, /only want to leave a message, do not call this again/);
  assert.match((await vyzov(kandidat, Object.assign({}, telo, { yazyk: 'ru' }))).soobshchenie, /о сертификате и о графике/);
  assert.match((await vyzov(kandidat, Object.assign({}, telo, { yazyk: 'es', sertifikat: '' }))).soobshchenie, /certificado y su horario/);
  assert.equal(await st.getJSON('indeks/telefon/kandidat/+17185550147'), null, 'ничего не сохранено');
  assert.ok((await P.zhurnal(st, '2026-09-30')).some((z) => z.chto === 'kandidat_bez_otbora'));

  const a = await vyzov(kandidat, Object.assign({}, telo, { sertifikat: 'HHA', podhodit: true }));
  assert.equal(a.ok, true);
  const b = await vyzov(kandidat, Object.assign({}, telo, { sms_soglasie: true, email: 'grace.demo@example.com' }));
  assert.equal(b.ok, true, 'второй вызов того же разговора без sertifikat — правка');
  assert.equal(b.id, a.id);
  const k = await st.getJSON(`kandidaty/${a.id}`);
  assert.equal(k.sertifikat, 'HHA', 'сертификат не потерялся');
  assert.equal(k.soglasiya.sms, true);
  assert.equal(k.email, 'grace.demo@example.com');
});

test('лист ожидания без sertifikat в теле — сертификат понятен по причине отказа (tolko_cna → CNA, net_sertifikata → net)', async () => {
  const st = P.st();
  const cna = await vyzov(kandidat, { imya: 'Nora DEMO', telefon: '+17185550148', podhodit: false, prichina_otkaza: 'tolko_cna',
    sms_soglasie: false, yazyk: 'en', conversation_id: 'conv_test_cna_0000001' });
  assert.equal(cna.ok, true);
  assert.equal(cna.status, 'waitlist');
  assert.equal((await st.getJSON(`kandidaty/${cna.id}`)).sertifikat, 'CNA');
  const net = await vyzov(kandidat, { imya: 'Omar DEMO', telefon: '+17185550149', podhodit: false, prichina_otkaza: 'net_sertifikata', sms_soglasie: false, yazyk: 'en' });
  assert.equal((await st.getJSON(`kandidaty/${net.id}`)).sertifikat, 'net');
});

test('семья с именем-заглушкой — {ok:false, net_imeni} на языке звонящего, ничего не сохранено', async () => {
  const r = await vyzov(semya, { imya: 'Unknown', telefon: '+17185550150', rayon: 'Midwood', oplata: 'private', srochnost: 'nedelya',
    yazyk: 'es', conversation_id: 'conv_test_sem_zagl_01' });
  assert.equal(r.ok, false);
  assert.equal(r.kod, 'net_imeni');
  assert.match(r.soobshchenie, /nombre y apellido/);
  assert.equal(await P.st().getJSON('indeks/telefon/semya/+17185550150'), null);
  assert.ok((await P.zhurnal(P.st(), '2026-09-30')).some((z) => z.chto === 'semya_bez_imeni'));
});

test('семья: согласие на SMS (необязательное поле) — в карточку и журнал согласий; повтор не теряет почту из записи', async () => {
  const st = P.st();
  const telo = { imya: 'Vera DEMO', telefon: '+17185550151', rayon: 'Astoria', zip: '11102', oplata: 'medicaid', srochnost: 'srochno',
    sms_soglasie: true, yazyk: 'en', conversation_id: 'conv_test_sem_sms_0001' };
  const r = await vyzov(semya, telo);
  assert.equal(r.ok, true);
  assert.equal((await st.getJSON('soglasiya/+17185550151')).sms, true);
  assert.equal((await st.getJSON(`semi/${r.id}`)).soglasiya.sms, true);
  await st.obnovit(`semi/${r.id}`, (x) => { x.kontakt.email = 'vera.demo@example.com'; return x; });   // так кладёт zapis
  const b = await vyzov(semya, Object.assign({}, telo, { sms_soglasie: undefined }));
  assert.equal(b.id, r.id);
  const k = await st.getJSON(`semi/${r.id}`);
  assert.equal(k.kontakt.email, 'vera.demo@example.com', 'почта из записи не потерялась');
  assert.equal(k.soglasiya.sms, true);
});
