#!/usr/bin/env node
'use strict';
// Ключ служебного аккаунта Google (запись в календари DEMO) → хранилище стенда: Netlify Blobs, store `kalendar-klyuch`,
// ключ `sa`. Оттуда его читает lib/kalendar.js (klyuchSA): в переменную окружения ключ не кладём — у Lambda потолок
// 4 КБ на все переменные сразу, а сам ключ ~2,4 КБ (память reference-4kb-peremennyh-lambda).
//
//   node scripts/zalit-klyuch-kalendarya.js                       локально, проба: временная папка (или HRANILISHCHE_PAPKA
//                                                                 вне Google Drive — в папку проекта ключ не пишется)
//   node scripts/zalit-klyuch-kalendarya.js --proverit            локально: только сказать, есть ли ключ
//   node scripts/zalit-klyuch-kalendarya.js --blobs               в Blobs стенда — шаг окна выкладки, только по «да» Андрея
//   node scripts/zalit-klyuch-kalendarya.js --blobs --proverit    на стенде: есть ли ключ и тот ли это ключ (ничего не пишет)
//   --fayl <путь>      файл ключа (по умолчанию ~/bidna-klyuchi/vera-kalendar.json, права 600, вне Drive)
//   --perezapisat      заменить, если в хранилище уже лежит ДРУГОЙ ключ (без флага — отказ)
//   --lyuboy-sayt      разрешить SITE_ID не стенда (по умолчанию — только linii-demo-85fof, чтобы не залить в сайт Веры)
//
// Для --blobs нужны SITE_ID (или NETLIFY_SITE_ID) и токен Netlify: BLOBS_TOKEN, иначе NETLIFY_AUTH_TOKEN, иначе токен
// netlify CLI из ~/Library/Preferences/netlify/config.json (читается в память процесса, никуда не печатается).
//
// СОДЕРЖИМОЕ КЛЮЧА НЕ ПЕЧАТАЕТСЯ НИКОГДА: только размер, отпечаток sha256 (первые 12 знаков) и «да/нет» по полям.
// Текст ошибки разбора JSON тоже не печатаем: в новых версиях Node он цитирует кусок файла.
// Коды выхода: 0 — готово / ключ есть; 1 — ключа в хранилище нет (--proverit); 2 — ошибка входа (файл, окружение, сайт);
// 3 — хранилище не поднялось или не записалось; 4 — в хранилище другой ключ (нужен --perezapisat или сверка руками).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const STEND_SITE_ID = 'ea43276c-c92b-479d-b662-541651e04cf2';   // linii-demo-85fof (README.md, шапка)
const STORE = 'kalendar-klyuch';
const KLYUCH = 'sa';
const OZHIDAEMYY_AKKAUNT = 'vera-kalendar@business-intelligence-dna.iam.gserviceaccount.com';   // README.md, «Выкладка»

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const znach = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const stop = (kod, tekst) => { console.error(tekst); process.exit(kod); };
const otpechatok = (t) => 'sha256:' + crypto.createHash('sha256').update(String(t)).digest('hex').slice(0, 12);

function prochitatFayl(put) {
  let tekst;
  try { tekst = fs.readFileSync(put, 'utf8'); }
  catch (e) { stop(2, `Файл ключа не прочитался (${e.code || 'ошибка'}): ${put}`); }
  let d;
  try { d = JSON.parse(tekst); } catch (_) { stop(2, 'Файл ключа — не JSON (содержимое не показываю).'); }
  const polya = {
    service_account: !!d && d.type === 'service_account',
    client_email: !!d && typeof d.client_email === 'string' && d.client_email.includes('@'),
    private_key: !!d && typeof d.private_key === 'string' && d.private_key.includes('PRIVATE KEY'),
  };
  if (!polya.client_email || !polya.private_key) {
    stop(2, `В файле нет нужных полей: client_email — ${polya.client_email ? 'да' : 'нет'}, private_key — ${polya.private_key ? 'да' : 'нет'}.`);
  }
  return { tekst, polya, akkauntTot: d.client_email === OZHIDAEMYY_AKKAUNT };
}

function tokenNetlify() {
  if (process.env.BLOBS_TOKEN) return { token: process.env.BLOBS_TOKEN, otkuda: 'BLOBS_TOKEN' };
  if (process.env.NETLIFY_AUTH_TOKEN) return { token: process.env.NETLIFY_AUTH_TOKEN, otkuda: 'NETLIFY_AUTH_TOKEN' };
  const cfg = path.join(os.homedir(), 'Library', 'Preferences', 'netlify', 'config.json');
  try {
    const d = JSON.parse(fs.readFileSync(cfg, 'utf8'));
    const users = Object.values((d && d.users) || {});
    const t = users.map((u) => u && u.auth && u.auth.token).find(Boolean);
    if (t) return { token: t, otkuda: 'netlify CLI (config.json)' };
  } catch (_) { /* нет CLI — ниже честный отказ */ }
  return null;
}

(async () => {
  const blobs = flag('--blobs');
  const proverit = flag('--proverit');
  const put = znach('--fayl') || path.join(os.homedir(), 'bidna-klyuchi', 'vera-kalendar.json');

  if (blobs) {
    const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || '';
    if (!siteId) stop(2, 'Для --blobs нужен SITE_ID (id сайта стенда: ' + STEND_SITE_ID + ').');
    if (siteId !== STEND_SITE_ID && !flag('--lyuboy-sayt')) {
      stop(2, 'SITE_ID — не стенд linii-demo-85fof. Ключ календаря кладём только на стенд (иначе --lyuboy-sayt).');
    }
    const t = tokenNetlify();
    if (!t) stop(2, 'Нет токена Netlify: BLOBS_TOKEN, NETLIFY_AUTH_TOKEN или вход в netlify CLI.');
    delete process.env.HRANILISHCHE_LOKALNO;
    process.env.SITE_ID = siteId;
    process.env.BLOBS_TOKEN = t.token;   // только в память этого процесса — lib/hranilishche.js берёт его отсюда
    console.log(`Хранилище: Blobs сайта ${siteId}, токен из ${t.otkuda}.`);
  } else {
    // Проба пишет НАСТОЯЩИЙ ключ на диск — только вне Google Drive (KONTRAKT.md, запрет 6): по умолчанию во временную папку.
    const papka = path.resolve(process.env.HRANILISHCHE_PAPKA || path.join(os.tmpdir(), 'platforma-kalendar-klyuch'));
    if (papka.startsWith(path.resolve(__dirname, '..', '..')) || /CloudStorage|Google ?Drive|My Drive/i.test(papka)) {
      stop(2, 'Локальная проба не кладёт ключ в Google Drive: задай HRANILISHCHE_PAPKA вне Drive (по умолчанию — временная папка).');
    }
    process.env.HRANILISHCHE_LOKALNO = '1';
    process.env.HRANILISHCHE_PAPKA = papka;
    console.log('Хранилище: локальное (проба), папка ' + papka);
  }

  const { hranilishcheImeni } = require('../lib/hranilishche');
  const st = hranilishcheImeni(STORE);
  if (!st || (blobs && st.rezhim !== 'blobs')) stop(3, 'Хранилище не поднялось.');

  const lokalnyy = proverit && !fs.existsSync(put) ? null : prochitatFayl(put);
  if (lokalnyy) {
    console.log(`Файл ключа: ${Buffer.byteLength(lokalnyy.tekst)} байт, ${otpechatok(lokalnyy.tekst)}; `
      + `type service_account — ${lokalnyy.polya.service_account ? 'да' : 'нет'}; аккаунт календаря Веры — ${lokalnyy.akkauntTot ? 'да' : 'НЕТ, проверь файл'}.`);
  }

  let tam;
  try { tam = await st.get(KLYUCH); }
  catch (_) { stop(3, `Не прочитал ${STORE}/${KLYUCH} (сеть или токен).`); }

  if (proverit) {
    if (tam === null || tam === undefined || tam === '') { console.log(`В ${STORE}/${KLYUCH} ключа НЕТ.`); process.exit(1); }
    const sovpadaet = lokalnyy ? otpechatok(tam) === otpechatok(lokalnyy.tekst) : null;
    console.log(`В ${STORE}/${KLYUCH} ключ ЕСТЬ: ${Buffer.byteLength(tam)} байт, ${otpechatok(tam)}`
      + (sovpadaet === null ? '.' : sovpadaet ? ' — тот же, что в файле.' : ' — НЕ тот, что в файле.'));
    process.exit(sovpadaet === false ? 4 : 0);
  }

  if (tam && otpechatok(tam) === otpechatok(lokalnyy.tekst)) {
    console.log(`Уже залит тот же ключ (${otpechatok(tam)}) — без изменений.`);
    process.exit(0);
  }
  if (tam && !flag('--perezapisat')) {
    stop(4, `В ${STORE}/${KLYUCH} лежит ДРУГОЙ ключ (${otpechatok(tam)}). Заменить — с --perezapisat.`);
  }
  try {
    await st.set(KLYUCH, lokalnyy.tekst, tam ? {} : { onlyIfNew: true });
  } catch (_) { stop(3, `Не записал ${STORE}/${KLYUCH} (сеть или токен).`); }
  let nazad = null;
  try { nazad = await st.get(KLYUCH); } catch (_) { nazad = null; }
  if (!nazad || otpechatok(nazad) !== otpechatok(lokalnyy.tekst)) stop(3, 'Записал, но при чтении назад ключ не совпал — проверь руками (--proverit).');
  console.log(`Залит в ${STORE}/${KLYUCH}: ${Buffer.byteLength(nazad)} байт, ${otpechatok(nazad)} — сверено чтением${tam ? ' (заменил прежний)' : ''}.`);
})().catch(() => stop(3, 'Упало (подробности не печатаю: в них может быть ключ).'));
