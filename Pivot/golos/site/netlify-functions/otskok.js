// Отметка владельцу, когда письмо не дошло. Ставится 23.09.2026, подтверждено Андреем 22.09.
//
// ЗАЧЕМ. Это последний открытый класс ошибок в адресах. Домен мы проверяем по MX,
// адрес Вера зачитывает по буквам — но и то и другое пройдёт, если домен ЖИВОЙ,
// а ящика на нём нет: andriii@gmail.com с лишней «и» проходит обе проверки.
// Узнать об этом можно ровно одним способом — по ответу почтового сервера,
// через несколько секунд ПОСЛЕ отправки. Его и слушаем.
//
// Вебхук Resend. Подпись Svix: v1,<base64(hmac-sha256)> от "<id>.<timestamp>.<тело>",
// ключ — base64 после whsec_. Без проверки подписи ручка публичная, и любой слал бы
// нам ложные отскоки; с проверкой — только Resend.
//
// env: RESEND_API_KEY, OTSKOK_SECRET (whsec_… из Resend), GOLOS_VLADELEC.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const OK = { statusCode: 200, body: 'ok' };
const VLADELEC = () => process.env.GOLOS_VLADELEC || 'support@businessinteldna.com';
const DOPUSK_SEK = 300;                       // расхождение часов, как принято у Svix

function hranilishche() {
  try { return getStore({ name: 'otskoki', consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: 'otskoki', siteID, token: t, consistency: 'strong' }); } catch (_) {}
  }
  return null;
}

function podpisVerna(telo, h, secret) {
  const id = h['svix-id'], ts = h['svix-timestamp'], sig = h['svix-signature'];
  if (!id || !ts || !sig || !secret) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > DOPUSK_SEK) return false;
  const klyuch = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const nash = crypto.createHmac('sha256', klyuch).update(`${id}.${ts}.${telo}`).digest('base64');
  const nashB = Buffer.from(nash);
  // В заголовке может лежать несколько версий через пробел: «v1,aaa v1,bbb».
  return String(sig).split(' ').some((ch) => {
    const v = ch.split(',')[1] || '';
    const vB = Buffer.from(v);
    return vB.length === nashB.length && crypto.timingSafeEqual(vB, nashB);
  });
}

const escape = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };
  const telo = event.body || '';
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (!podpisVerna(telo, h, process.env.OTSKOK_SECRET)) {
    console.log('[otskok] подпись не сошлась — молчим');
    return { statusCode: 401, body: 'no' };
  }

  let b = {};
  try { b = JSON.parse(telo); } catch (_) { return OK; }
  const tip = b.type || '';
  if (tip !== 'email.bounced' && tip !== 'email.complained') return OK;   // доставленные не трогаем

  const d = b.data || {};
  const komu = (Array.isArray(d.to) ? d.to : [d.to]).filter(Boolean).join(', ');
  const vlad = VLADELEC();
  // Письмо о неудаче тоже уходит почтой. Если отскочило письмо САМОМУ владельцу,
  // отметка пошла бы ему же, снова отскочила и закрутила петлю. Не шлём.
  if (!komu || komu.toLowerCase().includes(String(vlad).toLowerCase().split('@')[0])) {
    console.log('[otskok] отскок по адресу владельца — петлю не заводим');
    return OK;
  }

  // Resend может повторить доставку вебхука. Один отскок — одна отметка.
  const store = hranilishche();
  const klyuch = 'ot:' + String(d.email_id || h['svix-id'] || komu).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  if (store) {
    try {
      // Проверяем на СУЩЕСТВОВАНИЕ, а не на «истинность»: пустая строка ложна,
      // и с `if (await store.get(k))` дедуп не срабатывал бы никогда. Поймано проверкой.
      const bylo = await store.get(klyuch);
      if (bylo !== null && bylo !== undefined) { console.log('[otskok] уже отмечали'); return OK; }
      await store.set(klyuch, new Date().toISOString());
    } catch (e) { console.log('[otskok] хранилище молчит, шлём без дедупа:', e.message); }
  }

  const bnc = d.bounce || {};
  const navsegda = String(bnc.type || '').toLowerCase() === 'permanent';
  const zhaloba = tip === 'email.complained';
  const chto = zhaloba ? 'Человек пометил наше письмо как спам'
             : navsegda ? 'Письмо НЕ дошло и не дойдёт' : 'Письмо пока не дошло';
  const pochemu = zhaloba
    ? 'Это жалоба, а не ошибка адреса. Больше на этот адрес не пишем.'
    : navsegda
    ? 'Почтовый сервер ответил отказом навсегда. Обычно это опечатка в адресе: '
      + 'домен живой, а ящика на нём нет — такое не ловит ни проверка домена, ни чтение по буквам.'
    : 'Сервер получателя отложил доставку. Может дойти само, может и нет.';
  const delat = zhaloba
    ? 'Ничего не делаем.'
    : navsegda
    ? 'Если знаете, кто это, — напишите ему с другого адреса или другим способом. Он ждёт письма и не получит его.'
    : 'Подождать. Если к утру не дойдёт — считать, что не дошло.';

  const html = `<div style="font:15px/1.6 -apple-system,system-ui,Segoe UI,sans-serif;max-width:620px;color:#111">
    <p style="font-size:17px;margin:0 0 14px"><b>${escape(chto)}</b></p>
    <table style="border-collapse:collapse">
      <tr><td style="padding:3px 12px 3px 0;color:#666">Кому</td><td><b>${escape(komu)}</b></td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#666">Тема</td><td>${escape(d.subject || '—')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#666">Ответ сервера</td><td>${escape(bnc.message || bnc.subType || '—')}</td></tr>
      <tr><td style="padding:3px 12px 3px 0;color:#666">Когда</td><td>${escape(b.created_at || '')}</td></tr>
    </table>
    <p style="margin:16px 0 4px">${escape(pochemu)}</p>
    <p style="margin:0"><b>Что делать:</b> ${escape(delat)}</p>
  </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Business Intelligence DNA <hello@businessinteldna.com>',
        to: [vlad],
        subject: (navsegda || zhaloba ? '⚠ ' : '') + chto + ' — ' + komu,
        html,
      }),
    });
    console.log('[otskok]', tip, r.status, komu);
  } catch (e) {
    console.log('[otskok] упало:', e.message);
  }
  return OK;
};
