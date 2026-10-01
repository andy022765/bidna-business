// Паспорт: целостность, ссылка на запись, сверка цен с живыми страницами, выбор продукта и языка.
// Календарная часть паспорта и gkal.js — в отложенной записи: na-potom/tests/test-kartochka-zapis.js.
require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const K = require('../lib/kartochka');

const B = path.resolve(__dirname, '../../../../..');   // Our Business (Andrii & Masha)
const ISTOCHNIKI = path.join(B, 'shtab/sayty/istochniki');
const GLAVNYY_ZVONOK = path.join(B, 'netlify-functions/hochet-zvonok.js');

test('паспорт bid цел: все поля на двух языках, формы и страницы ведут на существующие продукты', () => {
  const k = K.vzyat('bid');
  assert.deepEqual(K.proverit(k), []);
  assert.match(k.__hesh, /^[0-9a-f]{12}$/);
});

test('кривой паспорт ловится: форма на несуществующий продукт и пустая цена', () => {
  const k = JSON.parse(JSON.stringify(K.vzyat('bid')));
  k.formy['lishnyaya'] = 'net-takogo';
  k.produkty.vera.ceny_en = [];
  const beda = K.proverit(k);
  assert.ok(beda.some(b => b.includes('lishnyaya')));
  assert.ok(beda.some(b => b.includes('vera: нет ceny_en')));
});

test('ссылка на запись: одна строка паспорта, Calendly из решения 29.09; без неё, по http или с кавычкой — паспорт не цел', () => {
  const k = K.vzyat('bid');
  assert.equal(k.ssylka_zapisi, 'https://calendly.com/businessinteldna-support/30min');
  for (const plohaya of [undefined, '', 'http://calendly.com/businessinteldna-support/30min', 'calendly.com/businessinteldna-support/30min',
                         'https://calendly.com/x" onclick="y', 'https://calendly.com/a b']) {
    const kk = JSON.parse(JSON.stringify(k));
    kk.ssylka_zapisi = plohaya;
    assert.ok(K.proverit(kk).some(b => b.startsWith('ssylka_zapisi')), 'пропустил: ' + plohaya);
  }
  const bezKnopki = JSON.parse(JSON.stringify(k));
  delete bezKnopki.teksty.knopka_zapisi_en;
  assert.ok(K.proverit(bezKnopki).includes('нет teksty.knopka_zapisi_en'));
});

test('календарь паспорту не нужен: живой паспорт без kalendar/vstrecha и без текстов своих окон — и он цел', () => {
  const k = K.vzyat('bid');
  assert.equal(k.kalendar, undefined);
  assert.equal(k.vstrecha, undefined);
  for (const t of ['vybor', 'ne_podhodit', 'bez_okon', 'tema_zapisi', 'zapisano', 'v_kalendar', 'perenesti'])
    assert.equal(k.teksty[t + '_ru'], undefined, t);
  assert.deepEqual(K.proverit(k), []);
});

test('на основном сайте кнопка «Остались вопросы?» ведёт на ту же ссылку Calendly, что в письме', { skip: !fs.existsSync(GLAVNYY_ZVONOK) && 'нет исходника основного сайта' }, () => {
  const m = fs.readFileSync(GLAVNYY_ZVONOK, 'utf8').match(/const KALENDAR = '([^']+)'/);
  assert.ok(m, 'в hochet-zvonok.js не нашлась строка const KALENDAR');
  assert.equal(m[1], K.vzyat('bid').ssylka_zapisi, 'основной сайт и письмо ведут в разные Calendly');
});

// Суммы после «$»: «$1 000», «$1,000», «$0,25», «+$1 500» → числа.
function dollary(tekst) {
  const out = new Set();
  const t = String(tekst).replace(/ /g, ' ');
  for (const m of t.matchAll(/\$\s?(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)/g)) {
    out.add(parseFloat(m[1].replace(/[ ,]/g, '') + (m[2] ? '.' + m[2] : '')));
  }
  return out;
}
function tekstStranicy(f) {
  const s = fs.readFileSync(path.join(ISTOCHNIKI, f), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#36;|&dollar;/g, '$');
}

test('каждая сумма в паспорте есть на живой странице своего продукта (паспорт и сайт не разъехались)', { skip: !fs.existsSync(ISTOCHNIKI) && 'нет shtab/sayty/istochniki' }, () => {
  const k = K.vzyat('bid');
  for (const [id, p] of Object.entries(k.produkty)) {
    const naSayte = new Set();
    for (const f of p.istochniki) for (const x of dollary(tekstStranicy(f))) naSayte.add(x);
    for (const y of ['ru', 'en']) for (const stroka of p['ceny_' + y]) for (const summa of dollary(stroka)) {
      assert.ok(naSayte.has(summa), `${id}/${y}: $${summa} из паспорта нет на ${p.istochniki.join(', ')} — «${stroka}»`);
    }
  }
});

test('набор сумм в русских и английских строках одного продукта один и тот же', () => {
  const k = K.vzyat('bid');
  for (const [id, p] of Object.entries(k.produkty)) {
    // Наборы, а не списки: на сайте «возвращаем всё до доллара» и «we return the full $1,500» — одно и то же.
    const ru = [...new Set(p.ceny_ru.flatMap(s => [...dollary(s)]))].sort((a, b) => a - b);
    const en = [...new Set(p.ceny_en.flatMap(s => [...dollary(s)]))].sort((a, b) => a - b);
    assert.deepEqual(ru, en, id);
  }
});

test('продукт по форме и странице; чужая форма — без ответа', () => {
  const k = K.vzyat('bid');
  assert.equal(K.produktDlya(k, 'hochet-zvonok', '/vera/ru/'), 'vera');
  assert.equal(K.produktDlya(k, 'hochet-zvonok', 'https://businessinteldna.com/visibility/?utm=x'), 'vidimost');
  assert.equal(K.produktDlya(k, 'hochet-zvonok', '/diagnostic/ru/'), 'diagnostika');
  assert.equal(K.produktDlya(k, 'hochet-zvonok', '/business/'), 'obshchiy');
  assert.equal(K.produktDlya(k, 'hochet-zvonok', '/veranda'), 'obshchiy', '/veranda — не /vera');
  assert.equal(K.produktDlya(k, 'geo-check', '/visibility/'), null);
  assert.equal(K.produktDlya(k, '_kak', '/vera/'), null, 'служебный ключ паспорта — не форма');
  assert.equal(K.produktDlya(k, '', '/vera/'), null);
});

test('язык: явный → -ru и /ru/ → английские страницы продуктов → по умолчанию русский', () => {
  const k = K.vzyat('bid');
  assert.equal(K.yazykDlya(k, 'hochet-zvonok', '/vera/'), 'en');
  assert.equal(K.yazykDlya(k, 'hochet-zvonok', '/vera/ru/'), 'ru');
  assert.equal(K.yazykDlya(k, 'vopros-ru', '/vera/'), 'ru');
  assert.equal(K.yazykDlya(k, 'hochet-zvonok', '/business/'), 'ru');
  assert.equal(K.yazykDlya(k, 'hochet-zvonok', '/business/', 'en'), 'en');
});
