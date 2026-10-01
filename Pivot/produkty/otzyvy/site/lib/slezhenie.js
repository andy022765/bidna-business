// Слежение за рейтингом и числом отзывов карточки. Расписание раз в 3 часа, но опрашиваем только
// днём по времени бизнеса (с 8:00 до 21:00): тревога владельцу не приходит ночью, а запросов к Google
// ~5 на клиента в сутки вместо 8 (~150 в месяц). Отзыв, пришедший ночью, ловит первый утренний опрос:
// отпечаток между опросами не меняется. Потолок 40 запросов в сутки на всех: клиентов опрашиваем
// по очереди, начиная с того, кого опрашивали давнее всех, — при нехватке никто не выпадает насовсем.
//
// Храним только отпечаток последнего опроса (rating, count, время) — он нужен, чтобы заметить новый
// отзыв, и живёт не дольше 30 дней (lib/ezhednevno.js). Истории нет: числа на начало месяца мы НЕ
// храним (ревью 29.09 — условия Google Maps Platform позволяют хранить только place_id; было
// baza/<клиент>/<месяц> без срока). Никаких текстов, авторов и id отзывов из Google.

const H = require('./hranilishche');
const K = require('./kartochka');
const V = require('./vremya');
const L = require('./limity');
const PL = require('./places');
const T = require('./trevoga');

const HRAN = 'otzyvy';
const DNEM_S = 8, DNEM_DO = 21;   // окно опроса по времени бизнеса
const dnem = (k, t) => { const m = V.mestnoe(new Date(t), k.biznes.poyas); return m.chas >= DNEM_S && m.chas < DNEM_DO; };

async function progon(o = {}) {
  const teper = Date.now();
  const s = H.store(HRAN);
  if (!s) return { itog: 'net_hranilishcha' };
  await H.polozhit(s, 'pulse/slezhenie', { t: teper });
  const vk = await L.vklyuchen(s);
  if (!vk.vklyucheno) { console.log('[slezhenie] выключено:', vk.pochemu); return { itog: 'vyklyucheno' }; }

  const spisok = [];
  for (const k of K.rabochie()) {
    if (!k.slezhenie.vklyucheno || (o.klient && k.klient !== o.klient)) continue;
    if (!dnem(k, teper)) continue;
    const pr = await H.vzyat(s, `otpechatok/${k.klient}`);
    spisok.push({ k, pr, t: pr ? pr.t : 0 });
  }
  spisok.sort((a, b) => a.t - b.t);
  const itogi = {};
  for (const { k, pr } of spisok) {
    const r = await PL.rejting(s, k.biznes.place_id);
    if (!r.ok) { itogi[k.klient] = { oshibka: r.oshibka }; if (r.potolok) break; continue; }
    const novyy = { rating: r.rating, count: r.count, t: teper };
    await H.polozhit(s, `otpechatok/${k.klient}`, novyy);
    const it = { rating: r.rating, count: r.count };
    if (pr && novyy.count > pr.count) {
      const a = PL.ocenka(pr, novyy, k.trevoga.zvyozd_do);
      it.novyh = a.novyh; it.granicy = [a.lo, a.hi];
      if (a.trevoga) it.trevoga = (await T.bezTeksta(s, k, { rating: pr.rating, count: pr.count }, { rating: novyy.rating, count: novyy.count }, a)).itog;
    } else if (pr && novyy.count < pr.count) console.log('[slezhenie] отзывов стало меньше (удалены?):', k.klient, pr.count, '→', novyy.count);
    itogi[k.klient] = it;
  }
  console.log('[slezhenie] готово:', JSON.stringify(itogi));
  return { itog: 'ok', klienty: itogi };
}

module.exports = { progon };
