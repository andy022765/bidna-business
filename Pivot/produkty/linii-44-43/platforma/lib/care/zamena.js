'use strict';
// №44 CareLine, модуль A3: подбор замены при отказе от смены. Движок без модели.
//
// ПОЧЕМУ БЕЗ МОДЕЛИ. Кому отдать смену — задача расписания с жёсткими ограничениями (навык, язык клиента,
// пересечения, лимит часов, согласие на SMS). Модели держат такие ограничения плохо (SCHEDBench,
// arXiv 2608.00991), поэтому здесь фильтр по правилам и детерминированное ранжирование: одинаковые
// данные → одинаковый ответ, у каждого места в списке есть причины.
//
// СИГНАТУРЫ ИЗ KONTRAKT.md
//   podobrat(smena, sidelki, smeny, pravila)            → [{sidelka_id, ball, prichiny[]}]
//   sleduyushchayaVolna(otkaz, reyting, pravila)        → {sidelki[], ostalos, kod}
//   prinyatOtvet(otkaz, sidelka_id, otvet[, kontekst])  → {rezultat, otkaz, izmeneno, soobshchenie, ...}
//   eskalaciyaNuzhna(otkaz, smena, seychas, pravila[, reyting]) → true | false
// Сверх контракта (для обвязки и пульта): podobratPodrobno, eskalaciyaPodrobno, nuzhnaNovayaVolna,
// sleduyushcheeDeystvie (одно решение «что делать сейчас»), razobratOtvet, primenitAtomarno.
//
// КЛИЕНТ СМЕНЫ. В сигнатуре podobrat клиента нет, а без него нельзя проверить язык, навык и расстояние.
// Берём smena.klient (так делает lib/otkazy.js) или ищем smena.klient_id в pravila.klienty. Нет клиента —
// ошибка, а не молчаливый подбор без фильтров.
//
// ДВОЙНОЕ «ДА». prinyatOtvet — чистая функция: не меняет вход, возвращает новое состояние. От гонки двух
// вебхуков в одну секунду она сама не спасает — запись в хранилище обязана быть условной (etag / замок).
// primenitAtomarno — готовый цикл «прочитать → применить → записать с версией → при конфликте повторить»:
// второй «ДА» после перечитывания получает «смена занята».

const { rasstoyanieKm } = require('./zip');
const vr = require('./vremya-dvizhkov');

const PRAVILA_PO_UMOLCHANIYU = Object.freeze({
  volna: 3,                         // сколько человек получают предложение в одной волне
  ozhidanie_min: 15,                // сколько ждём ответов на волну
  eskalaciya_za_min: 120,           // за сколько минут до начала будим дежурного, если смена не закрыта
  bufer_min: 30,                    // минимальный зазор между сменами одной сиделки (дорога)
  maks_km: 25,                      // дальше не предлагаем (по прямой между ZIP)
  norma_km: 20,                     // на таком расстоянии балл за близость падает до нуля
  maks_chasov_po_umolchaniyu: 40,   // если у сиделки не задан maks_chasov_v_nedelyu
  vesa: Object.freeze({ rasstoyanie: 0.4, znaet_klienta: 0.3, nadezhnost: 0.3 }),
  zamenyaet: Object.freeze({ HHA: Object.freeze(['PCA']) }), // HHA закрывает требование PCA (настройка агентства)
  zanyato_statusy: Object.freeze(['scheduled', 'filled']),   // смены с такими статусами занимают сиделку
  volny_posle_eskalacii: true,      // после побудки дежурного продолжать рассылать волны, пока смена не началась
  prinimat_posle_nachala: false,    // «ДА» после начала смены автоматически не закрепляем — решает координатор
  pervyy_den_nedeli: 1,             // рабочая неделя агентства с понедельника (для лимита часов)
  poyas: vr.POYAS,
  yazyk: 'en',                      // язык причин в рейтинге: 'en' | 'ru' (покупатель — агентство в США)
});

// Правила агентства поверх умолчаний. Понимает имена стенда: eskalaciya_za_chasov (nastroyki.json), poyas.
function sobratPravila(pravila) {
  const p = pravila || {};
  const itog = Object.assign({}, PRAVILA_PO_UMOLCHANIYU, p);
  itog.vesa = Object.assign({}, PRAVILA_PO_UMOLCHANIYU.vesa, p.vesa || {});
  itog.zamenyaet = p.zamenyaet || PRAVILA_PO_UMOLCHANIYU.zamenyaet;
  if (p.eskalaciya_za_min == null && p.eskalaciya_za_chasov != null && Number.isFinite(Number(p.eskalaciya_za_chasov))) {
    itog.eskalaciya_za_min = Number(p.eskalaciya_za_chasov) * 60;
  }
  itog.poyas = p.poyas || p.chasovoy_poyas || PRAVILA_PO_UMOLCHANIYU.poyas;
  itog.volna = Math.max(1, Math.floor(Number(itog.volna) || 3));
  itog.ozhidanie_min = Number(itog.ozhidanie_min);
  if (!Number.isFinite(itog.ozhidanie_min) || itog.ozhidanie_min < 0) itog.ozhidanie_min = 15;
  itog.eskalaciya_za_min = Number(itog.eskalaciya_za_min);
  if (!Number.isFinite(itog.eskalaciya_za_min)) itog.eskalaciya_za_min = 120;
  return itog;
}

const chislo = (x) => String(Math.round(x * 100) / 100);

const TEKSTY = {
  en: {
    km: (d) => `${d.toFixed(1)} km from the client`,
    kmNeizvestno: (z) => `distance unknown (ZIP ${z || '—'} is not in the table)`,
    znaet: 'knows the client',
    nadezhnost: (n) => `reliability ${n.toFixed(2)}`,
    yazyk: (y) => `speaks the client's language (${y})`,
    chasy: (u, s, l) => `${chislo(u)} h this week, ${chislo(u + s)} of ${chislo(l)} with this shift`,
    neAktivna: 'inactive',
    netSms: 'no SMS consent',
    samaOtkazalas: 'called off this shift',
    netNavyka: (n) => `missing skill ${n}`,
    netYazyka: (y) => `does not speak the client's language (${y})`,
    daleko: (d, m) => `too far: ${d.toFixed(1)} km (limit ${m} km)`,
    zanyata: (id, s, e) => `busy: shift ${id} ${s}–${e}`,
    limit: (u, s, l) => `weekly hours limit: ${chislo(u)} + ${chislo(s)} > ${chislo(l)}`,
  },
  ru: {
    km: (d) => `${d.toFixed(1)} км от клиента`,
    kmNeizvestno: (z) => `расстояние неизвестно (ZIP ${z || '—'} нет в таблице)`,
    znaet: 'знает клиента',
    nadezhnost: (n) => `надёжность ${n.toFixed(2)}`,
    yazyk: (y) => `говорит на языке клиента (${y})`,
    chasy: (u, s, l) => `${chislo(u)} ч на неделе, со сменой ${chislo(u + s)} из ${chislo(l)}`,
    neAktivna: 'не активна',
    netSms: 'нет согласия на SMS',
    samaOtkazalas: 'сама отказалась от этой смены',
    netNavyka: (n) => `нет навыка ${n}`,
    netYazyka: (y) => `не говорит на языке клиента (${y})`,
    daleko: (d, m) => `далеко: ${d.toFixed(1)} км (предел ${m} км)`,
    zanyata: (id, s, e) => `занята: смена ${id} ${s}–${e}`,
    limit: (u, s, l) => `лимит часов в неделю: ${chislo(u)} + ${chislo(s)} > ${chislo(l)}`,
  },
};

// Ответ сиделке по SMS на её ответ (EN/ES/RU проверены; ZH и HT — черновик перевода, проверить носителем).
const SMS = {
  zakreplena: {
    en: 'Confirmed: the shift is yours. The coordinator has been notified.',
    es: 'Confirmado: el turno es suyo. Ya avisamos a la coordinación.',
    ru: 'Подтверждено: смена ваша. Координатор в курсе.',
    zh: '已确认：这个班次由您负责，协调员已收到通知。',
    ht: 'Konfime: orè travay sa a se pou ou. Nou avèti koòdonatè a.',
  },
  zanyato: {
    en: 'Thank you! This shift has already been taken.',
    es: '¡Gracias! Este turno ya fue tomado.',
    ru: 'Спасибо! Смена уже занята.',
    zh: '谢谢！这个班次已经有人接了。',
    ht: 'Mèsi! Yon lòt moun deja pran orè travay sa a.',
  },
  uzhe_vasha: {
    en: 'You are already confirmed for this shift.',
    es: 'Usted ya está confirmada para este turno.',
    ru: 'Вы уже закреплены за этой сменой.',
    zh: '您已经确认接这个班次。',
    ht: 'Ou deja konfime pou orè travay sa a.',
  },
  otkaz_prinyat: {
    en: 'Thank you, noted.',
    es: 'Gracias, anotado.',
    ru: 'Спасибо, приняли.',
    zh: '谢谢，已记录。',
    ht: 'Mèsi, nou note sa.',
  },
  ne_ponyal: {
    en: 'Please reply YES or NO.',
    es: 'Por favor responda SÍ o NO.',
    ru: 'Пожалуйста, ответьте ДА или НЕТ.',
    zh: '请回复"是"或"不"。',
    ht: 'Tanpri reponn WI oswa NON.',
  },
  ne_predlagalos: {
    en: 'We have no open shift offer for you right now.',
    es: 'Ahora no tenemos una oferta de turno abierta para usted.',
    ru: 'Сейчас для вас нет открытого предложения смены.',
    zh: '目前没有给您的班次邀请。',
    ht: 'Pa gen okenn òf orè travay pou ou kounye a.',
  },
  pozdno: {
    en: 'Thank you! The shift has already started — the coordinator will call you.',
    es: '¡Gracias! El turno ya empezó; la coordinación le llamará.',
    ru: 'Спасибо! Смена уже началась — координатор вам позвонит.',
    zh: '谢谢！班次已经开始，协调员会给您打电话。',
    ht: 'Mèsi! Orè travay la deja kòmanse — koòdonatè a ap rele ou.',
  },
  ne_podhodit: {
    en: 'Thank you! The coordinator will contact you about this shift.',
    es: '¡Gracias! La coordinación le contactará sobre este turno.',
    ru: 'Спасибо! Координатор свяжется с вами по этой смене.',
    zh: '谢谢！协调员会就这个班次联系您。',
    ht: 'Mèsi! Koòdonatè a ap kontakte ou pou orè travay sa a.',
  },
  peredumala: {
    en: 'Noted. The coordinator will contact you shortly.',
    es: 'Anotado. La coordinación le contactará pronto.',
    ru: 'Приняли. Координатор скоро свяжется с вами.',
    zh: '已记录，协调员会尽快联系您。',
    ht: 'Nou note sa. Koòdonatè a ap kontakte ou byento.',
  },
};

function tekstSms(kod, yazyk) {
  const t = SMS[kod];
  if (!t) return '';
  const y = String(yazyk || 'en').trim().toLowerCase().slice(0, 2);
  return t[y] || t.en;
}

const norm = (x) => String(x == null ? '' : x).trim().toUpperCase();
const sravnitId = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
// Число из поля или запасное значение: null, '', 'abc' → zapas (пустое поле не должно стать нулём).
function chisloIli(x, zapas) {
  if (x == null || (typeof x === 'string' && !x.trim())) return zapas;
  const n = Number(x);
  return Number.isFinite(n) ? n : zapas;
}

function klientSmeny(smena, p) {
  if (smena.klient && typeof smena.klient === 'object') return smena.klient;
  const k = p.klienty;
  if (Array.isArray(k)) return k.find((x) => x && x.id === smena.klient_id) || null;
  if (k && typeof k === 'object') return k[smena.klient_id] || null;
  return null;
}

function imeetNavyk(navyki, trebuetsya, zamenyaet) {
  if (navyki.includes(trebuetsya)) return true;
  return navyki.some((n) => {
    const spisok = zamenyaet[n] || zamenyaet[n.toLowerCase()] || [];
    return spisok.map(norm).includes(trebuetsya);
  });
}

// Подбор с отчётом: кто прошёл (рейтинг) и кто отсеян и почему — для пульта «почему никого».
function podobratPodrobno(smena, sidelki, smeny, pravila) {
  if (!smena || typeof smena !== 'object') throw new TypeError('podobrat: нет смены');
  const p = sobratPravila(pravila);
  const t = TEKSTY[p.yazyk] || TEKSTY.en;
  const klient = klientSmeny(smena, p);
  if (!klient) {
    throw new Error(`podobrat: не найден клиент смены ${smena.klient_id} — передайте smena.klient или pravila.klienty`);
  }
  const poyas = p.poyas;
  const start = vr.vMs(smena.start, poyas);
  const end = vr.vMs(smena.end, poyas);
  if (!(end > start)) throw new Error(`podobrat: у смены ${smena.id} нет начала или конца`);
  const dlitCh = (end - start) / 3600000;
  const nedelya = vr.nachaloNedeli(start, poyas, p.pervyy_den_nedeli);
  const trebuetsya = (klient.trebovaniya_navyki || []).map(norm).filter(Boolean);
  const yazykKlienta = klient.yazyk ? norm(klient.yazyk) : null;
  const klientId = klient.id != null ? klient.id : smena.klient_id;
  const bufer = Math.max(0, Number(p.bufer_min) || 0) * 60000;
  // Не предлагаем ни отказавшейся, ни той, что отказалась раньше (lib/otkazy.js хранит её в sidelka_id_do_otkaza).
  const isklyuchit = new Set([smena.sidelka_id, smena.sidelka_id_do_otkaza,
    ...(Array.isArray(p.isklyuchit) ? p.isklyuchit : [])].filter(Boolean));

  // Занятость: только смены, которые реально за сиделкой (scheduled/filled); отказная смена сама не в счёт.
  const zanyatost = new Map();
  for (const s of Array.isArray(smeny) ? smeny : []) {
    if (!s || !s.sidelka_id || s.id === smena.id) continue;
    if (s.status && !p.zanyato_statusy.includes(s.status)) continue;
    const a = vr.vMs(s.start, poyas);
    const b = vr.vMs(s.end, poyas);
    if (!(b > a)) continue;
    if (!zanyatost.has(s.sidelka_id)) zanyatost.set(s.sidelka_id, []);
    zanyatost.get(s.sidelka_id).push({ id: s.id, a, b });
  }

  const reyting = [];
  const otseyany = [];
  for (const sd of Array.isArray(sidelki) ? sidelki : []) {
    if (!sd || !sd.id) continue;
    const net = [];
    if (sd.aktivna === false) net.push(t.neAktivna);
    if (sd.sms_soglasie !== true) net.push(t.netSms); // строго: без явного согласия SMS не шлём (TCPA)
    if (isklyuchit.has(sd.id)) net.push(t.samaOtkazalas);
    const navyki = (sd.navyki || []).map(norm);
    for (const tr of trebuetsya) if (!imeetNavyk(navyki, tr, p.zamenyaet)) net.push(t.netNavyka(tr));
    const yazyki = (sd.yazyki || []).map(norm);
    if (yazykKlienta && !yazyki.includes(yazykKlienta)) net.push(t.netYazyka(yazykKlienta));
    const km = rasstoyanieKm(sd.zip, klient.zip);
    if (km != null && km > p.maks_km) net.push(t.daleko(km, p.maks_km));
    const ee = zanyatost.get(sd.id) || [];
    const konflikt = ee.find((z) => z.a < end + bufer && z.b > start - bufer);
    if (konflikt) net.push(t.zanyata(konflikt.id, vr.chchmm(konflikt.a, poyas), vr.chchmm(konflikt.b, poyas)));
    const limit = chisloIli(sd.maks_chasov_v_nedelyu, p.maks_chasov_po_umolchaniyu);
    // Часы недели смены считаем по расписанию; без расписания — по полю chasov_na_etoy_nedele.
    const uzhe = Array.isArray(smeny)
      ? ee.filter((z) => vr.nachaloNedeli(z.a, poyas, p.pervyy_den_nedeli) === nedelya).reduce((s, z) => s + (z.b - z.a) / 3600000, 0)
      : chisloIli(sd.chasov_na_etoy_nedele, 0);
    if (uzhe + dlitCh > limit + 1e-9) net.push(t.limit(uzhe, dlitCh, limit));

    if (net.length) { otseyany.push({ sidelka_id: sd.id, prichiny: net }); continue; }

    const wR = Math.max(0, chisloIli(p.vesa.rasstoyanie, 0));
    const wZ = Math.max(0, chisloIli(p.vesa.znaet_klienta, 0));
    const wN = Math.max(0, chisloIli(p.vesa.nadezhnost, 0));
    const sumW = wR + wZ + wN || 1;
    const blizost = km == null ? 0 : Math.max(0, Math.min(1, 1 - km / p.norma_km));
    const znaet = (sd.znaet_klientov || []).includes(klientId);
    const nad = Math.max(0, Math.min(1, chisloIli(sd.nadezhnost, 0.5)));
    const tochno = (100 * (wR * blizost + wZ * (znaet ? 1 : 0) + wN * nad)) / sumW;
    const prichiny = [km == null ? t.kmNeizvestno(sd.zip) : t.km(km)];
    if (znaet) prichiny.push(t.znaet);
    prichiny.push(t.nadezhnost(nad));
    if (yazykKlienta) prichiny.push(t.yazyk(yazykKlienta));
    prichiny.push(t.chasy(uzhe, dlitCh, limit));
    reyting.push({ sidelka_id: sd.id, ball: Math.round(tochno * 10) / 10, prichiny, _t: tochno, _km: km });
  }
  reyting.sort((a, b) => (b._t - a._t)
    || ((a._km == null ? Infinity : a._km) - (b._km == null ? Infinity : b._km))
    || sravnitId(a.sidelka_id, b.sidelka_id));
  return {
    klient_id: klientId,
    reyting: reyting.map(({ sidelka_id, ball, prichiny }) => ({ sidelka_id, ball, prichiny })),
    otseyany,
  };
}

function podobrat(smena, sidelki, smeny, pravila) {
  return podobratPodrobno(smena, sidelki, smeny, pravila).reyting;
}

// ── волны ───────────────────────────────────────────────────────────────────
function predlozhennye(otkaz) {
  const s = new Set();
  for (const v of (otkaz && otkaz.volny) || []) for (const id of (v && v.sidelki) || []) s.add(id);
  return s;
}

function poslednieOtvety(otkaz) {
  const m = new Map();
  for (const o of (otkaz && otkaz.otvety) || []) if (o && o.sidelka_id) m.set(o.sidelka_id, o.otvet);
  return m;
}

function ostavshiesya(otkaz, reyting) {
  const byli = predlozhennye(otkaz);
  const otvetili = new Set(((otkaz && otkaz.otvety) || []).map((o) => o && o.sidelka_id));
  const vidali = new Set();
  const ost = [];
  for (const r of Array.isArray(reyting) ? reyting : []) {
    const id = r && (typeof r === 'string' ? r : r.sidelka_id);
    if (!id || vidali.has(id)) continue;
    vidali.add(id);
    if (byli.has(id) || otvetili.has(id) || id === otkaz.sidelka_id) continue;
    ost.push(id);
  }
  return ost;
}

// Следующая волна: первые `volna` из рейтинга, кому ещё не предлагали. Время волны (`at`) ставит вызывающий
// при записи в otkaz.volny. Пустой список (kod 'kandidaty_ischerpany') — предлагать больше некому.
function sleduyushchayaVolna(otkaz, reyting, pravila) {
  if (!otkaz || typeof otkaz !== 'object') throw new TypeError('sleduyushchayaVolna: нет отказа');
  const p = sobratPravila(pravila);
  if (otkaz.zakreplena_za) return { sidelki: [], ostalos: 0, kod: 'zakryta' };
  const ost = ostavshiesya(otkaz, reyting);
  const sidelki = ost.slice(0, p.volna);
  return { sidelki, ostalos: ost.length - sidelki.length, kod: sidelki.length ? 'volna' : 'kandidaty_ischerpany' };
}

// Пора ли следующая волна: волн ещё не было; последняя истекла (ozhidanie_min); или все из неё сказали «НЕТ».
function nuzhnaNovayaVolna(otkaz, seychas, pravila) {
  const p = sobratPravila(pravila);
  if (!otkaz || otkaz.zakreplena_za) return false;
  const volny = otkaz.volny || [];
  if (!volny.length) return true;
  const posl = volny[volny.length - 1] || {};
  const t = vr.vMs(seychas, p.poyas);
  const at = vr.vMs(posl.at, p.poyas);
  if (!Number.isFinite(at) || !Number.isFinite(t)) return true; // время волны не записано — не зависаем
  if (t - at >= p.ozhidanie_min * 60000) return true;
  const otv = poslednieOtvety(otkaz);
  const ids = posl.sidelki || [];
  return ids.length === 0 || ids.every((id) => otv.get(id) === 'net');
}

// ── эскалация ───────────────────────────────────────────────────────────────
function eskalaciyaPodrobno(otkaz, smena, seychas, pravila, reyting) {
  const p = sobratPravila(pravila);
  const ne = (kod) => ({ nuzhna: false, kod });
  const da = (kod, minDo) => ({ nuzhna: true, kod, min_do_nachala: minDo == null ? null : Math.round(minDo) });
  if (!otkaz) return da('net_dannyh');
  if (otkaz.zakreplena_za) return ne('zakryta');
  if (otkaz.eskalaciya_v) return ne('uzhe_eskalirovano');
  if (smena && smena.status === 'filled' && smena.sidelka_id && smena.sidelka_id !== otkaz.sidelka_id) return ne('zakryta');
  const t = vr.vMs(seychas, p.poyas);
  const start = smena ? vr.vMs(smena.start, p.poyas) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(start)) return da('net_dannyh'); // сломаны данные — будим человека
  const minDo = (start - t) / 60000;
  if (minDo <= 0) return da('smena_nachalas', minDo);
  if (minDo <= p.eskalaciya_za_min) return da('malo_vremeni', minDo);
  if (Array.isArray(reyting) && ostavshiesya(otkaz, reyting).length === 0) {
    const bylo = [...predlozhennye(otkaz)];
    if (!bylo.length) return da('net_kandidatov', minDo);
    if (nuzhnaNovayaVolna(otkaz, t, p)) {
      const otv = poslednieOtvety(otkaz);
      return da(bylo.every((id) => otv.get(id) === 'net') ? 'vse_otkazali' : 'nikto_ne_otvetil', minDo);
    }
  }
  return ne('zhdem');
}

// Контракт: да/нет. Если передан рейтинг (5-й аргумент), будим и тогда, когда предлагать больше некому.
function eskalaciyaNuzhna(otkaz, smena, seychas, pravila, reyting) {
  return eskalaciyaPodrobno(otkaz, smena, seychas, pravila, reyting).nuzhna;
}

// Одно решение на тик: 'volna' (разослать sidelki), 'eskalaciya' (будить дежурного; sidelki — параллельная
// волна), 'zhdat' или 'nichego'. Применяет вызывающий: volny.push({at: seychas, sidelki}), eskalaciya_v = seychas.
function sleduyushcheeDeystvie(otkaz, smena, seychas, pravila, reyting) {
  const p = sobratPravila(pravila);
  if (!otkaz) return { deystvie: 'eskalaciya', kod: 'net_dannyh', sidelki: [] };
  if (otkaz.zakreplena_za) return { deystvie: 'nichego', kod: 'zakryta', sidelki: [] };
  const t = vr.vMs(seychas, p.poyas);
  const start = smena ? vr.vMs(smena.start, p.poyas) : NaN;
  const esk = eskalaciyaPodrobno(otkaz, smena, t, p, reyting);
  let sidelki = [];
  const smenaEshcheNeNachalas = Number.isFinite(start) && Number.isFinite(t) && t < start;
  if (Array.isArray(reyting) && smenaEshcheNeNachalas && nuzhnaNovayaVolna(otkaz, t, p)) {
    const posleEskalacii = esk.nuzhna || !!otkaz.eskalaciya_v;
    if (!posleEskalacii || p.volny_posle_eskalacii) sidelki = sleduyushchayaVolna(otkaz, reyting, p).sidelki;
  }
  if (esk.nuzhna) return { deystvie: 'eskalaciya', kod: esk.kod, sidelki, min_do_nachala: esk.min_do_nachala };
  if (sidelki.length) {
    return { deystvie: 'volna', kod: (otkaz.volny || []).length ? 'sleduyushchaya_volna' : 'pervaya_volna', sidelki };
  }
  if (otkaz.eskalaciya_v) return { deystvie: 'zhdat', kod: 'zhdem_koordinatora', sidelki: [] };
  const volny = otkaz.volny || [];
  const posl = volny.length ? vr.vMs(volny[volny.length - 1].at, p.poyas) : NaN;
  const doMs = Number.isFinite(posl) ? posl + p.ozhidanie_min * 60000 : NaN;
  return { deystvie: 'zhdat', kod: 'zhdem_otvetov', sidelki: [], do: Number.isFinite(doMs) ? vr.vIso(doMs, p.poyas) : null };
}

// ── ответ сиделки ───────────────────────────────────────────────────────────
const DA = new Set(['DA', 'ДА', 'Д', 'YES', 'Y', 'YEP', 'YEAH', 'OK', 'OKAY', 'SI', 'SÍ', 'WI', 'OUI', 'КОНЕЧНО', 'МОГУ']);
const NET = new Set(['NET', 'НЕТ', 'Н', 'НЕ', 'NO', 'N', 'NOPE', 'NON', 'НЕМОГУ']);

// Текст SMS → 'da' | 'net' | null. Понимает EN/ES/RU/ZH/HT и нормализованные 'da'/'net' от обвязки.
// STOP/START сюда не относятся — их разбирает sms-vhod (согласия).
function razobratOtvet(tekst) {
  const s = String(tekst == null ? '' : tekst).trim().toUpperCase().replace(/^[\s"'«»(¡¿]+/, '').replace(/[\s.!?,;:"'«»)]+$/, '');
  if (!s) return null;
  if (DA.has(s)) return 'da';
  if (NET.has(s)) return 'net';
  if (/^[一-鿿]/.test(s)) {
    if (/^(不|否|没)/.test(s)) return 'net';
    if (/^(是|好|可以|行|能|对)/.test(s)) return 'da';
    return null;
  }
  const slovo = s.split(/[\s,.!?;:]+/)[0];
  if (DA.has(slovo)) return 'da';
  if (NET.has(slovo)) return 'net';
  return null;
}

function kopiya(otkaz) {
  return Object.assign({}, otkaz, {
    volny: ((otkaz && otkaz.volny) || []).map((v) => Object.assign({}, v, { sidelki: [...((v && v.sidelki) || [])] })),
    otvety: ((otkaz && otkaz.otvety) || []).map((o) => Object.assign({}, o)),
  });
}

// otvet: строка ('ДА', 'yes', 'da', …) или {otvet|tekst, at}. kontekst (необязательно):
//   at — время ответа; yazyk — язык SMS-ответа сиделке;
//   smena — чтобы не закреплять «ДА» после начала смены;
//   smena + sidelki + smeny + pravila — перепроверить сиделку на момент «ДА» (могла получить другую смену).
function prinyatOtvet(otkaz, sidelka_id, otvet, kontekst) {
  if (!otkaz || typeof otkaz !== 'object') throw new TypeError('prinyatOtvet: нет отказа');
  const k = kontekst || {};
  const p = sobratPravila(k.pravila);
  const obekt = otvet && typeof otvet === 'object';
  const tekst = obekt ? (otvet.otvet != null ? otvet.otvet : otvet.tekst) : otvet;
  const atSyroe = (obekt && otvet.at) || k.at || null;
  const at = atSyroe || vr.vIso(vr.teper(), p.poyas);
  const reshenie = razobratOtvet(tekst);
  const novyy = kopiya(otkaz);
  const itog = (rezultat, dop = {}) => Object.assign({
    rezultat,
    soobshchenie: tekstSms(rezultat, k.yazyk),
    otkaz: dop.izmeneno ? novyy : otkaz,
    izmeneno: false,
  }, dop);
  const zapisat = () => { novyy.otvety.push({ sidelka_id, otvet: reshenie, at }); };

  if (!sidelka_id || !predlozhennye(otkaz).has(sidelka_id)) return itog('ne_predlagalos');
  if (!reshenie) return itog('ne_ponyal');

  if (reshenie === 'da') {
    if (otkaz.zakreplena_za === sidelka_id) return itog('uzhe_vasha');
    if (otkaz.zakreplena_za) { zapisat(); return itog('zanyato', { izmeneno: true }); }
    if (k.smena && !p.prinimat_posle_nachala) {
      const tAt = vr.vMs(at, p.poyas);
      const start = vr.vMs(k.smena.start, p.poyas);
      if (Number.isFinite(tAt) && Number.isFinite(start) && tAt >= start) {
        zapisat();
        return itog('pozdno', { izmeneno: true, nuzhen_koordinator: true });
      }
    }
    if (k.smena && Array.isArray(k.sidelki)) {
      const sd = k.sidelki.find((x) => x && x.id === sidelka_id);
      const pr = podobratPodrobno(k.smena, sd ? [sd] : [], k.smeny, Object.assign({}, k.pravila || {}));
      if (!pr.reyting.length) {
        zapisat();
        return itog('ne_podhodit', { izmeneno: true, nuzhen_koordinator: false,
          prichiny: pr.otseyany.length ? pr.otseyany[0].prichiny : ['caregiver not found'] });
      }
    }
    zapisat();
    novyy.zakreplena_za = sidelka_id;
    novyy.zakreplena_v = at;
    const otv = poslednieOtvety(novyy);
    const uvedomit = [...predlozhennye(otkaz)].filter((id) => id !== sidelka_id && otv.get(id) !== 'net');
    return itog('zakreplena', { izmeneno: true, uvedomit_zanyato: uvedomit });
  }

  // «НЕТ»
  if (otkaz.zakreplena_za === sidelka_id) {
    zapisat(); // закрепление не снимаем молча: смена снова без человека — это решение координатора
    return itog('peredumala', { izmeneno: true, nuzhen_koordinator: true });
  }
  if (poslednieOtvety(otkaz).get(sidelka_id) === 'net') return itog('otkaz_prinyat');
  zapisat();
  return itog('otkaz_prinyat', { izmeneno: true });
}

// Условная запись с повтором. prochitat() → {znachenie, versiya}; zapisat(novoe, versiya) → true, если версия
// в хранилище не менялась (Netlify Blobs: onlyIfMatch по etag). izmenit(znachenie) → результат prinyatOtvet.
async function primenitAtomarno({ prochitat, zapisat, popytok = 5 }, izmenit) {
  for (let i = 1; i <= popytok; i++) {
    const { znachenie, versiya } = await prochitat();
    const r = izmenit(znachenie);
    if (!r || !r.izmeneno) return Object.assign({}, r, { popytok: i });
    if (await zapisat(r.otkaz, versiya)) return Object.assign({}, r, { popytok: i });
  }
  throw new Error(`primenitAtomarno: запись не удалась за ${popytok} попыток`);
}

module.exports = {
  PRAVILA_PO_UMOLCHANIYU, sobratPravila,
  podobrat, podobratPodrobno,
  sleduyushchayaVolna, nuzhnaNovayaVolna,
  prinyatOtvet, razobratOtvet, tekstSms, primenitAtomarno,
  eskalaciyaNuzhna, eskalaciyaPodrobno, sleduyushcheeDeystvie,
};
