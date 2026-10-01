// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Три окна в РАЗНЫЕ дни для письма-ответа и проверка одного окна перед записью.
//
// ПОЧЕМУ НЕ ПРОСТО svobodnye(). Она отдаёт первые 12 окон по 30 минут подряд — почти всегда
// это один и тот же день (10:00–16:00). В письме это выглядит как «только завтра», а человеку,
// у которого завтра занято, выбирать не из чего. Поэтому зовём svobodnye() несколько раз,
// каждый раз сдвигая «не раньше» на полночь следующего дня по поясу бизнеса.
// gkal.js при этом не трогаем: он сам принимает настройки снаружи (gkal.js:157).
//
// Каждая ошибка календаря — отказ целиком, как в gkal: не знаем занятости — не предлагаем ничего.

const G = require('./gkal');

// Второе окно берём ближе к середине дня: утро, день, утро — разным людям удобно разное.
const VTOROE_BLIZHE_K_CHASU = 15;
const MAX_ZAPROSOV = 12;

const klyuchDnya = (iso, poyas) => {
  const m = G.mestnoe(new Date(iso), poyas);
  return `${m.god}-${m.mes}-${m.den}`;
};

function blizheKChasu(okna, chas, poyas) {
  let luchshee = okna[0], raznica = Infinity;
  for (const x of okna) {
    const m = G.mestnoe(new Date(x), poyas);
    const r = Math.abs(m.chas + m.minuta / 60 - chas);
    if (r < raznica) { raznica = r; luchshee = x; }
  }
  return luchshee;
}

// Сколько часов от «сейчас» до местной полуночи после дня, в который попадает iso.
function chasovDoSleduyushchihSutok(iso, poyas) {
  const m = G.mestnoe(new Date(iso), poyas);
  const polnoch = G.mestnoeVUTC(m.god, m.mes, m.den + 1, 0, 0, poyas);   // Date.UTC сам переносит 32-е число
  return (polnoch.getTime() - Date.now()) / 3600e3;
}

// dop — настройки из kartochka.dopKalendarya(). Возвращает { ok, okna: [ISO…], poyas } или { ok:false, oshibka }.
async function triOkna(dop, skolko) {
  const nado = skolko || 3;
  const okna = [];
  let neRanshe = dop.ne_ranshe;
  for (let i = 0; i < MAX_ZAPROSOV && okna.length < nado; i++) {
    let r;
    try { r = await G.svobodnye(Object.assign({}, dop, { ne_ranshe: neRanshe })); }
    catch (e) { return { ok: false, oshibka: e.message, okna: [] }; }
    if (r.kod !== 200) return { ok: false, oshibka: r.oshibka || ('код ' + r.kod), kod: r.kod, okna: [] };
    if (!r.okna.length) break;
    const den = klyuchDnya(r.okna[0], dop.poyas);
    const togoDnya = r.okna.filter(x => klyuchDnya(x, dop.poyas) === den);
    const vybrano = okna.length === 1 ? blizheKChasu(togoDnya, VTOROE_BLIZHE_K_CHASU, dop.poyas) : togoDnya[0];
    okna.push(vybrano);
    neRanshe = chasovDoSleduyushchihSutok(vybrano, dop.poyas);
  }
  return { ok: true, okna, poyas: dop.poyas };
}

// Свободно ли ровно это окно СЕЙЧАС. Спрашиваем svobodnye() с «не раньше» чуть раньше начала окна
// и смотрим, есть ли окно в ответе. Нет — окно занято или выпало из расписания; различать не нужно,
// записывать нельзя в обоих случаях.
//
// ПОЧЕМУ «не раньше» С ЗАПАСОМ, а не за минуту до окна (ревью 29.09). svobodnye() спрашивает
// у Google занятость начиная с «не раньше», а freeBusy отдаёт только то, что пересекает этот
// момент. Встреча 10:20–10:50 при вопросе «с 10:59» в ответ не попадает — и запас 15 минут
// после неё никто не видит: человека записали бы на 11:00 впритык. Поэтому спрашиваем с
// «начало окна − запас − минута», а окно ищем в списке, а не только первым.
async function svobodnoLi(dop, iso) {
  const start = new Date(iso).getTime();
  if (!Number.isFinite(start)) return { ok: false, oshibka: 'кривое время' };
  const zapasMs = (Number(dop.zapas) || 0) * 60000;
  const neRanshe = (start - zapasMs - 60000 - Date.now()) / 3600e3;
  const vpered = Math.ceil((start + dop.dlina * 60000 - Date.now()) / 864e5) + 1;
  let r;
  try { r = await G.svobodnye(Object.assign({}, dop, { ne_ranshe: neRanshe, vpered })); }
  catch (e) { return { ok: false, oshibka: e.message }; }
  if (r.kod !== 200) return { ok: false, oshibka: r.oshibka || ('код ' + r.kod), kod: r.kod };
  return { ok: true, svobodno: r.okna.some(x => new Date(x).getTime() === start) };
}

module.exports = { triOkna, svobodnoLi, klyuchDnya, chasovDoSleduyushchihSutok };
