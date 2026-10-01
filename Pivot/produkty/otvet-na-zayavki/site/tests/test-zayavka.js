// Заявка → письмо человеку за секунды (цены из паспорта + ссылка на Calendly) и письмо владельцу.
// Запись — в Calendly (решение Андрея 29.09 ~18:05): своих окон и ссылок /zapis в письме нет,
// в Google функция не ходит.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../lib/kartochka');

const LID = 'anna@example.com';
const VLADELEC = 'support@businessinteldna.com';
const CALENDLY = 'https://calendly.com/bizzinteldna/1hr';   // решение 29.09; в коде — только из паспорта
const vseSsylki = (s) => [...String(s).matchAll(/https?:\/\/[^\s"'<>]+/g)].map(m => m[0]);
const osnova = (dop) => Object.assign({ id: 'sub-1', forma: 'hochet-zvonok', stranica: '/vera/ru/', pochta: LID, imya: 'Анна' }, dop || {});
const lidu = () => F.resend.komu(LID);
const vladelcu = () => F.resend.komu(VLADELEC);

test.beforeEach(() => F.sbrosVsego());

test('чужой или пустой секрет — ни одного письма', async () => {
  assert.equal((await F.zayavka(osnova(), { sekret: 'не тот' })).itog, 'sekret');
  assert.equal((await F.zayavka(osnova(), { sekret: null })).itog, 'sekret');
  process.env.OTVET_SECRET = '';
  assert.equal((await F.zayavka(osnova(), { sekret: '' })).itog, 'sekret', 'пустой секрет на сайте = функция выключена');
  process.env.OTVET_SECRET = 'short';
  assert.equal((await F.zayavka(osnova(), { sekret: 'short' })).itog, 'sekret', 'короткий секрет не принимается');
  assert.equal(F.resend.vyzovy.length, 0);
});

test('русская страница Веры: ответ по-русски, все четыре строки цен из паспорта, ссылка на Calendly, раскрытие автоматики', async () => {
  const r = await F.zayavka(osnova());
  assert.equal(r.itog, 'otvecheno');
  const [p] = lidu();
  const k = K.vzyat('bid');
  assert.equal(k.ssylka_zapisi, CALENDLY);
  assert.equal(p.subject, k.teksty.tema_otveta_ru);
  assert.equal(p.from, 'Business Intelligence DNA <support@businessinteldna.com>');
  assert.deepEqual(p.reply_to, [VLADELEC]);
  assert.match(p.text, /^Здравствуйте, Анна!/);
  for (const c of k.produkty.vera.ceny_ru) assert.ok(p.text.includes(c), 'нет строки цены: ' + c);
  // Текст: строка-приглашение и ссылка отдельной строкой (её видно и там, где HTML не показывают).
  assert.ok(p.text.includes(k.teksty.zapis_ru + '\n' + CALENDLY + '\n'), 'в тексте нет ссылки на запись');
  // HTML: кнопка «Выбрать время» ведёт ровно на Calendly из паспорта.
  assert.ok(p.html.includes(`<a href="${CALENDLY}" style="`), 'в HTML нет кнопки на Calendly');
  assert.match(p.html, new RegExp(`<a href="${CALENDLY}"[^>]*>Выбрать время</a>`));
  assert.ok(p.text.includes(k.teksty.raskrytie_ru), 'нет строки «собрано автоматически»');
  assert.ok(p.html.includes(k.teksty.raskrytie_ru));
  // Своих окон нет: ни /zapis, ни времени, ни пояса; в письме только ссылки паспорта.
  assert.ok(!/\/zapis\?t=/.test(p.text + p.html), 'ссылки своей записи в письме');
  assert.ok(!/Лос-Анджелес|11:00|30 минут/.test(p.text), 'в письме время/пояс своих окон');
  for (const u of vseSsylki(p.text)) assert.ok([CALENDLY, k.produkty.vera.stranica_ru].includes(u), 'чужая ссылка в тексте: ' + u);
  for (const u of vseSsylki(p.html)) assert.ok([CALENDLY, k.produkty.vera.stranica_ru].includes(u), 'чужая ссылка в HTML: ' + u);
  // Ни одного запроса в Google, ни одного токена записи в хранилище.
  assert.equal(F.google.vyzovy.length, 0);
  assert.deepEqual(F.blobs.klyuchi('otvet/t:'), []);
});

test('календарь живому пути не нужен: без календарных переменных и без ключа календаря — тот же ответ, Google ни разу', async () => {
  // Окружение по умолчанию уже без OTVET_KALENDAR_ID/ZANYATOST/BAZA_URL; убираем и ключ служебного аккаунта.
  F.blobs.dannye.delete('kalendar-klyuch/sa');
  assert.equal(process.env.OTVET_KALENDAR_ID, undefined);
  const r = await F.zayavka(osnova());
  assert.equal(r.itog, 'otvecheno');
  assert.ok(lidu()[0].text.includes(CALENDLY));
  // И даже если на сайте остались старые календарные переменные — в Google не ходим.
  F.sbrosVsego();
  Object.assign(process.env, { OTVET_KALENDAR_ID: F.KALENDAR, OTVET_KALENDAR_ZANYATOST: F.ZANYATOST, OTVET_BAZA_URL: 'https://businessinteldna.com' });
  await F.zayavka(osnova({ id: 'sub-2' }));
  assert.ok(lidu()[0].text.includes(CALENDLY));
  assert.equal(F.google.vyzovy.length, 0);
});

test('английская страница Веры → английский ответ и английские цены', async () => {
  await F.zayavka(osnova({ stranica: '/vera/', imya: 'John' }));
  const [p] = lidu();
  const k = K.vzyat('bid');
  assert.equal(p.subject, k.teksty.tema_otveta_en);
  assert.match(p.text, /^Hi John,/);
  for (const c of k.produkty.vera.ceny_en) assert.ok(p.text.includes(c), c);
  assert.ok(p.text.includes(k.teksty.zapis_en + '\n' + CALENDLY + '\n'));
  assert.match(p.html, new RegExp(`<a href="${CALENDLY}"[^>]*>Pick a time</a>`));
  assert.ok(p.text.includes(k.teksty.raskrytie_en));
  assert.ok(!/[А-Яа-яЁё]/.test(p.text), 'в английском письме нет кириллицы');
});

test('страница без своего продукта → общие цены; видимость → цены видимости', async () => {
  const k = K.vzyat('bid');
  await F.zayavka(osnova({ id: 'a', stranica: '/business/' }));
  for (const c of k.produkty.obshchiy.ceny_ru) assert.ok(lidu()[0].text.includes(c), c);
  F.resend.sbros();
  await F.zayavka(osnova({ id: 'b', stranica: '/visibility/ru/' }));
  for (const c of k.produkty.vidimost.ceny_ru) assert.ok(lidu()[0].text.includes(c), c);
  assert.ok(!lidu()[0].text.includes('$199'), 'в ответе про видимость нет цен Веры');
  assert.ok(lidu()[0].text.includes(CALENDLY), 'ссылка на запись — в любом продукте');
  // Третья заявка с того же адреса упёрлась бы в потолок (2 в сутки) — диагностику шлём с другого.
  await F.zayavka(osnova({ id: 'c', stranica: '/diagnostic/ru/', pochta: 'boris@example.com' }));
  const [d] = F.resend.komu('boris@example.com');
  for (const c of k.produkty.diagnostika.ceny_ru) assert.ok(d.text.includes(c), c);
  assert.ok(!d.text.includes('$1 500') && !d.text.includes('$199'), 'в ответе про диагностику нет цен видимости и Веры');
  assert.ok(d.text.includes(CALENDLY));
});

test('форма не из паспорта (geo-check уже получает свой разбор) — не отвечаем вовсе', async () => {
  const r = await F.zayavka(osnova({ forma: 'geo-check', stranica: '/visibility/' }));
  assert.equal(r.itog, 'forma');
  assert.equal(F.resend.vyzovy.length, 0);
});

test('письмо владельцу «ответ ушёл» по-русски: кто, откуда, ссылка на запись, текст ответа целиком, хэш паспорта', async () => {
  await F.zayavka(osnova({ telefon: '+1 (305) 555-0100' }));
  const [v] = vladelcu();
  const k = K.vzyat('bid');
  assert.equal(vladelcu().length, 1);
  assert.match(v.subject, /^Заявка → ответ ушёл за \d+ с: anna@example\.com$/);
  assert.deepEqual(v.reply_to, [LID], 'владелец жмёт «Ответить» — пишет человеку');
  assert.match(v.text, /^Ответ человеку ушёл через \d+ с после приёма заявки\./);
  assert.match(v.text, /Форма: hochet-zvonok · страница: \/vera\/ru\//);
  assert.match(v.text, /Интерес: Вера · язык ответа: ru/);
  assert.match(v.text, /Телефон: \+1 \(305\) 555-0100/);
  assert.ok(v.text.includes('Время выбирает сам по ссылке на запись: ' + CALENDLY));
  assert.ok(!/Предложили время|Записался/.test(v.text), 'про свои окна владельцу не пишем');
  assert.ok(v.text.includes(lidu()[0].text), 'в письме владельцу — ровно то, что ушло человеку');
  assert.ok(v.text.includes(k.__hesh));
});

test('повтор той же заявки (повтор фоновой функции, двойная отправка) — одно письмо', async () => {
  await F.zayavka(osnova());
  assert.equal((await F.zayavka(osnova())).itog, 'dubl');
  assert.equal(lidu().length, 1);
  assert.equal(vladelcu().length, 1);
});

test('без id заявки дубли ловятся по почте+форме+странице+суткам', async () => {
  await F.zayavka(osnova({ id: '' }));
  assert.equal((await F.zayavka(osnova({ id: '' }))).itog, 'dubl');
  assert.equal(lidu().length, 1);
});

test('прошлый заход упал посреди работы → повтор доводит, но письма не задваиваются', async () => {
  F.blobs.polozhit('otvet', 'z:bid:sub-1', { status: 'v_rabote', prinyata: F.chasy.get() - 5 * 60000 });
  assert.equal((await F.zayavka(osnova())).itog, 'otvecheno');
  assert.equal(lidu().length, 1);
  F.blobs.polozhit('otvet', 'z:bid:sub-2', { status: 'v_rabote', prinyata: F.chasy.get() - 10000 });
  assert.equal((await F.zayavka(osnova({ id: 'sub-2' }))).itog, 'dubl', 'свежий «в работе» — это идущий заход, не трогаем');
});

test('потолок на один адрес: третья заявка за сутки человеку не уходит, владельцу — да', async () => {
  await F.zayavka(osnova({ id: '1' }));
  await F.zayavka(osnova({ id: '2', stranica: '/visibility/ru/' }));
  const r = await F.zayavka(osnova({ id: '3', stranica: '/diagnostic/ru/' }));
  assert.equal(r.itog, 'limit');
  assert.equal(lidu().length, 2);
  assert.ok(vladelcu().some(p => /потолок/.test(p.subject)));
  // Заявка под потолком закрыта, а не висит «в работе»: та же отправка через 5 минут — дубль, не «повтор после сбоя».
  assert.equal(F.blobs.vzyat('otvet', 'z:bid:3').status, 'limit');
  F.chasy.sdvinut(5 * 60000);
  assert.equal((await F.zayavka(osnova({ id: '3', stranica: '/diagnostic/ru/' }))).itog, 'dubl');
});

test('имя-ловушка со ссылкой не попадает в письмо; сообщение человека не возвращается ему, но есть у владельца', async () => {
  await F.zayavka(osnova({ imya: '<a href="https://evil.com">Оплатите счёт</a>', soobshchenie: 'Оплатите на evil.com/pay срочно' }));
  const [p] = lidu();
  assert.match(p.text, /^Здравствуйте!/);
  assert.ok(!/evil/.test(p.text) && !/evil/.test(p.html), 'ничего от «человека» в письме с нашего домена');
  assert.ok(p.text.includes(K.vzyat('bid').teksty.est_vopros_ru), 'но вопрос замечен');
  assert.ok(vladelcu()[0].text.includes('Оплатите на evil.com/pay срочно'));
  assert.ok(!/<a href="https:\/\/evil/.test(vladelcu()[0].text));
});

test('имя с точкой («pay at evil.com») тоже не пропускается', async () => {
  await F.zayavka(osnova({ imya: 'pay at evil.com' }));
  assert.match(lidu()[0].text, /^Здравствуйте!/);
});

test('кривая почта — никаких писем', async () => {
  assert.equal((await F.zayavka(osnova({ pochta: 'anna@@example' }))).itog, 'pochta');
  assert.equal(F.resend.vyzovy.length, 0);
});

test('ссылка на запись берётся только из паспорта: что бы ни прислала форма, в письме одна ссылка — из ssylka_zapisi', async () => {
  await F.zayavka(osnova({ ssylka_zapisi: 'https://evil.com/book', ssylka: 'https://evil.com/x', stranica: '/vera/ru/?next=https://evil.com' }));
  const [p] = lidu();
  assert.ok(!/evil/.test(p.text + p.html));
  assert.equal(vseSsylki(p.text).filter(u => u.includes('calendly')).length, 1);
});

test('тело запроса в Resend — чистый ASCII (кириллица иначе роняет fetch), у каждого письма свой Idempotency-Key', async () => {
  await F.zayavka(osnova());
  assert.equal(F.resend.vyzovy.length, 2);
  for (const v of F.resend.vyzovy) {
    assert.ok(/^[\x00-\x7f]*$/.test(v.body), 'в теле есть не-ASCII');
    assert.ok(v.headers['Idempotency-Key']);
  }
  assert.notEqual(F.resend.vyzovy[0].headers['Idempotency-Key'], F.resend.vyzovy[1].headers['Idempotency-Key']);
});

test('холостой режим OTVET_SUHOY=1: всё собирается, в Resend не уходит ничего', async () => {
  process.env.OTVET_SUHOY = '1';
  const r = await F.zayavka(osnova());
  assert.equal(r.itog, 'otvecheno');
  assert.equal(F.resend.vyzovy.length, 0);
});

test('Resend лёг → владелец видит «ОТВЕТ НЕ УШЁЛ» и ссылку, которую дать человеку руками', async () => {
  F.resend.padaet = true;
  const r = await F.zayavka(osnova());
  assert.equal(r.itog, 'ne_ushlo');
  const tela = F.resend.vyzovy.map(v => JSON.parse(v.body));
  assert.match(tela[1].subject, /ОТВЕТ НЕ УШЁЛ/);
  assert.ok(tela[1].text.includes('Напишите ему сами и дайте ссылку на запись: ' + CALENDLY));
  assert.equal(F.blobs.vzyat('otvet', 'z:bid:sub-1').status, 'ne_ushlo');
});

test('без токена хранилища, но с event.blobs: работает через connectLambda без строгой согласованности', async () => {
  delete process.env.EV_BLOBS_TOKEN;
  const r = await F.zayavka(osnova(), { blobs: true });
  assert.equal(r.itog, 'otvecheno');
  assert.equal(F.blobs.vzyat('otvet', 'z:bid:sub-1').status, 'otvecheno', 'заявка записана в хранилище');
  assert.equal((await F.zayavka(osnova(), { blobs: true })).itog, 'dubl', 'и дубли по нему ловятся');
  assert.equal(lidu().length, 1);
  assert.equal(F.blobs.schet.strogoVLambda, 0, 'ни одного запроса со строгой согласованностью в режиме lambda');
});

test('хранилища нет совсем → ответ с ценами и Calendly уходит; повтор той же заявки второго письма не даёт (Idempotency-Key)', async () => {
  delete process.env.EV_BLOBS_TOKEN;
  const r = await F.zayavka(osnova());
  assert.equal(r.itog, 'otvecheno');
  assert.ok(lidu()[0].text.includes(CALENDLY));
  await F.zayavka(osnova());
  assert.equal(lidu().length, 1, 'дубль держит ключ Resend, раз хранилища нет');
});

test('потолок писем владельцу: 60-е письмо предупреждает, 61-го нет, а человеку отвечаем дальше', async () => {
  const k = K.vzyat('bid');
  F.blobs.dannye.set('otvet/vl:bid:2026-10-05', String(k.pochta.vladelcu_v_sutki - 1));
  await F.zayavka(osnova({ id: 'x1', pochta: 'a1@example.com' }));
  assert.match(vladelcu()[0].text, /последнее письмо о заявках сегодня/);
  await F.zayavka(osnova({ id: 'x2', pochta: 'a2@example.com' }));
  assert.equal(vladelcu().length, 1);
  assert.equal(F.resend.komu('a2@example.com').length, 1);
});
