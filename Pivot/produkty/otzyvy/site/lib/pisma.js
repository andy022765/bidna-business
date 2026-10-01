// Отправка писем через ОТДЕЛЬНЫЙ аккаунт Resend (PLAN-DLYA-ANDREYA п. 6.9а): утренняя пачка просьб
// не съест общий суточный предел и не остановит подтверждения записи у Веры, а отскок просьбы
// не попадёт в вебхук Веры и не превратится в «человек ждёт письма».
//
// Ключ — OTZYVY_RESEND_KEY (не RESEND_API_KEY: на сайте Веры под этим именем живёт ключ основного
// аккаунта, и перепутать их при переносе переменных легко).
//
// КИРИЛЛИЦА. Тело запроса уходит чистым ASCII (\uXXXX): иначе fetch в функции падал
// с «Cannot convert argument to a ByteString». Приём из основного сайта и «ответа на заявки».
//
// ДУБЛИ. У каждого письма ключ Idempotency-Key: повтор после сбоя посреди прогона не даёт второго
// письма даже там, где хранилище промолчало. Resend держит ключ сутки.
//
// ХОЛОСТОЙ РЕЖИМ. OTZYVY_SUHOY=1 на сайте или rezhim: "suhoy" в паспорте — письмо собирается
// целиком, в журнале видно, кому и что ушло бы, но в Resend не уходит ничего.

const vASCII = (raw) => {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    out += c > 127 ? '\\u' + ('000' + c.toString(16)).slice(-4) : raw[i];
  }
  return out;
};

const ekranHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Имя в письме: только то, что похоже на имя (урок ревью 15.09 в pismo.js Веры: «оплатите на evil.com»
// почтовики сами делают ссылкой). Берём первое слово — «Hi Maria», не «Hi Maria Lopez-Garcia».
const IMYA_OK = /^[\p{L}][\p{L}\p{M}'’-]{0,29}$/u;
function imyaDlyaPisma(s) {
  const pervoe = String(s || '').trim().split(/\s+/)[0] || '';
  return IMYA_OK.test(pervoe) ? pervoe : '';
}

// Ответ Resend об ошибке может повторять адрес получателя: в журнал функции и в запись визита — без него.
const bezPochty = (t) => String(t || '').replace(/[^\s"'<>,;:()\[\]]+@[^\s"'<>,;:()\[\]]+/g, '<почта>');

function suhoyLi(k) { return process.env.OTZYVY_SUHOY === '1' || !k || k.rezhim !== 'boevoy'; }

async function poslat(pismo, idemKey, o = {}) {
  if (o.suhoy) {
    console.log('[pisma] ХОЛОСТОЙ режим, не отправляю:', pismo.subject);
    return { ok: true, suhoy: true, kod: 0, id: null };
  }
  const key = process.env.OTZYVY_RESEND_KEY;
  if (!key) { console.log('[pisma] нет OTZYVY_RESEND_KEY, письмо не ушло:', pismo.subject); return { ok: false, kod: 0, oshibka: 'нет OTZYVY_RESEND_KEY' }; }
  const headers = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  if (idemKey) headers['Idempotency-Key'] = String(idemKey).slice(0, 256);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), o.taymautMs || 8000);
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers, body: vASCII(JSON.stringify(pismo)), signal: ctrl.signal });
    const t = await r.text();
    let d = {}; try { d = JSON.parse(t); } catch (_) {}
    // 409 по ключу повтора: письмо с этим ключом уже уходило. Это не сбой, а защита от дубля.
    if (r.status === 409 && idemKey) { console.log('[pisma] уже отправляли по ключу', idemKey); return { ok: true, povtor: true, kod: 409, id: null }; }
    if (!r.ok) console.log('[pisma] Resend отказал:', r.status, bezPochty(t).slice(0, 200));
    return { ok: r.ok, kod: r.status, id: d.id || null, limit: r.status === 429, oshibka: r.ok ? '' : bezPochty(t).slice(0, 200) };
  } catch (e) {
    console.log('[pisma] отправка упала:', bezPochty(e.message));
    return { ok: false, kod: 0, oshibka: e.name === 'AbortError' ? 'таймаут' : bezPochty(e.message) };
  } finally { clearTimeout(tm); }
}

// Адреса отправителей. Поддомен reviews.* — отдельный от основного (PLAN-V1 п. 3): его DNS-записи
// добавляются к девяти существующим, ни одну из них не трогая.
const otAdres = () => process.env.OTZYVY_OT_ADRES || 'thanks@reviews.businessinteldna.com';
const otVladelcu = () => process.env.OTZYVY_OT_VLADELCU || 'Business Intelligence DNA <otzyvy@reviews.businessinteldna.com>';
const otvetNashi = () => process.env.OTZYVY_NASH_ADRES || 'support@businessinteldna.com';
const baza = () => String(process.env.OTZYVY_BAZA_URL || '').replace(/\/+$/, '');

module.exports = { poslat, vASCII, ekranHtml, imyaDlyaPisma, suhoyLi, otAdres, otVladelcu, otvetNashi, baza, bezPochty };
