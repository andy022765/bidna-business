'use strict';
// Журнал действий клиента: `zhurnal/<YYYY-MM-DD>` (дата по поясу клиента) — массив {at, kto, chto, obekt}
// (+ необязательное detali). Слой соответствия A6: что сделал агент, что ушло бы письмом или SMS,
// чьё согласие изменилось. Запись дописывается условной записью по etag: два одновременных
// вызова не теряют строк друг друга. Сбой журнала не ломает основное действие — только пишет в лог.

const { seychas, iso, denKlyuch, POYAS } = require('./vremya');

async function zapisat(st, { kto, chto, obekt = null, detali } = {}, { poyas = POYAS } = {}) {
  const t = seychas();
  const zapis = { at: iso(t, poyas), kto: String(kto || 'sistema'), chto: String(chto || ''), obekt };
  if (detali !== undefined) zapis.detali = detali;
  if (!st) return zapis;
  try {
    await st.obnovit(`zhurnal/${denKlyuch(t, poyas)}`, (spisok) => {
      const a = Array.isArray(spisok) ? spisok : [];
      a.push(zapis);
      return a;
    });
  } catch (e) {
    console.log('[zhurnal] строка не записалась:', chto, e && e.message);
  }
  return zapis;
}

async function prochitat(st, den) {
  if (!st) return [];
  const a = await st.getJSON(`zhurnal/${den}`);
  return Array.isArray(a) ? a : [];
}

module.exports = { zapisat, prochitat };
