'use strict';
// Входящий звонок на номер линии → голосовой агент ElevenLabs этой линии. Основа — zvonok-vhod.js Веры
// (путь «register-call»: номер остаётся нашим, TwiML соединения выдаёт ElevenLabs; проверено живым звонком 25.09).
//
// ОТЛИЧИЯ ОТ ВЕРЫ: карта «номер → линия → клиент» из linii.json вместо одной линии en; суточный предел звонков
// СВОЙ у каждого клиента (schetchiki/<дата>.zvonkov в хранилище клиента), а не один на все номера.
// Повтор вебхука (Twilio повторяет при сбое) не списывается дважды: замок zvonki-vhod/<дата>/<CallSid>.
// Предел не проверить (хранилище лежит) — линия закрыта фразой «временно недоступна» (fail-closed, с 01.10).
//
// БЕЗОПАСНОСТЬ. Адрес публичный: без подписи Twilio — 403 (иначе любой жжёт наши минуты ElevenLabs).
// Звонок не на номер из linii.json — 403.
// Если агент недоступен и у клиента задан rezerv_nomer — звонок уходит в офис клиента, а не в тишину.
// На уровне Twilio у номера должен стоять VoiceFallbackUrl (скилл zapusk-very, шаг 7): он спасает, когда лежит сам стенд.
//
// ПЕРЕМЕННЫЕ АГЕНТА (KONTRAKT.md, «Дополнения care» и «Дополнения стенда 30.09 вечер»): в register-call кладём
// conversation_initiation_client_data.dynamic_variables = {ofis_seychas, kalendar} — статус офиса по часам клиента
// и календарь на 14 дней (lib/vremya.js, peremennyeZvonka). У агентов на обе переменные пустые заглушки, поэтому
// сбой расчёта звонок не роняет: соединяем без переменных. ElevenLabs не принял их (400/422) — один повтор без них.
//
// env: TWILIO_AUTH_TOKEN · ELEVENLABS_API_KEY · ZVONKI_BEZ_KVOTY (свои номера обкатки через запятую)

const { twiml, xml, forma } = require('../lib/http');
const { twilioPodpisVerna } = require('../lib/podpisi');
const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { schetchik } = require('../lib/otpravka');
const { zapisat } = require('../lib/zhurnal');
const { fraza, golos } = require('../lib/frazy');
const { POYAS, yazykIli, denKlyuch, seychas, peremennyeZvonka } = require('../lib/vremya');

function otboy(yazyk, klyuchFrazy, rezerv) {
  const g = golos(yazyk);
  const say = `<Say language="${g.language}" voice="${g.voice}">${xml(fraza(klyuchFrazy, yazyk))}</Say>`;
  if (rezerv) {
    const r = `<Say language="${g.language}" voice="${g.voice}">${xml(fraza('liniya_rezerv', yazyk))}</Say>`;
    return twiml(`${r}<Dial timeout="25">${xml(rezerv)}</Dial>`);
  }
  return twiml(`${say}<Hangup/>`);
}

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };
  if (!twilioPodpisVerna(event)) {
    console.log('[vhod] подпись Twilio не сошлась — отбой');
    return { statusCode: 403, body: 'no' };
  }
  const p = forma(event);
  const ot = p.get('From') || '';
  const kuda = p.get('To') || '';
  const l = linii.poNomeru(kuda);
  if (!l) {
    console.log('[vhod] звонок не на номер из linii.json');
    return { statusCode: 403, body: 'no' };
  }
  const klient = linii.klient(l.klient);
  const yazyk = yazykIli(l.yazyk);
  const rezerv = klient && linii.e164(klient.rezerv_nomer);
  if (!klient) return otboy(yazyk, 'liniya_nedostupna', null);
  const poyas = klient.poyas || POYAS;
  let st = null;
  try { st = H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }

  // Суточный предел клиента (nastroyki.limity.zvonkov_v_sutki, на стенде 15). Свои номера обкатки его не едят
  // (урок Веры: иначе 30 проверочных звонков выберут квоту живых людей до обеда).
  // FAIL-CLOSED (проверка 30.09): хранилище не поднялось или счётчик не прочитался — предел не проверить,
  // поэтому линию НЕ открываем: вежливая фраза «линия временно недоступна» (или резервный номер офиса клиента).
  // Раньше сбой Blobs молча снимал потолок, и минуты ElevenLabs текли без счёта из кошелька, общего с Верой.
  const svoi = String(process.env.ZVONKI_BEZ_KVOTY || '').split(',').map((x) => linii.e164(x.trim())).filter(Boolean);
  const callSid = String(p.get('CallSid') || '').slice(0, 64);
  if (!svoi.includes(linii.e164(ot))) {
    if (!st) {
      console.log('[vhod] хранилище клиента не поднялось — предел не проверить, линию не открываю');
      return otboy(yazyk, 'liniya_vremenno', rezerv);
    }
    try {
      const novyy = /^CA[0-9a-f]{32}$/i.test(callSid)
        ? await st.zanyat(`zvonki-vhod/${denKlyuch(seychas(), poyas)}/${callSid}`, { at: seychas(), liniya: l.klyuch })
        : true;
      if (novyy) {
        const lim = Number(klient.limity && klient.limity.zvonkov_v_sutki) || 15;
        const s = await schetchik(st, 'zvonkov', lim, poyas);
        if (!s.ok) {
          await zapisat(st, { kto: 'vhod', chto: 'zvonok_predel', obekt: null, detali: { liniya: l.liniya, limit: lim } }, { poyas });
          return otboy(yazyk, 'liniya_nedostupna', rezerv);
        }
      }
    } catch (e) {
      console.log('[vhod] счётчик не прочитался — предел не проверить, линию не открываю:', e && e.message);
      return otboy(yazyk, 'liniya_vremenno', rezerv);
    }
  }

  if (!l.agent_id || !process.env.ELEVENLABS_API_KEY) {
    console.log('[vhod] у линии нет агента или ключа ElevenLabs:', l.klyuch);
    return otboy(yazyk, 'liniya_nedostupna', rezerv);
  }
  // Статус офиса и календарь — в момент звонка, по поясу клиента.
  let peremennye = null;
  try { peremennye = peremennyeZvonka(klient, seychas()); }
  catch (e) { console.log('[vhod] переменные агента не посчитались, соединяю без них:', e && e.message); }
  const telo = { agent_id: l.agent_id, from_number: ot, to_number: kuda, direction: 'inbound' };
  if (peremennye && Object.keys(peremennye).length) telo.conversation_initiation_client_data = { dynamic_variables: peremennye };
  const zaregistrirovat = () => fetch('https://api.elevenlabs.io/v1/convai/twilio/register-call', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(telo),
  });
  try {
    let r = await zaregistrirovat();
    let text = await r.text();
    // Переменные на живом номере ещё не проверены: не приняли их (400/422) — один повтор без них, звонок важнее.
    if (!r.ok && (r.status === 400 || r.status === 422) && telo.conversation_initiation_client_data) {
      console.log('[vhod] ElevenLabs не принял переменные агента, повторяю без них:', r.status, text.slice(0, 200));
      delete telo.conversation_initiation_client_data;
      peremennye = null;
      r = await zaregistrirovat();
      text = await r.text();
    }
    if (!r.ok) {
      console.log('[vhod] ElevenLabs отказал:', r.status, text.slice(0, 200));
      return otboy(yazyk, 'liniya_nedostupna', rezerv);
    }
    // Ответ — готовый TwiML: отдаём как есть, формат соединения их, а не наш.
    let tw = text;
    if (text.trim().startsWith('{')) { try { tw = JSON.parse(text).twiml || ''; } catch (_) { tw = ''; } }
    if (!tw.includes('<Response')) {
      console.log('[vhod] ответ не похож на TwiML');
      return otboy(yazyk, 'liniya_nedostupna', rezerv);
    }
    if (st) {
      await zapisat(st, { kto: 'vhod', chto: 'zvonok_vhod', obekt: null,
                          detali: { liniya: l.liniya, call_sid: callSid, ofis_seychas: (peremennye && peremennye.ofis_seychas) || null } }, { poyas });
    }
    return { statusCode: 200, headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' }, body: tw };
  } catch (e) {
    console.log('[vhod] упало:', e && e.message);
    return otboy(yazyk, 'liniya_nedostupna', rezerv);
  }
};
