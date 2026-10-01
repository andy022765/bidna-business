#!/usr/bin/env node
'use strict';
// Демо-данные brightside (вымышленные: lib/shablony/demo-pult.js сборщика пульта) → хранилище клиента k-brightside.
//
//   node scripts/zagruzit-demo.js                      локально, в platforma/.data (ручной прогон функций)
//   node scripts/zagruzit-demo.js --blobs              в Netlify Blobs стенда — ТОЛЬКО по «да» Андрея, после выкладки;
//                                                      нужны SITE_ID и BLOBS_TOKEN в окружении (значения не печатаются)
//   --seychas 2026-09-30T14:05:00-04:00                на какой момент собрать статусы (по умолчанию — сейчас)
//
// Грузит только клиентов с demo:true в nastroyki.json. Настоящих людей в демо нет: телефоны 555-01xx, почта @example.com.
// Ключи — по модели KONTRAKT.md («Хранилище»): kandidaty/, semi/, sidelki/, klienty/, smeny/, otkazy/, evv/, zvonki/,
// soglasiya/ — по одной записи на ключ (повторная загрузка перезаписывает те же ключи); индексы телефонов
// indeks/telefon/kandidat|semya/<E.164> — как пишет lib/kartochki.js (повторный звонок находит ту же карточку);
// zhurnal/<YYYY-MM-DD> — массив {at, kto, chto, obekt[, detali]} за день --seychas по поясу клиента: строки
// дописываются к тому, что в этом дне уже лежит (стенд мог писать сам), одинаковая строка не дублируется.

const path = require('path');
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const znach = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

if (flag('--blobs')) {
  if (!process.env.SITE_ID || !process.env.BLOBS_TOKEN) {
    console.error('Для --blobs нужны SITE_ID и BLOBS_TOKEN в окружении.');
    process.exit(2);
  }
  delete process.env.HRANILISHCHE_LOKALNO;
} else {
  process.env.HRANILISHCHE_LOKALNO = '1';
  process.env.HRANILISHCHE_PAPKA = process.env.HRANILISHCHE_PAPKA || path.join(__dirname, '..', '.data');
}

const { hranilishcheKlienta } = require('../lib/hranilishche');
const linii = require('../lib/linii');
const { denKlyuch, POYAS } = require('../lib/vremya');
let demo;
try { demo = require('../lib/shablony/demo-pult'); }
catch (e) { console.error('Нет lib/shablony/demo-pult.js (сборщик пульта):', e.message); process.exit(1); }

const KLYUCH = {
  kandidaty: (x) => x.id, semi: (x) => x.id, sidelki: (x) => x.id, klienty: (x) => x.id, smeny: (x) => x.id,
  otkazy: (x) => x.id, evv: (x) => x.run_id, zvonki: (x) => x.conversation_id, soglasiya: (x) => x.telefon,
};
// Индекс телефона → карточка: [вид, телефон] (вид — как в lib/kartochki.js и netlify-functions/zapis.js).
const INDEKS = {
  kandidaty: (x) => ['kandidat', x.telefon],
  semi: (x) => ['semya', x.kontakt && x.kontakt.telefon],
};

const strokaZhurnala = (x) => JSON.stringify(x);

(async () => {
  const klient = linii.klient('brightside');
  if (!klient || klient.demo !== true) { console.error('brightside не помечен demo:true — не гружу.'); process.exit(1); }
  const st = hranilishcheKlienta(klient.id);
  if (!st) { console.error('Хранилище не поднялось.'); process.exit(1); }
  const poyas = klient.poyas || POYAS;
  const seychas = znach('--seychas') || new Date().toISOString();
  const z = demo.demoZapisi(seychas);
  const itog = {};
  for (const [kol, id] of Object.entries(KLYUCH)) {
    let n = 0;
    for (const x of z[kol] || []) {
      const k = id(x);
      if (!k) continue;
      await st.setJSON(`${kol}/${k}`, x);
      const ind = INDEKS[kol] ? INDEKS[kol](x) : null;
      const tel = ind ? linii.e164(ind[1]) : null;
      if (tel) await st.setJSON(`indeks/telefon/${ind[0]}/${tel}`, { id: x.id });
      n++;
    }
    itog[kol] = n;
  }

  // журнал: по дням (местная дата строки), слиянием с тем, что уже есть, по времени
  const poDnyam = new Map();
  for (const s of z.zhurnal || []) {
    if (!s || !s.at || isNaN(Date.parse(s.at))) continue;
    const den = denKlyuch(new Date(s.at), poyas);
    if (!poDnyam.has(den)) poDnyam.set(den, []);
    poDnyam.get(den).push(s);
  }
  let novyh = 0;
  for (const [den, stroki] of poDnyam) {
    await st.obnovit(`zhurnal/${den}`, (bylo) => {
      const a = Array.isArray(bylo) ? bylo : [];
      const est = new Set(a.map(strokaZhurnala));
      novyh = 0;
      for (const s of stroki) {
        if (est.has(strokaZhurnala(s))) continue;
        est.add(strokaZhurnala(s));
        a.push(s);
        novyh++;
      }
      return a.sort((p, q) => Date.parse(p.at) - Date.parse(q.at));
    });
    itog[`zhurnal/${den}`] = novyh;
  }
  console.log(`Загружено в ${st.rezhim === 'blobs' ? 'Blobs стенда' : process.env.HRANILISHCHE_PAPKA} (k-${klient.id}):`, JSON.stringify(itog));
})().catch((e) => { console.error('Упало:', e.message); process.exit(1); });
