'use strict';
// Время для движков №44 (zamena.js, evv.js): разбор ISO и выгрузок EVV, местная дата и начало недели
// в поясе клиента. Свой модуль, а не lib/vremya.js стенда: движки не должны ломаться от правок обвязки.
// Без библиотек: Intl в Node 20 знает правила перехода на летнее время.

const POYAS = 'America/New_York';
const formaty = new Map();
const DNI = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const dva = (n) => String(n).padStart(2, '0');

function format(poyas) {
  let f = formaty.get(poyas);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: poyas, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formaty.set(poyas, f);
  }
  return f;
}

// Местные части момента: y, m, d, h, mi, s; dn — день недели 0 (вс) … 6 (сб).
function chasti(ms, poyas = POYAS) {
  const o = {};
  for (const p of format(poyas).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, dn: DNI[o.weekday] };
}

// На сколько минут пояс отстоит от UTC в этот момент (Нью-Йорк летом −240).
function smeshchenieMin(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  const kakUtc = Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s);
  return Math.round((kakUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

// Момент для «такого-то местного времени». Второй проход нужен в дни перевода часов.
function izMestnogo(y, m, d, h = 0, mi = 0, s = 0, poyas = POYAS) {
  const kakUtc = Date.UTC(y, m - 1, d, h, mi, s);
  let ms = kakUtc - smeshchenieMin(kakUtc, poyas) * 60000;
  ms = kakUtc - smeshchenieMin(ms, poyas) * 60000;
  return ms;
}

function vIso(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  const sm = smeshchenieMin(ms, poyas);
  const a = Math.abs(sm);
  return `${c.y}-${dva(c.m)}-${dva(c.d)}T${dva(c.h)}:${dva(c.mi)}:${dva(c.s)}${sm < 0 ? '-' : '+'}${dva(Math.floor(a / 60))}:${dva(a % 60)}`;
}

function mestnayaData(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  return `${c.y}-${dva(c.m)}-${dva(c.d)}`;
}

function chchmm(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  return `${dva(c.h)}:${dva(c.mi)}`;
}

// 'YYYY-MM-DD' ± дни.
function sdvigDaty(data, dney) {
  const [y, m, d] = String(data).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dney));
  return `${t.getUTCFullYear()}-${dva(t.getUTCMonth() + 1)}-${dva(t.getUTCDate())}`;
}

// Начало недели (местная дата) для даты 'YYYY-MM-DD'; pervyyDen: 1 — понедельник, 0 — воскресенье.
function nachaloNedeliDaty(data, pervyyDen = 1) {
  const [y, m, d] = String(data).split('-').map(Number);
  const dn = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return sdvigDaty(data, -((dn - pervyyDen + 7) % 7));
}

function nachaloNedeli(ms, poyas = POYAS, pervyyDen = 1) {
  return nachaloNedeliDaty(mestnayaData(ms, poyas), pervyyDen);
}

function chas12(h, ampm) {
  if (!ampm) return h;
  if (h < 1 || h > 12) return NaN;
  const pm = /p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

function izChastey(y, mo, d, h, mi, s, poyas) {
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h >= 0 && h <= 23 && mi >= 0 && mi <= 59 && s >= 0 && s <= 59)) return NaN;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return NaN;
  return izMestnogo(y, mo, d, h, mi, s, poyas);
}

// Значение времени → миллисекунды (NaN, если пусто или не читается). Понимает:
// число мс, Date, ISO со смещением или Z; «YYYY-MM-DD HH:MM[:SS]» и ISO без смещения — местное время пояса
// (так пишет выгрузка HHAeXchange); «MM/DD/YYYY hh:mm[:ss] AM/PM» и «MM/DD/YYYY HH:MM» (экспорт в Excel).
function vMs(v, poyas = POYAS) {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v instanceof Date) return v.getTime();
  const s = String(v).trim();
  if (!s) return NaN;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
  }
  let r = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]\.?M\.?)?$/i.exec(s);
  if (r) return izChastey(+r[1], +r[2], +r[3], chas12(+r[4], r[7]), +r[5], +(r[6] || 0), poyas);
  r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]\.?M\.?)?$/i.exec(s);
  if (r) return izChastey(+r[3], +r[1], +r[2], chas12(+r[4], r[7]), +r[5], +(r[6] || 0), poyas);
  return NaN;
}

// Дата без времени → 'YYYY-MM-DD' или null. Понимает 'YYYY-MM-DD' и 'MM/DD/YYYY'.
function razobratDatu(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let y, mo, d, r;
  if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) { y = +r[1]; mo = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { y = +r[3]; mo = +r[1]; d = +r[2]; }
  else return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${dva(mo)}-${dva(d)}`;
}

// «Сейчас» для случаев, когда вызывающий время не передал. Уважает часы тестов стенда
// (globalThis.__PLATFORMA_SEYCHAS__, как lib/vremya.js), иначе — системные.
function teper() {
  const g = globalThis.__PLATFORMA_SEYCHAS__;
  if (typeof g === 'number' && Number.isFinite(g)) return g;
  if (g instanceof Date) return g.getTime();
  return Date.now();
}

module.exports = {
  POYAS, chasti, smeshchenieMin, izMestnogo, vIso, vMs, mestnayaData, chchmm, sdvigDaty,
  nachaloNedeli, nachaloNedeliDaty, razobratDatu, teper,
};
