'use strict';
// Тик напоминаний раз в 15 минут (netlify.toml): собеседования кандидатов и оценки на дому — за 24 ч и за 2 ч
// до начала, окно ±7,5 мин, флаги во встрече против повтора, SMS только при согласии, иначе письмо. Правила —
// lib/napominaniya.js. Всё наружу — через lib/otpravka (DRY_RUN=1: в журнал клиента, что ушло бы).
// Функции нет в таблице KONTRAKT.md — добавлена сборщиком стенда 30.09 вечером (раздел «Дополнения стенда 30.09 вечер»).

const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { seychas } = require('../lib/vremya');
const N = require('../lib/napominaniya');

exports.handler = async () => {
  const teper = seychas();
  const itogi = [];
  for (const klient of linii.vseKlienty()) {
    let st = null;
    try { st = H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
    if (!st) { itogi.push({ klient: klient.id, oshibka: 'hranilishche' }); continue; }
    try { itogi.push(Object.assign({ klient: klient.id }, await N.tik(st, klient, { teper }))); }
    catch (e) { itogi.push({ klient: klient.id, oshibka: e.message }); }
  }
  console.log('[napominaniya]', JSON.stringify(itogi));
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, itogi }) };
};
