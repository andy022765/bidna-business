// Проверка kalendar-sobytiya.js на подставном календаре.
// Живой публичный календарь для этого не годится: в нём нет событий на нужные даты,
// и «ноль событий» не отличить от сломанного фильтра. Здесь даты считаются от сегодня.
// Запуск: node Pivot/golos/proverka/test_kalendar.js

const path = require('path');
const F = path.join(__dirname, '..', 'site', 'netlify-functions', 'kalendar-sobytiya.js');

let vsego = 0, plohih = 0;
function pr(chto, uslovie, pokazat) {
  vsego++;
  if (uslovie) { console.log('  ок   ' + chto); }
  else { plohih++; console.log('  БЕДА ' + chto + (pokazat !== undefined ? ' → ' + JSON.stringify(pokazat) : '')); }
}

const d = (sdvig_dney) => {
  const t = new Date(Date.now() + sdvig_dney * 864e5);
  return t.toISOString().slice(0, 10).replace(/-/g, '');
};

// Нарочно кривой календарь: перенос строки посреди названия, событие на весь день,
// событие с поясом, экранированная запятая, гость, событие далеко за окном и в прошлом.
const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART;TZID=America/New_York:' + d(1) + 'T150000',
  'DTEND;TZID=America/New_York:' + d(1) + 'T153000',
  'SUMMARY:Замер крыши\\, второй этаж',
  'DESCRIPTION:Звонил Пётр\\nтелефон 561',
  'ATTENDEE;CN=Pyotr:mailto:pyotr@example.com',
  'CREATED:' + d(0) + 'T120000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:' + d(2),
  'SUMMARY:Очень длинное название, которое пере',
  ' несено на вторую строку',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:' + d(40) + 'T100000Z',
  'SUMMARY:Далеко за окном',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:' + d(-30) + 'T100000Z',
  'SUMMARY:Прошлое',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

(async () => {
  const nastoyashchiy = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => ICS });
  delete require.cache[require.resolve(F)];
  const f = require(F);

  process.env.KALENDAR_ID = 'proba@group.calendar.google.com';
  const r = await f.handler({});
  const b = JSON.parse(r.body);

  pr('код 200', r.statusCode === 200, r.statusCode);
  pr('ok', b.ok === true);
  pr('в календаре найдены все четыре события', b.vsego_v_kalendare === 4, b.vsego_v_kalendare);
  pr('в окно попали только два', b.sobytiy === 2, b.sobytiya.map(s => s.nazvanie));
  pr('далёкое отсечено', !b.sobytiya.some(s => s.nazvanie === 'Далеко за окном'));
  pr('прошлое отсечено', !b.sobytiya.some(s => s.nazvanie === 'Прошлое'));

  const a = b.sobytiya[0], vtoroe = b.sobytiya[1];
  pr('порядок по времени', a.nachalo < vtoroe.nachalo, [a.nachalo, vtoroe.nachalo]);
  pr('экранированная запятая развёрнута', a.nazvanie === 'Замер крыши, второй этаж', a.nazvanie);
  pr('перенос строки в описании убран', a.opisanie === 'Звонил Пётр телефон 561', a.opisanie);
  pr('гость вытащен', a.gosti[0] === 'pyotr@example.com', a.gosti);
  pr('пояс сохранён', a.poyas === 'America/New_York', a.poyas);
  pr('это НЕ событие на весь день', a.ves_den === false, a.ves_den);
  pr('время создания есть', !!a.sozdano, a.sozdano);
  pr('перенос строки в названии склеен',
     vtoroe.nazvanie === 'Очень длинное название, которое перенесено на вторую строку', vtoroe.nazvanie);
  pr('событие на весь день опознано', vtoroe.ves_den === true, vtoroe.ves_den);
  pr('у события на весь день нет времени', vtoroe.nachalo.length === 8, vtoroe.nachalo);
  pr('метка времени съёма есть', !!b.vzyato);

  // Отказы
  global.fetch = async () => ({ ok: false, status: 404, text: async () => '' });
  const r404 = await f.handler({});
  pr('404 у Google → говорим про галочку',
     /общедоступным/.test(JSON.parse(r404.body).text), JSON.parse(r404.body).text);
  pr('404 не притворяется успехом', JSON.parse(r404.body).ok === false);

  global.fetch = async () => { throw new Error('сеть легла'); };
  const rSet = await f.handler({});
  pr('сеть легла → 502 и причина', rSet.statusCode === 502 &&
     JSON.parse(rSet.body).why === 'ne_dostuchalis');

  delete process.env.KALENDAR_ID;
  const rNet = await f.handler({});
  pr('нет KALENDAR_ID → 503, а не пустой список',
     rNet.statusCode === 503 && JSON.parse(rNet.body).why === 'net_kalendarya');

  global.fetch = nastoyashchiy;
  console.log('\n  проверок ' + vsego + ', провалов ' + plohih);
  process.exit(plohih ? 1 : 0);
})();
