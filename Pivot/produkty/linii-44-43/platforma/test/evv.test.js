'use strict';
// №44 CareLine, A4 — проверка визитов EVV перед счётом. Движок lib/care/evv.js (без модели).
// Приёмка из плана: 30 из 30 подложенных ошибок найдено, 0 ложных срабатываний на чистой выгрузке.
// Запуск: node --test test/evv.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../lib/care/evv.js');

const DEMO = path.join(__dirname, '..', '..', 'care', 'demo-dannye');
const chitat = (f) => fs.readFileSync(path.join(DEMO, f), 'utf8');
const json = (f) => JSON.parse(chitat(f));
const avtorizacii = json('avtorizacii.json');
const smeny = json('smeny.json');
const klienty = json('klienty.json');
const ozhidaemye = json('oshibki-ozhidaemye.json');
const klyuch = (x) => `${x.vizit_id} ${x.pravilo}`;

test('грязная выгрузка NY: найдены все 30 подложенных ошибок, лишних нет', () => {
  const isk = E.proverit(E.vizityIzCsv(chitat('evv-s-oshibkami.csv')), avtorizacii, smeny, 'NY');
  const nado = ozhidaemye.oshibki.map(klyuch);
  assert.equal(nado.length, 30);
  const nashli = new Set(isk.map(klyuch));
  const najdeno = nado.filter((k) => nashli.has(k));
  assert.equal(najdeno.length, 30, `не найдены: ${nado.filter((k) => !nashli.has(k)).join('; ')}`);
  assert.deepEqual([...nashli].filter((k) => !nado.includes(k)), [], 'лишние срабатывания');
  assert.deepEqual(new Set(ozhidaemye.oshibki.map((o) => o.pravilo)), new Set(E.PRAVILA), 'подложены ошибки всех типов');
  for (const i of isk) {
    assert.ok(i.chto_ne_tak.length > 20 && i.kak_ispravit.length > 20, `${klyuch(i)}: есть что не так и как исправить`);
    assert.ok(['kritichno', 'preduprezhdenie'].includes(i.vazhnost), i.vazhnost);
    assert.ok(i.pravilo_tekst && i.vizit && 'data' in i.vizit, 'поля для пульта');
  }
});

test('чистая выгрузка NY: 0 ложных срабатываний', () => {
  assert.deepEqual(E.proverit(E.vizityIzCsv(chitat('evv-chistaya.csv')), avtorizacii, smeny, 'NY').map(klyuch), []);
  const r = E.proveritCsv(chitat('evv-chistaya.csv'), avtorizacii, smeny, 'NY', klienty);
  assert.equal(r.isklyucheniya.length, 0);
  assert.equal(r.svodka.propushcheno, 3, 'два пропущенных визита и удалённый дубль не проверяются');
  assert.equal(r.strok, 251);
});

test('демо-данные воспроизводимы: генератор с тем же seed даёт те же файлы', () => {
  const { sgenerirovat } = require(path.join(DEMO, 'generator.js'));
  const { fayly } = sgenerirovat();
  for (const [imya, soderzhimoe] of Object.entries(fayly)) assert.equal(chitat(imya), soderzhimoe, imya);
});

test('демо-данные: 45 сиделок, 60 клиентов, пометка DEMO, телефоны только 555-0100…0199', () => {
  const sidelki = json('sidelki.json');
  assert.equal(sidelki.length, 45);
  assert.equal(klienty.length, 60);
  for (const x of [...sidelki, ...klienty, ...smeny, ...avtorizacii]) assert.equal(x.demo, true);
  const telefony = [chitat('sidelki.json'), chitat('klienty.json'), chitat('avtorizacii.json')].join('\n').match(/\+1\d{10}/g);
  assert.ok(telefony.length >= 105);
  for (const t of telefony) assert.match(t, /^\+1(347|718)5550(1\d\d)$/);
  for (const t of chitat('evv-s-oshibkami.csv').match(/(?<=,)\d{10}(?=,)/g) || []) assert.match(t, /^(347|718)55501\d\d$/);
  assert.deepEqual([...new Set(sidelki.flatMap((s) => s.yazyki))].sort(), ['en', 'es', 'ht', 'ru', 'zh']);
  assert.ok(smeny.every((s) => s.start >= '2026-10-05' && s.start < '2026-10-12'));
  assert.ok(chitat('evv-s-oshibkami.csv').split('\n').slice(1).filter(Boolean).every((s) => s.includes('DEMO')));
});

// ── правила по одному: минимальная выгрузка, чтобы видеть, что каждое срабатывает само и не тянет других ──
const KOL = ['Visit ID', 'Member ID', 'Medicaid Number', 'Caregiver Code', 'Schedule ID', 'Procedure Code', 'Visit Date',
  'Schedule Start Time', 'Schedule End Time', 'Visit Start Time', 'Visit End Time', 'EVV Start Time', 'EVV End Time',
  'Clock-In Service Location Type', 'Clock-In Phone Number', 'Clock-In Latitude', 'Clock-In Longitude', 'Clock-In EVV Other Info',
  'Clock-Out Service Location Type', 'Clock-Out Phone Number', 'Clock-Out Latitude', 'Clock-Out Longitude', 'Clock-Out EVV Other Info',
  'Units Billed', 'Visit Edit Reason Code', 'Is Deletion', 'Missed Visit'];
const BAZA = {
  'Visit ID': 'V1', 'Member ID': 'K1', 'Medicaid Number': 'DEMO-1', 'Caregiver Code': 'C1', 'Schedule ID': 'S1',
  'Procedure Code': 'T1019:U1', 'Visit Date': '2026-10-07', 'Schedule Start Time': '2026-10-07 08:00', 'Schedule End Time': '2026-10-07 12:00',
  'Visit Start Time': '2026-10-07 08:00', 'Visit End Time': '2026-10-07 12:00', 'EVV Start Time': '2026-10-07 08:00', 'EVV End Time': '2026-10-07 12:00',
  'Clock-In Service Location Type': 'Home', 'Clock-In Latitude': '40.584220', 'Clock-In Longitude': '-73.943170',
  'Clock-Out Service Location Type': 'Home', 'Clock-Out Latitude': '40.584300', 'Clock-Out Longitude': '-73.943100',
  'Units Billed': '16', 'Is Deletion': 'N', 'Missed Visit': 'N',
};
const AVT = [{ id: 'A1', klient_id: 'K1', kod_uslugi: 'T1019:U1', s: '2026-10-01', po: '2026-12-31', edinic: 40, period: 'nedelya',
  mesto: { lat: 40.58422, lon: -73.94317, telefony: ['+17185550150'] } }];
const SM = [
  { id: 'S1', klient_id: 'K1', sidelka_id: 'C1', start: '2026-10-07T08:00:00-04:00', end: '2026-10-07T12:00:00-04:00' },
  { id: 'S2', klient_id: 'K1', sidelka_id: 'C1', start: '2026-10-08T08:00:00-04:00', end: '2026-10-08T12:00:00-04:00' },
];
const v = (dop) => ({ ...BAZA, ...dop });
const csv = (stroki) => [KOL.join(','), ...stroki.map((s) => KOL.map((k) => (s[k] == null ? '' : s[k])).join(','))].join('\n');
const najti = (stroki, { shtat = 'NY', avt = AVT, sm = SM } = {}) => E.proverit(E.vizityIzCsv(csv(stroki)), avt, sm, shtat).map(klyuch);

test('каждое из 17 правил срабатывает само по себе и не тянет за собой другие', () => {
  assert.deepEqual(najti([v({})]), [], 'базовый визит чистый');
  const na10_09 = { 'Visit Date': '2026-10-09', 'Schedule ID': '', 'Schedule Start Time': '', 'Schedule End Time': '',
    'Visit Start Time': '2026-10-09 08:00', 'Visit End Time': '2026-10-09 12:00', 'EVV Start Time': '2026-10-09 08:00', 'EVV End Time': '2026-10-09 12:00' };
  const sluchai = [
    ['NET_USLUGI', [v({ 'Procedure Code': '' })]],
    ['NET_POLUCHATELYA', [v({ 'Member ID': '', 'Medicaid Number': '' })]],
    ['NET_DATY', [v({ 'Visit Date': '13/45/2026' })]],
    ['NET_MESTA', [v({ 'Clock-In Latitude': '', 'Clock-In Longitude': '', 'Clock-In Service Location Type': '' })]],
    ['NET_ISPOLNITELYA', [v({ 'Caregiver Code': '' })]],
    ['NET_PRIHODA', [v({ 'Visit Start Time': '', 'EVV Start Time': '' })]],
    ['NET_UHODA', [v({ 'Visit End Time': '', 'EVV End Time': '' })]],
    ['UHOD_RANSHE_PRIHODA', [v({ 'Visit End Time': '2026-10-07 00:00', 'EVV End Time': '2026-10-07 00:00' })]],
    ['PRAVKA_BEZ_PRICHINY', [v({ 'EVV End Time': '' })]],
    ['MESTO_NE_SOVPADAET', [v({ 'Clock-Out Latitude': '40.600000' })]],
    ['EDINICY_BOLSHE_VREMENI', [v({ 'Units Billed': '17' })]],
    ['PREVYSHENIE_AVTORIZACII', [v({ 'Visit End Time': '2026-10-07 20:30', 'EVV End Time': '2026-10-07 20:30', 'Units Billed': '50' })]],
    ['KOD_NE_AVTORIZOVAN', [v({ 'Procedure Code': 'S5125' })]],
    ['VNE_DAT_AVTORIZACII', [v({})], { avt: [{ ...AVT[0], po: '2026-10-06' }] }],
    ['PERESECHENIE', [v({}), v({ 'Visit ID': 'V2', 'Visit Start Time': '2026-10-07 11:00', 'EVV Start Time': '2026-10-07 11:00',
      'Visit End Time': '2026-10-07 13:00', 'EVV End Time': '2026-10-07 13:00', 'Units Billed': '8' })], null, 'V2'],
    ['VNE_RASPISANIYA', [v(na10_09)]],
    ['NE_TA_SIDELKA', [v({ 'Caregiver Code': 'C2' })]],
  ];
  assert.equal(sluchai.length, E.PRAVILA.length);
  for (const [pravilo, stroki, opcii, vizit = 'V1'] of sluchai) {
    assert.deepEqual(najti(stroki, opcii || {}), [`${vizit} ${pravilo}`], pravilo);
  }
  // электронный звонок с телефона клиента — место подтверждено; с чужого — нет
  const zvonok = { 'Clock-In Latitude': '', 'Clock-In Longitude': '', 'Clock-In Phone Number': '7185550150' };
  assert.deepEqual(najti([v(zvonok)]), []);
  assert.deepEqual(najti([v({ ...zvonok, 'Clock-In Phone Number': '3475550101' })]), ['V1 MESTO_NE_SOVPADAET']);
  // уход у поликлиники с типом места Community — не ошибка; ручной уход с причиной — не ошибка
  assert.deepEqual(najti([v({ 'Clock-Out Latitude': '40.600000', 'Clock-Out Service Location Type': 'Community' })]), []);
  assert.deepEqual(najti([v({ 'EVV End Time': '', 'Clock-Out Latitude': '', 'Clock-Out Longitude': '', 'Visit Edit Reason Code': '110' })]), []);
  // пропущенный и удалённый визиты не проверяются
  assert.deepEqual(najti([v({ 'Missed Visit': 'Y', 'Visit Start Time': '', 'EVV Start Time': '', 'Visit End Time': '', 'EVV End Time': '' })]), []);
  assert.deepEqual(najti([v({}), v({ 'Visit ID': 'V2', 'Is Deletion': 'Y' })]), []);
});

test('NC: округление 8 минут и правка 02079, ручная правка — предупреждение, визит без расписания — критично, GPS обязателен', () => {
  const avtNC = [{ ...AVT[0], kod_uslugi: '99509:HB' }];
  const vizit68 = v({ 'Procedure Code': '99509 HB', 'Visit End Time': '2026-10-07 09:08', 'EVV End Time': '2026-10-07 09:08', 'Units Billed': '5' });
  assert.deepEqual(najti([vizit68], { shtat: 'NC', avt: avtNC }), [], '68 минут в NC — 5 единиц');
  assert.deepEqual(najti([vizit68], { shtat: 'NY', avt: avtNC }), ['V1 EDINICY_BOLSHE_VREMENI'], 'в NY — только 4 целых');
  const lishnie = E.proverit(E.vizityIzCsv(csv([v({ 'Procedure Code': '99509:HB', 'Visit End Time': '2026-10-07 09:07', 'EVV End Time': '2026-10-07 09:07', 'Units Billed': '5' })])), avtNC, SM, 'NC');
  assert.deepEqual(lishnie.map(klyuch), ['V1 EDINICY_BOLSHE_VREMENI']);
  assert.match(lishnie[0].kak_ispravit, /02079/);
  const vazhnost = (stroki, shtat) => E.proverit(E.vizityIzCsv(csv(stroki)), AVT, SM, shtat).map((i) => `${i.pravilo}:${i.vazhnost}`);
  assert.deepEqual(vazhnost([v({ 'EVV End Time': '' })], 'NY'), ['PRAVKA_BEZ_PRICHINY:kritichno']);
  assert.deepEqual(vazhnost([v({ 'EVV End Time': '' })], 'NC'), ['PRAVKA_BEZ_PRICHINY:preduprezhdenie']);
  const bezSmeny = { 'Schedule ID': '', 'Visit Date': '2026-10-09', 'Visit Start Time': '2026-10-09 08:00', 'Visit End Time': '2026-10-09 12:00',
    'EVV Start Time': '2026-10-09 08:00', 'EVV End Time': '2026-10-09 12:00' };
  assert.deepEqual(vazhnost([v(bezSmeny)], 'NY'), ['VNE_RASPISANIYA:preduprezhdenie']);
  assert.deepEqual(vazhnost([v(bezSmeny)], 'NC'), ['VNE_RASPISANIYA:kritichno']);
  // только тип места Home без GPS: в NY допустимо (FAQ NYSDOH), в NC — нет
  const tolkoTip = { 'Clock-In Latitude': '', 'Clock-In Longitude': '' };
  assert.deepEqual(najti([v(tolkoTip)], { shtat: 'NY' }), []);
  assert.deepEqual(najti([v(tolkoTip)], { shtat: 'NC' }), ['V1 NET_MESTA']);
  // визит Home Health в NC — 1 визит = 1 единица
  const avtRC = [{ ...AVT[0], kod_uslugi: 'RC570' }];
  assert.deepEqual(najti([v({ 'Procedure Code': 'RC570', 'Units Billed': '1' })], { shtat: 'NC', avt: avtRC }), []);
  assert.deepEqual(najti([v({ 'Procedure Code': 'RC570', 'Units Billed': '2' })], { shtat: 'NC', avt: avtRC }), ['V1 EDINICY_BOLSHE_VREMENI']);
  assert.throws(() => E.proverit([], AVT, SM, 'TX'), /нет правил для штата TX/);
});

test('разбор выгрузки: BOM, CRLF, «;», кавычки, AM/PM, MM/DD/YYYY, синонимы колонок, коды с модификатором', () => {
  const tekst = '﻿"Visit ID";"Patient ID";"Caregiver ID";"Service Code";"Modifier";"Date of Service";"Call In Time";"Call Out Time";'
    + '"Call In Phone";"Call Out Phone";"Billed Units";"Notes"\r\n'
    + 'V9;K1;C1;T1019;U1;10/07/2026;10/07/2026 08:00 AM;10/07/2026 12:00 PM;(718) 555-0150;718-555-0150;16;"DEMO; ""quoted"""\r\n';
  const r = E.razobratVygruzku(tekst);
  const [x] = r.vizity;
  assert.equal(r.strok, 1);
  assert.equal(x.vizit_id, 'V9');
  assert.equal(x.klient_id, 'K1');
  assert.equal(x.kod_uslugi, 'T1019:U1');
  assert.equal(x.data, '2026-10-07');
  assert.equal(x.prihod.vremya, '2026-10-07T08:00:00-04:00');
  assert.equal(x.uhod.vremya, '2026-10-07T12:00:00-04:00');
  assert.equal(x.prihod.telefon, '+17185550150');
  assert.ok(r.kolonki.net.includes('smena_id'));
  // Call In/Out — электронное время: не ручная правка; звонок с телефона клиента — место подтверждено
  assert.deepEqual(E.proverit([x], AVT, SM, 'NY').map(klyuch), []);
  for (const [s, ozhid] of [['T1019 U1', 'T1019:U1'], ['t1019u1', 'T1019:U1'], ['99509-HB', '99509:HB'], ['S5125', 'S5125'], ['RC570', 'RC570']]) {
    assert.equal(E.kanonKod(s), ozhid, s);
  }
  // строки CSV объектами и текст CSV целиком движок принимает сам
  assert.deepEqual(E.proverit([{ ...BAZA }], AVT, SM, 'NY'), []);
  assert.deepEqual(E.proverit(csv([v({ 'Units Billed': '17' })]), AVT, SM, 'NY').map(klyuch), ['V1 EDINICY_BOLSHE_VREMENI']);
  // в выгрузке нет колонок места вовсе — место не проверяем, а не метим каждый визит
  const bezMesta = 'Visit ID,Member ID,Caregiver Code,Procedure Code,Visit Start Time,Visit End Time,Units Billed\n'
    + 'V1,K1,C1,T1019:U1,2026-10-07 08:00,2026-10-07 12:00,16\n';
  assert.deepEqual(E.proverit(bezMesta, AVT, SM, 'NY').map(klyuch), []);
});

test('тексты по-русски для нашего пульта; адрес из справочника klienty (5-й аргумент) даёт тот же результат', () => {
  const vizity = E.vizityIzCsv(chitat('evv-s-oshibkami.csv'));
  const a = E.proverit(vizity, avtorizacii, smeny, 'NY');
  const b = E.proverit(vizity, avtorizacii, smeny, 'NY', klienty);
  assert.deepEqual(b.map(klyuch), a.map(klyuch));
  assert.ok(b.filter((i) => i.vizit.klient_id).every((i) => /^(BK|QN)-\d{3}$/.test(i.vizit.klient_kod)), 'код клиента BK-/QN- для пульта');
  const ru = E.proverit(vizity, avtorizacii, smeny, { kod: 'NY', yazyk: 'ru' });
  assert.equal(ru.length, 30);
  assert.ok(ru.every((i) => /[а-яё]/i.test(i.chto_ne_tak) && /[а-яё]/i.test(i.kak_ispravit)));
  const bezRaspisaniya = E.proveritPodrobno(vizity, avtorizacii, null, 'NY');
  assert.ok(bezRaspisaniya.svodka.zamechaniya.includes('raspisanie_ne_peredano'));
  assert.equal(bezRaspisaniya.isklyucheniya.filter((i) => ['VNE_RASPISANIYA', 'NE_TA_SIDELKA'].includes(i.pravilo)).length, 0);
});
