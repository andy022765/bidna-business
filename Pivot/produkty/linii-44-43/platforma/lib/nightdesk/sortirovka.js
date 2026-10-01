'use strict';
// №43 NightDesk, Б1 — ночной звонок жильца. Движок без модели: сортировка, цепочка эскалации, заявка на ремонт.
//
// ПОЧЕМУ БЕЗ МОДЕЛИ. «Звонить ли 911», «будить ли дежурного» и «ниже ли порога NYC» — решения с ценой ошибки
// в жизнь и в штраф HPD. Модель в разговоре только выбирает категорию и передаёт ответы жильца (да/нет/не знаю,
// температура, весь ли дом). Решение принимает этот файл: одинаковые ответы → одинаковый вердикт, у вердикта
// всегда есть причина (prichina). Неизвестный ответ на вопрос безопасности = худший случай.
//
// ЧТО ВНУТРИ
//   sortirovat(otvety, spisok, kontekst)         → вердикт {uroven, kategoriya, prichina, zvonit_911, signal, perevod,
//                                                   zayavka, instrukciya, podryadchik, sprosit, dalshe, …}
//   teploNyc(moment, {vnutri, snaruzhi}, pravilo) → нарушение правил отопления NYC (HPD: 1.10–31.05; 6–22 ч: снаружи <55°F
//                                                   → внутри ≥68°F; 22–6 ч: внутри ≥62°F)
//   otvetInstrumenta(verdikt, {yazyk, dom, instrukcii}) → тело ответа инструмента агенту {ok, uroven, skazat, sprosit, dalshe}
//   sostavitCepochku(kategoriya, nastroyki, {rezhim, ofisOtkryt}) → [{rol, imya, nomer}]: дежурный 1 → 2 → подрядчик
//   novayaEskalaciya / primenitIshod / sleduyushcheeDeystvie / otmetitZvonok — состояния цепочки
//   ishodPerevoda / ishodSignala                   → исход звонка по обратному вызову Twilio (4 исхода плана Б 28.09)
//   twimlPerevoda / twimlShirmy / twimlPrinyat / twimlSignala / twimlOtkata / obernut — TwiML как в perevod-ru.js
//   tekstShirmy / tekstSms / frazaZhilcu            → что слышит дежурный, что уходит SMS, что слышит жилец
//   novayaZayavka / proveritZayavku / nomerZayavki / nomerVsluh / normKvartira / kvartiraVsluh — заявка на ремонт
//   proveritSpisok(spisok)                          → ошибки в списке аварий управляющего
//
// СОСТОЯНИЯ ЦЕПОЧКИ (rezhim perevod — жилец на линии, его соединяют; rezhim signal — жильца нет, дежурного будят):
//   zvonim(шаг i) ──prinyal──────────────→ prinyata (конец)
//      │ bez_nazhatiya / ne_vzyal / sbrosil / oshibka → zvonim(шаг i+1) … последний шаг:
//      │     perevod → «никто»: фраза жильцу, SMS всем, пульт «авария не принята», rezhim signal, круг 1, шаг 0
//      │     signal  → круг < krugov: zhdem (povtor_min) → zvonim(шаг 0, круг+1); иначе ne_prinyata (конец)
//      └ zvonyashchiy_polozhil (жилец бросил трубку во время перевода) → SMS всем, rezhim signal, шаг 0
//   Ширма «нажмите 1» (perevod-ru.js Веры, план Б, проверено 28.09 во всех четырёх исходах): автоответчик цифру не нажмёт,
//   его нога кончается, и звонок уходит следующему. Любая цифра = живой человек.
//
// ЧИСТЫЕ ФУНКЦИИ. Ничего не пишут и никуда не ходят. Хранилище, Twilio, SMS, журнал, метки HMAC в адресах —
// обвязка стенда (KONTRAKT-ND.md). Повторный обратный вызов Twilio не двигает цепочку дважды: исход принимается
// только для текущих шага и круга.

const POYAS = 'America/New_York';

const UROVNI = Object.freeze(['ugroza_zhizni', 'avaria', 'ne_srochno']);
const OTVET = Object.freeze(['da', 'net', 'ne_znayu']);
const OHVAT = Object.freeze(['kvartira', 'neskolko', 'ves_dom', 'ulica', 'ne_znayu']);
const CO_SIGNAL = Object.freeze(['trevoga', 'batareyka', 'net', 'ne_znayu']);
const DOSTUP = Object.freeze(['da', 'tolko_pri_mne', 'net']);
const ISHODY = Object.freeze(['prinyal', 'bez_nazhatiya', 'ne_vzyal', 'sbrosil', 'oshibka', 'zvonyashchiy_polozhil']);

// Эти категории — угроза жизни всегда: список управляющего может ДОБАВИТЬ к ним свои, но убрать — нет.
const UGROZA_VSEGDA = Object.freeze(['gaz', 'ogon_dym', 'ugarnyy_gaz', 'lift_zastryali', 'elektrichestvo_opasno',
  'medicina', 'prestuplenie', 'obrushenie']);

// Каталог категорий по умолчанию (Нью-Йорк). voprosy — что спросить до вердикта, по порядку.
const KATEGORII = Object.freeze({
  gaz: { uroven: 'ugroza_zhizni', instrukciya: 'gaz' },
  ogon_dym: { uroven: 'ugroza_zhizni', instrukciya: 'ogon_dym' },
  ugarnyy_gaz: { uroven: 'ugroza_zhizni', instrukciya: 'ugarnyy_gaz' },
  lift_zastryali: { uroven: 'ugroza_zhizni', instrukciya: 'lift_zastryali' },
  elektrichestvo_opasno: { uroven: 'ugroza_zhizni', instrukciya: 'elektrichestvo_opasno' },
  medicina: { uroven: 'ugroza_zhizni', instrukciya: 'medicina' },
  prestuplenie: { uroven: 'ugroza_zhizni', instrukciya: 'prestuplenie' },
  obrushenie: { uroven: 'ugroza_zhizni', instrukciya: 'obrushenie' },

  voda_protechka: { uroven: 'avaria', instrukciya: 'voda', podryadchik: 'santehnik', voprosy: ['voda_u_elektriki', 'voda_aktivno'] },
  kanalizaciya: { uroven: 'avaria', instrukciya: 'kanalizaciya', podryadchik: 'kanalizaciya' },
  net_vody: { uroven: 'avaria', instrukciya: 'net_vody', podryadchik: 'santehnik' },
  net_tepla: { uroven: 'avaria', instrukciya: 'net_tepla', podryadchik: 'kotel', voprosy: ['ohvat', 'temperatura_vnutri', 'otoplenie_sovsem_net'] },
  net_goryachey_vody: { uroven: 'avaria', instrukciya: 'net_goryachey_vody', podryadchik: 'kotel', voprosy: ['ohvat'] },
  net_sveta: { uroven: 'avaria', instrukciya: 'net_sveta', podryadchik: 'elektrik', voprosy: ['ohvat', 'avtomat_proveren'] },
  vhodnaya_dver: { uroven: 'avaria', instrukciya: 'vhodnaya_dver', podryadchik: 'zamki' },
  zamok_kvartiry: { uroven: 'avaria', instrukciya: 'zamok_kvartiry', podryadchik: 'zamki' },
  lift_ne_rabotaet: { uroven: 'avaria', instrukciya: 'lift_ne_rabotaet', podryadchik: 'lift', voprosy: ['v_lifte_lyudi'] },

  santehnika: { uroven: 'ne_srochno' },
  bytovaya_tehnika: { uroven: 'ne_srochno' },
  vrediteli: { uroven: 'ne_srochno' },
  plesen: { uroven: 'ne_srochno' },
  domofon: { uroven: 'ne_srochno' },
  osveshchenie: { uroven: 'ne_srochno' },
  detektor_batareyka: { uroven: 'ne_srochno', instrukciya: 'detektor' },
  zamok_zahlopnulsya: { uroven: 'ne_srochno', instrukciya: 'zahlopnulsya', zayavka: false },
  okno: { uroven: 'ne_srochno' },
  shum: { uroven: 'ne_srochno', zayavka: false, soobshchenie: true },
  drugoe: { uroven: 'ne_srochno' },
});

// Правило отопления NYC (HPD, проверено 30.09.2026) — по умолчанию, если в списке клиента нет своего.
const TEPLO_NYC = Object.freeze({
  sezon_mesyacy: Object.freeze([10, 11, 12, 1, 2, 3, 4, 5]),
  den: Object.freeze({ s_chasa: 6, do_chasa: 22, snaruzhi_nizhe_f: 55, vnutri_ne_menee_f: 68 }),
  noch: Object.freeze({ s_chasa: 22, do_chasa: 6, vnutri_ne_menee_f: 62 }),
  goryachaya_voda_ne_menee_f: 120,
  istochnik: 'https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water-information.page',
});

const ESKALACIYA_PO_UMOLCHANIYU = Object.freeze({ zhdat_s: 20, povtor_min: 10, krugov: 3, zavis_s: 150 });

// Вопросы, которые движок просит задать, если ответа нет. Коротко: одна фраза, один вопрос.
const VOPROSY = Object.freeze({
  lyudi_v_opasnosti: { en: 'Is anyone hurt, or in danger right now?', es: '¿Hay alguien herido o en peligro en este momento?' },
  voda_u_elektriki: { en: 'Is the water near any outlets, switches, lights or the electrical panel?', es: '¿El agua está cerca de enchufes, interruptores, lámparas o del panel eléctrico?' },
  voda_aktivno: { en: 'Is water still coming in right now?', es: '¿Sigue entrando agua en este momento?' },
  ohvat: { en: 'Is it just your apartment, or your neighbors too?', es: '¿Es solo su apartamento, o también el de los vecinos?' },
  temperatura_vnutri: { en: 'Do you have a thermometer? What temperature is it inside right now?', es: '¿Tiene un termómetro? ¿Qué temperatura hay adentro ahora?' },
  otoplenie_sovsem_net: { en: 'Are the radiators completely cold?', es: '¿Los radiadores están completamente fríos?' },
  avtomat_proveren: { en: 'Could you check your electrical panel for a switch that is off, and tell me if the power comes back?', es: '¿Puede revisar su panel eléctrico por si hay un interruptor apagado, y decirme si vuelve la luz?' },
  v_lifte_lyudi: { en: 'Is anyone stuck inside the elevator?', es: '¿Hay alguien atrapado dentro del ascensor?' },
});

// Как категория звучит для дежурного (ширма, SMS) — по-английски, язык владельца; и для жильца по-испански.
const IMENA_KATEGORIY = Object.freeze({
  gaz: { en: 'gas smell', es: 'olor a gas' },
  ogon_dym: { en: 'fire or smoke', es: 'fuego o humo' },
  ugarnyy_gaz: { en: 'carbon monoxide alarm', es: 'alarma de monóxido de carbono' },
  lift_zastryali: { en: 'someone stuck in the elevator', es: 'persona atrapada en el ascensor' },
  elektrichestvo_opasno: { en: 'electrical danger', es: 'peligro eléctrico' },
  medicina: { en: 'medical emergency', es: 'emergencia médica' },
  prestuplenie: { en: 'break-in or threat', es: 'robo o amenaza' },
  obrushenie: { en: 'ceiling collapse', es: 'derrumbe del techo' },
  voda_protechka: { en: 'water leak', es: 'fuga de agua' },
  kanalizaciya: { en: 'sewage backup', es: 'desbordamiento de aguas negras' },
  net_vody: { en: 'no water', es: 'sin agua' },
  net_tepla: { en: 'no heat', es: 'sin calefacción' },
  net_goryachey_vody: { en: 'no hot water', es: 'sin agua caliente' },
  net_sveta: { en: 'no power', es: 'sin electricidad' },
  vhodnaya_dver: { en: 'building entrance door not locking', es: 'puerta de entrada del edificio sin cerrar' },
  zamok_kvartiry: { en: 'apartment door not locking', es: 'puerta del apartamento sin cerrar' },
  lift_ne_rabotaet: { en: 'elevator out of service', es: 'ascensor fuera de servicio' },
  santehnika: { en: 'plumbing problem', es: 'problema de plomería' },
  bytovaya_tehnika: { en: 'appliance problem', es: 'problema con un electrodoméstico' },
  vrediteli: { en: 'pests', es: 'plagas' },
  plesen: { en: 'mold', es: 'moho' },
  domofon: { en: 'intercom problem', es: 'problema con el intercomunicador' },
  osveshchenie: { en: 'lighting problem', es: 'problema de iluminación' },
  detektor_batareyka: { en: 'detector chirping', es: 'detector pitando' },
  zamok_zahlopnulsya: { en: 'lockout', es: 'se quedó afuera' },
  okno: { en: 'window problem', es: 'problema con una ventana' },
  shum: { en: 'noise', es: 'ruido' },
  drugoe: { en: 'other problem', es: 'otro problema' },
});

// Запасные слова, если у дома не заполнено, где вентиль и щиток.
const ZAPASNOE = Object.freeze({
  gde_voda: {
    en: 'use the small valves under your sinks, turned to the right, and the valve on the wall behind the toilet',
    es: 'use las llaves pequeñas debajo de los lavabos, girándolas a la derecha, y la llave en la pared detrás del inodoro',
  },
  gde_shchit: {
    en: "it's usually near your front door or in the kitchen",
    es: 'normalmente está cerca de la puerta de entrada o en la cocina',
  },
  '911': { en: 'Please hang up and call nine-one-one right now.', es: 'Por favor, cuelgue y llame al nueve uno uno ahora mismo.' },
});

// Что слышит жилец от Twilio (<Say>), когда агент уже отдал звонок: «соединяю» и «никто не ответил».
const FRAZY_ZHILCU = Object.freeze({
  soedinyayu: {
    en: 'Connecting you with our on-call team now. Please stay on the line.',
    es: 'Le comunico ahora con nuestro equipo de guardia. Por favor, no cuelgue.',
  },
  nikto: {
    en: 'No one could pick up right now. Your report is saved, and our on-call team is being alerted again. They will call you back at this number. Goodbye.',
    es: 'Nadie pudo contestar en este momento. Su reporte quedó guardado y estamos avisando de nuevo al equipo de guardia. Le devolverán la llamada a este número. Adiós.',
  },
});

const GOLOS = Object.freeze({
  en: Object.freeze({ language: 'en-US', voice: 'Polly.Joanna' }),
  es: Object.freeze({ language: 'es-US', voice: 'Polly.Lupe' }),
});

// ── мелочи ──────────────────────────────────────────────────────────────────
const yazykIli = (y) => (String(y || '').toLowerCase().startsWith('es') ? 'es' : 'en');
const dva = (n) => String(n).padStart(2, '0');

function xml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function chistyy(v, dlina = 200) {
  if (v === undefined || v === null) return '';
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^\{\{.*\}\}$/.test(s)) return '';            // системная переменная, которую платформа не подставила
  return s.slice(0, dlina);
}

// Ответ «да/нет/не знаю»: принимает и true/false, и слова трёх языков. Нет ответа → undefined (надо спросить).
function otvet(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === true) return 'da';
  if (v === false) return 'net';
  const s = String(v).trim().toLowerCase();
  if (/^\{\{.*\}\}$/.test(s)) return undefined;
  if (['da', 'yes', 'y', 'true', 'si', 'sí', 'да'].includes(s)) return 'da';
  if (['net', 'no', 'n', 'false', 'нет'].includes(s)) return 'net';
  return 'ne_znayu';
}

function enumIli(v, spisok) {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toLowerCase();
  return spisok.includes(s) ? s : 'ne_znayu';
}

// Температура внутри → °F. «ne_znayu» — спросили, жилец не знает. Число ≤ 32 без единиц считаем Цельсием:
// 32°F в квартире — лёд, а «18 градусов» от звонящего из Европы — это 18°C (64°F). Флаг kak_celsiy — в вердикт.
function temperaturaF(v, edinicy) {
  if (v === undefined || v === null || v === '') return { est: false };
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  const s = String(v).trim().toLowerCase().replace(/degrees?|grados?|градус\S*/g, '').trim();
  if (/^\{\{.*\}\}$/.test(s)) return { est: false };
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*°?\s*([fc])?$/);
  if (!m) return { est: true, f: null };
  let n = parseFloat(m[1].replace(',', '.'));
  let ed = (m[2] || String(edinicy || '').trim().toLowerCase()).slice(0, 1);
  let kakCelsiy = false;
  if (!ed && n <= 32) { ed = 'c'; kakCelsiy = true; }
  if (ed === 'c') n = (n * 9) / 5 + 32;
  return { est: true, f: Math.round(n * 10) / 10, kak_celsiy: kakCelsiy };
}

// ── время клиента (Intl знает летнее время сам) ─────────────────────────────
const formaty = new Map();
function chasti(ms, poyas = POYAS) {
  let f = formaty.get(poyas);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: poyas, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    formaty.set(poyas, f);
  }
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second, wd: o.weekday };
}
function smeshchenieMin(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  return Math.round((Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s) - Math.floor(ms / 1000) * 1000) / 60000);
}
function vIso(ms, poyas = POYAS) {
  const c = chasti(ms, poyas);
  const sm = smeshchenieMin(ms, poyas);
  const a = Math.abs(sm);
  return `${c.y}-${dva(c.m)}-${dva(c.d)}T${dva(c.h)}:${dva(c.mi)}:${dva(c.s)}${sm < 0 ? '-' : '+'}${dva(Math.floor(a / 60))}:${dva(a % 60)}`;
}
function vMs(t) {
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (t instanceof Date) return t.getTime();
  const ms = Date.parse(String(t || ''));
  return Number.isFinite(ms) ? ms : NaN;
}

// ── отопление по правилам NYC ───────────────────────────────────────────────
// vnutri, snaruzhi — °F или null. Снаружи неизвестно днём → по умолчанию считаем «холоднее 55°F»
// (жилец погоду не знает; стенд может подставить её сам — KONTRAKT-ND, nd-sortirovka).
function teploNyc(moment, { vnutri = null, snaruzhi = null } = {}, pravilo = TEPLO_NYC, poyas = POYAS,
  { snaruzhiNeizvestnoKakHolodno = true } = {}) {
  const p = pravilo || TEPLO_NYC;
  const ms = vMs(moment);
  if (!Number.isFinite(ms)) throw new Error('teploNyc: нет момента звонка');
  const c = chasti(ms, poyas);
  if (!p.sezon_mesyacy.includes(c.m)) {
    return { v_sezone: false, period: null, porog_f: null, narushenie: false, prichina: 'vne_sezona' };
  }
  const den = c.h >= p.den.s_chasa && c.h < p.den.do_chasa;
  if (den) {
    const snaruzhiIzv = snaruzhi !== null && snaruzhi !== undefined && Number.isFinite(Number(snaruzhi));
    const holodno = snaruzhiIzv ? Number(snaruzhi) < p.den.snaruzhi_nizhe_f : !!snaruzhiNeizvestnoKakHolodno;
    if (!holodno) {
      return { v_sezone: true, period: 'den', porog_f: null, narushenie: false, prichina: 'snaruzhi_ne_nizhe_poroga',
        snaruzhi_predpolozheno: false };
    }
    return sravnit('den', p.den.vnutri_ne_menee_f, vnutri, !snaruzhiIzv);
  }
  return sravnit('noch', p.noch.vnutri_ne_menee_f, vnutri, false);
}
function sravnit(period, porog, vnutri, snaruzhiPredpolozheno) {
  const baza = { v_sezone: true, period, porog_f: porog, snaruzhi_predpolozheno: snaruzhiPredpolozheno };
  if (vnutri === null || vnutri === undefined || !Number.isFinite(Number(vnutri))) {
    return Object.assign(baza, { narushenie: null, prichina: 'net_temperatury' });
  }
  const nizhe = Number(vnutri) < porog;
  return Object.assign(baza, { narushenie: nizhe, prichina: nizhe ? 'nizhe_poroga_nyc' : 'teplo_v_norme' });
}

// ── список аварий управляющего ──────────────────────────────────────────────
function sobratSpisok(spisok) {
  const s = spisok || {};
  const ugroza = new Set(UGROZA_VSEGDA);
  for (const k of s.ugroza_zhizni || []) if (KATEGORII[k]) ugroza.add(k);
  let avaria;
  if (Array.isArray(s.avaria)) {
    avaria = new Set(s.avaria.filter((k) => KATEGORII[k] && !ugroza.has(k)));
  } else {
    avaria = new Set(Object.keys(KATEGORII).filter((k) => KATEGORII[k].uroven === 'avaria' && !ugroza.has(k)));
  }
  return {
    ugroza, avaria,
    teplo: s.teplo_nyc || TEPLO_NYC,
    teploBezTermometra: s.teplo_bez_termometra === 'zayavka' ? 'ne_srochno' : 'avaria',
    snaruzhiNeizvestnoKakHolodno: s.snaruzhi_neizvestno_kak_holodno !== false,
    nastaivaetEskalirovat: s.nastaivaet_eskalirovat === true,
  };
}

// Ошибки списка: неизвестные коды, категория на двух уровнях, «угрозу жизни» пытались понизить.
function proveritSpisok(spisok) {
  const oshibki = [];
  const s = spisok || {};
  const gde = new Map();
  for (const uroven of UROVNI) {
    for (const k of s[uroven] || []) {
      if (!KATEGORII[k]) oshibki.push(`неизвестная категория «${k}» в ${uroven}`);
      if (gde.has(k)) oshibki.push(`категория «${k}» и в ${gde.get(k)}, и в ${uroven}`);
      gde.set(k, uroven);
    }
  }
  for (const k of UGROZA_VSEGDA) {
    if (gde.has(k) && gde.get(k) !== 'ugroza_zhizni') oshibki.push(`«${k}» — угроза жизни всегда, в списке стоит ${gde.get(k)}`);
  }
  return oshibki;
}

// ── сортировка ──────────────────────────────────────────────────────────────
function normalizovat(v) {
  const o = v || {};
  const t = temperaturaF(o.temperatura_vnutri, o.edinicy);
  const sn = o.temperatura_snaruzhi === undefined || o.temperatura_snaruzhi === null || o.temperatura_snaruzhi === ''
    ? null : temperaturaF(o.temperatura_snaruzhi, o.edinicy_snaruzhi || 'f');
  return {
    kategoriya: String(o.kategoriya || '').trim().toLowerCase(),
    lyudi_v_opasnosti: otvet(o.lyudi_v_opasnosti),
    zapah_gaza: otvet(o.zapah_gaza),
    dym_ili_ogon: otvet(o.dym_ili_ogon),
    co_signal: enumIli(o.co_signal, CO_SIGNAL),
    voda_aktivno: otvet(o.voda_aktivno),
    voda_u_elektriki: otvet(o.voda_u_elektriki),
    potolok_provis: otvet(o.potolok_provis),
    ohvat: enumIli(o.ohvat, OHVAT),
    temperatura: t,
    snaruzhi: sn && sn.est && sn.f !== null ? sn.f : null,
    otoplenie_sovsem_net: otvet(o.otoplenie_sovsem_net),
    avtomat_proveren: otvet(o.avtomat_proveren),
    v_lifte_lyudi: otvet(o.v_lifte_lyudi),
    zhilec_nastaivaet: otvet(o.zhilec_nastaivaet),
  };
}

function verdikt(uroven, kat, prichina, dop = {}) {
  const k = KATEGORII[kat] || KATEGORII.drugoe;
  const ugroza = uroven === 'ugroza_zhizni';
  const avaria = uroven === 'avaria';
  const zayavka = k.zayavka !== false || ugroza || avaria;
  const soobshchenie = !!k.soobshchenie && !ugroza && !avaria;
  let dalshe = 'ZAYAVKA';
  if (ugroza) dalshe = '911';
  else if (avaria) dalshe = 'PEREVOD';
  else if (soobshchenie) dalshe = 'SOOBSHCHENIE';
  else if (!zayavka) dalshe = 'INFO';
  return Object.assign({
    uroven,
    kategoriya: kat,
    prichina,
    po_spisku: !!dop.po_spisku,
    zvonit_911: ugroza,
    signal: ugroza,
    perevod: avaria,
    zayavka,
    soobshchenie,
    instrukciya: dop.instrukciya !== undefined ? dop.instrukciya : (k.instrukciya || null),
    dop_instrukciya: null,
    podryadchik: avaria ? (k.podryadchik || null) : null,
    sprosit: null,
    dalshe,
    preduprezhdeniya: [],
  }, dop, { po_spisku: !!dop.po_spisku });
}

function sprositVerdikt(kat, pole, instrukciya = null, dop = {}) {
  return Object.assign({
    uroven: null, kategoriya: kat, prichina: 'nuzhen_otvet', po_spisku: false, zvonit_911: false, signal: false,
    perevod: false, zayavka: false, soobshchenie: false, instrukciya, dop_instrukciya: null, podryadchik: null,
    sprosit: { pole, vopros: VOPROSY[pole] || null },
    dalshe: 'SPROSIT', preduprezhdeniya: [],
  }, dop);
}

// otvety — то, что агент передал инструменту (строки da/net/ne_znayu, ohvat, температура…);
// spisok — avarii из листа правды клиента (null → город по умолчанию);
// kontekst — {moment: время звонка (ISO или мс), poyas}.
function sortirovat(otvety, spisok = null, kontekst = {}) {
  const o = normalizovat(otvety);
  const s = sobratSpisok(spisok);
  const kat = KATEGORII[o.kategoriya] ? o.kategoriya : 'drugoe';
  const poyas = (kontekst && kontekst.poyas) || POYAS;
  const preduprezhdeniya = [];
  if (o.kategoriya && !KATEGORII[o.kategoriya]) preduprezhdeniya.push(`неизвестная категория «${o.kategoriya}» → drugoe`);
  if (o.temperatura && o.temperatura.kak_celsiy) preduprezhdeniya.push('температура без единиц ≤ 32 — считаю по Цельсию');
  const s911 = (prichina, instrukciya) => Object.assign(
    verdikt('ugroza_zhizni', kat, prichina, { po_spisku: true, instrukciya }), { preduprezhdeniya });

  // 1. Угроза жизни: по категории или по любому признаку опасности — раньше всех вопросов.
  if (s.ugroza.has(kat)) {
    if (kat === 'ugarnyy_gaz' && o.co_signal === 'batareyka' && o.lyudi_v_opasnosti !== 'da') {
      return Object.assign(verdikt('ne_srochno', 'detektor_batareyka', 'detektor_batareyka', { instrukciya: 'detektor' }), { preduprezhdeniya });
    }
    return s911('kategoriya', KATEGORII[kat].instrukciya);
  }
  if (o.zapah_gaza === 'da') return s911('zapah_gaza', 'gaz');
  if (o.dym_ili_ogon === 'da') return s911('dym_ili_ogon', 'ogon_dym');
  if (o.co_signal === 'trevoga') return s911('co_trevoga', 'ugarnyy_gaz');
  if (o.lyudi_v_opasnosti === 'da') return s911('lyudi_v_opasnosti', '911');
  if (o.voda_u_elektriki === 'da') return s911('voda_i_elektrichestvo', 'elektrichestvo_opasno');
  if (o.v_lifte_lyudi === 'da') return s911('lyudi_v_lifte', 'lift_zastryali');

  const poSpisku = s.avaria.has(kat);
  const k = KATEGORII[kat];

  // 2. Первый вопрос для всего, что может разбудить дежурного: есть ли опасность для людей.
  if ((poSpisku || kat === 'drugoe') && o.lyudi_v_opasnosti === undefined) {
    return Object.assign(sprositVerdikt(kat, 'lyudi_v_opasnosti'), { preduprezhdeniya });
  }

  // 3. Не в списке аварий управляющего → заявка на утро (или сообщение/справка).
  if (!poSpisku) {
    let v = verdikt('ne_srochno', kat, 'ne_po_spisku', { instrukciya: k.instrukciya || null });
    if (s.nastaivaetEskalirovat && o.zhilec_nastaivaet === 'da') {
      v = verdikt('avaria', kat, 'zhilec_nastaivaet', { po_spisku: false, instrukciya: k.instrukciya || null });
      v.podryadchik = null;
    }
    return Object.assign(v, { preduprezhdeniya });
  }

  // 4. Авария по списку: условия внутри категории.
  const avaria = (prichina, dop = {}) => Object.assign(verdikt('avaria', kat, prichina, Object.assign({ po_spisku: true }, dop)), { preduprezhdeniya });
  const zayavka = (prichina, dop = {}) => Object.assign(verdikt('ne_srochno', kat, prichina, Object.assign({ po_spisku: false }, dop)), { preduprezhdeniya });
  const sprosit = (pole, instr = null) => Object.assign(sprositVerdikt(kat, pole, instr), { preduprezhdeniya });

  switch (kat) {
    case 'voda_protechka': {
      if (o.voda_u_elektriki === undefined) return sprosit('voda_u_elektriki');
      if (o.voda_aktivno === undefined) return sprosit('voda_aktivno');
      if (o.voda_aktivno === 'net' && o.potolok_provis !== 'da') return zayavka('voda_ostanovlena', { instrukciya: null });
      return avaria(o.potolok_provis === 'da' ? 'potolok_provis' : 'voda_idet');
    }
    case 'net_tepla': {
      let moment = vMs(kontekst && (kontekst.moment ?? kontekst.seychas));
      if (!Number.isFinite(moment)) {
        // Стенд обязан передавать время звонка; забыл — берём часы сервера, а не роняем инструмент посреди аварии.
        moment = Date.now();
        preduprezhdeniya.push('нет kontekst.moment — взято время сервера');
      }
      const sezon = teploNyc(moment, {}, s.teplo, poyas);
      if (!sezon.v_sezone) return Object.assign(zayavka('vne_sezona', { instrukciya: null }), { teplo: sezon });
      if (o.ohvat === undefined) return sprosit('ohvat');
      if (o.ohvat === 'neskolko' || o.ohvat === 'ves_dom') return avaria('ves_dom');
      if (!o.temperatura.est) return sprosit('temperatura_vnutri');
      const t = teploNyc(moment, { vnutri: o.temperatura.f, snaruzhi: o.snaruzhi }, s.teplo, poyas,
        { snaruzhiNeizvestnoKakHolodno: s.snaruzhiNeizvestnoKakHolodno });
      if (t.narushenie === true) return Object.assign(avaria('nizhe_poroga_nyc'), { teplo: t });
      if (t.narushenie === false) return Object.assign(zayavka(t.prichina, { instrukciya: 'net_tepla' }), { teplo: t });
      // Термометра нет.
      if (o.otoplenie_sovsem_net === undefined) return Object.assign(sprosit('otoplenie_sovsem_net'), { teplo: t });
      if (o.otoplenie_sovsem_net === 'net') return Object.assign(zayavka('teplo_est_bez_termometra', { instrukciya: 'net_tepla' }), { teplo: t });
      if (s.teploBezTermometra === 'avaria') return Object.assign(avaria('bez_termometra'), { teplo: t });
      return Object.assign(zayavka('bez_termometra', { instrukciya: 'net_tepla' }), { teplo: t });
    }
    case 'net_goryachey_vody': {
      if (o.ohvat === undefined) return sprosit('ohvat');
      if (o.ohvat === 'neskolko' || o.ohvat === 'ves_dom') return avaria('ves_dom');
      return zayavka('odna_kvartira', { instrukciya: 'net_goryachey_vody' });
    }
    case 'net_sveta': {
      if (o.ohvat === undefined) return sprosit('ohvat');
      if (o.ohvat === 'ulica') {
        const v = zayavka('otklyuchenie_ulicy', { instrukciya: 'net_sveta_ulica', sluzhba: 'con_edison' });
        return v;
      }
      if (o.ohvat === 'neskolko' || o.ohvat === 'ves_dom') return avaria('ves_dom');
      if (o.avtomat_proveren === undefined) return sprosit('avtomat_proveren', 'avtomat');
      return avaria(o.avtomat_proveren === 'da' ? 'avtomat_proveren' : 'avtomat_ne_proveren');
    }
    case 'lift_ne_rabotaet': {
      if (o.v_lifte_lyudi === undefined) return sprosit('v_lifte_lyudi');
      return avaria(o.v_lifte_lyudi === 'net' ? 'lift_pustoy' : 'lift_neizvestno');
    }
    default:
      return avaria('po_spisku');
  }
}

// Ответ инструмента агенту: skazat — дословно для звонящего (инструкция безопасности или вопрос);
// dalshe — код следующего шага для агента, вслух не произносится.
function tekstInstrukcii(kod, yazyk, dom, instrukcii) {
  if (!kod) return '';
  const y = yazykIli(yazyk);
  const t = instrukcii && instrukcii[kod] && instrukcii[kod][y];
  const osnova = t || (kod === '911' || UGROZA_VSEGDA.includes(kod) ? ZAPASNOE['911'][y] : '');
  return osnova
    .replace('{gde_voda}', (dom && dom.gde_voda && dom.gde_voda[y]) || ZAPASNOE.gde_voda[y])
    .replace('{gde_shchit}', (dom && dom.gde_shchit && dom.gde_shchit[y]) || ZAPASNOE.gde_shchit[y]);
}

function otvetInstrumenta(v, { yazyk = 'en', dom = null, instrukcii = null, avaria_id = null, zayavka = null } = {}) {
  const y = yazykIli(yazyk);
  if (!v) return { ok: false, soobshchenie: '' };
  if (v.sprosit) {
    return {
      ok: true, uroven: null, kategoriya: v.kategoriya,
      skazat: tekstInstrukcii(v.sprosit.pole === 'avtomat_proveren' ? 'avtomat' : null, y, dom, instrukcii),
      sprosit: v.sprosit.vopros ? v.sprosit.vopros[y] : '',
      pole: v.sprosit.pole,
      dalshe: 'SPROSIT',
    };
  }
  const chasti = [tekstInstrukcii(v.instrukciya, y, dom, instrukcii), tekstInstrukcii(v.dop_instrukciya, y, dom, instrukcii)]
    .filter(Boolean);
  const o = {
    ok: true, uroven: v.uroven, kategoriya: v.kategoriya, skazat: chasti.join(' '), sprosit: '', dalshe: v.dalshe,
  };
  if (avaria_id) o.avaria = true;
  if (zayavka) Object.assign(o, zayavka);
  return o;
}

// ── цепочка эскалации ───────────────────────────────────────────────────────
function e164(s) {
  const syroe = String(s ?? '').trim();
  if (!syroe) return null;
  const cifry = syroe.replace(/\D+/g, '');
  if (syroe.startsWith('+')) return cifry.length >= 8 && cifry.length <= 15 ? '+' + cifry : null;
  if (cifry.length === 10) return '+1' + cifry;
  if (cifry.length === 11 && cifry.startsWith('1')) return '+' + cifry;
  return null;
}

function podryadchikDlya(kategoriya, podryadchiki) {
  const k = KATEGORII[kategoriya];
  const spisok = Array.isArray(podryadchiki) ? podryadchiki : [];
  return spisok.find((p) => Array.isArray(p.kategorii) && p.kategorii.includes(kategoriya))
    || (k && k.podryadchik ? spisok.find((p) => p.kod === k.podryadchik) : null)
    || null;
}

// nastroyki: {dezhurnye: {cepochka: [{rol, imya, telefon}]}, ofis_perevod: {cepochka_avarii: [...]}, podryadchiki: [...]}
// rezhim perevod — дежурные (или офис в часы работы) + подрядчик по категории; signal — только люди, без подрядчика.
function sostavitCepochku(kategoriya, nastroyki, { rezhim = 'perevod', ofisOtkryt = false } = {}) {
  const n = nastroyki || {};
  const zvenya = [];
  if (ofisOtkryt && n.ofis_perevod && Array.isArray(n.ofis_perevod.cepochka_avarii) && n.ofis_perevod.cepochka_avarii.length) {
    for (const nomer of n.ofis_perevod.cepochka_avarii) zvenya.push({ rol: 'ofis', imya: 'office', nomer: e164(nomer) });
  } else {
    const d = (n.dezhurnye && n.dezhurnye.cepochka) || [];
    d.forEach((x, i) => zvenya.push({ rol: x.rol || `dezhurnyy_${i + 1}`, imya: x.imya || '', nomer: e164(x.telefon || x.nomer || x) }));
  }
  if (rezhim === 'perevod') {
    const p = podryadchikDlya(kategoriya, n.podryadchiki);
    if (p) zvenya.push({ rol: 'podryadchik', kod: p.kod, imya: p.imya || '', nomer: e164(p.telefon) });
  }
  const bylo = new Set();
  return zvenya.filter((z) => z.nomer && !bylo.has(z.nomer) && bylo.add(z.nomer));
}

function pravilaEskalacii(p) {
  const x = Object.assign({}, ESKALACIYA_PO_UMOLCHANIYU, p || {});
  const chislo = (v, min, max, d) => (Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : d);
  return {
    zhdat_s: chislo(x.zhdat_s, 5, 60, 20),
    povtor_min: chislo(x.povtor_min, 1, 120, 10),
    krugov: Math.floor(chislo(x.krugov, 1, 10, 3)),
    zavis_s: chislo(x.zavis_s, 30, 900, 150),
  };
}

function zvonokDeystvie(esk, shag) {
  const z = esk.cepochka[shag];
  return { tip: 'zvonok', rezhim: esk.rezhim, shag, krug: esk.krug, rol: z.rol, nomer: z.nomer };
}
const vseNomera = (esk) => esk.cepochka.map((z) => z.nomer);

// Новая цепочка. rezhim perevod — жилец на линии (авария по списку); signal — угроза жизни (жилец звонит 911).
function novayaEskalaciya({ avaria_id, rezhim = 'perevod', cepochka, at, pravila } = {}) {
  const t = vMs(at);
  const esk = {
    avaria_id: avaria_id || null,
    rezhim: rezhim === 'signal' ? 'signal' : 'perevod',
    status: 'zvonim',
    shag: 0,
    krug: 1,
    cepochka: (cepochka || []).map((z) => Object.assign({}, z)),
    popytki: [],
    prinyal: null,
    nikto_v: null,
    zvonok_nachat_v: null,
    sleduyushchiy_krug_v: null,
    sozdano: Number.isFinite(t) ? new Date(t).toISOString() : null,
    pravila: pravilaEskalacii(pravila),
  };
  if (!esk.cepochka.length) {
    esk.status = 'nekomu';
    const deystviya = [{ tip: 'pult', sobytie: 'avaria_nekomu' }];
    if (esk.rezhim === 'perevod') deystviya.unshift({ tip: 'fraza_zhilcu', kod: 'nikto' });
    return { esk, deystviya };
  }
  const deystviya = [];
  if (esk.rezhim === 'signal') deystviya.push({ tip: 'sms', komu: vseNomera(esk), shablon: 'ugroza' });
  deystviya.push(zvonokDeystvie(esk, 0));
  return { esk, deystviya };
}

// Звонок на шаг ушёл (Twilio принял <Dial> или REST-звонок) — для сторожа зависших звонков.
function otmetitZvonok(esk, at) {
  if (!esk) return esk;
  const t = vMs(at);
  return Object.assign({}, esk, { zvonok_nachat_v: Number.isFinite(t) ? new Date(t).toISOString() : null });
}

// Исход звонка на текущий шаг → новое состояние и что сделать. Чистая функция, вход не меняется.
// Опоздавший или повторный обратный вызов (другой шаг или круг) ничего не двигает: izmeneno=false.
function primenitIshod(esk, { shag, krug, ishod, at } = {}) {
  if (!esk || ['prinyata', 'ne_prinyata', 'nekomu'].includes(esk.status)) {
    return { esk, deystviya: [], izmeneno: false, pochemu: 'zakryta' };
  }
  if (esk.status !== 'zvonim') return { esk, deystviya: [], izmeneno: false, pochemu: 'ne_zvonim' };
  if (Number(shag) !== esk.shag || (krug !== undefined && krug !== null && Number(krug) !== esk.krug)) {
    return { esk, deystviya: [], izmeneno: false, pochemu: 'ustarevshiy_ishod' };
  }
  const ish = ISHODY.includes(ishod) ? ishod : 'oshibka';
  const t = vMs(at);
  const kogda = Number.isFinite(t) ? new Date(t).toISOString() : null;
  const z = esk.cepochka[esk.shag];
  const n = Object.assign({}, esk, {
    popytki: [...esk.popytki, { shag: esk.shag, krug: esk.krug, rezhim: esk.rezhim, rol: z.rol, nomer: z.nomer, ishod: ish, at: kogda }],
    zvonok_nachat_v: null,
  });
  const deystviya = [];

  if (ish === 'prinyal') {
    n.status = 'prinyata';
    n.prinyal = { rol: z.rol, nomer: z.nomer, rezhim: esk.rezhim, at: kogda };
    deystviya.push({ tip: 'pult', sobytie: 'avaria_prinyata', rol: z.rol });
    const drugie = vseNomera(esk).filter((x) => x !== z.nomer);
    if (esk.rezhim === 'signal' && drugie.length) deystviya.push({ tip: 'sms', komu: drugie, shablon: 'prinyata' });
    return { esk: n, deystviya, izmeneno: true };
  }

  if (ish === 'zvonyashchiy_polozhil' && esk.rezhim === 'perevod') {
    // Жилец ушёл, пока звонили дежурному. Авария осталась: будим цепочку без соединения, с его номером в SMS.
    Object.assign(n, { rezhim: 'signal', shag: 0, krug: 1 });
    deystviya.push({ tip: 'sms', komu: vseNomera(esk), shablon: 'zhilec_polozhil' });
    deystviya.push({ tip: 'pult', sobytie: 'zhilec_polozhil' });
    deystviya.push(zvonokDeystvie(n, 0));
    return { esk: n, deystviya, izmeneno: true };
  }

  if (esk.shag + 1 < esk.cepochka.length) {
    n.shag = esk.shag + 1;
    deystviya.push(zvonokDeystvie(n, n.shag));
    return { esk: n, deystviya, izmeneno: true };
  }

  // Цепочка кончилась.
  if (esk.rezhim === 'perevod') {
    Object.assign(n, { rezhim: 'signal', shag: 0, krug: 1, nikto_v: kogda });
    deystviya.push({ tip: 'fraza_zhilcu', kod: 'nikto' });
    deystviya.push({ tip: 'sms', komu: vseNomera(esk), shablon: 'ne_prinyata' });
    deystviya.push({ tip: 'pult', sobytie: 'avaria_ne_prinyata' });
    deystviya.push(zvonokDeystvie(n, 0));
    return { esk: n, deystviya, izmeneno: true };
  }
  if (esk.krug < esk.pravila.krugov) {
    const sled = Number.isFinite(t) ? new Date(t + esk.pravila.povtor_min * 60000).toISOString() : null;
    Object.assign(n, { status: 'zhdem', shag: 0, krug: esk.krug + 1, sleduyushchiy_krug_v: sled });
    deystviya.push({ tip: 'zhdat', do: sled, krug: n.krug });
    return { esk: n, deystviya, izmeneno: true };
  }
  n.status = 'ne_prinyata';
  deystviya.push({ tip: 'pult', sobytie: 'avaria_ne_prinyata_okonchatelno' });
  deystviya.push({ tip: 'svodka', sobytie: 'avaria_ne_prinyata' });
  return { esk: n, deystviya, izmeneno: true };
}

// Одно решение на тик расписания (как volny у №44): пора ли звонить следующим кругом, не завис ли звонок.
function sleduyushcheeDeystvie(esk, seychas) {
  if (!esk || ['prinyata', 'ne_prinyata', 'nekomu'].includes(esk.status)) return { deystvie: 'nichego', esk, deystviya: [] };
  const t = vMs(seychas);
  if (esk.status === 'zhdem') {
    const kogda = vMs(esk.sleduyushchiy_krug_v);
    if (Number.isFinite(t) && Number.isFinite(kogda) && t < kogda) {
      return { deystvie: 'zhdat', do: esk.sleduyushchiy_krug_v, esk, deystviya: [] };
    }
    const n = Object.assign({}, esk, { status: 'zvonim', shag: 0, sleduyushchiy_krug_v: null });
    return { deystvie: 'zvonit', esk: n, deystviya: [zvonokDeystvie(n, 0)] };
  }
  const nachat = vMs(esk.zvonok_nachat_v);
  if (Number.isFinite(t) && Number.isFinite(nachat) && t - nachat > esk.pravila.zavis_s * 1000) {
    // Обратного вызова нет дольше разумного: считаем попытку неудачной и идём дальше.
    const r = primenitIshod(esk, { shag: esk.shag, krug: esk.krug, ishod: 'oshibka', at: t });
    return { deystvie: 'zavis', esk: r.esk, deystviya: r.deystviya };
  }
  return { deystvie: 'zhdat', esk, deystviya: [] };
}

// Исход перевода по обратному вызову <Dial action> (DialCallStatus, DialBridged) — четыре исхода плана Б:
// взял и нажал 1 → prinyal; взял без нажатия (или автоответчик) → bez_nazhatiya; не взял → ne_vzyal; сбросил → sbrosil.
function ishodPerevoda(p) {
  const f = p || {};
  const get = (k) => (typeof f.get === 'function' ? f.get(k) : f[k]);
  if (String(get('DialBridged') || '').toLowerCase() === 'true') return 'prinyal';
  const st = String(get('DialCallStatus') || '').toLowerCase();
  if (st === 'completed' || st === 'answered') return 'bez_nazhatiya';
  if (st === 'no-answer') return 'ne_vzyal';
  if (st === 'busy') return 'sbrosil';
  if (st === 'canceled') return 'zvonyashchiy_polozhil';
  return 'oshibka';
}

// Исход звонка-побудки (REST-звонок со StatusCallback). nazhal — стенд отметил цифру на шаге prinyat.
function ishodSignala({ CallStatus, nazhal } = {}) {
  if (nazhal) return 'prinyal';
  const st = String(CallStatus || '').toLowerCase();
  if (st === 'completed' || st === 'answered' || st === 'in-progress') return 'bez_nazhatiya';
  if (st === 'no-answer') return 'ne_vzyal';
  if (st === 'busy') return 'sbrosil';
  return 'oshibka';
}

// ── TwiML (как perevod-ru.js: <Dial timeout=20> + <Number url=ширма>, итог через <Dial action>) ─
function skazat(tekst, yazyk = 'en') {
  const g = GOLOS[yazykIli(yazyk)];
  return `<Say language="${g.language}" voice="${g.voice}">${xml(tekst)}</Say>`;
}
const obernut = (vnutri = '') => `<?xml version="1.0" encoding="UTF-8"?><Response>${vnutri}</Response>`;

// Жильца соединяют с номером шага: вступление (фраза жильцу) → <Dial> с ширмой и итогом.
function twimlPerevoda({ nomer, callerId = null, zhdatS = 20, adresShirmy, adresItoga, vstuplenie = null, yazyk = 'en' } = {}) {
  if (!nomer || !adresShirmy || !adresItoga) throw new Error('twimlPerevoda: нужны nomer, adresShirmy, adresItoga');
  const vst = vstuplenie === null ? '' : skazat(vstuplenie, yazyk);
  return `${vst}<Dial timeout="${Math.round(zhdatS)}"${callerId ? ` callerId="${xml(callerId)}"` : ''} action="${xml(adresItoga)}" method="POST">`
    + `<Number url="${xml(adresShirmy)}" method="POST">${xml(nomer)}</Number></Dial>`;
}

// Ширма: слышит только дежурный, после «алло» и до соединения. Два захода, потом отбой (нога кончается).
function twimlShirmy({ tekst, povtor, adresPrinyat, yazyk = 'en' } = {}) {
  const kuda = xml(adresPrinyat);
  const y = yazykIli(yazyk);
  const p = povtor || (y === 'es' ? 'Oprima 1 para aceptar la llamada.' : 'Press 1 to accept the call.');
  return `<Gather numDigits="1" timeout="6" action="${kuda}" method="POST">${skazat(tekst, y)}</Gather>`
    + `<Gather numDigits="1" timeout="5" action="${kuda}" method="POST">${skazat(p, y)}</Gather>`
    + '<Hangup/>';
}

// Нажатая цифра: любая цифра = живой человек (промах мимо единицы не должен стоить жильцу помощи).
// Пустой ответ = ширма кончилась, Twilio соединяет; отбой = нога дежурного закрыта.
function twimlPrinyat(cifra) {
  return /^[0-9*#]$/.test(String(cifra || '').trim()) ? '' : '<Hangup/>';
}

// Звонок-побудка (угроза жизни или «никто не принял»): прочитать дважды, ждать цифру, потом отбой.
function twimlSignala({ tekst, adresOtveta, yazyk = 'en' } = {}) {
  const kuda = xml(adresOtveta);
  return `<Gather numDigits="1" timeout="8" action="${kuda}" method="POST">${skazat(tekst, yazyk)}</Gather>`
    + `<Gather numDigits="1" timeout="8" action="${kuda}" method="POST">${skazat(tekst, yazyk)}</Gather><Hangup/>`;
}

function twimlOtkata({ tekst = null, yazyk = 'en' } = {}) {
  const y = yazykIli(yazyk);
  return `${skazat(tekst || FRAZY_ZHILCU.nikto[y], y)}<Hangup/>`;
}

function frazaZhilcu(kod, yazyk = 'en') {
  const f = FRAZY_ZHILCU[kod];
  return f ? f[yazykIli(yazyk)] : '';
}

// ── тексты для дежурного ───────────────────────────────────────────────────
function imyaKategorii(kat, yazyk = 'en') {
  const x = IMENA_KATEGORIY[kat] || IMENA_KATEGORIY.drugoe;
  return x[yazykIli(yazyk)];
}
function gdeTekst(avaria) {
  const a = avaria || {};
  const adres = chistyy(a.adres_korotko || a.adres || '', 60).replace(/\s*\(DEMO\)\s*/g, '').replace(/,?\s*Brooklyn.*$/i, '');
  const kv = a.kvartira ? `, apartment ${normKvartira(a.kvartira)}` : '';
  return adres ? `${adres}${kv}` : (kv ? kv.slice(2) : 'address not confirmed');
}

// Ширма и звонок-побудка: на языке владельца (по-английски), без имени жильца.
function tekstShirmy(avaria, { kompaniya = 'Harbor Row', rezhim = 'perevod' } = {}) {
  const a = avaria || {};
  const chto = imyaKategorii(a.kategoriya, 'en');
  const gde = gdeTekst(a);
  if (rezhim === 'signal') {
    const pochemu = a.uroven === 'ugroza_zhizni' ? 'Life safety call. The resident was told to call nine-one-one.'
      : 'Nobody has taken this emergency yet.';
    return `${kompaniya} emergency line. ${pochemu} ${cap(chto)} at ${gde}. The resident's number is in your text messages. Press 1 if you will handle it.`;
  }
  return `${kompaniya} emergency line. ${cap(chto)} at ${gde}. Press 1 to take the call.`;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// SMS дежурным (язык владельца, ≤ 320 знаков). Номер жильца нужен, имя — нет.
function tekstSms(avaria, shablon, { kompaniya = 'Harbor Row' } = {}) {
  const a = avaria || {};
  const chto = imyaKategorii(a.kategoriya, 'en');
  const gde = gdeTekst(a);
  const tel = e164(a.telefon) || 'unknown';
  const id = a.id ? ` #${a.id}` : '';
  const pref = `${kompaniya} NightDesk (DEMO)`;
  let t;
  if (shablon === 'ugroza') t = `${pref}: LIFE SAFETY - ${chto} at ${gde}. Resident told to call 911. Resident: ${tel}.${id}`;
  else if (shablon === 'ne_prinyata') t = `${pref}: EMERGENCY NOT TAKEN - ${chto} at ${gde}. Nobody took the transfer. Call the resident: ${tel}.${id}`;
  else if (shablon === 'zhilec_polozhil') t = `${pref}: EMERGENCY - ${chto} at ${gde}. Resident hung up during the transfer. Call back: ${tel}.${id}`;
  else if (shablon === 'prinyata') t = `${pref}: taken - ${chto} at ${gde} is being handled.${id}`;
  else t = `${pref}: ${chto} at ${gde}. Resident: ${tel}.${id}`;
  return t.slice(0, 320);
}

// ── заявка на ремонт ───────────────────────────────────────────────────────
// «apt 4b», «#4-B», «apartamento 4b», «квартира 4Б» → «4B». Кириллица А/Б/В… → латиница по звучанию.
const KIR = { 'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'С': 'C', 'Ф': 'F', 'Р': 'R', 'К': 'K', 'М': 'M', 'Н': 'N' };
function normKvartira(k) {
  let s = String(k ?? '').toUpperCase().trim();
  // Слово «квартира» убираем ДО замены букв: \b в JS не видит кириллицу, поэтому границы — пробел, # или цифра.
  s = s.replace(/(^|[\s#])(APARTMENT|APARTAMENTO|APT|UNIT|SUITE|NUM|NO|КВАРТИРА|КВ)\.?(?=[\s#\d]|$)/g, ' ');
  s = s.replace(/[АБВГДЕСФРКМН]/g, (b) => KIR[b] || b);
  s = s.replace(/[#\s\-–.,]/g, '');
  return s.slice(0, 8);
}

const EN_CHISLA = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_DESYATKI = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ES_CHISLA = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const ES_DESYATKI = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
function chisloSlovami(n, yazyk) {
  if (yazykIli(yazyk) === 'es') {
    if (n < 30) return ES_CHISLA[n];
    const d = Math.floor(n / 10); const e = n % 10;
    return e ? `${ES_DESYATKI[d]} y ${ES_CHISLA[e]}` : ES_DESYATKI[d];
  }
  if (n < 20) return EN_CHISLA[n];
  const d = Math.floor(n / 10); const e = n % 10;
  return e ? `${EN_DESYATKI[d]}-${EN_CHISLA[e]}` : EN_DESYATKI[d];
}
const cifraSlovom = (c, yazyk) => (yazykIli(yazyk) === 'es' ? ES_CHISLA[+c] : EN_CHISLA[+c]);

// «4B» → «four B»; «12C» → «twelve C»; «405» → «four zero five» (три цифры и больше — по одной).
function kvartiraVsluh(k, yazyk = 'en') {
  const s = normKvartira(k);
  return s.replace(/\d+/g, (m) => ` ${m.length <= 2 ? chisloSlovami(+m, yazyk) : m.split('').map((c) => cifraSlovom(c, yazyk)).join(' ')} `)
    .replace(/[A-Z]+/g, (m) => ` ${m.split('').join(' ')} `)
    .replace(/\s+/g, ' ').trim();
}

// Номер заявки для жильца: счётчик клиента 1, 2, 3… → HR-1001, HR-1002…
function nomerZayavki(n, prefiks = 'HR') {
  const x = Math.max(1, Math.floor(Number(n) || 1));
  return `${prefiks}-${1000 + x}`;
}
// Вслух — только цифры, по одной: «one zero zero one».
function nomerVsluh(nomer, yazyk = 'en') {
  const cifry = String(nomer || '').replace(/\D+/g, '');
  return cifry.split('').map((c) => cifraSlovom(c, yazyk)).join(' ');
}

// d: {dom, kvartira, kategoriya, uroven, opisanie, dostup, dostup_primechanie, zhivotnye, imya, telefon, sms_soglasie,
//     conversation_id, avaria_id, istochnik}. Адрес дома подставляется из doma (лист правды), не из слов модели.
function novayaZayavka(d, { nomer, at, doma = null, poyas = POYAS } = {}) {
  const x = d || {};
  const t = vMs(at);
  const domId = chistyy(x.dom, 40).toLowerCase();
  const dom = Array.isArray(doma) ? doma.find((z) => z.id === domId) : null;
  const dostup = DOSTUP.includes(String(x.dostup || '').toLowerCase()) ? String(x.dostup).toLowerCase() : null;
  const kat = KATEGORII[x.kategoriya] ? x.kategoriya : 'drugoe';
  const kogda = Number.isFinite(t) ? vIso(t, poyas) : null;
  return {
    id: nomer || null,
    nomer: nomer || null,
    created_at: kogda,
    conversation_id: chistyy(x.conversation_id, 80) || null,
    istochnik: x.istochnik === 'sms' ? 'sms' : 'call',
    dom: dom ? dom.id : (domId || null),
    adres: dom ? dom.adres : null,
    kvartira: normKvartira(x.kvartira) || null,
    kategoriya: kat,
    uroven: UROVNI.includes(x.uroven) ? x.uroven : 'ne_srochno',
    opisanie: chistyy(x.opisanie, 300),
    dostup,
    dostup_primechanie: chistyy(x.dostup_primechanie, 120),
    zhivotnye: otvet(x.zhivotnye) || null,
    imya: chistyy(x.imya, 80),
    telefon: e164(x.telefon),
    sms_soglasie: x.sms_soglasie === true || otvet(x.sms_soglasie) === 'da',
    foto_ssylka_otpravlena: false,
    avaria_id: x.avaria_id || null,
    status: 'new',
    istoriya: [{ at: kogda, status: 'new' }],
  };
}

// Приёмка плана: «Заявка управляющему: адрес, квартира, описание, доступ — 100% без потерь».
const PLOHIE_IMENA = /^(caller|unknown|resident|tenant|n\/?a|none|anonymous|no name|неизвестно|жилец)$/i;
function proveritZayavku(z, { doma = null } = {}) {
  const net = [];
  const oshibki = [];
  const x = z || {};
  if (!x.dom) net.push('dom');
  else if (Array.isArray(doma) && !doma.some((d) => d.id === x.dom)) oshibki.push('dom: не наш дом');
  if (!x.kvartira) net.push('kvartira');
  if (!x.opisanie || x.opisanie.length < 3) net.push('opisanie');
  if (!x.dostup) net.push('dostup');
  if (!x.imya || PLOHIE_IMENA.test(String(x.imya).trim())) net.push('imya');
  if (!x.telefon) net.push('telefon');
  return { ok: !net.length && !oshibki.length, net, oshibki };
}

module.exports = {
  // сортировка
  sortirovat, teploNyc, temperaturaF, otvetInstrumenta, tekstInstrukcii, proveritSpisok, sobratSpisok,
  // цепочка
  sostavitCepochku, podryadchikDlya, novayaEskalaciya, primenitIshod, sleduyushcheeDeystvie, otmetitZvonok,
  ishodPerevoda, ishodSignala, pravilaEskalacii,
  // TwiML и тексты
  twimlPerevoda, twimlShirmy, twimlPrinyat, twimlSignala, twimlOtkata, obernut, tekstShirmy, tekstSms, frazaZhilcu,
  imyaKategorii,
  // заявка
  novayaZayavka, proveritZayavku, nomerZayavki, nomerVsluh, normKvartira, kvartiraVsluh,
  // справочники
  KATEGORII, UGROZA_VSEGDA, UROVNI, OTVET, OHVAT, CO_SIGNAL, DOSTUP, ISHODY, TEPLO_NYC, VOPROSY, IMENA_KATEGORIY,
  FRAZY_ZHILCU, ESKALACIYA_PO_UMOLCHANIYU,
  // служебное (тесты)
  _vnutri: { chasti, vIso, vMs, e164, otvet, chistyy, xml },
};
