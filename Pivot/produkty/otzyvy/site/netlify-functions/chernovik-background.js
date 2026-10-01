// Фоновая: черновик ответа (Claude) и тревога владельцу по вставленному отзыву. Зовёт otzyv.js.
// Закрыта ключом администратора: иначе любой мог бы жечь лимит Claude и слать письма владельцу.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const T = require('../lib/trevoga');
N.podklyuchit(blobs);

exports.handler = async (event) => {
  H.nachat(event);
  if (!N.admin(event)) { console.log('[chernovik] чужой вызов'); return N.json(401, { itog: 'admin' }); }
  let d = {};
  try { d = JSON.parse(event.body || '{}'); } catch (_) { return N.json(400, { itog: 'json' }); }
  const k = K.vzyat(String(d.klient || ''));
  if (!k || K.proverit(k).length) return N.json(404, { itog: 'klient' });
  try { return N.json(200, await T.obrabotat(H.store('otzyvy'), k, String(d.id || ''))); }
  catch (e) { console.log('[chernovik] упал:', (e && e.stack) || e); return N.json(500, { itog: 'oshibka' }); }
};
