// Входящий звонок на английский номер: подпись, чужой номер, суточный предел.
// Ставится 25.09.2026. Сеть подменена: ни одного звонка наружу, ни цента.
//
//   node Pivot/golos/proverka/test_zvonok_vhod.js
const path = require('path');
const crypto = require('crypto');
const KOREN = path.join(__dirname, '..', 'site');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async (k) => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); },
    list: async ({ prefix } = {}) => ({
      blobs: [...mem.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((key) => ({ key })) }),
    delete: async (k) => { mem.delete(k); } }) };
  return orig.call(this, req, ...a);
};
const TOKEN = 'proba-auth-token';
process.env.TWILIO_AUTH_TOKEN = TOKEN;
process.env.TWILIO_NOMER_EN = '+14247244202';
process.env.ELEVENLABS_API_KEY = 'x';
process.env.GOLOS_AGENTS = JSON.stringify({ en: 'agent_en_proba' });
process.env.ZVONKOV_V_SUTKI = '3';
let vyzovov = 0;
global.fetch = async () => {
  vyzovov++;
  return { ok: true, status: 200,
    text: async () => '<?xml version="1.0"?><Response><Connect><Stream url="wss://proba"/></Connect></Response>' };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'zvonok-vhod.js'));

const HOST = 'dezhurny-r4p8w2.netlify.app';
const PUT = '/.netlify/functions/zvonok-vhod';
function zvonok(polya, { podpis = true } = {}) {
  const body = new URLSearchParams(polya).toString();
  const url = `https://${HOST}${PUT}`;
  let stroka = url;
  const p = new URLSearchParams(body);
  for (const k of [...p.keys()].sort()) stroka += k + p.get(k);
  const sig = crypto.createHmac('sha1', TOKEN).update(Buffer.from(stroka, 'utf8')).digest('base64');
  return handler({ httpMethod: 'POST', path: PUT, body,
    headers: { host: HOST, 'x-forwarded-proto': 'https',
               ...(podpis ? { 'x-twilio-signature': sig } : {}) } });
}

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(52), ok ? 'ДА' : 'ПРОВАЛ', d); };

(async () => {
  console.log('--- кого не пускаем ---');
  const bezPodpisi = await zvonok({ From: '+15551112222', To: '+14247244202', CallSid: 'CA1' }, { podpis: false });
  p('без подписи Twilio — 403', bezPodpisi.statusCode === 403);

  const chuzhoyNomer = await zvonok({ From: '+15551112222', To: '+13105550000', CallSid: 'CA2' });
  p('звонок не на наш номер — 403', chuzhoyNomer.statusCode === 403);

  console.log('\n--- обычный звонок ---');
  const ok1 = await zvonok({ From: '+15551112222', To: '+14247244202', CallSid: 'CA10' });
  p('с подписью соединяет', ok1.statusCode === 200 && /<Connect>/.test(ok1.body || ''));
  p('отдаёт именно TwiML', /text\/xml/.test((ok1.headers || {})['content-type'] || ''));

  console.log('\n--- суточный предел (в проверке он 3) ---');
  const povtor = await zvonok({ From: '+15551112222', To: '+14247244202', CallSid: 'CA10' });
  p('повтор вебхука по тому же звонку не тратит место', povtor.statusCode === 200 && /<Connect>/.test(povtor.body || ''));

  await zvonok({ From: '+1555', To: '+14247244202', CallSid: 'CA11' });
  await zvonok({ From: '+1555', To: '+14247244202', CallSid: 'CA12' });
  const sverh = await zvonok({ From: '+1555', To: '+14247244202', CallSid: 'CA13' });
  p('четвёртый звонок за сутки — вежливый отбой',
    sverh.statusCode === 200 && /demo line is busy today/.test(sverh.body || '')
    && !/<Connect>/.test(sverh.body || ''));
  p('отбой по-английски и кладёт трубку',
    /language="en-US"/.test(sverh.body || '') && /<Hangup\/>/.test(sverh.body || ''));

  const den = new Date().toISOString().slice(0, 10);
  p('в счётчике ровно три звонка', [...mem.keys()].filter((k) => k.startsWith(den + '/')).length === 3,
    'записей ' + [...mem.keys()].length);

  console.log('\n--- свой номер мимо предела (обкатка) ---');
  // Предел уже выбран: любой чужой номер сейчас получает отбой.
  process.env.ZVONKI_BEZ_KVOTY = '+14242756121, +14247811913';
  const svoy = await zvonok({ From: '+14242756121', To: '+14247244202', CallSid: 'CA20' });
  p('свой номер соединяют сверх предела',
    svoy.statusCode === 200 && /<Connect>/.test(svoy.body || ''));
  p('и места в счётчике он не занял',
    [...mem.keys()].filter((k) => k.startsWith(den + '/')).length === 3);

  const chuzhoy = await zvonok({ From: '+15559999999', To: '+14247244202', CallSid: 'CA21' });
  p('чужому сверх предела по-прежнему отбой',
    /demo line is busy today/.test(chuzhoy.body || '') && !/<Connect>/.test(chuzhoy.body || ''));

  process.env.ZVONKI_BEZ_KVOTY = '';
  const bezSpiska = await zvonok({ From: '+14242756121', To: '+14247244202', CallSid: 'CA22' });
  p('без списка исключений свой номер тоже упирается в предел',
    /demo line is busy today/.test(bezSpiska.body || ''));

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : `\nВСЕ ПРОВЕРКИ ЛИНИИ ПРОШЛИ (вызовов к ElevenLabs: ${vyzovov}, все подменены)`);
  process.exit(bed ? 1 : 0);
})();
