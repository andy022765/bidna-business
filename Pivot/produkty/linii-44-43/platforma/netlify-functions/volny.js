'use strict';
// Тик A3 раз в 5 минут (netlify.toml): по каждому открытому отказу — одно решение движка замены:
// следующая волна SMS, побудка дежурного или ждать. Смена началась без замены — «не закрыта».
// Функции нет в таблице KONTRAKT.md: без неё волна после 15 минут тишины и побудка за 2 часа до начала
// не случились бы никогда — отказ и SMS-ответы сами время не двигают. Добавлена сборщиком стенда 30.09.

const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { seychas } = require('../lib/vremya');
const O = require('../lib/otkazy');

exports.handler = async () => {
  const teper = seychas();
  const itogi = [];
  for (const klient of linii.vseKlienty()) {
    let st = null;
    try { st = H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
    if (!st) { itogi.push({ klient: klient.id, oshibka: 'hranilishche' }); continue; }
    try { itogi.push(Object.assign({ klient: klient.id }, await O.tik(st, klient, { teper }))); }
    catch (e) { itogi.push({ klient: klient.id, oshibka: e.message }); }
  }
  console.log('[volny]', JSON.stringify(itogi));
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, itogi }) };
};
