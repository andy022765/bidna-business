'use strict';
// Инструмент агента svobodnye_okna → свободные окна собеседований (A1) или оценок на дому (A2).
// Тело: tip (sobesedovanie | ocenka), data_s (YYYY-MM-DD, необяз.), yazyk.
// Ответ: {ok, okna:[{start, end, tekst}], soobshchenie, dalshe}; tekst — на языке звонящего,
// start — ISO с поясом клиента: его агент возвращает в zapis без правок.
//
// ДВА ОКНА, А НЕ СПИСОК (урок Веры): на слух восемь времён не запоминаются. Сколько — okon_v_otvete
// в настройках клиента. Календарь молчит — говорим правду, а не «свободного времени нет».

const { instrument } = require('../lib/http');
const { tipVstrechi, nastroykiKalendarya, svobodnyeOkna } = require('../lib/kalendar');
const { iso, tekst, razobratDatu } = require('../lib/vremya');
const { fraza } = require('../lib/frazy');
const { zapisat } = require('../lib/zhurnal');

exports.handler = instrument('okna', async ({ telo, liniya, klient, st, yazyk }) => {
  const tip = tipVstrechi(telo.tip);
  if (!tip) return { ok: false, kod: 'net_tipa', soobshchenie: fraza('net_tipa', yazyk) };
  const n = nastroykiKalendarya(klient, tip);
  const molchit = (kod) => ({ ok: false, kod, okna: [], soobshchenie: fraza('kalendar_molchit', yazyk),
                              dalshe: fraza('kalendar_molchit_dalshe', yazyk) });
  if (!n || !n.kalendar) {
    await zapisat(st, { kto: 'agent', chto: 'okna_net_kalendarya', obekt: null, detali: { tip, liniya: liniya.liniya } }, { poyas: klient.poyas });
    return molchit('net_kalendarya');
  }
  const dataS = razobratDatu(telo.data_s) ? String(telo.data_s).trim() : null;
  let r;
  try { r = await svobodnyeOkna(n, { dataS }); }
  catch (e) { r = { kod: 0, oshibka: e.message }; }
  if (r.kod !== 200) {
    console.log('[okna] занятость не прочиталась:', r.kod, r.oshibka);
    return molchit('kalendar');
  }
  const vybor = r.okna.slice(0, Math.max(1, n.okon_v_otvete));
  if (!vybor.length) {
    return { ok: true, tip, okna: [], soobshchenie: fraza('okon_net', yazyk), dalshe: fraza('okon_net_dalshe', yazyk) };
  }
  const okna = vybor.map((d) => ({
    start: iso(d, n.poyas),
    end: iso(d.getTime() + n.dlina * 60000, n.poyas),
    tekst: tekst(d, yazyk, n.poyas),
  }));
  return { ok: true, tip, okna, soobshchenie: fraza('okna', yazyk, okna.map((o) => o.tekst)), dalshe: fraza('okna_dalshe', yazyk) };
}, { liniya: 'care-hiring' });
