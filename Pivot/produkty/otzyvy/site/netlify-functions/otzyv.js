// Владелец вставляет текст отзыва: /otzyv?t=<подпись>. Ссылка — в каждой тревоге без текста и в отчёте.
// Плохой отзыв (1–3★ или 4★ с жалобой) → фоновая функция пишет черновик и шлёт тревогу со страницей
// решения. Хороший — принимаем, тревоги нет.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const S = require('../lib/podpis');
const T = require('../lib/trevoga');
const SH = require('../lib/shablony');
const P = require('../lib/pisma');
const L = require('../lib/limity');
const { stranica, teloFormy, E } = require('../lib/stranica');
N.podklyuchit(blobs);

function forma(t, k) {
  return `<p class="tih">${E(k.biznes.imya)}</p>`
    + `<form method="post" action="${E('/otzyv?t=' + encodeURIComponent(t))}">`
    + '<label>Сколько звёзд</label><select name="zvyozd"><option value="1">1★</option><option value="2">2★</option><option value="3">3★</option><option value="4">4★</option><option value="5">5★</option></select>'
    + '<label>Имя автора, как в Google</label><input name="avtor" maxlength="60" autocomplete="off">'
    + '<label>Текст отзыва</label><textarea name="tekst" rows="7" maxlength="4000"></textarea>'
    + '<label><input type="checkbox" name="zhaloba" value="1" style="width:auto;margin-right:8px">В отзыве жалоба (для 4★)</label><br>'
    + '<button type="submit">Прислать ответ</button></form>'
    + '<p class="tih">Черновик ответа придёт письмом через минуту-две. Публикуете вы сами, в Google.</p>';
}

// Фоновую функцию зовём по своему адресу: Netlify отвечает 202 сразу, черновик пишется до 15 минут.
async function pozvatChernovik(klient, id) {
  const url = (process.env.URL || P.baza()) + '/.netlify/functions/chernovik-background';
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-otzyvy-admin': process.env.OTZYVY_KLYUCH_ADMINA || '' },
      body: JSON.stringify({ klient, id }) });
    return r.status === 202 || r.ok;
  } catch (e) { console.log('[otzyv] фоновая функция не позвана:', e.message); return false; }
  finally { clearTimeout(tm); }
}

exports.handler = async (event) => {
  H.nachat(event);
  const q = event.queryStringParameters || {};
  const d = S.proverit(q.t, 'v');
  const k = d ? K.vzyat(d.k) : null;
  if (!k || K.proverit(k).length) return stranica(404, 'Ссылка не найдена', '<p>Эта ссылка не работает. Напишите нам на support@businessinteldna.com.</p>');
  if (event.httpMethod === 'GET') return stranica(200, 'Вставить отзыв', forma(q.t, k));
  if (event.httpMethod !== 'POST') return stranica(405, 'Вставить отзыв', '');

  const f = teloFormy(event);
  const zvyozd = parseInt(f.zvyozd, 10);
  const tekst = String(f.tekst || '').replace(/\r/g, '').trim().slice(0, 4000);
  if (!(zvyozd >= 1 && zvyozd <= 5)) return stranica(400, 'Вставить отзыв', '<p>Выберите число звёзд.</p>' + forma(q.t, k));
  if (tekst.length < 3) return stranica(400, 'Вставить отзыв', '<p>Вставьте текст отзыва.</p>' + forma(q.t, k));
  const s = H.store('otzyvy');
  const r = await T.prinyat(s, k, { zvyozd, avtor: String(f.avtor || '').trim().slice(0, 60), tekst, zhaloba: f.zhaloba === '1' });
  if (!r) return stranica(503, 'Не сохранилось', '<p>Попробуйте ещё раз через минуту.</p>');
  if (!r.negativ) return stranica(200, 'Отзыв принят', `<p>Отзыв на ${zvyozd}★ — тревоги нет. Черновики пишем на 1–${k.trevoga.zvyozd_do}★ и на 4★ с жалобой.</p>`);
  if (!(await L.vklyuchen(s)).vklyucheno || !k.vklyuchen)
    return stranica(200, 'Отзыв принят', '<p>Сборщик сейчас выключен: отзыв сохранён, черновик не пишем. Напишите нам на support@businessinteldna.com.</p>');
  const pozvali = await pozvatChernovik(k.klient, r.id);
  const ssylka = SH.ssylkaReshenie(k, r.id, 'kopir');
  return stranica(200, 'Отзыв принят', (pozvali
      ? '<p>Черновик ответа придёт письмом через минуту-две.</p>'
      : '<p>Черновик пишется с задержкой — письмо придёт позже.</p>')
    + `<p><a class="kn" href="${E(ssylka)}">Страница ответа</a></p>`);
};
