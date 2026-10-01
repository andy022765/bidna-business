'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
const svodka = require('../netlify-functions/svodka');

const zapusk = async (iso) => { P.vremya(iso); return svodka.svodkaKlienta(P.klient(), {}); };

test('расписание: 11 и 12 UTC; письмо — только в 7:xx по Нью-Йорку (летом 11 UTC, зимой 12 UTC)', async () => {
  const toml = require('fs').readFileSync(require('path').join(__dirname, '..', 'netlify.toml'), 'utf8');
  assert.match(toml, /\[functions\."svodka"\]\s*\n\s*schedule = "0 11,12 \* \* \*"/);
  assert.match(toml, /node_bundler = "esbuild"/);
  assert.match(toml, /NODE_VERSION = "20"/);

  const leto8 = await zapusk('2026-09-30T12:00:00Z');   // 8:00 EDT
  assert.equal(leto8.propushcheno, 'ne_tot_chas');
  assert.equal(leto8.mestnyy_chas, 8);
  const leto7 = await zapusk('2026-09-30T11:00:00Z');   // 7:00 EDT
  assert.equal(leto7.den, '2026-09-30');
  assert.ok(leto7.tema);
  const zima6 = await zapusk('2026-12-02T11:00:00Z');   // 6:00 EST
  assert.equal(zima6.propushcheno, 'ne_tot_chas');
  const zima7 = await zapusk('2026-12-02T12:00:00Z');   // 7:00 EST
  assert.equal(zima7.den, '2026-12-02');
});

test('сводка: письмо (DRY_RUN — в журнал) с шаблоном сборщика пульта, копия в svodki/<дата>, раз в сутки', async () => {
  const st = P.st();
  const kopiya = await st.getJSON('svodki/2026-09-30');
  assert.ok(kopiya && kopiya.tema && kopiya.html && kopiya.text);
  const zh = await P.zhurnal(st, '2026-09-30');
  const pismo = zh.find((z) => z.chto === 'pismo_dry_run' && z.detali.klyuch === 'svodka:brightside:2026-09-30');
  assert.ok(pismo, 'письмо сводки записано в журнал');
  assert.deepEqual(pismo.detali.komu, ['owner@example.com']);
  assert.ok(kopiya.html.includes('https://stend.example/pult/?k='), 'в письме ссылка на пульт с ключом (docs/API.md, раздел 6)');
  const povtor = await zapusk('2026-09-30T11:30:00Z');
  assert.equal(povtor.propushcheno, 'uzhe_otpravlena');
});

test('обработчик по расписанию проходит по всем клиентам и не падает', async () => {
  P.vremya('2026-10-01T11:00:00Z');
  const r = await svodka.handler({});
  assert.equal(r.statusCode, 200);
  const zh = await P.zhurnal(P.st(), '2026-10-01');
  assert.ok(zh.some((z) => z.chto === 'svodka'));
});
