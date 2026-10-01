// Тексты, которые сервер пишет сам, без модели. Модель их не может ни пропустить, ни переврать.
// Тексты про удаление данных и согласие утверждает Андрей (SPEC §5, строки 1 и 6).
//
// Язык: человек пишет латиницей без кириллицы — отвечаем по-английски, остальное по-русски.

const RU = {
  // Строка раскрытия перед первым ответом (SPEC §1.2 п. 4).
  raskrytie: 'Это Вера, виртуальный ассистент Business Intelligence DNA. Отвечаю с помощью модели Claude, Андрей и Маша видят этот чат.',
  // После паузы владельца: иначе человек решит, что пишет всё ещё Андрей (SPEC §1.5).
  snova: 'Это снова Вера, виртуальный ассистент.',
  // Второй аккаунт по коду и режим vse: до кнопки модель не зовём (скептик №3).
  soglasie: 'Здравствуйте! Это Вера, виртуальный ассистент Business Intelligence DNA. Отвечаю с помощью модели Claude компании Anthropic, Андрей и Маша видят этот чат. Как храним переписку: businessinteldna.com/privacy. Продолжим так или подождёте Андрея или Машу?',
  knopkaDa: 'Продолжить с Верой',
  knopkaChelovek: 'Жду человека',
  // Ответ не распознан ни как «да», ни как «жду человека» — один раз напоминаем кнопки, дальше молчим.
  soglasiePovtor: 'Чтобы продолжить с Верой, нажмите «Продолжить с Верой» или ответьте «да». Хотите дождаться Андрея или Машу — «Жду человека».',
  zhduCheloveka: 'Хорошо. Андрей и Маша видят этот чат и ответят здесь.',
  soglasieDa: 'Спасибо. Продолжаем.',
  peredayu: 'Этот вопрос передаю Андрею и Маше, они видят переписку.',
  peredayuAndreyu: 'Запуск Андрей обсуждает сам. Передаю ему, он видит этот чат.',
  pokaRazbor: 'Пока — вот с чего начинают:',
  zhaloba: 'Передаю Андрею и Маше, они видят переписку.',
  nedostupna: 'Сейчас не отвечу сама — передала Андрею и Маше, они видят переписку.',
  golos: 'Голосовые пока не слушаю — напишите, пожалуйста, текстом. Андрей и Маша увидят ваше сообщение здесь же.',
  fayl: 'Файлы пока не открываю — напишите, пожалуйста, текстом, что в нём главное. Андрей и Маша увидят файл здесь же.',
  stop: 'Хорошо, больше не пишу.',
  // Скептик №6: копии в группе боту не удалить, поэтому пишем правду о том, что стёрто, а что — руками.
  udalit: 'Удалила из нашей базы эту переписку и данные звонка. Остальные копии, например письмо и запись звонка, Андрей и Маша удалят вручную. Сам чат в Telegram удалите у себя с галочкой «удалить и у собеседника» — тогда он пропадёт у обеих сторон.',
};

const EN = {
  raskrytie: "This is Vera, the virtual assistant of Business Intelligence DNA. I reply using Anthropic's Claude model; Andrii and Masha can see this chat.",
  snova: 'Vera, the virtual assistant, again.',
  soglasie: "Hello! This is Vera, the virtual assistant of Business Intelligence DNA. I reply using Anthropic's Claude model; Andrii and Masha can see this chat. How we store messages: businessinteldna.com/privacy. Shall we continue, or would you rather wait for Andrii or Masha?",
  knopkaDa: 'Continue with Vera',
  knopkaChelovek: 'Wait for a person',
  soglasiePovtor: 'To continue with Vera, tap "Continue with Vera" or reply "yes". To wait for Andrii or Masha, tap "Wait for a person".',
  zhduCheloveka: 'Sure. Andrii and Masha can see this chat and will reply here.',
  soglasieDa: 'Thank you. Let us continue.',
  peredayu: "I'm passing this question to Andrii and Masha; they can see this chat.",
  peredayuAndreyu: "Andrii discusses launches himself. I'm passing this to him; he can see this chat.",
  pokaRazbor: 'Meanwhile, this is where people start:',
  zhaloba: "I'm passing this to Andrii and Masha; they can see this chat.",
  nedostupna: "I can't reply right now — I've passed this to Andrii and Masha; they can see this chat.",
  golos: "I can't listen to voice messages yet — please type your question. Andrii and Masha will see your message here too.",
  fayl: "I can't open files yet — please type what matters most. Andrii and Masha will see the file here too.",
  stop: "Understood, I won't write again.",
  udalit: "I've deleted this conversation and the call details from our database. Other copies, such as the email and the call record, Andrii and Masha will delete manually. To remove the chat itself, delete it in Telegram with the \"also delete for the other person\" option.",
};

function yazyk(tekst, languageCode) {
  const s = String(tekst || '');
  if (/[А-Яа-яЁё]/.test(s)) return 'ru';
  if (/[A-Za-z]{3,}/.test(s)) return 'en';
  return String(languageCode || '').startsWith('en') ? 'en' : 'ru';
}

const sh = (kluch, yaz = 'ru') => ((yaz === 'en' ? EN : RU)[kluch] || RU[kluch]);

// Кнопки согласия под бизнес-сообщением. callback_data: k:da / k:chelovek (≤ 64 байт).
const knopkiSoglasiya = (yaz = 'ru') => [[
  { text: sh('knopkaDa', yaz), callback_data: 'k:da' },
  { text: sh('knopkaChelovek', yaz), callback_data: 'k:chelovek' },
]];

// Текстовый ответ на вопрос о согласии (п. 5.4 Telegram, скептик №3; ревью 15.09 №3 и №8).
// Порядок важен: СНАЧАЛА отказ, потом согласие. Прежняя регулярка /^(да|ок|давайте|соглас…)/ без границы
// слова засчитывала «Дайте Андрея», «Да нет, подожду человека», «Даже не знаю», «Okay, wait for a human».
// Согласие — только целый короткий ответ из «да»-слов. Всё прочее — null: не согласие и не отказ.
// Отказ ловим с запасом («машина» тоже попадёт в «маш»): лишний раз позвать человека дешевле,
// чем отдать переписку в модель без разрешения.
const OTKAZ = /(человек|жив(?:ой|ого|ому|ым)|андре|андри|маш|жду|ждём|ждем|подожд|не\s*надо|не\s*хочу|(?:^|[^\p{L}])нет(?![\p{L}])|human|person|wait|andrii|andrew|masha|(?:^|[^\p{L}])(?:no|not|nope)(?![\p{L}]))/iu;
const SOGLASIE = /^(?:(?:да|ага|угу|ок|окей|давайте|давай|продолжим|продолжаем|продолжить|согласен|согласна|yes|yeah|yep|ok|okay|sure|continue)[\s,.!)]*){1,3}$/iu;
function razobratSoglasie(tekst) {
  const s = String(tekst || '').trim().replace(/ё/gi, 'е');
  if (!s) return null;
  if (OTKAZ.test(s)) return 'chelovek';
  if (s.length <= 20 && SOGLASIE.test(s)) return 'da';
  return null;
}

// Стикер или одно эмодзи — не отвечаем (SPEC §5 строка 4).
const odnoEmodzi = (tekst) => /^[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\s]+$/u.test(String(tekst || '')) && /\p{Extended_Pictographic}/u.test(String(tekst || ''));

module.exports = { RU, EN, sh, yazyk, knopkiSoglasiya, odnoEmodzi, razobratSoglasie };
