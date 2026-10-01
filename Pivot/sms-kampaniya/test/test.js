// Проверка sms-soglasie.js без сети:  node test/test.js
//
// Заглушка хранилища ведёт себя как настоящий Netlify при выкладке готовой папкой:
// getStore({name}) БРОСАЕТ, getStore({name, siteID, token}) — отдаёт. Иначе тест проверял бы
// мои предположения, а не условия, в которых функция живёт (грабля 26.09, память
// feedback-test-proveryaet-usloviya).
const Module = require('module');
const path = require('path');
const assert = require('assert');

// Второе условие настоящего Netlify: getStore({siteID, token}) токен НЕ проверяет — неверный
// или отозванный токен вылетает только на get/set. Флаг «slomano» так себя и ведёт.
const sklady = new Map();
let slomano = false;
const fakeBlobs = {
  getStore(o) {
    if (!o || !o.siteID || !o.token) throw new Error('The environment has not been configured to use Netlify Blobs');
    if (!sklady.has(o.name)) sklady.set(o.name, new Map());
    const m = sklady.get(o.name);
    const lomaem = () => { if (slomano) throw new Error('Netlify Blobs has generated an internal error (401)'); };
    return {
      async get(k) { lomaem(); return m.has(k) ? m.get(k) : null; },
      async set(k, v) { lomaem(); m.set(k, String(v)); },
      async list({ prefix = '' } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    };
  },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) { return req === '@netlify/blobs' ? fakeBlobs : origLoad.call(this, req, ...rest); };

const vyzovy = [];
global.fetch = async (url, opt) => {
  vyzovy.push({ url: String(url), opt });
  if (String(url).includes('twilio')) return { ok: true, status: 201, json: async () => ({ sid: 'SMtest' }) };
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};

const fn = require(path.join(__dirname, '..', 'sms-soglasie.js'));
const VERSII_EN = 'en-1.0', VERSII_RU = 'ru-1.0';

function post(b, h = {}) {
  return fn.handler({
    httpMethod: 'POST', body: JSON.stringify(b),
    headers: Object.assign({ 'x-nf-client-connection-ip': '203.0.113.7', 'user-agent': 'TestUA/1.0', referer: 'https://businessinteldna.com/sms-consent/' }, h),
  }).then((r) => ({ kod: r.statusCode, j: JSON.parse(r.body) }));
}
const get = (q, h = {}) => fn.handler({ httpMethod: 'GET', queryStringParameters: q, headers: h })
  .then((r) => ({ kod: r.statusCode, j: r.body === 'Not found' ? null : JSON.parse(r.body) }));
// Обычная форма без JavaScript: application/x-www-form-urlencoded, галочка — «on».
function forma(polya, h = {}) {
  return fn.handler({
    httpMethod: 'POST', body: new URLSearchParams(polya).toString(),
    headers: Object.assign({ 'content-type': 'application/x-www-form-urlencoded', 'x-nf-client-connection-ip': '198.51.100.20',
      'user-agent': 'NoJS/1.0', referer: 'https://businessinteldna.com/sms-consent/?ot=pismo' }, h),
  });
}
const pismaVladelcu = () => vyzovy.filter((v) => v.url.includes('resend'));
const sklad = () => sklady.get('sms-soglasiya') || new Map();
const zapisi = () => [...sklad().keys()].filter((k) => k.startsWith('zapis/'));

let proshlo = 0;
async function t(imya, f) {
  try { await f(); proshlo++; console.log('  ✓', imya); }
  catch (e) { console.log('  ✗', imya, '\n    ', e.message); process.exitCode = 1; }
}

(async () => {
  delete process.env.SITE_ID; delete process.env.EV_BLOBS_TOKEN; delete process.env.NETLIFY_API_TOKEN;
  process.env.RESEND_API_KEY = 're_test';

  await t('без токена хранилище не поднимается — человеку «не сохранилось», а не «ок»', async () => {
    const r = await post({ telefon: '(424) 555-0199', servis: true, versiya: VERSII_EN });
    assert.strictEqual(r.kod, 500); assert.strictEqual(r.j.ok, false);
    assert.ok(/did not save/i.test(r.j.pochemu));
    assert.ok(vyzovy.some((v) => v.url.includes('resend') && /НЕ ЗАПИСАНО|\\u041d\\u0415/.test(v.opt.body)), 'письмо-след владельцу');
  });

  process.env.SITE_ID = 'site-test'; process.env.EV_BLOBS_TOKEN = 'tok-test';
  vyzovy.length = 0;

  await t('согласие EN: журнал со всеми полями, состояние номера, письмо владельцу, SMS не шлём', async () => {
    const r = await post({ telefon: '1-424-555-0199', pochta: 'Ann@Example.com', servis: true, dozhim: false,
      versiya: VERSII_EN, stranica: 'https://businessinteldna.com/sms-consent/', ot: 'pismo-vera' });
    assert.deepStrictEqual(r, { kod: 200, j: { ok: true, soglasie: true } });
    const z = zapisi(); assert.strictEqual(z.length, 1);
    const rec = JSON.parse(sklad().get(z[0]));
    assert.strictEqual(rec.telefon, '+14245550199');
    assert.strictEqual(rec.servis, true); assert.strictEqual(rec.dozhim, false);
    assert.strictEqual(rec.ip, '203.0.113.7'); assert.strictEqual(rec.brauzer, 'TestUA/1.0');
    assert.strictEqual(rec.pochta, 'ann@example.com');
    assert.strictEqual(rec.versiya, VERSII_EN); assert.match(rec.tekst_sha256, /^[0-9a-f]{64}$/);
    assert.strictEqual(rec.stranica, 'https://businessinteldna.com/sms-consent/');
    assert.strictEqual(rec.ot, 'pismo-vera'); assert.ok(rec.kogda && rec.referer);
    const s = JSON.parse(sklad().get('nomer/+14245550199'));
    assert.strictEqual(s.otozvano, false); assert.strictEqual(s.podtverzhdenie, 'vyklyucheno');
    assert.ok(vyzovy.some((v) => v.url.includes('resend')), 'письмо владельцу');
    assert.ok(!vyzovy.some((v) => v.url.includes('twilio')), 'Twilio трогать нельзя');
  });

  await t('обе галочки пустые с номером = отказ/отзыв, записан в журнал', async () => {
    const r = await post({ telefon: '424 555 0199', servis: false, dozhim: false, versiya: VERSII_EN });
    assert.deepStrictEqual(r.j, { ok: true, soglasie: false });
    const s = JSON.parse(sklad().get('nomer/+14245550199'));
    assert.strictEqual(s.otozvano, true); assert.strictEqual(s.servis, false);
    assert.strictEqual(zapisi().length, 2);
  });

  await t('галочка без номера — отказ с понятной причиной, ничего не записано', async () => {
    const n = zapisi().length;
    const r = await post({ telefon: '', dozhim: true, versiya: VERSII_EN });
    assert.strictEqual(r.j.ok, false); assert.ok(/10 digits/.test(r.j.pochemu));
    assert.strictEqual(zapisi().length, n);
  });

  await t('номер не США / код зоны с 1 — отказ', async () => {
    for (const tel of ['+44 20 7946 0958', '(124) 555-0199', '555-0199']) {
      const r = await post({ telefon: tel, servis: true, versiya: VERSII_EN });
      assert.strictEqual(r.j.ok, false, tel);
    }
  });

  await t('незнакомая версия текста — 400, не пишем (не докажем, что человек видел)', async () => {
    const n = zapisi().length;
    const r = await post({ telefon: '4245550199', servis: true, versiya: 'en-0.9', yazyk: 'ru' });
    assert.strictEqual(r.kod, 400); assert.ok(/устарела/.test(r.j.pochemu));
    assert.strictEqual(zapisi().length, n);
  });

  await t('галочка-приманка для роботов — «ок», но ничего не пишем', async () => {
    const n = zapisi().length;
    const r = await post({ telefon: '4245550111', servis: true, versiya: VERSII_EN, sayt: 'http://spam' });
    assert.strictEqual(r.j.ok, true); assert.strictEqual(zapisi().length, n);
  });

  await t('RU: ответы по-русски, true только строго true', async () => {
    const r = await post({ telefon: 'abc', servis: 'true', versiya: VERSII_RU });
    assert.strictEqual(r.j.ok, false); assert.ok(/мобильный номер/.test(r.j.pochemu));
  });

  await t('кривая почта — отказ, пустая — можно', async () => {
    let r = await post({ telefon: '4245550122', servis: true, pochta: 'не почта', versiya: VERSII_RU });
    assert.strictEqual(r.j.ok, false);
    r = await post({ telefon: '4245550122', servis: true, pochta: '', versiya: VERSII_RU });
    assert.strictEqual(r.j.ok, true);
  });

  await t('подтверждающее SMS: включено → уходит один раз, повтор того же согласия — нет', async () => {
    Object.assign(process.env, { SMS_PODTVERZHDAT: '1', TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'x',
      TWILIO_MESSAGING_SERVICE_SID: 'MGtest' });
    vyzovy.length = 0;
    await post({ telefon: '4245550133', dozhim: true, versiya: VERSII_RU });
    await post({ telefon: '4245550133', dozhim: true, servis: true, versiya: VERSII_RU });
    const tw = vyzovy.filter((v) => v.url.includes('twilio'));
    assert.strictEqual(tw.length, 1);
    const b = new URLSearchParams(tw[0].opt.body);
    assert.strictEqual(b.get('To'), '+14245550133'); assert.strictEqual(b.get('MessagingServiceSid'), 'MGtest');
    assert.ok(/СТОП/.test(b.get('Body')), 'русский текст подтверждения');
    const s = JSON.parse(sklad().get('nomer/+14245550133'));
    assert.ok(/^otpravleno/.test(s.podtverzhdenie));
    for (const k of ['SMS_PODTVERZHDAT', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID']) delete process.env[k];
  });

  await t('здоровье: хранилище пишет и читает, данных не отдаёт', async () => {
    const r = await get({ zdorovie: '1' });
    assert.strictEqual(r.j.ok, true); assert.strictEqual(r.j.pishet, true);
    assert.deepStrictEqual(r.j.versii, ['en-1.0', 'ru-1.0']); assert.strictEqual(r.j.chtenie, 'zakryto');
    assert.ok(!JSON.stringify(r.j).includes('+1424'));
  });

  await t('чтение без SMS_KEY и с неверным ключом — 404; ключ в адресе — 404; заголовком — номера и журнал', async () => {
    assert.strictEqual((await get({}, { 'x-sms-key': '' })).kod, 404);
    process.env.SMS_KEY = 'k'.repeat(24);
    assert.strictEqual((await get({}, { 'x-sms-key': 'k'.repeat(23) })).kod, 404);
    assert.strictEqual((await get({ k: 'k'.repeat(24), vse: '1' })).kod, 404, 'ключ в адресе больше не принимаем');
    const r = await get({ vse: '1' }, { 'x-sms-key': 'k'.repeat(24) });
    assert.strictEqual(r.kod, 200); assert.ok(r.j.nomerov >= 3); assert.ok(r.j.zhurnal.length >= 5);
    delete process.env.SMS_KEY;
  });

  await t('без JavaScript: форма POST → запись с галочкой «on», 303 на страницу с #sohraneno, номера в адресе нет', async () => {
    const n = zapisi().length;
    const r = await forma({ telefon: '(424) 555-0144', pochta: '', servis: 'on', versiya: VERSII_EN, yazyk: 'en', sayt: '' });
    assert.strictEqual(r.statusCode, 303);
    assert.strictEqual(r.headers.Location, '/sms-consent/#sohraneno');
    assert.strictEqual(zapisi().length, n + 1);
    const s = JSON.parse(sklad().get('nomer/+14245550144'));
    assert.strictEqual(s.servis, true); assert.strictEqual(s.dozhim, false);
    const rec = JSON.parse(sklad().get(s.zapis));
    assert.strictEqual(rec.stranica, 'https://businessinteldna.com/sms-consent/'); assert.strictEqual(rec.ot, 'pismo');
  });

  await t('без JavaScript: кривой номер → #oshibka-nomer; пусто → #pusto; RU → /sms-consent/ru/; без галочек → #bez-sms', async () => {
    let r = await forma({ telefon: '555', servis: 'on', versiya: VERSII_EN, yazyk: 'en' });
    assert.strictEqual(r.headers.Location, '/sms-consent/#oshibka-nomer');
    r = await forma({ telefon: '', versiya: VERSII_RU, yazyk: 'ru' });
    assert.strictEqual(r.headers.Location, '/sms-consent/ru/#pusto');
    r = await forma({ telefon: '4245550155', versiya: VERSII_RU, yazyk: 'ru' });
    assert.strictEqual(r.headers.Location, '/sms-consent/ru/#bez-sms');
    r = await forma({ telefon: '4245550155', servis: 'true', versiya: VERSII_EN }, { referer: '' });
    assert.strictEqual(r.headers.Location, '/sms-consent/#bez-sms', 'галочка — только «on»');
  });

  await t('письмо владельцу — только когда выбор поменялся; повтор того же и первый «без SMS» — без письма', async () => {
    vyzovy.length = 0;
    const ip = { 'x-nf-client-connection-ip': '198.51.100.30' };
    await post({ telefon: '4245550166', servis: true, versiya: VERSII_EN }, ip);
    assert.strictEqual(pismaVladelcu().length, 1, 'новое согласие — письмо');
    await post({ telefon: '4245550166', servis: true, versiya: VERSII_EN }, ip);
    assert.strictEqual(pismaVladelcu().length, 1, 'тот же выбор — без письма');
    await post({ telefon: '4245550166', servis: true, dozhim: true, versiya: VERSII_EN }, ip);
    assert.strictEqual(pismaVladelcu().length, 2, 'добавил вторую галочку — письмо');
    await post({ telefon: '4245550166', versiya: VERSII_EN }, ip);
    assert.strictEqual(pismaVladelcu().length, 3, 'отзыв — письмо');
    assert.ok(/\\u041e\\u0422\\u0417\\u042b\\u0412|ОТЗЫВ/.test(pismaVladelcu()[2].opt.body), 'в письме слово ОТЗЫВ');
    await post({ telefon: '4245550177', versiya: VERSII_EN }, ip);
    assert.strictEqual(pismaVladelcu().length, 3, 'первый «без SMS» у нового номера — без письма');
  });

  await t('потолок: с одного IP больше 10 записей в сутки — 429, и в журнал не пишем', async () => {
    const ip = { 'x-nf-client-connection-ip': '192.0.2.99' };
    for (let i = 0; i < 10; i++) {
      const r = await post({ telefon: '42455502' + String(i).padStart(2, '0'), servis: true, versiya: VERSII_EN }, ip);
      assert.strictEqual(r.kod, 200, 'запись ' + (i + 1));
    }
    const n = zapisi().length;
    const r = await post({ telefon: '4245550299', servis: true, versiya: VERSII_EN }, ip);
    assert.strictEqual(r.kod, 429); assert.strictEqual(zapisi().length, n);
  });

  await t('потолок писем владельцу: 20 в сутки, в 20-м — «дальше сегодня писем не будет»', async () => {
    // Счётчик писем уже тикал в тестах выше; добиваем до потолка разными номерами и адресами.
    vyzovy.length = 0;
    for (let i = 0; i < 30; i++) {
      await post({ telefon: '42455503' + String(i).padStart(2, '0'), dozhim: true, versiya: VERSII_EN },
        { 'x-nf-client-connection-ip': '192.0.2.' + (100 + i) });
    }
    const n = [...sklad().keys()].find((k) => k.startsWith('pisma/'));
    assert.ok(parseInt(sklad().get(n), 10) > 20, 'счётчик писем дошёл до потолка');
    const vsego = pismaVladelcu();
    assert.ok(vsego.length < 30, 'не каждое согласие дало письмо');
    assert.ok(/\\u0434\\u0430\\u043b\\u044c\\u0448\\u0435 \\u0441\\u0435\\u0433\\u043e\\u0434\\u043d\\u044f/.test(vsego[vsego.length - 1].opt.body),
      'последнее письмо предупреждает, что дальше сегодня писем не будет');
  });

  await t('хранилище отказало на get/set (неверный токен) — 500 «не сохранилось» и письмо-след владельцу', async () => {
    slomano = true; vyzovy.length = 0;
    const r = await post({ telefon: '4245550400', servis: true, versiya: VERSII_EN }, { 'x-nf-client-connection-ip': '192.0.2.250' });
    slomano = false;
    assert.strictEqual(r.kod, 500); assert.strictEqual(r.j.ok, false);
    assert.ok(/did not save/i.test(r.j.pochemu));
    const p = pismaVladelcu();
    assert.strictEqual(p.length, 1, 'письмо-след');
    assert.ok(/\\u043e\\u0442\\u043a\\u0430\\u0437\\u0430\\u043b\\u043e/.test(p[0].opt.body), 'тема «хранилище отказало»');
  });

  await t('не POST и не GET — 405; огромное тело — 413', async () => {
    assert.strictEqual((await fn.handler({ httpMethod: 'PUT', headers: {} })).statusCode, 405);
    const r = await fn.handler({ httpMethod: 'POST', headers: {}, body: 'x'.repeat(6000) });
    assert.strictEqual(r.statusCode, 413);
  });

  console.log(process.exitCode ? '\n  ЕСТЬ ПАДЕНИЯ' : '\n  всё прошло: ' + proshlo);
})();
