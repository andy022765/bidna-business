// Карточка (паспорт) клиента: цены, ссылка на запись, тексты писем. Всё, что говорит бот
// о бизнесе, берётся отсюда — модель в v1 не участвует, поэтому неверной цены взяться неоткуда.
//
// Запись на звонок — по ссылке на систему записи клиента (ssylka_zapisi, у нас Calendly;
// решение Андрея 29.09). Календарь, часы и свои окна живому пути не нужны: они в
// na-potom/kartochka/*-zapis.json и na-potom/lib/kartochka-zapis.js, в выкладку не входят.
//
// Карточки подключаются статическим require: esbuild кладёт JSON в сборку функции,
// отдельно раскладывать файлы при выкладке не нужно. Новый клиент — новая строка в KARTOCHKI.

const crypto = require('crypto');

const KARTOCHKI = {
  bid: require('../kartochka/bid.json'),
};

const hesh = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 12);

function vzyat(klient) {
  const id = klient || process.env.OTVET_KLIENT || 'bid';
  const k = KARTOCHKI[id];
  if (!k) throw new Error('нет карточки клиента: ' + id);
  if (!k.__hesh) Object.defineProperty(k, '__hesh', { value: hesh(k), enumerable: false });
  return k;
}

// Путь страницы без домена, параметров и якоря, в нижнем регистре.
function put(stranica) {
  let s = String(stranica || '').trim();
  try { if (/^https?:\/\//i.test(s)) s = new URL(s).pathname; } catch (_) {}
  s = s.split('?')[0].split('#')[0].toLowerCase();
  if (s && s[0] !== '/') s = '/' + s;
  return s;
}

const nachinaetsya = (p, nachalo) => p === nachalo || p.startsWith(nachalo + '/') || p.startsWith(nachalo + '.');

// Какой продукт. null — форму не знаем, и отвечать на неё не будем.
function produktDlya(k, forma, stranica) {
  const f = String(forma || '').trim();
  const pravilo = Object.prototype.hasOwnProperty.call(k.formy, f) && !f.startsWith('_') ? k.formy[f] : null;
  if (!pravilo) return null;
  if (pravilo !== 'po_stranice') return k.produkty[pravilo] ? pravilo : null;
  const p = put(stranica);
  for (const s of k.stranicy) if (nachinaetsya(p, s.nachalo)) return s.produkt;
  return 'obshchiy';
}

// Язык письма. Явно переданный побеждает; дальше суффикс формы -ru или /ru в пути;
// дальше английские страницы продуктов (у них русская версия живёт в /ru/); иначе — по умолчанию.
function yazykDlya(k, forma, stranica, yavno) {
  const y = String(yavno || '').toLowerCase();
  if (y === 'ru' || y === 'en') return y;
  const p = put(stranica);
  if (/-ru$/.test(String(forma || '')) || /\/ru(\/|$|\.)/.test(p)) return 'ru';
  for (const a of k.anglijskie_stranicy || []) if (nachinaetsya(p, a)) return 'en';
  return k.yazyk_po_umolchaniyu === 'en' ? 'en' : 'ru';
}

// Проверка паспорта на целостность — её гоняют тесты и функция zdorovie. Только то, что нужно
// живому пути: календарь здесь НЕ требуется (его проверяет na-potom/lib/kartochka-zapis.js).
const TEKSTY = ['tema_otveta', 'vstuplenie', 'est_vopros', 'podrobnee', 'zapis', 'knopka_zapisi', 'raskrytie'];
function proverit(k) {
  const beda = [];
  const nado = (usl, chto) => { if (!usl) beda.push(chto); };
  nado(k.klient, 'нет klient');
  nado(k.pochta && /<[^@\s]+@[^@\s]+>$/.test(k.pochta.ot || ''), 'pochta.ot не вида «Имя <адрес>»');
  nado(k.pochta && Array.isArray(k.pochta.vladelcu) && k.pochta.vladelcu.length, 'нет pochta.vladelcu');
  // Ссылка на запись — главная кнопка письма. Только https и без пробелов/кавычек: она уходит
  // в href письма с нашего домена.
  nado(/^https:\/\/[^\s"'<>]+$/.test(k.ssylka_zapisi || ''), 'ssylka_zapisi: нет https-ссылки на запись');
  for (const y of ['ru', 'en']) nado((k.biznes || {})['podpis_' + y], 'biznes.podpis_' + y);
  for (const [f, p] of Object.entries(k.formy || {})) {
    if (f.startsWith('_')) continue;
    nado(p === 'po_stranice' || (k.produkty || {})[p], `форма ${f} ведёт на неизвестный продукт ${p}`);
  }
  for (const s of k.stranicy || []) nado((k.produkty || {})[s.produkt], `страница ${s.nachalo} → неизвестный продукт`);
  nado((k.produkty || {}).obshchiy, 'нет продукта obshchiy (для страниц без своего продукта)');
  for (const [id, p] of Object.entries(k.produkty || {})) {
    for (const y of ['ru', 'en']) {
      nado(p['zagolovok_' + y], `${id}: нет zagolovok_${y}`);
      nado(Array.isArray(p['ceny_' + y]) && p['ceny_' + y].length, `${id}: нет ceny_${y}`);
      nado(/^https:\/\//.test(p['stranica_' + y] || ''), `${id}: stranica_${y} не https`);
    }
  }
  for (const t of TEKSTY) for (const y of ['ru', 'en']) nado((k.teksty || {})[t + '_' + y], `нет teksty.${t}_${y}`);
  return beda;
}

module.exports = { vzyat, produktDlya, yazykDlya, proverit, put, KARTOCHKI, TEKSTY };
