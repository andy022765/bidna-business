// Два добавления 26.09: желаемое время в свободных окнах и подтверждение продиктованного
// номера. Оба выросли из обкатки: просили вторник на два — молча дали понедельник на
// одиннадцать; встречи создавались вообще без контакта, «Call · No name».
//
//     node Pivot/golos/proverka/test_kalendar_vremya_nomer.js
const path = require('path');
const KORENJ = path.join(__dirname, '..', 'site');
const Module = require('module');

// Свободные окна подменяем: СУББОТА 26.09 (10:00, 14:00) и ВТОРНИК 29.09 (10:00, 14:00),
// время местное для Лос-Анджелеса. Так видно и фильтр по дню, и фильтр по часу.
const OKNA = ['2026-09-26T17:00:00.000Z', '2026-09-26T21:00:00.000Z',
              '2026-09-29T17:00:00.000Z', '2026-09-29T21:00:00.000Z'];
let sozdano = [];
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => ({ get: async () => null, set: async () => {} }) };
  if (String(req).includes('gkal')) {
    const nast = () => ({ poyas: 'America/Los_Angeles', kalendar: 'k@g', dlina: 30 });
    return {
      nastroyki: nast,
      podklyuchitBlobs: () => {},
      svobodnye: async () => ({ kod: 200, okna: OKNA, kalendarey: 2 }),
      slovami: (iso) => new Date(iso).toISOString().slice(0, 16),
      gapi: async (put, telo) => { sozdano.push(telo); return { kod: 200, telo: { id: 'ev1' } }; },
    };
  }
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's';
const okna = require(path.join(KORENJ, 'netlify-functions', 'kalendar-okna.js')).handler;
const zapis = require(path.join(KORENJ, 'netlify-functions', 'kalendar-zapis.js')).handler;

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(58), ok ? 'ДА' : 'ПРОВАЛ', d); };
const zov = (f, telo) => f({ httpMethod: 'POST', headers: { 'x-golos-secret': 's' },
                             body: JSON.stringify(telo) }).then(r => JSON.parse(r.body));

(async () => {
  console.log('--- желаемый день и час ---');
  const bez = await zov(okna, { yazyk: 'en' });
  p('без пожеланий — как раньше, ближайшие два', (bez.okna || []).length === 2 && bez.okna[0] === OKNA[0]);

  const vt = await zov(okna, { yazyk: 'en', den: 'tue' });
  p('просили вторник — дали вторник',
    (vt.okna || []).length === 2 && (vt.okna || []).every(x => x.startsWith('2026-09-29')),
    JSON.stringify(vt.okna));

  const vt14 = await zov(okna, { yazyk: 'en', den: 'tue', chas: 14 });
  p('вторник на два часа дня — ровно это окно',
    (vt14.okna || []).length === 1 && vt14.okna[0] === '2026-09-29T21:00:00.000Z',
    JSON.stringify(vt14.okna));

  const pn = await zov(okna, { yazyk: 'en', den: 'mon' });
  p('понедельника свободного нет — сказано ПРЯМО, а не подменено молча',
    /Nothing free then/i.test(pn.skazat || '') && /never swap their day/i.test(pn.dalshe || ''),
    (pn.skazat || '').slice(0, 60));
  p('и при этом ближайшее всё равно предложено', (pn.okna || []).length === 2);

  const noch = await zov(okna, { yazyk: 'en', den: 'tue', chas: 3 });
  p('ночью свободного нет — тоже прямой отказ', /Nothing free then/i.test(noch.skazat || ''));

  console.log('\n--- номер звонящего и подтверждение цифрами ---');
  sozdano = [];
  const sam = await zov(zapis, { yazyk: 'en', start_time: OKNA[0], telefon_zvonka: '+14242756121' });
  p('номер звонка подставился сам, без вопросов', sam.zapisano === true);
  p('и попал в событие', /\+14242756121/.test(JSON.stringify(sozdano[0] || {})),
    (sozdano[0] || {}).description ? 'есть описание' : 'нет описания');

  sozdano = [];
  const shag1 = await zov(zapis, { yazyk: 'en', start_time: OKNA[0],
    telefon_zvonka: '+14242756121', telefon: '555 1212' });
  p('другой номер — сперва читаем по цифрам, не записываем',
    shag1.zapisano === false && /5 5 5 1 2 1 2/.test(shag1.skazat || ''), shag1.skazat || '');
  p('встреча при этом НЕ создана', sozdano.length === 0);

  const shag2 = await zov(zapis, { yazyk: 'en', start_time: OKNA[0],
    telefon_zvonka: '+14242756121', telefon: '555 1212', podtverdil: true });
  p('после «да» записываем', shag2.zapisano === true);
  p('в событии оба номера: продиктованный и тот, с которого звонили',
    /555 1212/.test(JSON.stringify(sozdano[0])) && /14242756121/.test(JSON.stringify(sozdano[0])));

  sozdano = [];
  const tot = await zov(zapis, { yazyk: 'en', start_time: OKNA[0],
    telefon_zvonka: '+1 424 275 6121', telefon: '4242756121' });
  p('тот же номер в другой записи — подтверждать нечего', tot.zapisano === true);

  console.log(bed ? `\nПРОВАЛОВ: ${bed}` : '\nВСЕ ПРОВЕРКИ ВРЕМЕНИ И НОМЕРА ПРОШЛИ');
  process.exit(bed ? 1 : 0);
})();
