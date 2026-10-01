'use strict';
// Карта «номер → линия → клиент» (linii.json) и настройки клиентов (nastroyki.json). Секретов нет:
// секрет линии — переменная окружения, имя которой записано в линии (klyuch_env).
//
// КАК ФУНКЦИЯ УЗНАЁТ ЛИНИЮ. В теле инструмента клиента нет (KONTRAKT.md): модель его не заполняет,
// а один стенд обслуживает много клиентов — ошибка маршрута = запись в чужой календарь.
// Поэтому линию определяет СЕКРЕТ в заголовке x-liniya-klyuch: у каждой линии свой, агент
// шлёт его постоянным заголовком инструмента. Если в теле есть системные поля
// (nomer_linii = system__called_number, agent_id = system__agent_id), они сужают выбор и обязаны
// совпасть с линией секрета — иначе отказ.
// Файлы подключаются через require: esbuild кладёт их в бандл, чтение с диска на стенде не нужно.

const { klyuchLiniiVeren } = require('./podpisi');

let LINII = require('../linii.json');
let NASTROYKI = require('../nastroyki.json');

// Для тестов: подменить карту и настройки (null — вернуть файлы).
function ustanovit({ linii, nastroyki } = {}) {
  LINII = linii || require('../linii.json');
  NASTROYKI = nastroyki || require('../nastroyki.json');
}

// E.164 для США по умолчанию: «(718) 555-0123» → +17185550123. Не номер — null.
function e164(s) {
  const syroe = String(s ?? '').trim();
  if (!syroe) return null;
  if (/^(client|sip):/i.test(syroe)) return null;
  const plus = syroe.startsWith('+');
  const cifry = syroe.replace(/\D+/g, '');
  if (!cifry) return null;
  if (plus) return cifry.length >= 8 && cifry.length <= 15 ? '+' + cifry : null;
  if (cifry.length === 10) return '+1' + cifry;
  if (cifry.length === 11 && cifry.startsWith('1')) return '+' + cifry;
  return null;
}

function sKlyuchom(klyuch) {
  const l = LINII[klyuch];
  return l ? Object.assign({ klyuch }, l) : null;
}
function vseLinii() { return Object.keys(LINII).map(sKlyuchom); }
function liniya(klyuch) { return sKlyuchom(klyuch); }

function poNomeru(nomer) {
  if (LINII[nomer]) return sKlyuchom(nomer);
  const n = e164(nomer);
  return n && LINII[n] ? sKlyuchom(n) : null;
}
function poAgentu(agentId) {
  if (!agentId) return null;
  return vseLinii().find((l) => l.agent_id && l.agent_id === agentId) || null;
}

// Номер линии: ключ, если это номер, или поле nomer (линия без своего номера живёт на номере другой линии
// того же клиента — так у линии сиделок CareLine DEMO: переход transfer_to_agent с линии найма).
function nomerLinii(l) { return (l && (e164(l.klyuch) || e164(l.nomer))) || null; }

function imyaEnvKlyucha(l) {
  if (l.klyuch_env) return l.klyuch_env;
  return 'LINIYA_KLYUCH_' + String(l.klyuch).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}
function sekretLinii(l) { return process.env[imyaEnvKlyucha(l)] || ''; }

function klient(id) {
  const k = NASTROYKI[id];
  return k ? Object.assign({ id }, k) : null;
}
function vseKlienty() { return Object.keys(NASTROYKI).map(klient); }

function imyaEnvPulta(k) { return k.pult_klyuch_env || 'PULT_KLYUCH_' + String(k.id).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase(); }
function klyuchPulta(k) { return process.env[imyaEnvPulta(k)] || ''; }

function zagolovok(headers, imya) {
  const h = headers || {};
  const k = Object.keys(h).find((x) => x.toLowerCase() === imya.toLowerCase());
  return k ? String(h[k]) : '';
}

// Линия инструмента: {ok:true, liniya, klient} или {ok:false, pochemu}.
// predpochtenie — тип линии, которой принадлежит функция (okna/zapis/kandidat/semya — care-hiring,
// otkaz — care-caregivers): при общем секрете двух линий клиента линию определяет функция (KONTRAKT.md, «Дополнения care»).
function opredelitLiniyu(headers, telo, { predpochtenie = null } = {}) {
  const prislan = zagolovok(headers, 'x-liniya-klyuch');
  if (!prislan) return { ok: false, pochemu: 'нет x-liniya-klyuch' };
  const b = telo || {};
  let kandidaty = vseLinii();
  const nomer = b.nomer_linii || b.called_number;
  if (nomer && !/^\{\{.*\}\}$/.test(String(nomer))) {
    const l = poNomeru(nomer);
    if (l) kandidaty = kandidaty.filter((x) => x.klyuch === l.klyuch);
  }
  const agent = b.agent_id;
  if (agent && !/^\{\{.*\}\}$/.test(String(agent))) {
    const s = kandidaty.filter((x) => x.agent_id && x.agent_id === agent);
    if (s.length) kandidaty = s;
  }
  const podhodyat = kandidaty.filter((l) => klyuchLiniiVeren(prislan, sekretLinii(l)));
  if (!podhodyat.length) return { ok: false, pochemu: 'секрет не подходит ни к одной линии' };
  // Один секрет на несколько линий ОДНОГО клиента терпим (у инструментов DEMO общий secret_id): клиент однозначен,
  // берём первую линию по порядку linii.json. Один секрет у разных клиентов — отказ: это ошибка маршрута.
  const klienty = [...new Set(podhodyat.map((l) => l.klient))];
  if (klienty.length > 1) return { ok: false, pochemu: 'секрет подходит к линиям разных клиентов' };
  const poFunkcii = predpochtenie ? podhodyat.filter((x) => x.liniya === predpochtenie) : [];
  const l = podhodyat.length === 1 ? podhodyat[0]
    : poFunkcii.length === 1 ? poFunkcii[0]
    : Object.assign({}, podhodyat[0], { neodnoznachno: true, linii_klyuchi: podhodyat.map((x) => x.klyuch) });
  const k = klient(l.klient);
  if (!k) return { ok: false, pochemu: 'у линии нет настроек клиента ' + l.klient };
  return { ok: true, liniya: l, klient: k };
}

module.exports = {
  ustanovit, e164, vseLinii, liniya, poNomeru, poAgentu, nomerLinii, imyaEnvKlyucha, sekretLinii,
  klient, vseKlienty, imyaEnvPulta, klyuchPulta, zagolovok, opredelitLiniyu,
};
