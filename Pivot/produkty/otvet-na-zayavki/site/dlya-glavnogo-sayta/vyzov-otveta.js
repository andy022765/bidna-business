// ДЛЯ ОСНОВНОГО САЙТА (businessinteldna.com). НЕ ВЫКАЧЕНО. Скопировать в ПОДПАПКУ
// netlify-functions/otvet/vyzov.js основного сайта и позвать из hochet-zvonok.js (и/или submission-created.js).
//
// ПОЧЕМУ В ПОДПАПКУ, а не рядом с hochet-zvonok.js (ревью 29.09). Каждый .js на верхнем уровне
// netlify-functions/ Netlify выкладывает как отдельную функцию. У этого файла нет handler —
// получился бы публичный адрес /.netlify/functions/vyzov-otveta, отвечающий ошибкой. Основной сайт
// так уже делает с общим кодом: netlify-functions/referal/lib.js. Имя файла НЕ index.js и НЕ otvet.js:
// такие имена в подпапке Netlify тоже считает функцией.
//
// Что делает: передаёт заявку на сайт «ответ на заявки». Не ждёт ответа дольше 3 секунд и
// НИКОГДА не бросает: поломка автоответа не должна ломать основную форму и письмо владельцу.
// Фоновая функция на той стороне отвечает 202 сразу, работа идёт у неё.
//
// Переменные основного сайта (две, ~120 байт из 4 КБ):
//   OTVET_URL    — https://<сайт-ответа>.netlify.app/.netlify/functions/zayavka-background
//   OTVET_SECRET — тот же секрет, что на сайте ответа (не короче 16 знаков)
//
// Вставка в hochet-zvonok.js — после записи заявки и письма, перед return:
//
//   const { peredatZayavku } = require('./otvet/vyzov.js');
//   await peredatZayavku({ forma: 'hochet-zvonok', stranica: otkuda, pochta, imya });
//
// Вставка в submission-created.js — в нужной ветке (например, для будущей формы с вопросом):
//
//   await peredatZayavku({ id: payload.id, forma: formName, stranica: data.stranica || '',
//                          pochta: em, imya: data.client_name, soobshchenie: data.vopros });
//
// На какие формы отвечать, решает карточка на той стороне (kartochka/bid.json → formy).
// Лишнюю форму можно передавать спокойно: ей просто не ответят.

async function peredatZayavku(z) {
  const url = process.env.OTVET_URL, secret = process.env.OTVET_SECRET;
  if (!url || !secret) { console.log('[otvet] OTVET_URL/OTVET_SECRET не заданы, автоответ выключен'); return { ok: false, pochemu: 'vyklyucheno' }; }
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-otvet-secret': secret },
      // ASCII-тело: кириллица в имени иначе роняет fetch в функции (грабля submission-created.js).
      body: JSON.stringify(z).replace(/[\u007f-￿]/g, (c) => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4)),
      signal: ctrl.signal,
    });
    console.log('[otvet] передано, код', r.status);
    return { ok: r.status === 202 || r.ok, kod: r.status };
  } catch (e) {
    console.log('[otvet] не передано:', e && (e.name === 'AbortError' ? 'таймаут 3 с' : e.message));
    return { ok: false, pochemu: 'set' };
  } finally { clearTimeout(tm); }
}

module.exports = { peredatZayavku };
