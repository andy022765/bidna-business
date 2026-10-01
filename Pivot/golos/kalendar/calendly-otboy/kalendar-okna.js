// Инструмент Веры «какие есть свободные окна». Читает Calendly и отдаёт ей ОДНО-ДВА
// ближайших окна словами в поясе звонящего.
//
// ПОЧЕМУ ДВА, А НЕ СПИСОК. На слух список из восьми времён не запоминается: человек
// переспрашивает, и разговор растёт. Два варианта — это выбор, а восемь — это работа.
//
// ЧАСЫ, ВЫХОДНЫЕ И ЗАПАС МЕЖДУ ВСТРЕЧАМИ МЫ НЕ СЧИТАЕМ. Их держит Calendly: что он
// отдал свободным — то и свободно. Своя арифметика здесь была бы вторым источником
// правды, и однажды он разошёлся бы с настоящим расписанием.
//
// env: CALENDLY_TOKEN · CALENDLY_EVENT_TYPE · GOLOS_PISMO_SECRET

const { svobodnye, slovami } = require('./kalendar-obshchee');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });

exports.handler = async (event) => {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret) {
    return otvet(401, { skazat: 'Сейчас не посмотрю.' });
  }

  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) {}
  const poyas = (d.poyas || 'America/New_York').trim();
  const ru = d.yazyk !== 'en';

  const r = await svobodnye(6);
  if (r.kod !== 200) {
    console.log('[kalendar-okna] Calendly отказал:', r.kod, r.oshibka);
    // Говорим Вере правду, а не пустой список: пустой список она озвучит как
    // «свободного времени нет», и человек уйдёт, думая, что мы заняты на неделю.
    return otvet(200, { ok: false,
      skazat: ru ? 'Календарь сейчас не отвечает, время назвать не могу.'
                 : 'The calendar is not responding right now.' });
  }
  if (!r.okna.length) {
    return otvet(200, { ok: true, okna: [],
      skazat: ru ? 'На ближайшие дни свободного времени нет.'
                 : 'There is no free time in the next few days.' });
  }

  const vybor = r.okna.slice(0, 2);
  return otvet(200, {
    ok: true,
    okna: vybor,                                   // точные ISO — их же вернуть в «записать»
    slovami: vybor.map(x => slovami(x, poyas, ru)),
    vsego: r.okna.length,
    skazat: ru
      ? 'Ближайшее: ' + vybor.map(x => slovami(x, poyas, ru)).join(' или ')
      : 'Nearest: ' + vybor.map(x => slovami(x, poyas, ru)).join(' or '),
  });
};
