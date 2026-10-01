// Планировщик: когда уходит просьба, одно напоминание, неявки и отмены, повторы, отписка, потолки.
// Часы подделаны: старт — понедельник 05.10.2026, 08:00 по Лос-Анджелесу (15:00 UTC, PDT −7).
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');

const MARIA = 'maria@example.com';
const PL = () => F.lib('planirovshchik');

// Визит Веры: событие в календаре + метка с почтой, на которую ушло подтверждение (как после патча dlya-very/).
function vizit(start, end, pochta = MARIA, dop = {}) {
  const e = F.google.vizit(start, end, dop.sobytie);
  if (pochta !== null) F.blobs.metkaVery(e.id, Object.assign({ event_id: e.id, kalendar: F.KALENDAR, pochta, pochta_podtverzhdena: !!pochta,
    imya: 'Maria', yazyk: 'en', konec: end }, dop.metka || {}));
  return e;
}
const v = (e) => PL().vidSobytiya(e.id);
const arhiv = (e) => { const k = F.blobs.klyuchi('arhiv/acme/').find(x => x.endsWith('/' + v(e))); return k ? F.blobs.vzyat(k) : null; };
const aktiv = (e) => F.blobs.vzyat('aktiv/acme/' + v(e));
const pisem = () => F.resend.pisma.length;
// Прогон «по расписанию» в :07 заданного часа по UTC.
async function progonV(iso) { F.chasy.ustanovit(iso); return F.plan(); }

test.beforeEach(() => { F.sbrosVsego(); F.postavitPasport(); F.blobs.vklyuchit(); });

test('просьба через 2–3 часа после конца визита, не раньше; письмо по образцу из плана', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');                       // 11:07 — прошёл час
  assert.equal(pisem(), 0);
  assert.ok(aktiv(e), 'визит взят в работу');
  await progonV('2026-10-05T19:07:00Z');                       // 12:07 — 2 ч 07 мин
  assert.equal(pisem(), 1);
  const [p] = F.resend.komu(MARIA);
  assert.equal(p.subject, 'Thank you for choosing Acme Auto Care');
  assert.equal(p.from, '"Acme Auto Care" <thanks@reviews.businessinteldna.com>');
  assert.deepEqual(p.reply_to, ['owner@acme.test'], 'ответы посетителя — владельцу');
  assert.match(p.text, /^Hi Maria, thank you for choosing Acme Auto Care\. If you have a minute, would you share your experience in a Google review\?/);
  assert.ok(p.text.includes('123 Main St, Los Angeles, CA 90012'), 'адрес бизнеса (CAN-SPAM)');
  assert.match(p.headers['List-Unsubscribe'], /^<https:\/\/otzyvy-test\.netlify\.app\/otpiska\?t=[\w.-]+>$/);
  assert.equal(p.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(p.__idem, `otzyvy-acme-${v(e)}-1`);
  assert.ok(aktiv(e).zapros, 'просьба записана в визит');
});

test('вечерний визит: письмо не ночью, а утром в 9:00 по времени бизнеса', async () => {
  vizit('2026-10-05T17:00:00-07:00', '2026-10-05T18:00:00-07:00');
  await progonV('2026-10-06T03:07:00Z');                       // 20:07 — окно закрыто
  await progonV('2026-10-06T15:07:00Z');                       // 08:07 — ещё рано
  assert.equal(pisem(), 0);
  await progonV('2026-10-06T16:07:00Z');                       // 09:07
  assert.equal(pisem(), 1);
});

test('граница окна: 18:07 ещё можно, после 19:00 — только утром', async () => {
  const rano = vizit('2026-10-05T15:00:00-07:00', '2026-10-05T16:00:00-07:00', 'a@example.com');
  const pozdno = vizit('2026-10-05T15:30:00-07:00', '2026-10-05T16:30:00-07:00', 'b@example.com');
  await progonV('2026-10-06T01:07:00Z');                       // 18:07: для 16:00 срок 18:00 — да; для 16:30 срок 18:30 — нет
  assert.equal(F.resend.komu('a@example.com').length, 1);
  assert.equal(F.resend.komu('b@example.com').length, 0);
  await progonV('2026-10-06T02:07:00Z');                       // 19:07 — окно закрыто
  assert.equal(F.resend.komu('b@example.com').length, 0);
  await progonV('2026-10-06T16:07:00Z');                       // 09:07 утра
  assert.equal(F.resend.komu('b@example.com').length, 1);
  assert.ok(aktiv(rano).zapros && aktiv(pozdno).zapros);
});

test('одно напоминание через 3 дня без клика, больше писем нет', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  await progonV('2026-10-08T18:07:00Z');                       // четверг 11:07 — ещё не 3 суток
  assert.equal(pisem(), 1);
  await progonV('2026-10-08T19:07:00Z');                       // четверг 12:07 — ровно 3 суток и 0 мин
  assert.equal(pisem(), 2);
  const nap = F.resend.pisma[1];
  assert.equal(nap.subject, 'A quick reminder from Acme Auto Care');
  assert.match(nap.text, /This is our only reminder\./);
  assert.equal(arhiv(e).itog, 'gotovo');
  for (const d of ['2026-10-09T19:07:00Z', '2026-10-12T19:07:00Z', '2026-10-20T19:07:00Z']) await progonV(d);
  assert.equal(pisem(), 2, 'третьего письма нет');
});

test('клик по кнопке → напоминания нет; кнопка ведёт на форму отзыва Google, открытие ссылки — только отметка', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  const knopka = F.ssylkiIzPisma(F.resend.pisma[0]).find(u => u.includes('/k?t='));
  const head = await F.fn('k').handler({ httpMethod: 'HEAD', headers: {}, queryStringParameters: { t: F.token(knopka) } });
  assert.equal(head.statusCode, 302);
  assert.equal(F.blobs.klyuchi('klik/').length, 0, 'HEAD клик не считает');
  const r = await F.get('k', { t: F.token(knopka) });
  assert.equal(r.statusCode, 302);
  assert.equal(r.headers.location, 'https://search.google.com/local/writereview?placeid=ChIJacmeTESTplace0001');
  await progonV('2026-10-08T19:07:00Z');
  assert.equal(pisem(), 1, 'напоминания нет');
  assert.equal(arhiv(e).itog, 'klik');
  const plohaya = await F.get('k', { t: F.token(knopka).replace(/.$/, c => (c === 'A' ? 'B' : 'A')) });
  assert.equal(plohaya.statusCode, 404, 'подделанная ссылка никуда не ведёт');
});

test('отмена, удалённая встреча и неявка («no show», «No-Show», «неявка») — письма нет, в журнале причина', async () => {
  const otm = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'otm@example.com');
  const ster = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'ster@example.com');
  const ns1 = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'ns1@example.com');
  const ns2 = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'ns2@example.com');
  const ns3 = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'ns3@example.com');
  await progonV('2026-10-05T18:07:00Z');                       // визиты взяты в работу
  F.google.otmenit(otm.id);
  F.google.steret(ster.id);
  F.google.pereimenovat(ns1.id, 'Visit · Maria no show');
  F.google.pereimenovat(ns2.id, 'NO-SHOW Visit · Maria');
  F.google.pereimenovat(ns3.id, 'Визит · Мария — неявка');
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0);
  assert.equal(arhiv(otm).itog, 'otmena');
  assert.equal(arhiv(ster).itog, 'udaleno');
  for (const e of [ns1, ns2, ns3]) assert.equal(arhiv(e).itog, 'neyavka');
});

test('отменённая до конца визита запись тоже попадает в журнал (для отчёта и сверки неявок)', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  F.google.otmenit(e.id);
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0);
  assert.equal(arhiv(e).itog, 'otmena');
});

test('неявку отметили после просьбы — напоминания нет', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  F.google.pereimenovat(e.id, 'no show');
  await progonV('2026-10-08T19:07:00Z');
  assert.equal(pisem(), 1);
  assert.equal(arhiv(e).itog, 'neyavka_posle_prosby');
});

test('перенос: время читаем из календаря в момент отправки', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');
  F.google.perenesti(e.id, '2026-10-06T09:00:00-07:00', '2026-10-06T10:00:00-07:00');   // на завтра
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0, 'по старому времени не шлём');
  await progonV('2026-10-06T19:07:00Z');
  assert.equal(pisem(), 1);
});

test('повторный прогон в тот же час — второго письма нет', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  await F.plan(); await F.plan();
  assert.equal(pisem(), 1);
  assert.equal(F.resend.vyzovy.length, 1);
});

test('упали после отправки, не успев записать визит: повтор через 10 минут с тем же ключом — Resend второго письма не шлёт', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  const r = aktiv(e); delete r.zapros; F.blobs.polozhit('aktiv/acme/' + v(e), r);
  F.blobs.polozhit(`zamok/acme/${v(e)}/1`, { t: Date.parse('2026-10-05T19:07:00Z'), status: 'v_rabote' });
  await progonV('2026-10-05T19:12:00Z');                       // 5 минут — замок ещё жив
  assert.equal(F.resend.vyzovy.length, 1, 'пока замок жив, не трогаем');
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(F.resend.vyzovy.length, 2, 'повтор ушёл в Resend…');
  assert.equal(pisem(), 1, '…но письмо одно: тот же Idempotency-Key');
  assert.ok(aktiv(e).zapros, 'визит поправлен');
});

test('замок «ушло», а визит не обновился — чиним запись без обращения к Resend', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  const r = aktiv(e); delete r.zapros; F.blobs.polozhit('aktiv/acme/' + v(e), r);
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(F.resend.vyzovy.length, 1);
  assert.ok(aktiv(e).zapros);
});

test('Resend упал — повтор на следующем часу; три неудачи — визит закрыт «ne_ushlo»', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  F.resend.padaet = true;
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(aktiv(e).popytok, 1);
  assert.equal(F.blobs.klyuchi('zamok/').length, 0, 'замок снят, чтобы повторить');
  await progonV('2026-10-05T20:07:00Z');
  await progonV('2026-10-05T21:07:00Z');
  assert.equal(arhiv(e).itog, 'ne_ushlo');
  F.resend.padaet = false;
  await progonV('2026-10-05T22:07:00Z');
  assert.equal(pisem(), 0);
});

test('Resend ответил 429 — прогон останавливается, остальные ждут следующего часа', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'a@example.com');
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'b@example.com');
  F.resend.kod = 429;
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.vyzovy.length, 1, 'после 429 второй не пробуем');
  F.resend.kod = 0;
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(pisem(), 2);
});

test('отписка: открытие ссылки не отписывает, кнопка (POST) — навсегда; дальше ни просьб, ни напоминаний', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  const ssylka = F.ssylkiIzPisma(F.resend.pisma[0]).find(u => u.includes('/otpiska?t='));
  const g = await F.get('otpiska', { t: F.token(ssylka) });
  assert.equal(g.statusCode, 200);
  assert.match(g.body, /<form method="post"/);
  assert.equal(F.blobs.klyuchi('otpiska/').length, 0, 'GET ничего не записал');
  const p = await F.post('otpiska', { t: F.token(ssylka) }, 'List-Unsubscribe=One-Click');   // так шлёт Gmail по RFC 8058
  assert.equal(p.statusCode, 200);
  assert.match(p.body, /You are unsubscribed/);
  assert.equal(F.blobs.klyuchi('otpiska/acme/').length, 1);
  assert.ok(!F.blobs.klyuchi('otpiska/acme/')[0].includes('maria'), 'в ключе отписки нет адреса');
  await progonV('2026-10-08T19:07:00Z');
  assert.equal(pisem(), 1, 'напоминания нет');
  assert.equal(arhiv(e).itog, 'otpisan_posle_prosby');
  // Новый визит того же человека через полгода — просьбы тоже нет.
  const e2 = vizit('2027-05-03T09:00:00-07:00', '2027-05-03T10:00:00-07:00');
  await progonV('2027-05-03T19:07:00Z');
  assert.equal(pisem(), 1);
  assert.equal(arhiv(e2).itog, 'otpisan');
});

test('отписка: кривая ссылка — 400 и ничего не записано; повторная отписка — тот же ответ', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  const t = F.token(F.ssylkiIzPisma(F.resend.pisma[0]).find(u => u.includes('/otpiska?t=')));
  assert.equal((await F.post('otpiska', { t: t.slice(0, -2) + 'xx' }, '')).statusCode, 400);
  assert.equal(F.blobs.klyuchi('otpiska/').length, 0);
  assert.equal((await F.post('otpiska', { t }, '')).statusCode, 200);
  assert.equal((await F.post('otpiska', { t }, '')).statusCode, 200);
  assert.equal(F.blobs.klyuchi('otpiska/').length, 1);
});

test('без почты — не шлём, в журнале «net_pochty»; один адрес — не чаще раза в 180 дней', async () => {
  const bez = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', '', {});
  const e1 = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(arhiv(bez).itog, 'net_pochty');
  assert.equal(pisem(), 1);
  const e2 = vizit('2026-10-20T09:00:00-07:00', '2026-10-20T10:00:00-07:00');   // тот же человек через 2 недели
  await progonV('2026-10-20T19:07:00Z');
  assert.equal(pisem(), 1);
  assert.equal(arhiv(e2).itog, 'nedavno_prosili');
  const e3 = vizit('2027-04-12T09:00:00-07:00', '2027-04-12T10:00:00-07:00');   // через полгода — снова можно
  await progonV('2027-04-12T19:07:00Z');
  assert.equal(pisem(), 2);
  assert.ok(e1 && e3);
});

test('потолки: не больше 20 писем за прогон и 40 на бизнес в сутки; остальные уходят завтра', async () => {
  for (let i = 0; i < 45; i++) vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', `p${i}@example.com`);
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 20);
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(pisem(), 40);
  await progonV('2026-10-05T21:07:00Z');
  assert.equal(pisem(), 40, 'потолок бизнеса на сутки');
  await progonV('2026-10-06T16:07:00Z');                       // завтра 09:07, ещё в пределах 48 ч
  assert.equal(pisem(), 45);
});

test('потолок на всех в сутки (90 из бесплатных 100 у Resend) — сверх него письма ждут', async () => {
  process.env.OTZYVY_VSEGO_V_SUTKI = '3';
  for (let i = 0; i < 5; i++) vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', `p${i}@example.com`);
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 3);
  process.env.OTZYVY_VSEGO_V_SUTKI = '500';
  assert.equal(F.lib('limity').POTOLKI.vsego_pisem(), 90, 'выше 90 переменной не поднять');
});

test('выключатель: нет записи или выключен — ничего не уходит и календарь не читается', async () => {
  F.blobs.dannye.delete(`${F.NASH_SAYT}|otzyvy/nastroyki/vyklyuchatel`);
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  const r = await progonV('2026-10-05T19:07:00Z');
  assert.equal(r.itog, 'vyklyucheno');
  F.blobs.vklyuchit(false);
  await F.plan();
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(F.google.vyzovy.length, 0);
  assert.ok(F.blobs.vzyat('pulse/planirovshchik'), 'пульс пишется и при выключенном — видно, что расписание живо');
});

test('паспорт выключен или не цел — клиента не трогаем', async () => {
  F.postavitPasport({ vklyuchen: false });
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  F.postavitPasport({ biznes: { place_id: 'bad' } });
  await F.plan();
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(F.google.vyzovy.length, 0);
});

test('холостой режим паспорта: всё решается и пишется в журнал, в Resend не уходит ничего', async () => {
  F.postavitPasport({ rezhim: 'suhoy' });
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  await progonV('2026-10-08T19:07:00Z');
  assert.equal(F.resend.vyzovy.length, 0);
  const a = arhiv(e);
  assert.equal(a.itog, 'gotovo');
  assert.equal(a.zapros.suhoy, true);
  assert.equal(a.napominanie.suhoy, true);
});

test('OTZYVY_SUHOY=1 на сайте перекрывает боевой паспорт', async () => {
  process.env.OTZYVY_SUHOY = '1';
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.vyzovy.length, 0);
});

test('выключатель стоял трое суток: старые визиты не шлём (по старой базе разом нельзя), свежие — да', async () => {
  F.blobs.vklyuchit(false);
  const star = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'old@example.com');
  const svezh = vizit('2026-10-08T08:00:00-07:00', '2026-10-08T09:00:00-07:00', 'new@example.com');
  await progonV('2026-10-05T19:07:00Z');
  F.blobs.vklyuchit(true);
  await progonV('2026-10-08T19:07:00Z');
  assert.equal(F.resend.komu('old@example.com').length, 0);
  assert.equal(F.resend.komu('new@example.com').length, 1);
  assert.equal(arhiv(star), null, 'визит за горизонтом в работу даже не берём');
  assert.ok(aktiv(svezh).zapros);
});

test('принят, но не отправлен за 48 ч (потолки) — закрыт «ustarel», не шлём', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');                       // в работе
  F.blobs.vklyuchit(false);
  await progonV('2026-10-07T19:07:00Z');
  F.blobs.vklyuchit(true);
  await progonV('2026-10-07T20:07:00Z');                       // 50 ч после конца визита
  assert.equal(pisem(), 0);
  assert.equal(arhiv(e).itog, 'ustarel');
});

test('календарь не прочитался — по визитам Веры вслепую не шлём; прочитался — шлём', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');
  F.google.padaet = true;
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0);
  assert.equal(F.blobs.vzyat('pulse/kalendar/acme').ok, false);
  F.google.padaet = false;
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(pisem(), 1);
});

test('хранилище Веры не отвечает — визит не теряется, решим на следующем часу', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  F.blobs.lomka.chtenie = /^otzyvy-vizit:/;
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.blobs.klyuchi('aktiv/').length + F.blobs.klyuchi('arhiv/').length, 0);
  F.blobs.lomka.chtenie = null;
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(pisem(), 1);
});

test('отписку прочитать не удалось — не шлём (сбой чтения не равен «не отписан»)', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  F.blobs.lomka.chtenie = /^otpiska\//;
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0);
});

test('визит без метки, но записанный Верой до патча: адрес из описания не подтверждён — не шлём, в журнале причина', async () => {
  const e = F.google.vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00',
    { description: 'Записано голосовым агентом Верой.\nИмя: Мария\nПочта: masha@example.com' });
  F.google.vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00',
    { description: 'Обед с поставщиком', attendees: [{ email: 'guest@example.com' }] });   // не Вера и не флаг
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(pisem(), 0, 'адрес, услышанный моделью при записи, мог быть чужим');
  assert.equal(arhiv(e).itog, 'pochta_ne_podtverzhdena');
  assert.equal(arhiv(e).istochnik, 'vera');
});

test('русская линия Веры (метка ru) — русское письмо', async () => {
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'masha@example.com', { metka: { imya: 'Мария', yazyk: 'ru' } });
  await progonV('2026-10-05T19:07:00Z');
  const [p] = F.resend.komu('masha@example.com');
  assert.equal(p.subject, 'Спасибо, что выбрали Acme Auto Care');
  assert.match(p.text, /^Здравствуйте, Мария!/);
});

test('письмо не тому: адрес в метке без подтверждения, два разных подтверждённых адреса, метка из чужого календаря — не шлём', async () => {
  const nepodtv = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'uslyshano@example.com', { metka: { pochta_podtverzhdena: false } });
  const dva = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'pervyy@example.com', { metka: { pochta_neodnoznachna: true } });
  const chuzhoy = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'chuzhoy@example.com', { metka: { kalendar: 'drugoy@group.calendar.google.com' } });
  const verno = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'Verno@Example.com');
  await progonV('2026-10-05T19:07:00Z');
  assert.deepEqual(F.resend.pisma.map(p => p.to[0]), ['verno@example.com'], 'подтверждённый адрес — в нижнем регистре');
  assert.equal(arhiv(nepodtv).itog, 'pochta_ne_podtverzhdena');
  assert.equal(arhiv(dva).itog, 'pochta_neodnoznachna');
  assert.equal(arhiv(chuzhoy), null, 'чужая запись в работу не берётся');
  assert.ok(aktiv(verno).zapros);
});

test('два включённых паспорта с одним календарём — не работает ни один (иначе просьба от имени двух бизнесов)', async () => {
  F.postavitPasport({}, 'acme2');
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.vyzovy.length + F.google.vyzovy.length, 0);
  F.lib('kartochka')._dlyaTesta('acme2', null);
  await F.plan();
  assert.equal(pisem(), 1);
});

test('замок «в работе» старше 20 ч (ключ повтора Resend живёт сутки) — не повторяем, закрываем «не знаем, ушло ли»', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');
  F.blobs.polozhit(`zamok/acme/${v(e)}/1`, { t: Date.parse('2026-10-04T19:07:00Z'), status: 'v_rabote' });
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(arhiv(e).itog, 'neizvestno_ushla_li_prosba');
});

test('холостой режим не блокирует человека на 180 дней: после обкатки настоящая просьба уходит', async () => {
  F.postavitPasport({ rezhim: 'suhoy' });
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(F.blobs.klyuchi('adres/').length, 0, 'холостая просьба в «когда просили» не пишется');
  F.postavitPasport({ rezhim: 'boevoy' });
  vizit('2026-10-12T09:00:00-07:00', '2026-10-12T10:00:00-07:00');
  await progonV('2026-10-12T19:07:00Z');
  assert.equal(F.resend.komu(MARIA).length, 1);
});

test('время прогона кончилось на разборе визитов — прогон останавливается, остальное — на следующем часу', async () => {
  for (let i = 0; i < 5; i++) vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', `t${i}@example.com`);
  const nastoyashchee = performance.now;
  let tik = 0;
  performance.now = () => (tik++ > 3 ? 1e9 : nastoyashchee.call(performance));
  try { await progonV('2026-10-05T19:07:00Z'); } finally { performance.now = nastoyashchee; }
  assert.equal(pisem(), 0, 'по стене времени остановились до отправки');
  assert.equal(F.blobs.klyuchi('aktiv/acme/').length, 3, 'разбор новых визитов тоже остановлен по времени');
  await progonV('2026-10-05T20:07:00Z');
  assert.equal(pisem(), 5, 'остальные ушли следующим часом, без дублей');
});

test('флаг «все события с почтой гостя» (только с согласия владельца): берём гостя, не себя и не организатора', async () => {
  F.postavitPasport({ istochniki: { kalendar_vse_s_gostem: true } });
  F.google.vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00',
    { description: 'Стрижка', attendees: [{ email: 'owner@acme.test', self: true }, { email: 'guest@example.com', displayName: 'Guest Person' }] });
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.komu('guest@example.com').length, 1);
  assert.equal(F.resend.komu('owner@acme.test').length, 0);
});

test('метка Веры с подтверждённым адресом главнее строки в описании', async () => {
  const e = F.google.vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00',
    { description: 'Booked by Vera, the voice agent.\nEmail: oshibka@example.com' });
  F.blobs.metkaVery(e.id, { event_id: e.id, pochta: 'verno@example.com', pochta_podtverzhdena: true, yazyk: 'en' });
  await progonV('2026-10-05T19:07:00Z');
  assert.equal(F.resend.komu('verno@example.com').length, 1);
  assert.equal(F.resend.komu('oshibka@example.com').length, 0);
});

test('дни писем: без воскресенья — воскресный визит получает просьбу в понедельник', async () => {
  F.postavitPasport({ pisma: { dni: [1, 2, 3, 4, 5, 6] } });
  vizit('2026-10-11T09:00:00-07:00', '2026-10-11T10:00:00-07:00');            // воскресенье
  await progonV('2026-10-11T19:07:00Z');
  assert.equal(pisem(), 0);
  await progonV('2026-10-12T16:07:00Z');                                       // понедельник 09:07
  assert.equal(pisem(), 1);
});

test('много событий в календаре — читаем все страницы списка', async () => {
  for (let i = 0; i < 260; i++) F.google.vizit('2026-10-01T09:00:00-07:00', '2026-10-01T10:00:00-07:00', { description: 'чужое' });
  vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T19:07:00Z');
  assert.ok(F.google.vyzovy.some(x => x.query.pageToken), 'была вторая страница');
  assert.equal(pisem(), 1);
});

test('в сеть мимо подделок тесты не ходили', () => { assert.deepEqual(F.sets, []); });

test('календарь молчит двое суток — визит не висит в работе вечно: закрыт «ustarel», письма нет', async () => {
  const e = vizit('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00');
  await progonV('2026-10-05T18:07:00Z');
  F.google.padaet = true;
  await progonV('2026-10-07T19:07:00Z');
  assert.equal(pisem(), 0);
  assert.equal(arhiv(e).itog, 'ustarel');
});
