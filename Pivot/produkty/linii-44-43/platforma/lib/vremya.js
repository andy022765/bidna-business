'use strict';
// Время клиента: пояс America/New_York по умолчанию, ISO 8601 со смещением пояса,
// человекочитаемое время на EN / ES / RU для реплик агента, писем и SMS.
//
// ПОЧЕМУ БЕЗ БИБЛИОТЕК. Нужны три вещи: местные час и день, момент UTC для «такого-то часа
// по местному времени» и фраза. Intl в Node 20 умеет всё это сам, включая переход на летнее
// время — таблица смещений устарела бы, а Intl знает правила из ICU.
// Арифметика поясов — из kalendar-lib/gkal.js Веры (проверена живыми записями 25–26.09).

const POYAS = 'America/New_York';

// Часы для тестов и прогонов: global.__PLATFORMA_SEYCHAS__ = число мс или Date.
function seychas() {
  const g = globalThis.__PLATFORMA_SEYCHAS__;
  if (typeof g === 'number' && Number.isFinite(g)) return g;
  if (g instanceof Date) return g.getTime();
  return Date.now();
}

const keshFormatov = new Map();
function format(poyas, lokal, opcii) {
  const k = poyas + '|' + lokal + '|' + JSON.stringify(opcii);
  let f = keshFormatov.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(lokal, Object.assign({ timeZone: poyas }, opcii));
    keshFormatov.set(k, f);
  }
  return f;
}
function chasti(f, d) {
  const p = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return p;
}

const NEDELYA = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Какие это день и час по местному времени. dn: 1 — понедельник … 7 — воскресенье.
function mestnoe(d, poyas = POYAS) {
  const p = chasti(format(poyas, 'en-US', {
    hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }), new Date(d));
  return { god: +p.year, mes: +p.month, den: +p.day, chas: (+p.hour) % 24,
           minuta: +p.minute, sekunda: +p.second, dn: NEDELYA[p.weekday] };
}

// Сколько минут пояс отстоит от UTC в этот момент (Нью-Йорк: −240 летом, −300 зимой).
function smeshchenie(d, poyas = POYAS) {
  const t = new Date(d).getTime();
  const m = mestnoe(t, poyas);
  const kak = Date.UTC(m.god, m.mes - 1, m.den, m.chas, m.minuta, m.sekunda);
  return Math.round((kak - Math.floor(t / 1000) * 1000) / 60000);
}

// Момент UTC для «такого-то числа, такого-то часа по местному времени». Два прохода:
// первый по смещению этого момента в UTC, второй — по смещению найденного. Без второго
// прохода в день перевода часов время уезжает на час.
function mestnoeVUTC(god, mes, den, chas, minuta, poyas = POYAS) {
  const naivno = Date.UTC(god, mes - 1, den, chas, minuta);
  let t = naivno;
  for (let i = 0; i < 3; i++) {
    const novoe = naivno - smeshchenie(t, poyas) * 60000;
    if (novoe === t) break;
    t = novoe;
  }
  return new Date(t);
}

const dva = (n) => String(n).padStart(2, '0');

// ISO 8601 со смещением пояса клиента: 2026-10-02T10:00:00-04:00.
function iso(d, poyas = POYAS) {
  const t = new Date(d);
  const m = mestnoe(t, poyas);
  const sm = smeshchenie(t, poyas);
  const znak = sm < 0 ? '-' : '+';
  const a = Math.abs(sm);
  return `${m.god}-${dva(m.mes)}-${dva(m.den)}T${dva(m.chas)}:${dva(m.minuta)}:${dva(m.sekunda)}`
       + `${znak}${dva(Math.floor(a / 60))}:${dva(a % 60)}`;
}

// Дата по местному времени — ключ журнала и сводки: 2026-10-02.
function denKlyuch(d, poyas = POYAS) {
  const m = mestnoe(d, poyas);
  return `${m.god}-${dva(m.mes)}-${dva(m.den)}`;
}

// 'YYYY-MM-DD' → {god, mes, den} или null.
function razobratDatu(s) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!r) return null;
  const god = +r[1], mes = +r[2], den = +r[3];
  const proverka = new Date(Date.UTC(god, mes - 1, den));
  if (proverka.getUTCFullYear() !== god || proverka.getUTCMonth() !== mes - 1 || proverka.getUTCDate() !== den) return null;
  return { god, mes, den };
}

// Местная полночь дня 'YYYY-MM-DD' как момент UTC.
function nachaloDnya(denStr, poyas = POYAS) {
  const d = razobratDatu(denStr);
  if (!d) return null;
  return mestnoeVUTC(d.god, d.mes, d.den, 0, 0, poyas);
}

// Разбор времени, которое прислала модель или календарь: ISO с поясом или без
// (без пояса — считаем местным временем клиента, а не UTC сервера).
function razobratVremya(s, poyas = POYAS) {
  const str = String(s || '').trim();
  if (!str) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) {
    const t = Date.parse(str);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  const r = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (!r) return null;
  return mestnoeVUTC(+r[1], +r[2], +r[3], +r[4], +r[5], poyas);
}

const YAZYKI = ['en', 'es', 'ru'];
function yazykIli(yazyk, zapas = 'en') {
  const y = String(yazyk || '').trim().toLowerCase().slice(0, 2);
  return YAZYKI.includes(y) ? y : zapas;
}

// «Friday, October 2 at 10:00 AM» · «viernes 2 de octubre a las 10:00 de la mañana» ·
// «пятница, 2 октября, в 10:00». Время — в поясе клиента: звонящий и агентство договариваются
// об одном времени, и называть его надо одним.
function tekst(d, yazyk = 'en', poyas = POYAS) {
  const t = new Date(d);
  const y = yazykIli(yazyk);
  const m = mestnoe(t, poyas);
  const mm = dva(m.minuta);
  if (y === 'ru') {
    const dn = format(poyas, 'ru-RU', { weekday: 'long' }).format(t);
    const dm = format(poyas, 'ru-RU', { day: 'numeric', month: 'long' }).format(t);
    return `${dn}, ${dm}, в ${m.chas}:${mm}`;
  }
  const h12 = m.chas % 12 === 0 ? 12 : m.chas % 12;
  if (y === 'es') {
    const dn = format(poyas, 'es-US', { weekday: 'long' }).format(t);
    const dm = format(poyas, 'es-US', { day: 'numeric', month: 'long' }).format(t);
    const chast = m.chas < 12 ? 'de la mañana' : m.chas < 19 ? 'de la tarde' : 'de la noche';
    const predlog = h12 === 1 ? 'a la' : 'a las';
    return `${dn} ${dm} ${predlog} ${h12}:${mm} ${chast}`;
  }
  const dn = format(poyas, 'en-US', { weekday: 'long' }).format(t);
  const dm = format(poyas, 'en-US', { month: 'long', day: 'numeric' }).format(t);
  return `${dn}, ${dm} at ${h12}:${mm} ${m.chas < 12 ? 'AM' : 'PM'}`;
}

// Короткая форма для SMS и сводки: «Fri Oct 2, 6:00 PM» · «vie 2 oct, 6:00 p. m.» · «пт 2 окт, 18:00».
function korotko(d, yazyk = 'en', poyas = POYAS) {
  const t = new Date(d);
  const y = yazykIli(yazyk);
  const m = mestnoe(t, poyas);
  const mm = dva(m.minuta);
  const h12 = m.chas % 12 === 0 ? 12 : m.chas % 12;
  if (y === 'ru') {
    const dn = format(poyas, 'ru-RU', { weekday: 'short' }).format(t);
    const dm = format(poyas, 'ru-RU', { day: 'numeric', month: 'short' }).format(t).replace(/\.$/, '');
    return `${dn} ${dm}, ${m.chas}:${mm}`;
  }
  if (y === 'es') {
    const dn = format(poyas, 'es-US', { weekday: 'short' }).format(t).replace(/\.$/, '');
    const dm = format(poyas, 'es-US', { day: 'numeric', month: 'short' }).format(t).replace(/\.$/, '');
    return `${dn} ${dm}, ${h12}:${mm} ${m.chas < 12 ? 'a. m.' : 'p. m.'}`;
  }
  const dn = format(poyas, 'en-US', { weekday: 'short' }).format(t);
  const dm = format(poyas, 'en-US', { month: 'short', day: 'numeric' }).format(t);
  return `${dn} ${dm}, ${h12}:${mm} ${m.chas < 12 ? 'AM' : 'PM'}`;
}

// Только часы: «6:00 PM» · «6:00 p. m.» · «18:00».
function chasy(d, yazyk = 'en', poyas = POYAS) {
  const m = mestnoe(d, poyas);
  const y = yazykIli(yazyk);
  const mm = dva(m.minuta);
  if (y === 'ru') return `${m.chas}:${mm}`;
  const h12 = m.chas % 12 === 0 ? 12 : m.chas % 12;
  return `${h12}:${mm} ${m.chas < 12 ? (y === 'es' ? 'a. m.' : 'AM') : (y === 'es' ? 'p. m.' : 'PM')}`;
}

// В рабочие ли часы момент: {chas_ot, chas_do, dni[1..7]} по местному времени.
function vRabocheeVremya(d, okno, poyas = POYAS) {
  if (!okno) return true;
  const m = mestnoe(d, poyas);
  const dni = Array.isArray(okno.dni) && okno.dni.length ? okno.dni : [1, 2, 3, 4, 5, 6, 7];
  if (!dni.includes(m.dn)) return false;
  const h = m.chas + m.minuta / 60;
  return h >= Number(okno.chas_ot ?? 0) && h < Number(okno.chas_do ?? 24);
}

// Местная дата «сегодня + sdvig дней» по поясу клиента: 'YYYY-MM-DD'. Календарная арифметика в полдень UTC —
// без часов и перевода времени (1 ноября — ровно один раз).
function denSdvig(d, sdvig = 0, poyas = POYAS) {
  const m = mestnoe(d, poyas);
  return new Date(Date.UTC(m.god, m.mes - 1, m.den + sdvig, 12)).toISOString().slice(0, 10);
}

// ── переменные агента на старте звонка (vhod → register-call) ───────────────
// KONTRAKT.md, «Дополнения care», НОВОЕ 30.09: статус офиса и календарь считает стенд — модель без рассуждений
// время не сравнивает и дни недели не считает (прогоны: «закрыто» в среду 15:40, «пятница, третье» принято за пятницу).
//
// kalendar — РОВНО формат chasy() из care/progony/progon.py, на нём гонялись все прогоны:
// «Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; …», 14 дней. Один и тот же,
// по-английски, для всех трёх языков: пресеты ES и RU читают тот же {{kalendar}} (у агента одна переменная на разговор,
// язык меняется посреди звонка), и прогоны ES/RU шли с английским календарём.
function kalendarDney(d = seychas(), poyas = POYAS, dney = 14) {
  const m = mestnoe(d, poyas);
  const out = [];
  for (let i = 0; i < dney; i++) {
    const den = new Date(Date.UTC(m.god, m.mes - 1, m.den + i, 12));
    const metka = i === 0 ? ' (today)' : i === 1 ? ' (tomorrow)' : '';
    out.push(`${format('UTC', 'en-US', { weekday: 'long' }).format(den)} ${format('UTC', 'en-US', { month: 'long' }).format(den)} ${den.getUTCDate()}${metka}`);
  }
  return out.join('; ');
}

// {ofis_seychas, kalendar} для conversation_initiation_client_data.dynamic_variables.
// ofis_seychas — OPEN / CLOSED по часам офиса клиента: nastroyki.perevod.chasy (часы из листа правды, пн–пт,
// 09:00 ≤ t < 17:00 по поясу клиента). Часов в настройках нет — переменную не передаём: у агента пустая заглушка,
// и он считает сам по {{system__time}} (хуже, но звонок не ломается). Строки — других типов переменных агент не ждёт.
function peremennyeZvonka(klient, d = seychas()) {
  const poyas = (klient && klient.poyas) || POYAS;
  const chasyOfisa = klient && klient.perevod && klient.perevod.chasy;
  const out = {};
  if (chasyOfisa && typeof chasyOfisa === 'object') out.ofis_seychas = vRabocheeVremya(d, chasyOfisa, poyas) ? 'OPEN' : 'CLOSED';
  out.kalendar = kalendarDney(d, poyas);
  return out;
}

module.exports = {
  POYAS, seychas, mestnoe, smeshchenie, mestnoeVUTC, iso, denKlyuch, razobratDatu, nachaloDnya,
  razobratVremya, yazykIli, tekst, korotko, chasy, vRabocheeVremya, YAZYKI,
  denSdvig, kalendarDney, peremennyeZvonka,
};
