// Ручной запуск для обкатки (у функций по расписанию нет адреса, на предпросмотре расписание не работает).
//   curl -X POST -H "x-otzyvy-admin: $OTZYVY_KLYUCH_ADMINA" -d '{"chto":"planirovshchik","klient":"obkatka"}' \
//        https://<сайт>/.netlify/functions/zapusk
// Всё то же, что по расписанию: выключатель, паспорт vklyuchen, rezhim, потолки. Обходов нет.
//   {"chto":"ssylki","klient":"acme"} — ссылки владельца: форма визитов и вставка отзыва. Нужны в первый
//   день пилота без Веры: иначе форма доходила бы до владельца только с первым месячным отчётом.
//   Ничего не шлёт и не тратит; ссылки отдаём нам, владельцу их передаём сами.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
N.podklyuchit(blobs);
const ssylki = (o) => {
  const K = require('../lib/kartochka');
  const SH = require('../lib/shablony');
  const k = K.vzyat(o.klient);
  if (!k) return { ok: false, oshibka: 'нет паспорта ' + o.klient };
  const beda = K.proverit(k);
  if (beda.length) return { ok: false, oshibka: 'паспорт не цел', beda };
  return { ok: true, klient: k.klient, vizity: k.istochniki.forma.vklyuchena ? SH.ssylkaVizity(k) : null, otzyv: SH.ssylkaVstavit(k) };
};
const CHTO = {
  ssylki: async (o) => ssylki(o),
  planirovshchik: (o) => require('../lib/planirovshchik').progon(o),
  slezhenie: (o) => require('../lib/slezhenie').progon(o),
  ezhednevno: () => require('../lib/ezhednevno').progon(),
};

exports.handler = async (event) => {
  H.nachat(event);
  if (event.httpMethod !== 'POST') return N.json(405, { ok: false });
  if (!N.admin(event)) return N.json(401, { ok: false });
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) { return N.json(400, { ok: false, oshibka: 'тело не JSON' }); }
  const f = CHTO[d.chto];
  if (!f) return N.json(400, { ok: false, oshibka: 'chto: planirovshchik | slezhenie | ezhednevno | ssylki' });
  try { return N.json(200, await f({ klient: typeof d.klient === 'string' ? d.klient : '' })); }
  catch (e) { console.log('[zapusk] упал:', (e && e.stack) || e); return N.json(500, { ok: false, oshibka: e.message }); }
};
