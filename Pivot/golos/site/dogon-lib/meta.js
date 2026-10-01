// Состояние чата: chat/<bc>/<chat_id>/meta и история chat/<bc>/<chat_id>/m/<message_id>.
//
// Запись meta — всегда через obnovitMeta(fn): перечитали СВЕЖУЮ версию прямо перед записью,
// применили только своё изменение, записали. Так фоновая функция, которая 10 секунд ждала модель,
// не затирает паузу, поставленную владельцем за эти 10 секунд. Без onlyIfMatch в Blobs 8.2.0
// это не атомарно (см. hranilishche.js), но окно гонки — миллисекунды, а не секунды.
//
// Сроки (скептик №7, ревью 15.09 №7): некупившим 12 месяцев от последнего изменения чата, оплатившим
// (кнопка «Оплатил») — 3 года, как «переписка по проекту» в разделе 11 privacy. Удаляет по этим срокам
// dogon-lib/obkhod.js (расписание tg-dogon раз в 10 минут, чистка — раз в сутки): чат целиком по meta.obnovleno, служебные ключи —
// по exp в самом JSON или по дате в ключе. Сроки служебных ключей — SROK_DNEY ниже, одно место правды.

const H = require('./hranilishche');

const seychas = () => (typeof global.__DOGON_NOW__ === 'number' ? global.__DOGON_NOW__ : Date.now());
const DEN_MS = 24 * 3600 * 1000;
const HRANIT_DNEY = () => +(process.env.DOGON_HRANIT_DNEY || 365);
const HRANIT_DNEY_KLIENTAM = () => +(process.env.DOGON_HRANIT_DNEY_KLIENTAM || 1095);

// Служебные ключи, дней. upd/schet/rashod чистятся по дате в ключе, остальные — по exp.
const SROK_DNEY = {
  upd: 7,             // upd/<дата>/<update_id> — дедуп апдейтов
  otvet: 7,           // otvet/<bc>/<chat>/<message_id> — «на это входящее уже отвечаем»
  ishodyashchee: 1,   // ishodyashchee/<bc>/<chat>/<sha1> — узнать эхо Веры
  media: 1,           // media/<bc>/<chat>/<media_group_id> — один ответ на альбом
  nadzor: 2,          // nadzor/<вид>/<bc>/<chat> — что проверить обходу (tg-dogon)
  zvonok_obrabotan: 7,
  schet: 90, rashod: 90,
  svyaz_vyklyuchena: 30,   // svyaz/<bc> с is_enabled=false
};
const exp = (vid, t = seychas()) => t + SROK_DNEY[vid] * DEN_MS;
// Что проверяет обход: zhdet — чат ждёт человека (горячий, жалоба, «позвать»); otvet — входящее ждёт ответа Веры.
const kNadzor = (vid, bc, chat) => `nadzor/${vid}/${bc}/${chat}`;

const kMeta = (bc, chat) => `chat/${bc}/${chat}/meta`;
const kSoobshchenie = (bc, chat, id) => `chat/${bc}/${chat}/m/${String(id).padStart(12, '0')}`;
const prefIstorii = (bc, chat) => `chat/${bc}/${chat}/m/`;

function novayaMeta({ bc, chat, from, status = 'novyy', t = seychas() }) {
  const u = from || chat || {};
  return {
    chat_id: chat && chat.id, bc,
    user: { id: u.id, first_name: String(u.first_name || '').slice(0, 64), username: u.username || '', language_code: u.language_code || '' },
    kod: null, razgovor: null, istochnik: null,
    status,
    soglasie: null,
    pauza_do: null, pauza_prichina: null,
    posl_vhod: null, posl_vera_t: null, posl_vladelec_t: null, okno_do: null,
    predstavilas: false, nuzhno_snova_predstavitsya: false,
    tseli: [], segment: '', tema: '', oplatil: false,
    kasaniy: 0, signal_t: {}, topic_id: null,
    limit: null, vyzovy: null, vybrosheno: 0,
    sozdano: t, obnovleno: t, exp: t + HRANIT_DNEY() * DEN_MS,
  };
}

async function chitatMeta(store, bc, chat) {
  return H.chitat(store, kMeta(bc, chat));
}

async function zapisatMeta(store, meta) {
  const t = seychas();
  meta.obnovleno = t;
  // Для глаз и выгрузок: чистка (obkhod.js) считает срок сама по obnovleno и oplatil.
  meta.exp = t + (meta.oplatil ? HRANIT_DNEY_KLIENTAM() : HRANIT_DNEY()) * DEN_MS;
  await H.pisat(store, kMeta(meta.bc, meta.chat_id), meta);
  return meta;
}

// fn(meta) меняет объект на месте; вернула false — ничего не пишем. meta нет — fn не зовём, вернём null.
async function obnovitMeta(store, bc, chat, fn) {
  let posl;
  for (let i = 0; i < 3; i++) {
    try {
      const m = await chitatMeta(store, bc, chat);
      if (!m) return null;
      if (fn(m) === false) return m;
      return await zapisatMeta(store, m);
    } catch (e) { posl = e; await H.pauza(global.__DOGON_BYSTRO__ ? 0 : 200 * (i + 1)); }
  }
  throw posl;
}

async function soxranitSoobshchenie(store, bc, chat, { id, kto, tip = 'text', text = '', t = seychas() }) {
  if (id == null) return;
  await H.pisat(store, kSoobshchenie(bc, chat, id), {
    id, kto, tip, text: String(text || '').slice(0, 4000), t, izmeneno: null,
    exp: t + HRANIT_DNEY() * DEN_MS,
  });
}

async function chitatSoobshchenie(store, bc, chat, id) {
  return H.chitat(store, kSoobshchenie(bc, chat, id));
}

// Последние n сообщений по порядку message_id (ключи дополнены нулями — сортировка строкой верна).
async function istoriya(store, bc, chat, n = 30) {
  const kluchi = (await H.spisok(store, prefIstorii(bc, chat))).sort().slice(-n);
  const out = [];
  for (const k of kluchi) {
    const z = await H.chitat(store, k).catch(() => null);
    if (z) out.push(z);
  }
  return out;
}

async function steretIstoriyu(store, bc, chat) {
  const kluchi = await H.spisok(store, prefIstorii(bc, chat));
  for (const k of kluchi) await H.steret(store, k).catch(() => {});
  return kluchi.length;
}

module.exports = {
  seychas, DEN_MS, HRANIT_DNEY, HRANIT_DNEY_KLIENTAM, SROK_DNEY, exp, kNadzor, kMeta, kSoobshchenie, novayaMeta, chitatMeta, zapisatMeta, obnovitMeta,
  soxranitSoobshchenie, chitatSoobshchenie, istoriya, steretIstoriyu,
};
