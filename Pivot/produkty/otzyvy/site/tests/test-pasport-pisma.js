// Паспорт клиента, подписи ссылок и тексты писем посетителю.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = F.lib('kartochka');
const S = F.lib('podpis');
const SH = F.lib('shablony');

test.beforeEach(() => F.sbrosVsego());

test('паспорт обкатки в сборке: не заполнен, выключен, холостой — ни одна функция его не трогает', () => {
  const k = K.vzyat('obkatka');
  assert.equal(k.vklyuchen, false);
  assert.equal(k.rezhim, 'suhoy');
  const beda = K.proverit(k);
  assert.ok(beda.some(b => b.startsWith('biznes.place_id')));
  assert.ok(beda.some(b => b.startsWith('istochniki.vera.kalendar_id')));
  assert.deepEqual(K.rabochie().map(x => x.klient), []);
});

test('целый тестовый паспорт проходит проверку; значения по умолчанию — из плана', () => {
  const k = F.postavitPasport();
  assert.deepEqual(K.proverit(k), []);
  assert.equal(k.pisma.okno_s, 9); assert.equal(k.pisma.okno_do, 19);
  assert.equal(k.pisma.zaderzhka_min, 120); assert.equal(k.pisma.napominanie_dney, 3);
  assert.equal(k.pisma.v_sutki, 40); assert.equal(k.trevoga.v_sutki, 20);
  assert.match(k.__hesh, /^[0-9a-f]{12}$/);
});

test('кривой паспорт ловится: primary вместо календаря, окно ночью, потолок выше плана, медицина без отметки', () => {
  const beda = K.proverit(F.postavitPasport({
    istochniki: { vera: { kalendar_id: 'primary' } },
    pisma: { okno_s: 2, v_sutki: 100 },
    biznes: { medicina: true, imya: 'Evil "Corp" <x>' },
  }));
  for (const chto of ['istochniki.vera.kalendar_id', 'pisma.okno_s', 'pisma.v_sutki', 'biznes.medicina', 'biznes.imya'])
    assert.ok(beda.some(b => b.startsWith(chto)), 'не поймано: ' + chto);
  // Медицина с отметкой «без электронных страховых заявок» (решение 25.09) — проходит.
  assert.deepEqual(K.proverit(F.postavitPasport({ biznes: { medicina: true, bez_elektronnyh_strahovyh_zayavok: true } })), []);
});

test('подпись ссылки: чужое назначение, порча, чужой секрет, истёкший срок — отказ; старый секрет при смене — принят', () => {
  const t = S.podpisat({ c: 'o', k: 'acme', h: 'a'.repeat(32) });
  assert.equal(S.proverit(t, 'o').k, 'acme');
  assert.equal(S.proverit(t, 'k'), null, 'ссылка отписки не годится как ссылка клика');
  assert.equal(S.proverit(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), 'o'), null);
  const srok = S.podpisat({ c: 'r', k: 'acme', v: 'x', e: S.srok(1) });
  F.chasy.sdvinut(2 * F.DEN);
  assert.equal(S.proverit(srok, 'r'), null, 'срок вышел');
  process.env.OTZYVY_SECRET_STARYY = process.env.OTZYVY_SECRET;
  process.env.OTZYVY_SECRET = 'novyy-sekret-0123456789abcdef-0123456789';
  assert.equal(S.proverit(t, 'o').k, 'acme', 'после смены секрета старые ссылки отписки работают');
  delete process.env.OTZYVY_SECRET_STARYY;
  assert.equal(S.proverit(t, 'o'), null);
});

test('письмо посетителю: без «довольны ли вы», скидок и подарков; адрес, отписка и заголовки есть; оба языка', () => {
  const k = F.postavitPasport();
  const ZAPRET = /satisf|happy|enjoy|discount|coupon|% off|gift|reward|prize|giveaway|free |today'?s visit|if you (were|are) not|let us know first|довольн|понравил|скидк|подар|розыгр|бесплатн|сегодняшн/i;
  for (const yazyk of ['en', 'ru']) for (const shag of [1, 2]) {
    const p = SH.pismoProsba(k, { vid: 'g-ev1', pochta: 'maria@example.com', imya: 'Maria', yazyk }, shag);
    for (const pole of ['subject', 'text', 'html']) assert.doesNotMatch(p[pole], ZAPRET, `${yazyk}/${shag}/${pole}`);
    assert.ok(p.text.includes(k.biznes.adres) && p.html.includes('123 Main St'), 'адрес бизнеса');
    assert.match(p.text, /\/otpiska\?t=/);
    assert.match(p.headers['List-Unsubscribe'], /^<https:\/\/[^>]+\/otpiska\?t=[^>]+>$/);
    assert.equal(p.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    assert.equal((p.html.match(/<a /g) || []).length, 2, 'в письме две ссылки: кнопка и отписка');
    assert.ok(!p.text.includes('maria@example.com'), 'адреса человека в ссылках нет');
  }
});

test('имя в письме: только похожее на имя; ссылка вместо имени не пройдёт; HTML экранируется', () => {
  const k = F.postavitPasport({ biznes: { imya: 'Tom & Jerry’s Salon' } });
  const p1 = SH.pismoProsba(k, { vid: 'g-1', pochta: 'a@example.com', imya: 'evil.com/pay', yazyk: 'en' }, 1);
  assert.match(p1.text, /^Hello, and thank you for choosing Tom & Jerry’s Salon\./);
  assert.ok(p1.html.includes('Tom &amp; Jerry'), 'амперсанд экранирован');
  const p2 = SH.pismoProsba(k, { vid: 'g-1', pochta: 'a@example.com', imya: '<b>Ann</b>', yazyk: 'en' }, 1);
  assert.ok(!p2.html.includes('<b>Ann'), 'разметка из имени не проходит');
  const p3 = SH.pismoProsba(k, { vid: 'g-1', pochta: 'a@example.com', imya: 'Mary-Jane Watson', yazyk: 'en' }, 1);
  assert.match(p3.text, /^Hi Mary-Jane,/);
});

test('тело для Resend — чистый ASCII (кириллица уходит \\u-последовательностями)', () => {
  const P = F.lib('pisma');
  const s = P.vASCII(JSON.stringify({ subject: 'Спасибо, что выбрали Acme' }));
  assert.doesNotMatch(s, /[^\x00-\x7f]/);
  assert.equal(JSON.parse(s).subject, 'Спасибо, что выбрали Acme');
});

test('gkal.js — побайтная копия календаря Веры (правим только там, копию обновляет skripty/skopirovat-gkal.sh)', (t) => {
  const vera = path.join(F.SITE, '../../../golos/site/kalendar-lib/gkal.js');
  if (!fs.existsSync(vera)) return t.skip('нет исходника Веры рядом');
  assert.ok(fs.readFileSync(vera).equals(fs.readFileSync(path.join(F.SITE, 'lib/gkal.js'))), 'копия разошлась с Верой');
});

test('ошибка Resend с адресом получателя: в журнал функции и в запись визита — без адреса', async () => {
  const P = F.lib('pisma');
  assert.equal(P.bezPochty('Invalid `to` field: "maria.l@example.com" is not valid'), 'Invalid `to` field: "<почта>" is not valid');
  F.postavitPasport();
  const nastoyashchiy = global.fetch;
  global.fetch = async (url, o) => (String(url).includes('api.resend.com')
    ? new Response('{"message":"bounced: maria@example.com"}', { status: 422 }) : nastoyashchiy(url, o));
  try {
    const r = await P.poslat({ to: ['maria@example.com'], subject: 'x' }, 'k1', {});
    assert.equal(r.ok, false);
    assert.ok(!r.oshibka.includes('maria@example.com'));
  } finally { global.fetch = nastoyashchiy; }
});
