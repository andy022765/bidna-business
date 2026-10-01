// Twilio зовёт сюда, когда запись готова. Складываем связку «звонок → запись → цель прозвона»,
// чтобы карточка компании могла показать запись, не опрашивая Twilio.
// Хранилище не поднялось — не страшно: запись всё равно достаётся по zvonok-zapis.
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const p = Object.fromEntries(new URLSearchParams(event.body || ''));
  const q = event.queryStringParameters || {};
  const zapis = { zapis_sid: p.RecordingSid, sek: Number(p.RecordingDuration || 0),
                  kompaniya: String(q.kompaniya || ''), t: Date.now() };
  console.log('[prozvon] запись готова:', p.CallSid, zapis.sek, 'с · цель', zapis.kompaniya || '—');
  try {
    const store = getStore({ name: 'prozvon', consistency: 'strong' });
    await store.set(`zapis/${p.CallSid}`, JSON.stringify(zapis));
  } catch (e) { console.log('[prozvon] связку не записал:', e.message); }
  return { statusCode: 204, body: '' };
};
