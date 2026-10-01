'use strict';
// Календарь клиента: свободные окна и запись. Google Calendar через служебный аккаунт — порт
// kalendar-lib/gkal.js Веры (JWT без googleapis, freebusy + своя сетка часов), но настройки не из
// переменных окружения, а из nastroyki.json клиента и по типу встречи (sobesedovanie / ocenka).
// Все поля задаются явно: у Веры умолчание часа в коде (10) разошлось со стендом (9) — 25.09.
//
// ЧТО ПЕРЕНЕСЕНО ИЗ ГРАБЛЕЙ ВЕРЫ:
//   - freebusy молча выбрасывает календарь без доступа (ошибки приходят по каждому календарю при
//     общем 200) — любая ошибка или отсутствие календаря = отказ целиком, окна не предлагаем;
//   - пишем только в календарь, которым поделились (kalendar), никогда не в primary;
//   - гостя в событие не ставим: служебному аккаунту Google отвечает 403 forbiddenForServiceAccounts;
//   - ключ служебного аккаунта не в переменной (потолок 4 КБ на все переменные Lambda), а в Blobs
//     `kalendar-klyuch` / `sa`; GOOGLE_SA_JSON — запасной путь.
//
// АДАПТЕР. Всё, что ходит в Google, — за интерфейсом {zanyatost, sozdat, udalit, sobytiya}.
// Тесты и локальный прогон берут feykKalendar (KALENDAR_ADAPTER=feyk или ustanovitAdapter).

const crypto = require('crypto');
const { hranilishcheImeni } = require('./hranilishche');
const { seychas, mestnoe, mestnoeVUTC, nachaloDnya, POYAS } = require('./vremya');

const OBLAST = 'https://www.googleapis.com/auth/calendar';
const BAZA = 'https://www.googleapis.com/calendar/v3';
const METKA_NASHIH = 'platforma_bron';   // extendedProperties.private: так узнаём свои события

// ── тип встречи ────────────────────────────────────────────────────────────
// sobesedovanie — собеседование кандидата (A1), ocenka — оценка ухода на дому для семьи (A2).
function tipVstrechi(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'sobesedovanie' || s === 'ocenka') return s;
  if (/interview|entrevista|собесед/.test(s)) return 'sobesedovanie';
  if (/assess|evalua|оцен/.test(s)) return 'ocenka';
  return null;
}

// ── настройки типа встречи ─────────────────────────────────────────────────
function nastroykiKalendarya(klient, tip) {
  const k = (klient && klient.kalendari && klient.kalendari[tip]) || null;
  if (!k) return null;
  const chislo = (v, zapas) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? zapas : Number(v));
  return {
    tip,
    kalendar: String(k.kalendar || ''),
    zanyatost: (Array.isArray(k.zanyatost) ? k.zanyatost : []).map(String).filter(Boolean),
    poyas: klient.poyas || POYAS,
    ot: chislo(k.chas_ot, 9),
    do: chislo(k.chas_do, 17),
    dni: Array.isArray(k.dni) && k.dni.length ? k.dni.map(Number) : [1, 2, 3, 4, 5],
    dlina: chislo(k.dlina_min, 30),
    zapas: chislo(k.zapas_min, 10),
    ne_ranshe: chislo(k.ne_ranshe_chasov, 2),
    vpered: chislo(k.vpered_dney, 10),
    okon_v_otvete: chislo(k.okon_v_otvete, 2),
  };
}

// ── Google ─────────────────────────────────────────────────────────────────
let keshKlyucha = null;
let keshTokena = { token: null, do: 0 };

async function klyuchSA() {
  if (keshKlyucha) return keshKlyucha;
  let syroe = process.env.GOOGLE_SA_JSON || '';
  if (!syroe) {
    const st = hranilishcheImeni('kalendar-klyuch');
    if (!st) throw new Error('хранилище ключа не поднялось');
    syroe = (await st.get('sa')) || '';
  }
  if (!syroe) throw new Error('ключа служебного аккаунта нет ни в переменной, ни в хранилище');
  const k = JSON.parse(syroe);
  if (!k.private_key || !k.client_email) throw new Error('в ключе нет private_key или client_email');
  keshKlyucha = k;
  return k;
}

const b64 = (s) => Buffer.from(s).toString('base64url');

async function tokenGoogle() {
  const teper = Date.now();
  if (keshTokena.token && teper < keshTokena.do - 60000) return keshTokena.token;
  const k = await klyuchSA();
  const sek = Math.floor(teper / 1000);
  const zag = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: k.private_key_id }));
  const telo = b64(JSON.stringify({ iss: k.client_email, scope: OBLAST, aud: 'https://oauth2.googleapis.com/token',
                                    iat: sek, exp: sek + 3600 }));
  const podpis = crypto.createSign('RSA-SHA256').update(zag + '.' + telo).sign(k.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                assertion: `${zag}.${telo}.${podpis}` }).toString(),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('Google не выдал токен: ' + r.status);
  keshTokena = { token: d.access_token, do: teper + (d.expires_in || 3600) * 1000 };
  return keshTokena.token;
}

async function gapi(put, telo, metod) {
  const r = await fetch(BAZA + put, {
    method: metod || (telo ? 'POST' : 'GET'),
    headers: { Authorization: 'Bearer ' + (await tokenGoogle()), 'content-type': 'application/json' },
    body: telo ? JSON.stringify(telo) : undefined,
  });
  const text = await r.text();
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch (_) { d = { syroe: text.slice(0, 200) }; }
  return { kod: r.status, telo: d };
}

const googleAdapter = {
  imya: 'google',
  // {kod, kalendari: {id: {zanyato:[{ot,do}]} | {oshibka}}}
  async zanyatost(ids, ot, do_, poyas) {
    const { kod, telo } = await gapi('/freeBusy', {
      timeMin: new Date(ot).toISOString(), timeMax: new Date(do_).toISOString(), timeZone: poyas,
      items: ids.map((id) => ({ id })),
    });
    if (kod !== 200) return { kod, oshibka: (telo.error && telo.error.message) || 'Google не ответил' };
    const kalendari = {};
    for (const id of ids) {
      const k = (telo.calendars || {})[id];
      if (!k) { kalendari[id] = { oshibka: 'нет в ответе' }; continue; }
      if (k.errors && k.errors.length) { kalendari[id] = { oshibka: k.errors.map((e) => e.reason).join(', ') }; continue; }
      kalendari[id] = { zanyato: (k.busy || []).map((b) => ({ ot: Date.parse(b.start), do: Date.parse(b.end) })) };
    }
    return { kod: 200, kalendari };
  },
  async sozdat(kalendar, sobytie) {
    const { kod, telo } = await gapi('/calendars/' + encodeURIComponent(kalendar) + '/events', sobytie);
    return kod === 200 && telo.id ? { kod, id: telo.id, created: telo.created || null } : { kod, oshibka: (telo.error && telo.error.message) || 'Google отказал' };
  },
  async udalit(kalendar, id) {
    const { kod } = await gapi('/calendars/' + encodeURIComponent(kalendar) + '/events/' + encodeURIComponent(id), null, 'DELETE');
    return { kod };
  },
  // Только НАШИ события в интервале (по метке в extendedProperties).
  async sobytiya(kalendar, ot, do_) {
    const q = new URLSearchParams({ timeMin: new Date(ot).toISOString(), timeMax: new Date(do_).toISOString(),
      singleEvents: 'true', showDeleted: 'false', privateExtendedProperty: METKA_NASHIH + '=1', maxResults: '50' });
    const { kod, telo } = await gapi('/calendars/' + encodeURIComponent(kalendar) + '/events?' + q.toString());
    if (kod !== 200) return { kod, oshibka: 'список событий не прочитался' };
    return { kod, sobytiya: (telo.items || []).map((e) => ({
      id: e.id, created: e.created || null,
      start: Date.parse((e.start && (e.start.dateTime || e.start.date)) || ''),
      end: Date.parse((e.end && (e.end.dateTime || e.end.date)) || ''),
      privatnoe: (e.extendedProperties && e.extendedProperties.private) || {},
    })) };
  },
};

// ── фейковый календарь (тесты, локальный прогон) ───────────────────────────
// nachalo: { '<id>': { zanyato: [{ot, do}] (ISO или мс), oshibka?: 'notFound' } }
function feykKalendar(nachalo = {}) {
  const kalendari = {};
  for (const [id, v] of Object.entries(nachalo)) {
    kalendari[id] = { oshibka: v.oshibka || null,
      zanyato: (v.zanyato || []).map((z) => ({ ot: new Date(z.ot).getTime(), do: new Date(z.do).getTime() })),
      sobytiya: [] };
  }
  let n = 0;
  const f = {
    imya: 'feyk',
    kalendari,
    vyzovy: { sozdat: 0, udalit: 0, zanyatost: 0 },
    otkaz: null,        // 'zanyatost' | 'sozdat' — сломать нарочно
    lag: false,         // true — занятость «не видит» только что созданных событий (как отставание freebusy)
    async zanyatost(ids, ot, do_) {
      f.vyzovy.zanyatost++;
      if (f.otkaz === 'zanyatost') return { kod: 503, oshibka: 'feyk: сломан' };
      const out = {};
      for (const id of ids) {
        const k = kalendari[id];
        if (!k) { out[id] = { oshibka: 'notFound' }; continue; }
        if (k.oshibka) { out[id] = { oshibka: k.oshibka }; continue; }
        const vse = k.zanyato.concat(f.lag ? [] : k.sobytiya.map((e) => ({ ot: e.start, do: e.end })));
        out[id] = { zanyato: vse.filter((z) => z.ot < new Date(do_).getTime() && z.do > new Date(ot).getTime()) };
      }
      return { kod: 200, kalendari: out };
    },
    async sozdat(kalendar, sobytie) {
      f.vyzovy.sozdat++;
      if (f.otkaz === 'sozdat') return { kod: 500, oshibka: 'feyk: сломан' };
      const k = kalendari[kalendar];
      if (!k) return { kod: 404, oshibka: 'notFound' };
      const id = 'feyk' + (++n) + crypto.randomBytes(2).toString('hex');
      const created = new Date(seychas() + n).toISOString();   // порядок создания различим
      k.sobytiya.push({ id, created, start: Date.parse(sobytie.start.dateTime), end: Date.parse(sobytie.end.dateTime),
        summary: sobytie.summary, description: sobytie.description,
        privatnoe: (sobytie.extendedProperties && sobytie.extendedProperties.private) || {} });
      return { kod: 200, id, created };
    },
    async udalit(kalendar, id) {
      f.vyzovy.udalit++;
      const k = kalendari[kalendar];
      if (!k) return { kod: 404 };
      const i = k.sobytiya.findIndex((e) => e.id === id);
      if (i >= 0) k.sobytiya.splice(i, 1);
      return { kod: i >= 0 ? 204 : 404 };
    },
    async sobytiya(kalendar, ot, do_) {
      const k = kalendari[kalendar];
      if (!k) return { kod: 404, oshibka: 'notFound' };
      const a = new Date(ot).getTime(), b = new Date(do_).getTime();
      return { kod: 200, sobytiya: k.sobytiya
        .filter((e) => e.privatnoe[METKA_NASHIH] === '1' && e.start < b && e.end > a)
        .map((e) => ({ id: e.id, created: e.created, start: e.start, end: e.end, privatnoe: e.privatnoe })) };
    },
  };
  return f;
}

let adapterVruchnuyu = null;
let obshchiyFeyk = null;
function ustanovitAdapter(a) { adapterVruchnuyu = a || null; }
function adapter() {
  if (adapterVruchnuyu) return adapterVruchnuyu;
  if (String(process.env.KALENDAR_ADAPTER || '').toLowerCase() === 'feyk') {
    if (!obshchiyFeyk) obshchiyFeyk = feykKalendar();
    return obshchiyFeyk;
  }
  return googleAdapter;
}

// ── свободные окна ─────────────────────────────────────────────────────────
// Занятость — у календаря (наш календарь записи + все, чем клиент поделился на «свободен/занят»),
// сетку часов строим сами: пустой календарь объявил бы свободными три часа ночи.
// {kod:200, okna:[Date], poyas} | {kod, oshibka}
async function svobodnyeOkna(n, { dataS = null, teper = seychas(), maks = 24 } = {}) {
  if (!n || !n.kalendar) return { kod: 0, oshibka: 'календарь не подключён' };
  const a = adapter();
  let ot = new Date(teper + n.ne_ranshe * 3600e3);
  const potolok = teper + 31 * 864e5;
  if (dataS) {
    const nd = nachaloDnya(dataS, n.poyas);
    if (nd && nd.getTime() > ot.getTime()) ot = nd;
  }
  const doMs = Math.min(ot.getTime() + n.vpered * 864e5, potolok);
  if (doMs <= ot.getTime()) return { kod: 200, okna: [], poyas: n.poyas };
  const do_ = new Date(doMs);

  const spisok = [n.kalendar, ...n.zanyatost.filter((x) => x !== n.kalendar)];
  const z = await a.zanyatost(spisok, ot, do_, n.poyas);
  if (z.kod !== 200) return { kod: z.kod || 0, oshibka: z.oshibka || 'календарь не ответил' };
  const zanyato = [];
  const bityye = [];
  for (const id of spisok) {
    const k = z.kalendari[id];
    if (!k || k.oshibka) { bityye.push(id + ': ' + ((k && k.oshibka) || 'нет в ответе')); continue; }
    for (const b of k.zanyato) zanyato.push({ ot: b.ot - n.zapas * 60000, do: b.do + n.zapas * 60000 });
  }
  if (bityye.length) return { kod: 403, oshibka: 'календарь не отдал занятость: ' + bityye.join(' · ') };

  const okna = [];
  const shag = n.dlina / 60;
  // Идём по КАЛЕНДАРНЫМ датам пояса клиента, а не прибавляем по 24 часа: накануне перехода
  // на летнее время сутки короче, и «+24 ч» от позднего вечера перепрыгнуло бы целый день.
  const d0 = mestnoe(ot, n.poyas);
  const dney = Math.ceil((doMs - ot.getTime()) / 864e5) + 1;
  for (let i = 0; i <= dney && okna.length < maks; i++) {
    const u = new Date(Date.UTC(d0.god, d0.mes - 1, d0.den + i, 12));
    const den = { god: u.getUTCFullYear(), mes: u.getUTCMonth() + 1, den: u.getUTCDate(), dn: ((u.getUTCDay() + 6) % 7) + 1 };
    if (!n.dni.includes(den.dn)) continue;
    for (let chas = n.ot; chas + shag <= n.do + 1e-9; chas += shag) {
      const nachalo = mestnoeVUTC(den.god, den.mes, den.den, Math.floor(chas), Math.round((chas % 1) * 60), n.poyas);
      const konec = new Date(nachalo.getTime() + n.dlina * 60000);
      if (nachalo.getTime() < ot.getTime() || konec.getTime() > doMs) continue;
      if (zanyato.some((x) => nachalo.getTime() < x.do && konec.getTime() > x.ot)) continue;
      if (!okna.some((o) => o.getTime() === nachalo.getTime())) okna.push(nachalo);
      if (okna.length >= maks) break;
    }
  }
  okna.sort((x, y) => x - y);
  return { kod: 200, okna, poyas: n.poyas };
}

// Событие записи. Имя и телефон — в заголовке и описании (гостя поставить нельзя), метка «наше».
function sobytieZapisi(n, { start, conversation_id, zagolovok, opisanie, klyuchBroni }) {
  const konec = new Date(start.getTime() + n.dlina * 60000);
  return {
    summary: zagolovok,
    description: opisanie,
    start: { dateTime: start.toISOString(), timeZone: n.poyas },
    end: { dateTime: konec.toISOString(), timeZone: n.poyas },
    extendedProperties: { private: { [METKA_NASHIH]: '1', bron: String(klyuchBroni || ''), razgovor: String(conversation_id || '') } },
  };
}

module.exports = {
  tipVstrechi, nastroykiKalendarya, svobodnyeOkna, sobytieZapisi, feykKalendar, ustanovitAdapter, adapter, googleAdapter,
  METKA_NASHIH,
  klyuchSA,   // для теста scripts/zalit-klyuch-kalendarya.js: стенд читает ключ ровно оттуда, куда его кладёт скрипт
};
