// Тексты писем. Посетителю — по образцу из PLAN-DLYA-ANDREYA п. 2 (английский по умолчанию, русский
// для русской линии Веры). Владельцу — по-русски.
//
// ЧЕГО В ПИСЬМЕ ПОСЕТИТЕЛЮ НЕТ И БЫТЬ НЕ ДОЛЖНО (тест test-shablony.js ловит каждое):
//  • вопроса «довольны ли вы» и развилки «если понравилось — в Google, если нет — нам» (review gating:
//    Google запрещает, FTC считает нарушением §5);
//  • скидки, подарка, розыгрыша за отзыв (Google запрещает любое вознаграждение, 16 CFR 465);
//  • имени сотрудника и слов «сегодняшний визит» — письмо не выглядит нелепо, если неявку забыли отметить.
// Есть обязательно: адрес бизнеса и отписка (CAN-SPAM), заголовки List-Unsubscribe и List-Unsubscribe-Post.

const P = require('./pisma');
const S = require('./podpis');

const E = P.ekranHtml;

// ── ссылки ─────────────────────────────────────────────────────────────────
const napisatOtzyv = (k) => 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(k.biznes.place_id);
const otzyvyVGoogle = (k) => 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(k.biznes.place_id);
const ssylkaKlik = (k, vid, shag) => `${P.baza()}/k?t=${S.podpisat({ c: 'k', k: k.klient, v: vid, s: shag })}`;
const ssylkaOtpiska = (k, heshPochty, yazyk) => `${P.baza()}/otpiska?t=${S.podpisat({ c: 'o', k: k.klient, h: heshPochty, y: yazyk })}`;
const ssylkaReshenie = (k, idOtzyva, d) => `${P.baza()}/reshenie?t=${S.podpisat({ c: 'r', k: k.klient, v: idOtzyva, e: S.srok(45) })}${d ? '&d=' + d : ''}`;
const ssylkaVstavit = (k) => `${P.baza()}/otzyv?t=${S.podpisat({ c: 'v', k: k.klient })}`;
const ssylkaVizity = (k) => `${P.baza()}/vizity?t=${S.podpisat({ c: 'f', k: k.klient })}`;

// ── письмо посетителю ──────────────────────────────────────────────────────
const TEKSTY = {
  en: {
    tema1: (b) => `Thank you for choosing ${b}`,
    tema2: (b) => `A quick reminder from ${b}`,
    abzac1: (imya, b) => (imya ? `Hi ${imya}, thank you for choosing ${b}.` : `Hello, and thank you for choosing ${b}.`)
      + ' If you have a minute, would you share your experience in a Google review? It helps people nearby decide.',
    abzac2: (imya, b) => (imya ? `Hi ${imya}, just a quick reminder.` : 'Hello, just a quick reminder.')
      + ` If you have a minute, would you share your experience with ${b} in a Google review? It helps people nearby decide. This is our only reminder.`,
    knopka: 'Leave a Google review',
    pochemu: 'You got this email because you booked with us.',
    otpiska: 'Unsubscribe',
  },
  ru: {
    tema1: (b) => `Спасибо, что выбрали ${b}`,
    tema2: (b) => `Небольшое напоминание от ${b}`,
    abzac1: (imya, b) => (imya ? `Здравствуйте, ${imya}! Спасибо, что выбрали ${b}.` : `Здравствуйте! Спасибо, что выбрали ${b}.`)
      + ' Если найдётся минута, расскажите о своём опыте в отзыве в Google: он помогает людям рядом сделать выбор.',
    abzac2: (imya, b) => (imya ? `Здравствуйте, ${imya}! Напоминаем одним письмом.` : 'Здравствуйте! Напоминаем одним письмом.')
      + ` Если найдётся минута, расскажите о своём опыте с ${b} в отзыве в Google: он помогает людям рядом сделать выбор. Это наше единственное напоминание.`,
    knopka: 'Оставить отзыв в Google',
    pochemu: 'Вы получили это письмо, потому что записывались к нам.',
    otpiska: 'Отписаться',
  },
};

// v: { vid, pochta, imya, yazyk }; shag: 1 — просьба, 2 — напоминание.
function pismoProsba(k, v, shag) {
  const y = TEKSTY[v.yazyk] ? v.yazyk : k.pisma.yazyk;
  const T = TEKSTY[y];
  const b = k.biznes.imya;
  const imya = P.imyaDlyaPisma(v.imya);
  const heshP = S.heshPochty(v.pochta);
  const knopka = ssylkaKlik(k, v.vid, shag);
  const otpiska = ssylkaOtpiska(k, heshP, y);
  const abzac = shag === 2 ? T.abzac2(imya, b) : T.abzac1(imya, b);
  const podval = `${b} · ${k.biznes.adres}`;

  const text = [abzac, '', `${T.knopka}: ${knopka}`, '', '—', podval, `${T.pochemu} ${T.otpiska}: ${otpiska}`].join('\n');
  const shr = 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a2e;max-width:560px';
  const stilKnopki = 'display:inline-block;padding:14px 26px;border-radius:10px;background:#1a73e8;color:#ffffff;text-decoration:none;font-weight:600';
  const html = [
    `<div style="${shr}">`,
    `<p>${E(abzac)}</p>`,
    `<p style="margin:24px 0"><a href="${E(knopka)}" style="${stilKnopki}">${E(T.knopka)}</a></p>`,
    `<p style="color:#5f6472;font-size:13px;margin-top:32px">${E(podval)}<br>${E(T.pochemu)} <a href="${E(otpiska)}" style="color:#5f6472">${E(T.otpiska)}</a></p>`,
    '</div>',
  ].join('');

  return {
    from: `"${b}" <${P.otAdres()}>`,
    to: [v.pochta],
    reply_to: [k.pisma.otvet_na],
    subject: shag === 2 ? T.tema2(b) : T.tema1(b),
    text, html,
    // RFC 8058: почтовик сам шлёт POST на этот адрес по кнопке «Отписаться» в своём интерфейсе.
    headers: { 'List-Unsubscribe': `<${otpiska}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

// ── владельцу: общий каркас ────────────────────────────────────────────────
const SHR_V = 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a2e;max-width:600px';
const KN_V = 'display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;border-radius:8px;background:#1a1a2e;color:#ffffff;text-decoration:none;font-size:14px';
const KN_V2 = 'display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;border-radius:8px;background:#eef0f4;color:#1a1a2e;text-decoration:none;font-size:14px';
const podvalVladelcu = (k) => `Сборщик отзывов · ${k.klient} · паспорт ${k.__hesh}`;
function vladelcu(k, tema, html, text) {
  return { from: P.otVladelcu(), to: k.vladelec.pochta, reply_to: [P.otvetNashi()], subject: tema,
           html: `<div style="${SHR_V}">${html}<p style="color:#8a8f99;font-size:12px;margin-top:28px">${E(podvalVladelcu(k))}</p></div>`,
           text: text + '\n\n' + podvalVladelcu(k) };
}
const zvyozdy = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// Тревога с текстом отзыва (его вставил владелец или, позже, пришло письмо Google менеджеру).
// o: { id, zvyozd, avtor, tekst, t, chernovik: {ok, tekst, oshibka}, sovpadeniya: [{imya, kogda}], poyas }
function pismoTrevoga(k, o) {
  const b = k.biznes.imya;
  const tema = `${b}: новый отзыв на ${o.zvyozd}★`;
  const kogda = o.kogda || '';
  const tsitata = String(o.tekst || '').slice(0, 400) + (String(o.tekst || '').length > 400 ? '…' : '');
  const sov = (o.sovpadeniya || []).map(s => `${s.imya}, ${s.kogda}`).join('; ');
  const h = [`<p style="margin:0 0 6px"><b>${E(tema)}</b> · ${E(kogda)}</p>`,
             `<p style="margin:0 0 14px;color:#444">${E(zvyozdy(o.zvyozd))} ${E(o.avtor || 'Без имени')}: «${E(tsitata)}»</p>`];
  const t = [tema + ' · ' + kogda, `${o.avtor || 'Без имени'}: «${tsitata}»`, ''];
  if (o.chernovik && o.chernovik.ok) {
    h.push('<p style="margin:0 0 6px"><b>Ответ</b> (на языке отзыва, можно править):</p>',
           `<blockquote style="margin:0 0 14px;padding:10px 14px;background:#f5f7fa;border-left:3px solid #1a73e8">${E(o.chernovik.tekst)}</blockquote>`);
    t.push('Ответ (на языке отзыва, можно править):', o.chernovik.tekst, '');
  } else {
    h.push(`<p style="margin:0 0 14px">Черновик ответа не получился${o.chernovik && o.chernovik.oshibka ? ' (' + E(o.chernovik.oshibka) + ')' : ''}. На странице по кнопке «Править» можно написать свой — сохраним его для отчёта.</p>`);
    t.push(`Черновик ответа не получился${o.chernovik && o.chernovik.oshibka ? ' (' + o.chernovik.oshibka + ')' : ''}. На странице по кнопке «Править» можно написать свой.`, '');
  }
  const sovet = 'Совет: свяжитесь с клиентом до ответа.' + (sov ? ` Возможно, это запись Веры: ${sov}.` : '');
  h.push(`<p style="margin:0 0 16px">${E(sovet)}</p>`);
  t.push(sovet, '');
  const kn = [['kopir', 'Скопировать и открыть отзыв', KN_V], ['opublikoval', 'Опубликовал', KN_V2], ['pravka', 'Править', KN_V2], ['net', 'Не отвечать', KN_V2]];
  h.push('<p>' + kn.map(([d, nazv, st]) => `<a href="${E(ssylkaReshenie(k, o.id, d))}" style="${st}">${E(nazv)}</a>`).join('') + '</p>');
  for (const [d, nazv] of kn) t.push(`${nazv}: ${ssylkaReshenie(k, o.id, d)}`);
  h.push('<p style="color:#5f6472;font-size:13px">Кнопки открывают страницу, где действие подтверждается ещё одной кнопкой: так почтовый сканер не нажмёт их за вас. Публиковать в Google пока нужно самому — после доступа Google появится кнопка «Опубликовать».</p>');
  return vladelcu(k, tema, h.join(''), t.join('\n'));
}

// Тревога без текста: опрос карточки показал, что пришёл, похоже, отзыв на 1–3★.
// o: { bylo: {rating, count}, stalo: {rating, count}, kogda, tochno }
function pismoTrevogaBezTeksta(k, o) {
  const b = k.biznes.imya;
  const tema = o.tochno ? `${b}: похоже, новый отзыв на 1–${k.trevoga.zvyozd_do}★` : `${b}: рейтинг в Google снизился — посмотрите новый отзыв`;
  const r = (x) => (x == null ? 'нет' : String(x).replace('.', ','));
  const fakt = `Рейтинг в Google ${r(o.bylo.rating)} → ${r(o.stalo.rating)}, отзывов ${o.bylo.count} → ${o.stalo.count} (опрос ${o.kogda}).`;
  const pochemu = o.tochno ? 'По этим числам средняя оценка новых отзывов не выше ' + k.trevoga.zvyozd_do + '★.' : 'Рейтинг снизился, значит новый отзыв ниже вашей средней оценки.';
  const vstavit = ssylkaVstavit(k);
  const h = [`<p style="margin:0 0 10px"><b>${E(tema)}</b></p>`, `<p>${E(fakt)} ${E(pochemu)}</p>`,
             '<p>Текста отзыва у нас нет. Откройте отзывы и вставьте текст — пришлём ответ.</p>',
             `<p><a href="${E(otzyvyVGoogle(k))}" style="${KN_V2}">Открыть отзывы в Google</a><a href="${E(vstavit)}" style="${KN_V}">Вставить текст отзыва</a></p>`,
             '<p style="color:#8a8f99;font-size:12px">Данные: Google Maps.</p>'];
  const t = [tema, '', fakt + ' ' + pochemu, '', 'Текста отзыва у нас нет. Откройте отзывы и вставьте текст — пришлём ответ.',
             'Открыть отзывы: ' + otzyvyVGoogle(k), 'Вставить текст: ' + vstavit, '', 'Данные: Google Maps.'];
  return vladelcu(k, tema, h.join(''), t.join('\n'));
}

// Неявок и удалений за неделю больше 20% записей (PLAN-DLYA-ANDREYA п. 8): просим посмотреть журнал.
// Копия нам: выборочная рассылка «только довольным» — риск, который мы не отдаём владельцу молча.
function pismoNeyavki(k, o) {
  const tema = `${k.biznes.imya}: много неявок за неделю — проверьте`;
  const fakt = `За неделю ${o.vsego} записей, без письма из-за неявки или удалённой встречи — ${o.isklyucheno} (${o.dolya}%).`;
  const zachem = 'Просьбу об отзыве мы шлём всем, кто был на визите. Отметка «no show» или удаление встречи — единственный способ её не слать, и Google запрещает выбирать, кого просить. Если это настоящие неявки — всё в порядке, просто ответьте на письмо. Если встречи удаляли, чтобы не просить недовольных, так делать нельзя: Google может снять отзывы, а FTC считает это нарушением.';
  const h = [`<p><b>${E(tema)}</b></p>`, `<p>${E(fakt)}</p>`, `<p>${E(zachem)}</p>`];
  const p = vladelcu(k, tema, h.join(''), [tema, '', fakt, '', zachem].join('\n'));
  p.cc = [P.otvetNashi()];
  return p;
}

// Месячный отчёт HTML-письмом (PDF нет: конвейер Chrome живёт на Маке, функции его не видят).
function pismoOtchet(k, d) {
  const b = k.biznes.imya;
  const tema = `${b}: отчёт по отзывам за ${d.mesyacSlovami}`;
  const r = (x) => (x == null ? '—' : String(x).replace('.', ','));
  const stroki = [
    ['Визитов с почтой / всего', `${d.sPochtoy} / ${d.vizitov}`],
    ['Просьб отправлено', d.prosb],
    ['Напоминаний', d.napominaniy],
    ['Кликов по кнопке', `${d.klikov} (почтовые сканеры иногда кликают сами — число приблизительное)`],
    ['Не отправлено: отмена / неявка / удалена', `${d.isk.otmena} / ${d.isk.neyavka} / ${d.isk.udaleno}`],
    ['Не отправлено: без почты / отписан / недавно просили / опоздали', `${d.isk.net_pochty} / ${d.isk.otpisan} / ${d.isk.nedavno_prosili} / ${d.isk.ustarel}`],
    ['Отписались за месяц', d.otpisok],
    ['Рейтинг в Google на день отчёта', d.rejting ? r(d.rejting.rating) : 'нет данных'],
    ['Отзывов в Google на день отчёта', d.rejting ? r(d.rejting.count) : 'нет данных'],
    ['Плохих отзывов разобрано', `${d.negativ.vsego}: опубликовал ${d.negativ.opublikoval}, не отвечать ${d.negativ.net}, правка ${d.negativ.pravka}, без решения ${d.negativ.bez}`],
    ['От отзыва до черновика', d.negativ.minut == null ? '—' : `в среднем ${d.negativ.minut} мин`],
  ];
  const sosedi = (d.sosedi || []).map(s => [s.imya, s.ok ? `${r(s.rating)}★, отзывов ${s.count}` : 'нет данных']);
  const tabl = (rows) => '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows.map(([a, v]) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#5f6472">${E(a)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${E(v)}</td></tr>`).join('') + '</table>';
  const h = [`<p style="font-size:17px;margin:0 0 12px"><b>${E(tema)}</b></p>`, tabl(stroki)];
  if (sosedi.length) h.push('<p style="margin:18px 0 6px"><b>Соседи на день отчёта</b></p>', tabl(sosedi));
  h.push('<p style="color:#8a8f99;font-size:12px">Рейтинг и число отзывов: Google Maps. История у нас не хранится — сравнивайте с прошлым отчётом в почте.</p>',
         `<p style="font-size:13px">Внести визиты не через Веру: <a href="${E(ssylkaVizity(k))}">форма</a>. Вставить текст отзыва: <a href="${E(ssylkaVstavit(k))}">сюда</a>.</p>`);
  const t = [tema, '', ...stroki.map(([a, v]) => `${a}: ${v}`)];
  if (sosedi.length) t.push('', 'Соседи на день отчёта:', ...sosedi.map(([a, v]) => `${a}: ${v}`));
  t.push('', 'Рейтинг и число отзывов: Google Maps. История у нас не хранится — сравнивайте с прошлым отчётом в почте.',
         'Внести визиты: ' + ssylkaVizity(k), 'Вставить текст отзыва: ' + ssylkaVstavit(k));
  return vladelcu(k, tema, h.join(''), t.join('\n'));
}

module.exports = { pismoProsba, pismoTrevoga, pismoTrevogaBezTeksta, pismoNeyavki, pismoOtchet, TEKSTY,
                   napisatOtzyv, otzyvyVGoogle, ssylkaKlik, ssylkaOtpiska, ssylkaReshenie, ssylkaVstavit, ssylkaVizity };
