// Живой разбор ответов квиза через Claude.
// Вызывается с финального экрана квиза. Если ключа нет или API недоступен —
// возвращаем не-200, и квиз молча показывает разбор по правилам (он всегда есть).
// Требует env ANTHROPIC_API_KEY в настройках сайта Netlify.
const Anthropic = require('@anthropic-ai/sdk');

const MAX = 600;                      // режем длинные ответы: это поле ввода на сайте
const clip = (v) => String(v == null ? '' : v).slice(0, MAX).trim();

const SYSTEM = `Ты — стратег-аналитик Business Intelligence DNA (Андрей и Маша).
Человек только что прошёл бесплатный экспресс-разбор на сайте. Твоя задача — дать ему
короткий, но честный и предметный разбор ИМЕННО ЕГО ответов. Это витрина метода: он должен
увидеть, что мы думаем про его дело, а не выдаём шаблон.

КАК ДУМАТЬ
Рабочее отличие держится на трёх опорах: КОМУ · КАКОЙ РЕЗУЛЬТАТ · ЗА СЧЁТ ЧЕГО.
Проверь формулировку человека по этим трём опорам и скажи, каких не хватает — дословно
процитировав его же слова. Если отличие звучит как категория («качество», «индивидуальный
подход», «опыт») — скажи прямо, что так говорит вся ниша, и поэтому клиент сравнивает по цене.

ЖЁСТКИЕ ПРАВИЛА
- НИКАКИХ обещаний цифр и сроков результата. Нельзя «+30%», «в 2 раза», «за месяц».
  Можно направление: продажи вырастут, затраты упадут, вас станет видно.
- Не льстить. Если отстраиваться нечем — сказать мягко, но честно.
- Не выдумывать факты о его бизнесе, которых нет в ответах. Опираться только на них.
- Не продавать в лоб и не звать на созвон — это делает сайт после тебя.
- Тон: как оператор с оператором. Без канцелярита, без «данный», «осуществляется»,
  без восторгов и без воды. Короткие предложения.

ФОРМАТ
Ровно три абзаца, каждый 2–3 предложения, разделены пустой строкой. Без заголовков,
без списков, без markdown, без эмодзи.
1) Что мы поняли про его дело — его же словами, и что в этой формулировке не работает.
2) Главный разрыв: где именно он теряет клиентов и почему это следствие пункта 1.
3) Что это ему стоит сегодня и с чего честно начинать. Направление, без цифр.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method' };
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 503, body: 'no key' };   // квиз покажет разбор по правилам

  try {
    const b = JSON.parse(event.body || '{}');
    const seg = b.segment === 'expert' ? 'эксперт-практик' : 'владелец бизнеса';
    const wy = clip(b.whatyoudo), kl = clip(b.killer);
    if (!wy && !kl) return { statusCode: 400, body: 'empty' };

    const S = b.scores || {};
    const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null);
    const facts = [
      `Сегмент: ${seg}.`,
      `Чем занимается (его слова): «${wy || 'не указал'}».`,
      `Чем он лучше конкурента (его слова): «${kl || 'не смог сформулировать'}».`,
      `Индекс видимости: ${num(S.score) ?? '—'} из 10.`,
      `Ясность отличия: ${num(S.clarity) ?? '—'}%. Система потока: ${num(S.system) ?? '—'}%. AI-видимость: ${num(S.aivis) ?? '—'}%.`,
      `Как его находят клиенты: ${clip(b.found) || 'не указано'}.`,
      `Предсказуемость потока: ${clip(b.flow) || 'не указано'}.`,
      `Что для него сейчас важнее всего: ${clip(b.matters) || 'не указано'}.`,
    ].join('\n');

    const client = new Anthropic({ apiKey: key });
    const res = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,                       // разбор намеренно короткий — три абзаца
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },       // человек ждёт на экране, глубина тут не нужна
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      messages: [{ role: 'user', content: 'Ответы человека:\n\n' + facts }],
    });

    if (res.stop_reason === 'refusal') {
      console.log('[quiz-insight] refusal', res.stop_details && res.stop_details.category);
      return { statusCode: 502, body: 'refused' };
    }
    const text = res.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n').trim();
    if (!text) return { statusCode: 502, body: 'empty completion' };

    console.log('[quiz-insight] ok', res.usage && res.usage.input_tokens, '/', res.usage && res.usage.output_tokens);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ insight: text }),
    };
  } catch (e) {
    // любая ошибка = тихий откат на разбор по правилам, человек ничего не замечает
    const status = e && e.status;
    console.error('[quiz-insight] error', status || '', e && e.message);
    return { statusCode: 502, body: 'error' };
  }
};
