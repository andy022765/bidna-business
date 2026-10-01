// Входящий звонок на НАШ номер Twilio → разговор с агентом ElevenLabs.
//
// ЗАЧЕМ ЭТА ФУНКЦИЯ ВООБЩЕ. Родной импорт номера у ElevenLabs («native integration»)
// на наш номер не сработал: их сервер получает от Twilio 401 нашими же ключами,
// хотя те же ключи прямым запросом к Twilio дают 200 (проверено 25.09.2026, дважды,
// плюс через отдельный ключ Twilio — они прямо ответили, что нужен аккаунтный токен).
// Поэтому идём их вторым, документированным путём: номер остаётся полностью нашим,
// а TwiML для соединения выдаёт ElevenLabs методом register-call.
// Цена этого пути — перевод на живого человека не работает: у ElevenLabs нет доступа
// к нашему аккаунту Twilio. Для английской линии перевода и не было.
//
// БЕЗОПАСНОСТЬ. Адрес функции публичный, поэтому: проверяем подпись Twilio (X-Twilio-Signature,
// HMAC-SHA1 по URL и полям тела) и отдельно — что звонили на НАШ номер. Без подписи
// любой мог бы дёргать нас и жечь минуты ElevenLabs.
//
// СУТОЧНЫЙ ПРЕДЕЛ (решение ШТАБа 25.09). Это демо-линия на настоящем телефоне: звонить
// может кто угодно и сколько угодно, а минуты агента платные. У браузерного демо счётчик
// есть, у телефонной ветки не было вовсе. Предел считаем по НОМЕРУ, а не по звонящему:
// защищаемся от расхода, а не от конкретного человека. Ключ — CallSid: Twilio повторяет
// вебхук при сбое, и без этого один звонок списался бы дважды.
// Русской боевой линии это не касается: у неё свой номер и там звонят покупатели.
//
// env: ELEVENLABS_API_KEY · TWILIO_AUTH_TOKEN · GOLOS_AGENTS (линия «en»)
//      · TWILIO_NOMER_EN (какой номер обслуживаем) · TWILIO_PROVERYAT_PODPIS (0 — выключить)
//      · ZVONKOV_V_SUTKI (по умолчанию 20) · ZVONKI_BEZ_KVOTY (свои номера через запятую)

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const V_SUTKI = Number(process.env.ZVONKOV_V_SUTKI || 20);
const den = () => new Date().toISOString().slice(0, 10);

function hranilishche() {
  try { return getStore({ name: 'zvonok-kvota', consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const tok of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: 'zvonok-kvota', siteID, token: tok, consistency: 'strong' }); }
    catch (_) {}
  }
  return null;
}

// true — звонок можно соединять. Хранилище не поднялось — соединяем: молчащий счётчик
// не должен глушить линию, перерасход виден по счёту, а тишина в трубке — нет.
async function mozhnoZvonok(callSid) {
  const store = hranilishche();
  if (!store) { console.log('[zvonok-vhod] счётчик не поднялся — соединяю'); return true; }
  try {
    const { blobs } = await store.list({ prefix: den() + '/' });
    if ((blobs || []).some((b) => b.key.endsWith('/' + callSid))) return true;  // повтор вебхука
    if ((blobs || []).length >= V_SUTKI) return false;
    await store.set(den() + '/' + callSid, '');
    return true;
  } catch (e) {
    console.log('[zvonok-vhod] счётчик не прочитался:', e && e.message);
    return true;
  }
}

const XML = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };
const otboy = (chto) => ({ statusCode: 200, headers: XML,
  body: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-US" voice="Polly.Joanna">`
      + `${chto}</Say><Hangup/></Response>` });

// Подпись Twilio: HMAC-SHA1 от полного URL плюс отсортированные пары поля+значение.
function podpisVerna(event) {
  if (String(process.env.TWILIO_PROVERYAT_PODPIS || '1') === '0') return true;
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  if (!token) return false;
  const h = event.headers || {};
  const podpis = h['x-twilio-signature'] || h['X-Twilio-Signature'] || '';
  if (!podpis) return false;
  const proto = h['x-forwarded-proto'] || 'https';
  const host = h['host'] || h['Host'] || '';
  const url = `${proto}://${host}${event.path || ''}`;
  const pole = new URLSearchParams(event.body || '');
  let stroka = url;
  for (const k of [...pole.keys()].sort()) stroka += k + pole.get(k);
  const nash = crypto.createHmac('sha1', token).update(Buffer.from(stroka, 'utf8')).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(nash), Buffer.from(podpis));
  } catch (_) {
    return false;   // разная длина — точно не наша подпись
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };

  if (!podpisVerna(event)) {
    console.log('[zvonok-vhod] подпись не сошлась — отбой');
    return { statusCode: 403, body: 'no' };
  }

  const p = new URLSearchParams(event.body || '');
  const ot = p.get('From') || '';
  const kuda = p.get('To') || '';
  const nash = (process.env.TWILIO_NOMER_EN || '').trim();
  if (nash && kuda !== nash) {
    console.log('[zvonok-vhod] звонок не на наш номер:', kuda);
    return { statusCode: 403, body: 'no' };
  }

  // Свои номера не едят суточный предел. Иначе обкатка на тридцать сценариев
  // выберет дневную квоту у живых посетителей ещё до обеда.
  // Список задаётся переменной, чтобы номер менялся без правки кода.
  const svoi = (process.env.ZVONKI_BEZ_KVOTY || '')
    .split(',').map((x) => x.trim()).filter(Boolean);
  const bezKvoty = svoi.includes(ot);
  if (bezKvoty) console.log('[zvonok-vhod] свой номер, предел не трогаем:', ot);

  const callSid = p.get('CallSid') || ('bez-sid-' + Date.now());
  if (!bezKvoty && !(await mozhnoZvonok(callSid))) {
    console.log('[zvonok-vhod] суточный предел', V_SUTKI, '— отбой', ot);
    return otboy('The demo line is busy today. Please try the browser demo on our site, '
               + 'business intel D N A dot com.');
  }

  let agenty = {};
  try { agenty = JSON.parse(process.env.GOLOS_AGENTS || '{}'); } catch (_) {}
  const agent = agenty.en;
  if (!agent) {
    console.log('[zvonok-vhod] линии en нет в GOLOS_AGENTS');
    return otboy('Sorry, the line is not available right now. Please try later.');
  }

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/register-call', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
                 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: agent, from_number: ot, to_number: kuda,
                             direction: 'inbound' }),
    });
    const text = await r.text();
    if (!r.ok) {
      console.log('[zvonok-vhod] ElevenLabs отказал:', r.status, text.slice(0, 200));
      return otboy('Sorry, we cannot take the call right now. Please try again in a minute.');
    }
    // Ответ — готовый TwiML. Отдаём Twilio как есть, ничего не достраивая:
    // формат соединения их, и подменять его своими догадками нельзя.
    const twiml = text.trim().startsWith('{') ? (JSON.parse(text).twiml || '') : text;
    if (!twiml.includes('<Response')) {
      console.log('[zvonok-vhod] ответ не похож на TwiML:', text.slice(0, 200));
      return otboy('Sorry, we cannot take the call right now.');
    }
    console.log('[zvonok-vhod] соединяю', ot, '→', kuda, '· агент', agent);
    return { statusCode: 200, headers: XML, body: twiml };
  } catch (e) {
    console.log('[zvonok-vhod] упало:', e && e.message);
    return otboy('Sorry, something went wrong. Please try again later.');
  }
};
