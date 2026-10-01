// Сколько звонков реально ушло в сеть сегодня. Источник правды — журнал Twilio, а не браузер.
//   GET /.netlify/functions/prozvon-schet?k=<ключ>
//   → {"segodnya": 8, "potolok": 20, "ostalos": 12, "nomera": ["+1623…"], "svoi": 2}
//
// Зачем. 22.09 счётчик жил в localStorage Маши и считал НАЖАТИЯ: двадцать попыток, из которых
// десять до сети не дошли — сервер отклонил номера без +1. Она упёрлась в потолок, не сделав
// и половины. Журнал Twilio врать не может: там ровно то, что видел оператор.
// Свои проверочные звонки на наш же номер считаем отдельно — они не идут в потолок.
//
// env: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, PROZVON_NOMER, PROZVON_KLYUCH.
const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const POTOLOK = 20;   // решение Андрея 22.09: не больше двадцати звонков в день

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const klyuch = process.env.PROZVON_KLYUCH;
  if (!klyuch || (q.k || '') !== klyuch) return { statusCode: 404, body: 'Not found' };

  const { TWILIO_ACCOUNT_SID: acc, TWILIO_API_KEY: kl, TWILIO_API_SECRET: sek, PROZVON_NOMER: nash } = process.env;
  const auth = 'Basic ' + Buffer.from(`${kl}:${sek}`).toString('base64');
  // День считаем по календарю Лос-Анджелеса: Маша звонит оттуда, и «сегодня» у неё своё.
  const den = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const adres = `https://api.twilio.com/2010-04-01/Accounts/${acc}/Calls.json`
    + `?From=${encodeURIComponent(nash)}&StartTime%3E=${den}&PageSize=100`;

  let zv = [];
  try {
    const r = await fetch(adres, { headers: { Authorization: auth } });
    if (!r.ok) throw new Error('Twilio ' + r.status);
    zv = (await r.json()).calls || [];
  } catch (e) {
    console.log('[prozvon] журнал не прочитался:', e.message);
    // Не знаем — не врём и не блокируем: пусть страница решает сама.
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ neizvestno: true, potolok: POTOLOK }) };
  }

  const naruzhu = zv.filter((c) => String(c.direction || '').startsWith('outbound'));
  const svoi = naruzhu.filter((c) => c.to === nash);            // проверочные на самих себя
  const chuzhie = naruzhu.filter((c) => c.to !== nash);
  const nomera = [...new Set(chuzhie.map((c) => c.to))];
  return { statusCode: 200, headers: JSON_H, body: JSON.stringify({
    segodnya: chuzhie.length, kompaniy: nomera.length, svoi: svoi.length,
    potolok: POTOLOK, ostalos: Math.max(0, POTOLOK - chuzhie.length), nomera, den }) };
};
