'use strict';
/**
 * Снимок данных пульта CareLine (№44) и утренней сводки.
 *
 * sobratSnimok(vhod) → объект в формате docs/API.md (versiya 1).
 * Чистая функция: без сети, без хранилища, без часов системы (время приходит в vhod.seychas).
 * Функция pult может отдать результат как есть; функция svodka передаёт его в renderSvodka().
 *
 * vhod = {
 *   klient:  { id, nazvanie, shtat, poyas, yazyki[], demo }   // запись из nastroyki.json + id
 *   seychas: Date | ISO-строка                               // момент снимка
 *   zapisi:  { kandidaty[], sidelki[], klienty[], smeny[], otkazy[], evv[], zvonki[], soglasiya[] }
 *            // записи хранилища k-<klient> по модели KONTRAKT.md, как есть
 *   okna:    { voronka_dney: 30, otkazy_dney: 7, kandidaty_dney: 14, zvonki_dney: 7 }   // необяз.
 *   limity:  { kandidaty: 60, zvonki: 100, soglasiya: 100, otkazy: 50, sobesedovaniya: 20, progony: 10 }
 * }
 *
 * Даты «сегодня/вчера» считаются в поясе клиента (poyas), а не в поясе сервера.
 * Записи позже vhod.seychas отбрасываются: снимок в 7:00 не видит того, что случится днём.
 */

const VERSIYA = 1;

/** Подписи причин отказа кандидату (prichina_otkaza → текст для владельца). Неизвестный код пульт покажет как есть. */
const PRICHINY_OTKAZA = {
  net_sertifikata: 'No HHA or PCA certificate',
  tolko_cna: 'CNA only; HHA or PCA required',
  vne_rayona: 'Lives outside the service area',
  grafik: 'Availability does not match open shifts',
  net_transporta: 'No way to reach clients',
  pravo_na_rabotu: 'Not authorized to work in the US',
  opyt: 'Less experience than required',
  yazyk: 'Language requirement not met',
  drugoe: 'Other reason',
};

/** Значения vazhnost, которые считаются «исправить до счёта». Движок EVV может писать любое из них. */
const KRITICHNO = new Set(['kritichno', 'critical', 'high', 'vysokaya', 'blokiruet']);

// ---------- время ----------

function kDate(t) {
  if (t instanceof Date) return isNaN(t) ? null : t;
  if (t === null || t === undefined || t === '') return null;
  const d = new Date(t);
  return isNaN(d) ? null : d;
}

const FORMATY = new Map();
function chasti(d, poyas) {
  let f = FORMATY.get(poyas);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: poyas,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', timeZoneName: 'longOffset',
    });
    FORMATY.set(poyas, f);
  }
  const p = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return p;
}

/** Местная дата YYYY-MM-DD в поясе клиента. */
function mestnayaData(t, poyas) {
  const d = kDate(t);
  if (!d) return null;
  const p = chasti(d, poyas);
  return `${p.year}-${p.month}-${p.day}`;
}

/** ISO 8601 с местным смещением: 2026-09-30T07:00:00-04:00. */
function isoMestnoe(t, poyas) {
  const d = kDate(t);
  if (!d) return null;
  const p = chasti(d, poyas);
  const smeshchenie = (p.timeZoneName || '').replace('GMT', '') || '+00:00';
  const chas = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${chas}:${p.minute}:${p.second}${smeshchenie}`;
}

/** Сдвиг календарной даты YYYY-MM-DD на n дней. */
function sdvigDaty(ymd, n) {
  const [g, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(g, m - 1, d + n)).toISOString().slice(0, 10);
}

function minutMezhdu(a, b) {
  const x = kDate(a);
  const y = kDate(b);
  if (!x || !y) return null;
  return Math.max(0, Math.round((y - x) / 60000));
}

// ---------- мелочи ----------

function mediana(chisla) {
  if (!chisla.length) return null;
  const s = chisla.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function podschet(massiv, klyuch) {
  const itog = {};
  for (const x of massiv) {
    const k = klyuch(x);
    if (k === null || k === undefined || k === '') continue;
    itog[k] = (itog[k] || 0) + 1;
  }
  return itog;
}

function poId(massiv) {
  const m = new Map();
  for (const x of massiv || []) if (x && x.id) m.set(x.id, x);
  return m;
}

function poUbyvaniyu(pole) {
  return (a, b) => (kDate(b[pole]) || 0) - (kDate(a[pole]) || 0);
}

function kritichno(vazhnost) {
  return KRITICHNO.has(String(vazhnost || '').toLowerCase());
}

// ---------- отказы от смен ----------

/**
 * Статус отказа для ленты:
 *  zakreplena_v есть                                   → 'zakryta'    (замена нашлась; zakryta_za_min от soobshcheno)
 *  смена unfilled, отказ закрыт стендом (zakrit / ne_zakryta_v)
 *  или смена уже началась без замены                    → 'ne_zakryta'
 *  eskalaciya_v есть, замены нет                        → 'eskalaciya' (дежурного разбудили, смена ещё открыта)
 *  иначе                                               → 'v_rabote'   (предложения ушли, ждём ответа)
 */
function statusOtkaza(o, smena, seychas) {
  if (o.zakreplena_v) return 'zakryta';
  if ((smena && smena.status === 'unfilled') || o.zakrit || o.ne_zakryta_v) return 'ne_zakryta';
  const start = smena ? kDate(smena.start) : null;
  if (start && start <= seychas) return 'ne_zakryta';
  if (o.eskalaciya_v) return 'eskalaciya';
  return 'v_rabote';
}

function obogatitOtkaz(o, ctx) {
  const smena = ctx.smeny.get(o.smena_id) || null;
  const klient = smena ? ctx.klienty.get(smena.klient_id) || null : null;
  const sidelka = ctx.sidelki.get(o.sidelka_id) || null;
  const zamena = o.zakreplena_za ? ctx.sidelki.get(o.zakreplena_za) || null : null;
  const predlozheno = new Set();
  for (const v of o.volny || []) for (const s of v.sidelki || []) predlozheno.add(s);
  const status = statusOtkaza(o, smena, ctx.seychas);
  return {
    ...o,
    smena: smena ? {
      id: smena.id,
      start: smena.start,
      end: smena.end,
      kod_uslugi: smena.kod_uslugi || null,
      status: smena.status || null,
      klient_kod: klient ? klient.kod || null : null,
      rayon: klient ? klient.rayon || null : null,
      zip: klient ? klient.zip || null : null,
    } : null,
    sidelka: o.sidelka_id ? { id: o.sidelka_id, imya: sidelka ? sidelka.imya : null } : null,
    zamena: o.zakreplena_za ? { id: o.zakreplena_za, imya: zamena ? zamena.imya : null } : null,
    status,
    zakryta_za_min: status === 'zakryta' ? minutMezhdu(o.soobshcheno, o.zakreplena_v) : null,
    predlozheno: predlozheno.size,
  };
}

// ---------- EVV ----------

function svodkaProgona(r) {
  const isk = r.isklyucheniya || [];
  return {
    run_id: r.run_id,
    zagruzheno: r.zagruzheno,
    shtat: r.shtat || null,
    strok: r.strok || 0,
    fayl: r.fayl || null,
    isklyucheniy: isk.length,
    kritichnyh: isk.filter((x) => kritichno(x.vazhnost)).length,
  };
}

// ---------- день ----------

function sobratDen(data, ctx) {
  const { poyas } = ctx;
  const vDen = (t) => mestnayaData(t, poyas) === data;

  const zv = ctx.zvonki.filter((z) => vDen(z.nachalo));
  const sekund = zv.reduce((s, z) => s + (Number(z.dlitelnost_s) || 0), 0);

  const novye = ctx.kandidaty.filter((k) => vDen(k.created_at));

  const zapisano = ctx.kandidaty.filter((k) => k.sobesedovanie
    && vDen(k.sobesedovanie.zapisano_v || k.created_at));
  const naDen = ctx.kandidaty.filter((k) => k.sobesedovanie && vDen(k.sobesedovanie.start));

  const otk = ctx.otkazy.filter((o) => vDen(o.soobshcheno));
  const zakrytye = otk.filter((o) => o.status === 'zakryta');

  const progony = ctx.evv.filter((r) => vDen(r.zagruzheno)).map(svodkaProgona);

  return {
    data,
    zvonki: {
      vsego: zv.length,
      minut: Math.round(sekund / 60),
      po_yazykam: podschet(zv, (z) => z.yazyk),
      po_liniyam: podschet(zv, (z) => z.liniya),
      po_namereniyam: podschet(zv, (z) => z.namerenie),
      po_itogam: podschet(zv, (z) => z.itog),
    },
    kandidaty: {
      novyh: novye.length,
      podhodyat: novye.filter((k) => k.podhodit === true).length,
      ne_podhodyat: novye.filter((k) => k.podhodit === false).length,
      po_yazykam: podschet(novye, (k) => k.yazyk),
    },
    sobesedovaniya: {
      zapisano: zapisano.length,
      naznacheno: naDen.length,
      prishli: naDen.filter((k) => k.status === 'attended').length,
      ne_prishli: naDen.filter((k) => k.status === 'no_show').length,
    },
    otkazy: {
      vsego: otk.length,
      zakryto: zakrytye.length,
      eskalaciya: otk.filter((o) => o.status === 'eskalaciya').length,
      ne_zakryto: otk.filter((o) => o.status === 'ne_zakryta').length,
      v_rabote: otk.filter((o) => o.status === 'v_rabote').length,
      mediana_min: mediana(zakrytye.map((o) => o.zakryta_za_min).filter((x) => x !== null)),
    },
    evv: {
      progonov: progony.length,
      strok: progony.reduce((s, r) => s + r.strok, 0),
      isklyucheniy: progony.reduce((s, r) => s + r.isklyucheniy, 0),
      kritichnyh: progony.reduce((s, r) => s + r.kritichnyh, 0),
    },
  };
}

// ---------- воронка ----------

const ZAPISAN = new Set(['booked', 'reminded', 'attended', 'no_show']);

function sobratVoronku(s, po, ctx) {
  const vOkne = ctx.kandidaty.filter((k) => {
    const d = mestnayaData(k.created_at, ctx.poyas);
    return d && d >= s && d <= po;
  });
  const ne = vOkne.filter((k) => k.podhodit === false);
  const prichiny = podschet(ne, (k) => k.prichina_otkaza || 'drugoe');
  return {
    s,
    po,
    dney: Math.round((Date.parse(po) - Date.parse(s)) / 86400000) + 1,
    etapy: [
      { kod: 'new', n: vOkne.length },
      { kod: 'booked', n: vOkne.filter((k) => k.sobesedovanie || ZAPISAN.has(k.status)).length },
      { kod: 'attended', n: vOkne.filter((k) => k.status === 'attended').length },
    ],
    statusy: podschet(vOkne, (k) => k.status),
    otkazy_po_prichinam: Object.entries(prichiny)
      .map(([kod, n]) => ({ kod, tekst: PRICHINY_OTKAZA[kod] || kod, n }))
      .sort((a, b) => b.n - a.n || a.kod.localeCompare(b.kod)),
  };
}

// ---------- главный сборщик ----------

function sobratSnimok(vhod) {
  const v = vhod || {};
  const klient = v.klient || {};
  const poyas = klient.poyas || 'America/New_York';
  const seychas = kDate(v.seychas) || new Date();
  const okna = { voronka_dney: 30, otkazy_dney: 7, kandidaty_dney: 14, zvonki_dney: 7, ...(v.okna || {}) };
  const limity = {
    kandidaty: 60, zvonki: 100, soglasiya: 100, otkazy: 50, sobesedovaniya: 20, progony: 10, ...(v.limity || {}),
  };
  const z = v.zapisi || {};
  const doSeychas = (t) => {
    const d = kDate(t);
    return !!d && d <= seychas;
  };

  const segodnya = mestnayaData(seychas, poyas);
  const vchera = sdvigDaty(segodnya, -1);
  const sDaty = (dney) => sdvigDaty(segodnya, -(dney - 1));

  const ctx = {
    poyas,
    seychas,
    sidelki: poId(z.sidelki),
    klienty: poId(z.klienty),
    smeny: poId(z.smeny),
    kandidaty: (z.kandidaty || []).filter((k) => doSeychas(k.created_at)),
    zvonki: (z.zvonki || []).filter((x) => doSeychas(x.nachalo)),
    evv: (z.evv || []).filter((r) => doSeychas(r.zagruzheno)).sort(poUbyvaniyu('zagruzheno')),
    otkazy: [],
  };
  ctx.otkazy = (z.otkazy || [])
    .filter((o) => doSeychas(o.soobshcheno))
    .map((o) => obogatitOtkaz(o, ctx))
    .sort(poUbyvaniyu('soobshcheno'));

  const mestnaya = (t) => mestnayaData(t, poyas);

  // кандидаты за последние N дней
  const sKand = sDaty(okna.kandidaty_dney);
  const kandidaty = ctx.kandidaty
    .filter((k) => mestnaya(k.created_at) >= sKand)
    .sort(poUbyvaniyu('created_at'))
    .slice(0, limity.kandidaty);

  // собеседования с сегодняшнего дня и дальше
  const sobesedovaniya = ctx.kandidaty
    .filter((k) => k.sobesedovanie && k.sobesedovanie.start && mestnaya(k.sobesedovanie.start) >= segodnya)
    .map((k) => ({
      kandidat_id: k.id,
      imya: k.imya || null,
      telefon: k.telefon || null,
      yazyk: k.yazyk || null,
      sertifikat: k.sertifikat || null,
      start: k.sobesedovanie.start,
      end: k.sobesedovanie.end || null,
      status: k.status || null,
    }))
    .sort((a, b) => kDate(a.start) - kDate(b.start))
    .slice(0, limity.sobesedovaniya);

  // лента отказов за N дней
  const sOtk = sDaty(okna.otkazy_dney);
  const otkazy = ctx.otkazy.filter((o) => mestnaya(o.soobshcheno) >= sOtk).slice(0, limity.otkazy);

  // EVV
  const posledniy = ctx.evv[0] || null;
  const evv = {
    posledniy: posledniy ? {
      run_id: posledniy.run_id,
      zagruzheno: posledniy.zagruzheno,
      shtat: posledniy.shtat || null,
      strok: posledniy.strok || 0,
      fayl: posledniy.fayl || null,
      isklyucheniya: posledniy.isklyucheniya || [],
    } : null,
    progony: ctx.evv.slice(0, limity.progony).map(svodkaProgona),
  };

  // журнал согласий; kto — кто это, если номер известен
  const ktoPoTelefonu = new Map();
  for (const s of z.sidelki || []) if (s.telefon) ktoPoTelefonu.set(s.telefon, { tip: 'sidelka', imya: s.imya || null });
  for (const k of ctx.kandidaty) if (k.telefon && !ktoPoTelefonu.has(k.telefon)) ktoPoTelefonu.set(k.telefon, { tip: 'kandidat', imya: k.imya || null });
  const soglasiya = (z.soglasiya || [])
    .filter((s) => doSeychas(s.at))
    .sort(poUbyvaniyu('at'))
    .slice(0, limity.soglasiya)
    .map((s) => ({ ...s, kto: ktoPoTelefonu.get(s.telefon) || null }));

  // звонки за N дней
  const sZv = sDaty(okna.zvonki_dney);
  const zvonki = ctx.zvonki
    .filter((x) => mestnaya(x.nachalo) >= sZv)
    .sort(poUbyvaniyu('nachalo'))
    .slice(0, limity.zvonki);

  return {
    ok: true,
    versiya: VERSIYA,
    demo: !!klient.demo,
    sformirovano: isoMestnoe(seychas, poyas),
    klient: {
      id: klient.id || null,
      nazvanie: klient.nazvanie || null,
      shtat: klient.shtat || null,
      poyas,
      yazyki: klient.yazyki || [],
      opisanie: klient.opisanie || null,
    },
    nastroyki_zameny: klient.zamena || null,
    segodnya: sobratDen(segodnya, ctx),
    vchera: sobratDen(vchera, ctx),
    voronka: sobratVoronku(sDaty(okna.voronka_dney), segodnya, ctx),
    kandidaty,
    sobesedovaniya,
    otkazy,
    evv,
    soglasiya,
    zvonki,
  };
}

module.exports = {
  VERSIYA,
  PRICHINY_OTKAZA,
  sobratSnimok,
  statusOtkaza,
  kritichno,
  mestnayaData,
  isoMestnoe,
  sdvigDaty,
};
