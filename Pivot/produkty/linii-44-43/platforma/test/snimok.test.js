'use strict';
// Снимок пульта: lib/shablony/snimok.js (формат docs/API.md). Запуск: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { sobratSnimok, statusOtkaza, mestnayaData, isoMestnoe } = require('../lib/shablony/snimok');
const { demoSnimok, demoZapisi, SEYCHAS_PULT } = require('../lib/shablony/demo-pult');

const T = (s) => `2026-10-${s}-04:00`;

test('статус отказа: закрыта / не закрыта / эскалация / в работе', () => {
  const seychas = new Date(T('05T12:00:00'));
  const buduschaya = { start: T('05T18:00:00'), status: 'offered' };
  assert.equal(statusOtkaza({ zakreplena_v: T('05T11:00:00') }, buduschaya, seychas), 'zakryta');
  assert.equal(statusOtkaza({ eskalaciya_v: T('05T11:00:00') }, buduschaya, seychas), 'eskalaciya');
  assert.equal(statusOtkaza({}, buduschaya, seychas), 'v_rabote');
  assert.equal(statusOtkaza({ eskalaciya_v: T('05T11:00:00') }, { ...buduschaya, status: 'unfilled' }, seychas), 'ne_zakryta');
  // смена началась, замены нет — не закрыта, даже без отметки unfilled
  assert.equal(statusOtkaza({}, { start: T('05T09:00:00'), status: 'offered' }, seychas), 'ne_zakryta');
  // стенд закрыл отказ без замены (lib/otkazy.js: zakrit + ne_zakryta_v), даже если смену не обновили
  assert.equal(statusOtkaza({ zakrit: true, ne_zakryta_v: T('05T09:00:00'), eskalaciya_v: T('05T07:00:00') }, buduschaya, seychas), 'ne_zakryta');
  // закрепление важнее всего
  assert.equal(statusOtkaza({ zakreplena_v: T('05T08:00:00'), eskalaciya_v: T('05T07:00:00') }, { start: T('05T09:00:00'), status: 'filled' }, seychas), 'zakryta');
});

test('местная дата и ISO со смещением, включая переход на зимнее время', () => {
  assert.equal(mestnayaData('2026-10-05T03:30:00Z', 'America/New_York'), '2026-10-04');
  assert.equal(isoMestnoe('2026-10-05T11:00:00Z', 'America/New_York'), '2026-10-05T07:00:00-04:00');
  assert.equal(isoMestnoe('2026-11-02T12:00:00Z', 'America/New_York'), '2026-11-02T07:00:00-05:00');
});

test('записи позже момента снимка не попадают в снимок', () => {
  const s = sobratSnimok({
    klient: { id: 't', poyas: 'America/New_York' },
    seychas: T('05T07:00:00'),
    zapisi: {
      zvonki: [
        { conversation_id: 'rano', nachalo: T('05T06:00:00'), dlitelnost_s: 60, yazyk: 'en' },
        { conversation_id: 'pozzhe', nachalo: T('05T09:00:00'), dlitelnost_s: 60, yazyk: 'en' },
      ],
      kandidaty: [{ id: 'k1', created_at: T('05T10:00:00'), status: 'new' }],
    },
  });
  assert.deepEqual(s.zvonki.map((z) => z.conversation_id), ['rano']);
  assert.equal(s.segodnya.zvonki.vsego, 1);
  assert.equal(s.kandidaty.length, 0);
});

test('отказ обогащается сменой, именами и минутами до закрытия', () => {
  const s = sobratSnimok({
    klient: { id: 't', poyas: 'America/New_York' },
    seychas: T('05T12:00:00'),
    zapisi: {
      sidelki: [{ id: 's1', imya: 'A' }, { id: 's2', imya: 'B' }, { id: 's3', imya: 'C' }],
      klienty: [{ id: 'c1', kod: 'BK-1', rayon: 'Midwood', zip: '11230' }],
      smeny: [{ id: 'sm1', klient_id: 'c1', start: T('05T15:00:00'), end: T('05T19:00:00'), kod_uslugi: 'T1019', status: 'filled' }],
      otkazy: [{
        id: 'o1', smena_id: 'sm1', sidelka_id: 's1', soobshcheno: T('05T10:00:00'), kanal: 'sms',
        volny: [{ at: T('05T10:01:00'), sidelki: ['s2', 's3'] }, { at: T('05T10:16:00'), sidelki: ['s3'] }],
        otvety: [{ sidelka_id: 's2', otvet: 'da', at: T('05T10:21:00') }], zakreplena_za: 's2', zakreplena_v: T('05T10:21:00'),
      }],
    },
  });
  const o = s.otkazy[0];
  assert.equal(o.status, 'zakryta');
  assert.equal(o.zakryta_za_min, 21);
  assert.equal(o.predlozheno, 2, 'уникальные сиделки по всем волнам');
  assert.deepEqual(o.sidelka, { id: 's1', imya: 'A' });
  assert.deepEqual(o.zamena, { id: 's2', imya: 'B' });
  assert.equal(o.smena.klient_kod, 'BK-1');
  assert.equal(o.smena.rayon, 'Midwood');
  assert.equal(s.segodnya.otkazy.zakryto, 1);
  assert.equal(s.segodnya.otkazy.mediana_min, 21);
});

test('DEMO-снимок: сюжеты отказов и воронка сходятся', () => {
  const s = demoSnimok(SEYCHAS_PULT);
  assert.equal(s.demo, true);
  assert.match(s.klient.nazvanie, /DEMO/);
  assert.equal(s.sformirovano, '2026-09-30T14:05:00-04:00');
  const po = Object.fromEntries(s.otkazy.map((o) => [o.id, o]));
  assert.equal(po['otk-11'].status, 'eskalaciya');
  assert.equal(po['otk-09'].status, 'ne_zakryta');
  assert.equal(po['otk-10'].status, 'zakryta');
  assert.equal(po['otk-10'].zakryta_za_min, 12);
  // второе «ДА» записано, но закреплён первый
  assert.equal(po['otk-10'].otvety.filter((x) => x.otvet === 'da').length, 2);
  assert.equal(po['otk-10'].zakreplena_za, po['otk-10'].otvety[0].sidelka_id);
  const [nov, zap, prish] = s.voronka.etapy.map((e) => e.n);
  assert.ok(nov >= zap && zap >= prish && prish > 0, `${nov} → ${zap} → ${prish}`);
  const summaPrichin = s.voronka.otkazy_po_prichinam.reduce((a, p) => a + p.n, 0);
  assert.equal(summaPrichin, (s.voronka.statusy.rejected || 0) + (s.voronka.statusy.waitlist || 0));
  assert.equal(s.evv.posledniy.isklyucheniya.length, s.evv.progony[0].isklyucheniy);
});

test('DEMO-данные: только вымышленные телефоны 555-01xx и почта example.com', () => {
  const z = demoZapisi(SEYCHAS_PULT);
  const tel = [...z.kandidaty.map((k) => k.telefon), ...z.sidelki.map((x) => x.telefon), ...z.soglasiya.map((x) => x.telefon)];
  assert.ok(tel.length > 100);
  for (const t of tel) assert.match(t, /^\+1\d{3}55501\d{2}$/, t);
  for (const k of z.kandidaty) if (k.email) assert.match(k.email, /@example\.com$/);
});

test('web/pult/demo.json собран из текущего генератора', () => {
  const fayl = path.join(__dirname, '..', 'web', 'pult', 'demo.json');
  const naDiske = JSON.parse(fs.readFileSync(fayl, 'utf8'));
  const svezhiy = JSON.parse(JSON.stringify(demoSnimok(SEYCHAS_PULT)));
  delete naDiske.pometka;
  assert.deepEqual(naDiske, svezhiy, 'demo.json устарел: node lib/shablony/demo-pult.js');
});
