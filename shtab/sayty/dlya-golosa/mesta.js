// Сколько мест осталось. ЗАМЕНА прежней версии, которая умела только купон.
//
// Способов честно посчитать место оказалось два, и они не взаимозаменяемы.
//
// 1. СЧЁТ ПО КУПОНУ (max_redemptions − times_redeemed). Работает там, где покупатель
//    реально вводит промокод при оплате: тогда Stripe сам уменьшает остаток. Так устроена
//    диагностика — код FIRST10, погашено 3 из 10. Число живое, проверено.
// 2. СЧЁТ ПО ССЫЛКЕ (restrictions.completed_sessions). Нужен там, где промокода нет
//    и вводить его некому. На лендинге видимости мы обещаем «больше четырёх клиентов
//    в квартал не берём», но купона к этому не привязано — по первому способу счётчик
//    навсегда замер бы на четырёх. Это была бы выдуманная срочность, поданная как живое
//    число, на странице, где мы хвалимся, что ни одна цифра не наша. Здесь Stripe считает
//    покупки сам и закрывает ссылку на пятой: число не просто честное, оно принудительное.
//
// Способ выбирается по виду идентификатора, а не отдельной настройкой: «plink_…» — ссылка,
// всё остальное — купон. Меньше мест, где можно ошибиться.
//
//   GET /.netlify/functions/mesta?p=vidimost  →  {"left":4,"valid":true}
//
// Ключу нужны права на ЧТЕНИЕ купонов и ссылок на оплату (Payment links) — STRIPE_SECRET_KEY.
// Нет ключа, нет идентификатора, Stripe промолчал → {unknown:true}, и страница просто
// не показывает число. Лучше молчать, чем показать выдуманное.

// Белый список: идентификатор берётся из окружения, а не из адреса, иначе по нашему ключу
// можно было бы вычитывать что угодно в аккаунте.
const CHEM_SCHITAT = {
  vidimost:    process.env.STRIPE_SSYLKA_VIDIMOST,   // квартал видимости, $1 500, предел 4
  priemka:     process.env.STRIPE_SSYLKA_PRIEMKA,    // приёмка линии, $450 — предела пока нет
  vera:        process.env.STRIPE_SSYLKA_VERA,       // запуск Веры, $1 000 — предела пока нет
  diagnostika: process.env.STRIPE_KUPON_DIAGNOSTIKA, // «первым 10» — купон, код FIRST10
};

const HEAD = { 'Content-Type': 'application/json; charset=utf-8',
               'Cache-Control': 'public, max-age=120' };   // две минуты: живое, но не ежесекундное

exports.handler = async (event) => {
  const q = (event.queryStringParameters || {});
  const id = CHEM_SCHITAT[String(q.p || '')];
  const key = process.env.STRIPE_SECRET_KEY;
  const molchim = { statusCode: 200, headers: HEAD, body: '{"unknown":true}' };

  if (!id || !key) return molchim;

  const po_ssylke = id.startsWith('plink_');
  const put = (po_ssylke ? 'payment_links/' : 'coupons/') + encodeURIComponent(id);

  try {
    const r = await fetch('https://api.stripe.com/v1/' + put,
                          { headers: { Authorization: 'Bearer ' + key } });
    if (!r.ok) { console.log('[mesta] stripe', r.status, q.p); return molchim; }
    const d = await r.json();

    let left, valid;
    if (po_ssylke) {
      const o = (d.restrictions && d.restrictions.completed_sessions) || null;
      if (!o || typeof o.limit !== 'number') return molchim;   // предела нет — считать нечего
      left = o.limit - (o.completed_count || 0);
      valid = d.active !== false;
    } else {
      if (typeof d.max_redemptions !== 'number') return molchim;  // купон без потолка
      left = d.max_redemptions - (d.times_redeemed || 0);
      valid = d.valid !== false;
    }
    return { statusCode: 200, headers: HEAD,
             body: JSON.stringify({ left: Math.max(0, left), valid: valid }) };
  } catch (e) {
    console.error('[mesta] упал:', e && e.message);
    return molchim;
  }
};
