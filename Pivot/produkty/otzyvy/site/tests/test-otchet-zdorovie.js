// Месячный отчёт, недельная сверка неявок, чистка по срокам, проверка здоровья.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const EZ = () => F.lib('ezhednevno');

const VLADELEC = 'owner@acme.test';
test.beforeEach(() => { F.sbrosVsego(); F.postavitPasport(); F.blobs.vklyuchit(); });

function vizitVera(start, end, pochta) {
  const e = F.google.vizit(start, end);
  F.blobs.metkaVery(e.id, { event_id: e.id, pochta, pochta_podtverzhdena: !!pochta, yazyk: 'en' });
  return e;
}

test('отчёт 1-го числа с 9:00 по времени бизнеса: просьбы, клики, исключения, рейтинг и соседи; один раз', async () => {
  F.places.postavit('ChIJacmeTESTplace0001', 4.5, 30);
  F.places.postavit('ChIJbestTESTplace0002', 4.7, 120);
  const a = vizitVera('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'a@example.com');
  const b = vizitVera('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'b@example.com');
  vizitVera('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', '');
  const c = vizitVera('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'c@example.com');
  F.chasy.ustanovit('2026-10-05T18:07:00Z'); await F.plan();
  F.google.pereimenovat(c.id, 'no show');
  F.chasy.ustanovit('2026-10-05T19:07:00Z'); await F.plan();
  F.blobs.polozhit('klik/acme/g-' + a.id, { t: Date.now(), s: 1 });
  F.chasy.ustanovit('2026-10-08T19:07:00Z'); await F.plan();          // b — напоминание, a — клик
  assert.ok(b);
  F.chasy.ustanovit('2026-11-01T16:00:00Z'); await EZ().progon();     // 09:00 PDT? нет: 1 ноября уже PST, это 08:00
  assert.equal(F.resend.komu(VLADELEC).length, 0, 'до 9:00 по времени бизнеса отчёта нет');
  F.chasy.ustanovit('2026-11-01T17:00:00Z'); await EZ().progon();     // 09:00 PST
  const [p] = F.resend.komu(VLADELEC);
  assert.equal(p.subject, 'Acme Auto Care: отчёт по отзывам за октябрь 2026');
  assert.match(p.text, /Визитов с почтой \/ всего: 3 \/ 4/);
  assert.match(p.text, /Просьб отправлено: 2/);
  assert.match(p.text, /Напоминаний: 1/);
  assert.match(p.text, /Кликов по кнопке: 1 \(почтовые сканеры/);
  assert.match(p.text, /отмена \/ неявка \/ удалена: 0 \/ 1 \/ 0/);
  assert.match(p.text, /без почты \/ отписан \/ недавно просили \/ опоздали: 1 \/ 0 \/ 0 \/ 0/);
  assert.match(p.text, /Рейтинг в Google на день отчёта: 4,5/);
  assert.match(p.text, /Отзывов в Google на день отчёта: 30/);
  assert.match(p.text, /сравнивайте с прошлым отчётом/);
  assert.match(p.text, /Best Auto: 4,7★, отзывов 120/);
  assert.match(p.text, /Google Maps/);
  F.chasy.sdvinut(F.DEN); await EZ().progon();
  assert.equal(F.resend.komu(VLADELEC).length, 1, 'второго отчёта за октябрь нет');
});

test('отчёт не ушёл (Resend упал) — на следующий день ещё попытка', async () => {
  F.resend.padaet = true;
  F.chasy.ustanovit('2026-11-01T18:00:00Z'); await EZ().progon();
  F.resend.padaet = false;
  F.chasy.ustanovit('2026-11-02T18:00:00Z'); await EZ().progon();
  assert.equal(F.resend.komu(VLADELEC).length, 1);
  F.chasy.ustanovit('2026-11-05T18:00:00Z'); await EZ().progon();
  assert.equal(F.resend.komu(VLADELEC).length, 1);
});

test('неявки: больше 20% записей за неделю — письмо владельцу с копией нам; меньше — тишина', async () => {
  const zapis = (den, itog, i) => F.blobs.polozhit(`arhiv/acme/${den}/g-e${i}`, { vid: 'g-e' + i, istochnik: 'vera', itog });
  let i = 0;
  for (const itog of ['gotovo', 'gotovo', 'gotovo', 'neyavka', 'otmena', 'udaleno']) zapis('2026-10-07', itog, i++);
  F.chasy.ustanovit('2026-10-12T18:00:00Z'); await EZ().progon();     // понедельник
  const p = F.resend.komu(VLADELEC).find(x => /неявок/.test(x.subject));
  assert.ok(p, 'письмо ушло');
  assert.deepEqual(p.cc, ['support@businessinteldna.com']);
  assert.match(p.text, /За неделю 6 записей, без письма из-за неявки или удалённой встречи — 3 \(50%\)/);
  F.chasy.sdvinut(3 * F.CHAS); await EZ().progon();
  assert.equal(F.resend.komu(VLADELEC).filter(x => /неявок/.test(x.subject)).length, 1, 'одно в неделю');
});

test('чистка: журнал визитов и отзывы старше 90 дней удаляются вместе с кликами и замками; отписки остаются навсегда', async () => {
  F.blobs.polozhit('arhiv/acme/2026-06-01/g-old', { vid: 'g-old' });
  F.blobs.polozhit('klik/acme/g-old', { t: 1 });
  F.blobs.polozhit('zamok/acme/g-old/1', { t: 1 });
  F.blobs.polozhit('arhiv/acme/2026-09-20/g-new', { vid: 'g-new' });
  F.blobs.polozhit('otzyv/acme/2026-06-01/aaaaaaaaaaaa', { t: 1 });
  F.blobs.polozhit('otpiska/acme/' + 'f'.repeat(32), { t: 1 });
  F.blobs.polozhit('lim/vsego/2026-09-01', '5');
  F.blobs.vklyuchit(false);                                            // чистка — срок хранения, идёт и выключенной
  await EZ().progon();
  assert.equal(F.blobs.vzyat('arhiv/acme/2026-06-01/g-old'), null);
  assert.equal(F.blobs.vzyat('klik/acme/g-old'), null);
  assert.equal(F.blobs.vzyat('zamok/acme/g-old/1'), null);
  assert.ok(F.blobs.vzyat('arhiv/acme/2026-09-20/g-new'));
  assert.equal(F.blobs.vzyat('otzyv/acme/2026-06-01/aaaaaaaaaaaa'), null);
  assert.ok(F.blobs.vzyat('otpiska/acme/' + 'f'.repeat(32)));
  assert.equal(F.blobs.vzyat('lim/vsego/2026-09-01'), null);
});

// ── здоровье ──────────────────────────────────────────────────────────────
const zdorovie = async (h) => { const r = await F.fn('zdorovie').handler({ headers: h || { 'x-otzyvy-admin': F.ADMIN } }); return { kod: r.statusCode, d: JSON.parse(r.body) }; };

test('здоровье: без ключа администратора — 401; с ключом — всё видно, ничего не отправлено и не потрачено', async () => {
  assert.equal((await zdorovie({})).kod, 401);
  assert.equal((await zdorovie({ 'x-otzyvy-admin': 'не тот' })).kod, 401);
  const { d } = await zdorovie();
  assert.equal(d.ok, true, JSON.stringify(d.beda));
  assert.equal(d.hranilishche, 'api');
  assert.equal(d.klienty.acme.kalendar, 'читается');
  assert.equal(d.klienty.acme.metki_very, 'читаются');
  assert.equal(d.puls.planirovshchik, 'ещё не срабатывал');
  assert.equal(F.resend.vyzovy.length + F.places.vyzovy.length + F.anthropic.vyzovy.length, 0);
});

test('здоровье: календарь открыт всем или не расшарен, нет ключа Resend — ok:false с причинами', async () => {
  F.google.publichnye.add(F.KALENDAR);
  delete process.env.OTZYVY_RESEND_KEY;
  let { d } = await zdorovie();
  assert.equal(d.ok, false);
  assert.ok(d.beda.includes('нет OTZYVY_RESEND_KEY'));
  assert.ok(d.beda.some(b => /открыт всем/.test(b)));
  F.google.nedostupny.add(F.KALENDAR);
  ({ d } = await zdorovie());
  assert.match(d.klienty.acme.kalendar, /НЕ ЧИТАЕТСЯ/);
});

test('здоровье: пульс расписания — через 3 часа после последнего прогона планировщика «не в норме»', async () => {
  await F.plan();
  let { d } = await zdorovie();
  assert.equal(d.puls.planirovshchik.v_norme, true);
  F.chasy.sdvinut(3 * F.CHAS);
  ({ d } = await zdorovie());
  assert.equal(d.puls.planirovshchik.v_norme, false);
});

test('ручной запуск для обкатки: только POST с ключом администратора; выключатель действует и тут', async () => {
  const z = (h, body) => F.fn('zapusk').handler({ httpMethod: 'POST', headers: h, body: JSON.stringify(body) });
  assert.equal((await z({}, { chto: 'planirovshchik' })).statusCode, 401);
  F.blobs.vklyuchit(false);
  const r = await z({ 'x-otzyvy-admin': F.ADMIN }, { chto: 'planirovshchik' });
  assert.equal(JSON.parse(r.body).itog, 'vyklyucheno');
  assert.equal((await z({ 'x-otzyvy-admin': F.ADMIN }, { chto: 'rm -rf' })).statusCode, 400);
});

test('в сеть мимо подделок тесты не ходили', () => { assert.deepEqual(F.sets, []); });

// ── ревью 29.09 ───────────────────────────────────────────────────────────
test('отчёт: холостые «письма» не считаются отправленными; слежение выключено — в Google не ходим, «нет данных»', async () => {
  F.postavitPasport({ rezhim: 'suhoy', slezhenie: { vklyucheno: false } });
  vizitVera('2026-10-05T09:00:00-07:00', '2026-10-05T10:00:00-07:00', 'a@example.com');
  F.chasy.ustanovit('2026-10-05T19:07:00Z'); await F.plan();
  F.postavitPasport({ slezhenie: { vklyucheno: false } });            // боевой
  F.chasy.ustanovit('2026-11-01T18:00:00Z'); await EZ().progon();
  const [p] = F.resend.komu(VLADELEC);
  assert.match(p.text, /Просьб отправлено: 0/);
  assert.match(p.text, /Рейтинг в Google на день отчёта: нет данных/);
  assert.equal(F.places.vyzovy.length, 0, 'ни карточки, ни соседей');
});

test('отчёт: Resend не ответил (таймаут) — замок остаётся, завтра второго отчёта нет', async () => {
  const nastoyashchiy = global.fetch;
  global.fetch = async (url, o) => { if (String(url).includes('api.resend.com')) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; } return nastoyashchiy(url, o); };
  try { F.chasy.ustanovit('2026-11-01T18:00:00Z'); await EZ().progon(); } finally { global.fetch = nastoyashchiy; }
  assert.equal(F.blobs.vzyat('otchet/acme/2026-10').neizvestno, true);
  F.chasy.ustanovit('2026-11-02T18:00:00Z'); await EZ().progon();
  assert.equal(F.resend.komu(VLADELEC).length, 0, 'повтор дал бы второй отчёт после срока ключа Resend');
});

test('неявки: визиты недели, ждущие напоминания (aktiv), входят в знаменатель — ложной тревоги нет', async () => {
  const zapis = (pre, den, itog, i) => F.blobs.polozhit(`${pre}/acme/${pre === 'arhiv' ? den + '/' : ''}g-e${i}`,
    { vid: 'g-e' + i, istochnik: 'vera', itog, konec: Date.parse(den + 'T17:00:00Z') });
  let i = 0;
  for (const itog of ['neyavka', 'otmena', 'gotovo', 'gotovo', 'gotovo']) zapis('arhiv', '2026-10-09', itog, i++);   // одни закрытые: 40%
  for (let j = 0; j < 8; j++) zapis('aktiv', '2026-10-10', undefined, i++);   // просьба ушла, ждут напоминания
  F.chasy.ustanovit('2026-10-12T18:00:00Z'); const r = await EZ().progon();
  assert.deepEqual(r.neyavki.acme, { vsego: 13, isklyucheno: 2, dolya: 15 });
  assert.equal(F.resend.komu(VLADELEC).filter(x => /неявок/.test(x.subject)).length, 0, '2 из 13 — ложной тревоги нет');
});

test('чистка: отпечаток опроса Google старше 30 дней и старые baza/ удаляются; «когда просили» — по сроку паспорта', async () => {
  F.blobs.polozhit('otpechatok/acme', { rating: 4.5, count: 10, t: Date.parse('2026-08-01T00:00:00Z') });
  F.blobs.polozhit('otpechatok/svezh', { rating: 4.5, count: 10, t: Date.parse('2026-10-01T00:00:00Z') });
  F.blobs.polozhit('baza/acme/2026-08', { rating: 4.4, count: 9, t: 1 });
  F.blobs.polozhit('adres/acme/' + 'a'.repeat(32), { t: Date.parse('2026-03-01T00:00:00Z'), vid: 'g-old' });   // > 180 дней
  F.blobs.polozhit('adres/acme/' + 'b'.repeat(32), { t: Date.parse('2026-09-01T00:00:00Z'), vid: 'g-new' });
  await EZ().progon();
  assert.equal(F.blobs.vzyat('otpechatok/acme'), null);
  assert.ok(F.blobs.vzyat('otpechatok/svezh'));
  assert.deepEqual(F.blobs.klyuchi('baza/'), []);
  assert.deepEqual(F.blobs.klyuchi('adres/'), ['adres/acme/' + 'b'.repeat(32)]);
});

test('здоровье: два включённых паспорта с одним календарём — ok:false с причиной', async () => {
  F.postavitPasport({}, 'acme2');
  const { d } = await zdorovie();
  assert.equal(d.ok, false);
  assert.ok(d.klienty.acme.problemy.some(x => /совпадает с другим/.test(x)));
});

test('ручной запуск «ssylki»: ссылки владельца для пилота без Веры, ничего не шлёт', async () => {
  const r = await F.fn('zapusk').handler({ httpMethod: 'POST', headers: { 'x-otzyvy-admin': F.ADMIN }, body: JSON.stringify({ chto: 'ssylki', klient: 'acme' }) });
  const d = JSON.parse(r.body);
  assert.equal(d.ok, true);
  assert.match(d.vizity, /^https:\/\/otzyvy-test\.netlify\.app\/vizity\?t=/);
  assert.equal((await F.get('vizity', { t: F.token(d.vizity) })).statusCode, 200, 'ссылка открывает форму');
  assert.equal(F.resend.vyzovy.length + F.places.vyzovy.length, 0);
});
