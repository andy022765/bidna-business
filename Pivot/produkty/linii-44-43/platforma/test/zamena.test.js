'use strict';
// №44 CareLine, A3 — 20 сценариев отказа от смены. Движок lib/care/zamena.js (без модели).
// Приёмка из плана: 20 из 20 без двойного закрепления; незакрытая смена будит дежурного.
// Запуск: node --test test/zamena.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Z = require('../lib/care/zamena.js');

const DEMO = path.join(__dirname, '..', '..', 'care', 'demo-dannye');
const demo = (f) => JSON.parse(fs.readFileSync(path.join(DEMO, f), 'utf8'));

const T = (hhmm, den = '2026-10-07') => `${den}T${hhmm}:00-04:00`;
// Клиент в Брайтон-Бич: говорит по-русски, нужен PCA. Смена — среда 07.10, 08:00–12:00; отказалась S0.
const KLIENT = { id: 'K1', kod: 'BK-900', zip: '11235', yazyk: 'ru', trebovaniya_navyki: ['PCA'] };
const PRAVILA = { klienty: [KLIENT] };
const SMENA = { id: 'SM-T', klient_id: 'K1', sidelka_id: 'S0', start: T('08:00'), end: T('12:00'), kod_uslugi: 'T1019:U1', status: 'calloff' };
const sd = (id, dop = {}) => ({
  id, imya: `${id} (DEMO)`, telefon: '+13475550199', yazyki: ['ru'], navyki: ['PCA'], zip: '11235',
  maks_chasov_v_nedelyu: 40, chasov_na_etoy_nedele: 0, nadezhnost: 0.8, znaet_klientov: [], sms_soglasie: true, aktivna: true, ...dop,
});
const otkaz = (dop = {}) => ({
  id: 'OT-1', smena_id: SMENA.id, sidelka_id: 'S0', prichina: 'bolezn', soobshcheno: T('05:00'), kanal: 'sms',
  volny: [], otvety: [], zakreplena_za: null, zakreplena_v: null, eskalaciya_v: null, ...dop,
});
const ids = (reyting) => reyting.map((r) => r.sidelka_id);

// Дежурный цикл, как его крутит стенд: решение движка применяется к отказу.
function tik(o, seychas, reyting, smena = SMENA, pravila = PRAVILA) {
  const d = Z.sleduyushcheeDeystvie(o, smena, seychas, pravila, reyting);
  let n = o;
  if (d.sidelki.length) n = { ...n, volny: [...n.volny, { at: seychas, sidelki: d.sidelki }] };
  if (d.deystvie === 'eskalaciya') n = { ...n, eskalaciya_v: seychas };
  return { o: n, d };
}
// Инвариант приёмки: закреплена ровно та, что ответила «ДА», и только одна.
function odnoZakreplenie(o) {
  if (o.zakreplena_za) assert.ok(o.otvety.some((x) => x.sidelka_id === o.zakreplena_za && x.otvet === 'da'), 'закреплена без «ДА»');
}

test('01 демо-расписание: отказ в 05:00 → кандидаты по правилам, волна из 3, первое «ДА» закрепляет', () => {
  const sidelki = demo('sidelki.json');
  const klienty = demo('klienty.json');
  const smeny = demo('smeny.json');
  const pravila = { klienty };
  let smena = null;
  let reyting = null;
  for (const s of smeny.filter((x) => x.start >= '2026-10-07T08' && x.start < '2026-10-07T10')) {
    const r = Z.podobrat({ ...s, status: 'calloff' }, sidelki, smeny, pravila);
    if (r.length >= 3) { smena = { ...s, status: 'calloff' }; reyting = r; break; }
  }
  assert.ok(smena, 'в демо-данных нет утренней смены 07.10 с тремя кандидатами');
  const kl = klienty.find((k) => k.id === smena.klient_id);
  const a = Date.parse(smena.start);
  const b = Date.parse(smena.end);
  for (const r of reyting) {
    const s = sidelki.find((x) => x.id === r.sidelka_id);
    assert.ok(s.aktivna && s.sms_soglasie, `${s.id}: активна и согласна на SMS`);
    assert.notEqual(s.id, smena.sidelka_id);
    assert.ok(s.yazyki.includes(kl.yazyk), `${s.id}: язык клиента`);
    const nuzhen = kl.trebovaniya_navyki[0];
    assert.ok(s.navyki.includes(nuzhen) || (nuzhen === 'PCA' && s.navyki.includes('HHA')), `${s.id}: навык`);
    const svoi = smeny.filter((x) => x.sidelka_id === s.id && x.id !== smena.id);
    assert.ok(svoi.every((x) => Date.parse(x.end) + 30 * 60000 <= a || Date.parse(x.start) - 30 * 60000 >= b), `${s.id}: без пересечений`);
    const chasy = svoi.reduce((sum, x) => sum + (Date.parse(x.end) - Date.parse(x.start)) / 3600000, 0);
    assert.ok(chasy + (b - a) / 3600000 <= s.maks_chasov_v_nedelyu, `${s.id}: лимит часов`);
  }
  for (let i = 1; i < reyting.length; i++) assert.ok(reyting[i - 1].ball >= reyting[i].ball, 'рейтинг по убыванию балла');

  const o0 = otkaz({ smena_id: smena.id, sidelka_id: smena.sidelka_id });
  const { o: o1, d } = tik(o0, T('05:00'), reyting, smena, pravila);
  assert.equal(d.deystvie, 'volna');
  assert.deepEqual(d.sidelki, ids(reyting).slice(0, 3));
  const r = Z.prinyatOtvet(o1, d.sidelki[1], { otvet: 'YES', at: T('05:04') });
  assert.equal(r.rezultat, 'zakreplena');
  assert.equal(r.otkaz.zakreplena_za, d.sidelki[1]);
  assert.equal(r.otkaz.zakreplena_v, T('05:04'));
  assert.deepEqual([...r.uvedomit_zanyato].sort(), [d.sidelki[0], d.sidelki[2]].sort());
  assert.equal(o1.zakreplena_za, null, 'вход не изменён');
  assert.equal(Z.eskalaciyaNuzhna(r.otkaz, smena, T('05:05'), pravila, reyting), false);
  odnoZakreplenie(r.otkaz);
});

test('02 нет подходящих → дежурного будим сразу, даже за 10 часов до смены', () => {
  const kl = { ...KLIENT, id: 'K2', yazyk: 'zh' };
  const smena = { ...SMENA, klient_id: 'K2', start: T('18:00'), end: T('22:00') };
  const pravila = { klienty: [kl] };
  const p = Z.podobratPodrobno(smena, [sd('A'), sd('B', { yazyki: ['ru', 'en'] })], [], pravila);
  assert.deepEqual(p.reyting, []);
  assert.equal(p.otseyany.length, 2);
  assert.match(p.otseyany[0].prichiny.join(' '), /language \(ZH\)/);
  const o = otkaz();
  assert.equal(Z.eskalaciyaNuzhna(o, smena, T('08:00'), pravila, p.reyting), true);
  const { o: o1, d } = tik(o, T('08:00'), p.reyting, smena, pravila);
  assert.equal(d.deystvie, 'eskalaciya');
  assert.equal(d.kod, 'net_kandidatov');
  assert.deepEqual(d.sidelki, []);
  assert.equal(o1.eskalaciya_v, T('08:00'));
  assert.equal(tik(o1, T('08:30'), p.reyting, smena, pravila).d.deystvie, 'zhdat', 'повторно не будим');
});

test('03 все отказались → следующая волна без ожидания 15 минут, затем побудка дежурного', () => {
  const reyting = Z.podobrat(SMENA, [sd('A'), sd('B'), sd('C'), sd('D')], [], PRAVILA);
  assert.equal(reyting.length, 4);
  let { o, d } = tik(otkaz(), T('05:00'), reyting);
  assert.equal(d.deystvie, 'volna');
  assert.equal(d.sidelki.length, 3);
  d.sidelki.forEach((id, i) => { o = Z.prinyatOtvet(o, id, { otvet: 'НЕТ', at: T(`05:0${i + 1}`) }).otkaz; });
  ({ o, d } = tik(o, T('05:04'), reyting));
  assert.equal(d.deystvie, 'volna', 'все из волны сказали «НЕТ» — не ждём 15 минут');
  assert.deepEqual(d.sidelki, [ids(reyting)[3]]);
  o = Z.prinyatOtvet(o, d.sidelki[0], { otvet: 'no', at: T('05:06') }).otkaz;
  ({ o, d } = tik(o, T('05:07'), reyting));
  assert.equal(d.deystvie, 'eskalaciya');
  assert.equal(d.kod, 'vse_otkazali');
  assert.equal(o.zakreplena_za, null);
  assert.ok(Date.parse(o.eskalaciya_v) < Date.parse(SMENA.start), 'дежурный разбужен до начала смены');
});

test('04 никто не отвечает → следующая волна через 15 минут; кандидаты кончились — дежурный', () => {
  const reyting = Z.podobrat(SMENA, ['A', 'B', 'C', 'D', 'E'].map((id) => sd(id)), [], PRAVILA);
  let { o, d } = tik(otkaz(), T('05:00'), reyting);
  assert.deepEqual(d.sidelki, ids(reyting).slice(0, 3));
  ({ o, d } = tik(o, T('05:14'), reyting));
  assert.equal(d.deystvie, 'zhdat');
  assert.equal(d.do, T('05:15'));
  ({ o, d } = tik(o, T('05:15'), reyting));
  assert.equal(d.deystvie, 'volna');
  assert.deepEqual(d.sidelki, ids(reyting).slice(3));
  ({ o, d } = tik(o, T('05:29'), reyting));
  assert.equal(d.deystvie, 'zhdat');
  ({ o, d } = tik(o, T('05:30'), reyting));
  assert.equal(d.deystvie, 'eskalaciya');
  assert.equal(d.kod, 'nikto_ne_otvetil');
  ({ d } = tik(o, T('05:45'), reyting));
  assert.equal(d.deystvie, 'zhdat');
  assert.equal(d.kod, 'zhdem_koordinatora');
});

test('05 два «ДА» одновременно → закреплена одна, второй получает «смена занята»', async () => {
  // Хранилище с версией — как Netlify Blobs с условной записью onlyIfMatch.
  let znachenie = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B', 'C'] }] });
  let versiya = 1;
  const hranilishche = {
    prochitat: async () => ({ znachenie, versiya }),
    zapisat: async (novoe, v) => {
      if (v !== versiya) return false;
      znachenie = novoe;
      versiya += 1;
      return true;
    },
  };
  const [ra, rb] = await Promise.all([
    Z.primenitAtomarno(hranilishche, (o) => Z.prinyatOtvet(o, 'A', { otvet: 'YES', at: T('05:03') })),
    Z.primenitAtomarno(hranilishche, (o) => Z.prinyatOtvet(o, 'B', { otvet: 'ДА', at: T('05:03') }, { yazyk: 'ru' })),
  ]);
  assert.equal(ra.rezultat, 'zakreplena');
  assert.equal(ra.popytok, 1);
  assert.equal(rb.rezultat, 'zanyato');
  assert.equal(rb.popytok, 2, 'второй перечитал состояние после конфликта версий');
  assert.equal(rb.soobshchenie, 'Спасибо! Смена уже занята.');
  assert.equal(znachenie.zakreplena_za, 'A');
  assert.equal(znachenie.otvety.filter((x) => x.otvet === 'da').length, 2);
  odnoZakreplenie(znachenie);
  // Почему запись обязана быть условной: из одного снимка без версии обе копии «закрепили» бы смену.
  const snimok = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B'] }] });
  assert.equal(Z.prinyatOtvet(snimok, 'A', 'yes').otkaz.zakreplena_za, 'A');
  assert.equal(Z.prinyatOtvet(snimok, 'B', 'yes').otkaz.zakreplena_za, 'B');
});

test('06 «ДА» после закрепления → «смена занята», закрепление не меняется', () => {
  const o = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B', 'C'] }] });
  const r1 = Z.prinyatOtvet(o, 'A', { otvet: 'Да', at: T('05:02') });
  const r2 = Z.prinyatOtvet(r1.otkaz, 'C', { otvet: 'Sí', at: T('05:09') }, { yazyk: 'es' });
  assert.equal(r2.rezultat, 'zanyato');
  assert.equal(r2.soobshchenie, '¡Gracias! Este turno ya fue tomado.');
  assert.equal(r2.otkaz.zakreplena_za, 'A');
  assert.equal(r2.otkaz.zakreplena_v, T('05:02'));
  assert.deepEqual(r2.otkaz.otvety.map((x) => [x.sidelka_id, x.otvet]), [['A', 'da'], ['C', 'da']]);
  odnoZakreplenie(r2.otkaz);
});

test('07 повторное «ДА» закреплённой (дубль SMS) → ничего не меняется', () => {
  const o = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B'] }] });
  const r1 = Z.prinyatOtvet(o, 'A', { otvet: 'yes', at: T('05:02') });
  const r2 = Z.prinyatOtvet(r1.otkaz, 'A', { otvet: 'YES', at: T('05:02') });
  assert.equal(r2.rezultat, 'uzhe_vasha');
  assert.equal(r2.izmeneno, false);
  assert.equal(r2.otkaz, r1.otkaz);
  assert.equal(r2.otkaz.otvety.length, 1);
});

test('08 «ДА» от того, кому не предлагали, и от самой отказавшейся → не закрепляем', () => {
  const o = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B', 'C'] }] });
  for (const kto of ['Z', 'S0', null]) {
    const r = Z.prinyatOtvet(o, kto, { otvet: 'YES', at: T('05:02') });
    assert.equal(r.rezultat, 'ne_predlagalos', String(kto));
    assert.equal(r.izmeneno, false);
    assert.equal(r.otkaz.zakreplena_za, null);
  }
});

test('09 отказ за час до смены → дежурного будим сразу, первая волна уходит параллельно', () => {
  const reyting = Z.podobrat(SMENA, ['A', 'B', 'C', 'D', 'E'].map((id) => sd(id)), [], PRAVILA);
  const o0 = otkaz({ soobshcheno: T('07:00') });
  assert.equal(Z.eskalaciyaNuzhna(o0, SMENA, T('07:00'), PRAVILA), true);
  let { o, d } = tik(o0, T('07:00'), reyting);
  assert.equal(d.deystvie, 'eskalaciya');
  assert.equal(d.kod, 'malo_vremeni');
  assert.equal(d.min_do_nachala, 60);
  assert.deepEqual(d.sidelki, ids(reyting).slice(0, 3));
  ({ o, d } = tik(o, T('07:15'), reyting));
  assert.equal(d.deystvie, 'volna', 'после побудки волны идут дальше, пока смена не началась');
  const r = Z.prinyatOtvet(o, d.sidelki[0], { otvet: 'yes', at: T('07:20') });
  assert.equal(r.rezultat, 'zakreplena');
  odnoZakreplenie(r.otkaz);
  // порог — настройка агентства (имя из nastroyki.json стенда): за 30 минут — в 07:00 ещё не будим
  assert.equal(Z.eskalaciyaNuzhna(o0, SMENA, T('07:00'), { ...PRAVILA, eskalaciya_za_chasov: 0.5 }), false);
});

test('10 язык клиента: предлагаем только тем, кто говорит на языке клиента', () => {
  const sidelki = [sd('A'), sd('E', { yazyki: ['es', 'en'] }), sd('F', { yazyki: ['zh'] }), sd('G', { yazyki: ['RU', 'EN'] })];
  const p = Z.podobratPodrobno(SMENA, sidelki, [], PRAVILA);
  assert.deepEqual(ids(p.reyting).sort(), ['A', 'G']);
  assert.deepEqual(p.otseyany.map((x) => x.sidelka_id).sort(), ['E', 'F']);
  assert.ok(p.otseyany.every((x) => x.prichiny.some((t) => t.includes("client's language (RU)"))));
  // клиент по-английски (передан прямо в смене): испаноязычная с английским подходит, китаеязычная — нет
  const en = Z.podobrat({ ...SMENA, klient: { ...KLIENT, yazyk: 'en' } }, sidelki, [], {});
  assert.deepEqual(ids(en).sort(), ['E', 'G']);
});

test('11 лимит часов в неделю: 38 + 4 > 40 — нет; 36 + 4 = 40 — да; прошлая неделя не в счёт', () => {
  const sm = (id, kto, den, s, e) => ({ id, klient_id: 'KX', sidelka_id: kto, start: T(s, den), end: T(e, den), status: 'scheduled' });
  const smeny = [
    sm('i1', 'I', '2026-10-05', '08:00', '18:00'), sm('i2', 'I', '2026-10-06', '08:00', '18:00'),
    sm('i3', 'I', '2026-10-08', '08:00', '18:00'), sm('i4', 'I', '2026-10-09', '08:00', '16:00'),
    sm('j1', 'J', '2026-10-05', '08:00', '18:00'), sm('j2', 'J', '2026-10-06', '08:00', '18:00'),
    sm('j3', 'J', '2026-10-08', '08:00', '18:00'), sm('j4', 'J', '2026-10-09', '08:00', '14:00'),
    sm('k1', 'K', '2026-10-05', '08:00', '18:00'), sm('k2', 'K', '2026-10-06', '08:00', '18:00'),
    sm('k3', 'K', '2026-10-08', '08:00', '16:00'),
    sm('m1', 'M', '2026-09-28', '08:00', '18:00'), sm('m2', 'M', '2026-09-29', '08:00', '18:00'),
    sm('m3', 'M', '2026-09-30', '08:00', '18:00'), sm('m4', 'M', '2026-10-01', '08:00', '18:00'),
  ];
  const p = Z.podobratPodrobno(SMENA, [sd('I'), sd('J'), sd('K', { maks_chasov_v_nedelyu: 30 }), sd('M')], smeny, PRAVILA);
  assert.deepEqual(ids(p.reyting).sort(), ['J', 'M']);
  assert.match(p.otseyany.find((x) => x.sidelka_id === 'I').prichiny.join(), /38 \+ 4 > 40/);
  assert.match(p.otseyany.find((x) => x.sidelka_id === 'K').prichiny.join(), /28 \+ 4 > 30/);
  // без расписания лимит считается по полю chasov_na_etoy_nedele
  const bez = Z.podobrat(SMENA, [sd('L', { chasov_na_etoy_nedele: 38 }), sd('N', { chasov_na_etoy_nedele: 36 })], null, PRAVILA);
  assert.deepEqual(ids(bez), ['N']);
});

test('12 без согласия на SMS → нет в подборе и ни в одной волне', () => {
  const sidelki = [sd('A'), sd('F', { sms_soglasie: false, znaet_klientov: ['K1'], nadezhnost: 1 }), sd('H', { sms_soglasie: undefined }), sd('B')];
  const p = Z.podobratPodrobno(SMENA, sidelki, [], PRAVILA);
  assert.deepEqual(ids(p.reyting).sort(), ['A', 'B']);
  assert.deepEqual(p.otseyany.map((x) => [x.sidelka_id, x.prichiny[0]]), [['F', 'no SMS consent'], ['H', 'no SMS consent']]);
  let o = otkaz();
  for (const t of ['05:00', '05:15', '05:30']) o = tik(o, T(t), p.reyting).o;
  const predlozheno = o.volny.flatMap((v) => v.sidelki);
  assert.deepEqual(predlozheno.sort(), ['A', 'B']);
  assert.ok(o.eskalaciya_v, 'кончились согласные — дежурный разбужен');
});

test('13 неактивная сиделка — не предлагаем, даже лучшую по баллам', () => {
  const p = Z.podobratPodrobno(SMENA, [sd('A', { aktivna: false, znaet_klientov: ['K1'], nadezhnost: 1 }), sd('B', { nadezhnost: 0.6 })], [], PRAVILA);
  assert.deepEqual(ids(p.reyting), ['B']);
  assert.deepEqual(p.otseyany, [{ sidelka_id: 'A', prichiny: ['inactive'] }]);
});

test('14 навыки: клиенту HHA — PCA не подходит; клиенту PCA — HHA подходит (настройка агентства)', () => {
  const sidelki = [sd('P', { navyki: ['PCA'] }), sd('H', { navyki: ['HHA'] })];
  const p = Z.podobratPodrobno(SMENA, sidelki, [], { klienty: [{ ...KLIENT, trebovaniya_navyki: ['HHA'] }] });
  assert.deepEqual(ids(p.reyting), ['H']);
  assert.deepEqual(p.otseyany, [{ sidelka_id: 'P', prichiny: ['missing skill HHA'] }]);
  assert.deepEqual(ids(Z.podobrat(SMENA, sidelki, [], PRAVILA)).sort(), ['H', 'P']);
  assert.deepEqual(ids(Z.podobrat(SMENA, sidelki, [], { ...PRAVILA, zamenyaet: {} })), ['P']);
});

test('15 занятость: зазор 30 минут, ночная смена через полночь, отменённые смены не держат', () => {
  const sm = (id, kto, s, e, status = 'scheduled') => ({ id, klient_id: 'KX', sidelka_id: kto, start: s, end: e, status });
  const smeny = [
    sm('p1', 'P1', T('04:00'), T('07:30')),                 // кончается за 30 мин до начала — можно
    sm('p2', 'P2', T('04:00'), T('07:45')),                 // за 15 мин — нельзя
    sm('p3', 'P3', T('22:00', '2026-10-06'), T('07:40')),   // ночная со вторника на среду — нельзя
    sm('p4', 'P4', T('12:30'), T('16:00')),                 // начинается через 30 мин после конца — можно
    sm('p5', 'P5', T('12:20'), T('16:00')),                 // через 20 мин — нельзя
    sm('p6', 'P6', T('09:00'), T('13:00'), 'calloff'),      // от той смены сама отказалась — свободна
  ];
  const sidelki = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((id) => sd(id));
  const p = Z.podobratPodrobno(SMENA, sidelki, smeny, PRAVILA);
  assert.deepEqual(ids(p.reyting).sort(), ['P1', 'P4', 'P6']);
  assert.match(p.otseyany.find((x) => x.sidelka_id === 'P3').prichiny[0], /busy: shift p3 22:00–07:40/);
  assert.deepEqual(ids(Z.podobrat(SMENA, sidelki, smeny, { ...PRAVILA, bufer_min: 0 })).sort(), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
});

test('16 отказавшаяся и далёкие (> 25 км) не попадают; ZIP вне таблицы — без балла за близость', () => {
  const sidelki = [sd('S0'), sd('FAR', { zip: '11004' }), sd('UNK', { zip: '10001' }), sd('A')];
  const p = Z.podobratPodrobno(SMENA, sidelki, [], PRAVILA);
  assert.deepEqual(ids(p.reyting), ['A', 'UNK']);
  assert.deepEqual(p.otseyany.map((x) => x.sidelka_id), ['S0', 'FAR']);
  assert.equal(p.otseyany[0].prichiny[0], 'called off this shift');
  assert.match(p.otseyany[1].prichiny[0], /too far: 26\.6 km/);
  assert.match(p.reyting[1].prichiny[0], /distance unknown \(ZIP 10001/);
  assert.deepEqual(ids(Z.podobrat(SMENA, sidelki, [], { ...PRAVILA, maks_km: 30 })), ['A', 'FAR', 'UNK']);
  // вызывающий может исключить ещё кого-то (например, «клиент просил её не присылать»)
  assert.deepEqual(ids(Z.podobrat(SMENA, sidelki, [], { ...PRAVILA, isklyuchit: ['A'] })), ['UNK']);
  // отказалась и замена: первая отказавшаяся (sidelka_id_do_otkaza) смену обратно не получает
  assert.deepEqual(ids(Z.podobrat({ ...SMENA, sidelka_id: 'A', sidelka_id_do_otkaza: 'S0' }, sidelki, [], PRAVILA)), ['UNK']);
});

test('17 ранжирование: ближе и знает клиента — выше; веса из правил меняют порядок; ничья — по id', () => {
  const sidelki = [sd('A', { nadezhnost: 0.7 }), sd('B', { zip: '11229', znaet_klientov: ['K1'], nadezhnost: 0.9 }), sd('C', { zip: '11214', nadezhnost: 0.99 })];
  const r = Z.podobrat(SMENA, sidelki, [], PRAVILA);
  assert.deepEqual(ids(r), ['B', 'A', 'C']);
  assert.deepEqual(r.map((x) => x.ball), [93.2, 61, 60.1]);
  assert.equal(r[0].prichiny[0], '1.9 km from the client');
  assert.ok(r[0].prichiny.includes('knows the client'));
  const tolkoNadezhnost = Z.podobrat(SMENA, sidelki, [], { ...PRAVILA, vesa: { rasstoyanie: 0, znaet_klienta: 0, nadezhnost: 1 } });
  assert.deepEqual(ids(tolkoNadezhnost), ['C', 'B', 'A']);
  assert.deepEqual(ids(Z.podobrat(SMENA, [sd('S-10'), sd('S-2')], [], PRAVILA)), ['S-2', 'S-10']);
  assert.equal(Z.podobrat(SMENA, sidelki, [], { ...PRAVILA, yazyk: 'ru' })[0].prichiny[1], 'знает клиента');
  // без клиента смены движок не молчит, а падает: иначе подбор прошёл бы без языка и навыка
  assert.throws(() => Z.podobrat({ ...SMENA, klient_id: 'NET' }, sidelki, [], PRAVILA), /не найден клиент/);
});

test('18 волны: размер из правил, без повторов, без ответивших и отказавшейся', () => {
  const reyting = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'].map((id) => ({ sidelka_id: id, ball: 50, prichiny: [] }));
  let o = otkaz();
  const v1 = Z.sleduyushchayaVolna(o, reyting, PRAVILA);
  assert.deepEqual(v1, { sidelki: ['R1', 'R2', 'R3'], ostalos: 4, kod: 'volna' });
  o = { ...o, volny: [{ at: T('05:00'), sidelki: v1.sidelki }] };
  assert.deepEqual(Z.sleduyushchayaVolna(o, reyting, PRAVILA).sidelki, ['R4', 'R5', 'R6']);
  assert.deepEqual(Z.sleduyushchayaVolna(o, reyting, { volna: 2 }).sidelki, ['R4', 'R5']);
  const gryaznyy = [{ sidelka_id: 'S0' }, { sidelka_id: 'R4' }, { sidelka_id: 'R4' }, { sidelka_id: 'R5' }, { sidelka_id: 'R6' }, { sidelka_id: 'R7' }];
  const o2 = { ...o, otvety: [{ sidelka_id: 'R5', otvet: 'net', at: T('05:01') }] };
  assert.deepEqual(Z.sleduyushchayaVolna(o2, gryaznyy, PRAVILA).sidelki, ['R4', 'R6', 'R7']);
  o = { ...o, volny: [...o.volny, { at: T('05:15'), sidelki: ['R4', 'R5', 'R6'] }, { at: T('05:30'), sidelki: ['R7'] }] };
  assert.deepEqual(Z.sleduyushchayaVolna(o, reyting, PRAVILA), { sidelki: [], ostalos: 0, kod: 'kandidaty_ischerpany' });
  assert.equal(Z.sleduyushchayaVolna({ ...o, zakreplena_za: 'R2' }, reyting, PRAVILA).kod, 'zakryta');
});

test('19 «НЕТ» после «ДА» → координатору, закрепление не снимаем; непонятный ответ ничего не меняет; ДА/НЕТ на пяти языках', () => {
  const o = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B'] }] });
  const r1 = Z.prinyatOtvet(o, 'A', { otvet: 'ДА', at: T('05:02') });
  const r2 = Z.prinyatOtvet(r1.otkaz, 'A', { otvet: 'нет', at: T('05:20') });
  assert.equal(r2.rezultat, 'peredumala');
  assert.equal(r2.nuzhen_koordinator, true);
  assert.equal(r2.otkaz.zakreplena_za, 'A');
  const r3 = Z.prinyatOtvet(r1.otkaz, 'B', 'может быть');
  assert.equal(r3.rezultat, 'ne_ponyal');
  assert.equal(r3.izmeneno, false);
  assert.equal(r3.soobshchenie, 'Please reply YES or NO.');
  const n1 = Z.prinyatOtvet(o, 'B', { otvet: 'NO', at: T('05:03') });
  const n2 = Z.prinyatOtvet(n1.otkaz, 'B', { otvet: 'No', at: T('05:04') });
  assert.equal(n1.izmeneno, true);
  assert.equal(n2.izmeneno, false);
  for (const x of ['YES', 'yes!', 'Y', 'Да, могу', 'да', 'Sí', 'si', 'Wi', 'OUI', '好的', '可以', '是', 'da', 'OK']) assert.equal(Z.razobratOtvet(x), 'da', x);
  for (const x of ['NO', 'No puedo', 'нет', 'Не могу', 'Non', '不行', '不', 'net', 'N']) assert.equal(Z.razobratOtvet(x), 'net', x);
  for (const x of ['STOP', 'START', '', null, 'позвоните мне', '?']) assert.equal(Z.razobratOtvet(x), null, String(x));
});

test('20 закрытую и эскалированную не будим повторно; «ДА» после начала и «ДА» занятой — не закрепляем', () => {
  const zakryta = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A'] }], zakreplena_za: 'A', zakreplena_v: T('05:05'),
    otvety: [{ sidelka_id: 'A', otvet: 'da', at: T('05:05') }] });
  assert.equal(Z.eskalaciyaNuzhna(zakryta, SMENA, T('07:30'), PRAVILA, []), false);
  assert.equal(Z.sleduyushcheeDeystvie(zakryta, SMENA, T('07:30'), PRAVILA, []).deystvie, 'nichego');
  const eskalirovana = otkaz({ volny: [{ at: T('05:00'), sidelki: ['A', 'B'] }], eskalaciya_v: T('06:00') });
  assert.equal(Z.eskalaciyaNuzhna(eskalirovana, SMENA, T('07:30'), PRAVILA, []), false);
  const pozdno = Z.prinyatOtvet(eskalirovana, 'B', { otvet: 'YES', at: T('08:05') }, { smena: SMENA });
  assert.equal(pozdno.rezultat, 'pozdno');
  assert.equal(pozdno.otkaz.zakreplena_za, null);
  assert.equal(pozdno.nuzhen_koordinator, true);
  // с момента предложения A поставили на другую смену 09:00–13:00: перепроверка на момент «ДА»
  const smenyPosle = [{ id: 'X1', klient_id: 'KX', sidelka_id: 'A', start: T('09:00'), end: T('13:00'), status: 'scheduled' }];
  const ne = Z.prinyatOtvet(eskalirovana, 'A', { otvet: 'YES', at: T('06:10') },
    { smena: SMENA, sidelki: [sd('A')], smeny: smenyPosle, pravila: PRAVILA });
  assert.equal(ne.rezultat, 'ne_podhodit');
  assert.equal(ne.otkaz.zakreplena_za, null);
  assert.match(ne.prichiny[0], /busy: shift X1/);
  // сломанное время смены — будим человека, а не молчим
  assert.equal(Z.eskalaciyaNuzhna(otkaz(), { ...SMENA, start: 'не время' }, T('05:00'), PRAVILA), true);
});
