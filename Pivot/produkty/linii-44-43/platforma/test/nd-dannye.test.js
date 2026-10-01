'use strict';
// №43 NightDesk — данные: лист правды harborrow, тела инструментов, сценарии, демо-жильцы, настройки стенда.
// Запуск: node --test test/nd-dannye.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../lib/nightdesk/sortirovka.js');

const ND = path.join(__dirname, '..', '..', 'nightdesk');
const chitat = (p) => JSON.parse(fs.readFileSync(path.join(ND, p), 'utf8'));
const L = chitat('list-pravdy/harborrow.json');
const SH = chitat('fair-housing/shablony.json');
const SC = chitat('scenarii/scenarii.json');
const ZH = chitat('demo-dannye/zhiltsy.json').zhiltsy;
const DEMO_TEL = /^\+1\d{3}5550(1\d\d)$/;
const vseTelefony = (o) => [...new Set((JSON.stringify(o).match(/\+1\d{10}/g) || []))];

test('лист правды: 3 дома, 180 квартир, 6 объявлений, у каждого объявления — свой дом', () => {
  assert.equal(L.doma.length, 3);
  assert.equal(L.doma.reduce((s, d) => s + d.kvartir, 0), 180);
  assert.equal(L.obyavleniya.length, 6);
  const doma = new Set(L.doma.map((d) => d.id));
  const nuzhno = ['id', 'dom', 'kvartira', 'spalen', 'vannyh', 'arenda_usd', 'arenda_vsluh_en', 'arenda_vsluh_es', 'svobodna_s',
    'svobodna_vsluh_en', 'svobodna_vsluh_es', 'zhivotnye', 'parkovka', 'kommunalnye', 'sbory', 'zalog_usd', 'vauchery', 'osobennosti',
    'ssylka_obyavleniya', 'ssylka_zayavki', 'ssylka_pokaza'];
  for (const o of L.obyavleniya) {
    for (const k of nuzhno) assert.ok(o[k] !== undefined && o[k] !== '', `${o.id}: нет ${k}`);
    assert.ok(doma.has(o.dom), o.id);
    assert.match(o.svobodna_s, /^\d{4}-\d{2}-\d{2}$/);
    for (const pole of ['zhivotnye', 'parkovka', 'kommunalnye', 'sbory', 'vauchery', 'osobennosti']) {
      assert.ok(o[pole].en && o[pole].es, `${o.id}.${pole}: нужны en и es`);
    }
  }
  assert.equal(new Set(L.obyavleniya.map((o) => o.id)).size, 6);
});

test('только вымышленное: все телефоны 555-01xx, все люди и компании помечены DEMO, адреса — DEMO', () => {
  for (const f of ['list-pravdy/harborrow.json', 'demo-dannye/zhiltsy.json', 'scenarii/scenarii.json', 'nastroyki/harborrow.nastroyki.json']) {
    for (const t of vseTelefony(chitat(f))) assert.match(t, DEMO_TEL, `${f}: ${t}`);
  }
  const lyudi = [L.kompaniya.lyudi.upravlyayushchiy, L.kompaniya.lyudi.lizing, L.kompaniya.lyudi.dezhurnyy_tehnik,
    ...L.doma.map((d) => d.super), ...L.dezhurnye.cepochka, ...L.podryadchiki, ...ZH];
  for (const x of lyudi) assert.match(x.imya, /\(DEMO\)$/, x.imya);
  for (const d of L.doma) assert.match(d.adres, /\(DEMO\)$/);
  assert.match(L.kompaniya.nazvanie, /\(DEMO\)/);
  assert.ok(!/@(?!harborrow-demo\.example)[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(L).replace(/https?:\/\/[^"]+/g, '')), 'почта только на .example');
  for (const u of JSON.stringify(L).match(/https:\/\/harborrow[^"]+/g) || []) assert.match(u, /^https:\/\/harborrow-demo\.example\//);
});

test('Fair Chance Housing: в объявлениях и опубликованных критериях ни слова о судимости', () => {
  const teksty = JSON.stringify([L.obyavleniya, L.kriterii_arendy.punkty]).toLowerCase();
  for (const slovo of ['criminal', 'arrest', 'conviction', 'felony', 'misdemeanor', 'record check', 'penales', 'criminales', 'arresto', 'condena']) {
    assert.ok(!teksty.includes(slovo), `«${slovo}» в объявлениях или критериях`);
  }
});

test('сборы по закону: заявка ≤ $20 (или свой отчёт за 30 дней), залог = одна месячная плата, без комиссии брокера', () => {
  const K = L.kriterii_arendy;
  assert.equal(K.sbor_zayavki_max_usd, 20);
  assert.equal(K.svoy_otchet_dney, 30);
  assert.equal(K.zalog_mesyacev, 1);
  for (const o of L.obyavleniya) {
    assert.equal(o.zalog_usd, o.arenda_usd, `${o.id}: залог больше месяца`);
    assert.ok(o.sbory.en.includes('up to twenty dollars') && o.sbory.en.includes('no broker fee'), o.id);
    assert.ok(o.sbory.es.includes('hasta veinte dólares') && o.sbory.es.includes('No hay comisión de corredor'), o.id);
  }
  const dohod = K.punkty.find((p) => p.kod === 'dohod');
  assert.ok(dohod.en.includes('forty times') && dohod.en.includes("doesn't apply to applicants whose share of the rent is set by a voucher"));
  assert.ok(dohod.en.includes('not asked for a guarantor'), 'держателей ваучеров не просим о поручителе (CCHR)');
  assert.ok(K.punkty.find((p) => p.kod === 'kredit').en.includes('no minimum credit score'));
});

test('ответ про ваучеры — одна строка во всех местах листа и в шаблоне', () => {
  const en = SH.shablony.vauchery.en;
  const vsego = JSON.stringify(L).split(en).length - 1;
  assert.ok(vsego >= 8, `английская строка встречается ${vsego} раз`);
  for (const o of L.obyavleniya) assert.equal(o.vauchery.en, en);
  assert.ok(!/(?:don't|do not|doesn't|no)\s+(?:accept|take)\s+(?:section 8|vouchers?)/i.test(JSON.stringify(L)));
});

test('список аварий: коды есть в движке, инструкции для всех кодов на en и es, правило тепла = HPD', () => {
  assert.deepEqual(S.proveritSpisok(L.avarii), []);
  const vseKody = [...L.avarii.ugroza_zhizni, ...L.avarii.avaria, ...L.avarii.ne_srochno];
  assert.deepEqual(new Set(vseKody), new Set(Object.keys(S.KATEGORII)), 'список управляющего покрывает все категории движка');
  const nuzhnyInstr = new Set(['911', 'avtomat', 'net_sveta_ulica']);
  for (const k of Object.values(S.KATEGORII)) if (k.instrukciya) nuzhnyInstr.add(k.instrukciya);
  for (const kod of nuzhnyInstr) {
    assert.ok(L.instrukcii[kod] && L.instrukcii[kod].en && L.instrukcii[kod].es, `нет инструкции ${kod}`);
  }
  for (const [kod, v] of Object.entries(L.instrukcii)) {
    if (kod.startsWith('_')) continue;
    for (const y of ['en', 'es']) {
      if (/\{gde_voda\}/.test(v[y])) assert.equal(kod, 'voda');
      if (/\{gde_shchit\}/.test(v[y])) assert.equal(kod, 'avtomat');
      if (S.UGROZA_VSEGDA.includes(kod) || kod === '911') assert.ok(/nine-one-one|nueve uno uno/.test(v[y]), `${kod}/${y} без 911`);
    }
  }
  const t = L.avarii.teplo_nyc;
  assert.deepEqual(t.sezon_mesyacy, [...S.TEPLO_NYC.sezon_mesyacy]);
  assert.equal(t.den.snaruzhi_nizhe_f, 55);
  assert.equal(t.den.vnutri_ne_menee_f, 68);
  assert.equal(t.noch.vnutri_ne_menee_f, 62);
  assert.equal(t.goryachaya_voda_ne_menee_f, 120);
  assert.equal(t.den.s_chasa, 6);
  assert.equal(t.den.do_chasa, 22);
  for (const d of L.doma) for (const y of ['en', 'es']) assert.ok(d.gde_voda[y] && d.gde_shchit[y], `${d.id}/${y}`);
});

test('источники: у каждого ссылка и дата проверки', () => {
  assert.ok(L._meta.istochniki.length >= 10);
  for (const s of L._meta.istochniki) {
    assert.match(s.url, /^https:\/\//, s.kod);
    assert.equal(s.provereno, '2026-09-30', s.kod);
  }
  assert.ok(L._meta.istochniki.some((s) => s.url.includes('heat-and-hot-water-information')));
});

test('цепочка дежурных и подрядчики: подрядчик на каждую аварию из списка (кроме угроз жизни)', () => {
  assert.equal(L.dezhurnye.cepochka.length, 2);
  assert.equal(L.dezhurnye.zhdat_s, 20, 'как план Б 28.09');
  for (const k of L.avarii.avaria) {
    assert.ok(S.podryadchikDlya(k, L.podryadchiki), `нет подрядчика для ${k}`);
  }
});

test('инструменты: 8 тел, имена *_nightdesk_demo, адрес стенда, required ⊆ properties, системные поля — dynamic_variable', () => {
  const fayly = fs.readdirSync(path.join(ND, 'instrumenty')).filter((f) => f.endsWith('.json'));
  assert.equal(fayly.length, 8);
  const ozhidaem = {
    'nayti_zhilca.json': 'nd-zhilec', 'sortirovka.json': 'nd-sortirovka', 'perevod.json': 'nd-perevod', 'sozdat_zayavku.json': 'nd-zayavka',
    'svobodnye_okna.json': 'okna', 'zapisat_pokaz.json': 'zapis', 'sohranit_lida.json': 'nd-lid', 'otpravit_ssylku.json': 'nd-ssylka',
  };
  const SYS = { caller_id: 'system__caller_id', conversation_id: 'system__conversation_id', agent_id: 'system__current_agent_id', call_sid: 'system__call_sid' };
  for (const f of fayly) {
    const t = chitat(`instrumenty/${f}`).tool_config;
    assert.match(t.name, /^[a-z_]+_nightdesk_demo$/, f);
    assert.equal(t.type, 'webhook');
    assert.equal(t.api_schema.url, `https://linii-demo-85fof.netlify.app/.netlify/functions/${ozhidaem[f]}`, f);
    assert.equal(t.api_schema.method, 'POST');
    assert.ok(t.api_schema.request_headers['x-liniya-klyuch'].secret_id, f);
    const sh = t.api_schema.request_body_schema;
    for (const r of sh.required) assert.ok(sh.properties[r], `${f}: ${r}`);
    for (const [k, v] of Object.entries(sh.properties)) {
      if (SYS[k]) assert.equal(v.dynamic_variable, SYS[k], `${f}: ${k}`);
      else assert.ok(v.description && v.description.length > 3, `${f}: ${k} без описания`);
    }
    assert.ok(t.description.length > 80, f);
  }
  const s = chitat('instrumenty/sortirovka.json').tool_config.api_schema.request_body_schema.properties;
  assert.deepEqual(new Set(s.kategoriya.enum), new Set(Object.keys(S.KATEGORII)));
  assert.deepEqual(new Set(s.dom.enum), new Set([...L.doma.map((d) => d.id), 'ne_znayu']));
  const ok = chitat('instrumenty/svobodnye_okna.json').tool_config.api_schema.request_body_schema.properties;
  assert.deepEqual(new Set(ok.obyavlenie_id.enum), new Set(L.obyavleniya.map((o) => o.id)));
  const lid = chitat('instrumenty/sohranit_lida.json').tool_config.api_schema.request_body_schema.properties;
  for (const zapret of ['dohod', 'deti', 'vaucher', 'vozrast', 'sudimost', 'invalidnost', 'semya', 'rabota']) assert.ok(!lid[zapret], `в карточке лида поле ${zapret}`);
  assert.equal(chitat('instrumenty/perevod.json').tool_config.pre_tool_speech, 'off', 'перевод без объявления — фразу говорит телефония');
  const ves = fayly.map((f) => fs.readFileSync(path.join(ND, 'instrumenty', f), 'utf8')).join('\n');
  assert.ok(!/sk_[a-z0-9]{20,}|AC[0-9a-f]{32}|re_[A-Za-z0-9]{20,}/.test(ves), 'в телах инструментов не должно быть ключей');
});

test('сценарии: 50 штук nd-01…nd-50, поле kritichnyy, линии и языки, прогон готов; 30 вопросов вне листа', () => {
  const s = SC.scenarii;
  assert.equal(s.length, 50);
  assert.deepEqual(s.map((x) => x.id), Array.from({ length: 50 }, (_, i) => `nd-${String(i + 1).padStart(2, '0')}`));
  for (const x of s) {
    assert.equal(typeof x.kritichnyy, 'boolean', x.id);
    assert.ok(['after-hours', 'leasing'].includes(x.liniya), x.id);
    assert.ok(['en', 'es'].includes(x.yazyk), x.id);
    for (const k of ['gruppa', 'chto_govorit', 'chto_proveryaem', 'ukazaniya']) assert.ok(x[k], `${x.id}: ${k}`);
    assert.ok(x.progon.persona.length > 80 && x.progon.vremya && x.progon.caller_id && x.progon.proverki.length && x.progon.kriterii.length, x.id);
    assert.match(x.progon.caller_id, DEMO_TEL, x.id);
  }
  assert.equal(SC._meta.vsego, 50);
  assert.equal(SC._meta.kritichnyh, s.filter((x) => x.kritichnyy).length);
  assert.ok(s.filter((x) => x.yazyk === 'es').length >= 6);
  assert.ok(s.filter((x) => x.liniya === 'leasing').length >= 10);
  assert.equal(SC.voprosy_vne_lista.voprosy.length, 30);
  assert.equal(new Set(SC.voprosy_vne_lista.voprosy).size, 30);
  const zayavki = s.filter((x) => x.ozhidaemo.zayavka);
  assert.ok(zayavki.length >= 6);
  for (const x of zayavki) {
    const z = x.ozhidaemo.zayavka;
    for (const k of ['dom', 'kvartira', 'dostup', 'imya', 'telefon']) assert.ok(z[k], `${x.id}: в ожидаемой заявке нет ${k}`);
  }
});

test('демо-жильцы: уникальные номера, дома из листа, никаких лишних полей о человеке', () => {
  const doma = new Set(L.doma.map((d) => d.id));
  const nomera = ZH.flatMap((z) => z.telefony);
  assert.equal(new Set(nomera).size, nomera.length);
  for (const z of ZH) {
    assert.ok(doma.has(z.dom), z.id);
    assert.deepEqual(Object.keys(z).sort(), ['aktiven', 'dom', 'id', 'imya', 'kvartira', 'sms_soglasie', 'telefony', 'yazyk'].sort(), z.id);
  }
  for (const x of SC.scenarii.filter((y) => y.liniya === 'after-hours' && y.progon.moki.zhilec === 'nayden')) {
    assert.ok(nomera.includes(x.progon.caller_id), `${x.id}: звонит не жилец из демо-данных`);
  }
});

test('настройки стенда собраны из листа и свежие (node nightdesk/nastroyki/sobrat.js)', () => {
  const { sobrat } = require(path.join(ND, 'nastroyki', 'sobrat.js'));
  const { nastroyki, linii } = sobrat();
  assert.deepEqual(chitat('nastroyki/harborrow.nastroyki.json'), nastroyki, 'harborrow.nastroyki.json устарел — перезапусти sobrat.js');
  assert.deepEqual(chitat('nastroyki/linii.chernovik.json'), linii, 'linii.chernovik.json устарел');
  const h = nastroyki.harborrow;
  assert.deepEqual(h.nightdesk.avarii, L.avarii);
  assert.deepEqual(h.perevod.chasy, { chas_ot: 9, chas_do: 17, dni: [1, 2, 3, 4, 5] });
  assert.deepEqual(h.kalendari.pokaz.dni, [1, 2, 3, 4, 5]);
  assert.equal(h.kalendari.pokaz.chas_ot, 10);
  assert.equal(h.kalendari.pokaz.chas_do, 17);
  assert.ok(h.nightdesk.fair_housing_odobrennye.includes(SH.shablony.vauchery.en));
  for (const l of Object.values(linii).filter((x) => x && x.liniya)) {
    assert.equal(l.klient, 'harborrow');
    assert.equal(l.klyuch_env, 'NIGHTDESK_DEMO_LINIYA_KLYUCH');
  }
  assert.ok(!JSON.stringify(nastroyki).match(/sk_|whsec|AC[0-9a-f]{32}/), 'секретов в настройках нет');
});
