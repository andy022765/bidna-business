// Проверка после выкладки: всё ли на месте, ничего не отправляя.
//   curl -H "x-otvet-secret: $OTVET_SECRET" https://<сайт>/.netlify/functions/zdorovie
// Отвечает: паспорт цел (и его хэш), какие переменные заданы, поднялось ли хранилище (и каким
// путём) и открывается ли страница записи из паспорта (Calendly).
//
// КАЛЕНДАРЬ НЕ ТРЕБУЕТСЯ. Запись — в Calendly (решение Андрея 29.09), своего календаря у живого
// пути нет. Проверки календаря записей (закрыт ли он, видит ли занятость, открывается ли /zapis)
// отложены вместе с записью: na-potom/lib/zdorovie-zapis.js.

const crypto = require('crypto');
const blobs = require('@netlify/blobs');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');

H.podklyuchit(blobs);

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };

// Открывается ли страница записи. ok: true — ответила 2xx; false — 404/410, ссылка в паспорте
// битая (опечатка, тип встречи удалён или переименован); null — проверить не удалось (сеть,
// 403 от защиты Calendly от ботов, 5xx): тогда ok сайта не роняем, а просим открыть ссылку глазами.
// 200 доказывает, что страница есть, но не что за ней нужный тип встречи.
async function stranicaZapisi(url) {
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (r.status >= 200 && r.status < 300) return { ok: true, ssylka: url, kod: r.status };
    if (r.status === 404 || r.status === 410) return { ok: false, ssylka: url, kod: r.status,
      oshibka: 'страницы записи нет — ссылка ssylka_zapisi в паспорте битая, в письмах ведёт в никуда' };
    return { ok: null, ssylka: url, kod: r.status, oshibka: 'не удалось проверить (код ' + r.status + ') — откройте ссылку глазами' };
  } catch (e) {
    return { ok: null, ssylka: url, oshibka: 'не удалось проверить (' + (e.name === 'AbortError' ? 'таймаут 5 с' : e.message) + ') — откройте ссылку глазами' };
  } finally { clearTimeout(tm); }
}

exports.handler = async (event) => {
  H.nachat(event);
  const nado = process.env.OTVET_SECRET || '';
  const prishel = String((event.headers || {})['x-otvet-secret'] || '');
  const a = Buffer.from(prishel), b = Buffer.from(nado);
  if (!nado || nado.length < 16 || a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return { statusCode: 401, headers: JSON_H, body: '{"ok":false}' };

  const k = K.vzyat();
  const out = {
    kartochka: { klient: k.klient, versiya: k.versiya, hesh: k.__hesh, problemy: K.proverit(k) },
    peremennye: {
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      EV_BLOBS_TOKEN: !!(process.env.EV_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN),
      OTVET_SUHOY: process.env.OTVET_SUHOY === '1',
    },
  };
  const s = H.store('otvet');
  out.hranilishche = s ? s.__rezhim : 'НЕТ';
  if (s) {
    try { await s.set('zdorovie:posledniy', new Date(Date.now()).toISOString()); out.hranilishche_zapis = true; }
    catch (e) { out.hranilishche_zapis = 'упало: ' + e.message; }
  }
  out.zapis = k.ssylka_zapisi ? await stranicaZapisi(k.ssylka_zapisi) : { ok: false, oshibka: 'нет ssylka_zapisi в паспорте' };
  // Хранилище держит дубли и потолки писем: без записи в него повтор фоновой функции прикрыт
  // только ключом Resend, а потолков нет вовсе. Поэтому запись в него — условие ok.
  out.ok = !!(!out.kartochka.problemy.length && out.peremennye.RESEND_API_KEY && s && out.hranilishche_zapis === true
              && out.zapis.ok !== false);
  return { statusCode: 200, headers: JSON_H, body: JSON.stringify(out, null, 2) };
};
