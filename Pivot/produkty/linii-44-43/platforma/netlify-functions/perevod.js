'use strict';
// Перевод на человека — порт perevod-ru.js Веры (план Б, проверен 28.09 во всех четырёх исходах) на любой язык,
// любого клиента и цепочку номеров. perevod.js (EN) Веры НЕ основа: без ширмы и без <Dial action>.
// Как подключить к линии и почему не системный transfer_to_number — README.md, раздел «Перевод на человека».
//
// 1) Инструмент агента (POST JSON, x-liniya-klyuch). Тело: call_sid = system__call_sid, svodka (коротко для
//    человека), yazyk, conversation_id = system__conversation_id, agent_id = system__current_agent_id (линия при общем секрете).
//    Часы офиса клиента (nastroyki.perevod.chasy) → цепочка координаторов perevod.cepochka. Вне часов — только линия
//    с perevod_vne_chasov (сиделки: срочное решает агент по промпту) → цепочка дежурных dezhurnye.cepochka; иначе ok:false.
//    Мы обновляем ЭТОТ звонок своим TwiML: «Соединяю…» голосом линии → <Dial timeout=20> на первый номер цепочки →
//    ширма (<Number url>): человек слышит, откуда звонок, и жмёт цифру. Автоответчик цифру не нажмёт.
//    DRY_RUN=1 — Twilio не трогаем вовсе (это звонок живому человеку): в журнал пишется, куда перевели бы.
// 2) Обратные вызовы Twilio (?shag=): shirma → prinyat → itog. itog: соединились — отбой; нет — следующий номер
//    той же цепочки, кончилась — фраза отката и отбой. В адресах метка k = HMAC(секрет линии, sid:номер:цепочка):
//    чужой адрес не соберёт, без метки ширма кладёт трубку, а номера цепочки наружу не отдаются.
// 3) Побудка дежурного по незакрытой смене (lib/otkazy.js → budit): ?shag=budit | budit-otvet | budit-status.
// 4) [не проверено] Режим номера-моста: системный transfer_to_number на отдельный номер Twilio, чей
//    VoiceUrl = /perevod?shag=vhod&l=<линия>&k=<HMAC(секрет линии, 'vhod-perevod:'+линия)> — отдаёт тот же TwiML.
//
// Записи голосом агента («соединяю с …», откат) — nastroyki.json perevod.zvuk[yazyk] = {soedinyayu, ne_otvetil}
// (пути в web/zvuk/<klient>/); нет записи — <Say> голосом Polly на языке линии. Ширма — на языке владельца.

const { json, twiml, xml, forma, znachenie, instrument } = require('../lib/http');
const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { metka, metkaVerna, twilioPodpisVerna } = require('../lib/podpisi');
const { fraza, golos } = require('../lib/frazy');
const { zapisat } = require('../lib/zhurnal');
const { yazykIli, vRabocheeVremya, seychas, POYAS, korotko } = require('../lib/vremya');
const otpravka = require('../lib/otpravka');
const O = require('../lib/otkazy');
const { razgovorId, svyazRazgovora } = require('../lib/kartochki');

const SID_OK = /^CA[0-9a-f]{32}$/i;
const PUT = '/.netlify/functions/perevod';
const baza = () => String(process.env.PLATFORMA_URL || process.env.URL || '').replace(/\/+$/, '');
const IMYA_PO_UMOLCHANIYU = { en: 'the coordinator', es: 'el coordinador', ru: 'координатором' };

// Цепочка: 'k' — координаторы в часы офиса, 'd' — дежурные вне часов.
function cepochka(klient, c = 'k') {
  const spisok = c === 'd' ? klient && klient.dezhurnye && klient.dezhurnye.cepochka
                           : klient && klient.perevod && klient.perevod.cepochka;
  return ((spisok || []).map(linii.e164)).filter(Boolean);
}
const tipCepochki = (v) => (v === 'd' ? 'd' : 'k');

// Какую цепочку звать сейчас: {c} или {net: 'vne_chasov'}.
function vybratCepochku(klient, liniya, teper = seychas()) {
  const chasy = klient.perevod && klient.perevod.chasy;
  if (!chasy || vRabocheeVremya(teper, chasy, klient.poyas || POYAS)) return { c: 'k' };
  if (liniya && liniya.perevod_vne_chasov) return { c: 'd' };
  return { net: 'vne_chasov' };
}

function zhdat(klient) {
  const z = Number(klient && klient.perevod && klient.perevod.zhdat_s);
  return Number.isFinite(z) && z >= 5 && z <= 60 ? Math.round(z) : 20;
}
// Сводка звучит только человеку в ширме: коротко, без разметки и эмодзи.
function chistaSvodka(s) {
  return String(s || '').replace(/[\uD800-\uDFFF]/g, '').replace(/[<>&"'`\\{}\[\]|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}
const metkaPerevoda = (l, sid, i, c) => metka(linii.sekretLinii(l), `perevod:${sid}:${i}:${tipCepochki(c)}`);
const metkaVernaPerevoda = (l, q) => metkaVerna(linii.sekretLinii(l), `perevod:${q.p}:${Number(q.i || 0)}:${tipCepochki(q.c)}`, q.k);
function adres(shag, l, sid, i, c, dop = {}) {
  const q = new URLSearchParams({ shag, l: l.klyuch, p: sid, i: String(i), c: tipCepochki(c), k: metkaPerevoda(l, sid, i, c) });
  for (const [k, v] of Object.entries(dop)) if (v) q.set(k, v);
  return `${baza()}${PUT}?${q.toString()}`;
}
function absolyutnyy(put) {
  const s = String(put || '');
  return /^https:\/\//.test(s) ? s : `${baza()}${s.startsWith('/') ? '' : '/'}${s}`;
}
function skazat(yazyk, tekstFrazy) {
  const g = golos(yazyk);
  return `<Say language="${g.language}" voice="${g.voice}">${xml(tekstFrazy)}</Say>`;
}

// TwiML: (вступление) + <Dial> на номер i цепочки c с ширмой и итогом.
function twimlDozvona(l, klient, sid, i, c, { svodka = '', yazyk = 'en', vstuplenie = true } = {}) {
  const cep = cepochka(klient, c);
  const zvuk = ((klient.perevod && klient.perevod.zvuk) || {})[yazyk] || {};
  const imyaKomu = ((klient.perevod && klient.perevod.imya) || {})[yazyk] || IMYA_PO_UMOLCHANIYU[yazyk] || IMYA_PO_UMOLCHANIYU.en;
  let vst = '';
  if (vstuplenie) vst = zvuk.soedinyayu ? `<Play>${xml(absolyutnyy(zvuk.soedinyayu))}</Play>` : skazat(yazyk, fraza('soedinyayu', yazyk, imyaKomu));
  const dop = { s: svodka, y: yazyk };
  const nomer = linii.nomerLinii(l);
  return `${vst}<Dial timeout="${zhdat(klient)}"${nomer ? ` callerId="${xml(nomer)}"` : ''} action="${xml(adres('itog', l, sid, i, c, dop))}" method="POST">`
       + `<Number url="${xml(adres('shirma', l, sid, i, c, dop))}" method="POST">${xml(cep[i])}</Number></Dial>`;
}

function otkat(klient, yazyk) {
  const zvuk = ((klient.perevod && klient.perevod.zvuk) || {})[yazyk] || {};
  const f = zvuk.ne_otvetil ? `<Play>${xml(absolyutnyy(zvuk.ne_otvetil))}</Play>` : skazat(yazyk, fraza('ne_otvetil', yazyk));
  return twiml(`${f}<Hangup/>`);
}

// ── 1. инструмент агента ────────────────────────────────────────────────────
const instrumentPerevoda = instrument('perevod', async ({ telo, liniya, klient, st, yazyk }) => {
  const poyas = klient.poyas || POYAS;
  const ne = (kod, frazaKl = 'perevod_net') => ({ ok: false, perevedeno: false, kod,
    soobshchenie: fraza(frazaKl, yazyk), dalshe: fraza('perevod_net_dalshe', yazyk) });
  const v = vybratCepochku(klient, liniya);
  if (v.net) {
    await zapisat(st, { kto: 'agent', chto: 'perevod_vne_chasov', obekt: null, detali: { liniya: liniya.liniya } }, { poyas });
    return ne('vne_chasov', 'perevod_ne_chasy');
  }
  const cep = cepochka(klient, v.c);
  if (!cep.length) {
    await zapisat(st, { kto: 'agent', chto: 'perevod_nekomu', obekt: null, detali: { liniya: liniya.liniya, cepochka: v.c } }, { poyas });
    return ne('net_cepochki');
  }
  const callSid = znachenie(telo.call_sid, 64);
  const svodka = chistaSvodka(telo.svodka);
  if (otpravka.suhoy()) {
    await zapisat(st, { kto: 'agent', chto: 'perevod_dry_run', obekt: null,
                        detali: { liniya: liniya.liniya, call_sid: callSid || null, cepochka: v.c, komu: cep, svodka } }, { poyas });
    return Object.assign(ne('dry_run'), { dry_run: true });
  }
  if (!SID_OK.test(callSid)) return ne('net_sid');
  const nomer = linii.nomerLinii(liniya);
  const zv = await otpravka.twilioApi(`/Calls/${callSid}.json`);
  if (zv.kod !== 200) return ne('net_zvonka');
  // Звонок обязан идти на номер ЭТОЙ линии: без проверки знающий секрет перевёл бы любой звонок аккаунта Twilio.
  if (!nomer || zv.telo.to !== nomer) { console.log('[perevod] звонок не на номер этой линии'); return ne('chuzhoy'); }
  if (zv.telo.status !== 'in-progress') return ne('ne_v_rabote');
  const tw = `<?xml version="1.0" encoding="UTF-8"?><Response>${twimlDozvona(liniya, klient, callSid, 0, v.c, { svodka, yazyk })}</Response>`;
  const upd = await otpravka.twilioApi(`/Calls/${callSid}.json`, { Twiml: tw });
  if (upd.kod !== 200) return ne('twilio');
  const conv = razgovorId(telo.conversation_id);
  if (conv) await svyazRazgovora(st, conv, liniya, (x) => { x.perevod = true; return x; });
  await zapisat(st, { kto: 'agent', chto: 'perevod', obekt: null,
                      detali: { liniya: liniya.liniya, call_sid: callSid, cepochka: v.c, komu: cep[0] } }, { poyas });
  return { ok: true, perevedeno: true, call_sid: callSid, soobshchenie: '', dalshe: fraza('perevod_poshel_dalshe', yazyk) };
});

// ── 2. обратные вызовы Twilio ──────────────────────────────────────────────
function kontekst(q) {
  const l = linii.liniya(String(q.l || ''));
  const klient = l ? linii.klient(l.klient) : null;
  return { l, klient };
}

function shirma(q) {
  const { l, klient } = kontekst(q);
  if (!l || !klient || !metkaVernaPerevoda(l, q)) {
    console.log('[perevod] ширма без верной метки — кладём трубку');
    return twiml('<Hangup/>');
  }
  const yv = yazykIli(klient.yazyk_vladelca || 'en');
  const kuda = adres('prinyat', l, q.p, Number(q.i || 0), q.c);
  const tekstShirmy = fraza('shirma', yv, klient.nazvanie || '', chistaSvodka(q.s));
  return twiml(
    `<Gather numDigits="1" timeout="6" action="${xml(kuda)}" method="POST">${skazat(yv, tekstShirmy)}</Gather>`
    + `<Gather numDigits="1" timeout="5" action="${xml(kuda)}" method="POST">${skazat(yv, fraza('shirma_povtor', yv))}</Gather>`
    + '<Hangup/>');
}

// Любая цифра = живой человек: автоответчик не жмёт ничего, а промах мимо единицы не должен стоить звонящего.
function prinyat(event, q) {
  const { l } = kontekst(q);
  if (!l || !metkaVernaPerevoda(l, q)) return twiml('<Hangup/>');
  const cifra = (forma(event).get('Digits') || '').trim();
  return /^[0-9*#]$/.test(cifra) ? twiml('') : twiml('<Hangup/>');
}

// Итог дозвона. Соединились и поговорили — отбой (без action Twilio пошёл бы к следующему глаголу
// и звонящий услышал бы «не ответили»). Не соединились — следующий номер цепочки или откат.
function itog(event, q) {
  const f = forma(event);
  const { l, klient } = kontekst(q);
  const yazyk = yazykIli(q.y || (l && l.yazyk));
  if (String(f.get('DialBridged') || '').toLowerCase() === 'true') return twiml('<Hangup/>');
  if (!l || !klient) return twiml(skazat(yazyk, fraza('ne_otvetil', yazyk)) + '<Hangup/>');
  const i = Number(q.i || 0);
  const c = tipCepochki(q.c);
  if (metkaVernaPerevoda(l, q) && cepochka(klient, c)[i + 1]) {
    return twiml(twimlDozvona(l, klient, q.p, i + 1, c, { svodka: q.s || '', yazyk, vstuplenie: false }));
  }
  return otkat(klient, yazyk);
}

// ── 3. побудка дежурного ───────────────────────────────────────────────────
function metkaBudilnikaVerna(q) {
  const { l } = kontekst(q);
  return !!l && metkaVerna(linii.sekretLinii(l), `budit:${q.o}:${Number(q.i || 0)}`, q.m);
}

async function budit(q) {
  const { l, klient } = kontekst(q);
  if (!klient || !metkaBudilnikaVerna(q)) return twiml('<Hangup/>');
  const yv = yazykIli(klient.yazyk_vladelca || 'en');
  let smenaT = '';
  try {
    const st = H.hranilishcheKlienta(klient.id);
    const otkaz = st && await st.getJSON(`otkazy/${q.o}`);
    const smena = otkaz && await st.getJSON(`smeny/${otkaz.smena_id}`);
    if (smena) smenaT = korotko(smena.start, yv, klient.poyas || POYAS);
  } catch (_) { /* без подробностей — всё равно будим */ }
  const kuda = O.adresBudilnika(l, q.o, Number(q.i || 0), 'budit-otvet');
  const t = fraza('budilnik', yv, klient.nazvanie || '', smenaT);
  return twiml(`<Gather numDigits="1" timeout="8" action="${xml(kuda)}" method="POST">${skazat(yv, t)}</Gather>`
             + `<Gather numDigits="1" timeout="8" action="${xml(kuda)}" method="POST">${skazat(yv, t)}</Gather><Hangup/>`);
}

async function buditOtvet(event, q) {
  const { klient } = kontekst(q);
  if (!klient || !metkaBudilnikaVerna(q)) return twiml('<Hangup/>');
  const cifra = (forma(event).get('Digits') || '').trim();
  if (!/^[0-9*#]$/.test(cifra)) return twiml('<Hangup/>');
  const yv = yazykIli(klient.yazyk_vladelca || 'en');
  const poyas = klient.poyas || POYAS;
  const i = Number(q.i || 0);
  const nomer = cepochka(klient, 'd')[i] || null;
  const st = H.hranilishcheKlienta(klient.id);
  if (st) {
    await st.obnovit(`otkazy/${q.o}`, (o) => {
      if (!o) return undefined;
      o.eskalaciya = Object.assign({}, o.eskalaciya || {}, { prinyal: nomer, prinyato_v: new Date(seychas()).toISOString() });
      return o;
    });
    await zapisat(st, { kto: 'dezhurnyy', chto: 'eskalaciya_prinyata', obekt: `otkazy/${q.o}`, detali: { nomer, i } }, { poyas });
  }
  return twiml(skazat(yv, fraza('budilnik_prinyat', yv)) + '<Hangup/>');
}

// Звонок дежурному закончился. Не нажал цифру (не взял, автоответчик, сбросил) — будим следующего.
async function buditStatus(q) {
  const { l, klient } = kontekst(q);
  if (!klient || !metkaBudilnikaVerna(q)) return json(200, {});
  const st = H.hranilishcheKlienta(klient.id);
  const otkaz = st && await st.getJSON(`otkazy/${q.o}`);
  if (!otkaz || otkaz.zakreplena_za || (otkaz.eskalaciya && otkaz.eskalaciya.prinyal)) return json(200, {});
  await O.budit(st, klient, l, q.o, { i: Number(q.i || 0) + 1, prichina: 'predydushchiy_ne_prinyal' });
  return json(200, {});
}

// ── 4. режим номера-моста (transfer_to_number на отдельный номер) [не проверено] ─
function vhodNomera(event, q) {
  const { l, klient } = kontekst(q);
  if (!l || !klient || !twilioPodpisVerna(event) || !metkaVerna(linii.sekretLinii(l), `vhod-perevod:${l.klyuch}`, q.k)) {
    return { statusCode: 403, body: 'no' };
  }
  const yazyk = yazykIli(l.yazyk);
  const sid = String(forma(event).get('CallSid') || '');
  const v = vybratCepochku(klient, l);
  if (!SID_OK.test(sid) || v.net || !cepochka(klient, v.c).length) return otkat(klient, yazyk);
  return twiml(twimlDozvona(l, klient, sid, 0, v.c, { yazyk }));
}

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  try {
    if (q.shag === 'shirma') return shirma(q);
    if (q.shag === 'prinyat') return prinyat(event, q);
    if (q.shag === 'itog') return itog(event, q);
    if (q.shag === 'budit') return await budit(q);
    if (q.shag === 'budit-otvet') return await buditOtvet(event, q);
    if (q.shag === 'budit-status') return await buditStatus(q);
    if (q.shag === 'vhod') return vhodNomera(event, q);
  } catch (e) {
    console.log('[perevod] обратный вызов упал:', e && e.message);
    return twiml('<Hangup/>');
  }
  return instrumentPerevoda(event);
};

exports._vnutri = { twimlDozvona, adres, metkaPerevoda, chistaSvodka, vybratCepochku };
