'use strict';
// Шаблон утренней сводки CareLine: lib/shablony/svodka.js → renderSvodka(snimok) → {tema, html, text}.
// Функцию netlify-functions/svodka.js (расписание, замок, отправка) проверяет test/stend-svodka.test.js.
// Запуск: node --test test/svodka.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSvodka } = require('../lib/shablony/svodka');
const { sobratSnimok } = require('../lib/shablony/snimok');
const { demoSnimok, SEYCHAS_SVODKA } = require('../lib/shablony/demo-pult');

const utro = () => demoSnimok(SEYCHAS_SVODKA); // снимок DEMO-агентства на 30.09.2026 7:00 ET

test('шаблон: возвращает тему, html и текст', () => {
  const r = renderSvodka(utro());
  assert.equal(typeof r.tema, 'string');
  assert.equal(typeof r.html, 'string');
  assert.equal(typeof r.text, 'string');
  assert.ok(r.tema.length > 10 && r.tema.length < 160, `длина темы ${r.tema.length}`);
  assert.match(r.html, /^<!doctype html>/i);
  assert.match(r.html, /<html lang="en">/);
});

test('шаблон: вёрстка для почтовых клиентов — таблицы, inline-стили, без внешних ресурсов', () => {
  const d = utro();
  d.ssylka_pult = 'https://stand.example.com/pult/';
  const { html } = renderSvodka(d);
  assert.match(html, /<table role="presentation"/);
  assert.match(html, /max-width:600px/);
  for (const zapret of [/<script/i, /<style/i, /<link/i, /<img/i, /<iframe/i, /url\(/i, /\bclass="/]) {
    assert.doesNotMatch(html, zapret, `в письме есть ${zapret}`);
  }
  // все внешние адреса — только ссылка на пульт
  const adresa = html.match(/https?:\/\/[^"'\s<)]+/g) || [];
  assert.deepEqual([...new Set(adresa)], ['https://stand.example.com/pult/']);
  // у каждого видимого блока текста — inline-стиль
  const bezStilya = html.match(/<(p|td|h1|h2|div)(?![^>]*style=)[^>]*>/g) || [];
  assert.deepEqual(bezStilya, []);
});

test('шаблон: цифры вчерашнего дня совпадают со снимком', () => {
  const d = utro();
  const v = d.vchera;
  const { tema, text, html } = renderSvodka(d);
  assert.equal(v.data, '2026-09-29');
  assert.match(tema, /^Brightside Home Care \(DEMO\), Tue, Sep 29: /);
  assert.ok(tema.includes(`${v.zvonki.vsego} calls`), tema);
  assert.ok(tema.includes(`${v.sobesedovaniya.zapisano} interviews booked`), tema);
  assert.ok(tema.includes('1 shift not filled'), tema);
  assert.ok(text.includes(`${v.zvonki.vsego} calls, ${v.zvonki.minut} minutes in total.`), 'звонки');
  assert.ok(text.includes(`${v.kandidaty.novyh} new applicants: ${v.kandidaty.podhodyat} met your requirements, ${v.kandidaty.ne_podhodyat} did not`), 'кандидаты');
  assert.ok(text.includes(`${v.sobesedovaniya.zapisano} interviews booked.`), 'записи');
  assert.ok(text.includes(`Checked ${v.evv.strok} visits at 6:12 PM against NY rules: ${v.evv.isklyucheniy} issues, ${v.evv.kritichnyh} to fix before billing.`), 'EVV');
  assert.ok(html.includes('Needs attention'));
});

test('шаблон: отказы и незакрытая смена — и в html, и в тексте', () => {
  const { html, text } = renderSvodka(utro());
  // причина приходит кодом инструмента (bolezn) и подписывается словами
  assert.ok(text.includes('5:31 AM: Yolanda O. (illness). Shift 9:00 AM to 3:00 PM, QN-121 (Jackson Heights). Filled in 9 minutes by Juana R.'), text);
  assert.ok(text.includes('Shift went unfilled: 4:00 PM to 8:00 PM, BK-144 (Bensonhurst). Ling A. called off at 1:52 PM; the on-call coordinator was called at 2:00 PM.'));
  assert.ok(text.includes('Not filled. The on-call coordinator was called at 2:00 PM.'));
  assert.ok(html.includes('Shift went unfilled'));
  assert.ok(html.includes('Filled in 9 minutes by Juana R.'));
  // сегодняшний дневной отказ (12:40) в 7:00 ещё не существует
  assert.ok(!text.includes('Beatriz M.'));
});

test('шаблон: собеседования сегодня идут по времени', () => {
  const { text } = renderSvodka(utro());
  const blok = text.split('INTERVIEWS TODAY, WEDNESDAY, SEPTEMBER 30')[1];
  assert.ok(blok, 'нет блока собеседований');
  const vremena = blok.split('\n').map((s) => (s.match(/^(\d{1,2}:\d{2} [AP]M) {2}/) || [])[1]).filter(Boolean);
  assert.deepEqual(vremena, ['10:00 AM', '11:30 AM', '1:00 PM', '3:00 PM']);
  assert.ok(blok.includes('Yudelka Cruz (Spanish, HHA)'));
});

test('шаблон: строки из данных экранируются', () => {
  const d = utro();
  d.otkazy = d.otkazy.map((o) => (o.sidelka && o.sidelka.imya === 'Ling A.'
    ? { ...o, sidelka: { ...o.sidelka, imya: '<script>alert(1)</script>' } } : o));
  d.klient = { ...d.klient, nazvanie: 'Brightside & Sons <b>(DEMO)</b>' };
  d.sobesedovaniya = [{ imya: '"><img src=x onerror=alert(1)>', start: '2026-09-30T10:00:00-04:00', yazyk: 'es', sertifikat: 'hha' }];
  const { html, text } = renderSvodka(d);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Brightside &amp; Sons &lt;b&gt;(DEMO)&lt;/b&gt;'));
  // в текстовой версии — как есть, это не HTML
  assert.ok(text.includes('<script>alert(1)</script>'));
});

test('шаблон: пустой день и пустой вход не ломают письмо', () => {
  const pustoy = renderSvodka({
    klient: { nazvanie: 'Test Agency', poyas: 'America/New_York' },
    sformirovano: '2026-10-05T07:00:00-04:00',
    vchera: { data: '2026-10-04' },
  });
  assert.equal(pustoy.tema, 'Test Agency, Sun, Oct 4: 0 calls');
  assert.ok(pustoy.text.includes('No calls.'));
  assert.ok(pustoy.text.includes('No new applicants.'));
  assert.ok(pustoy.text.includes('No call-offs.'));
  assert.ok(pustoy.text.includes('No EVV checks yet.'));
  assert.ok(pustoy.text.includes('No interviews on the calendar today.'));
  assert.ok(!pustoy.html.includes('Needs attention'));
  assert.doesNotThrow(() => renderSvodka());
  assert.doesNotThrow(() => renderSvodka({ vchera: null, otkazy: 'не массив', kandidaty: null }));
});

test('шаблон: единственное и множественное число', () => {
  const r = renderSvodka({
    klient: { nazvanie: 'Test Agency', poyas: 'America/New_York' },
    sformirovano: '2026-10-05T07:00:00-04:00',
    vchera: {
      data: '2026-10-04',
      zvonki: { vsego: 1, minut: 1, po_yazykam: { en: 1 }, po_itogam: { zapisan: 1 } },
      kandidaty: { novyh: 1, podhodyat: 1, ne_podhodyat: 0 },
      sobesedovaniya: { zapisano: 1, naznacheno: 0 },
      otkazy: { vsego: 1, zakryto: 1, mediana_min: 4 },
    },
  });
  assert.ok(r.tema.includes('1 call,'), r.tema);
  assert.ok(r.tema.includes('1 interview booked'), r.tema);
  assert.ok(r.tema.includes('1 call-off covered'), r.tema);
  assert.ok(r.text.includes('1 call, 1 minute in total.'));
  assert.ok(r.text.includes('1 new applicant: 1 met your requirements'));
  assert.ok(r.text.includes('Outcomes: 1 interview booked.'));
  assert.ok(!/\b1 (calls|minutes|interviews|call-offs)\b/.test(r.text), r.text);
});

test('шаблон: пометка DEMO', () => {
  const baza = { klient: { nazvanie: 'Harbor Agency', poyas: 'America/New_York' }, sformirovano: '2026-10-05T07:00:00-04:00', vchera: { data: '2026-10-04' } };
  const demo = renderSvodka({ ...baza, demo: true });
  assert.match(demo.tema, /^\[DEMO\] Harbor Agency/);
  assert.ok(demo.html.includes('Demo data. All names, phone numbers and records in this summary are fictional.'));
  assert.ok(demo.text.includes('Demo data.'));
  const zhivoy = renderSvodka({ ...baza, demo: false });
  assert.ok(!zhivoy.tema.includes('DEMO'));
  assert.ok(!zhivoy.html.includes('Demo data'));
  // название уже помечено — второй раз не добавляем
  assert.ok(!renderSvodka(utro()).tema.startsWith('[DEMO]'));
});

test('шаблон: ссылка на пульт — только http(s) или путь', () => {
  const d = utro();
  d.ssylka_pult = 'javascript:alert(1)';
  let r = renderSvodka(d);
  assert.ok(!r.html.includes('javascript:'));
  assert.ok(!r.html.includes('Open the dashboard'));
  d.ssylka_pult = 'https://stand.example.com/pult/?k=a"b';
  r = renderSvodka(d);
  assert.ok(!r.html.includes('Open the dashboard'), 'кавычка в адресе должна отклоняться');
  d.ssylka_pult = 'https://stand.example.com/pult/?x=1&y=2';
  r = renderSvodka(d);
  assert.ok(r.html.includes('href="https://stand.example.com/pult/?x=1&amp;y=2"'));
  assert.ok(r.text.includes('Open the dashboard: https://stand.example.com/pult/?x=1&y=2'));
});

test('шаблон: время и день — в поясе агентства, а не сервера', () => {
  // 09:05Z = 5:05 AM EDT 4 октября; 02:30Z 4 октября = 22:30 EDT 3 октября (не «вчера»)
  const zapisi = {
    sidelki: [{ id: 's-1', imya: 'Nadia Test' }, { id: 's-2', imya: 'Rosa Test' }],
    klienty: [{ id: 'c-1', kod: 'BK-1', rayon: 'Midwood' }],
    smeny: [{ id: 'sm-1', klient_id: 'c-1', start: '2026-10-04T13:00:00Z', end: '2026-10-04T17:00:00Z', status: 'filled' }],
    otkazy: [{ id: 'o-1', smena_id: 'sm-1', sidelka_id: 's-1', prichina: 'Sick', soobshcheno: '2026-10-04T09:05:00Z', kanal: 'sms', volny: [{ at: '2026-10-04T09:06:00Z', sidelki: ['s-2'] }], otvety: [{ sidelka_id: 's-2', otvet: 'da', at: '2026-10-04T09:12:00Z' }], zakreplena_za: 's-2', zakreplena_v: '2026-10-04T09:12:00Z', eskalaciya_v: null }],
    zvonki: [
      { conversation_id: 'a', liniya: 'care-hiring', nachalo: '2026-10-04T14:00:00Z', dlitelnost_s: 300, yazyk: 'es', namerenie: 'rabota', itog: 'zapisan' },
      { conversation_id: 'b', liniya: 'care-hiring', nachalo: '2026-10-04T15:00:00Z', dlitelnost_s: 120, yazyk: 'en', namerenie: 'rabota', itog: 'ne_podhodit' },
      { conversation_id: 'c', liniya: 'care-hiring', nachalo: '2026-10-04T02:30:00Z', dlitelnost_s: 60, yazyk: 'en', namerenie: 'drugoe', itog: 'sbros' },
    ],
  };
  const snimok = sobratSnimok({
    klient: { id: 't', nazvanie: 'Test Agency', poyas: 'America/New_York' },
    seychas: '2026-10-05T11:00:00Z',
    zapisi,
  });
  assert.equal(snimok.sformirovano, '2026-10-05T07:00:00-04:00');
  assert.equal(snimok.vchera.data, '2026-10-04');
  assert.equal(snimok.vchera.zvonki.vsego, 2, 'звонок в 22:30 3 октября не входит во вчера');
  const r = renderSvodka(snimok);
  assert.ok(r.text.includes('2 calls, 7 minutes in total.'), r.text);
  assert.ok(r.text.includes('5:05 AM: Nadia Test (sick). Shift 9:00 AM to 1:00 PM, BK-1 (Midwood). Filled in 7 minutes by Rosa Test.'), r.text);
});

test('шаблон: без длинных тире, управляющих символов и протёкших пустот', () => {
  const r = renderSvodka(utro());
  for (const s of [r.tema, r.html, r.text]) {
    assert.ok(!/[–—]/.test(s), 'длинное или среднее тире');
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), 'управляющий символ');
  }
  assert.ok(!/\bundefined\b|\bnull\b|NaN|\[object Object\]/.test(r.text), 'протекла пустота');
  assert.ok(!/\bundefined\b|NaN|\[object Object\]/.test(r.html), 'протекла пустота в html');
});

test('шаблон: сокращённое имя в конце предложения — одна точка («Juana R.», не «Juana R..»)', () => {
  const dvoynaya = /[^.]\.\.(?!\.)/;
  const demo = renderSvodka(utro()); // в демо-данных сиделки записаны как «Juana R.», «Xiuying S.»
  assert.doesNotMatch(demo.text, dvoynaya, 'двойная точка в тексте демо-письма');
  assert.doesNotMatch(demo.html, dvoynaya, 'двойная точка в html демо-письма');
  assert.ok(demo.text.includes('Filled in 9 minutes by Juana R.\n'), 'замена в конце строки');
  assert.ok(demo.text.includes('QN-123, Juana R. 15 units billed'), 'имя в заголовке пункта EVV');

  // все места, где имя встаёт в конец предложения: замена, отказ без причины, кто ждёт перезвона, пункт EVV
  const smena = { start: '2026-10-04T09:00:00-04:00', end: '2026-10-04T13:00:00-04:00', klient_kod: 'BK-1', rayon: 'Midwood' };
  const r = renderSvodka({
    klient: { nazvanie: 'Test Agency', poyas: 'America/New_York' },
    sformirovano: '2026-10-05T07:00:00-04:00',
    vchera: { data: '2026-10-04', otkazy: { vsego: 2, zakryto: 1, ne_zakryto: 1 } },
    otkazy: [
      { status: 'zakryta', soobshcheno: '2026-10-04T05:05:00-04:00', sidelka: { imya: 'Nadia T.' }, zamena: { imya: 'Rosa M.' }, zakryta_za_min: 7, smena },
      { status: 'ne_zakryta', soobshcheno: '2026-10-04T06:10:00-04:00', sidelka: { imya: 'Ling A.' }, prichina: null, smena },
    ],
    kandidaty: [{ created_at: '2026-10-04T12:00:00-04:00', imya: 'Latoya M.', podhodit: true, status: 'new', sobesedovanie: null }],
    evv: { posledniy: { zagruzheno: '2026-10-04T18:00:00-04:00', isklyucheniya: [{ vizit_id: 'V-1', pravilo_tekst: 'No clock-out', vazhnost: 'kritichno',
      chto_ne_tak: 'The visit has no clock-out.', kak_ispravit: 'Enter the end time.', vizit: { data: '2026-10-03', klient_kod: 'BK-1', sidelka: 'Rosa M.' } }] } },
  });
  for (const s of [r.text, r.html]) assert.doesNotMatch(s, dvoynaya, s);
  assert.ok(r.text.includes('- 5:05 AM: Nadia T. Shift 9:00 AM to 1:00 PM, BK-1 (Midwood). Filled in 7 minutes by Rosa M.\n'), r.text);
  assert.ok(r.text.includes('- 6:10 AM: Ling A. Shift 9:00 AM to 1:00 PM, BK-1 (Midwood). Not filled.'), r.text);
  assert.ok(r.text.includes('waiting for a callback: Latoya M.\n'), r.text);
  assert.ok(r.text.includes('- No clock-out: V-1, Sat, Oct 3, BK-1, Rosa M. The visit has no clock-out. Fix: Enter the end time.'), r.text);
  assert.ok(r.html.includes('Filled in 7 minutes by Rosa M.<'), 'html');
});

test('шаблон: сертификат подписан при любом регистре кода (стенд пишет HHA/PCA/CNA/net, демо — строчными)', () => {
  const d = utro();
  d.sobesedovaniya = [
    { imya: 'Ana DEMO', start: '2026-09-30T09:00:00-04:00', yazyk: 'en', sertifikat: 'HHA' },
    { imya: 'Bea DEMO', start: '2026-09-30T10:00:00-04:00', yazyk: 'es', sertifikat: 'PCA' },
    { imya: 'Cora DEMO', start: '2026-09-30T11:00:00-04:00', yazyk: 'ru', sertifikat: 'CNA' },
    { imya: 'Dina DEMO', start: '2026-09-30T12:00:00-04:00', yazyk: 'en', sertifikat: 'net' },
    { imya: 'Eva DEMO', start: '2026-09-30T13:00:00-04:00', yazyk: 'en', sertifikat: 'hha' },
    { imya: 'Fay DEMO', start: '2026-09-30T14:00:00-04:00', yazyk: 'en', sertifikat: null },
  ];
  const { text, html } = renderSvodka(d);
  for (const s of ['Ana DEMO (English, HHA)', 'Bea DEMO (Spanish, PCA)', 'Cora DEMO (Russian, CNA)', 'Dina DEMO (English, no certificate)',
    'Eva DEMO (English, HHA)', 'Fay DEMO (English)']) {
    assert.ok(text.includes(s), s);
    assert.ok(html.includes(s), s);
  }

  // карточка в том виде, как её сохраняет стенд (lib/kartochki.js → sertifikat 'HHA'), через снимок
  const snimok = sobratSnimok({
    klient: { id: 't', nazvanie: 'Test Agency', poyas: 'America/New_York' },
    seychas: '2026-10-05T11:00:00Z',
    zapisi: {
      kandidaty: [{ id: 'kand-1', created_at: '2026-10-04T14:00:00Z', yazyk: 'es', imya: 'Maria DEMO', sertifikat: 'HHA', podhodit: true,
        status: 'booked', sobesedovanie: { start: '2026-10-05T14:00:00Z', end: '2026-10-05T14:30:00Z', event_id: 'evt_1' } }],
    },
  });
  assert.ok(renderSvodka(snimok).text.includes('10:00 AM  Maria DEMO (Spanish, HHA)'), renderSvodka(snimok).text);
});
