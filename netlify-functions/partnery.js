// Страница «кому сколько должны» плюс работа со списком партнёров. Под ключом.
// Выплата ручная до пятого партнёра (решение Андрея 26.09), поэтому здесь нет
// никаких переводов денег — только что кому причитается и отметка «выплачено».
//
//   GET  ?k=…              — страница
//   POST ?k=… {deystvie:…} — partnyor | privyazka | vyplacheno | snyat-vyplatu
// Переменные: PARTNERY_KLYUCH
const { TOVARY, otkryt, chistyyKod, hvost, chistayaPochta, privyazat } = require('./referal/lib.js');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const HTML_H = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
const dollary = (c) => '$' + ((c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
const ekran = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const den = (iso) => String(iso || '').slice(0, 10);

async function vsyo(store, prefix) {
  const out = [];
  let kursor;
  do {
    const r = await store.list({ prefix, cursor: kursor });
    for (const b of r.blobs || []) {
      try { const v = JSON.parse((await store.get(b.key)) || 'null'); if (v) out.push([b.key, v]); }
      catch (_) { /* битую строку показываем как отсутствующую, но не роняем страницу */ }
    }
    kursor = r.cursor;
  } while (kursor);
  return out;
}

// Отметки на строке. Возврат ставится РУКАМИ: событие charge.refunded в боевом
// endpoint пока не отмечено (Андрей не нашёл группу Charge в списке), а возвраты
// редки. Когда событие добавят, оно проставит ту же отметку само — формат один.
function otmetki(id, o) {
  const kn = (d, t) => `<button data-id="${ekran(id)}" data-delo="${d}">${t}</button>`;
  const ch = [];
  if (o.vozvrat) ch.push(`<b>возврат ${ekran(den(o.vozvrat.kogda))}</b>`, kn('snyat-vozvrat', 'снять возврат'));
  else if (o.vyplacheno) ch.push(`выплачено ${ekran(den(o.vyplacheno.kogda))}`,
                                 kn('snyat-vyplatu', 'снять выплату'), kn('vozvrat', 'отметить возврат'));
  else {
    if (o.komissiya_c) ch.push(kn('vyplacheno', 'отметить выплату'));
    ch.push(kn('vozvrat', 'отметить возврат'));
  }
  return ch.join(' ');
}

// Дописать товар и комиссию руками. Нужно там, где сервер не мог знать: новая касса,
// оплата по счёту, спорная привязка. Сумму вводим в долларах — в центах человек ошибётся.
function pravka(id, o) {
  return `<form class="pr" data-id="${ekran(id)}">
    <input name="opisanie" placeholder="что за товар" value="${ekran(o.ne_znaem ? '' : o.opisanie)}">
    <input name="komissiya" placeholder="$ комиссия" inputmode="decimal"
           value="${o.komissiya_c ? (o.komissiya_c / 100) : ''}">
    <button>записать</button></form>`;
}

function stranica({ oplaty, partnery, svyazi }) {
  const zhivye = oplaty.filter(([, o]) => o.komissiya_c > 0 && !o.vyplacheno);
  const dolg = {};
  for (const [, o] of zhivye) dolg[o.kod] = (dolg[o.kod] || 0) + o.komissiya_c;
  // Сюда же — оплаты, товар которых мы не знаем: по правилу Андрея от 27.09 комиссия
  // положена с ЛЮБОГО продукта, включая новые. Новая касса не должна тихо лежать
  // в общем списке с подписью «комиссии нет».
  const neopoznano = oplaty.filter(([, o]) => !o.kod || o.spor || o.ne_znaem);

  const ryad = (k, o) => `<tr class="${o.vozvrat ? 'vozvrat' : ''}">
    <td>${ekran(den(o.kogda))}</td><td>${ekran(o.opisanie)}</td><td class="n">${dollary(o.summa_c)}</td>
    <td>${o.kod ? ekran((partnery[o.kod] || {}).imya || o.kod) : '<i>не опознан</i>'}
        ${o.spor ? `<span class="spor">спор: ${ekran(o.spor.join(', '))}</span>` : ''}</td>
    <td class="n">${o.komissiya_c ? dollary(o.komissiya_c)
      : `<span class="nol">—<small>${ekran(o.pochemu_nol || 'комиссии нет')}</small></span>`}</td>
    <td class="dela">${otmetki(k.slice(7), o)}</td></tr>`;

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Кому сколько должны</title><style>
:root{--ink:#16203f;--tih:#5b6577;--ram:#e4e8ef;--fon:#fff}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#e8ecf4;--tih:#9aa4b8;--ram:#2a3348;--fon:#121722}}
:root[data-theme="dark"]{--ink:#e8ecf4;--tih:#9aa4b8;--ram:#2a3348;--fon:#121722}
body{margin:0;padding:24px 16px;background:var(--fon);color:var(--ink);
 font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
.w{max-width:1000px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}
p.t{color:var(--tih);margin:0 0 20px}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{padding:9px 8px;border-bottom:1px solid var(--ram);text-align:left;vertical-align:top}
th{color:var(--tih);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
td.n,th.n{text-align:right;white-space:nowrap}
tr.vozvrat td{opacity:.55}
td.dela{white-space:normal}
td.dela button{margin:2px 4px 2px 0}
form.pr{display:flex;flex-wrap:wrap;gap:6px;margin:0}
form.pr input{min-width:96px;flex:1 1 96px;font-size:14px}
form.pr button{flex:0 0 auto}
/* Причина нуля читается глазами, а не наведением: Андрей смотрит с телефона,
   где подсказки по наведению не существует вовсе. */
.nol small{display:block;color:var(--tih);font-size:13px;line-height:1.35;margin-top:2px;
 max-width:190px;margin-left:auto;text-wrap:balance}
.spor{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;background:#b3541e;color:#fff;font-size:12px}
.itog td{font-weight:700;border-top:2px solid var(--ram);border-bottom:none}
button{min-height:44px;padding:0 14px;border:1px solid var(--ram);border-radius:8px;
 background:transparent;color:var(--ink);font:inherit;cursor:pointer}
button:hover{background:var(--ram)}
form{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
input{min-height:44px;padding:0 10px;border:1px solid var(--ram);border-radius:8px;
 background:transparent;color:var(--ink);font:inherit;min-width:150px;flex:1}
@media(max-width:700px){table,thead,tbody,th,td,tr{display:block}thead{display:none}
 td{border:none;padding:3px 0}tr{border-bottom:1px solid var(--ram);padding:10px 0}td.n{text-align:left}
 .nol small{max-width:none;margin-left:0}}
</style></head><body><div class="w">
<h1>Кому сколько должны</h1>
<p class="t">Выплата ручная. Отметили «выплачено» — строка уходит из долга.</p>

<h2>К выплате</h2>
${Object.keys(dolg).length ? `<table><thead><tr><th>Партнёр</th><th>Телефон</th><th class="n">Сумма</th></tr></thead><tbody>
${Object.entries(dolg).sort((a, b) => b[1] - a[1]).map(([k, s]) =>
  `<tr><td>${ekran((partnery[k] || {}).imya || k)}</td><td>${ekran((partnery[k] || {}).telefon || '—')}</td>
   <td class="n">${dollary(s)}</td></tr>`).join('')}
<tr class="itog"><td>Всего</td><td></td><td class="n">${dollary(Object.values(dolg).reduce((a, b) => a + b, 0))}</td></tr>
</tbody></table>` : '<p class="t">Пусто.</p>'}

<h2>Все оплаты</h2>
${oplaty.length ? `<table><thead><tr><th>Дата</th><th>Товар</th><th class="n">Чек</th><th>Партнёр</th>
<th class="n">Комиссия</th><th></th></tr></thead><tbody>
${oplaty.sort((a, b) => String(b[1].kogda).localeCompare(String(a[1].kogda))).map(([k, o]) => ryad(k, o)).join('')}
</tbody></table>` : '<p class="t">Оплат ещё не было.</p>'}

<h2>Не опознано${neopoznano.length ? ` — ${neopoznano.length}` : ''}</h2>
<p class="t">Оплаты без партнёра и спорные. Тихая потеря становится видимой строкой:
партнёр говорит «я привёл вам человека» — здесь это проверяется, а не обсуждается.</p>
${neopoznano.length ? `<table><thead><tr><th>Дата</th><th>Товар</th><th class="n">Чек</th>
<th>Кто платил</th><th>Почему здесь</th><th>Дописать</th></tr></thead><tbody>
${neopoznano.map(([k, o]) => `<tr><td>${ekran(den(o.kogda))}</td><td>${ekran(o.opisanie)}</td>
 <td class="n">${dollary(o.summa_c)}</td>
 <td>${ekran(o.pochta || '—')}<br><small>${ekran(o.telefon || '')}</small>
     ${o.kod ? `<br><small>привёл: ${ekran((partnery[o.kod] || {}).imya || o.kod)}</small>` : ''}</td>
 <td><small>${ekran(o.pochemu_nol || '')}</small></td>
 <td class="dela">${pravka(k.slice(7), o)}</td></tr>`).join('')}
</tbody></table>` : '<p class="t">Пусто.</p>'}

<h2>Партнёры</h2>
${Object.keys(partnery).length ? `<table><thead><tr><th>Код</th><th>Имя</th><th>Почта</th><th>Телефон</th></tr></thead><tbody>
${Object.entries(partnery).map(([k, p]) => `<tr><td><code>${ekran(k)}</code></td><td>${ekran(p.imya)}</td>
 <td>${ekran(p.pochta || '—')}</td><td>${ekran(p.telefon || '—')}</td></tr>`).join('')}
</tbody></table>` : '<p class="t">Партнёров ещё нет.</p>'}
<form id="f-partnyor"><input name="kod" placeholder="код, латиницей" required>
<input name="imya" placeholder="имя" required><input name="pochta" placeholder="почта" type="email">
<input name="telefon" placeholder="телефон"><button>Добавить партнёра</button></form>

<h2>Привязки клиентов</h2>
<p class="t">Ручная — когда человек пришёл по письму-знакомству, а не по ссылке: метка в браузере
теряется при смене устройства. Работает так же и бессрочно.</p>
${svyazi.length ? `<table><thead><tr><th>Клиент</th><th>Партнёр</th><th>Как</th><th>Когда</th></tr></thead><tbody>
${svyazi.map(([k, v]) => `<tr><td>${ekran(k.replace(/^svyaz:(pochta|telefon):/, ''))}</td>
 <td>${ekran((partnery[v.kod] || {}).imya || v.kod)}</td>
 <td>${v.kak === 'ruchnaya' ? 'по письму, руками' : 'по ссылке'}</td><td>${ekran(den(v.kogda))}</td></tr>`).join('')}
</tbody></table>` : '<p class="t">Привязок ещё нет.</p>'}
<form id="f-privyazka"><input name="kontakt" placeholder="почта или телефон клиента" required>
<input name="kod" placeholder="код партнёра" required><button>Привязать по письму</button></form>

<script>
var K = new URLSearchParams(location.search).get('k') || '';
function poslat(telo){
  return fetch(location.pathname + '?k=' + encodeURIComponent(K),
    {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(telo)})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d && d.ok) location.reload(); else alert((d && d.pochemu) || 'не вышло'); });
}
document.getElementById('f-partnyor').addEventListener('submit', function(e){ e.preventDefault();
  var f = new FormData(e.target), t = {deystvie:'partnyor'};
  f.forEach(function(v,k){ t[k]=v; }); poslat(t); });
document.getElementById('f-privyazka').addEventListener('submit', function(e){ e.preventDefault();
  var f = new FormData(e.target), t = {deystvie:'privyazka'};
  f.forEach(function(v,k){ t[k]=v; }); poslat(t); });
var SLOVA = {'vyplacheno':'Отметить выплату по этой строке?',
             'snyat-vyplatu':'Снять отметку о выплате?',
             'vozvrat':'Отметить возврат? У партнёра мы его не удерживаем — строка просто станет видна как возвращённая.',
             'snyat-vozvrat':'Снять отметку о возврате?'};
Array.prototype.forEach.call(document.querySelectorAll('form.pr'), function(f){
  f.addEventListener('submit', function(e){ e.preventDefault();
    var d = new FormData(f), t = {deystvie:'pravka', id:f.getAttribute('data-id')};
    d.forEach(function(v,k){ t[k]=v; }); poslat(t); }); });
Array.prototype.forEach.call(document.querySelectorAll('button[data-id]'), function(b){
  b.addEventListener('click', function(){
    var d = b.getAttribute('data-delo');
    if(confirm(SLOVA[d] || 'Продолжить?'))
      poslat({deystvie:d, id:b.getAttribute('data-id')}); }); });
</script></div></body></html>`;
}

exports.handler = async (event) => {
  const klyuch = process.env.PARTNERY_KLYUCH;
  const dan = (event.queryStringParameters || {}).k || '';
  if (!klyuch || dan !== klyuch) return { statusCode: 401, headers: JSON_H, body: '{"ok":false}' };

  const store = otkryt();
  if (!store) return { statusCode: 200, headers: HTML_H, body: '<p>Хранилище не поднялось.</p>' };

  if (event.httpMethod === 'POST') {
    let b = {};
    try { b = JSON.parse(event.body || '{}'); } catch (_) {}
    const d = b.deystvie;

    if (d === 'partnyor') {
      const kod = chistyyKod(b.kod);
      if (!kod) return { statusCode: 200, headers: JSON_H,
        body: '{"ok":false,"pochemu":"код только строчными латиницей и цифрами, без подчёркивания"}' };
      if (!String(b.imya || '').trim()) return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"нужно имя"}' };
      await store.set(`kod:${kod}`, JSON.stringify({ imya: String(b.imya).trim().slice(0, 80),
        pochta: chistayaPochta(b.pochta), telefon: String(b.telefon || '').trim().slice(0, 32),
        dobavlen: new Date().toISOString() }));
      return { statusCode: 200, headers: JSON_H, body: '{"ok":true}' };
    }

    if (d === 'privyazka') {
      const kod = chistyyKod(b.kod);
      if (!kod) return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"неверный код"}' };
      if (!(await store.get(`kod:${kod}`)))
        return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"такого партнёра нет — сперва добавьте его"}' };
      const kontakt = String(b.kontakt || '').trim();
      const pochta = kontakt.includes('@') ? kontakt : '';
      const telefon = kontakt.includes('@') ? '' : kontakt;
      if (!pochta && hvost(telefon).length !== 10)
        return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"нужна почта или телефон из десяти цифр"}' };
      const postavleno = await privyazat(store, { pochta, telefon, kod, kak: 'ruchnaya',
                                                  kogda: new Date().toISOString() });
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify(postavleno.length
        ? { ok: true } : { ok: false, pochemu: 'на этот контакт привязка уже есть — она бессрочная и не перетирается' }) };
    }

    if (d === 'pravka') {
      const k = `oplata:${String(b.id || '')}`;
      let v = null;
      try { v = JSON.parse((await store.get(k)) || 'null'); } catch (_) {}
      if (!v) return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"строка не найдена"}' };
      const opis = String(b.opisanie || '').trim().slice(0, 80);
      const dollarov = String(b.komissiya || '').trim().replace(',', '.');
      if (!opis && !dollarov)
        return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"нечего записывать"}' };
      if (dollarov) {
        if (!/^\d{1,6}(\.\d{1,2})?$/.test(dollarov))
          return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"комиссия — число в долларах, например 500 или 499.50"}' };
        const c = Math.round(parseFloat(dollarov) * 100);
        // Тот же потолок, что на сервере: пятая часть чека. Руками тоже нельзя назначить
        // больше, чем человек заплатил — иначе выплата идёт из нашего кармана.
        const potolok = Math.floor((v.summa_c || 0) * 0.2);
        if (c > potolok)
          return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ ok: false,
            pochemu: `больше пятой части чека нельзя: предел ${(potolok / 100).toFixed(2)}` }) };
        v.komissiya_c = c;
      }
      if (opis) { v.opisanie = opis; v.ne_znaem = false; }
      v.pochemu_nol = v.komissiya_c ? '' : 'дописано руками: комиссии нет';
      v.dopisano = { kogda: new Date().toISOString() };
      await store.set(k, JSON.stringify(v));
      return { statusCode: 200, headers: JSON_H, body: '{"ok":true}' };
    }

    if (['vyplacheno', 'snyat-vyplatu', 'vozvrat', 'snyat-vozvrat'].includes(d)) {
      const k = `oplata:${String(b.id || '')}`;
      let v = null;
      try { v = JSON.parse((await store.get(k)) || 'null'); } catch (_) {}
      if (!v) return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"строка не найдена"}' };
      const teper = new Date().toISOString();
      if (d === 'vyplacheno') v.vyplacheno = { kogda: teper };
      if (d === 'snyat-vyplatu') v.vyplacheno = null;
      // Возврат у партнёра НЕ удерживаем (решение Андрея 26.09): отметка только помечает
      // строку, чтобы мы видели её и не заплатили дважды по одному клиенту.
      if (d === 'vozvrat') v.vozvrat = { kogda: teper, summa_c: v.summa_c || 0, rukami: true };
      if (d === 'snyat-vozvrat') v.vozvrat = null;
      await store.set(k, JSON.stringify(v));
      return { statusCode: 200, headers: JSON_H, body: '{"ok":true}' };
    }
    return { statusCode: 200, headers: JSON_H, body: '{"ok":false,"pochemu":"неизвестное действие"}' };
  }

  const oplaty = await vsyo(store, 'oplata:');
  const svyazi = await vsyo(store, 'svyaz:');
  const partnery = {};
  for (const [k, v] of await vsyo(store, 'kod:')) partnery[k.slice(4)] = v;
  return { statusCode: 200, headers: HTML_H, body: stranica({ oplaty, partnery, svyazi }) };
};
