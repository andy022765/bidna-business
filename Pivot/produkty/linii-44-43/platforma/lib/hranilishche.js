'use strict';
// Хранилище клиента: одно на клиента, имя `k-<klient>` (KONTRAKT.md, «Хранилище»).
//
// ДВА РЕЖИМА.
//   Стенд — Netlify Blobs. Поднимаем ТОКЕНОМ и сайтом (SITE_ID + BLOBS_TOKEN), со строгой
//   согласованностью: так работает стенд Веры с 12.09 (pismo.js). Голый getStore в lambda-режиме
//   бросает «environment has not been configured» (26.09), а connectLambda(event) даёт только
//   edgeURL без uncachedEdgeURL — и строгое чтение на нём падает BlobsConsistencyError
//   (@netlify/blobs 10.1.0, getFinalRequest). Поэтому контекстный путь — только запасной.
//   Локально — файлы в `.data/` (или HRANILISHCHE_PAPKA). Включается ТОЛЬКО переменной
//   HRANILISHCHE_LOKALNO=1: на стенде этой переменной быть не должно.
//
// ЗАМКИ. Защита от двойной записи на одно окно и от двойного закрепления смены держится
// на условной записи: set(..., {onlyIfNew}) → If-None-Match: * (@netlify/blobs ≥ 10.0.0).
// Библиотека считает успехом любой ответ, кроме 412 (даже 500), поэтому замок после записи
// перечитывается и сверяется по случайной метке. Локально — эксклюзивное создание файла (flag 'wx').
// [не проверено на стенде] что бэкенд Blobs в режиме токена соблюдает If-None-Match на подписанном
// адресе — проверить первым делом после первой выкладки (README, «Что проверить на стенде»).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KLIENT_OK = /^[a-z0-9][a-z0-9-]{1,39}$/;
const SEGMENT_OK = /^[A-Za-z0-9+_.:@=-]+$/;

const lokalno = () => ['1', 'true', 'da', 'yes'].includes(String(process.env.HRANILISHCHE_LOKALNO || '').trim().toLowerCase());
const papka = () => process.env.HRANILISHCHE_PAPKA || path.join(__dirname, '..', '.data');

function proveritKlyuch(key) {
  const k = String(key || '');
  if (!k || k.length > 500) throw new Error('ключ хранилища пустой или длинный');
  const seg = k.split('/');
  for (const s of seg) {
    if (!s || s === '.' || s === '..' || !SEGMENT_OK.test(s)) throw new Error('недопустимый ключ хранилища: ' + k.slice(0, 80));
  }
  return k;
}

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const etagIz = (tekst) => '"' + crypto.createHash('sha1').update(tekst).digest('hex').slice(0, 20) + '"';

// ── локальный режим: файлы ──────────────────────────────────────────────────
const kodSeg = (s) => encodeURIComponent(s).replace(/\./g, '%2E').replace(/\*/g, '%2A');
const raskodSeg = (s) => decodeURIComponent(s);

function lokalnoeHranilishche(imya) {
  const koren = path.join(papka(), kodSeg(imya));
  const put = (key) => path.join(koren, ...proveritKlyuch(key).split('/').map(kodSeg)) + '.blob';
  const chitat = (key) => {
    try { return fs.readFileSync(put(key), 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  };
  const pisat = (p, tekst) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, tekst);
    fs.renameSync(tmp, p);
  };
  function obkhod(dir, pref, out) {
    let spisok;
    try { spisok = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of spisok) {
      if (e.isDirectory()) obkhod(path.join(dir, e.name), pref + raskodSeg(e.name) + '/', out);
      else if (e.name.endsWith('.blob')) out.push(pref + raskodSeg(e.name.slice(0, -5)));
    }
  }
  return {
    rezhim: 'lokalno',
    imya,
    async get(key) { return chitat(key); },
    async getSEtag(key) {
      const t = chitat(key);
      if (t === null) return null;
      return { tekst: t, etag: etagIz(t) };
    },
    // Синхронно внутри одного вызова: между чтением и записью нет await, значит в одном процессе
    // условная запись атомарна; между процессами onlyIfNew атомарен за счёт флага 'wx'.
    async set(key, tekst, usl = {}) {
      const p = put(key);
      const s = String(tekst);
      if (usl.onlyIfNew) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        try { fs.writeFileSync(p, s, { flag: 'wx' }); }
        catch (e) { if (e.code === 'EEXIST') return { modified: false }; throw e; }
        return { modified: true, etag: etagIz(s) };
      }
      if (usl.onlyIfMatch) {
        const tek = chitat(key);
        if (tek === null || etagIz(tek) !== usl.onlyIfMatch) return { modified: false };
      }
      pisat(p, s);
      return { modified: true, etag: etagIz(s) };
    },
    async delete(key) {
      try { fs.unlinkSync(put(key)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    },
    async list(prefix = '') {
      const out = [];
      obkhod(koren, '', out);
      return out.filter((k) => k.startsWith(prefix)).sort();
    },
  };
}

// ── стенд: Netlify Blobs ────────────────────────────────────────────────────
function blobsHranilishche(imya) {
  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch (e) { console.log('[hranilishche] @netlify/blobs не подключился:', e.message); return null; }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = [process.env.BLOBS_TOKEN, process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].find(Boolean);
  let store = null;
  if (siteID && token) {
    try { store = getStore({ name: imya, siteID, token, consistency: 'strong' }); } catch (_) { store = null; }
  }
  if (!store) {
    try { store = getStore({ name: imya, consistency: 'strong' }); } catch (_) { store = null; }
  }
  if (!store) return null;
  return {
    rezhim: 'blobs',
    imya,
    async get(key) { return store.get(proveritKlyuch(key)); },
    async getSEtag(key) {
      const r = await store.getWithMetadata(proveritKlyuch(key));
      if (!r || r.data === null || r.data === undefined) return null;
      return { tekst: r.data, etag: r.etag };
    },
    async set(key, tekst, usl = {}) {
      const opcii = {};
      if (usl.onlyIfNew) opcii.onlyIfNew = true;
      else if (usl.onlyIfMatch) opcii.onlyIfMatch = usl.onlyIfMatch;
      const r = await store.set(proveritKlyuch(key), String(tekst), opcii);
      return r && typeof r === 'object' ? r : { modified: true };
    },
    async delete(key) { await store.delete(proveritKlyuch(key)); },
    async list(prefix = '') {
      const r = await store.list(prefix ? { prefix } : {});
      return ((r && r.blobs) || []).map((b) => b.key).sort();
    },
  };
}

// ── общий слой: JSON, замки, обновление без потерь ──────────────────────────
function sObshchimSloem(syroe) {
  const st = {
    rezhim: syroe.rezhim,
    imya: syroe.imya,
    get: (k) => syroe.get(k),
    set: (k, v, u) => syroe.set(k, v, u),
    delete: (k) => syroe.delete(k),
    list: (p) => syroe.list(p),
    async getJSON(key) {
      const t = await syroe.get(key);
      if (t === null || t === undefined || t === '') return null;
      try { return JSON.parse(t); } catch (_) { return null; }
    },
    async setJSON(key, obj, usl) { return syroe.set(key, JSON.stringify(obj), usl); },

    // Атомарное «создать, если нет». true — ключ наш. Значение получает метку _tk,
    // по которой запись перечитывается: успех без метки = чужая запись или сбой.
    async zanyat(key, obj) {
      const tk = crypto.randomBytes(8).toString('hex');
      const telo = Object.assign({}, obj, { _tk: tk });
      const r = await syroe.set(key, JSON.stringify(telo), { onlyIfNew: true });
      if (r && r.modified === false) return false;
      const nazad = await st.getJSON(key);
      if (!nazad) throw new Error('замок не записался: ' + key);
      return nazad._tk === tk;
    },

    // Замок с возможностью перехвата. {nash:true} — замок наш; {nash:false, chey} — чужой.
    // perekhvat(staroe) → true разрешает забрать протухший замок (условная запись по etag:
    // два перехватчика одновременно не пройдут оба).
    async zamok(key, obj, { perekhvat } = {}) {
      if (await st.zanyat(key, obj)) return { nash: true };
      const tek = await syroe.getSEtag(key);
      if (!tek) {
        if (await st.zanyat(key, obj)) return { nash: true };
        return { nash: false, chey: await st.getJSON(key) };
      }
      let staroe = null;
      try { staroe = JSON.parse(tek.tekst); } catch (_) { staroe = null; }
      if (perekhvat && staroe && perekhvat(staroe) && tek.etag) {
        const tk = crypto.randomBytes(8).toString('hex');
        const r = await syroe.set(key, JSON.stringify(Object.assign({}, obj, { _tk: tk })), { onlyIfMatch: tek.etag });
        if (r && r.modified !== false) {
          const nazad = await st.getJSON(key);
          if (nazad && nazad._tk === tk) return { nash: true, perekhvachen: staroe };
        }
      }
      return { nash: false, chey: staroe };
    },

    // Прочитать → изменить → записать с проверкой etag; конфликт — повтор с новыми данными.
    // fn получает копию текущего значения (или null) и возвращает новое; undefined — без изменений.
    async obnovit(key, fn, { popytok = 8 } = {}) {
      for (let i = 0; i < popytok; i++) {
        const tek = await syroe.getSEtag(key);
        let staroe = null;
        if (tek) { try { staroe = JSON.parse(tek.tekst); } catch (_) { staroe = null; } }
        const novoe = await fn(staroe === null ? null : JSON.parse(JSON.stringify(staroe)));
        if (novoe === undefined) return { data: staroe, izmeneno: false };
        let r;
        if (!tek) r = await syroe.set(key, JSON.stringify(novoe), { onlyIfNew: true });
        else if (tek.etag) r = await syroe.set(key, JSON.stringify(novoe), { onlyIfMatch: tek.etag });
        else r = await syroe.set(key, JSON.stringify(novoe));
        if (!r || r.modified !== false) return { data: novoe, izmeneno: true };
        await pauza(10 + Math.floor(Math.random() * 30 * (i + 1)));
      }
      throw new Error('конфликт записи не разрешился: ' + key);
    },

    // Все объекты под префиксом: [{key, data}]. Читаем пачками — 45 сиделок и сотни смен
    // не должны идти по одному запросу подряд.
    async vse(prefix, { potok = 16 } = {}) {
      const klyuchi = await syroe.list(prefix);
      const out = new Array(klyuchi.length);
      let i = 0;
      async function rabotnik() {
        while (i < klyuchi.length) {
          const n = i++;
          out[n] = { key: klyuchi[n], data: await st.getJSON(klyuchi[n]) };
        }
      }
      await Promise.all(Array.from({ length: Math.min(potok, klyuchi.length) }, rabotnik));
      return out.filter((x) => x && x.data !== null);
    },
  };
  return st;
}

function hranilishcheImeni(imya) {
  const syroe = lokalno() ? lokalnoeHranilishche(imya) : blobsHranilishche(imya);
  return syroe ? sObshchimSloem(syroe) : null;
}

// Хранилище клиента `k-<klient>`. null — хранилище не поднялось (вызывающий отвечает честным отказом).
function hranilishcheKlienta(klient) {
  if (!KLIENT_OK.test(String(klient || ''))) throw new Error('недопустимое имя клиента');
  return hranilishcheImeni('k-' + klient);
}

// Новый id: префикс-ГГГГММДД-случайное. Без телефона и имени: ключи видны в журналах.
function novyyId(prefiks, teper = Date.now()) {
  const d = new Date(teper).toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefiks}-${d}-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { hranilishcheKlienta, hranilishcheImeni, novyyId, proveritKlyuch, lokalno };
