// Общая часть партнёрской программы: хранилище, товары, опознание клиента.
// Отдельным файлом, потому что этим пользуются двое: приём событий Stripe
// (stripe-oplata.js) и страница «кому сколько должны» (partnery.js).
// Решения Андрея 26.09.2026 — см. авто-память project-partnerskaya-programma.
const { getStore } = require('@netlify/blobs');

const STORE = 'partnery';

// Комиссия — ФИКСИРОВАННАЯ на товар, а не процент от чека. Касса Веры берёт в день
// оплаты $1199 (тысяча запуска плюс первый месяц $199), и 20% от неё дали бы $239.80
// вместо назначенных Андреем $200. С абонентки и с продлений не платим вовсе.
const TOVARY = {
  vera1: { imya: 'Вера, запуск',             komissiya_c: 20000 },
  vera2: { imya: 'Вера, второй этап',        komissiya_c: 30000 },
  vis1:  { imya: 'Видимость, первый квартал', komissiya_c: 30000 },
  visp:  { imya: 'Видимость, продление',     komissiya_c: 0 },
  // Связка Дежурный + Продавец, $2500 разово + $399/мес
  // (buy.stripe.com/00wdR10IU0Bc2fbaU3frW04). Это не новый продукт, а запуск и второй
  // этап, оплаченные разом: $200 + $300 = $500 (решение ШТАБА 26.09 по правилу Андрея).
  // С абонентки $399 — ничего, как везде.
  svyazka: { imya: 'Связка Дежурный и Продавец', komissiya_c: 50000 },
  abon:  { imya: 'Абонентская плата',        komissiya_c: 0 },
  // Диагностика $500 → $100 (решение 27.09). Подарочная и бесплатная комиссии не дают,
  // и это решает не таблица, а потолок ниже: с нулевого чека платить не с чего.
  diag:  { imya: 'Диагностика',              komissiya_c: 10000 },
  audit: { imya: 'Разбор звонков',           komissiya_c: 0 },
  // «inoe» — это НЕ «комиссии нет», а «мы этого товара ещё не знаем». Разница важна:
  // правило Андрея от 27.09 — 20% с первой покупки ЛЮБОГО продукта, включая новые.
  // Поэтому такая строка идёт в «не опознано» с суммой, чтобы человек дописал руками.
  inoe:  { imya: 'Не опознанный товар',      komissiya_c: 0, ne_znaem: true },
};

// Хвост адреса кассы → товар. Тот же список, что в странице (shtab/sayty/sborka.py):
// страница метит ссылку сама, а сюда мы смотрим, когда метки нет — например, человек
// кликнул партнёрскую ссылку на телефоне, а купил с компьютера.
const KASSY = {
  '28E6oz3V6abMbPLbY7frW03': 'vera1', 'eVqfZ92R23NoaLH1jtfrW07': 'vera1',
  'cNi8wHdvG4RsbPLe6ffrW05': 'vis1',  'bJe00b8bm83E7zv2nxfrW08': 'vis1',
  'cNi3cn63e5Vw6vr3rBfrW06': 'diag',  '3cI4grezKgAa8Dz2nxfrW02': 'audit',
  '00wdR10IU0Bc2fbaU3frW04': 'svyazka',
  // Тестовые двойники (песочница Stripe, 26.09.2026) — чтобы проверка шла тем же кодом.
  'test_3cI4grcrC2Jkg612nxfrW00': 'vera1', 'test_4gM14f77ifw65rn5zJfrW01': 'vis1',
};

// Товар по кассе, когда метки в ссылке нет. Без ключа Stripe молча возвращает пусто:
// это ухудшение отчёта, а не поломка приёма денег.
async function tovarPoKasse(plink) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !plink) return '';
  try {
    const r = await fetch('https://api.stripe.com/v1/payment_links/' + encodeURIComponent(plink),
                          { headers: { Authorization: 'Bearer ' + key } });
    if (!r.ok) { console.log('[referal] Stripe не отдал кассу:', r.status); return ''; }
    const d = await r.json();
    const hvostAdresa = String(d.url || '').replace(/\/$/, '').split('/').pop();
    return KASSY[hvostAdresa] || '';
  } catch (e) { console.log('[referal] кассу не спросить:', e.message); return ''; }
}

function otkryt() {
  try { return getStore({ name: STORE, consistency: 'strong' }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const t of [process.env.NETLIFY_API_TOKEN, process.env.NETLIFY_AUTH_TOKEN,
                   process.env.EV_BLOBS_TOKEN].filter(Boolean)) {
    try { return getStore({ name: STORE, siteID, token: t, consistency: 'strong' }); } catch (_) {}
  }
  return null;
}

const chistyyKod = (v) => (/^[a-z0-9][a-z0-9-]{1,31}$/.test(String(v || '').toLowerCase())
  ? String(v).toLowerCase() : '');

// Телефон сравниваем по последним десяти цифрам: +1 561 430 9795, 15614309795
// и (561) 430-9795 — один и тот же человек, а строки разные.
const hvost = (t) => String(t || '').replace(/\D/g, '').slice(-10);
const chistayaPochta = (p) => String(p || '').trim().toLowerCase();

// «anna_vera1» → код партнёра и метка товара. Подчёркивание в кодах запрещено
// на стороне страницы ровно ради этого разбора.
function razobratSsylku(s) {
  const v = String(s || '').trim();
  const i = v.indexOf('_');
  if (i === -1) return { kod: chistyyKod(v), tovar: '' };
  return { kod: chistyyKod(v.slice(0, i)), tovar: (v.slice(i + 1) || '').toLowerCase() };
}

// Кто привёл этого человека. Совпала почта ИЛИ телефон — считаем приведённым
// (решение ШТАБА 26.09): в жизни поля разъезжаются — пришёл с личной почты,
// платит с рабочей; звонил с мобильного, карта на жену. Ошибка в нашу сторону
// стоит $200, ошибка в его сторону стоит партнёра.
// Спорят две привязки — побеждает более ранняя, но обе уходят в ответ,
// чтобы строка на странице получила пометку «спор», а не тишину.
async function ktoPrivyol(store, pochta, telefon) {
  const klyuchi = [];
  if (chistayaPochta(pochta)) klyuchi.push(`svyaz:pochta:${chistayaPochta(pochta)}`);
  if (hvost(telefon).length === 10) klyuchi.push(`svyaz:telefon:${hvost(telefon)}`);
  const najdeno = [];
  for (const k of klyuchi) {
    try {
      const v = JSON.parse((await store.get(k)) || 'null');
      if (v && v.kod) najdeno.push(v);
    } catch (_) { /* битая запись не должна ронять приём платежа */ }
  }
  if (!najdeno.length) return { kod: '', spor: null };
  najdeno.sort((a, b) => String(a.kogda || '').localeCompare(String(b.kogda || '')));
  const kody = [...new Set(najdeno.map((x) => x.kod))];
  return { kod: najdeno[0].kod, spor: kody.length > 1 ? kody : null };
}

// Привязка ставится один раз и живёт бессрочно: партнёр привёл человека, и это
// не перестаёт быть правдой. Уже существующую НЕ перетираем — иначе последний
// партнёр в цепочке отбирал бы клиента у первого.
async function privyazat(store, { pochta, telefon, kod, kak, kogda }) {
  const k = chistyyKod(kod);
  if (!k) return [];
  const postavleno = [];
  for (const [pole, znach] of [['pochta', chistayaPochta(pochta)], ['telefon', hvost(telefon)]]) {
    if (!znach) continue;
    if (pole === 'telefon' && znach.length !== 10) continue;
    const klyuch = `svyaz:${pole}:${znach}`;
    let bylo = null;
    try { bylo = JSON.parse((await store.get(klyuch)) || 'null'); } catch (_) {}
    if (bylo && bylo.kod) continue;
    try {
      await store.set(klyuch, JSON.stringify({ kod: k, kak: kak || 'avto', kogda }));
      postavleno.push(klyuch);
    } catch (e) { console.log('[referal] привязку не записать:', klyuch, e.message); }
  }
  return postavleno;
}

// Комиссия не может быть больше пятой части того, что человек ЗАПЛАТИЛ. Таблица держит
// фиксированные суммы, потому что чек Веры включает первый месяц абонентки ($1199 против
// $1000 запуска). Но если чек вышел меньше обычного — купон, подарок, нулевая оплата, —
// фиксированная сумма превратилась бы в выплату из нашего кармана. Потолок это снимает
// и НЕ выдумывает новой политики: 20% с покупки так и остаются 20%.
function potolokKomissii(naznacheno_c, summa_c) {
  const potolok = Math.floor((Number(summa_c) || 0) * 0.2);
  return Math.min(Number(naznacheno_c) || 0, potolok);
}

module.exports = { STORE, TOVARY, KASSY, tovarPoKasse, otkryt, chistyyKod, hvost,
                   chistayaPochta, razobratSsylku, ktoPrivyol, privyazat, potolokKomissii };
