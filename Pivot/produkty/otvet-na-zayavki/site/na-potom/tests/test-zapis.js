// ОТЛОЖЕНО 29.09.2026 вместе со своей записью (живой путь — Calendly). Тесты те же, что до
// решения; изменилось только, откуда берутся токены: не из письма zayavka-background (он теперь
// даёт ссылку на Calendly), а из того же кода окон, вынесенного в na-potom/lib/okna-v-pismo.js.
//
// Клик по времени → страница с кнопкой → запись в календарь → письма. Сканеры, двойные клики,
// гонка с Верой и с другим лидом, прошедшее время, сбой Google.
const F = require('./_zapis');
const test = require('node:test');
const assert = require('node:assert/strict');

const LID = 'anna@example.com';
const VLADELEC = 'support@businessinteldna.com';

const lidSTokenami = (dop) => F.lidSTokenami(dop);
const vstavki = () => F.google.vstavki().length;
const sobytiyVKalendare = () => [...F.google.sobytiya.values()];

test.beforeEach(() => F.sbros());

test('GET по ссылке (так ходят сканеры писем) ничего не записывает и в календарь не ходит', async () => {
  const [t] = await lidSTokenami();
  const vyzovovDo = F.google.vyzovy.length;
  const r = await F.zapisGet(t);
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /Подтвердите звонок/);
  assert.match(r.body, /понедельник, 5 октября\D+11:00/, 'местное время Лос-Анджелеса, а не 14:00 Нью-Йорка');
  assert.match(r.body, /<form method="post" action="\/zapis">/);
  assert.match(r.body, /a\*\*\*a@example\.com/, 'почта замаскирована');
  assert.equal(F.google.vyzovy.length, vyzovovDo, 'ни одного запроса в Google');
  assert.equal(F.resend.vyzovy.length, 0);
  assert.equal(r.headers['x-frame-options'], 'DENY');
  assert.equal(r.headers['referrer-policy'], 'no-referrer');
  assert.match(r.headers['x-robots-tag'], /noindex/);
});

test('POST «Подтвердить» → событие в календаре, письмо человеку с .ics, письмо владельцу «Записался»', async () => {
  const [t] = await lidSTokenami();
  const r = await F.zapisPost(t);
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /Записано/);
  const ev = sobytiyVKalendare();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].start.dateTime, '2026-10-05T18:00:00.000Z');   // пн 11:00 по Лос-Анджелесу (PDT)
  assert.equal(ev[0].end.dateTime, '2026-10-05T18:30:00.000Z');
  assert.equal(ev[0].summary, 'Звонок · Анна');
  assert.match(ev[0].description, /Почта: anna@example\.com/);
  assert.ok(!F.google.vstavki()[0].telo.attendees, 'гостя не ставим: служебный аккаунт не может приглашать');

  const [p] = F.resend.komu(LID);
  assert.match(p.subject, /^Звонок записан: понедельник, 5 октября\D+11:00/);
  assert.match(p.text, /по времени Лос-Анджелеса\), 30 минут/);
  assert.match(p.text, /Ссылку на Zoom Андрей пришлёт/);
  const ics = Buffer.from(p.attachments[0].content, 'base64').toString('utf8');
  assert.match(ics, /DTSTART:20261005T180000Z\r\n/);
  assert.match(ics, /DTEND:20261005T183000Z\r\n/);
  for (const stroka of ics.split('\r\n')) assert.ok(Buffer.byteLength(stroka) <= 75, 'строка .ics длиннее 75 октетов: ' + stroka);

  const [v] = F.resend.komu(VLADELEC);
  assert.match(v.subject, /^Записался: понедельник, 5 октября .* — Анна$/);
  assert.match(v.text, /ССЫЛКУ НА ZOOM ПРИШЛИТЕ ЕМУ САМИ/);
  assert.match(v.text, /Подтверждение человеку ушло/);
  assert.match(v.text, /https:\/\/calendar\.google\.com\/event\?eid=/);
});

test('двойной клик по той же кнопке → «уже записаны», второго события и второго письма нет', async () => {
  const [t] = await lidSTokenami();
  await F.zapisPost(t);
  const r = await F.zapisPost(t);
  assert.match(r.body, /Вы уже записаны/);
  assert.equal(vstavki(), 1);
  assert.equal(F.resend.komu(LID).length, 1);
});

test('нажал другое время из того же письма → «уже записаны» на первое, вторая встреча не создаётся', async () => {
  const [t1, t2] = await lidSTokenami();
  await F.zapisPost(t1);
  const r = await F.zapisPost(t2);
  assert.match(r.body, /Вы уже записаны/);
  assert.match(r.body, /понедельник, 5 октября/);
  assert.equal(vstavki(), 1);
  const g = await F.zapisGet(t2);
  assert.match(g.body, /Вы уже записаны/, 'и GET по второй ссылке говорит то же');
});

test('пока письмо лежало, владелец поставил встречу на это время → «только что заняли» + три новых времени кнопками', async () => {
  const [t] = await lidSTokenami();
  F.google.zanyato.push({ kal: F.ZANYATOST, start: '2026-10-05T18:00:00Z', end: '2026-10-05T19:00:00Z' });   // пн 11:00–12:00 PDT
  const r = await F.zapisPost(t);
  assert.equal(r.statusCode, 409);
  assert.match(r.body, /Это время только что заняли/);
  assert.equal(vstavki(), 0);
  const novye = [...r.body.matchAll(/name="t" value="([A-Za-z0-9_-]{22})"/g)].map(m => m[1]);
  assert.equal(novye.length, 3);
  assert.ok(!novye.includes(t));
  // Новая кнопка сразу записывает (это уже не сканер, а человек на странице).
  const r2 = await F.zapisPost(novye[0]);
  assert.match(r2.body, /Записано/);
  assert.equal(sobytiyVKalendare()[0].start.dateTime, '2026-10-05T19:30:00.000Z', 'пн 12:30: 12:00 занято запасом 15 минут');
});

test('владелец поставил встречу, которая КОНЧАЕТСЯ за 10 минут до окна → запас 15 минут не даёт записать', async () => {
  // Окно пн 11:00 по Лос-Анджелесу. Встреча 10:20–10:50 в основном календаре появилась после письма.
  // Настоящий freeBusy отдаёт только занятость, пересекающую timeMin: если спрашивать «с 10:59»,
  // встреча 10:20–10:50 в ответ не попадёт, и запас после неё никто не увидит.
  const [t] = await lidSTokenami();
  assert.equal(F.blobs.vzyat('otvet', 't:bid:' + t).slot, '2026-10-05T18:00:00.000Z');
  F.google.zanyato.push({ kal: F.ZANYATOST, start: '2026-10-05T17:20:00Z', end: '2026-10-05T17:50:00Z' });   // 10:20–10:50 PDT
  const r = await F.zapisPost(t);
  assert.match(r.body, /Это время только что заняли/);
  assert.equal(vstavki(), 0);
});

test('Вера записала голосом в ту же секунду → уступаем: наше событие удалено, на времени одна встреча', async () => {
  const [t] = await lidSTokenami();
  F.google.posleVstavki = (nashe) => {
    F.google.posleVstavki = null;
    F.google.dobavitSobytie(nashe.start.dateTime, nashe.end.dateTime, { summary: 'Звонок · Вера записала' });
  };
  const r = await F.zapisPost(t);
  assert.match(r.body, /Это время только что заняли/);
  const ev = sobytiyVKalendare();
  assert.equal(ev.length, 1);
  assert.equal(ev[0].summary, 'Звонок · Вера записала');
  assert.equal(F.resend.komu(LID).length, 0, 'подтверждения нет — записи нет');
  // И человек может записаться на другое: замок заявки снят.
  const novye = [...r.body.matchAll(/name="t" value="([A-Za-z0-9_-]{22})"/g)].map(m => m[1]);
  assert.match((await F.zapisPost(novye[0])).body, /Записано/);
});

test('удалить своё при конфликте не вышло → запись оставлена, владелец получает ВНИМАНИЕ', async () => {
  const [t] = await lidSTokenami();
  F.google.udaleniePadaet = true;
  F.google.posleVstavki = (nashe) => { F.google.posleVstavki = null; F.google.dobavitSobytie(nashe.start.dateTime, nashe.end.dateTime); };
  const r = await F.zapisPost(t);
  assert.match(r.body, /Записано/);
  assert.match(F.resend.komu(VLADELEC)[0].text, /ВНИМАНИЕ: НА ЭТО ВРЕМЯ ЕСТЬ ДРУГАЯ ВСТРЕЧА/);
});

test('два текстовых лида на одно окно: пока первый записывается (метка свежая), второй получает «заняли»', async () => {
  const [tB] = await lidSTokenami({ pochta: 'boris@example.com', imya: 'Борис' });
  const slotB = F.blobs.vzyat('otvet', 't:bid:' + tB).slot;
  F.blobs.polozhit('otvet', `slot:${F.KALENDAR}:${slotB}`, { z: 'kto-to-drugoy', kogda: F.chasy.get() });
  const r = await F.zapisPost(tB);
  assert.match(r.body, /Это время только что заняли/);
  assert.equal(vstavki(), 0);
});

test('брошенная метка слота (упавший заход, старше двух минут, брони нет) снимается и не держит окно', async () => {
  const [t] = await lidSTokenami();
  const slot = F.blobs.vzyat('otvet', 't:bid:' + t).slot;
  F.blobs.polozhit('otvet', `slot:${F.KALENDAR}:${slot}`, { z: 'upal', kogda: F.chasy.get() - 10 * 60000 });
  assert.match((await F.zapisPost(t)).body, /Записано/);
});

test('после записи метка слота снята: если владелец удалит встречу, окно снова доступно', async () => {
  const [t] = await lidSTokenami();
  await F.zapisPost(t);
  assert.deepEqual(F.blobs.klyuchi('otvet/slot:'), []);
});

test('время прошло → GET без запросов к календарю даёт кнопку, POST показывает новые времена', async () => {
  const [t] = await lidSTokenami();
  F.chasy.ustanovit('2026-10-05T17:30:00Z');   // 10:30 PDT: до окна 30 минут, порог — час
  const g = await F.zapisGet(t);
  assert.match(g.body, /Это время уже прошло/);
  const p = await F.zapisPost(t);
  assert.match(p.body, /Это время уже прошло/);
  assert.equal([...p.body.matchAll(/name="t" value="/g)].length, 3);
  assert.equal(vstavki(), 0);
});

test('новые окна по одной заявке — не больше пяти раз (страницу нельзя дёргать бесконечно)', async () => {
  const [t] = await lidSTokenami();
  F.chasy.ustanovit('2026-10-05T17:30:00Z');
  for (let i = 0; i < 5; i++) await F.zapisPost(t);
  const shestoy = await F.zapisPost(t);
  assert.match(shestoy.body, /Свободного времени сейчас не видно/);
});

test('неизвестный или кривой токен → 404 без обращений к календарю', async () => {
  for (const t of ['', 'x', 'A'.repeat(22), '../../etc/passwd']) {
    const g = await F.zapisGet(t);
    assert.equal(g.statusCode, 404);
    const p = await F.zapisPost(t);
    assert.equal(p.statusCode, 404);
  }
  assert.equal(F.google.vyzovy.length, 0);
});

test('Google не дал вставить → «не получилось», владельцу письмо о сбое, повтор позже проходит', async () => {
  const [t] = await lidSTokenami();
  F.google.vstavkaPadaet = true;
  const r = await F.zapisPost(t);
  assert.equal(r.statusCode, 503);
  assert.match(r.body, /Не получилось записать/);
  assert.match(F.resend.komu(VLADELEC)[0].subject, /Запись НЕ прошла/);
  assert.equal(F.resend.komu(LID).length, 0, 'человеку «записано» не говорим и не пишем');
  F.google.vstavkaPadaet = false;
  assert.match((await F.zapisPost(t)).body, /Записано/, 'замки сняты, вторая попытка записывает');
});

test('перепроверка после вставки не прошла → запись остаётся (до вставки было свободно), владельцу пометка', async () => {
  const [t] = await lidSTokenami();
  F.google.spisokPadaet = true;
  assert.match((await F.zapisPost(t)).body, /Записано/);
  assert.match(F.resend.komu(VLADELEC)[0].text, /Перепроверка календаря после записи не прошла/);
});

test('английский лид → английская страница и письмо', async () => {
  const [t] = await lidSTokenami({ stranica: '/vera/', imya: 'John' });
  assert.match((await F.zapisGet(t)).body, /Confirm your call/);
  const r = await F.zapisPost(t);
  assert.match(r.body, /Booked/);
  const [p] = F.resend.komu(LID);
  assert.match(p.subject, /^Your call is booked: Monday, October 5\D+11:00/);
  assert.match(p.text, /Pacific time\), 30 minutes/);
});

test('имя на странице экранируется, чужой HTML не исполняется', async () => {
  const [t] = await lidSTokenami();
  F.blobs.polozhit('otvet', 't:bid:' + t, Object.assign(F.blobs.vzyat('otvet', 't:bid:' + t), { pochta: '"><script>alert(1)</script>@x.com' }));
  const g = await F.zapisGet(t);
  assert.ok(!g.body.includes('<script>alert'));
});

test('без хранилища запись не делается и «записано» не говорится', async () => {
  const [t] = await lidSTokenami();
  delete process.env.EV_BLOBS_TOKEN;
  const r = await F.zapisPost(t);
  assert.notEqual(r.statusCode, 200);
  assert.equal(vstavki(), 0);
});
