// Что уходит в выкладку: только живой путь (ответ с ценами и ссылкой на Calendly). Отложенная
// своя запись (na-potom/) не должна попасть в сборку ни функцией, ни через require.
const F = require('./_feyki');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('в netlify-functions/ только две живые функции; zapis.js — в na-potom/, не удалён', () => {
  const fayly = fs.readdirSync(path.join(F.SITE, 'netlify-functions')).sort();
  assert.deepEqual(fayly, ['zayavka-background.js', 'zdorovie.js']);
  assert.ok(fs.existsSync(path.join(F.SITE, 'na-potom/netlify-functions/zapis.js')), 'функция записи отложена, а не потеряна');
  for (const f of ['gkal.js', 'tekst-okna.js', 'tekst-zapis.js', 'stranica.js'])
    assert.ok(fs.existsSync(path.join(F.SITE, 'na-potom/lib', f)), 'нет na-potom/lib/' + f);
});

test('netlify.toml: публикуется web/, функции из netlify-functions/, правила /zapis нет', () => {
  const t = fs.readFileSync(path.join(F.SITE, 'netlify.toml'), 'utf8').replace(/#.*$/gm, '');
  assert.match(t, /publish\s*=\s*"web"/);
  assert.match(t, /directory\s*=\s*"netlify-functions"/);
  assert.ok(!/zapis|na-potom/.test(t), 'в действующих строках netlify.toml осталась запись');
  assert.ok(!fs.readdirSync(path.join(F.SITE, 'web')).some(f => /zapis/i.test(f)));
});

test('живые функции не тянут ни na-potom/, ни календарь: сборка esbuild возьмёт только живой путь', () => {
  require(path.join(F.SITE, 'netlify-functions/zayavka-background.js'));
  require(path.join(F.SITE, 'netlify-functions/zdorovie.js'));
  const zagruzheno = Object.keys(require.cache).filter(f => f.startsWith(F.SITE + path.sep));
  assert.ok(zagruzheno.length >= 6, 'живые модули загружены');
  const lishnee = zagruzheno.filter(f => f.includes(path.sep + 'na-potom' + path.sep) || /gkal\.js$|tekst-(okna|zapis)\.js$|stranica\.js$/.test(f));
  assert.deepEqual(lishnee, []);
});
