// Подделки для тестов. Правило (урок 26.09, feedback-test-proveryaet-usloviya): подделка ведёт
// себя как НАСТОЯЩИЙ Netlify, а не «всегда работает»:
//   • голый getStore({name}) БРОСАЕТ MissingBlobsEnvironmentError — как на живом стенде Веры;
//   • getStore({name, siteID, token}) работает, строгая согласованность есть (режим API);
//   • после connectLambda(event) getStore({name}) работает, но строгая согласованность бросает
//     BlobsConsistencyError на ПЕРВОМ запросе — так устроен @netlify/blobs 10.7 (edgeURL без uncachedEdgeURL);
//   • set(..., {onlyIfNew:true}) на существующем ключе отдаёт {modified:false}, как API.
// Google: занятость считает и по «чужим» занятым интервалам, и по событиям, которые мы вставили;
// календарь без доступа отдаёт errors, а неизвестный — вообще не попадает в ответ (мина из памяти 25.09).
// Resend: повтор с тем же Idempotency-Key и тем же телом второй раз НЕ отправляет, с другим телом — 409.
// Calendly: страница записи отвечает кодом calendly.kod (по умолчанию 200); calendly.padaet — сеть упала.
//
// Живой путь (Calendly) календаря не знает: окружение по умолчанию — БЕЗ календарных переменных.
// Подделка Google остаётся: ею пользуются тесты отложенной записи (na-potom/tests), а живые тесты
// проверяют по ней, что в Google не ушло ни одного запроса. Свои адреса (прокси /zapis основного
// сайта) отложенные тесты добавляют через dobavitMarshrut.

const crypto = require('crypto');
const path = require('path');

const SITE = path.join(__dirname, '..');

// ── окружение по умолчанию ────────────────────────────────────────────────
const SEKRET = 'test-secret-0123456789abcdef';
const KALENDAR = 'kal-zapisi@group.calendar.google.com';
const ZANYATOST = 'vladelec@example.com';
function okruzhenie() {
  Object.assign(process.env, {
    SITE_ID: 'site-test', EV_BLOBS_TOKEN: 'blobs-token', OTVET_SECRET: SEKRET, RESEND_API_KEY: 're_test',
  });
  delete process.env.GOOGLE_SA_JSON;         // ключ календаря — из хранилища, как на живом сайте
  delete process.env.OTVET_SUHOY;
  delete process.env.NETLIFY_API_TOKEN;
  delete process.env.NETLIFY_SITE_ID;
  delete process.env.URL;
  // Календарные переменные живому пути не нужны — их нет и на живом сайте.
  delete process.env.OTVET_KALENDAR_ID;
  delete process.env.OTVET_KALENDAR_ZANYATOST;
  delete process.env.OTVET_BAZA_URL;
}

// ── часы ──────────────────────────────────────────────────────────────────
let seychas = Date.parse('2026-10-05T15:00:00Z');   // понедельник, 08:00 по Лос-Анджелесу (PDT, UTC−7)
const nastoyashchiyNow = Date.now;
Date.now = () => seychas;
const chasy = { ustanovit(iso) { seychas = Date.parse(iso); }, sdvinut(ms) { seychas += ms; }, get: () => seychas };

// ── Blobs ─────────────────────────────────────────────────────────────────
class MissingBlobsEnvironmentError extends Error { constructor() { super('The environment has not been configured to use Netlify Blobs.'); this.name = 'MissingBlobsEnvironmentError'; } }
class BlobsConsistencyError extends Error { constructor() { super("Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property"); this.name = 'BlobsConsistencyError'; } }

const dannye = new Map();
let lambda = null;
const blobsSchet = { strogoVLambda: 0 };
function magazin(name, strogoNelzya) {
  const kk = (key) => name + '/' + key;
  const proverka = () => { if (strogoNelzya) { blobsSchet.strogoVLambda++; throw new BlobsConsistencyError(); } };
  return {
    async get(key, o) { proverka(); const v = dannye.has(kk(key)) ? dannye.get(kk(key)) : null; return v != null && o && o.type === 'json' ? JSON.parse(v) : v; },
    async set(key, val, o = {}) { proverka(); if (o.onlyIfNew && dannye.has(kk(key))) return { modified: false }; dannye.set(kk(key), String(val)); return { modified: true, etag: '"e"' }; },
    async setJSON(key, val, o) { return this.set(key, JSON.stringify(val), o); },
    async delete(key) { proverka(); dannye.delete(kk(key)); },
  };
}
const blobsModul = {
  connectLambda(event) { const d = JSON.parse(Buffer.from(event.blobs, 'base64').toString('utf8')); lambda = { url: d.url, token: d.token }; },
  getStore(input) {
    const o = typeof input === 'string' ? { name: input } : (input || {});
    if (o.siteID && o.token) return magazin(o.name, false);
    if (lambda) return magazin(o.name, o.consistency === 'strong');
    throw new MissingBlobsEnvironmentError();
  },
};
const resolved = require.resolve('@netlify/blobs', { paths: [SITE] });
require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: blobsModul };
const blobs = {
  dannye, schet: blobsSchet,
  sbros() { dannye.clear(); lambda = null; blobsSchet.strogoVLambda = 0; },
  vzyat(store, key) { const v = dannye.get(store + '/' + key); return v == null ? null : JSON.parse(v); },
  klyuchi(prefix) { return [...dannye.keys()].filter(k => k.startsWith(prefix)); },
  polozhit(store, key, obj) { dannye.set(store + '/' + key, JSON.stringify(obj)); },
  eventBlobs() { return Buffer.from(JSON.stringify({ url: 'https://edge.test', token: 'edge-token' })).toString('base64'); },
};

// Ключ служебного аккаунта кладём в хранилище, как `netlify blobs:set kalendar-klyuch sa` на живом сайте.
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: 'vera-kalendar@test.iam.gserviceaccount.com', private_key_id: 'kid1',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
function polozhitKlyuch() { dannye.set('kalendar-klyuch/sa', SA); }

// ── Google Calendar ───────────────────────────────────────────────────────
const google = {
  zanyato: [],            // [{kal, start, end}] — чужие встречи (основной календарь владельца и т.п.)
  sobytiya: new Map(),    // id → событие в календаре записей
  nedostupny: new Set(),  // календари, по которым freebusy отдаёт errors
  propadaet: new Set(),   // календари, которых нет в ответе вовсе
  publichnye: new Set(),  // календари, открытые всем (публичная выгрузка .ics отвечает 200)
  vstavkaPadaet: false, udaleniePadaet: false, spisokPadaet: false, freebusyPadaet: false,
  posleVstavki: null,     // (событие) => void — например, «Вера записала голосом в ту же секунду»
  vyzovy: [],
  sbros() { this.zanyato = []; this.sobytiya.clear(); this.nedostupny.clear(); this.propadaet.clear(); this.publichnye.clear();
            this.vstavkaPadaet = this.udaleniePadaet = this.spisokPadaet = this.freebusyPadaet = false;
            this.posleVstavki = null; this.vyzovy = []; },
  dobavitSobytie(start, end, extra) {
    const id = 'ev' + crypto.randomBytes(4).toString('hex');
    const e = Object.assign({ id, status: 'confirmed', start: { dateTime: start }, end: { dateTime: end },
                              created: new Date(Date.now()).toISOString(), htmlLink: 'https://calendar.google.com/event?eid=' + id }, extra || {});
    this.sobytiya.set(id, e); return e;
  },
  vstavki() { return this.vyzovy.filter(v => v.metod === 'POST' && /\/events$/.test(v.put)); },
};

// ── Resend ────────────────────────────────────────────────────────────────
const resend = {
  pisma: [], vyzovy: [], klyuchi: new Map(), padaet: false,
  sbros() { this.pisma = []; this.vyzovy = []; this.klyuchi.clear(); this.padaet = false; },
  komu(adres) { return this.pisma.filter(p => (p.to || []).includes(adres)); },
};

function otvetJSON(kod, obj) {
  const t = obj === undefined ? '' : JSON.stringify(obj);
  return { ok: kod >= 200 && kod < 300, status: kod, async json() { return JSON.parse(t || '{}'); }, async text() { return t; } };
}

const calendly = {
  kod: 200, padaet: false, vyzovy: [],
  sbros() { this.kod = 200; this.padaet = false; this.vyzovy = []; },
};

const marshruty = [];   // (u: URL, o) => ответ | undefined — дополнительные адреса отложенных тестов
function dobavitMarshrut(fn) { marshruty.push(fn); }

const sets = [];   // сетевые вызовы мимо известных адресов — тест должен падать, а не молча ходить в сеть
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const metod = (o.method || 'GET').toUpperCase();
  if (u.host === 'oauth2.googleapis.com') return otvetJSON(200, { access_token: 'ya29.test', expires_in: 3600 });
  if (u.host === 'www.googleapis.com') {
    const put = u.pathname.replace('/calendar/v3', '');
    google.vyzovy.push({ metod, put, query: Object.fromEntries(u.searchParams), telo: o.body ? JSON.parse(o.body) : null });
    if (put === '/freeBusy') {
      if (google.freebusyPadaet) return otvetJSON(500, { error: { message: 'backend' } });
      const b = JSON.parse(o.body);
      const calendars = {};
      // Как настоящий freeBusy: отдаёт только занятость, которая ПЕРЕСЕКАЕТ [timeMin, timeMax].
      // Встреча, кончившаяся до timeMin, в ответ не попадает — даже если запас после неё
      // залезает на проверяемое окно (ревью 29.09: без этого подделка прятала дыру в svobodnoLi).
      const tMin = Date.parse(b.timeMin), tMax = Date.parse(b.timeMax);
      const vOkne = (z) => Date.parse(z.start) < tMax && Date.parse(z.end) > tMin;
      for (const { id } of b.items) {
        if (google.propadaet.has(id)) continue;
        if (google.nedostupny.has(id)) { calendars[id] = { errors: [{ domain: 'global', reason: 'notFound' }] }; continue; }
        const busy = google.zanyato.filter(z => z.kal === id).map(z => ({ start: z.start, end: z.end }));
        if (id === KALENDAR) for (const e of google.sobytiya.values()) if (e.status !== 'cancelled' && e.transparency !== 'transparent') busy.push({ start: e.start.dateTime, end: e.end.dateTime });
        calendars[id] = { busy: busy.filter(vOkne) };
      }
      return otvetJSON(200, { kind: 'calendar#freeBusy', calendars });
    }
    const m = put.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (m) {
      const kal = decodeURIComponent(m[1]);
      if (kal !== KALENDAR) return otvetJSON(404, { error: { message: 'Not Found' } });
      if (metod === 'POST') {
        if (google.vstavkaPadaet) return otvetJSON(403, { error: { message: 'forbidden' } });
        const b = JSON.parse(o.body);
        if (b.attendees) return otvetJSON(403, { error: { message: 'forbiddenForServiceAccounts' } });
        const e = google.dobavitSobytie(b.start.dateTime, b.end.dateTime, { summary: b.summary, description: b.description });
        if (google.posleVstavki) google.posleVstavki(e);
        return otvetJSON(200, e);
      }
      if (metod === 'GET') {
        if (google.spisokPadaet) return otvetJSON(500, { error: { message: 'backend' } });
        const ot = Date.parse(u.searchParams.get('timeMin')), do_ = Date.parse(u.searchParams.get('timeMax'));
        const items = [...google.sobytiya.values()].filter(e => Date.parse(e.start.dateTime) < do_ && Date.parse(e.end.dateTime) > ot);
        return otvetJSON(200, { items });
      }
      if (metod === 'DELETE') {
        if (google.udaleniePadaet) return otvetJSON(500, { error: { message: 'backend' } });
        const id = decodeURIComponent(m[2]);
        if (!google.sobytiya.has(id)) return otvetJSON(410, { error: { message: 'Resource has been deleted' } });
        google.sobytiya.delete(id);
        return otvetJSON(204);
      }
    }
    return otvetJSON(404, {});
  }
  if (u.host === 'api.resend.com') {
    const h = o.headers || {};
    const body = String(o.body || '');
    resend.vyzovy.push({ headers: h, body });
    if (resend.padaet) return otvetJSON(500, { message: 'internal' });
    const idem = h['Idempotency-Key'];
    if (idem && resend.klyuchi.has(idem)) {
      const bylo = resend.klyuchi.get(idem);
      return bylo.body === body ? otvetJSON(200, { id: bylo.id }) : otvetJSON(409, { name: 'invalid_idempotent_request' });
    }
    const id = 're_' + crypto.randomBytes(4).toString('hex');
    if (idem) resend.klyuchi.set(idem, { body, id });
    resend.pisma.push(Object.assign(JSON.parse(body), { __idem: idem }));
    return otvetJSON(200, { id });
  }
  // Публичная выгрузка календаря: у открытого всем — 200 text/calendar, у закрытого — 404
  // (проверено живым запросом 29.09 на «Вера-демо» и support@).
  if (u.host === 'calendar.google.com' && /^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(u.pathname)) {
    const id = decodeURIComponent(u.pathname.split('/')[3]);
    return google.publichnye.has(id) ? otvetJSON(200, 'BEGIN:VCALENDAR') : otvetJSON(404, 'Not Found');
  }
  // Страница записи в Calendly (ссылка из паспорта). Проверяет её только zdorovie.
  if (u.host === 'calendly.com') {
    calendly.vyzovy.push({ metod, url: String(url) });
    if (calendly.padaet) throw new Error('getaddrinfo ENOTFOUND calendly.com');
    return { ok: calendly.kod >= 200 && calendly.kod < 300, status: calendly.kod, async text() { return '<html>calendly</html>'; } };
  }
  for (const m of marshruty) { const r = await m(u, o); if (r) return r; }
  sets.push(String(url));
  throw new Error('тест пошёл в сеть: ' + url);
};

// ── вызовы функций ────────────────────────────────────────────────────────
const fZayavka = () => require(path.join(SITE, 'netlify-functions/zayavka-background.js'));

async function zayavka(telo, o = {}) {
  const headers = { 'content-type': 'application/json' };
  if (o.sekret !== null) headers['x-otvet-secret'] = o.sekret === undefined ? SEKRET : o.sekret;
  const ev = { httpMethod: 'POST', headers, body: JSON.stringify(telo) };
  if (o.blobs) ev.blobs = blobs.eventBlobs();
  const r = await fZayavka().handler(ev);
  return JSON.parse(r.body);
}

function sbrosVsego() { okruzhenie(); blobs.sbros(); google.sbros(); resend.sbros(); calendly.sbros(); polozhitKlyuch(); chasy.ustanovit('2026-10-05T15:00:00Z'); }

okruzhenie();
polozhitKlyuch();

module.exports = { SITE, SEKRET, KALENDAR, ZANYATOST, chasy, blobs, blobsModul, google, resend, calendly, sets, zayavka,
                   dobavitMarshrut, sbrosVsego, okruzhenie, polozhitKlyuch, nastoyashchiyNow };
