'use strict';
// Инструмент агента zapisat → запись на собеседование (A1) или оценку на дому (A2), пока человек на линии.
// Тело: tip, start (строкой из okna), imya, telefon, email (необяз.), yazyk (en/es/ru, необяз.), conversation_id.
// Ответ: {ok, event_id, start_tekst, soobshchenie} — «записала» агент говорит ТОЛЬКО при ok:true.
//
// ЯЗЫК ОТВЕТА (start_tekst, soobshchenie, письмо, SMS): yazyk из тела; нет — язык карточки этого разговора
// (sohranit_kandidata / sohranit_semyu шлют yazyk обязательным полем, карточка сохраняется до записи); нет и её —
// язык линии (английский, агент переводит сам). Имя-заглушка (Caller…) в теле — берём имя из той же карточки.
//
// СЕРВЕР НЕ ВЕРИТ МОДЕЛИ НА СЛОВО (как kalendar-zapis Веры): время обязано быть в свежем списке окон.
//
// БЕЗ ДУБЛЕЙ — три рубежа:
//   1) повтор той же записи (тот же разговор или тот же телефон, то же время) → та же встреча, без второго события и письма;
//   2) два звонящих на одно окно → замок `bron/<tip>/<start UTC>` (условная запись): второй слышит «только что заняли»;
//   3) замок подвёл (сбой хранилища) → после создания события сверяемся с календарём: на окно два наших события —
//      остаётся созданное раньше, своё свежее удаляем. Удаляем только своё и только что созданное.
// Перенос в том же разговоре: новое событие создаётся, старое (наше) удаляется.
//
// ПИСЬМО О ЗАПИСИ — ключ дублей по встрече (`zapis:<klient>:<event_id>`): повторный вызов письма не шлёт,
// перенос — шлёт новое. Приглашение из календаря человеку не уходит (служебный аккаунт не зовёт гостей),
// поэтому письмо — единственное подтверждение; SMS — только при согласии.

const { instrument, htmlIzTeksta } = require('../lib/http');
const { tipVstrechi, nastroykiKalendarya, svobodnyeOkna, sobytieZapisi, adapter } = require('../lib/kalendar');
const { iso, tekst, korotko, razobratVremya, denKlyuch, seychas, yazykIli, POYAS } = require('../lib/vremya');
const { fraza } = require('../lib/frazy');
const { zapisat } = require('../lib/zhurnal');
const { e164, nomerLinii } = require('../lib/linii');
const { razgovorId, chistyyTekst, pochta, svyazRazgovora, razgovor, imyaZaglushka } = require('../lib/kartochki');
const otpravka = require('../lib/otpravka');

const SVEZHIY_ZAMOK_MS = 120000;

// Кто из наших событий на это окно был первым: {created, id} меньше — тот и владеет окном.
function pervoe(a, b) {
  const ca = String(a.created || ''), cb = String(b.created || '');
  if (ca !== cb) return ca < cb ? a : b;
  return String(a.id) < String(b.id) ? a : b;
}

async function proigralKalendaryu(a, n, start, konec, nashe, conv) {
  try {
    const sp = await a.sobytiya(n.kalendar, start, konec);
    if (!sp || sp.kod !== 200) return false;
    const drugie = (sp.sobytiya || []).filter((e) => e.id !== nashe.id
      && e.start < konec.getTime() && e.end > start.getTime()
      && !(conv && e.privatnoe && e.privatnoe.razgovor === conv));
    const moe = { id: nashe.id, created: nashe.created || new Date().toISOString() };
    return drugie.some((e) => pervoe(e, moe) === e);
  } catch (e) {
    console.log('[zapis] сверка с календарём не удалась:', e.message);
    return false;
  }
}

// Встреча в карточку человека. Новая встреча (и перенос) — новый объект без флагов напоминаний: новое время
// напоминается заново (lib/napominaniya.js); статус reminded прошлой встречи снова booked.
// Почта, названная при записи, ложится в карточку, если там её нет: у семьи (sohranit_semyu почту не принимает) это
// единственный адрес для напоминания письмом — kontakt.email.
async function obnovitKartochku(st, tip, rz, telefon, zapis, email) {
  const vid = tip === 'ocenka' ? 'semya' : 'kandidat';
  let id = rz && (vid === 'semya' ? rz.semya_id : rz.kandidat_id);
  if (!id && telefon) {
    const ind = await st.getJSON(`indeks/telefon/${vid}/${telefon}`);
    id = ind && ind.id;
  }
  if (!id) return null;
  const kl = vid === 'semya' ? `semi/${id}` : `kandidaty/${id}`;
  await st.obnovit(kl, (x) => {
    if (!x) return undefined;
    const vstrecha = { start: zapis.start, end: zapis.end, event_id: zapis.event_id, zapisano_v: zapis.zapisano_v };
    if (vid === 'semya') {
      x.ocenka = vstrecha;
      if (!x.status || x.status === 'new') x.status = 'booked';
      if (email && !(x.kontakt && x.kontakt.email)) x.kontakt = Object.assign({}, x.kontakt || {}, { email });
    } else {
      x.sobesedovanie = vstrecha;
      if (['new', 'rejected', 'waitlist', 'no_show', 'reminded'].includes(x.status || 'new')) x.status = 'booked';
      if (email && !x.email) x.email = email;
    }
    x.updated_at = zapis.zapisano_v;
    return x;
  });
  return kl;
}

exports.handler = instrument('zapis', async ({ telo, liniya, klient, st, yazyk: yazykVyzova }) => {
  const poyas = klient.poyas || POYAS;
  const tip = tipVstrechi(telo.tip);
  const conv = razgovorId(telo.conversation_id);
  const rz = conv ? await razgovor(st, conv) : null;
  // Карточка этого разговора (кандидат для собеседования, семья для оценки): её язык и имя — запасные.
  const idKarty = tip && rz && (tip === 'ocenka' ? rz.semya_id : rz.kandidat_id);
  const karta = idKarty ? await st.getJSON(`${tip === 'ocenka' ? 'semi' : 'kandidaty'}/${idKarty}`) : null;
  const yazyk = yazykIli(telo.yazyk, null) || (karta && yazykIli(karta.yazyk, null)) || yazykVyzova;
  if (!tip) return { ok: false, zapisano: false, kod: 'net_tipa', soobshchenie: fraza('net_tipa', yazyk) };
  const n = nastroykiKalendarya(klient, tip);
  const neVyshlo = (kod) => ({ ok: false, zapisano: false, kod, soobshchenie: fraza('zapis_ne_vyshlo', yazyk),
                               dalshe: fraza('zapis_ne_vyshlo_dalshe', yazyk) });
  const netVremeni = (kod) => ({ ok: false, zapisano: false, kod, soobshchenie: fraza('zapis_net_vremeni', yazyk),
                                 dalshe: fraza('zapis_net_vremeni_dalshe', yazyk) });
  const zanyato = () => ({ ok: false, zapisano: false, kod: 'zanyato', soobshchenie: fraza('zapis_zanyato', yazyk),
                           dalshe: fraza('zapis_net_vremeni_dalshe', yazyk) });
  if (!n || !n.kalendar) {
    await zapisat(st, { kto: 'agent', chto: 'zapis_net_kalendarya', obekt: null, detali: { tip } }, { poyas });
    return neVyshlo('net_kalendarya');
  }
  const start = razobratVremya(telo.start, poyas);
  if (!start) return netVremeni('net_vremeni');
  const telefon = e164(telo.telefon) || e164(telo.caller_id) || null;
  const imyaKarty = karta && (karta.imya || (karta.kontakt && karta.kontakt.imya));
  const imya = (!imyaZaglushka(telo.imya) && chistyyTekst(telo.imya, 80)) || (imyaKarty && chistyyTekst(imyaKarty, 80)) || null;
  const email = pochta(telo.email);
  const konec = new Date(start.getTime() + n.dlina * 60000);
  const klBroni = `bron/${tip}/${start.toISOString()}`;
  const startTekst = tekst(start, yazyk, poyas);
  const tot = (z) => !!z && ((!!conv && z.conversation_id === conv) || (!!telefon && z.telefon === telefon));
  const uspekh = (event_id, dop = {}) => ({ ok: true, zapisano: true, tip, event_id, start: iso(start, poyas),
    start_tekst: startTekst, soobshchenie: fraza('zapis_ok', yazyk, startTekst), ...dop });

  // 1. Повтор той же записи — та же встреча.
  const zamokBylo = await st.getJSON(klBroni);
  if (zamokBylo && zamokBylo.event_id && tot(zamokBylo)) {
    await zapisat(st, { kto: 'agent', chto: 'zapis_povtor', obekt: klBroni, detali: { event_id: zamokBylo.event_id } }, { poyas });
    return uspekh(zamokBylo.event_id, { povtor: true });
  }
  const byla = rz && rz.zapisi && rz.zapisi[tip] && rz.zapisi[tip].event_id ? rz.zapisi[tip] : null;
  if (byla && Date.parse(byla.start) === start.getTime()) return uspekh(byla.event_id, { povtor: true });

  // 2. Время — только из свежего списка окон.
  let r;
  try { r = await svobodnyeOkna(n, { dataS: denKlyuch(start, poyas), maks: 500 }); }
  catch (e) { r = { kod: 0, oshibka: e.message }; }
  if (r.kod !== 200) {
    console.log('[zapis] окна не прочитались:', r.kod, r.oshibka);
    return neVyshlo('kalendar');
  }
  if (!r.okna.some((d) => d.getTime() === start.getTime())) {
    await zapisat(st, { kto: 'agent', chto: 'zapis_net_v_raspisanii', obekt: null, detali: { tip, start: iso(start, poyas) } }, { poyas });
    return netVremeni('net_v_raspisanii');
  }

  // 3. Замок окна.
  const teper = seychas();
  const z = await st.zamok(klBroni, { conversation_id: conv, telefon, tip, at: teper, event_id: null }, {
    perekhvat: (staroe) => tot(staroe) || (teper - Number(staroe.at || 0)) > SVEZHIY_ZAMOK_MS,
  });
  if (!z.nash) {
    await zapisat(st, { kto: 'agent', chto: 'zapis_zanyato', obekt: klBroni, detali: { tip } }, { poyas });
    return zanyato();
  }

  // 4. Событие в календаре клиента.
  const a = adapter();
  const zagolovok = `${tip === 'ocenka' ? 'Home care assessment' : 'Interview'} · ${imya || 'No name'}${klient.demo ? ' (DEMO)' : ''}`;
  const opisanie = [
    `Booked by the ${klient.nazvanie || ''} AI phone line.`,
    imya ? 'Name: ' + imya : '', telefon ? 'Phone: ' + telefon : '', email ? 'Email: ' + email : '',
    conv ? 'Conversation: ' + conv : '',
    'No guest is attached: a service account cannot invite attendees. The person is confirmed by email or text.',
  ].filter(Boolean).join('\n');
  let s;
  try { s = await a.sozdat(n.kalendar, sobytieZapisi(n, { start, conversation_id: conv, zagolovok, opisanie, klyuchBroni: klBroni })); }
  catch (e) { s = { kod: 0, oshibka: e.message }; }
  if (!s || !s.id) {
    try { await st.delete(klBroni); } catch (_) {}
    await zapisat(st, { kto: 'agent', chto: 'zapis_oshibka_kalendarya', obekt: klBroni, detali: { kod: s && s.kod } }, { poyas });
    return neVyshlo('kalendar_zapis');
  }

  // 5. Сверка с календарём: на окно не должно быть двух наших встреч.
  if (await proigralKalendaryu(a, n, start, konec, s, conv)) {
    try { await a.udalit(n.kalendar, s.id); } catch (_) {}
    try { await st.delete(klBroni); } catch (_) {}
    await zapisat(st, { kto: 'agent', chto: 'zapis_konflikt_otkat', obekt: klBroni, detali: { event_id: s.id } }, { poyas });
    return zanyato();
  }

  // 6. Замок, разговор, перенос, карточка.
  const zapisano_v = iso(seychas(), poyas);
  const zapis = { start: iso(start, poyas), end: iso(konec, poyas), event_id: s.id, zapisano_v, start_tekst: tekst(start, 'en', poyas) };
  await st.obnovit(klBroni, (x) => Object.assign(x || {}, { conversation_id: conv, telefon, tip, at: teper, event_id: s.id }));
  if (conv) {
    await svyazRazgovora(st, conv, liniya, (x) => {
      x.zapisi = x.zapisi || {};
      x.zapisi[tip] = zapis;
      if (telefon && !x.telefon) x.telefon = telefon;
      return x;
    });
  }
  let pereneseno = false;
  if (byla && Date.parse(byla.start) !== start.getTime()) {
    try { await a.udalit(n.kalendar, byla.event_id); } catch (e) { console.log('[zapis] старая встреча не удалилась:', e.message); }
    try { await st.delete(`bron/${tip}/${new Date(byla.start).toISOString()}`); } catch (_) {}
    pereneseno = true;
  }
  const kartochka = await obnovitKartochku(st, tip, rz, telefon, zapis, email);

  // 7. Письмо (ключ дублей — встреча) и SMS при согласии.
  let pismo = null;
  if (email) {
    const chto = fraza(tip === 'ocenka' ? 'chto_ocenka' : 'chto_sobesedovanie', yazyk);
    const tekstPisma = fraza('pismo_zapis_tekst', yazyk, imya, klient.nazvanie, chto, startTekst);
    const rp = await otpravka.pismo(st, klient, {
      komu: [email], tema: fraza('pismo_zapis_tema', yazyk, klient.nazvanie, startTekst),
      text: tekstPisma, html: htmlIzTeksta(tekstPisma),
      klyuchDubley: `zapis:${klient.id}:${s.id}`, kto: 'agent', obekt: kartochka || klBroni,
    });
    pismo = rp.ok ? (rp.dry_run ? 'dry_run' : rp.uzhe ? 'uzhe' : 'otpravleno') : rp.pochemu;
  }
  let sms = null;
  if (telefon) {
    const sog = await st.getJSON(`soglasiya/${telefon}`);
    if (sog && sog.sms === true) {
      const rs = await otpravka.sms(st, klient, { ot: nomerLinii(liniya), komu: telefon,
        tekst: fraza('sms_zapis', yazyk, klient.nazvanie, korotko(start, yazyk, poyas)),
        klyuchDubley: `zapis-sms:${klient.id}:${s.id}`, kto: 'agent', obekt: kartochka || klBroni });
      sms = rs.ok ? (rs.dry_run ? 'dry_run' : 'otpravleno') : rs.pochemu;
    }
  }

  await zapisat(st, { kto: 'agent', chto: pereneseno ? 'zapis_perenesena' : 'zapis', obekt: kartochka || klBroni,
                      detali: { tip, start: zapis.start, event_id: s.id, pismo, sms, liniya: liniya.liniya } }, { poyas });
  // Про письмо говорим, только если оно правда ушло: в холостом режиме не обещаем.
  const proPismo = pismo === 'otpravleno' || pismo === 'uzhe' ? fraza('zapis_pismo', yazyk) : '';
  return uspekh(s.id, {
    pereneseno, pismo, sms,
    soobshchenie: fraza(pereneseno ? 'zapis_pereneseno' : 'zapis_ok', yazyk, startTekst) + proPismo,
  });
}, { liniya: 'care-hiring' });
