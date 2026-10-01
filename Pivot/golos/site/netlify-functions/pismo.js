// Вера вызывает эту функцию ПРЯМО В РАЗГОВОРЕ и отправляет человеку ссылку на почту.
// Не «мы вам вышлем», а письмо уходит, пока он держит трубку.
//
// Защита — здесь она важнее, чем на звонке: открытый эндпоинт отправки писем это
// открытый ретранслятор для спама, а платим репутацией домена businessinteldna.com.
//   1) общий секрет в заголовке (его знает только агент ElevenLabs);
//   2) проверка формата адреса;
//   3) потолок писем в сутки — у звонков и у формы РАЗНЫЙ (ревью 15.09 №2): форма публичная, и 20 заявок
//      с разных IP не должны оставить живого звонившего без письма до полуночи;
//   4) один и тот же адрес — не чаще раза в сутки;
//   5) имя — только буквы, пробел, апостроф и дефис, до 40 знаков и трёх слов, и экранируется в HTML
//      (ревью 15.09 №1). После перехода формы на один шаг публичный zayavka.js шлёт письмо сразу, и имя
//      вида <a href=//ev.il/pay>Оплатить счёт</a> ушло бы жертве с нашего домена с подписью DKIM.
//      Точку тоже не пускаем: «оплатите на evil.com» почтовики сами превращают в ссылку.
//
// ДВА ШАГА (14.09). Живой звонок Андрея: модель трижды пыталась отправить письмо, едва
// услышав адрес, ещё до «да», и сама путала буквы («эй ди джи» вместо «эй эн ди»).
// Промпт это не лечит — все шесть проверенных моделей так или иначе шлют раньше времени.
// Поэтому порядок держит сервер, а не модель:
//   первый вызов с адресом письмо НЕ шлёт — возвращает адрес по буквам, собранный кодом;
//   письмо уходит, только когда тот же адрес пришёл второй раз с podtverdil: true.
// Между шагами — минимум время чтения адреса вслух: модель, которая спешит, вызовет
// инструмент дважды подряд, и без паузы письмо ушло бы, пока Вера ещё читает.
// Хранилище упало — шлём по podtverdil, как до двух шагов: потерять письмо хуже.
// Заголовок x-golos-suhoy: 1 — холостой режим для прогонов: всё как обычно, но без Resend.
//
// ДОВОДЧИК (15.09). Перед отправкой выдаём КОД для Telegram и пишем его в Blobs 'dogon'
// (подробно — у vydatKod ниже). Блок «Продолжить в Telegram» попадает в письмо только
// при DOGON_V_PISME и только если код записан. Флаг выключен — письмо прежнее и Blobs 'dogon'
// не трогаем вовсе (ревью 15.09 №6): ни кода, ни почты, ни имени в новом хранилище.
//
// env: RESEND_API_KEY, GOLOS_PISMO_SECRET, при нужде EV_BLOBS_TOKEN, SITE_ID;
//      GOLOS_PISEM_V_SUTKI (звонки, 20), GOLOS_PISEM_FORMA_V_SUTKI (форма, 10);
//      DOGON_V_PISME (0 | 1 | список адресов через запятую), TG_USERNAME.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const LIMIT_V_SUTKI = +(process.env.GOLOS_PISEM_V_SUTKI || 20);
const LIMIT_FORMA_V_SUTKI = +(process.env.GOLOS_PISEM_FORMA_V_SUTKI || 10);

// Имя в письме: только то, что похоже на имя. Иначе письмо уходит с «Здравствуйте!» без имени.
const IMYA_OK = /^[\p{L}][\p{L}\p{M} '’-]{0,39}$/u;
function chistoeImya(s) {
  const v = String(s || '').trim().replace(/\s+/g, ' ');
  return IMYA_OK.test(v) && v.split(' ').length <= 3 ? v : '';
}
const ekranHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const OT   = 'Business Intelligence DNA <hello@businessinteldna.com>';
const OTVET = 'support@businessinteldna.com';   // одна почта везде с 14.09

// Два шага воронки. По умолчанию — БЕСПЛАТНЫЙ разбор: звонивший горячее, чем
// посетитель сайта, но $500 на первом контакте всё равно большой прыжок.
// Ссылку на оплату Вера шлёт только тем, кто сам сказал, что готов начинать.
// Тупика нет: список работ заканчивается блоком диагностики с кнопкой.
// Адреса (и почему razbor ведёт на ЛЕНДИНГ, а не на /list) — в ../dogon-lib/ssylki.js:
// одно место правды для письма и для Доводчика, человек сравнивает ссылки.
const SS = require('../dogon-lib/ssylki');
const { SAYT, SSYLKI } = SS;

// Хранилище и код Доводчика. Не поднялось — письмо уходит как до 15.09, без кода.
let D = null;
try {
  D = { H: require('../dogon-lib/hranilishche'), KOD: require('../dogon-lib/kod') };
  D.H.podklyuchitBlobs(getStore);
} catch (e) { D = null; console.log('[pismo] dogon-lib не поднялась, письма без кода:', e.message); }

const den = () => new Date().toISOString().slice(0, 10);
const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
// Агент читает это поле вслух, поэтому текст — готовая реплика, а не код ошибки.
const otvet = (code, ok, skazat) => ({ statusCode: code, headers: JSON_H,
                                       body: JSON.stringify({ ok, skazat }) });
// Холостой ответ помечен: если заголовок случайно попадёт в боевой инструмент, это видно в записи.
// kod — только в холостом ответе и только для прогонов: по нему тест пишет в Telegram.
const otvetSuhoy = (skazat, kod) => ({ statusCode: 200, headers: JSON_H,
                                  body: JSON.stringify({ ok: true, suhoy: true, skazat, ...(kod ? { kod } : {}) }) });

function hranilishche() {
  const name = 'golos-pisma', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

// ---------- адрес по буквам ----------
// Та же манера, что в промпте: английские имена букв, внутри группы пробелы,
// между группами запятая (запятая после каждой буквы звучит надрывом).
const BUKVY = { a:'эй', b:'би', c:'си', d:'ди', e:'и', f:'эф', g:'джи', h:'эйч', i:'ай', j:'джей',
  k:'кей', l:'эл', m:'эм', n:'эн', o:'оу', p:'пи', q:'кью', r:'ар', s:'эс', t:'ти', u:'ю', v:'ви',
  w:'дабл-ю', x:'экс', y:'уай', z:'зи' };
const CIFRY = ['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
const ZNAKI = { '.':'точка', '-':'дефис', '_':'нижнее подчёркивание', '+':'плюс' };
// Домены, которые люди говорят словом. Остальные — по буквам.
const DOMENY = { 'gmail.com':'джимейл точка ком', 'googlemail.com':'гугл мейл точка ком',
  'yahoo.com':'яху точка ком', 'outlook.com':'аутлук точка ком', 'hotmail.com':'хотмейл точка ком',
  'icloud.com':'ай клауд точка ком', 'me.com':'эм и точка ком', 'aol.com':'эй оу эл точка ком',
  'proton.me':'протон точка эм и', 'protonmail.com':'протон мейл точка ком',
  'mail.ru':'мейл точка ру', 'yandex.ru':'яндекс точка ру', 'ya.ru':'я точка ру',
  'bk.ru':'би кей точка ру', 'inbox.ru':'инбокс точка ру', 'list.ru':'лист точка ру', 'ukr.net':'укр точка нет',
  'businessinteldna.com':'бизнес интел ди эн эй точка ком' };
const ZONY = { com:'ком', net:'нет', org:'орг', ru:'ру', ua:'ю эй', us:'ю эс', io:'ай оу', me:'эм и', co:'си оу', de:'ди и', uk:'ю кей' };

function chastPoBukvam(str) {
  // Куски: подряд идущие буквы, подряд идущие цифры, знаки. Буквы и цифры — группами
  // по три; одиночный хвост приклеиваем к предыдущей группе («ар ай ай» лучше, чем «ар ай, ай»).
  const out = [];
  for (const kusok of str.match(/[a-z]+|[0-9]+|[^a-z0-9]/g) || []) {
    if (!/[a-z0-9]/.test(kusok)) { out.push(ZNAKI[kusok] || kusok); continue; }
    const slova = [...kusok].map(ch => BUKVY[ch] || CIFRY[+ch]);
    const gruppy = [];
    for (let i = 0; i < slova.length; i += 3) gruppy.push(slova.slice(i, i + 3));
    if (gruppy.length > 1 && gruppy[gruppy.length - 1].length === 1) gruppy[gruppy.length - 2].push(gruppy.pop()[0]);
    out.push(...gruppy.map(g => g.join(' ')));
  }
  return out.join(', ');
}

function poBukvam(email) {
  const [lok, dom] = email.split('@');
  let domen = DOMENY[dom];
  if (!domen) {
    const chasti = dom.split('.'), zona = chasti.pop();
    domen = chasti.map(chastPoBukvam).join(', точка, ') + ' точка ' + (ZONY[zona] || chastPoBukvam(zona));
  }
  return `${chastPoBukvam(lok)}, собака, ${domen}`;
}

// ---------- английская ветка (25.09.2026) ----------
// Английский агент зовёт ЭТУ ЖЕ функцию с yazyk:'en'. Русское поведение не меняется ни на байт:
// перевод произносимых фраз применяется ОДНИМ местом на выходе (обёртка в самом низу файла),
// поэтому ни один вызов otvet() не переписан — а значит и не сломан.
// Буквы по-английски произносятся сами собой, отдельной таблицы имён не нужно; цифры словами,
// иначе «123» читается как «сто двадцать три».
const EN_CIFRY = ['zero','one','two','three','four','five','six','seven','eight','nine'];
const EN_ZNAKI = { '.':'dot', '-':'dash', '_':'underscore', '+':'plus' };
const EN_DOMENY = { 'gmail.com':'gmail dot com', 'googlemail.com':'google mail dot com',
  'yahoo.com':'yahoo dot com', 'outlook.com':'outlook dot com', 'hotmail.com':'hotmail dot com',
  'icloud.com':'iCloud dot com', 'me.com':'me dot com', 'aol.com':'A O L dot com',
  'proton.me':'proton dot me', 'protonmail.com':'proton mail dot com',
  'businessinteldna.com':'business intel D N A dot com' };

function enChast(str) {
  const out = [];
  for (const kusok of str.match(/[a-z]+|[0-9]+|[^a-z0-9]/g) || []) {
    if (!/[a-z0-9]/.test(kusok)) { out.push(EN_ZNAKI[kusok] || kusok); continue; }
    const slova = [...kusok].map(ch => (/[0-9]/.test(ch) ? EN_CIFRY[+ch] : ch.toUpperCase()));
    const gruppy = [];
    for (let i = 0; i < slova.length; i += 3) gruppy.push(slova.slice(i, i + 3));
    if (gruppy.length > 1 && gruppy[gruppy.length - 1].length === 1) gruppy[gruppy.length - 2].push(gruppy.pop()[0]);
    out.push(...gruppy.map(g => g.join(' ')));
  }
  return out.join(', ');
}

function poBukvamEn(email) {
  const [lok, dom] = email.split('@');
  const domen = EN_DOMENY[dom] || (() => {
    const chasti = dom.split('.'), zona = chasti.pop();
    return chasti.map(enChast).join(', dot, ') + ' dot ' + enChast(zona);
  })();
  return `${enChast(lok)}, at, ${domen}`;
}

// Всё, что Вера произносит вслух. Ключ — русская фраза дословно; проверка
// test_pismo_en.js падает, если в коде появилась фраза без пары здесь.
const EN_FRAZY = {
  'Не получилось отправить.':
    "I couldn't send it.",
  'Сейчас не получается отправить, попробуем позже.':
    "I can't send it right now — let's try a bit later.",
  'Кажется, адрес записан неверно. Продиктуйте ещё раз, пожалуйста.':
    "I don't think I got that address right. Could you say it again, please?",
  'На этот адрес письма уходят, но не доходят. Давайте попробуем другой адрес или я продиктую адрес сайта.':
    "Mail goes out to that address but never arrives. Let's try another one, or I can read you the website address.",
  'Письмо сейчас не уходит. Продиктую адрес сайта голосом.':
    "The email isn't going out right now. Let me read you the website address instead.",
  'Сегодня отправить не получится. Адрес сайта продиктую голосом.':
    "I can't send it today. Let me read you the website address instead.",
  'Письмо на этот адрес уже ушло — проверьте почту, в том числе спам и промоакции.':
    "An email has already gone to that address — do check your inbox, including spam and promotions.",
  'Отправила ещё раз. Посмотрите, пожалуйста, и в спаме, и во вкладке «Промоакции».':
    "Sent again. Please look in spam and in the Promotions tab too.",
  'Письмо отправила, проверьте почту. Если не видно — загляните в спам.':
    "Sent — please check your inbox. If it's not there, look in spam.",
  'Домен продиктуйте, пожалуйста, по буквам — я сверю.':
    "Could you spell the domain out for me, letter by letter? I'll read it back.",
  'На какую почту прислать?':
    'Where should I send it?',
  'Продиктуйте адрес целиком ещё раз, пожалуйста.':
    'Could you give me the whole address again, please.',
  'Похоже, такого адреса не существует. Продиктуйте, пожалуйста, ещё раз — особенно то, что после собаки.':
    "That address doesn't seem to exist. Could you say it again, please — especially the part after the at sign.",
  'Тоже не существует. Давайте по буквам то, что после собаки — я соберу сама.':
    "That one doesn't exist either. Let's do the part after the at sign one letter at a time — I'll put it together.",
  'Давайте так: напишите нам на support@businessinteldna.com, и Андрей с Машей ответят.':
    "Let's do it this way: write to support@businessinteldna.com and Andrii and Masha will answer.",

  // Указания модели. Она их не произносит, но русский текст в английском разговоре
  // однажды отзовётся русской фразой.
  'Домен назван словами, а так теряется четыре адреса из пяти. Письмо НЕ отправлено. Дождись, пока человек продиктует домен по буквам, и вызови меня снова с полным адресом и podtverdil: false. Если он уже диктовал по буквам — просто вызови меня ещё раз с тем же адресом.':
    'The domain was said as words, and that loses four addresses out of five. The email was NOT sent. '
    + 'Wait until they spell the domain out letter by letter, then call me again with the full '
    + 'address and podtverdil: false. If they have already spelled it out, just call me again '
    + 'with the same address.',
  'Адрес человек ещё не называл. Не выдумывай адрес — дождись, пока он его продиктует.':
    'The person has not given an address yet. Do not invent one — wait until they say it.',
  'Письмо ещё НЕ ушло. Прочитай skazat дословно и дождись ответа человека. Что он ответит — передай дословно в поле otvet, своими словами не пересказывай. Согласился — вызови снова с этим же email, podtverdil: true, полем otvet и теми же shag, segment, imya. Сказал «нет» или поправил хоть одну букву — старый адрес мёртв: вызови с исправленным адресом и podtverdil: false.':
    'The email has NOT gone out. Read skazat back word for word and wait for their answer. '
    + 'Pass what they say into the otvet field verbatim — do not paraphrase. If they agree, '
    + 'call again with the same email, podtverdil: true, the otvet field and the same shag, '
    + 'segment, imya. If they say no or change even one letter, the old address is dead: '
    + 'call again with the corrected address and podtverdil: false.',
  'Человек сказал «нет» — прошлый адрес отменён, письмо туда не уйдёт. Дождись, пока он продиктует адрес заново, и вызови меня с НОВЫМ адресом и podtverdil: false.':
    'They said no — the previous address is cancelled and nothing will go there. Wait until '
    + 'they give the address again, then call me with the NEW address and podtverdil: false.',
  'Это ВТОРОЙ отказ подряд. Повторять прежнюю просьбу нельзя: тот же вопрос даст тот же неверно услышанный адрес. Попроси продиктовать часть после собаки ПО БУКВАМ, собери домен сам и вызови меня с полным адресом и podtverdil: false.':
    'That is the SECOND failure in a row. Do not repeat the same request — the same question '
    + 'gets you the same mishearing. Ask them for the part after the at sign LETTER BY LETTER, '
    + 'assemble the domain yourself and call me with the full address and podtverdil: false.',
  'Это ТРЕТИЙ отказ. Больше адрес не спрашивай — отдай наш и закрывай тему. Письмо НЕ отправлено.':
    'That is the THIRD failure. Do not ask for the address again — give them ours and close the '
    + 'subject. The email was NOT sent.',
  'Сервер проверил: у этого адреса нет почтового домена, письмо туда не дойдёт. Письмо НЕ отправлено — так и не говори, что отправлено. Дождись, пока человек продиктует адрес заново, и вызови меня с новым адресом и podtverdil: false.':
    'The server checked: that address has no mail server, so nothing can arrive there. '
    + 'The email was NOT sent — so do not say it was. Wait until they give the address again, '
    + 'then call me with the new address and podtverdil: false.',
};

// Строже, чем «есть собака и точка»: мусор вроде x@b..com Вера прочитала бы кривой фразой.
const POHOZH_NA_POCHTU = /^[a-z0-9+_-]+(\.[a-z0-9+_-]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

// Живой ли почтовый домен. Приёмка 22.09 (conv_3201m34zv4fsem2vgy2bjafqryvj): звонящий продиктовал
// ящик буквами, а домен словами, распознаватель склеил «businessintel.dadna.com». Вера честно
// прочитала это по буквам, звонящий сказал «да, верно», письмо ушло в никуда (Resend: delivery_delayed).
// Подтверждение длинной строки на слух ничего не гарантирует — проверяем почтовый сервер сами.
//
// Проверки «домен существует» мало, и это проверено на том же адресе: dadna.com — припаркованный
// домен, он отвечает на ЛЮБОЙ поддомен (A 64.190.63.x), а почтовым сервером указан localhost.
// Домен «живой», почты нет. Поэтому требуем хотя бы один НАСТОЯЩИЙ MX: не «.» (прямой отказ
// от почты, RFC 7505), не localhost, не 127.x. Без MX вовсе тоже отказ: по RFC 5321 письмо ушло бы
// на A-запись, но живые почтовые домены MX публикуют все, а припаркованные — нет. Цена ложного
// отказа — одна повторная диктовка, цена пропуска — клиент, уверенный, что письмо у него.
// Сеть подвела или не уложились в срок — не мешаем отправке: «не знаю» не значит «нет».
const dns = require('dns').promises;
const DNS_SROK_MS = 2500;
async function domenZhivoy(domen) {
  const sSrokom = (p) => Promise.race([p, new Promise((_, net) =>
    setTimeout(() => net(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_SROK_MS))]);
  let mx;
  try { mx = await sSrokom(dns.resolveMx(domen)); }
  catch (e) { return ['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(e && e.code) ? false : null; }
  const nastoyashchie = (mx || []).filter(({ exchange }) => {
    const h = String(exchange || '').toLowerCase().replace(/\.$/, '');
    return h && h !== 'localhost' && !h.endsWith('.localhost') && !/^(127\.|0\.0\.0\.0$)/.test(h);
  });
  return nastoyashchie.length > 0;
}

const OBERTKA = (vnutri, en = false) => `<!doctype html><html lang="${en ? 'en' : 'ru'}"><body style="margin:0;background:#F6F8F5;padding:28px 16px;
font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#161A17">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E1E6E0;border-radius:14px;padding:28px 26px">
${vnutri}
  <p style="margin:0;color:#7C877F;font-size:14px">
    ${en
      ? 'We work under NDA. We do not need access to your books, your CRM or your customer '
        + 'list, and we do not ask for it.'
      : 'Работаем под NDA. Доступ к вашим счетам, CRM и базе клиентов нам не нужен, '
        + 'и мы его не просим.'}<br><br>
    ${en ? 'Andrii and Masha' : 'Андрей и Маша'} · Business Intelligence DNA<br>
    <a href="${SAYT}" style="color:#3E8F72">businessinteldna.com</a>
  </p>
</div></body></html>`;

const KNOPKA = (ssylka, text) => `<p style="margin:0 0 22px">
    <a href="${ssylka}" style="display:inline-block;background:#55C79A;color:#0F1211;text-decoration:none;
       font-weight:600;padding:13px 24px;border-radius:9px">${text}</a>
  </p>`;

// ---------- Telegram: код и блок в письме (Доводчик, 15.09) ----------
// В Telegram первым пишет человек, и по коду бот узнаёт, после какого звонка или письма он пришёл.
// Ссылка с готовым текстом и кодом в письме — единственный вход в переписку (SPEC §0, §1.1).
//
// Код выдаём после «да» на адрес и после лимитов, прямо перед Resend: нет письма — нет кода.
// В одном разговоре код один: «не пришло» (povtor) и второе письмо (разбор → оплата) несут тот же.
// Записи в Blobs 'dogon' (срок — полем exp в самом JSON, чистит расписание, как в dogon-lib/meta.js):
//   kod/<КОД>              {kod, razgovor (conv_… или null), istochnik (vera|forma), email, imya, segment,
//                           shag, t, t_pisma, chaty:[], suhoy, v_pisme, exp} — 30 дней, холостой сутки.
//                           v_pisme — блок с кодом реально стоял в письме; без него zvonok.js не копит звонок.
//   razgovor-kod/<conv_id> {kod, t, exp} — по нему zvonok.js находит код своего звонка;
//   razgovor-kod/bez-id-<sha256(почта)[:16]> — то же, когда платформа не подставила id (живёт как ссылка час);
//   pochta/<sha256(почта)[:32]> {kody:[последние 5], t, exp} — запасной поиск zvonok.js (скептик №11).
// Почту открытым текстом в КЛЮЧАХ не держим: ключи видны в листингах.
//
// Скептик №11: хранилище упало или думает дольше 1,5 с — письмо уходит БЕЗ блока. Показать код,
// которого нет в Blobs, хуже, чем не показать: человек отправит его и получит тишину навсегда.
// Blobs 8.2.0 без onlyIfNew: «код свободен?» — get-затем-set. Два одинаковых кода из 28 млн
// в одну и ту же миллисекунду — не наш объём.

const DEN_MS = 24 * 3600 * 1000;
const KOD_TAYMAUT_MS = 1500;
const CHAS_MS = 3600 * 1000;
const TAYMAUT = Symbol('taymaut');
const seychas = () => (typeof global.__DOGON_NOW__ === 'number' ? global.__DOGON_NOW__ : Date.now());
const sha256 = (s, n) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n);

// DOGON_V_PISME: «1» — блок всем; адреса через запятую — только им (живая проверка, SPEC 7.2 п. 7); иначе выкл.
function blokVklyuchen(email) {
  const f = String(process.env.DOGON_V_PISME || '').trim().toLowerCase();
  if (f === '1') return true;
  if (!f.includes('@')) return false;
  return f.split(',').map(s => s.trim()).includes(email);
}

function sTaymautom(p, ms) {
  let tm;
  const chasy = new Promise(r => { tm = setTimeout(() => r(TAYMAUT), ms); });
  return Promise.race([p, chasy]).finally(() => clearTimeout(tm));
}

// otmena.v = true ставит обёртка по таймауту: запись, которая ещё не началась, уже не начнётся.
async function vydatKod({ email, imya, seg, shag, razgovor, istochnik, suhoy, vPisme }, otmena) {
  const store = D.H.hranilishche();
  if (!store) return null;
  const t = seychas();
  const sId = razgovor.startsWith('conv_');
  const kRazg = sId ? `razgovor-kod/${razgovor}` : `razgovor-kod/bez-id-${sha256(email, 16)}`;
  const kPochta = `pochta/${sha256(email, 32)}`;
  const [ukaz, pochta] = await Promise.all([
    D.H.chitat(store, kRazg).catch(() => null),
    D.H.chitat(store, kPochta).catch(() => null),
  ]);

  // Тот же разговор и тот же адрес — тот же код. Без id разговора «тот же» — в пределах часа:
  // иначе через месяц другой звонок с этой почтой получил бы старый код с чужим звонком.
  let zapis = null, novyy = false;
  if (ukaz && ukaz.kod && (sId || t - (ukaz.t || 0) < CHAS_MS)) {
    const byl = await D.H.chitat(store, `kod/${ukaz.kod}`).catch(() => null);
    if (byl && byl.email === email && !!byl.suhoy === suhoy && !byl.udaleno_t && D.KOD.zhivoy(byl, t)) {
      zapis = { ...byl, shag, t_pisma: t };
      if (seg) zapis.segment = seg;
      if (imya) zapis.imya = imya;
    }
  }
  if (!zapis) {
    let kod = null;
    for (let i = 0; i < 3 && !kod; i++) {
      const k = D.KOD.sgenerirovat();
      // ошибка чтения летит наверх: не зная, свободен ли код, не выдаём его
      if (!(await D.H.chitat(store, `kod/${k}`))) kod = k;
    }
    if (!kod) { console.log('[pismo] три кода подряд заняты — письмо без блока'); return null; }
    novyy = true;
    zapis = { kod, razgovor: sId ? razgovor : null, istochnik, email, imya, segment: seg, shag,
              t, t_pisma: t, chaty: [], suhoy, v_pisme: false,
              exp: t + (suhoy ? 1 : D.KOD.ZHIVET_DNEY) * DEN_MS };
  }
  if (otmena.v) return null;
  const bylVPisme = !!zapis.v_pisme;
  zapis.v_pisme = bylVPisme || vPisme;

  const kody = [zapis.kod, ...((pochta && Array.isArray(pochta.kody)) ? pochta.kody : []).filter(k => k !== zapis.kod)].slice(0, 5);
  const [zKod, zRazg, zPochta] = await Promise.allSettled([
    D.H.pisat(store, `kod/${zapis.kod}`, zapis),
    D.H.pisat(store, kRazg, { kod: zapis.kod, t, exp: zapis.exp }),
    D.H.pisat(store, kPochta, { kody, t, exp: Math.max(zapis.exp, (pochta && pochta.exp) || 0) }),
  ]);
  if (zKod.status !== 'fulfilled') { console.log('[pismo] код не записан:', zKod.reason && zKod.reason.message); return null; }
  // Запись дошла уже после таймаута: письмо ушло без блока, значит и v_pisme врёт. Поправляем, как успеем
  // (функция может замёрзнуть после ответа — тогда поправка доедет при следующем пробуждении).
  if (otmena.v) {
    console.log('[pismo] код', zapis.kod, 'дописался после таймаута — отзываю пометку «в письме»');
    try {
      if (novyy) await D.H.steret(store, `kod/${zapis.kod}`);
      else if (!bylVPisme) await D.H.pisat(store, `kod/${zapis.kod}`, { ...zapis, v_pisme: false });
    } catch (_) {}
    return null;
  }
  // Указатели — только для связки со звонком; код в Telegram работает и без них.
  if (zRazg.status !== 'fulfilled' || zPochta.status !== 'fulfilled') console.log('[pismo] код записан, указатель нет — звонок может не привязаться');
  return { kod: zapis.kod, novyy, store };
}

async function kodDlyaPisma(args) {
  if (!D) return null;
  const otmena = { v: false };
  try {
    const r = await sTaymautom(vydatKod(args, otmena), KOD_TAYMAUT_MS);
    if (r === TAYMAUT) {
      otmena.v = true;
      console.log('[pismo] код не успел записаться за 1,5 с — письмо без блока');
      return null;
    }
    if (r) console.log('[pismo] код', r.kod, r.novyy ? 'новый' : 'тот же', args.vPisme ? '— в письме' : '— флаг выкл, в письме нет');
    return r;
  } catch (e) { console.log('[pismo] код не выдан:', e.message); return null; }
}

// Письмо не ушло — новый код отзываем: у человека его нет, а zvonok.js иначе покажет владельцу
// «код Telegram», которого звонивший не получал. Старый код (повтор) не трогаем: он в прошлом письме.
async function otozvatKod(k) {
  if (!k || !k.novyy) return;
  try { await sTaymautom(D.H.steret(k.store, `kod/${k.kod}`), KOD_TAYMAUT_MS); }
  catch (e) { console.log('[pismo] код не отозван:', e.message); }
}

// Блок второстепенный: кнопка с обводкой, чтобы не спорила с главной. Раскрытие стоит рядом с кнопкой —
// это и есть согласие способом «pismo» (SPEC §1.2). Скептик №3: прямо говорим, что в модель уходит и звонок.
function blokTelegram(kod, istochnik) {
  const ssylka = SS.tmeSsylka(kod, istochnik).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const nik = SS.tgUsername().replace(/[^A-Za-z0-9_]/g, '');
  const chtoUhodit = istochnik === 'forma'
    ? 'ей передаются ваши сообщения'
    : 'ей передаются ваши сообщения и то, о чём вы говорили с Верой';
  return `
  <div style="margin:0 0 22px;padding-top:18px;border-top:1px solid #E1E6E0">
  <p style="margin:0 0 8px;font-weight:600">Удобнее переписываться?</p>
  <p style="margin:0 0 16px;color:#4A554E">
    Продолжим в Telegram. Первой ответит Вера, наш виртуальный ассистент. Её ответы пишет
    модель Claude компании Anthropic — ${chtoUhodit}. Андрей и Маша видят переписку
    и могут ответить сами. Нажимая кнопку и отправляя сообщение, вы на это соглашаетесь.
    Как мы храним переписку: <a href="${SAYT}/privacy" style="color:#3E8F72">businessinteldna.com/privacy</a>
  </p>
  <p style="margin:0 0 12px">
    <a href="${ssylka}" style="display:inline-block;background:#fff;color:#2E7A5E;text-decoration:none;
       font-weight:600;padding:11px 22px;border-radius:9px;border:1.5px solid #55C79A">Продолжить в Telegram</a>
  </p>
  <p style="margin:0;color:#7C877F;font-size:14px;font-style:italic">
    Если кнопка не открылась, найдите в Telegram @${nik} и отправьте код
    <b style="font-style:normal;letter-spacing:.06em">${kod}</b>.
  </p>
  </div>`;
}

// Английское тело письма. Смысл тот же, что у русского, и ни одного факта, которого нет
// в русском: цены и обещания одинаковы на всех языках (решение Андрея 25.09).
function teloEn(shag, imya, ssylka, blok = '', zapis = '') {
  const zvat = imya ? `Hi ${ekranHtml(imya)},` : 'Hello,';

  if (shag === 'diagnostika') {
    return OBERTKA(`
  <p style="margin:0 0 18px;font-size:17px">${zvat}</p>${zapis}
  <p style="margin:0 0 18px">As we agreed on the call — here is the link to the diagnostic:</p>
  ${KNOPKA(ssylka, 'Go to the diagnostic')}
  <p style="margin:0 0 8px;font-weight:600">What happens next</p>
  <p style="margin:0 0 18px;color:#4A554E">
    You take the diagnostic and fill in the questionnaire. We take three working days
    and get to the bottom of your business. Then you get the document and go into
    a strategy call with Andrii — he comes to that call already knowing what is going on
    with you, not starting from a blank page.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    The first ten get the diagnostic free — the counter on the page is live.
  </p>${blok}`, true);
  }

  // по умолчанию — бесплатный вход
  return OBERTKA(`
  <p style="margin:0 0 18px;font-size:17px">${zvat}</p>${zapis}
  <p style="margin:0 0 18px">As we agreed on the call — this is a good place to start:</p>
  ${KNOPKA(ssylka, 'Open it and build your work list')}
  <p style="margin:0 0 8px;font-weight:600">What this is</p>
  <p style="margin:0 0 18px;color:#4A554E">
    Three questions about your business — what you do, what repeats the same way every week,
    and who answers a customer first. In return you get a work list for your business:
    which AI employees are worth putting in for you specifically, what we do,
    what stays with you, and what to start with.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    It is free and takes a few minutes. Nobody calls you afterwards.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    If you want to go deeper, at the end of the list there is a five hundred dollar diagnostic,
    and it counts towards the cost of the build. For the first ten it is free.
  </p>${blok}`, true);
}

// blok — пустая строка при выключенном флаге: тогда разметка совпадает с прежней до байта.
function telo(shag, imya, ssylka, blok = '', zapis = '') {
  // Экранируем здесь же, даже если имя уже прошло chistoeImya: вторая линия на случай, если фильтр ослабят.
  const zvat = imya ? `${ekranHtml(imya)}, здравствуйте!` : 'Здравствуйте!';

  if (shag === 'diagnostika') {
    return OBERTKA(`
  <p style="margin:0 0 18px;font-size:17px">${zvat}</p>${zapis}
  <p style="margin:0 0 18px">Как и договорились по телефону — ссылка на диагностику:</p>
  ${KNOPKA(ssylka, 'Перейти к диагностике')}
  <p style="margin:0 0 8px;font-weight:600">Что дальше</p>
  <p style="margin:0 0 18px;color:#4A554E">
    Вы оформляете диагностику и заполняете анкету. Мы берём три рабочих дня
    и разбираемся в вашем деле. Дальше вы получаете документ и выходите
    на стратегическую сессию с&nbsp;Андреем — он приходит на разговор, уже зная,
    что у вас происходит, а не с чистого листа.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    Первым десяти диагностика бесплатно — счётчик мест на странице живой.
  </p>${blok}`);
  }

  // по умолчанию — бесплатный вход
  return OBERTKA(`
  <p style="margin:0 0 18px;font-size:17px">${zvat}</p>${zapis}
  <p style="margin:0 0 18px">Как и договорились по телефону — с этого удобно начать:</p>
  ${KNOPKA(ssylka, 'Открыть и собрать список')}
  <p style="margin:0 0 8px;font-weight:600">Что это</p>
  <p style="margin:0 0 18px;color:#4A554E">
    Три вопроса про ваше дело — чем занимаетесь, что в неделе повторяется одинаково,
    кто отвечает клиенту первым. В ответ вы получаете список работ по вашему делу:
    каких цифровых сотрудников имеет смысл поставить именно вам, что делаем мы,
    что остаётся на вас и с чего начинать первым.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    Это бесплатно и занимает несколько минут. Никто вам после этого не звонит.
  </p>
  <p style="margin:0 0 18px;color:#4A554E">
    Захотите глубже — в конце списка будет диагностика за пятьсот долларов,
    и она засчитывается в стоимость внедрения. Первым десяти — бесплатно.
  </p>${blok}`);
}

const handlerRu = async (event) => {
  if (event.httpMethod !== 'POST') return otvet(405, false, 'Не получилось отправить.');

  const secret = process.env.GOLOS_PISMO_SECRET;
  const h = event.headers || {};
  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret) {
    console.log('пришли без секрета — отбой');
    return otvet(401, false, 'Не получилось отправить.');
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return otvet(503, false, 'Сейчас не получается отправить, попробуем позже.');

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  // Язык разговора. Русское поведение — по умолчанию: нет поля, чужое значение, опечатка —
  // всё это русский, а не «что-то среднее».
  const EN = String(b.yazyk || '').toLowerCase() === 'en';
  const email = String(b.email || '').trim().toLowerCase();
  const imyaSyroe = String(b.imya || '').trim().slice(0, 60);
  const imya  = chistoeImya(imyaSyroe);
  if (imyaSyroe && !imya) console.log('[pismo] имя не похоже на имя — письмо без имени');
  const seg   = ['biznes', 'ekspert'].includes(b.segment) ? b.segment : '';
  const shag  = b.shag === 'diagnostika' ? 'diagnostika' : 'razbor';
  // Человек говорит «не пришло, отправьте ещё раз» — отвечать ему «уже отправлено»
  // бесполезно и злит. Повтор разрешаем, но не бесконечно: три раза на адрес в сутки.
  const povtor = b.povtor === true || b.povtor === 'true';
  // ПОВОД. Обязательное поле инструмента, а не необязательный шаг: запрет «не вызывай
  // при жалобе» модель нарушила дважды (обкатка 26.09). Обязательный выбор при каждом
  // вызове держится лучше, чем запрет.
  //   prosil   — человек сам просил материалы, письмо со ссылкой уходит;
  //   zhaloba  — пожаловался на работу;
  //   vozvrat  — просит отменить или вернуть деньги.
  // По жалобе и возврату звонящему НЕ уходит ничего: получить рекламу после «вы плохо
  // сделали работу» — оскорбление. Владельцу вместо этого уходит короткое письмо с пометкой.
  const POVODY = ['prosil', 'zhaloba', 'vozvrat'];
  const povod = POVODY.includes(String(b.povod || '')) ? String(b.povod) : '';
  const podtverdil = b.podtverdil === true || b.podtverdil === 'true';
  // id разговора подставляет платформа. Не подставила (пусто или сырой {{system__...}}) —
  // ключуемся по адресу: хуже, но подтверждение из чужого звонка не пройдёт на другой адрес.
  const rid = String(b.razgovor || '');
  const razgovor = /^conv_[\w-]{6,80}$/.test(rid) ? rid : `bez-id:${email}`;
  const suhoy = (h['x-golos-suhoy'] || h['X-Golos-Suhoy']) === '1';
  // Форма на демо-странице: адрес человек набрал руками, букв на слух не путают — два шага не нужны.
  // Скептик 15.09: после перехода на два шага форма получала «проверю по буквам» и письмо не уходило.
  const izFormy = (h['x-golos-istochnik'] || h['X-Golos-Istochnik']) === 'forma';
  // Для кода: forma — только по заголовку под секретом; иначе vera (телефон или демо уточнит zvonok.js).
  const istochnik = izFormy ? 'forma' : 'vera';

  // Прогон 14.09: модель дважды из десяти сама подставила test@test.com, пока человек не назвал адрес,
  // и приняла следующую его фразу за «да». Заготовки-примеры не принимаем вовсе — просим адрес.
  if (/^(test|example|user|name|email|mail|admin|info|primer|adres)@/.test(email) ||
      /@(test|example|domain|email|mail|sample|primer)\.(com|org|net|ru)$/.test(email))
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
      skazat: 'На какую почту прислать?',
      dalshe: 'Адрес человек ещё не называл. Не выдумывай адрес — дождись, пока он его продиктует.' }) };

  if (!POHOZH_NA_POCHTU.test(email) || email.length > 120)
    return otvet(200, false, 'Кажется, адрес записан неверно. Продиктуйте ещё раз, пожалуйста.');

  // До чтения по буквам: мёртвый домен незачем зачитывать и подтверждать. Форму не трогаем —
  // там адрес набран руками, и у zayavka.js свой разбор ответа.
  if (!izFormy && await domenZhivoy(email.split('@')[1]) === false) {
    console.log('[pismo] почтового домена нет, не зачитываю:', email.split('@')[1]);
    // ВТОРОЙ ОТКАЗ — ДРУГАЯ ПРОСЬБА. Обкатка 26.09: Вера дважды подряд сказала одно и то же
    // «продиктуйте ещё раз», получила то же самое мишеслышанное и человек ушёл — «I'll try
    // again later». Второй раз просим ЧАСТЬ ПОСЛЕ СОБАКИ ПО БУКВАМ, третий — отдаём свой
    // адрес и больше не мучаем. Счёт ведёт сервер, а не модель: в промпте это не держится.
    let raz = 1;
    const sch = hranilishche();
    if (sch) {
      const kl = `otkaz:${razgovor}`;
      try {
        raz = parseInt(await sch.get(kl) || '0', 10) + 1;
        await sch.set(kl, String(raz), { metadata: {} });
      } catch (e) { console.log('[pismo] счётчик отказов недоступен:', e.message); }
    }
    const teksty = {
      1: ['Похоже, такого адреса не существует. Продиктуйте, пожалуйста, ещё раз — особенно то, что после собаки.',
          'Сервер проверил: у этого адреса нет почтового домена, письмо туда не дойдёт. Письмо НЕ отправлено — так и не говори, что отправлено. Дождись, пока человек продиктует адрес заново, и вызови меня с новым адресом и podtverdil: false.'],
      2: ['Тоже не существует. Давайте по буквам то, что после собаки — я соберу сама.',
          'Это ВТОРОЙ отказ подряд. Повторять прежнюю просьбу нельзя: тот же вопрос даст тот же неверно услышанный адрес. Попроси продиктовать часть после собаки ПО БУКВАМ, собери домен сам и вызови меня с полным адресом и podtverdil: false.'],
      3: ['Давайте так: напишите нам на support@businessinteldna.com, и Андрей с Машей ответят.',
          'Это ТРЕТИЙ отказ. Больше адрес не спрашивай — отдай наш и закрывай тему. Письмо НЕ отправлено.'],
    };
    const [skaz, dalshe] = teksty[Math.min(raz, 3)];
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
      popytka: raz, skazat: skaz, dalshe }) };
  }

  const store = hranilishche();

  // Незнакомый домен просим продиктовать по буквам — один раз за разговор.
  // Замерено приёмкой 22.09 на двух прогонах по тридцать звонков: домен, названный СЛОВАМИ,
  // даёт 4 ошибки из 5 (dadna.com, dna.com, deena.com), тот же адрес ПО БУКВАМ — 3 из 3 точно.
  // В промпте это правило не держится: три прогона из трёх Вера всё равно записывала
  // «нордбилд точка ком» на слух. Поэтому держит сервер, ему модель не указ.
  // Известные ящики и наш домен не трогаем: там ошибаться не на чем, а лишний ход раздражает.
  const domen = email.split('@')[1];
  const znakomyy = Object.prototype.hasOwnProperty.call(DOMENY, domen);
  if (!izFormy && store && !znakomyy) {
    const kSpros = `domen-po-bukvam:${razgovor}`;
    let sprashivali = null;
    try { sprashivali = await store.get(kSpros); } catch (e) { sprashivali = 'ne-chitaetsya'; }
    if (!sprashivali) {
      try { await store.set(kSpros, domen); } catch (e) { /* не записалось — спросим в следующий раз */ }
      console.log('[pismo] незнакомый домен, прошу по буквам:', domen);
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
        skazat: 'Домен продиктуйте, пожалуйста, по буквам — я сверю.',
        dalshe: 'Домен назван словами, а так теряется четыре адреса из пяти. Письмо НЕ отправлено. '
              + 'Дождись, пока человек продиктует домен по буквам, и вызови меня снова с полным адресом '
              + 'и podtverdil: false. Если он уже диктовал по буквам — просто вызови меня ещё раз с тем же адресом.' }) };
    }
  }

  // Шаг первый: адрес ещё не зачитан по буквам в этом разговоре — зачитываем, не шлём.
  const skazat1 = `Проверю по буквам: ${poBukvam(email)}. Верно?`;
  const kAdres = `podtv:${razgovor}`;
  let zachitan = null, hranilishcheZhivo = !!store;
  if (store) {
    try { zachitan = JSON.parse((await store.get(kAdres)) || 'null'); }
    catch (e) { hranilishcheZhivo = false; console.log('[pismo] хранилище не читается:', e.message); }
  }
  // Прогон 16.09 (сценарий chisto): Вера зачитала «angrii@», человек сказал «Нет, не джи, а ди»,
  // она переспросила «продиктуйте целиком», услышала «Да, верно» — и отправила на СТАРЫЙ адрес.
  // Со стороны сервера это неотличимо от честного подтверждения: два одинаковых вызова подряд.
  // Поэтому просим модель передавать ответ человека дословно (otvet) и сами ищем в нём отказ.
  // Нет поля — шлём как раньше и пишем в лог: ломать живую отправку эта проверка не должна.
  const otvetCheloveka = String(b.otvet || '').trim();
  const OTKAZ = /(^|[\s,.:;!?—-])(нет|не\s|неверно|неправильно|ошиб|поправ|исправ|заново|другой адрес)/i;
  if (!izFormy && podtverdil && otvetCheloveka && OTKAZ.test(otvetCheloveka)) {
    console.log('[pismo] отказ в ответе человека, подтверждение не засчитано:', razgovor, email, otvetCheloveka.slice(0, 80));
    if (store) { try { await store.delete(kAdres); } catch (e) { /* не страшно: адрес всё равно не подтверждён */ } }
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
      skazat: 'Продиктуйте адрес целиком ещё раз, пожалуйста.',
      dalshe: 'Человек сказал «нет» — прошлый адрес отменён, письмо туда не уйдёт. Дождись, пока он продиктует адрес заново, и вызови меня с НОВЫМ адресом и podtverdil: false.' }) };
  }
  if (!izFormy && podtverdil && !otvetCheloveka) console.log('[pismo] подтверждение без поля otvet:', razgovor, email);

  if (!izFormy && hranilishcheZhivo) {
    const proshlo = zachitan ? Date.now() - zachitan.t : Infinity;
    // Ловит вызов «дважды подряд» (второй приходит через доли секунды), но не наказывает
    // человека, который сказал «да», не дослушав: чтение ~0,36 с на слово, пауза заметно короче.
    const minPauza = zachitan ? 2500 + 100 * zachitan.slov : 0;
    const gotov = zachitan && zachitan.email === email && proshlo >= minPauza && proshlo < 20 * 60 * 1000;
    if (!podtverdil || !gotov) {
      const zapis = { email, t: Date.now(), slov: skazat1.split(/\s+/).length };
      // тот же адрес уже зачитан и просто рано — время первого чтения не сдвигаем
      if (zachitan && zachitan.email === email && proshlo < minPauza) zapis.t = zachitan.t;
      try { await store.set(kAdres, JSON.stringify(zapis)); }
      catch (e) { console.log('[pismo] не записала адрес на проверку:', e.message); }
      console.log('[pismo] шаг 1, зачитываю', razgovor, email, podtverdil ? `(рано: ${proshlo} мс)` : '');
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
        id_razgovora: razgovor.startsWith('conv_'),   // видно в записи: подставила ли платформа id
        skazat: skazat1,
        dalshe: 'Письмо ещё НЕ ушло. Прочитай skazat дословно и дождись ответа человека. Что он ответит — передай дословно в поле otvet, своими словами не пересказывай. Согласился — вызови снова с этим же email, podtverdil: true, полем otvet и теми же shag, segment, imya. Сказал «нет» или поправил хоть одну букву — старый адрес мёртв: вызови с исправленным адресом и podtverdil: false.' }) };
    }
  } else if (!izFormy && !podtverdil) {
    console.log('[pismo] хранилища нет, шаг 1 без записи', email);
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false, skazat: skazat1 }) };
  } else if (!izFormy) console.log('[pismo] хранилища нет, шлю по podtverdil без проверки чтения', email);
  else console.log('[pismo] форма: адрес набран руками, шаг чтения по буквам не нужен', email);

  // РАЗВИЛКА ПО ПОВОДУ. Ставится ПОСЛЕ двух шагов подтверждения (на первом шаге письмо
  // и так не уходит) и ДО отправки. Форму на странице это не касается: там поводов нет.
  if (!izFormy && (povod === 'zhaloba' || povod === 'vozvrat')) {
    const chelovek = EN
      ? 'Andrii and Masha will write to you personally.'
      : 'Андрей и Маша напишут вам сами.';
    // Владельцу — короткое письмо с пометкой и адресом, чтобы жалоба не растворилась.
    const komu = (process.env.GOLOS_VLADELEC || '').split(',').map(s => s.trim()).filter(Boolean);
    const key = process.env.RESEND_API_KEY;
    if (komu.length && key && !suhoy) {
      const metka = povod === 'zhaloba' ? 'ЖАЛОБА' : 'ВОЗВРАТ';
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: OT, to: komu, reply_to: [OTVET],
            subject: `${metka} по звонку — ${email}`,
            html: `<p style="font:700 13px/1 -apple-system,sans-serif;letter-spacing:.14em">${metka}</p>`
              + `<p>Звонивший оставил адрес: <b>${email}</b></p>`
              + (imya ? `<p>Назвался: ${imya}</p>` : '')
              + `<p>Разговор: ${razgovor}</p>`
              + `<p style="color:#666">Продающее письмо ему НЕ отправлено — по поводу «${povod}»`
              + ` мы обещали, что напишет человек. Подробности и расшифровка — в письме`
              + ` «Входящий звонок» по этому же звонку.</p>` }),
        });
      } catch (e) { console.log('[pismo] письмо владельцу по поводу не ушло:', e.message); }
    }
    console.log('[pismo] повод', povod, '— звонящему не шлём, владельцу пометка:', email);
    return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
      povod, skazat: chelovek,
      dalshe: EN
        ? 'Nothing was sent to the caller, and that is correct for this povod. Say skazat and '
          + 'do not promise any email from you. A person writes to them.'
        : 'Звонящему ничего не отправлено, и для этого повода это правильно. Скажи skazat '
          + 'и не обещай письма от себя. Ему напишет человек.' }) };
  }
  // Строгость ТОЛЬКО на английской линии, и вот почему. Повод — обязательное поле
  // у английского инструмента send_the_link. А русский otpravit_ssylku его не знает,
  // как не знает и форма на странице; потребуй я повод от всех — живая русская линия
  // перестала бы отправлять письма вообще. Поэтому: нет повода и линия английская —
  // не отправляем; нет повода и линия русская — считаем prosil, но пишем в журнал,
  // чтобы было видно, когда придёт пора включить строгость и там.
  if (!izFormy && !povod) {
    if (EN) {
      console.log('[pismo] EN: повод не передан — не отправляю', email);
      return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ otpravleno: false,
        skazat: '',
        dalshe: 'The povod field is missing or not one of prosil / zhaloba / vozvrat. '
              + 'Nothing was sent. Say nothing to the caller, decide the povod and call me again '
              + 'with the same email and podtverdil: true.' }) };
    }
    console.log('[pismo] повода нет, линия не английская — считаю prosil', email);
  }

  // Письмо уходит — адрес считаем зачитанным ещё 20 минут: «не пришло» → povtor без нового чтения.
  const obnovitZachitan = () => hranilishcheZhivo && store.set(kAdres, JSON.stringify({ email, t: Date.now() - 3000, slov: 0 })).catch(() => {});

  const vPisme = blokVklyuchen(email);

  if (suhoy) {
    await obnovitZachitan();
    // SPEC §1.1: в холостом режиме код выдаётся всегда (для прогонов) — с пометкой suhoy и сроком в сутки.
    const k = await kodDlyaPisma({ email, imya, seg, shag, razgovor, istochnik, suhoy: true, vPisme });
    console.log('[pismo] холостой режим, письмо не отправляю', email);
    return otvetSuhoy(povtor
      ? 'Отправила ещё раз. Посмотрите, пожалуйста, и в спаме, и во вкладке «Промоакции».'
      : 'Письмо отправила, проверьте почту. Если не видно — загляните в спам.', k && k.kod);
  }

  // Отметка «на этот адрес сегодня уже ушло» ставится ДО отправки — это бронь: брошенный
  // и повторный вызов одного разговора (приёмка 22.09, 93-я и 98-я секунды) не пошлют два письма.
  // Но если Resend отказал, бронь надо снять: иначе следующий вызов честно ответит
  // «уже ушло», хотя не ушло ничего.
  // Подтверждение записи не имеет права попасть в один ключ с письмом-материалами.
  // Живой случай (приёмка 26.09, conv_1201m3g98ffgev4avvcrw7bvv63n): человек записался,
  // встреча в календаре появилась, а письма он не получил — сутки назад на тот же адрес
  // уже уходил «список работ», и ключ `день:шаг:почта` совпал. Вера при этом сказала
  // «письмо уже ушло» про письмо, которого не было. Приглашение из календаря человеку
  // не приходит (служебный аккаунт не зовёт гостей), значит это письмо — единственное,
  // чем он вообще узнаёт о своей встрече.
  // Метку ставит kalendar-zapis.js по тому же разговору. Модель в этом не участвует:
  // shag от неё мы бы не проверили, а метка — факт состоявшейся записи на сервере.
  let zapis = null;
  if (store && !izFormy) {
    try { zapis = JSON.parse((await store.get(`zapis:${razgovor}`)) || 'null'); }
    catch (e) { console.log('[pismo] метка записи не читается:', e.message); }
  }
  // Ключ подтверждения — на ВСТРЕЧУ, а не на сутки: человек, записавшийся дважды за день,
  // обязан получить оба письма. Повторный вызов по той же встрече по-прежнему съедается.
  const shagKlyucha = zapis ? `zapis:${zapis.start_time || zapis.slovami || ''}` : shag;
  const strokaZapisi = zapis && zapis.slovami
    ? `\n  <p style="margin:0 0 18px;padding:12px 14px;background:#F2F6F3;border-radius:8px">`
      + (EN ? `Your call is booked: <b>${ekranHtml(String(zapis.slovami))}</b>.`
            : `Ваша встреча записана: <b>${ekranHtml(String(zapis.slovami))}</b>.`)
      + `</p>`
    : '';

  let snyatBron = async () => {};
  if (store) {
    try {
      // Форма считает свои письма отдельно и в звонковый потолок не входит (ревью №2).
      const kAll = izFormy ? `${den()}:__forma` : `${den()}:__vsego`;
      const limit = izFormy ? LIMIT_FORMA_V_SUTKI : LIMIT_V_SUTKI;
      const kEm = `${den()}:${shagKlyucha}:${email}`;
      const [vsego, byl] = await Promise.all([store.get(kAll), store.get(kEm)]);
      const skolko = parseInt(byl || '0', 10);
      if (parseInt(vsego || '0', 10) >= limit) {
        console.log('[pismo] дневной потолок', izFormy ? 'формы' : 'звонков', limit);
        return otvet(200, false, 'Сегодня отправить не получится. Адрес сайта продиктую голосом.');
      }
      if (skolko && !povtor) {
        const skazatUzhe = 'Письмо на этот адрес уже ушло — проверьте почту, в том числе спам и промоакции.';
        // Форме — пометка uzhe: zayavka.js не шлёт владельцу второе уведомление о той же заявке.
        if (izFormy) return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ ok: true, uzhe: true, skazat: skazatUzhe }) };
        return otvet(200, true, skazatUzhe);
      }
      if (skolko >= 3)
        return otvet(200, false, 'На этот адрес письма уходят, но не доходят. Давайте попробуем другой адрес или я продиктую адрес сайта.');
      await Promise.all([store.set(kAll, String(parseInt(vsego || '0', 10) + 1)),
                         store.set(kEm, String(skolko + 1))]);
      snyatBron = () => Promise.all([store.set(kAll, String(parseInt(vsego || '0', 10))),
                                     store.set(kEm, String(skolko))])
        .catch((e) => console.log('[pismo] бронь не снялась:', e.message));
    } catch (e) { console.log('счётчик писем недоступен:', e.message); }
  }

  // Код — после лимитов, прямо перед отправкой. Блок только если код записан (скептик №11).
  // Флаг выключен — Blobs 'dogon' не трогаем: без блока в письме код никому не нужен (ревью №6).
  const k = vPisme ? await kodDlyaPisma({ email, imya, seg, shag, razgovor, istochnik, suhoy: false, vPisme }) : null;
  const blok = k && vPisme ? blokTelegram(k.kod, istochnik) : '';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: OT, to: [email], reply_to: [OTVET],
        subject: zapis
          ? (EN ? 'Your call is booked — Business Intelligence DNA'
                : 'Ваша встреча записана — Business Intelligence DNA')
          : EN
          ? (shag === 'diagnostika'
              ? 'Your diagnostic link — Business Intelligence DNA'
              : 'Your work list — Business Intelligence DNA')
          : (shag === 'diagnostika'
              ? 'Ваша ссылка на диагностику — Business Intelligence DNA'
              : 'Ваш список работ — Business Intelligence DNA'),
        html: (EN ? teloEn : telo)(shag, imya, SSYLKI[shag][seg], blok, strokaZapisi),
      }),
    });
    const t = await r.text();
    console.log('[pismo] resend', r.status, t.slice(0, 200));
    if (!r.ok) { await Promise.all([otozvatKod(k), snyatBron()]); return otvet(200, false, 'Письмо сейчас не уходит. Продиктую адрес сайта голосом.'); }
    await obnovitZachitan();
  } catch (e) {
    console.log('[pismo] упало:', e.message);
    await Promise.all([otozvatKod(k), snyatBron()]);
    return otvet(200, false, 'Письмо сейчас не уходит. Продиктую адрес сайта голосом.');
  }

  const skazat = povtor
    ? 'Отправила ещё раз. Посмотрите, пожалуйста, и в спаме, и во вкладке «Промоакции».'
    : 'Письмо отправила, проверьте почту. Если не видно — загляните в спам.';
  // Форме отдаём код, чтобы он встал в письмо владельцу. Вере — нет: поле увидит модель
  // и может прочитать код вслух, а про Telegram по телефону она пока не говорит.
  if (izFormy && blok) return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ ok: true, skazat, kod: k.kod }) };
  return otvet(200, true, skazat);
};

// ---------- перевод произносимого, одним местом (25.09.2026) ----------
// Обёртка НЕ трогает логику: берёт готовый ответ и заменяет фразы, которые Вера произносит
// вслух, на английские. Русский путь остаётся тем же кодом до байта, поэтому все прежние
// проверки продолжают проверять то же самое.
// Фраза без пары в EN_FRAZY остаётся русской — и это ловит проверка, а не звонок клиента.
exports.handler = async (event) => {
  const r = await handlerRu(event);
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  if (String(b.yazyk || '').toLowerCase() !== 'en') return r;

  let d = null;
  try { d = JSON.parse(r.body || 'null'); } catch (_) { return r; }
  if (!d || typeof d !== 'object') return r;

  for (const pole of ['skazat', 'dalshe']) {
    const s = d[pole];
    if (typeof s !== 'string') continue;
    // Зачитывание адреса собирается из самого адреса, поэтому переводится не таблицей,
    // а пересборкой: английские буквы, «at» вместо «собака», «dot» вместо «точка».
    if (s.startsWith('Проверю по буквам:')) {
      const email = String(b.email || '').trim().toLowerCase();
      d[pole] = `Let me read it back: ${poBukvamEn(email)}. Is that right?`;
      continue;
    }
    if (EN_FRAZY[s]) { d[pole] = EN_FRAZY[s]; continue; }
    console.log('[pismo] нет английской пары к фразе:', s.slice(0, 80));
  }
  return { ...r, body: JSON.stringify(d) };
};

// Наружу для проверок: таблицу и чтение адреса гоняем без сети.
exports._en = { poBukvamEn, EN_FRAZY };
