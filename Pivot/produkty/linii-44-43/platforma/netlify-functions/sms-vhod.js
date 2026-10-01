'use strict';
// Входящее SMS на номер линии (Twilio Messaging webhook, форма). Подпись Twilio → линия по номеру To → клиент.
//
//   ДА / YES / SÍ (+ код предложения)  → ответ на предложение смены: первый «ДА» закрепляет смену (замок),
//                                        остальным «смена занята»;
//   НЕТ / NO                           → отказ от предложения, в карточку отказа;
//   STOP и синонимы                    → согласие на SMS снято (soglasiya/<телефон>, карточка сиделки);
//   START / UNSTOP                     → согласие возвращено;
//   «не выйду», «sick», «no puedo»…    → отказ от ближайшей смены, если она одна; иначе просим позвонить.
//
// Ответы человеку идут через lib/otpravka (DRY_RUN, потолок, отписка), а не TwiML-ом <Message> в обход:
// в холостом режиме ответ только пишется в журнал. На STOP/START стандартными словами Twilio отвечает сам.
// Twilio ждёт ответа 15 с; сам ответ всегда пустой <Response/>.

const { twiml, forma } = require('../lib/http');
const { twilioPodpisVerna } = require('../lib/podpisi');
const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { zapisat } = require('../lib/zhurnal');
const { obnovitSoglasiya } = require('../lib/kartochki');
const O = require('../lib/otkazy');
const { fraza } = require('../lib/frazy');
const { korotko, yazykIli, POYAS, seychas } = require('../lib/vremya');
const otpravka = require('../lib/otpravka');

// Стандартные слова Twilio: на них он отвечает сам и сам блокирует отправку.
const STOP_TWILIO = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT']);
const START_TWILIO = new Set(['START', 'UNSTOP']);
const STOP = new Set([...STOP_TWILIO, 'СТОП', 'ОТПИСАТЬСЯ', 'BAJA', 'PARAR', 'CANCELAR']);
const START = new Set([...START_TWILIO, 'СТАРТ', 'COMENZAR', 'REANUDAR']);
const HELP = new Set(['HELP', 'INFO', 'ПОМОЩЬ', 'AYUDA']);
const DA = new Set(['YES', 'Y', 'YEP', 'YEAH', 'SI', 'ДА', 'Д']);
const NET = new Set(['NO', 'N', 'NOPE', 'НЕТ', 'Н']);
const OTKAZ = [/\bCALL ?OUT\b/, /\bSICK\b/, /\bCAN'?T (MAKE|COME|WORK|GO)\b/, /\bCANNOT (MAKE|COME|WORK|GO)\b/, /\bNOT COMING\b/,
  /\bNO PUEDO\b/, /\bENFERM/, /\bNO VOY\b/, /НЕ ВЫЙДУ/, /НЕ СМОГУ/, /БОЛЕЮ/, /ЗАБОЛЕЛ/, /НЕ ПРИДУ/];

function razobrat(tekstSms) {
  const syroe = String(tekstSms || '').trim().replace(/[’`´]/g, "'");
  // Диакритику снимаем только у латиницы (SÍ → SI); кириллицу не трогаем, иначе Й станет И.
  const s = syroe.replace(/[A-Za-zÀ-ÿ]+/g, (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')).toUpperCase();
  const slova = s.replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const pervoe = slova[0] || '';
  const kod = slova.slice(1).find((w) => /^\d{1,3}$/.test(w)) || null;
  const goloe = slova.length === 1 || (slova.length === 2 && /^\d{1,3}$/.test(slova[1]));
  if (slova.length === 1 && STOP.has(pervoe)) return { tip: 'stop', slovo: pervoe };
  if (slova.length === 1 && START.has(pervoe)) return { tip: 'start', slovo: pervoe };
  if (slova.length === 1 && HELP.has(pervoe)) return { tip: 'help' };
  if (goloe && DA.has(pervoe)) return { tip: 'da', kod };
  if (goloe && NET.has(pervoe)) return { tip: 'net', kod };
  if (OTKAZ.some((r) => r.test(s))) return { tip: 'otkaz' };
  if (DA.has(pervoe) && slova.length <= 4) return { tip: 'da', kod };
  if (NET.has(pervoe) && slova.length <= 4) return { tip: 'net', kod };
  return { tip: 'neizvestno' };
}

async function otvetit(st, klient, liniya, komu, tekstOtveta, klyuch) {
  if (!tekstOtveta) return null;
  return otpravka.sms(st, klient, { ot: linii.nomerLinii(liniya), komu, tekst: tekstOtveta, otvetNaVhodyashchee: true,
                                    klyuchDubley: klyuch, kto: 'sms', obekt: `soglasiya/${komu}` });
}

async function obnovitSidelku(st, sidelka, sms) {
  if (!sidelka) return;
  await st.obnovit(`sidelki/${sidelka.id}`, (s) => { if (!s || s.sms_soglasie === sms) return undefined; s.sms_soglasie = sms; return s; });
}

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };
  if (!twilioPodpisVerna(event)) {
    console.log('[sms-vhod] подпись Twilio не сошлась — отбой');
    return { statusCode: 403, body: 'no' };
  }
  const p = forma(event);
  const ot = linii.e164(p.get('From'));
  const l = linii.poNomeru(p.get('To') || '');
  if (!l || !ot) {
    console.log('[sms-vhod] не наша линия или нет номера отправителя');
    return twiml('');
  }
  const klient = linii.klient(l.klient);
  let st = null;
  try { st = klient && H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
  if (!st) { console.log('[sms-vhod] хранилище клиента не поднялось'); return twiml(''); }
  const poyas = klient.poyas || POYAS;
  const tekstSms = String(p.get('Body') || '').slice(0, 640);
  const sid = String(p.get('MessageSid') || '').slice(0, 64);
  const r = razobrat(tekstSms);

  try {
    const sidelka = await O.sidelkaPoTelefonu(st, ot);
    const yazyk = yazykIli(((sidelka && sidelka.yazyki) || []).find((y) => ['en', 'es', 'ru'].includes(y)) || l.yazyk);
    const a = klient.nazvanie;
    await zapisat(st, { kto: 'sms', chto: 'sms_vhod', obekt: sidelka ? `sidelki/${sidelka.id}` : null,
                        detali: { ot, tip: r.tip, tekst: tekstSms.slice(0, 300), liniya: l.liniya } }, { poyas });

    if (r.tip === 'stop') {
      await obnovitSoglasiya(st, ot, { sms: false }, { istochnik: 'sms_stop', kto: 'sms', poyas });
      await obnovitSidelku(st, sidelka, false);
      // На нестандартное слово Twilio не ответит и не заблокирует — подтверждаем сами (одно сообщение по закону).
      if (!STOP_TWILIO.has(r.slovo)) {
        await otpravka.sms(st, klient, { ot: linii.nomerLinii(l), komu: ot, podtverzhdenieOtpiski: true,
          tekst: `${a}: you are unsubscribed and will get no more messages. Reply START to resubscribe.`,
          klyuchDubley: `stop:${sid || ot + ':' + seychas()}`, kto: 'sms' });
      }
      return twiml('');
    }
    if (r.tip === 'start') {
      await obnovitSoglasiya(st, ot, { sms: true }, { istochnik: 'sms_start', kto: 'sms', poyas });
      await obnovitSidelku(st, sidelka, true);
      return twiml('');
    }
    if (r.tip === 'help') return twiml('');

    if (r.tip === 'da' || r.tip === 'net') {
      if (r.tip === 'da') {
        // «ДА» от номера, который раньше отписался: Twilio по умолчанию считает YES словом подписки.
        const sog = await st.getJSON(`soglasiya/${ot}`);
        if (sog && sog.sms === false) {
          await obnovitSoglasiya(st, ot, { sms: true }, { istochnik: 'sms_start', kto: 'sms', poyas });
          await obnovitSidelku(st, sidelka, true);
        }
      }
      const res = await O.prinyatOtvetSidelki(st, klient, l, { telefon: ot, otvet: r.tip, kod: r.kod });
      const smenaT = res.smena ? korotko(res.smena.start, yazyk, poyas) : '';
      let t = '';
      if (res.rezultat === 'zakreplena' || res.rezultat === 'uzhe_vasha') t = fraza('sms_zakreplena', yazyk, a, smenaT);
      else if (res.rezultat === 'zanyato') t = fraza('sms_zanyato', yazyk, a, smenaT);
      else if (res.rezultat === 'otkaz_prinyat') t = fraza('sms_net_prinyato', yazyk, a);
      else if (res.rezultat === 'net_predlozheniya') t = fraza('sms_net_predlozheniya', yazyk, a);
      else if (res.rezultat !== 'kakaya_smena' && res.soobshchenie) t = `${a}: ${res.soobshchenie}`;   // тексты движка: pozdno, ne_podhodit, peredumala…
      else if (res.rezultat === 'kakaya_smena') {
        const d = await O.kollekcii(st);
        const spisok = res.varianty.map((v) => {
          const sm = d.smeny.find((x) => x.id === v.smena_id);
          return `${v.kod}: ${sm ? korotko(sm.start, yazyk, poyas) : v.smena_id}`;
        }).join('; ');
        t = fraza('sms_kakaya_smena', yazyk, a, spisok);
      } else t = fraza('sms_net_predlozheniya', yazyk, a);
      await otvetit(st, klient, l, ot, t, `otvet:${sid || ot + ':' + seychas()}`);
      return twiml('');
    }

    if (r.tip === 'otkaz') {
      if (!sidelka) {
        await zapisat(st, { kto: 'sms', chto: 'otkaz_neizvestnyy_nomer', obekt: null, detali: { ot, kanal: 'sms' } }, { poyas });
        return twiml('');
      }
      const d = await O.kollekcii(st);
      const teper = seychas();
      const smeny = O.blizhayshieSmeny(sidelka, d.smeny, d.klienty, { poyas, teper })
        .filter((s) => Date.parse(s.start) < teper + 36 * 3600e3);
      if (smeny.length !== 1) {
        await zapisat(st, { kto: 'sms', chto: 'otkaz_sms_neodnoznachno', obekt: `sidelki/${sidelka.id}`, detali: { smen: smeny.length } }, { poyas });
        await otvetit(st, klient, l, ot, fraza('sms_otkaz_utochnit', yazyk, a), `otvet:${sid || ot + ':' + teper}`);
        return twiml('');
      }
      const { otkaz, novyy } = await O.zafiksirovat(st, klient, l, { sidelka, smena: smeny[0], prichina: 'sms: ' + tekstSms.slice(0, 100), kanal: 'sms' });
      if (novyy) await O.zapustitPodbor(st, klient, l, otkaz.id);
      await otvetit(st, klient, l, ot, fraza('sms_otkaz_prinyat', yazyk, a, korotko(smeny[0].start, yazyk, poyas)), `otvet:${sid || ot + ':' + teper}`);
      return twiml('');
    }

    await zapisat(st, { kto: 'sms', chto: 'sms_neizvestno', obekt: sidelka ? `sidelki/${sidelka.id}` : null, detali: { ot } }, { poyas });
    return twiml('');
  } catch (e) {
    console.log('[sms-vhod] упало:', e && e.message);
    return twiml('');
  }
};

exports._razobrat = razobrat;
