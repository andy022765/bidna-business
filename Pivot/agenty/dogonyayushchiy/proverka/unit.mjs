// Модульные тесты ядра Доводчика без сети: kod.js (код из письма) и validator.js (сервер держит правила).
//
//   node unit.mjs
//
// Контракт, по которому написаны тесты (SPEC §1.2, §4; скептик №2, №3, №8):
//   kod.js       ALFAVIT · sgenerirovat() → 'K7M3X' · normalizovat(str) → латиница верхним регистром без пробелов
//                najtiKod(tekst) → { kody: [...], sKlyuchom } (строка или null тоже принимаются)
//                najtiMetku(tekst) → 'S-OPL' | 'S-STAT' | null · zhivoy(zapis, seychas) → bool
//   validator.js proverit(otvet, { chislaIzKonteksta, tekstyKlienta, kartochka: { email, imya }, andreyPishet })
//                → { ok, prichiny } (bool, массив причин и строка тоже принимаются)
// Нет модуля или функции — тест падает понятной строкой, а не исключением прогона.

import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../golos/site/dogon-lib');

const itogi = [];
function test(gruppa, imya, fn) { itogi.push({ gruppa, imya, fn }); }

function zagruzit(fayl) {
  try { return { mod: require(join(LIB, fayl)) }; }
  catch (e) {
    const net = e.code === 'MODULE_NOT_FOUND' && String(e.message).includes(fayl);
    return { oshibka: net ? `модуля dogon-lib/${fayl} ещё нет` : `dogon-lib/${fayl} не загружается: ${String(e.message).split('\n')[0]}` };
  }
}

function funkciya(z, imena, fayl) {
  if (z.oshibka) throw new Error(z.oshibka);
  for (const n of imena) if (typeof z.mod[n] === 'function') return z.mod[n];
  throw new Error(`в ${fayl} нет функции ${imena.join(' / ')}`);
}

const ravno = (fakt, ozh, chto) => {
  if (fakt !== ozh) throw new Error(`${chto}: ждали ${JSON.stringify(ozh)}, есть ${JSON.stringify(fakt)}`);
};

// ======================================================================= kod.js
const KOD = zagruzit('kod.js');
const ALFAVIT = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const pervyyKod = (r) => {
  if (r == null) return null;
  if (typeof r === 'string') return r || null;
  if (Array.isArray(r)) return r[0] ?? null;
  if (Array.isArray(r.kody)) return r.kody[0] ?? null;
  if ('kod' in r) return r.kod ?? null;
  throw new Error(`не понимаю ответ najtiKod: ${JSON.stringify(r)}`);
};

test('kod', 'ALFAVIT — 31 знак без 0/O/1/I/L', () => {
  if (KOD.oshibka) throw new Error(KOD.oshibka);
  if (KOD.mod.ALFAVIT !== undefined) ravno(KOD.mod.ALFAVIT, ALFAVIT, 'ALFAVIT');
});

test('kod', 'генерация: 5 знаков, только алфавит, 2000 кодов почти без повторов', async () => {
  const gen = funkciya(KOD, ['sgenerirovat', 'novyyKod', 'generirovat'], 'kod.js');
  const vse = new Set();
  for (let i = 0; i < 2000; i++) {
    let k = await gen();
    if (k && typeof k === 'object') k = k.kod;
    if (typeof k !== 'string' || k.length !== 5) throw new Error(`код не из 5 знаков: ${JSON.stringify(k)}`);
    for (const ch of k) if (!ALFAVIT.includes(ch)) throw new Error(`знак «${ch}» не из алфавита в коде ${k}`);
    vse.add(k);
  }
  // 31^5 ≈ 28,6 млн: на 2000 кодах ожидаемое число совпадений ~0,07
  if (vse.size < 1995) throw new Error(`слишком много повторов: ${2000 - vse.size} на 2000`);
});

test('kod', 'генерация: все 31 знак встречаются (нет перекоса)', async () => {
  const gen = funkciya(KOD, ['sgenerirovat', 'novyyKod', 'generirovat'], 'kod.js');
  const vstrechalis = new Set();
  for (let i = 0; i < 2000; i++) for (const ch of String(await gen())) vstrechalis.add(ch);
  const net = [...ALFAVIT].filter((ch) => !vstrechalis.has(ch));
  if (net.length) throw new Error(`за 10 000 знаков не встретились: ${net.join('')}`);
});

const NORM = [
  ['K7M3X', 'K7M3X', 'латиница как есть'],
  ['k7m3x', 'K7M3X', 'строчные латиницей'],
  ['к7м3х', 'K7M3X', 'кириллица строчными'],
  ['К7М3Х', 'K7M3X', 'кириллица заглавными'],
  [' К7М 3Х ', 'K7M3X', 'кириллица с пробелами внутри и по краям'],
  ['K7м3X', 'K7M3X', 'смешанная раскладка'],
  ['ВЕКМН', 'BEKMH', 'двойники В Е К М Н'],
  ['РСТУХ', 'PCTYX', 'двойники Р С Т У Х'],
  ['авекм', 'ABEKM', 'двойники строчными а в е к м'],
];
for (const [vhod, ozh, chto] of NORM) {
  test('kod', `нормализация: ${chto} («${vhod}» → ${ozh})`, () => {
    const norm = funkciya(KOD, ['normalizovat', 'normalize'], 'kod.js');
    ravno(norm(vhod), ozh, `normalizovat(${JSON.stringify(vhod)})`);
  });
}

const DLINNYY_BEZ_KODA = 'Здравствуйте! Хочу рассказать про наш салон подробнее. '.repeat(5) + 'K7M3X где-то в середине длинного текста без того самого слова.';
const POISK = [
  ['Здравствуйте! Пишу после разговора с Верой. Код K7M3X', 'K7M3X', 'готовый текст после Веры'],
  ['Здравствуйте! Пишу после письма Business Intelligence DNA. Код K7M3X', 'K7M3X', 'готовый текст после формы'],
  ['здравствуйте, код:  к7м3х ', 'K7M3X', 'кириллица строчными после «код:»'],
  ['мой код k7m3x, спасибо', 'K7M3X', 'строчные латиницей внутри фразы'],
  ['Code #K7M3X', 'K7M3X', 'по-английски с #'],
  ['Код№К7М3Х', 'K7M3X', 'слитно с №, кириллица'],
  ['код: к7м 3х', 'K7M3X', 'пробел внутри кода'],
  ['K7M3X', 'K7M3X', 'один код без слова «код» в коротком сообщении'],
  ['Здравствуйте, сколько стоит Дежурный?', null, 'обычный вопрос без кода'],
  ['Код K7M3O', null, 'буква O не из алфавита — не наш код'],
  ['Код K1M3X', null, 'цифра 1 не из алфавита — не наш код'],
  [DLINNYY_BEZ_KODA, null, 'длинное сообщение (≥ 200 знаков) без слова «код» — слово из 5 знаков не берём'],
];
for (const [vhod, ozh, chto] of POISK) {
  test('kod', `поиск в тексте: ${chto}`, () => {
    const nayti = funkciya(KOD, ['najtiKod', 'naytiKod', 'nayti'], 'kod.js');
    ravno(pervyyKod(nayti(vhod)), ozh, `najtiKod(${JSON.stringify(vhod.slice(0, 50))})`);
  });
}

test('kod', 'поиск в тексте: sKlyuchom отмечает, что слово «код» было', () => {
  const nayti = funkciya(KOD, ['najtiKod', 'naytiKod', 'nayti'], 'kod.js');
  const r = nayti('Пишу после разговора с Верой. Код K7M3X');
  if (r && typeof r === 'object' && 'sKlyuchom' in r) ravno(r.sKlyuchom, true, 'sKlyuchom');
});

const METKI = [
  ['Здравствуйте! Вопрос до оплаты. Код S-OPL', 'S-OPL', 'метка страницы оплаты'],
  ['Пришлю анкету. Код S-ANK', 'S-ANK', 'метка страницы анкеты'],
  ['Здравствуйте. Прочитал статью про пять AI-инструментов. Хочу разобрать своё дело и получить пошаговую стратегию внедрения.', 'S-STAT', 'готовый текст статьи без метки'],
  ['Здравствуйте! Пишу после разговора с Верой. Код K7M3X', null, 'обычный код — не метка'],
];
for (const [vhod, ozh, chto] of METKI) {
  test('kod', `метка сайта (скептик №2): ${chto}`, () => {
    const metka = funkciya(KOD, ['najtiMetku', 'naytiMetku'], 'kod.js');
    ravno(metka(vhod), ozh, `najtiMetku(${JSON.stringify(vhod.slice(0, 40))})`);
  });
}

const SEYCHAS = Date.parse('2026-09-15T18:20:00Z');
const DEN = 864e5;
const ZHIVOY = [
  [{ kod: 'K7M3X', t: SEYCHAS - 29 * DEN }, true, 'код 29 дней — живой'],
  [{ kod: 'K7M3X', t: SEYCHAS - 31 * DEN }, false, 'код 31 день — истёк'],
  [{ kod: 'K7M3X', t: SEYCHAS - 25 * 3600e3, suhoy: true }, false, 'холостой код старше суток — истёк'],
  [{ kod: 'K7M3X', t: SEYCHAS - 2 * 3600e3, suhoy: true }, true, 'холостой код 2 часа — живой'],
  [null, false, 'записи нет — не живой (скептик №11)'],
];
for (const [zapis, ozh, chto] of ZHIVOY) {
  test('kod', `срок кода: ${chto}`, () => {
    const zhivoy = funkciya(KOD, ['zhivoy'], 'kod.js');
    ravno(!!zhivoy(zapis, SEYCHAS), ozh, 'zhivoy');
  });
}

// ======================================================================= validator.js
const VAL = zagruzit('validator.js');

function rezultat(r) {
  if (typeof r === 'boolean') return { ok: r, prichiny: [] };
  if (r == null || r === '') return { ok: true, prichiny: [] };
  if (typeof r === 'string') return { ok: false, prichiny: [r] };
  if (Array.isArray(r)) return { ok: r.length === 0, prichiny: r };
  if (typeof r === 'object') {
    const prichiny = r.prichiny || r.oshibki || r.zamechaniya || [];
    if ('ok' in r) return { ok: !!r.ok, prichiny };
    if (Array.isArray(prichiny)) return { ok: prichiny.length === 0, prichiny };
  }
  throw new Error(`не понимаю ответ валидатора: ${JSON.stringify(r)}`);
}

const KARTOCHKA = { email: 'irina@salon-test.com', imya: 'Ирина Соколова' };
const otvet = (tekst, dop = {}) => ({ tekst, ssylka: 'net', segment: 'biznes', tema: 'drugoe', signal: 'net',
  dlya_vladelcev: '', ne_otvetila: '', ...dop });

// [текст, тема, хороший?, что проверяем, доп. контекст]
const DLINNYY = 'Глубокая диагностика показывает, что мешает делу сейчас. '.repeat(18);
const OTVETY = [
  // ---- хорошие
  ['Это не аудит, а глубокая диагностика.', 'diagnostika', true, 'отрицание перед «аудит» (скептик №8)'],
  ['В абонентку связки входят 1500 минут и 2 часа наших правок.', 'svyazka', true, '«2 часа наших правок» (скептик №8)'],
  ['В месяц входит 1000 минут разговоров и 1 час наших правок.', 'dezhurny', true, '«1 час правок» (скептик №8)'],
  ['Цена глубокой диагностики — $500. Засчитывается во внедрение.', 'diagnostika', true, 'цена диагностики'],
  ['Запуск Дежурного — $1000, дальше $199 в месяц.', 'dezhurny', true, 'цена Дежурного'],
  ['Дежурный с продавцом — $2500 за запуск и $399 в месяц.', 'svyazka', true, 'цена связки'],
  ['Можно по шагам: сначала Дежурный за $1000, потом продавец ещё за $1500.', 'svyazka', true, 'связка лестницей'],
  ['Внедрение — от $5000, точная сумма в смете.', 'vnedrenie', true, 'внедрение от $5000'],
  ['Внедрение — от $5 000, точная сумма в смете.', 'vnedrenie', true, 'сумма с пробелом разрядов'],
  ['Сверх минут — $0.25 за минуту.', 'dezhurny', true, '25 центов дробью'],
  ['Ставка нашего часа — $50.', 'drugoe', true, 'ставка часа'],
  ['Анкета — 67 вопросов, на неё уходит час-полтора.', 'anketa', true, 'анкета 67 вопросов'],
  ['Срок — до 10 рабочих дней после согласования сметы.', 'vnedrenie', true, 'срок до 10 рабочих дней'],
  ['Первым 10 диагностика бесплатно, свободных мест сейчас 7.', 'diagnostika', true, 'число мест из КОНТЕКСТА', { chislaIzKonteksta: [7] }],
  ['Для салона на 17 мастеров это как раз работа Дежурного.', 'dezhurny', true, 'число из сообщения самого человека', { tekstyKlienta: ['У нас 17 мастеров, звонки теряем вечером'] }],
  ['Направлений пять: рынок, аудитория, позиционирование, цена и точки роста.', 'diagnostika', true, '«аудитория» — не «аудит»'],
  ['Скидок у нас нет.', 'drugoe', true, '«Скидок у нас нет» — единственная разрешённая скидка'],
  ['Цифру назвать не могу, врать не буду.', 'drugoe', true, 'анти-гарантия без цифр'],
  ['Сама через месяц не напишу. Напишите сюда, когда будет время, — переписка сохранится.', 'drugoe', true, 'шаблон про напоминания из промпта'],
  ['Звонить я не могу. Андрей и Маша видят этот чат.', 'drugoe', true, 'просьба позвонить без обещания'],
  ['Запуск Андрей обсуждает сам. Передаю ему, он видит этот чат.', 'dezhurny', true, 'передача Андрею'],
  ['Цену видимости здесь не назову. Пришлю разбор — там видно, нужна ли она вам первой.', 'vidimost', true, 'видимость без суммы'],
  ['Есть ли смысл автоматизировать, покажет разбор.', 'avtomatizaciya', true, 'автоматизация без суммы'],
  ['The deep diagnostic is $500 and counts toward implementation.', 'diagnostika', true, 'по-английски с разрешённой ценой'],
  // ---- плохие
  ['Видимость — $1500 за квартал.', 'vidimost', false, 'цена видимости при tema vidimost (скептик №8)'],
  ['Видимость обойдётся в $500 в месяц.', 'vidimost', false, 'любая сумма при tema vidimost'],
  ['Автоматизацию поставим примерно за $1000.', 'avtomatizaciya', false, 'сумма при tema avtomatizaciya'],
  ['Автоматизация — это $2500 за запуск.', 'drugoe', false, 'цена автоматизации при чужой теме'],
  ['После запуска заявок станет на 30% больше.', 'dezhurny', false, 'проценты'],
  ['Продажи вырастут в 2 раза.', 'dezhurny', false, '«в N раз»'],
  ['Заявок будет в 3 раза больше.', 'dezhurny', false, '«в N раз» с числом из белого списка'],
  ['Гарантируем, что клиентов станет больше.', 'drugoe', false, '«гарантируем»'],
  ['Мы гарантируем результат за месяц.', 'drugoe', false, 'гарантия срока'],
  ['Проведём аудит вашего бизнеса.', 'diagnostika', false, '«аудит» без отрицания'],
  ['Это аудит, только глубже.', 'diagnostika', false, '«аудит» без отрицания, короткий'],
  ['Андрей вам перезвонит сегодня.', 'drugoe', false, '«перезвон»'],
  ['Соединяю с Андреем.', 'drugoe', false, '«соединяю»'],
  ['Сейчас подключу оператора.', 'drugoe', false, '«оператор»'],
  ['Могу сделать скидку для вас.', 'drugoe', false, 'скидка'],
  ['Дам скидку 10%, если оплатите сегодня.', 'drugoe', false, 'скидка с процентом'],
  ['Напомню вам через неделю.', 'drugoe', false, '«напомню»'],
  ['Напишу через пару дней, как освободятся места.', 'drugoe', false, '«напишу через»'],
  ['Андрей напишет вам здесь же.', 'dezhurny', false, '«Андрей напишет» при DOGON_ANDREY_PISHET=0', { andreyPishet: false }],
  ['Цена глубокой диагностики — $700.', 'diagnostika', false, 'число не из цен'],
  ['Внедрение займёт 45 рабочих дней.', 'vnedrenie', false, 'срок не из цен'],
  ['Посмотрите здесь: https://businessinteldna.com/business/', 'razbor', false, 'URL со схемой'],
  ['Вот страница: businessinteldna.com/expert/oplata', 'diagnostika', false, 'адрес без схемы'],
  ['Пишите в t.me/business_int_dna', 'drugoe', false, 'ссылка t.me'],
  ['**Глубокая диагностика** — лучший первый шаг.', 'diagnostika', false, 'markdown жирный'],
  ['- Дежурный\n- Продавец', 'dezhurny', false, 'markdown список'],
  ['# Цены\nДежурный — $1000.', 'dezhurny', false, 'markdown заголовок'],
  ['Глубокая диагностика — хороший первый шаг 🙂', 'diagnostika', false, 'эмодзи'],
  [DLINNYY, 'diagnostika', false, `длиннее 900 знаков (${DLINNYY.length})`],
  ['Письмо ушло на irina@salon-test.com, проверьте.', 'drugoe', false, 'почта из карточки (скептик №3)'],
  ['Напишите нам на support@businessinteldna.com.', 'drugoe', false, '«@» в тексте (скептик №3)'],
  ['Ирина Соколова, по телефону вы спрашивали про Дежурного.', 'dezhurny', false, 'имя из карточки звонка (скептик №3)'],
  ['Ваш номер +1 561 555 0100 записан.', 'drugoe', false, 'телефон — чужие числа'],
  ['', 'drugoe', false, 'пустой ответ'],
];

for (const [tekst, tema, khoroshiy, chto, dop] of OTVETY) {
  test('validator', `${khoroshiy ? 'хороший' : 'плохой '}: ${chto}`, () => {
    const proverit = funkciya(VAL, ['proverit', 'validirovat', 'validate'], 'validator.js');
    const kontekst = { chislaIzKonteksta: [], tekstyKlienta: [], kartochka: KARTOCHKA, andreyPishet: false, ...(dop || {}) };
    const r = rezultat(proverit(otvet(tekst, { tema }), kontekst));
    if (khoroshiy && !r.ok) throw new Error(`отбит хороший ответ «${tekst.slice(0, 70)}»: ${[].concat(r.prichiny).join('; ')}`);
    if (!khoroshiy && r.ok) throw new Error(`пропущен плохой ответ «${tekst.slice(0, 70)}»`);
  });
}

// ======================================================================= shablony.js: согласие текстом
// Ревью 15.09 №3 и №8: сначала отказ, согласие — только целым коротким ответом.
const SH = zagruzit('shablony.js');
const SOGLASIE = [
  ['да', 'da'], ['Да!', 'da'], ['ок', 'da'], ['Okay', 'da'], ['да, давайте', 'da'], ['Продолжить', 'da'], ['yes', 'da'],
  ['Дайте Андрея', 'chelovek'], ['Да нет, подожду Андрея', 'chelovek'], ['Да нет, спасибо, подожду Андрея', 'chelovek'],
  ['Окей, жду Машу', 'chelovek'], ['Okay, wait for a human', 'chelovek'], ['Okay, but I prefer a human', 'chelovek'],
  ['Жду человека', 'chelovek'], ['нет', 'chelovek'], ['No', 'chelovek'], ['Согласен ли Андрей созвониться?', 'chelovek'],
  ['Даже не знаю', null], ['Давно хотел спросить', null], ['Около пяти сотрудников', null], ['Дайте цену', null],
  ['Сколько стоит Дежурный?', null], ['', null],
];
for (const [vhod, ozh] of SOGLASIE) {
  test('soglasie', `«${vhod}» → ${ozh}`, () => {
    const f = funkciya(SH, ['razobratSoglasie'], 'shablony.js');
    ravno(f(vhod), ozh, `razobratSoglasie(${JSON.stringify(vhod)})`);
  });
}

// ======================================================================= validator.js: второй аккаунт
// Ревью 15.09 №4: второму аккаунту не пересказываем чужой звонок (совпадение по 4 слова подряд).
const ZVONOK_POLYA = ['узнать про Дежурного для салона', 'салон маникюра в Тампе', 'когда можно запустить', 'Звонила про Дежурного, вечером администратор уходит домой'];
const VTOROY = [
  ['На звонке обсуждали салон маникюра в Тампе.', [], false, 'пересказ бизнеса из звонка'],
  ['Вечером администратор уходит домой, поэтому нужен Дежурный.', [], false, 'пересказ итога звонка'],
  ['Это видно только тому, кто звонил. Что вас интересует?', [], true, 'отказ пересказывать'],
  ['Для салона маникюра в Тампе это работа Дежурного.', ['У меня салон маникюра в Тампе'], true, 'те же слова написал сам человек'],
];
for (const [tekst, klient, khoroshiy, chto] of VTOROY) {
  test('vtoroy', `${khoroshiy ? 'хороший' : 'плохой '}: ${chto}`, () => {
    const proverit = funkciya(VAL, ['proverit'], 'validator.js');
    const r = rezultat(proverit(otvet(tekst), { chislaIzKonteksta: [], tekstyKlienta: klient, kartochka: {}, chuzhoyZvonok: ZVONOK_POLYA }));
    if (khoroshiy && !r.ok) throw new Error(`отбит хороший «${tekst}»: ${r.prichiny.join('; ')}`);
    if (!khoroshiy && r.ok) throw new Error(`пропущен пересказ «${tekst}»`);
  });
}
test('vtoroy', 'первому чату (без chuzhoyZvonok) пересказ темы звонка не запрещён', () => {
  const proverit = funkciya(VAL, ['proverit'], 'validator.js');
  const r = rezultat(proverit(otvet('По телефону вы спрашивали про салон маникюра в Тампе.'), { kartochka: {} }));
  if (!r.ok) throw new Error(r.prichiny.join('; '));
});

// ======================================================================= tg-nastroyka.js: проверка фона
// Ревью 15.09 №14: вебхук ставим, только если tg-vhod-background ответил 202 (Netlify исполняет её как фоновую).
const NASTROYKA = join(LIB, '../netlify-functions/tg-nastroyka.js');
async function nastroyka(q, fon, metod = 'POST') {
  process.env.DOGON_ADMIN_KLYUCH = 'klyuch-test';
  process.env.TG_WEBHOOK_SECRET = 'S'.repeat(40);
  process.env.URL = 'https://dogon-test.example';
  const fake = [], stuk = [];
  const fetchBylo = globalThis.fetch, logBylo = console.log;
  global.__DOGON_FAKE_TG__ = fake;
  globalThis.fetch = async (url, opts = {}) => {
    stuk.push({ url: String(url), sekret: (opts.headers || {})['x-telegram-bot-api-secret-token'] });
    if (fon === 'set') throw new Error('ECONNREFUSED');
    return new Response('', { status: fon });
  };
  console.log = () => {};
  try {
    const { handler } = require(NASTROYKA);
    const r = await handler({ httpMethod: metod, headers: { 'x-dogon-klyuch': 'klyuch-test' }, queryStringParameters: q, body: '' });
    return { kod: r.statusCode, telo: JSON.parse(r.body), setWebhook: fake.some((v) => v.method === 'setWebhook'), stuk };
  } finally {
    globalThis.fetch = fetchBylo; console.log = logBylo; delete global.__DOGON_FAKE_TG__;
    for (const k of ['DOGON_ADMIN_KLYUCH', 'TG_WEBHOOK_SECRET', 'URL']) delete process.env[k];
  }
}
test('nastroyka', 'фон 202 → setWebhook, стучались в -background чужим секретом', async () => {
  const r = await nastroyka({ d: 'setWebhook' }, 202);
  ravno(r.kod, 200, 'код ответа');
  if (!r.setWebhook) throw new Error('setWebhook не вызван');
  if (!r.stuk.length || !r.stuk[0].url.endsWith('/.netlify/functions/tg-vhod-background')) throw new Error(`стук не туда: ${JSON.stringify(r.stuk)}`);
  if (r.stuk[0].sekret === 'S'.repeat(40)) throw new Error('проверка фона ушла с настоящим секретом');
});
test('nastroyka', 'фон 200 (синхронная) → 409, вебхук не ставим', async () => {
  const r = await nastroyka({ d: 'setWebhook' }, 200);
  ravno(r.kod, 409, 'код ответа');
  if (r.setWebhook) throw new Error('setWebhook вызван, хотя функция не фоновая');
  ravno(r.telo.proverka_fona.status, 200, 'статус в проверке');
});
test('nastroyka', 'функция не отвечает → 409, вебхук не ставим', async () => {
  const r = await nastroyka({ d: 'setWebhook' }, 'set');
  ravno(r.kod, 409, 'код ответа');
  if (r.setWebhook) throw new Error('setWebhook вызван без проверки');
});
test('nastroyka', 'bez_proverki=1 → setWebhook без стука', async () => {
  const r = await nastroyka({ d: 'setWebhook', bez_proverki: '1' }, 200);
  ravno(r.kod, 200, 'код ответа');
  if (!r.setWebhook || r.stuk.length) throw new Error(`setWebhook=${r.setWebhook}, стуков ${r.stuk.length}`);
});
test('nastroyka', 'd=proverit_fon отдаёт вывод; d=obkhod только POST', async () => {
  const r = await nastroyka({ d: 'proverit_fon' }, 202, 'GET');
  ravno(r.telo.ok, true, 'proverit_fon.ok');
  const g = await nastroyka({ d: 'obkhod' }, 202, 'GET');
  ravno(g.kod, 405, 'obkhod по GET');
});

// ======================================================================= прогон
const origLog = console.log;
let proshli = 0;
const provaly = [];
for (const t of itogi) {
  try { await t.fn(); proshli++; origLog(`ПРОШЁЛ  ${t.gruppa.padEnd(9)} ${t.imya}`); }
  catch (e) { provaly.push(t); origLog(`ПРОВАЛ  ${t.gruppa.padEnd(9)} ${t.imya}\n        ${e.message}`); }
}
const khor = OTVETY.filter((o) => o[2]).length, plokh = OTVETY.length - khor;
origLog(`\nkod.js: ${itogi.filter((t) => t.gruppa === 'kod').length} тестов · validator.js: ${OTVETY.length} ответов (${khor} хороших, ${plokh} плохих)`
  + ` · согласие: ${SOGLASIE.length} · второй аккаунт: ${VTOROY.length + 1} · tg-nastroyka: ${itogi.filter((t) => t.gruppa === 'nastroyka').length}`);
if (KOD.oshibka) origLog(`! ${KOD.oshibka}`);
if (VAL.oshibka) origLog(`! ${VAL.oshibka}`);
origLog(`Итого: ${proshli} прошли, ${provaly.length} провалено из ${itogi.length}.`);
process.exit(provaly.length ? 1 : 0);
