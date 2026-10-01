// Общее для двух календарных инструментов Веры. Один файл, чтобы адрес API, заголовки
// и разбор окон не разъехались между «посмотреть» и «записать».
//
// ПОЧЕМУ ЯВНЫЙ USER-AGENT. API Calendly стоит за Cloudflare, и он отбивает клиентов
// по подписи. Замер 25.09: дефолтный python-urllib получает 403 «error code: 1010»,
// curl и явный UA — 200. Это не про права, а про подпись, и на 403 можно потерять час.
const UA = 'BusinessIntelDNA/1.0 (+https://businessinteldna.com)';
const API = 'https://api.calendly.com';

function golova() {
  return { 'Authorization': 'Bearer ' + (process.env.CALENDLY_TOKEN || ''),
           'User-Agent': UA, 'Content-Type': 'application/json' };
}

async function calendly(put, opciy) {
  const r = await fetch(API + put, Object.assign({ headers: golova() }, opciy || {}));
  const text = await r.text();
  let telo = null;
  try { telo = JSON.parse(text); } catch (_) { telo = { syroe: text.slice(0, 300) }; }
  return { kod: r.status, telo };
}

// Свободные окна на ближайшие дни. Потолок окна у Calendly — 7 суток, больше не просим.
async function svobodnye(dney) {
  const et = process.env.CALENDLY_EVENT_TYPE;
  if (!et) return { kod: 0, oshibka: 'нет CALENDLY_EVENT_TYPE' };
  // Старт чуть в будущем: Calendly не отдаёт окна, начинающиеся «сейчас».
  const s = new Date(Date.now() + 15 * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  const e = new Date(Date.now() + (dney || 6) * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  const p = new URLSearchParams({ event_type: et, start_time: s, end_time: e });
  const { kod, telo } = await calendly('/event_type_available_times?' + p.toString());
  if (kod !== 200) return { kod, oshibka: (telo && (telo.message || telo.title)) || 'Calendly не ответил' };
  return { kod: 200, okna: (telo.collection || []).map(x => x.start_time) };
}

// «в четверг в 15:00» на языке звонящего. Пояс — его, а не наш: он называет своё время.
function slovami(iso, poyas, ru) {
  const d = new Date(iso);
  try {
    const f = new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: !ru, timeZone: poyas,
    });
    return f.format(d);
  } catch (_) {
    // Неизвестный пояс — не выдумываем, отдаём UTC и честно это помечаем.
    return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }
}

module.exports = { calendly, svobodnye, slovami, UA };
