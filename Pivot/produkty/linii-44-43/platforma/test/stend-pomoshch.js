'use strict';
// Общее для тестов (сам не тест: npm test запускает только test/*.test.js).
// Каждый файл тестов — отдельный процесс со своей папкой хранилища во временном каталоге (не в Drive),
// DRY_RUN=1 и ЗАПРЕЩЁННОЙ сетью: любой непредусмотренный fetch падает. Данные — только вымышленные,
// телефоны из диапазона 555-01xx, почта @example.com.

const fs = require('fs');
const os = require('os');
const path = require('path');

const KLYUCHI = {
  DEMO_1: 'test-klyuch-demo-1-0123456789abcdef',
  DEMO_2: 'test-klyuch-demo-2-0123456789abcdef',
  TEL_1: 'test-klyuch-tel-1-0123456789abcdef',
  TEL_2: 'test-klyuch-tel-2-0123456789abcdef',
  PULT: 'test-pult-klyuch-0123456789abcdef',
};
const TWILIO_TOKEN = 'test-twilio-auth-token';
const EL_SEKRET = 'test-elevenlabs-webhook-secret';
const HOST = 'stend.example';
const NOMER_NAYM = '+17185550101';
const NOMER_SIDELKI = '+17185550102';

const LINII_TEST = {
  'DEMO-1': { liniya: 'care-hiring', klient: 'brightside', agent_id: 'agent_test_naym', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_DEMO_1', demo: true },
  'DEMO-2': { liniya: 'care-caregivers', klient: 'brightside', agent_id: 'agent_test_sidelki', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_DEMO_2', demo: true },
  [NOMER_NAYM]: { liniya: 'care-hiring', klient: 'brightside', agent_id: 'agent_test_naym_tel', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_TEL_1' },
  [NOMER_SIDELKI]: { liniya: 'care-caregivers', klient: 'brightside', agent_id: 'agent_test_sidelki_tel', yazyk: 'en', klyuch_env: 'LINIYA_KLYUCH_TEL_2', perevod_vne_chasov: true },
};

// Настройки — настоящий nastroyki.json плюс то, что в DEMO пусто (календари, адресаты, цепочки).
function nastroykiTest() {
  const n = JSON.parse(JSON.stringify(require('../nastroyki.json')));
  const b = n.brightside;
  b.kalendari.sobesedovanie.kalendar = 'kal-sobesedovanie@test';
  b.kalendari.ocenka.kalendar = 'kal-ocenka@test';
  b.pisma.koordinatoru = ['coordinator@example.com'];
  b.pisma.svodka_komu = ['owner@example.com'];
  b.perevod.cepochka = ['+17185550191', '+17185550192'];
  b.perevod.chasy = null;
  b.dezhurnye.cepochka = ['+17185550190'];
  b.sms.ot = NOMER_SIDELKI;
  return n;
}

function zapretitSet() {
  globalThis.fetch = async (url) => { throw new Error('сеть в тестах запрещена: ' + String(url).slice(0, 80)); };
}

function sreda() {
  const papka = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-test-'));
  Object.assign(process.env, {
    HRANILISHCHE_LOKALNO: '1', HRANILISHCHE_PAPKA: papka, DRY_RUN: '1',
    LINIYA_KLYUCH_DEMO_1: KLYUCHI.DEMO_1, LINIYA_KLYUCH_DEMO_2: KLYUCHI.DEMO_2,
    LINIYA_KLYUCH_TEL_1: KLYUCHI.TEL_1, LINIYA_KLYUCH_TEL_2: KLYUCHI.TEL_2,
    PULT_KLYUCH_BRIGHTSIDE: KLYUCHI.PULT,
    TWILIO_AUTH_TOKEN: TWILIO_TOKEN, TWILIO_ACCOUNT_SID: 'ACtest0000000000000000000000000000',
    CARELINE_WEBHOOK_SECRET: EL_SEKRET, ELEVENLABS_API_KEY: 'test-elevenlabs-key',
    PLATFORMA_URL: 'https://' + HOST,
  });
  // ELEVENLABS_WEBHOOK_SECRET — имя секрета живой Веры: стенд его не читает, в тестах его нет.
  for (const k of ['RESEND_API_KEY', 'KALENDAR_ADAPTER', 'ZVONKI_BEZ_KVOTY', 'GOOGLE_SA_JSON', 'BLOBS_TOKEN', 'NETLIFY_API_TOKEN',
                   'ELEVENLABS_WEBHOOK_SECRET', 'CARELINE_DEMO_LINIYA_KLYUCH']) delete process.env[k];
  require('../lib/linii').ustanovit({ linii: LINII_TEST, nastroyki: nastroykiTest() });
  zapretitSet();
  return papka;
}

function vremya(isoStroka) { globalThis.__PLATFORMA_SEYCHAS__ = Date.parse(isoStroka); }

const st = () => require('../lib/hranilishche').hranilishcheKlienta('brightside');
const klient = () => require('../lib/linii').klient('brightside');

// ── события Netlify ────────────────────────────────────────────────────────
function instrument(telo, klyuch = KLYUCHI.DEMO_1) {
  return { httpMethod: 'POST', path: '/.netlify/functions/instrument',
           headers: { 'content-type': 'application/json', 'x-liniya-klyuch': klyuch }, body: JSON.stringify(telo) };
}

function twilio(funkciya, polya, { token = TWILIO_TOKEN, query = '', bezPodpisi = false } = {}) {
  const { podpisTwilio } = require('../lib/podpisi');
  const put = '/.netlify/functions/' + funkciya;
  const url = `https://${HOST}${put}${query ? '?' + query : ''}`;
  const para = new URLSearchParams(polya);
  const headers = { host: HOST, 'x-forwarded-proto': 'https', 'content-type': 'application/x-www-form-urlencoded' };
  if (!bezPodpisi) headers['x-twilio-signature'] = podpisTwilio(url, para, token);
  return { httpMethod: 'POST', path: put, rawUrl: url, headers, body: para.toString(),
           queryStringParameters: Object.fromEntries(new URLSearchParams(query)) };
}

function elevenlabs(telo, { sekret = EL_SEKRET, tSek } = {}) {
  const { elevenlabsZagolovok } = require('../lib/podpisi');
  const raw = JSON.stringify(telo);
  return { httpMethod: 'POST', path: '/.netlify/functions/itog',
           headers: { 'content-type': 'application/json', 'elevenlabs-signature': elevenlabsZagolovok(raw, sekret, tSek ?? Math.floor(Date.now() / 1000)) },
           body: raw };
}

const otvet = (r) => JSON.parse(r.body);

// Подмена fetch на время теста: obrabotchik(url, opts) → Response.
function podmenitFetch(obrabotchik) {
  const vyzovy = [];
  globalThis.fetch = async (url, opts = {}) => { vyzovy.push({ url: String(url), opts }); return obrabotchik(String(url), opts); };
  return { vyzovy, vernut: zapretitSet };
}
const response = (kod, telo, headers = {}) => new Response(typeof telo === 'string' ? telo : JSON.stringify(telo), { status: kod, headers });

// ── вымышленные данные агентства (Бруклин, Brighton Beach и соседи) ────────
function klientyAgentstva() {
  return [
    { id: 'c-01', kod: 'BK-114', rayon: 'Brighton Beach', zip: '11235', yazyk: 'ru', trebovaniya_navyki: ['hha'],
      avtorizacii: [{ kod_uslugi: 'T1019', s: '2026-07-01', po: '2026-12-31', chasov_v_nedelyu: 25 }] },
    { id: 'c-02', kod: 'QN-208', rayon: 'Ridgewood', zip: '11385', yazyk: 'es', trebovaniya_navyki: ['hha'], avtorizacii: [] },
  ];
}
function sidelkiAgentstva() {
  const s = (id, imya, tel, yazyki, zip, dop = {}) => Object.assign({ id, imya, telefon: tel, yazyki, navyki: ['hha'], zip,
    rayon: 'Brooklyn', maks_chasov_v_nedelyu: 40, chasov_na_etoy_nedele: 10, nadezhnost: 0.8, znaet_klientov: [],
    sms_soglasie: true, aktivna: true }, dop);
  return [
    s('s-01', 'Oksana DEMO', '+17185550111', ['ru', 'en'], '11235'),
    s('s-02', 'Svetlana DEMO', '+17185550112', ['ru', 'en'], '11229', { nadezhnost: 0.95 }),
    s('s-03', 'Irina DEMO', '+17185550113', ['ru'], '11224', { nadezhnost: 0.9 }),
    s('s-04', 'Galina DEMO', '+17185550114', ['ru', 'en'], '11214', { nadezhnost: 0.85 }),
    s('s-05', 'Tamara DEMO', '+17185550115', ['ru'], '11223', { nadezhnost: 0.7 }),
    s('s-06', 'Nina DEMO', '+17185550116', ['ru'], '11235', { sms_soglasie: false }),
    s('s-07', 'Rosa DEMO', '+17185550117', ['es', 'en'], '11385'),
  ];
}
function smenyAgentstva() {
  return [
    { id: 'sm-1', klient_id: 'c-01', sidelka_id: 's-01', start: '2026-10-01T18:00:00-04:00', end: '2026-10-01T22:00:00-04:00', kod_uslugi: 'T1019', status: 'scheduled' },
    { id: 'sm-2', klient_id: 'c-01', sidelka_id: 's-01', start: '2026-10-03T09:00:00-04:00', end: '2026-10-03T13:00:00-04:00', kod_uslugi: 'T1019', status: 'scheduled' },
    { id: 'sm-3', klient_id: 'c-02', sidelka_id: 's-07', start: '2026-09-30T10:00:00-04:00', end: '2026-09-30T14:00:00-04:00', kod_uslugi: 'T1019', status: 'scheduled' },
  ];
}
async function zasejat(s) {
  for (const k of klientyAgentstva()) await s.setJSON(`klienty/${k.id}`, k);
  for (const x of sidelkiAgentstva()) await s.setJSON(`sidelki/${x.id}`, x);
  for (const x of smenyAgentstva()) await s.setJSON(`smeny/${x.id}`, x);
}

async function zhurnal(s, den) { return require('../lib/zhurnal').prochitat(s, den); }

module.exports = {
  KLYUCHI, TWILIO_TOKEN, EL_SEKRET, HOST, NOMER_NAYM, NOMER_SIDELKI, LINII_TEST, nastroykiTest,
  sreda, vremya, st, klient, instrument, twilio, elevenlabs, otvet, podmenitFetch, response, zapretitSet,
  klientyAgentstva, sidelkiAgentstva, smenyAgentstva, zasejat, zhurnal,
};
