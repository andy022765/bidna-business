'use strict';
// Напоминания о собеседованиях и оценках на дому за 24 ч и за 2 ч (lib/napominaniya.js, netlify-functions/napominaniya.js).
// DRY_RUN=1 и сеть запрещена (stend-pomoshch): «ушло бы» — строки sms_dry_run / pismo_dry_run в журнале клиента.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T08:00:00-04:00');
const linii = require('../lib/linii');
const kalendar = require('../lib/kalendar');
const N = require('../lib/napominaniya');
const napominaniya = require('../netlify-functions/napominaniya');
const kandidat = require('../netlify-functions/kandidat');
const zapis = require('../netlify-functions/zapis');

const tik = async (kogda) => { P.vremya(kogda); return N.tik(P.st(), P.klient(), { teper: Date.parse(kogda) }); };
const vyzov = async (f, telo) => P.otvet(await f.handler(P.instrument(telo)));
const vstrecha = (start, event_id, zapisano_v = '2026-09-29T12:00:00-04:00') =>
  ({ start, end: new Date(Date.parse(start) + 1800e3).toISOString(), event_id, zapisano_v });
const kart = async (kl, x) => P.st().setJSON(kl, x);
const kandidatK = (id, pola) => Object.assign({ id, status: 'booked', created_at: '2026-09-29T12:00:00-04:00',
  soglasiya: { zapis: true, ii: true, sms: null } }, pola);
// Что «ушло бы» по карточке: [{kanal, detali}] из журнала за день.
async function ushlo(den, obekt, prefiks = 'napominanie-') {
  return (await P.zhurnal(P.st(), den))
    .filter((z) => (z.chto === 'sms_dry_run' || z.chto === 'pismo_dry_run') && z.obekt === obekt && String(z.detali.klyuch || '').startsWith(prefiks))
    .map((z) => ({ kanal: z.chto === 'sms_dry_run' ? 'sms' : 'email', detali: z.detali }));
}

test('расписание: napominaniya раз в 15 минут (окно ±7,5 мин — ровно один запуск на момент)', () => {
  const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
  assert.match(toml, /\[functions\."napominaniya"\]\s*\n\s*schedule = "\*\/15 \* \* \* \*"/);
  assert.equal(N.OKNO_MS, 7.5 * 60000);
});

test('за 24 ч и за 2 ч: SMS при согласии, иначе письмо, иначе только флаг; язык карточки; STOP сильнее; свежая запись и прошедшие — без напоминания', async () => {
  const S = '2026-10-01T10:00:00-04:00';
  await kart('kandidaty/kand-a', kandidatK('kand-a', { imya: 'Ana DEMO', telefon: '+17185550131', yazyk: 'es', sobesedovanie: vstrecha(S, 'ev-a') }));
  await kart('soglasiya/+17185550131', { telefon: '+17185550131', sms: true, istochnik: 'call' });
  await kart('kandidaty/kand-b', kandidatK('kand-b', { imya: 'Boris DEMO', telefon: '+17185550132', yazyk: 'ru', email: 'boris.demo@example.com',
    soglasiya: { zapis: true, ii: true, sms: false }, sobesedovanie: vstrecha(S, 'ev-b') }));
  await kart('kandidaty/kand-c', kandidatK('kand-c', { imya: 'Chris DEMO', telefon: '+17185550133', yazyk: 'en', sobesedovanie: vstrecha(S, 'ev-c') }));
  await kart('kandidaty/kand-d', kandidatK('kand-d', { imya: 'Dana DEMO', telefon: '+17185550134', yazyk: 'en',
    soglasiya: { zapis: true, ii: true, sms: true }, sobesedovanie: vstrecha(S, 'ev-d', '2026-09-30T09:30:00-04:00') }));
  await kart('kandidaty/kand-e', kandidatK('kand-e', { imya: 'Eva DEMO', telefon: '+17185550135', yazyk: 'en', status: 'attended',
    soglasiya: { sms: true }, sobesedovanie: vstrecha(S, 'ev-e') }));
  await kart('kandidaty/kand-f', kandidatK('kand-f', { imya: 'Fay DEMO', telefon: '+17185550136', yazyk: 'en', email: 'fay.demo@example.com',
    soglasiya: { zapis: true, ii: true, sms: true }, sobesedovanie: vstrecha(S, 'ev-f') }));
  await kart('soglasiya/+17185550136', { telefon: '+17185550136', sms: false, istochnik: 'sms_stop' });
  await kart('kandidaty/kand-p', kandidatK('kand-p', { imya: 'Past DEMO', telefon: '+17185550139', yazyk: 'en',
    soglasiya: { sms: true }, sobesedovanie: vstrecha('2026-09-30T07:00:00-04:00', 'ev-p') }));
  await kart('semi/sem-g', { id: 'sem-g', status: 'booked', yazyk: 'en', kontakt: { imya: 'Gloria DEMO', telefon: '+17185550137', email: 'gloria.demo@example.com' },
    ocenka: vstrecha('2026-10-01T13:00:00-04:00', 'ev-g') });
  await kart('semi/sem-h', { id: 'sem-h', status: 'booked', yazyk: 'es', kontakt: { imya: 'Hilda DEMO', telefon: '+17185550138' }, ocenka: vstrecha(S, 'ev-h') });
  await kart('soglasiya/+17185550138', { telefon: '+17185550138', sms: true, istochnik: 'call' });

  // ── за 24 часа ──
  const t1 = await tik('2026-09-30T10:00:00-04:00');
  assert.deepEqual(t1, { vstrech: 7, napomnili: 4, bez_kanala: 2 });   // attended и прошедшая — не в счёт
  const [a] = await ushlo('2026-09-30', 'kandidaty/kand-a');
  assert.equal(a.kanal, 'sms');
  assert.equal(a.detali.tekst, 'Brightside Home Care (DEMO). Recordatorio: su entrevista es mañana, jue 1 oct, 10:00 a. m. '
    + 'Para cambiar la hora, llámenos. Responda STOP para no recibir mensajes.');
  assert.equal(a.detali.komu, '+17185550131');
  assert.equal(a.detali.ot, P.NOMER_SIDELKI, 'с номера sms.ot клиента');
  assert.equal(a.detali.klyuch, 'napominanie-sms:brightside:ev-a:24');
  const ka = await P.st().getJSON('kandidaty/kand-a');
  assert.deepEqual(ka.sobesedovanie.napominanie_24, { at: '2026-09-30T10:00:00-04:00', kanal: 'sms', rezultat: 'dry_run' });
  assert.equal(ka.status, 'reminded');

  const [b] = await ushlo('2026-09-30', 'kandidaty/kand-b');
  assert.equal(b.kanal, 'email', 'без согласия на SMS — письмо');
  assert.deepEqual(b.detali.komu, ['boris.demo@example.com']);
  assert.equal(b.detali.tema, 'Brightside Home Care (DEMO): напоминание, собеседование завтра, чт 1 окт, 10:00');
  assert.match(b.detali.text, /^Boris DEMO, здравствуйте!\n\nНапоминаем: собеседование в Brightside Home Care \(DEMO\) завтра, чт 1 окт, 10:00 \(время Нью-Йорка\)\./);

  assert.equal((await ushlo('2026-09-30', 'kandidaty/kand-c')).length, 0);
  const kc = await P.st().getJSON('kandidaty/kand-c');
  assert.deepEqual(kc.sobesedovanie.napominanie_24, { at: '2026-09-30T10:00:00-04:00', kanal: null, rezultat: 'net_kanala' });
  assert.equal(kc.status, 'booked', 'не напомнили — статус прежний');

  assert.equal((await ushlo('2026-09-30', 'kandidaty/kand-d')).length, 0, 'записалась 9:30 — за 24 ч не напоминаем');
  assert.equal((await P.st().getJSON('kandidaty/kand-d')).sobesedovanie.napominanie_24.rezultat, 'svezhaya_zapis');

  const f = await ushlo('2026-09-30', 'kandidaty/kand-f');
  assert.deepEqual(f.map((x) => x.kanal), ['email'], 'STOP в журнале согласий сильнее согласия в карточке');
  assert.match(f[0].detali.tema, /reminder about your interview tomorrow, Thu Oct 1, 10:00 AM/);

  assert.equal((await ushlo('2026-09-30', 'kandidaty/kand-e')).length, 0, 'статус attended — не напоминаем');
  assert.equal((await ushlo('2026-09-30', 'kandidaty/kand-p')).length, 0, 'прошедшая встреча — не напоминаем');
  const [h] = await ushlo('2026-09-30', 'semi/sem-h');
  assert.match(h.detali.tekst, /Recordatorio: su evaluación de cuidado en casa es mañana, jue 1 oct, 10:00 a\. m\./);
  assert.equal((await P.st().getJSON('semi/sem-h')).status, 'booked', 'статусы семей не трогаем');
  const zh = await P.zhurnal(P.st(), '2026-09-30');
  assert.equal(zh.filter((z) => z.chto === 'napominanie').length, 4);
  assert.equal(zh.filter((z) => z.chto === 'napominanie_net').length, 2);

  // ── повтор и края окна ──
  const smsDo = (await P.zhurnal(P.st(), '2026-09-30')).filter((z) => /_dry_run$/.test(z.chto)).length;
  assert.deepEqual(await tik('2026-09-30T10:00:00-04:00'), { vstrech: 7, napomnili: 0, bez_kanala: 0 }, 'повтор запуска — флаги');
  await tik('2026-09-30T10:07:00-04:00');
  await tik('2026-09-30T10:15:00-04:00');
  assert.equal((await P.zhurnal(P.st(), '2026-09-30')).filter((z) => /_dry_run$/.test(z.chto)).length, smsDo, 'второй раз не шлём');

  // ── оценка за 24 ч в 13:00 — письмом ──
  await tik('2026-09-30T13:00:00-04:00');
  const [g] = await ushlo('2026-09-30', 'semi/sem-g');
  assert.equal(g.kanal, 'email');
  assert.equal(g.detali.tema, 'Brightside Home Care (DEMO): reminder about your home care assessment tomorrow, Thu Oct 1, 1:00 PM');
  assert.match(g.detali.text, /^Hi Gloria DEMO,\n\nThis is a reminder: your home care assessment with Brightside Home Care \(DEMO\) is tomorrow/);

  // ── за 2 часа ──
  const t2 = await tik('2026-10-01T08:00:00-04:00');
  assert.deepEqual(t2, { vstrech: 7, napomnili: 5, bez_kanala: 1 });
  const a2 = await ushlo('2026-10-01', 'kandidaty/kand-a');
  assert.equal(a2[0].detali.tekst, 'Brightside Home Care (DEMO). Recordatorio: su entrevista es hoy a las 10:00 a. m. '
    + 'Para cambiar la hora, llámenos. Responda STOP para no recibir mensajes.');
  assert.equal(a2[0].detali.klyuch, 'napominanie-sms:brightside:ev-a:2');
  const b2 = await ushlo('2026-10-01', 'kandidaty/kand-b');
  assert.match(b2[0].detali.tema, /собеседование сегодня в 10:00$/);
  const d2 = await ushlo('2026-10-01', 'kandidaty/kand-d');
  assert.equal(d2[0].kanal, 'sms', 'согласие только в карточке (журнала нет) — SMS');
  assert.match(d2[0].detali.tekst, /Reminder: your interview is today at 10:00 AM\./);
  assert.equal((await P.st().getJSON('kandidaty/kand-d')).status, 'reminded');
  const kd = await P.st().getJSON('kandidaty/kand-d');
  assert.ok(kd.sobesedovanie.napominanie_24 && kd.sobesedovanie.napominanie_2, 'оба флага на месте');

  await tik('2026-10-01T11:00:00-04:00');
  const g2 = await ushlo('2026-10-01', 'semi/sem-g');
  assert.match(g2[0].detali.tema, /home care assessment today at 1:00 PM$/);
});

test('края окна: −7,5 мин — ещё напоминаем, +7,5 мин — уже нет', async () => {
  await kart('kandidaty/kand-w1', kandidatK('kand-w1', { imya: 'Wendy DEMO', telefon: '+17185550140', yazyk: 'en',
    soglasiya: { sms: true }, sobesedovanie: vstrecha('2026-10-05T10:00:00-04:00', 'ev-w1') }));
  await kart('kandidaty/kand-w2', kandidatK('kand-w2', { imya: 'Walt DEMO', telefon: '+17185550141', yazyk: 'en',
    soglasiya: { sms: true }, sobesedovanie: vstrecha('2026-10-05T12:00:00-04:00', 'ev-w2') }));
  await tik('2026-10-04T09:52:30-04:00');
  assert.equal((await ushlo('2026-10-04', 'kandidaty/kand-w1')).length, 1, 'ровно за 24 ч 7,5 мин — в окне');
  await tik('2026-10-04T12:07:30-04:00');
  assert.equal((await ushlo('2026-10-04', 'kandidaty/kand-w2')).length, 0, 'через 7,5 мин после момента — окно закрыто');
  await tik('2026-10-04T12:07:29-04:00');
  assert.equal((await ushlo('2026-10-04', 'kandidaty/kand-w2')).length, 1);
});

test('сквозь запись: kandidat → zapis → напоминание; перенос — новое время напоминается заново, статус снова booked', async () => {
  kalendar.ustanovitAdapter(kalendar.feykKalendar({ 'kal-sobesedovanie@test': {}, 'kal-ocenka@test': {} }));
  const conv = 'conv_test_napom_000001';
  P.vremya('2026-10-05T08:30:00-04:00');
  const k = await vyzov(kandidat, { imya: 'Irina DEMO', telefon: '+17185550142', sertifikat: 'HHA', podhodit: true, sms_soglasie: true,
    yazyk: 'ru', conversation_id: conv });
  assert.equal(k.ok, true);
  const z1 = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-06T10:00:00-04:00', imya: 'Irina DEMO', telefon: '+17185550142', conversation_id: conv });
  assert.equal(z1.ok, true);
  await tik('2026-10-05T10:00:00-04:00');
  const s1 = await ushlo('2026-10-05', `kandidaty/${k.id}`);
  assert.equal(s1.length, 1);
  assert.equal(s1[0].detali.tekst, 'Brightside Home Care (DEMO). Напоминаем: собеседование завтра, вт 6 окт, 10:00. '
    + 'Если нужно другое время, позвоните нам. STOP — отписаться.');
  assert.equal((await P.st().getJSON(`kandidaty/${k.id}`)).status, 'reminded');

  P.vremya('2026-10-05T10:30:00-04:00');
  const z2 = await vyzov(zapis, { tip: 'sobesedovanie', start: '2026-10-06T14:00:00-04:00', imya: 'Irina DEMO', telefon: '+17185550142', conversation_id: conv });
  assert.equal(z2.pereneseno, true);
  const kp = await P.st().getJSON(`kandidaty/${k.id}`);
  assert.equal(kp.status, 'booked', 'перенос — снова booked');
  assert.equal(kp.sobesedovanie.napominanie_24, undefined, 'у новой встречи флагов нет');
  await tik('2026-10-05T14:00:00-04:00');
  const s2 = await ushlo('2026-10-05', `kandidaty/${k.id}`);
  assert.equal(s2.length, 2);
  assert.match(s2[1].detali.tekst, /собеседование завтра, вт 6 окт, 14:00\./);
  assert.equal(s2[1].detali.klyuch, `napominanie-sms:brightside:${z2.event_id}:24`);
  // повторное сохранение карточки в том же разговоре не стирает флаги встречи
  await vyzov(kandidat, { imya: 'Irina DEMO', telefon: '+17185550142', sertifikat: 'HHA', podhodit: true, sms_soglasie: true, yazyk: 'ru', conversation_id: conv });
  assert.ok((await P.st().getJSON(`kandidaty/${k.id}`)).sobesedovanie.napominanie_24, 'флаг на месте');
});

test('выключено у клиента — пропуск; обработчик по расписанию проходит по всем клиентам', async () => {
  const n = P.nastroykiTest();
  n.brightside.napominaniya = { vklyucheny: false };
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  try { assert.deepEqual(await tik('2026-10-06T12:00:00-04:00'), { propushcheno: 'vyklyucheny' }); }
  finally { linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); }
  P.vremya('2026-10-06T12:00:00-04:00');   // 2 ч до перенесённой встречи 14:00
  const r = await napominaniya.handler({});
  assert.equal(r.statusCode, 200);
  const b = JSON.parse(r.body);
  assert.equal(b.ok, true);
  assert.deepEqual(b.itogi, [{ klient: 'brightside', vstrech: 1, napomnili: 1, bez_kanala: 0 }]);
});
