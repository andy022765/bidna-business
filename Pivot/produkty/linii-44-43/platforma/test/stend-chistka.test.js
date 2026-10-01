'use strict';
// Срок хранения итогов звонков: lib/chistka.js из функции svodka по расписанию (проверка 30.09, правка 01.10).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./stend-pomoshch');
P.sreda();
const svodka = require('../netlify-functions/svodka');
const linii = require('../lib/linii');

const SID = (n) => 'CA' + String(n).padStart(32, '0');

async function zasejatZvonki(st) {
  // старше 30 дней от 2026-10-01 (31.08 и раньше) — уходят; свежие и без даты — остаются
  await st.setJSON('zvonki/conv_staryy_0001', { conversation_id: 'conv_staryy_0001', nachalo: '2026-08-20T10:00:00-04:00', poluchen: '2026-08-20T10:05:00-04:00', kratko: 'old' });
  await st.setJSON('zvonki/conv_staryy_0002', { conversation_id: 'conv_staryy_0002', nachalo: '2026-08-30T09:00:00-04:00', kratko: 'old, no poluchen' });
  await st.setJSON('zvonki/conv_svezhiy_0001', { conversation_id: 'conv_svezhiy_0001', nachalo: '2026-09-28T10:00:00-04:00', poluchen: '2026-09-28T10:06:00-04:00' });
  await st.setJSON('zvonki/conv_bez_daty_0001', { conversation_id: 'conv_bez_daty_0001', kratko: 'no date' });
  await st.setJSON('zvonki-itog/conv_staryy_0001', { at: Date.parse('2026-08-20T14:05:00Z'), _tk: 'x' });
  await st.setJSON('zvonki-itog/conv_svezhiy_0001', { at: Date.parse('2026-09-28T14:06:00Z'), _tk: 'y' });
  await st.setJSON('razgovory/conv_staryy_0001', { conversation_id: 'conv_staryy_0001', sozdano: '2026-08-20T10:01:00-04:00', zapisi: {} });
  await st.setJSON('razgovory/conv_svezhiy_0001', { conversation_id: 'conv_svezhiy_0001', sozdano: '2026-09-28T10:01:00-04:00', zapisi: {} });
  await st.setJSON(`zvonki-vhod/2026-08-20/${SID(1)}`, { at: 1 });
  await st.setJSON(`zvonki-vhod/2026-09-28/${SID(2)}`, { at: 2 });
  await st.setJSON('kandidaty/k-staryy', { id: 'k-staryy', created_at: '2026-08-01T10:00:00-04:00' });
}

test('раз в сутки svodka чистит итоги звонков старше 30 дней; свежие, без даты и карточки кандидатов — на месте', async () => {
  const st = P.st();
  await zasejatZvonki(st);
  P.vremya('2026-10-01T11:00:00Z');   // 7:00 в Нью-Йорке — запуск по расписанию
  assert.equal((await svodka.handler({})).statusCode, 200);
  const est = async (k) => (await st.getJSON(k)) !== null;
  assert.equal(await est('zvonki/conv_staryy_0001'), false);
  assert.equal(await est('zvonki/conv_staryy_0002'), false, 'без poluchen — по nachalo');
  assert.equal(await est('zvonki/conv_svezhiy_0001'), true);
  assert.equal(await est('zvonki/conv_bez_daty_0001'), true, 'без даты не трогаем');
  assert.equal(await est('zvonki-itog/conv_staryy_0001'), false);
  assert.equal(await est('zvonki-itog/conv_svezhiy_0001'), true);
  assert.equal(await est('razgovory/conv_staryy_0001'), false);
  assert.equal(await est('razgovory/conv_svezhiy_0001'), true);
  assert.equal(await est(`zvonki-vhod/2026-08-20/${SID(1)}`), false);
  assert.equal(await est(`zvonki-vhod/2026-09-28/${SID(2)}`), true);
  assert.equal(await est('kandidaty/k-staryy'), true, 'карточки кандидатов — не срок итогов звонков');
  const zh = await P.zhurnal(st, '2026-10-01');
  const z = zh.find((x) => x.chto === 'chistka');
  assert.ok(z, 'строка чистки в журнале');
  assert.equal(z.detali.dney, 30);
  assert.deepEqual(z.detali.udaleno, { zvonki: 2, 'zvonki-itog': 1, razgovory: 1, 'zvonki-vhod': 1 });

  // второй запуск того же дня (12 UTC) не чистит: замок chistka/<дата>
  await st.setJSON('zvonki/conv_staryy_0003', { conversation_id: 'conv_staryy_0003', poluchen: '2026-08-01T10:00:00-04:00' });
  P.vremya('2026-10-01T12:00:00Z');
  await svodka.handler({});
  assert.equal(await est('zvonki/conv_staryy_0003'), true, 'раз в сутки');
  P.vremya('2026-10-02T11:00:00Z');
  await svodka.handler({});
  assert.equal(await est('zvonki/conv_staryy_0003'), false, 'на следующий день — дочищено');
});

test('срок из настроек клиента (hranenie.zvonki_dney); на стенде — 30', async () => {
  assert.equal(require('../nastroyki.json').brightside.hranenie.zvonki_dney, 30);
  const { srokDney, pochistit } = require('../lib/chistka');
  assert.equal(srokDney({}), 30, 'нет настройки — 30');
  assert.equal(srokDney({ hranenie: { zvonki_dney: 0 } }), 30, 'ноль не выключает чистку');
  const n = P.nastroykiTest();
  n.brightside.hranenie = { zvonki_dney: 7 };
  linii.ustanovit({ linii: P.LINII_TEST, nastroyki: n });
  try {
    const st = P.st();
    await st.setJSON('zvonki/conv_nedelya_0001', { conversation_id: 'conv_nedelya_0001', poluchen: '2026-09-28T10:00:00-04:00' });
    P.vremya('2026-10-06T15:00:00Z');
    const r = await pochistit(st, linii.klient('brightside'));
    assert.equal(r.dney, 7);
    assert.equal(await st.getJSON('zvonki/conv_nedelya_0001'), null, '8 дней при сроке 7 — удалено');
    assert.ok(await st.getJSON('zvonki/conv_svezhiy_0001') === null, 'и прошлый «свежий» тоже старше недели');
  } finally { linii.ustanovit({ linii: P.LINII_TEST, nastroyki: P.nastroykiTest() }); }
});
