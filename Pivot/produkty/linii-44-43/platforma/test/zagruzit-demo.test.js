'use strict';
// scripts/zagruzit-demo.js: демо-данные brightside → хранилище k-brightside (локальный режим, временная папка не в Drive,
// без сети). Семьи (semi/ + indeks/telefon/semya/) и журнал (zhurnal/<день>) — по модели KONTRAKT.md; пульт стенда
// на загруженных данных отдаёт то же, что демо-снимок. Запуск: node --test test/zagruzit-demo.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SEYCHAS = '2026-09-30T14:05:00-04:00';
const DEN = '2026-09-30';
const SKRIPT = path.join(__dirname, '..', 'scripts', 'zagruzit-demo.js');
const PULT_KLYUCH = 'test-pult-klyuch-0123456789abcdef';

Object.assign(process.env, { HRANILISHCHE_LOKALNO: '1', DRY_RUN: '1', PULT_KLYUCH_BRIGHTSIDE: PULT_KLYUCH });
for (const k of ['SITE_ID', 'BLOBS_TOKEN', 'NETLIFY_SITE_ID']) delete process.env[k];
globalThis.fetch = async (url) => { throw new Error('сеть в тестах запрещена: ' + String(url).slice(0, 80)); };

const { hranilishcheKlienta } = require('../lib/hranilishche');
const { e164 } = require('../lib/linii');
const { demoZapisi, demoSnimok } = require('../lib/shablony/demo-pult');

function novayaPapka() {
  process.env.HRANILISHCHE_PAPKA = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-zagruzka-'));
  return hranilishcheKlienta('brightside');
}
function zagruzit() {
  return execFileSync(process.execPath, [SKRIPT, '--seychas', SEYCHAS], { env: process.env, encoding: 'utf8' });
}

test('загрузка демо: семьи с индексом телефона и журнал дня лежат по модели контракта', async () => {
  const st = novayaPapka();
  const vyvod = zagruzit();
  const z = demoZapisi(SEYCHAS);
  assert.ok(z.semi.length > 0 && z.zhurnal.length > 0, 'в демо есть семьи и журнал');
  assert.match(vyvod, new RegExp(`"semi":${z.semi.length}\\b`));
  assert.match(vyvod, new RegExp(`"zhurnal/${DEN}":${z.zhurnal.length}\\b`));

  assert.equal((await st.vse('semi/')).length, z.semi.length);
  for (const s of z.semi) {
    assert.deepEqual(await st.getJSON(`semi/${s.id}`), s);
    assert.deepEqual(await st.getJSON(`indeks/telefon/semya/${e164(s.kontakt.telefon)}`), { id: s.id }, s.id);
  }
  const k = z.kandidaty[z.kandidaty.length - 1];
  assert.deepEqual(await st.getJSON(`indeks/telefon/kandidat/${e164(k.telefon)}`), { id: k.id });

  const zh = await st.getJSON(`zhurnal/${DEN}`);
  assert.deepEqual(zh, z.zhurnal);
  for (const s of zh) {
    for (const pole of ['at', 'kto', 'chto', 'obekt']) assert.ok(pole in s, `${pole} в строке журнала ${s.chto}`);
    assert.ok(s.at.startsWith(DEN), s.at);
  }
});

test('загрузка демо: пульт стенда на загруженных данных совпадает с демо-снимком (вместе с семьями и журналом)', async () => {
  novayaPapka();
  zagruzit();
  globalThis.__PLATFORMA_SEYCHAS__ = Date.parse(SEYCHAS);
  try {
    const r = await require('../netlify-functions/pult').handler({ httpMethod: 'GET', queryStringParameters: { k: PULT_KLYUCH }, headers: {} });
    assert.equal(r.statusCode, 200, r.body);
    const naStende = JSON.parse(r.body);
    const demo = JSON.parse(JSON.stringify(demoSnimok(SEYCHAS)));
    assert.ok(naStende.semi.length > 0 && naStende.zhurnal.length > 0);
    assert.deepEqual(naStende, demo);
  } finally {
    delete globalThis.__PLATFORMA_SEYCHAS__;
  }
});

test('загрузка демо: повтор не дублирует строки журнала, строки стенда в этом дне остаются', async () => {
  const st = novayaPapka();
  const svoya = { at: `${DEN}T13:59:30-04:00`, kto: 'sistema', chto: 'proverka_stenda', obekt: null };
  await st.setJSON(`zhurnal/${DEN}`, [svoya]);
  zagruzit();
  zagruzit();
  const z = demoZapisi(SEYCHAS);
  const zh = await st.getJSON(`zhurnal/${DEN}`);
  assert.equal(zh.length, z.zhurnal.length + 1);
  assert.equal(zh.filter((s) => s.chto === 'proverka_stenda').length, 1);
  assert.deepEqual(zh.filter((s) => s.chto !== 'proverka_stenda'), z.zhurnal);
  const vremena = zh.map((s) => Date.parse(s.at));
  assert.deepEqual(vremena, vremena.slice().sort((a, b) => a - b), 'журнал по времени');
  assert.equal((await st.vse('semi/')).length, z.semi.length, 'семьи — те же ключи, не копии');
});
