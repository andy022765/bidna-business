// Точка TwiML: браузер Маши просит набрать номер, мы набираем и ПИШЕМ обе стороны.
// Адрес этой функции стоит Voice URL у приложения Twilio (TwiML App).
//
// Зовёт её сам Twilio, не мы. Поэтому проверяем его подпись: иначе любой, кто узнает адрес,
// сможет звонить с нашего номера за наш счёт.
//
// Запись: record-from-answer-dual — две дорожки, наша и собеседника, с момента ответа.
// Уведомление о записи Маша произносит первой фразой (решение Андрея 22.09), и оно попадает
// в саму запись — это и есть доказательство, что уведомление прозвучало.
//
// env: TWILIO_AUTH_TOKEN (для подписи), PROZVON_NOMER (с какого звоним).
const crypto = require('crypto');

const XML = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };
const ekran = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const otvet = (xml) => ({ statusCode: 200, headers: XML, body: `<?xml version="1.0" encoding="UTF-8"?>${xml}` });

// Подпись Twilio: HMAC-SHA1 от полного адреса плюс отсортированные пары поля-значения.
function podpisVerna(event, params) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const h = event.headers || {};
  const dana = h['x-twilio-signature'] || h['X-Twilio-Signature'];
  if (!dana) return false;
  const host = h['x-forwarded-host'] || h.host;
  const url = `https://${host}${event.path}`;
  const stroka = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const nasha = crypto.createHmac('sha1', token).update(Buffer.from(stroka, 'utf-8')).digest('base64');
  const a = Buffer.from(nasha), b = Buffer.from(String(dana));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  const params = Object.fromEntries(new URLSearchParams(event.body || ''));
  if (!podpisVerna(event, params)) {
    console.log('[prozvon] подпись Twilio не сошлась — набор отклонён');
    return otvet('<Response><Say language="ru-RU">Звонок отклонён.</Say><Hangup/></Response>');
  }

  const kuda = String(params.To || '').trim();
  const kompaniya = String(params.kompaniya || '').slice(0, 40);
  const nash = process.env.PROZVON_NOMER;
  // Только номер в международном виде: подставить сюда «sip:» или чужой адрес нельзя.
  if (!/^\+1\d{10}$/.test(kuda) || !nash) {
    console.log('[prozvon] негодный номер:', kuda.slice(0, 6));
    return otvet('<Response><Say language="ru-RU">Номер записан неверно.</Say><Hangup/></Response>');
  }

  const host = (event.headers || {})['x-forwarded-host'] || (event.headers || {}).host;
  const kogdaGotovo = `https://${host}/.netlify/functions/zvonok-zapis-gotova`
    + (kompaniya ? `?kompaniya=${encodeURIComponent(kompaniya)}` : '');
  console.log('[prozvon] набираю', kuda.slice(0, 5) + '…', 'цель', kompaniya || '—');

  // answerOnBridge: Маша слышит настоящие гудки, а не тишину, пока идёт дозвон.
  // timeLimit: страховка от звонка, забытого открытым на весь день.
  return otvet(
    `<Response><Dial callerId="${ekran(nash)}" answerOnBridge="true" timeLimit="1800"`
    + ` record="record-from-answer-dual" trim="do-not-trim"`
    + ` recordingStatusCallback="${ekran(kogdaGotovo)}" recordingStatusCallbackEvent="completed">`
    + `<Number>${ekran(kuda)}</Number></Dial></Response>`);
};
