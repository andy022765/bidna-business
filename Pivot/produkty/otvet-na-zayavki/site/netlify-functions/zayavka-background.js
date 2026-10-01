// Заявка с сайта → ответ человеку за секунды: цены из карточки + ссылка на запись (Calendly).
// Плюс письмо владельцу, что именно ушло.
//
// ЗАПИСЬ — В CALENDLY. Решение Андрея 29.09 ~18:05: «Оставляем просто календарь, сразу приходит
// календарь календли». Ссылка — одна строка паспорта (kartochka/bid.json → ssylka_zapisi).
// Своих трёх окон и своей записи здесь нет, в Google функция не ходит. Код записи отложен в
// na-potom/ (для клиентов без своей системы записи) и в выкладку не входит.
//
// КТО ЗОВЁТ. Только сервер основного сайта (submission-created.js или hochet-zvonok.js),
// с общим секретом в заголовке x-otvet-secret. Публичной формы у этой функции нет: иначе она
// стала бы открытым ретранслятором писем с нашего домена.
//
// ПОЧЕМУ ФОНОВАЯ (-background). Netlify отвечает вызывающему 202 сразу, а работа идёт до 15 минут.
// Основной сайт не ждёт хранилища и Resend, его функция укладывается в свои 10 секунд.
// Цена этого — Netlify может ПОВТОРИТЬ фоновую функцию при сбое. Поэтому заявка записывается
// «только если новая» (onlyIfNew), а у писем свой ключ Idempotency-Key.
//
// ЧТО ПРИХОДИТ (JSON):
//   id          — id отправки Netlify Forms или любой уникальный; нет — считаем сами (почта+форма+страница+сутки)
//   forma       — имя формы: на какие отвечать, решает карточка (kartochka/bid.json → formy)
//   stranica    — путь или адрес страницы, с которой пришли: по нему выбирается продукт и язык
//   pochta, imya, telefon, soobshchenie, yazyk (ru|en, необязательно)
//
// env: OTVET_SECRET · RESEND_API_KEY · EV_BLOBS_TOKEN (или NETLIFY_API_TOKEN) · OTVET_SUHOY (1 — не слать)
//      · OTVET_KLIENT (bid). Календарных переменных живому пути не нужно.

const crypto = require('crypto');
const blobs = require('@netlify/blobs');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const P = require('../lib/pisma');

H.podklyuchit(blobs);

const HRAN = 'otvet';

const POHOZH_NA_POCHTU = /^[a-z0-9+_.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const den = () => new Date(Date.now()).toISOString().slice(0, 10);

function sekretVeren(prishel) {
  const nado = process.env.OTVET_SECRET || '';
  if (!nado || nado.length < 16) return false;             // короткий или пустой секрет = выключено
  const a = Buffer.from(String(prishel || '')), b = Buffer.from(nado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function obrabotat(event) {
  const t0 = Date.now();
  const h = event.headers || {};
  if (!sekretVeren(h['x-otvet-secret'] || h['X-Otvet-Secret'])) { console.log('[zayavka] неверный секрет'); return { itog: 'sekret' }; }

  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) { console.log('[zayavka] тело не JSON'); return { itog: 'json' }; }

  const k = K.vzyat();
  const pochta = String(d.pochta || d.email || '').trim().toLowerCase().slice(0, 120);
  if (!POHOZH_NA_POCHTU.test(pochta)) { console.log('[zayavka] почта не похожа на почту'); return { itog: 'pochta' }; }
  const forma = String(d.forma || '').trim().slice(0, 60);
  const stranica = K.put(d.stranica).slice(0, 200);
  const produkt = K.produktDlya(k, forma, stranica);
  if (!produkt) { console.log('[zayavka] форма не из карточки, не отвечаем:', forma); return { itog: 'forma' }; }

  const soobshchenie = String(d.soobshchenie || '').replace(/\r/g, '').trim().slice(0, 2000);
  const lid = {
    z: String(d.id || '').replace(/[^\w-]/g, '').slice(0, 60)
      || crypto.createHash('sha256').update([pochta, forma, stranica, den()].join('|')).digest('hex').slice(0, 24),
    pochta, forma, stranica, produkt,
    imya: P.chistoeImya(d.imya),
    telefon: String(d.telefon || '').replace(/[^\d+()\- ]/g, '').trim().slice(0, 30),
    soobshchenie, est_vopros: soobshchenie.length > 0,
    yazyk: K.yazykDlya(k, forma, stranica, d.yazyk),
  };

  const s = H.store(HRAN);
  if (!s) console.log('[zayavka] ХРАНИЛИЩА НЕТ: дубли держит только Idempotency-Key, потолков нет');

  // Дубли: повтор фоновой функции или двойная отправка формы.
  const novaya = await H.pervym(s, `z:${k.klient}:${lid.z}`, { lid, prinyata: Date.now(), status: 'v_rabote' });
  if (novaya === false) {
    // Прошлый заход упал посреди работы (статус так и остался «в работе») — это повтор после
    // сбоя, его надо довести. Письма второй раз не уйдут: их держит Idempotency-Key.
    const bylo = await H.vzyat(s, `z:${k.klient}:${lid.z}`);
    if (!(bylo && bylo.status === 'v_rabote' && Date.now() - (bylo.prinyata || 0) > 120000)) {
      console.log('[zayavka] уже обработана:', lid.z); return { itog: 'dubl' };
    }
    console.log('[zayavka] повтор после сбоя, довожу:', lid.z);
  }

  // Потолки: на один адрес и на всех за сутки. Выше — человеку не пишем, владельцу пишем.
  const naAdres = await H.schetchik(s, `lim:${k.klient}:${den()}:${pochta}`);
  const vsego = await H.schetchik(s, `lim:${k.klient}:${den()}:__vsego`);
  if (naAdres.bylo >= k.pochta.lidu_na_adres_v_sutki || vsego.bylo >= k.pochta.lidam_v_sutki) {
    console.log('[zayavka] потолок ответов, человеку не пишем:', naAdres.bylo, vsego.bylo);
    await P.poslat({ from: k.pochta.ot, to: k.pochta.vladelcu, reply_to: [pochta],
      subject: `Заявка без ответа (потолок): ${pochta}`,
      text: `Автоответ не ушёл: потолок ${naAdres.bylo >= k.pochta.lidu_na_adres_v_sutki ? 'на один адрес (' + k.pochta.lidu_na_adres_v_sutki + ' в сутки)' : 'на всех (' + k.pochta.lidam_v_sutki + ' в сутки)'}.\n\nПочта: ${pochta}\nФорма: ${forma} · ${stranica}` +
            (soobshchenie ? '\n\nСообщение:\n' + soobshchenie : '') }, `vladelcu-limit-${k.klient}-${lid.z}`);
    // Статус закрываем: иначе заявка навсегда осталась бы «в работе», и такая же отправка
    // через пару минут считалась бы «повтором после сбоя» и прогонялась заново (ревью 29.09).
    await H.polozhit(s, `z:${k.klient}:${lid.z}`, { lid, prinyata: t0, status: 'limit' });
    return { itog: 'limit' };
  }

  // Цены продукта + ссылка на запись из паспорта. Время человек выбирает сам в Calendly.
  const pismo = P.pismoOtvet(k, lid);
  const otvet = await P.poslat(pismo, `otvet-${k.klient}-${lid.z}`);
  const sekund = Math.max(1, Math.round((Date.now() - t0) / 1000));

  // Владельцу — с дневным потолком; последнее письмо перед потолком об этом говорит.
  const vl = await H.schetchik(s, `vl:${k.klient}:${den()}`);
  let vladelcu = { ok: false, propushcheno: true };
  if (vl.bylo < k.pochta.vladelcu_v_sutki) {
    vladelcu = await P.poslat(P.pismoVladelcuOtvet(k, lid, { otvet, sekund, pismo,
      posledneeSegodnya: vl.bylo === k.pochta.vladelcu_v_sutki - 1 }), `vladelcu-otvet-${k.klient}-${lid.z}`);
  } else console.log('[zayavka] потолок писем владельцу, не пишу');

  await H.polozhit(s, `z:${k.klient}:${lid.z}`, { lid, prinyata: t0, status: otvet.ok ? 'otvecheno' : 'ne_ushlo',
    resend: otvet.kod, sekund });
  console.log('[zayavka] готово:', lid.z, 'продукт', produkt, 'язык', lid.yazyk,
              'человеку', otvet.kod || (otvet.suhoy ? 'холосто' : otvet.oshibka), 'владельцу', vladelcu.kod || '-', sekund + ' с');
  return { itog: otvet.ok ? 'otvecheno' : 'ne_ushlo', lid };
}

exports.handler = async (event) => {
  H.nachat(event);
  try {
    const r = await obrabotat(event);
    // Фоновой функции ответ никто не читает (Netlify уже вернул 202). Тело — для тестов и журнала.
    return { statusCode: 200, body: JSON.stringify({ itog: r.itog }) };
  } catch (e) {
    console.log('[zayavka] упало:', e && e.stack || e);
    return { statusCode: 500, body: '{"itog":"oshibka"}' };
  }
};
exports._obrabotat = obrabotat;
