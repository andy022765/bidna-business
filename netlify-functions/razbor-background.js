// Разбор видимости письмом: три движка, по три прогона. Ставится 23.09.2026.
// Решение Андрея дословно: «нахрен не надо слать человеку письмо о том, что к вам придут
// результаты. Просто слать результаты».
//
// ПОЧЕМУ ФОНОВАЯ. Обычная функция Netlify умирает на сороковой секунде (замер 05.09).
// Девять прогонов — около минуты. Имя файла с «-background» даёт пятнадцать минут;
// вызвавший получает 202 сразу и не ждёт.
//
// ДВИЖКИ: ChatGPT, Claude, Perplexity. Google AI Mode НЕ входит — решение Андрея 23.09.
// Доступа к нему у нас нет: Gemini запрещён условиями, а под AI Mode заводился DataForSEO,
// логин и пароль которого так и остались пустыми. Обещать то, чего не делаем, нельзя.
//
// ДЕНЬГИ. Прогон: OpenAI ~$0.03, Anthropic ~$0.08, Perplexity ~$0.006 (замеры Смотрителя).
// Девять прогонов ≈ $0.35 за разбор. Дневной потолок ниже — иначе холодный трафик
// выест кошелёк, общий со Смотрителем.
//
// ЕСЛИ УПАЛО — ВСЁ РАВНО ПИШЕМ. Молчание после «проверьте почту через несколько минут»
// хуже вчерашнего «в течение рабочего дня»: человек решит, что его обманули.

const { getStore } = require('@netlify/blobs');

const MESTO = { type: 'approximate', country: 'US', timezone: 'America/New_York' };
const PROGONOV = Number(process.env.RAZBOR_PROGONOV || 3);
const V_SUTKI = Number(process.env.RAZBOR_V_SUTKI || 10);       // ≈ $3.5/сутки потолком
const SEKRET = () => process.env.RAZBOR_SECRET || '';
const OT = 'Business Intelligence DNA <support@businessinteldna.com>';
// Ссылка оплаты видимости. Решение Андрея 23.09 (через ШТАБ): «сначала оплата во все три места» —
// на лендинге, на «спасибо» и ЗДЕСЬ. Письмо — главное из трёх: человек только что увидел
// чужие имена вместо своего. Цена $1,500 за квартал — из docs/pricing.md, сверено.
const OPLATA = process.env.STRIPE_SSYLKA_VIDIMOST_URL
  || 'https://buy.stripe.com/cNi8wHdvG4RsbPLe6ffrW05';

// Рецепты взяты у Смотрителя (Pivot/agenty/smotritel/progon/progon.py) — они уже
// обкатаны живым замером, выдумывать свои незачем.
const DVIZHKI = [
  { id: 'openai', imya: 'ChatGPT', paralleli: true },
  { id: 'anthropic', imya: 'Claude', paralleli: true },
  // Три прогона Perplexity разом отдают 429 — проверено 22.09. Только по очереди.
  { id: 'perplexity', imya: 'Perplexity', paralleli: false },
];

const den = () => new Date().toISOString().slice(0, 10);
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const chisto = (s, n) => String(s == null ? '' : s).replace(/[^\x20-\x7e -￿]/g, ' ')
  .replace(/[<>]/g, ' ').trim().slice(0, n);
const escape = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function openStore() {
  try { return getStore({ name: 'razbor-kvota', consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name: 'razbor-kvota', siteID, token: t, consistency: 'strong' }); } catch (_) {}
  }
  return null;
}

// Тот же разбор списка, что у кнопки: письмо и экран должны считать одинаково,
// иначе человек увидит два разных ответа на один вопрос.
function imena(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*(?:\d+[.)]|[-*•])\s*(.+?)\s*$/);
    if (!m) continue;
    let s = m[1].replace(/\*\*/g, '').replace(/\[(.+?)\]\(.*?\)/g, '$1');
    s = s.split(/\s[—–-]\s|:\s/)[0].trim();
    if (s.length >= 2 && s.length <= 80) out.push(s);
    if (out.length >= 8) break;
  }
  return out;
}

// Одна фирма под двумя именами. Живой прогон 23.09 дал «JA Edwards of America» и
// «JA Edwards of America Roofing» отдельными строками — 3 и 3 вместо 6. Для продукта,
// который меряет «сколько раз вас назвали», это прямое занижение: так же разойдётся
// и имя клиента. Сводим осторожно: только когда одно имя целиком начинает другое
// после снятия юридических хвостов. «Tampa Roofing» и «Tampa Roof Repair» НЕ сольются.
const HVOSTY = /\b(inc|llc|ltd|co|corp|company|services|service|group|and sons|of america)\b\.?/gi;
function klyuch(imya) {
  return String(imya).toLowerCase()
    .replace(/&amp;/g, '&').replace(/[.,'\u2019"]/g, '')
    .replace(HVOSTY, ' ').replace(/\s+/g, ' ').trim();
}
function svesti(spisok) {
  const po_dline = [...spisok].sort((a, b) => klyuch(a.imya).length - klyuch(b.imya).length);
  const itog = [];
  for (const z of po_dline) {
    const k = klyuch(z.imya);
    const rodnya = itog.find((x) => {
      const kx = klyuch(x.imya);
      return k === kx || k.startsWith(kx + ' ') || kx.startsWith(k + ' ');
    });
    if (!rodnya) { itog.push({ imya: z.imya, po: { ...z.po }, vsego: z.vsego }); continue; }
    // Оставляем более короткое имя: оно и есть название, длинное — с припиской.
    for (const d of Object.keys(z.po)) rodnya.po[d] = (rodnya.po[d] || 0) + z.po[d];
    rodnya.vsego += z.vsego;
  }
  return itog;
}

const VOPROS = (trade, city) =>
  `Who is the best ${trade} in ${city}? Give me specific businesses I can call today.\n\n` +
  `Answer with a numbered list of business names only, up to eight, most recommended first. ` +
  `No preamble, no commentary, one name per line.`;

async function sprosit(dv, q) {
  if (dv === 'openai') {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'chat-latest', input: q,
                             tools: [{ type: 'web_search', user_location: MESTO }], tool_choice: 'required' }),
    });
    if (!r.ok) throw new Error('openai ' + r.status);
    const d = await r.json();
    let t = '';
    for (const o of (d.output || [])) for (const c of (o.content || [])) if (c.type === 'output_text') t += c.text + '\n';
    return t;
  }
  if (dv === 'anthropic') {
    // web_search_20250305, не новее: новая версия у Смотрителя дала 259 с и $0.27 против 19 с и $0.08.
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01',
                 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 4000,
                             messages: [{ role: 'user', content: q }],
                             tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5,
                                       user_location: MESTO }] }),
    });
    if (!r.ok) throw new Error('anthropic ' + r.status);
    const d = await r.json();
    return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }
  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.PERPLEXITY_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: q }], max_tokens: 700 }),
  });
  if (!r.ok) throw new Error('perplexity ' + r.status);
  const d = await r.json();
  return ((d.choices || [{}])[0].message || {}).content || '';
}

async function progonyDvizhka(dv, q) {
  const zadacha = () => sprosit(dv.id, q).then(imena).catch((e) => {
    console.log('[razbor] прогон не вышел:', dv.id, e.message); return null;
  });
  if (dv.paralleli) return await Promise.all(Array.from({ length: PROGONOV }, zadacha));
  const out = [];
  for (let i = 0; i < PROGONOV; i++) { out.push(await zadacha()); if (i < PROGONOV - 1) await pauza(1200); }
  return out;
}

async function poslat(pismo) {
  const raw = JSON.stringify(pismo);
  let body = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    body += c > 127 ? '\\u' + ('000' + c.toString(16)).slice(-4) : raw[i];
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body,
  });
  return r.status;
}

// Честное письмо, когда разбора нет. Обещание «через несколько минут» уже дано.
async function pismoZaderzhka(email, trade, city, pochemu) {
  console.log('[razbor] задержка:', pochemu, email);
  return poslat({ from: OT, to: [email], reply_to: ['support@businessinteldna.com'],
    subject: 'Разбор задерживается / Your check is delayed',
    text: 'Мы обещали разбор за несколько минут — он задерживается, и мы пишем сразу, а не молчим.\n\n' +
          `Ваш запрос: ${trade}, ${city}. Он не потерян: доделаем руками и пришлём в течение рабочего дня.\n` +
          'Если к завтрашнему утру письма не будет — ответьте на это, и мы разберёмся.\n\n' +
          '—————————————\n\n' +
          'We promised your check within minutes. It is delayed, and we would rather say so than go quiet.\n\n' +
          `Your request: ${trade}, ${city}. It is not lost — we finish it by hand and send it within one business day.\n` +
          'No email by tomorrow morning? Reply to this one and we will sort it out.\n\n' +
          '—\nBusiness Intelligence DNA · support@businessinteldna.com' });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'no' };
  if (!SEKRET() || (event.headers['x-razbor-secret'] || '') !== SEKRET()) {
    console.log('[razbor] чужой запрос'); return { statusCode: 404, body: 'no' };
  }
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) { return { statusCode: 400, body: 'bad json' }; }
  const email = chisto(b.email, 120), trade = chisto(b.trade, 60), city = chisto(b.city, 60);
  const ru = b.yaz === 'ru';
  if (!/.+@.+\..+/.test(email) || trade.length < 2 || city.length < 2) {
    console.log('[razbor] нечего считать'); return { statusCode: 400, body: 'pusto' };
  }

  // Служебный ключ для своих (25.09). Полоса ПИСЬМА делает первое касание тем же путём,
  // что и посетитель, и без этого их находки съедали бы суточные десять мест.
  // Снимается только СУТОЧНЫЙ потолок; деньги идут в тот же месячный лимит — иначе мы
  // перестанем видеть собственный расход. Свои прогоны пишутся отдельно.
  const nashKlyuch = String(process.env.PROVERKA_NASH_KLYUCH || '').trim();
  const svoy = !!nashKlyuch && String(b.k || '').trim() === nashKlyuch;

  const store = openStore();
  if (store && svoy) {
    try { await store.set(den() + '/svoi/' + Date.now().toString(36), ''); }
    catch (e) { console.log('[razbor] свой прогон не записался:', e.message); }
  } else if (store) {
    try {
      const { blobs } = await store.list({ prefix: den() + '/' });
      // Свои отметки лежат в `<день>/svoi/…` и в потолок посетителей не идут.
      const chuzhih = (blobs || []).filter((x) => !String(x.key).includes('/svoi/')).length;
      if (chuzhih >= V_SUTKI) {
        await pismoZaderzhka(email, trade, city, 'дневной потолок');
        return { statusCode: 200, body: 'potolok' };
      }
      await store.set(den() + '/' + Date.now().toString(36), '');
    } catch (e) { console.log('[razbor] квота недоступна:', e.message); }
  }

  const q = VOPROS(trade, city);
  let rez;
  try {
    rez = await Promise.all(DVIZHKI.map(async (dv) => ({ dv, progony: await progonyDvizhka(dv, q) })));
  } catch (e) {
    await pismoZaderzhka(email, trade, city, 'прогон упал: ' + e.message);
    return { statusCode: 200, body: 'upalo' };
  }

  // Считаем по движкам и всего. Разброс между прогонами — то, ради чего их три.
  const svod = new Map();
  let udachnyh = 0;
  for (const { dv, progony } of rez) {
    for (const spisok of progony) {
      if (!spisok) continue;
      udachnyh++;
      for (const im of new Set(spisok.map((x) => x.trim()))) {
        const k = im.toLowerCase();
        const z = svod.get(k) || { imya: im, po: {}, vsego: 0 };
        z.po[dv.imya] = (z.po[dv.imya] || 0) + 1; z.vsego++;
        svod.set(k, z);
      }
    }
  }
  if (udachnyh === 0) {
    await pismoZaderzhka(email, trade, city, 'все девять прогонов пустые');
    return { statusCode: 200, body: 'pusto' };
  }

  // ЧЕСТНОСТЬ ПИСЬМА (25.09). Раньше письмо всегда говорило «спросили три движка», даже
  // когда один молчал — а 25.09 у OpenAI кончились деньги, и ChatGPT не отвечал вовсе.
  // Называем ровно тех, кто ответил, и отдельно говорим, кто промолчал.
  const otvetili = rez.filter(({ progony }) => (progony || []).some((s) => s && s.length))
                      .map(({ dv }) => dv);
  const SLOVAMI_DV = { 1: 'один движок', 2: 'два движка', 3: 'три движка' };
  const skolkoDv = SLOVAMI_DV[otvetili.length] || (otvetili.length + ' движков');
  const imenaDv = otvetili.map((d) => d.imya);
  const perechen = (a, soyuz) => (a.length > 1
    ? a.slice(0, -1).join(', ') + ' ' + soyuz + ' ' + a[a.length - 1] : (a[0] || ''));
  const spisokDv = perechen(imenaDv, 'и');
  const spisokDvEn = perechen(imenaDv, 'and');
  const molchali = DVIZHKI.filter((d) => !otvetili.includes(d)).map((d) => d.imya);

  const spisok = svesti([...svod.values()])
    .sort((a, b2) => b2.vsego - a.vsego || a.imya.localeCompare(b2.imya)).slice(0, 12);
  const vsegoProgonov = DVIZHKI.length * PROGONOV;
  const stroki = spisok.map((z) => {
    const po = otvetili.map((d) => `${d.imya}: ${z.po[d.imya] || 0}/${PROGONOV}`).join(' · ');
    return `<tr><td style="padding:6px 12px 6px 0"><b>${escape(z.imya)}</b></td>` +
           `<td style="padding:6px 12px 6px 0;white-space:nowrap">${z.vsego} из ${udachnyh}</td>` +
           `<td style="padding:6px 0;color:#666;font-size:13px">${po}</td></tr>`;
  }).join('');

  const html = `<div style="font:15px/1.6 -apple-system,system-ui,Segoe UI,sans-serif;max-width:660px;color:#111">
    <p>Спросили ${skolkoDv} — ${spisokDv}, — кто лучший в вашем деле в вашем городе.
         Каждый по три раза: один прогон спорит сам с собой, поэтому одному числу верить нельзя.</p>
      ${molchali.length ? `<p style="color:#a15c00">Сегодня не ответил${molchali.length > 1 ? 'и' : ''}:
         <b>${molchali.join(', ')}</b> — и в список ниже не попал${molchali.length > 1 ? 'и' : ''}.
         Показываем только то, что действительно спросили.</p>` : ''}
    <p style="color:#666">We asked ${otvetili.length === 1 ? 'one engine' : otvetili.length + ' engines'} — ${spisokDvEn} — who is best in your
         trade in your city. Three runs each, because a single run argues with itself.${molchali.length ? ' Did not answer today: ' + molchali.join(', ') + '.' : ''}</p>
    <p><b>Ваше дело:</b> ${escape(trade)} · <b>город:</b> ${escape(city)} ·
       удачных прогонов ${udachnyh} из ${vsegoProgonov}</p>
    <table style="border-collapse:collapse;margin:16px 0;width:100%">
      <tr><th style="text-align:left;padding:0 12px 6px 0;font-size:13px;color:#666">Кого называют / Who gets named</th>
          <th style="text-align:left;padding:0 12px 6px 0;font-size:13px;color:#666">Сколько раз</th>
          <th style="text-align:left;padding:0 0 6px;font-size:13px;color:#666">По движкам</th></tr>
      ${stroki}
    </table>
    <p>Если вашего имени в этом списке нет — покупатель, который задаст такой вопрос, вас не увидит.
       Он увидит тех, кто выше.</p>
    <p style="color:#666">If your name is not on this list, the buyer who asks this question does not
       see you. They see the names above.</p>
    <div style="border:1px solid #e5e5e5;border-radius:10px;padding:18px;margin:22px 0;background:#fafafa">
      <p style="margin:0 0 4px"><b>Взять видимость на квартал — $1,500</b></p>
      <p style="margin:0 0 14px;color:#444">Три-пять вопросов вашего покупателя, замороженных письменно. Сегодняшний
         замер становится нулевой точкой. Через девяносто дней — тот же протокол и построчная разница.
         <b>Не назвал ни один из трёх движков — возвращаем всё.</b></p>
      <p style="margin:0 0 14px;color:#666">A quarter of visibility work — $1,500. Three to five frozen questions,
         today's run as the baseline, the same protocol on day ninety. If not one of the three engines names
         you, we refund in full.</p>
      <a href="${OPLATA}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;
         padding:11px 22px;border-radius:8px;font-weight:600">Оплатить · Pay</a>
      <p style="margin:12px 0 0;color:#888;font-size:13px">Не готовы платить — просто ответьте на это письмо,
         разберём ваш случай словами. · Not ready to pay? Just reply to this email.</p>
    </div>
    <p style="border-top:1px solid #e5e5e5;padding-top:14px;color:#666">Это нулевая точка, снятая сегодня.
       Что с ней делать — на странице:
       <a href="https://businessinteldna.com/geo">businessinteldna.com/geo</a><br>
       This is today's baseline. What to do with it:
       <a href="https://businessinteldna.com/visibility/">businessinteldna.com/visibility</a></p>
    <p style="color:#666">Business Intelligence DNA · support@businessinteldna.com</p>
  </div>`;

  const st = await poslat({ from: OT, to: [email], reply_to: ['support@businessinteldna.com'],
    subject: ru ? 'Кого называют вместо вас — разбор / Who gets named instead of you'
                : 'Who gets named instead of you / Кого называют вместо вас',
    html });
  console.log('[razbor] отправлен:', st, email, 'имён:', spisok.length,
              'прогонов:', udachnyh + '/' + vsegoProgonov);
  return { statusCode: 200, body: 'ok' };
};
