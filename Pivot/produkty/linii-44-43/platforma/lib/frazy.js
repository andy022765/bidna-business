'use strict';
// Всё, что стенд говорит людям, на трёх языках линии: EN, ES, RU. Одним местом, чтобы у каждой
// фразы была пара на каждом языке (тест test/frazy.test.js падает, если пары нет).
//
// Правило Веры: поле soobshchenie агент произносит — это готовая реплика, а не код ошибки.
// Поле dalshe — указание агенту, его не произносят.

const { yazykIli } = require('./vremya');

// Испанское время кончается точкой («10:00 a. m.»): в конце предложения вторую точку не ставим.
const bt = (s) => String(s ?? '').replace(/\.\s*$/, '');

const F = {
  net_dostupa: {
    en: "I can't do that right now. I'll pass your details to the coordinator.",
    es: 'No puedo hacerlo en este momento. Le pasaré sus datos al coordinador.',
    ru: 'Сейчас не могу это сделать. Я передам ваши данные координатору.',
  },
  sboy: {
    en: "Something didn't work on my side. I'll pass your details to the coordinator.",
    es: 'Algo no funcionó de mi lado. Le pasaré sus datos al coordinador.',
    ru: 'У меня что-то не сработало. Я передам ваши данные координатору.',
  },
  net_tipa: {
    en: 'Is this about a job interview or a home care assessment?',
    es: '¿Es para una entrevista de trabajo o para una evaluación de cuidado en casa?',
    ru: 'Это собеседование на работу или оценка ухода на дому?',
  },
  kalendar_molchit: {
    en: "The calendar isn't responding right now, so I can't name a time.",
    es: 'El calendario no responde en este momento, así que no puedo darle una hora.',
    ru: 'Календарь сейчас не отвечает, поэтому время назвать не могу.',
  },
  kalendar_molchit_dalshe: {
    en: 'Do NOT name or invent a time. Offer that the coordinator will call back and confirm the phone number.',
    es: 'NO digas ni inventes una hora. Ofrece que el coordinador devolverá la llamada y confirma el teléfono.',
    ru: 'Время НЕ называй и не выдумывай. Предложи, что координатор перезвонит, и подтверди телефон.',
  },
  okon_net: {
    en: "There's no free time in the next few days.",
    es: 'No hay horarios libres en los próximos días.',
    ru: 'На ближайшие дни свободного времени нет.',
  },
  okon_net_dalshe: {
    en: 'Do not offer a time of your own. Offer a call back from the coordinator.',
    es: 'No ofrezcas una hora por tu cuenta. Ofrece que el coordinador devuelva la llamada.',
    ru: 'Своё время не предлагай. Предложи, что координатор перезвонит.',
  },
  okna: {
    en: (s) => `The nearest options are ${s.join(' or ')}.`,
    es: (s) => `Las opciones más cercanas son ${s.join(' o ')}.`,
    ru: (s) => `Ближайшие варианты: ${s.join(' или ')}.`,
  },
  okna_dalshe: {
    en: 'Offer these options and ask which one works. When they choose, call the booking tool with start EXACTLY as in the okna list. Never name a time from memory.',
    es: 'Ofrece estas opciones y pregunta cuál le conviene. Cuando elija, llama a la herramienta de reserva con start EXACTAMENTE como en la lista okna. Nunca digas una hora de memoria.',
    ru: 'Назови варианты и спроси, какой подходит. Выбрал — вызови запись и передай start ТОЧНО как в списке okna. Время из головы не называй.',
  },
  zapis_net_vremeni: {
    en: "That time isn't among the free ones. Let me check the nearest options.",
    es: 'Ese horario no está entre los libres. Déjeme ver las opciones más cercanas.',
    ru: 'Этого времени нет среди свободных. Давайте посмотрю ближайшие варианты.',
  },
  zapis_net_vremeni_dalshe: {
    en: 'Call the free-slots tool again and offer only what it returns.',
    es: 'Vuelve a llamar a la herramienta de horarios libres y ofrece solo lo que devuelva.',
    ru: 'Вызови свободные окна заново и предложи только то, что они вернут.',
  },
  zapis_zanyato: {
    en: 'That time was just taken. Let me offer another one.',
    es: 'Ese horario se acaba de ocupar. Déjeme ofrecerle otro.',
    ru: 'Это время только что заняли. Давайте предложу другое.',
  },
  zapis_ne_vyshlo: {
    en: "I couldn't book that just now. The coordinator will call you back to set a time.",
    es: 'No pude agendarlo en este momento. El coordinador le devolverá la llamada para fijar la hora.',
    ru: 'Записать сейчас не получилось. Координатор перезвонит вам и согласует время.',
  },
  zapis_ne_vyshlo_dalshe: {
    en: 'Do NOT say it is booked.',
    es: 'NO digas que quedó agendado.',
    ru: 'НЕ говори, что записала.',
  },
  zapis_ok: {
    en: (t) => `You're booked for ${t}.`,
    es: (t) => `Queda agendado para el ${t}.`,
    ru: (t) => `Записала вас: ${t}.`,
  },
  zapis_pereneseno: {
    en: (t) => `I've moved your appointment to ${t}.`,
    es: (t) => `Cambié su cita para el ${t}.`,
    ru: (t) => `Перенесла вашу встречу: ${t}.`,
  },
  zapis_pismo: {
    en: ' A confirmation email is on its way.',
    es: ' Le enviamos un correo de confirmación.',
    ru: ' Подтверждение придёт на почту.',
  },
  kartochka_ok: {
    en: 'Saved.',
    es: 'Guardado.',
    ru: 'Записала.',
  },
  kartochka_net_telefona: {
    en: "I didn't catch a phone number. Could you repeat it digit by digit?",
    es: 'No entendí el número de teléfono. ¿Me lo repite dígito por dígito?',
    ru: 'Я не расслышала номер телефона. Повторите, пожалуйста, по цифрам.',
  },
  // Карточка с именем-заглушкой («Caller», «Unknown»…) или кандидат без вопросов отбора: НИЧЕГО не сохранено
  // (KONTRAKT.md, «Дополнения стенда 30.09 вечер»). soobshchenie агент говорит звонящему, dalshe — только ему.
  kartochka_net_imeni: {
    en: 'I need your first and last name first — could you spell it for me?',
    es: 'Primero necesito su nombre y apellido. ¿Me los puede deletrear, por favor?',
    ru: 'Сначала мне нужны ваши имя и фамилия. Продиктуйте их, пожалуйста, по буквам латиницей.',
  },
  kartochka_net_imeni_dalshe: {
    en: 'Nothing was saved. Ask for the first and last name, read it back letter by letter, wait for yes, then call this again with that name. Never use a placeholder such as Caller.',
    es: 'No se guardó nada. Pide el nombre y apellido, repítelo letra por letra, espera el sí y vuelve a llamar con ese nombre. Nunca uses un nombre de relleno como Caller.',
    ru: 'Ничего не сохранено. Спроси имя и фамилию, повтори по буквам, дождись «да» и вызови снова с этим именем. Никогда не ставь заглушку вроде Caller.',
  },
  kartochka_net_otbora: {
    en: 'Before I save your application, I need to ask you a couple of quick questions about your certificate and your schedule.',
    es: 'Antes de guardar su solicitud, necesito hacerle un par de preguntas rápidas sobre su certificado y su horario.',
    ru: 'Прежде чем сохранить заявку, мне нужно задать пару коротких вопросов: о сертификате и о графике работы.',
  },
  kartochka_net_otbora_dalshe: {
    en: 'Nothing was saved. If this caller is applying for a job, ask the screening questions one at a time, certificate first, then call this again with sertifikat. If they only want to leave a message, do not call this again: take the message in the conversation.',
    es: 'No se guardó nada. Si la persona busca trabajo, haz las preguntas de selección una por una, primero el certificado, y vuelve a llamar con sertifikat. Si solo quiere dejar un mensaje, no vuelvas a llamar: toma el mensaje en la conversación.',
    ru: 'Ничего не сохранено. Если человек устраивается на работу, задай вопросы отбора по одному, первым сертификат, и вызови снова с sertifikat. Если он хочет только оставить сообщение, больше не вызывай: прими сообщение в разговоре.',
  },
  otkaz_ok: {
    en: (t) => `Thank you for letting us know. I've recorded that you can't make your shift on ${t}. We're finding a replacement now.`,
    es: (t) => `Gracias por avisarnos. Anoté que no puede cubrir su turno del ${t}. Ya estamos buscando un reemplazo.`,
    ru: (t) => `Спасибо, что предупредили. Я отметила, что вы не выйдете на смену: ${t}. Мы уже ищем замену.`,
  },
  otkaz_uzhe: {
    en: (t) => `Your call-off for the shift on ${t} is already recorded. We're finding a replacement.`,
    es: (t) => `Su aviso para el turno del ${t} ya está registrado. Estamos buscando un reemplazo.`,
    ru: (t) => `Отказ от смены (${t}) уже записан. Мы ищем замену.`,
  },
  otkaz_mnogo: {
    en: (s) => `I see more than one upcoming shift: ${s.join(' or ')}. Which one can't you make?`,
    es: (s) => `Veo más de un turno próximo: ${s.join(' o ')}. ¿Cuál no puede cubrir?`,
    ru: (s) => `Вижу несколько ближайших смен: ${s.join(' или ')}. На какую вы не выйдете?`,
  },
  otkaz_net_smeny: {
    en: "I don't see an upcoming shift for you. What date is the shift, and which client is it with?",
    es: 'No veo un turno próximo para usted. ¿De qué fecha es el turno y con qué cliente?',
    ru: 'Не вижу у вас ближайшей смены. На какую дату смена и у какого клиента?',
  },
  otkaz_neizvestnyy: {
    en: "I don't see this number in our caregiver list. I'll pass your message to the coordinator right away.",
    es: 'No veo este número en nuestra lista de cuidadores. Le paso su mensaje al coordinador de inmediato.',
    ru: 'Не вижу этот номер в списке сиделок. Сейчас же передам ваше сообщение координатору.',
  },
  // Отказ без причины: не записан, сначала вопрос (слова — как в промптах линии сиделок, раздел 5, шаг 4).
  otkaz_prichina: {
    en: "What's the reason — are you sick, is it transportation, a family matter, or something else?",
    es: '¿Cuál es el motivo: está enfermo, es por transporte, un asunto familiar u otra cosa?',
    ru: 'А причина — вы заболели, проблема с дорогой, семейные обстоятельства или что-то другое?',
  },
  otkaz_prichina_dalshe: {
    en: 'Nothing is recorded yet, so do not say it is. Ask this question, then call the call-off tool again with the same date and prichina: bolezn, semya, transport, or drugoe only if they said it is something else.',
    es: 'Todavía no se anotó nada: no digas que quedó anotado. Haz esta pregunta y vuelve a llamar a la herramienta de ausencias con la misma fecha y prichina: bolezn, semya, transport, o drugoe solo si dijo que es otra cosa.',
    ru: 'Пока ничего не записано: не говори, что записала. Задай этот вопрос и вызови отказ снова с той же датой и prichina: bolezn, semya, transport, а drugoe — только если назвали что-то другое.',
  },
  perevod_ne_chasy: {
    en: "Our coordinators aren't available right now. I'll take a message, and they'll call you back.",
    es: 'Nuestros coordinadores no están disponibles en este momento. Tomo su mensaje y le devolverán la llamada.',
    ru: 'Координаторы сейчас не на связи. Я приму сообщение, и вам перезвонят.',
  },
  perevod_net: {
    en: "The coordinator can't pick up right now. I'll take a message, and they'll call you back.",
    es: 'El coordinador no puede contestar ahora. Tomo su mensaje y le devolverán la llamada.',
    ru: 'Координатор сейчас не может ответить. Я приму сообщение, и вам перезвонят.',
  },
  perevod_net_dalshe: {
    en: 'Do NOT say you are transferring. Take the message: name, phone, reason.',
    es: 'NO digas que estás transfiriendo. Toma el mensaje: nombre, teléfono, motivo.',
    ru: 'НЕ говори, что переводишь. Прими сообщение: имя, телефон, причина.',
  },
  perevod_poshel_dalshe: {
    en: 'The transfer has started. Say nothing more and ask nothing; a person takes over.',
    es: 'La transferencia comenzó. No digas nada más ni hagas preguntas; ahora atiende una persona.',
    ru: 'Перевод пошёл. Больше ничего не говори и не спрашивай — дальше человек.',
  },
  // Входящий звонок, когда агент недоступен (произносит Twilio).
  liniya_nedostupna: {
    en: "Sorry, we can't take your call right now. Please call again in a few minutes.",
    es: 'Lo sentimos, no podemos atender su llamada ahora. Por favor, llame de nuevo en unos minutos.',
    ru: 'Извините, сейчас не можем принять звонок. Пожалуйста, перезвоните через несколько минут.',
  },
  // Входящий звонок, когда предел звонков не проверить (хранилище стенда не ответило): линию не открываем.
  liniya_vremenno: {
    en: 'Sorry, this line is temporarily unavailable. Please call again later.',
    es: 'Lo sentimos, esta línea no está disponible en este momento. Por favor, llame más tarde.',
    ru: 'Извините, линия временно недоступна. Пожалуйста, перезвоните позже.',
  },
  liniya_rezerv: {
    en: 'One moment, connecting you with our office.',
    es: 'Un momento, le comunico con nuestra oficina.',
    ru: 'Одну секунду, соединяю с офисом.',
  },
  // Произносит Twilio (<Say>), если записи голосом агента нет.
  soedinyayu: {
    en: (imya) => `Connecting you with ${imya}, one moment.`,
    es: (imya) => `Le comunico con ${imya}, un momento.`,
    ru: (imya) => `Соединяю с ${imya}, одну секунду.`,
  },
  ne_otvetil: {
    en: "They couldn't pick up right now. We have your number, and the coordinator will call you back. Goodbye.",
    es: 'No pudieron contestar en este momento. Tenemos su número y el coordinador le devolverá la llamada. Adiós.',
    ru: 'Сейчас не смогли ответить. Ваш номер у нас, координатор вам перезвонит. До свидания.',
  },
  // Ширма: слышит только тот, кому переводят, на языке владельца.
  shirma: {
    en: (agentstvo, svodka) => `Call from the ${agentstvo} line.${svodka ? ' ' + svodka + '.' : ''} Press 1 to accept.`,
    es: (agentstvo, svodka) => `Llamada de la línea de ${agentstvo}.${svodka ? ' ' + svodka + '.' : ''} Oprima 1 para aceptar.`,
    ru: (agentstvo, svodka) => `Звонок с линии ${agentstvo}.${svodka ? ' ' + svodka + '.' : ''} Нажмите один, чтобы принять.`,
  },
  shirma_povtor: {
    en: 'Press 1 to accept the call.',
    es: 'Oprima 1 para aceptar la llamada.',
    ru: 'Нажмите один, чтобы принять звонок.',
  },
  // Побудка дежурного по незакрытой смене.
  budilnik: {
    en: (agentstvo, smena) => `${agentstvo}: a shift is still unfilled. ${smena}. Press 1 if you will handle it.`,
    es: (agentstvo, smena) => `${agentstvo}: hay un turno sin cubrir. ${smena}. Oprima 1 si usted se encarga.`,
    ru: (agentstvo, smena) => `${agentstvo}: смена так и не закрыта. ${smena}. Нажмите один, если берёте её на себя.`,
  },
  budilnik_prinyat: {
    en: 'Thank you. The shift is marked as yours in the dashboard. Goodbye.',
    es: 'Gracias. El turno queda a su cargo en el panel. Adiós.',
    ru: 'Спасибо. В пульте смена отмечена за вами. До свидания.',
  },
  // SMS сиделкам.
  sms_predlozhenie: {
    en: (a, s, kod) => `${a}: open shift ${s}. Reply YES ${kod} to take it or NO ${kod} to pass. Reply STOP to opt out.`,
    es: (a, s, kod) => `${a}: turno disponible ${bt(s)}. Responda SI ${kod} para tomarlo o NO ${kod} para pasar. Responda STOP para no recibir mensajes.`,
    ru: (a, s, kod) => `${a}: свободная смена ${s}. Ответьте ДА ${kod}, чтобы взять, или НЕТ ${kod}. STOP — отписаться.`,
  },
  sms_zakreplena: {
    en: (a, s) => `${a}: confirmed, the shift ${s} is yours. Thank you!`,
    es: (a, s) => `${a}: confirmado, el turno ${s} es suyo. ¡Gracias!`,
    ru: (a, s) => `${a}: подтверждено, смена ${s} ваша. Спасибо!`,
  },
  sms_zanyato: {
    en: (a, s) => `${a}: the shift ${s} has already been filled. Thank you for answering.`,
    es: (a, s) => `${a}: el turno ${s} ya fue cubierto. Gracias por responder.`,
    ru: (a, s) => `${a}: смена ${s} уже закрыта. Спасибо, что ответили.`,
  },
  sms_net_prinyato: {
    en: (a) => `${a}: got it, thank you.`,
    es: (a) => `${a}: entendido, gracias.`,
    ru: (a) => `${a}: поняли, спасибо.`,
  },
  sms_kakaya_smena: {
    en: (a, s) => `${a}: you have more than one open offer: ${s}. Reply YES with the code, for example YES 12.`,
    es: (a, s) => `${a}: tiene más de una oferta abierta: ${bt(s)}. Responda SI con el código, por ejemplo SI 12.`,
    ru: (a, s) => `${a}: у вас несколько предложений: ${s}. Ответьте ДА с кодом, например ДА 12.`,
  },
  sms_net_predlozheniya: {
    en: (a) => `${a}: there is no open shift offer for you right now. For anything else, please call us.`,
    es: (a) => `${a}: no tiene ofertas de turno abiertas ahora. Para otra cosa, llámenos por favor.`,
    ru: (a) => `${a}: открытых предложений смен для вас сейчас нет. По другим вопросам позвоните нам.`,
  },
  sms_otkaz_prinyat: {
    en: (a, s) => `${a}: got it, you can't make the shift ${s}. We're finding a replacement. Thank you for telling us.`,
    es: (a, s) => `${a}: entendido, no puede cubrir el turno ${bt(s)}. Buscamos reemplazo. Gracias por avisar.`,
    ru: (a, s) => `${a}: поняли, на смену ${s} вы не выйдете. Ищем замену. Спасибо, что предупредили.`,
  },
  sms_otkaz_utochnit: {
    en: (a) => `${a}: we couldn't tell which shift you mean. Please call us so we can sort it out.`,
    es: (a) => `${a}: no pudimos saber de qué turno se trata. Llámenos, por favor.`,
    ru: (a) => `${a}: не поняли, о какой смене речь. Позвоните нам, пожалуйста.`,
  },
  sms_zapis: {
    en: (a, t) => `${a}: you're booked for ${t}. Reply STOP to opt out.`,
    es: (a, t) => `${a}: su cita es el ${bt(t)}. Responda STOP para no recibir mensajes.`,
    ru: (a, t) => `${a}: вы записаны: ${t}. STOP — отписаться.`,
  },
  // Письмо о записи.
  pismo_zapis_tema: {
    en: (a, t) => `${a}: your appointment on ${t}`,
    es: (a, t) => `${a}: su cita el ${t}`,
    ru: (a, t) => `${a}: ваша встреча ${t}`,
  },
  pismo_zapis_tekst: {
    en: (imya, a, chto, t) => `${imya ? 'Hi ' + imya + ',' : 'Hello,'}\n\nYour ${chto} with ${a} is booked for ${t} (New York time).\nIf you need to change the time, just call us back.\n\n${a}`,
    es: (imya, a, chto, t) => `${imya ? 'Hola, ' + imya + ':' : 'Hola:'}\n\nSu ${chto} con ${a} quedó agendada para el ${t} (hora de Nueva York).\nSi necesita cambiar la hora, llámenos.\n\n${a}`,
    ru: (imya, a, chto, t) => `${imya ? imya + ', здравствуйте!' : 'Здравствуйте!'}\n\n${chto} в ${a}: ${t} (время Нью-Йорка).\nЕсли нужно другое время — просто перезвоните нам.\n\n${a}`,
  },
  chto_sobesedovanie: { en: 'interview', es: 'entrevista', ru: 'Собеседование' },
  chto_ocenka: { en: 'home care assessment', es: 'evaluación de cuidado en casa', ru: 'Оценка ухода на дому' },
  // Напоминание о встрече за 24 и за 2 часа (lib/napominaniya.js). kogda_* — «когда» относительно сегодняшнего дня.
  kogda_segodnya: {
    en: (t) => `today at ${t}`,
    es: (t) => `hoy ${/^1:/.test(t) ? 'a la' : 'a las'} ${t}`,
    ru: (t) => `сегодня в ${t}`,
  },
  kogda_zavtra: {
    en: (k) => `tomorrow, ${k}`,
    es: (k) => `mañana, ${k}`,
    ru: (k) => `завтра, ${k}`,
  },
  kogda_data: {
    en: (k) => `on ${k}`,
    es: (k) => `el ${k}`,
    ru: (k) => k,
  },
  napominanie_sms: {
    en: (a, chto, kogda) => `${a}. Reminder: your ${chto} is ${kogda}. To change the time, call us. Reply STOP to opt out.`,
    es: (a, chto, kogda) => `${a}. Recordatorio: su ${chto} es ${bt(kogda)}. Para cambiar la hora, llámenos. Responda STOP para no recibir mensajes.`,
    ru: (a, chto, kogda) => `${a}. Напоминаем: ${chto} ${kogda}. Если нужно другое время, позвоните нам. STOP — отписаться.`,
  },
  napominanie_tema: {
    en: (a, chto, kogda) => `${a}: reminder about your ${chto} ${kogda}`,
    es: (a, chto, kogda) => `${a}: recordatorio de su ${chto} ${kogda}`,
    ru: (a, chto, kogda) => `${a}: напоминание, ${chto} ${kogda}`,
  },
  napominanie_tekst: {
    en: (imya, a, chto, kogda) => `${imya ? 'Hi ' + imya + ',' : 'Hello,'}\n\nThis is a reminder: your ${chto} with ${a} is ${kogda} (New York time).\nIf you need to change the time, just call us back.\n\n${a}`,
    es: (imya, a, chto, kogda) => `${imya ? 'Hola, ' + imya + ':' : 'Hola:'}\n\nLe recordamos: su ${chto} con ${a} es ${kogda} (hora de Nueva York).\nSi necesita cambiar la hora, llámenos.\n\n${a}`,
    ru: (imya, a, chto, kogda) => `${imya ? imya + ', здравствуйте!' : 'Здравствуйте!'}\n\nНапоминаем: ${chto} в ${a} ${kogda} (время Нью-Йорка).\nЕсли нужно другое время, просто перезвоните нам.\n\n${a}`,
  },
};

// Фраза на языке; нет пары — английская (и тест это ловит раньше звонка).
function fraza(klyuch, yazyk, ...args) {
  const z = F[klyuch];
  if (!z) throw new Error('нет фразы ' + klyuch);
  const v = z[yazykIli(yazyk)] ?? z.en;
  return typeof v === 'function' ? v(...args) : v;
}

// Голос Twilio для <Say> на языке.
const GOLOS = {
  en: { language: 'en-US', voice: 'Polly.Joanna' },
  es: { language: 'es-US', voice: 'Polly.Lupe' },
  ru: { language: 'ru-RU', voice: 'Polly.Tatyana' },
};
function golos(yazyk) { return GOLOS[yazykIli(yazyk)]; }

module.exports = { F, fraza, golos };
