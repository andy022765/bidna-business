// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Три окна для письма-ответа: ровно то, что до 29.09 ~18:05 делал zayavka-background между
// потолками и отправкой (вынесено сюда без изменений логики). Возврат своей записи для клиента
// без Calendly — в na-potom/CHITAT.md: zayavka-background зовёт oknaDlyaPisma(k, lid), письмо
// собирает PZ.pismoOtvetSOknami(k, lid, ssylki, baza), владельцу — PZ.pismoVladelcuOtvetSOknami.
//
// Каждая ошибка календаря — не «окон нет», а честное «время не предложили» с причиной:
// человеку уходит ответ с ценами без времени, владельцу — причина в письме.

const O = require('./tekst-okna');
const Z = require('./tekst-zapis');
const KZ = require('./kartochka-zapis');

const baza = () => process.env.OTVET_BAZA_URL || process.env.URL || '';

// k — склеенный паспорт (KZ.vzyat()). Вернёт { ssylki: [{token, slot}], kalendarOshibka, baza }.
async function oknaDlyaPisma(k, lid) {
  const dop = KZ.dopKalendarya(k);
  let ssylki = [], kalendarOshibka = '';
  if (!dop.kalendar) kalendarOshibka = 'нет OTVET_KALENDAR_ID';
  else if (!baza()) kalendarOshibka = 'нет OTVET_BAZA_URL — ссылки не на что вести';
  else {
    const r = await O.triOkna(dop, k.kalendar.skolko_okon);
    if (!r.ok) kalendarOshibka = 'календарь: ' + r.oshibka;
    else if (!r.okna.length) kalendarOshibka = 'свободных окон нет на ' + k.kalendar.vpered_dney + ' дней вперёд';
    else {
      const t = await Z.vydatTokeny(k, lid, r.okna);
      if (t) ssylki = t; else kalendarOshibka = 'хранилище не записало ссылки';
    }
  }
  if (kalendarOshibka) console.log('[zayavka] без окон:', kalendarOshibka);
  return { ssylki, kalendarOshibka, baza: baza() };
}

module.exports = { oknaDlyaPisma };
