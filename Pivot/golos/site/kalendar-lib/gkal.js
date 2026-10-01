// Общее для двух календарных инструментов Веры: токен Google, вызовы Calendar API,
// арифметика рабочих часов. Один файл, чтобы «посмотреть» и «записать» не разъехались.
//
// ПОЧЕМУ БЕЗ БИБЛИОТЕК GOOGLE. googleapis тянет десятки мегабайт в сборку функции.
// Нам нужен один JWT и два вызова — подписываем сами через встроенный crypto.
//
// ГДЕ ЛЕЖИТ КЛЮЧ И ПОЧЕМУ НЕ В ПЕРЕМЕННОЙ. Переменной он не влезает: **AWS даёт на ВСЕ
// переменные окружения функции 4 КБ разом**, у этого сайта занято 2,1 КБ, а файл служебного
// аккаунта — 2,3 КБ. Выкладка падает целиком: «Your environment variables exceed the 4KB limit
// imposed by AWS Lambda». Обрезка до трёх нужных полей даёт 1,9 КБ и влезает, но с запасом
// в сорок байт — то есть следующая же новая переменная снова уронила бы выкладку всего сайта.
// Поэтому ключ живёт в Netlify Blobs, в хранилище `kalendar-klyuch` под именем `sa`,
// и потолка там нет. Переменная GOOGLE_SA_JSON осталась запасным путём — ею пользуются
// проверки, чтобы не ходить в сеть.
// В папке проекта ключа нет и быть не может: папка синхронизируется в Google Drive.
const crypto = require('crypto');

const OBLAST = 'https://www.googleapis.com/auth/calendar';
const BAZA = 'https://www.googleapis.com/calendar/v3';

// --- токен ---
let kesh = { token: null, do: 0 };

let keshKlyucha = null;
let getStore = null;

// Функция передаёт сюда свой getStore из @netlify/blobs. См. пояснение ниже.
function podklyuchitBlobs(fn) { getStore = fn; }

async function klyuch() {
  if (keshKlyucha) return keshKlyucha;
  let syroy = process.env.GOOGLE_SA_JSON || '';
  if (!syroy) {
    // Blobs. getStore СЮДА ПЕРЕДАЁТ ФУНКЦИЯ — так же, как в dogon-lib, и не по прихоти:
    // эта папка лежит рядом с netlify-functions, а не внутри, и её node_modules не видит.
    // Прямой require('@netlify/blobs') отсюда роняет ВСЮ сборку сайта:
    // «Could not resolve "@netlify/blobs"». Проверено выкладкой 25.09.
    if (!getStore) throw new Error('хранилище не подключено: вызови podklyuchitBlobs(getStore)');
    let store = null;
    try { store = getStore({ name: 'kalendar-klyuch' }); }
    catch (_) {
      const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
      for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
        try { store = getStore({ name: 'kalendar-klyuch', siteID, token }); break; } catch (_) {}
      }
    }
    if (!store) throw new Error('хранилище ключа не поднялось');
    syroy = (await store.get('sa')) || '';
  }
  if (!syroy) throw new Error('ключа нет ни в переменной, ни в хранилище');
  const k = JSON.parse(syroy);
  if (!k.private_key || !k.client_email) throw new Error('в ключе нет private_key или client_email');
  keshKlyucha = k;
  return k;
}

const b64 = (s) => Buffer.from(s).toString('base64url');

async function token() {
  const teper = Date.now();
  if (kesh.token && teper < kesh.do - 60000) return kesh.token;
  const k = await klyuch();
  const sek = Math.floor(teper / 1000);
  const zag = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: k.private_key_id }));
  const telo = b64(JSON.stringify({ iss: k.client_email, scope: OBLAST,
                                    aud: 'https://oauth2.googleapis.com/token',
                                    iat: sek, exp: sek + 3600 }));
  const podpis = crypto.createSign('RSA-SHA256').update(zag + '.' + telo).sign(k.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                                assertion: `${zag}.${telo}.${podpis}` }).toString(),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error('токен не выдан: ' + JSON.stringify(d).slice(0, 200));
  kesh = { token: d.access_token, do: teper + (d.expires_in || 3600) * 1000 };
  return kesh.token;
}

async function gapi(put, telo, metod) {
  const r = await fetch(BAZA + put, {
    method: metod || (telo ? 'POST' : 'GET'),
    headers: { Authorization: 'Bearer ' + (await token()), 'content-type': 'application/json' },
    body: telo ? JSON.stringify(telo) : undefined,
  });
  const text = await r.text();
  let d = null;
  try { d = text ? JSON.parse(text) : {}; } catch (_) { d = { syroe: text.slice(0, 200) }; }
  return { kod: r.status, telo: d };
}

// --- настройки ---
// Все с запасом по умолчанию: функция должна работать, даже если переменную забыли.
const nastroyki = () => ({
  kalendar: process.env.KALENDAR_ID || '',
  // Чужие календари, которые надо ТОЛЬКО прочитать на занятость: основной календарь
  // клиента и всё, чем он с нами поделился с правом «только свободен/занят».
  // Писать туда мы не можем и не должны — пишем всегда только в kalendar.
  zanyatost: String(process.env.KALENDAR_ZANYATOST || '')
    .split(',').map(s => s.trim()).filter(Boolean),
  poyas: process.env.KALENDAR_POYAS || 'America/Los_Angeles',
  // Рабочие часы по времени ВЛАДЕЛЬЦА. «10-18» значит с 10:00 до 18:00.
  ot: +(process.env.KALENDAR_CHAS_OT || 10),
  do: +(process.env.KALENDAR_CHAS_DO || 18),
  // Дни недели: 1 — понедельник, 7 — воскресенье.
  dni: (process.env.KALENDAR_DNI || '1,2,3,4,5').split(',').map(Number),
  dlina: +(process.env.KALENDAR_DLINA_MIN || 30),      // длина встречи
  zapas: +(process.env.KALENDAR_ZAPAS_MIN || 15),      // запас до и после занятого
  ne_ranshe: +(process.env.KALENDAR_NE_RANSHE_CHASOV || 3),  // не предлагать «через полчаса»
  vpered: +(process.env.KALENDAR_VPERED_DNEY || 10),   // насколько вперёд смотрим
});

// --- время в чужом поясе, без библиотек ---
// Сколько минут пояс отстоит от UTC в этот момент. Через Intl, поэтому переход
// на летнее время считается сам, а не таблицей, которая устареет.
function smeshchenie(d, poyas) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: poyas, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  const kak = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return (kak - d.getTime()) / 60000;
}

// Момент UTC для «такого-то числа, такого-то часа по местному времени».
// Два прохода: первый по смещению сегодняшнего дня, второй — по смещению найденного момента.
// Это и есть обработка перехода на летнее время: без второго прохода час уезжает.
function mestnoeVUTC(god, mes, den, chas, minuta, poyas) {
  let t = Date.UTC(god, mes - 1, den, chas, minuta);
  for (let i = 0; i < 2; i++) {
    const sm = smeshchenie(new Date(t), poyas);
    const novoe = Date.UTC(god, mes - 1, den, chas, minuta) - sm * 60000;
    if (novoe === t) break;
    t = novoe;
  }
  return new Date(t);
}

// Какой это день и час по местному времени.
function mestnoe(d, poyas) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: poyas, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit' });
  const p = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  const nedelya = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { god: +p.year, mes: +p.month, den: +p.day, chas: (+p.hour) % 24,
           minuta: +p.minute, dn: nedelya[p.weekday] };
}

// --- свободные окна ---
// Занятость берём у Google (freebusy), сетку часов строим сами. Готовый календарь
// объявил бы свободными три часа ночи: там просто нет события.
async function svobodnye(dop) {
  const n = Object.assign(nastroyki(), dop || {});
  if (!n.kalendar) return { kod: 0, oshibka: 'нет KALENDAR_ID' };

  const teper = Date.now();
  const ot = new Date(teper + n.ne_ranshe * 3600e3);
  const do_ = new Date(teper + n.vpered * 864e5);

  // Спрашиваем занятость СРАЗУ по всем календарям: наш, куда пишем, и все чужие,
  // которыми клиент поделился на чтение занятости. Окно свободно, только если оно
  // свободно ВО ВСЕХ. Иначе Вера запишет человека поверх встречи владельца.
  // У freebusy потолок 50 календарей за запрос — нам столько и не нужно.
  const spisok = [n.kalendar, ...n.zanyatost.filter(x => x !== n.kalendar)];
  const { kod, telo } = await gapi('/freeBusy', {
    timeMin: ot.toISOString(), timeMax: do_.toISOString(),
    timeZone: n.poyas, items: spisok.map(id => ({ id })),
  });
  if (kod !== 200) return { kod, oshibka: (telo.error && telo.error.message) || 'Google не ответил' };

  // ОШИБКИ ПРИХОДЯТ ПО КАЖДОМУ КАЛЕНДАРЮ ОТДЕЛЬНО, и общий код при этом 200.
  // Без этой проверки «нет доступа» читалось бы как «свободен целиком» — и Вера
  // позвала бы человека на занятое время. Поэтому любая ошибка по любому календарю
  // из списка — отказ целиком: мы не знаем занятости, значит не предлагаем ничего.
  const zanyato = [];
  const bityye = [];
  for (const id of spisok) {
    const kal = (telo.calendars || {})[id] || {};
    if (!telo.calendars || !(id in telo.calendars)) { bityye.push(id + ': нет в ответе'); continue; }
    if (kal.errors && kal.errors.length) {
      bityye.push(id + ': ' + kal.errors.map(e => e.reason).join(', '));
      continue;
    }
    for (const b of kal.busy || []) {
      zanyato.push({ ot: new Date(b.start).getTime() - n.zapas * 60000,
                     do: new Date(b.end).getTime() + n.zapas * 60000 });
    }
  }
  if (bityye.length)
    return { kod: 403, nedostupno: bityye,
             oshibka: 'календарь не отдал занятость: ' + bityye.join(' · ') };

  const okna = [];
  // Идём по дням в поясе владельца, а не по UTC: иначе на границе суток день теряется.
  for (let sutki = 0; sutki <= n.vpered && okna.length < 12; sutki++) {
    const den = mestnoe(new Date(teper + sutki * 864e5), n.poyas);
    if (!n.dni.includes(den.dn)) continue;
    for (let chas = n.ot; chas + n.dlina / 60 <= n.do; chas += n.dlina / 60) {
      const nachalo = mestnoeVUTC(den.god, den.mes, den.den, Math.floor(chas),
                                  Math.round((chas % 1) * 60), n.poyas);
      const konec = new Date(nachalo.getTime() + n.dlina * 60000);
      if (nachalo < ot || konec > do_) continue;
      const peresek = zanyato.some(z => nachalo.getTime() < z.do && konec.getTime() > z.ot);
      if (!peresek) okna.push(nachalo.toISOString());
      if (okna.length >= 12) break;
    }
  }
  return { kod: 200, okna, poyas: n.poyas, kalendarey: spisok.length };
}

// «в четверг в три часа дня» на языке звонящего. Пояс — владельца: он и звонящий
// договариваются об одном времени, и называть его надо одним.
function slovami(iso, poyas, ru) {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: !ru, timeZone: poyas,
    }).format(d);
  } catch (_) {
    return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
}

module.exports = { token, gapi, nastroyki, svobodnye, slovami, smeshchenie, mestnoeVUTC,
                   mestnoe, podklyuchitBlobs };
