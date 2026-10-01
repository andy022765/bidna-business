// Тревога Андрею в Telegram (бот @business_int_dna_bot) для облачного таргетолога и наших агентов.
// POST {"text": "🤖 Таргетолог: ..."} → sendMessage в чат Андрея. Ключ не нужен (облачным задачам нельзя передавать
// секреты): принимаем только текст с нашим префиксом, до 1500 знаков, не чаще 20 раз в 10 минут на экземпляр функции.
const PREFIX = '🤖 Таргетолог';
let okna = [];
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  let d;
  try { d = JSON.parse(event.body || '{}'); } catch (e) { return { statusCode: 400, body: 'bad json' }; }
  const text = String(d.text || '').trim().slice(0, 1500);
  const keyOk = process.env.TREVOGA_KEY && d.key === process.env.TREVOGA_KEY;
  if (!keyOk && !text.startsWith(PREFIX)) return { statusCode: 403, body: 'prefix' };
  const now = Date.now();
  okna = okna.filter((t) => now - t < 10 * 60 * 1000);
  if (okna.length >= 20) return { statusCode: 429, body: 'slow down' };
  okna.push(now);
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TG_ANDREY_CHAT_ID, text, disable_web_page_preview: true }),
    });
    const j = await r.json().catch(() => ({}));
    return { statusCode: j.ok ? 200 : 502, body: j.ok ? 'OK' : 'TG error' };
  } catch (e) {
    return { statusCode: 502, body: 'TG unreachable' };
  }
};
