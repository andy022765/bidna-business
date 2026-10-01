// Кнопка «Leave a Google review» из письма: /k?t=<подпись> → отметка клика → 302 на форму отзыва Google.
// Клик нужен только для одного: не слать напоминание тому, кто уже нажал. Сканеры почты тоже «кликают»,
// ошибка тут в одну сторону — напоминание не уйдёт (PLAN-V1 п. 2). HEAD клик не считает.
// Куда вести, берётся из паспорта по клиенту, не из ссылки: открытого перенаправления нет.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const S = require('../lib/podpis');
const SH = require('../lib/shablony');
const { stranica } = require('../lib/stranica');
N.podklyuchit(blobs);

exports.handler = async (event) => {
  H.nachat(event);
  const q = event.queryStringParameters || {};
  const d = S.proverit(q.t, 'k');
  const k = d && /^[a-z0-9-]{2,30}$/.test(d.k || '') ? K.vzyat(d.k) : null;
  if (!d || !k || !/^[gf]-[A-Za-z0-9_-]{1,130}$/.test(d.v || '') || !K.PLACE_ID.test(k.biznes.place_id || ''))
    return stranica(404, 'Link not found', '<p>This link is not valid.</p>', { yazyk: 'en' });
  if (event.httpMethod === 'GET') {
    const r = await H.pervym(H.store('otzyvy'), `klik/${d.k}/${d.v}`, { t: Date.now(), s: d.s === 2 ? 2 : 1 });
    if (r === null) console.log('[k] клик не записался:', d.k, d.v);
  }
  return { statusCode: 302, headers: { location: SH.napisatOtzyv(k), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex, nofollow' }, body: '' };
};
