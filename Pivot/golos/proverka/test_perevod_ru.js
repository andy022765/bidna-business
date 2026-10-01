// Перевод РУССКОЙ линии на Андрея (план Б): кого пускаем, что уходит в Twilio, ширма, итог.
// Сеть подменена, наружу ничего. Живые звонки — отдельно, по таблице в PLAN-B-PEREVOD.md.
//
//   node Pivot/golos/proverka/test_perevod_ru.js
const path = require('path');
const KOREN = path.join(__dirname, '..', 'site');
process.env.GOLOS_PISMO_SECRET = 's';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'ttest';

let zvonok = { to: '+14247811913', status: 'in-progress' };
let obnovleno = null, kodZvonka = 200, kodObnovleniya = 200;
global.fetch = async (url, opt) => {
  const post = (opt || {}).method === 'POST' || !!(opt || {}).body;
  if (post) {
    obnovleno = new URLSearchParams((opt || {}).body || '').get('Twiml');
    return { status: kodObnovleniya, text: async () => JSON.stringify({ sid: 'CA1' }) };
  }
  return { status: kodZvonka, text: async () => JSON.stringify(zvonok) };
};
const { handler } = require(path.join(KOREN, 'netlify-functions', 'perevod-ru.js'));

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(60), ok ? 'ДА' : 'ПРОВАЛ', d); };
const SID = 'CA' + 'b'.repeat(32);
const zvat = (telo, sec = 's') => handler({ httpMethod: 'POST', headers: { 'x-golos-secret': sec },
  body: JSON.stringify(telo) }).then((r) => JSON.parse(r.body));
// Twilio зовёт ширму, её ответ и итог формой; Netlify иногда отдаёт тело в base64.
const twilioZovet = (q, forma = {}, b64 = false) => {
  const telo = new URLSearchParams(forma).toString();
  return handler({ httpMethod: 'POST', queryStringParameters: q, isBase64Encoded: b64,
    body: b64 ? Buffer.from(telo).toString('base64') : telo }).then((r) => r.body);
};
// Голый & в XML ломает весь TwiML — Twilio тогда говорит «application error».
const xmlCel = (s) => !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(s);
const razobrat = (url) => Object.fromEntries(new URL(url.replace(/&amp;/g, '&')).searchParams);

(async () => {
  console.log('--- кого не переводим ---');
  p('без секрета — отказ', (await zvat({ call_sid: SID }, 'нет')).perevedeno === false);
  p('кривой call_sid — отказ', (await zvat({ call_sid: 'CA-не-тот' })).pochemu === 'net_sid');

  zvonok = { to: '+14247244202', status: 'in-progress' };      // английская линия
  const chuzhoy = await zvat({ call_sid: SID });
  p('звонок не на русскую линию — отказ', chuzhoy.pochemu === 'chuzhoy');
  p('и TwiML не отправлен', obnovleno === null);

  zvonok = { to: '+14247811913', status: 'completed' };
  p('звонок уже завершён — отказ', (await zvat({ call_sid: SID })).pochemu === 'ne_v_rabote');
  p('при отказе Вере велено не врать про перевод',
    /НЕ говори, что переводишь/.test((await zvat({ call_sid: SID })).dalshe || ''));

  console.log('\n--- перевод ---');
  zvonok = { to: '+14247811913', status: 'in-progress' };
  const ok = await zvat({ call_sid: SID, svodka: 'хочет начать внедрение, вопрос по оплате' });
  const t = obnovleno || '';
  p('переводит', ok.perevedeno === true);
  p('TwiML — целый XML (нет голых &)', xmlCel(t));
  p('сначала фраза голосом Веры', /^<\?xml[^>]*\?><Response><Play>https:\/\/dezhurny-r4p8w2\.netlify\.app\/zvuk\/soedinyayu\.mp3<\/Play>/.test(t));
  p('ждём 20 с, звоним с русской линии', /<Dial timeout="20" callerId="\+14247811913"/.test(t));
  p('звоним Андрею', /<Number url="[^"]+" method="POST">\+15614516864<\/Number>/.test(t));
  const dial = (t.match(/<Dial [^>]*action="([^"]+)"/) || [])[1] || '';
  const num = (t.match(/<Number url="([^"]+)"/) || [])[1] || '';
  p('у Dial есть итог (иначе «не ответил» после разговора)', /shag=itog/.test(dial));
  p('у Number есть ширма', /shag=shirma/.test(num));
  const qs = razobrat(num);
  p('в ширме sid звонка и метка', qs.p === SID && /^[0-9a-f]{32}$/.test(qs.k || ''));
  p('сводка доехала до ширмы', qs.s === 'хочет начать внедрение, вопрос по оплате');
  p('после Dial ничего нет — откат только через итог', /<\/Dial><\/Response>$/.test(t));

  obnovleno = null;
  await zvat({ call_sid: SID, svodka: '<Say>взлом</Say> & "кавычки" ' + 'я'.repeat(300) });
  const qs2 = razobrat((obnovleno.match(/<Number url="([^"]+)"/) || [])[1] || 'https://x/');
  p('сводка без разметки', !/[<>&"]/.test(qs2.s || ''));
  p('сводка не длиннее 140', (qs2.s || '').length <= 140);
  p('и TwiML по-прежнему целый', xmlCel(obnovleno));

  console.log('\n--- ширма (слышит только Андрей) ---');
  const sh = await twilioZovet(qs);
  p('ширма целый XML', xmlCel(sh));
  p('просит нажать один', /<Gather numDigits="1" timeout="6" action="[^"]+shag=prinyat[^"]*"/.test(sh) && /Нажмите один/.test(sh));
  p('называет сводку', /вопрос по оплате/.test(sh));
  p('не нажал — трубка кладётся', /<\/Gather><Hangup\/><\/Response>$/.test(sh));
  const chuzhayaShirma = await twilioZovet({ shag: 'shirma', p: SID, k: 'f'.repeat(32) });
  p('чужая метка — сразу отбой, ни с кем не соединяет', /<Response><Hangup\/><\/Response>$/.test(chuzhayaShirma));
  p('без метки — тоже отбой', /<Hangup\/>/.test(await twilioZovet({ shag: 'shirma', p: SID })));

  console.log('\n--- нажатие ---');
  const pq = razobrat((sh.match(/action="([^"]+shag=prinyat[^"]*)"/) || [])[1] || 'https://x/');
  const odin = await twilioZovet(pq, { Digits: '1' });
  p('нажал 1 — пустой ответ, соединяем', /<Response><\/Response>$/.test(odin));
  p('нажал 1, тело в base64 — тоже соединяем', /<Response><\/Response>$/.test(await twilioZovet(pq, { Digits: '1' }, true)));
  p('нажал 2 — тоже соединяем (любая цифра = человек)', /<Response><\/Response>$/.test(await twilioZovet(pq, { Digits: '2' })));
  p('цифры нет — отбой', /<Hangup\/>/.test(await twilioZovet(pq, {})));
  p('чужая метка при нажатии — отбой', /<Hangup\/>/.test(
    await twilioZovet({ shag: 'prinyat', p: SID, k: '0'.repeat(32) }, { Digits: '1' })));
  let upala = false;
  try { await twilioZovet({ shag: 'prinyat', p: SID, k: 'я'.repeat(32) }, { Digits: '1' }); } catch (_) { upala = true; }
  p('метка из многобайтных букв — не падает, а отбой', !upala);

  console.log('\n--- сводка с эмодзи на границе ---');
  obnovleno = null; kodObnovleniya = 200;
  let upalaSvodka = false;
  try { await zvat({ call_sid: SID, svodka: 'а'.repeat(139) + '😀' + 'хвост' }); } catch (_) { upalaSvodka = true; }
  p('эмодзи на 140-м знаке не роняет перевод', !upalaSvodka && !!obnovleno && xmlCel(obnovleno));

  console.log('\n--- итог дозвона ---');
  const iq = razobrat(dial);
  const pogovorili = await twilioZovet(iq, { DialCallStatus: 'completed', DialBridged: 'true' });
  p('поговорили — просто отбой, без «не ответил»', /<Response><Hangup\/><\/Response>$/.test(pogovorili));
  const avto = await twilioZovet(iq, { DialCallStatus: 'completed', DialBridged: 'false' });
  p('ответил автоответчик (ширма не пройдена) — откат', /zvuk\/ne-otvetil\.mp3<\/Play><Hangup\/>/.test(avto));
  p('не взял — откат', /ne-otvetil\.mp3/.test(await twilioZovet(iq, { DialCallStatus: 'no-answer', DialBridged: 'false' })));
  p('занято — откат', /ne-otvetil\.mp3/.test(await twilioZovet(iq, { DialCallStatus: 'busy' })));
  p('итог без метки — всё равно откат, не тишина',
    /ne-otvetil\.mp3/.test(await twilioZovet({ shag: 'itog' }, { DialCallStatus: 'no-answer' })));

  console.log('\n--- когда Twilio отказывает ---');
  kodObnovleniya = 400;
  const otkaz = await zvat({ call_sid: SID });
  p('Вере честно: не перевелось', otkaz.perevedeno === false && otkaz.pochemu === 'twilio');

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ПЕРЕВОДА РУССКОЙ ЛИНИИ ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
