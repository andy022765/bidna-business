// Обёртка Telegram Bot API. Прямой fetch, без библиотек.
//
// Правила:
//   - токен НИКОГДА не попадает в лог: адрес запроса не печатаем, текст ошибок чистим от токена;
//   - 429 → ждём retry_after (не дольше 10 с) и пробуем ещё раз;
//   - сетевой сбой на отправке сообщения НЕ повторяем: запрос мог дойти, и человек получит два ответа.
//
// Тесты: global.__DOGON_FAKE_TG__ (массив) — вызовы не уходят в сеть, а складываются туда
// как {method, body}; ответ {ok:true, result:{message_id:<счётчик>}}.
// Необязательно: global.__DOGON_FAKE_TG_OTVET__ = async (method, body) => ответ | null —
// чтобы подсунуть ошибку («окно закрыто», 403 и т. п.).

let schetchikFake = 0;
const pauza = (ms) => new Promise(r => setTimeout(r, ms));

function chisto(s) {
  const token = process.env.TG_BOT_TOKEN;
  const str = String(s == null ? '' : s);
  return token ? str.split(token).join('<токен>') : str;
}

// Для синхронных функций (zvonok.js) и расписания (tg-dogon, стена 30 с): taymautMs короче,
// zhdat429=false — на 429 не ждём retry_after, а сразу отдаём ошибку: досылка будет позже.
async function vyzov(method, body = {}, { povtorSeti = true, taymautMs = 15000, zhdat429 = true } = {}) {
  if (Array.isArray(global.__DOGON_FAKE_TG__)) {
    global.__DOGON_FAKE_TG__.push({ method, body });
    if (typeof global.__DOGON_FAKE_TG_OTVET__ === 'function') {
      const o = await global.__DOGON_FAKE_TG_OTVET__(method, body);
      if (o) return o;
    }
    return { ok: true, result: { message_id: ++schetchikFake } };
  }

  const token = process.env.TG_BOT_TOKEN;
  if (!token) { console.log(`[tg] ${method}: нет TG_BOT_TOKEN`); return { ok: false, description: 'нет TG_BOT_TOKEN' }; }

  for (let popytka = 0; popytka < 3; popytka++) {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), taymautMs);
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const d = await r.json().catch(() => ({ ok: false, error_code: r.status, description: `HTTP ${r.status}` }));
      if (d.ok) return d;
      const ra = d.parameters && d.parameters.retry_after;
      if (zhdat429 && d.error_code === 429 && ra && ra <= 10 && popytka < 2) {
        console.log(`[tg] ${method}: 429, жду ${ra} с`);
        await pauza(ra * 1000);
        continue;
      }
      console.log(`[tg] ${method} не прошёл: ${d.error_code} ${chisto(d.description).slice(0, 200)}`);
      return d;
    } catch (e) {
      console.log(`[tg] ${method} сеть: ${chisto(e && e.message).slice(0, 200)}`);
      if (!povtorSeti || popytka >= 1) return { ok: false, description: `сеть: ${chisto(e && e.message)}` };
      await pauza(500);
    } finally {
      clearTimeout(tm);
    }
  }
  return { ok: false, description: 'не прошёл после повторов' };
}

// Ошибка «окно в 24 часа закрыто» — точный текст не проверен живьём (SPEC §8),
// поэтому ловим все известные варианты: BUSINESS_PEER_USAGE_MISSING, «can't reply», 403 от бизнес-чата.
function oknoZakryto(d) {
  if (!d || d.ok) return false;
  const s = String(d.description || '');
  return /BUSINESS_PEER|PEER_USAGE|USAGE_MISSING|24 hours|can'?t reply|not allowed to reply|BOT_ACCESS_FORBIDDEN|CHAT_WRITE_FORBIDDEN/i.test(s)
      || (d.error_code === 403);
}

// «Печатает…» в бизнес-чате, пока думает модель. Telegram гасит индикатор через 5 с — обновляем каждые 4.
function pechataet(bc, chatId) {
  const odin = () => vyzov('sendChatAction', { business_connection_id: bc, chat_id: chatId, action: 'typing' }, { povtorSeti: false })
    .catch(() => {});
  odin();
  const id = setInterval(odin, 4000);
  return () => clearInterval(id);
}

const otvetitKnopke = (id, text) => vyzov('answerCallbackQuery', text ? { callback_query_id: id, text: String(text).slice(0, 190) } : { callback_query_id: id })
  .catch(() => ({ ok: false }));

module.exports = { vyzov, oknoZakryto, pechataet, otvetitKnopke, chisto };
