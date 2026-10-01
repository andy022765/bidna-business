'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
P.vremya('2026-09-30T09:00:00-04:00');
const Z = require('../lib/care/zamena');
const otkaz = require('../netlify-functions/otkaz');
const vyzov = async (telo) => P.otvet(await otkaz.handler(P.instrument(telo, P.KLYUCHI.DEMO_2)));
const nastoyashchiyDvizhok = typeof Z.sleduyushcheeDeystvie === 'function';

test.before(async () => { await P.zasejat(P.st()); });

test('отказ → движок вызван со сменой и клиентом → первая волна SMS (в журнал) → смена «offered»', async () => {
  const vyzovy = [];
  const podobrat = Z.podobrat;
  Z.podobrat = (...a) => { vyzovy.push(a); return podobrat(...a); };
  try {
    const r = await vyzov({ caller_id: '+17185550111', data_smeny: '2026-10-01', prichina: 'bolezn', conversation_id: 'conv_test_otkaz_00001' });
    assert.equal(r.ok, true);
    assert.equal(r.nuzhno_utochnit, false);
    assert.deepEqual(r.smena, { start_tekst: 'Thursday, October 1 at 6:00 PM', klient_kod: 'BK-114' });
    assert.match(r.soobshchenie, /can't make your shift on Thursday, October 1 at 6:00 PM/);
    assert.equal(vyzovy.length, 1, 'движок подбора вызван один раз');
    const [smena, sidelki, smeny, pravila] = vyzovy[0];
    assert.equal(smena.id, 'sm-1');
    assert.equal(smena.klient.kod, 'BK-114', 'клиент смены передан движку');
    assert.equal(sidelki.length, 7);
    assert.ok(Array.isArray(smeny));
    assert.equal(pravila.volna, 3);
  } finally { Z.podobrat = podobrat; }

  const st = P.st();
  const o = await st.getJSON('otkazy/otk-sm-1-s-01');
  assert.equal(o.sidelka_id, 's-01');
  assert.equal(o.prichina, 'bolezn');
  assert.equal(o.kanal, 'call');
  assert.equal(o.volny.length, 1);
  assert.ok(o.volny[0].sidelki.length >= 1 && o.volny[0].sidelki.length <= 3);
  assert.ok(!o.volny[0].sidelki.includes('s-01'), 'отказавшей не предлагаем');
  assert.ok(!o.volny[0].sidelki.includes('s-06'), 'без согласия на SMS не предлагаем');
  assert.equal((await st.getJSON('smeny/sm-1')).status, 'offered');
  const zh = await P.zhurnal(st, '2026-09-30');
  const sms = zh.filter((z) => z.chto === 'sms_dry_run');
  assert.equal(sms.length, o.volny[0].sidelki.length);
  assert.match(sms[0].detali.tekst, /Brightside Home Care \(DEMO\): (open shift|свободная смена)/);
  assert.match(sms[0].detali.tekst, new RegExp(`(YES|ДА) ${o.kod}`));
  const pred = await st.getJSON(`predlozheniya/${sms[0].detali.komu}`);
  assert.equal(pred.spisok[0].otkaz_id, 'otk-sm-1-s-01');
  assert.ok(zh.some((z) => z.chto === 'otkaz_ot_smeny'));
});

test('повтор того же отказа — тот же отказ, вторая волна не уходит', async () => {
  const st = P.st();
  const smsDo = (await P.zhurnal(st, '2026-09-30')).filter((z) => z.chto === 'sms_dry_run').length;
  const r = await vyzov({ caller_id: '+17185550111', data_smeny: '2026-10-01', prichina: 'bolezn', conversation_id: 'conv_test_otkaz_00001' });
  assert.equal(r.ok, true);
  assert.equal(r.uzhe, true);
  assert.equal((await st.getJSON('otkazy/otk-sm-1-s-01')).volny.length, 1);
  assert.equal((await P.zhurnal(st, '2026-09-30')).filter((z) => z.chto === 'sms_dry_run').length, smsDo);
});

test('несколько смен без даты — уточняем; незнакомый номер — координатору', async () => {
  await P.st().setJSON('smeny/sm-4', { id: 'sm-4', klient_id: 'c-01', sidelka_id: 's-02', start: '2026-10-02T09:00:00-04:00', end: '2026-10-02T13:00:00-04:00', status: 'scheduled' });
  await P.st().setJSON('smeny/sm-5', { id: 'sm-5', klient_id: 'c-02', sidelka_id: 's-02', start: '2026-10-04T09:00:00-04:00', end: '2026-10-04T13:00:00-04:00', status: 'scheduled' });
  const r = await vyzov({ caller_id: '+17185550112', prichina: 'semya', conversation_id: 'conv_test_otkaz_00002' });
  assert.equal(r.ok, true);
  assert.equal(r.nuzhno_utochnit, true);
  assert.equal(r.smena, null);
  assert.equal(r.varianty.length, 2);
  assert.match(r.soobshchenie, /more than one upcoming shift/);
  const poKodu = await vyzov({ caller_id: '+17185550112', klient_kod: 'qn-208', prichina: 'semya', conversation_id: 'conv_test_otkaz_00002' });
  assert.equal(poKodu.nuzhno_utochnit, false);
  assert.equal(poKodu.smena.klient_kod, 'QN-208');
  const net = await vyzov({ caller_id: '+17185550112', data_smeny: '2026-10-09', prichina: 'drugoe' });
  assert.equal(net.nuzhno_utochnit, true);
  const chuzhoy = await vyzov({ caller_id: '+17185550199', prichina: 'drugoe' });
  assert.equal(chuzhoy.ok, false);
  assert.equal(chuzhoy.peredat_koordinatoru, true);
  assert.match(chuzhoy.soobshchenie, /caregiver list/);
});

test('смена меньше чем через 2 часа — будим дежурного сразу (в DRY_RUN — журнал звонка)', { skip: !nastoyashchiyDvizhok && 'движок замены — заглушка' }, async () => {
  const st = P.st();
  await st.setJSON('smeny/sm-6', { id: 'sm-6', klient_id: 'c-01', sidelka_id: 's-03', start: '2026-09-30T10:30:00-04:00', end: '2026-09-30T14:30:00-04:00', status: 'scheduled' });
  const r = await vyzov({ caller_id: '+17185550113', data_smeny: '2026-09-30', prichina: 'transport', conversation_id: 'conv_test_otkaz_00003' });
  assert.equal(r.ok, true);
  const o = await st.getJSON('otkazy/otk-sm-6-s-03');
  assert.ok(o.eskalaciya_v, 'дежурного разбудили');
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.ok(zh.some((z) => z.chto === 'zvonok_dry_run' && z.detali.komu === '+17185550190'));
  assert.ok(zh.some((z) => z.chto === 'eskalaciya_zvonok' && z.obekt === 'otkazy/otk-sm-6-s-03'));
});

test('движок упал — отказ всё равно записан, дежурного будим', async () => {
  const st = P.st();
  await st.setJSON('smeny/sm-7', { id: 'sm-7', klient_id: 'c-01', sidelka_id: 's-04', start: '2026-10-05T09:00:00-04:00', end: '2026-10-05T13:00:00-04:00', status: 'scheduled' });
  const podobrat = Z.podobrat;
  Z.podobrat = () => { throw new Error('проверка: движок сломан'); };
  try {
    const r = await vyzov({ caller_id: '+17185550114', data_smeny: '2026-10-05', prichina: 'bolezn' });
    assert.equal(r.ok, true);
  } finally { Z.podobrat = podobrat; }
  const o = await st.getJSON('otkazy/otk-sm-7-s-04');
  assert.ok(o, 'отказ записан');
  assert.ok(o.eskalaciya_v, 'дежурного будим');
  assert.ok((await P.zhurnal(st, '2026-09-30')).some((z) => z.chto === 'podbor_oshibka'));
});

test('отказ без причины — {ok:false, net_prichiny, nuzhno_utochnit} с вопросом на языке звонящего; ничего не записано', async () => {
  const st = P.st();
  await st.setJSON('smeny/sm-8', { id: 'sm-8', klient_id: 'c-01', sidelka_id: 's-05', start: '2026-10-02T09:00:00-04:00', end: '2026-10-02T13:00:00-04:00', status: 'scheduled' });
  const smsDo = (await P.zhurnal(st, '2026-09-30')).filter((z) => z.chto === 'sms_dry_run').length;
  const telo = { caller_id: '+17185550115', data_smeny: '2026-10-02', conversation_id: 'conv_test_otkaz_00010' };
  const en = await vyzov(telo);
  assert.equal(en.ok, false);
  assert.equal(en.kod, 'net_prichiny');
  assert.equal(en.nuzhno_utochnit, true);
  assert.equal(en.smena, null);
  assert.equal(en.soobshchenie, "What's the reason — are you sick, is it transportation, a family matter, or something else?");
  assert.match(en.dalshe, /Nothing is recorded yet/);
  assert.match((await vyzov(Object.assign({}, telo, { yazyk: 'ru', prichina: '' }))).soobshchenie, /^А причина — вы заболели/);
  assert.match((await vyzov(Object.assign({}, telo, { yazyk: 'es', prichina: 'unknown' }))).soobshchenie, /^¿Cuál es el motivo/);
  assert.equal((await vyzov(Object.assign({}, telo, { prichina: '{{prichina}}' }))).kod, 'net_prichiny');
  assert.equal(await st.getJSON('otkazy/otk-sm-8-s-05'), null, 'отказа нет');
  assert.equal((await st.getJSON('smeny/sm-8')).status, 'scheduled', 'смена не тронута');
  const zh = await P.zhurnal(st, '2026-09-30');
  assert.equal(zh.filter((z) => z.chto === 'sms_dry_run').length, smsDo, 'волна не ушла');
  assert.ok(zh.some((z) => z.chto === 'otkaz_bez_prichiny' && z.obekt === 'smeny/sm-8'));

  // Агент спросил и позвал снова — записано; повтор без причины про ту же смену — «уже записан», а не вопрос.
  const r = await vyzov(Object.assign({}, telo, { prichina: 'semya', yazyk: 'ru' }));
  assert.equal(r.ok, true);
  assert.equal((await st.getJSON('otkazy/otk-sm-8-s-05')).prichina, 'semya');
  const povtor = await vyzov(telo);
  assert.equal(povtor.ok, true);
  assert.equal(povtor.uzhe, true);
});

test('причина без смены и незнакомый номер — ответы прежние: вопрос о причине только когда смена найдена', async () => {
  const net = await vyzov({ caller_id: '+17185550115', data_smeny: '2026-10-09', conversation_id: 'conv_test_otkaz_00012' });
  assert.equal(net.ok, true);
  assert.equal(net.nuzhno_utochnit, true);
  assert.match(net.soobshchenie, /don't see an upcoming shift/);
  const chuzhoy = await vyzov({ caller_id: '+17185550198' });
  assert.equal(chuzhoy.kod, 'neizvestnyy_nomer');
});

test('причина словами вне перечня: sick → bolezn, семья → semya, «врач» → drugoe; unknown / N/A / пусто — не названа', () => {
  const p = otkaz._prichinaIz;
  for (const [v, kod] of [['bolezn', 'bolezn'], ['BOLEZN', 'bolezn'], ['Sick', 'bolezn'], ['enferma', 'bolezn'], ['заболела', 'bolezn'],
    ['family', 'semya'], ['Семья', 'semya'], ['transportation', 'transport'], ['транспорт', 'transport'], ['drugoe', 'drugoe'],
    ['doctor appointment', 'drugoe'], ['', null], ['N/A', null], ['none', null], ['unknown', null], [undefined, null]]) {
    assert.equal(p(v), kod, String(v));
  }
});

test('yazyk в теле — start_tekst и soobshchenie на языке звонящего (es, ru); без yazyk — английский', async () => {
  const st = P.st();
  await st.setJSON('smeny/sm-9', { id: 'sm-9', klient_id: 'c-02', sidelka_id: 's-07', start: '2026-10-02T14:00:00-04:00', end: '2026-10-02T18:00:00-04:00', status: 'scheduled' });
  const telo = { caller_id: '+17185550117', data_smeny: '2026-10-02', prichina: 'transport', conversation_id: 'conv_test_otkaz_00011' };
  const es = await vyzov(Object.assign({ yazyk: 'es' }, telo));
  assert.equal(es.ok, true);
  assert.deepEqual(es.smena, { start_tekst: 'viernes 2 de octubre a las 2:00 de la tarde', klient_kod: 'QN-208' });
  assert.equal(es.soobshchenie, 'Gracias por avisarnos. Anoté que no puede cubrir su turno del viernes 2 de octubre a las 2:00 de la tarde. Ya estamos buscando un reemplazo.');
  const ru = await vyzov(Object.assign({ yazyk: 'ru' }, telo));
  assert.equal(ru.uzhe, true);
  assert.equal(ru.smena.start_tekst, 'пятница, 2 октября, в 14:00');
  assert.equal(ru.soobshchenie, 'Отказ от смены (пятница, 2 октября, в 14:00) уже записан. Мы ищем замену.');
  const en = await vyzov(telo);
  assert.equal(en.smena.start_tekst, 'Friday, October 2 at 2:00 PM');
  assert.match(en.soobshchenie, /already recorded/);
  const mnogo = await vyzov({ caller_id: '+17185550112', prichina: 'semya', yazyk: 'es', conversation_id: 'conv_test_otkaz_00013' });
  assert.equal(mnogo.nuzhno_utochnit, true);
  assert.match(mnogo.soobshchenie, /^Veo más de un turno próximo: viernes 2 de octubre a las 9:00 de la mañana \(BK-114\) o domingo 4 de octubre/);
});
