// Выключатель и потолки. Главный риск продукта — не письмо не тому, а цикл, который жжёт кредиты
// Netlify (их исчерпание кладёт ВСЕ сайты сразу) или деньги Google и Anthropic. Поэтому:
//  • общий выключатель в Blobs, по умолчанию ВЫКЛЮЧЕНО: нет записи — нет работы;
//  • потолки на сутки: письма посетителям на бизнес и на всех, тревоги владельцу, запросы
//    к Google Maps (на все карточки разом), черновики Claude.
// Сверх потолка ничего не теряется молча: письмо ждёт следующего дня (до срока устаревания),
// в журнале функции пишется причина.

const H = require('./hranilishche');
const V = require('./vremya');
const S = require('./podpis');

const KLYUCH_VYKL = 'nastroyki/vyklyuchatel';

// Числа из PLAN-DLYA-ANDREYA п. 8 и п. 6.7: 90 писем в сутки из бесплатных 100 у Resend;
// 40 запросов Places в сутки на всех (при сбое больше ~$6 в месяц не спишется).
const POTOLKI = {
  vsego_pisem: () => Math.min(+(process.env.OTZYVY_VSEGO_V_SUTKI || 90), 90),
  places: () => Math.min(+(process.env.OTZYVY_PLACES_V_SUTKI || 40), 40),
  claude: () => Math.min(+(process.env.OTZYVY_CLAUDE_V_SUTKI || 30), 30),
  za_progon: () => Math.min(+(process.env.OTZYVY_ZA_PROGON || 20), 20),
};

async function vklyuchen(s) {
  if (!s) return { vklyucheno: false, pochemu: 'нет хранилища' };
  // Без адреса сайта и секрета ссылки в письмах (кнопка, отписка) были бы битыми — не работаем вовсе.
  if (!/^https:\/\/[^\s/]+/.test(String(process.env.OTZYVY_BAZA_URL || ''))) return { vklyucheno: false, pochemu: 'нет OTZYVY_BAZA_URL (https) — ссылки в письмах были бы битыми' };
  if (!S.sekrety().length) return { vklyucheno: false, pochemu: 'нет OTZYVY_SECRET (от 32 знаков) — нечем подписать ссылки' };
  let v = null;
  try { v = await s.get(KLYUCH_VYKL); } catch (e) { return { vklyucheno: false, pochemu: 'не читается: ' + e.message }; }
  if (v == null) return { vklyucheno: false, pochemu: 'нет записи (по умолчанию выключено)' };
  let d = null;
  try { d = typeof v === 'string' ? JSON.parse(v) : v; } catch (_) { return { vklyucheno: false, pochemu: 'запись битая' }; }
  return { vklyucheno: d && d.vklyucheno === true, pochemu: d && d.vklyucheno === true ? '' : 'выключено', kto: d && d.kto, kogda: d && d.kogda };
}

const kl = {
  vsego: (t) => `lim/vsego/${V.utcDen(t)}`,
  biznes: (k, t) => `lim/biznes/${k.klient}/${V.mestnyyDen(t, k.biznes.poyas)}`,
  trevogi: (k, t) => `lim/trevogi/${k.klient}/${V.mestnyyDen(t, k.biznes.poyas)}`,
  forma: (k, t) => `lim/forma/${k.klient}/${V.mestnyyDen(t, k.biznes.poyas)}`,
  places: (t) => `lim/places/${V.utcDen(t)}`,
  claude: (t) => `lim/claude/${V.utcDen(t)}`,
};

// Можно ли ещё. Не прочиталось — нельзя: потолок, который нельзя проверить, считается достигнутым.
async function estMesto(s, klyuch, potolok) {
  const n = await H.prochitatChislo(s, klyuch);
  if (n == null) return false;
  return n < potolok;
}

module.exports = { vklyuchen, KLYUCH_VYKL, POTOLKI, kl, estMesto };
