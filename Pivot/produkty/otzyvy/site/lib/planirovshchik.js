// Планировщик просьб. Раз в час: находит закончившиеся визиты, решает по каждому — слать просьбу,
// напоминание, ждать или закрыть с причиной — и шлёт.
//
// ПРАВИЛА (PLAN-DLYA-ANDREYA п. 2 и п. 8, решения по технике — мои):
//  • просьба — через zaderzhka_min (120) после конца визита, с ходом часового расписания это 2–3 часа;
//    только с okno_s до okno_do (9–19) по времени бизнеса, вечерние уходят утром;
//  • одно напоминание через napominanie_dney (3), если не было клика; больше писем нет;
//  • НЕ шлём только если: запись отменена или удалена, владелец отметил неявку, нет почты, человек
//    отписался, этот адрес просили недавно (adres_ne_chashche_dney, одинаково для всех), опоздали дольше
//    ustarevaet_chasov (потолки, ночь, выключатель — по старой базе разом не шлём). Каждое такое решение
//    ложится в журнал (arhiv/…) с причиной. Ручного «не слать этому» нет и не будет (review gating);
//  • время и статус визита читаем из календаря в момент решения: владелец мог перенести или отменить;
//    календарь не прочитался — по визитам Веры не шлём вслепую, ждём следующего часа;
//  • дубли: замок на визит и шаг (onlyIfNew) + Idempotency-Key у Resend. Упали посреди отправки —
//    повтор через 10 минут с тем же ключом, Resend второго письма не пошлёт. Ключ Resend живёт сутки:
//    замок старше POVTOR_NE_POZZHE_MS (20 ч) не повторяем, визит закрываем «neizvestno» — второе
//    письмо хуже потерянного (ревью 29.09);
//  • холостой режим не считается просьбой для правила «не чаще раза в N дней» (ревью 29.09: иначе
//    после обкатки настоящие люди полгода не получали бы просьбу);
//  • потолки: на бизнес (v_sutki) и на всех (90) в сутки, не больше 20 писем за прогон и 20 секунд
//    работы (у функции по расписанию стена 30 с) — время проверяется и при разборе визитов, не только
//    при отправке. Сверх потолка письмо ждёт, пока не устареет.
//
// ХРАНИЛИЩЕ `otzyvy`:
//   aktiv/<клиент>/<vid>              визит в работе (почта, имя, конец, что ушло)
//   arhiv/<клиент>/<ГГГГ-ММ-ДД>/<vid>  закрытый визит с причиной (итог), хранится 90 дней
//   zamok/<клиент>/<vid>/<шаг>        замок отправки; klik/<клиент>/<vid> — клик по кнопке
//   otpiska/<клиент>/<отпечаток>      отписка — навсегда; adres/<клиент>/<отпечаток> — когда просили
// vid: g-<id события> (календарь) или f-<хэш> (форма владельца).

const H = require('./hranilishche');
const K = require('./kartochka');
const V = require('./vremya');
const VZ = require('./vizity');
const SH = require('./shablony');
const P = require('./pisma');
const S = require('./podpis');
const L = require('./limity');

const HRAN = 'otzyvy';
const DEN = V.DEN_MS;
const ZAMOK_ZHIVET_MS = 10 * 60000;
const POVTOR_NE_POZZHE_MS = 20 * 3600e3;   // Idempotency-Key у Resend живёт 24 ч — повторяем с запасом
const STENA_MS = 20000;                     // у функции по расписанию 30 с
const vremyaVyshlo = (ctx) => performance.now() - ctx.t0 > STENA_MS;

const kl = {
  aktiv: (k, vid) => `aktiv/${k.klient}/${vid}`,
  aktivPrefix: (k) => `aktiv/${k.klient}/`,
  arhiv: (k, den, vid) => `arhiv/${k.klient}/${den}/${vid}`,
  arhivPrefix: (k) => `arhiv/${k.klient}/`,
  zamok: (k, vid, shag) => `zamok/${k.klient}/${vid}/${shag}`,
  klik: (k, vid) => `klik/${k.klient}/${vid}`,
  otpiska: (k, h) => `otpiska/${k.klient}/${h}`,
  adres: (k, h) => `adres/${k.klient}/${h}`,
};
const vidSobytiya = (id) => 'g-' + String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
const vidIzKlyucha = (key) => key.split('/').pop();
const pauza = (ms) => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve());

async function progon(o = {}) {
  const teper = Date.now();
  const s = H.store(HRAN);
  if (!s) { console.log('[plan] хранилища нет — ничего не делаю'); return { itog: 'net_hranilishcha' }; }
  // Пульс ДО выключателя: по нему проверка здоровья видит, что расписание вообще срабатывает.
  await H.polozhit(s, 'pulse/planirovshchik', { t: teper });
  const vk = await L.vklyuchen(s);
  if (!vk.vklyucheno) { console.log('[plan] выключено:', vk.pochemu); return { itog: 'vyklyucheno', pochemu: vk.pochemu }; }

  const ctx = { s, teper, t0: performance.now(), otpravleno: 0, stop: false, pauzaMs: +(process.env.OTZYVY_PAUZA_MS ?? 600) };
  const klienty = {};
  for (const k of K.rabochie()) {
    if (o.klient && k.klient !== o.klient) continue;
    try { klienty[k.klient] = await klient(ctx, k); }
    catch (e) { console.log('[plan] клиент упал:', k.klient, (e && e.stack) || e); klienty[k.klient] = { oshibka: String(e && e.message || e) }; }
    if (ctx.stop) break;
  }
  console.log('[plan] готово: писем', ctx.otpravleno, JSON.stringify(klienty));
  return { itog: 'ok', otpravleno: ctx.otpravleno, klienty };
}

async function klient(ctx, k) {
  const { s, teper } = ctx;
  const st = { novyh: 0, poslano: 0, zhdut: 0, zakryto: {}, potolok: '' };
  const aktivKeys = await H.spisok(s, kl.aktivPrefix(k));
  const arhivKeys = await H.spisok(s, kl.arhivPrefix(k));
  if (aktivKeys === null || arhivKeys === null) return { oshibka: 'список визитов не получен' };
  const izvestnye = new Set([...aktivKeys, ...arhivKeys].map(vidIzKlyucha));

  // 1. Календарь: новые визиты и текущее состояние старых.
  let sob = null;
  const kalendar = k.istochniki.vera.vklyuchen || k.istochniki.kalendar_vse_s_gostem ? k.istochniki.vera.kalendar_id : '';
  const novye = [];
  if (kalendar) {
    sob = await VZ.sobytiya(kalendar, teper - 7 * DEN, teper + DEN);
    await H.polozhit(s, `pulse/kalendar/${k.klient}`, { t: teper, ok: sob !== null });
    if (sob) {
      const gorizont = k.pisma.ustarevaet_chasov * 3600e3;
      for (const e of sob.values()) {
        if (vremyaVyshlo(ctx)) { ctx.stop = true; st.potolok = 'vremya'; break; }
        const vid = vidSobytiya(e.id);
        if (izvestnye.has(vid)) continue;
        let konec = VZ.konecSobytiya(e);
        if (konec != null && (konec > teper || konec < teper - gorizont)) continue;
        const kto = await VZ.razobratSobytie(k, e);
        if (kto === undefined) { st.nerazobrano = (st.nerazobrano || 0) + 1; continue; }
        if (!kto) continue;
        if (konec == null) konec = kto.konec || null;   // удалённое событие без времени — время из метки Веры
        if (konec == null || konec > teper || konec < teper - gorizont) continue;
        const r = { vid, istochnik: kto.istochnik, event_id: e.id, konec, pochta: kto.pochta || '', imya: kto.imya || '',
                    yazyk: kto.yazyk || '', sozdan: teper };
        if (!r.pochta && kto.pochta_prichina) r.pochta_prichina = kto.pochta_prichina;
        const ok = await H.pervym(s, kl.aktiv(k, vid), r);
        if (ok) { novye.push(r); st.novyh++; }
      }
    }
  }

  // 2. Все визиты в работе — по порядку конца.
  const recs = [...novye];
  for (const key of aktivKeys) {
    if (vremyaVyshlo(ctx)) { ctx.stop = true; st.potolok = 'vremya'; break; }
    const r = await H.vzyat(s, key); if (r && r.vid) recs.push(r);
  }
  recs.sort((a, b) => (a.konec || 0) - (b.konec || 0));
  for (const r of recs) {
    if (ctx.stop || vremyaVyshlo(ctx)) { ctx.stop = true; st.potolok = st.potolok || 'vremya'; break; }
    await obrabotat(ctx, k, r, sob, kalendar, st);
  }
  return st;
}

async function obrabotat(ctx, k, r, sob, kalendar, st) {
  const { s, teper } = ctx;
  const p = k.pisma, poyas = k.biznes.poyas;
  let izmenen = false;
  // Календарь молчит долго: вслепую не шлём, но и вечно в работе не держим — по сроку закрываем.
  const ustarelVslepuyu = () => {
    const ust = p.ustarevaet_chasov * 3600e3;
    if (!r.zapros && teper > Math.max(r.konec || 0, r.sozdan || 0) + ust) return zakryt(ctx, k, r, 'ustarel', st);
    if (r.zapros && !r.napominanie && teper > r.zapros.t + p.napominanie_dney * DEN + ust) return zakryt(ctx, k, r, 'napominanie_ustarelo', st);
  };

  // Событие календаря сейчас: отменено, удалено, неявка, перенесено.
  if (r.istochnik !== 'forma') {
    if (!sob) return ustarelVslepuyu();                 // календарь молчит — не шлём вслепую
    let e = sob.get(r.event_id), sost;
    if (!e) {
      const g = await VZ.sobytie(kalendar, r.event_id);
      if (g.oshibka) return ustarelVslepuyu();
      if (g.udaleno) sost = 'udaleno'; else e = g.e;
    }
    if (!sost) sost = VZ.sostoyanie(e);
    if (sost !== 'ok') return zakryt(ctx, k, r, r.zapros ? sost + '_posle_prosby' : sost, st);
    const kn = VZ.konecSobytiya(e);
    if (kn != null && kn !== r.konec) { r.konec = kn; r.perenesen = true; izmenen = true; }
  }
  const sohranit = () => (izmenen ? H.polozhit(s, kl.aktiv(k, r.vid), r) : null);
  const heshP = r.pochta ? S.heshPochty(r.pochta) : '';

  // Шаг 1: просьба.
  if (!r.zapros) {
    if (!r.pochta) return zakryt(ctx, k, r, r.pochta_prichina || 'net_pochty', st);
    if (r.konec > teper) { await sohranit(); return; }  // визит ещё не кончился (или его перенесли вперёд)
    const baza = Math.max(r.konec, r.istochnik === 'forma' ? r.sozdan : 0);
    if (teper > baza + p.ustarevaet_chasov * 3600e3) return zakryt(ctx, k, r, 'ustarel', st);
    const otp = await H.vzyatStrogo(s, kl.otpiska(k, heshP));
    if (otp === undefined) return;
    if (otp) return zakryt(ctx, k, r, 'otpisan', st);
    const adr = await H.vzyatStrogo(s, kl.adres(k, heshP));
    if (adr === undefined) return;
    if (adr && !adr.suhoy && adr.vid !== r.vid && teper - adr.t < p.adres_ne_chashche_dney * DEN) return zakryt(ctx, k, r, 'nedavno_prosili', st);
    const srok = V.sleduyushcheeOkno(Math.max(r.konec + p.zaderzhka_min * 60000, r.istochnik === 'forma' ? r.sozdan : 0), p, poyas);
    if (teper < srok || !V.vOkne(teper, p, poyas)) { st.zhdut++; await sohranit(); return; }
    return otpravit(ctx, k, r, 1, st);
  }

  // Шаг 2: одно напоминание — если не было клика.
  if (!r.napominanie) {
    const klik = await H.vzyatStrogo(s, kl.klik(k, r.vid));
    if (klik === undefined) return;
    if (klik) { r.klik = klik.t; return zakryt(ctx, k, r, 'klik', st); }
    const otp = await H.vzyatStrogo(s, kl.otpiska(k, heshP));
    if (otp === undefined) return;
    if (otp) return zakryt(ctx, k, r, 'otpisan_posle_prosby', st);
    const baza2 = r.zapros.t + p.napominanie_dney * DEN;
    if (teper > baza2 + p.ustarevaet_chasov * 3600e3) return zakryt(ctx, k, r, 'napominanie_ustarelo', st);
    const srok = V.sleduyushcheeOkno(baza2, p, poyas);
    if (teper < srok || !V.vOkne(teper, p, poyas)) { st.zhdut++; await sohranit(); return; }
    return otpravit(ctx, k, r, 2, st);
  }
  return zakryt(ctx, k, r, 'gotovo', st);
}

async function otpravit(ctx, k, r, shag, st) {
  const { s, teper } = ctx;
  if (ctx.otpravleno >= L.POTOLKI.za_progon() || vremyaVyshlo(ctx)) { ctx.stop = true; st.potolok = 'progon'; return; }
  if (!(await L.estMesto(s, L.kl.vsego(teper), L.POTOLKI.vsego_pisem()))) { ctx.stop = true; st.potolok = 'vsego'; console.log('[plan] потолок писем на всех за сутки'); return; }
  if (!(await L.estMesto(s, L.kl.biznes(k, teper), k.pisma.v_sutki))) { st.potolok = 'biznes'; st.zhdut++; return; }

  const zk = kl.zamok(k, r.vid, shag);
  const z = await H.pervym(s, zk, { t: teper, status: 'v_rabote' });
  if (z === null) return;                               // хранилище не пишет — не шлём без замка
  if (z === false) {
    const byl = await H.vzyat(s, zk);
    if (byl && byl.status === 'ushlo') return zapisatFakt(ctx, k, r, shag, byl, st);   // ушло, но визит не обновился
    if (!(byl && byl.status === 'v_rabote' && teper - byl.t > ZAMOK_ZHIVET_MS)) return; // шлёт другой прогон
    // Ключ повтора у Resend уже мог истечь: повтор дал бы второе письмо, если первое всё-таки ушло.
    if (teper - byl.t > POVTOR_NE_POZZHE_MS) {
      console.log('[plan] замок висит дольше, чем живёт ключ повтора Resend, — не повторяю:', r.vid, shag);
      return zakryt(ctx, k, r, shag === 1 ? 'neizvestno_ushla_li_prosba' : 'neizvestno_ushlo_li_napominanie', st);
    }
    console.log('[plan] замок висит с прошлого прогона, повторяю с тем же ключом:', r.vid, shag);
  }

  const pismo = SH.pismoProsba(k, r, shag);
  const otv = await P.poslat(pismo, `otzyvy-${k.klient}-${r.vid}-${shag}`, { suhoy: P.suhoyLi(k) });
  if (!otv.ok) {
    await H.ubrat(s, zk);
    r.popytok = (r.popytok || 0) + 1;
    r.oshibka = String(otv.oshibka || otv.kod || '').slice(0, 200);
    if (otv.limit) ctx.stop = true;                     // 429 — Resend просит остановиться
    if (r.popytok >= 3) return zakryt(ctx, k, r, 'ne_ushlo', st);
    await H.polozhit(s, kl.aktiv(k, r.vid), r);
    return;
  }
  ctx.otpravleno++; st.poslano++;
  await H.pribavit(s, L.kl.vsego(teper));
  await H.pribavit(s, L.kl.biznes(k, teper));
  const fakt = { t: teper, status: 'ushlo', id: otv.id || null, suhoy: !!otv.suhoy };
  await H.polozhit(s, zk, fakt);
  console.log('[plan]', otv.suhoy ? 'ХОЛОСТО' : 'ушло', shag === 1 ? 'просьба' : 'напоминание', k.klient, r.vid);
  await zapisatFakt(ctx, k, r, shag, fakt, st);
  await pauza(ctx.pauzaMs);
}

async function zapisatFakt(ctx, k, r, shag, fakt, st) {
  const { s } = ctx;
  const f = { t: fakt.t, id: fakt.id || null, suhoy: !!fakt.suhoy };
  if (shag === 1) {
    r.zapros = f;
    // Холостую «просьбу» в правило «не чаще раза в N дней» не записываем: человек её не получал.
    if (!f.suhoy) await H.polozhit(s, kl.adres(k, S.heshPochty(r.pochta)), { t: f.t, vid: r.vid });
    await H.polozhit(s, kl.aktiv(k, r.vid), r);
  } else {
    r.napominanie = f;
    await zakryt(ctx, k, r, 'gotovo', st);
  }
}

// Закрыть визит: в журнал (arhiv) с причиной, из работы убрать. Журнал не записался — визит остаётся
// в работе и закроется на следующем прогоне: потерять запись об исключении нельзя.
async function zakryt(ctx, k, r, prichina, st) {
  const { s, teper } = ctx;
  r.itog = prichina; r.zakryt = teper;
  const den = V.mestnyyDen(r.konec || r.sozdan || teper, k.biznes.poyas);
  if (!(await H.polozhit(s, kl.arhiv(k, den, r.vid), r))) return;
  await H.ubrat(s, kl.aktiv(k, r.vid));
  st.zakryto[prichina] = (st.zakryto[prichina] || 0) + 1;
  if (!['gotovo', 'klik'].includes(prichina)) console.log('[plan] исключение', k.klient, r.vid, prichina);
}

module.exports = { progon, kl, HRAN, vidSobytiya };
