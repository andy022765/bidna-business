// Сигналы в закрытую группу Андрея и Маши (env DOGON_GRUPPA).
//
// Скептик №6: DOGON_KOPII=0 — копий реплик в группе НЕТ. Владельцы и так видят чат в аккаунте,
// а копию в теме бот потом удалить не может (deleteForumTopic требует can_delete_messages,
// deleteMessage живёт 48 ч). В сигнале — имя, @username, код, карточка звонка и строка от Веры
// «для владельцев». Текста сообщений клиента здесь нет.
//
// Тема на чат (createForumTopic): карточка и сигналы этого чата. Важные сигналы дублируются
// в общую ленту, чтобы их не пропустили. Ночью (22–08 ET) без звука, кроме ГОРЯЧИЙ и ЖАЛОБА.
// Кнопки: a:<действие>:<chat_id> — нажатие принимается только от DOGON_ADMINY.

const tg = require('./tg');
const { seychas } = require('./meta');
const { kartochkaZvonka, vremyaNY } = require('./kontekst');

const NAZVANIYA = {
  novyy_chat: 'НОВЫЙ ЧАТ', vtoroy_akkaunt: 'КОД СО ВТОРОГО АККАУНТА', neopoznannyy: 'НЕОПОЗНАННЫЙ',
  s_sayta: 'С САЙТА — ОТВЕЧАЮТ ЛЮДИ', goryachiy: 'ГОРЯЧИЙ', pozvat_cheloveka: 'ПОЗВАТЬ ЧЕЛОВЕКА',
  zhaloba: 'ЖАЛОБА', ssylka: 'ССЫЛКА ОТПРАВЛЕНА', vmeshalsya: 'ВМЕШАЛСЯ ВЛАДЕЛЕЦ',
  v_pauze: 'КЛИЕНТ ПИШЕТ В ПАУЗЕ', zhdet: 'КЛИЕНТ ЖДЁТ ЧЕЛОВЕКА', ne_tekst: 'НЕ ТЕКСТ',
  udalenie: 'УДАЛЕНИЕ ДАННЫХ', stop: 'СТОП', spam: 'СПАМ', lichnoe: 'ПОХОЖЕ НА ЛИЧНОЕ',
  limit: 'ЛИМИТ', okno: 'ОКНО ЗАКРЫТО — ДАЛЬШЕ РУКАМИ', oshibka: 'ОШИБКА', podklyuchenie: 'ПОДКЛЮЧЕНИЕ',
  karta_zvonka: 'КАРТОЧКА ЗВОНКА',
  // tg-dogon (обходы по расписанию, ревью 15.09 №12):
  goryachiy_bez_otveta: 'ГОРЯЧИЙ БЕЗ ОТВЕТА', zhdet_bez_otveta: 'ЖДЁТ ЧЕЛОВЕКА БЕЗ ОТВЕТА', ne_otvetili: 'НЕ ОТВЕТИЛИ',
};
const ZVUK_VSEGDA = ['goryachiy', 'zhaloba'];
const VAZHNYE = ['novyy_chat', 'vtoroy_akkaunt', 'goryachiy', 'zhaloba', 'pozvat_cheloveka', 'oshibka', 'udalenie', 'okno', 'limit',
  'goryachiy_bez_otveta', 'zhdet_bez_otveta', 'ne_otvetili'];

const gruppa = () => String(process.env.DOGON_GRUPPA || '').trim();
const adminy = () => String(process.env.DOGON_ADMINY || '').split(',').map(s => s.trim()).filter(Boolean);
const etoAdmin = (id) => id != null && adminy().includes(String(id));
const pauzaChasov = () => +(process.env.DOGON_PAUZA_CHASOV || 24);

function nochNY(t = seychas()) {
  const h = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(new Date(t));
  return h >= 22 || h < 8;
}

// Троттлинг: один сигнал такого типа на чат не чаще, чем раз в `minut`. Меняет meta — сохраняет вызывающий.
function mozhno(meta, tip, minut, t = seychas()) {
  if (!meta) return true;
  meta.signal_t = meta.signal_t || {};
  const bylo = meta.signal_t[tip];
  if (bylo && t - bylo < minut * 60000) return false;
  meta.signal_t[tip] = t;
  return true;
}

function kto(meta) {
  const u = (meta && meta.user) || {};
  return `${u.first_name || 'без имени'}${u.username ? ` (@${u.username})` : ''}`;
}

function zagolovok(tip, meta) {
  const chasti = [NAZVANIYA[tip] || String(tip).toUpperCase()];
  if (meta) {
    chasti.push(kto(meta));
    if (meta.kod) chasti.push(`код ${meta.kod}`);
  }
  return chasti.join(' · ');
}

function knopki(meta, upravlenie) {
  const ryady = [];
  if (meta && meta.user && meta.user.username) ryady.push([{ text: 'Открыть чат', url: `https://t.me/${meta.user.username}` }]);
  if (upravlenie && meta && meta.chat_id != null) {
    const id = meta.chat_id;
    ryady.push([{ text: `Молчать ${pauzaChasov()} ч`, callback_data: `a:tiho:${id}` }, { text: 'Вернуть Веру', callback_data: `a:vera:${id}` }]);
    ryady.push([{ text: 'Стоп в чате', callback_data: `a:stop:${id}` }, { text: 'Оплатил', callback_data: `a:oplatil:${id}` }]);
  }
  return ryady.length ? { inline_keyboard: ryady } : undefined;
}

// stroki — готовые строки без реплик клиента. upravlenie=false — без кнопок паузы/стопа (чат не наш).
// bystro — для синхронных функций и расписания: короткий таймаут, без ожидания 429 (ревью №5).
// Возвращает true, если сигнал дошёл хотя бы в одно место: по этому решают, досылать ли карточку.
async function signal(tip, { meta = null, stroki = [], upravlenie, vObshchuyu = false, bystro = false } = {}) {
  const chat = gruppa();
  const tekst = [zagolovok(tip, meta), ...stroki.filter(Boolean)].join('\n').slice(0, 4000);
  if (!chat) { console.log('[dogon] сигнал без группы:', tekst.split('\n')[0]); return false; }
  const opts = bystro ? { taymautMs: 3000, zhdat429: false, povtorSeti: false } : {};

  const base = {
    chat_id: chat, text: tekst,
    disable_notification: nochNY() && !ZVUK_VSEGDA.includes(tip),
    link_preview_options: { is_disabled: true },
  };
  const svoy = !!(meta && (meta.kod || meta.soglasie));
  const rm = knopki(meta, upravlenie === undefined ? svoy : upravlenie);
  if (rm) base.reply_markup = rm;

  const kuda = [];
  if (meta && meta.topic_id) {
    kuda.push(meta.topic_id);
    if (VAZHNYE.includes(tip) || vObshchuyu) kuda.push(null);
  } else kuda.push(null);

  let doshlo = false;
  for (const thread of kuda) {
    const body = { ...base };
    if (thread) body.message_thread_id = thread;
    const d = await tg.vyzov('sendMessage', body, opts);
    if (d && d.ok) doshlo = true;
  }
  return doshlo;
}

// ОШИБКА — прямой вызов Telegram, без Blobs: сигнал должен дойти, даже когда хранилище лежит (скептик №5).
// kto — {chat_id, first_name, username} из самого апдейта (ревью №11): без него Андрей не знает,
// какой чат открыть. Кнопка «Открыть чат» — только при username (tg://user?id= в URL-кнопке не проверен).
async function oshibkaPryamo(tekst, kto = null) {
  const chasti = ['ОШИБКА'];
  if (kto && kto.chat_id != null) {
    chasti.push(`${kto.first_name || 'без имени'}${kto.username ? ` (@${kto.username})` : ''}`, `chat ${kto.chat_id}`);
  }
  const s = `${chasti.join(' · ')}\n${tg.chisto(tekst)}`.slice(0, 3500);
  console.log('[dogon]', s.replace(/\n/g, ' | '));
  const chat = gruppa();
  if (!chat) return;
  const body = { chat_id: chat, text: s, link_preview_options: { is_disabled: true } };
  if (kto && kto.username) body.reply_markup = { inline_keyboard: [[{ text: 'Открыть чат', url: `https://t.me/${kto.username}` }]] };
  await tg.vyzov('sendMessage', body);
}

async function sozdatTemu(meta) {
  if (!gruppa() || process.env.DOGON_TEMY === '0') return null;
  const u = meta.user || {};
  const name = [u.first_name || 'Без имени', u.username ? `@${u.username}` : '', meta.kod || ''].filter(Boolean).join(' · ').slice(0, 128);
  const d = await tg.vyzov('createForumTopic', { chat_id: gruppa(), name });
  return (d && d.ok && d.result && d.result.message_thread_id) || null;
}

// Карточка чата: откуда, какое письмо, пять полей звонка, ссылка на историю. Без почты и телефона.
function strokiKartochki(meta, kodZapis, zvonok) {
  const s = [];
  const ist = (zvonok && zvonok.istochnik) || (kodZapis && kodZapis.istochnik) || meta.istochnik;
  s.push(`Откуда: ${ist === 'forma' ? 'форма на сайте' : ist === 'demo' ? 'демо на сайте' : 'звонок Вере'}`);
  if (zvonok && zvonok.t) s.push(`Звонок: ${vremyaNY(zvonok.t)}${zvonok.dlit ? `, ${Math.max(1, Math.round(zvonok.dlit / 60))} мин` : ''}`);
  if (kodZapis && kodZapis.shag) s.push(`Письмо: ${kodZapis.shag === 'diagnostika' ? 'ссылка на оплату диагностики' : 'бесплатный разбор'}`);
  const k = kartochkaZvonka(zvonok);
  if (k) {
    if (k.zachem) s.push(`Зачем: ${k.zachem}`);
    if (k.biznes) s.push(`Бизнес: ${k.biznes}`);
    if (k.obeshchali) s.push(`Обещали: ${k.obeshchali}`);
    if (k.hvost) s.push(`Висит: ${k.hvost}`);
    if (k.itog) s.push(`Итог: ${k.itog}`);
  } else if (meta.razgovor) s.push('Записи звонка пока нет — карточка придёт, когда появится.');
  if (meta.razgovor && /^conv_/.test(meta.razgovor)) s.push(`История: https://elevenlabs.io/app/agents/history/${meta.razgovor}`);
  return s;
}

module.exports = {
  NAZVANIYA, signal, oshibkaPryamo, sozdatTemu, strokiKartochki, mozhno, etoAdmin, adminy, gruppa,
  nochNY, kto, pauzaChasov,
};
