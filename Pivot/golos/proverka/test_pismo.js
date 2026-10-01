// Локальная проверка pismo.js на заглушках: хранилище в памяти, Resend подменён.
// Сценарии 1–11 — два шага и холостой режим (вывод как до 15.09). 12–20 — код Доводчика.
// 21–23 — ревью 15.09: имя в письме (№1), отдельный потолок формы (№2), zayavka.js: потолок и дубли владельцу.
const path = process.argv[2];
const Module = require('module');
const mem = new Map(); let lomat = false; let pisem = 0;
// Порча записи кода: 'oshibka' — set бросает, 'zavis' — set висит 3 с (дольше таймаута 1,5 с).
let porchaKoda = '';
const orig = Module._load;
Module._load = function (req, ...a) {
  if (req === '@netlify/blobs') return { getStore: () => lomat ? (() => { throw new Error('нет'); })() :
    ({ get: async k => mem.get(k) ?? null, set: async (k, v) => {
      if (porchaKoda && k.startsWith('kod/')) {
        if (porchaKoda === 'oshibka') throw new Error('Blobs 500');
        await new Promise(r => setTimeout(r, 3000));
      }
      mem.set(k, v);
    }, delete: async k => { mem.delete(k); } }) };
  return orig.call(this, req, ...a);
};
process.env.GOLOS_PISMO_SECRET = 's'; process.env.RESEND_API_KEY = 'k';
process.env.GOLOS_PISEM_FORMA_V_SUTKI = '3';   // читается при загрузке модуля
let poslPismo = null;
global.fetch = async (url, opts) => { pisem++; try { poslPismo = JSON.parse(opts.body); } catch (_) {} return { ok: true, status: 200, text: async () => '{}' }; };
const { handler } = require(path);
const T0 = Date.now(); let sdvig = 0; const realNow = Date.now; Date.now = () => realNow() + sdvig;
const call = async (body, suhoy, dop = {}) => JSON.parse((await handler({ httpMethod: 'POST', headers: { 'x-golos-secret': 's', ...(suhoy ? { 'x-golos-suhoy': '1' } : {}), ...dop }, body: JSON.stringify(body) })).body);
const C = 'conv_test1234567';
(async () => {
  const log = (n, r) => console.log(n.padEnd(46), r.otpravleno === false ? 'ЗАЧИТАЛА' : (r.ok ? 'УШЛО' : 'ОТКАЗ'), '|', (r.skazat || '').slice(0, 60), '| писем', pisem);
  log('1. без podtverdil (старый вызов)', await call({ email: 'a.b@gmail.com', shag: 'razbor', razgovor: C }));
  log('2. сразу podtverdil=true (рано, 0 с)', await call({ email: 'a.b@gmail.com', shag: 'razbor', podtverdil: true, razgovor: C }));
  sdvig += 12000;
  log('3. через 12 с, podtverdil=true', await call({ email: 'a.b@gmail.com', shag: 'razbor', podtverdil: true, razgovor: C }));
  log('4. «не пришло», povtor', await call({ email: 'a.b@gmail.com', shag: 'razbor', podtverdil: true, povtor: true, razgovor: C }));
  log('5. другой адрес с podtverdil=true', await call({ email: 'c@gmail.com', shag: 'razbor', podtverdil: true, razgovor: C }));
  log('6. кривой адрес x@b..com', await call({ email: 'x@b..com', shag: 'razbor', podtverdil: false, razgovor: C }));
  log('7. чужой разговор, тот же адрес, true', await call({ email: 'a.b@gmail.com', shag: 'razbor', podtverdil: true, razgovor: 'conv_drugoy99999' }));
  log('8. razgovor не подставлен {{system__...}}', await call({ email: 'z@gmail.com', shag: 'razbor', podtverdil: true, razgovor: '{{system__conversation_id}}' }));
  lomat = true;
  log('9. хранилище упало, podtverdil=false', await call({ email: 'q@gmail.com', shag: 'razbor', podtverdil: false, razgovor: C }));
  log('10. хранилище упало, podtverdil=true', await call({ email: 'q@gmail.com', shag: 'razbor', podtverdil: true, razgovor: C }));
  lomat = false;
  const r = await call({ email: 'dry@gmail.com', shag: 'razbor', podtverdil: false, razgovor: 'conv_suhoy12345' }, true); sdvig += 15000;
  log('11. холостой: шаг 2 через 15 с', await call({ email: 'dry@gmail.com', shag: 'razbor', podtverdil: true, razgovor: 'conv_suhoy12345' }, true));

  // ---------- код Доводчика ----------
  const json = (k) => { const v = mem.get(k); return v == null ? null : JSON.parse(v); };
  const kodVPisme = (html) => ((html || '').match(/отправьте код\s*<b[^>]*>([A-Z0-9]{5})<\/b>/) || [])[1] || null;
  const est = (html) => (html || '').includes('Продолжить в Telegram');
  let provalov = 0;
  const proverit = (n, uslovie, podrobno = '') => { if (!uslovie) provalov++; console.log(n.padEnd(58), uslovie ? 'ДА' : 'ПРОВАЛ', podrobno); };
  const otpravit = async (email, razgovor, dop = {}, zagolovki = {}) => {
    await call({ email, shag: 'razbor', razgovor, ...dop }, false, zagolovki); sdvig += 12000;
    poslPismo = null;
    return call({ email, shag: 'razbor', podtverdil: true, razgovor, ...dop }, false, zagolovki);
  };

  console.log('\n--- код Доводчика ---');
  // 12. Флаг выключен (сценарии 3–10): письма ушли, а Blobs Доводчика не тронуты вовсе (ревью №6):
  // ни kod/*, ни razgovor-kod/*, ни pochta/* — почт и имён звонивших в новом хранилище нет.
  // Код есть только у холостого прогона (11): его выдают всегда, для прогонов.
  const boevyeKody = [...mem.keys()].filter(k => k.startsWith('kod/') && !json(k).suhoy);
  proverit('12. флаг выкл: боевых kod/* нет, razgovor-kod/<conv> нет', boevyeKody.length === 0 && !mem.has(`razgovor-kod/${C}`), boevyeKody.join(', '));
  const suhieKody = new Set([...mem.keys()].filter(k => k.startsWith('kod/')).map(k => json(k).kod));
  const chuzhayaPochta = [...mem.keys()].filter(k => k.startsWith('pochta/') && (json(k).kody || []).some(kk => !suhieKody.has(kk)));
  proverit('    pochta/* — только от холостого прогона, почты в ключах нет', chuzhayaPochta.length === 0 && ![...mem.keys()].some(k => k.startsWith('pochta/') && k.includes('@')));
  proverit('    холостой (11): код suhoy со сроком сутки', (() => { const u = json('razgovor-kod/conv_suhoy12345'); const z = u && json(`kod/${u.kod}`); return !!(z && z.suhoy === true && z.exp - z.t === 24 * 3600 * 1000); })());

  process.env.DOGON_V_PISME = '1';
  // 13. Флаг включён: блок в html, код в блоке тот же, что в Blobs, ссылка https://t.me с кодом.
  let o = await otpravit('flag.on@gmail.com', 'conv_flag1234567');
  let html = poslPismo && poslPismo.html;
  const k13 = kodVPisme(html);
  const z13 = k13 && json(`kod/${k13}`);
  proverit('13. DOGON_V_PISME=1: блок Telegram в html письма', o.ok === true && est(html) && !!z13 && z13.v_pisme === true, `код ${k13}`);
  proverit('    ссылка t.me с готовым текстом и кодом, без почты', html.includes(`https://t.me/business_int_dna?text=${encodeURIComponent(`Здравствуйте! Пишу после разговора с Верой. Код ${k13}`)}`) && !/t\.me[^"]*flag\.on/.test(html));
  proverit('    раскрытие про Claude и разговор с Верой', html.includes('модель Claude компании Anthropic') && html.includes('о чём вы говорили с Верой'));
  proverit('    Вере код в ответе не отдаётся', o.kod === undefined);

  // 14. «Не пришло» в том же разговоре — тот же код.
  sdvig += 1000; poslPismo = null;
  o = await call({ email: 'flag.on@gmail.com', shag: 'razbor', podtverdil: true, povtor: true, razgovor: 'conv_flag1234567' });
  proverit('14. povtor в том же разговоре — тот же код', o.ok === true && kodVPisme(poslPismo && poslPismo.html) === k13);

  // 15. Запись кода с ошибкой — письмо уходит, блока нет.
  porchaKoda = 'oshibka';
  const bylo = pisem;
  o = await otpravit('slomano@gmail.com', 'conv_slom1234567');
  html = poslPismo && poslPismo.html;
  proverit('15. запись kod/* с ошибкой: письмо ушло, блока нет', o.ok === true && pisem === bylo + 1 && !est(html) && ![...mem.keys()].some(k => k.startsWith('kod/') && json(k).email === 'slomano@gmail.com'));

  // 16. Запись кода висит дольше 1,5 с — письмо не ждёт, уходит без блока.
  porchaKoda = 'zavis';
  const t0 = realNow();
  o = await otpravit('medlenno@gmail.com', 'conv_zavis1234567');
  const zanyalo = realNow() - t0;
  proverit('16. запись висит 3 с: письмо ушло за ~1,5 с без блока', o.ok === true && !est(poslPismo && poslPismo.html) && zanyalo < 2500, `${zanyalo} мс`);
  porchaKoda = '';

  // 17. Форма: текст «после письма», код отдаётся zayavka.js, раскрытие без звонка.
  // Форма идёт в один шаг (адрес набран руками) — письмо уходит с первого вызова.
  poslPismo = null;
  o = await call({ email: 'forma.flag@gmail.com', shag: 'razbor', imya: 'Оля' }, false, { 'x-golos-istochnik': 'forma' });
  html = poslPismo && poslPismo.html;
  const k17 = kodVPisme(html);
  proverit('17. форма: блок, текст «после письма», код в ответе', o.ok === true && o.kod === k17 && html.includes(encodeURIComponent('Пишу после письма Business Intelligence DNA')) && !html.includes('говорили с Верой') && json(`kod/${k17}`).istochnik === 'forma' && json(`kod/${k17}`).razgovor === null);

  // 18. Resend отказал — новый код отозван (у человека его нет).
  const fetchBylo = global.fetch;
  global.fetch = async (url, opts) => { pisem++; poslPismo = JSON.parse(opts.body); return { ok: false, status: 500, text: async () => 'fail' }; };
  o = await otpravit('resend.upal@gmail.com', 'conv_resend123456');
  const k18 = kodVPisme(poslPismo && poslPismo.html);
  proverit('18. Resend отказал: ОТКАЗ, новый код стёрт', o.ok === false && !!k18 && !mem.has(`kod/${k18}`), `код ${k18}`);
  global.fetch = fetchBylo;

  // 19. Флаг — список адресов: блок только им.
  process.env.DOGON_V_PISME = 'svoy@gmail.com, drug@gmail.com';
  await otpravit('svoy@gmail.com', 'conv_spisok123456'); const s1 = est(poslPismo && poslPismo.html);
  await otpravit('chuzhoy@gmail.com', 'conv_spisok654321'); const s2 = est(poslPismo && poslPismo.html);
  proverit('19. флаг-список: свой адрес с блоком, чужой без', s1 && !s2);
  delete process.env.DOGON_V_PISME;

  // 20. Зависшая запись из 16 дописалась позже — код отозван, чтобы zvonok.js не показал его владельцу.
  await new Promise(r => setTimeout(r, 3500));
  proverit('20. опоздавшая запись кода (16) отозвана', ![...mem.keys()].some(k => k.startsWith('kod/') && json(k).email === 'medlenno@gmail.com'));

  // ---------- ревью 15.09 ----------
  console.log('\n--- ревью 15.09: имя, потолок формы, zayavka ---');
  const DEN = new Date().toISOString().slice(0, 10);
  const pervayaStroka = (h) => ((h || '').match(/font-size:17px">([^<]*(?:<[^/][^>]*>[^<]*)*)<\/p>/) || [])[1];

  // 21. Имя со ссылкой через форму: письмо уходит, но без имени и без чужой разметки (ревью №1).
  const vsegoDo = mem.get(`${DEN}:__vsego`);
  poslPismo = null;
  o = await call({ email: 'zhertva@corp.com', shag: 'razbor', imya: '<a href=//ev.il/pay>Оплатить счёт</a>' }, false, { 'x-golos-istochnik': 'forma' });
  html = (poslPismo && poslPismo.html) || '';
  proverit('21. имя-ссылка из формы: письмо без имени и без <a href=//ev.il', o.ok === true && !html.includes('ev.il') && !html.includes('Оплатить счёт') && pervayaStroka(html) === 'Здравствуйте!', pervayaStroka(html));
  poslPismo = null;
  o = await call({ email: 'imya.tochka@corp.com', shag: 'razbor', imya: 'Оплатите на evil.com' }, false, { 'x-golos-istochnik': 'forma' });
  proverit('    имя с точкой («evil.com») не выводится', o.ok === true && !((poslPismo && poslPismo.html) || '').includes('evil'));
  const vsegoPosleForm = mem.get(`${DEN}:__vsego`), formaPosle = mem.get(`${DEN}:__forma`);
  sdvig += 1000;
  let r21 = await otpravit('anna.maria@gmail.com', 'conv_imya1234567', { imya: 'Анна-Мария' });
  proverit('    нормальное имя «Анна-Мария» на месте', r21.ok === true && pervayaStroka(poslPismo && poslPismo.html) === 'Анна-Мария, здравствуйте!', pervayaStroka(poslPismo && poslPismo.html));
  r21 = await otpravit('uglovye@gmail.com', 'conv_imya7654321', { imya: 'Ирина <b>' });
  proverit('    имя с угловыми скобками от Веры — без имени', r21.ok === true && pervayaStroka(poslPismo && poslPismo.html) === 'Здравствуйте!');
  const fImya = require('fs').readFileSync(path, 'utf8');
  proverit('    экранирование внутри telo() на месте', /ekranHtml\(imya\)/.test(fImya));

  // 22. Потолок формы отдельный: форма упёрлась — звонок всё равно шлёт, __vsego формой не тронут (ревью №2).
  proverit('22. две формы из 21: __vsego не тронут, __forma вырос', vsegoPosleForm === vsegoDo && +formaPosle >= 2,
    `__vsego ${vsegoDo} → ${vsegoPosleForm}, __forma ${formaPosle}`);
  mem.set(`${DEN}:__forma`, '3');
  o = await call({ email: 'forma.limit@gmail.com', shag: 'razbor' }, false, { 'x-golos-istochnik': 'forma' });
  proverit('    форма на потолке (3): отказ', o.ok === false && /Сегодня отправить не получится/.test(o.skazat || ''));
  const vsego22 = +(mem.get(`${DEN}:__vsego`) || 0);
  const r22 = await otpravit('zvonok.posle.formy@gmail.com', 'conv_limit1234567');
  proverit('    звонок в тот же день: письмо ушло, __vsego +1, __forma не тронут', r22.ok === true && +mem.get(`${DEN}:__vsego`) === vsego22 + 1 && mem.get(`${DEN}:__forma`) === '3');

  // 23. zayavka.js: имя через публичную форму, суточный потолок уведомлений владельцу, повтор без второго уведомления.
  mem.set(`${DEN}:__forma`, '0');
  const zayavka = require(path.replace(/pismo\.js$/, 'zayavka.js')).handler;
  const vladelcu = [];
  const fetchDo23 = global.fetch;
  global.fetch = async (url, opts) => {
    if (String(url).includes('/.netlify/functions/pismo')) {
      const r = await handler({ httpMethod: 'POST', headers: opts.headers, body: opts.body });
      return { status: r.statusCode, json: async () => JSON.parse(r.body) };
    }
    const b = JSON.parse(opts.body);
    if (/^Заявка с демо/.test(b.subject || '')) vladelcu.push(b); else { pisem++; poslPismo = b; }
    return { ok: true, status: 200, text: async () => '{}' };
  };
  process.env.GOLOS_VLADELEC = 'owner@businessinteldna.com';
  process.env.GOLOS_ZAYAVOK_VLADELCU_V_SUTKI = '1';
  const zayavit = async (email, imya, ip) => JSON.parse((await zayavka({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': ip }, body: JSON.stringify({ email, imya }) })).body);
  poslPismo = null;
  let z23 = await zayavit('victim@corp.com', '<a href=//ev.il/pay>Оплатить счёт</a>', '10.0.0.1');
  html = (poslPismo && poslPismo.html) || '';
  proverit('23. zayavka: имя-ссылка → письмо человеку чистое, владельцу одно', z23.ok === true && !html.includes('ev.il') && vladelcu.length === 1);
  z23 = await zayavit('drugoy@corp.com', 'Олег', '10.0.0.2');
  proverit('    потолок уведомлений владельцу (1): вторая заявка без уведомления', z23.ok === true && vladelcu.length === 1);
  process.env.GOLOS_ZAYAVOK_VLADELCU_V_SUTKI = '20';
  z23 = await zayavit('victim@corp.com', 'Ира', '10.0.0.3');
  proverit('    тот же адрес повторно: владельцу второй раз не пишем', z23.ok === true && vladelcu.length === 1);
  global.fetch = fetchDo23;

  console.log(provalov ? `\nПРОВАЛОВ: ${provalov}` : '\nВСЕ ПРОВЕРКИ КОДА ПРОШЛИ');
  process.exitCode = provalov ? 1 : 0;
})();
