// Сколько бесплатных мест осталось в купоне Stripe.
// Нужен ключ только на ЧТЕНИЕ купонов (restricted key) — STRIPE_SECRET_KEY.
// Ключа нет или Stripe не ответил → {unknown:true}, страница показывает промокод как раньше.
exports.handler = async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  const id  = process.env.STRIPE_COUPON_ID || 'uIU2gn3e';
  const head = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (!key) return { statusCode: 200, headers: head, body: JSON.stringify({ unknown: true }) };
  try {
    const r = await fetch('https://api.stripe.com/v1/coupons/' + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + key }
    });
    if (!r.ok) {
      console.log('[promo] stripe', r.status);
      return { statusCode: 200, headers: head, body: JSON.stringify({ unknown: true }) };
    }
    const d = await r.json();
    const max = (typeof d.max_redemptions === 'number') ? d.max_redemptions : null;
    const used = d.times_redeemed || 0;
    const left = max === null ? null : Math.max(0, max - used);
    console.log('[promo] used', used, 'of', max, '| valid', d.valid);
    return { statusCode: 200, headers: head, body: JSON.stringify({ left: left, valid: d.valid !== false }) };
  } catch (e) {
    console.error('[promo] error', e && e.message);
    return { statusCode: 200, headers: head, body: JSON.stringify({ unknown: true }) };
  }
};
