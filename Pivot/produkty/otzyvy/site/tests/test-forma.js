// Визиты не через Веру: форма и CSV владельца (пилот для бизнеса без Веры).
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const SH = F.lib('shablony');

let k, t;
test.beforeEach(() => {
  F.sbrosVsego(); k = F.postavitPasport({ istochniki: { vera: { vklyuchen: false } } }); F.blobs.vklyuchit();
  t = F.token(SH.ssylkaVizity(k));
});

test('страница формы: GET ничего не пишет, крупно — «всех подряд, не только довольных»', async () => {
  const r = await F.get('vizity', { t });
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /не только довольных/);
  assert.match(r.headers['content-security-policy'], /default-src 'none'/);
  assert.equal(F.blobs.klyuchi('aktiv/').length, 0);
});

test('чужая или битая ссылка — 404; форма выключена в паспорте — 404', async () => {
  assert.equal((await F.get('vizity', { t: t.slice(0, -3) + 'abc' })).statusCode, 404);
  assert.equal((await F.get('vizity', { t: F.token(SH.ssylkaVstavit(k)) })).statusCode, 404, 'ссылка вставки отзыва не открывает форму визитов');
  F.postavitPasport({ istochniki: { vera: { vklyuchen: false }, forma: { vklyuchena: false } } });
  assert.equal((await F.get('vizity', { t })).statusCode, 404);
});

test('одна запись формой → просьба в 9:07 утра (вносили в 8:00), календарь не нужен', async () => {
  const r = await F.post('vizity', { t }, { pochta: 'Ann@Example.com', imya: 'Ann', kogda: '2026-10-04T15:00' });
  assert.match(r.body, /Принято: 1\./);
  F.chasy.ustanovit('2026-10-05T15:07:00Z'); await F.plan();   // 08:07
  assert.equal(F.resend.pisma.length, 0);
  F.chasy.ustanovit('2026-10-05T16:07:00Z'); await F.plan();   // 09:07
  assert.equal(F.resend.komu('ann@example.com').length, 1);
  assert.match(F.resend.pisma[0].text, /^Hi Ann,/);
  assert.equal(F.google.vyzovy.length, 0);
});

test('CSV: заголовок пропущен, кривые строки названы, старше 7 дней — не принимаем, дубль — «уже был»', async () => {
  const csv = [
    'email,name,date',
    'bob@example.com, Bob, 2026-10-05 10:00',
    'carol@example.com; Carol; 10/04/2026 3:15 pm',
    'не почта, Dan, 2026-10-05 10:00',
    'eve@example.com, Eve',
    'old@example.com, Old, 2026-09-20 10:00',
    'bob@example.com, Bob, 2026-10-05 11:00',
  ].join('\n');
  const r = await F.post('vizity', { t }, { csv });
  assert.match(r.body, /Принято: 2\. Уже были внесены: 1\. Не принято: 3\./);
  assert.match(r.body, /нет почты/);
  assert.match(r.body, /нет даты визита/);
  assert.match(r.body, /по старой базе не просим/);
  assert.equal(F.blobs.klyuchi('aktiv/acme/f-').length, 2);
});

test('визит на завтра: принят, просьба уходит после его конца', async () => {
  await F.post('vizity', { t }, { pochta: 'fut@example.com', kogda: '2026-10-06T14:00' });
  F.chasy.ustanovit('2026-10-05T20:07:00Z'); await F.plan();
  assert.equal(F.resend.pisma.length, 0);
  F.chasy.ustanovit('2026-10-06T23:07:00Z'); await F.plan();   // 16:07 — 2 ч 07 мин после конца
  assert.equal(F.resend.pisma.length, 1);
});

test('больше 200 строк за раз — остальное не принято, и это сказано', async () => {
  const csv = Array.from({ length: 205 }, (_, i) => `u${i}@example.com, U, 2026-10-05 10:00`).join('\n');
  const r = await F.post('vizity', { t }, { csv });
  assert.match(r.body, /Принято: 200\./);
  assert.match(r.body, /больше 200 строк/);
});

test('потолок формы на сутки (ссылка без срока): сверх него не принимаем и говорим почему', async () => {
  k = F.postavitPasport({ istochniki: { vera: { vklyuchen: false }, forma: { v_sutki: 3 } } });
  const csv = Array.from({ length: 5 }, (_, i) => `c${i}@example.com, C, 2026-10-05 10:00`).join('\n');
  const r = await F.post('vizity', { t }, { csv });
  assert.match(r.body, /Принято: 3\./);
  assert.match(r.body, /за сутки уже внесено 3 визитов/);
  assert.equal(F.blobs.klyuchi('aktiv/acme/f-').length, 3);
});
