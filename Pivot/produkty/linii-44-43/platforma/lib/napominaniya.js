'use strict';
// Напоминания о встречах за 24 ч и за 2 ч до начала (план A1 и A2): собеседование кандидата
// (kandidaty/<id>.sobesedovanie) и оценка ухода на дому (semi/<id>.ocenka). Тик зовёт функция napominaniya
// раз в 15 минут (netlify.toml). Функции нет в таблице KONTRAKT.md — добавлена сборщиком стенда 30.09 вечером.
//
// ОКНО ±7,5 мин вокруг «начало − 24 ч» и «начало − 2 ч», полуоткрытое [−7,5; +7,5): шаг расписания 15 минут, значит
// в окно попадает ровно один запуск. Netlify пропустил запуск — этого напоминания нет (не шлём SMS не вовремя).
// ФЛАГИ napominanie_24 / napominanie_2 лежат в самой встрече: {at, kanal, rezultat}. Перенос (zapis) кладёт новую
// встречу без флагов — новое время напоминается заново; повтор или два запуска подряд второй раз не шлют.
// Второй рубеж от дублей — ключ отправки lib/otpravka: встреча + отметка.
// КАНАЛ. SMS — только при согласии: журнал согласий soglasiya/<телефон> (STOP сильнее всего), записи нет — согласие
// из карточки. Нет согласия или SMS не ушло — письмо, если есть почта (кандидат: email; семья: kontakt.email, её
// кладёт zapis). Нет ни того, ни другого — только флаг и строка журнала napominanie_net.
// СВЕЖАЯ ЗАПИСЬ. Записались меньше чем за час до момента напоминания — не напоминаем: подтверждение только что ушло.
// СТАТУС. Кандидату после первого ушедшего напоминания — reminded (словарь контракта); статусы семей не трогаем.
// Напоминаем только встречам со статусом new / booked / reminded (или без статуса); прошедшие — никогда.
// Язык — карточки (en/es/ru; остальные — английский). Всё наружу — через lib/otpravka: DRY_RUN=1 — в журнал.
// Выключить у клиента — nastroyki.json: "napominaniya": {"vklyucheny": false} (поля нет — включены).

const linii = require('./linii');
const otpravka = require('./otpravka');
const { zapisat } = require('./zhurnal');
const { fraza } = require('./frazy');
const { htmlIzTeksta } = require('./http');
const { seychas, iso, korotko, chasy, denSdvig, yazykIli, POYAS } = require('./vremya');

const OTMETKI = [{ pole: 'napominanie_24', chasov: 24 }, { pole: 'napominanie_2', chasov: 2 }];
const OKNO_MS = 7.5 * 60000;
const SVEZHAYA_ZAPIS_MS = 60 * 60000;
const STATUSY = new Set(['new', 'booked', 'reminded']);
const VIDY = [
  { vid: 'kandidat', prefiks: 'kandidaty/', pole: 'sobesedovanie', tip: 'sobesedovanie' },
  { vid: 'semya', prefiks: 'semi/', pole: 'ocenka', tip: 'ocenka' },
];

function kontakt(vid, x) {
  if (vid.vid === 'semya') {
    const k = x.kontakt || {};
    return { imya: k.imya || null, telefon: linii.e164(k.telefon), email: k.email || x.email || null, yazyk: x.yazyk };
  }
  return { imya: x.imya || null, telefon: linii.e164(x.telefon), email: x.email || null, yazyk: x.yazyk };
}

// «today at 10:00 AM» · «tomorrow, Thu Oct 1, 10:00 AM» · «on Mon Oct 5, 10:00 AM» — по местной дате клиента.
function kogda(start, teper, y, poyas) {
  const den = denSdvig(start, 0, poyas);
  if (den === denSdvig(teper, 0, poyas)) return fraza('kogda_segodnya', y, chasy(start, y, poyas));
  if (den === denSdvig(teper, 1, poyas)) return fraza('kogda_zavtra', y, korotko(start, y, poyas));
  return fraza('kogda_data', y, korotko(start, y, poyas));
}

// С какого номера SMS: sms.ot клиента, иначе номер его линии найма (запись идёт с неё), иначе любой его номер.
function nomerOtpravki(klient) {
  const yavno = linii.e164(klient.sms && klient.sms.ot);
  if (yavno) return yavno;
  const svoi = linii.vseLinii().filter((l) => l.klient === klient.id && linii.nomerLinii(l));
  const l = svoi.find((x) => x.liniya === 'care-hiring') || svoi[0];
  return l ? linii.nomerLinii(l) : null;
}

async function smsSoglasie(st, telefon, x) {
  if (!telefon) return false;
  const z = await st.getJSON(`soglasiya/${telefon}`);
  if (z && (z.sms === true || z.sms === false)) return z.sms === true;
  return !!(x.soglasiya && x.soglasiya.sms === true);
}

const itogOtpravki = (r) => (r.dry_run ? 'dry_run' : r.uzhe ? 'uzhe' : 'otpravleno');

// Одно напоминание: канал, отправка, флаг во встрече, журнал. {kanal, rezultat}.
async function napomnit(st, klient, vid, klyuch, x, vstrecha, o, teper) {
  const poyas = klient.poyas || POYAS;
  const a = klient.nazvanie || '';
  const k = kontakt(vid, x);
  const y = yazykIli(k.yazyk);
  const start = Date.parse(vstrecha.start);
  const moment = start - o.chasov * 3600e3;
  const chto = fraza(vid.tip === 'ocenka' ? 'chto_ocenka' : 'chto_sobesedovanie', y).toLowerCase();
  const kogdaT = kogda(start, teper, y, poyas);
  const metka = `${klient.id}:${vstrecha.event_id || klyuch + ':' + vstrecha.start}:${o.chasov}`;
  let kanal = null, rezultat = null, sms = null, pismo = null;

  const zapisanoV = Date.parse(vstrecha.zapisano_v || '');
  if (Number.isFinite(zapisanoV) && zapisanoV > moment - SVEZHAYA_ZAPIS_MS) {
    rezultat = 'svezhaya_zapis';
  } else {
    if (await smsSoglasie(st, k.telefon, x)) {
      const r = await otpravka.sms(st, klient, { ot: nomerOtpravki(klient), komu: k.telefon, soglasie: true,
        tekst: fraza('napominanie_sms', y, a, chto, kogdaT), klyuchDubley: `napominanie-sms:${metka}`, kto: 'napominaniya', obekt: klyuch });
      sms = r.ok ? itogOtpravki(r) : r.pochemu;
      if (r.ok) { kanal = 'sms'; rezultat = sms; }
    } else sms = k.telefon ? 'net_soglasiya' : 'net_nomera';
    if (!kanal && k.email) {
      const tekstPisma = fraza('napominanie_tekst', y, k.imya, a, chto, kogdaT);
      const r = await otpravka.pismo(st, klient, { komu: [k.email], tema: fraza('napominanie_tema', y, a, chto, kogdaT),
        text: tekstPisma, html: htmlIzTeksta(tekstPisma), klyuchDubley: `napominanie-pismo:${metka}`, kto: 'napominaniya', obekt: klyuch });
      pismo = r.ok ? itogOtpravki(r) : r.pochemu;
      if (r.ok) { kanal = 'email'; rezultat = pismo; }
    } else if (!kanal) pismo = 'net_adresa';
    if (!kanal) rezultat = 'net_kanala';
  }

  const flag = { at: iso(teper, poyas), kanal, rezultat };
  await st.obnovit(klyuch, (z) => {
    const v = z && z[vid.pole];
    if (!v || v.start !== vstrecha.start || (v.event_id || null) !== (vstrecha.event_id || null) || v[o.pole]) return undefined;
    v[o.pole] = flag;
    if (vid.vid === 'kandidat' && kanal && z.status === 'booked') z.status = 'reminded';
    return z;
  });
  await zapisat(st, { kto: 'napominaniya', chto: kanal ? 'napominanie' : 'napominanie_net', obekt: klyuch,
                      detali: { chasov: o.chasov, tip: vid.tip, kanal, rezultat, sms, pismo, event_id: vstrecha.event_id || null,
                                start: vstrecha.start } }, { poyas });
  return { kanal, rezultat };
}

// Тик по одному клиенту: {vstrech, napomnili, bez_kanala} — сколько будущих встреч, сколько напоминаний ушло, сколько нет.
async function tik(st, klient, { teper = seychas() } = {}) {
  if (klient.napominaniya && klient.napominaniya.vklyucheny === false) return { propushcheno: 'vyklyucheny' };
  const itog = { vstrech: 0, napomnili: 0, bez_kanala: 0 };
  for (const vid of VIDY) {
    for (const { key, data: x } of await st.vse(vid.prefiks)) {
      const v = x && x[vid.pole];
      if (!v || !v.start || (x.status && !STATUSY.has(x.status))) continue;
      const start = Date.parse(v.start);
      if (!Number.isFinite(start) || start <= teper) continue;
      itog.vstrech++;
      for (const o of OTMETKI) {
        const moment = start - o.chasov * 3600e3;
        if (v[o.pole] || teper < moment - OKNO_MS || teper >= moment + OKNO_MS) continue;
        const r = await napomnit(st, klient, vid, key, x, v, o, teper);
        if (r.kanal) itog.napomnili++; else itog.bez_kanala++;
      }
    }
  }
  return itog;
}

module.exports = { OTMETKI, OKNO_MS, SVEZHAYA_ZAPIS_MS, tik, napomnit, kogda, nomerOtpravki };
