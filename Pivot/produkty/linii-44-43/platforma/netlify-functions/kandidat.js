'use strict';
// Инструмент агента sohranit_kandidata → карточка кандидата (A1) в `kandidaty/<id>`.
// Тело: imya, telefon, email, sertifikat, rayon, zip, transport, grafik_dni[], grafik_chasy, yazyki[], opyt_let,
//       pravo_na_rabotu, podhodit, prichina_otkaza, sms_soglasie, yazyk, conversation_id. Ответ: {ok, id}.
// Повторный вызов в том же разговоре или с тем же телефоном — та же карточка (lib/kartochki.js).
// podhodit:false — лист ожидания (так описан инструмент в care/instrumenty/sohranit_kandidata.json).
//
// ЗАЩИТА ОТ КАРТОЧКИ-ЗАГЛУШКИ (прогоны care-19, care-31: «сообщение» сохранено кандидатом «Caller»). HTTP 200 и
// {ok:false, kod, soobshchenie, dalshe}, ничего не сохранено:
//   kod net_imeni  — имя пустое или служебное (Caller, Unknown, N/A, Звонящий, Llamante…, без учёта регистра):
//                    звонящему — просьба назвать имя и фамилию по буквам;
//   kod net_otbora — нет sertifikat, а карточки с отбором у разговора или телефона ещё нет: звонящему — «сначала
//                    пара вопросов о сертификате и графике»; в dalshe — «хочет только сообщение — не зови снова».
// Фразы — на языке звонящего (yazyk в теле, lib/frazy.js).

const { instrument } = require('../lib/http');
const { sohranitKandidata } = require('../lib/kartochki');
const { fraza } = require('../lib/frazy');

const FRAZA = { net_telefona: 'kartochka_net_telefona', net_imeni: 'kartochka_net_imeni', net_otbora: 'kartochka_net_otbora' };
const DALSHE = { net_imeni: 'kartochka_net_imeni_dalshe', net_otbora: 'kartochka_net_otbora_dalshe' };

exports.handler = instrument('kandidat', async ({ telo, liniya, klient, st, yazyk }) => {
  const r = await sohranitKandidata(st, klient, liniya, telo);
  if (!r.ok) {
    const otvet = { ok: false, kod: r.pochemu, soobshchenie: fraza(FRAZA[r.pochemu] || 'sboy', yazyk) };
    if (DALSHE[r.pochemu]) otvet.dalshe = fraza(DALSHE[r.pochemu], yazyk);
    return otvet;
  }
  return { ok: true, id: r.id, status: r.kartochka.status, soobshchenie: fraza('kartochka_ok', yazyk) };
}, { liniya: 'care-hiring' });
