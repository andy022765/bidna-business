// Инструмент Веры «записать». Создаёт настоящую встречу в календаре, пока человек на линии.
//
// СЕРВЕР НЕ ВЕРИТ МОДЕЛИ НА СЛОВО. Прежде чем записывать, он САМ перечитывает свободные
// окна и проверяет, что названное время в них есть. Без этого Вера могла бы записать время,
// которое ей почудилось. Тот же принцип, по которому адрес почты читает сервер, а не модель.
//
// ГОСТЯ В СОБЫТИЕ НЕ СТАВИМ — так решил не я, а Google. Проверено пробой 25.09:
// events.insert с полем attendees отвечает 403 forbiddenForServiceAccounts, «Service accounts
// cannot invite attendees without Domain-Wide Delegation of Authority», и одинаково при
// sendUpdates=none и sendUpdates=all. Поэтому имя, телефон и почта человека живут в заголовке
// и описании, а подтверждение ему уходит НАШИМ письмом через pismo. Domain-Wide Delegation
// просить не станем: это право действовать от имени любого сотрудника домена, несоразмерное
// задаче «поставить одну встречу».
//
// НИКОГДА НЕ primary. Пишем только в тот календарь, которым с нами поделились (KALENDAR_ID).
// Пример от вендора предлагает primary — то есть личный календарь владельца, куда мы лезть
// не имеем права.
//
// УСПЕХ — ТОЛЬКО 200 с id. Всё остальное — «записать не получилось», и Вера уходит на письмо.
// Она НЕ пересказывает ошибку: человеку не нужен наш код возврата. Худшее, что тут можно
// сделать, — сказать «записала» при незаписанном.
//
// env: GOOGLE_SA_JSON · KALENDAR_ID · KALENDAR_POYAS · GOLOS_PISMO_SECRET (+ настройки часов)

const { gapi, svobodnye, slovami, nastroyki , podklyuchitBlobs } = require('../kalendar-lib/gkal');
const { getStore } = require('@netlify/blobs');
podklyuchitBlobs(getStore);

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });
const NE_VYSHLO = (ru) => ({ ok: false, zapisano: false,
  skazat: ru ? 'Записать сейчас не получилось.' : 'I could not book that just now.',
  dalshe: ru ? 'НЕ говори, что записала. Предложи письмо и возьми адрес почты.'
             : 'Do NOT say it is booked. Offer the email instead and take their address.' });

const POHOZH_NA_POCHTU = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// То же хранилище, что у писем, и тем же способом: голый getStore на стенде не поднимается.
function hranilishcheZapisey() {
  const name = 'golos-pisma', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

exports.handler = async (event) => {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) {}
  const ru = String(d.yazyk || '').toLowerCase() !== 'en';

  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret)
    return otvet(401, { ok: false, zapisano: false,
      skazat: ru ? 'Сейчас не запишу.' : "I can't book that right now." });

  const n = nastroyki();
  const poyas = String(d.poyas || n.poyas).trim();
  const kogda = String(d.start_time || '').trim();
  const imya = String(d.imya || '').trim().slice(0, 60);
  const pochta = String(d.pochta || '').trim().toLowerCase().slice(0, 120);
  // ТЕЛЕФОН. Раньше поле было необязательным, модель его не передавала, и в календаре
  // оказывались встречи «Call · No name» вообще без единого контакта (обкатка 26.09).
  // Теперь номер берётся АВТОМАТИЧЕСКИ — из system__call_sid-варианта caller id, который
  // подставляет платформа. А если человек продиктовал ДРУГОЙ номер, он подтверждается
  // так же, как почта: сервер читает цифры вслух и ждёт «да».
  const telefon = String(d.telefon || '').trim().slice(0, 40);
  const telZvonka = String(d.telefon_zvonka || '').trim().slice(0, 40);
  const podtverdil = d.podtverdil === true || d.podtverdil === 'true';
  // Сравниваем по ПОСЛЕДНИМ десяти цифрам: «+1 424 275 6121» и «4242756121» —
  // один и тот же номер, а сравнение по всем цифрам считало их разными
  // и заставляло Веру переспрашивать на ровном месте.
  const cifry = (s) => (s || '').replace(/\D+/g, '');
  const hvost = (s) => cifry(s).slice(-10);
  const poCifram = (s) => cifry(s).split('').join(' ');
  const zachem = String(d.zachem || '').trim().slice(0, 300);

  if (!kogda) return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'net_vremeni' }));
  if (!n.kalendar) {
    console.log('[kalendar-zapis] нет KALENDAR_ID');
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'net_kalendarya' }));
  }
  // Почта не обязательна, чтобы записаться, но без неё подтверждение отправить некуда.
  // Кривую почту в событие не пишем: она осядет в записи и однажды уедет в письмо.
  const pochta_ok = pochta && POHOZH_NA_POCHTU.test(pochta);
  if (pochta && !pochta_ok) console.log('[kalendar-zapis] почта не похожа на почту, в событие не пишу');

  // Продиктованный номер отличается от того, с которого звонят, — читаем его по цифрам
  // и ждём подтверждения. Совпадает или не назван — подтверждать нечего.
  const svoyNomer = telefon && hvost(telefon) && hvost(telefon) !== hvost(telZvonka);
  if (svoyNomer && !podtverdil) {
    const skaz = ru
      ? `Записываю номер: ${poCifram(telefon)}. Верно?`
      : `Let me read the number back: ${poCifram(telefon)}. Is that right?`;
    console.log('[kalendar-zapis] шаг 1, читаю номер по цифрам');
    return otvet(200, { ok: true, zapisano: false, skazat: skaz,
      dalshe: ru
        ? 'Встреча ЕЩЁ НЕ записана. Прочитай skazat дословно и дождись ответа. Сказал «да» — '
          + 'вызови меня снова с теми же полями и podtverdil: true. Поправил хоть одну цифру — '
          + 'вызови с новым номером и podtverdil: false.'
        : 'The meeting is NOT booked yet. Read skazat back word for word and wait. If they say '
          + 'yes, call me again with the same fields and podtverdil: true. If they correct even '
          + 'one digit, call again with the new number and podtverdil: false.' });
  }

  // 1. Сверяем время со СВЕЖИМ списком окон, а не с тем, что сказала модель.
  let spisok;
  try { spisok = await svobodnye(); }
  catch (e) {
    console.log('[kalendar-zapis] окна не прочитались:', e.message);
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'okna' }));
  }
  if (spisok.kod !== 200) {
    console.log('[kalendar-zapis] окна не прочитались:', spisok.kod, spisok.oshibka);
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'okna' }));
  }
  const tochno = spisok.okna.find(x => new Date(x).getTime() === new Date(kogda).getTime());
  if (!tochno) {
    console.log('[kalendar-zapis] время не из списка свободных:', kogda);
    // «Занято» сказать нельзя: сюда же попадает время ВНЕ рабочих часов и выходной,
    // а оно не занято — его просто нет в расписании. Фраза одна и правдива в обоих случаях.
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'net_v_raspisanii',
      skazat: ru ? 'Этого времени среди свободных нет. Давайте выберу ближайшее.'
                 : 'That time is not among the free ones. Let me offer the nearest.',
      dalshe: ru ? 'Вызови инструмент свободных окон заново и предложи то, что он вернёт.'
                 : 'Call the free-slots tool again and offer whatever it returns.' }));
  }

  // 2. Пишем. Гостя не ставим — Google запрещает служебному аккаунту приглашать.
  const konec = new Date(new Date(tochno).getTime() + n.dlina * 60000);
  const kto = imya || (ru ? 'Без имени' : 'No name');
  const opisanie = [
    ru ? 'Записано голосовым агентом Верой.' : 'Booked by Vera, the voice agent.',
    imya ? (ru ? 'Имя: ' : 'Name: ') + imya : '',
    telefon ? (ru ? 'Телефон: ' : 'Phone: ') + telefon : '',
    (telZvonka && hvost(telZvonka) !== hvost(telefon))
      ? (ru ? 'Звонил с номера: ' : 'Called from: ') + telZvonka : '',
    pochta_ok ? (ru ? 'Почта: ' : 'Email: ') + pochta : '',
    zachem ? (ru ? 'О чём: ' : 'About: ') + zachem : '',
    ru ? 'Гость в событие не добавлен: служебный аккаунт не может приглашать. '
       + 'Подтверждение человеку уходит письмом.'
       : 'No guest is attached: a service account cannot invite attendees. '
       + 'The person is confirmed by email.',
  ].filter(Boolean).join('\n');

  const { kod, telo } = await gapi(
    '/calendars/' + encodeURIComponent(n.kalendar) + '/events',
    { summary: (ru ? 'Звонок · ' : 'Call · ') + kto,
      description: opisanie,
      start: { dateTime: new Date(tochno).toISOString(), timeZone: n.poyas },
      end: { dateTime: konec.toISOString(), timeZone: n.poyas } });

  if (kod !== 200 || !telo.id) {
    console.log('[kalendar-zapis] Google отказал:', kod, JSON.stringify(telo).slice(0, 200));
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'google' }));
  }

  const slova = slovami(tochno, poyas, ru);

  // Метка для pismo.js: в этом разговоре запись СОСТОЯЛАСЬ. По ней письмо-подтверждение
  // получает свой ключ защиты от дублей и не тонет в ключе письма-материалов, а к тексту
  // добавляется строка со временем встречи. Приглашение из календаря человеку не уходит —
  // служебный аккаунт не умеет звать гостей, — поэтому письмо здесь единственное.
  // Разговор приходит системной переменной, модель его не выбирает и не видит.
  //
  // Хранилище поднимаем ТАК ЖЕ, как pismo.js: на этом стенде голый getStore({name})
  // бросает «The environment has not been configured to use Netlify Blobs», и метка
  // молча не пишется. Поймано выкаткой 26.09.2026: запись прошла, а подтверждение
  // не ушло — сервер честно отработал, просто метки не было.
  const rid = String(d.razgovor || '');
  if (/^conv_[\w-]{6,80}$/.test(rid)) {
    const hran = hranilishcheZapisey();
    if (!hran) console.log('[kalendar-zapis] хранилище не поднялось, метки записи не будет');
    else {
      try {
        await hran.set(`zapis:${rid}`, JSON.stringify({ start_time: tochno, slovami: slova }));
      } catch (e) { console.log('[kalendar-zapis] метку записи не поставить:', e.message); }
    }
  }

  return otvet(200, {
    ok: true, zapisano: true, id: telo.id, start_time: tochno, slovami: slova,
    skazat: ru ? `Записала: ${slova}.` : `Booked: ${slova}.`,
    dalshe: ru
      ? 'Запись СОСТОЯЛАСЬ — теперь сказать «записала» можно. Дальше возьми адрес почты '
        + 'и отправь подтверждение письмом: приглашение из календаря человеку НЕ уходит.'
      : 'The booking DID go through — now you may say it is booked. Next, take their email '
        + 'address and send the confirmation: no calendar invite reaches them.',
  });
};
