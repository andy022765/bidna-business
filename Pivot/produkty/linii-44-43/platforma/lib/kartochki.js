'use strict';
// Карточки: кандидат (A1), обращение семьи (A2), связь разговора и журнал согласий (A6).
//
// БЕЗ ДУБЛЕЙ. Модель зовёт инструмент повторно (переспросила, поправила цифру) — карточка та же:
//   1) разговор уже сохранил карточку (razgovory/<conversation_id>) → обновляем её;
//   2) этот телефон уже есть (indeks/telefon/<вид>/<E.164>) → обновляем карточку человека;
//   3) иначе — новая.
// БЕЗ МУСОРА. Имя-заглушка («Caller», «Unknown», «N/A», «Звонящий», «Llamante»…) — отказ у кандидата и семьи;
// кандидат без вопросов отбора (нет sertifikat) — отказ, если карточки с отбором ещё нет. Отказ = {ok:false} с фразой
// для звонящего (netlify-functions/kandidat.js, semya.js); не пишется ничего, кроме строки журнала.
// Имена, телефоны, даты приводятся к одному виду: телефон E.164, время ISO с поясом клиента.

const { seychas, iso, POYAS, yazykIli } = require('./vremya');
const { e164 } = require('./linii');
const { novyyId } = require('./hranilishche');
const { POCHTA_OK } = require('./otpravka');
const { zapisat } = require('./zhurnal');
const { znachenie } = require('./http');

const RAZGOVOR_OK = /^conv_[A-Za-z0-9_-]{6,80}$/;
const razgovorId = (v) => (RAZGOVOR_OK.test(znachenie(v, 100)) ? znachenie(v, 100) : null);

function chistyyTekst(v, dlina = 80) {
  const s = znachenie(v, 400).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, dlina) : null;
}
function bul(v) {
  if (v === true || v === false) return v;
  const s = znachenie(v, 20).toLowerCase();
  if (['true', 'yes', 'y', 'si', 'sí', 'da', 'да', '1'].includes(s)) return true;
  if (['false', 'no', 'n', 'net', 'нет', '0'].includes(s)) return false;
  return null;
}
function chislo(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function zip(v) {
  const m = /\b(\d{5})(?:-\d{4})?\b/.exec(znachenie(v, 20));
  return m ? m[1] : null;
}
function pochta(v) {
  const s = znachenie(v, 120).toLowerCase().replace(/\s+/g, '');
  return s && POCHTA_OK.test(s) ? s : null;
}

function sertifikat(v) {
  const s = znachenie(v, 80).toUpperCase();
  if (/\bCNA\b/.test(s)) return 'CNA';
  if (/\bHHA\b/.test(s)) return 'HHA';
  if (/\bPCA\b/.test(s)) return 'PCA';
  return 'net';
}

// ── имя-заглушка ───────────────────────────────────────────────────────────
// Модель подставляет служебное имя, когда имени не спрашивала: прогоны care-19 и care-31 — «сообщение» сохранено
// карточкой кандидата с именем «Caller», в пульте вышел бы мусорный кандидат в листе ожидания (care/progony/ITOGI.md).
// Заглушка — если в имени нет ни одного слова хотя бы из двух букв, которое не служебное. Без учёта регистра
// и диакритики латиницы; «DEMO» (пометка демо-данных) не имя и не заглушка. Номер телефона вместо имени — заглушка.
const SLOVA_ZAGLUSHKI = new Set([
  // en
  'caller', 'calling', 'unknown', 'unnamed', 'anonymous', 'anon', 'applicant', 'candidate', 'job', 'the', 'a', 'an',
  'n', 'na', 'none', 'null', 'nil', 'undefined', 'not', 'no', 'name', 'first', 'last', 'full', 'given', 'provided',
  'available', 'specified', 'unspecified', 'unavailable', 'known', 'user', 'customer', 'client', 'person', 'someone',
  'somebody', 'family', 'member', 'tbd', 'placeholder', 'pending', 'missing', 'empty', 'message', 'voicemail', 'from',
  'mr', 'mrs', 'ms', 'miss', 'sir', 'madam', 'maam',
  // es
  'llamante', 'persona', 'que', 'llama', 'desconocido', 'desconocida', 'anonimo', 'anonima', 'solicitante', 'candidato',
  'candidata', 'aspirante', 'sin', 'nombre', 'apellido', 'disponible', 'dado', 'cliente', 'usuario', 'usuaria', 'familia',
  'familiar', 'mensaje', 'de', 'senor', 'senora', 'sr', 'sra',
  // ru
  'звонящий', 'звонящая', 'звонящего', 'звонивший', 'звонившая', 'абонент', 'неизвестный', 'неизвестная', 'неизвестно',
  'аноним', 'анонимный', 'анонимно', 'кандидат', 'кандидатка', 'соискатель', 'соискательница', 'имя', 'имени', 'фамилия',
  'без', 'нет', 'не', 'указано', 'указан', 'указана', 'назван', 'названо', 'назвал', 'назвала', 'клиент', 'клиентка',
  'пользователь', 'семья', 'человек', 'сообщение', 'от', 'господин', 'госпожа',
]);
function imyaZaglushka(v) {
  const s = znachenie(v, 200);
  if (!s) return true;
  const latinica = s.replace(/[A-Za-zÀ-ÿ]+/g, (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const slova = (latinica.toLowerCase().match(/\p{L}+/gu) || []).filter((w) => w !== 'demo');
  return !slova.some((w) => !SLOVA_ZAGLUSHKI.has(w) && [...w].length >= 2);
}

const DNI = { mon: 'mon', monday: 'mon', lunes: 'mon', 'пн': 'mon', 'понедельник': 'mon', 1: 'mon',
  tue: 'tue', tuesday: 'tue', martes: 'tue', 'вт': 'tue', 'вторник': 'tue', 2: 'tue',
  wed: 'wed', wednesday: 'wed', 'miércoles': 'wed', miercoles: 'wed', 'ср': 'wed', 'среда': 'wed', 3: 'wed',
  thu: 'thu', thursday: 'thu', jueves: 'thu', 'чт': 'thu', 'четверг': 'thu', 4: 'thu',
  fri: 'fri', friday: 'fri', viernes: 'fri', 'пт': 'fri', 'пятница': 'fri', 5: 'fri',
  sat: 'sat', saturday: 'sat', 'sábado': 'sat', sabado: 'sat', 'сб': 'sat', 'суббота': 'sat', 6: 'sat',
  sun: 'sun', sunday: 'sun', domingo: 'sun', 'вс': 'sun', 'воскресенье': 'sun', 7: 'sun' };
const PORYADOK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function dni(v) {
  const a = Array.isArray(v) ? v : znachenie(v, 200).split(/[,;/\s]+/);
  const out = new Set();
  for (const x of a) {
    const s = String(x || '').trim().toLowerCase();
    if (['weekdays', 'будни', 'entre semana'].includes(s)) ['mon', 'tue', 'wed', 'thu', 'fri'].forEach((d) => out.add(d));
    else if (['weekends', 'выходные', 'fin de semana'].includes(s)) ['sat', 'sun'].forEach((d) => out.add(d));
    else if (DNI[s]) out.add(DNI[s]);
  }
  return PORYADOK.filter((d) => out.has(d));
}

const YAZYKI = { en: 'en', english: 'en', 'inglés': 'en', ingles: 'en', 'английский': 'en',
  es: 'es', spanish: 'es', 'español': 'es', espanol: 'es', 'испанский': 'es',
  ru: 'ru', russian: 'ru', 'ruso': 'ru', 'русский': 'ru',
  zh: 'zh', chinese: 'zh', mandarin: 'zh', cantonese: 'zh', 'chino': 'zh', 'китайский': 'zh',
  ht: 'ht', 'haitian creole': 'ht', creole: 'ht', kreyol: 'ht', 'kreyòl': 'ht', 'criollo haitiano': 'ht', 'креольский': 'ht',
  uk: 'uk', ukrainian: 'uk', 'украинский': 'uk', pl: 'pl', polish: 'pl', bn: 'bn', bengali: 'bn' };
function yazyki(v) {
  const a = Array.isArray(v) ? v : znachenie(v, 200).split(/[,;/]+/);
  const out = [];
  for (const x of a) {
    const s = String(x || '').trim().toLowerCase();
    if (!s) continue;
    // Незнакомый язык не выбрасываем: инструмент разрешает прислать название по-английски («tagalog»).
    const kod = YAZYKI[s] || (/^[a-z]{2}$/.test(s) ? s : s.replace(/[^\p{L} -]/gu, '').slice(0, 30));
    if (kod && !out.includes(kod)) out.push(kod);
  }
  return out;
}

function oplata(v) {
  const s = znachenie(v, 80).toLowerCase();
  if (!s) return 'unknown';
  if (/medicaid|mltc|managed long/.test(s)) return 'medicaid';
  if (/ltc|long[- ]term|insurance|seguro|страхов/.test(s)) return 'ltc';
  if (/private|self|out of pocket|particular|сам|частн/.test(s)) return 'private';
  return ['private', 'medicaid', 'ltc'].includes(s) ? s : 'unknown';
}

// ── связь разговора ────────────────────────────────────────────────────────
async function svyazRazgovora(st, conv, liniya, fn) {
  if (!conv) return null;
  const r = await st.obnovit(`razgovory/${conv}`, (z) => {
    const x = z || { conversation_id: conv, liniya: liniya ? liniya.liniya : null, sozdano: iso(seychas()), zapisi: {} };
    const novoe = fn(x);
    return novoe === undefined ? x : novoe;
  });
  return r.data;
}
async function razgovor(st, conv) { return conv ? st.getJSON(`razgovory/${conv}`) : null; }

// ── согласия ───────────────────────────────────────────────────────────────
// soglasiya/<телефон>: последнее состояние + история изменений (чем докажем согласие по TCPA).
async function obnovitSoglasiya(st, telefon, izmeneniya, { istochnik = 'call', kto = 'agent', poyas = POYAS, obekt = null } = {}) {
  const nomer = e164(telefon);
  if (!nomer) return null;
  const chto = {};
  for (const k of ['zapis', 'ii', 'sms']) if (izmeneniya[k] === true || izmeneniya[k] === false) chto[k] = izmeneniya[k];
  if (!Object.keys(chto).length) return null;
  const at = iso(seychas(), poyas);
  let bylo = null;
  const r = await st.obnovit(`soglasiya/${nomer}`, (z) => {
    const x = z || { telefon: nomer, zapis: null, ii: null, sms: null, istochnik, at, istoriya: [] };
    bylo = { zapis: x.zapis, ii: x.ii, sms: x.sms };
    const menyaetsya = Object.keys(chto).filter((k) => x[k] !== chto[k]);
    if (!menyaetsya.length) return undefined;
    Object.assign(x, chto, { istochnik, at });
    x.istoriya = (x.istoriya || []).concat([{ at, istochnik, ...chto }]).slice(-50);
    return x;
  });
  if (r.izmeneno) {
    await zapisat(st, { kto, chto: 'soglasie', obekt: obekt || `soglasiya/${nomer}`, detali: { bylo, stalo: chto, istochnik } }, { poyas });
  }
  return r.data;
}

// ── кандидат ───────────────────────────────────────────────────────────────
// sertifikat: не прислан — null (а не 'net'): «вопросов отбора не было» и «сертификата нет» — разные вещи.
// Лист ожидания без сертификата в теле понятен по причине: net_sertifikata → net, tolko_cna → CNA.
function kandidatIzTela(b, liniya) {
  const telefon = e164(b.telefon) || e164(b.caller_id) || null;
  const prichinaOtkaza = chistyyTekst(b.prichina_otkaza, 300);
  const sertSyroy = znachenie(b.sertifikat, 80);
  return {
    imya: chistyyTekst(b.imya, 80),
    telefon,
    telefon_prislan: znachenie(b.telefon, 40) ? true : false,
    email: pochta(b.email),
    sertifikat: sertSyroy ? sertifikat(sertSyroy)
      : prichinaOtkaza === 'tolko_cna' ? 'CNA' : prichinaOtkaza === 'net_sertifikata' ? 'net' : null,
    rayon: chistyyTekst(b.rayon, 80),
    zip: zip(b.zip),
    transport: bul(b.transport),
    grafik: { dni: dni(b.grafik_dni), chasy: chistyyTekst(b.grafik_chasy, 80) },
    yazyki: yazyki(b.yazyki),
    opyt_let: chislo(b.opyt_let, 0, 60),
    pravo_na_rabotu: bul(b.pravo_na_rabotu),
    podhodit: bul(b.podhodit),
    prichina_otkaza: prichinaOtkaza,
    sms_soglasie: bul(b.sms_soglasie),
    yazyk: yazykIli(b.yazyk, yazykIli(liniya && liniya.yazyk)),
  };
}

// Встреча из разговора в карточку. Та же встреча (event_id) — поля обновляются, флаги напоминаний
// (napominanie_24 / napominanie_2, lib/napominaniya.js) остаются; другая встреча — новая запись без флагов.
function vstrechaVKartochku(bylo, z) {
  const osnova = bylo && bylo.event_id && bylo.event_id === z.event_id ? bylo : {};
  return Object.assign({}, osnova, { start: z.start, end: z.end, event_id: z.event_id, zapisano_v: z.zapisano_v || null });
}

// {ok:false, pochemu}: net_imeni — имя-заглушка; net_telefona; net_otbora — нет sertifikat, а карточки с отбором у
// этого разговора или телефона ещё нет (вызов «сообщением», до вопросов отбора). Во всех трёх случаях не пишется
// ничего, кроме строки журнала: карточка появляется только у настоящего кандидата.
async function sohranitKandidata(st, klient, liniya, b) {
  const poyas = klient.poyas || POYAS;
  if (imyaZaglushka(b.imya)) {
    await zapisat(st, { kto: 'agent', chto: 'kandidat_bez_imeni', obekt: null, detali: { liniya: liniya.liniya } }, { poyas });
    return { ok: false, pochemu: 'net_imeni' };
  }
  const d = kandidatIzTela(b, liniya);
  if (!d.telefon) return { ok: false, pochemu: 'net_telefona' };
  const conv = razgovorId(b.conversation_id);
  const at = iso(seychas(), poyas);

  let id = null;
  const rz = await razgovor(st, conv);
  if (rz && rz.kandidat_id) id = rz.kandidat_id;
  if (!id) {
    const ind = await st.getJSON(`indeks/telefon/kandidat/${d.telefon}`);
    if (ind && ind.id) id = ind.id;
  }
  // Без sertifikat — только правка карточки, у которой отбор уже был (второй вызов того же разговора).
  if (d.sertifikat === null) {
    const bylo = id ? await st.getJSON(`kandidaty/${id}`) : null;
    if (!bylo || !bylo.sertifikat) {
      await zapisat(st, { kto: 'agent', chto: 'kandidat_bez_otbora', obekt: null, detali: { liniya: liniya.liniya } }, { poyas });
      return { ok: false, pochemu: 'net_otbora' };
    }
  }
  let novyy = false;
  if (!id) { id = novyyId('kand', seychas()); novyy = true; }

  const zapisSob = rz && rz.zapisi && rz.zapisi.sobesedovanie ? rz.zapisi.sobesedovanie : null;
  const itog = await st.obnovit(`kandidaty/${id}`, (z) => {
    const x = z || { id, created_at: at, istochnik: znachenie(b.istochnik, 10) === 'sms' ? 'sms' : 'call',
                     sobesedovanie: null, status: 'new', soglasiya: { zapis: null, ii: null, sms: null } };
    x.conversation_id = conv || x.conversation_id || null;
    x.yazyk = d.yazyk;
    for (const k of ['imya', 'telefon', 'email', 'sertifikat', 'rayon', 'zip', 'opyt_let', 'prichina_otkaza']) {
      if (d[k] !== null && d[k] !== undefined) x[k] = d[k];
      else if (!(k in x)) x[k] = null;
    }
    for (const k of ['transport', 'pravo_na_rabotu', 'podhodit']) {
      if (d[k] !== null) x[k] = d[k];
      else if (!(k in x)) x[k] = null;
    }
    x.grafik = { dni: d.grafik.dni.length ? d.grafik.dni : ((x.grafik && x.grafik.dni) || []),
                 chasy: d.grafik.chasy || ((x.grafik && x.grafik.chasy) || null) };
    x.yazyki = d.yazyki.length ? d.yazyki : (x.yazyki || []);
    if (zapisSob) x.sobesedovanie = vstrechaVKartochku(x.sobesedovanie, zapisSob);
    // podhodit:false = не прошёл требования и согласился на лист ожидания (описание инструмента),
    // поэтому waitlist, а не rejected: «отклонён» решает координатор, а не агент.
    if (x.podhodit === false && !x.sobesedovanie) x.status = 'waitlist';
    else if (x.sobesedovanie && ['new', 'rejected', 'waitlist'].includes(x.status)) x.status = 'booked';
    else if (!x.status) x.status = 'new';
    x.soglasiya = x.soglasiya || { zapis: null, ii: null, sms: null };
    if (d.sms_soglasie !== null) x.soglasiya.sms = d.sms_soglasie;
    x.updated_at = at;
    return x;
  });
  await st.setJSON(`indeks/telefon/kandidat/${d.telefon}`, { id });
  if (conv) await svyazRazgovora(st, conv, liniya, (x) => { x.kandidat_id = id; x.telefon = d.telefon; return x; });
  if (d.sms_soglasie !== null) {
    await obnovitSoglasiya(st, d.telefon, { sms: d.sms_soglasie }, { istochnik: 'call', poyas, obekt: `kandidaty/${id}` });
  }
  await zapisat(st, { kto: 'agent', chto: novyy ? 'kandidat_novyy' : 'kandidat_obnovlen', obekt: `kandidaty/${id}`,
                      detali: { status: itog.data.status, liniya: liniya.liniya } }, { poyas });
  return { ok: true, id, novyy, kartochka: itog.data };
}

// ── семья ──────────────────────────────────────────────────────────────────
// Имя-заглушка — {ok:false, pochemu:'net_imeni'} и ничего не пишется, как у кандидата.
// sms_soglasie (необязательное поле, в контракте его нет) — как у кандидата: в карточку и в журнал согласий;
// без него SMS-напоминание семье уходит только по согласию из итога звонка (data_collection sms_soglasie).
async function sohranitSemyu(st, klient, liniya, b) {
  const poyas = klient.poyas || POYAS;
  if (imyaZaglushka(b.imya)) {
    await zapisat(st, { kto: 'agent', chto: 'semya_bez_imeni', obekt: null, detali: { liniya: liniya.liniya } }, { poyas });
    return { ok: false, pochemu: 'net_imeni' };
  }
  const telefon = e164(b.telefon) || e164(b.caller_id) || null;
  if (!telefon) return { ok: false, pochemu: 'net_telefona' };
  const conv = razgovorId(b.conversation_id);
  const at = iso(seychas(), poyas);
  let id = null;
  const rz = await razgovor(st, conv);
  if (rz && rz.semya_id) id = rz.semya_id;
  if (!id) {
    const ind = await st.getJSON(`indeks/telefon/semya/${telefon}`);
    if (ind && ind.id) id = ind.id;
  }
  let novyy = false;
  if (!id) { id = novyyId('sem', seychas()); novyy = true; }
  const zapisOc = rz && rz.zapisi && rz.zapisi.ocenka ? rz.zapisi.ocenka : null;
  const d = {
    imya: chistyyTekst(b.imya, 80), rayon: chistyyTekst(b.rayon, 80), zip: zip(b.zip),
    chasy_v_nedelyu: chislo(b.chasov_v_nedelyu ?? b.chasy_v_nedelyu, 0, 168),
    oplata: oplata(b.oplata), srochnost: chistyyTekst(b.srochnost, 60),
    yazyk: yazykIli(b.yazyk, yazykIli(liniya && liniya.yazyk)),
    sms_soglasie: bul(b.sms_soglasie),
  };
  const itog = await st.obnovit(`semi/${id}`, (z) => {
    const x = z || { id, created_at: at, ocenka: null, status: 'new' };
    x.conversation_id = conv || x.conversation_id || null;
    // Остальные поля контакта (email из zapis) не теряем.
    x.kontakt = Object.assign({}, x.kontakt || {}, { imya: d.imya || (x.kontakt && x.kontakt.imya) || null, telefon });
    x.rayon = d.rayon ?? x.rayon ?? null;
    x.zip = d.zip ?? x.zip ?? null;
    x.chasy_v_nedelyu = d.chasy_v_nedelyu ?? x.chasy_v_nedelyu ?? null;
    x.oplata = d.oplata !== 'unknown' ? d.oplata : (x.oplata || 'unknown');
    x.srochnost = d.srochnost ?? x.srochnost ?? null;
    x.yazyk = d.yazyk;
    if (d.sms_soglasie !== null) x.soglasiya = Object.assign({ sms: null }, x.soglasiya || {}, { sms: d.sms_soglasie });
    if (zapisOc) x.ocenka = vstrechaVKartochku(x.ocenka, zapisOc);
    if (x.ocenka && x.status === 'new') x.status = 'booked';
    x.updated_at = at;
    return x;
  });
  await st.setJSON(`indeks/telefon/semya/${telefon}`, { id });
  if (conv) await svyazRazgovora(st, conv, liniya, (x) => { x.semya_id = id; x.telefon = telefon; return x; });
  if (d.sms_soglasie !== null) {
    await obnovitSoglasiya(st, telefon, { sms: d.sms_soglasie }, { istochnik: 'call', poyas, obekt: `semi/${id}` });
  }
  await zapisat(st, { kto: 'agent', chto: novyy ? 'semya_novaya' : 'semya_obnovlena', obekt: `semi/${id}`,
                      detali: { oplata: itog.data.oplata, liniya: liniya.liniya } }, { poyas });
  return { ok: true, id, novyy, kartochka: itog.data };
}

module.exports = {
  RAZGOVOR_OK, razgovorId, chistyyTekst, bul, chislo, zip, pochta, sertifikat, dni, yazyki, oplata,
  svyazRazgovora, razgovor, obnovitSoglasiya, kandidatIzTela, sohranitKandidata, sohranitSemyu,
  imyaZaglushka, vstrechaVKartochku,
};
