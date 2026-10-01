'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');
const otpravka = require('../lib/otpravka');
const DEN = '2026-09-30';

const kolvo = (zh, chto) => zh.filter((z) => z.chto === chto).length;

test('DRY_RUN по умолчанию: письмо не уходит, в журнале — что ушло бы (и сеть не тронута)', async () => {
  delete process.env.DRY_RUN;
  assert.equal(otpravka.suhoy(), true);
  const st = P.st();
  const r = await otpravka.pismo(st, P.klient(), { komu: 'maria.demo@example.com', tema: 'T', text: 'Hello', html: '<p>Hello</p>' });
  assert.deepEqual([r.ok, r.dry_run], [true, true]);
  const zh = await P.zhurnal(st, DEN);
  const z = zh.find((x) => x.chto === 'pismo_dry_run');
  assert.ok(z, 'строка в журнале есть');
  assert.deepEqual(z.detali.komu, ['maria.demo@example.com']);
  assert.match(z.detali.ot, /не задан/);
  assert.equal(z.detali.text, 'Hello');
  process.env.DRY_RUN = '1';
});

test('ключ дублей: второе письмо с тем же ключом не уходит', async () => {
  const st = P.st();
  const a = await otpravka.pismo(st, P.klient(), { komu: ['a@example.com'], tema: 'T', text: 'x', klyuchDubley: 'zapis:brightside:evt1' });
  const b = await otpravka.pismo(st, P.klient(), { komu: ['a@example.com'], tema: 'T', text: 'x', klyuchDubley: 'zapis:brightside:evt1' });
  assert.equal(a.dry_run, true);
  assert.equal(b.uzhe, true);
  const zh = await P.zhurnal(st, DEN);
  assert.equal(zh.filter((x) => x.chto === 'pismo_dry_run' && x.detali.klyuch === 'zapis:brightside:evt1').length, 1);
  assert.ok(kolvo(zh, 'pismo_dubl_propushcheno') >= 1);
});

test('потолок писем в сутки — свой у клиента', async () => {
  const st = P.st();
  const k = Object.assign({}, P.klient(), { limity: { pisem_v_sutki: 3 } });
  const bylo = (await st.getJSON(`schetchiki/${DEN}`) || {}).pisem || 0;
  const rez = [];
  for (let i = 0; i < 4 - bylo + 1; i++) rez.push(await otpravka.pismo(st, k, { komu: ['b@example.com'], tema: 'T' + i, text: 'x' }));
  assert.equal(rez[rez.length - 1].pochemu, 'potolok');
});

test('без адреса и с кривым адресом — не отправляем', async () => {
  const st = P.st();
  assert.equal((await otpravka.pismo(st, P.klient(), { komu: 'not-an-email', tema: 'T', text: 'x' })).pochemu, 'net_adresa');
});

test('DRY_RUN=0 без отправителя (решение Андрея не принято) — не отправляем и сеть не трогаем', async () => {
  process.env.DRY_RUN = '0';
  process.env.RESEND_API_KEY = 're_test';
  try {
    const r = await otpravka.pismo(P.st(), P.klient(), { komu: ['c@example.com'], tema: 'T', text: 'x' });
    assert.equal(r.pochemu, 'net_otpravitelya');
  } finally { process.env.DRY_RUN = '1'; delete process.env.RESEND_API_KEY; }
});

test('DRY_RUN=0 с отправителем: Resend с Idempotency-Key (ответ Resend подменён)', async () => {
  process.env.DRY_RUN = '0';
  process.env.RESEND_API_KEY = 're_test';
  const f = P.podmenitFetch(() => P.response(200, { id: 'email_1' }));
  try {
    const k = Object.assign({}, P.klient(), { pisma: { ot: 'Brightside (DEMO) <demo@example.com>', otvet: 'office@example.com' } });
    const r = await otpravka.pismo(P.st(), k, { komu: ['d@example.com'], tema: 'Тема', text: 'x', html: '<p>x</p>', klyuchDubley: 'k-live-1' });
    assert.deepEqual([r.ok, r.id], [true, 'email_1']);
    assert.equal(f.vyzovy.length, 1);
    assert.equal(f.vyzovy[0].url, 'https://api.resend.com/emails');
    assert.match(f.vyzovy[0].opts.headers['Idempotency-Key'], /^[0-9a-f]{64}$/);
    const telo = JSON.parse(f.vyzovy[0].opts.body);
    assert.deepEqual(telo.to, ['d@example.com']);
    assert.deepEqual(telo.reply_to, ['office@example.com']);
  } finally { f.vernut(); process.env.DRY_RUN = '1'; delete process.env.RESEND_API_KEY; }
});

test('SMS: без согласия — нет; с согласием — в журнал; после STOP — нет даже с согласием карточки', async () => {
  const st = P.st();
  const k = P.klient();
  assert.equal((await otpravka.sms(st, k, { komu: '+17185550131', tekst: 'x' })).pochemu, 'net_soglasiya');
  const r = await otpravka.sms(st, k, { komu: '+17185550131', tekst: 'Offer', soglasie: true });
  assert.equal(r.dry_run, true);
  const zh = await P.zhurnal(st, DEN);
  const z = zh.find((x) => x.chto === 'sms_dry_run' && x.detali.komu === '+17185550131');
  assert.equal(z.detali.ot, P.NOMER_SIDELKI);
  assert.equal(z.detali.tekst, 'Offer');
  await st.setJSON('soglasiya/+17185550131', { telefon: '+17185550131', sms: false });
  assert.equal((await otpravka.sms(st, k, { komu: '+17185550131', tekst: 'x', soglasie: true })).pochemu, 'otpiska');
  assert.equal((await otpravka.sms(st, k, { komu: '+17185550131', tekst: 'x', otvetNaVhodyashchee: true })).pochemu, 'otpiska');
  assert.equal((await otpravka.sms(st, k, { komu: '+17185550131', tekst: 'You are unsubscribed', podtverzhdenieOtpiski: true })).ok, true);
});

test('исходящий звонок в DRY_RUN — только журнал', async () => {
  const st = P.st();
  const r = await otpravka.zvonok(st, P.klient(), { ot: P.NOMER_SIDELKI, komu: '+17185550190', url: 'https://x/y', opisanie: 'побудка' });
  assert.equal(r.dry_run, true);
  const zh = await P.zhurnal(st, DEN);
  assert.ok(zh.some((x) => x.chto === 'zvonok_dry_run' && x.detali.komu === '+17185550190'));
});

test('исходящие звонки: суточный потолок клиента (limity.ishodyashchih_v_sutki), считается и в DRY_RUN; ключ дублей не залипает', async () => {
  const st = P.st();
  const bylo = ((await st.getJSON(`schetchiki/${DEN}`)) || {}).ishodyashchih || 0;
  assert.ok(bylo >= 1, 'прошлый тест уже посчитал холостой звонок');
  const k = Object.assign({}, P.klient(), { limity: { ishodyashchih_v_sutki: bylo + 1 } });
  const a = await otpravka.zvonok(st, k, { ot: P.NOMER_SIDELKI, komu: '+17185550190', url: 'https://x/y', klyuchDubley: 'cap-1', opisanie: 'побудка' });
  assert.equal(a.dry_run, true, 'до потолка — звонок (в журнал)');
  const b = await otpravka.zvonok(st, k, { ot: P.NOMER_SIDELKI, komu: '+17185550190', url: 'https://x/y', klyuchDubley: 'cap-2', opisanie: 'побудка' });
  assert.deepEqual([b.ok, b.pochemu], [false, 'potolok']);
  const zh = await P.zhurnal(st, DEN);
  assert.ok(zh.some((x) => x.chto === 'zvonok_potolok' && x.detali.limit === bylo + 1));
  assert.equal(((await st.getJSON(`schetchiki/${DEN}`)) || {}).ishodyashchih, bylo + 1, 'отказ по потолку счётчик не двигает');
  const k2 = Object.assign({}, P.klient(), { limity: { ishodyashchih_v_sutki: bylo + 5 } });
  const c = await otpravka.zvonok(st, k2, { ot: P.NOMER_SIDELKI, komu: '+17185550190', url: 'https://x/y', klyuchDubley: 'cap-2', opisanie: 'побудка' });
  assert.equal(c.dry_run, true, 'после отказа по потолку тот же ключ дублей свободен');
  assert.equal(require('../nastroyki.json').brightside.limity.ishodyashchih_v_sutki, 10);
});

test('исходящий звонок вживую: Twilio отказал — счётчик и ключ дублей откатываются (ответ Twilio подменён)', async () => {
  const st = P.st();
  process.env.DRY_RUN = '0';
  const f = P.podmenitFetch(() => P.response(500, { message: 'test' }));
  try {
    const bylo = ((await st.getJSON(`schetchiki/${DEN}`)) || {}).ishodyashchih || 0;
    const k = Object.assign({}, P.klient(), { limity: { ishodyashchih_v_sutki: 50 } });
    const r = await otpravka.zvonok(st, k, { ot: P.NOMER_SIDELKI, komu: '+17185550190', url: 'https://x/y', klyuchDubley: 'live-1' });
    assert.deepEqual([r.ok, r.pochemu], [false, 'twilio']);
    assert.equal(f.vyzovy.length, 1);
    assert.match(f.vyzovy[0].url, /\/Calls\.json$/);
    assert.equal(((await st.getJSON(`schetchiki/${DEN}`)) || {}).ishodyashchih, bylo, 'сбой не съел потолок');
  } finally { f.vernut(); process.env.DRY_RUN = '1'; }
});

test('побудка дежурного упёрлась в потолок исходящих — письмо координатору вместо звонка', async () => {
  const st = P.st();
  const O = require('../lib/otkazy');
  const linii = require('../lib/linii');
  await st.setJSON('otkazy/otk-test-cap', { id: 'otk-test-cap', smena_id: 'sm-cap', sidelka_id: 's-x', volny: [], otvety: [] });
  const bylo = ((await st.getJSON(`schetchiki/${DEN}`)) || {}).ishodyashchih || 0;
  const k = Object.assign({}, P.klient(), { limity: { ishodyashchih_v_sutki: bylo } });   // потолок уже выбран
  const r = await O.budit(st, k, linii.liniya(P.NOMER_SIDELKI), 'otk-test-cap', { prichina: 'eskalaciya' });
  assert.deepEqual([r.ok, r.potolok], [false, true]);
  const zh = await P.zhurnal(st, DEN);
  assert.ok(zh.some((x) => x.chto === 'eskalaciya_zvonok' && x.obekt === 'otkazy/otk-test-cap' && x.detali.pochemu === 'potolok'));
  const p = zh.find((x) => x.chto === 'pismo_dry_run' && x.detali.klyuch === 'eskalaciya-pismo:otk-test-cap');
  assert.ok(p, 'координатор узнаёт письмом');
  assert.deepEqual(p.detali.komu, ['coordinator@example.com']);
});
