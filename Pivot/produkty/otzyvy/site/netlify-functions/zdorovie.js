// Проверка после выкладки и в любой день: всё ли на месте, ничего не отправляя и не тратя денег.
//   curl -H "x-otzyvy-admin: $OTZYVY_KLYUCH_ADMINA" https://<сайт>/.netlify/functions/zdorovie
// Отвечает: паспорта (целы ли, включены ли, холостой или боевой режим), переменные (есть ли — без значений),
// хранилище, выключатель, пульс расписаний (срабатывает ли расписание при нашей выкладке — PLAN-V1 п. 2),
// календарь каждого клиента (читается ли и ЗАКРЫТ ли: в событиях имена и почты людей), хранилище Веры,
// счётчики потолков на сегодня. Google Maps, Resend и Claude не вызываются: каждый вызов стоит денег
// или квоты — проверяется только наличие ключа.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const L = require('../lib/limity');
const V = require('../lib/vremya');
const VZ = require('../lib/vizity');
const S = require('../lib/podpis');
N.podklyuchit(blobs);

const CHAS = 3600e3;

async function kalendarPublichnyy(id) {
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(`https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`, { signal: ctrl.signal, redirect: 'manual' });
    return r.status === 200;
  } catch (_) { return null; } finally { clearTimeout(tm); }
}

exports.handler = async (event) => {
  H.nachat(event);
  if (!N.admin(event)) return N.json(401, { ok: false });
  const teper = Date.now();
  const beda = [];
  const out = {
    peremennye: {
      OTZYVY_SECRET: S.sekrety().length > 0,
      OTZYVY_KLYUCH_ADMINA: true,
      OTZYVY_RESEND_KEY: !!process.env.OTZYVY_RESEND_KEY,
      OTZYVY_PLACES_KEY: !!process.env.OTZYVY_PLACES_KEY,
      OTZYVY_ANTHROPIC_KEY: !!process.env.OTZYVY_ANTHROPIC_KEY,
      EV_BLOBS_TOKEN: !!(process.env.EV_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN),
      OTZYVY_BAZA_URL: /^https:\/\/[^\s/]+$/.test(String(process.env.OTZYVY_BAZA_URL || '').replace(/\/+$/, '')),
      OTZYVY_SUHOY: process.env.OTZYVY_SUHOY === '1',
    },
  };
  for (const x of ['OTZYVY_SECRET', 'OTZYVY_RESEND_KEY', 'EV_BLOBS_TOKEN', 'OTZYVY_BAZA_URL'])
    if (!out.peremennye[x]) beda.push('нет ' + x);

  const s = H.store('otzyvy');
  out.hranilishche = s ? s.__rezhim : 'НЕТ';
  if (s) {
    try { await s.set('zdorovie/posledniy', new Date(teper).toISOString()); out.hranilishche_zapis = true; }
    catch (e) { out.hranilishche_zapis = 'упало: ' + e.message; beda.push('хранилище не пишет'); }
  } else beda.push('хранилища нет');
  out.vyklyuchatel = await L.vklyuchen(s);

  // Пульс расписаний. Пустой пульс сразу после выкладки — норма; через 2 часа — расписание не работает.
  out.puls = {};
  for (const [f, norma] of [['planirovshchik', 2 * CHAS], ['slezhenie', 4 * CHAS], ['ezhednevno', 26 * CHAS]]) {
    const p = await H.vzyat(s, `pulse/${f}`);
    out.puls[f] = p ? { minut_nazad: Math.round((teper - p.t) / 60000), v_norme: teper - p.t <= norma } : 'ещё не срабатывал';
  }

  out.klienty = {};
  let rabochih = 0;
  const rabochie = new Set(K.rabochie().map(x => x.klient));
  for (const k of K.vse()) {
    const problemy = K.proverit(k);
    if (k.vklyuchen && !problemy.length && !rabochie.has(k.klient)) problemy.push('календарь записей совпадает с другим включённым паспортом');
    const c = { vklyuchen: !!k.vklyuchen, rezhim: k.rezhim, pasport: k.__hesh, problemy };
    if (k.vklyuchen && problemy.length) beda.push(`паспорт ${k.klient} включён, но не цел`);
    if (k.vklyuchen && !problemy.length) {
      rabochih++;
      const vera = k.istochniki.vera;
      if (vera.vklyuchen || k.istochniki.kalendar_vse_s_gostem) {
        const sob = await VZ.sobytiya(vera.kalendar_id, teper - CHAS, teper);
        c.kalendar = sob === null ? 'НЕ ЧИТАЕТСЯ (поделились ли календарём со служебным адресом?)' : 'читается';
        if (sob === null) beda.push(`календарь ${k.klient} не читается`);
        const pub = await kalendarPublichnyy(vera.kalendar_id);
        if (pub) { c.kalendar_publichnyy = 'ПУБЛИЧНЫЙ — в событиях имена и почты людей, закройте'; beda.push(`календарь ${k.klient} открыт всем`); }
        if (vera.vklyuchen) {
          const vs = H.chuzhoy('golos-pisma', vera.site_id);
          let ok = false;
          if (vs) { try { await vs.get('otzyvy-vizit:__proverka'); ok = true; } catch (_) {} }
          c.metki_very = ok ? 'читаются' : 'НЕ ЧИТАЮТСЯ (токен или site_id Веры)';
          if (!ok) beda.push(`метки Веры для ${k.klient} не читаются`);
        }
      }
      if (k.slezhenie.vklyucheno && !process.env.OTZYVY_PLACES_KEY) beda.push(`слежение ${k.klient} включено, а ключа Google Maps нет`);
      c.segodnya = {
        pisem: await H.prochitatChislo(s, L.kl.biznes(k, teper)),
        trevog: await H.prochitatChislo(s, L.kl.trevogi(k, teper)),
        v_rabote: ((await H.spisok(s, `aktiv/${k.klient}/`)) || []).length,
        mestnoe_vremya: V.korotko(teper, k.biznes.poyas),
      };
    }
    out.klienty[k.klient] = c;
  }
  out.segodnya_vsego = {
    pisem: await H.prochitatChislo(s, L.kl.vsego(teper)), potolok_pisem: L.POTOLKI.vsego_pisem(),
    places: await H.prochitatChislo(s, L.kl.places(teper)), potolok_places: L.POTOLKI.places(),
    claude: await H.prochitatChislo(s, L.kl.claude(teper)), potolok_claude: L.POTOLKI.claude(),
  };
  out.rabochih_pasportov = rabochih;
  out.beda = beda;
  out.ok = beda.length === 0;
  return N.json(200, out);
};
