'use strict';
// Общее для pult, evv и svodka: клиент по ключу пульта и записи клиента для снимка (lib/shablony/snimok.js).

const linii = require('./linii');
const { ravny } = require('./podpisi');

// Клиент, чей ключ пульта совпал (PULT_KLYUCH_<KLIENT> или pult_klyuch_env). Короткий ключ = не настроен.
function klientPoKlyuchuPulta(k) {
  const prislan = String(k || '');
  if (prislan.length < 16) return null;
  for (const kl of linii.vseKlienty()) {
    const nado = linii.klyuchPulta(kl);
    if (nado && nado.length >= 16 && ravny(prislan, nado)) return kl;
  }
  return null;
}

function klyuchIzZaprosa(event) {
  const q = event.queryStringParameters || {};
  return q.k || linii.zagolovok(event.headers || {}, 'x-pult-klyuch') || '';
}

const KOLLEKCII = ['kandidaty', 'sidelki', 'klienty', 'smeny', 'otkazy', 'evv', 'zvonki', 'soglasiya', 'semi'];

// Записи хранилища k-<klient> по модели KONTRAKT.md — вход sobratSnimok({zapisi}).
async function zapisiKlienta(st) {
  const out = {};
  await Promise.all(KOLLEKCII.map(async (k) => { out[k] = (await st.vse(k + '/')).map((x) => x.data); }));
  return out;
}

module.exports = { klientPoKlyuchuPulta, klyuchIzZaprosa, zapisiKlienta, KOLLEKCII };
