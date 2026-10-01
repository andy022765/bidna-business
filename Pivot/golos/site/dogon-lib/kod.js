// Код, по которому чат в Telegram узнаёт звонок или письмо.
//
// 5 знаков из 31: без 0/O/1/I/L — их путают глазами и при перепечатке. 31^5 ≈ 28,6 млн.
// Человек может перепечатать код кириллицей («К7М3Х») или строчными с пробелом —
// нормализация сводит всё к латинице верхнего регистра.
//
// Метки сайта (скептик №2): на страницах оплаты, анкеты, «спасибо» и в статье ссылки на
// @business_int_dna ведут людей, которым обещали ЖИВОЙ ответ. Их готовый текст несёт метку
// «Код S-OPL» и т. п. — такой чат навсегда отдаётся людям, Вера туда не заходит.

const crypto = require('crypto');

const ALFAVIT = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const DLINA = 5;
const ZHIVET_DNEY = 30;
const SUHOY_ZHIVET_CHASOV = 24;

// Кириллические двойники → латиница (SPEC §1.2). О/З/Ч не трогаем: 0 и O в алфавите нет.
const DVOYNIKI = { 'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X' };

function sgenerirovat() {
  let s = '';
  for (let i = 0; i < DLINA; i++) s += ALFAVIT[crypto.randomInt(ALFAVIT.length)];
  return s;
}

function normalizovat(str) {
  return String(str || '')
    .toUpperCase()
    .replace(/[\s  \-–—_.·]/g, '')
    .replace(/[АВЕЁКМНРСТУХ]/g, ch => DVOYNIKI[ch] || ch);
}

const vAlfavite = (s) => s.length === DLINA && [...s].every(ch => ALFAVIT.includes(ch));

// Ищем код в тексте. Возвращает { kody: [до 3 кандидатов], sKlyuchom: было ли слово «код» }.
//   1) «код|code» + до 7 знаков дальше (пробел внутри кода допускаем: «к7м 3х»);
//   2) слова «код» нет и сообщение короче 200 знаков — любое слово из 5 знаков нашего алфавита.
//      Сначала те, где есть цифра: русское «СЕКТА» тоже проходит алфавит, но цифр в нём нет.
function najtiKod(tekst) {
  const s = String(tekst || '');
  const kody = [];
  const dobavit = (k) => { if (vAlfavite(k) && !kody.includes(k)) kody.push(k); };

  const re = /(?:^|[^A-Za-zА-Яа-яЁё])(?:код|code|kod)\s*[:#№\-–—]?\s*([A-Za-zА-Яа-яЁё0-9](?:[\s\-]?[A-Za-zА-Яа-яЁё0-9]){4,6})/giu;
  let m, sKlyuchom = false;
  while ((m = re.exec(s))) {
    sKlyuchom = true;
    const syroe = normalizovat(m[1]);
    dobavit(syroe.slice(0, DLINA));
  }
  if (!kody.length && !sKlyuchom && s.length < 200) {
    const slova = s.split(/[^A-Za-zА-Яа-яЁё0-9]+/).map(normalizovat).filter(vAlfavite);
    slova.sort((a, b) => (/\d/.test(b) ? 1 : 0) - (/\d/.test(a) ? 1 : 0));
    slova.forEach(dobavit);
  }
  return { kody: kody.slice(0, 3), sKlyuchom };
}

// Живой ли код: моложе 30 дней; холостой (suhoy, из прогонов) — моложе суток.
function zhivoy(zapis, seychas) {
  if (!zapis || !zapis.t) return false;
  const vozrast = seychas - zapis.t;
  if (vozrast < 0) return true;
  if (zapis.suhoy) return vozrast < SUHOY_ZHIVET_CHASOV * 3600 * 1000;
  return vozrast < ZHIVET_DNEY * 24 * 3600 * 1000;
}

// Метки источника с сайта: «Код S-OPL», «S-ANK», «S-SPS», «S-STAT». Любая S-<буквы> — метка.
// Плюс готовый текст статьи, которого уже нет смысла ждать с меткой: он разослан до правки.
const STATYA = /прочитал[аи]?\s+статью\s+про\s+пять\s+ai/i;
function najtiMetku(tekst) {
  const s = String(tekst || '');
  const m = s.match(/(?:^|[^A-Za-z0-9])S-([A-Z]{2,6})(?![A-Za-z0-9])/i);
  if (m) return `S-${m[1].toUpperCase()}`;
  if (STATYA.test(s)) return 'S-STAT';
  return null;
}

module.exports = { ALFAVIT, DLINA, ZHIVET_DNEY, sgenerirovat, normalizovat, najtiKod, zhivoy, najtiMetku };
