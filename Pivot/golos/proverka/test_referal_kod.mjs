// Код партнёра из ?p= доезжает до кассы. Читаем САМ исходник сборки (shtab/sayty/sborka.py),
// а не собранную страницу: тест не должен зависеть от того, собирал ли кто-то сайт сегодня.
// Ставится 26.09.2026 вместе с партнёрской программой.
//     node Pivot/golos/proverka/test_referal_kod.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const TUT = path.dirname(fileURLToPath(import.meta.url));
const SBORKA = path.join(TUT, '..', '..', '..', 'shtab', 'sayty', 'sborka.py');

const src = fs.readFileSync(SBORKA, 'utf8');
const m = src.match(/<script>\/\* REFERAL \*\/([\s\S]*?)<\/script>/);
if (!m) { console.log('  В sborka.py нет куска REFERAL — тест проверять нечего'); process.exit(1); }
// В питоновской строке экранирование своё; берём то, что реально уедет в страницу.
const js = m[1].replace(/\\\\/g, '\\');

let bed = 0;
const p = (n, ok, d = '') => { if (!ok) bed++; console.log('  ' + n.padEnd(56), ok ? 'ДА' : 'ПРОВАЛ', d); };

function prognat({ poisk = '', cookie = '', hranilishche = null, ssylki = [] }) {
  const store = new Map(); if (hranilishche) store.set('bidna_p', hranilishche);
  const uzly = ssylki.map(h => ({ h, getAttribute: () => h, setAttribute(_, v) { this.h = v; } }));
  const dok = { cookie, readyState: 'complete',
                querySelectorAll: s => s.includes('buy.stripe.com') ? uzly : [],
                addEventListener() {} };
  new Function('location', 'document', 'localStorage', 'URLSearchParams', js)(
    { search: poisk, protocol: 'https:' }, dok,
    { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, URLSearchParams);
  return { ssylki: uzly.map(u => u.h), cookie: dok.cookie, pamyat: store.get('bidna_p') };
}

const KASSA = 'https://buy.stripe.com/28E6oz3V6abMbPLbY7frW03';       // Вера $1000
const KASSA_VIS = 'https://buy.stripe.com/cNi8wHdvG4RsbPLe6ffrW05';   // Видимость $1500
let r = prognat({ poisk: '?p=anna', ssylki: [KASSA] });
p('код и товар уехали в кассу', r.ssylki[0] === KASSA + '?client_reference_id=anna_vera1', r.ssylki[0]);
p('у другой кассы своя метка товара',
  prognat({ poisk: '?p=anna', ssylki: [KASSA_VIS] }).ssylki[0].endsWith('=anna_vis1'));
p('незнакомая касса помечается как inoe',
  prognat({ poisk: '?p=anna', ssylki: ['https://buy.stripe.com/zzzNEZNAKOMAYA9'] })
    .ssylki[0].endsWith('=anna_inoe'));
p('подчёркивание в коде партнёра не принимается',
  prognat({ poisk: '?p=an_na', ssylki: [KASSA] }).ssylki[0] === KASSA);
p('код записан в память', r.pamyat === 'anna');
p('код записан в cookie на год', /bidna_p=anna/.test(r.cookie) && /max-age=31536000/.test(r.cookie));
p('cookie помечена secure и samesite', /secure/.test(r.cookie) && /samesite=lax/.test(r.cookie));

p('на следующей странице код берётся из памяти',
  prognat({ hranilishche: 'anna', ssylki: [KASSA] }).ssylki[0].endsWith('=anna_vera1'));
p('код берётся из cookie, когда память пуста',
  prognat({ cookie: 'bidna_p=igor; a=b', ssylki: [KASSA] }).ssylki[0].endsWith('=igor_vera1'));
p('новая ссылка перебивает старый код',
  prognat({ poisk: '?p=nadia', cookie: 'bidna_p=igor', hranilishche: 'igor', ssylki: [KASSA] })
    .ssylki[0].endsWith('=nadia_vera1'));
p('без кода ссылка не тронута', prognat({ ssylki: [KASSA] }).ssylki[0] === KASSA);
p('мусор вместо кода отброшен',
  prognat({ poisk: '?p=%3Cscript%3E', ssylki: [KASSA] }).ssylki[0] === KASSA);
p('слишком длинный код отброшен',
  prognat({ poisk: '?p=' + 'x'.repeat(80), ssylki: [KASSA] }).ssylki[0] === KASSA);
p('регистр приводится к нижнему',
  prognat({ poisk: '?p=ANNA', ssylki: [KASSA] }).ssylki[0].endsWith('=anna_vera1'));
p('вторая метка цепляется через амперсанд',
  prognat({ poisk: '?p=anna', ssylki: [KASSA + '?prefilled_email=a%40b.c'] }).ssylki[0]
    === KASSA + '?prefilled_email=a%40b.c&client_reference_id=anna_vera1');
p('уже размеченная ссылка не портится',
  prognat({ poisk: '?p=anna', ssylki: [KASSA + '?client_reference_id=igor'] }).ssylki[0].endsWith('=igor'));
p('код находится рядом с другими метками',
  prognat({ poisk: '?p=anna&utm_source=tg', ssylki: [KASSA] }).ssylki[0].endsWith('=anna_vera1'));

// Вставка обязана стоять во ВСЕХ генераторах страниц, иначе партнёр теряет клиента молча.
for (const g of ['sborka.py', 'zvonki.py']) {
  const t = fs.readFileSync(path.join(TUT, '..', '..', '..', 'shtab', 'sayty', g), 'utf8');
  p(`генератор ${g} ставит код партнёра`, /kod_partnera\(/.test(t));
}

console.log(bed ? `\n  ПРОВАЛОВ: ${bed}` : '\n  всё сошлось');
process.exit(bed ? 1 : 0);
