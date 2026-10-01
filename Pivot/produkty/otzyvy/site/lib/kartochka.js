// Паспорт клиента Сборщика: карточка в Google (place_id), пояс, окно писем, отправитель, источники
// визитов. Всё, что письмо говорит от имени бизнеса, берётся отсюда — модель в письмах не участвует.
//
// Паспорта подключаются статическим require: esbuild кладёт JSON в сборку функции. Новый клиент —
// новый файл в kartochka/ и строка в KARTOCHKI. Паспорт, который не проходит proverit(), ни одна
// функция не трогает: шлёт, следит и отчитывается только по целым паспортам.
//
// Включение — два замка: общий выключатель в Blobs (по умолчанию выключено, lib/limity.js)
// и поле vklyuchen в паспорте (правится только выкладкой, по слову Андрея).

const crypto = require('crypto');

const KARTOCHKI = {
  obkatka: require('../kartochka/obkatka.json'),
};
const dlyaTesta = {};   // тесты кладут сюда свои паспорта; в сборке пусто

// Значения по умолчанию. Всё, что тут стоит, — решения из PLAN-DLYA-ANDREYA (п. 2 и п. 8).
const PO_UMOLCHANIYU = {
  rezhim: 'suhoy',
  pisma: {
    yazyk: 'en',
    okno_s: 9, okno_do: 19,            // по времени бизнеса; вечерние уходят утром
    dni: [1, 2, 3, 4, 5, 6, 7],
    zaderzhka_min: 120,                // + ход часового расписания = 2–3 часа после конца визита
    napominanie_dney: 3,               // одно напоминание, если не было клика
    ustarevaet_chasov: 48,             // не успели за 48 ч (потолки, ночь, выключатель) — не шлём вовсе
    v_sutki: 40,                       // потолок на бизнес в сутки
    adres_ne_chashche_dney: 180,       // постоянного клиента не просим после каждой стрижки
  },
  istochniki: {
    vera: { vklyuchen: false },
    kalendar_vse_s_gostem: false,      // все события с почтой гостя — только с согласия владельца
    // v_sutki — потолок визитов формой за местные сутки: ссылка формы без срока, и пересланный отчёт
    // не должен превращаться в рассылку по чужому списку и в прогоны, которые жгут кредиты Netlify.
    forma: { vklyuchena: true, ne_starshe_dney: 7, strok_za_raz: 200, v_sutki: 200 },
  },
  slezhenie: { vklyucheno: true, sosedi: [] },
  trevoga: { zvyozd_do: 3, v_sutki: 20, obrazcy_otvetov: [] },
};

const kopiya = (o) => JSON.parse(JSON.stringify(o));
function slit(baza, sverhu) {
  const out = kopiya(baza);
  for (const [k, v] of Object.entries(sverhu || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = slit(out[k], v);
    else out[k] = kopiya(v === undefined ? null : v);
  }
  return out;
}

const hesh = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 12);

function polnyy(syroy) {
  const k = slit(PO_UMOLCHANIYU, syroy);
  Object.defineProperty(k, '__hesh', { value: hesh(syroy), enumerable: false });
  return k;
}

function vse() {
  const out = [];
  for (const [id, k] of Object.entries(Object.assign({}, KARTOCHKI, dlyaTesta))) {
    if (!k) continue;
    const p = polnyy(k);
    if (p.klient !== id) { console.log('[kartochka] имя файла и klient разошлись:', id, p.klient); continue; }
    out.push(p);
  }
  return out;
}

function vzyat(id) {
  const k = Object.prototype.hasOwnProperty.call(dlyaTesta, id) ? dlyaTesta[id]
          : Object.prototype.hasOwnProperty.call(KARTOCHKI, id) ? KARTOCHKI[id] : null;
  return k ? polnyy(k) : null;
}

const POCHTA = /^[a-z0-9+_.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{16,300}$/;
const poyasOk = (p) => { try { new Intl.DateTimeFormat('en-US', { timeZone: p }).format(0); return !!p; } catch (_) { return false; } };
const chisloV = (x, ot, do_) => typeof x === 'number' && Number.isFinite(x) && x >= ot && x <= do_;
// В заголовок From и в тело письма уходит имя бизнеса: только печатные знаки, без кавычек и угловых скобок.
const IMYA_BIZNESA = /^[^"<>\r\n\\]{2,60}$/;

function proverit(k) {
  const beda = [];
  const nado = (usl, chto) => { if (!usl) beda.push(chto); };
  const b = k.biznes || {}, v = k.vladelec || {}, p = k.pisma || {}, i = k.istochniki || {}, sl = k.slezhenie || {}, tr = k.trevoga || {};
  nado(/^[a-z0-9-]{2,30}$/.test(k.klient || ''), 'klient: только латиница, цифры, дефис');
  nado(['suhoy', 'boevoy'].includes(k.rezhim), 'rezhim: suhoy или boevoy');
  nado(IMYA_BIZNESA.test(b.imya || ''), 'biznes.imya: 2–60 знаков, без кавычек и <>');
  nado(String(b.adres || '').trim().length >= 10 && !/[<>\r\n]/.test(b.adres), 'biznes.adres: нужен почтовый адрес (CAN-SPAM)');
  nado(poyasOk(b.poyas), 'biznes.poyas: не часовой пояс IANA');
  nado(PLACE_ID.test(b.place_id || ''), 'biznes.place_id: не похоже на place_id Google');
  nado(typeof b.medicina === 'boolean', 'biznes.medicina: true или false');
  // Решение Андрея 25.09 и PLAN-DLYA-ANDREYA п. 6.3: медицину берём только без электронных страховых заявок
  // (тогда HIPAA к практике не относится). Без явной отметки медицинский паспорт не пропускаем.
  if (b.medicina) nado(b.bez_elektronnyh_strahovyh_zayavok === true, 'biznes.medicina: нужна отметка bez_elektronnyh_strahovyh_zayavok: true (иначе HIPAA и нужен BAA)');
  nado(Array.isArray(v.pochta) && v.pochta.length > 0 && v.pochta.every(x => POCHTA.test(x)), 'vladelec.pochta: список адресов');
  nado(['en', 'ru'].includes(p.yazyk), 'pisma.yazyk: en или ru');
  nado(POCHTA.test(p.otvet_na || ''), 'pisma.otvet_na: почта владельца для ответов посетителей');
  nado(chisloV(p.okno_s, 7, 12) && chisloV(p.okno_do, 15, 21), 'pisma.okno_s 7–12, okno_do 15–21');
  nado(Array.isArray(p.dni) && p.dni.length > 0 && p.dni.every(d => [1, 2, 3, 4, 5, 6, 7].includes(d)), 'pisma.dni: дни недели 1–7');
  nado(chisloV(p.zaderzhka_min, 60, 360), 'pisma.zaderzhka_min: 60–360');
  nado(chisloV(p.napominanie_dney, 2, 7), 'pisma.napominanie_dney: 2–7');
  nado(chisloV(p.ustarevaet_chasov, 24, 96), 'pisma.ustarevaet_chasov: 24–96');
  nado(chisloV(p.v_sutki, 1, 40), 'pisma.v_sutki: 1–40 (потолок из плана)');
  nado(chisloV(p.adres_ne_chashche_dney, 30, 3650), 'pisma.adres_ne_chashche_dney: от 30');
  const vera = i.vera || {};
  if (vera.vklyuchen) {
    nado(/^[0-9a-f-]{20,40}$/.test(vera.site_id || ''), 'istochniki.vera.site_id: id сайта Веры');
    nado(vera.kalendar_id && vera.kalendar_id !== 'primary' && vera.kalendar_id !== 'ZAPOLNIT' && /@/.test(vera.kalendar_id),
      'istochniki.vera.kalendar_id: календарь записей (никогда не primary)');
  }
  const forma = i.forma || {};
  nado(vera.vklyuchen || forma.vklyuchena, 'нет ни одного источника визитов');
  nado(chisloV(forma.ne_starshe_dney, 1, 14), 'istochniki.forma.ne_starshe_dney: 1–14 (по старой базе разом не шлём)');
  nado(chisloV(forma.v_sutki, 1, 500), 'istochniki.forma.v_sutki: 1–500 визитов формой в сутки');
  nado(Array.isArray(sl.sosedi) && sl.sosedi.length <= 3 && sl.sosedi.every(x => x && PLACE_ID.test(x.place_id || '') && IMYA_BIZNESA.test(x.imya || '')),
    'slezhenie.sosedi: до трёх, у каждого imya и place_id');
  nado(chisloV(tr.zvyozd_do, 1, 3), 'trevoga.zvyozd_do: 1–3');
  nado(chisloV(tr.v_sutki, 1, 20), 'trevoga.v_sutki: 1–20');
  nado(Array.isArray(tr.obrazcy_otvetov) && tr.obrazcy_otvetov.length <= 3, 'trevoga.obrazcy_otvetov: до трёх ответов владельца');
  return beda;
}

// Паспорта, по которым можно работать: целы и включены. Один календарь записей — один бизнес:
// два включённых паспорта с одним календарём (ошибка при заполнении) слали бы каждому посетителю
// просьбы от имени двух бизнесов. Такие паспорта не работают оба, пока не разведут.
function rabochie() {
  const out = [];
  for (const k of vse()) {
    if (!k.vklyuchen) continue;
    const beda = proverit(k);
    if (beda.length) { console.log('[kartochka] паспорт не цел, пропускаю:', k.klient, beda.join(' · ')); continue; }
    out.push(k);
  }
  const kal = (k) => (k.istochniki.vera.vklyuchen || k.istochniki.kalendar_vse_s_gostem) ? String(k.istochniki.vera.kalendar_id || '') : '';
  const skolko = new Map();
  for (const k of out) { const id = kal(k); if (id) skolko.set(id, (skolko.get(id) || 0) + 1); }
  return out.filter(k => {
    const id = kal(k);
    if (id && skolko.get(id) > 1) { console.log('[kartochka] один календарь у нескольких паспортов, пропускаю:', k.klient); return false; }
    return true;
  });
}

function _dlyaTesta(id, k) { if (k === null) delete dlyaTesta[id]; else dlyaTesta[id] = k; }
function _sbrosTestov() { for (const id of Object.keys(dlyaTesta)) delete dlyaTesta[id]; }

module.exports = { vse, vzyat, proverit, rabochie, polnyy, PO_UMOLCHANIYU, KARTOCHKI, POCHTA, PLACE_ID, _dlyaTesta, _sbrosTestov };
