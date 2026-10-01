// Общий запуск для всех функций: подключить Blobs к хранилищу и к ключу календаря (gkal.js Веры
// берёт getStore снаружи — прямой require('@netlify/blobs') из соседней папки роняет сборку).
// Плюс проверка ключа администратора для служебных вызовов (zapusk, zdorovie, chernovik-background).

const crypto = require('crypto');
const H = require('./hranilishche');
const G = require('./gkal');

function podklyuchit(blobs) { H.podklyuchit(blobs); G.podklyuchitBlobs(blobs.getStore); }

// OTZYVY_KLYUCH_ADMINA (от 24 знаков) в заголовке x-otzyvy-admin. Короткий или пустой — всё закрыто.
function admin(event) {
  const nado = process.env.OTZYVY_KLYUCH_ADMINA || '';
  if (nado.length < 24) return false;
  const h = (event && event.headers) || {};
  const a = Buffer.from(String(h['x-otzyvy-admin'] || h['X-Otzyvy-Admin'] || '')), b = Buffer.from(nado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const json = (kod, obj) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(obj, null, 2) });

module.exports = { podklyuchit, admin, json };
