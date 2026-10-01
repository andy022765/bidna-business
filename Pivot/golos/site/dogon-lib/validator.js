// Сервер держит правила сам, не надеясь на модель (тот же урок, что двухшаговое письмо в pismo.js).
// Ответ отбивается, если в нём (SPEC §4 + скептик №8 и №3):
//   - проценты, «в N раз», «гарантируем», «аудит» без отрицания перед ним, «перезвон»,
//     «соединяю», «оператор», «специалист», скидка (кроме «скидок нет»), «напомню», «напишу через»;
//   - число не из chisla.generated.js, не из КОНТЕКСТА (места) и не из сообщений самого человека;
//   - сумма в долларах, когда тема видимость или автоматизация (цену видимости не называем);
//   - любой URL (ссылки добавляет только сервер), markdown, эмодзи;
//   - «@» и совпадение с почтой или именем из карточки звонка (второй аккаунт не должен их увидеть);
//   - второй аккаунт: совпадение по 4 слова подряд с полями звонка (biznes, itog и др.) — ревью 15.09 №4.
//     Модель карточку этому чату и так не получает; это вторая линия, если она просочится иначе;
//   - больше 900 знаков или пусто.
//
// chisla.generated.js делает sobrat_prompt.py из тех же вырезанных блоков цен, что уходят в промпт,
// поэтому цены в Вере-голосе и Вере-переписке не разъедутся. Файла ещё нет — запасной список ниже.

let CHISLA = null;
try {
  const c = require('./chisla.generated');
  const arr = Array.isArray(c) ? c : (c && (c.CHISLA || c.chisla || c.default));
  if (Array.isArray(arr) && arr.length) CHISLA = arr.map(Number).filter(Number.isFinite);
} catch (_) { CHISLA = null; }
const CHISLA_ZAGLUSHKA = !CHISLA;
if (!CHISLA) {
  // SPEC §4 + скептик №8 (1, 2, 5, 1,5) + 25 центов за минуту из Линии 05.
  CHISLA = [500, 5000, 1000, 199, 2500, 399, 1500, 0.25, 25, 50, 10, 3, 67, 40, 11, 1, 2, 5, 1.5];
}

const MAX_DLINA = 900;

// Отрицание прямо перед словом: «не аудит», «а не аудит», «не просто аудит», «not an audit».
function sOtricaniem(tekst, index) {
  const pered = tekst.slice(Math.max(0, index - 30), index);
  return /(?:^|[\s,.(«"—-])(?:не|нет|ни|not|no|isn['’]t|aren['’]t|don['’]t|doesn['’]t|won['’]t|never)\s+(?:\S+\s+){0,2}$/i.test(pered);
}

function estBezOtricaniya(tekst, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(tekst))) { if (!sOtricaniem(tekst, m.index)) return m[0]; }
  return null;
}

// «5 000», «5,000», «$1 500» → одно число; «1,5» и «0,25» — дробь.
function chislaVTekste(s) {
  let x = String(s || '');
  for (let i = 0; i < 3; i++) x = x.replace(/(\d)[\s  ,](\d{3})(?!\d)/g, '$1$2');
  const out = [];
  for (const m of x.matchAll(/\d+(?:[.,]\d+)?/g)) out.push(parseFloat(m[0].replace(',', '.')));
  return out;
}

const ravny = (a, b) => Math.abs(a - b) < 1e-9;

// Слова для сравнения фраз: нижний регистр, ё → е, только буквы и цифры.
const slova = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function ngrammy(s, n = 4) {
  const w = slova(s), out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}
const ekran = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DOLLARY = /\$|долл|usd|dollar|бакс/i;

// otvet — нормализованный ответ модели (mozgi.normalizovat).
// dop: { chislaIzKonteksta: [..], tekstyKlienta: [..], kartochka: { email, imya }, andreyPishet: bool,
//        chuzhoyZvonok: [строки полей звонка] — только для второго аккаунта }
function proverit(otvet, dop = {}) {
  const prichiny = [];
  const tekst = String((otvet && otvet.tekst) || '');
  const tema = otvet && otvet.tema;
  const ploho = (p) => { if (!prichiny.includes(p)) prichiny.push(p); };

  if (!tekst.trim()) ploho('пустой ответ');
  if (tekst.length > MAX_DLINA) ploho(`длиннее ${MAX_DLINA} знаков (${tekst.length})`);

  // анти-гарантия
  if (/\d\s*%|процент|percent/i.test(tekst)) ploho('проценты');
  if (/(?:^|[^а-яё])в\s+(?:\d+(?:[.,]\d+)?|полтора|два|две|три|четыре|пять|десять|несколько)\s+раз(?:а)?(?![а-яё])/i.test(tekst)
      || /\b\d+(?:[.,]\d+)?\s?x\b|\b(?:twice|two times|\d+ times)\b/i.test(tekst)) ploho('«в N раз»');
  const garant = estBezOtricaniya(tekst, /гарантиру|guarantee/i);
  if (garant) ploho(`«${garant}»`);

  // название платного шага
  // «аудитория» — одно из пяти направлений диагностики, Вера обязана его называть: не путать с «аудит».
  const audit = estBezOtricaniya(tekst, /аудит(?!ори)|audit/i);
  if (audit) ploho('«аудит» — платный шаг называется «глубокая диагностика»');

  // обещания, которых нет
  for (const re of [/перезвон/i, /напомн(?:ю|им)/i, /напиш(?:у|ем)\s+(?:вам\s+)?через/i, /вернусь\s+к\s+вам/i,
                    /свяж(?:усь|емся|ется|утся)/i, /позвон(?:ю|им|ит|ят)(?![а-яё])/i,
                    /call you back|remind you|get back to you|reach out to you/i]) {
    const n = estBezOtricaniya(tekst, re);
    if (n) ploho(`обещание «${n}»`);
  }
  if (!dop.andreyPishet && /(андрей|маша)[^.!?\n]{0,25}напиш(?:ет|ут)(?![а-яё])/i.test(tekst)) ploho('«Андрей напишет» выключено');
  for (const re of [/соедин(?:яю|им|ю)/i, /оператор/i, /специалист/i]) {
    const m = tekst.match(re);
    if (m) ploho(`слово «${m[0]}»`);
  }

  // скидки: можно только сказать, что их нет
  if (/скидк|скидок|discount/i.test(tekst)) {
    const bez = tekst
      .replace(/скидок\s+(?:у\s+нас\s+)?(?:нет|не\s+бывает|не\s+даём|не\s+даем|не\s+делаем)/gi, '')
      .replace(/без\s+скид(?:ок|ки)/gi, '')
      .replace(/(?:не|нет)\s+(?:\S+\s+){0,2}скид(?:ок|ки|ку|ка)/gi, '')
      .replace(/скидк[аиу]\s+не\s+/gi, '')
      .replace(/no\s+discounts?|don['’]t\s+(?:offer|give|do)\s+discounts?/gi, '');
    if (/скидк|скидок|discount/i.test(bez)) ploho('скидка');
  }

  // ссылки, разметка, эмодзи, ники и личные данные
  if (/https?:\/\/|www\.|t\.me\/|tg:\/\/|\b[a-z0-9-]{2,}\.(?:com|ru|net|org|io|me|app|ai|co|us)\b/i.test(tekst)) ploho('адрес или ссылка в тексте');
  if (/\*\*|__|`|^\s{0,3}#{1,6}\s|^\s*[*•▪◦\-]\s+|\[[^\]]*\]\([^)]*\)/m.test(tekst)) ploho('markdown');
  if (/\p{Extended_Pictographic}/u.test(tekst)) ploho('эмодзи');
  if (tekst.includes('@')) ploho('«@» в тексте');

  const kl = (dop.tekstyKlienta || []).join('\n').toLowerCase();
  const k = dop.kartochka || {};
  if (k.email) {
    const email = String(k.email).toLowerCase();
    const lok = email.split('@')[0];
    const nizhn = tekst.toLowerCase();
    if (nizhn.includes(email) || (lok.length >= 4 && nizhn.includes(lok) && !kl.includes(lok))) ploho('почта из карточки');
  }
  if (k.imya && String(k.imya).trim().length >= 3) {
    const imya = String(k.imya).trim();
    const re = new RegExp(`(^|[^\\p{L}])${ekran(imya)}(?![\\p{L}])`, 'iu');
    if (re.test(tekst) && !re.test(kl)) ploho('имя из карточки');
  }

  // второй аккаунт: фразы из чужого звонка (4 слова подряд), кроме тех, что человек написал сам
  if (Array.isArray(dop.chuzhoyZvonok) && dop.chuzhoyZvonok.length) {
    const svoi = ngrammy((dop.tekstyKlienta || []).join('\n'));
    const zapret = new Set();
    for (const pole of dop.chuzhoyZvonok) for (const g of ngrammy(pole)) if (!svoi.has(g)) zapret.add(g);
    for (const g of ngrammy(tekst)) if (zapret.has(g)) { ploho('пересказ звонка второму аккаунту'); break; }
  }

  // числа
  const razresheno = [...CHISLA, ...(dop.chislaIzKonteksta || []).map(Number).filter(Number.isFinite)];
  for (const t of dop.tekstyKlienta || []) razresheno.push(...chislaVTekste(t));
  const chuzhie = chislaVTekste(tekst).filter(n => !razresheno.some(r => ravny(r, n)));
  if (chuzhie.length) ploho(`числа не из цен: ${[...new Set(chuzhie)].join(', ')}`);

  // цена видимости и автоматизации не называется (скептик №8)
  const estSumma = (s) => DOLLARY.test(s) && /\d|тысяч|сот|thousand|hundred/i.test(s);
  if ((tema === 'vidimost' || tema === 'avtomatizaciya') && estSumma(tekst)) ploho(`сумма в долларах при теме ${tema}`);
  for (const predl of tekst.split(/[.!?\n]+/)) {
    if (/видимост|visibility|автоматизац|automation/i.test(predl) && estSumma(predl)) { ploho('цена видимости или автоматизации'); break; }
  }

  return { ok: prichiny.length === 0, prichiny };
}

module.exports = { proverit, chislaVTekste, ngrammy, CHISLA, CHISLA_ZAGLUSHKA, MAX_DLINA };
