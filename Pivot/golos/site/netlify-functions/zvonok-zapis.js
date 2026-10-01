// Запись разговора по CallSid. Два режима:
//   GET ?k=<ключ>&sid=<CallSid>          → {"gotovo":true,"url":"…","sek":123} либо {"gotovo":false}
//   GET ?k=<ключ>&sid=<CallSid>&fayl=1   → сам mp3
//
// Наружу ссылку Twilio не отдаём: у них она открыта всем, кто её узнал. Файл забираем сами
// и отдаём только по нашему ключу. Записи используем ровно в одном месте — в письме тому же
// бизнесу, чью линию проверяли (решение Андрея 22.09).
//
// env: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, PROZVON_KLYUCH.
const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const klyuch = process.env.PROZVON_KLYUCH;
  if (!klyuch || (q.k || '') !== klyuch) return { statusCode: 404, body: 'Not found' };
  const sid = String(q.sid || '');
  if (!/^CA[0-9a-f]{32}$/i.test(sid)) return { statusCode: 400, headers: JSON_H, body: JSON.stringify({ oshibka: 'нужен CallSid' }) };

  const { TWILIO_ACCOUNT_SID: acc, TWILIO_API_KEY: kl, TWILIO_API_SECRET: sek } = process.env;
  const auth = 'Basic ' + Buffer.from(`${kl}:${sek}`).toString('base64');
  const spisok = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${acc}/Recordings.json?CallSid=${sid}&PageSize=5`,
    { headers: { Authorization: auth } });
  if (!spisok.ok) {
    console.log('[prozvon] Twilio не отдал список записей:', spisok.status);
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ gotovo: false, prichina: 'Twilio не ответил' }) };
  }
  const z = ((await spisok.json()).recordings || [])[0];
  // Запись появляется через несколько секунд после отбоя — это не ошибка, надо подождать.
  if (!z) return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ gotovo: false }) };

  if (!q.fayl) {
    const host = (event.headers || {})['x-forwarded-host'] || (event.headers || {}).host;
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ gotovo: true,
      url: `https://${host}/.netlify/functions/zvonok-zapis?k=${encodeURIComponent(klyuch)}&sid=${sid}&fayl=1`,
      sek: Number(z.duration || 0), zapis_sid: z.sid }) };
  }

  const media = await fetch(`https://api.twilio.com${z.uri.replace('.json', '')}.mp3`, { headers: { Authorization: auth } });
  if (!media.ok) return { statusCode: 502, headers: JSON_H, body: JSON.stringify({ oshibka: 'файл не забрался' }) };
  const buf = Buffer.from(await media.arrayBuffer());
  return { statusCode: 200, isBase64Encoded: true,
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store',
               'content-disposition': `inline; filename="${sid}.mp3"` },
    body: buf.toString('base64') };
};
