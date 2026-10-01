// Мозги Доводчика: один вызов Anthropic Messages API прямым fetch, без SDK.
//
// Настройки:
//   - модель env DOGON_MODEL, по умолчанию claude-sonnet-5; ключ env ANTHROPIC_API_KEY_DOGON
//     (отдельный workspace со своим лимитом — условие запуска, скептик №10: общий лимит $30
//     кладёт list.js на главном сайте);
//   - thinking выключен, max_tokens 1500: ответ короткий, а мышление ело бы тот же лимит;
//   - ответ строго JSON по схеме: output_config.format = json_schema. Всё равно парсим с защитой;
//   - кэш промпта только если прошлый вызов по чату был меньше 5 минут назад — кэш живёт 5 минут,
//     а запись стоит 1,25 цены: в переписке с долгими паузами он чаще дороже, чем дешевле;
//   - один повтор на 429/5xx/сеть (SPEC §5 строка 18), дальше — шаблон и сигнал ОШИБКА.
//
// Каждый вызов пишет в лог строку [dogon$] с токенами и суммой.
// Тесты: global.__DOGON_STUB_MODEL__ = async (messages, system) => объект ответа.

let PROMPT = null, PROMPT_ZAGLUSHKA = false;
try {
  // Собирает sobrat_prompt.py из PROMPT-DOGON.md + блоков Линий 03 и 05.
  const p = require('./prompt.generated');
  PROMPT = typeof p === 'string' ? p : (p && (p.PROMPT || p.prompt || p.default)) || null;
} catch (_) { PROMPT = null; }
if (!PROMPT || typeof PROMPT !== 'string') {
  // Заглушка только чтобы модуль грузился. В бою tg-vhod проверяет estPrompt() и без настоящего
  // промпта модель не зовёт: отвечает шаблоном и шлёт ОШИБКА.
  PROMPT_ZAGLUSHKA = true;
  PROMPT = 'Ты — Вера, виртуальный ассистент Business Intelligence DNA. Отвечай коротко, без ссылок, '
         + 'без цифр результата и без обещаний. Если не уверена — signal pozvat_cheloveka.';
}

const estPrompt = () => !PROMPT_ZAGLUSHKA;

const SIGNALY = ['net', 'goryachiy', 'pozvat_cheloveka', 'zhaloba', 'udalit_dannye', 'stop', 'ne_po_delu', 'spam'];
const TEMY = ['diagnostika', 'razbor', 'dezhurny', 'svyazka', 'vnedrenie', 'vidimost', 'avtomatizaciya', 'anketa', 'drugoe'];
const SSYLKI = ['net', 'razbor', 'diagnostika'];
const SEGMENTY = ['biznes', 'ekspert', ''];

// SPEC §3 «Модель». Ограничения длины в json_schema не поддерживаются — их держит validator.js.
const SHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tekst', 'ssylka', 'segment', 'tema', 'signal', 'dlya_vladelcev', 'ne_otvetila'],
  properties: {
    tekst:          { type: 'string', description: 'Ответ человеку, простой текст, до 500 знаков (максимум 900).' },
    ssylka:         { type: 'string', enum: SSYLKI },
    segment:        { type: 'string', enum: SEGMENTY },
    tema:           { type: 'string', enum: TEMY },
    signal:         { type: 'string', enum: SIGNALY },
    dlya_vladelcev: { type: 'string', description: 'Одна строка для Андрея и Маши, до 300 знаков.' },
    ne_otvetila:    { type: 'string', description: 'На какой вопрос не ответила; пусто, если на все.' },
  },
};

// Sonnet 5, $ за миллион токенов: вход 2, выход 10, запись кэша 5 мин ×1,25, чтение ×0,1.
const CENA = { vhod: 2, vyhod: 10, zapis: 2.5, chtenie: 0.2 };
function stoimost(u) {
  if (!u) return 0;
  return ((u.input_tokens || 0) * CENA.vhod + (u.output_tokens || 0) * CENA.vyhod
        + (u.cache_creation_input_tokens || 0) * CENA.zapis + (u.cache_read_input_tokens || 0) * CENA.chtenie) / 1e6;
}

const odnoIz = (v, spisok, poUmolch) => (spisok.includes(v) ? v : poUmolch);

// Приводим что угодно к схеме. Не распарсилось — null.
function normalizovat(o) {
  if (!o || typeof o !== 'object') return null;
  return {
    tekst: String(o.tekst == null ? '' : o.tekst).trim(),
    ssylka: odnoIz(o.ssylka, SSYLKI, 'net'),
    segment: odnoIz(o.segment, SEGMENTY, ''),
    tema: odnoIz(o.tema, TEMY, 'drugoe'),
    signal: odnoIz(o.signal, SIGNALY, 'net'),
    dlya_vladelcev: String(o.dlya_vladelcev || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    ne_otvetila: String(o.ne_otvetila || '').replace(/\s+/g, ' ').trim().slice(0, 300),
  };
}

function razobratJSON(text) {
  const s = String(text || '').trim();
  const popytki = [s, s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')];
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) popytki.push(s.slice(a, b + 1));
  for (const p of popytki) { try { return JSON.parse(p); } catch (_) {} }
  return null;
}

const pauza = (ms) => new Promise(r => setTimeout(r, ms));

// kontekst — второй системный блок (меняется), messages — история из kontekst.istoriyaDlyaModeli.
// Возвращает { ok, otvet, usage, cena, oshibka }.
async function sprosit({ kontekst, messages, keshirovat = false }) {
  const systemTekst = `${PROMPT}\n\n${kontekst || ''}`;

  if (typeof global.__DOGON_STUB_MODEL__ === 'function') {
    try {
      const o = normalizovat(await global.__DOGON_STUB_MODEL__(messages, systemTekst));
      if (!o) return { ok: false, oshibka: 'заглушка вернула не объект', usage: null, cena: 0 };
      return { ok: true, otvet: o, usage: null, cena: 0 };
    } catch (e) { return { ok: false, oshibka: `заглушка: ${e.message}`, usage: null, cena: 0 }; }
  }

  const key = process.env.ANTHROPIC_API_KEY_DOGON;
  if (!key) return { ok: false, oshibka: 'нет ANTHROPIC_API_KEY_DOGON', usage: null, cena: 0 };
  const model = process.env.DOGON_MODEL || 'claude-sonnet-5';

  const blokPrompta = { type: 'text', text: PROMPT };
  if (keshirovat) blokPrompta.cache_control = { type: 'ephemeral' };
  const telo = {
    model,
    max_tokens: 1500,
    thinking: { type: 'disabled' },
    system: [blokPrompta, { type: 'text', text: kontekst || '' }],
    messages,
    output_config: { format: { type: 'json_schema', schema: SHEMA } },
  };

  let posl = '';
  for (let popytka = 0; popytka < 2; popytka++) {
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 60000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(telo),
        signal: ctrl.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        posl = `HTTP ${r.status} ${(d.error && d.error.message) || ''}`.slice(0, 300);
        console.log('[dogon] модель:', posl);
        if ((r.status === 429 || r.status >= 500) && popytka === 0) { await pauza(global.__DOGON_BYSTRO__ ? 0 : 2000); continue; }
        return { ok: false, oshibka: posl, usage: null, cena: 0 };
      }
      const u = d.usage || {};
      const cena = stoimost(u);
      console.log(`[dogon$] ${model} вход ${u.input_tokens || 0} выход ${u.output_tokens || 0} кэш+ ${u.cache_creation_input_tokens || 0} кэш= ${u.cache_read_input_tokens || 0} $${cena.toFixed(4)} ${d.stop_reason}`);
      if (d.stop_reason === 'refusal') return { ok: false, oshibka: 'модель отказалась (refusal)', usage: u, cena };
      if (d.stop_reason === 'max_tokens') return { ok: false, oshibka: 'ответ обрезан max_tokens', usage: u, cena };
      const text = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const o = normalizovat(razobratJSON(text));
      if (!o) return { ok: false, oshibka: 'ответ не разобрался как JSON', usage: u, cena };
      return { ok: true, otvet: o, usage: u, cena };
    } catch (e) {
      posl = `сеть: ${e && e.name === 'AbortError' ? 'таймаут 60 с' : e && e.message}`;
      console.log('[dogon] модель:', posl);
      if (popytka === 0) { await pauza(global.__DOGON_BYSTRO__ ? 0 : 2000); continue; }
    } finally { clearTimeout(tm); }
  }
  return { ok: false, oshibka: posl || 'модель недоступна', usage: null, cena: 0 };
}

module.exports = { sprosit, estPrompt, normalizovat, razobratJSON, stoimost, SHEMA, SIGNALY, TEMY };
