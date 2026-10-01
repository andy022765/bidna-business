// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Страница подтверждения записи. Одна вёрстка на все состояния: подтвердить · записано ·
// уже записаны · время заняли/прошло (с новыми окнами) · ссылка не найдена · сбой.
//
// Никаких внешних файлов, скриптов и шрифтов: страница должна открываться в почтовом
// браузере телефона на плохой связи. Всё, что пришло извне, экранируется.

const P = require('../../lib/pisma');
const PZ = require('./pisma-zapis');

const T = {
  ru: {
    podtverdit_h: 'Подтвердите звонок', podtverdit_b: 'Подтвердить звонок',
    podtverdit_p: 'Письмо с подтверждением придёт на {pochta}.',
    zapisano_h: 'Записано', zapisano_p: 'Письмо с подтверждением ушло на {pochta}.',
    zapisano_bez_pisma: 'Встреча записана, а письмо с подтверждением не ушло. Ответьте на наше письмо — пришлём.',
    uzhe_h: 'Вы уже записаны', uzhe_p: 'Перенести или отменить — ответьте на наше письмо.',
    idet_h: 'Запись уже оформляется', idet_p: 'Похоже, кнопку нажали дважды. Обновите страницу через минуту.',
    zanyato_h: 'Это время только что заняли', isteklo_h: 'Это время уже прошло',
    drugoe: 'Выберите другое ({poyas}):',
    bez_okon: 'Свободного времени сейчас не видно. Ответьте на наше письмо — подберём.',
    net_h: 'Ссылка не найдена', net_p: 'Возможно, она устарела. Ответьте на наше письмо — подберём время.',
    oshibka_h: 'Не получилось записать', oshibka_p: 'Ничего не записано. Ответьте на наше письмо — запишем вручную.',
    zvonok: 'Звонок: {vremya} ({poyas}), {dlina} минут.',
  },
  en: {
    podtverdit_h: 'Confirm your call', podtverdit_b: 'Confirm the call',
    podtverdit_p: 'A confirmation will go to {pochta}.',
    zapisano_h: 'Booked', zapisano_p: 'A confirmation went to {pochta}.',
    zapisano_bez_pisma: 'The call is booked, but the confirmation email did not go out. Reply to our email and we will send it.',
    uzhe_h: 'You are already booked', uzhe_p: 'To move or cancel, reply to our email.',
    idet_h: 'Your booking is going through', idet_p: 'Looks like the button was pressed twice. Refresh this page in a minute.',
    zanyato_h: 'That time was just taken', isteklo_h: 'That time has passed',
    drugoe: 'Pick another ({poyas}):',
    bez_okon: 'No open times are showing right now. Reply to our email and we will find one.',
    net_h: 'Link not found', net_p: 'It may have expired. Reply to our email and we will find a time.',
    oshibka_h: 'Could not book it', oshibka_p: 'Nothing was booked. Reply to our email and we will book you by hand.',
    zvonok: 'Call: {vremya} ({poyas}), {dlina} minutes.',
  },
};

// a***@gmail.com — чтобы по пересланной ссылке чужой не прочитал адрес целиком.
function maska(pochta) {
  const [l, d] = String(pochta || '').split('@');
  if (!d) return '';
  return (l.length <= 2 ? l[0] + '*' : l[0] + '***' + l.slice(-1)) + '@' + d;
}

const ZAGOLOVKI = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
  // no-referrer обязателен: токен живёт в адресе страницы и не должен уехать дальше.
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function stranica(k, y, { zagolovok, abzacy = [], knopka = null, okna = null, kod = 200 }) {
  const e = P.ekranHtml;
  const biz = k.biznes.imya;
  const telo = [];
  for (const a of abzacy) if (a) telo.push(`<p>${e(a)}</p>`);
  if (knopka) telo.push(`<form method="post" action="/zapis"><input type="hidden" name="t" value="${e(knopka.token)}"><button type="submit">${e(knopka.tekst)}</button></form>`);
  if (okna) {
    if (okna.ssylki.length) {
      telo.push(`<p>${e(P.podstavit(T[y].drugoe, { poyas: k.kalendar['poyas_' + y] }))}</p>`);
      for (const s of okna.ssylki) telo.push(`<form method="post" action="/zapis"><input type="hidden" name="t" value="${e(s.token)}"><button type="submit" class="vtor">${e(PZ.vremya(s.slot, k, y))}</button></form>`);
    } else telo.push(`<p>${e(T[y].bez_okon)}</p>`);
  }
  const html = `<!doctype html><html lang="${y}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${e(zagolovok)} · ${e(biz)}</title>
<style>
:root{--fon:#f6f4ef;--tekst:#1a1a2e;--tusk:#5f6472;--ram:#d9d4c8;--kn:#1a1a2e;--kn-t:#fff}
@media (prefers-color-scheme:dark){:root{--fon:#14141c;--tekst:#ecebe6;--tusk:#a4a7b2;--ram:#34343f;--kn:#ecebe6;--kn-t:#14141c}}
*{box-sizing:border-box}body{margin:0;background:var(--fon);color:var(--tekst);font:17px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif}
main{max-width:520px;margin:0 auto;padding:40px 16px 56px}
.biz{font-size:14px;letter-spacing:.04em;text-transform:uppercase;color:var(--tusk);margin:0 0 18px}
h1{font-size:28px;line-height:1.2;margin:0 0 16px}
p{margin:0 0 14px}
form{margin:0 0 10px}
button{width:100%;min-height:52px;padding:12px 18px;border-radius:12px;border:1px solid var(--kn);background:var(--kn);color:var(--kn-t);font-family:inherit;font-size:17px;font-weight:600;line-height:1.3;cursor:pointer}
button.vtor{background:transparent;color:var(--tekst);border-color:var(--ram)}
</style></head><body><main data-otvet="zapis"><p class="biz">${e(biz)}</p><h1>${e(zagolovok)}</h1>${telo.join('\n')}</main></body></html>`;
  return { statusCode: kod, headers: ZAGOLOVKI, body: html };
}

module.exports = { T, stranica, maska, ZAGOLOVKI };
