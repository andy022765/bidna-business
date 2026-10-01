// Подписанные ссылки: отписка, клик по кнопке отзыва, страницы владельца. HMAC-SHA256 на секрете
// OTZYVY_SECRET (от 32 знаков). В ссылке — назначение (c), клиент (k), что именно (v), срок (e).
//
// СЕКРЕТ НЕ МЕНЯТЬ ПРОСТО ТАК: ссылки отписки в уже ушедших письмах обязаны работать (CAN-SPAM —
// не меньше 30 дней). При смене старый кладётся в OTZYVY_SECRET_STARYY: проверка принимает оба,
// подпись новых — только новым.
//
// Почта в ссылки не попадает: отписка держится на отпечатке адреса (heshPochty), пересланное письмо
// адреса не раскрывает.

const crypto = require('crypto');

const b64u = (s) => Buffer.from(s).toString('base64url');
function sekrety() {
  return [process.env.OTZYVY_SECRET, process.env.OTZYVY_SECRET_STARYY].filter(s => s && s.length >= 32);
}
const mac = (sekret, telo) => crypto.createHmac('sha256', sekret).update(telo).digest('base64url').slice(0, 27);

function podpisat(dannye) {
  const [s] = sekrety();
  if (!s) throw new Error('нет OTZYVY_SECRET (от 32 знаков)');
  const telo = b64u(JSON.stringify(dannye));
  return telo + '.' + mac(s, telo);
}

// Вернёт данные или null: подпись не сошлась, назначение не то, срок вышел, мусор.
function proverit(token, naznachenie) {
  const t = String(token || '');
  if (t.length > 600) return null;
  const [telo, podp] = t.split('.');
  if (!telo || !podp) return null;
  const ok = sekrety().some(s => {
    const a = Buffer.from(mac(s, telo)), b = Buffer.from(podp);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) return null;
  let d = null;
  try { d = JSON.parse(Buffer.from(telo, 'base64url').toString('utf8')); } catch (_) { return null; }
  if (!d || typeof d !== 'object' || d.c !== naznachenie) return null;
  if (d.e && Date.now() / 1000 > d.e) return null;
  return d;
}

// Отпечаток адреса: постоянный (не зависит от секрета), чтобы отписка пережила смену секрета.
function heshPochty(pochta) {
  return crypto.createHash('sha256').update('otzyvy|' + String(pochta || '').trim().toLowerCase()).digest('hex').slice(0, 32);
}

const srok = (dney) => Math.floor(Date.now() / 1000) + Math.round(dney * 86400);

module.exports = { podpisat, proverit, heshPochty, srok, sekrety };
