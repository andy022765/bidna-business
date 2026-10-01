'use strict';
// Срок хранения итогов звонков (проверка 30.09: «расшифровки хранятся бессрочно»). Раз в сутки — из функции svodka
// по расписанию, замок chistka/<дата> — удаляет из хранилища клиента записи старше nastroyki.hranenie.zvonki_dney
// (по умолчанию 30 дней):
//   zvonki/<conv>            итог звонка: kratko, сообщение координатору, имя, телефон (дата — poluchen, иначе nachalo);
//   zvonki-itog/<conv>       замок обработки вебхука итога ({at} в мс);
//   razgovory/<conv>         что сделано в разговоре ({sozdano});
//   zvonki-vhod/<дата>/<sid> замок повтора вебхука Twilio (дата в ключе, без чтения);
//   chistka/<дата>           свои замки прошлых чисток.
// Карточки кандидатов и семей, смены, отказы, согласия и журнал не трогаем: у них свой смысл и свой срок
// (решение Андрея). Запись без понятной даты не удаляем: лучше храним лишнее, чем сотрём свежее.
// Расшифровки у ElevenLabs живут по своему сроку — platform_settings.privacy.retention_days агентов
// (care/sborka_agentov.py, тот же срок 30 дней).

const { seychas, iso, denKlyuch, POYAS } = require('./vremya');
const { zapisat } = require('./zhurnal');

const DEN_MS = 864e5;
const DATA_V_KLYUCHE = /^\d{4}-\d{2}-\d{2}$/;

function srokDney(klient) {
  const n = Number(klient && klient.hranenie && klient.hranenie.zvonki_dney);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30;
}

// Момент записи в мс или null (непонятная дата — не трогаем).
function momentZapisi(prefiks, data) {
  if (!data || typeof data !== 'object') return null;
  let t = NaN;
  if (prefiks === 'zvonki/') t = Date.parse(data.poluchen || data.nachalo || '');
  else if (prefiks === 'zvonki-itog/') t = Number(data.at);
  else if (prefiks === 'razgovory/') t = Date.parse(data.sozdano || '');
  return Number.isFinite(t) && t > 0 ? t : null;
}

async function pochistit(st, klient, { teper = seychas() } = {}) {
  const poyas = (klient && klient.poyas) || POYAS;
  const dney = srokDney(klient);
  const granica = teper - dney * DEN_MS;
  const granicaDen = denKlyuch(granica, poyas);
  const udaleno = {};
  const udalit = async (vid, key) => { await st.delete(key); udaleno[vid] = (udaleno[vid] || 0) + 1; };

  for (const prefiks of ['zvonki/', 'zvonki-itog/', 'razgovory/']) {
    for (const { key, data } of await st.vse(prefiks)) {
      const t = momentZapisi(prefiks, data);
      if (t !== null && t < granica) await udalit(prefiks.slice(0, -1), key);
    }
  }
  for (const prefiks of ['zvonki-vhod/', 'chistka/']) {
    for (const key of await st.list(prefiks)) {
      const den = key.split('/')[1] || '';
      if (DATA_V_KLYUCHE.test(den) && den < granicaDen) await udalit(prefiks.slice(0, -1), key);
    }
  }
  const vsego = Object.values(udaleno).reduce((a, b) => a + b, 0);
  await zapisat(st, { kto: 'chistka', chto: 'chistka', obekt: null,
                      detali: { dney, starshe: iso(granica, poyas), udaleno } }, { poyas });
  return { dney, udaleno, vsego };
}

// Раз в сутки на клиента: замок chistka/<дата>. Второй запуск того же дня — {propushcheno:'uzhe'}.
async function chistkaZaDen(st, klient, { teper = seychas() } = {}) {
  const poyas = (klient && klient.poyas) || POYAS;
  const den = denKlyuch(teper, poyas);
  if (!(await st.zanyat(`chistka/${den}`, { at: iso(teper, poyas) }))) return { propushcheno: 'uzhe', den };
  try {
    return Object.assign({ den }, await pochistit(st, klient, { teper }));
  } catch (e) {
    try { await st.delete(`chistka/${den}`); } catch (_) { /* следующий запуск расписания повторит */ }
    throw e;
  }
}

module.exports = { pochistit, chistkaZaDen, srokDney };
