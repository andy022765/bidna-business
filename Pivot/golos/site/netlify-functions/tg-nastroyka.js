// Служебная функция Доводчика: вебхук Telegram и состояние.
//
// Ключ DOGON_ADMIN_KLYUCH — заголовком x-dogon-klyuch (лучше) или ?k= (как у sostoyanie).
// Сравнение timing-safe. GOLOS_NASH_KLYUCH не берём: он записан открытым текстом в CLAUDE.md.
// Чтение — GET или POST, изменения — только POST.
//
//   ?d=getMe            кто бот
//   ?d=getWebhookInfo   куда смотрит вебхук, last_error
//   ?d=status           вебхук + подключения из Blobs + рубильник + расход за сегодня
//   ?d=proverit_fon     исполняется ли tg-vhod-background как ФОНОВАЯ функция (ревью 15.09 №14, ниже)
//   POST ?d=setWebhook  url варианта A, secret_token, allowed_updates; ?drop=0 — не сбрасывать очередь.
//                       Сначала proverit_fon: не 202 — вебхук не ставим (?bez_proverki=1 — осознанный обход)
//   POST ?d=deleteWebhook
//   POST ?d=nastroyki   тело {vklyuchen, rezhim: kod|vse, pauza_chasov} — переключатели без передеплоя
//   POST ?d=obkhod      тот же обход, что tg-dogon по расписанию (запланированную функцию по URL не вызвать);
//                       ?bez_chistki=1 — только напоминания «без ответа»
//
// ПРОВЕРКА ФОНА (ревью №14). Вся схема варианта A стоит на том, что Netlify исполняет tg-vhod-background
// как фоновую функцию: мгновенный 202 и до 15 минут работы. На этом сайте фоновых функций ещё не было,
// а у Netlify они доступны не на всех тарифах [не проверено для нашего аккаунта]. Если функция исполнится
// как обычная синхронная, Telegram ждёт ответа всю обработку (6 с паузы + модель), получает таймаут,
// повторяет апдейт, и getWebhookInfo копит last_error. Тесты зовут handler напрямую и этого не видят.
// Как проверяем: POST на функцию с заведомо неверным секретом. Фоновая — Netlify сам отвечает 202 до
// запуска кода. Синхронная — наш код отвечает 200 на отбое секрета. В логе tg-vhod-background после
// проверки будет «отбой: секрет не сошёлся» — это она.
//
// Токен бота в ответ не попадает никогда: getWebhookInfo его не содержит, ошибки чистит tg.js.
//
// env: TG_BOT_TOKEN, TG_WEBHOOK_SECRET, DOGON_ADMIN_KLYUCH, URL (Netlify ставит сам), EV_BLOBS_TOKEN, SITE_ID.

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const H = require('../dogon-lib/hranilishche');
H.podklyuchitBlobs(getStore);
const tg = require('../dogon-lib/tg');
const { seychas } = require('../dogon-lib/meta');
const { obkhod } = require('../dogon-lib/obkhod');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const otvet = (code, obj) => ({ statusCode: code, headers: JSON_H, body: JSON.stringify(obj, null, 2) });

const ALLOWED_UPDATES = ['business_connection', 'business_message', 'edited_business_message', 'deleted_business_messages', 'message', 'callback_query'];

function klyuchVeren(event) {
  const nash = process.env.DOGON_ADMIN_KLYUCH || '';
  const h = event.headers || {};
  const q = event.queryStringParameters || {};
  const ih = String(h['x-dogon-klyuch'] || h['X-Dogon-Klyuch'] || q.k || '');
  if (!nash || !ih) return false;
  // Хэшируем обе стороны: timingSafeEqual требует равной длины, а длину ключа тоже не выдаём.
  const a = crypto.createHash('sha256').update(nash).digest();
  const b = crypto.createHash('sha256').update(ih).digest();
  return crypto.timingSafeEqual(a, b);
}

const adresVebhuka = () => `${String(process.env.URL || 'https://dezhurny-r4p8w2.netlify.app').replace(/\/+$/, '')}/.netlify/functions/tg-vhod-background`;

async function proveritFon() {
  const url = adresVebhuka();
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), 8000);
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': `proverka-fona-${crypto.randomBytes(8).toString('hex')}` },
      body: '{}',
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    const fon = r.status === 202;
    return { ok: fon, status: r.status, ms, url,
      vyvod: fon
        ? 'Фоновая: Netlify ответил 202 до запуска кода. Вариант A годится.'
        : `НЕ фоновая: статус ${r.status}, ждали 202. Тариф без Background Functions или функция не выложена — вебхук сюда не ставить, вариант B (SPEC §3).` };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, url, vyvod: `Не достучалась до функции: ${tg.chisto(e && e.message)}` };
  } finally { clearTimeout(tm); }
}

exports.handler = async (event) => {
  if (!process.env.DOGON_ADMIN_KLYUCH) return otvet(503, { ok: false, oshibka: 'DOGON_ADMIN_KLYUCH не задан' });
  if (!klyuchVeren(event)) { console.log('[tg-nastroyka] отбой: ключ не сошёлся'); return otvet(401, { ok: false }); }

  const q = event.queryStringParameters || {};
  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  const d = String(q.d || b.d || 'status');
  const post = event.httpMethod === 'POST';
  const IZMENENIYA = ['setWebhook', 'deleteWebhook', 'nastroyki', 'obkhod'];
  if (IZMENENIYA.includes(d) && !post) return otvet(405, { ok: false, oshibka: `${d} — только POST` });

  try {
    if (d === 'getMe' || d === 'getWebhookInfo') {
      return otvet(200, await tg.vyzov(d, {}));
    }

    if (d === 'proverit_fon') {
      return otvet(200, await proveritFon());
    }

    if (d === 'setWebhook') {
      const secret = process.env.TG_WEBHOOK_SECRET || '';
      // Требование Telegram к secret_token: 1–256 знаков A-Za-z0-9_-. У нас не короче 32.
      if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return otvet(400, { ok: false, oshibka: 'TG_WEBHOOK_SECRET: нужно 32–256 знаков A-Za-z0-9_-' });
      const bezProverki = String(q.bez_proverki || b.bez_proverki || '') === '1';
      const fon = bezProverki ? null : await proveritFon();
      if (fon && !fon.ok) {
        console.log('[tg-nastroyka] setWebhook отменён: функция не фоновая', fon.status);
        return otvet(409, { ok: false, oshibka: 'Вебхук не поставлен: tg-vhod-background не отвечает как фоновая функция.', proverka_fona: fon });
      }
      const url = adresVebhuka();
      const r = await tg.vyzov('setWebhook', {
        url,
        secret_token: secret,
        allowed_updates: ALLOWED_UPDATES,
        drop_pending_updates: String(q.drop || b.drop || '1') !== '0',
        max_connections: 10,
      });
      console.log('[tg-nastroyka] setWebhook', url, r.ok);
      return otvet(200, { ...r, url, allowed_updates: ALLOWED_UPDATES, proverka_fona: fon || 'пропущена (bez_proverki=1)' });
    }

    if (d === 'deleteWebhook') {
      return otvet(200, await tg.vyzov('deleteWebhook', { drop_pending_updates: false }));
    }

    const store = H.hranilishche();

    if (d === 'nastroyki') {
      if (!store) return otvet(503, { ok: false, oshibka: 'хранилище Blobs не поднялось' });
      const z = (await H.chitat(store, 'nastroyki')) || {};
      if (typeof b.vklyuchen === 'boolean') z.vklyuchen = b.vklyuchen;
      if (['kod', 'vse'].includes(b.rezhim)) z.rezhim = b.rezhim;
      if (Number.isFinite(+b.pauza_chasov) && +b.pauza_chasov >= 1 && +b.pauza_chasov <= 168) z.pauza_chasov = +b.pauza_chasov;
      z.t = seychas();
      await H.pisat(store, 'nastroyki', z);
      return otvet(200, { ok: true, nastroyki: z });
    }

    if (d === 'obkhod') {
      if (!store) return otvet(503, { ok: false, oshibka: 'хранилище Blobs не поднялось' });
      const bezChistki = String(q.bez_chistki || b.bez_chistki || '') === '1';
      // 7 с: это синхронная функция, её стена короче расписания (по документации Netlify бывала 10 с).
      // Чистка, не успевшая за 7 с, продолжится с курсора при следующем запуске.
      return otvet(200, { ok: true, itog: await obkhod({ store, byudzhetMs: 7000, bezChistki }) });
    }

    // Отладка живой проверки: какие ключи есть в хранилище 'dogon' (без значений текстов сообщений).
    if (d === 'klyuchi') {
      if (!store) return otvet(503, { ok: false, oshibka: 'хранилище Blobs не поднялось' });
      const pref = String(q.prefix || b.prefix || '');
      const kl = await H.spisok(store, pref).catch(e => ['ОШИБКА ' + e.message]);
      const out = { ok: true, prefix: pref, vsego: kl.length, klyuchi: kl.slice(0, 200) };
      // значения — только служебных ключей, где нет переписки
      if (/^(upd\/|kod\/|svyaz\/|nastroyki|rashod\/)/.test(pref) || /\/meta$/.test(pref)) {
        out.znacheniya = {};
        for (const k of kl.slice(0, 20)) {
          const v = await H.chitat(store, k).catch(() => null);
          if (v && typeof v === 'object') { const c = { ...v }; delete c.email; delete c.imya; out.znacheniya[k] = c; } else out.znacheniya[k] = v;
        }
      }
      return otvet(200, out);
    }

    if (d === 'status') {
      const vebhuk = await tg.vyzov('getWebhookInfo', {});
      const out = {
        ok: true,
        vebhuk: vebhuk.ok ? vebhuk.result : vebhuk,
        ozhidaem_url: adresVebhuka(),
        url_sovpadaet: !!(vebhuk.ok && vebhuk.result && vebhuk.result.url === adresVebhuka()),
        hranilishche: !!store,
      };
      if (store) {
        const den = new Date(seychas()).toISOString().slice(0, 10);
        const [nastr, rashod, kluchiSvyazi] = await Promise.all([
          H.chitat(store, 'nastroyki').catch(() => null),
          H.chitat(store, `rashod/${den}`).catch(() => null),
          H.spisok(store, 'svyaz/').catch(() => []),
        ]);
        const svyazi = [];
        for (const k of kluchiSvyazi) {
          const s = await H.chitat(store, k).catch(() => null);
          if (s) svyazi.push({ user_id: s.user_id, username: s.username, is_enabled: s.is_enabled, can_reply: !!(s.rights || {}).can_reply, rights: s.rights, t: s.t });
        }
        out.nastroyki = { vklyuchen: !nastr || nastr.vklyuchen !== false, rezhim: (nastr && nastr.rezhim) || process.env.DOGON_REZHIM || 'kod', pauza_chasov: (nastr && nastr.pauza_chasov) || +(process.env.DOGON_PAUZA_CHASOV || 24) };
        out.rashod_segodnya = rashod || { vyzovov: 0, usd: 0 };
        out.podklyucheniya = svyazi;
      }
      return otvet(200, out);
    }

    return otvet(400, { ok: false, oshibka: `неизвестное d=${d}` });
  } catch (e) {
    console.log('[tg-nastroyka] упало:', tg.chisto(e && e.message));
    return otvet(500, { ok: false, oshibka: tg.chisto(e && e.message) });
  }
};
