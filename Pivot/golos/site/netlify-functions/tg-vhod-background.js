// Доводчик: вебхук Telegram. Бот подключён к аккаунту @business_int_dna через Telegram Business
// и от его имени продолжает переписку после звонка или письма Веры.
//
// Фоновая функция (суффикс -background): Netlify сразу отвечает Telegram 202, работа идёт до 15 минут.
// setWebhook смотрит прямо сюда (SPEC §3, вариант A).
//
// ПОРЯДОК (SPEC §3 с правками скептика и ревью 15.09):
//   0. try/catch ВЫШЕ ВСЕГО, включая секрет и Blobs (№5). Ошибка → сигнал ОШИБКА прямым вызовом
//      Telegram, без Blobs, с именем, @username и chat_id из самого апдейта (ревью №11).
//      ПОВТОР: если клиенту в этой попытке ничего не ушло, исключение бросаем наружу — Netlify повторяет
//      фоновую функцию через 1 и ещё через 2 минуты (docs.netlify.com, Background Functions; живьём
//      не проверено). Отметка upd получает s:'oshibka', и повтор проходит дедуп сразу, без 90 с.
//      Что-то клиенту уже ушло — не бросаем: второй ответ хуже, чем ОШИБКА в группе.
//   1. Секрет X-Telegram-Bot-Api-Secret-Token, timingSafeEqual. IP Telegram — только в лог.
//   2. Дедуп upd/<дата>/<update_id> = {s:'v_rabote'|'oshibka'|'gotovo', t, popytka} (№5): v_rabote старше
//      90 с без gotovo — первая попытка умерла на полпути (убили по времени), пропускаем. Не больше 3 попыток.
//   3. По типу апдейта; входящее — obrabotat(). Рубильник nastroyki.vklyuchen глушит ТОЛЬКО ответы Веры
//      (ревью №9): реплики владельца, эхо, правки и удаления пишутся и при выключенной Вере.
//
// ЧТО РЕШЕНО (Андрей не возразил, 15.09):
//   - чатам без кода не отвечаем (DOGON_REZHIM=kod), их текст НЕ храним (№2);
//   - метки сайта S-OPL/S-ANK/S-STAT и текст статьи → статус chelovek навсегда (№2);
//   - файл или фото от неопознанного → chelovek, без шаблона (№2);
//   - второй аккаунт по тому же коду → шаблон согласия с кнопками, до них модель не зовём (№3);
//   - goryachiy / pozvat_cheloveka / zhaloba → статус zhdem_cheloveka: Вера молчит до «Вернуть Веру» (№4);
//   - исходящее владельца в чате без привязки → chelovek навсегда, а не пауза (№4);
//   - эхо Веры узнаём по хэшу текста ishodyashchee/<bc>/<chat>/<sha1>, записанному ДО отправки,
//     и по известному message_id — даже если sender_business_bot не придёт (№4);
//   - передача Андрею всегда со ссылкой razbor «пока — вот с чего начинают» (№9);
//   - потолки: DOGON_VYZOVOV_V_SUTKI=60, 25 на чат в сутки, DOGON_USD_V_SUTKI по фактическому usage (№10);
//   - касаний нет (DOGON_DOGONYAT=0): ochered/* не пишем; письма после суток нет (№12);
//   - надзор (ревью №12): чат уходит к людям → nadzor/zhdet/*, входящее ждёт Веру → nadzor/otvet/*.
//     Обход tg-dogon раз в 10 минут шлёт «ГОРЯЧИЙ/ЖДЁТ БЕЗ ОТВЕТА» (30 мин) и «НЕ ОТВЕТИЛИ» (3 мин);
//   - альбом и серия голосовых: один шаблон на альбом, одна обработка из одновременных и не чаще раза
//     в 10 минут на чат (ревью №10);
//   - копий реплик в группе нет (DOGON_KOPII=0), только сигналы и карточка (№6);
//   - пауза после вмешательства владельца — DOGON_PAUZA_CHASOV=24.
//
// readBusinessMessage не вызываем: у Андрея не должны пропадать непрочитанные.
//
// env: TG_BOT_TOKEN, TG_WEBHOOK_SECRET, DOGON_GRUPPA, DOGON_ADMINY, ANTHROPIC_API_KEY_DOGON, DOGON_MODEL,
//      DOGON_REZHIM, DOGON_PAUZA_CHASOV, DOGON_VYZOVOV_V_SUTKI, DOGON_VYZOVOV_NA_CHAT, DOGON_USD_V_SUTKI,
//      DOGON_ANDREY_PISHET, GOLOS_MESTA_URL, EV_BLOBS_TOKEN, SITE_ID.

const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const { getStore } = require('@netlify/blobs');
const H = require('../dogon-lib/hranilishche');
H.podklyuchitBlobs(getStore);
const tg = require('../dogon-lib/tg');
const KOD = require('../dogon-lib/kod');
const { ssylkaDlya } = require('../dogon-lib/ssylki');
const K = require('../dogon-lib/kontekst');
const mozgi = require('../dogon-lib/mozgi');
const { proverit } = require('../dogon-lib/validator');
const SH = require('../dogon-lib/shablony');
const S = require('../dogon-lib/signaly');
const M = require('../dogon-lib/meta');

const { seychas, DEN_MS } = M;
const OK = { statusCode: 200, body: '' };
const den = (t) => new Date(t).toISOString().slice(0, 10);
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');
const ZAKRYTYE = ['stop', 'lichnyy', 'udalen', 'chelovek'];
const VHODYASHCHIH_V_CHAS = 20;
const VYZOVOV_V_SUTKI = () => +(process.env.DOGON_VYZOVOV_V_SUTKI || 60);
const VYZOVOV_NA_CHAT = () => +(process.env.DOGON_VYZOVOV_NA_CHAT || 25);
const USD_V_SUTKI = () => +(process.env.DOGON_USD_V_SUTKI || 3);
const MAX_POPYTOK = 3;   // первая + два повтора Netlify

// Состояние одной обработки апдейта: сколько отправок клиенту уже было. AsyncLocalStorage, а не
// переменная модуля: в прогонах несколько апдейтов обрабатываются параллельно в одном процессе.
const VYZOV = new AsyncLocalStorage();

// ---------- вход ----------

function sekretVeren(h) {
  const nash = process.env.TG_WEBHOOK_SECRET || '';
  const ih = h['x-telegram-bot-api-secret-token'] || h['X-Telegram-Bot-Api-Secret-Token'] || '';
  if (!nash || !ih) return false;
  const a = Buffer.from(nash), b = Buffer.from(String(ih));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 149.154.160.0/20 и 91.108.4.0/22 — только для лога, не для блокировки (адреса Telegram меняются).
function ipTelegram(ip) {
  const chislo = (s) => { const p = String(s).split('.').map(Number); return p.length === 4 && p.every(x => x >= 0 && x < 256) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; };
  const n = chislo(ip);
  if (n == null) return false;
  const v = (baza, bit) => { const mask = (~0 << (32 - bit)) >>> 0; return ((n & mask) >>> 0) === ((chislo(baza) & mask) >>> 0); };
  return v('149.154.160.0', 20) || v('91.108.4.0', 22);
}

exports.handler = async (event) => {
  const ctx = { klientu: 0 };
  return VYZOV.run(ctx, () => vhod(event, ctx));
};

// Кто в чате — из самого апдейта, без Blobs: для сигнала ОШИБКА, когда хранилище лежит.
// В личном бизнес-чате chat — всегда собеседник, даже в исходящем от аккаунта.
function ktoIzApdeyta(upd) {
  if (!upd) return null;
  const cq = upd.callback_query;
  const m = upd.business_message || upd.edited_business_message || upd.deleted_business_messages || (cq && cq.message);
  if (m && m.chat && (m.chat.type === 'private' || m.business_connection_id)) {
    return { chat_id: m.chat.id, first_name: m.chat.first_name || '', username: m.chat.username || '' };
  }
  const data = cq ? String(cq.data || '') : '';
  if (data.startsWith('a:') && data.split(':')[2]) return { chat_id: data.split(':')[2] };
  return null;
}

async function vhod(event, ctx) {
  let upd = null, store = null, otmetka = null;
  try {
    const h = event.headers || {};
    const ip = String(h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || '').trim();
    if (!sekretVeren(h)) { console.log('[dogon] отбой: секрет не сошёлся', ip || 'без ip'); return OK; }
    if (ip && !ipTelegram(ip)) console.log('[dogon] секрет верный, но IP не из сетей Telegram:', ip);

    try { upd = JSON.parse(event.body || '{}'); } catch (_) { console.log('[dogon] тело не JSON'); return OK; }
    if (!upd || typeof upd.update_id !== 'number') return OK;

    store = H.hranilishche();
    if (!store) throw new Error('хранилище Blobs не поднялось (EV_BLOBS_TOKEN/SITE_ID?)');

    otmetka = await dedup(store, upd.update_id);
    if (!otmetka) return OK;

    await razobrat(store, upd);
    await H.pisat(store, otmetka.k, { s: 'gotovo', t: seychas(), popytka: otmetka.popytka, exp: M.exp('upd') }).catch(() => {});
  } catch (e) {
    console.log('[dogon] упало:', tg.chisto((e && e.stack) || e));
    const popytka = otmetka ? otmetka.popytka : 1;
    const povtorit = !!upd && typeof upd.update_id === 'number' && ctx.klientu === 0 && popytka < MAX_POPYTOK;
    if (store && otmetka) await H.pisat(store, otmetka.k, { s: 'oshibka', t: seychas(), popytka, exp: M.exp('upd') }).catch(() => {});
    // Сигнал — на первой попытке и на последней, чтобы три повтора не дали три одинаковых сообщения.
    // Хранилище лежит целиком — номер попытки не узнать, сигнал придёт на каждой (не больше трёх).
    if (popytka === 1 || !povtorit) {
      const chto = povtorit
        ? `Попытка ${popytka} из ${MAX_POPYTOK}: Netlify повторит через 1–2 минуты. Ответ не появится — ответьте из аккаунта business_int_dna.`
        : ctx.klientu
          ? 'Клиенту в этой попытке уже что-то ушло — повторять не буду. Проверьте чат из аккаунта business_int_dna.'
          : `Попыток было ${popytka}, больше не повторяю. Ответьте из аккаунта business_int_dna.`;
      await S.oshibkaPryamo(`Апдейт ${upd && upd.update_id}: ${e && e.message}\n${chto}`, ktoIzApdeyta(upd)).catch(() => {});
    }
    if (povtorit) throw e;
  }
  return OK;
}

// get-затем-set (Blobs 8.2.0 без onlyIfNew). Telegram не шлёт один апдейт параллельно, а повтор после
// сбоя приходит минутами позже — этого окна достаточно. Возвращает {k, popytka} или null — «не обрабатывать».
async function dedup(store, id) {
  const t = seychas();
  const k = `upd/${den(t)}/${id}`;
  const kluchi = [k];
  if (t % DEN_MS < 10 * 60000) kluchi.push(`upd/${den(t - DEN_MS)}/${id}`);   // повтор через полночь UTC
  for (const kk of kluchi) {
    const z = await H.chitat(store, kk);
    if (!z) continue;
    const popytka = (z.popytka || 1) + 1;
    if (z.s === 'gotovo') { console.log('[dogon] повтор апдейта, уже готово', id); return null; }
    if (z.s !== 'oshibka' && t - (z.t || 0) < 90000) { console.log('[dogon] апдейт ещё в работе', id); return null; }
    if (popytka > MAX_POPYTOK) { console.log('[dogon] апдейт: попытки кончились', id); return null; }
    console.log('[dogon] апдейт', id, z.s === 'oshibka' ? 'упал в прошлый раз' : 'завис без gotovo больше 90 с', '— попытка', popytka);
    await H.pisat(store, kk, { s: 'v_rabote', t, popytka, exp: M.exp('upd', t) });
    return { k: kk, popytka };
  }
  await H.pisat(store, k, { s: 'v_rabote', t, popytka: 1, exp: M.exp('upd', t) });
  return { k, popytka: 1 };
}

async function nastroyki(store) {
  const z = (await H.chitat(store, 'nastroyki').catch(() => null)) || {};
  return {
    vklyuchen: z.vklyuchen !== false,
    rezhim: z.rezhim || process.env.DOGON_REZHIM || 'kod',
    pauza_chasov: +(z.pauza_chasov || process.env.DOGON_PAUZA_CHASOV || 24),
  };
}

async function schet(store, sobytie) {
  const t = seychas();
  await H.pisatStroku(store, `schet/${den(t)}/${sobytie}/${t}-${crypto.randomBytes(3).toString('hex')}`, '').catch(() => {});
}

async function razobrat(store, upd) {
  if (upd.business_connection) return svyaz(store, upd.business_connection, true);
  if (upd.callback_query) return knopka(store, upd.callback_query);
  if (upd.message) return komanda(store, upd.message);

  // Рубильник проверяют obrabotat (перед ответом Веры) и knopkaKlienta. Правки, удаления, реплики владельца
  // и эхо пишутся всегда: иначе после /start_vse Вера не знает, что Андрей уже говорил, и отвечает поверх (ревью №9).
  const nastr = await nastroyki(store);
  if (upd.business_message) return obrabotat(store, upd.business_message, nastr);
  if (upd.edited_business_message) return pravka(store, upd.edited_business_message);
  if (upd.deleted_business_messages) return udalenieVTelegram(store, upd.deleted_business_messages);
}

// ---------- подключение ----------

async function svyaz(store, bcObj, sSignalom) {
  const t = seychas();
  const k = `svyaz/${bcObj.id}`;
  const bylo = sSignalom ? await H.chitat(store, k) : null;
  const zapis = {
    id: bcObj.id,
    user_id: bcObj.user && bcObj.user.id,
    username: (bcObj.user && bcObj.user.username) || '',
    user_chat_id: bcObj.user_chat_id,
    rights: bcObj.rights || {},
    is_enabled: bcObj.is_enabled !== false,
    t,
  };
  await H.pisat(store, k, zapis);
  if (!sSignalom) return zapis;

  const mozhetOtvechat = !!zapis.rights.can_reply;
  const pomenyalos = !bylo || bylo.is_enabled !== zapis.is_enabled || !!(bylo.rights || {}).can_reply !== mozhetOtvechat;
  if (pomenyalos) {
    const lishnie = Object.keys(zapis.rights).filter(r => zapis.rights[r] && r !== 'can_reply');
    await S.signal('podklyuchenie', { stroki: [
      `Аккаунт: ${zapis.username ? '@' + zapis.username : zapis.user_id}`,
      `Подключение: ${zapis.is_enabled ? 'включено' : 'ВЫКЛЮЧЕНО'} · отвечать: ${mozhetOtvechat ? 'да' : 'НЕТ'}`,
      lishnie.length ? `Лишние права (нужно только «Отвечать на сообщения»): ${lishnie.join(', ')}` : '',
      (!zapis.is_enabled || !mozhetOtvechat) ? 'Вера в чатах молчит, пока подключение не вернут.' : '',
    ] });
  }
  return zapis;
}

async function poluchitSvyaz(store, bc) {
  const sv = await H.chitat(store, `svyaz/${bc}`);
  if (sv) return sv;
  const d = await tg.vyzov('getBusinessConnection', { business_connection_id: bc });
  if (d && d.ok && d.result && d.result.id && d.result.user) return svyaz(store, d.result, false);
  return null;
}

// ---------- сообщение ----------

const TIPY = ['text', 'voice', 'video_note', 'audio', 'photo', 'video', 'document', 'sticker', 'animation', 'contact', 'location', 'poll'];
function tipSoobshcheniya(msg) {
  for (const t of TIPY) if (msg[t] != null) return t;
  return 'drugoe';
}
function tekstSoobshcheniya(msg) {
  if (msg.text) return String(msg.text);
  if (msg.caption) {
    const pometka = { photo: '[фото]', video: '[видео]', document: '[файл]', audio: '[аудио]', animation: '[анимация]' }[tipSoobshcheniya(msg)] || '[вложение]';
    return `${pometka} ${msg.caption}`;
  }
  return '';
}

async function obrabotat(store, msg, nastr) {
  const bc = msg.business_connection_id;
  const chat = msg.chat || {};
  const chatId = chat.id;
  if (!bc || chatId == null || !msg.from) return;
  if (chat.type && chat.type !== 'private') return;
  const t = seychas();
  const tip = tipSoobshcheniya(msg);
  const text = tekstSoobshcheniya(msg);
  const sv = await poluchitSvyaz(store, bc);

  // 1. Эхо собственной отправки бота.
  if (msg.sender_business_bot) { await ekho(store, bc, chatId, msg, text); return; }

  // 2. Исходящее от аккаунта. В личном чате chat.id — это собеседник, поэтому from.id ≠ chat.id
  //    значит «написал аккаунт», даже если svyaz не прочиталась.
  const otAkkaunta = (sv && msg.from.id === sv.user_id) || msg.from.id !== chatId;
  if (otAkkaunta) return iskhodyashchee(store, bc, chatId, msg, text, tip, nastr);

  // 3. Входящее от человека.
  let meta = await M.chitatMeta(store, bc, chatId);
  if (meta && ZAKRYTYE.includes(meta.status)) { console.log('[dogon] чат закрыт для Веры:', meta.status); return; }

  // Альбом: Telegram шлёт отдельный апдейт на каждый элемент с общим media_group_id (ревью №10).
  // Отвечает один — элемент с подписью, иначе первый записавшийся. Остальные — только в историю привязанного чата.
  if (msg.media_group_id && !(await vedushchiyVAlbome(store, bc, chatId, msg, t))) {
    if (meta && (meta.kod || meta.soglasie))
      await M.soxranitSoobshchenie(store, bc, chatId, { id: msg.message_id, kto: 'klient', tip, text: text.slice(0, 4000), t });
    return;
  }

  if (!meta || !(meta.kod || meta.soglasie)) {
    meta = await opoznat(store, bc, msg, text, tip, meta, nastr);
    if (!meta) return;
  }

  // 4. Чат наш — пишем историю (обрезаем длинное до 4000 знаков, SPEC §5 строка 5).
  await M.soxranitSoobshchenie(store, bc, chatId, { id: msg.message_id, kto: 'klient', tip, text: text.slice(0, 4000), t });
  const yaz = SH.yazyk(text, meta.user && meta.user.language_code);

  // 5. Флуд: больше 20 входящих в час — молчим до конца часа.
  let flood = false, sigFlood = false;
  meta = await M.obnovitMeta(store, bc, chatId, (m) => {
    const chas = new Date(t).toISOString().slice(0, 13);
    if (!m.limit || m.limit.chas !== chas) m.limit = { chas, n: 0 };
    m.limit.n++;
    if (m.limit.n > VHODYASHCHIH_V_CHAS) { flood = true; sigFlood = S.mozhno(m, 'flood', 60); }
    m.yazyk = yaz;
  });
  if (!meta) return;
  if (flood) {
    if (sigFlood) await S.signal('limit', { meta, stroki: [`Больше ${VHODYASHCHIH_V_CHAS} сообщений за час — Вера молчит до конца часа.`] });
    return;
  }

  // Рубильник (/stop_vse): чаты ведут люди. История записана, Вера не отвечает и сигналов не шлёт.
  if (!nastr.vklyuchen) { console.log('[dogon] рубильник выключен — Вера не отвечает', chatId); return; }

  // 6. Подключение выключено или нет права отвечать — ничего не шлём, сигнал раз в сутки.
  if (!sv || sv.is_enabled === false || !(sv.rights && sv.rights.can_reply)) {
    let s = false;
    meta = await M.obnovitMeta(store, bc, chatId, (m) => { s = S.mozhno(m, 'net_prav', 24 * 60); });
    if (s) await S.signal(sv ? 'podklyuchenie' : 'oshibka', { meta, stroki: [sv
      ? 'Подключение выключено или нет права «Отвечать» — Вера молчит. Ответьте из аккаунта сами.'
      : 'Не получилось узнать подключение (getBusinessConnection) — Вера молчит.'] });
    return;
  }

  // 7. Пауза владельца или чат ждёт человека.
  if (meta.pauza_do && meta.pauza_do > t) {
    let s = false;
    meta = await M.obnovitMeta(store, bc, chatId, (m) => { s = S.mozhno(m, 'v_pauze', 30); });
    if (s) await S.signal('v_pauze', { meta, stroki: [`Пауза до ${K.vremyaNY(meta.pauza_do)} по Нью-Йорку (${meta.pauza_prichina === 'knopka' ? 'кнопка' : 'писал владелец'}). Вера молчит.`] });
    return;
  }
  if (meta.status === 'zhdem_cheloveka') {
    let s = false;
    meta = await M.obnovitMeta(store, bc, chatId, (m) => { s = S.mozhno(m, 'zhdet', 30); });
    if (s) await S.signal('zhdet', { meta, stroki: ['Вера передала чат людям и молчит до «Вернуть Веру».', meta.ne_otvetila ? `Не ответила: ${meta.ne_otvetila}` : ''] });
    return;
  }

  // 8. Согласие (второй аккаунт по коду): до «да» модель не зовём.
  if (!meta.soglasie) {
    const r = await soglasieTekstom(store, meta, text, yaz);
    if (r !== 'da') return;
    meta = await M.chitatMeta(store, bc, chatId);
  }

  // 9. Не текст. Стикер и одно эмодзи — без ответа.
  if (tip === 'sticker' || (tip === 'text' && SH.odnoEmodzi(text))) return;
  const golos = ['voice', 'video_note', 'audio'].includes(tip);
  if (golos || (tip !== 'text' && !msg.caption)) {
    // Шаблон не чаще раза в 10 минут на чат: три голосовых подряд — одна просьба, а не три (ревью №10).
    // Троттлинг в meta — get-затем-set и при ОДНОВРЕМЕННЫХ апдейтах не срабатывает, поэтому сперва метка
    // «одна обработка на пачку»: остальные молчат (содержимое всё равно не открываем, история записана).
    if (!(await odinVPachke(store, `media/${bc}/${chatId}/ne-tekst`, msg.message_id, t))) return;
    let shablon = false, s = false;
    const m2 = await M.obnovitMeta(store, bc, chatId, (m) => { shablon = S.mozhno(m, 'shablon_ne_tekst', 10); s = S.mozhno(m, 'ne_tekst', 30); });
    if (shablon) await otpravit(store, m2 || meta, SH.sh(golos ? 'golos' : 'fayl', yaz));
    if (s) await S.signal('ne_tekst', { meta: m2, stroki: [`Прислал: ${tip}. ${shablon ? 'Вера попросила написать текстом' : 'Вера промолчала (просьбу писать текстом уже отправляла)'}, содержимое не открывала.`] });
    return;
  }

  // 10. Ответ Веры.
  await zapustitOtvet(store, bc, chatId, msg.message_id, nastr);
}

// Один ответ на альбом (ревью №10). Blobs 8.2.0 без onlyIfNew, поэтому «записать — подождать — перечитать»:
// параллельные элементы все пишут метку, после паузы каждый видит последнюю запись, и отвечает только её хозяин.
// Подпись важнее. Элемент без подписи мог перезаписать метку элемента с подписью (оба прочитали «пусто»),
// поэтому в две фазы: после первой паузы элемент с подписью возвращает метку себе, а элемент без подписи
// ждёт вторую паузу и перечитывает ещё раз — подписанный к этому времени уже забрал метку.
async function vedushchiyVAlbome(store, bc, chatId, msg, t) {
  const k = `media/${bc}/${chatId}/${msg.media_group_id}`;
  const id = msg.message_id;
  const podpis = !!msg.caption;
  const moya = () => H.pisat(store, k, { id, podpis, t, exp: M.exp('media', t) });
  const chitat = () => H.chitat(store, k).catch(() => null);
  const pauza = () => H.pauza(global.__DOGON_BYSTRO__ ? 0 : 1500);

  const z = await chitat();
  if (!z || (podpis && !z.podpis)) await moya();
  await pauza();
  const z2 = await chitat();
  let da;
  if (podpis) {
    // Метку перебил элемент без подписи — забираем обратно. Перебил другой подписанный — отвечает он.
    if (z2 && z2.podpis && z2.id !== id) da = false;
    else { if (!z2 || z2.id !== id) await moya(); da = true; }
  } else {
    da = !!z2 && z2.id === id && !z2.podpis;
    if (da) { await pauza(); const z3 = await chitat(); da = !!z3 && z3.id === id && !z3.podpis; }
  }
  if (!da) console.log('[dogon] элемент альбома', id, '— отвечает другой');
  return da;
}

// Одна обработка из одновременных (голосовые, файлы подряд). Та же манера «записать — подождать — перечитать»,
// что у альбома, но без приоритета подписи и с окном: метка старше минуты — уже не эта пачка.
async function odinVPachke(store, k, id, t, oknoMs = 60000) {
  const z = await H.chitat(store, k).catch(() => null);
  if (!z || t - (z.t || 0) > oknoMs) await H.pisat(store, k, { id, t, exp: M.exp('media', t) });
  await H.pauza(global.__DOGON_BYSTRO__ ? 0 : 1500);
  const z2 = await H.chitat(store, k).catch(() => null);
  const da = !!z2 && z2.id === id;
  if (!da) console.log('[dogon] не текст', id, '— отвечает другая обработка из пачки');
  return da;
}

// Чат уходит людям: Вера молчит до «Вернуть Веру». Обход tg-dogon напомнит, если за 30 минут никто не ответил.
function kLyudyam(m, prichina, t) { m.status = 'zhdem_cheloveka'; m.zhdem_t = t; m.zhdem_prichina = prichina; }

// Что проверить обходу tg-dogon. Не записалось — не повод ронять ответ: только лог.
async function nadzor(store, vid, bc, chatId, zapis) {
  await H.pisat(store, M.kNadzor(vid, bc, chatId), { ...zapis, bc: String(bc), chat: String(chatId), exp: M.exp('nadzor') })
    .catch(e => console.log('[dogon] надзор не записан:', vid, e.message));
}

// Чат без привязки: метка сайта → люди; код → привязка; иначе молчим (kod) или спрашиваем согласие (vse).
// Текст неопознанного чата не храним (скептик №2). Возвращает meta привязанного чата или null.
// При выключенном рубильнике код привязываем (клиенту это ничего не шлёт), но вопросов о согласии не задаём.
async function opoznat(store, bc, msg, text, tip, meta, nastr) {
  const t = seychas();
  const chatId = msg.chat.id;
  if (!meta) { meta = M.novayaMeta({ bc, chat: msg.chat, from: msg.from, status: 'novyy', t }); await M.zapisatMeta(store, meta); }

  const metka = KOD.najtiMetku(text);
  if (metka) {
    let s = false;
    meta = await M.obnovitMeta(store, bc, chatId, (m) => { m.status = 'chelovek'; m.metka = metka; s = S.mozhno(m, 's_sayta', 30); });
    if (s) await S.signal('s_sayta', { meta, upravlenie: false, stroki: [`Метка ${metka}: человеку обещан живой ответ. Вера сюда не заходит.`] });
    await schet(store, `metka_${metka}`);
    return null;
  }

  const { kody, sKlyuchom } = KOD.najtiKod(text);
  let prichina = '';
  for (const k of kody) {
    const z = await H.chitat(store, `kod/${k}`).catch(() => null);
    if (!z) { if (sKlyuchom) prichina = `код не найден: ${k}`; continue; }
    // SPEC §5 строка 3: истёкший — как неизвестный, пометка «код не найден: X»; причину даём в скобках.
    if (!KOD.zhivoy(z, t)) { prichina = `код не найден: ${k} (истёк, старше ${KOD.ZHIVET_DNEY} дней)`; continue; }
    const r = await privyazat(store, bc, msg, { kod: k, zapis: z });
    if (r.meta) return r.meta;
    prichina = r.prichina;
    break;
  }

  // Файл, фото, голосовое от неопознанного — людям, без шаблона (скептик №2: анкета приходит файлом).
  if (tip !== 'text') {
    let s = false;
    meta = await M.obnovitMeta(store, bc, chatId, (m) => { m.status = 'chelovek'; s = S.mozhno(m, 'ne_tekst', 30); });
    if (s) await S.signal('ne_tekst', { meta, upravlenie: false, stroki: [`Чат без кода прислал: ${tip}. Вера не отвечала — отвечаете вы.`, prichina] });
    return null;
  }

  const yaz = SH.yazyk(text, msg.from && msg.from.language_code);
  if (meta.status === 'zhdem_soglasiya') {
    if (!nastr.vklyuchen) return null;
    const r = await soglasieTekstom(store, meta, text, yaz);
    return r === 'da' ? M.chitatMeta(store, bc, chatId) : null;
  }

  let s = false;
  meta = await M.obnovitMeta(store, bc, chatId, (m) => { s = S.mozhno(m, 'neopoznannyy', 30); });
  if (nastr.rezhim === 'vse' && nastr.vklyuchen) {
    // Режим vse включать только после меток источника на сайте (скептик №12).
    await soglasieTekstom(store, meta, text, yaz);
    if (s) await S.signal('neopoznannyy', { meta, upravlenie: false, stroki: ['Пишет без кода. Режим «все»: Вера отправила вопрос о согласии.', prichina] });
    return null;
  }
  if (s) await S.signal('neopoznannyy', { meta, upravlenie: false, stroki: ['Пишет без кода — Вера молчит (режим «только с кодом»). Ответьте сами из аккаунта.', prichina] });
  return null;
}

async function privyazat(store, bc, msg, { kod, zapis }) {
  const t = seychas();
  const chatId = msg.chat.id;
  const chaty = Array.isArray(zapis.chaty) ? zapis.chaty : [];
  const svoy = (c) => c.bc === bc && String(c.chat) === String(chatId);
  let idx = chaty.findIndex(svoy);
  if (idx < 0) {
    if (chaty.length >= 2) return { prichina: `код ${kod} уже привязан к двум чатам` };
    chaty.push({ bc, chat: chatId, user_id: msg.from.id, t });
    idx = chaty.length - 1;
    zapis.chaty = chaty;
    // get-затем-set: два разных чата с одним кодом в одну и ту же секунду — не наш объём.
    await H.pisat(store, `kod/${kod}`, zapis);
  }
  const vtoroy = idx > 0;
  const zvonok = zapis.razgovor ? await H.chitat(store, `zvonok/${zapis.razgovor}`).catch(() => null) : null;

  let meta = await M.obnovitMeta(store, bc, chatId, (m) => {
    m.kod = kod;
    m.razgovor = zapis.razgovor || null;
    m.istochnik = (zvonok && zvonok.istochnik) || zapis.istochnik || 'vera';
    m.segment = m.segment || (['biznes', 'ekspert'].includes(zapis.segment) ? zapis.segment : '');
    m.vtoroy_akkaunt = vtoroy;
    m.kartochka_zvonka = !!zvonok;
    if (vtoroy) m.status = 'zhdem_soglasiya';
    else { m.status = 'aktivnyy'; m.soglasie = { sposob: 'pismo', t }; }
  });
  // Для кнопок группы. Срок — как у чата: удаляется вместе с ним (obkhod.js), exp — на случай сироты.
  await H.pisat(store, `adm/chat/${chatId}`, { bc: String(bc), t, exp: t + M.HRANIT_DNEY() * DEN_MS });

  const tema = await S.sozdatTemu(meta);
  if (tema) meta = await M.obnovitMeta(store, bc, chatId, (m) => { m.topic_id = tema; });

  await S.signal(vtoroy ? 'vtoroy_akkaunt' : 'novyy_chat', { meta, stroki: [
    vtoroy
      ? 'Этот код уже открыт другим чатом. Модель не зовём, пока человек не нажмёт «Продолжить с Верой». Подробностей звонка Вера этому чату не видит.'
      // Ревью №4: «первый» — просто первый приславший код. Сверить его с адресатом письма нечем.
      : 'Первый чат по этому коду. Кто пишет — не проверено: код мог уйти пересланным письмом или скриншотом.',
    ...S.strokiKartochki(meta, zapis, zvonok),
  ] });
  await schet(store, vtoroy ? 'kod_vtoroy_akkaunt' : 'pervoe_s_kodom');
  return { meta };
}

// Первый раз — шаблон с кнопками. Дальше ответ текстом «да» / «жду человека», если кнопка не сработала
// (callback на бизнес-сообщениях в Bot API подтверждён только косвенно, SPEC §8).
async function soglasieTekstom(store, meta, text, yaz) {
  const bc = meta.bc, chatId = meta.chat_id;
  if (!meta.soglasie_zaprosheno) {
    const m1 = await M.obnovitMeta(store, bc, chatId, (m) => { m.status = 'zhdem_soglasiya'; m.soglasie_zaprosheno = seychas(); });
    await otpravit(store, m1 || meta, SH.sh('soglasie', yaz), { knopki: SH.knopkiSoglasiya(yaz), bezPredstavleniya: true, raskryvaet: true });
    await schet(store, 'soglasie_zaprosheno');
    return null;
  }
  // Сначала отказ, потом согласие; согласие — только целым коротким ответом (SH.razobratSoglasie, ревью №3/№8).
  const r = SH.razobratSoglasie(text);
  if (r === 'da') {
    await M.obnovitMeta(store, bc, chatId, (m) => { m.soglasie = { sposob: 'tekst', t: seychas() }; m.status = 'aktivnyy'; });
    await schet(store, 'soglasie');
    return 'da';
  }
  if (r === 'chelovek') {
    const t = seychas();
    const m2 = await M.obnovitMeta(store, bc, chatId, (m) => { kLyudyam(m, 'soglasie_net', t); });
    await nadzor(store, 'zhdet', bc, chatId, { t, prichina: 'soglasie_net' });
    await otpravit(store, m2, SH.sh('zhduCheloveka', yaz), { bezPredstavleniya: true });
    await S.signal('pozvat_cheloveka', { meta: m2, stroki: ['Человек выбрал «жду человека» вместо переписки с Верой.'] });
    return 'chelovek';
  }
  // Ни «да», ни «жду человека»: один раз напоминаем кнопки, дальше молчим. Модель без согласия не зовём.
  let napomnit = false;
  const m3 = await M.obnovitMeta(store, bc, chatId, (m) => { if (m.soglasie_povtoreno) return false; m.soglasie_povtoreno = seychas(); napomnit = true; });
  if (napomnit) await otpravit(store, m3 || meta, SH.sh('soglasiePovtor', yaz), { knopki: SH.knopkiSoglasiya(yaz), bezPredstavleniya: true });
  return null;
}

// ---------- исходящее ----------

async function etoVera(store, bc, chatId, msg, text) {
  const z = await M.chitatSoobshchenie(store, bc, chatId, msg.message_id).catch(() => null);
  if (z && z.kto === 'vera') return true;
  if (!text) return false;
  const h = await H.chitat(store, `ishodyashchee/${bc}/${chatId}/${sha1(text.trim())}`).catch(() => null);
  return !!(h && seychas() - (h.t || 0) < 15 * 60000);
}

async function ekho(store, bc, chatId, msg, text) {
  const meta = await M.chitatMeta(store, bc, chatId);
  if (!meta || !(meta.kod || meta.soglasie) || ['udalen', 'stop'].includes(meta.status)) return;
  const z = await M.chitatSoobshchenie(store, bc, chatId, msg.message_id);
  if (!z) await M.soxranitSoobshchenie(store, bc, chatId, { id: msg.message_id, kto: 'vera', tip: tipSoobshcheniya(msg), text, t: seychas() });
}

async function iskhodyashchee(store, bc, chatId, msg, text, tip, nastr) {
  if (await etoVera(store, bc, chatId, msg, text)) { await ekho(store, bc, chatId, msg, text); return; }
  const t = seychas();
  const meta = await M.chitatMeta(store, bc, chatId);

  // Автоответ, приветствие, отложенное — не живой человек, паузу не ставим.
  if (msg.is_from_offline) {
    if (meta && (meta.kod || meta.soglasie) && !['udalen', 'stop'].includes(meta.status))
      await M.soxranitSoobshchenie(store, bc, chatId, { id: msg.message_id, kto: 'avto', tip, text, t });
    return;
  }

  // Первым написал аккаунт — это личный чат Андрея. Вера сюда не заходит никогда, текст не храним.
  if (!meta) {
    await M.zapisatMeta(store, M.novayaMeta({ bc, chat: msg.chat, status: 'lichnyy', t }));
    console.log('[dogon] чат начал владелец — lichnyy', chatId);
    return;
  }
  if (['lichnyy', 'udalen'].includes(meta.status)) return;

  // Чат без привязки: владелец ответил сам — чат людей навсегда (скептик №4).
  if (!(meta.kod || meta.soglasie)) {
    if (meta.status !== 'chelovek') {
      await M.obnovitMeta(store, bc, chatId, (m) => { m.status = 'chelovek'; m.posl_vladelec_t = t; });
      console.log('[dogon] владелец ответил в чате без кода — chelovek', chatId);
    }
    return;
  }

  // Привязанный чат: пауза, каждое сообщение владельца её продлевает.
  if (meta.status !== 'stop') await M.soxranitSoobshchenie(store, bc, chatId, { id: msg.message_id, kto: 'vladelec', tip, text, t });
  let s = false;
  const m2 = await M.obnovitMeta(store, bc, chatId, (m) => {
    m.pauza_do = Math.max(m.pauza_do || 0, t + nastr.pauza_chasov * 3600000);
    m.pauza_prichina = 'vladelec';
    m.posl_vladelec_t = t;
    m.nuzhno_snova_predstavitsya = true;
    s = S.mozhno(m, 'vmeshalsya', 30);
  });
  if (s && m2 && m2.status !== 'stop')
    await S.signal('vmeshalsya', { meta: m2, stroki: [m2.status === 'zhdem_cheloveka'
      // Ревью №12: чат ждал человека — пауза тут ни при чём, Вера молчит, пока не нажмут кнопку.
      ? 'Чат ждал человека: Вера молчит до кнопки «Вернуть Веру», сколько бы времени ни прошло.'
      : `Вера молчит в этом чате до ${K.vremyaNY(m2.pauza_do)} по Нью-Йорку. Каждое ваше сообщение продлевает паузу. Раньше — кнопка «Вернуть Веру».`] });
}

// ---------- ответ ----------

async function zapustitOtvet(store, bc, chatId, msgId, nastr) {
  const t = seychas();
  await M.obnovitMeta(store, bc, chatId, (m) => {
    if (m.posl_vhod && m.posl_vhod.id > msgId) return false;
    m.posl_vhod = { id: msgId, t };
    m.okno_do = t + DEN_MS;
  });
  // Обход tg-dogon: через 3 минуты без ответа Веры, без паузы и без смены статуса — сигнал «НЕ ОТВЕТИЛИ».
  await nadzor(store, 'otvet', bc, chatId, { id: msgId, t });

  // Несколько сообщений подряд: ждём 6 с, отвечает обработка последнего и сразу на все (SPEC §5 строка 13).
  await H.pauza(global.__DOGON_BYSTRO__ ? 0 : 6000);
  const meta = await M.chitatMeta(store, bc, chatId);
  if (!meta || !meta.posl_vhod || meta.posl_vhod.id !== msgId) { console.log('[dogon] ответит обработка более позднего сообщения'); return; }

  const kOtvet = `otvet/${bc}/${chatId}/${msgId}`;
  const z = await H.chitat(store, kOtvet);
  if (z && (z.s === 'gotovo' || seychas() - (z.t || 0) < 5 * 60000)) { console.log('[dogon] на это сообщение уже отвечаем'); return; }
  await H.pisat(store, kOtvet, { s: 'v_rabote', t: seychas(), exp: M.exp('otvet') });
  try {
    await otvetit(store, meta, nastr);
  } catch (e) {
    // Исключение уходит в handler: если клиенту ещё ничего не ушло, Netlify повторит функцию через минуту,
    // и повтор должен иметь право ответить — поэтому отметку снимаем.
    await H.steret(store, kOtvet).catch(() => {});
    throw e;
  }
  await H.pisat(store, kOtvet, { s: 'gotovo', t: seychas(), exp: M.exp('otvet') });
}

async function proveritLimity(store, meta, t) {
  const d = den(t);
  const r = (await H.chitat(store, `rashod/${d}`).catch(() => null)) || { vyzovov: 0, usd: 0 };
  if ((r.vyzovov || 0) >= VYZOVOV_V_SUTKI()) return { ok: false, prichina: `дневной потолок вызовов модели: ${r.vyzovov} из ${VYZOVOV_V_SUTKI()}` };
  if ((r.usd || 0) >= USD_V_SUTKI()) return { ok: false, prichina: `дневной потолок расхода: $${(r.usd || 0).toFixed(2)} из $${USD_V_SUTKI()}` };
  const naChat = meta.vyzovy && meta.vyzovy.den === d ? meta.vyzovy.n : 0;
  if (naChat >= VYZOVOV_NA_CHAT()) return { ok: false, prichina: `потолок на чат: ${naChat} вызовов за сутки` };
  return { ok: true };
}

// Счёт по фактическому usage из ответа. get-затем-set: при гонке может недосчитать вызов — для потолка допустимо.
async function uchestRashod(store, meta, r) {
  const t = seychas(), d = den(t);
  try {
    const k = `rashod/${d}`;
    const z = (await H.chitat(store, k)) || { vyzovov: 0, usd: 0, vhod: 0, vyhod: 0 };
    z.vyzovov = (z.vyzovov || 0) + 1;
    z.usd = +((z.usd || 0) + (r.cena || 0)).toFixed(6);
    if (r.usage) {
      z.vhod = (z.vhod || 0) + (r.usage.input_tokens || 0) + (r.usage.cache_creation_input_tokens || 0) + (r.usage.cache_read_input_tokens || 0);
      z.vyhod = (z.vyhod || 0) + (r.usage.output_tokens || 0);
    }
    await H.pisat(store, k, z);
    await M.obnovitMeta(store, meta.bc, meta.chat_id, (m) => {
      m.vyzovy = { den: d, n: (m.vyzovy && m.vyzovy.den === d ? m.vyzovy.n : 0) + 1 };
      m.posl_model_t = t;
    });
  } catch (e) { console.log('[dogon] расход не записан:', e.message); }
}

const NUZHEN_TEKST = ['net', 'goryachiy'];

async function otvetit(store, meta, nastr) {
  const bc = meta.bc, chatId = meta.chat_id, t = seychas();
  const soobshcheniya = await M.istoriya(store, bc, chatId, 30);
  const tekstyKlienta = soobshcheniya.filter(z => z.kto === 'klient').map(z => z.text || '');
  const yaz = SH.yazyk(tekstyKlienta[tekstyKlienta.length - 1], meta.user && meta.user.language_code);

  // Потолки (скептик №10): сверх — один шаблон в сутки на чат и сигнал.
  const lim = await proveritLimity(store, meta, t);
  if (!lim.ok) {
    let s = false;
    const m2 = await M.obnovitMeta(store, bc, chatId, (m) => { s = S.mozhno(m, 'limit', 24 * 60); });
    // Сигнал ЛИМИТ уже говорит «Вера молчит до конца суток» — «НЕ ОТВЕТИЛИ» на каждое сообщение не нужен.
    await H.steret(store, M.kNadzor('otvet', bc, chatId)).catch(() => {});
    if (s) {
      await otpravit(store, m2 || meta, SH.sh('nedostupna', yaz));
      await S.signal('limit', { meta: m2 || meta, stroki: [lim.prichina, 'Вера в этом чате молчит до конца суток (UTC). Ответьте сами.'] });
    }
    return;
  }

  // Без собранного промпта модель не зовём: заглушка не знает цен и правил.
  if (!mozgi.estPrompt() && typeof global.__DOGON_STUB_MODEL__ !== 'function') {
    await otpravit(store, meta, SH.sh('nedostupna', yaz));
    await S.signal('oshibka', { meta, stroki: ['Нет dogon-lib/prompt.generated.js — модель не вызываю. Собрать: sobrat_prompt.py.'] });
    return;
  }

  const [kodZapis, zvonok, mesta] = await Promise.all([
    meta.kod ? H.chitat(store, `kod/${meta.kod}`).catch(() => null) : null,
    meta.razgovor ? H.chitat(store, `zvonok/${meta.razgovor}`).catch(() => null) : null,
    K.skolkoMest(),
  ]);

  // Человек написал раньше, чем пришла запись звонка: карточку шлём, как только она появилась (SPEC §5 строка 12).
  // Флаг ставим только когда карточка дошла: не дошла — дошлём при следующем ответе.
  if (zvonok && !meta.kartochka_zvonka) {
    if (await S.signal('karta_zvonka', { meta, stroki: S.strokiKartochki(meta, kodZapis, zvonok) }))
      await M.obnovitMeta(store, bc, chatId, (m) => { m.kartochka_zvonka = true; });
  }

  const messages = K.istoriyaDlyaModeli(soobshcheniya);
  const keshirovat = !!(meta.posl_model_t && t - meta.posl_model_t < 5 * 60000);
  const dop = {
    chislaIzKonteksta: Number.isFinite(mesta) ? [mesta] : [],
    tekstyKlienta,
    kartochka: {
      email: kodZapis && kodZapis.email,
      imya: (kodZapis && kodZapis.imya) || (zvonok && zvonok.sobrano && zvonok.sobrano.imya) || '',
    },
    andreyPishet: process.env.DOGON_ANDREY_PISHET === '1',
    // Ревью №4: второму аккаунту не пересказываем чужой звонок — сверяем по 4 слова подряд.
    chuzhoyZvonok: meta.vtoroy_akkaunt ? Object.values(K.kartochkaZvonka(zvonok) || {}).filter(Boolean) : [],
  };

  const stopPechat = tg.pechataet(bc, chatId);
  let otvet = null, prichiny = [], oshibka = '';
  try {
    // Не прошло проверку — одна перегенерация с замечанием; замечание идёт в изменчивый блок, кэш промпта цел.
    for (let popytka = 0; popytka < 2 && !otvet; popytka++) {
      const kontekst = K.sobratKontekst({ meta, kodZapis, zvonok, mesta, t, zamechanie: popytka ? prichiny.join('; ') : '' });
      const r = await mozgi.sprosit({ kontekst, messages, keshirovat });
      await uchestRashod(store, meta, r);
      if (!r.ok) { oshibka = r.oshibka; break; }
      if (!NUZHEN_TEKST.includes(r.otvet.signal)) { otvet = r.otvet; break; }
      const p = proverit(r.otvet, dop);
      if (p.ok) otvet = r.otvet;
      else { prichiny = p.prichiny; console.log('[dogon] проверка отбила ответ:', prichiny.join('; ')); }
    }
  } finally { stopPechat(); }

  if (!otvet && oshibka) {
    await otpravit(store, meta, SH.sh('nedostupna', yaz));
    await S.signal('oshibka', { meta, stroki: [`Модель: ${oshibka}`] });
    return;
  }
  if (!otvet) {
    const t1 = seychas();
    const m2 = await M.obnovitMeta(store, bc, chatId, (m) => { kLyudyam(m, 'validator', t1); });
    await nadzor(store, 'zhdet', bc, chatId, { t: t1, prichina: 'validator' });
    await otpravit(store, m2 || meta, SH.sh('peredayu', yaz));
    await S.signal('pozvat_cheloveka', { meta: m2 || meta, stroki: [`Проверка дважды отбила ответ Веры: ${prichiny.join('; ')}`, 'Вера молчит до «Вернуть Веру».'] });
    return;
  }

  // Пока модель думала: не вмешался ли владелец, не пришло ли новое сообщение.
  const svezh = await M.chitatMeta(store, bc, chatId);
  if (!svezh) return;
  // Рубильник могли выключить, пока модель думала (/stop_vse посреди инцидента) — ответ выбрасываем.
  if (!(await nastroyki(store)).vklyuchen) { console.log('[dogon] ответ выброшен: рубильник выключили'); return; }
  if ((svezh.pauza_do && svezh.pauza_do > seychas()) || svezh.status !== 'aktivnyy') {
    console.log('[dogon] ответ выброшен: пауза или статус', svezh.status);
    return;
  }
  if (!svezh.posl_vhod || !meta.posl_vhod || svezh.posl_vhod.id !== meta.posl_vhod.id) {
    if ((svezh.vybrosheno || 0) < 2) {
      await M.obnovitMeta(store, bc, chatId, (m) => { m.vybrosheno = (m.vybrosheno || 0) + 1; });
      console.log('[dogon] ответ выброшен: пришло новое сообщение');
      return;
    }
    console.log('[dogon] третий выброшенный подряд — отправляю всё равно');
  }

  const sig = otvet.signal;
  const segment = ['biznes', 'ekspert'].includes(otvet.segment) ? otvet.segment : (svezh.segment || '');
  const dlya = otvet.dlya_vladelcev ? `Для владельцев: ${otvet.dlya_vladelcev}` : '';
  const ne = otvet.ne_otvetila ? `Не ответила Вера: ${otvet.ne_otvetila}` : '';
  const t1 = seychas();
  const status = (st) => M.obnovitMeta(store, bc, chatId, (m) => {
    if (st === 'zhdem_cheloveka') kLyudyam(m, sig, t1); else m.status = st;
    m.tema = otvet.tema;
    if (otvet.ne_otvetila) m.ne_otvetila = otvet.ne_otvetila;
  });

  if (sig === 'stop') {
    await otpravit(store, svezh, SH.sh('stop', yaz));
    const m2 = await status('stop');
    await S.signal('stop', { meta: m2, stroki: ['Человек попросил не писать. Вера замолчала. Напишет сам — отвечаете вы.', dlya] });
    await schet(store, 'stop');
    return;
  }
  if (sig === 'udalit_dannye') return udalitDannye(store, svezh, yaz);
  if (sig === 'spam') {
    const m2 = await status('stop');
    await S.signal('spam', { meta: m2, stroki: ['Похоже на спам — Вера не отвечает в этом чате.', dlya] });
    return;
  }
  if (sig === 'ne_po_delu') {
    const m2 = await status('chelovek');
    await S.signal('lichnoe', { meta: m2, upravlenie: false, stroki: ['Похоже на личное — Вера замолчала в этом чате навсегда.', dlya] });
    return;
  }
  if (sig === 'zhaloba' || sig === 'pozvat_cheloveka') {
    await otpravit(store, svezh, SH.sh(sig === 'zhaloba' ? 'zhaloba' : 'peredayu', yaz));
    const m2 = await status('zhdem_cheloveka');
    await nadzor(store, 'zhdet', bc, chatId, { t: t1, prichina: sig });
    await S.signal(sig, { meta: m2, stroki: [dlya, ne, 'Вера молчит до «Вернуть Веру».'] });
    return;
  }

  // net или goryachiy: текст модели, прошедший проверку, плюс адрес от сервера.
  let tekst = otvet.tekst;
  const tseli = [];
  if (sig === 'goryachiy') {
    if (!/переда|passing|hand/i.test(tekst)) tekst += ` ${SH.sh('peredayuAndreyu', yaz)}`;
    // Скептик №9: после «передаю» у человека должно что-то остаться на руках.
    if (!(svezh.tseli || []).some(x => x.tip === 'razbor')) {
      tekst += `\n\n${SH.sh('pokaRazbor', yaz)} ${ssylkaDlya('razbor', segment)}`;
      tseli.push('razbor');
    }
    tseli.push('peredacha');
  } else if (otvet.ssylka !== 'net') {
    const url = ssylkaDlya(otvet.ssylka, segment);
    if (url) { tekst += `\n\n${url}`; tseli.push(otvet.ssylka); }
    else console.log('[dogon] ссылка на оплату без сегмента — не добавляю');
  }

  const id = await otpravit(store, svezh, tekst);
  if (!id) return;
  const t2 = seychas();
  const m2 = await M.obnovitMeta(store, bc, chatId, (m) => {
    if (segment) m.segment = segment;
    m.tema = otvet.tema;
    m.tseli = m.tseli || [];
    for (const tip of tseli) m.tseli.push({ tip, t: t2 });
    if (otvet.ne_otvetila) m.ne_otvetila = otvet.ne_otvetila;
    if (sig === 'goryachiy') { kLyudyam(m, 'goryachiy', t2); m.goryachiy_t = t2; }
  });
  if (sig === 'goryachiy') {
    await nadzor(store, 'zhdet', bc, chatId, { t: t2, prichina: 'goryachiy' });
    await S.signal('goryachiy', { meta: m2, stroki: [dlya, `Тема: ${otvet.tema}`, ne, 'Вера дала ссылку на разбор и молчит до «Вернуть Веру».'] });
    await schet(store, 'peredacha');
  } else if (tseli.length) {
    await S.signal('ssylka', { meta: m2, stroki: [`Отправлено: ${tseli.join(', ')}`, dlya] });
  }
  for (const tip of tseli.filter(x => x !== 'peredacha')) await schet(store, `ssylka_${tip}`);
}

// Отправка в бизнес-чат. Строку раскрытия ставит сервер, модель пропустить её не может.
// raskryvaet — шаблон сам содержит полное раскрытие (согласие): его id запоминаем как raskrytie_id.
async function otpravit(store, meta, tekst, { knopki, bezPredstavleniya = false, raskryvaet = false } = {}) {
  const bc = meta.bc, chatId = meta.chat_id;
  const yaz = meta.yazyk || 'ru';
  let text = String(tekst || '').trim();
  let predstavilas = bezPredstavleniya;   // шаблон согласия раскрывает сам
  let sRaskrytiem = raskryvaet;
  if (!bezPredstavleniya) {
    if (!meta.predstavilas) { text = `${SH.sh('raskrytie', yaz)}\n\n${text}`; predstavilas = true; sRaskrytiem = true; }
    else if (meta.nuzhno_snova_predstavitsya) { text = `${SH.sh('snova', yaz)} ${text}`; predstavilas = true; }
  }
  text = text.slice(0, 4096);

  // Хэш ДО отправки: эхо может прийти раньше, чем мы запишем message_id (скептик №4).
  await H.pisat(store, `ishodyashchee/${bc}/${chatId}/${sha1(text.trim())}`, { t: seychas(), exp: M.exp('ishodyashchee') }).catch(() => {});
  const body = { business_connection_id: bc, chat_id: chatId, text };
  if (knopki) body.reply_markup = { inline_keyboard: knopki };
  // Считаем ДО вызова: запрос мог дойти, даже если ответ Telegram потерялся — тогда повторять нельзя.
  const ctx = VYZOV.getStore();
  if (ctx) ctx.klientu++;
  const d = await tg.vyzov('sendMessage', body, { povtorSeti: false });

  if (!d || !d.ok) {
    // Сигнал ниже уже зовёт людей — «НЕ ОТВЕТИЛИ» по этому же сообщению не нужен.
    await H.steret(store, M.kNadzor('otvet', bc, chatId)).catch(() => {});
    if (tg.oknoZakryto(d)) {
      let s = false;
      const m2 = await M.obnovitMeta(store, bc, chatId, (m) => { m.okno_do = seychas(); s = S.mozhno(m, 'okno', 12 * 60); });
      if (s) await S.signal('okno', { meta: m2 || meta, stroki: [`Telegram не дал ответить: ${String((d && d.description) || '').slice(0, 160)}`, 'Бот сюда больше не напишет. Ответьте из аккаунта сами.'] });
    } else {
      await S.signal('oshibka', { meta, stroki: [`sendMessage не прошёл: ${String((d && d.description) || '').slice(0, 200)}`] });
    }
    return null;
  }

  const id = d.result && d.result.message_id;
  const t = seychas();
  await M.soxranitSoobshchenie(store, bc, chatId, { id, kto: 'vera', tip: 'text', text, t });
  await M.obnovitMeta(store, bc, chatId, (m) => {
    m.posl_vera_t = t;
    m.vybrosheno = 0;
    if (predstavilas) { m.predstavilas = true; m.nuzhno_snova_predstavitsya = false; }
    if (sRaskrytiem && id) m.raskrytie_id = id;
  });
  if (predstavilas) { meta.predstavilas = true; meta.nuzhno_snova_predstavitsya = false; }
  return id || true;
}

// «Удалите мои данные» (SPEC §5 строка 6, скептик №6 — пишем правду о том, что стёрто).
async function udalitDannye(store, meta, yaz) {
  const bc = meta.bc, chatId = meta.chat_id;
  await otpravit(store, meta, SH.sh('udalit', yaz));
  const n = await M.steretIstoriyu(store, bc, chatId);
  if (meta.kod) {
    const z = await H.chitat(store, `kod/${meta.kod}`).catch(() => null);
    if (z) { delete z.email; delete z.imya; z.udaleno_t = seychas(); await H.pisat(store, `kod/${meta.kod}`, z); }
  }
  if (meta.razgovor) {
    const zv = await H.chitat(store, `zvonok/${meta.razgovor}`).catch(() => null);
    if (zv) await H.pisat(store, `zvonok/${meta.razgovor}`, { conv: zv.conv, agent_id: zv.agent_id, istochnik: zv.istochnik, t: zv.t, kod: zv.kod, udaleno_t: seychas() });
  }
  const dlyaSignala = { ...meta };
  await M.obnovitMeta(store, bc, chatId, (m) => {
    m.status = 'udalen'; m.tseli = []; m.ne_otvetila = ''; m.tema = '';
    m.user = { id: m.user && m.user.id };
  });
  await S.signal('udalenie', { meta: dlyaSignala, upravlenie: false, stroki: [
    `Стёрто из базы: ${n} сообщений, личные поля кода и звонка.`,
    `Вручную: письмо человеку и письмо о звонке в Gmail (support@) · история в ElevenLabs${meta.razgovor ? ` (${meta.razgovor})` : ''} · чат в аккаунте business_int_dna · сигналы об этом человеке в этой группе (бот их удалить не может).`,
    'Оферта п. 14.2: подтвердить удаление письмом.',
  ] });
  await schet(store, 'udalenie');
}

// ---------- правки и удаления в Telegram ----------

async function pravka(store, msg) {
  const bc = msg.business_connection_id, chatId = msg.chat && msg.chat.id;
  if (!bc || chatId == null) return;
  const z = await M.chitatSoobshchenie(store, bc, chatId, msg.message_id);
  if (!z) return;   // храним только чаты с привязкой — чужую правку не записываем
  z.text = tekstSoobshcheniya(msg).slice(0, 4000);
  z.izmeneno = seychas();
  await H.pisat(store, M.kSoobshchenie(bc, chatId, msg.message_id), z);
}

async function udalenieVTelegram(store, dm) {
  const bc = dm.business_connection_id, chatId = dm.chat && dm.chat.id;
  if (!bc || chatId == null) return;
  const meta = await M.chitatMeta(store, bc, chatId);
  if (!meta) return;
  const ids = (dm.message_ids || []).map(String);
  for (const id of ids) await H.steret(store, M.kSoobshchenie(bc, chatId, id)).catch(() => {});
  if (!(meta.kod || meta.soglasie) || meta.status === 'udalen') return;

  // Ревью №13: человек удалил переписку — у него пустой чат, а meta помнит «уже представилась» и отправленные
  // ссылки. Следующий ответ ушёл бы без строки раскрытия (SPEC §1.2, §1.5). Сбрасываем, если история пуста
  // или удалено именно сообщение с раскрытием.
  const ostalos = await H.spisok(store, `chat/${bc}/${chatId}/m/`).catch(() => null);
  const pusto = Array.isArray(ostalos) && ostalos.length === 0;
  const raskrytieUdaleno = meta.raskrytie_id != null && ids.includes(String(meta.raskrytie_id));
  if (pusto || raskrytieUdaleno) {
    await M.obnovitMeta(store, bc, chatId, (m) => {
      m.predstavilas = false; m.nuzhno_snova_predstavitsya = false; m.raskrytie_id = null;
      if (pusto) m.tseli = [];
    });
    console.log('[dogon] удалена переписка или раскрытие — Вера представится заново', chatId);
  }
  // Скептик №12: переписку, удалённую без нашего запроса, считаем для сводки как ранний признак жалобы.
  await schet(store, pusto ? 'udalil_v_telegram' : 'udalil_soobshchenie');
}

// ---------- кнопки ----------

// adm/chat/<chat_id> → {bc}. По SPEC §2 там лежит сам bc_id строкой; ранняя сборка писала {bc, t} —
// принимаем оба вида, чтобы кнопки старых сигналов не падали.
async function chitatAdm(store, chatId) {
  const v = await H.chitatTekst(store, `adm/chat/${chatId}`);
  if (!v) return null;
  try {
    const o = JSON.parse(v);
    if (o && typeof o === 'object') return o.bc ? { bc: String(o.bc) } : null;
    if (typeof o === 'string' && o) return { bc: o };
  } catch (_) { /* не JSON — значит, bc_id как есть */ }
  return { bc: v };
}

async function knopka(store, cq) {
  const data = String(cq.data || '');
  const msg = cq.message || {};
  if (msg.business_connection_id || data.startsWith('k:')) return knopkaKlienta(store, cq);
  if (!data.startsWith('a:')) { await tg.otvetitKnopke(cq.id); return; }

  const [, deystvie, chatId] = data.split(':');
  const adm = chatId ? await chitatAdm(store, chatId) : null;
  const sv = adm ? await H.chitat(store, `svyaz/${adm.bc}`) : null;
  const fromId = cq.from && cq.from.id;
  // Нажатие принимается только от DOGON_ADMINY (или от самого бизнес-аккаунта — меню Manage Bot).
  if (!S.etoAdmin(fromId) && !(sv && sv.user_id === fromId)) {
    console.log('[dogon] кнопка от чужого id', fromId);
    await tg.otvetitKnopke(cq.id, 'Нет прав.');
    return;
  }
  if (!adm) { await tg.otvetitKnopke(cq.id, 'Чат не найден.'); return; }

  const t = seychas();
  const chasov = (await nastroyki(store)).pauza_chasov;
  let otvet = '';
  const meta = await M.obnovitMeta(store, adm.bc, chatId, (m) => {
    // Любая кнопка значит «люди видели чат»: обход tg-dogon больше не напоминает «ЖДЁТ БЕЗ ОТВЕТА».
    m.posl_knopka_t = t;
    if (deystvie === 'tiho') {
      m.pauza_do = t + chasov * 3600000; m.pauza_prichina = 'knopka'; m.nuzhno_snova_predstavitsya = true;
      otvet = `Вера молчит ${chasov} ч.`;
    } else if (deystvie === 'vera') {
      if (['udalen', 'lichnyy'].includes(m.status)) { otvet = 'В этом чате Веру вернуть нельзя.'; return false; }
      if (!m.soglasie) { otvet = 'Нет согласия человека — Вера ждёт его кнопку.'; return false; }
      m.pauza_do = null; m.pauza_prichina = null; m.status = 'aktivnyy'; m.nuzhno_snova_predstavitsya = true;
      otvet = 'Вера вернулась и ответит на следующее сообщение.';
    } else if (deystvie === 'stop') {
      m.status = 'stop'; otvet = 'Вера в этом чате остановлена.';
    } else if (deystvie === 'oplatil') {
      m.oplatil = true; otvet = 'Отмечено: оплатил. Вера больше не продаёт.';
    } else { otvet = 'Не знаю такой кнопки.'; return false; }
  });
  await tg.otvetitKnopke(cq.id, meta ? otvet : 'Чат не найден.');
  if (meta) await schet(store, `knopka_${deystvie}`);
}

async function knopkaKlienta(store, cq) {
  const msg = cq.message || {};
  const bc = msg.business_connection_id;
  const chatId = msg.chat && msg.chat.id;
  if (!bc || chatId == null) { await tg.otvetitKnopke(cq.id); return; }
  if (!cq.from || String(cq.from.id) !== String(chatId)) { await tg.otvetitKnopke(cq.id, 'Эта кнопка для собеседника.'); return; }

  const nastr = await nastroyki(store);
  if (!nastr.vklyuchen) { await tg.otvetitKnopke(cq.id); return; }
  const meta0 = await M.chitatMeta(store, bc, chatId);
  if (!meta0 || meta0.status !== 'zhdem_soglasiya') { await tg.otvetitKnopke(cq.id); return; }
  const yaz = meta0.yazyk || 'ru';

  if (cq.data === 'k:da') {
    const meta = await M.obnovitMeta(store, bc, chatId, (m) => { m.soglasie = { sposob: 'knopka', t: seychas() }; m.status = 'aktivnyy'; });
    await tg.otvetitKnopke(cq.id, SH.sh('soglasieDa', yaz));
    await schet(store, 'soglasie');
    const ist = await M.istoriya(store, bc, chatId, 30);
    const posl = ist.filter(z => z.kto === 'klient').pop();
    if (posl) await zapustitOtvet(store, bc, chatId, posl.id, nastr);
    else await otpravit(store, meta, yaz === 'en' ? 'Thank you. How can I help?' : 'Спасибо. С каким вопросом пришли?', { bezPredstavleniya: true });
  } else if (cq.data === 'k:chelovek') {
    const t = seychas();
    const meta = await M.obnovitMeta(store, bc, chatId, (m) => { kLyudyam(m, 'soglasie_net', t); });
    await nadzor(store, 'zhdet', bc, chatId, { t, prichina: 'soglasie_net' });
    await tg.otvetitKnopke(cq.id);
    await otpravit(store, meta, SH.sh('zhduCheloveka', yaz), { bezPredstavleniya: true });
    await S.signal('pozvat_cheloveka', { meta, stroki: ['Человек нажал «Жду человека» вместо переписки с Верой.'] });
  } else {
    await tg.otvetitKnopke(cq.id);
  }
}

// ---------- команды ----------

async function komanda(store, msg) {
  const text = String(msg.text || '').trim();
  if (!text.startsWith('/')) return;
  const [golova, arg = ''] = text.split(/\s+/, 2);
  const cmd = golova.split('@')[0].toLowerCase();
  const chat = msg.chat || {};
  const fromId = msg.from && msg.from.id;
  const gruppa = S.gruppa();
  const vGruppe = !!gruppa && String(chat.id) === gruppa;
  const otvet = (t, extra = {}) => tg.vyzov('sendMessage', {
    chat_id: chat.id, text: t, ...(msg.message_thread_id ? { message_thread_id: msg.message_thread_id } : {}), ...extra,
  });

  // /id отвечает и до того, как DOGON_GRUPPA и DOGON_ADMINY заданы: так их и узнают (SPEC §6 п. 4).
  if (cmd === '/id') {
    if (!gruppa || vGruppe || chat.type === 'private') await otvet(`chat.id: ${chat.id}\nfrom.id: ${fromId}`);
    return;
  }

  // Manage Bot присылает в личку /start bizChat<id> — меню управления этим чатом.
  if (chat.type === 'private' && cmd === '/start' && /^bizChat\d+$/.test(arg)) {
    const chatId = arg.slice('bizChat'.length);
    const adm = await chitatAdm(store, chatId);
    const sv = adm ? await H.chitat(store, `svyaz/${adm.bc}`) : null;
    if (!S.etoAdmin(fromId) && !(sv && sv.user_id === fromId)) { console.log('[dogon] /start bizChat от чужого', fromId); return; }
    const meta = adm ? await M.chitatMeta(store, adm.bc, chatId) : null;
    if (!meta) { await otvet('Этот чат Вера не ведёт: кода не было или человек ещё не писал.'); return; }
    const pauza = meta.pauza_do && meta.pauza_do > seychas() ? ` · пауза до ${K.vremyaNY(meta.pauza_do)}` : '';
    await otvet(`${S.kto(meta)} · код ${meta.kod || '—'}\nСтатус: ${meta.status}${pauza}${meta.oplatil ? ' · оплатил' : ''}`, {
      reply_markup: { inline_keyboard: [
        [{ text: `Молчать ${S.pauzaChasov()} ч`, callback_data: `a:tiho:${chatId}` }, { text: 'Вернуть Веру', callback_data: `a:vera:${chatId}` }],
        [{ text: 'Стоп в чате', callback_data: `a:stop:${chatId}` }, { text: 'Оплатил', callback_data: `a:oplatil:${chatId}` }],
      ] },
    });
    return;
  }

  if (!vGruppe || !S.etoAdmin(fromId)) return;
  if (cmd === '/status') {
    const n = await nastroyki(store);
    const r = (await H.chitat(store, `rashod/${den(seychas())}`)) || {};
    await otvet(`Вера: ${n.vklyuchen ? 'включена' : 'ВЫКЛЮЧЕНА'} · режим ${n.rezhim} · пауза ${n.pauza_chasov} ч\n`
      + `Сегодня: вызовов модели ${r.vyzovov || 0} из ${VYZOVOV_V_SUTKI()}, $${(r.usd || 0).toFixed(2)} из $${USD_V_SUTKI()}`);
  } else if (cmd === '/stop_vse' || cmd === '/start_vse') {
    const z = (await H.chitat(store, 'nastroyki')) || {};
    z.vklyuchen = cmd === '/start_vse';
    z.t = seychas();
    await H.pisat(store, 'nastroyki', z);
    await otvet(z.vklyuchen ? 'Вера включена во всех чатах.' : 'Вера выключена во всех чатах. Включить: /start_vse');
  }
}

// Для проверок без сети.
exports._vnutr = { dedup, sekretVeren, ipTelegram, tipSoobshcheniya, tekstSoobshcheniya, ktoIzApdeyta };
