// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Паспорт для СВОЕЙ записи = основной паспорт (kartochka/<клиент>.json) + дополнение
// (na-potom/kartochka/<клиент>-zapis.json: kalendar, vstrecha, тексты окон и подтверждения).
// Тексты дополнения ложатся поверх основных (например, vstuplenie «…и запись на звонок»).
// Здесь же настройки для gkal и проверка календарной части паспорта — всё, что живому пути не нужно.

const crypto = require('crypto');
const K = require('../../lib/kartochka');

const DOPOLNENIYA = {
  bid: require('../kartochka/bid-zapis.json'),
};

const hesh = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 12);
const kesh = new Map();

function vzyat(klient) {
  const baza = K.vzyat(klient);
  if (kesh.has(baza.klient)) return kesh.get(baza.klient);
  const d = DOPOLNENIYA[baza.klient];
  if (!d) throw new Error('нет дополнения для своей записи: ' + baza.klient);
  const k = Object.assign({}, baza, { kalendar: d.kalendar, vstrecha: d.vstrecha,
                                      teksty: Object.assign({}, baza.teksty, d.teksty) });
  Object.defineProperty(k, '__hesh', { value: hesh(k), enumerable: false });
  kesh.set(baza.klient, k);
  return k;
}

// Настройки для gkal.svobodnye(dop). gkal.js не правим: он сам берёт настройки из dop поверх
// своих переменных окружения (gkal.js:157). ID календаря — из переменной сайта, а не из файла:
// менять его не должно требовать правки паспорта и тестов.
function dopKalendarya(k) {
  const c = k.kalendar;
  return {
    kalendar: process.env.OTVET_KALENDAR_ID || c.id || '',
    zanyatost: String(process.env.OTVET_KALENDAR_ZANYATOST || (c.zanyatost || []).join(','))
      .split(',').map(s => s.trim()).filter(Boolean),
    poyas: c.poyas,
    ot: c.chas_ot,
    do: c.chas_do,
    dni: c.dni,
    dlina: c.dlina_min,
    zapas: c.zapas_min,
    ne_ranshe: c.ne_ranshe_chasov,
    vpered: c.vpered_dney,
  };
}

// Проверка календарной части (то, что до 29.09 проверял K.proverit). Общую часть проверяет живой K.proverit.
function proveritZapis(k) {
  const beda = K.proverit(k).filter(b => !/ssylka_zapisi/.test(b));   // своей записи ссылка на Calendly не нужна
  const nado = (usl, chto) => { if (!usl) beda.push(chto); };
  const c = k.kalendar || {};
  nado(c.poyas && (() => { try { new Intl.DateTimeFormat('en-US', { timeZone: c.poyas }); return true; } catch (_) { return false; } })(), 'kalendar.poyas не пояс');
  nado(c.chas_ot >= 0 && c.chas_do <= 24 && c.chas_ot < c.chas_do, 'часы работы');
  nado(Array.isArray(c.dni) && c.dni.length && c.dni.every(d => d >= 1 && d <= 7), 'дни недели 1..7');
  nado(c.dlina_min >= 10 && c.dlina_min <= 240, 'длина встречи');
  nado(c.skolko_okon >= 1 && c.skolko_okon <= 5, 'skolko_okon 1..5');
  nado(c.poyas_ru && c.poyas_en, 'подпись пояса на двух языках');
  const v = k.vstrecha || {};
  nado(v.nazvanie_ru && v.nazvanie_en, 'vstrecha.nazvanie на двух языках');
  nado(v.ssylka ? /^https:\/\//.test(v.ssylka) : (v.bez_ssylki_ru && v.bez_ssylki_en), 'vstrecha: ни https-ссылки, ни текста «пришлём ссылку»');
  for (const t of ['vybor', 'ne_podhodit', 'bez_okon', 'tema_zapisi', 'zapisano', 'v_kalendar', 'perenesti'])
    for (const y of ['ru', 'en']) nado((k.teksty || {})[t + '_' + y], `нет teksty.${t}_${y}`);
  return beda;
}

module.exports = { vzyat, dopKalendarya, proveritZapis, DOPOLNENIYA };
