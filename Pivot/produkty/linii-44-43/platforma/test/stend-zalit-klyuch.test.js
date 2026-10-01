'use strict';
// scripts/zalit-klyuch-kalendarya.js — только на локальном адаптере, с ВЫМЫШЛЕННЫМ ключом во временной папке.
// HOME подменён временной папкой: настоящие ~/bidna-klyuchi и токен netlify CLI тест не видит и не трогает.
// Сеть не нужна: всё, что могло бы пойти в Blobs, отсекается проверками до сети.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SKRIPT = path.join(__dirname, '..', 'scripts', 'zalit-klyuch-kalendarya.js');
const DOM = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-klyuch-home-'));
const PAPKA = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-klyuch-store-'));
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const KLYUCH_A = JSON.stringify({ type: 'service_account', project_id: 'demo-test', private_key_id: 'test1',
  private_key: PEM, client_email: 'kalendar-test@demo-test.iam.gserviceaccount.com' }, null, 2);
const KLYUCH_B = JSON.stringify({ type: 'service_account', project_id: 'demo-test', private_key_id: 'test2',
  private_key: PEM, client_email: 'drugoy-test@demo-test.iam.gserviceaccount.com' }, null, 2);
const FAYL_A = path.join(DOM, 'a.json');
const FAYL_B = path.join(DOM, 'b.json');
fs.writeFileSync(FAYL_A, KLYUCH_A);
fs.writeFileSync(FAYL_B, KLYUCH_B);
const blob = () => path.join(PAPKA, 'kalendar-klyuch', 'sa.blob');

function zapusk(args, dopEnv = {}) {
  const env = { PATH: process.env.PATH, HOME: DOM, HRANILISHCHE_PAPKA: PAPKA, ...dopEnv };
  const r = spawnSync(process.execPath, [SKRIPT, ...args], { env, encoding: 'utf8', timeout: 20000 });
  const vyvod = (r.stdout || '') + (r.stderr || '');
  // ни один запуск не печатает содержимое ключа
  for (const kusok of ['PRIVATE KEY', PEM.split('\n')[1], 'kalendar-test@', 'drugoy-test@', 'test1', 'test2']) {
    assert.ok(!vyvod.includes(kusok), `вывод скрипта содержит часть ключа: ${kusok.slice(0, 12)}…`);
  }
  return { kod: r.status, vyvod };
}

test('проба на локальном адаптере: ключ ложится в kalendar-klyuch/sa байт в байт, стенд читает его оттуда же', async () => {
  const r = zapusk(['--fayl', FAYL_A]);
  assert.equal(r.kod, 0, r.vyvod);
  assert.match(r.vyvod, /Залит в kalendar-klyuch\/sa: \d+ байт, sha256:[0-9a-f]{12} — сверено чтением/);
  assert.match(r.vyvod, /аккаунт календаря Веры — НЕТ/, 'вымышленный аккаунт честно назван «не тот»');
  assert.equal(fs.readFileSync(blob(), 'utf8'), KLYUCH_A);
  // lib/kalendar.js (klyuchSA) читает ключ из того же хранилища и ключа
  Object.assign(process.env, { HRANILISHCHE_LOKALNO: '1', HRANILISHCHE_PAPKA: PAPKA });
  delete process.env.GOOGLE_SA_JSON;
  const k = await require('../lib/kalendar').klyuchSA();
  assert.equal(k.client_email, 'kalendar-test@demo-test.iam.gserviceaccount.com');
});

test('повтор — без изменений; --proverit говорит «есть» и сверяет с файлом, ничего не пишет', () => {
  assert.match(zapusk(['--fayl', FAYL_A]).vyvod, /Уже залит тот же ключ/);
  const p = zapusk(['--proverit', '--fayl', FAYL_A]);
  assert.equal(p.kod, 0);
  assert.match(p.vyvod, /ключ ЕСТЬ: \d+ байт, sha256:[0-9a-f]{12} — тот же, что в файле/);
  const d = zapusk(['--proverit', '--fayl', FAYL_B]);
  assert.equal(d.kod, 4, 'в хранилище не тот ключ, что в файле');
  assert.equal(fs.readFileSync(blob(), 'utf8'), KLYUCH_A, '--proverit ничего не пишет');
});

test('другой ключ без --perezapisat — отказ; с флагом — замена', () => {
  const r = zapusk(['--fayl', FAYL_B]);
  assert.equal(r.kod, 4);
  assert.match(r.vyvod, /ДРУГОЙ ключ/);
  assert.equal(fs.readFileSync(blob(), 'utf8'), KLYUCH_A);
  const z = zapusk(['--fayl', FAYL_B, '--perezapisat']);
  assert.equal(z.kod, 0, z.vyvod);
  assert.match(z.vyvod, /заменил прежний/);
  assert.equal(fs.readFileSync(blob(), 'utf8'), KLYUCH_B);
});

test('пустое хранилище: --proverit — «нет», код 1; кривой файл — код 2 без цитаты содержимого', () => {
  const pusto = fs.mkdtempSync(path.join(os.tmpdir(), 'platforma-klyuch-pusto-'));
  const n = zapusk(['--proverit'], { HRANILISHCHE_PAPKA: pusto });
  assert.equal(n.kod, 1);
  assert.match(n.vyvod, /ключа НЕТ/);
  const krivoy = path.join(DOM, 'krivoy.json');
  fs.writeFileSync(krivoy, 'abc SEKRET-ZNACHENIE {');
  const k = zapusk(['--fayl', krivoy]);
  assert.equal(k.kod, 2);
  assert.match(k.vyvod, /не JSON/);
  assert.ok(!k.vyvod.includes('SEKRET-ZNACHENIE'), 'текст файла не цитируется');
  const bezPoley = path.join(DOM, 'bez.json');
  fs.writeFileSync(bezPoley, JSON.stringify({ type: 'service_account' }));
  assert.equal(zapusk(['--fayl', bezPoley]).kod, 2);
  assert.equal(zapusk([]).kod, 2, 'по умолчанию ~/bidna-klyuchi/vera-kalendar.json — в подменённом HOME его нет');
});

test('--blobs: без SITE_ID, с чужим SITE_ID или без токена — отказ до сети; проба в папку Drive — отказ', () => {
  const a = zapusk(['--blobs', '--fayl', FAYL_A]);
  assert.equal(a.kod, 2);
  assert.match(a.vyvod, /нужен SITE_ID/);
  const b = zapusk(['--blobs', '--fayl', FAYL_A], { SITE_ID: '4583b8b6-f9f4-4fae-b369-d107c8ac56a3' });   // сайт Веры
  assert.equal(b.kod, 2);
  assert.match(b.vyvod, /не стенд linii-demo-85fof/);
  const c = zapusk(['--blobs', '--fayl', FAYL_A], { SITE_ID: 'ea43276c-c92b-479d-b662-541651e04cf2' });
  assert.equal(c.kod, 2, 'токена нет ни в окружении, ни в netlify CLI подменённого HOME');
  assert.match(c.vyvod, /Нет токена Netlify/);
  const d = zapusk(['--fayl', FAYL_A], { HRANILISHCHE_PAPKA: path.join(__dirname, '..', '.data-proba') });
  assert.equal(d.kod, 2);
  assert.match(d.vyvod, /не кладёт ключ в Google Drive/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', '.data-proba')), false);
});
