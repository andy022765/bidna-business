// Приём событий Stripe для партнёрской программы. Решения Андрея 26.09.2026.
//
// Что делает: опознаёт, кто привёл заплатившего, считает комиссию по таблице товаров,
// пишет строку в «кому сколько должны» и шлёт два письма — партнёру и Андрею.
// Чего НЕ делает: не платит. Выплата ручная до пятого партнёра, Stripe Connect не строим.
//
// Адрес в Stripe: /.netlify/functions/stripe-oplata
// События: checkout.session.completed, invoice.paid, charge.refunded
// Переменные: STRIPE_WEBHOOK_SECRET (whsec_…), RESEND_API_KEY, BIDNA_MAIL
const crypto = require('crypto');
const { TOVARY, otkryt, chistyyKod, hvost, chistayaPochta, razobratSsylku,
        ktoPrivyol, privyazat, tovarPoKasse, potolokKomissii } = require('./referal/lib.js');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const ok = (telo) => ({ statusCode: 200, headers: JSON_H, body: JSON.stringify(telo || { ok: true }) });
const dollary = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

// Подпись Stripe: t=…,v1=… . Сверяем сами, без их библиотеки — одна функция вместо зависимости.
// Окно пять минут: и от повтора чужой записи, и от рассинхрона часов.
function podpisVerna(telo, zagolovok, sekret) {
  if (!sekret || !zagolovok) return false;
  const chasti = {};
  for (const p of String(zagolovok).split(',')) {
    const i = p.indexOf('=');
    if (i > 0) (chasti[p.slice(0, i).trim()] ||= []).push(p.slice(i + 1).trim());
  }
  const t = (chasti.t || [])[0];
  const nashi = chasti.v1 || [];
  if (!t || !nashi.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > 300) {
    console.log('[stripe] подпись просрочена, отметка', t);
    return false;
  }
  const zhdyom = crypto.createHmac('sha256', sekret).update(`${t}.${telo}`, 'utf8').digest('hex');
  const a = Buffer.from(zhdyom, 'utf8');
  return nashi.some((v) => {
    const b = Buffer.from(String(v), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

async function pismo({ komu, tema, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log('[stripe] RESEND_API_KEY нет, письмо не ушло:', tema); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'Business Intelligence DNA <support@businessinteldna.com>',
                             to: [komu], reply_to: ['support@businessinteldna.com'], subject: tema, html }),
    });
    if (!r.ok) console.log('[stripe] Resend отказал:', r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.log('[stripe] письмо упало:', e.message); return false; }
}

const id0 = (ob) => String((ob && ob.id) || '');
const ekran = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: JSON_H, body: '{"ok":false}' };

  // Подпись считается по СЫРОМУ телу. Netlify отдаёт его в base64, когда так решил сам:
  // распарсить и собрать обратно нельзя — порядок полей поедет, и подпись не сойдётся.
  const syroe = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const h = event.headers || {};
  const zagolovok = h['stripe-signature'] || h['Stripe-Signature'];
  if (!podpisVerna(syroe, zagolovok, process.env.STRIPE_WEBHOOK_SECRET)) {
    console.log('[stripe] подпись не сошлась — отбой');
    return { statusCode: 400, headers: JSON_H, body: '{"ok":false,"pochemu":"podpis"}' };
  }

  let sob = {};
  try { sob = JSON.parse(syroe); } catch (_) { return ok({ ok: false, pochemu: 'ne-json' }); }
  const tip = sob.type || '';
  const ob = (sob.data && sob.data.object) || {};

  const store = otkryt();
  if (!store) { console.log('[stripe] хранилище не поднялось'); return ok({ ok: false, pochemu: 'net-hranilishcha' }); }

  // Возврат: строку не удаляем и у партнёра НЕ удерживаем (решение Андрея) — помечаем,
  // чтобы на странице было видно и мы не заплатили дважды по одному клиенту.
  if (tip === 'charge.refunded') {
    const pi = ob.payment_intent || ob.id;
    try {
      for (const b of (await store.list({ prefix: 'oplata:' })).blobs || []) {
        const v = JSON.parse((await store.get(b.key)) || 'null');
        if (!v || (v.platyozh !== pi && v.id !== pi)) continue;
        v.vozvrat = { kogda: new Date().toISOString(), summa_c: ob.amount_refunded || 0 };
        await store.set(b.key, JSON.stringify(v));
        console.log('[stripe] возврат помечен:', b.key);
      }
    } catch (e) { console.log('[stripe] возврат не пометить:', e.message); }
    return ok();
  }

  if (tip !== 'checkout.session.completed' && tip !== 'invoice.paid') return ok({ ok: true, propushcheno: tip });

  // Первый счёт подписки — ЭТО ТЕ ЖЕ ДЕНЬГИ, что и сессия оплаты. Поймано живой
  // тестовой оплатой 26.09.2026: касса Веры ($1000 + $199/мес) дала оба события,
  // причём invoice.paid пришёл на секунду РАНЬШЕ сессии — привязки ещё не было,
  // и он лёг второй строкой «не опознано» на те же $1199. Одна оплата, два следа:
  // мы бы решили, что потеряли партнёра, а деньги посчитали бы дважды.
  // Разовые кассы такого счёта не создают, так что теряется здесь только дубль.
  const povod = String(ob.billing_reason || '');
  if (tip === 'invoice.paid' && povod === 'subscription_create') {
    console.log('[stripe] первый счёт подписки пропущен, его считает сессия:', id0(ob));
    return ok({ ok: true, propushcheno: 'subscription_create' });
  }

  const id = ob.id || '';
  if (!id) return ok({ ok: false, pochemu: 'net-id' });

  // Идемпотентность. Stripe повторяет доставку, пока не получит 200: без этой проверки
  // одна оплата дала бы партнёру две строки и два письма.
  const klyuchOplaty = `oplata:${id}`;
  try { if (await store.get(klyuchOplaty)) { console.log('[stripe] уже посчитано:', id); return ok({ ok: true, povtor: true }); } }
  catch (e) { console.log('[stripe] проверка повтора не прошла:', e.message); }

  const kd = ob.customer_details || {};
  const pochta = chistayaPochta(kd.email || ob.customer_email || '');
  const telefon = kd.phone || ob.customer_phone || '';
  const kogda = new Date((sob.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const summa_c = Number(ob.amount_total ?? ob.amount_paid ?? 0) || 0;

  // Откуда берётся товар и партнёр. По ссылке — из client_reference_id («код_товар»).
  // По счёту, выставленному руками, этого поля нет вовсе: тогда партнёр ищется
  // по почте и телефону, а товар остаётся неизвестным и ставится руками.
  const izSsylki = razobratSsylku(ob.client_reference_id || '');
  let kod = izSsylki.kod;
  let kak = kod ? 'ssylka' : '';
  let spor = null;
  if (!kod) {
    const najden = await ktoPrivyol(store, pochta, telefon);
    kod = najden.kod; spor = najden.spor;
    if (kod) kak = 'privyazka';
  }
  if (kod) await privyazat(store, { pochta, telefon, kod, kak: 'avto', kogda });

  // Месячное продление подписки — это абонентка, и называть её надо так, а не
  // «не опознанный товар»: строка должна читаться, а не вызывать вопросы.
  let tovar = izSsylki.tovar && TOVARY[izSsylki.tovar] ? izSsylki.tovar : 'inoe';
  if (tovar === 'inoe' && povod === 'subscription_cycle') tovar = 'abon';
  // Метки нет, но деньги пришли через нашу кассу — спросим товар у Stripe.
  // Иначе партнёр, которого нашли по привязке, остался бы без комиссии просто потому,
  // что человек кликнул ссылку на телефоне, а купил с компьютера. Поймано живой
  // тестовой оплатой 26.09.2026: $1500 за Видимость легли как «не опознанный товар».
  if (tovar === 'inoe' && ob.payment_link) {
    const najden = await tovarPoKasse(ob.payment_link);
    if (najden) { tovar = najden; console.log('[stripe] товар опознан по кассе:', najden); }
  }
  const opisanieTovara = (TOVARY[tovar] || TOVARY.inoe).imya;

  // «20% с ПЕРВОЙ покупки каждого продукта». Второй раз тот же продукт тому же
  // человеку комиссии не даёт; продления и абонентка не дают её никогда.
  const klient = pochta || (hvost(telefon) ? 'tel:' + hvost(telefon) : '');
  const klyuchKupil = klient ? `kupil:${klient}:${tovar}` : '';
  let uzheBral = false;
  if (klyuchKupil) { try { uzheBral = !!(await store.get(klyuchKupil)); } catch (_) {} }

  const zapis = TOVARY[tovar] || TOVARY.inoe;
  let komissiya_c = zapis.komissiya_c;
  // Чек меньше обычного — купон, подарок, нулевая оплата: фиксированная сумма из таблицы
  // превратилась бы в выплату из нашего кармана.
  const doPotolka = komissiya_c;
  komissiya_c = potolokKomissii(komissiya_c, summa_c);
  const srezano = komissiya_c < doPotolka;
  let pochemuNol = '';
  // «Товара не знаем» и «комиссии нет по правилу» — разные вещи, и на странице они
  // должны читаться по-разному: правило Андрея от 27.09 — 20% с первой покупки ЛЮБОГО
  // продукта, включая те, которых ещё нет. Новая касса не должна выглядеть как отказ.
  if (spor) pochemuNol = 'спор между привязками — решается руками';
  else if (!kod) pochemuNol = 'партнёр не опознан';
  else if (zapis.ne_znaem) pochemuNol = 'товар не опознан — допишите товар и комиссию руками';
  else if (uzheBral) { komissiya_c = 0; pochemuNol = 'этот продукт клиент уже брал'; }
  else if (!komissiya_c && srezano) pochemuNol = 'чек нулевой — платить не с чего';
  else if (!komissiya_c) pochemuNol = 'по этому товару комиссии нет';
  else if (srezano) pochemuNol = 'срезано до пятой части чека';
  // Спорное не платим до решения человека (решение ШТАБА 26.09): строку показываем
  // с обоими кодами, но в «к выплате» она не попадает.
  if (!kod || spor) komissiya_c = 0;

  let partnyor = null;
  if (kod) { try { partnyor = JSON.parse((await store.get(`kod:${kod}`)) || 'null'); } catch (_) {} }
  if (kod && !partnyor) pochemuNol = pochemuNol || 'кода нет в списке партнёров';
  if (kod && !partnyor) komissiya_c = 0;

  const stroka = { id, tip, kogda, summa_c, tovar, opisanie: opisanieTovara,
                   ne_znaem: !!zapis.ne_znaem,
                   kod: kod || '', kak: kak || '', spor: spor || null,
                   komissiya_c, pochemu_nol: pochemuNol || '',
                   pochta, telefon: hvost(telefon), platyozh: ob.payment_intent || '',
                   vyplacheno: null, vozvrat: null };
  try { await store.set(klyuchOplaty, JSON.stringify(stroka)); }
  catch (e) { console.log('[stripe] строку не записать:', e.message); return ok({ ok: false, pochemu: 'ne-zapisalos' }); }
  if (klyuchKupil) { try { await store.set(klyuchKupil, kogda); } catch (_) {} }

  // Письма только когда есть кому и за что. Партнёру — ФАКТ и СУММА, без данных
  // клиента: он их не покупал, и мы под NDA.
  if (komissiya_c > 0 && partnyor && partnyor.pochta) {
    await pismo({ komu: partnyor.pochta,
      tema: 'Ваш клиент оплатил — Business Intelligence DNA',
      html: `<p>${ekran(partnyor.imya || '')}, здравствуйте!</p>`
        + `<p>Клиент, пришедший по вашей ссылке, оплатил: <b>${ekran(opisanieTovara)}</b>, `
        + `${dollary(summa_c)}.</p>`
        + `<p>Ваше вознаграждение — <b>${dollary(komissiya_c)}</b>.</p>`
        + `<p>Мы позвоним вам, чтобы взять реквизиты для выплаты.</p>` });
  }
  const komuNam = process.env.BIDNA_MAIL || 'support@businessinteldna.com';
  await pismo({ komu: komuNam,
    tema: komissiya_c > 0
      ? `Оплата по партнёру ${kod} — ${dollary(komissiya_c)} к выплате`
      : `Оплата без выплаты партнёру — ${opisanieTovara}`,
    html: `<p><b>${ekran(opisanieTovara)}</b>, ${dollary(summa_c)}, ${ekran(kogda)}</p>`
      + `<p>Клиент: ${ekran(pochta || '—')} ${ekran(hvost(telefon) || '')}</p>`
      + (kod
          ? `<p>Привёл: <b>${ekran((partnyor && partnyor.imya) || kod)}</b> (код ${ekran(kod)}), `
            + `телефон ${ekran((partnyor && partnyor.telefon) || '—')}, почта ${ekran((partnyor && partnyor.pochta) || '—')}</p>`
          : `<p><b>Партнёр не опознан</b> — строка ушла в «не опознано».</p>`)
      + `<p>К выплате: <b>${dollary(komissiya_c)}</b>${pochemuNol ? ` — ${ekran(pochemuNol)}` : ''}</p>`
      + (spor ? `<p><b>Спор:</b> на этого клиента заведены коды ${ekran(spor.join(', '))}. `
                + `Считаем по более ранней привязке, проверьте руками.</p>` : '') });

  console.log('[stripe] посчитано:', id, tovar, kod || 'без партнёра', komissiya_c);
  return ok({ ok: true, kod: kod || null, tovar, komissiya_c });
};
