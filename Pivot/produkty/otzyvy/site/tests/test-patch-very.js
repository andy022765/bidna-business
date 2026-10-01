// Патч для Веры (dlya-very/): ложится на её текущий код, её проверки не ломает, новая проверка метки
// проходит с патчем и падает без него. Живые файлы Веры не трогаются — всё во временной копии вне Drive.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SKRIPT = path.join(__dirname, '..', 'dlya-very', 'proverit-patch.sh');
const VERA = path.join(__dirname, '..', '..', '..', '..', 'golos', 'site', 'netlify-functions', 'kalendar-zapis.js');

test('патч для Веры цел: ложится, её проверки не ломает, новая проверка метки его ловит', { timeout: 180000 }, (t) => {
  if (!fs.existsSync(VERA)) return t.skip('нет кода Веры рядом');
  const vyvod = execFileSync('bash', [SKRIPT], { encoding: 'utf8', env: Object.assign({}, process.env, { NODE_PATH: '' }) });
  assert.match(vyvod, /коды выхода до и после патча совпадают/);
  assert.match(vyvod, /новая проверка метки: (\d+) из \1/);
  assert.match(vyvod, /ГОТОВО: патч цел/);
});
