// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Календарная часть проверки после выкладки — то, что до 29.09 ~18:05 делала функция zdorovie.
// Живая zdorovie календарь не требует. На возврате своей записи: zdorovie зовёт proverkaZapisi(k)
// и добавляет её ok к своему.
//
// Что проверяет: календарная часть паспорта цела; календарь читает занятость и какие три окна
// предложил бы сейчас; календарь записей ЗАКРЫТ (грабля ревью 29.09: единственный календарь,
// которым уже поделились со служебным аккаунтом, — «Вера-демо», и он открыт всем; взять его
// «потому что уже работает» — выложить почты лидов в интернет); ссылки из писем открывают НАШУ
// страницу /zapis, а не 404 основного сайта (нет строки-прокси в его _redirects).

const G = require('./gkal');
const O = require('./tekst-okna');
const KZ = require('./kartochka-zapis');

// true — календарь открыт всем, false — закрыт, null — проверить не удалось (сеть).
async function publichnyyLi(id) {
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch('https://calendar.google.com/calendar/ical/' + encodeURIComponent(id) + '/public/basic.ics',
      { signal: ctrl.signal, redirect: 'manual' });
    if (r.status === 200) return true;
    if (r.status === 404 || r.status === 403 || r.status === 401) return false;   // проверено 29.09: закрытый → 404
    return null;
  } catch (_) { return null; } finally { clearTimeout(tm); }
}

// k — склеенный паспорт (KZ.vzyat()).
async function proverkaZapisi(k) {
  const out = {
    problemy: KZ.proveritZapis(k),
    peremennye: {
      OTVET_KALENDAR_ID: !!process.env.OTVET_KALENDAR_ID,
      OTVET_KALENDAR_ZANYATOST: String(process.env.OTVET_KALENDAR_ZANYATOST || '').split(',').filter(Boolean).length,
      OTVET_BAZA_URL: process.env.OTVET_BAZA_URL || process.env.URL || '',
    },
  };
  const dop = KZ.dopKalendarya(k);
  if (dop.kalendar) {
    const r = await O.triOkna(dop, k.kalendar.skolko_okon);
    out.kalendar = r.ok ? { ok: true, okna: r.okna.map(x => G.slovami(x, dop.poyas, true)) } : { ok: false, oshibka: r.oshibka };
    const pub = await publichnyyLi(dop.kalendar);
    if (pub !== false) out.kalendar = { ok: false, okna: out.kalendar.okna, oshibka: pub
      ? 'календарь записей ПУБЛИЧНЫЙ: имена и почты людей видны всем — нужен отдельный закрытый календарь'
      : 'не удалось проверить, закрыт ли календарь записей' };
  } else out.kalendar = { ok: false, oshibka: 'нет OTVET_KALENDAR_ID' };
  // Спрашиваем заведомо несуществующий токен и ждём НАШУ страницу «ссылка не найдена»
  // (метка data-otvet), а не чужую 404.
  const baza = String(process.env.OTVET_BAZA_URL || process.env.URL || '').replace(/\/+$/, '');
  if (baza) {
    try {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(baza + '/zapis?t=proverka-zdorovya', { signal: ctrl.signal, headers: { 'accept-language': 'ru' } });
      clearTimeout(tm);
      const t = await r.text();
      out.ssylki = t.includes('data-otvet="zapis"') ? { ok: true, baza } : { ok: false, baza, kod: r.status,
        oshibka: 'по адресу открывается не страница записи — нет прокси /zapis на основном сайте или неверный OTVET_BAZA_URL' };
    } catch (e) { out.ssylki = { ok: false, baza, oshibka: e.message }; }
  } else out.ssylki = { ok: false, oshibka: 'нет OTVET_BAZA_URL' };
  out.ok = !!(!out.problemy.length && out.kalendar.ok && out.ssylki.ok);
  return out;
}

module.exports = { proverkaZapisi, publichnyyLi };
