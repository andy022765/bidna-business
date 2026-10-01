// Вставка для основного сайта: передаёт заявку с секретом, не бросает, не держит форму дольше 3 секунд.
// И сквозной путь: то, что шлёт вставка, принимает zayavka-background.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { peredatZayavku } = require('../dlya-glavnogo-sayta/vyzov-otveta');

const URL_OTVETA = 'https://otvet-test.netlify.app/.netlify/functions/zayavka-background';
const podmena = (fn) => { const byl = global.fetch; global.fetch = fn; return () => { global.fetch = byl; }; };

test.beforeEach(() => { F.sbrosVsego(); process.env.OTVET_URL = URL_OTVETA; });

test('без OTVET_URL/OTVET_SECRET — тихо выключено, в сеть не ходит', async () => {
  delete process.env.OTVET_URL;
  let bylo = 0; const vernut = podmena(async () => { bylo++; });
  try { assert.deepEqual(await peredatZayavku({ pochta: 'a@b.co' }), { ok: false, pochemu: 'vyklyucheno' }); }
  finally { vernut(); }
  assert.equal(bylo, 0);
});

test('сеть упала — не бросает (форма и письмо владельцу на основном сайте не страдают)', async () => {
  const vernut = podmena(async () => { throw new Error('ECONNRESET'); });
  try { assert.equal((await peredatZayavku({ pochta: 'a@b.co' })).ok, false); }
  finally { vernut(); }
});

test('сквозной путь: вставка → zayavka-background → письмо человеку с ценами и ссылкой на Calendly', async () => {
  const fn = require(path.join(F.SITE, 'netlify-functions/zayavka-background.js'));
  let zapros = null;
  // Подменяем только адрес сайта ответа; Google и Resend уходят в общие подделки.
  const feyk = global.fetch;
  global.fetch = async (url, o) => {
    if (String(url) !== URL_OTVETA) return feyk(url, o);
    zapros = o;
    // Так Netlify зовёт фоновую функцию: тело и заголовки как есть (заголовки в нижнем регистре),
    // вызывающему — 202.
    await fn.handler({ httpMethod: 'POST', headers: Object.fromEntries(Object.entries(o.headers).map(([k, v]) => [k.toLowerCase(), v])), body: o.body });
    return { ok: true, status: 202 };
  };
  try {
    const r = await peredatZayavku({ forma: 'hochet-zvonok', stranica: '/vera/ru/', pochta: 'anna@example.com', imya: 'Анна' });
    assert.deepEqual(r, { ok: true, kod: 202 });
  } finally { global.fetch = feyk; }
  assert.equal(zapros.headers['x-otvet-secret'], F.SEKRET);
  assert.ok(/^[\x00-\x7f]*$/.test(zapros.body), 'тело ASCII');
  assert.equal(JSON.parse(zapros.body).imya, 'Анна', 'и при этом кириллица доезжает');
  const [p] = F.resend.komu('anna@example.com');
  assert.ok(p.text.includes('https://calendly.com/businessinteldna-support/30min'));
  assert.ok(p.text.includes(require('../lib/kartochka').vzyat('bid').produkty.vera.ceny_ru[0]));
  assert.match(p.text, /^Здравствуйте, Анна!/);
  assert.equal(F.resend.komu('support@businessinteldna.com').length, 1, 'владельцу «ответ ушёл»');
});
