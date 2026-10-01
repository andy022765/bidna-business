// Адреса воронки — одно место правды для pismo.js и Доводчика.
// Бот не должен слать другие адреса, чем письмо: человек сравнивает.
//
// ВАЖНО про razbor (перенесено из pismo.js): ведём на ЛЕНДИНГ, а не на /list напрямую.
// /list — голая форма из четырёх полей; на лендинге кнопка «Собрать список работ — бесплатно»
// уже на первом экране, и человек видит, кто мы и что получит.

const SAYT = 'https://businessinteldna.com';

const SSYLKI = {
  razbor:      { biznes: `${SAYT}/business/`,       ekspert: `${SAYT}/expert/`,      '': SAYT },
  diagnostika: { biznes: `${SAYT}/business/oplata`, ekspert: `${SAYT}/expert/oplata`, '': SAYT },
};

const tgUsername = () => String(process.env.TG_USERNAME || 'business_int_dna').replace(/^@/, '');

// Готовый текст, который встаёт в поле ввода Telegram. Почту и телефон в адрес не кладём никогда.
function tekstDlyaTelegram(kod, istochnik) {
  return istochnik === 'forma'
    ? `Здравствуйте! Пишу после письма Business Intelligence DNA. Код ${kod}`
    : `Здравствуйте! Пишу после разговора с Верой. Код ${kod}`;
}

// Только https://t.me — tg:// в письмах режут почтовики и не открывает веб.
function tmeSsylka(kod, istochnik) {
  return `https://t.me/${tgUsername()}?text=${encodeURIComponent(tekstDlyaTelegram(kod, istochnik))}`;
}

// Адрес для поля ssylka ответа модели. diagnostika без сегмента не отдаём (null):
// главная — это не страница оплаты, а промпт велит сперва спросить «команда или сами?».
function ssylkaDlya(tip, segment) {
  const seg = ['biznes', 'ekspert'].includes(segment) ? segment : '';
  if (tip === 'razbor') return SSYLKI.razbor[seg];
  if (tip === 'diagnostika') return seg ? SSYLKI.diagnostika[seg] : null;
  return null;
}

module.exports = { SAYT, SSYLKI, tgUsername, tekstDlyaTelegram, tmeSsylka, ssylkaDlya };
