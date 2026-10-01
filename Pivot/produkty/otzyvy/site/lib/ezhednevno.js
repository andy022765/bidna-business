// Раз в сутки (17:00 UTC — утро в США): месячный отчёт 1-го числа, недельная сверка неявок,
// чистка по срокам хранения.
//
// ОТЧЁТ. Уходит, когда по времени бизнеса 1–3 число месяца и уже 9:00 или позже; за каждый месяц
// один раз (замок otchet/<клиент>/<месяц>). Resend ответил отказом — замок снимается, завтра ещё
// попытка. Ответа нет (таймаут) — замок остаётся: письмо могло уйти, а ключ повтора Resend живёт
// сутки, и завтрашняя попытка дала бы второй отчёт. В отчёте — только настоящие письма (холостые
// не считаются) и рейтинг на день отчёта из живого запроса: истории чисел Google мы не храним.
// НЕЯВКИ. По понедельникам (по времени бизнеса): за прошлые 7 дней неявки, отмены и удаления против
// всех записей из календаря — и закрытых, и ещё ждущих напоминания (иначе доля завышалась и владелец
// получал ложную тревогу). Больше 20% при 5+ записях — письмо владельцу с копией нам
// (PLAN-DLYA-ANDREYA п. 8: удалённую встречу не отличить от отмены, выборочная рассылка запрещена).
// ЧИСТКА. Журнал визитов (с почтой) и отзывы, вставленные владельцем, — 90 дней. Отписки — навсегда.
// «Когда просили этот адрес» — пока действует правило паспорта (по умолчанию 180 дней), понемногу
// за каждый прогон. Отпечаток опроса Google — не старше 30 дней. Счётчики и замки lim/ — 14 дней.
// Чистка идёт и при выключенном выключателе: это срок хранения, не работа.

const H = require('./hranilishche');
const K = require('./kartochka');
const V = require('./vremya');
const L = require('./limity');
const P = require('./pisma');
const SH = require('./shablony');
const PL = require('./places');

const HRAN = 'otzyvy';
const MESYACY = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const HRANIT_DNEY = 90;
const ISK = ['otmena', 'neyavka', 'udaleno', 'net_pochty', 'otpisan', 'nedavno_prosili', 'ustarel'];
// Причины, которые в отчёте владельцу идут в колонку «без почты»: адрес есть, но не подтверждён или их два.
const ISK_SVOD = { pochta_ne_podtverzhdena: 'net_pochty', pochta_neodnoznachna: 'net_pochty' };
const ADRES_ZA_PROGON = 300;
const OTPECHATOK_DNEY = 30;
const nastoyashchee = (f) => !!(f && !f.suhoy);   // письмо ушло на самом деле, не в холостом режиме

async function vizityMesyaca(s, k, mesyac) {
  const recs = [];
  for (const key of (await H.spisok(s, `arhiv/${k.klient}/${mesyac}`)) || []) { const r = await H.vzyat(s, key); if (r) recs.push(r); }
  for (const key of (await H.spisok(s, `aktiv/${k.klient}/`)) || []) {
    const r = await H.vzyat(s, key);
    if (r && V.mestnyyMesyac(r.konec || r.sozdan, k.biznes.poyas) === mesyac) recs.push(r);
  }
  return recs;
}

async function sobratOtchet(s, k, mesyac) {
  const recs = await vizityMesyaca(s, k, mesyac);
  const kliki = new Set(((await H.spisok(s, `klik/${k.klient}/`)) || []).map(x => x.split('/').pop()));
  const isk = Object.fromEntries(ISK.map(x => [x, 0]));
  for (const r of recs) { const x = ISK_SVOD[r.itog] || r.itog; if (x && isk[x] != null) isk[x]++; }
  const d = {
    mesyac, mesyacSlovami: `${MESYACY[+mesyac.slice(5) - 1]} ${mesyac.slice(0, 4)}`,
    vizitov: recs.length, sPochtoy: recs.filter(r => r.pochta).length,
    prosb: recs.filter(r => nastoyashchee(r.zapros)).length, napominaniy: recs.filter(r => nastoyashchee(r.napominanie)).length,
    klikov: recs.filter(r => nastoyashchee(r.zapros) && (r.klik || kliki.has(r.vid))).length,
    isk,
    otpisok: ((await H.spisok(s, `otpiska-zhurnal/${k.klient}/${mesyac}/`)) || []).length,
  };
  // Негатив за месяц: что пришло и что с ним сделано.
  const neg = { vsego: 0, opublikoval: 0, net: 0, pravka: 0, bez: 0, minut: null };
  const minuty = [];
  for (const key of (await H.spisok(s, `otzyv/${k.klient}/${mesyac}`)) || []) {
    const o = await H.vzyat(s, key);
    if (!o || !o.negativ) continue;
    neg.vsego++;
    const r = o.reshenie && o.reshenie.d;
    if (r === 'opublikoval') neg.opublikoval++; else if (r === 'net') neg.net++; else if (r === 'pravka') neg.pravka++; else neg.bez++;
    if (o.chernovik && o.chernovik.ok && o.chernovik.t) minuty.push((o.chernovik.t - o.t) / 60000);
  }
  if (minuty.length) neg.minut = Math.max(1, Math.round(minuty.reduce((a, b) => a + b, 0) / minuty.length));
  d.negativ = neg;
  // Рейтинг и соседи — только живым запросом на день отчёта. Истории чисел Google у нас нет: сравнение
  // с прошлым месяцем — по прошлому отчёту в почте владельца (PLAN-V1 п. 5). Не ответил Google — «нет данных»,
  // сохранённые числа вместо живых не подставляем. Слежение выключено — в Google не ходим вовсе.
  d.rejting = null;
  d.sosedi = [];
  if (k.slezhenie.vklyucheno) {
    const r = await PL.rejting(s, k.biznes.place_id);
    if (r.ok) d.rejting = { rating: r.rating, count: r.count };
    for (const sos of k.slezhenie.sosedi || []) {
      const x = await PL.rejting(s, sos.place_id);
      d.sosedi.push({ imya: sos.imya, ok: x.ok, rating: x.rating, count: x.count });
    }
  }
  return d;
}

async function otchety(s, teper, itog) {
  for (const k of K.rabochie()) {
    const m = V.mestnoe(new Date(teper), k.biznes.poyas);
    if (m.den > 3 || m.chas < 9) continue;
    const mesyac = V.proshlyyMesyac(V.mestnyyMesyac(teper, k.biznes.poyas));
    const zamok = `otchet/${k.klient}/${mesyac}`;
    const z = await H.pervym(s, zamok, { t: teper });
    if (!z) continue;
    const d = await sobratOtchet(s, k, mesyac);
    const r = await P.poslat(SH.pismoOtchet(k, d), `otzyvy-otchet-${k.klient}-${mesyac}`, { suhoy: P.suhoyLi(k) });
    if (!r.ok && !r.kod) {
      // Ответа Resend нет: письмо могло уйти. Завтрашний повтор пришёл бы после срока ключа повтора — дубль.
      await H.polozhit(s, zamok, { t: teper, neizvestno: true, oshibka: String(r.oshibka || '').slice(0, 100) });
      console.log('[ezhednevno] отчёт: ответа Resend нет, не повторяю (проверить в Resend):', k.klient, mesyac);
      itog.otchety[k.klient] = 'neizvestno'; continue;
    }
    if (!r.ok) { await H.ubrat(s, zamok); itog.otchety[k.klient] = 'ne_ushel'; continue; }
    await H.polozhit(s, zamok, { t: teper, ushel: true, suhoy: !!r.suhoy });
    itog.otchety[k.klient] = mesyac;
  }
}

async function neyavki(s, teper, itog) {
  for (const k of K.rabochie()) {
    const m = V.mestnoe(new Date(teper), k.biznes.poyas);
    if (m.dn !== 1) continue;
    const segodnya = V.mestnyyDen(teper, k.biznes.poyas);
    const ot = V.mestnyyDen(teper - 7 * V.DEN_MS, k.biznes.poyas);
    const arhiv = await H.spisok(s, `arhiv/${k.klient}/`);
    const aktiv = await H.spisok(s, `aktiv/${k.klient}/`);
    if (arhiv === null || aktiv === null) { itog.neyavki[k.klient] = { oshibka: 'список не получен' }; continue; }
    const keys = arhiv.filter(x => { const d = x.split('/')[2]; return d >= ot && d < segodnya; });
    let vsego = 0, isklyucheno = 0;
    const uchest = (r) => {
      if (!r || r.istochnik === 'forma') return;
      vsego++;
      if (/^(neyavka|otmena|udaleno)/.test(r.itog || '')) isklyucheno++;
    };
    for (const key of keys) uchest(await H.vzyat(s, key));
    // Визиты недели, которые ещё ждут напоминания, лежат в aktiv/ — без них доля неявок завышена.
    for (const key of aktiv) {
      const r = await H.vzyat(s, key);
      if (!r || !r.konec) continue;
      const d = V.mestnyyDen(r.konec, k.biznes.poyas);
      if (d >= ot && d < segodnya) uchest(r);
    }
    const dolya = vsego ? Math.round((isklyucheno / vsego) * 100) : 0;
    itog.neyavki[k.klient] = { vsego, isklyucheno, dolya };
    if (vsego < 5 || isklyucheno / vsego <= 0.2) continue;
    if (!(await H.pervym(s, `neyavki/${k.klient}/${segodnya}`, { t: teper, vsego, isklyucheno }))) continue;
    await P.poslat(SH.pismoNeyavki(k, { vsego, isklyucheno, dolya }), `otzyvy-neyavki-${k.klient}-${segodnya}`, { suhoy: P.suhoyLi(k) });
  }
}

async function chistka(s, teper, itog) {
  let udaleno = 0;
  const predel = 400;
  const granica = V.utcDen(teper - HRANIT_DNEY * V.DEN_MS);
  const ubrat = async (key) => { if (udaleno < predel && (await H.ubrat(s, key))) udaleno++; };
  for (const key of (await H.spisok(s, 'arhiv/')) || []) {
    const [, kl, den, vid] = key.split('/');
    if (!den || den >= granica) continue;
    await ubrat(key);
    await ubrat(`klik/${kl}/${vid}`);
    await ubrat(`zamok/${kl}/${vid}/1`);
    await ubrat(`zamok/${kl}/${vid}/2`);
  }
  for (const pre of ['otzyv/', 'zamok-chernovik/'])
    for (const key of (await H.spisok(s, pre)) || []) { const den = key.split('/')[2]; if (den && den < granica) await ubrat(key); }
  const granicaLim = V.utcDen(teper - 14 * V.DEN_MS);
  for (const key of (await H.spisok(s, 'lim/')) || []) { const den = key.split('/').pop(); if (/^\d{4}-\d{2}-\d{2}$/.test(den) && den < granicaLim) await ubrat(key); }
  // Числа Google: отпечаток опроса — не старше 30 дней; baza/ и trevoga-opros/ — остатки прежней версии.
  for (const key of (await H.spisok(s, 'otpechatok/')) || []) {
    const o = await H.vzyat(s, key);
    if (!o || !(teper - (o.t || 0) <= OTPECHATOK_DNEY * V.DEN_MS)) await ubrat(key);
  }
  for (const pre of ['baza/', 'trevoga-opros/']) for (const key of (await H.spisok(s, pre)) || []) await ubrat(key);
  // «Когда просили адрес»: храним, пока действует правило паспорта. Читаем понемногу, по кругу.
  const adresa = (await H.spisok(s, 'adres/')) || [];
  const kursor = ((await H.vzyat(s, 'chistka/kursor-adres')) || {}).k || '';
  let porciya = adresa.filter(x => x > kursor).slice(0, ADRES_ZA_PROGON);
  if (!porciya.length) porciya = adresa.slice(0, ADRES_ZA_PROGON);
  for (const key of porciya) {
    const r = await H.vzyat(s, key);
    const k = K.vzyat(key.split('/')[1] || '');
    const dney = k ? k.pisma.adres_ne_chashche_dney : 180;
    if (!r || teper - (r.t || 0) > dney * V.DEN_MS) await ubrat(key);
  }
  if (porciya.length) await H.polozhit(s, 'chistka/kursor-adres', { k: porciya.length < ADRES_ZA_PROGON ? '' : porciya[porciya.length - 1] });
  itog.udaleno = udaleno;
}

async function progon() {
  const teper = Date.now();
  const s = H.store(HRAN);
  if (!s) return { itog: 'net_hranilishcha' };
  await H.polozhit(s, 'pulse/ezhednevno', { t: teper });
  const itog = { itog: 'ok', otchety: {}, neyavki: {}, udaleno: 0 };
  await chistka(s, teper, itog);
  const vk = await L.vklyuchen(s);
  if (!vk.vklyucheno) { itog.itog = 'vyklyucheno'; return itog; }
  await otchety(s, teper, itog);
  await neyavki(s, teper, itog);
  console.log('[ezhednevno]', JSON.stringify(itog));
  return itog;
}

module.exports = { progon, sobratOtchet };
