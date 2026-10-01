'use strict';
// Подписи и ключи: всё, что отличает наш вызов от чужого.
//   1) Twilio — X-Twilio-Signature: HMAC-SHA1 (auth token) от полного адреса плюс поля формы,
//      отсортированные по имени (как в zvonok-vhod.js Веры, проверено живым звонком 25.09;
//      здесь ещё повторяющиеся поля и несколько вариантов адреса — см. adresaZaprosa).
//   2) ElevenLabs post-call — заголовок «t=<сек>,v0=<hex>», HMAC-SHA256 от «t.тело»,
//      подпись не старше 30 минут (как в zvonok.js Веры, работает с 13.09).
//   3) Инструменты агента — заголовок x-liniya-klyuch: секрет линии из переменных стенда.
//   4) Метка в адресах, которые потом зовёт Twilio (ширма перевода): HMAC от sid звонка.
// Сравнение везде постоянное по времени и только при равной длине.

const crypto = require('crypto');

function ravny(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (!x.length || x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

// Строка подписи Twilio: URL + для каждого имени по алфавиту — имя и значение
// (повторяющееся поле — все значения по алфавиту).
function podpisTwilio(url, polya, authToken) {
  const para = polya instanceof URLSearchParams ? polya : new URLSearchParams(polya || {});
  let stroka = String(url);
  const imena = [...new Set([...para.keys()])].sort();
  for (const k of imena) {
    for (const v of para.getAll(k).sort()) stroka += k + v;
  }
  return crypto.createHmac('sha1', String(authToken)).update(Buffer.from(stroka, 'utf8')).digest('base64');
}

// Twilio подписывает адрес, который сам вызвал. За Netlify мы видим его в нескольких формах:
// rawUrl события и сборка из x-forwarded-proto + host + путь (+ строка запроса). Подходит любой.
function adresaZaprosa(event) {
  const h = event.headers || {};
  const zag = (k) => h[k] ?? h[k.toLowerCase()] ?? Object.entries(h).find(([n]) => n.toLowerCase() === k.toLowerCase())?.[1];
  const out = new Set();
  const baza = String(process.env.PLATFORMA_URL || '').replace(/\/+$/, '');
  const put = event.path || '';
  const q = event.rawQuery
    ? '?' + event.rawQuery
    : (event.queryStringParameters && Object.keys(event.queryStringParameters).length
      ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '');
  if (event.rawUrl) out.add(String(event.rawUrl));
  const host = zag('host');
  if (host) {
    const proto = String(zag('x-forwarded-proto') || 'https').split(',')[0].trim();
    out.add(`${proto}://${host}${put}${q}`);
    out.add(`${proto}://${host}${put}`);
  }
  if (baza) { out.add(`${baza}${put}${q}`); out.add(`${baza}${put}`); }
  return [...out];
}

// true — запрос подписан Twilio нашим токеном.
function twilioPodpisVerna(event, authToken = process.env.TWILIO_AUTH_TOKEN) {
  if (!authToken) return false;
  const h = event.headers || {};
  const podpis = Object.entries(h).find(([k]) => k.toLowerCase() === 'x-twilio-signature')?.[1];
  if (!podpis) return false;
  const syroe = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const tip = String(Object.entries(h).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || '');
  // Тело формы подписывается полями; JSON-тело Twilio подписывает иначе (bodySHA256) — нам не приходит.
  const polya = /json/i.test(tip) ? new URLSearchParams() : new URLSearchParams(syroe);
  for (const url of adresaZaprosa(event)) {
    if (ravny(podpisTwilio(url, polya, authToken), podpis)) return true;
  }
  return false;
}

// ElevenLabs: «t=1739537297,v0=abc…». {ok, pochemu}.
// Секрет стенда — CARELINE_WEBHOOK_SECRET (HMAC вебхука итога CareLine; в ~/.bidna-golos.env он CARELINE_DEMO_WEBHOOK_SECRET).
// ELEVENLABS_WEBHOOK_SECRET НЕ читаем намеренно: под этим именем в ~/.bidna-golos.env лежит секрет живой Веры
// (проверка 30.09) — перепутали бы при заливке переменных, и стенд принимал бы чужие подписи.
function elevenlabsPodpisVerna(raw, zagolovok, sekret = process.env.CARELINE_WEBHOOK_SECRET, { dopuskSek = 1800, teperMs = Date.now() } = {}) {
  if (!sekret) return { ok: false, pochemu: 'секрет не задан' };
  if (!zagolovok) return { ok: false, pochemu: 'нет заголовка подписи' };
  const chasti = {};
  for (const kusok of String(zagolovok).split(',')) {
    const i = kusok.indexOf('=');
    if (i > 0) chasti[kusok.slice(0, i).trim()] = kusok.slice(i + 1).trim();
  }
  const t = chasti.t, v0 = chasti.v0;
  if (!t || !v0) return { ok: false, pochemu: 'заголовок не разобрался' };
  const vozrast = Math.abs(Math.floor(teperMs / 1000) - parseInt(t, 10));
  if (!Number.isFinite(vozrast) || vozrast > dopuskSek) return { ok: false, pochemu: 'подпись протухла' };
  const nash = crypto.createHmac('sha256', String(sekret)).update(`${t}.${raw}`).digest('hex');
  return ravny(nash, v0) ? { ok: true, pochemu: '' } : { ok: false, pochemu: 'подпись не сошлась' };
}

// Для тестов и прогонов: собрать заголовок ElevenLabs.
function elevenlabsZagolovok(raw, sekret, tSek = Math.floor(Date.now() / 1000)) {
  const v0 = crypto.createHmac('sha256', String(sekret)).update(`${tSek}.${raw}`).digest('hex');
  return `t=${tSek},v0=${v0}`;
}

// x-liniya-klyuch против секрета линии.
function klyuchLiniiVeren(prislannyy, sekret) {
  if (!sekret || String(sekret).length < 16) return false;   // короткий секрет = не настроен
  return ravny(prislannyy, sekret);
}

// Метка в адресах обратного вызова Twilio (ширма, итог перевода, побудка).
function metka(sekret, chto) {
  if (!sekret) return '';
  return crypto.createHmac('sha256', String(sekret)).update(String(chto)).digest('hex').slice(0, 32);
}
function metkaVerna(sekret, chto, prislannaya) {
  if (typeof prislannaya !== 'string' || !/^[0-9a-f]{32}$/.test(prislannaya)) return false;
  return ravny(metka(sekret, chto), prislannaya);
}

module.exports = {
  ravny, podpisTwilio, adresaZaprosa, twilioPodpisVerna, elevenlabsPodpisVerna, elevenlabsZagolovok,
  klyuchLiniiVeren, metka, metkaVerna,
};
