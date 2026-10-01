// Инструмент Веры «какие есть свободные окна». Читает занятость у Google и отдаёт
// ОДНО-ДВА ближайших окна словами.
//
// ПОЧЕМУ ДВА, А НЕ СПИСОК. На слух список из восьми времён не запоминается: человек
// переспрашивает, и разговор растёт. Два варианта — это выбор, а восемь — это работа.
//
// ЧАСЫ, ВЫХОДНЫЕ И ЗАПАС СЧИТАЕМ МЫ САМИ, и в этом вся работа. Google отдаёт только
// занятость: где события нет — там «свободно», включая три часа ночи и воскресенье.
// Поэтому сетку часов строит наш код (kalendar-lib/gkal.js), а Google лишь вычёркивает занятое.
//
// ПОЯС — ВЛАДЕЛЬЦА, а не наш и не угаданный. Владелец и звонящий договариваются об одном
// времени, и называть его надо одним. Если модель передала poyas — значит звонящий сам
// назвал свой часовой пояс, тогда говорим в его.
//
// env: GOOGLE_SA_JSON · KALENDAR_ID · KALENDAR_POYAS · KALENDAR_CHAS_OT · KALENDAR_CHAS_DO
//      · KALENDAR_DNI · KALENDAR_DLINA_MIN · KALENDAR_ZAPAS_MIN · KALENDAR_NE_RANSHE_CHASOV
//      · KALENDAR_VPERED_DNEY · GOLOS_PISMO_SECRET

const { svobodnye, slovami, nastroyki , podklyuchitBlobs } = require('../kalendar-lib/gkal');
const { getStore } = require('@netlify/blobs');
podklyuchitBlobs(getStore);

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });

exports.handler = async (event) => {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) {}
  const ru = String(d.yazyk || '').toLowerCase() !== 'en';

  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret)
    return otvet(401, { skazat: ru ? 'Сейчас не посмотрю.' : "I can't check that right now." });

  const n = nastroyki();
  const poyas = String(d.poyas || n.poyas).trim();

  let r;
  try { r = await svobodnye(); }
  catch (e) {
    console.log('[kalendar-okna] упало:', e.message);
    r = { kod: 0, oshibka: e.message };
  }

  if (r.kod !== 200) {
    console.log('[kalendar-okna] занятость не прочиталась:', r.kod, r.oshibka);
    // Говорим Вере правду, а не пустой список: пустой список она озвучит как «свободного
    // времени нет», и человек уйдёт, думая, что мы заняты на неделю вперёд.
    return otvet(200, { ok: false,
      skazat: ru ? 'Календарь сейчас не отвечает, время назвать не могу.'
                 : 'The calendar is not responding right now, so I cannot name a time.',
      dalshe: ru ? 'Время НЕ называй и не выдумывай. Скажи, что пришлёшь на почту, и возьми адрес.'
                 : 'Do NOT name a time and do not invent one. Say you will send it by email and take their address.' });
  }

  if (!r.okna.length) {
    return otvet(200, { ok: true, okna: [],
      skazat: ru ? 'На ближайшие дни свободного времени нет.'
                 : 'There is no free time in the next few days.',
      dalshe: ru ? 'Своё время не предлагай. Предложи письмо и возьми адрес.'
                 : 'Do not offer a time of your own. Offer the email and take their address.' });
  }

  // ЖЕЛАЕМОЕ ВРЕМЯ. До 26.09 инструмент умел только «ближайшее»: человек просил вторник
  // на два часа дня, получал понедельник на одиннадцать, и про вторник не слышал ни слова
  // (обкатка, сценарий zapis-03). Теперь спрошенный день и час учитываются, а если в них
  // свободного нет — так и говорим, и только потом предлагаем ближайшее.
  const DNI = { vs: 0, sun: 0, pn: 1, mon: 1, vt: 2, tue: 2, sr: 3, wed: 3,
                cht: 4, thu: 4, pt: 5, fri: 5, sb: 6, sat: 6 };
  const den = String(d.den || '').trim().toLowerCase();
  const chas = d.chas === undefined || d.chas === null || d.chas === '' ? null : Number(d.chas);
  const mestnoeDlya = (iso) => {
    // День недели и час в поясе показа, а не в UTC: иначе вечер уезжает на сутки.
    const f = new Intl.DateTimeFormat('en-US', { timeZone: poyas, hour12: false,
      weekday: 'short', hour: '2-digit', day: '2-digit' });
    const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
    const kartaDnya = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dn: kartaDnya[p.weekday], chas: (+p.hour) % 24, den: +p.day };
  };
  let podhodyat = r.okna;
  let prosili = false;
  if (den || chas !== null) {
    prosili = true;
    const segodnyaDen = mestnoeDlya(new Date().toISOString()).den;
    podhodyat = r.okna.filter((x) => {
      const m = mestnoeDlya(x);
      if (den === 'segodnya' || den === 'today') { if (m.den !== segodnyaDen) return false; }
      else if (den === 'zavtra' || den === 'tomorrow') { if (m.den === segodnyaDen) return false; }
      else if (den in DNI) { if (m.dn !== DNI[den]) return false; }
      // Час считаем попаданием в пределах двух часов: «на два» и 13:30 — это одно и то же.
      if (chas !== null && Math.abs(m.chas - chas) > 2) return false;
      return true;
    });
  }
  if (prosili && !podhodyat.length) {
    const blizh = r.okna.slice(0, 2).map(x => slovami(x, poyas, ru));
    console.log('[kalendar-okna] в запрошенное время свободного нет:', den, chas);
    return otvet(200, { ok: true, okna: r.okna.slice(0, 2), slovami: blizh, vsego: r.okna.length,
      poyas, prosili_den: den || null, prosili_chas: chas,
      skazat: (ru ? 'В это время свободного нет. Ближайшее: ' : 'Nothing free then. The nearest: ')
              + blizh.join(ru ? ' или ' : ' or '),
      dalshe: ru
        ? 'Сначала скажи ПРЯМО, что в запрошенное время свободного нет, и только потом назови '
          + 'ближайшее. Молча подменять день на другой нельзя.'
        : 'Say PLAINLY first that nothing is free at the time they asked for, and only then '
          + 'offer the nearest. Never swap their day for another one in silence.' });
  }

  const vybor = (prosili ? podhodyat : r.okna).slice(0, 2);
  const slova = vybor.map(x => slovami(x, poyas, ru));
  return otvet(200, {
    ok: true,
    okna: vybor,                       // точные ISO — их же вернуть в «записать», без правок
    slovami: slova,
    vsego: r.okna.length,
    prosili_den: den || null, prosili_chas: chas,
    kalendarey: r.kalendarey,        // по скольким календарям считали занятость
    poyas,
    skazat: (ru ? 'Ближайшее: ' : 'Nearest: ') + slova.join(ru ? ' или ' : ' or '),
    dalshe: ru
      ? 'Назови эти варианты и спроси, какой подходит. Человек выбрал — вызови «записать» '
        + 'и передай start_time ТОЧНО той строкой из поля okna, которая соответствует выбору. '
        + 'Своё время не придумывай и время из головы не называй.'
      : 'Offer these options and ask which one works. Once they choose, call the booking tool '
        + 'and pass start_time EXACTLY as the matching string from the okna field. '
        + 'Do not invent a time and never name one from memory.',
  });
};
