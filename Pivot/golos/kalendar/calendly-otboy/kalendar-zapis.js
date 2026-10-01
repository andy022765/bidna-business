// Инструмент Веры «записать». Создаёт настоящую встречу в Calendly, пока человек на линии.
//
// СЕРВЕР НЕ ВЕРИТ МОДЕЛИ НА СЛОВО. Прежде чем записывать, он САМ перечитывает свободные
// окна и проверяет, что названное время есть в списке. Без этого Вера могла бы предложить
// время, которое ей почудилось, а мы бы его молча записали. Тот же принцип, по которому
// адрес почты читает сервер, а не модель.
//
// УСПЕХ — ТОЛЬКО 201 С uri. Всё остальное — «записать не получилось», и Вера уходит на
// письмо. Она НЕ пересказывает ошибку: человеку не нужен наш код возврата, ему нужно
// знать, что записи нет. Худшее, что тут можно сделать, — сказать «записала» при незаписанном.
//
// ТАРИФ. POST /invitees у Calendly доступен только на платных планах (Standard и выше);
// на бесплатном он отвечает 403. Наш аккаунт 25.09 на пробном периоде — значит однажды
// этот 403 придёт по-настоящему. Ветка 403 обработана отдельно и проверена подменой.
//
// env: CALENDLY_TOKEN · CALENDLY_EVENT_TYPE · CALENDLY_MESTO (по умолчанию zoom_conference)
//      · GOLOS_PISMO_SECRET

const { calendly, svobodnye, slovami } = require('./kalendar-obshchee');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (kod, telo) => ({ statusCode: kod, headers: JSON_H, body: JSON.stringify(telo) });
const NE_VYSHLO = (ru) => ({ ok: false, zapisano: false,
  skazat: ru ? 'Записать сейчас не получилось.' : 'I could not book that just now.' });

exports.handler = async (event) => {
  const h = event.headers || {};
  const secret = process.env.GOLOS_PISMO_SECRET;
  if (!secret || (h['x-golos-secret'] || h['X-Golos-Secret']) !== secret) {
    return otvet(401, { ok: false, zapisano: false, skazat: 'Сейчас не запишу.' });
  }

  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) {}
  const ru = d.yazyk !== 'en';
  const pochta = String(d.pochta || '').trim();
  const imya = String(d.imya || '').trim();
  const poyas = String(d.poyas || 'America/New_York').trim();
  const kogda = String(d.start_time || '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(pochta)) {
    console.log('[kalendar-zapis] почта не похожа на почту:', pochta);
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'pochta' }));
  }
  if (!kogda) return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'net_vremeni' }));

  // 1. Сверяем время со СВЕЖИМ списком окон, а не с тем, что сказала модель.
  const spisok = await svobodnye(6);
  if (spisok.kod !== 200) {
    console.log('[kalendar-zapis] окна не прочитались:', spisok.kod, spisok.oshibka);
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'okna' }));
  }
  const tochno = spisok.okna.find(x => new Date(x).getTime() === new Date(kogda).getTime());
  if (!tochno) {
    console.log('[kalendar-zapis] время не из списка свободных:', kogda);
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'zanyato',
      skazat: ru ? 'Это время уже занято.' : 'That time is taken.' }));
  }

  // 2. Пишем. location обязателен: без него Calendly отвечает 400 «invalid location choice».
  const telo = {
    event_type: process.env.CALENDLY_EVENT_TYPE,
    start_time: tochno,
    invitee: { name: imya || (ru ? 'Без имени' : 'No name'), email: pochta, timezone: poyas },
    location: { kind: process.env.CALENDLY_MESTO || 'zoom_conference' },
  };
  if (d.o_chem) {
    telo.questions_and_answers = [{
      question: 'Please share anything that will help prepare for our meeting.',
      answer: String(d.o_chem).slice(0, 400), position: 0 }];
  }

  const { kod, telo: r } = await calendly('/invitees',
    { method: 'POST', body: JSON.stringify(telo) });

  if (kod === 403) {
    // Тариф Calendly упал до бесплатного. Для звонящего это просто «не получилось»,
    // а вот нам надо увидеть причину в журнале, иначе будем искать её в промпте.
    console.log('[kalendar-zapis] 403 — похоже, тариф Calendly больше не позволяет запись');
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'tarif' }));
  }
  const uri = r && r.resource && r.resource.uri;
  if (kod !== 201 || !uri) {
    console.log('[kalendar-zapis] Calendly отказал:', kod, JSON.stringify(r).slice(0, 300));
    return otvet(200, Object.assign(NE_VYSHLO(ru), { pochemu: 'calendly_' + kod }));
  }

  console.log('[kalendar-zapis] записано:', uri, pochta, tochno);
  return otvet(200, {
    ok: true, zapisano: true, uri,
    sobytie: r.resource.event,
    start_time: tochno,
    skazat: (ru ? 'Записала на ' : 'Booked for ') + slovami(tochno, poyas, ru)
            + (ru ? '. Приглашение уйдёт на почту.' : '. The invitation goes to that email.'),
  });
};
