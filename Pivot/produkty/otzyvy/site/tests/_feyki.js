// Подделки для тестов. Правило (урок 26.09, feedback-test-proveryaet-usloviya): подделка ведёт себя
// как НАСТОЯЩИЙ сервис, а не «всегда работает»:
//   • Blobs: голый getStore({name}) БРОСАЕТ, как на живом стенде; по siteID+токену — работает, и у каждого
//     сайта свои данные (хранилище Веры — на её сайте, наше — на нашем); onlyIfNew на существующем ключе
//     отдаёт {modified:false}; list({prefix}) отдаёт ключи; можно «сломать» чтение ключей по шаблону.
//   • Google Calendar: список с showDeleted отдаёт удалённые как status:"cancelled", стёртое событие — 404;
//     окно timeMin/timeMax — по пересечению, как у Google; страницы по maxResults.
//   • Resend: повтор с тем же Idempotency-Key и тем же телом второй раз НЕ отправляет, с другим — 409.
//   • Places: отдаёт только поля из X-Goog-FieldMask; каждый вызов записан.
//   • Anthropic: настоящий SDK поверх подделки fetch — проверяется и форма запроса, и разбор ответа.
// Любой другой адрес — тест падает: в сеть тесты не ходят.

const crypto = require('crypto');
const path = require('path');

const SITE = path.join(__dirname, '..');
const NASH_SAYT = 'site-otzyvy';
const SAYT_VERY = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const KALENDAR = 'kal-acme@group.calendar.google.com';
const ADMIN = 'admin-klyuch-0123456789abcdef-xyz';
const BAZA = 'https://otzyvy-test.netlify.app';

function okruzhenie() {
  for (const k of Object.keys(process.env)) if (k.startsWith('OTZYVY_')) delete process.env[k];
  Object.assign(process.env, {
    SITE_ID: NASH_SAYT, EV_BLOBS_TOKEN: 'blobs-token',
    OTZYVY_SECRET: 'sekret-dlya-testov-0123456789abcdef0123', OTZYVY_KLYUCH_ADMINA: ADMIN,
    OTZYVY_RESEND_KEY: 're_test', OTZYVY_PLACES_KEY: 'places-test', OTZYVY_ANTHROPIC_KEY: 'sk-ant-test',
    OTZYVY_BAZA_URL: BAZA, URL: BAZA, OTZYVY_PAUZA_MS: '0',
  });
  delete process.env.GOOGLE_SA_JSON;
  delete process.env.NETLIFY_API_TOKEN;
  delete process.env.NETLIFY_SITE_ID;
  delete process.env.ANTHROPIC_API_KEY;
}

// ── часы ──────────────────────────────────────────────────────────────────
// Понедельник 05.10.2026, 08:00 по Лос-Анджелесу (PDT, UTC−7).
const NACHALO = '2026-10-05T15:00:00Z';
let seychas = Date.parse(NACHALO);
Date.now = () => seychas;
const chasy = { ustanovit(iso) { seychas = Date.parse(iso); }, sdvinut(ms) { seychas += ms; }, get: () => seychas };
const CHAS = 3600e3, DEN = 864e5;

// ── Blobs ─────────────────────────────────────────────────────────────────
class MissingBlobsEnvironmentError extends Error { constructor() { super('The environment has not been configured to use Netlify Blobs.'); this.name = 'MissingBlobsEnvironmentError'; } }
const dannye = new Map();                 // `${site}|${store}/${key}` → строка
const lomka = { chtenie: null, zapis: null, spisok: false };   // RegExp по ключу — чтение/запись бросает
let lambda = null;
function magazin(site, name) {
  const kk = (key) => `${site}|${name}/${key}`;
  return {
    async get(key) { if (lomka.chtenie && lomka.chtenie.test(key)) throw new Error('blobs read failed'); return dannye.has(kk(key)) ? dannye.get(kk(key)) : null; },
    async set(key, val, o = {}) {
      if (lomka.zapis && lomka.zapis.test(key)) throw new Error('blobs write failed');
      if (o.onlyIfNew && dannye.has(kk(key))) return { modified: false };
      dannye.set(kk(key), String(val)); return { modified: true, etag: '"e"' };
    },
    async delete(key) { dannye.delete(kk(key)); },
    async list(o = {}) {
      if (lomka.spisok) throw new Error('blobs list failed');
      const pre = `${site}|${name}/` + (o.prefix || '');
      const blobs = [...dannye.keys()].filter(x => x.startsWith(pre)).map(x => ({ key: x.slice(`${site}|${name}/`.length), etag: '"e"' }));
      return { blobs, directories: [] };
    },
  };
}
const blobsModul = {
  connectLambda(event) { JSON.parse(Buffer.from(event.blobs, 'base64').toString('utf8')); lambda = true; },
  getStore(input) {
    const o = typeof input === 'string' ? { name: input } : (input || {});
    if (o.siteID && o.token) return magazin(o.siteID, o.name);
    if (lambda) return magazin(NASH_SAYT, o.name);
    throw new MissingBlobsEnvironmentError();
  },
};
const resolved = require.resolve('@netlify/blobs', { paths: [SITE] });
require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: blobsModul };
const blobs = {
  dannye, lomka,
  sbros() { dannye.clear(); lambda = null; lomka.chtenie = null; lomka.zapis = null; lomka.spisok = false; },
  vzyat(key, site = NASH_SAYT, store = 'otzyvy') { const v = dannye.get(`${site}|${store}/${key}`); return v == null ? null : JSON.parse(v); },
  polozhit(key, obj, site = NASH_SAYT, store = 'otzyvy') { dannye.set(`${site}|${store}/${key}`, typeof obj === 'string' ? obj : JSON.stringify(obj)); },
  klyuchi(prefix, site = NASH_SAYT, store = 'otzyvy') { const p = `${site}|${store}/`; return [...dannye.keys()].filter(x => x.startsWith(p + prefix)).map(x => x.slice(p.length)); },
  metkaVery(eventId, obj) { dannye.set(`${SAYT_VERY}|golos-pisma/otzyvy-vizit:${eventId}`, JSON.stringify(obj)); },
  vklyuchit(da = true) { dannye.set(`${NASH_SAYT}|otzyvy/nastroyki/vyklyuchatel`, JSON.stringify({ vklyucheno: da, kto: 'test' })); },
};
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA = JSON.stringify({ client_email: 'vera-kalendar@test.iam.gserviceaccount.com', private_key_id: 'kid1',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
function polozhitKlyuch() { dannye.set(`${NASH_SAYT}|kalendar-klyuch/sa`, SA); }

// ── Google Calendar ───────────────────────────────────────────────────────
const google = {
  kalendari: new Map(),     // id календаря → Map(id события → событие)
  nedostupny: new Set(), publichnye: new Set(), padaet: false, vyzovy: [],
  sbros() { this.kalendari.clear(); this.nedostupny.clear(); this.publichnye.clear(); this.padaet = false; this.vyzovy = []; },
  kal(id) { if (!this.kalendari.has(id)) this.kalendari.set(id, new Map()); return this.kalendari.get(id); },
  // Визит: начало и конец в ISO. extra — summary, description, attendees…
  vizit(start, end, extra, kal = KALENDAR) {
    const id = 'ev' + crypto.randomBytes(5).toString('hex');
    const e = Object.assign({ id, status: 'confirmed', summary: 'Visit · Maria', start: { dateTime: start }, end: { dateTime: end },
      description: 'Booked by Vera, the voice agent.\nName: Maria' }, extra || {});
    this.kal(kal).set(id, e); return e;
  },
  otmenit(id, kal = KALENDAR) { const e = this.kal(kal).get(id); e.status = 'cancelled'; },
  steret(id, kal = KALENDAR) { this.kal(kal).delete(id); },
  perenesti(id, start, end, kal = KALENDAR) { const e = this.kal(kal).get(id); e.start = { dateTime: start }; e.end = { dateTime: end }; },
  pereimenovat(id, summary, kal = KALENDAR) { this.kal(kal).get(id).summary = summary; },
};

// ── Resend ────────────────────────────────────────────────────────────────
const resend = {
  pisma: [], vyzovy: [], klyuchi: new Map(), padaet: false, kod: 0,
  sbros() { this.pisma = []; this.vyzovy = []; this.klyuchi.clear(); this.padaet = false; this.kod = 0; },
  komu(adres) { return this.pisma.filter(p => (p.to || []).includes(adres)); },
};

// ── Places ────────────────────────────────────────────────────────────────
const places = {
  karty: new Map(), vyzovy: [], padaet: false,
  sbros() { this.karty.clear(); this.vyzovy = []; this.padaet = false; },
  postavit(placeId, rating, count) { this.karty.set(placeId, { rating, userRatingCount: count, reviews: [{ text: 'NE DOLZHNO UTECH' }], displayName: { text: 'X' } }); },
};

// ── Anthropic ─────────────────────────────────────────────────────────────
const anthropic = {
  vyzovy: [], otvet: 'Hi John, thank you for telling us, and we are sorry about the wait. Please reach out to us directly so we can make it right. — Acme Auto Care',
  stop: 'end_turn', kod: 200,
  sbros() { this.vyzovy = []; this.otvet = 'Hi John, thank you for telling us, and we are sorry about the wait. Please reach out to us directly so we can make it right. — Acme Auto Care'; this.stop = 'end_turn'; this.kod = 200; },
};

const otvet = (kod, obj, h = {}) => new Response(kod === 204 ? null : (typeof obj === 'string' ? obj : JSON.stringify(obj === undefined ? {} : obj)),
  { status: kod, headers: Object.assign({ 'content-type': 'application/json' }, h) });

const sets = [];
const nastoyashchiyFetch = global.fetch;
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  const metod = (o.method || 'GET').toUpperCase();
  const zag = o.headers instanceof Headers ? Object.fromEntries(o.headers.entries()) : Object.fromEntries(Object.entries(o.headers || {}).map(([a, b]) => [a.toLowerCase(), b]));
  if (u.host === 'oauth2.googleapis.com') return otvet(200, { access_token: 'ya29.test', expires_in: 3600 });
  if (u.host === 'www.googleapis.com') {
    const put = u.pathname.replace('/calendar/v3', '');
    google.vyzovy.push({ metod, put, query: Object.fromEntries(u.searchParams) });
    if (google.padaet) return otvet(500, { error: { message: 'backend' } });
    const m = put.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
    if (!m) return otvet(404, {});
    const kal = decodeURIComponent(m[1]);
    if (google.nedostupny.has(kal) || !google.kalendari.has(kal)) return otvet(404, { error: { message: 'Not Found' } });
    const sob = google.kal(kal);
    if (metod === 'GET' && !m[2]) {
      const ot = Date.parse(u.searchParams.get('timeMin')), do_ = Date.parse(u.searchParams.get('timeMax'));
      const udalennye = u.searchParams.get('showDeleted') === 'true';
      const vse = [...sob.values()].filter(e => (udalennye || e.status !== 'cancelled') && Date.parse(e.start.dateTime || e.start.date) < do_ && Date.parse(e.end.dateTime || e.end.date) > ot);
      const n = +(u.searchParams.get('maxResults') || 250), s0 = +(u.searchParams.get('pageToken') || 0);
      const items = vse.slice(s0, s0 + n);
      return otvet(200, Object.assign({ items }, s0 + n < vse.length ? { nextPageToken: String(s0 + n) } : {}));
    }
    if (metod === 'GET' && m[2]) {
      const e = sob.get(decodeURIComponent(m[2]));
      return e ? otvet(200, e) : otvet(404, { error: { message: 'Not Found' } });
    }
    return otvet(405, {});
  }
  if (u.host === 'calendar.google.com' && /\/public\/basic\.ics$/.test(u.pathname)) {
    const id = decodeURIComponent(u.pathname.split('/')[3]);
    return google.publichnye.has(id) ? otvet(200, 'BEGIN:VCALENDAR') : otvet(404, 'Not Found');
  }
  if (u.host === 'api.resend.com') {
    const body = String(o.body || '');
    resend.vyzovy.push({ headers: zag, body });
    if (resend.padaet) return otvet(500, { message: 'internal' });
    if (resend.kod) return otvet(resend.kod, { message: 'rate limit' });
    const idem = zag['idempotency-key'];
    if (idem && resend.klyuchi.has(idem)) {
      const bylo = resend.klyuchi.get(idem);
      return bylo.body === body ? otvet(200, { id: bylo.id }) : otvet(409, { name: 'invalid_idempotent_request' });
    }
    if (/[^\x00-\x7f]/.test(body)) return otvet(422, { message: 'тело не ASCII — живой fetch упал бы на ByteString' });
    const id = 're_' + crypto.randomBytes(4).toString('hex');
    if (idem) resend.klyuchi.set(idem, { body, id });
    resend.pisma.push(Object.assign(JSON.parse(body), { __idem: idem }));
    return otvet(200, { id });
  }
  if (u.host === 'places.googleapis.com') {
    const pid = decodeURIComponent(u.pathname.replace('/v1/places/', ''));
    places.vyzovy.push({ pid, maska: zag['x-goog-fieldmask'], klyuch: zag['x-goog-api-key'] });
    if (places.padaet) return otvet(500, { error: { message: 'backend' } });
    const k = places.karty.get(pid);
    if (!k) return otvet(404, { error: { message: 'Not found' } });
    const out = {};
    for (const f of String(zag['x-goog-fieldmask'] || '').split(',')) if (f && k[f] !== undefined) out[f] = k[f];
    return otvet(200, out);
  }
  if (u.host === 'api.anthropic.com') {
    const telo = JSON.parse(String(o.body || '{}'));
    anthropic.vyzovy.push({ telo, zag });
    if (anthropic.kod !== 200) return otvet(anthropic.kod, { type: 'error', error: { type: 'api_error', message: 'fail' } });
    return otvet(200, { id: 'msg_test', type: 'message', role: 'assistant', model: telo.model,
      content: [{ type: 'text', text: anthropic.otvet }], stop_reason: anthropic.stop, stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 } });
  }
  if (u.origin === BAZA && u.pathname === '/.netlify/functions/chernovik-background') {
    const r = await require(path.join(SITE, 'netlify-functions/chernovik-background.js')).handler({ httpMethod: 'POST', headers: zag, body: o.body });
    fon.push(JSON.parse(r.body));
    return otvet(r.statusCode === 200 ? 202 : r.statusCode, '');
  }
  sets.push(String(url));
  throw new Error('тест пошёл в сеть: ' + url);
};
const fon = [];

// ── паспорт для тестов ────────────────────────────────────────────────────
const K = require(path.join(SITE, 'lib/kartochka'));
function pasportAcme(dop) {
  const baza = {
    klient: 'acme', versiya: 'test', vklyuchen: true, rezhim: 'boevoy',
    biznes: { imya: 'Acme Auto Care', adres: '123 Main St, Los Angeles, CA 90012', poyas: 'America/Los_Angeles',
              place_id: 'ChIJacmeTESTplace0001', medicina: false },
    vladelec: { pochta: ['owner@acme.test'] },
    pisma: { yazyk: 'en', otvet_na: 'owner@acme.test' },
    istochniki: { vera: { vklyuchen: true, site_id: SAYT_VERY, kalendar_id: KALENDAR }, forma: { vklyuchena: true } },
    slezhenie: { vklyucheno: true, sosedi: [{ imya: 'Best Auto', place_id: 'ChIJbestTESTplace0002' }] },
  };
  return slitGluboko(baza, dop || {});
}
function slitGluboko(a, b) {
  const out = JSON.parse(JSON.stringify(a));
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? slitGluboko(out[k], v) : v;
  return out;
}
function postavitPasport(dop, id = 'acme') { const p = pasportAcme(dop); p.klient = id; K._dlyaTesta(id, p); return K.vzyat(id); }

// ── вызовы функций ────────────────────────────────────────────────────────
const fn = (imya) => require(path.join(SITE, 'netlify-functions', imya + '.js'));
const lib = (imya) => require(path.join(SITE, 'lib', imya + '.js'));
async function plan(o) { return lib('planirovshchik').progon(o); }
async function get(imya, q, headers) { return fn(imya).handler({ httpMethod: 'GET', headers: headers || {}, queryStringParameters: q || {} }); }
async function post(imya, q, forma, headers) {
  return fn(imya).handler({ httpMethod: 'POST', headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded' }, headers || {}),
    queryStringParameters: q || {}, body: typeof forma === 'string' ? forma : new URLSearchParams(forma || {}).toString() });
}
// t=… из ссылки письма.
function token(ssylka) { return new URL(ssylka).searchParams.get('t'); }
function ssylkiIzPisma(p) { return [...String(p.text).matchAll(/https:\/\/\S+/g)].map(m => m[0]); }

function sbrosVsego() {
  okruzhenie(); blobs.sbros(); google.sbros(); resend.sbros(); places.sbros(); anthropic.sbros(); fon.length = 0; sets.length = 0;
  polozhitKlyuch(); chasy.ustanovit(NACHALO); K._sbrosTestov();
  google.kal(KALENDAR);
}

okruzhenie();
polozhitKlyuch();
// Как в функциях: Blobs подключаются к нашему хранилищу и к ключу календаря (lib/nachalo.js).
require(path.join(SITE, 'lib/nachalo')).podklyuchit(blobsModul);

module.exports = { SITE, NASH_SAYT, SAYT_VERY, KALENDAR, ADMIN, BAZA, CHAS, DEN, chasy, blobs, google, resend, places, anthropic, fon, sets,
                   sbrosVsego, okruzhenie, postavitPasport, pasportAcme, plan, get, post, fn, lib, token, ssylkiIzPisma, nastoyashchiyFetch };
