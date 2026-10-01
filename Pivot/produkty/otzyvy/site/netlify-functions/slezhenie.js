// По расписанию раз в 3 часа (netlify.toml): рейтинг и число отзывов карточки, тревога без текста.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const SL = require('../lib/slezhenie');
N.podklyuchit(blobs);

exports.handler = async (event) => {
  H.nachat(event);
  try { return N.json(200, await SL.progon()); }
  catch (e) { console.log('[slezhenie] упал:', (e && e.stack) || e); return N.json(500, { itog: 'oshibka' }); }
};
