// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Письма своей записи: ответ с тремя окнами, подтверждение с .ics, владельцу «Записался» и
// «Запись НЕ прошла», владельцу «ответ ушёл» с предложенными окнами. Код перенесён из
// lib/pisma.js как был; общее (отправка, экранирование, имя, подстановка, подвал) берётся
// из живого lib/pisma.js, чтобы правила безопасности писем не разъехались.
// Паспорт k здесь — склеенный (na-potom/lib/kartochka-zapis.js): в нём есть kalendar и vstrecha.

const G = require('./gkal');
const P = require('../../lib/pisma');

const { chistoeImya, ekranHtml, podstavit } = P;

// «четверг, 1 октября в 10:00» / «Thursday, October 1 at 10:00 AM» — в поясе бизнеса.
const vremya = (iso, k, y) => G.slovami(iso, k.kalendar.poyas, y === 'ru');
const poyasPodpis = (k, y) => k.kalendar['poyas_' + y];
const tx = (k, klyuch, y) => k.teksty[klyuch + '_' + y];

function ssylkaZapisi(baza, token) { return String(baza).replace(/\/+$/, '') + '/zapis?t=' + encodeURIComponent(token); }

// ── ответ человеку с тремя окнами ─────────────────────────────────────────
// ssylki — [{token, slot}] или пусто (календарь не ответил): тогда просим ответить письмом.
function pismoOtvetSOknami(k, lid, ssylki, baza) {
  const y = lid.yazyk;
  const p = k.produkty[lid.produkt] || k.produkty.obshchiy;
  const imya = chistoeImya(lid.imya);
  const privet = y === 'ru' ? (imya ? `Здравствуйте, ${imya}!` : 'Здравствуйте!') : (imya ? `Hi ${imya},` : 'Hello,');
  const zn = { poyas: poyasPodpis(k, y), dlina: k.kalendar.dlina_min };
  const est = ssylki && ssylki.length;

  const t = [privet, '', tx(k, 'vstuplenie', y), ''];
  if (lid.est_vopros) t.push(tx(k, 'est_vopros', y), '');
  t.push(p['zagolovok_' + y] + ':');
  for (const c of p['ceny_' + y]) t.push('— ' + c);
  t.push(tx(k, 'podrobnee', y) + ': ' + p['stranica_' + y], '');
  if (est) {
    t.push(podstavit(tx(k, 'vybor', y), zn));
    for (const s of ssylki) t.push('— ' + vremya(s.slot, k, y) + ': ' + ssylkaZapisi(baza, s.token));
    t.push('', tx(k, 'ne_podhodit', y));
  } else {
    t.push(tx(k, 'bez_okon', y));
  }
  t.push('', tx(k, 'raskrytie', y), '', '—', k.biznes['podpis_' + y]);

  const shr = 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a2e;max-width:560px';
  const knopka = 'display:block;margin:0 0 10px;padding:13px 18px;border:1px solid #1a1a2e;border-radius:10px;color:#1a1a2e;text-decoration:none;font-weight:600';
  const h = [`<div style="${shr}">`, `<p>${ekranHtml(privet)}</p>`, `<p>${ekranHtml(tx(k, 'vstuplenie', y))}</p>`];
  if (lid.est_vopros) h.push(`<p>${ekranHtml(tx(k, 'est_vopros', y))}</p>`);
  h.push(`<p style="margin-bottom:6px"><b>${ekranHtml(p['zagolovok_' + y])}</b></p><ul style="margin-top:0;padding-left:20px">`);
  for (const c of p['ceny_' + y]) h.push(`<li>${ekranHtml(c)}</li>`);
  h.push(`</ul><p><a href="${ekranHtml(p['stranica_' + y])}" style="color:#1a1a2e">${ekranHtml(tx(k, 'podrobnee', y))} →</a></p>`);
  if (est) {
    h.push(`<p style="margin-top:22px">${ekranHtml(podstavit(tx(k, 'vybor', y), zn))}</p>`);
    for (const s of ssylki) h.push(`<a href="${ekranHtml(ssylkaZapisi(baza, s.token))}" style="${knopka}">${ekranHtml(vremya(s.slot, k, y))}</a>`);
    h.push(`<p>${ekranHtml(tx(k, 'ne_podhodit', y))}</p>`);
  } else {
    h.push(`<p>${ekranHtml(tx(k, 'bez_okon', y))}</p>`);
  }
  h.push(`<p style="color:#5f6472;font-size:14px">${ekranHtml(tx(k, 'raskrytie', y))}</p>`,
         `<p style="color:#5f6472;font-size:14px">${ekranHtml(k.biznes['podpis_' + y])}</p></div>`);

  return { from: k.pochta.ot, to: [lid.pochta], reply_to: [k.pochta.otvet_na],
           subject: tx(k, 'tema_otveta', y), text: t.join('\n'), html: h.join('') };
}

// ── подтверждение записи ───────────────────────────────────────────────────
const icsVremya = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsTekst = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsSvernut(stroka) {
  // RFC 5545: строки длиннее 75 октетов переносятся с пробелом в начале. Режем по символам с запасом.
  const out = []; let s = stroka;
  while (Buffer.byteLength(s, 'utf8') > 73) {
    let n = 73; while (Buffer.byteLength(s.slice(0, n), 'utf8') > 73) n--;
    out.push(s.slice(0, n)); s = ' ' + s.slice(n);
  }
  out.push(s); return out.join('\r\n');
}

function ics(k, lid, slot, uid) {
  const y = lid.yazyk;
  const start = new Date(slot).getTime();
  const konec = start + k.kalendar.dlina_min * 60000;
  const opis = [k.vstrecha.ssylka || k.vstrecha['bez_ssylki_' + y], tx(k, 'perenesti', y)].join('\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//otvet-na-zayavki//' + k.klient + '//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', 'UID:' + String(uid).replace(/[^\w.@-]/g, '') + '@otvet-na-zayavki', 'DTSTAMP:' + icsVremya(Date.now()),
    'DTSTART:' + icsVremya(start), 'DTEND:' + icsVremya(konec),
    icsSvernut('SUMMARY:' + icsTekst(k.vstrecha['nazvanie_' + y])),
    icsSvernut('DESCRIPTION:' + icsTekst(opis)),
    ...(k.vstrecha.ssylka ? [icsSvernut('LOCATION:' + icsTekst(k.vstrecha.ssylka))] : []),
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

function ssylkaGoogle(k, lid, slot) {
  const y = lid.yazyk;
  const start = new Date(slot).getTime();
  const q = new URLSearchParams({ action: 'TEMPLATE', text: k.vstrecha['nazvanie_' + y],
    dates: icsVremya(start) + '/' + icsVremya(start + k.kalendar.dlina_min * 60000),
    details: k.vstrecha.ssylka || k.vstrecha['bez_ssylki_' + y] });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

function pismoPodtverzhdenie(k, lid, slot, uid) {
  const y = lid.yazyk;
  const zn = { vremya: vremya(slot, k, y), poyas: poyasPodpis(k, y), dlina: k.kalendar.dlina_min };
  const imya = chistoeImya(lid.imya);
  const privet = y === 'ru' ? (imya ? `Здравствуйте, ${imya}!` : 'Здравствуйте!') : (imya ? `Hi ${imya},` : 'Hello,');
  const gde = k.vstrecha.ssylka ? (y === 'ru' ? 'Ссылка на звонок: ' : 'Call link: ') + k.vstrecha.ssylka : k.vstrecha['bez_ssylki_' + y];
  const gl = ssylkaGoogle(k, lid, slot);
  // В текстовой версии ссылки Google нет: закодированная, она занимает полэкрана. Она — в HTML.
  const t = [privet, '', podstavit(tx(k, 'zapisano', y), zn), gde, '', tx(k, 'v_kalendar', y), '',
             tx(k, 'perenesti', y), '', '—', k.biznes['podpis_' + y]].join('\n');
  const shr = 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a2e;max-width:560px';
  const html = `<div style="${shr}"><p>${ekranHtml(privet)}</p>`
    + `<p><b>${ekranHtml(podstavit(tx(k, 'zapisano', y), zn))}</b></p>`
    + `<p>${k.vstrecha.ssylka ? ekranHtml(y === 'ru' ? 'Ссылка на звонок: ' : 'Call link: ') + `<a href="${ekranHtml(k.vstrecha.ssylka)}">${ekranHtml(k.vstrecha.ssylka)}</a>` : ekranHtml(gde)}</p>`
    + `<p>${ekranHtml(tx(k, 'v_kalendar', y))} <a href="${ekranHtml(gl)}">Google Calendar →</a></p>`
    + `<p>${ekranHtml(tx(k, 'perenesti', y))}</p>`
    + `<p style="color:#5f6472;font-size:14px">${ekranHtml(k.biznes['podpis_' + y])}</p></div>`;
  return { from: k.pochta.ot, to: [lid.pochta], reply_to: [k.pochta.otvet_na],
           subject: podstavit(tx(k, 'tema_zapisi', y), zn), text: t, html,
           attachments: [{ filename: 'zvonok.ics', content: Buffer.from(ics(k, lid, slot, uid)).toString('base64'), content_type: 'text/calendar; charset=utf-8; method=PUBLISH' }] };
}

// ── владельцу (по-русски) ──────────────────────────────────────────────────
const vremyaRu = (iso, k) => G.slovami(iso, k.kalendar.poyas, true);

function pismoVladelcuOtvetSOknami(k, lid, r) {
  // r: { otvet: {ok,kod,suhoy}, ssylki, kalendar_oshibka, sekund, pismo, posledneeSegodnya }
  const kuda = lid.pochta;
  let tema;
  if (!r.otvet.ok) tema = `Заявка → ОТВЕТ НЕ УШЁЛ: ${kuda}`;
  else if (!(r.ssylki && r.ssylki.length)) tema = `Заявка → ответ ушёл БЕЗ ВРЕМЕНИ (календарь): ${kuda}`;
  else tema = `Заявка → ответ ушёл за ${r.sekund} с: ${kuda}`;
  const t = [
    r.otvet.ok
      ? (r.otvet.suhoy ? 'ХОЛОСТОЙ РЕЖИМ (OTVET_SUHOY=1): письмо человеку собрано, но не отправлено.' : `Ответ человеку ушёл через ${r.sekund} с после приёма заявки.`)
      : `Ответ человеку НЕ ушёл: ${r.otvet.oshibka || r.otvet.kod}. Напишите ему сами.`,
    '',
    'Имя: ' + (lid.imya || '—'),
    'Почта: ' + lid.pochta,
    'Телефон: ' + (lid.telefon || '—'),
    'Форма: ' + (lid.forma || '—') + ' · страница: ' + (lid.stranica || '—'),
    'Интерес: ' + (P.NAZVANIE[lid.produkt] || lid.produkt) + ' · язык ответа: ' + lid.yazyk,
  ];
  if (lid.soobshchenie) t.push('', 'Его сообщение (в ответ ему НЕ повторяли):', lid.soobshchenie);
  t.push('');
  if (r.ssylki && r.ssylki.length) {
    t.push('Предложили время (' + k.kalendar.poyas_ru + '):');
    for (const s of r.ssylki) t.push('— ' + vremyaRu(s.slot, k));
    t.push('Выберет — придёт второе письмо «Записался». Не выберет — догоняем сами.');
  } else {
    t.push('Время НЕ предложили: ' + (r.kalendar_oshibka || 'окон нет') + '. Человека попросили ответить письмом.');
  }
  if (r.posledneeSegodnya) t.push('', `Это последнее письмо о заявках сегодня: предел ${k.pochta.vladelcu_v_sutki} в сутки. Заявки дальше обрабатываются, но писем о них до полуночи (UTC) не будет — смотрите журнал функции zayavka-background.`);
  t.push('', '──────── что ушло человеку ────────', r.pismo ? r.pismo.text : '(не собрано)');
  return { from: k.pochta.ot, to: k.pochta.vladelcu, reply_to: [lid.pochta], subject: tema, text: t.join('\n') + P.podvalVladelcu(k, lid.z) };
}

function pismoVladelcuZapis(k, lid, z, otpravka) {
  const kogda = vremyaRu(z.slot, k);
  const t = [
    `Записался на звонок: ${kogda} (${k.kalendar.poyas_ru}), ${k.kalendar.dlina_min} минут.`,
    '',
    'Имя: ' + (lid.imya || '—'),
    'Почта: ' + lid.pochta,
    'Интерес: ' + (P.NAZVANIE[lid.produkt] || lid.produkt),
    'Форма: ' + (lid.forma || '—') + ' · страница: ' + (lid.stranica || '—'),
    'В календаре: ' + (z.htmlLink || '(ссылки нет, событие ' + z.id + ')'),
    '',
    k.vstrecha.ssylka ? 'Ссылка на звонок в письме у него есть.' : 'ССЫЛКУ НА ZOOM ПРИШЛИТЕ ЕМУ САМИ: в письме сказано, что её пришлёт Андрей.',
    otpravka && otpravka.ok ? (otpravka.suhoy ? 'Подтверждение человеку: холостой режим, не отправлено.' : 'Подтверждение человеку ушло.') : 'ПОДТВЕРЖДЕНИЕ ЧЕЛОВЕКУ НЕ УШЛО: ' + ((otpravka && otpravka.oshibka) || '?') + '. Приглашение из календаря ему не приходит — напишите сами.',
  ];
  if (z.predupr) t.push('', 'ВНИМАНИЕ: ' + z.predupr);
  return { from: k.pochta.ot, to: k.pochta.vladelcu, reply_to: [lid.pochta],
           subject: `Записался: ${kogda} — ${lid.imya || lid.pochta}`, text: t.join('\n') + P.podvalVladelcu(k, lid.z) };
}

function pismoVladelcuSboy(k, lid, chto) {
  return { from: k.pochta.ot, to: k.pochta.vladelcu, reply_to: [lid.pochta],
           subject: `Запись НЕ прошла: ${lid.pochta}`,
           text: [`Человек нажал «Подтвердить», а записать не получилось: ${chto}.`, 'Ему показали: «ответьте на письмо — запишем вручную».', '',
                  'Почта: ' + lid.pochta, 'Хотел время: ' + vremyaRu(lid.slot, k) + ' (' + k.kalendar.poyas_ru + ')'].join('\n') + P.podvalVladelcu(k, lid.z) };
}

module.exports = { pismoOtvetSOknami, pismoVladelcuOtvetSOknami, pismoPodtverzhdenie, pismoVladelcuZapis, pismoVladelcuSboy,
                   ics, ssylkaZapisi, vremya };
