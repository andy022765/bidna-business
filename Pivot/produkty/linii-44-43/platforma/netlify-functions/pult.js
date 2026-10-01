'use strict';
// Данные пульта: GET /.netlify/functions/pult?k=<ключ пульта клиента> (так зовёт web/pult/pult.js).
// Снимок собирает lib/shablony/snimok.js (сборщик пульта, формат docs/API.md): функция достаёт записи
// клиента из хранилища и отдаёт снимок как есть. Сверх снимка — semi (обращения семей, A2) и zhurnal
// (журнал действий за сегодня, A6), если снимок их не содержит.
// Ключ неверный или не настроен — 401 {ok:false, oshibka:'klyuch'}: пульт покажет «ссылка не подходит».
//
// env: PULT_KLYUCH_<KLIENT> (например PULT_KLYUCH_BRIGHTSIDE), не короче 16 символов.

const { json } = require('../lib/http');
const H = require('../lib/hranilishche');
const { seychas, denKlyuch, POYAS } = require('../lib/vremya');
const { prochitat } = require('../lib/zhurnal');
const { klientPoKlyuchuPulta, klyuchIzZaprosa, zapisiKlienta } = require('../lib/pult-dannye');
const { sobratSnimok } = require('../lib/shablony/snimok');

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'GET') return json(405, { ok: false, oshibka: 'metod', soobshchenie: 'GET only' });
  const klient = klientPoKlyuchuPulta(klyuchIzZaprosa(event));
  if (!klient) return json(401, { ok: false, oshibka: 'klyuch', soobshchenie: 'This link is not valid.' });
  let st = null;
  try { st = H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
  if (!st) return json(500, { ok: false, oshibka: 'server', soobshchenie: 'Data storage is not available right now. Try again in a minute.' });
  try {
    const teper = seychas();
    const zapisi = await zapisiKlienta(st);
    const snimok = sobratSnimok({ klient, seychas: new Date(teper), zapisi });
    if (!('semi' in snimok)) {
      snimok.semi = zapisi.semi.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 50);
    }
    if (!('zhurnal' in snimok)) {
      snimok.zhurnal = (await prochitat(st, denKlyuch(teper, klient.poyas || POYAS))).slice(-100).reverse();
    }
    return json(200, snimok);
  } catch (e) {
    console.log('[pult] упало:', e && e.message);
    return json(500, { ok: false, oshibka: 'server', soobshchenie: 'The dashboard could not load. Try again in a minute.' });
  }
};
