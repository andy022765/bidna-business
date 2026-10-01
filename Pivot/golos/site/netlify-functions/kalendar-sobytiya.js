// Читает ПУБЛИЧНЫЙ календарь Google и отдаёт странице список событий.
//
// ЗАЧЕМ ФУНКЦИЯ, А НЕ ЗАПРОС ИЗ БРАУЗЕРА. calendar.google.com не отдаёт заголовков CORS,
// и fetch со страницы к нему запрещён браузером. Плюс наше правило: «не вытаскивается
// через curl — значит этого на странице нет». Через эту функцию список ВЫТАСКИВАЕТСЯ.
//
// ПОЧЕМУ БЕЗ КЛЮЧЕЙ. API v3 без ключа отвечает 403 («unregistered callers») — проверено
// 24.09. А публичная выгрузка .ics отдаётся вообще без авторизации — проверено на том же
// прогоне. Значит Google Cloud, служебный аккаунт и хранение ключа не нужны совсем.
//
// ЧЕГО ЖДАТЬ ОТ СВЕЖЕСТИ. Google кэширует публичный .ics, и насколько — он не обещает.
// Поэтому эта функция НЕ единственный глаз демо: рядом на странице стоит встроенный
// календарь Google, он всегда живой. Здесь — текст, который можно проверить curl-ом.
// Отставание видно по полю `vzyato`: если оно моложе события, а события нет — это кэш.
//
// env: KALENDAR_ID — идентификатор публичного календаря (не секрет).
//      KALENDAR_POYAS — часовой пояс показа, по умолчанию America/New_York.

const DNEY_VPERED = 14;

// Разворачиваем перенос строк: в .ics длинная строка продолжается строкой,
// начинающейся с пробела или табуляции. Без этого длинные названия рвутся посередине.
function razvernut(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function raskodirovat(s) {
  return String(s || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// DTSTART:20260925T150000Z · DTSTART;TZID=America/New_York:20260925T150000 ·
// DTSTART;VALUE=DATE:20260925 (событие на весь день)
function razobratVremya(stroka) {
  const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(stroka);
  if (!m) return null;
  const parametry = m[2] || '', znachenie = m[3].trim();
  const tzid = (/TZID=([^;:]+)/.exec(parametry) || [])[1] || null;
  const ves_den = /VALUE=DATE(?![-A])/.test(parametry) || /^\d{8}$/.test(znachenie);
  return { syroe: znachenie, tzid, ves_den };
}

// Только чтобы отсортировать и отсечь окно. Часовой пояс НЕ пересчитываем: отдаём как есть
// плюс tzid, а как показать — решает страница. Своя арифметика поясов здесь была бы
// лишним местом, где можно тихо соврать на час.
function vSravnimoe(v) {
  if (!v) return 0;
  const s = v.syroe;
  const g = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const ch = +(s.slice(9, 11) || 0), mi = +(s.slice(11, 13) || 0);
  return Date.UTC(g, (m || 1) - 1, d || 1, ch, mi);
}

// Адрес встроенного вида Google. Страница берёт его отсюда, а не держит у себя:
// идентификатор календаря должен лежать в одном месте — в переменной окружения.
// Проверено 24.09: страница встроенного вида не ставит X-Frame-Options, рамку разрешает.
function vstroit(id, poyas) {
  const p = new URLSearchParams({
    src: id, ctz: poyas, mode: 'WEEK', bgcolor: '#0F1211',
    showTitle: '0', showPrint: '0', showTabs: '0', showCalendars: '0',
    showTz: '0', showNav: '1', showDate: '1',
  });
  return 'https://calendar.google.com/calendar/embed?' + p.toString();
}

exports.handler = async () => {
  const golova = { 'content-type': 'application/json; charset=utf-8',
                   'cache-control': 'no-store' };
  const id = process.env.KALENDAR_ID;
  if (!id) {
    return { statusCode: 503, headers: golova,
             body: JSON.stringify({ ok: false, why: 'net_kalendarya',
               text: 'Календарь ещё не подключён: нет KALENDAR_ID.' }) };
  }

  const url = 'https://calendar.google.com/calendar/ical/' +
              encodeURIComponent(id) + '/public/basic.ics';
  let syroe;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'BusinessIntelDNA-Kalendar/1.0' } });
    if (!r.ok) {
      // 404 здесь почти всегда значит одно: календарь не сделали общедоступным.
      return { statusCode: 502, headers: golova,
               body: JSON.stringify({ ok: false, why: 'google_otkazal', kod: r.status,
                 text: r.status === 404
                   ? 'Google не отдаёт этот календарь. Скорее всего не стоит галочка «Сделать общедоступным».'
                   : 'Google не отдал календарь.' }) };
    }
    syroe = await r.text();
  } catch (e) {
    return { statusCode: 502, headers: golova,
             body: JSON.stringify({ ok: false, why: 'ne_dostuchalis', text: e.message }) };
  }

  const text = razvernut(syroe);
  const sobytiya = [];
  for (const kusok of text.split('BEGIN:VEVENT').slice(1)) {
    const telo = kusok.split('END:VEVENT')[0];
    let nachalo = null, konec = null, nazvanie = '', opisanie = '', gosti = [], sozdano = null;
    for (const stroka of telo.split('\n')) {
      if (/^DTSTART/.test(stroka)) nachalo = razobratVremya(stroka);
      else if (/^DTEND/.test(stroka)) konec = razobratVremya(stroka);
      else if (/^SUMMARY/.test(stroka)) nazvanie = raskodirovat(stroka.split(':').slice(1).join(':'));
      else if (/^DESCRIPTION/.test(stroka)) opisanie = raskodirovat(stroka.split(':').slice(1).join(':'));
      else if (/^ATTENDEE/.test(stroka)) {
        const p = /mailto:([^;\s]+)/i.exec(stroka);
        if (p) gosti.push(p[1]);
      } else if (/^CREATED/.test(stroka)) sozdano = razobratVremya(stroka);
    }
    if (!nachalo) continue;
    sobytiya.push({ nazvanie, opisanie, gosti,
                    nachalo: nachalo.syroe, konec: konec ? konec.syroe : null,
                    poyas: nachalo.tzid, ves_den: nachalo.ves_den,
                    sozdano: sozdano ? sozdano.syroe : null,
                    _k: vSravnimoe(nachalo) });
  }

  const teper = Date.now();
  const okno = teper + DNEY_VPERED * 864e5;
  const vidno = sobytiya
    .filter(s => s._k >= teper - 864e5 && s._k <= okno)
    .sort((a, b) => a._k - b._k)
    .map(({ _k, ...ost }) => ost);

  return { statusCode: 200, headers: golova,
           body: JSON.stringify({ ok: true, vzyato: new Date().toISOString(),
                                  vstroennyy: vstroit(id, process.env.KALENDAR_POYAS || 'America/New_York'),
                                  vsego_v_kalendare: sobytiya.length,
                                  dney_vpered: DNEY_VPERED,
                                  sobytiy: vidno.length, sobytiya: vidno }) };
};
