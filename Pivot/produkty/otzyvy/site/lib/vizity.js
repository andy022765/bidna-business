// Откуда берутся визиты.
//
// 1. КАЛЕНДАРЬ ЗАПИСЕЙ ВЕРЫ. Событие — источник правды о времени и статусе: время читаем из календаря
//    в момент отправки (владелец мог перенести), отменённое и удалённое пропускаем, «no show»
//    в названии — неявка. Почту берём ТОЛЬКО из метки `otzyvy-vizit:<event_id>` в хранилище Веры
//    (golos-pisma, только чтение) и ТОЛЬКО с pochta_podtverzhdena: true — это адрес, на который
//    pismo.js реально отправил подтверждение записи после чтения по буквам и «да» (патч dlya-very/).
//    Адрес, названный при записи (строка «Почта:/Email:» в описании события), — услышанный моделью
//    и никем не подтверждённый: по нему НЕ шлём (ревью 29.09 — «письмо не тому»). Два разных
//    подтверждённых адреса на одну запись (pochta_neodnoznachna) — тоже не шлём: не знаем, чей визит.
//    Без метки, но с подписью Веры в описании — визит Веры (записи до патча): в журнал, без почты.
//    Остальные события календаря не трогаем. Режим «все события с почтой гостя» — только флагом
//    паспорта kalendar_vse_s_gostem и только с согласия владельца (PLAN-V1 п. 1).
// 2. ФОРМА ИЛИ CSV ОТ ВЛАДЕЛЬЦА (бизнес без Веры, пилот): почта, имя, когда закончился визит.
//
// Ключ служебного аккаунта для календаря — в хранилище этого сайта (`kalendar-klyuch/sa`), как у Веры.

const G = require('./gkal');
const H = require('./hranilishche');
const V = require('./vremya');
const { POCHTA } = require('./kartochka');

const PODPIS_VERY = /Записано голосовым агентом Верой\.|Booked by Vera, the voice agent\./;
// Неявка: «no show», «no-show», «noshow», «неявка», «не пришёл/пришла/пришли». Только в названии события:
// так сказано владельцу (PLAN-DLYA-ANDREYA п. 2), а в описании Вера пишет слова звонившего.
const NEYAVKA = /\bno[\s_-]?show\b|неявк|не\s*приш(ёл|ел|ла|ли)/i;

const enc = encodeURIComponent;

function konecSobytiya(e) {
  const s = e && e.end && e.end.dateTime;
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : null;   // событие на весь день (end.date) — не визит
}

// Что с событием сейчас: ok · otmena · neyavka.
function sostoyanie(e) {
  if (!e || e.status === 'cancelled') return 'otmena';
  if (NEYAVKA.test(String(e.summary || ''))) return 'neyavka';
  return 'ok';
}

function pochtaIzOpisaniya(opisanie) {
  const m = /(?:^|\n)\s*(?:Email|Почта):\s*([^\s<>]+@[^\s<>]+)/i.exec(String(opisanie || ''));
  const p = m ? m[1].trim().toLowerCase().replace(/[.,;]+$/, '') : '';
  return POCHTA.test(p) ? p : '';
}
function imyaIzOpisaniya(opisanie) {
  const m = /(?:^|\n)\s*(?:Name|Имя):\s*([^\n]{1,60})/i.exec(String(opisanie || ''));
  return m ? m[1].trim() : '';
}
function gostSobytiya(e) {
  for (const a of (e && e.attendees) || []) {
    if (a.self || a.organizer || a.resource) continue;
    const p = String(a.email || '').trim().toLowerCase();
    if (POCHTA.test(p)) return { pochta: p, imya: String(a.displayName || '').slice(0, 60) };
  }
  return null;
}

// Все события календаря в окне [ot, do_]. Удалённые тоже (showDeleted): удаление — это исключение,
// его надо увидеть и записать в журнал. null — календарь не прочитался.
async function sobytiya(kalendar, ot, do_) {
  const out = new Map();
  let pageToken = '';
  for (let str = 0; str < 5; str++) {
    const q = new URLSearchParams({ timeMin: new Date(ot).toISOString(), timeMax: new Date(do_).toISOString(),
      singleEvents: 'true', showDeleted: 'true', maxResults: '250' });
    if (pageToken) q.set('pageToken', pageToken);
    let r;
    try { r = await G.gapi(`/calendars/${enc(kalendar)}/events?${q}`); }
    catch (e) { console.log('[vizity] календарь не прочитан:', e.message); return null; }
    if (r.kod !== 200) { console.log('[vizity] календарь ответил', r.kod, JSON.stringify(r.telo).slice(0, 200)); return null; }
    for (const e of r.telo.items || []) if (e && e.id) out.set(e.id, e);
    pageToken = r.telo.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

// Одно событие по id: для визита, который уехал из окна списка (перенесли далеко). 404/410 — удалено.
async function sobytie(kalendar, id) {
  let r;
  try { r = await G.gapi(`/calendars/${enc(kalendar)}/events/${enc(id)}`); }
  catch (e) { console.log('[vizity] событие не прочитано:', id, e.message); return { oshibka: true }; }
  if (r.kod === 404 || r.kod === 410) return { udaleno: true };
  if (r.kod !== 200) return { oshibka: true };
  return { e: r.telo };
}

// Метка визита, которую ставит Вера (патч dlya-very/). undefined — хранилище Веры не прочиталось.
async function metkaVery(k, eventId) {
  const s = H.chuzhoy('golos-pisma', k.istochniki.vera.site_id);
  if (!s) return undefined;
  return H.vzyatStrogo(s, `otzyvy-vizit:${eventId}`);
}

// Почта из метки Веры: только подтверждённая и однозначная. { pochta } или { pochta: '', pochta_prichina }.
function pochtaIzMetki(metka, opisanie) {
  const p = String(metka.pochta || '').trim().toLowerCase();
  if (metka.pochta_neodnoznachna) return { pochta: '', pochta_prichina: 'pochta_neodnoznachna' };
  if (metka.pochta_podtverzhdena === true && POCHTA.test(p)) return { pochta: p };
  return { pochta: '', pochta_prichina: (POCHTA.test(p) || pochtaIzOpisaniya(opisanie)) ? 'pochta_ne_podtverzhdena' : '' };
}

// Визит ли это и чей: { pochta, imya, yazyk, istochnik, konec } или null (не наше событие).
// undefined — не смогли решить (хранилище Веры молчит): решим на следующем прогоне.
async function razobratSobytie(k, e) {
  const metka = await metkaVery(k, e.id);
  if (metka === undefined) return undefined;
  if (metka) {
    // Метка из другого календаря (id совпал случайно или паспорт указывает не туда) — не наша запись.
    if (metka.kalendar && metka.kalendar !== k.istochniki.vera.kalendar_id) {
      console.log('[vizity] метка Веры из другого календаря, пропускаю:', k.klient);
      return null;
    }
    return Object.assign({ istochnik: 'vera', imya: metka.imya || imyaIzOpisaniya(e.description),
             yazyk: metka.yazyk === 'ru' ? 'ru' : (metka.yazyk === 'en' ? 'en' : ''),
             konec: Date.parse(metka.konec || '') || null }, pochtaIzMetki(metka, e.description));
  }
  if (PODPIS_VERY.test(String(e.description || ''))) {
    // Запись до патча: адрес в описании не подтверждён (его услышала модель при записи) — не шлём.
    return { istochnik: 'vera', pochta: '', pochta_prichina: pochtaIzOpisaniya(e.description) ? 'pochta_ne_podtverzhdena' : '',
             imya: imyaIzOpisaniya(e.description), yazyk: /Записано голосовым агентом Верой\./.test(e.description) ? 'ru' : 'en' };
  }
  if (k.istochniki.kalendar_vse_s_gostem) {
    const g = gostSobytiya(e);
    if (g) return { istochnik: 'kalendar', pochta: g.pochta, imya: g.imya, yazyk: '' };
  }
  return null;
}

// ── форма и CSV ─────────────────────────────────────────────────────────────
const DATA_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/;
const DATA_US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i;

// Время конца визита по поясу бизнеса. Только дата — считаем полдень.
function razobratVremya(s, poyas) {
  const v = String(s || '').trim();
  let g, m, d, ch = 12, mi = 0, x;
  if ((x = DATA_ISO.exec(v))) { g = +x[1]; m = +x[2]; d = +x[3]; if (x[4] != null) { ch = +x[4]; mi = +x[5]; } }
  else if ((x = DATA_US.exec(v))) {
    m = +x[1]; d = +x[2]; g = +x[3];
    if (x[4] != null) { ch = +x[4]; mi = +x[5]; const ap = (x[6] || '').toLowerCase(); if (ap === 'pm' && ch < 12) ch += 12; if (ap === 'am' && ch === 12) ch = 0; }
  } else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || ch > 23 || mi > 59) return null;
  const t = V.izMestnogo(g, m, d, ch, mi, poyas);
  // 31 февраля и подобное: Date молча переносит на март — ловим обратной проверкой даты.
  const naz = V.mestnoe(new Date(t), poyas);
  if (naz.god !== g || naz.mes !== m || naz.den !== d) return null;
  return t;
}

// Строки CSV: «почта, имя, когда» в любом порядке, разделитель — запятая, точка с запятой или табуляция.
function razobratCSV(tekst, poyas, predel) {
  const stroki = [], oshibki = [];
  const vse = String(tekst || '').replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < vse.length; i++) {
    if (stroki.length + oshibki.length >= predel) { oshibki.push({ stroka: i + 1, pochemu: `больше ${predel} строк за раз — остальное не принято` }); break; }
    const yach = vse[i].split(/[,;\t]/).map(s => s.trim().replace(/^"|"$/g, ''));
    const pochta = (yach.find(c => POCHTA.test(c.toLowerCase())) || '').toLowerCase();
    if (!pochta) { if (i > 0 || !/mail|почт/i.test(vse[i])) oshibki.push({ stroka: i + 1, pochemu: 'нет почты' }); continue; }
    let konec = null, imya = '';
    for (const c of yach) {
      if (!c || c.toLowerCase() === pochta) continue;
      const t = razobratVremya(c, poyas);
      if (t != null && konec == null) { konec = t; continue; }
      if (!imya && !/\d/.test(c)) imya = c.slice(0, 60);
    }
    if (konec == null) { oshibki.push({ stroka: i + 1, pochemu: 'нет даты визита (ГГГГ-ММ-ДД ЧЧ:ММ или ММ/ДД/ГГГГ)' }); continue; }
    stroki.push({ pochta, imya, konec });
  }
  return { stroki, oshibki };
}

module.exports = { sobytiya, sobytie, razobratSobytie, sostoyanie, konecSobytiya, pochtaIzOpisaniya, gostSobytiya,
                   razobratVremya, razobratCSV, NEYAVKA, PODPIS_VERY, metkaVery };
