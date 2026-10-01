'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const P = require('./stend-pomoshch');
P.sreda();
const podpisi = require('../lib/podpisi');

test('Twilio: подпись = HMAC-SHA1(URL + имя+значение по алфавиту), base64', () => {
  const url = 'https://stend.example/.netlify/functions/sms-vhod';
  const polya = new URLSearchParams({ To: '+17185550102', From: '+17185550111', Body: 'YES 12' });
  const vruchnuyu = crypto.createHmac('sha1', 'tok').update(url + 'BodyYES 12From+17185550111To+17185550102').digest('base64');
  assert.equal(podpisi.podpisTwilio(url, polya, 'tok'), vruchnuyu);
  // порядок полей в теле не влияет
  const inache = new URLSearchParams({ Body: 'YES 12', To: '+17185550102', From: '+17185550111' });
  assert.equal(podpisi.podpisTwilio(url, inache, 'tok'), vruchnuyu);
});

test('Twilio: повторяющееся поле — все значения по алфавиту', () => {
  const url = 'https://x.example/f';
  const polya = new URLSearchParams([['A', '2'], ['A', '1'], ['B', 'x']]);
  const vruchnuyu = crypto.createHmac('sha1', 't').update(url + 'A1A2Bx').digest('base64');
  assert.equal(podpisi.podpisTwilio(url, polya, 't'), vruchnuyu);
});

test('Twilio: верная подпись проходит, чужой токен, правка тела и отсутствие заголовка — нет', () => {
  const e = P.twilio('sms-vhod', { To: P.NOMER_SIDELKI, From: '+17185550111', Body: 'YES' });
  assert.equal(podpisi.twilioPodpisVerna(e), true);
  assert.equal(podpisi.twilioPodpisVerna(P.twilio('sms-vhod', { Body: 'YES' }, { token: 'chuzhoy' })), false);
  const podmena = Object.assign({}, e, { body: e.body.replace('YES', 'NO') });
  assert.equal(podpisi.twilioPodpisVerna(podmena), false);
  assert.equal(podpisi.twilioPodpisVerna(P.twilio('sms-vhod', { Body: 'YES' }, { bezPodpisi: true })), false);
  assert.equal(podpisi.twilioPodpisVerna(e, ''), false, 'без токена — всегда отказ');
});

test('Twilio: адрес собирается и без rawUrl (host + путь + строка запроса)', () => {
  const e = P.twilio('perevod', { Digits: '1' }, { query: 'shag=prinyat&p=CA1' });
  delete e.rawUrl;
  e.rawQuery = 'shag=prinyat&p=CA1';
  assert.equal(podpisi.twilioPodpisVerna(e), true);
});

test('ElevenLabs HMAC: верная, протухшая, чужой секрет, кривой заголовок', () => {
  const raw = JSON.stringify({ type: 'post_call_transcription', data: { conversation_id: 'conv_test123456' } });
  const t = Math.floor(Date.now() / 1000);
  const zag = podpisi.elevenlabsZagolovok(raw, 's3kret', t);
  assert.equal(podpisi.elevenlabsPodpisVerna(raw, zag, 's3kret').ok, true);
  assert.equal(podpisi.elevenlabsPodpisVerna(raw + ' ', zag, 's3kret').ok, false);
  assert.equal(podpisi.elevenlabsPodpisVerna(raw, zag, 'drugoy').ok, false);
  const staraya = podpisi.elevenlabsZagolovok(raw, 's3kret', t - 3600);
  assert.equal(podpisi.elevenlabsPodpisVerna(raw, staraya, 's3kret').pochemu, 'подпись протухла');
  assert.equal(podpisi.elevenlabsPodpisVerna(raw, 'erunda', 's3kret').ok, false);
  assert.equal(podpisi.elevenlabsPodpisVerna(raw, zag, '').ok, false);
});

test('x-liniya-klyuch: сравнение и отказ от короткого (ненастроенного) секрета', () => {
  assert.equal(podpisi.klyuchLiniiVeren('a'.repeat(32), 'a'.repeat(32)), true);
  assert.equal(podpisi.klyuchLiniiVeren('a'.repeat(32), 'b'.repeat(32)), false);
  assert.equal(podpisi.klyuchLiniiVeren('short', 'short'), false);
  assert.equal(podpisi.klyuchLiniiVeren('', ''), false);
});

test('метка обратного вызова: своя проходит, чужая и кривая — нет', () => {
  const m = podpisi.metka('sekret', 'perevod:CA1:0');
  assert.match(m, /^[0-9a-f]{32}$/);
  assert.equal(podpisi.metkaVerna('sekret', 'perevod:CA1:0', m), true);
  assert.equal(podpisi.metkaVerna('sekret', 'perevod:CA1:1', m), false);
  assert.equal(podpisi.metkaVerna('drugoy', 'perevod:CA1:0', m), false);
  assert.equal(podpisi.metkaVerna('sekret', 'perevod:CA1:0', 'яяяя'), false);
});
