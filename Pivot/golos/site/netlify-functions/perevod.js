// Перевод звонка на живого человека — СВОЙ, потому что встроенный на нашем маршруте
// не работает: номер импортирован не родным способом, и у ElevenLabs нет доступа
// к нашему аккаунту Twilio (см. zvonok-vhod.js).
//
// КАК ЭТО РАБОТАЕТ. Вера зовёт инструмент, тот приносит сюда system__call_sid —
// настоящий идентификатор звонка у Twilio. Мы обновляем ЭТОТ звонок новым TwiML:
// <Dial> на живой номер. Twilio переводит на лету, человек ничего не набирает.
//
// ПОЧЕМУ ПРОВЕРЯЕМ НОМЕР ЗВОНКА. Без проверки тот, кто узнал секрет, мог бы
// перевести ЛЮБОЙ звонок нашего аккаунта — включая боевую русскую линию. Поэтому
// сверяем: звонок должен идти НА наш английский номер и быть в работе.
//
// ЕСЛИ НИКТО НЕ ВЗЯЛ ТРУБКУ — не бросаем человека в тишину: говорим об этом
// и возвращаем к обычному пути (почта). Это прямо прописано в TwiML после <Dial>.
//
// env: TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_NOMER_EN · PEREVOD_NOMER
//      · GOLOS_PISMO_SECRET

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });

const SID_OK = /^CA[0-9a-f]{32}$/i;

function ne(ru, pochemu) {
  return { ok: false, perevedeno: false, pochemu,
    skazat: ru ? 'Сейчас перевести не получается.'
               : "I can't put you through right now.",
    dalshe: ru ? 'НЕ говори, что переводишь. Предложи письмо и возьми адрес почты.'
               : 'Do NOT say you are transferring. Offer the email instead and take their address.' };
}

async function twilio(put, telo, metod) {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const tok = process.env.TWILIO_AUTH_TOKEN || '';
  const osn = Buffer.from(`${sid}:${tok}`).toString('base64');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${put}`, {
    method: metod || (telo ? 'POST' : 'GET'),
    headers: { Authorization: 'Basic ' + osn,
               ...(telo ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: telo ? new URLSearchParams(telo).toString() : undefined,
  });
  const text = await r.text();
  let d = null;
  try { d = JSON.parse(text); } catch (_) { d = { syroe: text.slice(0, 200) }; }
  return { kod: r.status, telo: d };
}

exports.handler = async (event) => {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  const ru = String(b.yazyk || '').toLowerCase() !== 'en';

  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret)
    return otvet(401, ne(ru, 'secret'));

  const callSid = String(b.call_sid || '').trim();
  if (!SID_OK.test(callSid)) {
    console.log('[perevod] call_sid не похож на настоящий:', callSid.slice(0, 40));
    return otvet(200, ne(ru, 'net_sid'));
  }

  const kuda = String(process.env.PEREVOD_NOMER || '').trim();
  if (!/^\+[0-9]{8,15}$/.test(kuda)) {
    console.log('[perevod] PEREVOD_NOMER не задан или кривой');
    return otvet(200, ne(ru, 'net_nomera'));
  }

  // 1. Чей это звонок и жив ли он.
  const { kod, telo } = await twilio(`/Calls/${callSid}.json`);
  if (kod !== 200) {
    console.log('[perevod] звонок не прочитался:', kod, JSON.stringify(telo).slice(0, 150));
    return otvet(200, ne(ru, 'net_zvonka'));
  }
  const nash = (process.env.TWILIO_NOMER_EN || '').trim();
  if (nash && telo.to !== nash) {
    console.log('[perevod] чужой звонок, не на нашу линию:', telo.to);
    return otvet(200, ne(ru, 'chuzhoy'));
  }
  if (telo.status !== 'in-progress') {
    console.log('[perevod] звонок уже не в работе:', telo.status);
    return otvet(200, ne(ru, 'ne_v_rabote'));
  }

  // 2. Переводим. Никого нет — не бросаем в тишине, говорим и кладём трубку.
  const skazhem = ru ? 'Соединяю, одну секунду.' : 'Connecting you now, one moment.';
  const nikogo = ru
    ? 'Никто не поднял трубку. Мы пришлём всё на почту.'
    : 'Nobody picked up. We will send everything to your email instead.';
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say language="${ru ? 'ru-RU' : 'en-US'}"${ru ? '' : ' voice="Polly.Joanna"'}>${skazhem}</Say>` +
    `<Dial timeout="25" callerId="${nash || telo.to}"><Number>${kuda}</Number></Dial>` +
    `<Say language="${ru ? 'ru-RU' : 'en-US'}"${ru ? '' : ' voice="Polly.Joanna"'}>${nikogo}</Say>` +
    `<Hangup/></Response>`;

  const upd = await twilio(`/Calls/${callSid}.json`, { Twiml: twiml });
  if (upd.kod !== 200) {
    console.log('[perevod] Twilio отказал:', upd.kod, JSON.stringify(upd.telo).slice(0, 200));
    return otvet(200, ne(ru, 'twilio'));
  }

  console.log('[perevod] звонок', callSid, 'переведён на', kuda);
  return otvet(200, {
    ok: true, perevedeno: true, call_sid: callSid,
    skazat: skazhem,
    dalshe: ru
      ? 'Перевод пошёл. Больше ничего не говори и не задавай вопросов — дальше человек.'
      : 'The transfer is going through. Say nothing more and ask nothing — a person takes it from here.',
  });
};
