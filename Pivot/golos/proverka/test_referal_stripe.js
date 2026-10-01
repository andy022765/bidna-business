// Партнёрская программа целиком, на имитации Stripe. События собраны по его формату
// и подписаны тем же способом (HMAC-SHA256, заголовок Stripe-Signature с t= и v1=),
// поэтому проверяется НАСТОЯЩАЯ проверка подписи, а не заглушка.
// Ставится 26.09.2026. Решения Андрея — авто-память project-partnerskaya-programma.
//     node Pivot/golos/proverka/test_referal_stripe.js
const path = require('path');
const crypto = require('crypto');
const KOREN = path.join(__dirname, '..', '..', '..', 'netlify-functions');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async k => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); },
    list: async ({ prefix } = {}) => ({
      blobs: [...mem.keys()].filter(k => !prefix || k.startsWith(prefix)).map(key => ({ key })) }) }) };
  return orig.call(this, req, ...a);
};
const SEKRET = 'whsec_proba';
process.env.STRIPE_WEBHOOK_SECRET = SEKRET;
process.env.RESEND_API_KEY = 'k';
process.env.BIDNA_MAIL = 'support@businessinteldna.com';
process.env.PARTNERY_KLYUCH = 'kl';
let pisma = [];
global.fetch = async (url, opts) => {
  if (String(url).includes('resend')) { try { pisma.push(JSON.parse(opts.body)); } catch (_) {} }
  return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
};
const stripe = require(path.join(KOREN, 'stripe-oplata.js')).handler;
const admin = require(path.join(KOREN, 'partnery.js')).handler;

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(60), ok ? 'ДА' : 'ПРОВАЛ', d); };

function podpisat(telo, sekret = SEKRET, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', sekret).update(`${t}.${telo}`, 'utf8').digest('hex');
  return `t=${t},v1=${v1}`;
}
async function sobytie(ob, { tip = 'checkout.session.completed', sekret = SEKRET, t, isk } = {}) {
  const telo = JSON.stringify({ id: 'evt_' + Math.random().toString(36).slice(2),
    type: tip, created: Math.floor(Date.now() / 1000), data: { object: ob } });
  const r = await stripe({ httpMethod: 'POST', headers: { 'stripe-signature': isk || podsig(telo, sekret, t) },
                           body: telo });
  return { kod: r.statusCode, telo: JSON.parse(r.body) };
}
const podsig = (telo, sekret, t) => podpisat(telo, sekret, t);

const sessiya = (o = {}) => Object.assign({
  id: 'cs_test_' + Math.random().toString(36).slice(2), object: 'checkout.session',
  amount_total: 119900, currency: 'usd', payment_intent: 'pi_' + Math.random().toString(36).slice(2),
  client_reference_id: null, customer_details: { email: null, phone: null },
}, o);

const stranicaHtml = async () => (await admin({ httpMethod: 'GET', queryStringParameters: { k: 'kl' } })).body;
const post = (t) => admin({ httpMethod: 'POST', queryStringParameters: { k: 'kl' }, body: JSON.stringify(t) })
  .then(r => JSON.parse(r.body));

(async () => {
  // ---------- подпись
  mem.clear(); pisma = [];
  let r = await sobytie(sessiya(), { sekret: 'whsec_chuzhoy' });
  p('чужая подпись отбита', r.kod === 400 && r.telo.pochemu === 'podpis');
  r = await sobytie(sessiya(), { t: Math.floor(Date.now() / 1000) - 3600 });
  p('просроченная подпись отбита', r.kod === 400);
  const telo = JSON.stringify({ type: 'checkout.session.completed', data: { object: sessiya() } });
  r = await stripe({ httpMethod: 'POST', headers: {}, body: telo });
  p('без заголовка подписи отбито', r.statusCode === 400);
  r = await stripe({ httpMethod: 'GET', headers: {}, body: '' });
  p('GET на вебхук не принимается', r.statusCode === 405);

  // ---------- партнёр и первая оплата
  mem.clear(); pisma = [];
  p('партнёр заводится', (await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна Семенова',
    pochta: 'anna@example.org', telefon: '+1 310 555 0101' })).ok === true);
  p('код с подчёркиванием не принимается',
    (await post({ deystvie: 'partnyor', kod: 'an_na', imya: 'Х' })).ok === false);

  const s1 = sessiya({ client_reference_id: 'anna_vera1',
    customer_details: { email: 'Daniel@Gmail.com', phone: '+1 (424) 275-6121' } });
  r = await sobytie(s1);
  p('оплата по ссылке засчитана партнёру', r.telo.kod === 'anna' && r.telo.komissiya_c === 20000,
    JSON.stringify(r.telo));
  p('комиссия фиксированная, а не 20% от чека $1199', r.telo.komissiya_c === 20000);
  p('партнёру ушло письмо', pisma.some(x => x.to[0] === 'anna@example.org'));
  p('нам ушло письмо', pisma.some(x => x.to[0] === 'support@businessinteldna.com'));
  const pp = pisma.find(x => x.to[0] === 'anna@example.org');
  p('в письме партнёру НЕТ данных клиента',
    !/daniel@gmail\.com|4242756121|424/i.test(pp.html), pp.html.slice(0, 80));
  p('в письме партнёру есть сумма вознаграждения', /\$200\.00/.test(pp.html));

  // ---------- повтор
  pisma = [];
  r = await sobytie(s1);
  p('повтор того же события ничего не делает', r.telo.povtor === true && pisma.length === 0);

  // ---------- вторая покупка того же продукта
  pisma = [];
  r = await sobytie(sessiya({ client_reference_id: 'anna_vera1',
    customer_details: { email: 'daniel@gmail.com', phone: null } }));
  p('второй раз тот же продукт комиссии не даёт',
    r.telo.komissiya_c === 0, JSON.stringify(r.telo));

  // ---------- другой продукт тому же клиенту
  r = await sobytie(sessiya({ amount_total: 150000, client_reference_id: 'anna_vis1',
    customer_details: { email: 'daniel@gmail.com', phone: null } }));
  p('другой продукт тому же клиенту комиссию даёт', r.telo.komissiya_c === 30000);

  // ---------- связка: запуск и второй этап разом
  r = await sobytie(sessiya({ amount_total: 289900, client_reference_id: 'anna_svyazka',
    customer_details: { email: 'boss@firma.com', phone: null } }));
  p('связка даёт $500 — запуск плюс второй этап', r.telo.komissiya_c === 50000, JSON.stringify(r.telo));

  // ---------- абонентка
  r = await sobytie({ id: 'in_1', amount_paid: 19900, customer_email: 'daniel@gmail.com' },
                    { tip: 'invoice.paid' });
  p('месячная абонентка комиссии не даёт', r.telo.komissiya_c === 0);

  // ---------- привязка: оплата БЕЗ кода, по счёту
  pisma = [];
  r = await sobytie({ id: 'in_2', amount_paid: 150000, customer_email: 'daniel@gmail.com' },
                    { tip: 'invoice.paid' });
  p('оплата без кода опознана по прежней привязке', r.telo.kod === 'anna', JSON.stringify(r.telo));

  // ---------- совпадение по ТЕЛЕФОНУ, почта другая
  r = await sobytie(sessiya({ amount_total: 150000, client_reference_id: null,
    customer_details: { email: 'work@firma.com', phone: '424-275-6121' } }));
  p('совпадение по одному телефону тоже считается', r.telo.kod === 'anna', JSON.stringify(r.telo));

  // ---------- никого
  pisma = [];
  r = await sobytie(sessiya({ customer_details: { email: 'nikto@example.net', phone: null } }));
  p('оплата без партнёра комиссии не даёт', r.telo.kod === null && r.telo.komissiya_c === 0);
  p('но письмо нам всё равно ушло', pisma.length === 1);
  p('строка попала в «не опознано»', (await stranicaHtml()).includes('nikto@example.net'));
  {
    // Причину ноля читают глазами, а не наведением: с телефона подсказок нет.
    const h0 = await stranicaHtml();
    const bezTegov = h0.replace(/<[^>]+>/g, ' ');
    p('причина ноля видна текстом, а не только в подсказке',
      /партнёр не опознан/.test(bezTegov), bezTegov.includes('title=') ? '' : '');
    p('и не спрятана в title', !/title="[^"]*партнёр не опознан/.test(h0));
  }

  // ---------- ручная привязка «по письму»
  p('ручная привязка на неизвестного партнёра отбита',
    (await post({ deystvie: 'privyazka', kontakt: 'x@y.z', kod: 'netakogo' })).ok === false);
  p('ручная привязка ставится',
    (await post({ deystvie: 'privyazka', kontakt: 'ruth@shop.com', kod: 'anna' })).ok === true);
  r = await sobytie(sessiya({ amount_total: 100000, client_reference_id: null,
    customer_details: { email: 'ruth@shop.com', phone: null } }));
  p('оплата по ручной привязке засчитана', r.telo.kod === 'anna');
  p('существующая привязка не перетирается',
    (await post({ deystvie: 'privyazka', kontakt: 'ruth@shop.com', kod: 'anna' })).ok === false);

  // ---------- спор
  await post({ deystvie: 'partnyor', kod: 'igor', imya: 'Игорь Лён', pochta: 'igor@example.org' });
  mem.set('svyaz:pochta:spor@x.com', JSON.stringify({ kod: 'anna', kak: 'avto', kogda: '2026-01-01T00:00:00Z' }));
  mem.set('svyaz:telefon:3105550199', JSON.stringify({ kod: 'igor', kak: 'ruchnaya', kogda: '2026-05-01T00:00:00Z' }));
  pisma = [];
  r = await sobytie(sessiya({ amount_total: 150000, client_reference_id: null,
    customer_details: { email: 'spor@x.com', phone: '+1 310 555 0199' } }));
  p('спор: берём более раннюю привязку', r.telo.kod === 'anna', JSON.stringify(r.telo));
  p('спор: в «к выплате» не попадает', r.telo.komissiya_c === 0);
  p('спор: нам сказали про спор в письме', /Спор/.test(pisma.map(x => x.html).join('')));
  let h = await stranicaHtml();
  p('спор: на странице видны оба кода', /anna, igor|igor, anna/.test(h));

  // ---------- возврат
  const vozvratnaya = [...mem.keys()].find(k => k.startsWith('oplata:') &&
    JSON.parse(mem.get(k)).komissiya_c === 20000);
  const pi = JSON.parse(mem.get(vozvratnaya)).platyozh;
  await sobytie({ id: 'ch_1', payment_intent: pi, amount_refunded: 119900 }, { tip: 'charge.refunded' });
  p('возврат помечен на строке', !!JSON.parse(mem.get(vozvratnaya)).vozvrat);
  p('у партнёра возврат НЕ удержан', JSON.parse(mem.get(vozvratnaya)).komissiya_c === 20000);
  h = await stranicaHtml();
  p('возврат видно на странице', h.includes('возврат'));

  // ---------- выплата
  p('отметка «выплачено» ставится',
    (await post({ deystvie: 'vyplacheno', id: vozvratnaya.slice(7) })).ok === true);
  p('выплаченное ушло из долга', !!JSON.parse(mem.get(vozvratnaya)).vyplacheno);

  // ---------- возврат РУКАМИ: событие charge.refunded в боевом endpoint пока не отмечено
  mem.clear(); pisma = [];
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна Семенова', pochta: 'anna@example.org' });
  await sobytie(sessiya({ client_reference_id: 'anna_vera1',
    customer_details: { email: 'ruchnoy@gmail.com', phone: null } }));
  const rid = [...mem.keys()].find(x => x.startsWith('oplata:')).slice(7);
  p('до отметки строка в долге', (await stranicaHtml()).includes('$200.00'));
  p('возврат ставится руками', (await post({ deystvie: 'vozvrat', id: rid })).ok === true);
  const vz = JSON.parse(mem.get('oplata:' + rid));
  p('отметка сохранена и помечена как ручная', !!vz.vozvrat && vz.vozvrat.rukami === true);
  p('комиссия у партнёра НЕ удержана', vz.komissiya_c === 20000);
  let hh = await stranicaHtml();
  p('возврат виден на странице', /возврат\s+2\d{3}-/.test(hh.replace(/<[^>]+>/g, ' ')));
  p('есть кнопка снять возврат', hh.includes('снять возврат'));
  p('ошибочную отметку можно снять', (await post({ deystvie: 'snyat-vozvrat', id: rid })).ok === true
    && !JSON.parse(mem.get('oplata:' + rid)).vozvrat);
  p('кнопка «отметить возврат» есть у обычной строки',
    (await stranicaHtml()).includes('отметить возврат'));
  p('несуществующая строка отбита',
    (await post({ deystvie: 'vozvrat', id: 'netakoy' })).ok === false);

  // ---------- НОВАЯ КАССА: товар не опознан, но деньги и партнёр видны, и дописать можно
  mem.clear(); pisma = [];
  process.env.STRIPE_SECRET_KEY = 'rk_proba';
  const bylF = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).includes('/payment_links/'))
      return { ok: true, status: 200, json: async () => ({ id: 'plink_new',
        url: 'https://buy.stripe.com/SOVSEMNOVAYAKASSA1' }) };   // такой кассы мы не знаем
    return bylF(url, opts);
  };
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна Семенова', pochta: 'anna@example.org' });
  r = await sobytie(sessiya({ amount_total: 250000, client_reference_id: 'anna_inoe',
    payment_link: 'plink_new', customer_details: { email: 'novyy@klient.com', phone: null } }));
  const nid = [...mem.keys()].find(x => x.startsWith('oplata:')).slice(7);
  let nst = JSON.parse(mem.get('oplata:' + nid));
  p('новая касса: партнёр найден', nst.kod === 'anna');
  p('новая касса: сумма записана', nst.summa_c === 250000);
  p('причина — «товар не опознан», а НЕ «комиссии нет»',
    /товар не опознан/.test(nst.pochemu_nol), nst.pochemu_nol);
  let h2 = await stranicaHtml();
  const blok = h2.slice(h2.indexOf('Не опознано'), h2.indexOf('<h2>Партнёры'));
  p('новая касса попала в «не опознано»', blok.includes('novyy@klient.com') || blok.includes('$2,500.00'));
  p('в «не опознано» видна сумма', blok.includes('$2,500.00'));
  p('в «не опознано» есть форма дописать', blok.includes('data-id="' + nid + '"'));

  p('дописать товар и комиссию', (await post({ deystvie: 'pravka', id: nid,
    opisanie: 'Новый продукт', komissiya: '500' })).ok === true);
  nst = JSON.parse(mem.get('oplata:' + nid));
  p('после правки комиссия $500', nst.komissiya_c === 50000, String(nst.komissiya_c));
  p('после правки товар назван', nst.opisanie === 'Новый продукт');
  p('после правки строка ушла из «не опознано»',
    !(await stranicaHtml()).slice((await stranicaHtml()).indexOf('Не опознано')).includes(nid)
    || nst.ne_znaem === false);
  p('после правки строка попала в долг', (await stranicaHtml()).includes('$500.00'));

  p('больше пятой части чека руками нельзя',
    (await post({ deystvie: 'pravka', id: nid, komissiya: '900' })).ok === false);
  p('буквы вместо суммы отбиты',
    (await post({ deystvie: 'pravka', id: nid, komissiya: 'много' })).ok === false);
  p('пустая правка отбита', (await post({ deystvie: 'pravka', id: nid })).ok === false);

  // ---------- потолок: с нулевого чека платить не с чего
  mem.clear(); pisma = [];
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна', pochta: 'anna@example.org' });
  r = await sobytie(sessiya({ amount_total: 0, client_reference_id: 'anna_diag',
    customer_details: { email: 'podarok@klient.com', phone: null } }));
  p('подарочная диагностика комиссии не даёт', r.telo.komissiya_c === 0, JSON.stringify(r.telo));
  const pst = JSON.parse([...mem.values()].find(v => v.includes('"tovar":"diag"')));
  p('и сказано почему', /чек нулевой/.test(pst.pochemu_nol), pst.pochemu_nol);

  // ---------- оплаченная диагностика $500 → $100
  mem.clear(); pisma = [];
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна', pochta: 'anna@example.org' });
  r = await sobytie(sessiya({ amount_total: 50000, client_reference_id: 'anna_diag',
    customer_details: { email: 'diag@klient.com', phone: null } }));
  p('оплаченная диагностика $500 даёт $100', r.telo.komissiya_c === 10000, JSON.stringify(r.telo));
  global.fetch = bylF;
  delete process.env.STRIPE_SECRET_KEY;

  // ---------- ключ страницы
  p('без ключа страница закрыта',
    (await admin({ httpMethod: 'GET', queryStringParameters: {} })).statusCode === 401);
  p('с чужим ключом закрыта',
    (await admin({ httpMethod: 'GET', queryStringParameters: { k: 'ne-tot' } })).statusCode === 401);

  // ---------- первый счёт подписки не должен давать вторую строку
  mem.clear(); pisma = [];
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна Семенова', pochta: 'anna@example.org' });
  const cs = sessiya({ client_reference_id: 'anna_vera1',
    customer_details: { email: 'dvoynik@gmail.com', phone: null } });
  // Stripe присылает счёт РАНЬШЕ сессии — так было на живой тестовой оплате 26.09.
  await sobytie({ id: 'in_podpiska', amount_paid: 119900, billing_reason: 'subscription_create',
                  customer_email: 'dvoynik@gmail.com' }, { tip: 'invoice.paid' });
  await sobytie(cs);
  const strok = [...mem.keys()].filter(k => k.startsWith('oplata:')).length;
  p('первый счёт подписки не создаёт вторую строку', strok === 1, 'строк ' + strok);
  p('и не порождает «не опознано»', !(await stranicaHtml()).includes('dvoynik@gmail.com')
    || (await stranicaHtml()).split('dvoynik@gmail.com').length === 2);

  // ---------- месячное продление называется абоненткой
  r = await sobytie({ id: 'in_mesyac', amount_paid: 19900, billing_reason: 'subscription_cycle',
                      customer_email: 'dvoynik@gmail.com' }, { tip: 'invoice.paid' });
  p('месячное продление названо абоненткой, а не «не опознано»',
    r.telo.tovar === 'abon' && r.telo.komissiya_c === 0, JSON.stringify(r.telo));

  // ---------- товар опознаётся по кассе, когда метки в ссылке нет
  mem.clear(); pisma = [];
  process.env.STRIPE_SECRET_KEY = 'rk_proba';
  const bylFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).includes('/payment_links/'))
      return { ok: true, status: 200, json: async () => ({
        id: 'plink_1', url: 'https://buy.stripe.com/cNi8wHdvG4RsbPLe6ffrW05' }) };
    return bylFetch(url, opts);
  };
  await post({ deystvie: 'partnyor', kod: 'anna', imya: 'Анна Семенова', pochta: 'anna@example.org' });
  mem.set('svyaz:pochta:bezmetki@gmail.com',
          JSON.stringify({ kod: 'anna', kak: 'avto', kogda: '2026-01-01T00:00:00Z' }));
  r = await sobytie(sessiya({ amount_total: 150000, client_reference_id: null,
    payment_link: 'plink_1', customer_details: { email: 'bezmetki@gmail.com', phone: null } }));
  p('без метки товар опознан по кассе', r.telo.tovar === 'vis1', JSON.stringify(r.telo));
  p('и комиссия начислена, а не потеряна', r.telo.komissiya_c === 30000);

  // Без ключа Stripe — отчёт хуже, но деньги принимаются и партнёр не теряется.
  delete process.env.STRIPE_SECRET_KEY;
  mem.set('svyaz:pochta:bezklyucha@gmail.com',
          JSON.stringify({ kod: 'anna', kak: 'avto', kogda: '2026-01-01T00:00:00Z' }));
  r = await sobytie(sessiya({ amount_total: 150000, client_reference_id: null,
    payment_link: 'plink_1', customer_details: { email: 'bezklyucha@gmail.com', phone: null } }));
  p('без ключа Stripe приём не падает', r.telo.ok === true && r.telo.kod === 'anna');
  global.fetch = bylFetch;

  console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
  process.exit(bed ? 1 : 0);
})();
