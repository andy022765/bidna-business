'use strict';
/**
 * DEMO-данные пульта CareLine: вымышленное агентство «Brightside Home Care (DEMO)», Бруклин и Квинс.
 *
 * ОТКУДА ЛЮДИ И КОДЫ. Сиделки, клиенты, расписание, авторизации и выгрузка EVV — из care/demo-dannye/
 * (генератор care/demo-dannye/generator.js, seed 44): те же CG-001…CG-045 с теми же именами и телефонами,
 * CL-001…CL-060 с кодами BK-### / QN-###, смены SM-0001…SM-0253 (неделя пн 05.10 – вс 11.10.2026).
 * Снимок пульта — 30.09.2026 14:05, раньше этой недели. Расписание агентства повторяется каждую неделю,
 * поэтому в снимке три недели: 21–27.09 и 28.09–04.10 — те же слоты, перенесённые на 14 и 7 дней назад
 * (тот же клиент, сиделка, время, код услуги; id «<id слота>-<ММДД>», например SM-0160-0924), и сама неделя
 * 05–11.10 как есть. Отказы от смен — на слотах 24–30.09; кого звали на замену — по рейтингу lib/care/zamena.js
 * на этих данных (посчитан 30.09 и записан в таблицу OTKAZY, движок при генерации не вызывается).
 * Последняя проверка EVV (29.09) — evv-s-oshibkami.csv, перенесённая на 14 дней назад (визиты 21–27.09)
 * и прогнанная настоящим движком lib/care/evv.js: те же 30 подложенных ошибок (сверка с oshibki-ozhidaemye.json,
 * не сошлось — генератор падает). Где смену после отказа закрыла другая сиделка, визит в выгрузке записан на неё.
 * Кандидаты, семьи, звонки, согласия и журнал действий придуманы здесь: в demo-dannye их нет.
 * Телефоны — только 555-0100…555-0199 (без повторов с сиделками и клиентами), почта — @example.com.
 *
 * demoZapisi(seychas) → { kandidaty, sidelki, klienty, smeny, otkazy, evv, zvonki, soglasiya, semi, zhurnal }
 *   Записи в модели KONTRAKT.md и lib/kartochki.js (semi), журнал — как lib/zhurnal.js за день seychas.
 *   Одно зерно: при любом seychas те же люди и события, статусы — на момент seychas.
 * demoSnimok(seychas) → снимок как у netlify-functions/pult.js: sobratSnimok + semi (до 50) + zhurnal (до 100).
 *
 * Запуск из platforma/:  node lib/shablony/demo-pult.js
 *   → web/pult/demo.json          снимок пульта на 30.09.2026 14:05 по Нью-Йорку
 *   → web/demo/care/svodka.html   образец утреннего письма 30.09.2026 7:00
 * Правка генератора, care/demo-dannye или движка EVV → перезапустить (test/snimok.test.js сверяет demo.json).
 */

const path = require('path');
const fs = require('fs');
const { sobratSnimok, isoMestnoe } = require('./snimok');

const POYAS = 'America/New_York';
const SMESHCHENIE = '-04:00';
const SEYCHAS_PULT = '2026-09-30T14:05:00-04:00';
const SEYCHAS_SVODKA = '2026-09-30T07:00:00-04:00';
const DEMO_DANNYE = path.resolve(__dirname, '..', '..', '..', 'care', 'demo-dannye');

// ---------- случайность с зерном ----------

function sZernom(zerno) {
  let a = zerno >>> 0;
  return function sluchay() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- время ----------

const t = (data, hhmm) => `${data}T${hhmm}:00${SMESHCHENIE}`;
const plusMin = (iso, min) => isoMestnoe(new Date(Date.parse(iso) + min * 60000), POYAS);
const plusSek = (iso, sek) => isoMestnoe(new Date(Date.parse(iso) + sek * 1000), POYAS);
const den = (d) => `2026-09-${String(d).padStart(2, '0')}`;
function sdvigYmd(ymd, dney) {
  const [g, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(g, m - 1, d + dney)).toISOString().slice(0, 10);
}
function denNedeli(ymd) {
  const [g, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(g, m - 1, d)).getUTCDay(); // 0 = вс
}
function sledRabochiy(ymd, shag) {
  let x = ymd;
  let n = shag;
  while (n > 0) {
    x = sdvigYmd(x, 1);
    const w = denNedeli(x);
    if (w !== 0 && w !== 6) n -= 1;
  }
  return x;
}
const FMT_DEN = new Intl.DateTimeFormat('en-US', { timeZone: POYAS, weekday: 'short', month: 'short', day: 'numeric' });
const FMT_CHAS = new Intl.DateTimeFormat('en-US', { timeZone: POYAS, hour: 'numeric', minute: '2-digit' });
const kogda = (iso) => `${FMT_DEN.format(new Date(iso))}, ${FMT_CHAS.format(new Date(iso))}`;
const kogdaPolno = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: POYAS, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

// ---------- care/demo-dannye ----------

// Подпись района по ZIP клиента — только для показа (в demo-dannye у клиента есть ZIP, района нет).
const RAYON_PO_ZIP = {
  11102: 'Astoria', 11103: 'Astoria', 11201: 'Brooklyn Heights', 11203: 'East Flatbush', 11204: 'Bensonhurst',
  11206: 'East Williamsburg', 11207: 'East New York', 11208: 'Cypress Hills', 11210: 'Midwood', 11213: 'Crown Heights',
  11214: 'Bensonhurst', 11220: 'Sunset Park', 11221: 'Bushwick', 11223: 'Gravesend', 11224: 'Coney Island',
  11225: 'Prospect Lefferts Gardens', 11229: 'Sheepshead Bay', 11231: 'Carroll Gardens', 11232: 'Sunset Park',
  11235: 'Brighton Beach', 11236: 'Canarsie', 11237: 'Bushwick', 11354: 'Flushing', 11356: 'College Point',
  11361: 'Bayside', 11367: 'Kew Gardens Hills', 11369: 'East Elmhurst', 11370: 'East Elmhurst', 11372: 'Jackson Heights',
  11373: 'Elmhurst', 11374: 'Rego Park', 11375: 'Forest Hills', 11385: 'Ridgewood', 11411: 'Cambria Heights',
  11417: 'Ozone Park', 11422: 'Rosedale', 11426: 'Bellerose', 11434: 'South Jamaica', 11691: 'Far Rockaway', 11694: 'Rockaway Park',
};

let ISTOCHNIK = null;
function istochnik() {
  if (ISTOCHNIK) return ISTOCHNIK;
  const chitat = (f) => fs.readFileSync(path.join(DEMO_DANNYE, f), 'utf8');
  ISTOCHNIK = {
    sidelki: JSON.parse(chitat('sidelki.json')),
    klienty: JSON.parse(chitat('klienty.json')),
    smeny: JSON.parse(chitat('smeny.json')),
    avtorizacii: JSON.parse(chitat('avtorizacii.json')),
    oshibki: JSON.parse(chitat('oshibki-ozhidaemye.json')),
    csv: chitat('evv-s-oshibkami.csv'),
  };
  return ISTOCHNIK;
}

// Слот расписания на dney дней раньше/позже: тот же клиент, сиделка, время, код услуги; id — «<слот>-<ММДД>».
function idPerenosa(slot, dney) { return `${slot.id}-${sdvigYmd(slot.start.slice(0, 10), dney).slice(5).replace('-', '')}`; }
function perenos(slot, dney) {
  return {
    ...slot,
    id: idPerenosa(slot, dney),
    start: sdvigYmd(slot.start.slice(0, 10), dney) + slot.start.slice(10),
    end: sdvigYmd(slot.end.slice(0, 10), dney) + slot.end.slice(10),
  };
}

// ---------- EVV: выгрузка demo-dannye, перенесённая на dney дней, через движок lib/care/evv.js ----------

const EVV_KESH = new Map();
function evvProgon(dney, zameny) {
  const klyuch = `${dney}|${JSON.stringify(zameny || {})}`;
  if (EVV_KESH.has(klyuch)) return EVV_KESH.get(klyuch);
  const evv = require('../care/evv');
  const src = istochnik();
  const noviyId = new Map(src.smeny.map((s) => [s.id, idPerenosa(s, dney)]));
  const smeny = src.smeny.map((s) => perenos(s, dney)).map((s) => (zameny && zameny[s.id] ? { ...s, sidelka_id: zameny[s.id] } : s));
  const avtorizacii = src.avtorizacii.map((a) => ({ ...a, s: sdvigYmd(a.s, dney), po: sdvigYmd(a.po, dney) }));
  // Дата визита и все времена — на dney дней; Schedule ID — перенесённый id; Caregiver Code — кто правда вышел.
  const stroki = src.csv.replace(/\r\n/g, '\n').replace(/\b(\d{4}-\d\d-\d\d)\b/g, (x) => sdvigYmd(x, dney)).split('\n');
  const zag = stroki[0].split(',');
  const iSm = zag.indexOf('Schedule ID');
  const iSid = zag.indexOf('Caregiver Code');
  const csv = [stroki[0]].concat(stroki.slice(1).map((s) => {
    if (!s.trim()) return s;
    const p = s.split(','); // запятые в кавычках есть только в последней колонке Notes — склейка обратно её не меняет
    const smId = noviyId.get(p[iSm]) || p[iSm];
    p[iSm] = smId;
    if (zameny && zameny[smId] && p[iSid]) p[iSid] = zameny[smId];
    return p.join(',');
  })).join('\n');
  const r = evv.proveritCsv(csv, avtorizacii, smeny, 'NY', src.klienty);
  const imya = new Map(src.sidelki.map((s) => [s.id, s.imya]));
  const itog = {
    strok: r.strok,
    isklyucheniya: r.isklyucheniya.map((x) => ({ ...x, vizit: { ...x.vizit, sidelka: x.vizit && x.vizit.sidelka_id ? imya.get(x.vizit.sidelka_id) || null : null } })),
  };
  EVV_KESH.set(klyuch, itog);
  return itog;
}

// ---------- справочники ----------

// Где живут кандидаты (не клиенты): район и ZIP.
const RAYONY = [
  ['Brighton Beach', '11235'], ['Bensonhurst', '11214'], ['Sheepshead Bay', '11229'], ['Midwood', '11230'],
  ['Borough Park', '11219'], ['Flatbush', '11226'], ['East Flatbush', '11203'], ['Crown Heights', '11213'],
  ['Canarsie', '11236'], ['Sunset Park', '11220'], ['Bay Ridge', '11209'], ['Bushwick', '11237'],
  ['Forest Hills', '11375'], ['Rego Park', '11374'], ['Flushing', '11355'], ['Jackson Heights', '11372'],
  ['Corona', '11368'], ['Elmhurst', '11373'], ['Jamaica', '11432'], ['Richmond Hill', '11418'], ['Ridgewood', '11385'],
];
const VNE_RAYONA = [['Staten Island', '10314'], ['Bronx', '10467'], ['Yonkers', '10701'], ['Jersey City', '07306']];
const RAYON_ZIP = Object.fromEntries(RAYONY.concat(VNE_RAYONA));

const IMENA = {
  es: {
    f: ['Marisol', 'Yesenia', 'Carmen', 'Lucía', 'Rosa', 'Ana', 'Gloria', 'Maribel', 'Dayana', 'Leticia', 'Esperanza', 'Karina', 'Johanna', 'Paola', 'Wendy', 'Ingrid', 'Mirtha', 'Altagracia', 'Yudelka', 'Nancy'],
    m: ['Carlos', 'Luis', 'Rafael', 'Wilson'],
    l: ['Ortega', 'Delgado', 'Rosario', 'Peña', 'Cabrera', 'Santana', 'Almonte', 'Batista', 'Vargas', 'Mejía', 'Quiñones', 'Guzmán', 'Paredes', 'Rivas', 'Espinal', 'Tejada', 'Polanco', 'Cruz', 'Castillo', 'Reyes', 'Fernández', 'Herrera', 'Suárez', 'Acosta', 'Méndez', 'Rojas', 'Valdez'],
  },
  ru: {
    f: ['Nadia', 'Svetlana', 'Oksana', 'Irina', 'Galina', 'Larisa', 'Tatiana', 'Yelena', 'Marina', 'Lyudmila', 'Olga', 'Zarina', 'Dilnoza', 'Gulnara', 'Natalia', 'Alla'],
    m: ['Dmitri', 'Rustam', 'Aleksandr'],
    l: ['Petrenko', 'Kovalenko', 'Abramova', 'Sokolova', 'Melnyk', 'Yusupova', 'Karimova', 'Rakhimova', 'Belenko', 'Zaitseva', 'Orlova', 'Tkachenko', 'Lysenko', 'Gromova', 'Sadykova', 'Kuzmina', 'Morozova', 'Pavlova', 'Volkova', 'Nazarova', 'Ismailova', 'Bondarenko', 'Shevchenko', 'Romanova'],
  },
  ht: {
    f: ['Guerline', 'Nadège', 'Mirlande', 'Fabiola', 'Roseline', 'Chantal', 'Myrlande', 'Widline', 'Marie-Claude'],
    m: ['Jean-Robert', 'Frantz'],
    l: ['Joseph', 'Pierre', 'Jean-Baptiste', 'Charles', 'Baptiste', 'François', 'Étienne', 'Désir', 'Louis', 'Moïse', 'Augustin', 'Célestin', 'Dorvil', 'Noël'],
  },
  zh: { f: ['Mei Lin', 'Xiu Ying', 'Hui Min', 'Li Na', 'Yan'], m: ['Wei'], l: ['Chen', 'Lin', 'Wong', 'Zhang', 'Liu', 'Huang', 'Wu', 'Zhou', 'Xu', 'Guo'] },
  en: {
    f: ['Tamika', 'Shanice', 'Keisha', 'Andrea', 'Patrice', 'Denise', 'Grace', 'Abena', 'Folake', 'Monique', 'Latoya', 'Crystal', 'Simone', 'Tanya', 'Kimberly'],
    m: ['Kwame', 'Andre', 'Marcus'],
    l: ['Williams', 'Campbell', 'Thompson', 'Brown', 'Mensah', 'Adeyemi', 'Okafor', 'Richards', 'Grant', 'Clarke', 'Johnson', 'Mitchell', 'Owusu', 'Boateng', 'Asante', 'Nwosu', 'Harris', 'Robinson', 'Walker', 'Bailey', 'Forbes', 'Morgan', 'Edwards'],
  },
};

// Причины отказа от смены — коды инструмента otkaz_ot_smeny (care/list-pravdy: bolezn, semya, transport, drugoe).
const PRICHINA_SMENY = { bolezn: 'illness', semya: 'family reasons', transport: 'transportation', drugoe: 'other reason' };
const OPLATA_TEKST = { private: 'private pay', medicaid: 'Medicaid', ltc: 'long-term care insurance', unknown: 'payment not decided yet' };
const SROCHNOST_TEKST = { srochno: 'within a few days', nedelya: 'within a week or two', pozzhe: 'later', ne_znayu: 'start date not decided' };
const AGENTSTVO = 'Brightside Home Care (DEMO)';
const POCHTA_KOORDINATORA = ['intake@brightside.example.com'];
const POCHTA_SVODKI = ['owner@brightside.example.com'];

// Отказы от смен. slot — смена недели 05–11.10 из care/demo-dannye/smeny.json, den — на какой день 24–30.09 она пришлась.
// volny — кому ушло предложение: сверху рейтинга lib/care/zamena.js (язык и навык клиента, свободна, лимит часов,
// согласие на SMS, расстояние, знает клиента, надёжность). Время волн — по правилам nastroyki.json: волна 3,
// ждём 15 мин, будим дежурного, когда до начала меньше 2 ч или предлагать больше некому (eskKod — как в движке).
const OTKAZY = [
  { n: 1, slot: 'SM-0160', den: den(24), at: t(den(24), '06:12'), kanal: 'sms', prichina: 'bolezn',
    volny: [['06:13', ['CG-026', 'CG-022', 'CG-024']]], otvety: [['CG-022', 'net', '06:16'], ['CG-026', 'da', '06:21']], zakr: ['CG-026', '06:21'] },
  { n: 2, slot: 'SM-0210', den: den(25), at: t(den(24), '20:47'), kanal: 'call', prichina: 'semya',
    volny: [['20:49', ['CG-005', 'CG-032', 'CG-012']], ['21:04', ['CG-006', 'CG-041', 'CG-040']]],
    otvety: [['CG-032', 'net', '20:55'], ['CG-005', 'da', '21:09']], zakr: ['CG-005', '21:09'] },
  { n: 3, slot: 'SM-0178', den: den(25), at: t(den(25), '04:40'), kanal: 'sms', prichina: 'transport',
    volny: [['04:41', ['CG-013', 'CG-015', 'CG-002']], ['04:56', ['CG-023', 'CG-039', 'CG-022']]],
    otvety: [['CG-015', 'net', '04:47']], esk: '05:01', eskKod: 'malo_vremeni', zakr: ['CG-023', '05:38'] },
  { n: 4, slot: 'SM-0234', den: den(26), at: t(den(26), '07:15'), kanal: 'sms', prichina: 'bolezn',
    volny: [['07:17', ['CG-013', 'CG-015', 'CG-002']]], otvety: [['CG-013', 'da', '07:25']], zakr: ['CG-013', '07:25'] },
  { n: 5, slot: 'SM-0249', den: den(27), at: t(den(27), '10:05'), kanal: 'call', prichina: 'semya',
    volny: [['10:06', ['CG-024', 'CG-021', 'CG-026']]], otvety: [['CG-021', 'net', '10:12'], ['CG-024', 'da', '10:19']], zakr: ['CG-024', '10:19'] },
  { n: 6, slot: 'SM-0003', den: den(28), at: t(den(27), '21:30'), kanal: 'sms', prichina: 'semya',
    volny: [['21:31', ['CG-013', 'CG-015', 'CG-002']], ['21:46', ['CG-005', 'CG-022']]],
    otvety: [['CG-015', 'net', '21:40'], ['CG-005', 'net', '21:58']], esk: '22:01', eskKod: 'nikto_ne_otvetil', zakr: ['CG-013', '22:37'] },
  { n: 7, slot: 'SM-0035', den: den(28), at: t(den(28), '06:50'), kanal: 'call', prichina: 'drugoe',
    volny: [['06:52', ['CG-005', 'CG-012', 'CG-032']]], otvety: [['CG-005', 'da', '06:57']], zakr: ['CG-005', '06:57'] },
  { n: 8, slot: 'SM-0069', den: den(29), at: t(den(29), '05:31'), kanal: 'call', prichina: 'bolezn',
    volny: [['05:32', ['CG-015', 'CG-020', 'CG-017']]], otvety: [['CG-015', 'da', '05:40']], zakr: ['CG-015', '05:40'] },
  { n: 9, slot: 'SM-0088', den: den(29), at: t(den(29), '13:52'), kanal: 'sms', prichina: 'semya',
    volny: [['13:53', ['CG-036', 'CG-033', 'CG-028']], ['14:08', ['CG-032', 'CG-029']]],
    otvety: [['CG-033', 'net', '13:58'], ['CG-028', 'net', '14:20']], esk: '14:00', eskKod: 'malo_vremeni', eskPrinyal: '14:03', nezakryta: true },
  { n: 10, slot: 'SM-0118', den: den(30), at: t(den(30), '05:02'), kanal: 'sms', prichina: 'bolezn',
    sms: "Hi, it's Sharon. I'm sick today and can't do my 12pm shift.",
    volny: [['05:03', ['CG-040', 'CG-012', 'CG-032']]], otvety: [['CG-040', 'da', '05:14'], ['CG-012', 'da', '05:16']], zakr: ['CG-040', '05:14'] },
  { n: 11, slot: 'SM-0134', den: den(30), at: t(den(30), '12:40'), kanal: 'sms', prichina: 'semya',
    sms: 'Hoy no puedo ir a las 4, es un problema familiar. Beatriz',
    volny: [['12:41', ['CG-019', 'CG-018', 'CG-012']], ['12:56', ['CG-010']]], otvety: [['CG-018', 'net', '12:49']],
    esk: '13:11', eskKod: 'nikto_ne_otvetil', eskPrinyal: '13:13' },
];

// ---------- генератор ----------

function demoZapisi(seychasVhod) {
  const seychas = new Date(seychasVhod || SEYCHAS_PULT);
  const uzhe = (iso) => !!iso && new Date(iso) <= seychas;
  const segodnya = isoMestnoe(seychas, POYAS).slice(0, 10);
  const src = istochnik();
  const sl = sZernom(44044);
  const vybor = (a) => a[Math.floor(sl() * a.length)];
  const shans = (p) => sl() < p;
  const celoe = (a, b) => a + Math.floor(sl() * (b - a + 1));

  // телефоны: +1 <код> 555-01xx, без повторов — и без номеров сиделок и клиентов из demo-dannye
  const zanyato = new Set(src.sidelki.map((s) => s.telefon).concat(src.klienty.map((k) => k.telefon)).filter(Boolean));
  function telefon() {
    for (;;) {
      const nomer = `+1${vybor(['718', '347', '929', '917', '646'])}55501${String(celoe(0, 99)).padStart(2, '0')}`;
      if (!zanyato.has(nomer)) { zanyato.add(nomer); return nomer; }
    }
  }
  const pochta = (imya) => `${imya.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.com`;
  const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[celoe(0, 15)]).join('');
  const nomerDezhurnogo = telefon();
  const nomerKoordinatora = telefon();

  // --- сиделки и клиенты — как в care/demo-dannye (клиентам — подпись района по ZIP для показа)
  const sidelki = src.sidelki.map((s) => ({ ...s }));
  const sidelkaPoId = new Map(sidelki.map((s) => [s.id, s]));
  const klienty = src.klienty.map((k) => ({ ...k, rayon: RAYON_PO_ZIP[k.zip] || null }));
  const klientPoId = new Map(klienty.map((k) => [k.id, k]));
  const yazykZvonka = (s) => (s.yazyki || []).find((y) => ['en', 'es', 'ru'].includes(y)) || 'en'; // агент говорит en/es/ru

  // --- расписание: 21.09–04.10 — перенос недели 05–11.10, дальше — сама неделя
  const smeny = [];
  const smenaPoId = new Map();
  for (const dney of [-14, -7, 0]) {
    for (const slot of src.smeny) {
      const s = dney ? perenos(slot, dney) : { ...slot };
      smeny.push(s);
      smenaPoId.set(s.id, s);
    }
  }

  // --- отказы от смен
  const otkazy = [];
  const zvonki = [];
  const sobytiyaOtkazov = []; // для журнала: что происходило по отказам (сегодняшние попадут в zhurnal)
  const vremyaOt = (o, hhmm) => {
    const iso = t(o.at.slice(0, 10), hhmm);
    return iso < o.at ? t(sdvigYmd(o.at.slice(0, 10), 1), hhmm) : iso; // волны после полуночи
  };
  for (const o of OTKAZY) {
    if (!uzhe(o.at)) continue;
    const slot = src.smeny.find((s) => s.id === o.slot);
    const smena = smenaPoId.get(idPerenosa(slot, Math.round((Date.parse(o.den) - Date.parse(slot.start.slice(0, 10))) / 86400000)));
    const kl = klientPoId.get(smena.klient_id);
    const volny = o.volny.map(([at, s]) => ({ at: vremyaOt(o, at), sidelki: s })).filter((v) => uzhe(v.at));
    const otvety = o.otvety.map(([s, otvet, at]) => ({ sidelka_id: s, otvet, at: vremyaOt(o, at) })).filter((x) => uzhe(x.at));
    const eskalaciya = o.esk && uzhe(vremyaOt(o, o.esk)) ? vremyaOt(o, o.esk) : null;
    const zakr = o.zakr && uzhe(vremyaOt(o, o.zakr[1])) ? { za: o.zakr[0], v: vremyaOt(o, o.zakr[1]) } : null;
    const nachalas = new Date(smena.start) <= seychas;
    smena.sidelka_id_do_otkaza = smena.sidelka_id;
    if (zakr) { smena.sidelka_id = zakr.za; smena.status = 'filled'; } else if (nachalas) smena.status = 'unfilled';
    else smena.status = 'offered';
    const zapis = {
      id: `otk-${String(o.n).padStart(2, '0')}`, kod: String(o.n), smena_id: smena.id, sidelka_id: smena.sidelka_id_do_otkaza,
      prichina: o.prichina, soobshcheno: o.at, kanal: o.kanal, volny, otvety,
      zakreplena_za: zakr ? zakr.za : null, zakreplena_v: zakr ? zakr.v : null, eskalaciya_v: eskalaciya,
    };
    if (!zakr && nachalas) { zapis.zakrit = true; zapis.ne_zakryta_v = smena.start; }
    otkazy.push(zapis);
    const s = sidelkaPoId.get(zapis.sidelka_id);
    if (o.kanal === 'call') {
      const dl = celoe(70, 140);
      zvonki.push({
        conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-caregivers', nachalo: plusSek(o.at, -dl + 25), dlitelnost_s: dl,
        yazyk: yazykZvonka(s), namerenie: 'otkaz', itog: 'otkaz_prinyat',
        kratko: `${s.imya} can't work the ${kogda(smena.start)} shift for ${kl.kod} (${PRICHINA_SMENY[o.prichina] || 'other reason'}). Replacement search started.`,
        soglasiya: { zapis: true, ii: true }, telefon: s.telefon, _tip: 'otkaz', _otkaz: zapis.id,
      });
    }
    sobytiyaOtkazov.push({ o, zapis, smena, kl, s, eskalaciya, zakr });
  }

  // --- кандидаты
  const SLOTY = ['09:30', '10:00', '11:00', '11:30', '13:00', '14:00', '14:30', '16:00'];
  const kandidaty = [];
  const imenaZanyaty = new Set(sidelki.map((x) => x.imya));
  // окна явных сюжетов 29.09–02.10 заняты заранее: случайные кандидаты их не берут
  const slotyZanyaty = new Set([
    t(den(29), '10:00'), t(den(29), '13:00'), t(den(29), '16:00'), t(den(30), '10:00'), t(den(30), '11:30'),
    t(den(30), '13:00'), t(den(30), '15:00'), t('2026-10-01', '10:00'), t('2026-10-01', '14:30'), t('2026-10-01', '11:30'),
    t('2026-10-01', '16:00'), t('2026-10-02', '10:00'), t('2026-10-02', '13:00'),
  ]);
  let nomerKand = 0;

  function sertTekst(s) { return s === 'net' ? 'No certificate' : s.toUpperCase(); }
  function novoeImya(gruppa, zhenshchina) {
    let imya = null;
    for (let popytka = 0; !imya || (imenaZanyaty.has(imya) && popytka < 20); popytka += 1) {
      imya = `${vybor(zhenshchina ? IMENA[gruppa].f : IMENA[gruppa].m)} ${vybor(IMENA[gruppa].l)}`;
    }
    imenaZanyaty.add(imya);
    return imya;
  }

  /** Кандидат + звонок + согласие. p — явные поля, остальное случайно. */
  function kandidat(p) {
    nomerKand += 1;
    const yazyk = p.yazyk;
    const gruppa = p.gruppa || (yazyk === 'en' ? vybor(['en', 'en', 'en', 'ht', 'ht', 'zh']) : yazyk);
    const zhenshchina = p.m ? false : !shans(0.08);
    const imya = p.imya || novoeImya(gruppa, zhenshchina);
    imenaZanyaty.add(imya);
    const [rayon, zip] = p.rayon ? [p.rayon, RAYON_ZIP[p.rayon]] : (p.vne ? vybor(VNE_RAYONA) : vybor(RAYONY));
    // Лист правды brightside (care/list-pravdy): обязательно HHA или PCA, законное право работать в США,
    // дорога к клиентам в Бруклине и Квинсе. Не прошёл по сертификату — карточка только при согласии
    // на лист ожидания (podhodit:false, prichina net_sertifikata / tolko_cna / drugoe, статус waitlist —
    // так ставит lib/kartochki.js). «Нет права на работу» и «не может ездить» — карточки нет, есть итог звонка.
    const sertifikat = p.sertifikat || (() => {
      const x = sl();
      return x < 0.5 ? 'hha' : x < 0.66 ? 'pca' : x < 0.76 ? 'cna' : 'net';
    })();
    let podhodit = true;
    let prichina = null;
    let bezKartochki = p.bezKartochki || null; // 'pravo' | 'doroga' | 'otkazalsya'
    if (p.prichina !== undefined) { prichina = p.prichina; podhodit = !prichina; }
    else if (!bezKartochki && (sertifikat === 'net' || sertifikat === 'cna')) {
      prichina = sertifikat === 'net' ? 'net_sertifikata' : 'tolko_cna';
      podhodit = false;
      if (!shans(0.55)) bezKartochki = 'otkazalsya';
    } else if (!bezKartochki) {
      const x = sl();
      if (x < 0.035) bezKartochki = 'pravo';
      else if (x < 0.085) bezKartochki = 'doroga';
      else if (x < 0.11) { prichina = 'drugoe'; podhodit = false; }
    }
    const created = p.at;
    const istochnik2 = p.istochnik || (shans(0.8) ? 'call' : 'sms');
    const tel = telefon();
    const yazyki = [gruppa === 'en' ? 'en' : gruppa].concat(gruppa !== 'en' && (gruppa !== 'ru' && gruppa !== 'es' ? true : shans(0.6)) ? ['en'] : []);
    const smsSoglasie = p.sms !== undefined ? p.sms : shans(0.78);
    const opis = `${sertTekst(sertifikat)}, ${rayon}`;

    if (bezKartochki) {
      // карточку не сохраняем: остаётся только итог звонка (SMS-переписка в звонки не попадает)
      if (istochnik2 === 'call') {
        const dl = celoe(110, 240);
        const kratko = {
          pravo: 'Answered no to the work authorization question. Screening ended politely; no card saved.',
          doroga: `Lives in ${rayon} and cannot travel to clients in Brooklyn or Queens. No card saved.`,
          otkazalsya: sertifikat === 'cna'
            ? `CNA only, ${rayon}. Explained that HHA or PCA is required; did not want to join the waitlist.`
            : `No certificate, ${rayon}. Shared where to get HHA training; did not want to join the waitlist.`,
        }[bezKartochki];
        zvonki.push({
          conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-hiring', nachalo: plusSek(created, -dl), dlitelnost_s: dl,
          yazyk, namerenie: 'rabota', itog: 'ne_podhodit', kratko, soglasiya: { zapis: true, ii: true }, telefon: tel, _tip: 'ne_podhodit',
        });
      }
      return null;
    }

    const dl = istochnik2 === 'call' ? (!podhodit ? celoe(140, 280) : celoe(280, 520)) : 0;
    const nachaloZvonka = istochnik2 === 'call' ? plusSek(created, -Math.round(dl * 0.6)) : null;
    let sobesedovanie = null;
    let status;
    if (!podhodit) {
      status = 'waitlist';
    } else if (p.bez_zapisi) {
      status = 'new';
    } else {
      const start = p.sobes || (() => {
        let d = sledRabochiy(created.slice(0, 10), celoe(1, 2));
        // 29–30.09 заданы явно; случайных кандидатов переносим на 1–2 октября
        if (p.izbegat && d >= den(29)) d = sledRabochiy(den(30), celoe(1, 2));
        for (let popytka = 0; popytka < 40; popytka += 1) {
          const slot = t(d, vybor(SLOTY));
          if (!slotyZanyaty.has(slot)) return slot;
          if (popytka % 8 === 7) d = sledRabochiy(d, 1);
        }
        return t(d, SLOTY[0]);
      })();
      slotyZanyaty.add(start);
      const zapisanoV = nachaloZvonka ? plusSek(nachaloZvonka, Math.round(dl * 0.85)) : plusSek(created, 90);
      sobesedovanie = { start, end: plusMin(start, 30), event_id: `evt_demo_${hex(10)}`, zapisano_v: zapisanoV };
      const nachalo = new Date(start);
      if (nachalo <= seychas) status = p.prishel !== undefined ? (p.prishel ? 'attended' : 'no_show') : (shans(0.7) ? 'attended' : 'no_show');
      else status = (nachalo - seychas) <= 24 * 3600000 ? 'reminded' : 'booked';
    }

    const k = {
      id: `kand-${String(nomerKand).padStart(3, '0')}`,
      created_at: created,
      istochnik: istochnik2,
      conversation_id: istochnik2 === 'call' ? `conv_demo_${hex(12)}` : null,
      yazyk,
      imya,
      telefon: tel,
      email: shans(0.55) ? pochta(imya) : null,
      sertifikat,
      rayon,
      zip,
      transport: true,
      grafik: { dni: vybor([['mon', 'tue', 'wed', 'thu', 'fri'], ['mon', 'wed', 'fri', 'sat'], ['sat', 'sun'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']]), chasy: vybor(['days', 'days', 'evenings', 'overnights', 'flexible']) },
      yazyki,
      opyt_let: celoe(0, 14),
      pravo_na_rabotu: shans(0.95) ? true : null,
      podhodit,
      prichina_otkaza: prichina,
      sobesedovanie,
      status,
      soglasiya: { zapis: istochnik2 === 'call' ? true : null, ii: true, sms: smsSoglasie },
    };
    kandidaty.push(k);

    if (istochnik2 === 'call') {
      let itog;
      let kratko;
      if (sobesedovanie) { itog = 'zapisan'; kratko = `${opis}. Interview booked for ${kogda(sobesedovanie.start)}.`; }
      else if (podhodit) { itog = 'perezvon'; kratko = `${opis}. Meets requirements; none of the offered times worked. Coordinator to call back.`; }
      else {
        itog = 'list_ozhidaniya';
        kratko = {
          net_sertifikata: `No certificate, ${rayon}. Shared where to get HHA training; added to the waitlist.`,
          tolko_cna: `CNA only, ${rayon}. HHA or PCA is required; added to the waitlist for the coordinator to review.`,
          drugoe: `${opis}. Question for the coordinator about the requirements; added to the waitlist.`,
        }[prichina] || `${opis}. Added to the waitlist.`;
      }
      zvonki.push({
        conversation_id: k.conversation_id, liniya: 'care-hiring', nachalo: nachaloZvonka, dlitelnost_s: dl,
        yazyk, namerenie: 'rabota', itog, kratko, soglasiya: { zapis: true, ii: true }, telefon: tel, _tip: 'kandidat', _kand: k.id,
      });
    }
    return k;
  }

  // случайные кандидаты 1–28 сентября
  for (let d = 1; d <= 28; d += 1) {
    const data = den(d);
    const w = denNedeli(data);
    const n = (w === 0 || w === 6) ? celoe(1, 3) : celoe(3, 6);
    const vremena = [];
    for (let i = 0; i < n; i += 1) {
      const x = sl();
      const chas = x < 0.1 ? celoe(0, 5) : x < 0.7 ? celoe(7, 17) : celoe(18, 23);
      vremena.push(`${String(chas).padStart(2, '0')}:${String(celoe(0, 59)).padStart(2, '0')}`);
    }
    vremena.sort();
    for (const hhmm of vremena) {
      const at = t(data, hhmm);
      const yazyk = (() => { const x = sl(); return x < 0.5 ? 'en' : x < 0.82 ? 'es' : 'ru'; })();
      kandidat({ at, yazyk, vne: shans(0.06), izbegat: true, bez_zapisi: shans(0.08) });
    }
  }
  // явные: собеседования 29–30.09 у кандидатов прошлых дней
  kandidat({ at: t(den(25), '19:20'), yazyk: 'es', imya: 'Dayana Castillo', sertifikat: 'hha', rayon: 'Ridgewood', prichina: null, sobes: t(den(29), '10:00'), prishel: true });
  kandidat({ at: t(den(26), '10:44'), yazyk: 'ru', imya: 'Galina Morozova', sertifikat: 'hha', rayon: 'Midwood', prichina: null, sobes: t(den(29), '13:00'), prishel: true });
  kandidat({ at: t(den(27), '16:05'), yazyk: 'en', gruppa: 'en', imya: 'Kimberly Harris', sertifikat: 'pca', rayon: 'Canarsie', prichina: null, sobes: t(den(29), '16:00'), prishel: false });
  kandidat({ at: t(den(28), '09:31'), yazyk: 'en', gruppa: 'en', imya: 'Andrea Boateng', sertifikat: 'hha', rayon: 'Jamaica', prichina: null, sobes: t(den(30), '13:00'), prishel: true });
  kandidat({ at: t(den(28), '20:12'), yazyk: 'es', imya: 'Lucía Méndez', sertifikat: 'pca', rayon: 'Elmhurst', prichina: null, sobes: t(den(30), '15:00'), sms: true });
  // вчера, 29.09
  kandidat({ at: t(den(29), '00:47'), yazyk: 'es', imya: 'Yudelka Cruz', sertifikat: 'hha', rayon: 'Corona', prichina: null, istochnik: 'call', sobes: t(den(30), '10:00'), prishel: true });
  kandidat({ at: t(den(29), '07:58'), yazyk: 'ru', imya: 'Alla Kuzmina', sertifikat: 'pca', rayon: 'Brighton Beach', prichina: null, istochnik: 'call', sobes: t(den(30), '11:30'), prishel: false });
  kandidat({ at: t(den(29), '09:12'), yazyk: 'en', gruppa: 'en', imya: 'Tamika Richards', sertifikat: 'net', rayon: 'East Flatbush', prichina: 'net_sertifikata', istochnik: 'sms' });
  kandidat({ at: t(den(29), '11:40'), yazyk: 'en', gruppa: 'en', imya: 'Grace Adeyemi', sertifikat: 'hha', rayon: 'Canarsie', prichina: null, istochnik: 'call', sobes: t('2026-10-01', '10:00') });
  kandidat({ at: t(den(29), '14:25'), yazyk: 'es', imya: 'Paola Vargas', sertifikat: 'hha', rayon: 'Jackson Heights', prichina: null, istochnik: 'call', sobes: t('2026-10-01', '14:30') });
  kandidat({ at: t(den(29), '18:03'), yazyk: 'en', gruppa: 'ht', imya: 'Widline Désir', sertifikat: 'cna', rayon: 'Flatbush', prichina: 'tolko_cna', istochnik: 'call' });
  kandidat({ at: t(den(29), '22:16'), yazyk: 'ru', m: true, imya: 'Rustam Sadykov', sertifikat: 'hha', rayon: 'Staten Island', bezKartochki: 'doroga', istochnik: 'call' });
  // сегодня, 30.09
  kandidat({ at: t(den(30), '01:12'), yazyk: 'es', imya: 'Esperanza Guzmán', sertifikat: 'hha', rayon: 'Elmhurst', prichina: null, istochnik: 'call', sobes: t('2026-10-01', '11:30') });
  kandidat({ at: t(den(30), '06:35'), yazyk: 'ru', imya: 'Irina Sadykova', sertifikat: 'hha', rayon: 'Sheepshead Bay', prichina: null, istochnik: 'call', sobes: t('2026-10-02', '10:00') });
  kandidat({ at: t(den(30), '08:20'), yazyk: 'en', gruppa: 'en', imya: 'Monique Grant', sertifikat: 'pca', rayon: 'Crown Heights', prichina: null, istochnik: 'sms', sobes: t('2026-10-01', '16:00'), sms: true });
  kandidat({ at: t(den(30), '10:05'), yazyk: 'en', gruppa: 'zh', imya: 'Hui Min Liu', sertifikat: 'net', rayon: 'Flushing', prichina: 'net_sertifikata', istochnik: 'call' });
  kandidat({ at: t(den(30), '11:47'), yazyk: 'es', m: true, imya: 'Wilson Peña', sertifikat: 'hha', rayon: 'Bushwick', prichina: null, istochnik: 'call', sobes: t('2026-10-02', '13:00') });
  kandidat({ at: t(den(30), '13:22'), yazyk: 'en', gruppa: 'en', imya: 'Latoya Mitchell', sertifikat: 'hha', rayon: 'Jamaica', prichina: null, istochnik: 'call', bez_zapisi: true });

  const kandidatyDoSeychas = kandidaty.filter((k) => k && uzhe(k.created_at));

  // --- семьи (обращения A2): карточка semi/<id> как у lib/kartochki.js + звонок
  const semi = [];
  function semya(p) {
    const gruppa = p.gruppa || (p.yazyk === 'en' ? vybor(['en', 'en', 'ht', 'zh']) : p.yazyk);
    const imya = novoeImya(gruppa, !shans(0.3));
    const tel = telefon();
    const dl = celoe(260, 560);
    const nachalo = plusSek(p.at, -Math.round(dl * 0.55)); // карточку сохраняют посреди звонка
    const conv = `conv_demo_${hex(12)}`;
    const ocenka = p.ocenka ? { start: p.ocenka, end: plusMin(p.ocenka, 60), event_id: `evt_demo_${hex(10)}`, zapisano_v: plusSek(nachalo, Math.round(dl * 0.85)) } : null;
    const zip = RAYON_ZIP[p.rayon] || null;
    // SMS о подтверждении и напоминании спрашивают до карточки (sms_soglasie в sohranit_semyu); почта приходит с записью
    const smsSoglasie = p.sms !== undefined ? p.sms : shans(0.7);
    const email = ocenka && (p.email !== undefined ? p.email : shans(0.35)) ? pochta(imya) : null;
    const zapis = {
      id: `sem-${p.at.slice(0, 10).replace(/-/g, '')}-${hex(8)}`,
      created_at: p.at,
      conversation_id: conv,
      kontakt: email ? { imya, telefon: tel, email } : { imya, telefon: tel },
      rayon: p.rayon,
      zip,
      chasy_v_nedelyu: p.chasov,
      oplata: p.oplata,
      srochnost: p.srochnost,
      yazyk: p.yazyk,
      soglasiya: { sms: smsSoglasie },
      ocenka,
      status: ocenka ? 'booked' : 'new',
      updated_at: ocenka ? ocenka.zapisano_v : p.at,
    };
    const chto = `Family inquiry for care in ${p.rayon}, about ${p.chasov} hours a week, ${OPLATA_TEKST[p.oplata]}, needed ${SROCHNOST_TEKST[p.srochnost]}.`;
    semi.push(zapis);
    zvonki.push({
      conversation_id: conv, liniya: 'care-hiring', nachalo, dlitelnost_s: dl, yazyk: p.yazyk, namerenie: 'semya',
      itog: ocenka ? 'ocenka' : 'soobshchenie',
      kratko: `${chto} ${ocenka ? `Home assessment booked for ${kogda(ocenka.start)}.` : 'None of the assessment times worked; message left for the intake coordinator.'}`,
      soglasiya: { zapis: true, ii: true }, telefon: tel, _tip: 'semya', _semya: zapis.id, _soobshchenie: !ocenka,
    });
  }

  // --- прочие звонки: семьи, линия сиделок, сбросы, отказ от записи, перевод
  const OPLATY = ['medicaid', 'medicaid', 'medicaid', 'private', 'ltc', 'unknown'];
  const SROCHNOSTI = ['srochno', 'nedelya', 'nedelya', 'pozzhe', 'ne_znayu'];
  for (let d = 1; d <= 30; d += 1) {
    const data = den(d);
    const w = denNedeli(data);
    const vyh = w === 0 || w === 6;
    // семьи
    for (let i = 0, n = shans(vyh ? 0.3 : 0.65) ? 1 : 0; i < n; i += 1) {
      const at = t(data, `${String(celoe(8, 20)).padStart(2, '0')}:${String(celoe(0, 59)).padStart(2, '0')}`);
      const [rayon] = vybor(RAYONY);
      const zapis = shans(0.65);
      semya({
        at, yazyk: vybor(['en', 'en', 'ru', 'ru', 'es']), rayon, chasov: vybor([12, 20, 25, 30, 40]),
        oplata: vybor(OPLATY), srochnost: vybor(SROCHNOSTI),
        ocenka: zapis ? t(sledRabochiy(data, celoe(1, 3)), vybor(['10:00', '11:00', '13:00', '14:00'])) : null,
      });
    }
    // линия сиделок: вопросы, которые агент принимает сообщением
    for (let i = 0, n = shans(vyh ? 0.4 : 0.85) ? 1 : 0; i < n; i += 1) {
      const s = sidelki[celoe(0, sidelki.length - 1)];
      const chas = celoe(7, 20);
      const at = t(data, `${String(chas).padStart(2, '0')}:${String(celoe(0, 59)).padStart(2, '0')}`);
      const rabochee = !vyh && chas >= 9 && chas < 17;
      const tema = vybor([
        ['Asked when this week\'s paychecks go out.', 'Message left for payroll.'],
        ['Wants more hours next week.', 'Message left for the scheduler.'],
        ['Asked to confirm tomorrow\'s shift time.', 'Message left for the scheduler.'],
        ['Asked to speak with a coordinator about a client.', rabochee ? 'Transferred to the coordinator.' : 'After hours; message left for the coordinator.'],
      ]);
      const perevod = tema[1].startsWith('Transferred');
      zvonki.push({
        conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-caregivers', nachalo: at, dlitelnost_s: celoe(60, 200), yazyk: yazykZvonka(s),
        namerenie: 'drugoe', itog: perevod ? 'perevod' : 'soobshchenie', kratko: `${s.imya}. ${tema[0]} ${tema[1]}`,
        soglasiya: { zapis: true, ii: true }, telefon: s.telefon, _tip: perevod ? 'perevod' : 'soobshchenie', _imya: s.imya,
      });
    }
    // сброс, отказ от записи, просьба о человеке
    if (shans(0.45)) {
      const at = t(data, `${String(celoe(0, 23)).padStart(2, '0')}:${String(celoe(0, 59)).padStart(2, '0')}`);
      const x = sl();
      if (x < 0.55) {
        zvonki.push({ conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-hiring', nachalo: at, dlitelnost_s: celoe(6, 22), yazyk: 'en', namerenie: 'drugoe', itog: 'sbros', kratko: 'Caller hung up during the greeting.', soglasiya: { zapis: null, ii: null }, telefon: telefon(), _tip: 'sbros' });
      } else if (x < 0.8) {
        zvonki.push({ conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-hiring', nachalo: at, dlitelnost_s: celoe(25, 50), yazyk: vybor(['en', 'es', 'ru']), namerenie: 'rabota', itog: 'net_soglasiya', kratko: 'Did not agree to continue with an AI assistant on a recorded line. Offered a callback from a coordinator.', soglasiya: { zapis: false, ii: false }, telefon: telefon(), _tip: 'net_soglasiya' });
      } else {
        const vRabochee = !vyh && at.slice(11, 13) >= '09' && at.slice(11, 13) < '17';
        zvonki.push({ conversation_id: `conv_demo_${hex(12)}`, liniya: 'care-hiring', nachalo: at, dlitelnost_s: celoe(40, 110), yazyk: vybor(['en', 'es']), namerenie: 'rabota',
          itog: vRabochee ? 'perevod' : 'soobshchenie',
          kratko: vRabochee ? 'Applicant asked for a person. Transferred to the recruiting coordinator.' : 'Applicant asked for a person after hours. Message left for the recruiting coordinator.',
          soglasiya: { zapis: true, ii: true }, telefon: telefon(), _tip: vRabochee ? 'perevod' : 'soobshchenie' });
      }
    }
  }
  // явные семьи: вчера и сегодня — одна срочная без оценки (ждёт звонка координатора)
  semya({ at: t(den(29), '16:40'), yazyk: 'ru', rayon: 'Brighton Beach', chasov: 25, oplata: 'medicaid', srochnost: 'srochno', ocenka: t('2026-10-01', '11:00') });
  semya({ at: t(den(30), '09:12'), yazyk: 'es', rayon: 'Corona', chasov: 40, oplata: 'private', srochnost: 'srochno', ocenka: null });
  semya({ at: t(den(30), '12:05'), yazyk: 'en', gruppa: 'en', rayon: 'Flatbush', chasov: 20, oplata: 'ltc', srochnost: 'nedelya', ocenka: t('2026-10-02', '14:00') });

  const vseZvonki = zvonki.filter((z) => uzhe(z.nachalo));

  // --- журнал согласий: одна запись на номер, последнее состояние
  const soglasiya = new Map();
  for (const z of vseZvonki.slice().sort((a, b) => Date.parse(a.nachalo) - Date.parse(b.nachalo))) {
    if (!z.telefon || z.itog === 'sbros') continue;
    const konec = plusSek(z.nachalo, z.dlitelnost_s);
    const s = sidelki.find((x) => x.telefon === z.telefon);
    const k = kandidatyDoSeychas.find((x) => x.telefon === z.telefon);
    const f = semi.find((x) => x.kontakt.telefon === z.telefon);
    soglasiya.set(z.telefon, {
      telefon: z.telefon,
      zapis: z.soglasiya.zapis,
      ii: z.soglasiya.ii,
      sms: z.soglasiya.zapis === false ? null : (s ? s.sms_soglasie : k ? k.soglasiya.sms : f ? f.soglasiya.sms : null),
      istochnik: 'call',
      at: konec,
    });
  }
  for (const k of kandidatyDoSeychas) {
    if (k.istochnik !== 'sms') continue;
    soglasiya.set(k.telefon, { telefon: k.telefon, zapis: null, ii: true, sms: true, istochnik: 'sms', at: k.created_at });
  }
  // два STOP от кандидатов после напоминаний
  const stopy = kandidatyDoSeychas.filter((k) => k.soglasiya.sms && k.created_at < t(den(27), '00:00')).slice(-2);
  stopy.forEach((k, i) => {
    const at = plusMin(k.created_at, 60 * 24 * (i + 1) + 17);
    if (uzhe(at)) soglasiya.set(k.telefon, { telefon: k.telefon, zapis: true, ii: true, sms: false, istochnik: 'sms_stop', at });
  });

  // --- EVV: три прогона. Последний — выгрузка demo-dannye за 21–27.09, где закрытые отказы записаны на замену.
  const zamenyNedeli = {};
  for (const x of sobytiyaOtkazov) {
    if (x.zakr && x.smena.start.slice(0, 10) >= den(21) && x.smena.start.slice(0, 10) <= den(27)) zamenyNedeli[x.smena.id] = x.zakr.za;
  }
  const posledniy = evvProgon(-14, zamenyNedeli);
  const nado = new Set(src.oshibki.oshibki.map((o) => `${o.vizit_id}|${o.pravilo}`));
  const est = new Set(posledniy.isklyucheniya.map((o) => `${o.vizit_id}|${o.pravilo}`));
  if (nado.size !== est.size || [...nado].some((x) => !est.has(x))) {
    throw new Error(`demo-pult: движок EVV на перенесённой выгрузке нашёл не те ${est.size} ошибок, что в oshibki-ozhidaemye.json (${nado.size})`);
  }
  // Прошлые недели: та же выгрузка на 28 и 21 день назад; в пульте от них только строка с числами — берём часть списка.
  const proshlaya = (dney, ostavit) => {
    const r = evvProgon(dney, null);
    return { strok: r.strok, isklyucheniya: r.isklyucheniya.filter((_, i) => ostavit(i)) };
  };
  const p15 = proshlaya(-28, (i) => i % 5 !== 0);
  const p22 = proshlaya(-21, (i) => i % 3 !== 0);
  const progon = (run_id, zagruzheno, fayl, r) => ({ run_id, zagruzheno, shtat: 'NY', strok: r.strok, fayl, isklyucheniya: r.isklyucheniya });
  const evv = [
    progon('evv-20260915-1803', t(den(15), '18:03'), 'visits_2026-09-07_to_09-13.csv', p15),
    progon('evv-20260922-1748', t(den(22), '17:48'), 'visits_2026-09-14_to_09-20.csv', p22),
    progon('evv-20260929-1812', t(den(29), '18:12'), 'visits_2026-09-21_to_09-27.csv', posledniy),
  ];

  // --- журнал действий за день seychas (lib/zhurnal.js: {at, kto, chto, obekt, detali})
  const zhurnal = [];
  const zh = (at, kto, chto, obekt, detali) => {
    if (!at || at.slice(0, 10) !== segodnya || !uzhe(at)) return;
    const zapis = { at, kto, chto, obekt: obekt || null };
    if (detali !== undefined) zapis.detali = detali;
    zhurnal.push(zapis);
  };
  const pervyyRaz = new Set(); // номер уже давал согласие на запись и ИИ раньше — повторно не пишем
  for (const z of vseZvonki.slice().sort((a, b) => Date.parse(a.nachalo) - Date.parse(b.nachalo))) {
    const konec = plusSek(z.nachalo, z.dlitelnost_s);
    const obektZv = `zvonki/${z.conversation_id}`;
    zh(z.nachalo, 'vhod', 'zvonok_vhod', null, { liniya: z.liniya });
    if (z._tip === 'kandidat') {
      const k = kandidatyDoSeychas.find((x) => x.id === z._kand);
      if (k) {
        const ob = `kandidaty/${k.id}`;
        zh(k.created_at, 'agent', 'kandidat_novyy', ob, { status: k.sobesedovanie ? 'new' : k.status, liniya: 'care-hiring' });
        zh(plusSek(k.created_at, 1), 'agent', 'soglasie', ob, { bylo: { zapis: null, ii: null, sms: null }, stalo: { sms: k.soglasiya.sms }, istochnik: 'call' });
        if (k.sobesedovanie) {
          const zv = k.sobesedovanie.zapisano_v;
          zh(zv, 'agent', 'zapis', ob, { tip: 'sobesedovanie', start: k.sobesedovanie.start, event_id: k.sobesedovanie.event_id,
            pismo: k.email ? 'otpravleno' : null, sms: k.soglasiya.sms ? 'otpravleno' : null, liniya: 'care-hiring' });
          if (k.email) zh(plusSek(zv, 3), 'agent', 'pismo_otpravleno', ob, { komu: [k.email], tema: `${AGENTSTVO}: your appointment on ${kogdaPolno(k.sobesedovanie.start)}`, id: `em_demo_${hex(10)}` });
          if (k.soglasiya.sms) zh(plusSek(zv, 4), 'agent', 'sms_otpravleno', ob, { komu: k.telefon, sid: `SM${hex(32)}` });
        }
      }
    } else if (z._tip === 'semya') {
      const s = semi.find((x) => x.id === z._semya);
      const ob = `semi/${s.id}`;
      zh(s.created_at, 'agent', 'semya_novaya', ob, { oplata: s.oplata, liniya: 'care-hiring' });
      zh(plusSek(s.created_at, 1), 'agent', 'soglasie', ob, { bylo: { zapis: null, ii: null, sms: null }, stalo: { sms: s.soglasiya.sms }, istochnik: 'call' });
      if (s.ocenka) {
        const zv = s.ocenka.zapisano_v;
        zh(zv, 'agent', 'zapis', ob, { tip: 'ocenka', start: s.ocenka.start, event_id: s.ocenka.event_id,
          pismo: s.kontakt.email ? 'otpravleno' : null, sms: s.soglasiya.sms ? 'otpravleno' : null, liniya: 'care-hiring' });
        if (s.kontakt.email) zh(plusSek(zv, 3), 'agent', 'pismo_otpravleno', ob, { komu: [s.kontakt.email], tema: `${AGENTSTVO}: your appointment on ${kogdaPolno(s.ocenka.start)}`, id: `em_demo_${hex(10)}` });
        if (s.soglasiya.sms) zh(plusSek(zv, 4), 'agent', 'sms_otpravleno', ob, { komu: s.kontakt.telefon, sid: `SM${hex(32)}` });
      }
    } else if (z._tip === 'perevod') {
      zh(plusSek(z.nachalo, Math.round(z.dlitelnost_s * 0.8)), 'agent', 'perevod', null, { liniya: z.liniya, komu: nomerKoordinatora });
    }
    if (z.itog !== 'sbros' || z.dlitelnost_s > 0) {
      const soob = z._tip === 'soobshchenie' || !!z._soobshchenie;
      zh(plusSek(konec, 15), 'itog', 'zvonok_itog', obektZv, { liniya: z.liniya, namerenie: z.namerenie, itog: z.itog, dlitelnost_s: z.dlitelnost_s, raskrytie_ii: true, soobshchenie: soob });
      if (z.telefon && z.soglasiya.zapis !== null && !pervyyRaz.has(z.telefon)) {
        pervyyRaz.add(z.telefon);
        zh(plusSek(konec, 16), 'itog', 'soglasie', obektZv, { bylo: { zapis: null, ii: null, sms: null }, stalo: { zapis: z.soglasiya.zapis, ii: z.soglasiya.ii }, istochnik: 'call' });
      }
      if (soob) {
        const kto = z._imya || (semi.find((x) => x.id === z._semya) || { kontakt: {} }).kontakt.imya || 'caller';
        zh(plusSek(konec, 18), 'itog', 'pismo_otpravleno', obektZv, { komu: POCHTA_KOORDINATORA, tema: `${AGENTSTVO}: message from ${kto}`, id: `em_demo_${hex(10)}` });
      }
    }
  }
  for (const k of kandidatyDoSeychas) { // заявки по SMS: карточка без звонка
    if (k.istochnik === 'sms') zh(k.created_at, 'sms', 'kandidat_novyy', `kandidaty/${k.id}`, { status: k.status, liniya: 'care-hiring' });
  }
  // отказы от смен — пошагово, как lib/otkazy.js и функции sms-vhod / volny
  for (const x of sobytiyaOtkazov) {
    const { o, zapis, smena, s } = x;
    const ob = `otkazy/${zapis.id}`;
    const ktoOtkaza = o.kanal === 'sms' ? 'sms' : 'agent';
    if (o.kanal === 'sms') zh(o.at, 'sms', 'sms_vhod', `sidelki/${s.id}`, { ot: s.telefon, tip: 'otkaz', tekst: o.sms || 'Cannot work my shift today, sorry.', liniya: 'care-caregivers' });
    zh(plusSek(o.at, 20), ktoOtkaza, 'otkaz_ot_smeny', ob, { smena_id: smena.id, sidelka_id: s.id, prichina: o.prichina });
    if (o.kanal === 'sms') zh(plusSek(o.at, 22), 'sms', 'sms_otpravleno', ob, { komu: s.telefon, sid: `SM${hex(32)}` });
    const skazaliNet = new Set();
    zapis.volny.forEach((v, i) => {
      v.sidelki.forEach((id, j) => zh(plusSek(v.at, 2 + j), 'zamena', 'sms_otpravleno', ob, { komu: sidelkaPoId.get(id).telefon, sid: `SM${hex(32)}` }));
      zh(plusSek(v.at, 8), 'zamena', i === 0 ? 'volna_pervaya' : 'volna_sleduyushchaya', ob, { sidelki: v.sidelki, otpravleno: v.sidelki.length });
    });
    for (const a of zapis.otvety) {
      const kto = sidelkaPoId.get(a.sidelka_id);
      zh(a.at, 'sms', 'sms_vhod', `sidelki/${kto.id}`, { ot: kto.telefon, tip: a.otvet, tekst: `${a.otvet === 'da' ? 'YES' : 'NO'} ${zapis.kod}`, liniya: 'care-caregivers' });
      if (a.otvet === 'net') { skazaliNet.add(a.sidelka_id); zh(plusSek(a.at, 1), 'sms', 'otvet_net', ob, { sidelka_id: kto.id, rezultat: 'otkaz_prinyat' }); continue; }
      if (zapis.zakreplena_za === a.sidelka_id && zapis.zakreplena_v === a.at) {
        zh(plusSek(a.at, 1), 'sms', 'otvet_da', ob, { sidelka_id: kto.id, rezultat: 'zakreplena' });
        zh(plusSek(a.at, 2), 'sms', 'smena_zakreplena', ob, { sidelka_id: kto.id, smena_id: smena.id });
        zh(plusSek(a.at, 3), 'sms', 'sms_otpravleno', ob, { komu: kto.telefon, sid: `SM${hex(32)}` });
        const vse = new Set(zapis.volny.flatMap((v) => v.sidelki));
        [...vse].filter((id) => id !== kto.id && !skazaliNet.has(id)).forEach((id, j) => zh(plusSek(a.at, 4 + j), 'zamena', 'sms_otpravleno', ob, { komu: sidelkaPoId.get(id).telefon, sid: `SM${hex(32)}` }));
        zh(plusSek(a.at, 9), 'zamena', 'pismo_otpravleno', ob, { komu: POCHTA_KOORDINATORA, tema: `${AGENTSTVO}: shift filled, ${kogdaPolno(smena.start)}`, id: `em_demo_${hex(10)}` });
      } else {
        zh(plusSek(a.at, 1), 'sms', 'otvet_da', ob, { sidelka_id: kto.id, rezultat: 'zanyato' });
        zh(plusSek(a.at, 2), 'sms', 'sms_otpravleno', ob, { komu: kto.telefon, sid: `SM${hex(32)}` });
      }
    }
    if (x.eskalaciya) {
      zh(x.eskalaciya, 'zamena', 'zvonok_nachat', ob, { komu: nomerDezhurnogo, sid: `CA${hex(32)}` });
      zh(plusSek(x.eskalaciya, 1), 'zamena', 'eskalaciya_zvonok', ob, { nomer_v_cepochke: 0, komu: nomerDezhurnogo, prichina: o.eskKod, dry_run: false, ok: true });
      if (o.eskPrinyal) zh(vremyaOt(o, o.eskPrinyal), 'dezhurnyy', 'eskalaciya_prinyata', ob, { nomer: nomerDezhurnogo, i: 0 });
    }
    if (zapis.zakrit) zh(zapis.ne_zakryta_v, 'zamena', 'smena_ne_zakryta', ob, { smena_id: smena.id });
  }
  // утренняя сводка 7:00
  const svodkaV = t(segodnya, '07:00');
  let temaSvodki = `${AGENTSTVO}, ${FMT_DEN.format(new Date(t(sdvigYmd(segodnya, -1), '12:00')))}: morning summary`;
  if (uzhe(plusSek(svodkaV, 4))) temaSvodki = require('./svodka').renderSvodka(demoSnimok(svodkaV)).tema; // та же тема, что у письма в 7:00
  zh(plusSek(svodkaV, 4), 'svodka', 'pismo_otpravleno', `svodki/${segodnya}`, { komu: POCHTA_SVODKI, tema: temaSvodki, id: `em_demo_${hex(10)}` });
  zh(plusSek(svodkaV, 5), 'svodka', 'svodka', `svodki/${segodnya}`, { tema: temaSvodki, komu: POCHTA_SVODKI.length, rezultat: 'otpravleno' });
  zhurnal.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // Звонок как его пишет функция itog стенда: + telefon, imya и ссылка на карточку разговора (служебные _поля — прочь).
  const dlyaVyvoda = (z) => {
    const out = Object.fromEntries(Object.entries(z).filter(([k]) => !k.startsWith('_')));
    const otk = z._otkaz ? otkazy.find((o) => o.id === z._otkaz) : null;
    const imya = z._kand ? (kandidatyDoSeychas.find((k) => k.id === z._kand) || {}).imya
      : z._semya ? (semi.find((x) => x.id === z._semya) || { kontakt: {} }).kontakt.imya
        : z._imya || (otk ? (sidelkaPoId.get(otk.sidelka_id) || {}).imya : null);
    if (imya) out.imya = imya;
    if (z._kand) out.kandidat_id = z._kand;
    if (z._semya) out.semya_id = z._semya;
    if (z._otkaz) out.otkaz_id = z._otkaz;
    return out;
  };
  return {
    kandidaty: kandidatyDoSeychas,
    sidelki,
    klienty,
    smeny,
    otkazy,
    evv: evv.filter((r) => uzhe(r.zagruzheno)),
    zvonki: vseZvonki.map(dlyaVyvoda),
    soglasiya: [...soglasiya.values()].filter((s) => uzhe(s.at)),
    // запись оценки ещё не сделана к seychas — ни встречи, ни почты (почта приходит вместе с записью)
    semi: semi.filter((s) => uzhe(s.created_at)).map((s) => (s.ocenka && !uzhe(s.ocenka.zapisano_v)
      ? { ...s, kontakt: { imya: s.kontakt.imya, telefon: s.kontakt.telefon }, ocenka: null, status: 'new', updated_at: s.created_at } : s)),
    zhurnal,
  };
}

// ---------- клиент из nastroyki.json ----------

function demoKlient() {
  let n = {};
  try { n = require('../../nastroyki.json').brightside || {}; } catch (e) { n = {}; }
  return {
    id: 'brightside',
    nazvanie: n.nazvanie || 'Brightside Home Care (DEMO)',
    demo: n.demo !== undefined ? n.demo : true,
    shtat: n.shtat || 'NY',
    poyas: n.poyas || POYAS,
    yazyki: n.yazyki || ['en', 'es', 'ru', 'zh', 'ht'],
    zamena: n.zamena || { volna: 3, ozhidanie_min: 15, eskalaciya_za_chasov: 2 },
    opisanie: 'Brooklyn and Queens, NY',
  };
}

// Как netlify-functions/pult.js: снимок + semi (новые сверху, до 50) + журнал дня (последние 100, новые сверху).
function demoSnimok(seychas) {
  const zapisi = demoZapisi(seychas);
  const snimok = sobratSnimok({ klient: demoKlient(), seychas, zapisi });
  snimok.semi = zapisi.semi.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 50);
  snimok.zhurnal = zapisi.zhurnal.slice(-100).reverse();
  return snimok;
}

module.exports = { demoZapisi, demoKlient, demoSnimok, SEYCHAS_PULT, SEYCHAS_SVODKA, DEMO_DANNYE, RAYON_PO_ZIP };

// ---------- запуск ----------

if (require.main === module) {
  const koren = path.resolve(__dirname, '..', '..');
  const snimok = demoSnimok(SEYCHAS_PULT);
  snimok.pometka = 'DEMO: all agencies, people, phone numbers (555-01xx) and records here are fictional.';
  fs.writeFileSync(path.join(koren, 'web', 'pult', 'demo.json'), `${JSON.stringify(snimok, null, 2)}\n`);

  const { renderSvodka } = require('./svodka');
  const utro = demoSnimok(SEYCHAS_SVODKA);
  utro.ssylka_pult = '/pult/?demo=1';
  const pismo = renderSvodka(utro);
  const html = pismo.html.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">');
  fs.writeFileSync(path.join(koren, 'web', 'demo', 'care', 'svodka.html'), html);

  const s = snimok.segodnya;
  const v = snimok.vchera;
  console.log(`demo.json: ${snimok.sformirovano}; сегодня звонков ${s.zvonki.vsego}, кандидатов ${s.kandidaty.novyh}, записей ${s.sobesedovaniya.zapisano}, отказов ${s.otkazy.vsego}`);
  console.log(`вчера: звонков ${v.zvonki.vsego}, кандидатов ${v.kandidaty.novyh}, записей ${v.sobesedovaniya.zapisano}, отказов ${v.otkazy.vsego} (не закрыто ${v.otkazy.ne_zakryto}), EVV ${v.evv.isklyucheniy}`);
  console.log(`воронка: ${snimok.voronka.etapy.map((e) => `${e.kod} ${e.n}`).join(' → ')}; причины: ${snimok.voronka.otkazy_po_prichinam.map((p) => `${p.kod} ${p.n}`).join(', ')}`);
  console.log(`семьи: ${snimok.semi.length}; журнал сегодня: ${snimok.zhurnal.length} строк; EVV последний: ${snimok.evv.posledniy.isklyucheniya.length} исключений в ${snimok.evv.posledniy.strok} строках`);
  console.log(`svodka.html: «${pismo.tema}»`);
}
