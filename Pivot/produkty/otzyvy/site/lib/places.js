// Google Places API (New), Place Details: ТОЛЬКО rating и userRatingCount (PLAN-DLYA-ANDREYA п. 7).
// Тексты отзывов не запрашиваем, не храним и в Claude не отдаём — так читаются условия Google Maps
// Platform (хранить можно только place_id). У нас лежат лишь два числа ПОСЛЕДНЕГО опроса — чтобы
// заметить новый отзыв; они перезаписываются каждым опросом и живут не дольше 30 дней. Истории
// (чисел на начало месяца) нет с ревью 29.09: отчёт берёт рейтинг живым запросом. Это всё равно
// серая зона условий — решение за Андреем (CHITAT.md, «Открыто»).
//
// Деньги: SKU Place Details Enterprise, $20 за 1000, первые 1000 в месяц бесплатно. Потолок 40 запросов
// в сутки НА ВСЕ карточки (lib/limity.js): даже при сбое больше ~$4 в месяц сверх бесплатной тысячи
// не спишется (40 × 30 = 1 200). Опрос только днём — ~5 запросов на клиента в сутки. Запрос
// считается ДО отправки — Google берёт деньги и за неудачный.

const H = require('./hranilishche');
const L = require('./limity');

async function rejting(s, placeId) {
  const key = process.env.OTZYVY_PLACES_KEY;
  if (!key) return { ok: false, oshibka: 'нет OTZYVY_PLACES_KEY' };
  const lk = L.kl.places(Date.now());
  if (!(await L.estMesto(s, lk, L.POTOLKI.places()))) return { ok: false, potolok: true, oshibka: 'потолок запросов Google Maps на сутки' };
  if (!(await H.pribavit(s, lk))) return { ok: false, oshibka: 'счётчик запросов не пишется — без счёта не спрашиваем' };
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId), {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount' }, signal: ctrl.signal });
    const t = await r.text();
    if (!r.ok) { console.log('[places] Google ответил', r.status, t.slice(0, 200)); return { ok: false, kod: r.status, oshibka: 'Google ответил ' + r.status }; }
    let d = {}; try { d = JSON.parse(t); } catch (_) { return { ok: false, oshibka: 'ответ не JSON' }; }
    // У карточки без отзывов Google не отдаёт ни rating, ни userRatingCount.
    return { ok: true, rating: typeof d.rating === 'number' ? d.rating : null,
             count: Number.isInteger(d.userRatingCount) ? d.userRatingCount : 0 };
  } catch (e) {
    return { ok: false, oshibka: e.name === 'AbortError' ? 'таймаут' : e.message };
  } finally { clearTimeout(tm); }
}

// Что можно сказать о новых отзывах по двум опросам. Google отдаёт рейтинг, округлённый до десятой,
// поэтому средняя оценка новых отзывов известна лишь в границах [lo, hi]. Тревога:
//  • tochno — даже верхняя граница не выше порога (средняя новых ≤ 3★, значит хоть один ≤ 3★);
//  • snizilsya — рейтинг упал и нижняя граница не выше порога (плохой отзыв возможен и вероятен).
// На карточке с сотнями отзывов один отзыв на 1★ часто не сдвигает округлённый рейтинг — такой
// опрос его не увидит. Надёжно ловят только письма Google менеджеру (после первого клиента).
function ocenka(bylo, stalo, porog) {
  const n1 = bylo.count, n2 = stalo.count, r2 = stalo.rating;
  // Первые отзывы карточки: до них рейтинга нет, и средняя новых — это сам новый рейтинг.
  const r1 = bylo.rating != null ? bylo.rating : (n1 === 0 ? 0 : null);
  const novyh = n2 - n1;
  if (!(novyh > 0) || r1 == null || r2 == null) return { novyh: Math.max(0, novyh || 0), trevoga: false };
  // Сумма звёзд — целое число: берём целые границы сумм, иначе один отзыв на 3★ при рейтинге «3,0»
  // давал бы верхнюю границу 3,05 и не считался бы плохим.
  const vniz = (x) => Math.ceil(x - 1e-9), vverh = (x) => Math.floor(x + 1e-9);
  const lo = Math.max(1, (vniz((r2 - 0.05) * n2) - vverh((r1 + 0.05) * n1)) / novyh);
  const hi = Math.min(5, (vverh((r2 + 0.05) * n2) - vniz((r1 - 0.05) * n1)) / novyh);
  const tochno = hi <= porog + 1e-9;
  const snizilsya = n1 > 0 && r2 < r1 && lo <= porog + 1e-9;
  return { novyh, lo: Math.round(lo * 100) / 100, hi: Math.round(hi * 100) / 100, tochno, snizilsya, trevoga: tochno || snizilsya };
}

module.exports = { rejting, ocenka };
