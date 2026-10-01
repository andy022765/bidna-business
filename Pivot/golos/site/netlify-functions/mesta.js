// Сколько бесплатных мест осталось — Вера спрашивает это ЖИВЬЁМ во время разговора.
// Считает не наш счётчик, а купон Stripe: max_redemptions минус погашенные.
// Значит цифра настоящая: place кончились в кассе — кончились и в трубке.
//
// Проксируем через основной сайт, чтобы ключ Stripe не заводить на стенде.

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const ISTOCHNIK = process.env.GOLOS_MESTA_URL
  || 'https://businessinteldna.com/.netlify/functions/promo-status';

// Число словами: Вера обязана произносить числительные, а не цифры.
const SLOVAMI = ['ноль','одно','два','три','четыре','пять','шесть','семь','восемь','девять','десять'];
// Английская ветка (25.09.2026): агент зовёт эту же функцию с yazyk:'en'.
// Русский путь — по умолчанию: нет поля, чужое значение, опечатка — всё это русский.
const EN_SLOVAMI = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
const EN = {
  nezmogu: "I can't check that right now.",
  neskazhu: "There is a limited number of places — I can't give you the exact count right now.",
  konchilis: 'The free places are gone. The diagnostic is now at its regular price — five hundred dollars.',
  ostalos: (n) => `${n <= 10 ? EN_SLOVAMI[n] : n} ${n === 1 ? 'place' : 'places'} left.`,
};

exports.handler = async (event) => {
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  const en = String(b.yazyk || '').toLowerCase() === 'en';

  const secret = process.env.GOLOS_PISMO_SECRET;
  const h = event.headers || {};
  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret)
    return { statusCode: 401, headers: JSON_H,
             body: JSON.stringify({ skazat: en ? EN.nezmogu : 'Сейчас не посмотрю.' }) };

  try {
    const r = await fetch(ISTOCHNIK);
    const d = await r.json();

    if (d.unknown || d.left == null || d.valid === false)
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify({
        est_chislo: false,
        skazat: en ? EN.neskazhu : 'Мест ограниченное число, точное сейчас не скажу.' }) };

    const n = Math.max(0, parseInt(d.left, 10));
    if (n === 0)
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify({
        est_chislo: true, ostalos: 0,
        skazat: en ? EN.konchilis
                   : 'Бесплатные места закончились. Сейчас диагностика по обычной цене — пятьсот долларов.' }) };

    const slovo = n <= 10 ? SLOVAMI[n] : String(n);
    const d10 = n % 10, d100 = n % 100;
    const mest = (d10 === 1 && d100 !== 11) ? 'место'
               : (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) ? 'места' : 'мест';
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({
      est_chislo: true, ostalos: n,
      skazat: en ? EN.ostalos(n) : `Осталось ${slovo} ${mest}.` }) };
  } catch (e) {
    console.log('[mesta] упало:', e.message);
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({
      est_chislo: false,
      skazat: en ? EN.neskazhu : 'Мест ограниченное число, точное сейчас не скажу.' }) };
  }
};
