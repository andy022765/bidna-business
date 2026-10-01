// Сколько минут и звонков израсходовано. Смотреть глазами, чтобы не узнавать
// о конце лимита от посетителя. Закрыто тем же ключом, что и звонки без квоты.
//
// https://dezhurny-r4p8w2.netlify.app/.netlify/functions/sostoyanie?k=<ключ>

const { getStore } = require('@netlify/blobs');

const LIMIT_MINUT      = +(process.env.GOLOS_LIMIT_MINUT  || 200);
const LIMIT_MESYAC     = +(process.env.GOLOS_LIMIT_MESYAC || 10);
const LIMIT_DEN        = +(process.env.GOLOS_LIMIT_DEN    || 6);
const TARIF_MINUT      = +(process.env.GOLOS_TARIF_MINUT  || 275);   // что реально куплено

// Сколько минут СЪЕДЕНО У ВЕНДОРА на самом деле. Наш счётчик в Blobs считает только
// браузерное демо: телефонные звонки и прогоны по ключу мимо него. 27.09.2026 это дало
// расхождение в разы — страница бодро писала «осталось 525 из 525», когда у вендора
// за месяц было съедено 766 минут. Цифра, которой нельзя верить, хуже отсутствующей:
// именно по ней собирались запускать платную рекламу на звонки.
async function minutyUVendora(mes) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  let sek = 0, kursor = null;
  try {
    for (let i = 0; i < 8; i++) {          // потолок страниц: страница не должна висеть
      const u = 'https://api.elevenlabs.io/v1/convai/conversations?page_size=100'
              + (kursor ? '&cursor=' + encodeURIComponent(kursor) : '');
      const r = await fetch(u, { headers: { 'xi-api-key': key } });
      if (!r.ok) { console.log('[sostoyanie] вендор не отдал журнал:', r.status); return null; }
      const d = await r.json();
      for (const c of d.conversations || []) {
        const den = new Date((c.start_time_unix_secs || 0) * 1000).toISOString().slice(0, 7);
        if (den === mes) sek += c.call_duration_secs || 0;
      }
      kursor = d.next_cursor;
      if (!d.has_more || !kursor) break;
    }
  } catch (e) { console.log('[sostoyanie] журнал вендора недоступен:', e.message); return null; }
  return sek / 60;
}

const den    = () => new Date().toISOString().slice(0, 10);
const mesyac = () => new Date().toISOString().slice(0, 7);

function hranilishche() {
  const name = 'golos-kvota', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

const polosa = (dolya, shirina = 28) => {
  const n = Math.max(0, Math.min(shirina, Math.round(dolya * shirina)));
  return '█'.repeat(n) + '·'.repeat(shirina - n);
};

exports.handler = async (event) => {
  const nash = process.env.GOLOS_NASH_KLYUCH;
  if (!nash || (event.queryStringParameters || {}).k !== nash)
    return { statusCode: 401, body: 'нет' };

  const store = hranilishche();
  if (!store) return { statusCode: 503, body: 'хранилище недоступно' };

  const [min, mes, dn] = (await Promise.all([
    store.get(`${mesyac()}:__minut`),
    store.get(`${mesyac()}:__mesyac`),
    store.get(`${den()}:__den`),
  ])).map(v => parseFloat(v || '0'));

  const ostalos = Math.max(0, LIMIT_MINUT - min);
  const dolya = LIMIT_MINUT ? min / LIMIT_MINUT : 0;

  // Остаток тарифа считаем от РЕАЛЬНОГО расхода у вендора, а не от своего счётчика.
  const uVendora = await minutyUVendora(mesyac());
  const zapas = uVendora === null ? null : TARIF_MINUT - uVendora;

  const trevoga = dolya >= 0.8 ? '  ⚠ ЛИМИТ НА ИСХОДЕ' : '';

  const t = [
    `ДЕЖУРНЫЙ · состояние на ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    ``,
    `БРАУЗЕРНОЕ ДЕМО ЗА МЕСЯЦ (${mesyac()})${trevoga}`,
    `  ${polosa(dolya)}  ${min.toFixed(1)} из ${LIMIT_MINUT}`,
    `  осталось демо:        ${ostalos.toFixed(1)} мин  (~${Math.floor(ostalos / 3)} демо по три минуты)`,
    ``,
    `ВСЕ МИНУТЫ У ВЕНДОРА ЗА МЕСЯЦ — демо, телефон и наши прогоны вместе`,
    uVendora === null
      ? `  журнал ElevenLabs сейчас не читается — остаток тарифа НЕИЗВЕСТЕН`
      : `  израсходовано: ${uVendora.toFixed(1)} мин` + (
          zapas >= 0
            ? `\n  осталось на тарифе:   ${zapas.toFixed(1)} мин из ${TARIF_MINUT}`
            : `\n  ⚠ ПЕРЕРАСХОД: ${Math.abs(zapas).toFixed(1)} мин сверх тарифа ${TARIF_MINUT}`),
    ``,
    `ЗВОНКИ`,
    `  за месяц: ${mes} из ${LIMIT_MESYAC}`,
    `  за сутки: ${dn} из ${LIMIT_DEN}`,
    ``,
    `Счётчики звонков и демо считают только браузер. Телефон и прогоны по ключу видны`,
    `лишь в строке «все минуты у вендора» — по ней и судим об остатке тарифа.`,
    `Сам тариф наш ключ прочитать не может (нет права user_read): число ${TARIF_MINUT}`,
    `взято из переменной GOLOS_TARIF_MINUT и верно ровно настолько, насколько её обновляли.`,
  ].join('\n');

  return { statusCode: 200,
           headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
           body: t };
};
