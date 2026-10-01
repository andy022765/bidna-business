// Доводчик: обход по расписанию. netlify.toml: [functions."tg-dogon"] schedule = "*/10 * * * *".
// Ревью 15.09 №12 и скептик №5, №7, №9 — что именно делает, подробно в ../dogon-lib/obkhod.js:
//   - «ГОРЯЧИЙ / ЖДЁТ ЧЕЛОВЕКА БЕЗ ОТВЕТА» через 30 минут после передачи чата людям;
//   - «НЕ ОТВЕТИЛИ» через 3 минуты, если входящее осталось без ответа Веры;
//   - раз в сутки чистка Blobs 'dogon' по срокам (12 месяцев некупившим, privacy раздел 11).
//
// Касаний и писем после суток здесь НЕТ (DOGON_DOGONYAT=0, решение 15.09): клиенту обход не пишет ничего.
//
// Запланированную функцию по URL на проде не вызвать — ручной запуск той же логики: tg-nastroyka ?d=obkhod.
// Лимит запланированной функции у Netlify — 30 с, обход берёт себе 20.
// [не проверено] расписание при деплое готовой папкой через CLI: после выкладки смотреть в логах строку
// «[tg-dogon] итог» раз в 10 минут (SPEC §8).
//
// env: DOGON_GRUPPA, TG_BOT_TOKEN, DOGON_HRANIT_DNEY, DOGON_HRANIT_DNEY_KLIENTAM, EV_BLOBS_TOKEN, SITE_ID.

const { getStore } = require('@netlify/blobs');
const H = require('../dogon-lib/hranilishche');
H.podklyuchitBlobs(getStore);
const tg = require('../dogon-lib/tg');
const S = require('../dogon-lib/signaly');
const { seychas } = require('../dogon-lib/meta');
const { obkhod } = require('../dogon-lib/obkhod');

exports.handler = async () => {
  // Пока бот не подключён (нет токена) — тихо выходим, чтобы расписание не сыпало ошибками каждые 10 минут.
  if (!process.env.TG_BOT_TOKEN) return { statusCode: 200, body: 'бот не подключён' };
  try {
    const store = H.hranilishche();
    if (!store) throw new Error('хранилище Blobs не поднялось (EV_BLOBS_TOKEN/SITE_ID?)');
    const itog = await obkhod({ store, byudzhetMs: 20000 });
    console.log('[tg-dogon] итог', JSON.stringify(itog));
  } catch (e) {
    console.log('[tg-dogon] упало:', tg.chisto((e && e.stack) || e));
    // Не чаще раза в час: расписание каждые 10 минут, и лежащее хранилище дало бы шесть ОШИБОК в час.
    if (new Date(seychas()).getUTCMinutes() < 10) {
      await S.oshibkaPryamo(`Обход tg-dogon упал: ${e && e.message}\nНапоминаний «без ответа» и чистки по срокам нет, пока не починят.`).catch(() => {});
    }
  }
  return { statusCode: 200, body: '' };
};
