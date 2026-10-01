// Форма «оставьте почту» на демо-странице. Показывается, когда минуты стенда
// на месяц кончились или линия недоступна: исчерпанный лимит не должен терять человека.
//
// Что делает: проверяет адрес → шлёт человеку письмо «с чего начать» тем же pismo.js
// (одна вёрстка, одна логика дублей) → пишет владельцу, что пришла заявка с демо.
// Защита: скрытое поле-ловушка для ботов, 3 заявки с одного IP в сутки. IP меняются легко, поэтому ещё
// (ревью 15.09 №2): письма человеку с формы идут под своим суточным потолком в pismo.js (__forma, не трогает
// звонковый __vsego), а уведомлений владельцу — не больше GOLOS_ZAYAVOK_VLADELCU_V_SUTKI (20) в сутки;
// повтор на тот же адрес (pismo отвечает uzhe) владельцу второй раз не пишется.
// Имя чистит pismo.js: в письмо человеку идёт только похожее на имя и экранированное (ревью №1).
//
// env: GOLOS_PISMO_SECRET, RESEND_API_KEY, GOLOS_VLADELEC, GOLOS_ZAYAVOK_VLADELCU_V_SUTKI, EV_BLOBS_TOKEN, SITE_ID.

const { getStore } = require('@netlify/blobs');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (code, ok, text) => ({ statusCode: code, headers: JSON_H, body: JSON.stringify({ ok, text }) });
const POHOZH = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;
const den = () => new Date().toISOString().slice(0, 10);
const VLADELCU_V_SUTKI = () => +(process.env.GOLOS_ZAYAVOK_VLADELCU_V_SUTKI || 20);

function hranilishche() {
  const name = 'golos-zayavki', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return otvet(405, false, 'Не получилось.');
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}

  // ловушка: живой человек это поле не видит и не заполняет
  if (b.sayt) return otvet(200, true, 'Готово, проверьте почту.');

  const email = String(b.email || '').trim().toLowerCase();
  const imya = String(b.imya || '').trim().slice(0, 60);
  if (!POHOZH.test(email) || email.length > 120)
    return otvet(200, false, 'Проверьте адрес — кажется, в нём ошибка.');

  const h = event.headers || {};
  const ip = (h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || 'net-ip').trim();
  const store = hranilishche();
  if (store) {
    try {
      const k = `${den()}:${ip}`;
      const n = parseInt(await store.get(k) || '0', 10);
      if (n >= 3) return otvet(429, false, 'На сегодня хватит заявок с этого устройства. Напишите нам на support@businessinteldna.com.');
      await store.set(k, String(n + 1));
    } catch (e) { console.log('[zayavka] счётчик:', e.message); }
  }

  const baza = process.env.URL || 'https://dezhurny-r4p8w2.netlify.app';
  let skazat = 'Готово, проверьте почту.';
  // Код Telegram из письма человеку (Доводчик, 15.09). pismo.js отдаёт его форме, только когда блок
  // с кодом реально встал в письмо (DOGON_V_PISME и успешная запись) — иначе уведомление прежнее.
  let kod = '', uzhe = false;
  try {
    const r = await fetch(`${baza}/.netlify/functions/pismo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-golos-secret': process.env.GOLOS_PISMO_SECRET || '', 'x-golos-istochnik': 'forma' },
      body: JSON.stringify({ email, imya, segment: '', shag: 'razbor' }),
    });
    const d = await r.json().catch(() => ({}));
    // «ушло» — только ok:true без otpravleno:false; иначе человеку не врём «проверьте почту»
    if (!d || d.ok !== true || d.otpravleno === false) return otvet(200, false, 'Письмо сейчас не уходит. Напишите нам на support@businessinteldna.com.');
    if (/^[2-9A-HJKMNP-Z]{5}$/.test(String(d.kod || ''))) kod = d.kod;
    uzhe = d.uzhe === true;
    console.log('[zayavka] письмо человеку:', r.status);
  } catch (e) {
    console.log('[zayavka] pismo упало:', e.message);
    return otvet(200, false, 'Письмо сейчас не уходит. Напишите нам на support@businessinteldna.com.');
  }

  const komu = (process.env.GOLOS_VLADELEC || '').split(',').map(s => s.trim()).filter(Boolean);
  let vladelcu = komu.length && process.env.RESEND_API_KEY && !uzhe;
  if (uzhe) console.log('[zayavka] письмо на этот адрес сегодня уже уходило — владельцу повторно не пишу');
  if (vladelcu && store) {
    try {
      const k = `${den()}:__vladelcu`;
      const n = parseInt(await store.get(k) || '0', 10);
      if (n >= VLADELCU_V_SUTKI()) { vladelcu = false; console.log('[zayavka] суточный потолок уведомлений владельцу'); }
      else await store.set(k, String(n + 1));
    } catch (e) { console.log('[zayavka] счётчик уведомлений:', e.message); }
  }
  if (vladelcu) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: 'Business Intelligence DNA <hello@businessinteldna.com>',
          to: komu, reply_to: [email],
          subject: `Заявка с демо Веры: ${email}`,
          text: `Человек хотел поговорить с Верой на сайте, но линия была недоступна (минуты кончились или сбой).\n\nОставил почту: ${email}${imya ? '\nИмя: ' + imya : ''}${kod ? '\nКод Telegram: ' + kod : ''}\n\nЕму уже ушло письмо со ссылкой на бесплатный список работ. Ответ на это письмо уйдёт ему напрямую.`,
        }),
      });
    } catch (e) { console.log('[zayavka] уведомление владельцу:', e.message); }
  }
  return otvet(200, true, skazat);
};
