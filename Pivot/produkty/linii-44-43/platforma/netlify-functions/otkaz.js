'use strict';
// Инструмент агента otkaz_ot_smeny → отказ сиделки от смены (A3) и запуск подбора замены.
// Тело: caller_id (system__caller_id), data_smeny (YYYY-MM-DD, необяз.), klient_kod (необяз.), prichina,
//       yazyk (en/es/ru, необяз.), conversation_id.
// Ответ: {ok, smena:{start_tekst, klient_kod}|null, nuzhno_utochnit, soobshchenie}; start_tekst и soobshchenie —
// на языке yazyk (нет — на языке линии, английский: тогда агент переводит сам).
//
// Сиделку узнаём по номеру, с которого звонят (не по словам модели). Смена однозначна — фиксируем отказ,
// движок подбирает замену, первая волна SMS уходит сразу (в DRY_RUN — в журнал). Смен несколько или ни одной —
// nuzhno_utochnit:true и вопрос в soobshchenie; агент переспрашивает и зовёт снова с датой или кодом клиента.
// Повторный вызов про ту же смену — тот же отказ, подбор второй раз не запускается.
//
// ПРИЧИНА ОБЯЗАТЕЛЬНА (прогон care-54: агент не спросил, в карточку ушло выдуманное «drugoe»). Смена найдена
// однозначно, отказа по ней ещё нет, а prichina пустая — НИЧЕГО не записываем: HTTP 200 {ok:false, kod:'net_prichiny',
// nuzhno_utochnit:true, soobshchenie: вопрос о причине (болезнь, семья, транспорт, другое), dalshe}. Незнакомый номер,
// нет смены, несколько смен, уже записанный отказ — ответы прежние: причина там ещё (или уже) не нужна.
// prichina: bolezn/semya/transport/drugoe; явные слова (sick, familia, транспорт…) понимаем; «unknown», «none», «n/a» —
// это пусто; любое другое непустое — drugoe (человек назвал свою причину).

const { instrument, znachenie } = require('../lib/http');
const { e164 } = require('../lib/linii');
const { tekst, razobratDatu, POYAS } = require('../lib/vremya');
const { fraza } = require('../lib/frazy');
const { zapisat } = require('../lib/zhurnal');
const { razgovorId, svyazRazgovora } = require('../lib/kartochki');
const O = require('../lib/otkazy');

const PRICHINY = ['bolezn', 'semya', 'transport', 'drugoe'];
const PUSTO = new Set(['unknown', 'none', 'null', 'nil', 'undefined', 'n a', 'na', 'not given', 'not provided', 'not specified',
  'no reason', 'ne znayu', 'desconocido', 'desconocida', 'неизвестно', 'не указано', 'не знаю']);
const SLOVA = [
  [/^(sick|ill|enferm|болез|болен|больн|забол|бол[еи]ю)/, 'bolezn'],
  [/^(famil|семья|семейн)/, 'semya'],
  [/^(transport|транспорт)/, 'transport'],
];

// Причина из тела: код перечня или null — «не назвали».
function prichinaIz(v) {
  const s = znachenie(v, 60).toLowerCase();
  if (PRICHINY.includes(s)) return s;
  const slova = s.replace(/[^\p{L}]+/gu, ' ').trim();
  if (!slova || PUSTO.has(slova)) return null;
  for (const [re, kod] of SLOVA) if (re.test(slova)) return kod;
  return 'drugoe';
}

exports.handler = instrument('otkaz', async ({ telo, liniya, klient, st, yazyk }) => {
  const poyas = klient.poyas || POYAS;
  const telefon = e164(telo.caller_id);
  const conv = razgovorId(telo.conversation_id);
  const prichina = prichinaIz(telo.prichina);

  const sidelka = telefon ? await O.sidelkaPoTelefonu(st, telefon) : null;
  if (!sidelka) {
    await zapisat(st, { kto: 'agent', chto: 'otkaz_neizvestnyy_nomer', obekt: null,
                        detali: { telefon: telefon || null, prichina, liniya: liniya.liniya, conversation_id: conv } }, { poyas });
    return { ok: false, kod: 'neizvestnyy_nomer', smena: null, nuzhno_utochnit: false, peredat_koordinatoru: true,
             soobshchenie: fraza('otkaz_neizvestnyy', yazyk) };
  }

  const d = await O.kollekcii(st);
  const data = razobratDatu(telo.data_smeny) ? String(telo.data_smeny).trim() : null;
  const klientKod = znachenie(telo.klient_kod, 20) || null;
  const smeny = O.blizhayshieSmeny(sidelka, d.smeny, d.klienty, { data, klientKod, poyas });
  const kodKlienta = (s) => { const k = d.klienty.find((x) => x.id === s.klient_id); return k ? k.kod || null : null; };

  if (!smeny.length) {
    return { ok: true, smena: null, nuzhno_utochnit: true, soobshchenie: fraza('otkaz_net_smeny', yazyk) };
  }
  if (smeny.length > 1) {
    const varianty = smeny.slice(0, 3).map((s) => tekst(s.start, yazyk, poyas) + (kodKlienta(s) ? ` (${kodKlienta(s)})` : ''));
    return { ok: true, smena: null, nuzhno_utochnit: true, varianty, soobshchenie: fraza('otkaz_mnogo', yazyk, varianty) };
  }

  const smena = smeny[0];
  const startTekst = tekst(smena.start, yazyk, poyas);
  const otvetSmena = { start_tekst: startTekst, klient_kod: kodKlienta(smena) };
  if (!prichina && !(await st.getJSON(`otkazy/${O.idOtkaza(smena, sidelka)}`))) {
    await zapisat(st, { kto: 'agent', chto: 'otkaz_bez_prichiny', obekt: `smeny/${smena.id}`,
                        detali: { sidelka_id: sidelka.id, liniya: liniya.liniya, conversation_id: conv } }, { poyas });
    return { ok: false, kod: 'net_prichiny', zapisano: false, smena: null, nuzhno_utochnit: true,
             soobshchenie: fraza('otkaz_prichina', yazyk), dalshe: fraza('otkaz_prichina_dalshe', yazyk) };
  }
  const { otkaz, novyy } = await O.zafiksirovat(st, klient, liniya, { sidelka, smena, prichina: prichina || 'drugoe', kanal: 'call', conversation_id: conv });
  if (conv) await svyazRazgovora(st, conv, liniya, (x) => { x.otkaz_id = otkaz.id; x.telefon = x.telefon || telefon; return x; });
  if (!novyy) {
    return { ok: true, smena: otvetSmena, nuzhno_utochnit: false, uzhe: true, otkaz_id: otkaz.id,
             soobshchenie: fraza('otkaz_uzhe', yazyk, startTekst) };
  }
  const podbor = await O.zapustitPodbor(st, klient, liniya, otkaz.id);
  return { ok: true, smena: otvetSmena, nuzhno_utochnit: false, otkaz_id: otkaz.id,
           predlozheno: podbor.komu ? podbor.komu.length : 0,
           soobshchenie: fraza('otkaz_ok', yazyk, startTekst) };
}, { liniya: 'care-caregivers' });

exports._prichinaIz = prichinaIz;
