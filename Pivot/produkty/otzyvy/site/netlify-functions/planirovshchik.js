// По расписанию раз в час (netlify.toml): просьбы и напоминания. Логика — lib/planirovshchik.js.
// Вызвать руками нельзя: у функций по расписанию нет адреса. Для обкатки — netlify-functions/zapusk.js.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const PL = require('../lib/planirovshchik');
N.podklyuchit(blobs);

exports.handler = async (event) => {
  H.nachat(event);
  try { return N.json(200, await PL.progon()); }
  catch (e) { console.log('[planirovshchik] упал:', (e && e.stack) || e); return N.json(500, { itog: 'oshibka' }); }
};
