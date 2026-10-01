'use strict';
// №44 CareLine, модуль A4: проверка визитов EVV перед счётом. Движок без модели — правила штата.
//
// КОНТРАКТ: proverit(vizity, avtorizacii, smeny, shtat[, klienty]) → isklyucheniya[]
//   isklyuchenie: {vizit_id, pravilo, vazhnost, chto_ne_tak, kak_ispravit} + для пульта pravilo_tekst,
//   vizit {data, klient_id, klient_kod, sidelka_id, smena_id, kod_uslugi, stroka}, svyazannyy_vizit, detali.
//   vazhnost: 'kritichno' — исправить до счёта; 'preduprezhdenie' — проверить (риск аудита).
//   shtat: 'NY' | 'NC' | {kod:'NY', radius_m, okruglenie, yazyk:'ru', vazhnost:{...}} — поверх правил штата.
//   vizity: нормализованные визиты (форма ниже), строки CSV-объектами {'Visit ID': …} или текст CSV целиком.
//   avtorizacii: [{id, klient_id, kod_uslugi, s, po, edinic, period:'nedelya'|'mesyac'|'vsego', mesto:{lat,lon,telefony[]}}].
//     mesto — адрес обслуживания из авторизации; по нему проверяется место визита. Можно передать klienty
//     пятым аргументом ([{id, kod, lat, lon, telefon}]) — тогда адрес и код клиента берутся оттуда.
//   smeny: [{id, klient_id, sidelka_id, start, end}] — расписание; null — проверки расписания пропускаются.
//
// ПРАВИЛА. Шесть элементов EVV по 42 U.S.C. 1396b(l)(5)(A) (21st Century Cures Act §12006): вид услуги,
// получатель, дата, место, исполнитель, время начала и конца. Плюс: порядок отметок, ручная правка без
// причины, место против адреса клиента, единицы против времени EVV и против авторизации, код и даты
// авторизации, пересечения визитов одной сиделки, расписание. Источники и допущения —
// care/demo-dannye/ISTOCHNIKI.md.
//
// ОДНА ПРИЧИНА — ОДНО ИСКЛЮЧЕНИЕ. Правило, которому не хватает данных из-за уже найденной ошибки,
// молчит: визит без клиента не проверяется на авторизацию, без отметки ухода — на пересечения и единицы.
// Колонки, которой нет в выгрузке вовсе (undefined), движок не судит; пустое значение (null, '') — ошибка.
//
// ФОРМА ВИЗИТА: {vizit_id, stroka, klient_id, medicaid, sidelka_id, smena_id, kod_uslugi, data,
//   plan_start, plan_end, prihod:{vremya, evv, lat, lon, telefon, drugoe, tip}, uhod:{…}, edinic,
//   prichina_pravki, deystvie_pravki, ruchnaya_pravka, udalenie, propushchen}
//   vremya — время визита для счёта; evv — время, снятое электронно. vremya без evv — ручной ввод,
//   расхождение vremya и evv — правка. tip — 'Home' | 'Community'.

const vr = require('./vremya-dvizhkov');
const { haversineM } = require('./zip');

const PRAVILA = Object.freeze([
  'NET_USLUGI', 'NET_POLUCHATELYA', 'NET_DATY', 'NET_MESTA', 'NET_ISPOLNITELYA', 'NET_PRIHODA', 'NET_UHODA',
  'UHOD_RANSHE_PRIHODA', 'PRAVKA_BEZ_PRICHINY', 'MESTO_NE_SOVPADAET', 'EDINICY_BOLSHE_VREMENI',
  'PREVYSHENIE_AVTORIZACII', 'KOD_NE_AVTORIZOVAN', 'VNE_DAT_AVTORIZACII', 'PERESECHENIE', 'VNE_RASPISANIYA',
  'NE_TA_SIDELKA',
]);

const K = 'kritichno';
const P = 'preduprezhdenie';

// Общие настройки; штат и вызывающий могут переопределить.
const OBSHCHEE = Object.freeze({
  poyas: 'America/New_York',
  radius_m: 400,                  // ДОПУЩЕНИЕ: радиус от адреса клиента задаёт агентство, штаты числа не дают
  dopusk_peresecheniya_min: 0,    // пересечение строго больше нуля минут
  dopusk_raspisaniya_min: 120,    // визит «по расписанию», если попал в смену ± 2 ч (сдвиги времени — не ошибка)
  pervyy_den_nedeli: 1,           // ДОПУЩЕНИЕ: недельная авторизация считается с понедельника
  edinica_po_umolchaniyu: 15,     // минут в единице, если кода нет в справочнике штата
  yazyk: 'en',                    // тексты для координатора агентства в США; 'ru' — для нас
});

// Коды услуг — из официальных списков штатов (см. ISTOCHNIKI.md). edinica: минуты | 'vizit' | 'den'.
const KODY_NY = {
  'S5130:U1': ['PCS Level I, 15 minutes', 15], 'S5130:U2': ['PCS Level I, two clients', 15],
  'S5130:U3': ['PCS Level I, multiple clients', 15], 'S5130:TV': ['PCS Level I, weekend/holiday', 15],
  'T1019:U1': ['PCS Level II basic, 15 minutes', 15], 'T1019:U2': ['PCS Level II, two clients', 15],
  'T1019:U3': ['PCS Level II, multiple clients', 15], 'T1019:U4': ['PCS Level II, hard to serve', 15],
  'T1019:U5': ['PCS Level II, two clients hard to serve', 15], 'T1019:TV': ['PCS Level II, weekend/holiday', 15],
  'T1019:U6': ['CDPA basic, 15 minutes', 15], 'T1019:U7': ['CDPA, two consumers', 15],
  'T1019:U8': ['CDPA enhanced', 15], 'T1019:U9': ['CDPA, two consumers enhanced', 15],
  'T1020': ['PCS Level II live-in, per diem', 'den'], 'T1020:U2': ['PCS Level II live-in, two clients', 'den'],
  'T1020:TV': ['PCS Level II live-in, weekend/holiday', 'den'], 'T1020:U5': ['PCS Level II live-in, two clients hard to serve', 'den'],
  'T1020:U6': ['CDPA live-in', 'den'], 'T1020:U7': ['CDPA live-in, two consumers', 'den'],
  'T1020:U8': ['CDPA live-in enhanced', 'den'], 'T1020:U9': ['CDPA live-in, two consumers enhanced', 'den'],
  'S5125': ['Home health aide, 15 minutes', 15], 'S5125:U2': ['Home health aide, two clients, 15 minutes', 15],
  'S9122': ['Home health aide, per hour', 60], 'S9122:U1': ['Advanced home health aide, per hour', 60],
  'S5126': ['Home health aide live-in, per diem (13 hours)', 'den'], 'S5126:U2': ['Home health aide live-in, two clients', 'den'],
};
const KODY_NC = {
  // Единица 15 мин для 99509 — ДОПУЩЕНИЕ по правилу округления NC для PCS/CAP; сверить с политикой 3L.
  '99509:HA': ['State Plan PCS, beneficiary under 21', 15], '99509:HB': ['State Plan PCS, in-home care agency, 21+', 15],
  'S5125': ['CAP in-home aide / attendant care, 15 minutes', 15], 'S5125:UN': ['CAP attendant care, congregate, 15 minutes', 15],
  'S5150': ['In-home respite, 15 minutes', 15], 'T1004': ['PNA in-home respite, 15 minutes', 15],
  'T1019': ['PNA assistance, 15 minutes', 15], 'T2027': ['Personal care assistance, 15 minutes', 15],
  'T2027:TF': ['Personal care assistance, congregate', 15], 'S5135': ['Personal care assistance', 15],
  'S5135:UN': ['Personal care assistance, congregate, 15 minutes', 15],
  'S9122:TF': ['In-home respite, congregate, 15 minutes', 15], 'S9122:TG': ['PNA respite, congregate, 15 minutes', 15],
  'RC570': ['Home health aide visit (revenue code 0570)', 'vizit'],
  'RC550': ['Skilled nursing visit, assessment', 'vizit'], 'RC551': ['Skilled nursing visit, treatment', 'vizit'],
  'RC420': ['Physical therapy visit', 'vizit'], 'RC430': ['Occupational therapy visit', 'vizit'],
  'RC440': ['Speech therapy visit', 'vizit'],
};
const vSpravochnik = (t) => Object.fromEntries(Object.entries(t).map(([k, [nazvanie, edinica]]) => [k, { nazvanie, edinica }]));

const SHTATY = Object.freeze({
  NY: Object.freeze({
    kod: 'NY',
    nazvanie: 'New York',
    agregator: 'NYS EVV Data Aggregator (eMedNY)',
    // ДОПУЩЕНИЕ: для сверки «единицы против времени» — только целые 15-минутные единицы. NYSDOH требует в EVV
    // точное время и не задаёт округление; правила округления у планов (MLTC) свои — к консультанту по биллингу.
    okruglenie: 'vniz',
    mesto_tip_dostatochno: true,   // FAQ NYSDOH: GPS не обязателен, место можно указать как Home/Community
    mesto_dlya_ruchnyh: true,      // место начала и конца нужно и для исправленных вручную визитов
    vazhnost: Object.freeze({ MESTO_NE_SOVPADAET: P, VNE_RASPISANIYA: P, NE_TA_SIDELKA: P }),
    kody: Object.freeze(vSpravochnik(KODY_NY)),
  }),
  NC: Object.freeze({
    kod: 'NC',
    nazvanie: 'North Carolina',
    agregator: 'Sandata (NC Medicaid aggregator); HHAeXchange / CareBridge for health plans',
    okruglenie: '8min',            // NC Medicaid EVV: 8–22 мин = 1 единица, 23–37 = 2 …
    mesto_tip_dostatochno: false,  // FAQ NC: при стороннем поставщике EVV нужна отметка GPS
    mesto_dlya_ruchnyh: false,     // ручной визит в Visit Maintenance без GPS допустим (с причиной)
    vazhnost: Object.freeze({ MESTO_NE_SOVPADAET: P, PRAVKA_BEZ_PRICHINY: P, NE_TA_SIDELKA: P }),
    kody: Object.freeze(vSpravochnik(KODY_NC)),
  }),
});

function konfigShtata(shtat) {
  if (!shtat) throw new Error('proverit: укажите штат — NY или NC');
  const kod = String(typeof shtat === 'string' ? shtat : shtat.kod || '').trim().toUpperCase();
  const baza = SHTATY[kod];
  if (!baza) throw new Error(`proverit: нет правил для штата ${kod || '—'}; есть: ${Object.keys(SHTATY).join(', ')}`);
  const nad = typeof shtat === 'object' ? shtat : {};
  const c = Object.assign({}, OBSHCHEE, baza, nad);
  c.kod = baza.kod;
  c.vazhnost = Object.assign({}, baza.vazhnost, nad.vazhnost || {});
  c.kody = Object.assign({}, baza.kody, nad.kody || {});
  c.poyas = nad.poyas || nad.chasovoy_poyas || baza.poyas || OBSHCHEE.poyas;
  c.yazyk = TEKSTY[c.yazyk] ? c.yazyk : 'en';
  return c;
}

// ── коды услуг ──────────────────────────────────────────────────────────────
// 'T1019 U1', 't1019:u1', 'T1019-U1', 'T1019U1' → 'T1019:U1'; 'S5125' → 'S5125'.
function kanonKod(kod, modifikator) {
  const s = String(kod == null ? '' : kod).trim().toUpperCase();
  if (!s) return '';
  let chasti = s.split(/[\s:,\-/]+/).filter(Boolean);
  if (chasti.length === 1 && /^[A-Z0-9]\d{4}([A-Z0-9]{2})+$/.test(chasti[0])) {
    chasti = [chasti[0].slice(0, 5), ...chasti[0].slice(5).match(/.{2}/g)];
  }
  const mod = String(modifikator == null ? '' : modifikator).trim().toUpperCase().split(/[\s:,\-/]+/).filter(Boolean);
  for (const m of mod) if (!chasti.includes(m)) chasti.push(m);
  return chasti.join(':');
}
const bazaKoda = (kod) => String(kod || '').split(':')[0];

// Авторизация на 'T1019' без модификатора покрывает T1019 с любым; на 'T1019:U1' — только T1019:U1.
function kodPokryvaet(avtKod, vizitKod) {
  if (!avtKod || !vizitKod) return false;
  if (avtKod === vizitKod) return true;
  return !avtKod.includes(':') && bazaKoda(vizitKod) === avtKod;
}

function edinicaKoda(c, kod) {
  const tochno = c.kody[kod];
  if (tochno) return tochno.edinica;
  const baza = bazaKoda(kod);
  if (c.kody[baza]) return c.kody[baza].edinica;
  const pohozhiy = Object.keys(c.kody).find((k) => bazaKoda(k) === baza);
  return pohozhiy ? c.kody[pohozhiy].edinica : c.edinica_po_umolchaniyu;
}

function edinicIzMinut(minut, edinica, okruglenie) {
  if (!(minut > 0) || !(edinica > 0)) return 0;
  if (okruglenie === '8min') return Math.floor((minut + Math.ceil(edinica / 2) - 1) / edinica + 1e-9);
  if (okruglenie === 'vverh') return Math.ceil(minut / edinica - 1e-9);
  return Math.floor(minut / edinica + 1e-9);
}

// ── разбор выгрузки ─────────────────────────────────────────────────────────
function razobratCsv(tekst) {
  let s = String(tekst == null ? '' : tekst);
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  const pervaya = s.slice(0, Math.max(0, s.indexOf('\n')) || s.length);
  const schet = (ch) => pervaya.split(ch).length - 1;
  const razd = [',', ';', '\t'].sort((a, b) => schet(b) - schet(a))[0];
  const stroki = [];
  let pole = '';
  let stroka = [];
  let vKavychkah = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (vKavychkah) {
      if (ch === '"') {
        if (s[i + 1] === '"') { pole += '"'; i++; } else vKavychkah = false;
      } else pole += ch;
      continue;
    }
    if (ch === '"') vKavychkah = true;
    else if (ch === razd) { stroka.push(pole); pole = ''; }
    else if (ch === '\n') { stroka.push(pole); stroki.push(stroka); stroka = []; pole = ''; }
    else if (ch !== '\r') pole += ch;
  }
  if (pole !== '' || stroka.length) { stroka.push(pole); stroki.push(stroka); }
  return stroki.filter((r) => r.some((x) => String(x).trim() !== ''));
}

// Колонки: имена из макета импорта визитов HHAeXchange (Homecare V5) и частые синонимы других выгрузок.
const KOLONKI = {
  vizit_id: ['Visit ID', 'EVV Visit ID', 'Visit Number', 'Visit Key'],
  klient_id: ['Member ID', 'Patient ID', 'Admission ID', 'Client ID', 'Recipient ID'],
  medicaid: ['Medicaid Number', 'Medicaid ID', 'Medicaid #', 'CIN'],
  sidelka_id: ['Caregiver Code', 'Caregiver ID', 'Aide Code', 'Employee ID', 'Worker ID'],
  smena_id: ['Schedule ID'],
  kod_uslugi: ['Procedure Code', 'Service Code', 'HCPCS', 'Billing Code'],
  modifikator: ['Modifier', 'Modifier 1', 'Procedure Modifier'],
  data: ['Visit Date', 'Date of Service', 'Service Date', 'DOS'],
  plan_start: ['Schedule Start Time', 'Scheduled Start Time', 'Schedule Start'],
  plan_end: ['Schedule End Time', 'Scheduled End Time', 'Schedule End'],
  prihod_vremya: ['Visit Start Time', 'Actual Start Time', 'Visit Start'],
  uhod_vremya: ['Visit End Time', 'Actual End Time', 'Visit End'],
  prihod_evv: ['EVV Start Time', 'Call In Time', 'Clock In Time', 'Clock-In Time'],
  uhod_evv: ['EVV End Time', 'Call Out Time', 'Clock Out Time', 'Clock-Out Time'],
  prihod_lat: ['Clock-In Latitude', 'Call In Latitude', 'Call In GPS Latitude'],
  prihod_lon: ['Clock-In Longitude', 'Call In Longitude', 'Call In GPS Longitude'],
  prihod_telefon: ['Clock-In Phone Number', 'Call In Phone', 'Call In Phone Number'],
  prihod_drugoe: ['Clock-In EVV Other Info', 'Call In FOB', 'Clock-In FOB'],
  prihod_tip: ['Clock-In Service Location Type', 'Start Location', 'Call In Location Type'],
  uhod_lat: ['Clock-Out Latitude', 'Call Out Latitude', 'Call Out GPS Latitude'],
  uhod_lon: ['Clock-Out Longitude', 'Call Out Longitude', 'Call Out GPS Longitude'],
  uhod_telefon: ['Clock-Out Phone Number', 'Call Out Phone', 'Call Out Phone Number'],
  uhod_drugoe: ['Clock-Out EVV Other Info', 'Call Out FOB', 'Clock-Out FOB'],
  uhod_tip: ['Clock-Out Service Location Type', 'End Location', 'Call Out Location Type'],
  edinic: ['Units Billed', 'Billed Units', 'Units'],
  prichina_pravki: ['Visit Edit Reason Code', 'Edit Reason Code', 'Reason Code', 'Edit Reason'],
  deystvie_pravki: ['Visit Edit Action Taken', 'Action Taken Code', 'Action Taken'],
  ruchnaya_pravka: ['Manual Edit', 'Manually Edited', 'Is Manual'],
  udalenie: ['Is Deletion', 'Deleted'],
  propushchen: ['Missed Visit'],
  prichina_propuska: ['Missed Visit Reason Code'],
};
const normKol = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9#]/g, '');
const SINONIMY = new Map();
for (const [pole, imena] of Object.entries(KOLONKI)) for (const imya of imena) SINONIMY.set(normKol(imya), pole);

function kartaKolonok(zagolovki) {
  const karta = {};
  zagolovki.forEach((z, i) => {
    const pole = SINONIMY.get(normKol(z));
    if (pole && karta[pole] === undefined) karta[pole] = i;
  });
  return karta;
}

const pusto = (x) => x == null || String(x).trim() === '';
const tekst = (x) => (pusto(x) ? null : String(x).trim());
const da = (x) => /^(y|yes|true|1|да)$/i.test(String(x == null ? '' : x).trim());
function chisloIliNull(x) {
  if (pusto(x)) return null;
  const n = Number(String(x).trim());
  return Number.isFinite(n) ? n : null;
}
function telefonE164(x) {
  const d = String(x == null ? '' : x).replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return '+' + d;
}

// Одна строка выгрузки → визит. poluchit(pole) → значение или undefined, если такой колонки нет.
function vizitIzPoley(poluchit, nomer, poyas) {
  const est = (pole) => poluchit(pole) !== undefined;
  const iso = (x) => { const t = vr.vMs(x, poyas); return Number.isFinite(t) ? vr.vIso(t, poyas) : null; };
  const znach = (pole, f) => (est(pole) ? f(poluchit(pole)) : undefined);
  const otmetka = (pr) => {
    const vremyaSyroe = tekst(poluchit(`${pr}_vremya`));
    const evvSyroe = tekst(poluchit(`${pr}_evv`));
    const t = {
      vremya: iso(vremyaSyroe) || iso(evvSyroe),
      evv: est(`${pr}_evv`) ? iso(evvSyroe) : undefined,
      lat: znach(`${pr}_lat`, chisloIliNull),
      lon: znach(`${pr}_lon`, chisloIliNull),
      telefon: znach(`${pr}_telefon`, telefonE164),
      drugoe: znach(`${pr}_drugoe`, tekst),
      tip: znach(`${pr}_tip`, tekst),
    };
    if (!est(`${pr}_evv`)) t.evv = undefined;         // в выгрузке нет электронного времени — не отличить ручное
    if (!est(`${pr}_vremya`) && !est(`${pr}_evv`)) t.vremya = undefined;
    const syroe = vremyaSyroe || evvSyroe;
    if (syroe && !t.vremya) t.syroe = syroe;          // значение есть, но не читается
    return t;
  };
  const dataSyraya = est('data') ? tekst(poluchit('data')) : undefined;
  const v = {
    vizit_id: tekst(poluchit('vizit_id')) || `stroka-${nomer}`,
    stroka: nomer,
    klient_id: znach('klient_id', tekst),
    medicaid: znach('medicaid', tekst),
    sidelka_id: znach('sidelka_id', tekst),
    smena_id: znach('smena_id', tekst),
    kod_uslugi: est('kod_uslugi') ? kanonKod(poluchit('kod_uslugi'), poluchit('modifikator')) : undefined,
    data: dataSyraya === undefined ? undefined : (vr.razobratDatu(dataSyraya) || ''),
    plan_start: znach('plan_start', iso),
    plan_end: znach('plan_end', iso),
    prihod: otmetka('prihod'),
    uhod: otmetka('uhod'),
    edinic: znach('edinic', chisloIliNull),
    prichina_pravki: znach('prichina_pravki', tekst),
    deystvie_pravki: znach('deystvie_pravki', tekst),
    ruchnaya_pravka: est('ruchnaya_pravka') ? da(poluchit('ruchnaya_pravka')) : undefined,
    udalenie: da(poluchit('udalenie')),
    propushchen: da(poluchit('propushchen')),
    prichina_propuska: znach('prichina_propuska', tekst),
  };
  if (dataSyraya && !v.data) v.data_syraya = dataSyraya;
  return v;
}

// Текст выгрузки → {vizity, kolonki {najdeny, net}, strok}.
function razobratVygruzku(tekstCsv, opcii) {
  const poyas = (opcii && (opcii.poyas || (opcii.shtat && konfigShtata(opcii.shtat).poyas))) || OBSHCHEE.poyas;
  const stroki = razobratCsv(tekstCsv);
  if (!stroki.length) return { vizity: [], kolonki: { najdeny: {}, net: Object.keys(KOLONKI) }, strok: 0 };
  const zag = stroki[0];
  const karta = kartaKolonok(zag);
  const vizity = stroki.slice(1).map((r, i) => vizitIzPoley((pole) => (karta[pole] === undefined ? undefined : (r[karta[pole]] ?? '')), i + 2, poyas));
  const najdeny = {};
  for (const [pole, i] of Object.entries(karta)) najdeny[pole] = zag[i];
  return { vizity, kolonki: { najdeny, net: Object.keys(KOLONKI).filter((p) => karta[p] === undefined) }, strok: vizity.length };
}

function vizityIzCsv(tekstCsv, opcii) {
  return razobratVygruzku(tekstCsv, opcii).vizity;
}

// Строка-объект с заголовками CSV в ключах ({'Visit ID': …}) → визит.
function vizitIzZapisi(obj, nomer, poyas) {
  const karta = kartaKolonok(Object.keys(obj));
  const klyuchi = Object.keys(obj);
  return vizitIzPoley((pole) => (karta[pole] === undefined ? undefined : obj[klyuchi[karta[pole]]]), nomer, poyas);
}

function normalizovat(vizity, c) {
  if (typeof vizity === 'string') return razobratVygruzku(vizity, { poyas: c.poyas }).vizity;
  return (Array.isArray(vizity) ? vizity : []).map((v, i) => {
    if (!v || typeof v !== 'object') return null;
    if (v.prihod || v.uhod || Object.prototype.hasOwnProperty.call(v, 'vizit_id')) return v;
    return vizitIzZapisi(v, i + 1, c.poyas);
  }).filter(Boolean);
}

// ── тексты ──────────────────────────────────────────────────────────────────
const dva = (n) => String(n).padStart(2, '0');
const MES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatery(yazyk, poyas) {
  const ru = yazyk === 'ru';
  const chasy = (ms) => {
    if (!Number.isFinite(ms)) return '—';
    const c = vr.chasti(ms, poyas);
    if (ru) return `${dva(c.h)}:${dva(c.mi)}`;
    return `${c.h % 12 || 12}:${dva(c.mi)} ${c.h < 12 ? 'AM' : 'PM'}`;
  };
  const data = (d) => {
    if (!d) return '—';
    const [y, m, dd] = String(d).split('-').map(Number);
    return ru ? `${dva(dd)}.${dva(m)}.${y}` : `${MES[m - 1]} ${dd}, ${y}`;
  };
  const vremya = (ms) => {
    if (!Number.isFinite(ms)) return '—';
    const c = vr.chasti(ms, poyas);
    return ru ? `${dva(c.d)}.${dva(c.m)} ${chasy(ms)}` : `${MES[c.m - 1]} ${c.d}, ${chasy(ms)}`;
  };
  const dlit = (min) => {
    const m = Math.round(min);
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (ru) return h ? `${h} ч ${r} мин` : `${r} мин`;
    return h ? `${h} h ${r} min` : `${r} min`;
  };
  return { chasy, data, vremya, dlit };
}

const NAZVANIYA = {
  en: {
    NET_USLUGI: 'Missing service type', NET_POLUCHATELYA: 'Missing member', NET_DATY: 'Missing date of service',
    NET_MESTA: 'Missing location', NET_ISPOLNITELYA: 'Missing caregiver', NET_PRIHODA: 'No clock-in',
    NET_UHODA: 'No clock-out', UHOD_RANSHE_PRIHODA: 'Clock-out before clock-in',
    PRAVKA_BEZ_PRICHINY: 'Manual edit without reason', MESTO_NE_SOVPADAET: 'Location does not match',
    EDINICY_BOLSHE_VREMENI: 'Billed units exceed EVV time', PREVYSHENIE_AVTORIZACII: 'Over authorized units',
    KOD_NE_AVTORIZOVAN: 'Service not authorized', VNE_DAT_AVTORIZACII: 'Outside authorization dates',
    PERESECHENIE: 'Overlapping visits', VNE_RASPISANIYA: 'Visit not on the schedule',
    NE_TA_SIDELKA: 'Different caregiver than scheduled',
  },
  ru: {
    NET_USLUGI: 'Нет вида услуги', NET_POLUCHATELYA: 'Нет получателя', NET_DATY: 'Нет даты визита',
    NET_MESTA: 'Нет места', NET_ISPOLNITELYA: 'Нет исполнителя', NET_PRIHODA: 'Нет отметки прихода',
    NET_UHODA: 'Нет отметки ухода', UHOD_RANSHE_PRIHODA: 'Уход раньше прихода',
    PRAVKA_BEZ_PRICHINY: 'Ручная правка без причины', MESTO_NE_SOVPADAET: 'Место не совпадает с адресом',
    EDINICY_BOLSHE_VREMENI: 'Единиц больше, чем времени', PREVYSHENIE_AVTORIZACII: 'Сверх авторизации',
    KOD_NE_AVTORIZOVAN: 'Услуга не авторизована', VNE_DAT_AVTORIZACII: 'Вне дат авторизации',
    PERESECHENIE: 'Пересечение визитов', VNE_RASPISANIYA: 'Визит вне расписания',
    NE_TA_SIDELKA: 'Не та сиделка',
  },
};

const PUNKT = { en: { prihod: 'clock-in', uhod: 'clock-out' }, ru: { prihod: 'приход', uhod: 'уход' } };
const zaglavnaya = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const OKRUGLENIE = {
  en: { vniz: 'whole 15-minute units only', '8min': 'NC rounding: 8 minutes or more counts as a unit', vverh: 'rounded up', vizit: '1 visit = 1 unit' },
  ru: { vniz: 'только целые 15-минутные единицы', '8min': 'округление NC: от 8 минут — единица', vverh: 'с округлением вверх', vizit: '1 визит = 1 единица' },
};

const TEKSTY = {
  en: {
    NET_USLUGI: () => ({
      chto: 'The visit has no service (procedure) code, so the type of service, one of the six required EVV data elements, is missing.',
      kak: "Add the procedure code from the member's authorization to the visit in the EVV system before billing.",
    }),
    NET_POLUCHATELYA: () => ({
      chto: 'The visit has no member ID or Medicaid number, so the person who received the service is not identified.',
      kak: 'Link the visit to the member in the EVV system (Member ID or Medicaid number).',
    }),
    NET_DATY: (x, c, f) => ({
      chto: x.syroe ? `The date of service "${x.syroe}" cannot be read.` : 'The date of service is empty.',
      kak: `Enter the date of service on the visit; it must match the clock-in date${x.izVremeni ? ` (${f.data(x.izVremeni)})` : ''}.`,
    }),
    NET_MESTA: (x, c) => ({
      chto: `No location was captured at ${x.punkty.join(' and ')}: no GPS, no phone, no FOB${c.mesto_tip_dostatochno ? ', and no Home/Community location type' : ''}.`,
      kak: c.kod === 'NC'
        ? "Capture visits with the mobile app (GPS), the member's registered phone or a FOB. NC Medicaid reviews visit locations in post-payment audits."
        : "Record where the service started and ended (GPS, the member's phone, a FOB, or location type Home/Community) and keep the evidence for an audit.",
    }),
    NET_ISPOLNITELYA: () => ({
      chto: 'The visit has no caregiver code, so the person who provided the service is not identified.',
      kak: 'Assign the caregiver who actually worked the visit.',
    }),
    NET_PRIHODA: (x, c, f) => ({
      chto: (x.syroe ? `The clock-in time "${x.syroe}" cannot be read.` : 'The visit has no clock-in (start time).')
        + (Number.isFinite(x.plan) ? ` Scheduled start: ${f.vremya(x.plan)}.` : ''),
      kak: 'Confirm the real start time with the caregiver and the member, then enter it as a visit edit with a reason code and supervisor approval.',
    }),
    NET_UHODA: (x, c, f) => ({
      chto: (x.syroe ? `The clock-out time "${x.syroe}" cannot be read.` : 'The visit has no clock-out (end time).')
        + (Number.isFinite(x.plan) ? ` Scheduled end: ${f.vremya(x.plan)}.` : ''),
      kak: 'Confirm the real end time with the caregiver and the member, then enter it as a visit edit with a reason code and supervisor approval.',
    }),
    UHOD_RANSHE_PRIHODA: (x, c, f) => ({
      chto: `Clock-out ${f.vremya(x.e)} is not after clock-in ${f.vremya(x.s)}.`,
      kak: 'Check for an AM/PM or date mistake and correct the times with a reason code.',
    }),
    PRAVKA_BEZ_PRICHINY: (x, c, f) => ({
      chto: `The visit was changed by hand without a reason code: ${x.pravki.map((p) => (p.tip === 'izmeneno'
        ? `${PUNKT.en[p.punkt]} changed from ${f.chasy(p.bylo)} to ${f.chasy(p.stalo)}`
        : p.tip === 'vruchnuyu' ? `${PUNKT.en[p.punkt]} entered manually (${f.chasy(p.stalo)})` : 'marked as a manual edit')).join('; ')}.`,
      kak: c.kod === 'NC'
        ? 'Add the reason code in Visit Maintenance. In NC manual edits do not deny the claim, but NC Medicaid expects them on 15% of visits or fewer.'
        : 'Add the reason code and supervisor approval. NYSDOH requires keeping both the original and the edited times with the documented reason for audit.',
    }),
    MESTO_NE_SOVPADAET: (x, c) => ({
      chto: zaglavnaya(x.problemy.map((p) => (p.tip === 'gps'
        ? `${PUNKT.en[p.punkt]} was recorded ${p.m} m from the member's address (limit ${c.radius_m} m)`
        : `${PUNKT.en[p.punkt]} was called in from ${p.telefon}, which is not a phone registered to the member`)).join('; ')) + '.',
      kak: "Confirm with the caregiver where the service took place. If it was in the community, set the location type to Community; if the member moved, update the address; otherwise correct the visit before billing.",
    }),
    EDINICY_BOLSHE_VREMENI: (x, c, f) => ({
      chto: `${x.edinic} units billed, but the EVV times (${f.dlit(x.minut)}) support ${x.dopustimo} (${OKRUGLENIE.en[x.okruglenie]}).`,
      kak: `Bill ${x.dopustimo} units, or correct the visit times with a reason code if the caregiver really worked longer.`
        + (c.kod === 'NC' ? ' NCTracks edit 02079 cuts the submitted units back to the verified units.' : ''),
    }),
    PREVYSHENIE_AVTORIZACII: (x) => ({
      chto: `Authorization ${x.avt} allows ${x.limit} units per ${x.period === 'mesyac' ? 'month' : x.period === 'vsego' ? 'authorization period' : 'week'}; with this visit the total is ${x.itogo} (${x.itogo - x.limit} over).`,
      kak: 'Bill only the authorized units, or ask the plan to increase the authorization before billing the extra time.',
    }),
    KOD_NE_AVTORIZOVAN: (x, c) => ({
      chto: x.est.length
        ? `Service code ${x.kod} is not in the member's authorizations (authorized: ${x.est.join(', ')}).`
        : `The member has no authorization on file, so service ${x.kod} is not authorized.`,
      kak: `Bill under the authorized service code, or get an authorization for ${x.kod} from the plan.`
        + (c.kod === 'NC' ? ' NC Medicaid denies claims when the codes on the claim, the EVV visit and the authorization do not match.' : ''),
    }),
    VNE_DAT_AVTORIZACII: (x, c, f) => ({
      chto: `The visit on ${f.data(x.data)} is outside the authorization dates (${x.periody.map((p) => `${p.id}: ${f.data(p.s)} – ${f.data(p.po)}`).join('; ')}).`,
      kak: 'Get the authorization extended or renewed to cover this date, or do not bill the visit. Update the schedule so no more visits are booked outside it.',
    }),
    PERESECHENIE: (x, c, f) => ({
      chto: `This visit overlaps visit ${x.svyaz} of the same caregiver by ${f.dlit(x.minut)} (${f.chasy(x.ot)}–${f.chasy(x.do)}).`,
      kak: 'A caregiver cannot be in two places at once: check clock-in and clock-out of both visits and correct the wrong one with a reason code.',
    }),
    VNE_RASPISANIYA: (x, c, f) => ({
      chto: x.tip === 'ne_ta_smena'
        ? `The visit is linked to shift ${x.smena_id} (${f.vremya(x.plan)}), but it took place ${f.vremya(x.fakt)}.`
        : `There is no scheduled shift for this member at this time (${f.vremya(x.fakt)}).`,
      kak: 'Link the visit to the right shift, or add the shift to the schedule and confirm the visit was authorized.'
        + (c.kod === 'NC' ? ' NC Medicaid business rules require EVV visits to be scheduled.' : ''),
    }),
    NE_TA_SIDELKA: (x) => ({
      chto: `Shift ${x.smena_id} was scheduled for caregiver ${x.po_raspisaniyu}, but the visit was recorded by ${x.fakt}.`,
      kak: 'If this was a replacement, update the schedule; if not, find out who actually worked the visit before billing.',
    }),
  },
  ru: {
    NET_USLUGI: () => ({
      chto: 'У визита нет кода услуги — не хватает одного из шести обязательных элементов EVV (вид услуги).',
      kak: 'Впишите в визит код услуги из авторизации клиента до выставления счёта.',
    }),
    NET_POLUCHATELYA: () => ({
      chto: 'У визита нет ID клиента и номера Medicaid — получатель услуги не определён.',
      kak: 'Привяжите визит к клиенту в системе EVV (Member ID или номер Medicaid).',
    }),
    NET_DATY: (x, c, f) => ({
      chto: x.syroe ? `Дата визита «${x.syroe}» не читается.` : 'Дата визита пустая.',
      kak: `Впишите дату визита; она должна совпадать с датой прихода${x.izVremeni ? ` (${f.data(x.izVremeni)})` : ''}.`,
    }),
    NET_MESTA: (x, c) => ({
      chto: `Не снято место (${x.punkty.map((p) => PUNKT.ru[p] || p).join(' и ')}): нет GPS, телефона и FOB${c.mesto_tip_dostatochno ? ', нет и типа места Home/Community' : ''}.`,
      kak: c.kod === 'NC'
        ? 'Отмечайте визиты через приложение (GPS), зарегистрированный телефон клиента или FOB. NC Medicaid проверяет место визитов при аудите после оплаты.'
        : 'Зафиксируйте, где начался и закончился визит (GPS, телефон клиента, FOB или тип места Home/Community), и сохраните подтверждение для аудита.',
    }),
    NET_ISPOLNITELYA: () => ({
      chto: 'У визита нет кода сиделки — исполнитель не определён.',
      kak: 'Укажите сиделку, которая фактически отработала визит.',
    }),
    NET_PRIHODA: (x, c, f) => ({
      chto: (x.syroe ? `Время прихода «${x.syroe}» не читается.` : 'У визита нет отметки прихода (времени начала).')
        + (Number.isFinite(x.plan) ? ` По расписанию начало ${f.vremya(x.plan)}.` : ''),
      kak: 'Уточните реальное время начала у сиделки и клиента и внесите его правкой с кодом причины и подтверждением руководителя.',
    }),
    NET_UHODA: (x, c, f) => ({
      chto: (x.syroe ? `Время ухода «${x.syroe}» не читается.` : 'У визита нет отметки ухода (времени окончания).')
        + (Number.isFinite(x.plan) ? ` По расписанию конец ${f.vremya(x.plan)}.` : ''),
      kak: 'Уточните реальное время окончания у сиделки и клиента и внесите его правкой с кодом причины и подтверждением руководителя.',
    }),
    UHOD_RANSHE_PRIHODA: (x, c, f) => ({
      chto: `Уход ${f.vremya(x.e)} не позже прихода ${f.vremya(x.s)}.`,
      kak: 'Проверьте ошибку AM/PM или даты и исправьте время с кодом причины.',
    }),
    PRAVKA_BEZ_PRICHINY: (x, c, f) => ({
      chto: `Визит правили вручную без кода причины: ${x.pravki.map((p) => (p.tip === 'izmeneno'
        ? `${PUNKT.ru[p.punkt]} изменён с ${f.chasy(p.bylo)} на ${f.chasy(p.stalo)}`
        : p.tip === 'vruchnuyu' ? `${PUNKT.ru[p.punkt]} внесён вручную (${f.chasy(p.stalo)})` : 'стоит отметка ручной правки')).join('; ')}.`,
      kak: c.kod === 'NC'
        ? 'Добавьте код причины в Visit Maintenance. В NC ручная правка счёт не отклоняет, но доля ручных визитов должна быть не больше 15%.'
        : 'Добавьте код причины и подтверждение руководителя. NYSDOH требует хранить исходное и исправленное время вместе с причиной для аудита.',
    }),
    MESTO_NE_SOVPADAET: (x, c) => ({
      chto: zaglavnaya(x.problemy.map((p) => (p.tip === 'gps'
        ? `${PUNKT.ru[p.punkt]} отмечен в ${p.m} м от адреса клиента (предел ${c.radius_m} м)`
        : `${PUNKT.ru[p.punkt]} отмечен звонком с ${p.telefon} — это не телефон клиента`)).join('; ')) + '.',
      kak: 'Уточните у сиделки, где оказывалась услуга. Если вне дома — поставьте тип места Community; если клиент переехал — обновите адрес; иначе исправьте визит до счёта.',
    }),
    EDINICY_BOLSHE_VREMENI: (x, c, f) => ({
      chto: `К оплате ${x.edinic} ед., а время EVV (${f.dlit(x.minut)}) даёт ${x.dopustimo} (${OKRUGLENIE.ru[x.okruglenie]}).`,
      kak: `Выставьте ${x.dopustimo} ед. или, если сиделка работала дольше, исправьте время с кодом причины.`
        + (c.kod === 'NC' ? ' Правка NCTracks 02079 срежет единицы до подтверждённых.' : ''),
    }),
    PREVYSHENIE_AVTORIZACII: (x) => ({
      chto: `Авторизация ${x.avt} разрешает ${x.limit} ед. за ${x.period === 'mesyac' ? 'месяц' : x.period === 'vsego' ? 'весь срок' : 'неделю'}; с этим визитом ${x.itogo} (сверх на ${x.itogo - x.limit}).`,
      kak: 'Выставьте только авторизованные единицы или попросите план увеличить авторизацию до счёта.',
    }),
    KOD_NE_AVTORIZOVAN: (x, c) => ({
      chto: x.est.length
        ? `Кода услуги ${x.kod} нет в авторизациях клиента (есть: ${x.est.join(', ')}).`
        : `У клиента нет авторизации — услуга ${x.kod} не авторизована.`,
      kak: `Выставьте счёт по авторизованному коду или получите авторизацию на ${x.kod}.`
        + (c.kod === 'NC' ? ' NC Medicaid отклоняет счёт, если коды в счёте, визите EVV и авторизации не совпадают.' : ''),
    }),
    VNE_DAT_AVTORIZACII: (x, c, f) => ({
      chto: `Визит ${f.data(x.data)} вне дат авторизации (${x.periody.map((p) => `${p.id}: ${f.data(p.s)} – ${f.data(p.po)}`).join('; ')}).`,
      kak: 'Продлите авторизацию на эту дату или не выставляйте визит. Поправьте расписание, чтобы визиты не ставились вне авторизации.',
    }),
    PERESECHENIE: (x, c, f) => ({
      chto: `Визит пересекается с визитом ${x.svyaz} той же сиделки на ${f.dlit(x.minut)} (${f.chasy(x.ot)}–${f.chasy(x.do)}).`,
      kak: 'Сиделка не может быть в двух местах: проверьте приход и уход обоих визитов и исправьте ошибочный с кодом причины.',
    }),
    VNE_RASPISANIYA: (x, c, f) => ({
      chto: x.tip === 'ne_ta_smena'
        ? `Визит привязан к смене ${x.smena_id} (${f.vremya(x.plan)}), а прошёл ${f.vremya(x.fakt)}.`
        : `У клиента нет смены в расписании на это время (${f.vremya(x.fakt)}).`,
      kak: 'Привяжите визит к нужной смене или внесите смену в расписание и проверьте авторизацию.'
        + (c.kod === 'NC' ? ' Правила NC Medicaid требуют, чтобы визиты EVV были в расписании.' : ''),
    }),
    NE_TA_SIDELKA: (x) => ({
      chto: `Смена ${x.smena_id} стояла за сиделкой ${x.po_raspisaniyu}, а визит отметила ${x.fakt}.`,
      kak: 'Если это замена — обновите расписание; если нет — выясните, кто фактически работал, до счёта.',
    }),
  },
};

// ── проверка ────────────────────────────────────────────────────────────────
const gpsEst = (t) => !!t && Number.isFinite(t.lat) && Number.isFinite(t.lon) && !(t.lat === 0 && t.lon === 0)
  && Math.abs(t.lat) <= 90 && Math.abs(t.lon) <= 180;
const kolonokMestaNet = (t) => !t || (t.lat === undefined && t.lon === undefined && t.telefon === undefined
  && t.drugoe === undefined && t.tip === undefined);
const sravnitId = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

function normAvtorizacii(avtorizacii) {
  return (Array.isArray(avtorizacii) ? avtorizacii : []).filter(Boolean).map((a) => ({
    id: a.id || `${a.klient_id}:${a.kod_uslugi}`,
    klient_id: a.klient_id,
    kod: kanonKod(a.kod_uslugi),
    s: vr.razobratDatu(a.s),
    po: vr.razobratDatu(a.po),
    edinic: chisloIliNull(a.edinic),
    period: ['nedelya', 'mesyac', 'vsego'].includes(a.period) ? a.period : 'nedelya',
    mesto: a.mesto || null,
  }));
}

function proveritPodrobno(vizityVhod, avtorizacii, smeny, shtat, klienty) {
  const c = konfigShtata(shtat);
  const poyas = c.poyas;
  const yaz = c.yazyk;
  const f = formatery(yaz, poyas);
  const vizity = normalizovat(vizityVhod, c);
  const zamechaniya = [];

  const klientyPoId = new Map();
  const klientPoMedicaid = new Map();
  for (const k of Array.isArray(klienty) ? klienty : []) {
    if (!k || !k.id) continue;
    klientyPoId.set(k.id, k);
    if (k.medicaid) klientPoMedicaid.set(String(k.medicaid), k.id);
  }
  const avt = normAvtorizacii(avtorizacii);
  const avtPoKlientu = new Map();
  for (const a of avt) {
    if (!avtPoKlientu.has(a.klient_id)) avtPoKlientu.set(a.klient_id, []);
    avtPoKlientu.get(a.klient_id).push(a);
  }
  const estAvt = Array.isArray(avtorizacii);
  if (!estAvt) zamechaniya.push('avtorizacii_ne_peredany');
  const estRaspisanie = Array.isArray(smeny);
  if (!estRaspisanie) zamechaniya.push('raspisanie_ne_peredano');
  const smenyPoId = new Map();
  const smenyPoKlientu = new Map();
  for (const s of estRaspisanie ? smeny : []) {
    if (!s || !s.id) continue;
    const a = vr.vMs(s.start, poyas);
    const b = vr.vMs(s.end, poyas);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const x = { id: s.id, klient_id: s.klient_id, sidelka_id: s.sidelka_id || null, a, b };
    smenyPoId.set(s.id, x);
    if (!smenyPoKlientu.has(s.klient_id)) smenyPoKlientu.set(s.klient_id, []);
    smenyPoKlientu.get(s.klient_id).push(x);
  }

  // Адрес обслуживания клиента: справочник клиентов, иначе место из авторизации.
  function mestoKlienta(klientId, data) {
    const k = klientyPoId.get(klientId);
    const telefony = (arr) => arr.map(telefonE164).filter(Boolean);
    if (k && (Number.isFinite(Number(k.lat)) || k.telefon || k.telefony)) {
      return { lat: Number(k.lat), lon: Number(k.lon), telefony: telefony([k.telefon, ...(k.telefony || [])]) };
    }
    const spisok = (avtPoKlientu.get(klientId) || []).filter((a) => a.mesto);
    const podhodit = spisok.find((a) => data && (!a.s || a.s <= data) && (!a.po || data <= a.po)) || spisok[0];
    if (!podhodit) return null;
    const m = podhodit.mesto;
    return { lat: Number(m.lat), lon: Number(m.lon), telefony: telefony([m.telefon, ...(m.telefony || [])]) };
  }

  const isklyucheniya = [];
  const byli = new Set();
  const dobavit = (x, pravilo, kontekst) => {
    const klyuch = `${x.v.vizit_id}|${pravilo}`;
    if (byli.has(klyuch)) return;
    byli.add(klyuch);
    const t = TEKSTY[yaz][pravilo](kontekst || {}, c, f);
    const kl = x.klient ? klientyPoId.get(x.klient) : null;
    const zapis = {
      vizit_id: x.v.vizit_id,
      pravilo,
      pravilo_tekst: NAZVANIYA[yaz][pravilo],
      vazhnost: c.vazhnost[pravilo] || K,
      chto_ne_tak: t.chto,
      kak_ispravit: t.kak,
      vizit: {
        data: x.data || null,
        klient_id: x.klient || null,
        klient_kod: kl && kl.kod ? kl.kod : null,
        sidelka_id: x.v.sidelka_id || null,
        smena_id: x.v.smena_id || null,
        kod_uslugi: x.v.kod_uslugi || null,
        stroka: x.v.stroka || null,
      },
      detali: kontekst && kontekst.detali ? kontekst.detali : {},
    };
    if (kontekst && kontekst.svyaz) zapis.svyazannyy_vizit = kontekst.svyaz;
    isklyucheniya.push(zapis);
  };

  const rabochie = [];
  let propushcheno = 0;
  for (const v of vizity) {
    if (v.udalenie || v.propushchen) { propushcheno++; continue; }
    const pr = v.prihod || {};
    const uh = v.uhod || {};
    const s = vr.vMs(pr.vremya, poyas);
    const e = vr.vMs(uh.vremya, poyas);
    const dataVizita = typeof v.data === 'string' ? vr.razobratDatu(v.data) : null;
    const izVremeni = Number.isFinite(s) ? vr.mestnayaData(s, poyas)
      : Number.isFinite(e) ? vr.mestnayaData(e, poyas)
        : Number.isFinite(vr.vMs(v.plan_start, poyas)) ? vr.mestnayaData(vr.vMs(v.plan_start, poyas), poyas) : null;
    const klient = v.klient_id || (v.medicaid && klientPoMedicaid.get(String(v.medicaid))) || null;
    rabochie.push({ v, s, e, pr, uh, data: dataVizita || izVremeni, izVremeni, klient,
      interval: Number.isFinite(s) && Number.isFinite(e) && e > s });
  }

  for (const x of rabochie) {
    const { v, s, e, pr, uh } = x;
    // 1. Шесть элементов EVV.
    if (v.kod_uslugi !== undefined && !v.kod_uslugi) dobavit(x, 'NET_USLUGI');
    if ((v.klient_id !== undefined || v.medicaid !== undefined) && !v.klient_id && !v.medicaid) dobavit(x, 'NET_POLUCHATELYA');
    if (v.data !== undefined && !vr.razobratDatu(v.data)) dobavit(x, 'NET_DATY', { syroe: v.data_syraya || (v.data || null), izVremeni: x.izVremeni });
    if (v.sidelka_id !== undefined && !v.sidelka_id) dobavit(x, 'NET_ISPOLNITELYA');
    if (pr.vremya !== undefined && !Number.isFinite(s)) {
      dobavit(x, 'NET_PRIHODA', { syroe: pr.syroe || null, plan: vr.vMs(v.plan_start, poyas), detali: { plan_start: v.plan_start || null } });
    }
    if (uh.vremya !== undefined && !Number.isFinite(e)) {
      dobavit(x, 'NET_UHODA', { syroe: uh.syroe || null, plan: vr.vMs(v.plan_end, poyas), detali: { plan_end: v.plan_end || null } });
    }
    if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
      dobavit(x, 'UHOD_RANSHE_PRIHODA', { s, e, detali: { prihod: pr.vremya, uhod: uh.vremya } });
    }

    // 2. Отметки: электронные или ручные, место.
    const otmetki = [['prihod', pr, s], ['uhod', uh, e]];
    const pravki = [];
    const bezMesta = [];
    const elektronnye = new Set();
    for (const [imya, t, ms] of otmetki) {
      if (!Number.isFinite(ms)) continue;
      const evvKolonkaEst = t.evv !== undefined;
      const msEvv = vr.vMs(t.evv, poyas);
      const elektronno = !evvKolonkaEst || Number.isFinite(msEvv);
      if (elektronno) elektronnye.add(imya);
      if (evvKolonkaEst && !Number.isFinite(msEvv)) pravki.push({ punkt: imya, tip: 'vruchnuyu', stalo: ms });
      else if (evvKolonkaEst && Math.abs(ms - msEvv) >= 60000) pravki.push({ punkt: imya, tip: 'izmeneno', bylo: msEvv, stalo: ms });
      if (kolonokMestaNet(t)) continue;
      if (!(elektronno || c.mesto_dlya_ruchnyh)) continue;
      const mesto = gpsEst(t) || !!t.telefon || !!t.drugoe || (c.mesto_tip_dostatochno && !!t.tip);
      if (!mesto) bezMesta.push(imya);
    }
    if (v.ruchnaya_pravka === true && !pravki.length) pravki.push({ punkt: null, tip: 'flag' });
    if (pravki.length && !v.prichina_pravki) {
      dobavit(x, 'PRAVKA_BEZ_PRICHINY', { pravki, detali: { pravki: pravki.map((p) => ({ punkt: p.punkt, tip: p.tip })) } });
    }
    if (bezMesta.length) dobavit(x, 'NET_MESTA', { punkty: yaz === 'ru' ? bezMesta : bezMesta.map((p) => PUNKT.en[p]), detali: { otmetki: bezMesta } });

    // 3. Место против адреса клиента: GPS в радиусе; звонок — с телефона клиента.
    if (x.klient) {
      const L = mestoKlienta(x.klient, x.data);
      const problemy = [];
      for (const [imya, t, ms] of otmetki) {
        if (!L || !Number.isFinite(ms) || !elektronnye.has(imya)) continue;
        if (/community/i.test(t.tip || '')) continue;
        if (gpsEst(t) && Number.isFinite(L.lat) && Number.isFinite(L.lon)) {
          const m = Math.round(haversineM(t.lat, t.lon, L.lat, L.lon));
          if (m > c.radius_m) problemy.push({ punkt: imya, tip: 'gps', m });
        } else if (!gpsEst(t) && t.telefon && L.telefony.length && !L.telefony.includes(t.telefon)) {
          problemy.push({ punkt: imya, tip: 'telefon', telefon: t.telefon });
        }
      }
      if (problemy.length) dobavit(x, 'MESTO_NE_SOVPADAET', { problemy, detali: { problemy } });
    }

    // 4. Единицы к оплате против времени EVV.
    if (Number.isFinite(v.edinic) && x.interval && v.kod_uslugi) {
      const edinica = edinicaKoda(c, v.kod_uslugi);
      if (edinica !== 'den') {
        const minut = (e - s) / 60000;
        const dopustimo = edinica === 'vizit' ? 1 : edinicIzMinut(minut, edinica, c.okruglenie);
        if (v.edinic > dopustimo) {
          dobavit(x, 'EDINICY_BOLSHE_VREMENI', { edinic: v.edinic, dopustimo, minut,
            okruglenie: edinica === 'vizit' ? 'vizit' : c.okruglenie, detali: { edinic: v.edinic, dopustimo, minut: Math.round(minut) } });
        }
      }
    }

    // 5. Авторизация: код и даты.
    if (estAvt && x.klient && v.kod_uslugi && x.data) {
      const spisok = avtPoKlientu.get(x.klient) || [];
      const sKodom = spisok.filter((a) => kodPokryvaet(a.kod, v.kod_uslugi));
      if (!sKodom.length) {
        const est = [...new Set(spisok.map((a) => a.kod))];
        dobavit(x, 'KOD_NE_AVTORIZOVAN', { kod: v.kod_uslugi, est, detali: { kod: v.kod_uslugi, avtorizovano: est } });
      } else {
        const pokryvayut = sKodom.filter((a) => (!a.s || a.s <= x.data) && (!a.po || x.data <= a.po));
        if (!pokryvayut.length) {
          const periody = sKodom.map((a) => ({ id: a.id, s: a.s, po: a.po }));
          dobavit(x, 'VNE_DAT_AVTORIZACII', { data: x.data, periody, detali: { data: x.data, periody } });
        } else {
          x.avt = pokryvayut.sort((a, b) => String(b.s || '').localeCompare(String(a.s || '')) || sravnitId(a.id, b.id))[0];
        }
      }
    }

    // 6. Расписание.
    if (estRaspisanie && x.klient) {
      const dop = c.dopusk_raspisaniya_min * 60000;
      let ot;
      let doo;
      if (x.interval) { ot = s; doo = e; }
      else if (Number.isFinite(s)) { ot = s; doo = s; }
      else if (Number.isFinite(e)) { ot = e; doo = e; }
      else if (x.data) { ot = vr.vMs(`${x.data} 00:00`, poyas); doo = vr.vMs(`${x.data} 23:59`, poyas); }
      if (Number.isFinite(ot) && Number.isFinite(doo)) {
        const sovpadaet = (sm) => sm.klient_id === x.klient && ot <= sm.b + dop && sm.a - dop <= doo;
        const privyazana = v.smena_id ? smenyPoId.get(v.smena_id) : null;
        let smena = null;
        if (privyazana && !sovpadaet(privyazana)) {
          dobavit(x, 'VNE_RASPISANIYA', { tip: 'ne_ta_smena', smena_id: privyazana.id, plan: privyazana.a, fakt: ot,
            detali: { tip: 'ne_ta_smena', smena_id: privyazana.id } });
        } else if (privyazana) {
          smena = privyazana;
        } else {
          const kandidaty = (smenyPoKlientu.get(x.klient) || []).filter(sovpadaet);
          if (!kandidaty.length) {
            dobavit(x, 'VNE_RASPISANIYA', { tip: 'bez_smeny', fakt: ot, detali: { tip: 'bez_smeny', smena_id: v.smena_id || null } });
          } else {
            const obshchee = (sm) => Math.max(0, Math.min(doo, sm.b) - Math.max(ot, sm.a));
            smena = kandidaty.find((sm) => v.sidelka_id && sm.sidelka_id === v.sidelka_id)
              || kandidaty.sort((a, b) => obshchee(b) - obshchee(a) || a.a - b.a || sravnitId(a.id, b.id))[0];
          }
        }
        if (smena && v.sidelka_id && smena.sidelka_id && smena.sidelka_id !== v.sidelka_id) {
          dobavit(x, 'NE_TA_SIDELKA', { smena_id: smena.id, po_raspisaniyu: smena.sidelka_id, fakt: v.sidelka_id,
            detali: { smena_id: smena.id, po_raspisaniyu: smena.sidelka_id } });
        }
      }
    }
  }

  // 7. Пересечения визитов одной сиделки: помечаем визит, который начался раньше, чем закончился предыдущий.
  const poSidelke = new Map();
  for (const x of rabochie) {
    if (!x.v.sidelka_id || !x.interval) continue;
    if (!poSidelke.has(x.v.sidelka_id)) poSidelke.set(x.v.sidelka_id, []);
    poSidelke.get(x.v.sidelka_id).push(x);
  }
  const dopPeresech = c.dopusk_peresecheniya_min * 60000;
  for (const spisok of poSidelke.values()) {
    spisok.sort((a, b) => a.s - b.s || sravnitId(a.v.vizit_id, b.v.vizit_id));
    let derzhit = null;
    for (const x of spisok) {
      if (derzhit && x.s < derzhit.e - dopPeresech) {
        const ot = x.s;
        const doo = Math.min(x.e, derzhit.e);
        dobavit(x, 'PERESECHENIE', { svyaz: derzhit.v.vizit_id, ot, do: doo, minut: (doo - ot) / 60000,
          detali: { svyazannyy_vizit: derzhit.v.vizit_id, minut: Math.round((doo - ot) / 60000) } });
      }
      if (!derzhit || x.e > derzhit.e) derzhit = x;
    }
  }

  // 8. Единицы против авторизации за период (неделя с понедельника / месяц / весь срок).
  const gruppy = new Map();
  for (const x of rabochie) {
    if (!x.avt || x.avt.edinic == null) continue;
    const period = x.avt.period === 'mesyac' ? x.data.slice(0, 7)
      : x.avt.period === 'vsego' ? 'vse' : vr.nachaloNedeliDaty(x.data, c.pervyy_den_nedeli);
    const klyuch = `${x.avt.id}|${period}`;
    if (!gruppy.has(klyuch)) gruppy.set(klyuch, []);
    gruppy.get(klyuch).push(x);
  }
  for (const spisok of gruppy.values()) {
    spisok.sort((a, b) => (Number.isFinite(a.s) ? a.s : 0) - (Number.isFinite(b.s) ? b.s : 0)
      || String(a.data).localeCompare(String(b.data)) || sravnitId(a.v.vizit_id, b.v.vizit_id));
    let itogo = 0;
    for (const x of spisok) {
      let ed = x.v.edinic;
      if (!Number.isFinite(ed)) {
        const edinica = edinicaKoda(c, x.v.kod_uslugi);
        ed = !x.interval ? 0 : edinica === 'vizit' || edinica === 'den' ? 1 : edinicIzMinut((x.e - x.s) / 60000, edinica, c.okruglenie);
      }
      itogo += ed;
      if (itogo > x.avt.edinic) {
        dobavit(x, 'PREVYSHENIE_AVTORIZACII', { avt: x.avt.id, limit: x.avt.edinic, itogo, period: x.avt.period,
          detali: { avtorizaciya: x.avt.id, limit: x.avt.edinic, itogo, period: x.avt.period } });
      }
    }
  }

  const poryadok = new Map(PRAVILA.map((p, i) => [p, i]));
  isklyucheniya.sort((a, b) => sravnitId(a.vizit_id, b.vizit_id) || poryadok.get(a.pravilo) - poryadok.get(b.pravilo));
  const poPravilam = {};
  for (const i of isklyucheniya) poPravilam[i.pravilo] = (poPravilam[i.pravilo] || 0) + 1;
  return {
    isklyucheniya,
    svodka: {
      shtat: c.kod,
      vizitov: vizity.length,
      provereno: rabochie.length,
      propushcheno,
      isklyucheniy: isklyucheniya.length,
      kritichnyh: isklyucheniya.filter((i) => i.vazhnost === K).length,
      preduprezhdeniy: isklyucheniya.filter((i) => i.vazhnost === P).length,
      vizitov_s_isklyucheniyami: new Set(isklyucheniya.map((i) => i.vizit_id)).size,
      po_pravilam: poPravilam,
      zamechaniya,
    },
  };
}

function proverit(vizity, avtorizacii, smeny, shtat, klienty) {
  return proveritPodrobno(vizity, avtorizacii, smeny, shtat, klienty).isklyucheniya;
}

// Всё разом для функции стенда: текст CSV → визиты → исключения, плюс какие колонки узнаны.
function proveritCsv(tekstCsv, avtorizacii, smeny, shtat, klienty) {
  const c = konfigShtata(shtat);
  const r = razobratVygruzku(tekstCsv, { poyas: c.poyas });
  const p = proveritPodrobno(r.vizity, avtorizacii, smeny, shtat, klienty);
  return { strok: r.strok, kolonki: r.kolonki, isklyucheniya: p.isklyucheniya, svodka: p.svodka };
}

module.exports = {
  PRAVILA, SHTATY, KOLONKI, NAZVANIYA,
  proverit, proveritPodrobno, proveritCsv,
  razobratCsv, razobratVygruzku, vizityIzCsv,
  kanonKod, kodPokryvaet, edinicIzMinut, konfigShtata,
};
