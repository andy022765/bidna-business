'use strict';
// №43 NightDesk, Б1 — движок lib/nightdesk/sortirovka.js: сортировка, правила отопления NYC, цепочка эскалации
// с ширмой «нажмите 1» (4 исхода плана Б 28.09), TwiML, заявка на ремонт и сверка с 50 сценариями.
// Запуск: node --test test/nd-sortirovka.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../lib/nightdesk/sortirovka.js');

const ND = path.join(__dirname, '..', '..', 'nightdesk');
const chitat = (p) => JSON.parse(fs.readFileSync(path.join(ND, p), 'utf8'));
const L = chitat('list-pravdy/harborrow.json');
const NAST = chitat('nastroyki/harborrow.nastroyki.json').harborrow.nightdesk;
const SC = chitat('scenarii/scenarii.json').scenarii;
const SP = L.avarii;
const NOCH = '2026-10-07T02:10:00-04:00';
const dom = (id) => L.doma.find((d) => d.id === id);
const sort = (o, moment = NOCH, spisok = SP) => S.sortirovat(o, spisok, { moment });

// ── сортировка ───────────────────────────────────────────────────────────
test('угроза жизни: 8 категорий → 911, сигнал, без вопросов и без перевода', () => {
  for (const k of S.UGROZA_VSEGDA) {
    const v = sort({ kategoriya: k });
    assert.equal(v.uroven, 'ugroza_zhizni', k);
    assert.equal(v.zvonit_911, true, k);
    assert.equal(v.signal, true, k);
    assert.equal(v.perevod, false, k);
    assert.equal(v.dalshe, '911', k);
    assert.equal(v.sprosit, null, k);
    assert.ok(v.instrukciya, k);
  }
});

test('признак опасности поднимает любую категорию до угрозы жизни', () => {
  const sl = [
    [{ kategoriya: 'bytovaya_tehnika', zapah_gaza: 'da' }, 'zapah_gaza', 'gaz'],
    [{ kategoriya: 'santehnika', dym_ili_ogon: 'yes' }, 'dym_ili_ogon', 'ogon_dym'],
    [{ kategoriya: 'detektor_batareyka', co_signal: 'trevoga' }, 'co_trevoga', 'ugarnyy_gaz'],
    [{ kategoriya: 'net_tepla', lyudi_v_opasnosti: true }, 'lyudi_v_opasnosti', '911'],
    [{ kategoriya: 'voda_protechka', voda_u_elektriki: 'da' }, 'voda_i_elektrichestvo', 'elektrichestvo_opasno'],
    [{ kategoriya: 'lift_ne_rabotaet', lyudi_v_opasnosti: 'net', v_lifte_lyudi: 'sí' }, 'lyudi_v_lifte', 'lift_zastryali'],
  ];
  for (const [vhod, prichina, instr] of sl) {
    const v = sort(vhod);
    assert.equal(v.uroven, 'ugroza_zhizni', JSON.stringify(vhod));
    assert.equal(v.prichina, prichina);
    assert.equal(v.instrukciya, instr);
  }
});

test('угрозу жизни список управляющего убрать не может (и proveritSpisok это ловит)', () => {
  const plohoy = { ugroza_zhizni: ['ogon_dym'], avaria: ['voda_protechka'], ne_srochno: ['gaz', 'nesushchestvuet'] };
  assert.equal(sort({ kategoriya: 'gaz' }, NOCH, plohoy).uroven, 'ugroza_zhizni');
  const osh = S.proveritSpisok(plohoy);
  assert.ok(osh.some((x) => x.includes('gaz')), osh.join('; '));
  assert.ok(osh.some((x) => x.includes('nesushchestvuet')));
  assert.deepEqual(S.proveritSpisok(SP), [], 'список Harbor Row без ошибок');
});

test('★ вопрос о людях — первым для аварий из списка и «другого»; для мелочей не задаётся', () => {
  for (const k of SP.avaria) {
    const v = sort({ kategoriya: k });
    assert.equal(v.dalshe, 'SPROSIT', k);
    assert.equal(v.sprosit.pole, 'lyudi_v_opasnosti', k);
  }
  assert.equal(sort({ kategoriya: 'drugoe' }).sprosit.pole, 'lyudi_v_opasnosti');
  for (const k of ['santehnika', 'vrediteli', 'plesen', 'domofon', 'okno']) {
    const v = sort({ kategoriya: k });
    assert.equal(v.uroven, 'ne_srochno', k);
    assert.equal(v.dalshe, 'ZAYAVKA', k);
  }
});

test('течь: идёт → авария; остановлена → заявка; провис потолка → авария; «не знаю» → худший случай', () => {
  const b = { kategoriya: 'voda_protechka', lyudi_v_opasnosti: 'net', voda_u_elektriki: 'net' };
  assert.equal(sort(b).sprosit.pole, 'voda_aktivno');
  assert.equal(sort({ ...b, voda_aktivno: 'da' }).uroven, 'avaria');
  assert.equal(sort({ ...b, voda_aktivno: 'net' }).uroven, 'ne_srochno');
  assert.equal(sort({ ...b, voda_aktivno: 'net' }).prichina, 'voda_ostanovlena');
  assert.equal(sort({ ...b, voda_aktivno: 'net', potolok_provis: 'da' }).prichina, 'potolok_provis');
  assert.equal(sort({ ...b, voda_aktivno: 'ne_znayu' }).uroven, 'avaria');
  assert.equal(sort({ ...b, voda_aktivno: 'da' }).podryadchik, 'santehnik');
});

// ── отопление NYC (HPD: 1.10–31.05; 6–22 ч при <55°F снаружи — ≥68°F; 22–6 ч — ≥62°F) ─────────
test('teploNyc: границы сезона, суток, порогов и летнего времени', () => {
  const t = (iso, o = {}) => S.teploNyc(iso, o);
  assert.equal(t('2026-09-30T23:59:00-04:00').v_sezone, false);
  assert.equal(t('2026-10-01T00:00:00-04:00').v_sezone, true);
  assert.equal(t('2027-05-31T23:59:00-04:00').v_sezone, true);
  assert.equal(t('2027-06-01T00:00:00-04:00').v_sezone, false);
  assert.equal(t('2026-10-07T22:00:00-04:00', { vnutri: 63 }).period, 'noch');
  assert.equal(t('2026-10-07T21:59:00-04:00', { vnutri: 63, snaruzhi: 50 }).period, 'den');
  assert.equal(t('2026-10-07T06:00:00-04:00', { vnutri: 63, snaruzhi: 50 }).period, 'den');
  assert.equal(t('2026-10-07T05:59:00-04:00', { vnutri: 63 }).period, 'noch');
  // день: снаружи ровно 55 — требование не действует; 54 — действует
  assert.equal(t('2026-10-07T14:00:00-04:00', { vnutri: 60, snaruzhi: 55 }).narushenie, false);
  assert.equal(t('2026-10-07T14:00:00-04:00', { vnutri: 67.9, snaruzhi: 54 }).narushenie, true);
  assert.equal(t('2026-10-07T14:00:00-04:00', { vnutri: 68, snaruzhi: 54 }).narushenie, false);
  // ночь: 61 — нарушение, 62 — норма, погода не важна
  assert.equal(t('2026-10-07T23:30:00-04:00', { vnutri: 61, snaruzhi: 70 }).narushenie, true);
  assert.equal(t('2026-10-07T23:30:00-04:00', { vnutri: 62 }).narushenie, false);
  // снаружи неизвестно днём — по умолчанию «холодно», можно выключить
  assert.equal(t('2026-10-07T14:00:00-04:00', { vnutri: 66 }).narushenie, true);
  assert.equal(S.teploNyc('2026-10-07T14:00:00-04:00', { vnutri: 66 }, S.TEPLO_NYC, 'America/New_York',
    { snaruzhiNeizvestnoKakHolodno: false }).narushenie, false);
  // после перехода на зимнее время (1.11.2026): 03:30 EST — ночь
  assert.equal(t('2026-11-06T03:30:00-05:00', { vnutri: 61 }).period, 'noch');
  assert.equal(t('2026-11-06T08:30:00Z', { vnutri: 61 }).period, 'noch', '08:30 UTC = 03:30 EST');
});

test('net_tepla: вне сезона — заявка; весь дом — авария; °C пересчитываются; без термометра — по радиаторам', () => {
  const b = { kategoriya: 'net_tepla', lyudi_v_opasnosti: 'net' };
  const vne = sort(b, '2026-09-29T23:40:00-04:00');
  assert.equal(vne.uroven, 'ne_srochno');
  assert.equal(vne.prichina, 'vne_sezona');
  assert.equal(sort(b).sprosit.pole, 'ohvat');
  assert.equal(sort({ ...b, ohvat: 'ves_dom' }).prichina, 'ves_dom');
  assert.equal(sort({ ...b, ohvat: 'kvartira' }).sprosit.pole, 'temperatura_vnutri');
  const c16 = sort({ ...b, ohvat: 'kvartira', temperatura_vnutri: '16' });
  assert.equal(c16.uroven, 'avaria', '16 без единиц = 16°C = 60.8°F < 62');
  assert.ok(c16.preduprezhdeniya.length >= 1);
  assert.equal(sort({ ...b, ohvat: 'kvartira', temperatura_vnutri: '18', edinicy: 'C' }).uroven, 'ne_srochno', '64.4°F ≥ 62');
  assert.equal(sort({ ...b, ohvat: 'kvartira', temperatura_vnutri: '64 degrees' }).prichina, 'teplo_v_norme');
  const bez = { ...b, ohvat: 'kvartira', temperatura_vnutri: 'ne_znayu' };
  assert.equal(sort(bez).sprosit.pole, 'otoplenie_sovsem_net');
  assert.equal(sort({ ...bez, otoplenie_sovsem_net: 'da' }).prichina, 'bez_termometra');
  assert.equal(sort({ ...bez, otoplenie_sovsem_net: 'ne_znayu' }).uroven, 'avaria');
  assert.equal(sort({ ...bez, otoplenie_sovsem_net: 'net' }).uroven, 'ne_srochno');
  const myagkiy = { ...SP, teplo_bez_termometra: 'zayavka' };
  assert.equal(sort({ ...bez, otoplenie_sovsem_net: 'da' }, NOCH, myagkiy).uroven, 'ne_srochno');
  // время звонка забыли передать — не падаем посреди аварии
  const bezMomenta = S.sortirovat({ ...b, ohvat: 'ves_dom' }, SP, {});
  assert.ok(['avaria', 'ne_srochno'].includes(bezMomenta.uroven));
  assert.ok(bezMomenta.preduprezhdeniya.some((x) => x.includes('moment')));
});

test('горячая вода, свет, лифт: условия внутри категорий', () => {
  const hv = { kategoriya: 'net_goryachey_vody', lyudi_v_opasnosti: 'net' };
  assert.equal(sort({ ...hv, ohvat: 'kvartira' }).uroven, 'ne_srochno');
  assert.equal(sort({ ...hv, ohvat: 'neskolko' }).uroven, 'avaria');
  const sv = { kategoriya: 'net_sveta', lyudi_v_opasnosti: 'net' };
  const ul = sort({ ...sv, ohvat: 'ulica' });
  assert.equal(ul.uroven, 'ne_srochno');
  assert.equal(ul.instrukciya, 'net_sveta_ulica');
  assert.equal(ul.sluzhba, 'con_edison');
  const sp = sort({ ...sv, ohvat: 'kvartira' });
  assert.equal(sp.sprosit.pole, 'avtomat_proveren');
  assert.equal(sp.instrukciya, 'avtomat');
  assert.equal(sort({ ...sv, ohvat: 'kvartira', avtomat_proveren: 'da' }).prichina, 'avtomat_proveren');
  assert.equal(sort({ ...sv, ohvat: 'ne_znayu', avtomat_proveren: 'net' }).uroven, 'avaria');
  assert.equal(sort({ ...sv, ohvat: 'ves_dom' }).uroven, 'avaria');
  const lf = { kategoriya: 'lift_ne_rabotaet', lyudi_v_opasnosti: 'net' };
  assert.equal(sort(lf).sprosit.pole, 'v_lifte_lyudi');
  assert.equal(sort({ ...lf, v_lifte_lyudi: 'net' }).prichina, 'lift_pustoy');
  assert.equal(sort({ ...lf, v_lifte_lyudi: 'ne_znayu' }).prichina, 'lift_neizvestno');
});

test('детектор: писк батарейки — заявка, тревога или симптомы — 911', () => {
  assert.equal(sort({ kategoriya: 'ugarnyy_gaz', co_signal: 'batareyka' }).uroven, 'ne_srochno');
  assert.equal(sort({ kategoriya: 'ugarnyy_gaz', co_signal: 'batareyka', lyudi_v_opasnosti: 'da' }).uroven, 'ugroza_zhizni');
  assert.equal(sort({ kategoriya: 'ugarnyy_gaz' }).uroven, 'ugroza_zhizni', 'не уточнили — худший случай');
  assert.equal(sort({ kategoriya: 'detektor_batareyka', co_signal: 'batareyka' }).instrukciya, 'detektor');
});

test('шум, «захлопнулся», неизвестная категория, «жилец настаивает»', () => {
  const sh = sort({ kategoriya: 'shum' });
  assert.equal(sh.dalshe, 'SOOBSHCHENIE');
  assert.equal(sh.zayavka, false);
  const zh = sort({ kategoriya: 'zamok_zahlopnulsya' });
  assert.equal(zh.dalshe, 'INFO');
  assert.equal(zh.instrukciya, 'zahlopnulsya');
  const nz = sort({ kategoriya: 'chto-to-strannoe' });
  assert.equal(nz.kategoriya, 'drugoe');
  assert.ok(nz.preduprezhdeniya.length);
  assert.equal(sort({ kategoriya: 'okno', zhilec_nastaivaet: 'da' }).uroven, 'ne_srochno', 'по умолчанию не будим');
  const v = sort({ kategoriya: 'okno', zhilec_nastaivaet: 'da' }, NOCH, { ...SP, nastaivaet_eskalirovat: true });
  assert.equal(v.uroven, 'avaria');
  assert.equal(v.prichina, 'zhilec_nastaivaet');
});

test('детерминизм: одинаковый вход → одинаковый вердикт; вход не меняется', () => {
  const vhod = { kategoriya: 'net_tepla', lyudi_v_opasnosti: 'net', ohvat: 'kvartira', temperatura_vnutri: '59' };
  const kopiya = JSON.parse(JSON.stringify(vhod));
  const a = sort(vhod);
  const b = sort(vhod);
  assert.deepEqual(a, b);
  assert.deepEqual(vhod, kopiya);
});

test('ответ инструмента: инструкции всех кодов для всех домов на двух языках — без незаполненных {…}', () => {
  const kody = Object.keys(L.instrukcii).filter((k) => !k.startsWith('_'));
  for (const d of L.doma) {
    for (const y of ['en', 'es']) {
      for (const k of kody) {
        const t = S.tekstInstrukcii(k, y, d, L.instrukcii);
        assert.ok(t.length > 20, `${k}/${y}`);
        assert.ok(!/[{}]/.test(t), `${k}/${y}/${d.id}: ${t}`);
      }
    }
  }
  const v = sort({ kategoriya: 'voda_protechka', lyudi_v_opasnosti: 'net', voda_u_elektriki: 'net', voda_aktivno: 'da' });
  const o = S.otvetInstrumenta(v, { yazyk: 'es', dom: dom('seawell'), instrukcii: L.instrukcii });
  assert.equal(o.dalshe, 'PEREVOD');
  assert.ok(o.skazat.includes(dom('seawell').gde_voda.es));
  const sp = S.otvetInstrumenta(sort({ kategoriya: 'net_sveta', lyudi_v_opasnosti: 'net', ohvat: 'kvartira' }),
    { yazyk: 'en', dom: dom('kestrel'), instrukcii: L.instrukcii });
  assert.equal(sp.dalshe, 'SPROSIT');
  assert.ok(sp.skazat.includes(dom('kestrel').gde_shchit.en));
  assert.equal(sp.sprosit, S.VOPROSY.avtomat_proveren.en);
  // ни одного служебного кода в том, что агент читает вслух
  assert.ok(!/(voda_|ugroza|avaria|PEREVOD|ZAYAVKA|nightdesk)/.test(o.skazat + sp.skazat + sp.sprosit));
  // запасной текст 911, если у клиента нет инструкции
  assert.ok(S.tekstInstrukcii('gaz', 'en', null, {}).includes('nine-one-one'));
});

// ── цепочка эскалации ────────────────────────────────────────────────────
const T0 = '2026-10-07T06:10:00Z';
const plus = (min) => new Date(Date.parse(T0) + min * 60000).toISOString();

function prognat(kategoriya, ishody, { rezhim = 'perevod', ofisOtkryt = false } = {}) {
  const cep = S.sostavitCepochku(kategoriya, NAST, { rezhim, ofisOtkryt });
  let { esk, deystviya } = S.novayaEskalaciya({ avaria_id: 'AV-1', rezhim, cepochka: cep, at: T0, pravila: NAST.eskalaciya });
  const vse = [...deystviya];
  let min = 0;
  for (const ishod of ishody) {
    if (esk.status === 'zhdem') {
      min += esk.pravila.povtor_min;
      const d = S.sleduyushcheeDeystvie(esk, plus(min));
      assert.equal(d.deystvie, 'zvonit');
      esk = d.esk;
      vse.push(...d.deystviya);
    }
    min += 1;
    const r = S.primenitIshod(esk, { shag: esk.shag, krug: esk.krug, ishod, at: plus(min) });
    assert.equal(r.izmeneno, true, `${ishod} не применился`);
    esk = r.esk;
    vse.push(...r.deystviya);
  }
  return { esk, vse, cep };
}

test('цепочка: дежурный 1 → дежурный 2 → подрядчик по категории; офис в часы работы; сигнал без подрядчика', () => {
  assert.deepEqual(S.sostavitCepochku('kanalizaciya', NAST).map((z) => z.rol), ['dezhurnyy_1', 'dezhurnyy_2', 'podryadchik']);
  assert.equal(S.sostavitCepochku('kanalizaciya', NAST)[2].kod, 'kanalizaciya');
  assert.equal(S.sostavitCepochku('net_tepla', NAST)[2].kod, 'kotel');
  assert.deepEqual(S.sostavitCepochku('voda_protechka', NAST, { ofisOtkryt: true }).map((z) => z.rol), ['ofis', 'podryadchik']);
  assert.deepEqual(S.sostavitCepochku('gaz', NAST, { rezhim: 'signal' }).map((z) => z.rol), ['dezhurnyy_1', 'dezhurnyy_2']);
  assert.deepEqual(S.sostavitCepochku('drugoe', NAST).map((z) => z.rol), ['dezhurnyy_1', 'dezhurnyy_2'], 'нет подрядчика — только люди');
  const dubl = { dezhurnye: { cepochka: [{ telefon: '+17185550111' }, { telefon: '(718) 555-0111' }, { telefon: 'not a phone' }] } };
  assert.equal(S.sostavitCepochku('drugoe', dubl).length, 1, 'дубли и мусор выброшены');
});

test('план Б, исход 1: взял и нажал 1 → принята первым', () => {
  const { esk, vse } = prognat('voda_protechka', ['prinyal']);
  assert.equal(esk.status, 'prinyata');
  assert.equal(esk.prinyal.rol, 'dezhurnyy_1');
  assert.equal(vse[0].tip, 'zvonok');
  assert.ok(vse.some((d) => d.tip === 'pult' && d.sobytie === 'avaria_prinyata'));
});

test('план Б, исходы 2–4: взял без нажатия, не взял, сбросил → следующий в цепочке', () => {
  for (const ishod of ['bez_nazhatiya', 'ne_vzyal', 'sbrosil', 'oshibka']) {
    const { esk } = prognat('voda_protechka', [ishod, 'prinyal']);
    assert.equal(esk.status, 'prinyata', ishod);
    assert.equal(esk.prinyal.rol, 'dezhurnyy_2', ishod);
    assert.equal(esk.popytki[0].ishod, ishod);
  }
  const { esk } = prognat('kanalizaciya', ['ne_vzyal', 'sbrosil', 'prinyal']);
  assert.equal(esk.prinyal.rol, 'podryadchik');
});

test('никто не принял: фраза жильцу, SMS всем, пульт «не принята», побудка кругами, потом конец', () => {
  const r = prognat('net_vody', ['ne_vzyal', 'ne_vzyal', 'ne_vzyal']);
  assert.equal(r.esk.rezhim, 'signal');
  assert.ok(r.esk.nikto_v);
  assert.ok(r.vse.some((d) => d.tip === 'fraza_zhilcu' && d.kod === 'nikto'));
  const sms = r.vse.find((d) => d.tip === 'sms' && d.shablon === 'ne_prinyata');
  assert.deepEqual(sms.komu, r.cep.map((z) => z.nomer));
  assert.ok(r.vse.some((d) => d.tip === 'pult' && d.sobytie === 'avaria_ne_prinyata'));
  // три круга побудки по двум людям… и подрядчику (цепочка та же), никто не нажал → окончательно не принята
  const vsego = ['ne_vzyal', 'ne_vzyal', 'ne_vzyal', ...Array(3 * 3).fill('ne_vzyal')];
  const k = prognat('net_vody', vsego);
  assert.equal(k.esk.status, 'ne_prinyata');
  assert.ok(k.vse.some((d) => d.tip === 'svodka'));
  assert.equal(S.primenitIshod(k.esk, { shag: 0, krug: 3, ishod: 'prinyal', at: plus(99) }).izmeneno, false, 'после конца ничего не двигается');
});

test('между кругами ждём povtor_min; раньше времени — «ждать»', () => {
  const r = prognat('net_vody', ['ne_vzyal', 'ne_vzyal', 'ne_vzyal', 'ne_vzyal', 'ne_vzyal', 'ne_vzyal']);
  assert.equal(r.esk.status, 'zhdem');
  assert.equal(r.esk.krug, 2);
  const rano = S.sleduyushcheeDeystvie(r.esk, new Date(Date.parse(r.esk.sleduyushchiy_krug_v) - 60000).toISOString());
  assert.equal(rano.deystvie, 'zhdat');
  const pora = S.sleduyushcheeDeystvie(r.esk, r.esk.sleduyushchiy_krug_v);
  assert.equal(pora.deystvie, 'zvonit');
  assert.equal(pora.deystviya[0].rezhim, 'signal');
});

test('жилец положил трубку во время перевода → сигнал без соединения, SMS «жилец положил трубку»', () => {
  const { esk, vse } = prognat('voda_protechka', ['zvonyashchiy_polozhil', 'prinyal']);
  assert.equal(esk.status, 'prinyata');
  assert.equal(esk.prinyal.rezhim, 'signal');
  assert.ok(vse.some((d) => d.tip === 'sms' && d.shablon === 'zhilec_polozhil'));
});

test('угроза жизни: сначала SMS всем, потом побудка; принял один — остальным SMS «принята»', () => {
  const { esk, vse } = prognat('gaz', ['ne_vzyal', 'prinyal'], { rezhim: 'signal' });
  assert.equal(vse[0].tip, 'sms');
  assert.equal(vse[0].shablon, 'ugroza');
  assert.equal(vse[1].tip, 'zvonok');
  assert.equal(esk.prinyal.rol, 'dezhurnyy_2');
  const pr = vse.find((d) => d.shablon === 'prinyata');
  assert.deepEqual(pr.komu, ['+17185550111']);
});

test('повторный и опоздавший обратный вызов Twilio не двигает цепочку дважды', () => {
  const cep = S.sostavitCepochku('voda_protechka', NAST);
  const { esk } = S.novayaEskalaciya({ avaria_id: 'AV-2', cepochka: cep, at: T0 });
  const r1 = S.primenitIshod(esk, { shag: 0, krug: 1, ishod: 'ne_vzyal', at: plus(1) });
  assert.equal(r1.esk.shag, 1);
  const r2 = S.primenitIshod(r1.esk, { shag: 0, krug: 1, ishod: 'ne_vzyal', at: plus(1) });
  assert.equal(r2.izmeneno, false);
  assert.equal(r2.pochemu, 'ustarevshiy_ishod');
  assert.equal(r2.esk.shag, 1);
});

test('пустая цепочка → «некому»: жильцу фраза отката, в пульт тревога', () => {
  const { esk, deystviya } = S.novayaEskalaciya({ avaria_id: 'AV-3', cepochka: [], at: T0 });
  assert.equal(esk.status, 'nekomu');
  assert.ok(deystviya.some((d) => d.tip === 'fraza_zhilcu'));
  assert.ok(deystviya.some((d) => d.tip === 'pult' && d.sobytie === 'avaria_nekomu'));
});

test('сторож: обратного вызова нет дольше zavis_s → попытка считается неудачной', () => {
  const cep = S.sostavitCepochku('voda_protechka', NAST);
  let { esk } = S.novayaEskalaciya({ avaria_id: 'AV-4', cepochka: cep, at: T0 });
  esk = S.otmetitZvonok(esk, T0);
  assert.equal(S.sleduyushcheeDeystvie(esk, plus(1)).deystvie, 'zhdat');
  const d = S.sleduyushcheeDeystvie(esk, plus(3));
  assert.equal(d.deystvie, 'zavis');
  assert.equal(d.esk.shag, 1);
  assert.equal(d.esk.popytki[0].ishod, 'oshibka');
});

test('исход по обратному вызову Twilio: четыре исхода плана Б и прочее', () => {
  assert.equal(S.ishodPerevoda({ DialBridged: 'true', DialCallStatus: 'completed' }), 'prinyal');
  assert.equal(S.ishodPerevoda({ DialBridged: 'false', DialCallStatus: 'completed' }), 'bez_nazhatiya');
  assert.equal(S.ishodPerevoda({ DialCallStatus: 'no-answer' }), 'ne_vzyal');
  assert.equal(S.ishodPerevoda({ DialCallStatus: 'busy' }), 'sbrosil');
  assert.equal(S.ishodPerevoda({ DialCallStatus: 'canceled' }), 'zvonyashchiy_polozhil');
  assert.equal(S.ishodPerevoda({ DialCallStatus: 'failed' }), 'oshibka');
  assert.equal(S.ishodPerevoda(new URLSearchParams('DialCallStatus=no-answer&DialBridged=false')), 'ne_vzyal');
  assert.equal(S.ishodSignala({ CallStatus: 'completed', nazhal: true }), 'prinyal');
  assert.equal(S.ishodSignala({ CallStatus: 'completed' }), 'bez_nazhatiya');
  assert.equal(S.ishodSignala({ CallStatus: 'no-answer' }), 'ne_vzyal');
  assert.equal(S.ishodSignala({ CallStatus: 'busy' }), 'sbrosil');
});

// ── TwiML: ширма как в perevod-ru.js ─────────────────────────────────────
test('TwiML перевода: <Dial timeout=20 action> + <Number url=ширма>, адреса экранированы', () => {
  const tw = S.twimlPerevoda({
    nomer: '+17185550111', callerId: '+17185550100', zhdatS: 20,
    adresShirmy: 'https://x.example/nd-perevod?shag=shirma&a=AV-1&i=0&k=abc',
    adresItoga: 'https://x.example/nd-perevod?shag=itog&a=AV-1&i=0&k=abc',
    vstuplenie: S.frazaZhilcu('soedinyayu', 'en'),
  });
  assert.match(tw, /^<Say language="en-US" voice="Polly\.Joanna">Connecting you with our on-call team now\./);
  assert.match(tw, /<Dial timeout="20" callerId="\+17185550100" action="https:\/\/x\.example\/nd-perevod\?shag=itog&amp;a=AV-1&amp;i=0&amp;k=abc" method="POST">/);
  assert.match(tw, /<Number url="[^"]*shag=shirma&amp;[^"]*" method="POST">\+17185550111<\/Number><\/Dial>$/);
  assert.throws(() => S.twimlPerevoda({ nomer: '+17185550111' }));
  const doc = S.obernut(tw);
  assert.ok(doc.startsWith('<?xml version="1.0" encoding="UTF-8"?><Response>') && doc.endsWith('</Response>'));
});

test('ширма: два захода <Gather numDigits=1> (6 и 5 с), потом отбой; любая цифра = принял', () => {
  const tw = S.twimlShirmy({ tekst: 'Harbor Row emergency line. Press 1 to take the call.', adresPrinyat: 'https://x.example/p?a=1&b=2' });
  const gathers = tw.match(/<Gather numDigits="1" timeout="(\d+)"/g);
  assert.equal(gathers.length, 2);
  assert.match(tw, /timeout="6"[\s\S]*timeout="5"/);
  assert.ok(tw.endsWith('<Hangup/>'));
  assert.ok(tw.includes('a=1&amp;b=2'));
  assert.equal(S.twimlPrinyat('1'), '');
  assert.equal(S.twimlPrinyat('7'), '');
  assert.equal(S.twimlPrinyat('#'), '');
  assert.equal(S.twimlPrinyat(''), '<Hangup/>');
  assert.equal(S.twimlPrinyat('12'), '<Hangup/>');
  const es = S.twimlOtkata({ yazyk: 'es' });
  assert.match(es, /Polly\.Lupe/);
  assert.ok(es.includes('Nadie pudo contestar'));
  const sig = S.twimlSignala({ tekst: 'x', adresOtveta: 'https://x.example/o' });
  assert.equal((sig.match(/<Gather numDigits="1" timeout="8"/g) || []).length, 2);
});

test('тексты дежурному: ширма без имени жильца, SMS ≤ 320 знаков с номером для перезвона', () => {
  const av = { id: 'AV-7', kategoriya: 'voda_protechka', uroven: 'avaria', adres: dom('tidewater').adres, kvartira: '4b', telefon: '+13475550142', imya: 'Daniel Brooks' };
  const sh = S.tekstShirmy(av);
  assert.equal(sh, 'Harbor Row emergency line. Water leak at 41 Harbor Row, apartment 4B. Press 1 to take the call.');
  assert.ok(!sh.includes('Daniel'));
  const sig = S.tekstShirmy({ ...av, uroven: 'ugroza_zhizni', kategoriya: 'gaz' }, { rezhim: 'signal' });
  assert.ok(sig.includes('nine-one-one') && sig.includes('Press 1'));
  for (const shablon of ['ugroza', 'ne_prinyata', 'zhilec_polozhil', 'prinyata', 'drugoe']) {
    const t = S.tekstSms(av, shablon);
    assert.ok(t.length <= 320, shablon);
    assert.ok(!t.includes('Daniel'), shablon);
    if (shablon !== 'prinyata') assert.ok(t.includes('+13475550142'), shablon);
  }
  assert.ok(S.tekstSms(av, 'ugroza').includes('911'));
});

// ── заявка на ремонт ─────────────────────────────────────────────────────
test('заявка: нормализация, обязательные поля, номер и чтение вслух', () => {
  const z = S.novayaZayavka({
    dom: 'Tidewater', kvartira: 'apt 4b', kategoriya: 'santehnika', opisanie: '  Kitchen   faucet\ndrips ',
    dostup: 'tolko_pri_mne', zhivotnye: 'no', imya: 'Daniel Brooks', telefon: '(347) 555-0142', sms_soglasie: 'yes',
    conversation_id: 'conv_1',
  }, { nomer: S.nomerZayavki(4), at: '2026-10-07T06:10:00Z', doma: L.doma });
  assert.equal(z.nomer, 'HR-1004');
  assert.equal(z.dom, 'tidewater');
  assert.equal(z.adres, dom('tidewater').adres);
  assert.equal(z.kvartira, '4B');
  assert.equal(z.opisanie, 'Kitchen faucet drips');
  assert.equal(z.telefon, '+13475550142');
  assert.equal(z.zhivotnye, 'net');
  assert.equal(z.sms_soglasie, true);
  assert.equal(z.created_at, '2026-10-07T02:10:00-04:00');
  assert.deepEqual(S.proveritZayavku(z, { doma: L.doma }), { ok: true, net: [], oshibki: [] });
  assert.equal(S.nomerVsluh('HR-1004'), 'one zero zero four');
  assert.equal(S.nomerVsluh('HR-1004', 'es'), 'uno cero cero cuatro');
  const pustaya = S.proveritZayavku(S.novayaZayavka({ dom: 'tidewater', imya: 'Caller' }, { doma: L.doma }), { doma: L.doma });
  assert.equal(pustaya.ok, false);
  assert.deepEqual(pustaya.net.sort(), ['dostup', 'imya', 'kvartira', 'opisanie', 'telefon'].sort());
  assert.ok(S.proveritZayavku({ dom: 'chuzhoy', kvartira: '1', opisanie: 'xxxx', dostup: 'da', imya: 'A B', telefon: '+13475550142' }, { doma: L.doma }).oshibki.length);
});

test('квартира: форматы и чтение вслух на двух языках', () => {
  assert.equal(S.normKvartira('#4-B'), '4B');
  assert.equal(S.normKvartira('Apartment 12c'), '12C');
  assert.equal(S.normKvartira('apartamento 3 d'), '3D');
  assert.equal(S.normKvartira('квартира 4Б'), '4B');
  assert.equal(S.normKvartira('кв. 5д'), '5D');
  assert.equal(S.normKvartira('common'), 'COMMON');
  assert.equal(S.kvartiraVsluh('4B'), 'four B');
  assert.equal(S.kvartiraVsluh('12C'), 'twelve C');
  assert.equal(S.kvartiraVsluh('1R', 'es'), 'uno R');
  assert.equal(S.kvartiraVsluh('405'), 'four zero five');
});

// ── сверка с 50 сценариями ───────────────────────────────────────────────
test('сценарии: каждый ожидаемый вердикт и каждый промежуточный вопрос совпадают с движком', () => {
  let proveril = 0;
  for (const s of SC) {
    const o = s.ozhidaemo && s.ozhidaemo.sortirovka;
    if (!o) continue;
    for (const sh of o.shagi || []) {
      const v = S.sortirovat(sh.vhod, SP, { moment: o.moment });
      assert.equal(v.sprosit && v.sprosit.pole, sh.sprosit, `${s.id}: шаг ${JSON.stringify(sh.vhod)}`);
    }
    const v = S.sortirovat(o.vhod, SP, { moment: o.moment });
    for (const k of ['uroven', 'prichina', 'dalshe', 'instrukciya', 'podryadchik']) {
      if (o[k] !== undefined) assert.equal(v[k], o[k], `${s.id}: ${k}`);
    }
    if (o.zayavka === false) assert.equal(v.zayavka, false, s.id);
    for (const [k, zn] of Object.entries(o.teplo || {})) assert.equal(v.teplo[k], zn, `${s.id}: teplo.${k}`);
    proveril++;
  }
  assert.ok(proveril >= 30, `проверено ${proveril}`);
});

test('сценарии: цепочки эскалации проходят так, как записано (все исходы плана Б покрыты)', () => {
  const vstrecheno = new Set();
  let n = 0;
  for (const s of SC) {
    const e = s.ozhidaemo && s.ozhidaemo.eskalaciya;
    if (!e) continue;
    const kat = s.ozhidaemo.sortirovka.vhod.kategoriya;
    const r = prognat(kat, e.ishody, { rezhim: e.rezhim, ofisOtkryt: !!e.ofis_otkryt });
    assert.equal(r.esk.status, e.status, s.id);
    assert.equal(r.esk.prinyal && r.esk.prinyal.rol, e.prinyal_rol, s.id);
    if (e.prinyal_kod) assert.equal(r.cep.find((z) => z.nomer === r.esk.prinyal.nomer).kod, e.prinyal_kod, s.id);
    if (e.rezhim_itog) assert.equal(r.esk.rezhim, e.rezhim_itog, s.id);
    if (e.nikto) assert.ok(r.vse.some((d) => d.tip === 'fraza_zhilcu' && d.kod === 'nikto'), s.id);
    if (e.sms_nikto) assert.ok(r.vse.some((d) => d.shablon === e.sms_nikto), s.id);
    if (e.sms_polozhil) assert.ok(r.vse.some((d) => d.shablon === e.sms_polozhil), s.id);
    if (e.sms_pervoe) assert.equal(r.vse[0].shablon, e.sms_pervoe, s.id);
    for (const i of e.ishody) vstrecheno.add(i);
    n++;
  }
  assert.ok(n >= 14, `цепочек ${n}`);
  for (const i of ['prinyal', 'bez_nazhatiya', 'ne_vzyal', 'sbrosil', 'zvonyashchiy_polozhil']) assert.ok(vstrecheno.has(i), i);
});

test('приёмка: угроза жизни в 100% сценариев → 911 и сигнал дежурным', () => {
  const ugrozy = SC.filter((s) => s.gruppa.startsWith('ugroza'));
  assert.equal(ugrozy.length, 9);
  for (const s of ugrozy) {
    const o = s.ozhidaemo.sortirovka;
    const v = S.sortirovat(o.vhod, SP, { moment: o.moment });
    assert.equal(v.zvonit_911 && v.signal && !v.perevod, true, s.id);
    assert.equal(s.kritichnyy, true, s.id);
  }
});
