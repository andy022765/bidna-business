// Страницы: отписка (посетителю), форма визитов, вставка отзыва и решение по отзыву (владельцу).
// Никаких внешних файлов и шрифтов: открывается в почтовом браузере телефона на плохой связи.
// Всё, что пришло извне, экранируется. Скрипт — только встроенный, с одноразовым nonce.
// GET ничего не меняет: по ссылкам из писем ходят почтовые сканеры. Действие — только кнопкой (POST).

const crypto = require('crypto');
const { ekranHtml: E } = require('./pisma');

function zagolovki(nonce) {
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow',
    // no-referrer обязателен: токен живёт в адресе страницы и не должен уехать дальше.
    'referrer-policy': 'no-referrer',
    'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
  };
}

const STIL = 'body{font:16px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a2e;max-width:560px;margin:32px auto;padding:0 16px}'
  + 'h1{font-size:22px;margin:0 0 14px}button,.kn{display:inline-block;font:inherit;padding:12px 20px;border-radius:10px;border:0;background:#1a1a2e;color:#fff;cursor:pointer;text-decoration:none;margin:4px 6px 4px 0}'
  + '.vt{background:#eef0f4;color:#1a1a2e}.akt{outline:3px solid #1a73e8}textarea,input,select{font:inherit;width:100%;box-sizing:border-box;padding:10px;border:1px solid #c9ccd3;border-radius:8px;margin:4px 0 12px}'
  + 'label{font-size:14px;color:#5f6472}.tih{color:#5f6472;font-size:14px}blockquote{margin:0 0 14px;padding:10px 14px;background:#f5f7fa;border-left:3px solid #1a73e8}';

// telo — уже готовый HTML (всё внешнее в нём экранировано вызывающим). skript — текст скрипта или ''.
function stranica(kod, zag, telo, o = {}) {
  const nonce = crypto.randomBytes(12).toString('base64');
  const html = `<!doctype html><html lang="${o.yazyk === 'en' ? 'en' : 'ru'}"><head><meta charset="utf-8">`
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">'
    + `<title>${E(zag)}</title><style>${STIL}</style></head><body><h1>${E(zag)}</h1>${telo}`
    + (o.skript ? `<script nonce="${nonce}">${o.skript}</script>` : '') + '</body></html>';
  return { statusCode: kod, headers: zagolovki(nonce), body: html };
}

// Тело POST: форма (urlencoded) или пусто. Netlify может прислать его в base64.
function teloFormy(event) {
  let b = event.body || '';
  if (event.isBase64Encoded) b = Buffer.from(b, 'base64').toString('utf8');
  return Object.fromEntries(new URLSearchParams(b));
}

module.exports = { stranica, teloFormy, E };
