// Время по поясу бизнеса. Арифметика поясов — из gkal.js Веры (побайтная копия, lib/gkal.js):
// смещение считает Intl, поэтому переход на летнее время берётся из базы поясов, а не из таблицы.
// Своей второй арифметики поясов здесь нет — только окно писем поверх неё.

const { mestnoe, mestnoeVUTC } = require('./gkal');

const DEN_MS = 864e5;

// Календарная дата + n дней (без поясов: чистый календарь).
function denPlus(d, n) {
  const x = new Date(Date.UTC(d.god, d.mes - 1, d.den + n));
  return { god: x.getUTCFullYear(), mes: x.getUTCMonth() + 1, den: x.getUTCDate() };
}
// 1 — понедельник, 7 — воскресенье.
function dnNedeli(d) { const w = new Date(Date.UTC(d.god, d.mes - 1, d.den)).getUTCDay(); return w === 0 ? 7 : w; }

// Можно ли слать письмо посетителю в момент t: день из списка и час в [okno_s, okno_do).
function vOkne(t, p, poyas) {
  const m = mestnoe(new Date(t), poyas);
  return p.dni.includes(m.dn) && m.chas >= p.okno_s && m.chas < p.okno_do;
}

// Ближайший момент не раньше t, когда письмо можно отправить. Вечернее уходит утром.
function sleduyushcheeOkno(t, p, poyas) {
  if (vOkne(t, p, poyas)) return t;
  const m = mestnoe(new Date(t), poyas);
  const segodnya = { god: m.god, mes: m.mes, den: m.den };
  if (m.chas < p.okno_s && p.dni.includes(m.dn)) return +mestnoeVUTC(segodnya.god, segodnya.mes, segodnya.den, p.okno_s, 0, poyas);
  for (let i = 1; i <= 8; i++) {
    const d = denPlus(segodnya, i);
    if (p.dni.includes(dnNedeli(d))) return +mestnoeVUTC(d.god, d.mes, d.den, p.okno_s, 0, poyas);
  }
  return t + DEN_MS;   // недостижимо при непустом списке дней; на всякий случай — сутки
}

const dva = (n) => String(n).padStart(2, '0');
function mestnyyDen(t, poyas) { const m = mestnoe(new Date(t), poyas); return `${m.god}-${dva(m.mes)}-${dva(m.den)}`; }
function mestnyyMesyac(t, poyas) { return mestnyyDen(t, poyas).slice(0, 7); }
function utcDen(t) { return new Date(t).toISOString().slice(0, 10); }
function proshlyyMesyac(mesyac) {
  const [g, m] = mesyac.split('-').map(Number);
  return m === 1 ? `${g - 1}-12` : `${g}-${dva(m - 1)}`;
}
// «29.09, 14:10» по поясу бизнеса — для писем владельцу.
function korotko(t, poyas) {
  const m = mestnoe(new Date(t), poyas);
  return `${dva(m.den)}.${dva(m.mes)}, ${dva(m.chas)}:${dva(m.minuta)}`;
}
// Момент начала местного дня (для «YYYY-MM-DD HH:MM» из формы владельца).
function izMestnogo(god, mes, den, chas, minuta, poyas) { return +mestnoeVUTC(god, mes, den, chas, minuta, poyas); }

module.exports = { vOkne, sleduyushcheeOkno, mestnyyDen, mestnyyMesyac, utcDen, proshlyyMesyac, korotko, izMestnogo,
                   denPlus, dnNedeli, DEN_MS, mestnoe };
