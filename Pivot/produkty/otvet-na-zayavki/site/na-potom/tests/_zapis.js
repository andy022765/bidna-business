// ОТЛОЖЕНО 29.09.2026. Обвязка тестов своей записи поверх общих подделок tests/_feyki.js.
//
// До 29.09 ~18:05 ссылки на окна выдавал zayavka-background, и тесты записи брали токены из
// письма. Живой путь теперь даёт ссылку на Calendly, поэтому заявку «как её собирал zayavka»
// собираем здесь и зовём ровно тот код, что раньше стоял в функции (na-potom/lib/okna-v-pismo.js).
const F = require('../../tests/_feyki');
const path = require('path');

const NP = path.join(__dirname, '..');
const H = require('../../lib/hranilishche');
const G = require('../lib/gkal');
const KZ = require('../lib/kartochka-zapis');
const OP = require('../lib/okna-v-pismo');
const PZ = require('../lib/pisma-zapis');
const P = require('../../lib/pisma');
const Kz = require('../../lib/kartochka');

H.podklyuchit(F.blobsModul);
G.podklyuchitBlobs(F.blobsModul.getStore);

// Календарные переменные — как было на стенде записи.
function okruzhenieZapisi() {
  Object.assign(process.env, { OTVET_KALENDAR_ID: F.KALENDAR, OTVET_KALENDAR_ZANYATOST: F.ZANYATOST,
                               OTVET_BAZA_URL: 'https://businessinteldna.com' });
}

// Основной сайт с прокси /zapis → сайт ответа (строка _redirects). proksi=false — строки ещё нет.
const glavnyy = { proksi: true };
const fZapis = () => require(path.join(NP, 'netlify-functions/zapis.js'));
F.dobavitMarshrut(async (u, o) => {
  if (u.host !== 'businessinteldna.com' || u.pathname !== '/zapis') return undefined;
  if (!glavnyy.proksi) return { ok: false, status: 404, async text() { return '{"oshibka":"Page not found"}'; } };
  const r = await fZapis().handler({ httpMethod: 'GET', headers: o.headers || {}, queryStringParameters: Object.fromEntries(u.searchParams) });
  return { ok: r.statusCode < 300, status: r.statusCode, async text() { return r.body; } };
});

async function zapisGet(t, o = {}) {
  return fZapis().handler({ httpMethod: 'GET', headers: Object.assign({ 'accept-language': 'ru-RU,ru;q=0.9' }, o.headers || {}), queryStringParameters: { t } });
}
async function zapisPost(t) {
  return fZapis().handler({ httpMethod: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ t }).toString() });
}

// Токены из письма человеку — в том порядке, в каком стоят ссылки.
function tokenyIzPisma(p) { return [...String(p.text).matchAll(/\/zapis\?t=([A-Za-z0-9_-]+)/g)].map(m => m[1]); }

// Заявка так, как её собирал zayavka-background (продукт и язык — живым паспортом).
function lid(d = {}) {
  const k = KZ.vzyat('bid');
  const o = Object.assign({ id: 'sub-' + Math.random().toString(36).slice(2), forma: 'hochet-zvonok', stranica: '/vera/ru/',
                            pochta: 'anna@example.com', imya: 'Анна' }, d);
  const stranica = Kz.put(o.stranica);
  const soobshchenie = String(o.soobshchenie || '');
  return { z: o.id, pochta: o.pochta, forma: o.forma, stranica, produkt: Kz.produktDlya(k, o.forma, stranica),
           imya: P.chistoeImya(o.imya), telefon: o.telefon || '', soobshchenie, est_vopros: soobshchenie.length > 0,
           yazyk: Kz.yazykDlya(k, o.forma, stranica, o.yazyk) };
}

// Окна + письмо человеку с тремя ссылками (как до 29.09). Письмо не отправляется — только собирается.
// sobytie — событие вызова функции (например, с event.blobs для режима connectLambda).
async function pismoSOknami(d, sobytie) {
  H.nachat(sobytie || { headers: {} });
  const k = KZ.vzyat('bid');
  const l = lid(d);
  const r = await OP.oknaDlyaPisma(k, l);
  return Object.assign(r, { lid: l, pismo: PZ.pismoOtvetSOknami(k, l, r.ssylki, r.baza) });
}

// Токены для тестов страницы записи (раньше: F.zayavka → письмо → tokenyIzPisma).
async function lidSTokenami(d) {
  const r = await pismoSOknami(d);
  return tokenyIzPisma(r.pismo);
}

function sbros() { F.sbrosVsego(); okruzhenieZapisi(); glavnyy.proksi = true; H.nachat({ headers: {} }); }

module.exports = Object.assign({}, F, { NP, glavnyy, zapisGet, zapisPost, tokenyIzPisma, lid, pismoSOknami, lidSTokenami,
                                        okruzhenieZapisi, sbros });
