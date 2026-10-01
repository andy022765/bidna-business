'use strict';
// Сборка настроек стенда для клиента harborrow (№43 NightDesk) из листа правды и шаблонов fair housing.
//
//   node nightdesk/nastroyki/sobrat.js          → пишет harborrow.nastroyki.json и linii.chernovik.json рядом
//   require('./sobrat').sobrat()                → {nastroyki, linii} без записи (тест сверяет свежесть файлов)
//
// ЗАЧЕМ. Стенд читает настройки клиентов из platforma/nastroyki.json и карту номеров из platforma/linii.json
// (esbuild кладёт их в бандл). Это файлы сборщика стенда — сюда мы их не пишем. Здесь — готовый блок «harborrow»
// и черновик двух линий: сборщик стенда вливает их как есть (KONTRAKT-ND.md, «Что сделать стенду»).
// Один источник правды: лист nightdesk/list-pravdy/harborrow.json. Поменял лист — перезапусти сборку;
// test/nd-dannye.test.js падает, если файлы устарели.

const fs = require('fs');
const path = require('path');

const ND = path.join(__dirname, '..');
const chitat = (p) => JSON.parse(fs.readFileSync(path.join(ND, p), 'utf8'));
const bezPrim = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));
const DNI = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const chas = (hhmm) => Number(String(hhmm).split(':')[0]);

function sobrat() {
  const L = chitat('list-pravdy/harborrow.json');
  const SH = chitat('fair-housing/shablony.json');
  const k = L.kompaniya;

  const odobrennye = [];
  for (const v of Object.values(SH.shablony)) odobrennye.push(v.en, v.es);
  for (const p of L.kriterii_arendy.punkty) odobrennye.push(p.en, p.es);

  const chasyOfisa = { chas_ot: chas(k.ofis.chasy.s), chas_do: chas(k.ofis.chasy.do), dni: k.ofis.chasy.dni.map((d) => DNI[d]) };
  const pokaz = L.pokazy.s_agentom;

  const harborrow = {
    _prim: 'СОБРАНО nightdesk/nastroyki/sobrat.js из nightdesk/list-pravdy/harborrow.json — руками не править. Без секретов. null/пусто = решения Андрея нет (номера реальных дежурных, отправитель писем, адресаты сводки). Блок nightdesk читают функции nd-* (KONTRAKT-ND.md).',
    nazvanie: k.nazvanie,
    opisanie: `${L.doma.length} buildings, ${L.doma.reduce((s, d) => s + d.kvartir, 0)} apartments, Brooklyn, NY`,
    demo: true,
    shtat: 'NY',
    poyas: k.chasovoy_poyas,
    yazyk_vladelca: 'en',
    yazyki: k.yazyki_linii_ii,
    kalendari: {
      pokaz: {
        kalendar: '',
        zanyatost: [],
        chas_ot: chas(pokaz.s),
        chas_do: chas(pokaz.do),
        dni: pokaz.dni.map((d) => DNI[d]),
        dlina_min: pokaz.dlina_min,
        zapas_min: 0,
        ne_ranshe_chasov: 2,
        vpered_dney: 10,
        okon_v_otvete: 3,
        po_obyavleniyu: true,
      },
    },
    perevod: {
      _prim: 'Часы офиса: линия лизинга в часы офиса переводит на cepochka (агент по аренде → ресепшн). Ночная линия зовёт людей через nd-perevod по цепочке nightdesk.dezhurnye.',
      chasy: chasyOfisa,
      cepochka: L.ofis_perevod.cepochka_lizinga,
      imya: { en: 'our leasing office', es: 'nuestra oficina de alquiler' },
      zhdat_s: L.dezhurnye.zhdat_s,
      zvuk: {},
    },
    dezhurnye: {
      cepochka: L.dezhurnye.cepochka.map((d) => d.telefon),
      zhdat_s: L.dezhurnye.zhdat_s,
    },
    pisma: { ot: null, otvet: null, upravlyayushchemu: [], lizingu: [], svodka_komu: [] },
    sms: { ot: null },
    limity: { pisem_v_sutki: 60, sms_v_sutki: 200, zvonkov_v_sutki: 60, zayavok_v_sutki: 100 },
    svodka: { vklyuchena: true, chas: 7 },
    pult_klyuch_env: 'PULT_KLYUCH_HARBORROW',
    rezerv_nomer: null,
    nightdesk: {
      avarii: L.avarii,
      instrukcii: bezPrim(L.instrukcii),
      doma: L.doma.map((d) => ({
        id: d.id, nazvanie: d.nazvanie, adres: d.adres, adres_vsluh_en: d.adres_vsluh_en, adres_vsluh_es: d.adres_vsluh_es,
        lift: d.lift, gde_voda: d.gde_voda, gde_shchit: d.gde_shchit,
      })),
      dezhurnye: { cepochka: L.dezhurnye.cepochka.map((d) => ({ rol: d.rol, imya: d.imya, telefon: d.telefon })) },
      ofis_perevod: { cepochka_avarii: L.ofis_perevod.cepochka_avarii, cepochka_lizinga: L.ofis_perevod.cepochka_lizinga },
      podryadchiki: L.podryadchiki,
      eskalaciya: { zhdat_s: L.dezhurnye.zhdat_s, povtor_min: L.dezhurnye.povtor_min, krugov: L.dezhurnye.krugov },
      obeshchanie_perezvona: { en: L.dezhurnye.obeshchanie_perezvona_en, es: L.dezhurnye.obeshchanie_perezvona_es },
      zayavki: { prefiks: 'HR', obyazatelnye_polya: L.zayavki.obyazatelnye_polya, chto_dalshe: { en: L.zayavki.chto_dalshe_en, es: L.zayavki.chto_dalshe_es } },
      obyavleniya: L.obyavleniya.map((o) => ({
        id: o.id, dom: o.dom, kvartira: o.kvartira, samostoyatelnyy_pokaz: o.samostoyatelnyy_pokaz,
        ssylka_obyavleniya: o.ssylka_obyavleniya, ssylka_zayavki: o.ssylka_zayavki, ssylka_pokaza: o.ssylka_pokaza,
      })),
      kriterii_ssylka: L.kriterii_arendy.ssylka,
      kompaniya_vsluh: k.korotko_vsluh,
      fair_housing_odobrennye: odobrennye,
    },
  };

  const linii = {
    _prim: 'ЧЕРНОВИК для platforma/linii.json (вливает сборщик стенда). Номеров NightDesk ещё нет — ключи DEMO-3/DEMO-4; agent_id появятся после создания агентов (не создавались). Секрет один на обе линии клиента: NIGHTDESK_DEMO_LINIYA_KLYUCH.',
    'DEMO-3': {
      liniya: 'nd-after-hours', klient: 'harborrow', agent_id: null, yazyk: 'en',
      nazvanie: 'NightDesk DEMO — Harbor Row Property Management (DEMO), resident line',
      klyuch_env: 'NIGHTDESK_DEMO_LINIYA_KLYUCH', perevod_vne_chasov: true, demo: true,
    },
    'DEMO-4': {
      liniya: 'nd-leasing', klient: 'harborrow', agent_id: null, yazyk: 'en',
      nazvanie: 'NightDesk DEMO — Harbor Row Property Management (DEMO), leasing line',
      klyuch_env: 'NIGHTDESK_DEMO_LINIYA_KLYUCH', demo: true,
    },
  };
  return { nastroyki: { harborrow }, linii };
}

if (require.main === module) {
  const { nastroyki, linii } = sobrat();
  fs.writeFileSync(path.join(__dirname, 'harborrow.nastroyki.json'), JSON.stringify(nastroyki, null, 2) + '\n');
  fs.writeFileSync(path.join(__dirname, 'linii.chernovik.json'), JSON.stringify(linii, null, 2) + '\n');
  console.log('записано: harborrow.nastroyki.json, linii.chernovik.json');
}

module.exports = { sobrat };
