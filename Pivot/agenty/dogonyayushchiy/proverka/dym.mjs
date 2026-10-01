// Дымовой прогон ядра Доводчика без сети: тестовое хранилище, фейковый Telegram, заглушка модели.
// Запуск: node "Pivot/agenty/dogonyayushchiy/proverka/dym.mjs"
//
// Сценарий:
//   1) business_connection (включено, can_reply)
//   2) сообщение с кодом, перепечатанным кириллицей строчными с пробелом («к7м 3х»)
//   2б) эхо ответа Веры БЕЗ sender_business_bot — должно узнаться по хэшу, паузы нет (скептик №4)
//   3) исходящее владельца → пауза 24 ч, сигнал ВМЕШАЛСЯ ВЛАДЕЛЕЦ, ответа нет
//   4) клиент пишет в паузе → тишина, сигнал КЛИЕНТ ПИШЕТ В ПАУЗЕ
//   5) повтор update_id из шага 2 → ничего

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const zdes = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(zdes, '../../../golos/site');

// ---------- тестовые хуки ----------
const dannye = new Map();
global.__DOGON_TEST_STORE__ = {
  async get(key, opts = {}) {
    if (!dannye.has(key)) return null;
    const v = dannye.get(key);
    if (opts.type === 'json') { try { return JSON.parse(v); } catch { return null; } }
    return v;
  },
  async set(key, val) { dannye.set(key, String(val)); },
  async setJSON(key, val) { dannye.set(key, JSON.stringify(val)); },
  async delete(key) { dannye.delete(key); },
  async list({ prefix = '' } = {}) { return { blobs: [...dannye.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
};
const FAKE = [];
global.__DOGON_FAKE_TG__ = FAKE;
const NOW = Date.UTC(2026, 8, 15, 18, 20, 0);   // 14:20 в Нью-Йорке
global.__DOGON_NOW__ = NOW;
global.__DOGON_BYSTRO__ = true;
global.__DOGON_MESTA__ = 7;

const vyzovyModeli = [];
global.__DOGON_STUB_MODEL__ = async (messages, system) => {
  vyzovyModeli.push({ messages, system });
  return {
    tekst: 'По телефону вы спрашивали про Дежурного для салона. Что осталось непонятным?',
    ssylka: 'net', segment: 'biznes', tema: 'dezhurny', signal: 'net',
    dlya_vladelcev: 'Салон, спрашивала про Дежурного', ne_otvetila: '',
  };
};

const SECRET = 'test_secret_0123456789abcdefghijklmnop';
Object.assign(process.env, {
  TG_WEBHOOK_SECRET: SECRET,
  DOGON_GRUPPA: '-1001234567890',
  DOGON_ADMINY: '111,222',
  DOGON_REZHIM: 'kod',
  DOGON_PAUZA_CHASOV: '24',
});
delete process.env.TG_BOT_TOKEN;
delete process.env.ANTHROPIC_API_KEY_DOGON;

const { handler } = require(path.join(SITE, 'netlify-functions/tg-vhod-background.js'));

// ---------- данные звонка и кода, как их положат pismo.js и zvonok.js ----------
const KOD = 'K7M3X', CONV = 'conv_test123456';
dannye.set(`kod/${KOD}`, JSON.stringify({
  kod: KOD, razgovor: CONV, istochnik: 'vera', email: 'irina.nails@gmail.com', imya: 'Ирина',
  segment: 'biznes', shag: 'razbor', t: NOW - 3600_000, chaty: [], suhoy: false,
}));
dannye.set(`zvonok/${CONV}`, JSON.stringify({
  conv: CONV, agent_id: 'agent_x', istochnik: 'telefon', t: NOW - 3700_000, dlit: 360,
  sobrano: { imya: 'Ирина', telefon: '+1 305 555 0199', pochta: 'irina.nails@gmail.com',
             zachem: 'Дежурный для салона', biznes: 'салон ногтей в Майами', obeshchali: 'письмо со списком работ',
             hvost: 'когда можно запустить' },
  itog: 'Звонила про Дежурного, вечером пропускают звонки. Почта irina.nails@gmail.com',
  dialog: [{ kto: 'user', text: 'моя почта irina.nails@gmail.com, телефон 305 555 0199' }],
  nomer: '+13055550199', kod: KOD,
}));

const BC = 'bc_test_1', VLADELEC = 777, KLIENT = 555;
const chatKlienta = { id: KLIENT, type: 'private', first_name: 'Ирина', username: 'irina_nails' };
const vyzov = (upd) => handler({ httpMethod: 'POST', headers: { 'x-telegram-bot-api-secret-token': SECRET }, body: JSON.stringify(upd) });
const metaKlienta = () => JSON.parse(dannye.get(`chat/${BC}/${KLIENT}/meta`) || 'null');
const srez = (from) => FAKE.slice(from).map(c => ({ method: c.method, chat_id: c.body.chat_id, text: c.body.text && c.body.text.split('\n')[0].slice(0, 90) }));

function shag(nazvanie, from) {
  console.log(`\n=== ${nazvanie}`);
  for (const c of srez(from)) console.log(`  TG ${c.method} → ${c.chat_id}${c.text ? `: ${c.text}` : ''}`);
}

// 1) подключение
let n = FAKE.length;
await vyzov({ update_id: 1001, business_connection: {
  id: BC, user: { id: VLADELEC, first_name: 'BIDNA', username: 'business_int_dna' }, user_chat_id: VLADELEC,
  date: NOW / 1000, rights: { can_reply: true }, is_enabled: true } });
shag('1) business_connection', n);
const sv = JSON.parse(dannye.get(`svyaz/${BC}`));
assert.equal(sv.user_id, VLADELEC);
assert.equal(sv.rights.can_reply, true);
assert.ok(FAKE.slice(n).some(c => c.method === 'sendMessage' && c.body.chat_id === process.env.DOGON_GRUPPA && /ПОДКЛЮЧЕНИЕ/.test(c.body.text)), 'сигнал ПОДКЛЮЧЕНИЕ в группу');

// 2) сообщение с кодом кириллицей
n = FAKE.length;
const upd2 = { update_id: 1002, business_message: {
  message_id: 10, business_connection_id: BC, from: { id: KLIENT, first_name: 'Ирина', username: 'irina_nails', language_code: 'ru' },
  chat: chatKlienta, date: NOW / 1000, text: 'Здравствуйте! Пишу после разговора с Верой. Код к7м 3х' } };
await vyzov(upd2);
shag('2) сообщение с кодом «к7м 3х»', n);
let meta = metaKlienta();
assert.equal(meta.kod, KOD, 'код привязан');
assert.equal(meta.status, 'aktivnyy');
assert.equal(meta.soglasie.sposob, 'pismo');
assert.equal(meta.predstavilas, true);
const otvetVery = FAKE.slice(n).find(c => c.method === 'sendMessage' && c.body.business_connection_id === BC);
assert.ok(otvetVery, 'Вера ответила в бизнес-чат');
assert.ok(otvetVery.body.text.startsWith('Это Вера, виртуальный ассистент Business Intelligence DNA.'), 'строка раскрытия от сервера');
assert.ok(!otvetVery.body.parse_mode, 'без parse_mode');
assert.ok(FAKE.slice(n).some(c => c.body.chat_id === process.env.DOGON_GRUPPA && /НОВЫЙ ЧАТ/.test(c.body.text || '')), 'сигнал НОВЫЙ ЧАТ');
const kartochka = FAKE.slice(n).find(c => /НОВЫЙ ЧАТ/.test(c.body.text || '')).body.text;
assert.ok(!/irina\.nails@|305 555|\+1305/.test(kartochka), 'в карточке группы нет почты и телефона');
assert.equal(vyzovyModeli.length, 1, 'модель вызвана один раз');
const vsyoVModel = vyzovyModeli[0].system + JSON.stringify(vyzovyModeli[0].messages);
assert.ok(/Дежурный для салона/.test(vsyoVModel), 'в контексте тема звонка');
assert.ok(!/irina\.nails|305 555|0199|моя почта/.test(vsyoVModel), 'в модель не ушли почта, телефон и реплики звонка');
assert.ok(dannye.has(`chat/${BC}/${KLIENT}/m/000000000010`), 'сообщение клиента в истории');
assert.equal(JSON.parse(dannye.get(`kod/${KOD}`)).chaty.length, 1, 'чат записан в kod/*');
assert.equal(JSON.parse(dannye.get(`upd/2026-09-15/1002`)).s, 'gotovo', 'дедуп: gotovo');

// 2б) эхо ответа Веры без sender_business_bot — узнаём по хэшу текста
n = FAKE.length;
global.__DOGON_NOW__ = NOW + 2000;
await vyzov({ update_id: 1003, business_message: {
  message_id: 11, business_connection_id: BC, from: { id: VLADELEC, first_name: 'BIDNA' },
  chat: chatKlienta, date: NOW / 1000 + 2, text: otvetVery.body.text } });
shag('2б) эхо ответа Веры без sender_business_bot', n);
meta = metaKlienta();
assert.equal(meta.pauza_do, null, 'эхо не поставило паузу');
assert.equal(FAKE.length, n, 'на эхо ничего не отправлено');
assert.equal(JSON.parse(dannye.get(`chat/${BC}/${KLIENT}/m/000000000011`)).kto, 'vera', 'эхо записано как Вера');

// 3) исходящее владельца
n = FAKE.length;
global.__DOGON_NOW__ = NOW + 60_000;
await vyzov({ update_id: 1004, business_message: {
  message_id: 12, business_connection_id: BC, from: { id: VLADELEC, first_name: 'BIDNA', username: 'business_int_dna' },
  chat: chatKlienta, date: NOW / 1000 + 60, text: 'Это Андрей, подключаюсь.' } });
shag('3) исходящее владельца', n);
meta = metaKlienta();
assert.equal(meta.pauza_do, NOW + 60_000 + 24 * 3600_000, 'пауза 24 ч');
assert.equal(meta.pauza_prichina, 'vladelec');
assert.equal(meta.nuzhno_snova_predstavitsya, true);
assert.ok(!FAKE.slice(n).some(c => c.body.business_connection_id), 'Вера не отвечала');
assert.ok(FAKE.slice(n).some(c => /ВМЕШАЛСЯ ВЛАДЕЛЕЦ/.test(c.body.text || '')), 'сигнал ВМЕШАЛСЯ ВЛАДЕЛЕЦ');
assert.equal(JSON.parse(dannye.get(`chat/${BC}/${KLIENT}/m/000000000012`)).kto, 'vladelec');

// 4) клиент пишет в паузе
n = FAKE.length;
global.__DOGON_NOW__ = NOW + 120_000;
await vyzov({ update_id: 1005, business_message: {
  message_id: 13, business_connection_id: BC, from: { id: KLIENT, first_name: 'Ирина', username: 'irina_nails' },
  chat: chatKlienta, date: NOW / 1000 + 120, text: 'Андрей, а когда можно запустить?' } });
shag('4) клиент пишет в паузе', n);
assert.ok(!FAKE.slice(n).some(c => c.body.business_connection_id && c.method === 'sendMessage'), 'Вера молчит в паузе');
assert.ok(FAKE.slice(n).some(c => /КЛИЕНТ ПИШЕТ В ПАУЗЕ/.test(c.body.text || '')), 'сигнал КЛИЕНТ ПИШЕТ В ПАУЗЕ');
assert.equal(vyzovyModeli.length, 1, 'модель не вызывалась');

// 5) повтор апдейта из шага 2
n = FAKE.length;
await vyzov(upd2);
shag('5) повтор update_id 1002', n);
assert.equal(FAKE.length, n, 'повтор ничего не делает');

console.log('\n=== meta после прогона');
const { signal_t, ...kratko } = metaKlienta();
console.log(JSON.stringify({ ...kratko, signal_t: Object.keys(signal_t) }, null, 2));
console.log('\nВСЕГО вызовов фейкового Telegram:', FAKE.length, '· вызовов модели:', vyzovyModeli.length);
console.log('ДЫМ ПРОШЁЛ');
