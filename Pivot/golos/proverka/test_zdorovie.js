// Эндпоинт здоровья движков: ключ, кэш, слово для сторожа. Сеть подменена.
//
//   node Pivot/golos/proverka/test_zdorovie.js
const path = require('path');
const KOREN = path.join(__dirname, '..', '..', '..');
const Module = require('module');
const mem = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({
    get: async (k) => mem.get(k) ?? null,
    set: async (k, v) => { mem.set(k, v); } }) };
  return orig.call(this, req, ...a);
};
process.env.ZDOROVIE_KEY = 'zk';
process.env.OPENAI_API_KEY = 'a'; process.env.ANTHROPIC_API_KEY = 'b'; process.env.PERPLEXITY_API_KEY = 'c';
let sostoyanie = { openai: true, anthropic: true, perplexity: true };
let vyzovov = 0;
global.fetch = async (url) => {
  vyzovov++;
  const s = String(url);
  const kto = s.includes('openai') ? 'openai' : s.includes('anthropic') ? 'anthropic' : 'perplexity';
  if (sostoyanie[kto]) return { ok: true, text: async () => '{}' };
  return { ok: false, status: 400,
    text: async () => JSON.stringify({ error: { code: 'credit_balance_exhausted', type: 'invalid_request_error' } }) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'zdorovie.js'));

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(52), ok ? 'ДА' : 'ПРОВАЛ', d); };
const zvat = (q = {}) => handler({ queryStringParameters: { k: 'zk', ...q } });

(async () => {
  const bezKlyucha = await handler({ queryStringParameters: {} });
  p('без ключа читать МОЖНО — это для сторожа', bezKlyucha.statusCode === 200, bezKlyucha.body);
  const chuzhoy = await handler({ queryStringParameters: { svezho: '1' } });
  p('без ключа принудительно проверять НЕЛЬЗЯ', chuzhoy.statusCode === 403);

  mem.clear(); vyzovov = 0;
  const vse = await zvat({ svezho: '1' });
  p('все три живы — слово для сторожа есть',
    /DVIZHKI-ZHIVY/.test(vse.body) && !/BEDA/.test(vse.body), vse.body);
  p('три вызова, по одному на движок', vyzovov === 3, String(vyzovov));

  vyzovov = 0;
  const izKesha = await zvat();
  p('второй запрос берётся из кэша, денег не тратит', vyzovov === 0 && /из кэша/.test(izKesha.body));

  sostoyanie.openai = false;
  const svezho = await zvat({ svezho: '1' });
  p('кончились деньги у OpenAI — слова нет',
    !/DVIZHKI-ZHIVY/.test(svezho.body) && /DVIZHKI-BEDA/.test(svezho.body), svezho.body);
  p('виноватый назван по имени', /openai:credit_balance_exhausted/.test(svezho.body));

  sostoyanie = { openai: false, anthropic: false, perplexity: false };
  const vseUpali = await zvat({ svezho: '1' });
  p('легли все — все три в ответе',
    /openai/.test(vseUpali.body) && /anthropic/.test(vseUpali.body) && /perplexity/.test(vseUpali.body));

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ЗДОРОВЬЯ ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
