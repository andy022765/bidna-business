// Проверка zvonok.js (письмо владельцу после звонка) на заглушках — без сети, без ElevenLabs и Resend.
// Запуск: node "Pivot/agenty/dogonyayushchiy/proverka/test_zvonok.js" [путь к прежнему zvonok.js]
//   Второй аргумент необязателен: если дан, письмо владельцу без кода сверяется с прежним до байта.
//
// Что проверяем:
//   - подпись ElevenLabs: чужая подпись → 401 и ни одной записи;
//   - дедуп zvonok-obrabotan/<conv_id>: повтор не даёт второго письма; post_call_audio не съедает письмо;
//     зависшая «в работе» старше 90 с пропускает повтор, свежая — нет;
//   - zvonok/* пишется ТОЛЬКО когда pismo.js выдал код и код стоял в письме (или холостой прогон);
//   - демо без conv_id: код находится по pochta/<sha> за последний час, старше часа — нет;
//   - чат уже привязан к коду → карточка звонка в группу, без почты и телефона;
//   - хранилище Доводчика лежит → письмо владельцу всё равно уходит;
//   - ревью 15.09 №5: Telegram висит → письмо владельцу уходит ДО карточки и не ждёт её дольше 3 с;
//   - ревью 15.09 №6, №7: флаг выключен — кода нет вовсе; в zvonok/* ни почты, ни телефона, ни номера.

const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const SITE = path.resolve(__dirname, '../../../golos/site');
const STARYY = process.argv[2] ? path.resolve(process.argv[2]) : null;

// ---------- заглушки ----------
// Blobs старых хранилищ (golos-pisma, golos-zvonki, golos-kvota) — по Map на имя.
const starye = new Map();
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: ({ name }) => {
    if (!starye.has(name)) starye.set(name, new Map());
    const m = starye.get(name);
    return { get: async k => m.get(k) ?? null, set: async (k, v) => { m.set(k, String(v)); } };
  } };
  return orig.call(this, req, ...a);
};

// Хранилище Доводчика — единый тестовый контракт dogon-lib.
const dannye = new Map();
const testStore = {
  async get(key, opts = {}) {
    if (!dannye.has(key)) return null;
    const v = dannye.get(key);
    if (opts.type === 'json') { try { return JSON.parse(v); } catch { return null; } }
    return v;
  },
  async set(key, val) { dannye.set(key, String(val)); },
  async setJSON(key, val) { dannye.set(key, JSON.stringify(val)); },
  async delete(key) { dannye.delete(key); },
  async list({ prefix = '' } = {}) { return { blobs: [...dannye.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
};
global.__DOGON_TEST_STORE__ = testStore;
global.__DOGON_BYSTRO__ = true;
const FAKE = [];
global.__DOGON_FAKE_TG__ = FAKE;

// Resend: складываем письма.
const pisma = [];
let poryadok = 0, poryadokPisma = 0;
global.fetch = async (url, opts) => {
  if (String(url).includes('resend.com')) { pisma.push(JSON.parse(opts.body)); poryadokPisma = ++poryadok; }
  return { ok: true, status: 200, text: async () => '{"id":"test"}', json: async () => ({}) };
};

const SECRET = 'whsec_test_zvonok';
Object.assign(process.env, {
  ELEVENLABS_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: 'k', GOLOS_VLADELEC: 'support@businessinteldna.com',
  GOLOS_PISMO_SECRET: 's', GOLOS_AGENTS: JSON.stringify({ dna: 'agent_dna_test', demo: 'agent_demo_test' }),
  DOGON_GRUPPA: '-1001234567890', DOGON_ADMINY: '111,222',
});
delete process.env.TG_BOT_TOKEN;
delete process.env.DOGON_V_PISME;

// Время: pismo держит паузу между шагами по Date.now — сдвигаем, а не ждём.
let sdvig = 0; const realNow = Date.now; Date.now = () => realNow() + sdvig;

// Логи функций глушим, оставляем только строки [zvonok] для отладки по флагу.
const pokazLogi = process.env.LOGI === '1';
const logOrig = console.log;
console.log = (...a) => { if (pokazLogi || !/^\[(pismo|zvonok|dogon|tg)\]/.test(String(a[0]))) logOrig(...a); };

const zvonok = require(path.join(SITE, 'netlify-functions/zvonok.js')).handler;
const pismo = require(path.join(SITE, 'netlify-functions/pismo.js')).handler;

// ---------- помощники ----------
const podpis = (raw, sekret = SECRET, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v0=${crypto.createHmac('sha256', sekret).update(`${t}.${raw}`).digest('hex')}`;

function vebhuk({ conv, type = 'post_call_transcription', pochta = 'irina.nails@gmail.com', telefon = true, auth, agent = 'agent_dna_test' }) {
  return {
    type, event_timestamp: 1789500400,
    data: {
      agent_id: agent, conversation_id: conv,
      transcript: [
        { role: 'agent', message: 'Здравствуйте, это Вера.' },
        { role: 'user', message: `Моя почта ${pochta}, телефон 305 555 0199` },
      ],
      metadata: {
        start_time_unix_secs: 1789500000, call_duration_secs: 361,
        ...(telefon ? { phone_call: { direction: 'inbound', external_number: '+13055550199', agent_number: '+18884810868', type: 'sip_trunking' } } : {}),
        ...(auth ? { authorization_method: auth } : {}),
      },
      analysis: {
        transcript_summary: 'Звонила про Дежурного для салона, вечером пропускают звонки.',
        data_collection_results: {
          imya: { value: 'Ирина' }, telefon: { value: '+1 305 555 0199' }, pochta: { value: pochta },
          zachem: { value: 'Дежурный для салона' }, biznes: { value: 'салон ногтей' },
          obeshchali: { value: 'письмо со списком работ' }, hvost: { value: 'когда можно запустить' },
        },
      },
    },
  };
}

async function poslat(handler, telo, { sekret } = {}) {
  const raw = JSON.stringify(telo);
  const r = await handler({ httpMethod: 'POST', headers: { 'elevenlabs-signature': podpis(raw, sekret) }, body: raw });
  return r.statusCode;
}

// Письмо через pismo.js в два шага, как в разговоре. Возвращает код из kod/*, если он выдан.
async function pismoVery(email, razgovor, { suhoy = false } = {}) {
  const h = { 'x-golos-secret': 's', ...(suhoy ? { 'x-golos-suhoy': '1' } : {}) };
  const b = { email, shag: 'razbor', segment: 'biznes', imya: 'Ирина', razgovor };
  await pismo({ httpMethod: 'POST', headers: h, body: JSON.stringify(b) });
  sdvig += 12000;
  const r = JSON.parse((await pismo({ httpMethod: 'POST', headers: h, body: JSON.stringify({ ...b, podtverdil: true }) })).body);
  const kod = [...dannye.keys()].filter(k => k.startsWith('kod/')).map(k => JSON.parse(dannye.get(k)))
    .filter(z => z.email === email).sort((a, b2) => b2.t_pisma - a.t_pisma)[0];
  return { otvet: r, kod: kod || null };
}

const json = (k) => (dannye.has(k) ? JSON.parse(dannye.get(k)) : null);
const pislemVladelcu = () => pisma.filter(p => (p.to || []).includes('support@businessinteldna.com') && /^(Звонок|Входящий)/.test(p.subject || ''));

let provalov = 0;
const proverit = (n, uslovie, podrobno = '') => { if (!uslovie) provalov++; logOrig(n.padEnd(66), uslovie ? 'ДА' : 'ПРОВАЛ', podrobno); };

(async () => {
  // A. Чужая подпись.
  let n0 = pisma.length, d0 = dannye.size;
  let kodOtveta = await poslat(zvonok, vebhuk({ conv: 'conv_chuzhoy12345' }), { sekret: 'nevernyy' });
  proverit('A. чужая подпись → 401, ни письма, ни записи', kodOtveta === 401 && pisma.length === n0 && dannye.size === d0, `код ${kodOtveta}`);

  // B. Подписанный вебхук, кода нет.
  n0 = pislemVladelcu().length;
  const vB = vebhuk({ conv: 'conv_bezkoda12345' });
  kodOtveta = await poslat(zvonok, vB);
  const pismoB = pislemVladelcu()[n0];
  proverit('B. без кода: письмо владельцу ушло', kodOtveta === 200 && pislemVladelcu().length === n0 + 1);
  proverit('   zvonok/* не записан', !dannye.has('zvonok/conv_bezkoda12345'));
  proverit('   строки «Код Telegram» нет', pismoB && !pismoB.html.includes('Код Telegram'));
  proverit('   дедуп отмечен «готово»', (json('zvonok-obrabotan/conv_bezkoda12345') || {}).s === 'gotovo');

  // C. Тот же вебхук ещё раз.
  n0 = pislemVladelcu().length;
  kodOtveta = await poslat(zvonok, vB);
  proverit('C. повтор вебхука → 200, второго письма нет', kodOtveta === 200 && pislemVladelcu().length === n0);

  // D. post_call_audio с тем же id не съедает письмо о звонке.
  n0 = pislemVladelcu().length;
  await poslat(zvonok, vebhuk({ conv: 'conv_audio123456', type: 'post_call_audio' }));
  proverit('D. post_call_audio: письма нет, дедуп не отмечен', pislemVladelcu().length === n0 && !dannye.has('zvonok-obrabotan/conv_audio123456'));
  await poslat(zvonok, vebhuk({ conv: 'conv_audio123456' }));
  proverit('   затем post_call_transcription → письмо ушло', pislemVladelcu().length === n0 + 1);

  // E. Зависшая отметка «в работе».
  n0 = pislemVladelcu().length;
  dannye.set('zvonok-obrabotan/conv_svezh123456', JSON.stringify({ s: 'v_rabote', t: Date.now() - 10 * 1000 }));
  dannye.set('zvonok-obrabotan/conv_staryy12345', JSON.stringify({ s: 'v_rabote', t: Date.now() - 120 * 1000 }));
  await poslat(zvonok, vebhuk({ conv: 'conv_svezh123456' }));
  proverit('E. «в работе» 10 с назад → повтор пропущен', pislemVladelcu().length === n0);
  await poslat(zvonok, vebhuk({ conv: 'conv_staryy12345' }));
  proverit('   «в работе» 120 с назад → повтор обработан', pislemVladelcu().length === n0 + 1 && json('zvonok-obrabotan/conv_staryy12345').s === 'gotovo');

  // F. Сквозная связка, флаг включён: pismo → код → вебхук с тем же conv_id.
  process.env.DOGON_V_PISME = '1';
  const F = await pismoVery('irina.nails@gmail.com', 'conv_svyazka12345');
  process.env.DOGON_V_PISME = '0';   // флаг читает pismo; zvonok смотрит на v_pisme в самой записи
  n0 = pislemVladelcu().length;
  await poslat(zvonok, vebhuk({ conv: 'conv_svyazka12345' }));
  const zF = json('zvonok/conv_svyazka12345');
  const pismoF = pislemVladelcu()[n0];
  proverit('F. код в письме + вебхук: zvonok/* записан с тем же кодом', !!(F.kod && F.kod.v_pisme && zF && zF.kod === F.kod.kod), F.kod ? `код ${F.kod.kod}` : 'кода нет');
  proverit('   поля: istochnik=telefon, 5 полей, itog, dlit, exp 365 дн.', !!zF && zF.istochnik === 'telefon'
    && Object.keys(zF.sobrano).sort().join() === 'biznes,hvost,imya,obeshchali,zachem' && zF.itog.includes('Дежурного') && zF.dlit === 361 && Math.round((zF.exp - Date.now()) / 86400000) >= 364);
  proverit('   ревью №7: ни номера, ни почты, ни телефона в zvonok/*', !!zF && !('nomer' in zF) && !/13055550199|305 555|irina\.nails/.test(JSON.stringify(zF)));
  proverit('   реплик расшифровки в zvonok/* нет', !!zF && !('dialog' in zF) && !JSON.stringify(zF).includes('305 555 0199,'));
  proverit('   в письме владельцу строка «Код Telegram»', !!pismoF && pismoF.html.includes('Код Telegram') && pismoF.html.includes(F.kod && F.kod.kod));

  // G. Флаг выключен: pismo.js Blobs Доводчика не трогает (ревью №6) → кода нет, zvonok/* не пишем, письмо владельцу прежнее.
  delete process.env.DOGON_V_PISME;
  const G = await pismoVery('bez.flaga@gmail.com', 'conv_bezflaga1234');
  n0 = pislemVladelcu().length;
  const vG = vebhuk({ conv: 'conv_bezflaga1234', pochta: 'bez.flaga@gmail.com' });
  await poslat(zvonok, vG);
  const pismoG = pislemVladelcu()[n0];
  proverit('G. флаг выкл: кода нет вовсе, zvonok/* НЕ записан', G.otvet.ok === true && G.kod === null && !dannye.has('zvonok/conv_bezflaga1234') && !dannye.has('razgovor-kod/conv_bezflaga1234'));
  proverit('   строки «Код Telegram» в письме владельцу нет', !!pismoG && !pismoG.html.includes('Код Telegram'));
  if (STARYY) {
    const staryy = require(STARYY).handler;
    const bylo = pisma.length;
    // Прежний zvonok.js: тот же вебхук под другим id, чтобы ссылка на историю совпала — меняем id и в нашем письме.
    const vG2 = vebhuk({ conv: 'conv_bezflaga1234', pochta: 'bez.flaga@gmail.com' });
    await poslat(staryy, vG2);
    const prezhnee = pisma[bylo];
    proverit('   письмо владельцу совпадает с прежним zvonok.js до байта', !!prezhnee && JSON.stringify(prezhnee) === JSON.stringify(pismoG),
      `${prezhnee ? prezhnee.html.length : 0} / ${pismoG ? pismoG.html.length : 0} знаков`);
  } else logOrig('   сверка с прежним zvonok.js пропущена (не передан путь)');

  // H. Демо без conv_id в pismo: код лёг по хэшу почты, zvonok находит его по pochta/<sha>.
  process.env.DOGON_V_PISME = '1';
  const H = await pismoVery('demo.bez.id@gmail.com', '{{system__conversation_id}}');
  delete process.env.DOGON_V_PISME;
  await poslat(zvonok, vebhuk({ conv: 'conv_demo12345678', pochta: 'Demo.Bez.Id@gmail.com ', telefon: false, auth: 'signed_url', agent: 'agent_demo_test' }));
  const zH = json('zvonok/conv_demo12345678');
  const kH = H.kod && json(`kod/${H.kod.kod}`);
  proverit('H. демо без id: код найден по почте, zvonok/* записан', !!(H.kod && H.kod.razgovor === null && zH && zH.kod === H.kod.kod), H.kod ? `код ${H.kod.kod}` : '');
  proverit('   istochnik=demo, номера нет', !!zH && zH.istochnik === 'demo' && !('nomer' in zH));
  proverit('   kod/* получил razgovor, есть razgovor-kod/<conv_id>', !!kH && kH.razgovor === 'conv_demo12345678' && (json('razgovor-kod/conv_demo12345678') || {}).kod === H.kod.kod);

  // I. Письмо было больше часа назад — по почте не привязываем.
  process.env.DOGON_V_PISME = '1';
  const I = await pismoVery('staroe.pismo@gmail.com', '{{system__conversation_id}}');
  delete process.env.DOGON_V_PISME;
  global.__DOGON_NOW__ = Date.now() + 2 * 3600 * 1000;
  await poslat(zvonok, vebhuk({ conv: 'conv_chaspozzhe1234', pochta: 'staroe.pismo@gmail.com', telefon: false }));
  delete global.__DOGON_NOW__;
  proverit('I. письмо 2 ч назад: по почте не привязано', !!I.kod && !dannye.has('zvonok/conv_chaspozzhe1234'));

  // J. Человек написал в Telegram, пока шёл звонок: чат уже привязан → карточка в группу сразу.
  process.env.DOGON_V_PISME = '1';
  const J = await pismoVery('uzhe.pishet@gmail.com', 'conv_uzhepishet123');
  delete process.env.DOGON_V_PISME;
  const kJ = json(`kod/${J.kod.kod}`);
  kJ.chaty = [{ bc: 'bc_test_1', chat: 555, user_id: 555, t: Date.now() }];
  dannye.set(`kod/${J.kod.kod}`, JSON.stringify(kJ));
  dannye.set('chat/bc_test_1/555/meta', JSON.stringify({ chat_id: 555, bc: 'bc_test_1', user: { id: 555, first_name: 'Ирина', username: 'irina_nails' },
    kod: J.kod.kod, razgovor: 'conv_uzhepishet123', status: 'aktivnyy', soglasie: { sposob: 'pismo', t: Date.now() }, topic_id: 77, signal_t: {}, kartochka_zvonka: false }));
  const f0 = FAKE.length;
  await poslat(zvonok, vebhuk({ conv: 'conv_uzhepishet123', pochta: 'uzhe.pishet@gmail.com' }));
  const karty = FAKE.slice(f0).filter(c => c.method === 'sendMessage' && /КАРТОЧКА ЗВОНКА/.test(c.body.text || ''));
  const mJ = json('chat/bc_test_1/555/meta');
  proverit('J. чат уже привязан: карточка звонка ушла в тему', karty.length >= 1 && karty.some(c => c.body.message_thread_id === 77), `${karty.length} сообщ.`);
  proverit('   в карточке нет почты и телефона', karty.length > 0 && karty.every(c => !/@gmail|305 555|\+1305/.test(c.body.text)));
  proverit('   meta.kartochka_zvonka=true, повтор не шлёт второй', mJ.kartochka_zvonka === true && await (async () => {
    dannye.delete('zvonok-obrabotan/conv_uzhepishet123');
    const f1 = FAKE.length;
    await poslat(zvonok, vebhuk({ conv: 'conv_uzhepishet123', pochta: 'uzhe.pishet@gmail.com' }));
    return !FAKE.slice(f1).some(c => /КАРТОЧКА ЗВОНКА/.test(c.body.text || ''));
  })());

  // K. Холостой прогон (флаг выкл): код suhoy → zvonok/* пишется, строки в письме владельцу нет.
  const K = await pismoVery('suhoy.progon@gmail.com', 'conv_suhoyprogon12', { suhoy: true });
  n0 = pislemVladelcu().length;
  await poslat(zvonok, vebhuk({ conv: 'conv_suhoyprogon12', pochta: 'suhoy.progon@gmail.com' }));
  proverit('K. холостой: kod suhoy, zvonok/* записан', !!(K.kod && K.kod.suhoy && K.otvet.kod === K.kod.kod) && (json('zvonok/conv_suhoyprogon12') || {}).kod === K.kod.kod);
  proverit('   строки «Код Telegram» нет (в письме человеку кода не было)', !pislemVladelcu()[n0].html.includes('Код Telegram'));

  // L. Человек попросил удалить данные (udaleno_t) — zvonok/* не пишем.
  process.env.DOGON_V_PISME = '1';
  const L = await pismoVery('udalit@gmail.com', 'conv_udalit1234567');
  delete process.env.DOGON_V_PISME;
  const kL = json(`kod/${L.kod.kod}`); delete kL.email; kL.udaleno_t = Date.now();
  dannye.set(`kod/${L.kod.kod}`, JSON.stringify(kL));
  await poslat(zvonok, vebhuk({ conv: 'conv_udalit1234567', pochta: 'udalit@gmail.com' }));
  proverit('L. данные удалены по просьбе: zvonok/* не записан', !dannye.has('zvonok/conv_udalit1234567'));

  // M. Хранилище Доводчика лежит: письмо владельцу всё равно уходит, 200.
  global.__DOGON_TEST_STORE__ = { get: async () => { throw new Error('Blobs 503'); }, set: async () => { throw new Error('Blobs 503'); },
    setJSON: async () => { throw new Error('Blobs 503'); }, delete: async () => {}, list: async () => ({ blobs: [] }) };
  n0 = pislemVladelcu().length;
  kodOtveta = await poslat(zvonok, vebhuk({ conv: 'conv_lezhit123456' }));
  global.__DOGON_TEST_STORE__ = testStore;
  proverit('M. хранилище dogon лежит: 200 и письмо владельцу ушло', kodOtveta === 200 && pislemVladelcu().length === n0 + 1);

  // N. Ревью №5: Telegram отвечает по 6 с (429, медленная сеть). Письмо владельцу уходит раньше карточки,
  // вебхук отвечает не дольше ~3,5 с, флаг kartochka_zvonka не ставится — карточку дошлёт tg-vhod.
  process.env.DOGON_V_PISME = '1';
  const Nn = await pismoVery('medlenno.tg@gmail.com', 'conv_medlennotg12');
  delete process.env.DOGON_V_PISME;
  const kN = json(`kod/${Nn.kod.kod}`);
  kN.chaty = [{ bc: 'bc_test_1', chat: 556, user_id: 556, t: Date.now() }];
  dannye.set(`kod/${Nn.kod.kod}`, JSON.stringify(kN));
  dannye.set('chat/bc_test_1/556/meta', JSON.stringify({ chat_id: 556, bc: 'bc_test_1', user: { id: 556, first_name: 'Олег', username: 'oleg_test' },
    kod: Nn.kod.kod, razgovor: 'conv_medlennotg12', status: 'aktivnyy', soglasie: { sposob: 'pismo', t: Date.now() }, topic_id: 78, signal_t: {}, kartochka_zvonka: false }));
  let poryadokTg = 0;
  global.__DOGON_FAKE_TG_OTVET__ = async (method) => {
    if (method === 'sendMessage') { if (!poryadokTg) poryadokTg = ++poryadok; await new Promise(r => setTimeout(r, 6000)); }
    return null;
  };
  n0 = pislemVladelcu().length;
  const { performance } = require('perf_hooks');
  const tN = performance.now();
  kodOtveta = await poslat(zvonok, vebhuk({ conv: 'conv_medlennotg12', pochta: 'medlenno.tg@gmail.com' }));
  const zanyaloN = Math.round(performance.now() - tN);
  proverit('N. Telegram висит 6 с: письмо владельцу ушло раньше карточки', kodOtveta === 200 && pislemVladelcu().length === n0 + 1 && poryadokTg > 0 && poryadokPisma < poryadokTg,
    `письмо #${poryadokPisma}, Telegram #${poryadokTg}`);
  proverit('   вебхук ответил за < 4 с, карточку не ждал', zanyaloN < 4000, `${zanyaloN} мс`);
  proverit('   флаг kartochka_zvonka не поставлен (дошлёт tg-vhod)', json('chat/bc_test_1/556/meta').kartochka_zvonka === false);
  global.__DOGON_FAKE_TG_OTVET__ = undefined;

  logOrig(provalov ? `\nПРОВАЛОВ: ${provalov}` : '\nВСЕ ПРОВЕРКИ zvonok.js ПРОШЛИ');
  process.exitCode = provalov ? 1 : 0;
})().catch(e => { logOrig('ТЕСТ УПАЛ:', e); process.exitCode = 1; });
