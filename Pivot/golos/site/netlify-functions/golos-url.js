// Выдаёт странице стенда подписанный WSS-адрес на разговор с агентом ElevenLabs.
// Ключ вендора наружу не уходит: страница получает одноразовый адрес, живёт он минуты.
//
// Защита кошелька. Минута разговора стоит 8-10 центов. Тариф Creator — 275 минут
// в месяц, демо-звонок 3-5 минут, значит месяц это ~60 звонков. Поэтому:
//   1) считаем в трёх корзинах: устройство/сутки, стенд/сутки, стенд/месяц;
//   2) не смогли посчитать — НЕ пускаем (лучше «недоступно», чем слитый тариф);
//   3) списываем только после того, как вендор реально дал адрес.
//
// env: ELEVENLABS_API_KEY (нужно право convai_write — у них выдача адреса считается
//      записью), GOLOS_AGENTS ({"dna":"agent_..."}), SITE_ID, при нужде EV_BLOBS_TOKEN.

const { getStore } = require('@netlify/blobs');

const LIMIT_USTROYSTVO = +(process.env.GOLOS_LIMIT_IP     || 2);   // с устройства в сутки
const LIMIT_DEN        = +(process.env.GOLOS_LIMIT_DEN    || 6);   // со стенда в сутки
const LIMIT_MESYAC     = +(process.env.GOLOS_LIMIT_MESYAC || 10);  // звонков со стенда в месяц

// ГЛАВНЫЙ СТОРОЖ — МИНУТЫ, А НЕ ЗВОНКИ. Вендор списывает минуты: тариф Creator это
// 275 минут в месяц. Считать звонки бессмысленно — один звонок может быть и минуту,
// и шесть. Резервируем при выдаче адреса, а по факту разговора поправляем: zvonok.js
// знает настоящую длительность из вебхука и присылает её сюда.
const LIMIT_MINUT  = +(process.env.GOLOS_LIMIT_MINUT  || 200);  // минут со стенда в месяц
const REZERV_MINUT = +(process.env.GOLOS_REZERV_MINUT || 6);    // столько занимаем авансом

const den    = () => new Date().toISOString().slice(0, 10);   // 2026-09-12
const mesyac = () => new Date().toISOString().slice(0, 7);    // 2026-09

function hranilishche() {
  const name = 'golos-kvota', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN,
                       process.env.NETLIFY_AUTH_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otkaz = (code, error, text) => ({ statusCode: code, headers: JSON_H,
                                        body: JSON.stringify({ error, text }) });

exports.handler = async (event) => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return otkaz(503, 'net_klyucha', 'Стенд сейчас недоступен.');

  let agenty = {};
  try { agenty = JSON.parse(process.env.GOLOS_AGENTS || '{}'); } catch (_) {}
  const liniya = String((event.queryStringParameters || {}).liniya || 'dna');
  const agentId = agenty[liniya];
  if (!agentId) return otkaz(400, 'net_linii', 'Такой линии нет.');

  // Наш собственный ключ: мы с Андреем тестируем помногу, и незачем этим есть
  // бюджет, который посчитан на посетителей. Ссылка со ?k=<секрет> квоту не трогает.
  const nash = process.env.GOLOS_NASH_KLYUCH;
  const params = event.queryStringParameters || {};
  if (nash && params.k === nash) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { 'xi-api-key': key } });
      if (!r.ok) {
        console.log('[свои] ElevenLabs отказал:', r.status, (await r.text()).slice(0, 200));
        return otkaz(502, 'vendor', 'Линия сейчас занята. Попробуйте через минуту.');
      }
      const u = (await r.json()).signed_url;
      if (!u) return otkaz(502, 'vendor', 'Линия сейчас занята.');
      return { statusCode: 200, headers: JSON_H,
               body: JSON.stringify({ signed_url: u, liniya, svoy: true }) };
    } catch (e) {
      console.log('[свои] упало:', e.message);
      return otkaz(500, 'server', 'Стенд сейчас недоступен.');
    }
  }

  // --- считаем, но пока не списываем
  const store = hranilishche();
  if (!store) {
    console.log('блобы не поднялись — считать квоту нечем, звонок отклонён');
    return otkaz(503, 'kvota_nedostupna', 'Стенд сейчас недоступен. Попробуйте позже.');
  }

  const h = event.headers || {};
  const ip = (h['x-nf-client-connection-ip'] ||
              (h['x-forwarded-for'] || '').split(',')[0] || 'net-ip').trim();
  const kUstr = `${den()}:${ip}`, kDen = `${den()}:__den`, kMes = `${mesyac()}:__mesyac`;

  const kMin = `${mesyac()}:__minut`;
  let nUstr, nDen, nMes, nMin;
  try {
    [nUstr, nDen, nMes, nMin] = (await Promise.all([
      store.get(kUstr), store.get(kDen), store.get(kMes), store.get(kMin)]))
      .map(v => parseFloat(v || '0'));
  } catch (e) {
    console.log('счётчик квоты не читается:', e.message);
    return otkaz(503, 'kvota_nedostupna', 'Стенд сейчас недоступен. Попробуйте позже.');
  }

  if (nMin + REZERV_MINUT > LIMIT_MINUT)
    return otkaz(429, 'kvota_minut', 'Стенд на этот месяц отговорил. Напишите нам — покажем живьём.');
  if (nMes  >= LIMIT_MESYAC)
    return otkaz(429, 'kvota_mesyac', 'Стенд на этот месяц отговорил. Напишите нам — покажем живьём.');
  if (nDen  >= LIMIT_DEN)
    return otkaz(429, 'kvota_den', 'Стенд сегодня перегружен. Возвращайтесь завтра.');
  if (nUstr >= LIMIT_USTROYSTVO)
    return otkaz(429, 'kvota_ustroystvo', 'На сегодня звонки с этого устройства закончились. Возвращайтесь завтра.');

  // --- идём к вендору
  let signed;
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': key } });
    const text = await r.text();
    if (!r.ok) {
      console.log('ElevenLabs отказал:', r.status, text.slice(0, 300));
      return otkaz(502, 'vendor', 'Линия сейчас занята. Попробуйте через минуту.');
    }
    signed = JSON.parse(text).signed_url;
    if (!signed) return otkaz(502, 'vendor', 'Линия сейчас занята. Попробуйте через минуту.');
  } catch (e) {
    console.log('golos-url упал:', e.message);
    return otkaz(500, 'server', 'Стенд сейчас недоступен.');
  }

  // --- адрес получен: только теперь списываем
  try {
    await Promise.all([
      store.set(kUstr, String(nUstr + 1)),
      store.set(kDen,  String(nDen  + 1)),
      store.set(kMes,  String(nMes  + 1)),
      store.set(kMin,  String(nMin  + REZERV_MINUT)),   // аванс, поправится по факту
    ]);
  } catch (e) {
    console.log('не записался счётчик (звонок уже выдан):', e.message);
  }

  return { statusCode: 200, headers: JSON_H,
           body: JSON.stringify({ signed_url: signed, liniya,
                                  ostalos_v_mesyac: LIMIT_MESYAC - nMes - 1,
                                  ostalos_minut: Math.round(LIMIT_MINUT - nMin - REZERV_MINUT) }) };
};
