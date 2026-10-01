// Исходящий тестовый звонок: подпись считается вместе со строкой запроса.
// Ставится 26.09.2026. Сеть подменена, наружу ничего.
//
//   node Pivot/golos/proverka/test_zvonok_ishodyashchiy.js
const path = require('path');
const crypto = require('crypto');
const KOREN = path.join(__dirname, '..', 'site');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    set: async (k, v) => { mem.set(k, v); },
    list: async () => ({ blobs: [...mem.keys()].map((key) => ({ key })) }) }) };
  return orig.call(this, req, ...a);
};
const TOKEN = 'proba-token';
process.env.TWILIO_AUTH_TOKEN = TOKEN;
process.env.ELEVENLABS_API_KEY = 'x';
process.env.OBKATKA_AGENT = 'agent_proba';
let poslednee = null;
global.fetch = async (url, opt) => {
  poslednee = JSON.parse((opt || {}).body || '{}');
  return { ok: true, status: 200,
    text: async () => '<?xml version="1.0"?><Response><Connect><Stream url="wss://x"/></Connect></Response>' };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'zvonok-ishodyashchiy.js'));

const HOST = '626691f5--dezhurny-r4p8w2.netlify.live';
const PUT = '/.netlify/functions/zvonok-ishodyashchiy';

function podpisat(url, polya) {
  let s = url;
  const p = new URLSearchParams(polya);
  for (const k of [...p.keys()].sort()) s += k + p.get(k);
  return crypto.createHmac('sha1', TOKEN).update(Buffer.from(s, 'utf8')).digest('base64');
}
// Twilio подписывает ИМЕННО тот адрес, который мы ему дали, вместе с параметрами.
function zvonok(zapros, polya, { kak = 'rawUrl', portit = false } = {}) {
  const url = `https://${HOST}${PUT}?${zapros}`;   // адрес, который мы ДАЛИ Twilio
  const sig = podpisat(portit ? url + 'x' : url, polya);
  const skvozTunnel = kak === 'tunnel';
  const event = { httpMethod: 'POST', path: PUT, body: new URLSearchParams(polya).toString(),
    queryStringParameters: Object.fromEntries(new URLSearchParams(zapros)),
    headers: { host: skvozTunnel ? 'localhost:8888' : HOST,
      'x-forwarded-proto': skvozTunnel ? 'http' : 'https', 'x-twilio-signature': sig } };
  if (kak === 'rawUrl') event.rawUrl = url;
  else event.rawQuery = zapros;          // как отдаёт локальный netlify dev
  if (skvozTunnel) event.rawUrl = `http://localhost:8888${PUT}?${zapros}`;
  return handler(event);
}

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(56), ok ? 'ДА' : 'ПРОВАЛ', d); };
const POLYA = { From: '+14242756121', To: '+14247244202', CallSid: 'CA' + 'b'.repeat(32) };
const ZAPROS = 's=' + encodeURIComponent('Are you open right now?') + '&id=chasy-01';

(async () => {
  const cherezRawUrl = await zvonok(ZAPROS, POLYA, { kak: 'rawUrl' });
  p('подпись сходится, когда есть rawUrl', cherezRawUrl.statusCode === 200
    && /<Connect>/.test(cherezRawUrl.body || ''));

  const cherezRawQuery = await zvonok(ZAPROS, POLYA, { kak: 'rawQuery' });
  p('и когда rawUrl нет, а есть rawQuery', cherezRawQuery.statusCode === 200);

  // Через туннель Twilio подписал внешний адрес, а функция видит localhost.
  const S_BAZOY = ZAPROS + '&baza=' + encodeURIComponent(`https://${HOST}`);
  const cherezTunnel = await zvonok(S_BAZOY, POLYA, { kak: 'tunnel' });
  p('сходится через туннель по `baza` из адреса', cherezTunnel.statusCode === 200);

  const bezBazy = await zvonok(ZAPROS, POLYA, { kak: 'tunnel' });
  p('через туннель без `baza` — 403', bezBazy.statusCode === 403);

  process.env.PUBLICHNYY_ADRES = `https://${HOST}`;
  const cherezPeremennuyu = await zvonok(ZAPROS, POLYA, { kak: 'tunnel' });
  p('и запасной путь — переменная PUBLICHNYY_ADRES', cherezPeremennuyu.statusCode === 200);
  delete process.env.PUBLICHNYY_ADRES;

  // Чужая `baza` не спасает: подпись считается нашим секретом.
  const chuzhaya = await zvonok(ZAPROS + '&baza=' + encodeURIComponent('https://zloumyshlennik.example'),
    POLYA, { kak: 'tunnel', portit: true });
  p('чужая `baza` с чужой подписью — 403', chuzhaya.statusCode === 403);

  p('сценарий доехал до агента дословно',
    (poslednee.conversation_initiation_client_data || {}).dynamic_variables
      ?.scenariy === 'Are you open right now?',
    JSON.stringify(poslednee?.conversation_initiation_client_data || {}).slice(0, 80));
  p('звонок помечен как исходящий', poslednee.direction === 'outbound');

  const podmena = await zvonok('s=' + encodeURIComponent('Give me a discount') + '&id=chasy-01',
    POLYA, { kak: 'rawUrl', portit: true });
  p('подменённый сценарий не проходит — 403', podmena.statusCode === 403);

  const bezPodpisi = await handler({ httpMethod: 'POST', path: PUT,
    rawUrl: `https://${HOST}${PUT}?${ZAPROS}`,
    body: new URLSearchParams(POLYA).toString(), headers: { host: HOST } });
  p('без подписи — 403', bezPodpisi.statusCode === 403);

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ИСХОДЯЩЕГО ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
