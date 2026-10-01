'use strict';
// Проверка визитов EVV перед счётом (A4). Зовёт пульт: POST /.netlify/functions/evv?k=<ключ пульта>&shtat=NY|NC&fayl=<имя>,
// тело — CSV выгрузки визитов (text/csv, до 5 МБ). Можно и JSON {csv, shtat, fayl}.
// Правила — движок lib/care/evv.js (другой сборщик): proveritCsv(текст, avtorizacii, smeny, shtat, klienty),
// а если его нет — контрактный proverit(визиты-или-текст, avtorizacii, smeny, shtat, klienty).
// Авторизации берём из карточек клиентов агентства (klienty/<id>.avtorizacii[]) и помечаем klient_id — так их
// ждёт движок. Результат — прогон evv/<run_id> {run_id, zagruzheno, shtat, strok, fayl, isklyucheniya};
// ответ {ok:true, progon} (так читает web/pult/pult.js). Модель здесь не участвует вовсе.

const { json, syroeTelo } = require('../lib/http');
const H = require('../lib/hranilishche');
const { seychas, iso, POYAS } = require('../lib/vremya');
const { zapisat } = require('../lib/zhurnal');
const { klientPoKlyuchuPulta, klyuchIzZaprosa } = require('../lib/pult-dannye');
const linii = require('../lib/linii');
const crypto = require('crypto');

const dvizhok = () => require('../lib/care/evv');
const MAKS_BAYT = 5 * 1024 * 1024;
const SHTATY = ['NY', 'NC'];

function avtorizaciiIzKlientov(klienty) {
  const out = [];
  for (const k of klienty) {
    for (const [i, a] of (Array.isArray(k.avtorizacii) ? k.avtorizacii : []).entries()) {
      if (!a) continue;
      out.push(Object.assign({ id: a.id || `${k.id}:${a.kod_uslugi || 'kod'}:${i}` }, a, { klient_id: a.klient_id || k.id, klient_kod: k.kod || null }));
    }
  }
  return out;
}

function schitatStroki(tekst) {
  return Math.max(0, String(tekst).split(/\r?\n/).filter((s) => s.trim()).length - 1);
}

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'POST') return json(405, { ok: false, soobshchenie: 'Use POST.' });
  const klient = klientPoKlyuchuPulta(klyuchIzZaprosa(event));
  if (!klient) return json(401, { ok: false, oshibka: 'klyuch', soobshchenie: 'This link cannot upload files.' });
  const q = event.queryStringParameters || {};
  let tekst = syroeTelo(event);
  if (Buffer.byteLength(tekst, 'utf8') > MAKS_BAYT) {
    return json(413, { ok: false, soobshchenie: 'The file is larger than 5 MB. Export a shorter date range and try again.' });
  }
  let shtat = String(q.shtat || '').toUpperCase();
  let fayl = q.fayl || null;
  if (/json/i.test(linii.zagolovok(event.headers || {}, 'content-type'))) {
    try {
      const b = JSON.parse(tekst || '{}');
      tekst = String(b.csv || '');
      shtat = String(b.shtat || shtat).toUpperCase();
      fayl = b.fayl || fayl;
    } catch (_) { return json(400, { ok: false, soobshchenie: 'The request could not be read.' }); }
  }
  tekst = tekst.replace(/^﻿/, '');
  if (!SHTATY.includes(shtat)) shtat = SHTATY.includes(String(klient.shtat || '').toUpperCase()) ? String(klient.shtat).toUpperCase() : 'NY';
  fayl = fayl ? String(fayl).replace(/[^\w .()-]/g, '_').slice(0, 120) : null;
  if (schitatStroki(tekst) < 1) return json(400, { ok: false, soobshchenie: 'The file has no visit rows under the header.' });

  let st = null;
  try { st = H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
  if (!st) return json(503, { ok: false, soobshchenie: 'Storage is not available right now. Try again in a minute.' });
  const poyas = klient.poyas || POYAS;
  try {
    const [klienty, smeny] = await Promise.all([st.vse('klienty/'), st.vse('smeny/')]).then((r) => r.map((x) => x.map((y) => y.data)));
    const avtorizacii = avtorizaciiIzKlientov(klienty);
    const E = dvizhok();
    let strok, isklyucheniya, kolonki = null, svodka = null;
    if (typeof E.proveritCsv === 'function') {
      const r = E.proveritCsv(tekst, avtorizacii, smeny, shtat, klienty);
      strok = r.strok; isklyucheniya = r.isklyucheniya || []; kolonki = r.kolonki || null; svodka = r.svodka || null;
      // Без колонки даты визита проверять нечего — просим правильную выгрузку (docs/API.md, раздел 5).
      if (kolonki && kolonki.najdeny && !('data' in kolonki.najdeny)) {
        return json(400, { ok: false, soobshchenie: 'The file has no visit date column. Export visits with the date, times and caregiver.' });
      }
    } else {
      isklyucheniya = E.proverit(tekst, avtorizacii, smeny, shtat, klienty) || [];
      strok = schitatStroki(tekst);
    }
    const t = seychas();
    const mestnoe = iso(t, poyas);
    const run_id = `evv-${mestnoe.slice(0, 10).replace(/-/g, '')}-${mestnoe.slice(11, 16).replace(':', '')}-${crypto.randomBytes(2).toString('hex')}`;
    const progon = { run_id, zagruzheno: mestnoe, shtat, strok: Number(strok) || 0, fayl, isklyucheniya,
                     ...(kolonki ? { kolonki } : {}), ...(svodka ? { svodka } : {}) };
    await st.setJSON(`evv/${run_id}`, progon);
    await zapisat(st, { kto: 'pult', chto: 'evv_progon', obekt: `evv/${run_id}`,
                        detali: { shtat, strok: progon.strok, isklyucheniy: isklyucheniya.length, fayl } }, { poyas });
    return json(200, { ok: true, progon });
  } catch (e) {
    console.log('[evv] упало:', e && e.message);
    return json(500, { ok: false, soobshchenie: 'The file could not be checked. Make sure it is the visit export in CSV format.' });
  }
};

exports._avtorizaciiIzKlientov = avtorizaciiIzKlientov;
