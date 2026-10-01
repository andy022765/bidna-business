'use strict';
// Инструмент агента sohranit_semyu → обращение семьи (A2) в `semi/<id>`.
// Тело: imya, telefon, rayon, zip, chasov_v_nedelyu, oplata, srochnost, yazyk, conversation_id. Ответ: {ok, id}.
// Медицинских сведений карточка не принимает вовсе: полей для них нет (A2 — только вымышленные данные до цепочки BAA).
// Имя-заглушка (Caller, Unknown, N/A…) — HTTP 200 {ok:false, kod:'net_imeni', soobshchenie, dalshe}, ничего не
// сохранено: агент спросит имя и фамилию (как у кандидата, netlify-functions/kandidat.js).

const { instrument } = require('../lib/http');
const { sohranitSemyu } = require('../lib/kartochki');
const { fraza } = require('../lib/frazy');

const FRAZA = { net_telefona: 'kartochka_net_telefona', net_imeni: 'kartochka_net_imeni' };

exports.handler = instrument('semya', async ({ telo, liniya, klient, st, yazyk }) => {
  const r = await sohranitSemyu(st, klient, liniya, telo);
  if (!r.ok) {
    const otvet = { ok: false, kod: r.pochemu, soobshchenie: fraza(FRAZA[r.pochemu] || 'sboy', yazyk) };
    if (r.pochemu === 'net_imeni') otvet.dalshe = fraza('kartochka_net_imeni_dalshe', yazyk);
    return otvet;
  }
  return { ok: true, id: r.id, status: r.kartochka.status, soobshchenie: fraza('kartochka_ok', yazyk) };
}, { liniya: 'care-hiring' });
