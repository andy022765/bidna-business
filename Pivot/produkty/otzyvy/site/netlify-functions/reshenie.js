// Страница решения по плохому отзыву: /reshenie?t=<подпись>&d=kopir|opublikoval|pravka|net.
// Кнопки письма ведут сюда; параметр d только подсвечивает нужную кнопку. Действие — кнопкой на
// странице (POST): почтовый сканер, открыв ссылку, ничего не «нажимает».
// «Скопировать и открыть отзыв» — копирование в буфер и ссылка на отзывы в Google. Публикует владелец сам,
// пока Google не дал доступ к API (PLAN-DLYA-ANDREYA п. 8).
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const S = require('../lib/podpis');
const T = require('../lib/trevoga');
const SH = require('../lib/shablony');
const { stranica, teloFormy, E } = require('../lib/stranica');
N.podklyuchit(blobs);

const NAZV = { opublikoval: 'Опубликовал', net: 'Не отвечать', pravka: 'Правка сохранена' };
const SKRIPT = "var b=document.getElementById('kopir');if(b)b.addEventListener('click',function(){var t=document.getElementById('otvet');"
  + "t.select();try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}b.textContent='Скопировано';});";

function telo(t, k, rec, podsvetka, soobshchenie) {
  const deystvie = E('/reshenie?t=' + encodeURIComponent(t));
  const akt = (d) => (podsvetka === d ? ' akt' : '');
  const zv = '★'.repeat(rec.zvyozd || 0);
  const h = [];
  if (soobshchenie) h.push(`<p><b>${E(soobshchenie)}</b></p>`);
  h.push(`<p class="tih">${E(k.biznes.imya)} · ${E(zv)} · ${E(rec.avtor || 'Без имени')}</p>`);
  if (rec.tekst) h.push(`<blockquote>${E(rec.tekst)}</blockquote>`);
  if (rec.reshenie && ['opublikoval', 'net'].includes(rec.reshenie.d)) {
    h.push(`<p>Отмечено: ${E(NAZV[rec.reshenie.d])}.</p>`);
    if (rec.tekst_otveta) h.push(`<label>Ответ</label><textarea id="otvet" rows="6" readonly>${E(rec.tekst_otveta)}</textarea>`);
    return h.join('');
  }
  if (!rec.tekst_otveta && rec.status === 'zhdet_chernovik') h.push('<p>Черновик ещё пишется — обновите страницу через минуту.</p>');
  h.push(`<form method="post" action="${deystvie}"><input type="hidden" name="d" value="pravka">`
    + `<label>Ответ (можно править)</label><textarea id="otvet" name="tekst" rows="7" maxlength="2000">${E(rec.tekst_otveta || '')}</textarea>`
    + `<button type="button" id="kopir" class="${akt('kopir').trim()}">Скопировать</button>`
    + `<a class="kn vt${akt('kopir')}" href="${E(SH.otzyvyVGoogle(k))}" target="_blank" rel="noopener noreferrer">Открыть отзывы в Google</a>`
    + `<button type="submit" class="vt${akt('pravka')}">Сохранить правку</button></form>`);
  h.push(`<form method="post" action="${deystvie}" style="display:inline"><input type="hidden" name="d" value="opublikoval"><button type="submit" class="${akt('opublikoval').trim()}">Опубликовал</button></form>`
    + `<form method="post" action="${deystvie}" style="display:inline"><input type="hidden" name="d" value="net"><button type="submit" class="vt${akt('net')}">Не отвечать</button></form>`);
  h.push('<p class="tih">Совет: свяжитесь с клиентом до ответа. Ответ проходит модерацию Google и появляется не сразу.</p>');
  return h.join('');
}

exports.handler = async (event) => {
  H.nachat(event);
  const q = event.queryStringParameters || {};
  const d = S.proverit(q.t, 'r');
  const k = d ? K.vzyat(d.k) : null;
  if (!k || !T.ID.test(String(d.v || ''))) return stranica(404, 'Ссылка не найдена', '<p>Ссылка устарела или повреждена. Откройте последнее письмо о отзыве или напишите нам на support@businessinteldna.com.</p>');
  const s = H.store('otzyvy');
  if (event.httpMethod === 'POST') {
    const f = teloFormy(event);
    const r = await T.reshit(s, k, d.v, f.d, f.tekst);
    if (r.itog === 'net' || r.itog === 'id') return stranica(404, 'Отзыв не найден', '<p>Возможно, прошло больше 90 дней.</p>');
    if (r.itog === 'sboy') return stranica(503, 'Не сохранилось', '<p>Попробуйте ещё раз через минуту.</p>');
    const soob = r.itog === 'ok' ? NAZV[f.d] : r.itog === 'uzhe' ? 'Уже отмечено раньше' : r.itog === 'pusto' ? 'Пустой ответ не сохраняем' : 'Не понял действие';
    return stranica(200, 'Ответ на отзыв', telo(q.t, k, r.rec, '', soob), { skript: SKRIPT });
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return stranica(405, 'Ответ на отзыв', '');
  const rec = await H.vzyat(s, T.klOtzyv(k, d.v));
  if (!rec) return stranica(404, 'Отзыв не найден', '<p>Возможно, прошло больше 90 дней.</p>');
  return stranica(200, 'Ответ на отзыв', telo(q.t, k, rec, String(q.d || ''), ''), { skript: SKRIPT });
};
