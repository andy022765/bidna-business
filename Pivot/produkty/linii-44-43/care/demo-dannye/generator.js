'use strict';
// DEMO — генератор вымышленных демо-данных №44 CareLine: агентство «Brightside Home Care (DEMO)», Бруклин и Квинс.
//
//   node generator.js             перезаписать файлы в этой папке (seed фиксирован — результат всегда тот же)
//   node generator.js --proverit  только сверить файлы на диске с тем, что даёт seed
//
// ВСЁ ВЫМЫШЛЕНО. Имена — «имя + инициал» из общих списков; телефоны — только вымышленный диапазон NANP
// 555-0100…0199 (коды 347 — сиделки, 718 — клиенты); адреса — «DEMO address»; номера Medicaid — «DEMO-…»;
// налоговый номер агентства — нули. Координаты клиента — точка ZIP (перепись 2020) со сдвигом до ~450 м.
//
// КАК ПОДКЛАДЫВАЮТСЯ ОШИБКИ. evv-chistaya.csv — выгрузка без нарушений. evv-s-oshibkami.csv — та же выгрузка,
// где 26 визитов испорчены и 4 добавлены (дубль, визит вне расписания, два визита после конца авторизации).
// Каждая порча записывается в oshibki-ozhidaemye.json в момент порчи, до проверки движком. В конце генератор
// прогоняет движок: на чистой выгрузке — ноль исключений, на грязной — ровно список, не больше и не меньше.

const fs = require('fs');
const path = require('path');

const LIB = path.join(__dirname, '..', '..', 'platforma', 'lib', 'care');
const vr = require(path.join(LIB, 'vremya-dvizhkov.js'));
const { ZIP, koordinaty, rasstoyanieKm } = require(path.join(LIB, 'zip.js'));
const evv = require(path.join(LIB, 'evv.js'));
const zamena = require(path.join(LIB, 'zamena.js'));

const SEED = 44;
const POYAS = 'America/New_York';
const AGENTSTVO = 'Brightside Home Care (DEMO)';
const DATA_DNYA = { 1: '2026-10-05', 2: '2026-10-06', 3: '2026-10-07', 4: '2026-10-08', 5: '2026-10-09', 6: '2026-10-10', 0: '2026-10-11' };

// Состав сиделок: языки → сколько (итого 45). Первый язык — родной, по нему выбирается район.
const SOSTAV_SIDELOK = [
  [['en'], 8], [['es', 'en'], 8], [['es'], 4], [['ru', 'en'], 4], [['ru'], 3],
  [['zh', 'en'], 5], [['zh'], 4], [['ht', 'en'], 7], [['ht'], 2],
];
const SOSTAV_KLIENTOV = [['en', 20], ['es', 14], ['ru', 9], ['zh', 8], ['ht', 9]];
const IMENA = {
  en: ['Denise', 'Tanya', 'Keisha', 'Brenda', 'Monique', 'Sharon', 'Patricia', 'Janelle', 'Latoya', 'Crystal', 'Gloria', 'Renee'],
  es: ['Rosa', 'Carmen', 'Lucía', 'Yolanda', 'Altagracia', 'Marisol', 'Juana', 'Esperanza', 'Beatriz', 'Milagros', 'Maritza'],
  ru: ['Galina', 'Svetlana', 'Natalia', 'Irina', 'Olga', 'Lyudmila', 'Tamara'],
  zh: ['Mei', 'Li Na', 'Xiuying', 'Hui', 'Yan', 'Fang', 'Jing', 'Ling'],
  ht: ['Marie-Claude', 'Nadège', 'Guerline', 'Rose-Marie', 'Fabienne', 'Marjorie', 'Widline', 'Nathalie', 'Myrlande'],
};
const INICIALY = 'ABCDEFGHJKLMNOPRSTVWZ'.split('');
// Районы, где живут носители языка (правдоподобно для Бруклина и Квинса); английский — любой ZIP.
const ZIP_PO_YAZYKU = {
  es: ['11237', '11221', '11207', '11208', '11232', '11220', '11368', '11372', '11373', '11385', '11369'],
  ru: ['11235', '11229', '11224', '11223', '11214', '11374', '11375', '11204'],
  zh: ['11220', '11219', '11204', '11214', '11228', '11354', '11355', '11373'],
  ht: ['11226', '11203', '11210', '11236', '11212', '11225', '11411', '11412', '11413', '11434'],
};
const VSE_ZIP = Object.keys(ZIP);
const SHABLONY = [
  { dni: [1, 2, 3, 4, 5], chasy: 4 }, { dni: [1, 2, 3, 4, 5], chasy: 6 }, { dni: [0, 1, 2, 3, 4, 5, 6], chasy: 4 },
  { dni: [1, 3, 5], chasy: 3 }, { dni: [2, 4], chasy: 5 }, { dni: [0, 6], chasy: 8 },
  { dni: [1, 2, 3, 4], chasy: 5 }, { dni: [1, 3, 5], chasy: 4 },
];
const STARTY = [7, 8, 9, 10, 12, 13, 14, 16, 17];
const KOD_USLUGI = { PCA: 'T1019:U1', HHA: 'S5125' }; // NY Managed Care: PCS Level II 15 мин / HHA 15 мин

const KOLONKI_CSV = [
  'Visit ID', 'Agency Tax ID', 'Payer ID', 'Medicaid Number', 'Member ID', 'Caregiver Code', 'Schedule ID',
  'Procedure Code', 'Visit Date', 'Schedule Start Time', 'Schedule End Time', 'Visit Start Time', 'Visit End Time',
  'EVV Start Time', 'EVV End Time', 'Clock-In Service Location Type', 'Clock-In Phone Number', 'Clock-In Latitude',
  'Clock-In Longitude', 'Clock-In EVV Other Info', 'Clock-Out Service Location Type', 'Clock-Out Phone Number',
  'Clock-Out Latitude', 'Clock-Out Longitude', 'Clock-Out EVV Other Info', 'Units Billed', 'Visit Edit Reason Code',
  'Visit Edit Action Taken', 'Is Deletion', 'Missed Visit', 'Missed Visit Reason Code', 'Notes',
];

const pad = (n, w) => String(n).padStart(w, '0');
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const sravnitId = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const MIN = 60000;

function generatorSluchaya(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => {
    const x = arr.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  return { rnd, int, pick, shuffle };
}

const vMestnom = (data, chas, minut = 0) => {
  const [y, m, d] = data.split('-').map(Number);
  return vr.izMestnogo(y, m, d, chas, minut, 0, POYAS);
};
const stroka = (ms) => {
  const c = vr.chasti(ms, POYAS);
  return `${c.y}-${pad(c.m, 2)}-${pad(c.d, 2)} ${pad(c.h, 2)}:${pad(c.mi, 2)}`;
};
const cifry = (tel) => String(tel).replace(/\D/g, '').slice(-10);

function sgenerirovat() {
  const R = generatorSluchaya(SEED);

  // ── 1. Сиделки ────────────────────────────────────────────────────────────
  const sidelki = [];
  const zanyatyeImena = new Set();
  let n = 0;
  for (const [yazyki, skolko] of SOSTAV_SIDELOK) {
    for (let j = 0; j < skolko; j++) {
      n++;
      const rodnoy = yazyki[0];
      let imya;
      do imya = `${R.pick(IMENA[rodnoy])} ${R.pick(INICIALY)}.`; while (zanyatyeImena.has(imya));
      zanyatyeImena.add(imya);
      sidelki.push({
        id: `CG-${pad(n, 3)}`,
        demo: true,
        imya,
        telefon: `+1347555${pad(99 + n, 4)}`,
        yazyki: [...yazyki],
        navyki: [j % 3 === 2 ? 'PCA' : 'HHA'],
        zip: R.pick(ZIP_PO_YAZYKU[rodnoy] || VSE_ZIP),
        maks_chasov_v_nedelyu: R.pick([30, 35, 40, 40, 44, 50]),
        chasov_na_etoy_nedele: 0,
        nadezhnost: Math.round((0.6 + R.rnd() * 0.39) * 100) / 100,
        znaet_klientov: [],
        sms_soglasie: true,
        aktivna: true,
      });
    }
  }
  const poryadok = R.shuffle(sidelki.map((_, i) => i));
  for (const i of poryadok.slice(0, 3)) sidelki[i].aktivna = false;
  for (const i of poryadok.slice(3, 8)) sidelki[i].sms_soglasie = false;

  // ── 2. Клиенты ────────────────────────────────────────────────────────────
  const klienty = [];
  let k = 0;
  for (const [yaz, skolko] of SOSTAV_KLIENTOV) {
    for (let j = 0; j < skolko; j++) {
      k++;
      const zip = R.pick(ZIP_PO_YAZYKU[yaz] || VSE_ZIP);
      const t = koordinaty(zip);
      const navyk = j % 5 === 0 || j % 5 === 2 ? 'HHA' : 'PCA';
      klienty.push({
        id: `CL-${pad(k, 3)}`,
        demo: true,
        kod: `${t.boro}-${100 + k}`,
        zip,
        yazyk: yaz,
        trebovaniya_navyki: [navyk],
        avtorizacii: [],
        adres: `DEMO address, ${t.boro === 'BK' ? 'Brooklyn' : 'Queens'}, NY ${zip}`,
        lat: round6(t.lat + (R.rnd() - 0.5) * 0.008),
        lon: round6(t.lon + (R.rnd() - 0.5) * 0.010),
        telefon: `+1718555${pad(99 + k, 4)}`,
        medicaid: `DEMO-${pad(k, 5)}`,
      });
    }
  }
  const klPoId = new Map(klienty.map((x) => [x.id, x]));
  const sdPoId = new Map(sidelki.map((x) => [x.id, x]));

  // Способ отметки EVV у клиента: у 8 — городской телефон (telephony), у 2 — FOB, у остальных — приложение с GPS.
  const sposob = new Map(klienty.map((x) => [x.id, 'mobile']));
  const smeshannye = R.shuffle(klienty.map((x) => x.id));
  smeshannye.slice(0, 8).forEach((id) => sposob.set(id, 'telephony'));
  smeshannye.slice(8, 10).forEach((id) => sposob.set(id, 'fob'));
  // Клиент, у которого авторизация кончается в четверг 08.10, а расписание идёт всю неделю.
  const klientVneDat = R.pick(klienty.filter((x) => sposob.get(x.id) === 'mobile')).id;

  // ── 3. Расписание недели 05–11.10.2026 ────────────────────────────────────
  const planKlienta = new Map();
  for (const kl of klienty) {
    const sh = kl.id === klientVneDat ? SHABLONY[2] : R.pick(SHABLONY);
    const chas = R.pick(STARTY.filter((h) => h + sh.chasy <= 21));
    planKlienta.set(kl.id, sh.dni.map((dn) => {
      const data = DATA_DNYA[dn];
      return { klient_id: kl.id, data, a: vMestnom(data, chas), b: vMestnom(data, chas + sh.chasy), chasy: sh.chasy };
    }).sort((x, y) => x.a - y.a));
  }
  const aktivnye = sidelki.filter((s) => s.aktivna);
  const zanyatost = new Map(aktivnye.map((s) => [s.id, []]));
  const chasy = new Map(aktivnye.map((s) => [s.id, 0]));
  const BUFER = 60 * MIN; // в расписании между клиентами час на дорогу
  const podhodit = (sd, kl) => sd.yazyki.includes(kl.yazyk)
    && (sd.navyki.includes(kl.trebovaniya_navyki[0]) || (kl.trebovaniya_navyki[0] === 'PCA' && sd.navyki.includes('HHA')));
  const svobodna = (sd, sm) => !zanyatost.get(sd.id).some((z) => z.a < sm.b + BUFER && z.b > sm.a - BUFER);
  const limit = (sd) => sd.maks_chasov_v_nedelyu - 4; // запас 4 часа на замены
  const naznachit = (sd, sm) => { sm.sidelka_id = sd.id; zanyatost.get(sd.id).push(sm); chasy.set(sd.id, chasy.get(sd.id) + sm.chasy); };

  const ochered = klienty.map((kl) => ({ kl, plan: planKlienta.get(kl.id), kand: aktivnye.filter((sd) => podhodit(sd, kl)) }))
    .sort((x, y) => x.kand.length - y.kand.length || sravnitId(x.kl.id, y.kl.id));
  for (const { kl, plan, kand } of ochered) {
    const blizkie = kand.map((sd) => ({ sd, km: rasstoyanieKm(sd.zip, kl.zip) }))
      .filter((x) => x.km != null && x.km <= 22)
      .sort((x, y) => x.km - y.km || sravnitId(x.sd.id, y.sd.id)).map((x) => x.sd);
    const vsego = plan.reduce((s, sm) => s + sm.chasy, 0);
    const odna = blizkie.find((sd) => chasy.get(sd.id) + vsego <= limit(sd) && plan.every((sm) => svobodna(sd, sm)));
    if (odna) { plan.forEach((sm) => naznachit(odna, sm)); continue; }
    for (const sm of plan) {
      const uzhe = [...new Set(plan.filter((x) => x.sidelka_id).map((x) => x.sidelka_id))].map((id) => sdPoId.get(id));
      const sd = [...uzhe, ...blizkie].find((x) => chasy.get(x.id) + sm.chasy <= limit(x) && svobodna(x, sm));
      if (!sd) throw new Error(`генератор: некому поставить смену клиента ${kl.id} ${sm.data}`);
      naznachit(sd, sm);
    }
  }
  const vseSmeny = klienty.flatMap((kl) => planKlienta.get(kl.id))
    .sort((x, y) => x.a - y.a || sravnitId(x.klient_id, y.klient_id));
  vseSmeny.forEach((sm, i) => { sm.id = `SM-${pad(i + 1, 4)}`; });
  const smeny = vseSmeny.map((sm) => ({
    id: sm.id, demo: true, klient_id: sm.klient_id, sidelka_id: sm.sidelka_id,
    start: vr.vIso(sm.a, POYAS), end: vr.vIso(sm.b, POYAS),
    kod_uslugi: KOD_USLUGI[klPoId.get(sm.klient_id).trebovaniya_navyki[0]], status: 'scheduled',
  }));
  for (const sd of sidelki) {
    const moi = vseSmeny.filter((sm) => sm.sidelka_id === sd.id);
    sd.chasov_na_etoy_nedele = moi.reduce((s, sm) => s + sm.chasy, 0);
    const svoi = [...new Set(moi.map((sm) => sm.klient_id))];
    const drugie = R.shuffle(klienty.filter((kl) => sd.yazyki.includes(kl.yazyk) && !svoi.includes(kl.id)).map((kl) => kl.id)).slice(0, R.int(0, 2));
    sd.znaet_klientov = [...svoi, ...drugie].sort(sravnitId);
  }

  // ── 4. Визиты: по одному на смену ─────────────────────────────────────────
  const vizity = vseSmeny.map((sm, i) => {
    const kl = klPoId.get(sm.klient_id);
    const prihod = sm.a + R.int(-5, 3) * MIN;
    const uhod = sm.b + R.int(-3, 6) * MIN;
    const r = {
      'Visit ID': `V-${10001 + i}`, 'Agency Tax ID': '000000000', 'Payer ID': 'DEMO-MLTC-01',
      'Medicaid Number': kl.medicaid, 'Member ID': kl.id, 'Caregiver Code': sm.sidelka_id, 'Schedule ID': sm.id,
      'Procedure Code': KOD_USLUGI[kl.trebovaniya_navyki[0]], 'Visit Date': sm.data,
      'Schedule Start Time': stroka(sm.a), 'Schedule End Time': stroka(sm.b),
      'Visit Start Time': stroka(prihod), 'Visit End Time': stroka(uhod),
      'EVV Start Time': stroka(prihod), 'EVV End Time': stroka(uhod),
      'Clock-In Service Location Type': 'Home', 'Clock-In Phone Number': '', 'Clock-In Latitude': '',
      'Clock-In Longitude': '', 'Clock-In EVV Other Info': '',
      'Clock-Out Service Location Type': 'Home', 'Clock-Out Phone Number': '', 'Clock-Out Latitude': '',
      'Clock-Out Longitude': '', 'Clock-Out EVV Other Info': '',
      'Units Billed': Math.floor((uhod - prihod) / MIN / 15),
      'Visit Edit Reason Code': '', 'Visit Edit Action Taken': '', 'Is Deletion': 'N', 'Missed Visit': 'N',
      'Missed Visit Reason Code': '', Notes: 'DEMO',
      _sm: sm, _prihod: prihod, _uhod: uhod, _sposob: sposob.get(kl.id),
    };
    for (const [pr, kogda] of [['Clock-In', prihod], ['Clock-Out', uhod]]) {
      void kogda;
      if (r._sposob === 'telephony') r[`${pr} Phone Number`] = cifry(kl.telefon);
      else if (r._sposob === 'fob') r[`${pr} EVV Other Info`] = `FOB DEMO-${kl.id.slice(3)}`;
      else {
        r[`${pr} Latitude`] = round6(kl.lat + (R.rnd() - 0.5) * 0.0008).toFixed(6);
        r[`${pr} Longitude`] = round6(kl.lon + (R.rnd() - 0.5) * 0.0010).toFixed(6);
      }
    }
    return r;
  });
  const poId = new Map(vizity.map((r) => [r['Visit ID'], r]));

  // Особые клиенты: «тесные» (авторизация впритык к выставленному) — под превышение авторизации.
  const obychnyeKlienty = klienty.filter((x) => x.id !== klientVneDat);
  const tesnye = R.shuffle(obychnyeKlienty.filter((x) => planKlienta.get(x.id).length >= 2)).slice(0, 2).map((x) => x.id);
  const osobyeKlienty = new Set([klientVneDat, ...tesnye]);
  const zanyaty = new Set(); // визиты, уже занятые особыми случаями или порчей
  const obychnyy = (r) => !osobyeKlienty.has(r['Member ID']) && !zanyaty.has(r['Visit ID']);
  const vybrat = (opisanie, uslovie) => {
    const kand = vizity.filter((r) => obychnyy(r) && uslovie(r));
    if (!kand.length) throw new Error(`генератор: нет визита для «${opisanie}»`);
    const r = kand[Math.floor(R.rnd() * kand.length)];
    zanyaty.add(r['Visit ID']);
    return r;
  };
  const mobile = (r) => r._sposob === 'mobile';

  // Визиты клиента «вне дат» после 08.10 в чистую выгрузку не входят (агентство их не выставляет).
  const posleAvt = vizity.filter((r) => r['Member ID'] === klientVneDat && r['Visit Date'] > '2026-10-08');
  posleAvt.forEach((r) => zanyaty.add(r['Visit ID']));

  // ── 5. Нормальные особенности чистой выгрузки (не ошибки) ─────────────────
  const osobye = [];
  const propushchennye = [vybrat('пропущенный визит', mobile), vybrat('пропущенный визит', mobile)];
  for (const r of propushchennye) {
    Object.assign(r, {
      'Missed Visit': 'Y', 'Missed Visit Reason Code': 'DEMO-MV1', 'Visit Start Time': '', 'Visit End Time': '',
      'EVV Start Time': '', 'EVV End Time': '', 'Clock-In Latitude': '', 'Clock-In Longitude': '',
      'Clock-Out Latitude': '', 'Clock-Out Longitude': '', 'Units Billed': '', Notes: 'DEMO, client in hospital',
    });
    osobye.push([r['Visit ID'], 'пропущенный визит (Missed Visit = Y) — не проверяется']);
  }
  {
    const r = vybrat('ручной уход с причиной', mobile);
    r['EVV End Time'] = '';
    r['Visit End Time'] = stroka(r._sm.b);
    r['Clock-Out Latitude'] = ''; r['Clock-Out Longitude'] = '';
    r['Units Billed'] = Math.floor((r._sm.b - r._prihod) / MIN / 15);
    r['Visit Edit Reason Code'] = '110'; r['Visit Edit Action Taken'] = '10';
    osobye.push([r['Visit ID'], 'уход внесён вручную с кодом причины']);
  }
  {
    const r = vybrat('правка прихода с причиной', mobile);
    const pozdno = r._sm.a + 25 * MIN;
    r['EVV Start Time'] = stroka(pozdno);
    r['Visit Start Time'] = stroka(r._sm.a);
    r['Units Billed'] = Math.floor((r._uhod - r._sm.a) / MIN / 15);
    r['Visit Edit Reason Code'] = '120'; r['Visit Edit Action Taken'] = '10';
    osobye.push([r['Visit ID'], 'время прихода исправлено с кодом причины']);
  }
  {
    const r = vybrat('ручной приход с причиной', mobile);
    r['EVV Start Time'] = '';
    r['Visit Start Time'] = stroka(r._sm.a);
    r['Clock-In Latitude'] = ''; r['Clock-In Longitude'] = '';
    r['Units Billed'] = Math.floor((r._uhod - r._sm.a) / MIN / 15);
    r['Visit Edit Reason Code'] = '110'; r['Visit Edit Action Taken'] = '10';
    osobye.push([r['Visit ID'], 'приход внесён вручную с кодом причины']);
  }
  for (let i = 0; i < 2; i++) {
    const r = vybrat('уход в сообществе', mobile);
    const kl = klPoId.get(r['Member ID']);
    r['Clock-Out Service Location Type'] = 'Community';
    r['Clock-Out Latitude'] = round6(kl.lat + 0.0135).toFixed(6);
    r['Clock-Out Longitude'] = round6(kl.lon).toFixed(6);
    r.Notes = 'DEMO, escort to clinic';
    osobye.push([r['Visit ID'], 'уход отмечен у поликлиники, тип места Community — не ошибка']);
  }
  const udalennyy = (() => {
    const r = vybrat('удалённый дубль', mobile);
    zanyaty.add('V-18001');
    return Object.assign({}, r, { 'Visit ID': 'V-18001', 'Is Deletion': 'Y', Notes: 'DEMO, duplicate deleted' });
  })();
  osobye.push(['V-18001', 'дубль, помеченный Is Deletion = Y — не проверяется']);

  // ── 6. Авторизации (после визитов: «тесным» лимит ровно по выставленным единицам) ──
  const edinicChistyh = (id) => vizity.filter((r) => r['Member ID'] === id && !posleAvt.includes(r) && r['Missed Visit'] !== 'Y')
    .reduce((s, r) => s + Number(r['Units Billed'] || 0), 0);
  const avtorizacii = klienty.map((kl, i) => {
    const plan = planKlienta.get(kl.id);
    const zapas = R.pick([8, 12, 16, 24]);
    const mesyac = R.int(5, 10);
    let s = `2026-${pad(mesyac, 2)}-01`;
    let po = vr.sdvigDaty(`${mesyac + 6 > 12 ? 2027 : 2026}-${pad(((mesyac + 5) % 12) + 1, 2)}-01`, -1);
    if (kl.id === klientVneDat) { s = '2026-04-09'; po = '2026-10-08'; }
    const edinic = tesnye.includes(kl.id) ? edinicChistyh(kl.id) : plan.reduce((x, sm) => x + sm.chasy * 4, 0) + zapas;
    return {
      id: `AU-${pad(i + 1, 3)}`, demo: true, klient_id: kl.id, kod_uslugi: KOD_USLUGI[kl.trebovaniya_navyki[0]],
      s, po, edinic, period: 'nedelya', platelshchik: 'DEMO MLTC Plan',
      mesto: { lat: kl.lat, lon: kl.lon, adres: kl.adres, telefony: [kl.telefon] },
    };
  });
  const avtPoKlientu = new Map(avtorizacii.map((a) => [a.klient_id, a]));
  for (const kl of klienty) {
    const a = avtPoKlientu.get(kl.id);
    kl.avtorizacii = [{ id: a.id, kod_uslugi: a.kod_uslugi, s: a.s, po: a.po, edinic: a.edinic, period: a.period }];
  }
  // Запас единиц клиента под порчу: лимит минус выставленное в чистой выгрузке минус уже добавленное порчей.
  const dobavleno = new Map();
  const dobavitEdinic = (id, n) => dobavleno.set(id, (dobavleno.get(id) || 0) + n);
  const zapasKlienta = (id) => avtPoKlientu.get(id).edinic - edinicChistyh(id) - (dobavleno.get(id) || 0);
  const obrazec = (id) => vizity.find((r) => r['Member ID'] === id && r['Missed Visit'] === 'N'
    && !r['Visit Edit Reason Code'] && r['Clock-In Latitude'] && r['Clock-Out Service Location Type'] === 'Home');

  // ── 7. Порча: ровно 30 ошибок, по одной на визит ──────────────────────────
  const gryaz = new Map(vizity.map((r) => [r['Visit ID'], Object.assign({}, r)]));
  const dobavlennye = [];
  const ozhidaemye = [];
  const zapisat = (id, pravilo, chto) => ozhidaemye.push({ vizit_id: id, pravilo, chto_podlozheno: chto });
  const isportit = (r, pravilo, chto, izmenit) => { izmenit(gryaz.get(r['Visit ID'])); zapisat(r['Visit ID'], pravilo, chto); };
  const pusto = (g, pr) => { for (const p of ['Phone Number', 'Latitude', 'Longitude', 'EVV Other Info', 'Service Location Type']) g[`${pr} ${p}`] = ''; };
  const edinicPoVremeni = (g) => Math.floor((vr.vMs(g['Visit End Time'], POYAS) - vr.vMs(g['Visit Start Time'], POYAS)) / MIN / 15);

  isportit(vybrat('NET_USLUGI', () => true), 'NET_USLUGI', 'стёрт Procedure Code', (g) => { g['Procedure Code'] = ''; });
  isportit(vybrat('NET_POLUCHATELYA', () => true), 'NET_POLUCHATELYA', 'стёрты Member ID и Medicaid Number',
    (g) => { g['Member ID'] = ''; g['Medicaid Number'] = ''; });
  isportit(vybrat('NET_DATY', () => true), 'NET_DATY', 'стёрта Visit Date', (g) => { g['Visit Date'] = ''; });
  isportit(vybrat('NET_ISPOLNITELYA', () => true), 'NET_ISPOLNITELYA', 'стёрт Caregiver Code', (g) => { g['Caregiver Code'] = ''; });
  isportit(vybrat('NET_MESTA приход', mobile), 'NET_MESTA', 'у прихода стёрты GPS и тип места', (g) => pusto(g, 'Clock-In'));
  isportit(vybrat('NET_MESTA уход', mobile), 'NET_MESTA', 'у ухода стёрты GPS и тип места', (g) => pusto(g, 'Clock-Out'));
  for (let i = 0; i < 2; i++) {
    isportit(vybrat('NET_PRIHODA', () => true), 'NET_PRIHODA', 'стёрты Visit Start Time, EVV Start Time и место прихода',
      (g) => { g['Visit Start Time'] = ''; g['EVV Start Time'] = ''; pusto(g, 'Clock-In'); });
  }
  for (let i = 0; i < 3; i++) {
    isportit(vybrat('NET_UHODA', () => true), 'NET_UHODA', 'стёрты Visit End Time, EVV End Time и место ухода (сиделка забыла отметиться)',
      (g) => { g['Visit End Time'] = ''; g['EVV End Time'] = ''; pusto(g, 'Clock-Out'); });
  }
  isportit(vybrat('UHOD_RANSHE_PRIHODA', (r) => vr.chasti(r._uhod, POYAS).h >= 13), 'UHOD_RANSHE_PRIHODA',
    'уход записан на 12 часов раньше (AM вместо PM)', (g) => {
      const t = stroka(g._uhod - 12 * 60 * MIN);
      g['Visit End Time'] = t; g['EVV End Time'] = t;
    });
  isportit(vybrat('PRAVKA уход вручную', mobile), 'PRAVKA_BEZ_PRICHINY', 'уход внесён вручную (EVV End Time пуст), кода причины нет', (g) => {
    g['EVV End Time'] = ''; g['Visit End Time'] = stroka(g._sm.b);
    g['Clock-Out Latitude'] = ''; g['Clock-Out Longitude'] = '';
    g['Units Billed'] = Math.min(Number(g['Units Billed']), edinicPoVremeni(g));
  });
  isportit(vybrat('PRAVKA приход сдвинут', mobile), 'PRAVKA_BEZ_PRICHINY', 'Visit Start Time сдвинут на 40 минут раньше EVV Start Time, кода причины нет',
    (g) => { g['Visit Start Time'] = stroka(g._prihod - 40 * MIN); });
  isportit(vybrat('MESTO приход далеко', mobile), 'MESTO_NE_SOVPADAET', 'GPS прихода сдвинут на ~2,5 км к северу',
    (g) => { g['Clock-In Latitude'] = round6(Number(g['Clock-In Latitude']) + 0.0225).toFixed(6); });
  isportit(vybrat('MESTO уход далеко', mobile), 'MESTO_NE_SOVPADAET', 'GPS ухода сдвинут на ~1,2 км к востоку',
    (g) => { g['Clock-Out Longitude'] = round6(Number(g['Clock-Out Longitude']) + 0.0142).toFixed(6); });
  isportit(vybrat('MESTO чужой телефон', (r) => r._sposob === 'telephony'), 'MESTO_NE_SOVPADAET',
    'приход отмечен звонком с мобильного сиделки, а не с телефона клиента',
    (g) => { g['Clock-In Phone Number'] = cifry(sdPoId.get(g['Caregiver Code']).telefon); });
  for (let i = 0; i < 2; i++) {
    const r = vybrat('EDINICY', (x) => zapasKlienta(x['Member ID']) >= 5);
    dobavitEdinic(r['Member ID'], 3);
    isportit(r, 'EDINICY_BOLSHE_VREMENI', 'Units Billed больше времени визита на 3 единицы',
      (g) => { g['Units Billed'] = Number(g['Units Billed']) + 3; });
  }
  for (const id of tesnye) {
    const posledniy = vizity.filter((r) => r['Member ID'] === id).sort((a, b) => b._sm.a - a._sm.a)[0];
    zanyaty.add(posledniy['Visit ID']);
    isportit(posledniy, 'PREVYSHENIE_AVTORIZACII', 'последний визит недели продлён на 30 минут, выставлено на 2 единицы больше лимита авторизации', (g) => {
      const t = stroka(g._uhod + 30 * MIN);
      g['Visit End Time'] = t; g['EVV End Time'] = t;
      g['Units Billed'] = edinicPoVremeni(g);
    });
  }
  const pca = (r) => r['Procedure Code'] === 'T1019:U1';
  isportit(vybrat('KOD S5125', pca), 'KOD_NE_AVTORIZOVAN', 'код T1019:U1 заменён на S5125 (HHA), которого нет в авторизации',
    (g) => { g['Procedure Code'] = 'S5125'; });
  isportit(vybrat('KOD U6', pca), 'KOD_NE_AVTORIZOVAN', 'модификатор U1 заменён на U6 (CDPA), которого нет в авторизации',
    (g) => { g['Procedure Code'] = 'T1019:U6'; });
  for (const r of posleAvt.filter((x) => x['Visit Date'] <= '2026-10-10')) {
    dobavlennye.push(Object.assign({}, r));
    zapisat(r['Visit ID'], 'VNE_DAT_AVTORIZACII', `визит ${r['Visit Date']} после конца авторизации 08.10 (расписание не обновили)`);
  }
  {
    const r = vybrat('дубль', (x) => mobile(x) && zapasKlienta(x['Member ID']) >= Number(x['Units Billed']) + 2);
    dobavitEdinic(r['Member ID'], Number(r['Units Billed']));
    const kopiya = Object.assign({}, r, { 'Visit ID': 'V-19001', Notes: 'DEMO' });
    dobavlennye.push(kopiya);
    zapisat('V-19001', 'PERESECHENIE', `дубль визита ${r['Visit ID']} под новым Visit ID`);
  }
  {
    // Сиделка, у которой в один день два визита у разных клиентов: второй начинается за 30 мин до конца первого.
    const paryPoDnyu = [];
    const poSidelke = new Map();
    for (const r of vizity) {
      if (!obychnyy(r) || r['Missed Visit'] === 'Y') continue;
      const kl = `${r['Caregiver Code']}|${r['Visit Date']}`;
      if (!poSidelke.has(kl)) poSidelke.set(kl, []);
      poSidelke.get(kl).push(r);
    }
    for (const spisok of poSidelke.values()) {
      if (spisok.length < 2) continue;
      spisok.sort((a, b) => a._prihod - b._prihod);
      for (let i = 1; i < spisok.length; i++) if (spisok[i]['Member ID'] !== spisok[i - 1]['Member ID']) paryPoDnyu.push([spisok[i - 1], spisok[i]]);
    }
    if (!paryPoDnyu.length) throw new Error('генератор: нет сиделки с двумя визитами в день');
    const [A, B] = paryPoDnyu[Math.floor(R.rnd() * paryPoDnyu.length)];
    zanyaty.add(A['Visit ID']); zanyaty.add(B['Visit ID']);
    isportit(B, 'PERESECHENIE', `приход сдвинут на 30 минут раньше конца визита ${A['Visit ID']} той же сиделки`, (g) => {
      const t = stroka(A._uhod - 30 * MIN);
      g['Visit Start Time'] = t; g['EVV Start Time'] = t;
    });
  }
  // Кто свободен в это время по грязной выгрузке (±60 минут).
  const vseGryaznye = () => [...gryaz.values(), ...dobavlennye];
  const svobodnaV = (sdId, a, b) => !vseGryaznye().some((g) => g['Caregiver Code'] === sdId && g['Missed Visit'] !== 'Y'
    && vr.vMs(g['Visit Start Time'], POYAS) < b + 60 * MIN && vr.vMs(g['Visit End Time'], POYAS) > a - 60 * MIN);
  {
    // Визит без смены: день, в который у клиента смен нет, 15:00–17:00, своя сиделка клиента.
    const kand = obychnyeKlienty.filter((kl) => sposob.get(kl.id) === 'mobile' && zapasKlienta(kl.id) >= 10
      && planKlienta.get(kl.id).length <= 5 && obrazec(kl.id));
    const variant = [];
    for (const kl of kand) {
      const dni = new Set(planKlienta.get(kl.id).map((sm) => sm.data));
      const sdId = planKlienta.get(kl.id)[0].sidelka_id;
      for (const data of Object.values(DATA_DNYA)) {
        if (dni.has(data)) continue;
        const a = vMestnom(data, 15); const b = vMestnom(data, 17);
        if (svobodnaV(sdId, a, b)) variant.push({ kl, sdId, data, a, b });
      }
    }
    if (!variant.length) throw new Error('генератор: некуда поставить визит без смены');
    const v = variant[Math.floor(R.rnd() * variant.length)];
    dobavitEdinic(v.kl.id, 7);
    const r = Object.assign({}, obrazec(v.kl.id), {
      'Visit ID': 'V-19002', 'Schedule ID': '', 'Caregiver Code': v.sdId, 'Visit Date': v.data,
      'Schedule Start Time': '', 'Schedule End Time': '',
      'Visit Start Time': stroka(v.a + 2 * MIN), 'Visit End Time': stroka(v.b + 1 * MIN),
      'EVV Start Time': stroka(v.a + 2 * MIN), 'EVV End Time': stroka(v.b + 1 * MIN), 'Units Billed': 7,
      'Visit Edit Reason Code': '', 'Visit Edit Action Taken': '', 'Is Deletion': 'N', 'Missed Visit': 'N',
      'Missed Visit Reason Code': '', Notes: 'DEMO',
    });
    dobavlennye.push(r);
    zapisat('V-19002', 'VNE_RASPISANIYA', `визит ${v.data} 15:00–17:00 у клиента ${v.kl.id}, в этот день смен в расписании нет`);
  }
  {
    const dvaDnya = (r) => planKlienta.get(r['Member ID']).length >= 2;
    const r = vybrat('не та смена', dvaDnya);
    const drugaya = planKlienta.get(r['Member ID']).find((sm) => sm.id !== r['Schedule ID'] && sm.data !== r['Visit Date']);
    isportit(r, 'VNE_RASPISANIYA', `Schedule ID заменён на смену того же клиента в другой день (${drugaya.id})`,
      (g) => { g['Schedule ID'] = drugaya.id; });
  }
  {
    const variant = vizity.filter((r) => obychnyy(r) && r['Missed Visit'] !== 'Y').flatMap((r) => aktivnye
      .filter((sd) => sd.id !== r['Caregiver Code'] && svobodnaV(sd.id, r._prihod, r._uhod)).map((sd) => ({ r, sd })));
    const { r, sd } = variant[Math.floor(R.rnd() * variant.length)];
    zanyaty.add(r['Visit ID']);
    isportit(r, 'NE_TA_SIDELKA', `Caregiver Code заменён на ${sd.id}, в расписании смена за ${r['Caregiver Code']}`,
      (g) => { g['Caregiver Code'] = sd.id; });
  }

  // ── 8. Файлы ──────────────────────────────────────────────────────────────
  const csvPole = (x) => { const s = x == null ? '' : String(x); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const vCsv = (stroki) => [KOLONKI_CSV.join(','), ...stroki
    .sort((a, b) => sravnitId(a['Visit ID'], b['Visit ID']))
    .map((r) => KOLONKI_CSV.map((kol) => csvPole(r[kol])).join(','))].join('\r\n') + '\r\n';
  const chistye = [...vizity.filter((r) => !posleAvt.includes(r)), udalennyy];
  const gryaznye = [...[...gryaz.values()].filter((r) => !posleAvt.some((p) => p['Visit ID'] === r['Visit ID'])), udalennyy, ...dobavlennye];
  ozhidaemye.sort((a, b) => sravnitId(a.vizit_id, b.vizit_id));
  const poPravilam = {};
  for (const o of ozhidaemye) poPravilam[o.pravilo] = (poPravilam[o.pravilo] || 0) + 1;
  const json = (x) => JSON.stringify(x, null, 2) + '\n';
  const fayly = {
    'sidelki.json': json(sidelki),
    'klienty.json': json(klienty),
    'smeny.json': json(smeny),
    'avtorizacii.json': json(avtorizacii),
    'evv-chistaya.csv': vCsv(chistye),
    'evv-s-oshibkami.csv': vCsv(gryaznye),
    'oshibki-ozhidaemye.json': json({
      demo: `DEMO — вымышленные данные, ${AGENTSTVO}`,
      shtat: 'NY',
      vygruzka: 'evv-s-oshibkami.csv',
      vsego: ozhidaemye.length,
      po_pravilam: poPravilam,
      normalnye_osobennosti: osobye.map(([vizit_id, chto]) => ({ vizit_id, chto })),
      oshibki: ozhidaemye,
    }),
  };

  // ── 9. Самопроверка ───────────────────────────────────────────────────────
  const smenyJson = JSON.parse(fayly['smeny.json']);
  const avtJson = JSON.parse(fayly['avtorizacii.json']);
  const naChistoy = evv.proverit(evv.vizityIzCsv(fayly['evv-chistaya.csv']), avtJson, smenyJson, 'NY');
  if (naChistoy.length) {
    throw new Error(`генератор: на чистой выгрузке ${naChistoy.length} срабатываний: ${naChistoy.slice(0, 5).map((i) => `${i.vizit_id} ${i.pravilo}`).join('; ')}`);
  }
  const naGryaznoy = evv.proverit(evv.vizityIzCsv(fayly['evv-s-oshibkami.csv']), avtJson, smenyJson, 'NY');
  const nashli = new Set(naGryaznoy.map((i) => `${i.vizit_id} ${i.pravilo}`));
  const nado = new Set(ozhidaemye.map((o) => `${o.vizit_id} ${o.pravilo}`));
  const netNaydeno = [...nado].filter((x) => !nashli.has(x));
  const lishnie = [...nashli].filter((x) => !nado.has(x));
  if (ozhidaemye.length !== 30 || netNaydeno.length || lishnie.length) {
    throw new Error(`генератор: ожидаемых ${ozhidaemye.length}; не найдены: ${netNaydeno.join('; ') || '—'}; лишние: ${lishnie.join('; ') || '—'}`);
  }
  // Показ замены: смена в среду 07.10 с 08:00 до 10:00, на которую есть не меньше трёх кандидатов.
  const kandidatyPokaza = smenyJson.filter((s) => s.start >= '2026-10-07T08' && s.start < '2026-10-07T10').map((s) => {
    const r = zamena.podobrat(Object.assign({}, s, { status: 'calloff' }), sidelki, smenyJson, { klienty });
    return { smena_id: s.id, kandidatov: r.length };
  }).filter((x) => x.kandidatov >= 3);
  if (!kandidatyPokaza.length) throw new Error('генератор: нет смены 07.10 утром с тремя кандидатами на замену');

  return {
    fayly,
    svodka: {
      sidelok: sidelki.length, aktivnyh: aktivnye.length, bez_sms: sidelki.filter((s) => !s.sms_soglasie).length,
      klientov: klienty.length, smen: smeny.length, vizitov_chistyh: chistye.length, vizitov_gryaznyh: gryaznye.length,
      oshibok: ozhidaemye.length, klient_vne_dat: klientVneDat, tesnye, pokaz_zameny: kandidatyPokaza[0],
    },
  };
}

module.exports = { sgenerirovat, SEED, KOLONKI_CSV };

if (require.main === module) {
  const { fayly, svodka } = sgenerirovat();
  const tolkoProverit = process.argv.includes('--proverit');
  let rashozhdeniy = 0;
  for (const [imya, soderzhimoe] of Object.entries(fayly)) {
    const put = path.join(__dirname, imya);
    if (tolkoProverit) {
      const naDiske = fs.existsSync(put) ? fs.readFileSync(put, 'utf8') : null;
      if (naDiske !== soderzhimoe) { rashozhdeniy++; console.log(`расходится: ${imya}`); }
    } else {
      fs.writeFileSync(put, soderzhimoe);
    }
  }
  console.log(JSON.stringify(svodka, null, 2));
  if (tolkoProverit) {
    console.log(rashozhdeniy ? `файлов расходится: ${rashozhdeniy}` : 'файлы совпадают с seed');
    process.exitCode = rashozhdeniy ? 1 : 0;
  }
}
