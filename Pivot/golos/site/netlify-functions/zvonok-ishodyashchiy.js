// Исходящий тестовый звонок: наш агент-покупатель звонит на линию клиента.
//
// ЗАЧЕМ. Обкатка перед запуском — тридцать звонков по сетке: часы, цена, работа,
// которой нет, запись, просьба о человеке, сбивчивая речь, опасные вопросы.
// Руками это три часа на клиента; машиной — двадцать минут.
//
// КАК. Дозвонщик просит Twilio позвонить на номер клиента и даёт этот адрес как VoiceUrl.
// Клиент снял трубку → Twilio стучит сюда → мы регистрируем ИСХОДЯЩИЙ разговор
// у ElevenLabs (register-call, direction: outbound) для агента-покупателя и отдаём TwiML.
// Сценарий приезжает в адресе и подставляется агенту переменной {{scenariy}}.
//
// ПОЧЕМУ СЦЕНАРИЙ В АДРЕСЕ, А НЕ В ХРАНИЛИЩЕ. Он короткий, одна фраза, и так его видно
// в журнале Twilio рядом со звонком — при разборе это дороже аккуратности.
// Подделать нельзя: Twilio подписывает адрес целиком, вместе с параметрами.
//
// СЧЁТ МИНУТ ОТДЕЛЬНО. Каждый тестовый звонок пишется в хранилище `obkatka-minuty`
// с длительностью. Это нужно, чтобы Андрей мог решить, списывать ли обкатку с лимита
// клиента, и чтобы решение можно было принять ПОСЛЕ, а не переделывать потом.
//
// env: ELEVENLABS_API_KEY · TWILIO_AUTH_TOKEN · OBKATKA_AGENT (агент-покупатель)
//      · TWILIO_PROVERYAT_PODPIS (0 — выключить) · PUBLICHNYY_ADRES (адрес туннеля)

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const XML = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };
const otboy = () => ({ statusCode: 200, headers: XML,
  body: '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>' });

function podpisVerna(event) {
  if (String(process.env.TWILIO_PROVERYAT_PODPIS || '1') === '0') return true;
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  if (!token) return false;
  const h = event.headers || {};
  const podpis = h['x-twilio-signature'] || h['X-Twilio-Signature'] || '';
  if (!podpis) return false;
  // Подпись считается по ПОЛНОМУ адресу, ВМЕСТЕ с параметрами: иначе сценарий можно
  // подменить на «дайте скидку» и агент честно отработает чужую команду.
  //
  // ГРАБЛЯ. Twilio подписывает ТОТ адрес, который мы ему дали в VoiceUrl. А функция видит
  // адрес, которым к ней пришли, — и это разные строки, когда между ними туннель:
  // наружу `https://…netlify.live/…`, внутрь `http://localhost:8888/…`. Поэтому сверяем
  // не одну строку, а несколько кандидатов. Безопасность от этого не страдает: подпись
  // всё равно считается нашим секретом, подделать любой из кандидатов нельзя.
  const proto = h['x-forwarded-proto'] || 'https';
  const host = h['host'] || h['Host'] || '';
  // Строку запроса берём СЫРУЮ: пересборка из разобранных полей меняет порядок
  // и кодировку, и подпись перестаёт сходиться.
  const zapros = event.rawQuery
    || (event.rawUrl && event.rawUrl.includes('?') ? event.rawUrl.split('?').slice(1).join('?') : '');
  const hvost = (event.path || '') + (zapros ? '?' + zapros : '');
  // `baza` кладёт дозвонщик — это адрес, по которому он стучится снаружи. Она лежит
  // ВНУТРИ подписанного адреса, поэтому чужой её не подставит: подпись не сойдётся.
  const izZaprosa = new URLSearchParams(zapros).get('baza') || '';
  const kandidaty = [
    event.rawUrl && event.rawUrl.startsWith('http') ? event.rawUrl : null,
    host ? `${proto}://${host}${hvost}` : null,
    /^https?:\/\/[^/]+$/.test(izZaprosa) ? izZaprosa + hvost : null,
    (process.env.PUBLICHNYY_ADRES || '').replace(/\/+$/, '')
      ? process.env.PUBLICHNYY_ADRES.replace(/\/+$/, '') + hvost : null,
  ].filter(Boolean);

  const pole = new URLSearchParams(event.body || '');
  const kljuchi = [...pole.keys()].sort();
  const schitat = (url) => {
    let stroka = url;
    for (const k of kljuchi) stroka += k + pole.get(k);
    return crypto.createHmac('sha1', token).update(Buffer.from(stroka, 'utf8')).digest('base64');
  };

  for (const url of kandidaty) {
    const nash = schitat(url);
    try { if (crypto.timingSafeEqual(Buffer.from(nash), Buffer.from(podpis))) return true; }
    catch (_) {}
  }
  // Печатаем ровно то, из чего считали, — но не саму подпись.
  console.log('[obkatka] подпись не сошлась ни по одному адресу:', JSON.stringify(kandidaty));
  return false;
}

function hranilishche() {
  try { return getStore({ name: 'obkatka-minuty', consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: 'obkatka-minuty', siteID, token: t, consistency: 'strong' }); }
    catch (_) {}
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };
  if (!podpisVerna(event)) {
    console.log('[obkatka] подпись не сошлась — отбой');
    return { statusCode: 403, body: 'no' };
  }

  const q = event.queryStringParameters || {};
  const scenariy = String(q.s || '').slice(0, 400);
  const nomerScenariya = String(q.id || '').slice(0, 40);
  if (!scenariy) { console.log('[obkatka] сценарий не пришёл'); return otboy(); }

  const agent = (process.env.OBKATKA_AGENT || '').trim();
  if (!agent) { console.log('[obkatka] OBKATKA_AGENT не задан'); return otboy(); }

  const p = new URLSearchParams(event.body || '');
  const ot = p.get('From') || '';
  const kuda = p.get('To') || '';
  const callSid = p.get('CallSid') || '';

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/twilio/register-call', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
                 'content-type': 'application/json' },
      body: JSON.stringify({
        agent_id: agent, from_number: ot, to_number: kuda, direction: 'outbound',
        conversation_initiation_client_data: {
          dynamic_variables: { scenariy, nomer_scenariya: nomerScenariya },
        },
      }),
    });
    const text = await r.text();
    if (!r.ok) {
      console.log('[obkatka] ElevenLabs отказал:', r.status, text.slice(0, 200));
      return otboy();
    }
    const twiml = text.trim().startsWith('{') ? (JSON.parse(text).twiml || '') : text;
    if (!twiml.includes('<Response')) {
      console.log('[obkatka] ответ не похож на TwiML:', text.slice(0, 160));
      return otboy();
    }

    // Отметка о звонке: длительность допишет дозвонщик, когда звонок кончится.
    const store = hranilishche();
    if (store) {
      try {
        await store.set(`${new Date().toISOString().slice(0, 10)}/${callSid}`,
          JSON.stringify({ scenariy: nomerScenariya, kuda, t: Date.now() }));
      } catch (e) { console.log('[obkatka] отметка не записалась:', e && e.message); }
    }

    console.log('[obkatka] сценарий', nomerScenariya, '→', kuda);
    return { statusCode: 200, headers: XML, body: twiml };
  } catch (e) {
    console.log('[obkatka] упало:', e && e.message);
    return otboy();
  }
};
