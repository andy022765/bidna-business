// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Страница «подтвердите звонок» и сама запись.
//
// GET  /zapis?t=<токен> — только показывает время и кнопку. НИЧЕГО не записывает и в календарь
//      не ходит: по ссылкам из писем ходят сканеры, и запись от простого открытия была бы ложной.
// POST /zapis (t=<токен>) — записывает: свежая проверка занятости, метки, вставка, перепроверка
//      (lib/tekst-zapis.js), затем письмо человеку с файлом .ics и письмо владельцу.
//
// Адрес /zapis отдаёт этой функции правило в netlify.toml. Основной сайт может проксировать
// businessinteldna.com/zapis сюда же одной строкой _redirects — тогда в письмах наш домен.
//
// env: те же, что у zayavka-background (без OTVET_SECRET: страница публичная по смыслу,
//      защищает её неугадываемый токен).

const blobs = require('@netlify/blobs');
const G = require('../lib/gkal');
const H = require('../../lib/hranilishche');
const K = require('../lib/kartochka-zapis');   // склеенный паспорт: kalendar, vstrecha, тексты записи
const Z = require('../lib/tekst-zapis');
const P = Object.assign({}, require('../../lib/pisma'), require('../lib/pisma-zapis'));   // общее + письма записи
const S = require('../lib/stranica');

H.podklyuchit(blobs);
G.podklyuchitBlobs(blobs.getStore);

const NOVYH_OKON_NA_ZAYAVKU = 5;

function yazykPoZagolovku(h, k) {
  const al = String((h || {})['accept-language'] || '').toLowerCase();
  if (al.startsWith('ru') || al.includes(',ru')) return 'ru';
  return al ? 'en' : k.yazyk_po_umolchaniyu;
}

function razobratTelo(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  const ct = String((event.headers || {})['content-type'] || '');
  if (ct.includes('application/json')) { try { return JSON.parse(raw); } catch (_) { return {}; } }
  return Object.fromEntries(new URLSearchParams(raw));
}

const zvonokStroka = (k, y, slot) => P.podstavit(S.T[y].zvonok,
  { vremya: P.vremya(slot, k, y), poyas: k.kalendar['poyas_' + y], dlina: k.kalendar.dlina_min });

// Новые окна для того же человека — не больше NOVYH_OKON_NA_ZAYAVKU раз на заявку.
async function svezhieOkna(k, lid) {
  const s = H.store(Z.HRAN);
  const n = await H.schetchik(s, `novye:${k.klient}:${lid.z}`);
  if (n.bylo >= NOVYH_OKON_NA_ZAYAVKU) return { ok: false, ssylki: [] };
  return Z.novyeOkna(k, lid);
}

async function get(event, k) {
  const q = event.queryStringParameters || {};
  const t = String(q.t || '');
  const lid = await Z.prochitat(k, t);
  if (!lid) { const y = yazykPoZagolovku(event.headers, k); return S.stranica(k, y, { zagolovok: S.T[y].net_h, abzacy: [S.T[y].net_p], kod: 404 }); }
  const y = lid.yazyk === 'en' ? 'en' : 'ru';
  const b = await Z.bronZayavki(k, lid.z);
  if (b) return S.stranica(k, y, { zagolovok: S.T[y].uzhe_h, abzacy: [zvonokStroka(k, y, b.slot), S.T[y].uzhe_p] });
  const porog = (k.kalendar.ne_ranshe_pri_zapisi_chasov || 1) * 3600e3;
  if (new Date(lid.slot).getTime() - Date.now() < porog) {
    // Прошедшее время: свежих окон на GET не ищем (это запрос к календарю от каждого сканера),
    // а даём кнопку — POST покажет новые.
    return S.stranica(k, y, { zagolovok: S.T[y].isteklo_h, abzacy: [zvonokStroka(k, y, lid.slot)],
      knopka: { token: t, tekst: y === 'ru' ? 'Показать свободное время' : 'Show open times' } });
  }
  return S.stranica(k, y, { zagolovok: S.T[y].podtverdit_h,
    abzacy: [zvonokStroka(k, y, lid.slot), P.podstavit(S.T[y].podtverdit_p, { pochta: S.maska(lid.pochta) })],
    knopka: { token: t, tekst: S.T[y].podtverdit_b } });
}

async function post(event, k) {
  const d = razobratTelo(event);
  const t = String(d.t || '');
  const r = await Z.zapisat(k, t);
  const lid = r.lid;
  const y = lid && lid.yazyk === 'en' ? 'en' : (lid ? 'ru' : yazykPoZagolovku(event.headers, k));

  if (r.status === 'net') return S.stranica(k, y, { zagolovok: S.T[y].net_h, abzacy: [S.T[y].net_p], kod: 404 });

  if (r.status === 'uzhe') {
    if (r.idet) return S.stranica(k, y, { zagolovok: S.T[y].idet_h, abzacy: [S.T[y].idet_p] });
    return S.stranica(k, y, { zagolovok: S.T[y].uzhe_h, abzacy: [zvonokStroka(k, y, r.slot), S.T[y].uzhe_p] });
  }

  if (r.status === 'zanyato' || r.status === 'isteklo') {
    const okna = await svezhieOkna(k, lid);
    return S.stranica(k, y, { zagolovok: r.status === 'zanyato' ? S.T[y].zanyato_h : S.T[y].isteklo_h,
      abzacy: [zvonokStroka(k, y, lid.slot)], okna, kod: 409 });
  }

  if (r.status === 'zapisano') {
    // Обычная функция живёт 10 секунд, а календарь и хранилище уже съели часть. Поэтому Resend ждём
    // не дольше 3,5 с на письмо: лучше честное «письмо не ушло» на странице, чем обрыв без ответа.
    const podtv = await P.poslat(P.pismoPodtverzhdenie(k, lid, r.slot, r.id), `zapis-${k.klient}-${lid.z}`, 3500);
    await P.poslat(P.pismoVladelcuZapis(k, lid, r, podtv), `vladelcu-zapis-${k.klient}-${lid.z}`, 3500);
    console.log('[zapis] записано:', lid.z, r.slot, 'подтверждение', podtv.kod || (podtv.suhoy ? 'холосто' : podtv.oshibka));
    return S.stranica(k, y, { zagolovok: S.T[y].zapisano_h,
      abzacy: [zvonokStroka(k, y, r.slot), podtv.ok ? P.podstavit(S.T[y].zapisano_p, { pochta: S.maska(lid.pochta) }) : S.T[y].zapisano_bez_pisma] });
  }

  // oshibka
  console.log('[zapis] не записано:', r.pochemu);
  if (lid) await P.poslat(P.pismoVladelcuSboy(k, lid, r.pochemu || 'сбой'), `vladelcu-sboy-${k.klient}-${t}`, 3500);
  return S.stranica(k, y, { zagolovok: S.T[y].oshibka_h, abzacy: [S.T[y].oshibka_p], kod: 503 });
}

exports.handler = async (event) => {
  H.nachat(event);
  const k = K.vzyat();
  try {
    if (event.httpMethod === 'GET' || event.httpMethod === 'HEAD') return await get(event, k);
    if (event.httpMethod === 'POST') return await post(event, k);
    return { statusCode: 405, headers: { allow: 'GET, POST' }, body: '' };
  } catch (e) {
    console.log('[zapis] упало:', e && e.stack || e);
    const y = yazykPoZagolovku(event.headers, k);
    return S.stranica(k, y, { zagolovok: S.T[y].oshibka_h, abzacy: [S.T[y].oshibka_p], kod: 500 });
  }
};
