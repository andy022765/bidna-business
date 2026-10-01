// По расписанию раз в сутки (netlify.toml): отчёт 1-го числа, неявки по понедельникам, чистка по срокам.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const EZ = require('../lib/ezhednevno');
N.podklyuchit(blobs);

exports.handler = async (event) => {
  H.nachat(event);
  try { return N.json(200, await EZ.progon()); }
  catch (e) { console.log('[ezhednevno] упал:', (e && e.stack) || e); return N.json(500, { itog: 'oshibka' }); }
};
