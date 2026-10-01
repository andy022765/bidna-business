// Токен для браузерного звонка Маши (Twilio Voice JS SDK).
//   GET /.netlify/functions/zvonok-token?k=<PROZVON_KLYUCH>
//   → {"token": "...", "identity": "masha", "ttl": 3600}
//
// Зачем это вообще. Прозвон 56 целей: Маша первой фразой уведомляет, что записывает разговор,
// и записи нужны нам, чтобы вернуть этому же бизнесу дословные цитаты его собственной линии.
// Кнопка tel: передавала звонок на айфон — записи не было, то есть мы говорили «я записываю»
// и не записывали. Отсюда браузерный звонок.
//
// Токен собираем руками на crypto: библиотека twilio тянет в бандл несколько мегабайт
// ради одного JWT, а формат у него открытый и стабильный.
//
// env: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWIML_APP_SID, PROZVON_KLYUCH.
const crypto = require('crypto');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))
  .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

exports.handler = async (event) => {
  const klyuch = process.env.PROZVON_KLYUCH;
  const dan = (event.queryStringParameters || {}).k || '';
  // Ключа нет или чужой — отвечаем 404, а не 401: страницы просто «не существует».
  if (!klyuch || dan !== klyuch) return { statusCode: 404, body: 'Not found' };

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_API_KEY: kl, TWILIO_API_SECRET: sek, TWIML_APP_SID: app } = process.env;
  if (!sid || !kl || !sek || !app) {
    console.log('[prozvon] не хватает переменных Twilio');
    return { statusCode: 500, headers: JSON_H, body: JSON.stringify({ oshibka: 'нет настроек Twilio' }) };
  }

  const identity = 'masha';
  const TTL = 3600;
  const iat = Math.floor(Date.now() / 1000);
  const golova = { alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' };
  const telo = {
    jti: `${kl}-${iat}`, iss: kl, sub: sid, iat, exp: iat + TTL,
    grants: { identity, voice: { incoming: { allow: false }, outgoing: { application_sid: app } } },
  };
  const bezPodpisi = `${b64(golova)}.${b64(telo)}`;
  const podpis = crypto.createHmac('sha256', sek).update(bezPodpisi).digest('base64')
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  return { statusCode: 200, headers: JSON_H,
    body: JSON.stringify({ token: `${bezPodpisi}.${podpis}`, identity, ttl: TTL }) };
};
