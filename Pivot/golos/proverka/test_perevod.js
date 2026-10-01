// Перевод звонка на живого: кого пускаем, кого нет. Сеть подменена, наружу ничего.
//
//   node Pivot/golos/proverka/test_perevod.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
process.env.GOLOS_PISMO_SECRET = 's';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'ttest';
process.env.TWILIO_NOMER_EN = '+14247244202';
process.env.PEREVOD_NOMER = '+14247811913';

let zvonok = { to: '+14247244202', status: 'in-progress' };
let obnovleno = null, kodZvonka = 200, kodObnovleniya = 200;
global.fetch = async (url, opt) => {
  const post = (opt || {}).method === 'POST' || !!(opt || {}).body;
  if (post) {
    obnovleno = new URLSearchParams((opt || {}).body || '').get('Twiml');
    return { status: kodObnovleniya, text: async () => JSON.stringify({ sid: 'CA1' }) };
  }
  return { status: kodZvonka, text: async () => JSON.stringify(zvonok) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'perevod.js'));

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(52), ok ? 'ДА' : 'ПРОВАЛ', d); };
const SID = 'CA' + 'a'.repeat(32);
const zvat = (telo, sec = 's') => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': sec },
  body: JSON.stringify(telo) }).then((r) => JSON.parse(r.body));

(async () => {
  console.log('--- кого не переводим ---');
  p('без секрета — отказ', (await zvat({ call_sid: SID }, 'нет')).perevedeno === false);
  p('кривой call_sid — отказ',
    (await zvat({ call_sid: 'CA-не-тот', yazyk: 'en' })).pochemu === 'net_sid');

  zvonok = { to: '+14247811913', status: 'in-progress' };   // боевая русская линия
  const chuzhoy = await zvat({ call_sid: SID, yazyk: 'en' });
  p('звонок не на нашу английскую линию — отказ', chuzhoy.pochemu === 'chuzhoy');
  p('и TwiML не отправлен', obnovleno === null);

  zvonok = { to: '+14247244202', status: 'completed' };
  p('звонок уже завершён — отказ', (await zvat({ call_sid: SID })).pochemu === 'ne_v_rabote');

  console.log('\n--- перевод ---');
  zvonok = { to: '+14247244202', status: 'in-progress' };
  const ok = await zvat({ call_sid: SID, yazyk: 'en' });
  p('переводит', ok.perevedeno === true, ok.skazat);
  p('в TwiML есть Dial на наш номер', /<Dial[^>]*><Number>\+14247811913<\/Number>/.test(obnovleno || ''));
  p('и есть что сказать, если не подняли', /Nobody picked up/.test(obnovleno || ''));
  p('по-английски говорит по-английски', /language="en-US"/.test(obnovleno || '') && !/ru-RU/.test(obnovleno || ''));

  obnovleno = null;
  const okRu = await zvat({ call_sid: SID });
  p('по-русски говорит по-русски', /language="ru-RU"/.test(obnovleno || '') && okRu.perevedeno === true);

  console.log('\n--- когда Twilio отказывает ---');
  kodObnovleniya = 400;
  const otkaz = await zvat({ call_sid: SID, yazyk: 'en' });
  p('Вере честно: не перевелось', otkaz.perevedeno === false && otkaz.pochemu === 'twilio');
  p('и велено не врать про перевод', /Do NOT say you are transferring/.test(otkaz.dalshe || ''));

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ПЕРЕВОДА ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
