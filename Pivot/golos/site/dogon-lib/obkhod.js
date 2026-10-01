// Обход по расписанию (tg-dogon, раз в 10 минут; вручную — tg-nastroyka ?d=obkhod). Ревью 15.09 №12.
// Без модели и без отправок клиенту: только сигналы в группу и чистка Blobs.
//
// Три прохода, в таком порядке (важное — первым, пока не кончилось время):
//   1. nadzor/zhdet/* — чат ушёл людям (горячий, «позвать человека», жалоба, проверка дважды отбила,
//      «жду человека»). Прошло 30 минут, а из аккаунта никто не ответил и кнопку не нажимал →
//      «ГОРЯЧИЙ БЕЗ ОТВЕТА» / «ЖДЁТ ЧЕЛОВЕКА БЕЗ ОТВЕТА». Ночью (22–08 ET) сигнал без звука, поэтому
//      если первое напоминание было ночным, утром приходит ещё одно. Больше двух — нет.
//   2. nadzor/otvet/* — входящее ждёт ответа Веры (скептик №5). Прошло 3 минуты, Вера не ответила,
//      паузы нет, статус aktivnyy → «НЕ ОТВЕТИЛИ». Одно на сообщение.
//   3. Чистка (скептик №7, ревью №7): раз в сутки, по кусочку за запуск, с курсором в obkhod/chistka/<дата>.
//      - чат целиком (meta + история): некупившим HRANIT_DNEY (365) от последнего изменения чата,
//        оплатившим — HRANIT_DNEY_KLIENTAM (1095). Историю отдельных сообщений по их exp НЕ чистим:
//        у оплатившего она жила бы меньше его чата;
//      - upd/, schet/, rashod/, obkhod/chistka/ — по дате в ключе (сроки — SROK_DNEY в meta.js);
//      - adm/chat/<chat> — когда нет живого чата с этим bc;
//      - svyaz/<bc> с is_enabled=false — через 30 дней;
//      - всё остальное (kod, razgovor-kod, pochta, zvonok, zvonok-obrabotan, otvet, ishodyashchee, media,
//        nadzor) — по полю exp в JSON. Ключ без exp и без правила не трогаем, только считаем.
//
// Сигнал не дошёл (429, сеть) — отметку не ставим: следующий запуск попробует снова.
// Blobs 8.2.0 без onlyIfMatch: если между чтением и записью отметки чат поменялся, худшее — лишнее
// напоминание. Для обхода раз в 10 минут это допустимо.

const { performance } = require('perf_hooks');
const H = require('./hranilishche');
const M = require('./meta');
const S = require('./signaly');

const { seychas, DEN_MS, SROK_DNEY } = M;
const ZHDET_MIN = 30;
const NE_OTVETILI_MIN = 3;
const PACHKA = 8;   // сколько ключей чистки читаем разом

const den = (t) => new Date(t).toISOString().slice(0, 10);
const minut = (ms) => Math.max(1, Math.round(ms / 60000));

// nadzor/<вид>/<bc>/<chat>: bc и chat берём из записи, из ключа — только если записи старые.
function izKlyucha(k, z) {
  if (z && z.bc != null && z.chat != null) return { bc: String(z.bc), chat: String(z.chat) };
  const chasti = k.split('/');
  if (chasti.length < 4) return null;
  return { bc: chasti.slice(2, -1).join('/'), chat: chasti[chasti.length - 1] };
}

async function rubilnikVklyuchen(store) {
  const z = await H.chitat(store, 'nastroyki').catch(() => null);
  return !z || z.vklyuchen !== false;
}

// ---------- 1. чат ждёт человека ----------
async function prokhodZhdet(store, t, dedlayn, itog) {
  const kluchi = await H.spisok(store, 'nadzor/zhdet/');
  for (const k of kluchi) {
    if (performance.now() > dedlayn) { itog.ne_uspel = true; return; }
    const z = await H.chitat(store, k).catch(() => null);
    const kto = izKlyucha(k, z);
    if (!z || !kto) { await H.steret(store, k).catch(() => {}); continue; }
    const m = await M.chitatMeta(store, kto.bc, kto.chat).catch(() => undefined);
    if (m === undefined) continue;   // хранилище моргнуло — решим в следующий запуск
    const reshyon = !m || m.status !== 'zhdem_cheloveka'
      || (m.posl_vladelec_t && m.posl_vladelec_t >= z.t)
      || (m.posl_knopka_t && m.posl_knopka_t >= z.t);
    if (reshyon) { await H.steret(store, k).catch(() => {}); itog.zhdet_snyato++; continue; }
    if (t - z.t < ZHDET_MIN * 60000) continue;

    const noch = S.nochNY(t);
    const pervoe = !z.napomnili_t;
    const utrom = !pervoe && z.noch && !noch;
    if (!pervoe && !utrom) continue;

    const goryachiy = z.prichina === 'goryachiy';
    const doshlo = await S.signal(goryachiy ? 'goryachiy_bez_otveta' : 'zhdet_bez_otveta', {
      meta: m, bystro: true,
      stroki: [
        `Вера передала чат людям ${minut(t - z.t)} мин назад (${z.prichina || 'причина не записана'}) и молчит до «Вернуть Веру».`,
        'Из аккаунта business_int_dna никто не ответил, кнопок не нажимали.',
        m.ne_otvetila ? `Не ответила: ${m.ne_otvetila}` : '',
        utrom ? 'Ночное напоминание пришло без звука — повторяю утром.' : '',
      ],
    });
    if (!doshlo) { itog.ne_doshlo++; continue; }
    await H.pisat(store, k, { ...z, napomnili_t: t, noch, exp: M.exp('nadzor', t) }).catch(() => {});
    itog.zhdet_signalov++;
  }
}

// ---------- 2. входящее без ответа Веры ----------
async function prokhodOtvet(store, t, dedlayn, itog) {
  const kluchi = await H.spisok(store, 'nadzor/otvet/');
  if (!kluchi.length) return;
  const vklyuchen = await rubilnikVklyuchen(store);
  for (const k of kluchi) {
    if (performance.now() > dedlayn) { itog.ne_uspel = true; return; }
    const z = await H.chitat(store, k).catch(() => null);
    const kto = izKlyucha(k, z);
    if (!z || !kto) { await H.steret(store, k).catch(() => {}); continue; }
    const m = await M.chitatMeta(store, kto.bc, kto.chat).catch(() => undefined);
    if (m === undefined) continue;
    // Рубильник выключен — чаты ведут люди, «не ответили» тут не новость.
    const reshyon = !vklyuchen || !m || m.status !== 'aktivnyy'
      || (m.posl_vera_t && m.posl_vera_t >= z.t)
      || (m.posl_vladelec_t && m.posl_vladelec_t >= z.t)
      || (m.pauza_do && m.pauza_do > t);
    if (reshyon) { await H.steret(store, k).catch(() => {}); itog.otvet_snyato++; continue; }
    if (t - z.t < NE_OTVETILI_MIN * 60000) continue;

    const doshlo = await S.signal('ne_otvetili', {
      meta: m, bystro: true,
      stroki: [
        `Человек написал ${minut(t - z.t)} мин назад. Вера не ответила, паузы нет, чат не передавали людям.`,
        'Если в группе была ОШИБКА по этому чату — причина там. Ответьте из аккаунта business_int_dna.',
      ],
    });
    if (!doshlo) {
      // Telegram не принял трижды подряд — снимаем, чтобы не долбить каждые 10 минут.
      const popytok = (z.popytok || 0) + 1;
      if (popytok >= 3) await H.steret(store, k).catch(() => {});
      else await H.pisat(store, k, { ...z, popytok }).catch(() => {});
      itog.ne_doshlo++;
      continue;
    }
    await H.steret(store, k).catch(() => {});
    itog.otvet_signalov++;
  }
}

// ---------- 3. чистка ----------
const PO_DATE = [
  [/^upd\/(\d{4}-\d{2}-\d{2})\//, SROK_DNEY.upd],
  [/^schet\/(\d{4}-\d{2}-\d{2})\//, SROK_DNEY.schet],
  [/^rashod\/(\d{4}-\d{2}-\d{2})$/, SROK_DNEY.rashod],
  [/^obkhod\/chistka\/(\d{4}-\d{2}-\d{2})$/, 7],
];
const RE_CHAT = /^chat\/(.+)\/(-?\d+)\/(meta|m\/\d+)$/;

// Жив ли чат: решение одно на чат, кэш на весь запуск.
async function verdiktChata(store, bc, chat, t, kesh) {
  const kk = `${bc}/${chat}`;
  if (kesh.has(kk)) return kesh.get(kk);
  const m = await M.chitatMeta(store, bc, chat).catch(() => undefined);
  let v;
  if (m === undefined) v = 'neizvestno';          // не прочитали — не трогаем
  else if (!m) v = 'net';
  else {
    const srok = (m.oplatil ? M.HRANIT_DNEY_KLIENTAM() : M.HRANIT_DNEY()) * DEN_MS;
    const posl = m.obnovleno || m.sozdano;
    v = posl && t - posl > srok ? 'istek' : 'zhiv';   // без даты не удаляем: лучше лишний год, чем чужой чат
  }
  kesh.set(kk, v);
  return v;
}

// true — ключ удалить.
async function reshit(store, k, t, kesh) {
  if (k === 'nastroyki') return false;
  for (const [re, dney] of PO_DATE) {
    const d = k.match(re);
    if (d) return Date.parse(`${d[1]}T00:00:00Z`) + (dney + 1) * DEN_MS < t;
  }
  const c = k.match(RE_CHAT);
  if (c) {
    const v = await verdiktChata(store, c[1], c[2], t, kesh);
    if (v === 'istek') return true;
    if (v !== 'net' || c[3] === 'meta') return false;
    // История без meta (сирота) — по сроку самого сообщения.
    const z = await H.chitat(store, k).catch(() => null);
    return !!(z && typeof z.exp === 'number' && z.exp < t);
  }
  if (k.startsWith('adm/chat/')) {
    const chat = k.slice('adm/chat/'.length);
    const syroe = await H.chitatTekst(store, k).catch(() => null);
    if (syroe == null) return false;
    let bc = syroe;
    try { const o = JSON.parse(syroe); bc = o && typeof o === 'object' ? o.bc : o; } catch (_) { /* bc_id строкой */ }
    if (!bc) return true;
    const v = await verdiktChata(store, String(bc), chat, t, kesh);
    return v === 'net' || v === 'istek';
  }
  const z = await H.chitat(store, k).catch(() => null);
  if (!z || typeof z !== 'object') return false;
  if (k.startsWith('svyaz/')) return z.is_enabled === false && t - (z.t || 0) > SROK_DNEY.svyaz_vyklyuchena * DEN_MS;
  return typeof z.exp === 'number' && z.exp < t;
}

async function chistka(store, t, dedlayn, itog) {
  const kMarker = `obkhod/chistka/${den(t)}`;
  const marker = await H.chitat(store, kMarker).catch(() => null);
  if (marker && marker.gotovo) { itog.chistka = 'uzhe_segodnya'; return; }
  const kluchi = (await H.spisok(store, '')).sort();
  let i = marker && marker.kursor ? kluchi.findIndex(k => k > marker.kursor) : 0;
  if (i < 0) i = kluchi.length;
  const kesh = new Map();
  let posl = marker && marker.kursor;
  while (i < kluchi.length) {
    if (performance.now() > dedlayn) {
      await H.pisat(store, kMarker, { kursor: posl || '', t }).catch(() => {});
      itog.chistka = `prervana na ${posl || 'nachale'}`;
      return;
    }
    const pachka = kluchi.slice(i, i + PACHKA);
    const resheniya = await Promise.all(pachka.map(k => reshit(store, k, t, kesh).catch(() => false)));
    for (let j = 0; j < pachka.length; j++) {
      itog.prosmotreno++;
      if (!resheniya[j]) continue;
      if (pachka[j] === kMarker) continue;
      await H.steret(store, pachka[j]).then(() => { itog.udaleno++; }).catch(() => {});
    }
    posl = pachka[pachka.length - 1];
    i += PACHKA;
  }
  await H.pisat(store, kMarker, { gotovo: true, t }).catch(() => {});
  itog.chistka = 'gotovo';
}

// byudzhetMs — сколько из 30 секунд расписания можем занять (запас на холодный старт и запись итога).
async function obkhod({ store, t = seychas(), byudzhetMs = 20000, bezChistki = false } = {}) {
  const dedlayn = performance.now() + byudzhetMs;
  const itog = { zhdet_signalov: 0, zhdet_snyato: 0, otvet_signalov: 0, otvet_snyato: 0, ne_doshlo: 0,
    prosmotreno: 0, udaleno: 0, chistka: bezChistki ? 'vyklyuchena' : 'ne_nachata', ne_uspel: false };
  await prokhodZhdet(store, t, dedlayn, itog);
  await prokhodOtvet(store, t, dedlayn, itog);
  if (!bezChistki && performance.now() < dedlayn) await chistka(store, t, dedlayn, itog);
  return itog;
}

module.exports = { obkhod, ZHDET_MIN, NE_OTVETILI_MIN };
