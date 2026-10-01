'use strict';
// Общее для функций: ответы, разбор тела, обёртка инструмента агента.
//
// ИНСТРУМЕНТ ВСЕГДА ОТВЕЧАЕТ HTTP 200 (KONTRAKT.md): на 4xx/5xx агент ElevenLabs молчит,
// и звонящий слышит тишину. Ошибка — {ok:false, soobshchenie}: soobshchenie агент может сказать.

const linii = require('./linii');
const H = require('./hranilishche');   // через объект модуля: тесты подменяют хранилище
const { fraza } = require('./frazy');
const { yazykIli } = require('./vremya');

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
const XML_H = { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'no-store' };

const json = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });
const twiml = (vnutri = '') => ({ statusCode: 200, headers: XML_H,
  body: `<?xml version="1.0" encoding="UTF-8"?><Response>${vnutri}</Response>` });

function xml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function syroeTelo(event) {
  return event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
}
function teloJSON(event) {
  try {
    const d = JSON.parse(syroeTelo(event) || '{}');
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  } catch (_) { return {}; }
}
const forma = (event) => new URLSearchParams(syroeTelo(event));

// Системная переменная, которую платформа не подставила, приходит как «{{system__…}}» — это пусто.
function znachenie(v, dlina = 200) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim();
  if (/^\{\{.*\}\}$/.test(s)) return '';
  return s.slice(0, dlina);
}

// Письмо из простого текста: экранируем и переносим строки. Разметку от модели не принимаем никогда.
function htmlIzTeksta(t) {
  const telo = String(t || '').split('\n\n').map((abz) => `<p style="margin:0 0 14px">${xml(abz).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#f6f7f5;font:15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#161a17"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e1e6e0;border-radius:12px;padding:22px">${telo}</div></body></html>`;
}

function maska(tel) {
  const s = String(tel || '');
  return s.length > 4 ? '…' + s.slice(-4) : s;
}

// Обёртка инструмента: POST → ключ линии → клиент → хранилище клиента → obrabotchik.
// liniya — тип линии функции: при общем секрете двух линий клиента по нему выбирается линия.
function instrument(imya, obrabotchik, { liniya: predpochtenie = null } = {}) {
  return async (event) => {
    if (event.httpMethod && event.httpMethod !== 'POST') return json(405, { ok: false, soobshchenie: '' });
    const telo = teloJSON(event);
    const yazykZ = telo.yazyk ? yazykIli(telo.yazyk) : null;
    const opr = linii.opredelitLiniyu(event.headers || {}, telo, { predpochtenie });
    if (!opr.ok) {
      console.log(`[${imya}] отказ по ключу линии: ${opr.pochemu}`);
      return json(200, { ok: false, kod: 'net_dostupa', soobshchenie: fraza('net_dostupa', yazykZ || 'en') });
    }
    const yazyk = yazykZ || yazykIli(opr.liniya.yazyk);
    let st = null;
    try { st = H.hranilishcheKlienta(opr.klient.id); } catch (e) { st = null; }
    if (!st) {
      console.log(`[${imya}] хранилище клиента не поднялось`);
      return json(200, { ok: false, kod: 'hranilishche', soobshchenie: fraza('sboy', yazyk) });
    }
    try {
      const otvet = await obrabotchik({ event, telo, liniya: opr.liniya, klient: opr.klient, st, yazyk });
      return json(200, otvet);
    } catch (e) {
      console.log(`[${imya}] упало:`, e && e.message);
      return json(200, { ok: false, kod: 'sboy', soobshchenie: fraza('sboy', yazyk) });
    }
  };
}

module.exports = { JSON_H, XML_H, json, twiml, xml, syroeTelo, teloJSON, forma, znachenie, maska, htmlIzTeksta, instrument };
