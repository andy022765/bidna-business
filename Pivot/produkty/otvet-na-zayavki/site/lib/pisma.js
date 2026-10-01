// Письма: ответ человеку (цены + ссылка на запись) и письмо владельцу «ответ ушёл». Отправка через Resend.
//
// ЗАПИСЬ НА ЗВОНОК — по ссылке из паспорта (ssylka_zapisi, у нас Calendly; решение Андрея 29.09
// ~18:05). Своих окон, подтверждения с .ics и писем «Записался» в живом пути нет: они отложены
// в na-potom/lib/pisma-zapis.js и в выкладку не входят.
//
// ЧТО ПОПАДАЕТ В ПИСЬМО ЧЕЛОВЕКУ. Только текст и ссылки из карточки. Его собственное сообщение
// в ответ НЕ возвращается: форма публичная, и чужой текст с нашего домена с подписью DKIM —
// готовая заготовка для фишинга. По той же причине имя пропускаем только похожее на имя: буквы,
// пробел, апостроф, дефис, без точки (урок ревью 15.09 №1 в pismo.js: «оплатите на evil.com»
// почтовики сами делают ссылкой). Почту и имя в ссылку Calendly НЕ подставляем: пересланное
// письмо не должно раскрывать адрес, а поля в Calendly человек заполнит сам.
//
// КИРИЛЛИЦА. Тело запроса уходит чистым ASCII (\uXXXX): иначе fetch в функции падал
// с «Cannot convert argument to a ByteString». Приём из submission-created.js основного сайта.
//
// ДУБЛИ. У каждого письма ключ Idempotency-Key на заявку: повтор фоновой функции или двойная
// отправка формы не дают второго письма даже там, где хранилище промолчало.
//
// ХОЛОСТОЙ РЕЖИМ. OTVET_SUHOY=1 — всё как обычно, но в Resend ничего не уходит: для первой
// выкладки и прогонов.

const IMYA_OK = /^[\p{L}][\p{L}\p{M} '’-]{0,39}$/u;
function chistoeImya(s) {
  const v = String(s || '').trim().replace(/\s+/g, ' ');
  return IMYA_OK.test(v) && v.split(' ').length <= 3 ? v : '';
}

const ekranHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const vASCII = (raw) => {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    out += c > 127 ? '\\u' + ('000' + c.toString(16)).slice(-4) : raw[i];
  }
  return out;
};

const podstavit = (shablon, zn) => String(shablon || '').replace(/\{(\w+)\}/g, (m, k) => (k in zn ? zn[k] : m));

// taymautMs: у страницы записи (na-potom/, обычная функция, стена 10 с) ждём меньше, чем у фоновой.
async function poslat(pismo, idemKey, taymautMs) {
  if (process.env.OTVET_SUHOY === '1') {
    console.log('[pisma] ХОЛОСТОЙ режим, не отправляю:', pismo.subject, '→', (pismo.to || []).join(','));
    return { ok: true, suhoy: true, kod: 0, id: null };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[pisma] нет RESEND_API_KEY, письмо не ушло:', pismo.subject); return { ok: false, kod: 0, oshibka: 'нет RESEND_API_KEY' }; }
  const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  if (idemKey) headers['Idempotency-Key'] = String(idemKey).slice(0, 256);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), taymautMs || 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers, body: vASCII(JSON.stringify(pismo)), signal: ctrl.signal });
    const t = await r.text();
    let d = {}; try { d = JSON.parse(t); } catch (_) {}
    // 409 по ключу повтора: письмо с этим ключом уже уходило (или уходит). Это не сбой, а защита от дубля.
    if (r.status === 409 && idemKey) { console.log('[pisma] уже отправляли по ключу', idemKey); return { ok: true, povtor: true, kod: 409, id: null }; }
    if (!r.ok) console.log('[pisma] Resend отказал:', r.status, t.slice(0, 200));
    return { ok: r.ok, kod: r.status, id: d.id || null, oshibka: r.ok ? '' : t.slice(0, 200) };
  } catch (e) {
    console.log('[pisma] отправка упала:', e.message);
    return { ok: false, kod: 0, oshibka: e.name === 'AbortError' ? 'таймаут ' + Math.round((taymautMs || 8000) / 1000) + ' с' : e.message };
  } finally { clearTimeout(tm); }
}

const tx = (k, klyuch, y) => k.teksty[klyuch + '_' + y];
const privetDlya = (y, imya) => y === 'ru' ? (imya ? `Здравствуйте, ${imya}!` : 'Здравствуйте!') : (imya ? `Hi ${imya},` : 'Hello,');

// ── ответ человеку ─────────────────────────────────────────────────────────
// Цены продукта, которым человек интересовался (страница формы → продукт), и кнопка на запись.
function pismoOtvet(k, lid) {
  const y = lid.yazyk;
  const p = k.produkty[lid.produkt] || k.produkty.obshchiy;
  const privet = privetDlya(y, chistoeImya(lid.imya));
  const zapis = k.ssylka_zapisi;

  const t = [privet, '', tx(k, 'vstuplenie', y), ''];
  if (lid.est_vopros) t.push(tx(k, 'est_vopros', y), '');
  t.push(p['zagolovok_' + y] + ':');
  for (const c of p['ceny_' + y]) t.push('— ' + c);
  t.push(tx(k, 'podrobnee', y) + ': ' + p['stranica_' + y], '');
  t.push(tx(k, 'zapis', y), zapis, '');
  t.push(tx(k, 'raskrytie', y), '', '—', k.biznes['podpis_' + y]);

  const shr = 'font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1a2e;max-width:560px';
  const knopka = 'display:inline-block;padding:14px 26px;border-radius:10px;background:#1a1a2e;color:#ffffff;text-decoration:none;font-weight:600';
  const h = [`<div style="${shr}">`, `<p>${ekranHtml(privet)}</p>`, `<p>${ekranHtml(tx(k, 'vstuplenie', y))}</p>`];
  if (lid.est_vopros) h.push(`<p>${ekranHtml(tx(k, 'est_vopros', y))}</p>`);
  h.push(`<p style="margin-bottom:6px"><b>${ekranHtml(p['zagolovok_' + y])}</b></p><ul style="margin-top:0;padding-left:20px">`);
  for (const c of p['ceny_' + y]) h.push(`<li>${ekranHtml(c)}</li>`);
  h.push(`</ul><p><a href="${ekranHtml(p['stranica_' + y])}" style="color:#1a1a2e">${ekranHtml(tx(k, 'podrobnee', y))} →</a></p>`);
  h.push(`<p style="margin-top:22px">${ekranHtml(tx(k, 'zapis', y))}</p>`,
         `<p style="margin:0 0 22px"><a href="${ekranHtml(zapis)}" style="${knopka}">${ekranHtml(tx(k, 'knopka_zapisi', y))}</a></p>`);
  h.push(`<p style="color:#5f6472;font-size:14px">${ekranHtml(tx(k, 'raskrytie', y))}</p>`,
         `<p style="color:#5f6472;font-size:14px">${ekranHtml(k.biznes['podpis_' + y])}</p></div>`);

  return { from: k.pochta.ot, to: [lid.pochta], reply_to: [k.pochta.otvet_na],
           subject: tx(k, 'tema_otveta', y), text: t.join('\n'), html: h.join('') };
}

// ── владельцу (по-русски) ──────────────────────────────────────────────────
const NAZVANIE = { vera: 'Вера', vidimost: 'Видимость', diagnostika: 'Диагностика', obshchiy: 'без продукта (общие цены)' };
const podvalVladelcu = (k, z) => `\n\nПаспорт ${k.klient} · версия ${k.versiya} · хэш ${k.__hesh} · заявка ${z}`;

function pismoVladelcuOtvet(k, lid, r) {
  // r: { otvet: {ok,kod,suhoy,oshibka}, sekund, pismo, posledneeSegodnya }
  const kuda = lid.pochta;
  const tema = r.otvet.ok ? `Заявка → ответ ушёл за ${r.sekund} с: ${kuda}` : `Заявка → ОТВЕТ НЕ УШЁЛ: ${kuda}`;
  const t = [
    r.otvet.ok
      ? (r.otvet.suhoy ? 'ХОЛОСТОЙ РЕЖИМ (OTVET_SUHOY=1): письмо человеку собрано, но не отправлено.' : `Ответ человеку ушёл через ${r.sekund} с после приёма заявки.`)
      : `Ответ человеку НЕ ушёл: ${r.otvet.oshibka || r.otvet.kod}. Напишите ему сами и дайте ссылку на запись: ${k.ssylka_zapisi}`,
    '',
    'Имя: ' + (lid.imya || '—'),
    'Почта: ' + lid.pochta,
    'Телефон: ' + (lid.telefon || '—'),
    'Форма: ' + (lid.forma || '—') + ' · страница: ' + (lid.stranica || '—'),
    'Интерес: ' + (NAZVANIE[lid.produkt] || lid.produkt) + ' · язык ответа: ' + lid.yazyk,
  ];
  if (lid.soobshchenie) t.push('', 'Его сообщение (в ответ ему НЕ повторяли):', lid.soobshchenie);
  t.push('', 'Время выбирает сам по ссылке на запись: ' + k.ssylka_zapisi,
         'Запишется — это покажет Calendly (его уведомление, не наше). Не запишется — догоняем сами.');
  if (r.posledneeSegodnya) t.push('', `Это последнее письмо о заявках сегодня: предел ${k.pochta.vladelcu_v_sutki} в сутки. Заявки дальше обрабатываются, но писем о них до полуночи (UTC) не будет — смотрите журнал функции zayavka-background.`);
  t.push('', '──────── что ушло человеку ────────', r.pismo ? r.pismo.text : '(не собрано)');
  return { from: k.pochta.ot, to: k.pochta.vladelcu, reply_to: [lid.pochta], subject: tema, text: t.join('\n') + podvalVladelcu(k, lid.z) };
}

module.exports = { poslat, pismoOtvet, pismoVladelcuOtvet, chistoeImya, ekranHtml, vASCII, podstavit, NAZVANIE, podvalVladelcu };
