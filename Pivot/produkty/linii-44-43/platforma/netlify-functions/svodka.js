'use strict';
// Утренняя сводка владельцу агентства в 7:00 по его поясу (A5). Запускается по расписанию (netlify.toml).
//
// ЛЕТНЕЕ ВРЕМЯ. Cron Netlify — в UTC. 7:00 America/New_York = 11:00 UTC летом (EDT) и 12:00 UTC зимой (EST).
// Расписание зовёт функцию дважды — в 11 и 12 UTC; письмо уходит только тот раз, когда местный час клиента
// равен svodka.chas (7), и не чаще раза в сутки (замок svodka/<дата> в хранилище клиента). Так сводка приходит
// в 7:00 круглый год без правки cron при переводе часов (ближайший — 1 ноября 2026).
// Пропуск: если запуск в 7:xx упал, повтора в этот день нет (второй запуск — в 8:00 или 6:00 местного).
//
// Данные — снимок пульта на 7:00 (lib/shablony/snimok.js), текст письма — renderSvodka (lib/shablony/svodka.js,
// сборщик пульта). Отправка — lib/otpravka (DRY_RUN=1: в журнал, что ушло бы). Копия сводки — svodki/<дата>.
// С 01.10 тем же запуском раз в сутки — чистка итогов звонков старше срока хранения (lib/chistka.js, ниже).

const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { seychas, mestnoe, denKlyuch, iso, POYAS } = require('../lib/vremya');
const { zapisiKlienta } = require('../lib/pult-dannye');
const { sobratSnimok } = require('../lib/shablony/snimok');
const { renderSvodka } = require('../lib/shablony/svodka');
const otpravka = require('../lib/otpravka');
const { zapisat } = require('../lib/zhurnal');
const { chistkaZaDen } = require('../lib/chistka');

async function svodkaKlienta(klient, { teper = seychas(), sila = false } = {}) {
  const cfg = klient.svodka || {};
  if (cfg.vklyuchena === false) return { klient: klient.id, propushcheno: 'vyklyuchena' };
  const poyas = klient.poyas || POYAS;
  const chas = Number.isFinite(Number(cfg.chas)) ? Number(cfg.chas) : 7;
  const m = mestnoe(teper, poyas);
  if (!sila && m.chas !== chas) return { klient: klient.id, propushcheno: 'ne_tot_chas', mestnyy_chas: m.chas };
  const st = H.hranilishcheKlienta(klient.id);
  if (!st) return { klient: klient.id, oshibka: 'hranilishche' };
  const den = denKlyuch(teper, poyas);
  if (!(await st.zanyat(`svodka/${den}`, { at: iso(teper, poyas) }))) return { klient: klient.id, propushcheno: 'uzhe_otpravlena', den };
  try {
    const snimok = sobratSnimok({ klient, seychas: new Date(teper), zapisi: await zapisiKlienta(st) });
    // Ссылка с ключом пульта (docs/API.md, раздел 6): кто получил письмо, тот открывает пульт —
    // поэтому svodka_komu только владелец и те, кого он назвал.
    const baza = String(process.env.PLATFORMA_URL || process.env.URL || '').replace(/\/+$/, '');
    const klyuch = linii.klyuchPulta(klient);
    if (baza) snimok.ssylka_pult = `${baza}/pult/${klyuch ? '?k=' + encodeURIComponent(klyuch) : ''}`;
    const { tema, html, text } = renderSvodka(snimok);
    await st.setJSON(`svodki/${den}`, { den, tema, text, html, sformirovano: iso(teper, poyas) });
    const komu = (klient.pisma && klient.pisma.svodka_komu) || [];
    let r = { ok: false, pochemu: 'net_adresa' };
    if (komu.length) {
      r = await otpravka.pismo(st, klient, { komu, tema, html, text, klyuchDubley: `svodka:${klient.id}:${den}`,
                                              kto: 'svodka', obekt: `svodki/${den}` });
    }
    await zapisat(st, { kto: 'svodka', chto: komu.length ? 'svodka' : 'svodka_nekomu', obekt: `svodki/${den}`,
                        detali: { tema, komu: komu.length, rezultat: r.ok ? (r.dry_run ? 'dry_run' : r.uzhe ? 'uzhe' : 'otpravleno') : r.pochemu } }, { poyas });
    return { klient: klient.id, den, tema, otpravka: r };
  } catch (e) {
    try { await st.delete(`svodka/${den}`); } catch (_) {}
    throw e;
  }
}

// Тот же запуск по расписанию раз в сутки чистит старые итоги звонков (lib/chistka.js, срок nastroyki.hranenie.zvonki_dney,
// по умолчанию 30 дней). Чистка не зависит от того, включена ли сводка, и её сбой сводку не роняет.
async function chistkaKlienta(klient, teper) {
  const st = H.hranilishcheKlienta(klient.id);
  if (!st) return { klient: klient.id, oshibka: 'hranilishche' };
  return Object.assign({ klient: klient.id }, await chistkaZaDen(st, klient, { teper }));
}

exports.handler = async () => {
  const teper = seychas();
  const itogi = [];
  const chistki = [];
  for (const klient of linii.vseKlienty()) {
    try { itogi.push(await svodkaKlienta(klient, { teper })); }
    catch (e) { itogi.push({ klient: klient.id, oshibka: e.message }); }
    try { chistki.push(await chistkaKlienta(klient, teper)); }
    catch (e) { chistki.push({ klient: klient.id, oshibka: e.message }); }
  }
  console.log('[svodka]', JSON.stringify(itogi.map((x) => ({ klient: x.klient, den: x.den, propushcheno: x.propushcheno, oshibka: x.oshibka }))));
  console.log('[svodka] чистка', JSON.stringify(chistki.map((x) => ({ klient: x.klient, den: x.den, propushcheno: x.propushcheno, udaleno: x.udaleno, oshibka: x.oshibka }))));
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, itogi: itogi.length }) };
};

exports.svodkaKlienta = svodkaKlienta;
