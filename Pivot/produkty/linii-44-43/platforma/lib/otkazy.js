'use strict';
// A3: отказ от смены → подбор замены волнами SMS → закрепление первого «ДА» → побудка дежурного.
//
// КТО ЧТО РЕШАЕТ. Кому предлагать, когда следующая волна, когда будить дежурного и чем кончается ответ
// сиделки — движок lib/care/zamena.js (другой сборщик; сигнатуры KONTRAKT.md): podobrat, sleduyushchayaVolna,
// prinyatOtvet, и сверх контракта sleduyushcheeDeystvie — «одно решение на тик». Здесь — всё вокруг движка:
// хранилище, SMS, время, замки, журнал. Если в движке нет sleduyushcheeDeystvie (заглушка) — запасная логика
// с теми же правилами (волна 3, ожидание 15 мин, побудка за 2 ч до начала).
//
// ДВОЙНОЕ ЗАКРЕПЛЕНИЕ. Два «ДА» в одну секунду — два вызова sms-vhod. Порядок: решение движка на свежем
// состоянии → замок `zakrep/<smena_id>` (условная запись; кто создал первым, тот и взял) → движок ещё раз на
// самом свежем состоянии, запись по etag. Второй получает «смена занята». Движок сам от гонки не спасает
// (чистая функция) — спасает замок.

const zamenaModul = () => require('./care/zamena');
const { seychas, iso, korotko, tekst, POYAS, yazykIli } = require('./vremya');
const { e164, nomerLinii, sekretLinii, liniya: liniyaPoKlyuchu } = require('./linii');
const { zapisat } = require('./zhurnal');
const otpravka = require('./otpravka');
const { fraza } = require('./frazy');
const { metka } = require('./podpisi');

const PRAVILA_PO_UMOLCHANIYU = { volna: 3, ozhidanie_min: 15, eskalaciya_za_chasov: 2 };
const pravilaKlienta = (klient, t = seychas()) => {
  const poyas = (klient && klient.poyas) || POYAS;
  return Object.assign({}, PRAVILA_PO_UMOLCHANIYU, (klient && klient.zamena) || {}, { poyas, seychas: iso(t, poyas) });
};

const idIz = (x) => (typeof x === 'string' ? x : (x && (x.sidelka_id || x.id)) || null);

// Ответ sleduyushchayaVolna → {sidelki:[id], eskalaciya}: {sidelki} (движок), массив, {volna:{sidelki}}, отказ с volny.
function volnaIz(r, otkazDo) {
  if (!r) return { sidelki: [], eskalaciya: false };
  if (Array.isArray(r)) return { sidelki: r.map(idIz).filter(Boolean), eskalaciya: false };
  const esk = !!(r.eskalaciya === true || r.eskalirovat || r.nuzhna_eskalaciya);
  if (Array.isArray(r.sidelki)) return { sidelki: r.sidelki.map(idIz).filter(Boolean), eskalaciya: esk };
  if (r.volna && Array.isArray(r.volna.sidelki)) return { sidelki: r.volna.sidelki.map(idIz).filter(Boolean), eskalaciya: esk };
  const obj = r.otkaz && Array.isArray(r.otkaz.volny) ? r.otkaz : r;
  if (Array.isArray(obj.volny)) {
    const bylo = otkazDo && otkazDo.volny ? otkazDo.volny.length : 0;
    const nov = obj.volny.length > bylo ? obj.volny[obj.volny.length - 1] : null;
    return { sidelki: nov ? (nov.sidelki || []).map(idIz).filter(Boolean) : [], eskalaciya: esk };
  }
  return { sidelki: [], eskalaciya: esk };
}

// Ответ prinyatOtvet → {rezultat, otkaz, izmeneno, soobshchenie, uvedomit_zanyato}.
function otvetIz(r, otkazDo) {
  if (!r) return { rezultat: null, otkaz: otkazDo, izmeneno: false };
  if (r.smena_id && Array.isArray(r.otvety)) return { rezultat: null, otkaz: r, izmeneno: true };
  return {
    rezultat: r.rezultat || r.status || null,
    otkaz: r.otkaz && r.otkaz.smena_id ? r.otkaz : otkazDo,
    izmeneno: r.izmeneno === true || (r.otkaz && r.otkaz !== otkazDo) || false,
    soobshchenie: r.soobshchenie || '',
    uvedomit_zanyato: Array.isArray(r.uvedomit_zanyato) ? r.uvedomit_zanyato : null,
    nuzhen_koordinator: !!r.nuzhen_koordinator,
  };
}

// ── чтение ─────────────────────────────────────────────────────────────────
async function kollekcii(st) {
  const [sidelki, smeny, klienty] = await Promise.all([st.vse('sidelki/'), st.vse('smeny/'), st.vse('klienty/')]);
  return { sidelki: sidelki.map((x) => x.data), smeny: smeny.map((x) => x.data), klienty: klienty.map((x) => x.data) };
}

async function sidelkaPoTelefonu(st, telefon, dannye = null) {
  const n = e164(telefon);
  if (!n) return null;
  const spisok = dannye ? dannye.sidelki : (await st.vse('sidelki/')).map((x) => x.data);
  return spisok.find((x) => e164(x.telefon) === n) || null;
}

// Смена с клиентом агентства: движку нужны навыки, язык и zip клиента, а в сигнатуре podobrat его нет.
function smenaSKlientom(smena, klienty) {
  const kl = (klienty || []).find((k) => k.id === smena.klient_id) || null;
  return Object.assign({}, smena, { klient: kl });
}

// Ближайшие смены сиделки: ещё не закончились и не дальше 7 дней; фильтр по дате (местной) и коду клиента.
// calloff тоже её: отказ уже записан, а волна не ушла (некому предложить) — повторный звонок про эту смену
// должен услышать «уже записан», а не «смены не вижу» (найдено тестом 30.09 вечером).
function blizhayshieSmeny(sidelka, smeny, klienty, { data = null, klientKod = null, poyas = POYAS, teper = seychas() } = {}) {
  const kod = klientKod ? String(klientKod).trim().toUpperCase() : null;
  return smeny
    .filter((s) => s.sidelka_id === sidelka.id && ['scheduled', 'filled', 'offered', 'calloff'].includes(s.status || 'scheduled'))
    .filter((s) => Date.parse(s.end || s.start) > teper && Date.parse(s.start) < teper + 7 * 864e5)
    .filter((s) => !data || iso(s.start, poyas).slice(0, 10) === data)
    .filter((s) => {
      if (!kod) return true;
      const kl = klienty.find((k) => k.id === s.klient_id);
      return !!kl && String(kl.kod || '').toUpperCase() === kod;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

// ── отказ ──────────────────────────────────────────────────────────────────
// Один отказ на пару «смена + сиделка»: id = otk-<smena_id>-<sidelka_id>, создание условной записью.
// Повтор той же сиделки — тот же отказ; отказ замены от той же смены — новый.
const idOtkaza = (smena, sidelka) => `otk-${smena.id}-${sidelka.id}`.replace(/[^A-Za-z0-9+_.:@=-]/g, '-');

async function zafiksirovat(st, klient, liniya, { sidelka, smena, prichina, kanal, conversation_id }) {
  const poyas = klient.poyas || POYAS;
  const id = idOtkaza(smena, sidelka);
  const otkaz = {
    id, smena_id: smena.id, sidelka_id: sidelka.id,
    prichina: String(prichina || 'drugoe').slice(0, 120),
    soobshcheno: iso(seychas(), poyas), kanal: kanal === 'sms' ? 'sms' : 'call',
    conversation_id: conversation_id || null,
    liniya_klyuch: liniya ? liniya.klyuch : null,
    kod: String(10 + Math.floor(Math.random() * 90)),
    volny: [], otvety: [], zakreplena_za: null, zakreplena_v: null, eskalaciya_v: null,
  };
  const novyy = await st.zanyat(`otkazy/${id}`, otkaz);
  if (!novyy) return { otkaz: await st.getJSON(`otkazy/${id}`), novyy: false };
  await st.obnovit(`smeny/${smena.id}`, (s) => {
    if (!s || s.status === 'calloff') return undefined;
    s.status = 'calloff';
    return s;
  });
  await zapisat(st, { kto: kanal === 'sms' ? 'sms' : 'agent', chto: 'otkaz_ot_smeny', obekt: `otkazy/${id}`,
                      detali: { smena_id: smena.id, sidelka_id: sidelka.id, prichina: otkaz.prichina } }, { poyas });
  return { otkaz, novyy: true };
}

function tekstSmeny(smena, klienty, yazyk, poyas) {
  const kl = klienty.find((k) => k.id === smena.klient_id);
  return `${korotko(smena.start, yazyk, poyas)}${kl && kl.kod ? ', ' + kl.kod : ''}${kl && kl.zip ? ', zip ' + kl.zip : ''}`;
}
const yazykSidelki = (s) => yazykIli(((s && s.yazyki) || []).find((y) => ['en', 'es', 'ru'].includes(y)) || 'en');
const nomerOtpravki = (klient, liniya) => e164(klient && klient.sms && klient.sms.ot) || nomerLinii(liniya) || null;

// Разослать волну конкретным сиделкам: запись волны, предложения по телефонам, SMS (в DRY_RUN — журнал).
async function razoslat(st, klient, liniya, otkazId, ids, d, { pervaya = false } = {}) {
  const poyas = klient.poyas || POYAS;
  const otkaz = await st.getJSON(`otkazy/${otkazId}`);
  const smena = otkaz && d.smeny.find((s) => s.id === otkaz.smena_id);
  if (!otkaz || !smena || !ids.length) return { komu: [], otpravleno: 0 };
  const at = iso(seychas(), poyas);
  await st.obnovit(`otkazy/${otkazId}`, (o) => {
    if (!o || o.zakreplena_za) return undefined;
    o.volny = (o.volny || []).concat([{ at, sidelki: ids }]);
    return o;
  });
  await st.obnovit(`smeny/${smena.id}`, (s) => { if (!s || s.status === 'filled' || s.status === 'offered') return undefined; s.status = 'offered'; return s; });
  let otpravleno = 0;
  for (const sid of ids) {
    const s = d.sidelki.find((x) => x.id === sid);
    const nomer = s && e164(s.telefon);
    if (!nomer) continue;
    await st.obnovit(`predlozheniya/${nomer}`, (p) => {
      const x = p || { telefon: nomer, spisok: [] };
      if (x.spisok.some((e) => e.otkaz_id === otkazId)) return undefined;
      x.spisok.push({ otkaz_id: otkazId, smena_id: smena.id, kod: otkaz.kod, at });
      return x;
    });
    const y = yazykSidelki(s);
    const r = await otpravka.sms(st, klient, {
      ot: nomerOtpravki(klient, liniya), komu: nomer, soglasie: s.sms_soglasie === true,
      tekst: fraza('sms_predlozhenie', y, klient.nazvanie, tekstSmeny(smena, d.klienty, y, poyas), otkaz.kod),
      klyuchDubley: `predlozhenie:${otkazId}:${sid}`, kto: 'zamena', obekt: `otkazy/${otkazId}`,
    });
    if (r.ok) otpravleno++;
  }
  await zapisat(st, { kto: 'zamena', chto: pervaya ? 'volna_pervaya' : 'volna_sleduyushchaya', obekt: `otkazy/${otkazId}`,
                      detali: { sidelki: ids, otpravleno } }, { poyas });
  return { komu: ids, otpravleno };
}

// Решение на этот момент: {deystvie: 'volna'|'eskalaciya'|'zhdat'|'nichego', kod, sidelki, reyting}.
function reshenie(Z, otkaz, smena, d, pravila, teper) {
  const pravilaD = Object.assign({}, pravila, { klienty: d.klienty });
  const reyting = Z.podobrat(smenaSKlientom(smena, d.klienty), d.sidelki, d.smeny, pravilaD) || [];
  if (typeof Z.sleduyushcheeDeystvie === 'function') {
    const r = Z.sleduyushcheeDeystvie(otkaz, smena, iso(teper, pravila.poyas), pravilaD, reyting) || {};
    return { deystvie: r.deystvie || 'zhdat', kod: r.kod || null, sidelki: (r.sidelki || []).map(idIz).filter(Boolean), reyting };
  }
  // Запасная логика: те же правила, что в плане (волна, ожидание, побудка за eskalaciya_za_chasov до начала).
  const volny = otkaz.volny || [];
  const posl = volny.length ? Date.parse(volny[volny.length - 1].at) : null;
  const pora = !volny.length || teper - posl >= Number(pravila.ozhidanie_min) * 60000;
  const sidelki = pora ? volnaIz(Z.sleduyushchayaVolna(otkaz, reyting, pravilaD), otkaz).sidelki : [];
  const doNachalaMin = (Date.parse(smena.start) - teper) / 60000;
  const esk = !otkaz.eskalaciya_v && (doNachalaMin <= Number(pravila.eskalaciya_za_chasov) * 60 || (pora && !sidelki.length));
  return { deystvie: esk ? 'eskalaciya' : sidelki.length ? 'volna' : 'zhdat',
           kod: esk ? (sidelki.length ? 'malo_vremeni' : 'net_kandidatov') : null, sidelki, reyting };
}

// Один шаг по отказу: решить (движок) и сделать (мы).
async function shag(st, klient, liniya, otkazId, { dannye = null, teper = seychas(), pervyy = false } = {}) {
  const poyas = klient.poyas || POYAS;
  const d = dannye || await kollekcii(st);
  const otkaz = await st.getJSON(`otkazy/${otkazId}`);
  if (!otkaz || otkaz.zakreplena_za || otkaz.zakrit) return { deystvie: 'nichego' };
  const smena = d.smeny.find((s) => s.id === otkaz.smena_id);
  if (!smena) {
    await budit(st, klient, liniya, otkazId, { prichina: 'net_smeny' });
    return { deystvie: 'eskalaciya', kod: 'net_smeny' };
  }
  if (Date.parse(smena.start) <= teper) {
    // Смена началась без замены: будим, если ещё не будили, и отмечаем «не закрыта».
    if (!otkaz.eskalaciya_v) await budit(st, klient, liniya, otkazId, { prichina: 'smena_nachalas' });
    await st.obnovit(`smeny/${smena.id}`, (s) => { if (!s || s.status === 'filled' || s.status === 'unfilled') return undefined; s.status = 'unfilled'; return s; });
    await st.obnovit(`otkazy/${otkazId}`, (x) => { if (!x || x.zakrit || x.zakreplena_za) return undefined; x.zakrit = true; x.ne_zakryta_v = iso(teper, poyas); return x; });
    await zapisat(st, { kto: 'zamena', chto: 'smena_ne_zakryta', obekt: `otkazy/${otkazId}`, detali: { smena_id: smena.id } }, { poyas });
    return { deystvie: 'ne_zakryta' };
  }
  const pravila = pravilaKlienta(klient, teper);
  let r;
  try { r = reshenie(zamenaModul(), otkaz, smena, d, pravila, teper); }
  catch (e) {
    console.log('[otkazy] движок подбора упал:', e.message);
    await zapisat(st, { kto: 'zamena', chto: 'podbor_oshibka', obekt: `otkazy/${otkazId}`, detali: { oshibka: e.message } }, { poyas });
    r = { deystvie: 'eskalaciya', kod: 'oshibka_dvizhka', sidelki: [], reyting: [] };
  }
  // Страховка на нашей стороне: отказавшей и уже получившим — не предлагать.
  const uzhe = new Set([otkaz.sidelka_id]);
  for (const w of otkaz.volny || []) for (const s of w.sidelki || []) uzhe.add(s);
  const komu = r.sidelki.filter((x) => !uzhe.has(x)).slice(0, Math.max(1, Number(pravila.volna) || 3));
  let v = { komu: [], otpravleno: 0 };
  if (komu.length) v = await razoslat(st, klient, liniya, otkazId, komu, d, { pervaya: pervyy || !(otkaz.volny || []).length });
  if (r.deystvie === 'eskalaciya') await budit(st, klient, liniya, otkazId, { prichina: r.kod || 'eskalaciya' });
  return { deystvie: r.deystvie, kod: r.kod, komu: v.komu, otpravleno: v.otpravleno, reyting: r.reyting.length };
}

const zapustitPodbor = (st, klient, liniya, otkazId) => shag(st, klient, liniya, otkazId, { pervyy: true });

// ── побудка дежурного ──────────────────────────────────────────────────────
function adresBudilnika(liniya, otkazId, i, shagTwilio) {
  const baza = String(process.env.PLATFORMA_URL || process.env.URL || '').replace(/\/+$/, '');
  const m = metka(sekretLinii(liniya), `budit:${otkazId}:${i}`);
  const q = new URLSearchParams({ shag: shagTwilio, l: liniya.klyuch, o: otkazId, i: String(i), m });
  return `${baza}/.netlify/functions/perevod?${q.toString()}`;
}

// Звонок i-му в цепочке дежурных (klient.dezhurnye.cepochka). Цепочки нет или кончилась — письмо координатору.
async function budit(st, klient, liniya, otkazId, { i = 0, prichina = 'eskalaciya' } = {}) {
  const poyas = klient.poyas || POYAS;
  const cep = ((klient.dezhurnye && klient.dezhurnye.cepochka) || []).map(e164).filter(Boolean);
  const r = await st.obnovit(`otkazy/${otkazId}`, (o) => {
    if (!o || o.zakreplena_za || (o.eskalaciya && o.eskalaciya.prinyal)) return undefined;
    if (i === 0 && o.eskalaciya_v) return undefined;       // будим один раз на отказ; дальше — по цепочке
    o.eskalaciya_v = o.eskalaciya_v || iso(seychas(), poyas);
    o.eskalaciya = Object.assign({}, o.eskalaciya || {}, { prichina, nomer_v_cepochke: i });
    return o;
  });
  const otkaz = r.data;
  if (!otkaz || otkaz.zakreplena_za) return { ok: true, zakreplena: true };
  if (otkaz.eskalaciya && otkaz.eskalaciya.prinyal) return { ok: true, prinyato: true };
  if (!r.izmeneno && i === 0) return { ok: true, uzhe: true };
  // Будить некого (цепочки нет или кончилась) или исчерпан суточный потолок исходящих звонков — письмо координатору.
  const pismoKoordinatoru = async () => {
    const komu = (klient.pisma && klient.pisma.koordinatoru) || [];
    if (!komu.length) return;
    await otpravka.pismo(st, klient, { komu, tema: `${klient.nazvanie}: unfilled shift`,
      text: `Shift ${otkaz.smena_id} is still unfilled (${prichina}). Please check the dashboard.`,
      html: `<p>Shift <b>${otkaz.smena_id}</b> is still unfilled (${prichina}). Please check the dashboard.</p>`,
      klyuchDubley: `eskalaciya-pismo:${otkazId}`, kto: 'zamena', obekt: `otkazy/${otkazId}` });
  };
  if (!cep[i]) {
    await zapisat(st, { kto: 'zamena', chto: i === 0 ? 'eskalaciya_nekogo_budit' : 'eskalaciya_cepochka_konchilas',
                        obekt: `otkazy/${otkazId}`, detali: { prichina } }, { poyas });
    await pismoKoordinatoru();
    return { ok: true, nekogo: true };
  }
  const yv = yazykIli(klient.yazyk_vladelca || 'en');
  const z = await otpravka.zvonok(st, klient, {
    ot: nomerLinii(liniya), komu: cep[i],
    url: adresBudilnika(liniya, otkazId, i, 'budit'), statusUrl: adresBudilnika(liniya, otkazId, i, 'budit-status'),
    klyuchDubley: `budit:${otkazId}:${i}`, kto: 'zamena', obekt: `otkazy/${otkazId}`,
    opisanie: `Побудка дежурного №${i + 1} (${prichina}): ${fraza('budilnik', yv, klient.nazvanie, otkaz.smena_id)}`,
  });
  await zapisat(st, { kto: 'zamena', chto: 'eskalaciya_zvonok', obekt: `otkazy/${otkazId}`,
                      detali: { nomer_v_cepochke: i, komu: cep[i], prichina, dry_run: !!z.dry_run, ok: !!z.ok,
                                ...(z.pochemu ? { pochemu: z.pochemu } : {}) } }, { poyas });
  if (z.pochemu === 'potolok') {
    await pismoKoordinatoru();
    return { ok: false, potolok: true };
  }
  return { ok: !!z.ok, dry_run: !!z.dry_run };
}

// ── ответ сиделки «ДА» / «НЕТ» ─────────────────────────────────────────────
// Предложение не удаляем, а закрываем: опоздавшее «ДА» должно услышать «смена уже закрыта» и попасть
// в ответы отказа, а не получить «у вас нет предложений». Записи старше 7 дней чистятся при следующей правке.
const NEDELYA_MS = 7 * 864e5;
async function ubratPredlozhenie(st, nomer, otkazId) {
  if (!nomer) return;
  try {
    await st.obnovit(`predlozheniya/${nomer}`, (p) => {
      if (!p || !Array.isArray(p.spisok)) return undefined;
      let izm = false;
      const teper = seychas();
      const s = p.spisok.filter((e) => {
        const svezhee = !e.at || teper - Date.parse(e.at) < NEDELYA_MS;
        if (!svezhee) izm = true;
        return svezhee;
      }).map((e) => {
        if (e.otkaz_id !== otkazId || e.zakryto) return e;
        izm = true;
        return Object.assign({}, e, { zakryto: true });
      });
      if (!izm) return undefined;
      p.spisok = s;
      return p;
    });
  } catch (e) { console.log('[otkazy] предложение не закрылось:', e.message); }
}

async function pismoKoordinatoru(st, klient, otkazId, tema, tekstPisma) {
  const komu = (klient.pisma && klient.pisma.koordinatoru) || [];
  if (!komu.length) return null;
  return otpravka.pismo(st, klient, { komu, tema: `${klient.nazvanie}: ${tema}`, text: tekstPisma,
    html: `<p>${String(tekstPisma).replace(/[<>&]/g, ' ')}</p>`, klyuchDubley: `koordinator:${otkazId}:${tema}`,
    kto: 'zamena', obekt: `otkazy/${otkazId}` });
}

// {rezultat: zakreplena|uzhe_vasha|zanyato|otkaz_prinyat|peredumala|pozdno|ne_podhodit|ne_predlagalos|ne_ponyal|
//            kakaya_smena|net_predlozheniya, smena, sidelka, soobshchenie}
async function prinyatOtvetSidelki(st, klient, liniya, { telefon, otvet, kod = null }) {
  const poyas = klient.poyas || POYAS;
  const nomer = e164(telefon);
  const pred = await st.getJSON(`predlozheniya/${nomer}`);
  const teper = seychas();
  const vse = ((pred && pred.spisok) || []).filter((e) => !e.at || teper - Date.parse(e.at) < NEDELYA_MS);
  const otkrytye = [];
  for (const e of vse.filter((x) => !x.zakryto)) {
    const o = await st.getJSON(`otkazy/${e.otkaz_id}`);
    if (o && !o.zakrit) otkrytye.push(e);
  }
  const poKodu = (spisok) => (kod ? spisok.filter((e) => String(e.kod) === String(kod)) : spisok);
  let vybor = poKodu(otkrytye);
  if (!vybor.length && kod && otkrytye.length === 1) vybor = otkrytye;     // код с опечаткой, а предложение одно
  if (!vybor.length) {
    // Открытых нет, но недавно было — ответ опоздал: пусть движок запишет его и скажет «смена занята».
    // Самое свежее закрытое: по времени, при равном времени — позже добавленное (порядок в списке).
    const zakrytye = poKodu(vse.filter((x) => x.zakryto)).map((x) => ({ x, i: vse.indexOf(x) }))
      .sort((a, b) => (Date.parse(b.x.at || 0) - Date.parse(a.x.at || 0)) || (b.i - a.i)).map((y) => y.x);
    if (!zakrytye.length) return { rezultat: 'net_predlozheniya' };
    vybor = [zakrytye[0]];
  }
  if (vybor.length > 1) return { rezultat: 'kakaya_smena', varianty: vybor.map((e) => ({ kod: e.kod, smena_id: e.smena_id })) };

  const e = vybor[0];
  const otkazId = e.otkaz_id;
  const d = await kollekcii(st);
  const sidelka = await sidelkaPoTelefonu(st, nomer, d);
  const smena = d.smeny.find((s) => s.id === e.smena_id);
  if (!sidelka || !smena) return { rezultat: 'net_predlozheniya' };
  const at = iso(seychas(), poyas);
  const pravila = pravilaKlienta(klient);
  const ctx = { at, yazyk: yazykSidelki(sidelka), smena: smenaSKlientom(smena, d.klienty), sidelki: d.sidelki, smeny: d.smeny,
                pravila: Object.assign({}, pravila, { klienty: d.klienty }) };
  const Z = zamenaModul();
  const primenit = (o) => otvetIz(Z.prinyatOtvet(o, sidelka.id, otvet, ctx), o);
  const obekt = `otkazy/${otkazId}`;

  if (otvet === 'net') {
    let r = { rezultat: 'otkaz_prinyat' };
    await st.obnovit(obekt, (o) => { if (!o) return undefined; r = primenit(o); return r.izmeneno ? r.otkaz : undefined; });
    await ubratPredlozhenie(st, nomer, otkazId);
    await zapisat(st, { kto: 'sms', chto: 'otvet_net', obekt, detali: { sidelka_id: sidelka.id, rezultat: r.rezultat } }, { poyas });
    if (r.rezultat === 'peredumala') {
      await pismoKoordinatoru(st, klient, otkazId, 'caregiver changed her mind',
        `${sidelka.imya || sidelka.id} replied NO after being confirmed for shift ${smena.id}. The shift may be uncovered again.`);
    }
    return { rezultat: r.rezultat || 'otkaz_prinyat', smena, sidelka, soobshchenie: r.soobshchenie };
  }

  // «ДА». 1) решение движка на свежем состоянии.
  const r0 = primenit(await st.getJSON(obekt));
  if (r0.rezultat !== 'zakreplena') {
    if (r0.izmeneno) await st.obnovit(obekt, (o) => { if (!o) return undefined; const r = primenit(o); return r.izmeneno ? r.otkaz : undefined; });
    if (r0.rezultat !== 'uzhe_vasha' && r0.rezultat !== 'ne_ponyal') await ubratPredlozhenie(st, nomer, otkazId);
    await zapisat(st, { kto: 'sms', chto: 'otvet_da', obekt, detali: { sidelka_id: sidelka.id, rezultat: r0.rezultat } }, { poyas });
    if (r0.nuzhen_koordinator) {
      await pismoKoordinatoru(st, klient, otkazId, 'late YES',
        `${sidelka.imya || sidelka.id} replied YES for shift ${smena.id} (${r0.rezultat}). Please call her.`);
    }
    return { rezultat: r0.rezultat || 'ne_predlagalos', smena, sidelka, soobshchenie: r0.soobshchenie };
  }
  // 2) замок смены — защита от двойного закрепления.
  const z = await st.zamok(`zakrep/${smena.id}`, { sidelka_id: sidelka.id, otkaz_id: otkazId, at });
  if (!z.nash) {
    if (z.chey && z.chey.sidelka_id === sidelka.id) return { rezultat: 'uzhe_vasha', smena, sidelka };
    await st.obnovit(obekt, (o) => {
      if (!o) return undefined;
      o.otvety = (o.otvety || []).concat([{ sidelka_id: sidelka.id, otvet: 'da', at, pozdno: true }]);
      return o;
    });
    await ubratPredlozhenie(st, nomer, otkazId);
    await zapisat(st, { kto: 'sms', chto: 'otvet_da', obekt, detali: { sidelka_id: sidelka.id, rezultat: 'zanyato' } }, { poyas });
    return { rezultat: 'zanyato', smena, sidelka };
  }
  // 3) движок ещё раз — на самом свежем состоянии, запись по etag.
  let rf = r0;
  await st.obnovit(obekt, (o) => { if (!o) return undefined; rf = primenit(o); return rf.izmeneno ? rf.otkaz : undefined; });
  if (rf.rezultat !== 'zakreplena' && rf.rezultat !== 'uzhe_vasha') {
    try { await st.delete(`zakrep/${smena.id}`); } catch (_) {}
    await zapisat(st, { kto: 'sms', chto: 'otvet_da', obekt, detali: { sidelka_id: sidelka.id, rezultat: rf.rezultat } }, { poyas });
    return { rezultat: rf.rezultat, smena, sidelka, soobshchenie: rf.soobshchenie };
  }
  await st.obnovit(`smeny/${smena.id}`, (s) => {
    if (!s) return undefined;
    s.sidelka_id_do_otkaza = s.sidelka_id_do_otkaza || s.sidelka_id;
    s.sidelka_id = sidelka.id;
    s.status = 'filled';
    return s;
  });
  await zapisat(st, { kto: 'sms', chto: 'smena_zakreplena', obekt, detali: { sidelka_id: sidelka.id, smena_id: smena.id } }, { poyas });

  // Остальным из волн — «смена занята» (кто не ответил «нет»); их предложения закрываем.
  const otkaz = await st.getJSON(obekt);
  const skazaliNet = new Set(((otkaz && otkaz.otvety) || []).filter((a) => a.otvet === 'net').map((a) => a.sidelka_id));
  const vseVolny = new Set();
  for (const w of (otkaz && otkaz.volny) || []) for (const s of w.sidelki || []) vseVolny.add(s);
  const uvedomit = rf.uvedomit_zanyato || [...vseVolny].filter((s) => s !== sidelka.id && !skazaliNet.has(s));
  for (const sid of vseVolny) {
    if (sid === sidelka.id) continue;
    const s = d.sidelki.find((x) => x.id === sid);
    if (!s || !e164(s.telefon)) continue;
    await ubratPredlozhenie(st, e164(s.telefon), otkazId);
    if (!uvedomit.includes(sid)) continue;
    const y = yazykSidelki(s);
    await otpravka.sms(st, klient, { ot: nomerOtpravki(klient, liniya), komu: s.telefon, soglasie: s.sms_soglasie === true,
      tekst: fraza('sms_zanyato', y, klient.nazvanie, korotko(smena.start, y, poyas)),
      klyuchDubley: `zanyato:${otkazId}:${sid}`, kto: 'zamena', obekt });
  }
  await ubratPredlozhenie(st, nomer, otkazId);
  const t = tekst(smena.start, 'en', poyas);
  await pismoKoordinatoru(st, klient, otkazId, `shift filled — ${t}`,
    `The shift on ${t} (${smena.id}) is now covered by ${sidelka.imya || sidelka.id}.`);
  return { rezultat: 'zakreplena', smena, sidelka };
}

// ── тик раз в 5 минут ──────────────────────────────────────────────────────
async function tik(st, klient, { teper = seychas() } = {}) {
  const otkrytye = (await st.vse('otkazy/')).map((x) => x.data).filter((o) => o && !o.zakreplena_za && !o.zakrit);
  if (!otkrytye.length) return { otkrytyh: 0, voln: 0, eskalaciy: 0, oshibok: 0 };
  const d = await kollekcii(st);
  let voln = 0, eskalaciy = 0, oshibok = 0;
  for (const o of otkrytye) {
    try {
      const liniya = liniyaPoKlyuchu(o.liniya_klyuch) || { klyuch: o.liniya_klyuch || '', liniya: 'care-caregivers', klient: klient.id };
      const r = await shag(st, klient, liniya, o.id, { dannye: d, teper });
      if (r.komu && r.komu.length) voln++;
      if (r.deystvie === 'eskalaciya') eskalaciy++;
    } catch (e) {
      oshibok++;
      console.log('[otkazy] тик по отказу', o.id, 'упал:', e.message);
    }
  }
  return { otkrytyh: otkrytye.length, voln, eskalaciy, oshibok };
}

module.exports = {
  PRAVILA_PO_UMOLCHANIYU, pravilaKlienta, volnaIz, otvetIz, kollekcii, sidelkaPoTelefonu, smenaSKlientom,
  blizhayshieSmeny, idOtkaza, zafiksirovat, razoslat, reshenie, shag, zapustitPodbor, budit, adresBudilnika,
  ubratPredlozhenie, prinyatOtvetSidelki, tik, tekstSmeny,
};
