// Визиты не через Веру (бизнес без Веры, пилот): владелец вносит почту и время конца визита формой
// или вставляет CSV. Ссылка /vizity?t=<подпись> — в месячном отчёте; своя у каждого бизнеса.
//
// Просьба уйдёт по тем же правилам, что и после Веры: через 2–3 ч после конца визита, в окно 9–19,
// одно напоминание, отписка и «недавно просили» действуют. По старой базе разом не шлём: визиты старше
// ne_starshe_dney (7) не принимаются, а принятый визит, не отправленный за 48 ч, устаревает.
// Выборочная просьба «только довольным» запрещена — это сказано на самой форме, крупно.
const crypto = require('crypto');
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const S = require('../lib/podpis');
const V = require('../lib/vremya');
const VZ = require('../lib/vizity');
const L = require('../lib/limity');
const { stranica, teloFormy, E } = require('../lib/stranica');
N.podklyuchit(blobs);

const VPERED_DNEY = 14;

function forma(t, k) {
  const deystvie = '/vizity?t=' + encodeURIComponent(t);
  return `<p class="tih">${E(k.biznes.imya)} · время — ${E(k.biznes.poyas)}</p>`
    + '<p><b>Вносите всех клиентов подряд, не только довольных.</b> Выбирать, кого просить об отзыве, Google запрещает, а FTC считает нарушением.</p>'
    + `<form method="post" action="${E(deystvie)}">`
    + '<label>Почта клиента</label><input name="pochta" type="email" autocomplete="off">'
    + '<label>Имя (необязательно)</label><input name="imya" maxlength="60" autocomplete="off">'
    + '<label>Когда закончился визит</label><input name="kogda" type="datetime-local">'
    + '<label>Или список CSV: почта, имя, дата и время — по строке на визит</label>'
    + '<textarea name="csv" rows="6" placeholder="maria@example.com, Maria, 2026-10-05 14:30"></textarea>'
    + '<button type="submit">Внести</button></form>'
    + `<p class="tih">Просьба уйдёт через 2–3 часа после конца визита, с ${k.pisma.okno_s}:00 до ${k.pisma.okno_do}:00. Кто отписался или получал просьбу за последние ${k.pisma.adres_ne_chashche_dney} дней — не получит. Визиты старше ${k.istochniki.forma.ne_starshe_dney} дней не принимаются, за сутки — не больше ${k.istochniki.forma.v_sutki}.</p>`;
}

exports.handler = async (event) => {
  H.nachat(event);
  const q = event.queryStringParameters || {};
  const d = S.proverit(q.t, 'f');
  const k = d ? K.vzyat(d.k) : null;
  if (!k || K.proverit(k).length || !k.istochniki.forma.vklyuchena) return stranica(404, 'Ссылка не найдена', '<p>Эта ссылка не работает. Напишите нам на support@businessinteldna.com.</p>');
  if (event.httpMethod === 'GET') return stranica(200, 'Внести визиты', forma(q.t, k));
  if (event.httpMethod !== 'POST') return stranica(405, 'Внести визиты', '');

  const f = teloFormy(event);
  const teper = Date.now();
  const poyas = k.biznes.poyas;
  const predel = k.istochniki.forma.strok_za_raz;
  const stroki = [], oshibki = [];
  if (String(f.pochta || '').trim()) {
    const pochta = String(f.pochta).trim().toLowerCase();
    const konec = VZ.razobratVremya(String(f.kogda || '').replace('T', ' '), poyas);
    if (!K.POCHTA.test(pochta)) oshibki.push({ stroka: 'форма', pochemu: 'почта не похожа на почту' });
    else if (konec == null) oshibki.push({ stroka: 'форма', pochemu: 'нет времени визита' });
    else stroki.push({ pochta, imya: String(f.imya || '').trim().slice(0, 60), konec });
  }
  if (String(f.csv || '').trim()) {
    const r = VZ.razobratCSV(f.csv, poyas, predel);
    stroki.push(...r.stroki); oshibki.push(...r.oshibki);
  }
  const s = H.store('otzyvy');
  let prinyato = 0, uzhe = 0;
  // Потолок визитов формой за местные сутки (паспорт forma.v_sutki): ссылка без срока — пересланный
  // отчёт не должен давать чужому человеку слать просьбы по своему списку без предела.
  const lk = L.kl.forma(k, teper);
  let zaSutki = await H.prochitatChislo(s, lk);
  for (const st of stroki.slice(0, predel)) {
    if (zaSutki == null || zaSutki >= k.istochniki.forma.v_sutki) {
      oshibki.push({ stroka: st.pochta, pochemu: zaSutki == null ? 'не сохранилось — попробуйте ещё раз' : `за сутки уже внесено ${k.istochniki.forma.v_sutki} визитов — остальное завтра` });
      continue;
    }
    if (st.konec < teper - k.istochniki.forma.ne_starshe_dney * V.DEN_MS) { oshibki.push({ stroka: st.pochta, pochemu: `визит старше ${k.istochniki.forma.ne_starshe_dney} дней — по старой базе не просим` }); continue; }
    if (st.konec > teper + VPERED_DNEY * V.DEN_MS) { oshibki.push({ stroka: st.pochta, pochemu: 'визит дальше двух недель вперёд' }); continue; }
    const vid = 'f-' + crypto.createHash('sha256').update([k.klient, S.heshPochty(st.pochta), V.mestnyyDen(st.konec, poyas)].join('|')).digest('hex').slice(0, 24);
    const z = await H.pervym(s, `aktiv/${k.klient}/${vid}`, { vid, istochnik: 'forma', konec: st.konec, pochta: st.pochta,
                                                          imya: st.imya, yazyk: '', sozdan: teper });
    if (z === null) { oshibki.push({ stroka: st.pochta, pochemu: 'не сохранилось — попробуйте ещё раз' }); continue; }
    if (z) { prinyato++; zaSutki++; await H.pribavit(s, lk); } else uzhe++;
  }
  console.log('[vizity]', k.klient, 'принято', prinyato, 'уже было', uzhe, 'отклонено', oshibki.length);
  const spisokOshibok = oshibki.length ? '<p><b>Не принято:</b></p><ul>' + oshibki.slice(0, 50).map(o => `<li>${E(o.stroka)}: ${E(o.pochemu)}</li>`).join('') + '</ul>' : '';
  return stranica(200, 'Визиты приняты', `<p>Принято: ${prinyato}. Уже были внесены: ${uzhe}. Не принято: ${oshibki.length}.</p>${spisokOshibok}`
    + `<p><a class="kn vt" href="${E('/vizity?t=' + encodeURIComponent(q.t))}">Внести ещё</a></p>`);
};
