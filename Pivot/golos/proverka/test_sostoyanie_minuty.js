// Страница состояния обязана показывать РЕАЛЬНЫЙ расход у вендора, а не свой счётчик.
// Ставится 27.09.2026: страница писала «осталось 525 из 525», когда у ElevenLabs за месяц
// было съедено 766 минут. По этой цифре собирались запускать платную рекламу на звонки.
//     node Pivot/golos/proverka/test_sostoyanie_minuty.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async k => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } }) };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_NASH_KLYUCH = 'kl';
process.env.GOLOS_TARIF_MINUT = '525';
process.env.GOLOS_LIMIT_MINUT = '400';
process.env.ELEVENLABS_API_KEY = 'x';

const mes = new Date().toISOString().slice(0, 7);
const sek = (t) => Math.floor(new Date(mes + '-15T12:00:00Z').getTime() / 1000) + t;
let otdavat = null;                       // что «вендор» отдаёт в журнале
global.fetch = async (u) => {
  if (String(u).includes('convai/conversations')) {
    if (otdavat === 'otkaz') return { ok: false, status: 401, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ conversations: otdavat, has_more: false }) };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'sostoyanie.js'));
const stranica = () => handler({ httpMethod: 'GET', queryStringParameters: { k: 'kl' } })
  .then(r => r.body);

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(60), ok ? 'ДА' : 'ПРОВАЛ', d); };

(async () => {
  // Свой счётчик пуст — браузерного демо в этом месяце не было.
  mem.set(`${mes}:__minut`, '0');

  // А у вендора съедено 766 минут телефоном и прогонами.
  otdavat = [{ start_time_unix_secs: sek(0), call_duration_secs: 766 * 60 }];
  let t = await stranica();
  p('показан реальный расход у вендора', /израсходовано: 766\.0 мин/.test(t));
  p('перерасход назван перерасходом', /ПЕРЕРАСХОД: 241\.0 мин сверх тарифа 525/.test(t), '');
  p('нет вранья «525 из 525»', !/осталось на тарифе:\s+525\.0/.test(t));
  p('счётчик демо подписан как браузерный', /БРАУЗЕРНОЕ ДЕМО/.test(t));

  // Расход в пределах тарифа — обычная строка остатка.
  otdavat = [{ start_time_unix_secs: sek(0), call_duration_secs: 100 * 60 }];
  t = await stranica();
  p('в пределах тарифа показан остаток', /осталось на тарифе:\s+425\.0 мин из 525/.test(t));
  p('и слова «перерасход» нет', !/ПЕРЕРАСХОД/.test(t));

  // Разговоры прошлого месяца в счёт этого не идут.
  otdavat = [{ start_time_unix_secs: sek(-45 * 86400), call_duration_secs: 900 * 60 },
             { start_time_unix_secs: sek(0), call_duration_secs: 30 * 60 }];
  t = await stranica();
  p('чужой месяц не считается', /израсходовано: 30\.0 мин/.test(t));

  // Вендор недоступен — молчим честно, а не показываем красивую неправду.
  otdavat = 'otkaz';
  t = await stranica();
  p('отказ вендора: остаток назван неизвестным', /остаток тарифа НЕИЗВЕСТЕН/.test(t));
  p('и число тарифа не выдаётся за остаток', !/осталось на тарифе/.test(t));

  // Чужой ключ по-прежнему не пускают.
  const r = await handler({ httpMethod: 'GET', queryStringParameters: { k: 'ne-tot' } });
  p('без верного ключа страница закрыта', r.statusCode !== 200, String(r.statusCode));

  console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
  process.exit(bed ? 1 : 0);
})();
