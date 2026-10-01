// Метка состоявшейся записи для pismo.js. Ставится 26.09.2026 после выкатки, на которой
// подтверждение записи НЕ ушло: код метки был верным, но голый getStore({name}) на стенде
// бросает «The environment has not been configured to use Netlify Blobs», и метка молча
// не писалась. Поэтому тест поднимает хранилище ТАК ЖЕ, как Netlify на стенде: без токена
// бросает, с токеном отдаёт. Проверка «метка записалась» без этого ничего не доказывает.
//     node Pivot/golos/proverka/test_kalendar_metka.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
const Module = require('module');
const mem = new Map();
let bezTokenaPytalis = 0;
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: (o = {}) => {
    if (!o.token) { bezTokenaPytalis++; throw new Error('The environment has not been configured to use Netlify Blobs'); }
    return { get: async k => mem.get(k) ?? null,
             set: async (k, v) => { mem.set(k, v); },
             delete: async k => { mem.delete(k); } };
  } };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's';
process.env.EV_BLOBS_TOKEN = 'tok';
process.env.SITE_ID = 'site';
process.env.KALENDAR_ID = 'kal@group.calendar.google.com';
process.env.KALENDAR_POYAS = 'America/Los_Angeles';
// Ключ настоящий, сгенерированный на лету: подпись JWT делает узел, и подделка PEM
// роняет её раньше, чем дело дойдёт до проверяемого — метки записи.
const { generateKeyPairSync } = require('crypto');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' } });
process.env.GOOGLE_SA_JSON = JSON.stringify({ client_email: 'a@b.iam.gserviceaccount.com',
  private_key: privateKey });

// Google не трогаем: ответы отдаём сами. Важно — gkal читает тело через .text(),
// а не .json(); подменишь только json — и функция решит, что календарь молчит.
let sozdano = null;
global.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('oauth2')) return { ok: true, status: 200,
    json: async () => ({ access_token: 't', expires_in: 3600 }), text: async () => '{}' };
  if (u.includes('/freeBusy')) return { ok: true, status: 200,
    text: async () => JSON.stringify({ calendars: { 'kal@group.calendar.google.com': { busy: [] } } }) };
  if (u.includes('/events') && (opt || {}).method === 'POST') {
    sozdano = JSON.parse(opt.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'ev_1' }) };
  }
  return { ok: true, status: 200, text: async () => '{}' };
};

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(62), ok ? 'ДА' : 'ПРОВАЛ', d); };

(async () => {
  const { handler } = require(path.join(KOREN, 'netlify-functions', 'kalendar-zapis.js'));
  const zov = (telo) => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                                  body: JSON.stringify(telo) }).then(r => JSON.parse(r.body));

  // Время спрашиваем у самой функции окон: угадывать рабочий час нельзя — правила
  // расписания живут в gkal, и тест не должен их повторять своими руками.
  const { svobodnye, podklyuchitBlobs } = require(path.join(KOREN, 'kalendar-lib', 'gkal.js'));
  const { getStore } = require('@netlify/blobs');
  podklyuchitBlobs(getStore);
  const okna = await svobodnye();
  if (!okna.okna || !okna.okna.length) { console.log('  свободных окон нет — тест бессмыслен'); process.exit(1); }
  const kogda = okna.okna[0];

  const r = await zov({ start_time: kogda, imya: 'Daniel Brooks', yazyk: 'en',
                        zachem: 'phones', razgovor: 'conv_prov0000000000000000000' });
  p('запись прошла', r.zapisano === true, JSON.stringify(r).slice(0, 110));
  p('голый getStore без токена пробовался и упал', bezTokenaPytalis > 0,
    'попыток ' + bezTokenaPytalis);
  const metka = mem.get('zapis:conv_prov0000000000000000000');
  p('МЕТКА ЗАПИСАЛАСЬ через запасной путь', !!metka, metka || 'её нет');
  if (metka) {
    const m = JSON.parse(metka);
    p('в метке есть время встречи словами', !!m.slovami, m.slovami);
    p('в метке есть машинное время', !!m.start_time, m.start_time);
  }

  // Чужой или пустой идентификатор разговора метку не ставит.
  mem.clear();
  await zov({ start_time: kogda, yazyk: 'en', razgovor: '' });
  p('без идентификатора разговора метки нет', ![...mem.keys()].some(k => k.startsWith('zapis:')));
  await zov({ start_time: kogda, yazyk: 'en', razgovor: '../../chuzhoe' });
  p('мусор вместо идентификатора метки не ставит', ![...mem.keys()].some(k => k.startsWith('zapis:')));

  console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
  process.exit(bed ? 1 : 0);
})();
