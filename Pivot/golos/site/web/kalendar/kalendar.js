/* Демо записи в календарь: слева разговор с Верой, справа настоящий календарь владельца.

   ЭТО КОПИЯ web/demo/demo.js. Движок разговора взят оттуда БЕЗ правок логики, чтобы демо,
   которое Андрей уже обкатал, не поехало. Отличий ровно четыре: линия kalendar, самоссылка
   на себя, предел 240 с и блок календаря в конце файла.
   ПРАВИШЬ ЗВУК ИЛИ ТАЙМЕР — ПРАВЬ ОБА ФАЙЛА: сверки между ними нет, и разъедутся они молча.

   (шапка исходника) Демо Веры для сайта: три минуты разговора.
   Звуковой движок взят из стенда (../stend.js), здесь только то, что нужно витрине:
   таймер, подсказка агенту за 30 секунд до конца и форма, если линия недоступна. */

const $ = s => document.querySelector(s);
const _p = new URLSearchParams(location.search);
const NASH = _p.get('k') || '';                 // наш ключ — мимо квоты, для проверок
const LIMIT = 240;          // четыре минуты: запись требует больше слов, чем вопрос о цене
                            // (цель, дата, длительность, имя, почта по буквам, пояс).
                            // Потолок у самого агента тоже 240 с — трубку кладёт страница.
const PREDUPREDIT = 40;     // подсказка «осталось 30 с»: Вера отвечает с задержкой ~2 с и в следующей реплике
const ZHDAT_PROSHCHANIYA = 25;  // сколько ждём прощальную реплику после «время вышло», потом кладём трубку
// Потолок вендора у агента 240 с — это страховка. Трубку кладёт страница, когда Вера договорит.

let ws = null, ctx = null, mic = null;
let idyot = false, nabor = false;
let vyhodRate = 16000, playhead = 0, istochniki = [];
let start = 0, tik = null, podskazano = false;
let zvukBylo = false, taymerIdet = false, slezhka = null, otkryto = 0;
let finalOtpravlen = false, finalVremya = 0, zvukPosleFinala = false;
let posledniyZvuk = 0;
const govorit = () => (ctx && playhead > ctx.currentTime) || performance.now() - posledniyZvuk < 1000;

/* ---------- защита от старой вкладки ----------
   14.09 Андрей звонил со вкладки, открытой до выкладки: кнопка «Позвонить ещё раз»
   не перечитывает код, и старая страница говорила с новым промптом. Сверяем отпечаток
   demo.js перед каждым звонком; изменился — перезагружаем страницу. */
const otpechatok = () => fetch('kalendar.js', { method: 'HEAD', cache: 'no-store' })
  .then(r => r.headers.get('etag') || '').catch(() => '');
const MOY_OTPECHATOK = otpechatok();

const karta = $('#karta'), knopka = $('#knopka'), sost = $('#sost'), podpis = $('#podpis');

/* ---------- подпись: последние реплики ---------- */
const repliki = [];
function replika(kto, text){
  if (!text || text.startsWith('[САЙТ]')) return;
  repliki.push([kto, text]); while (repliki.length > 2) repliki.shift();
  podpis.innerHTML = '';
  for (const [k, t] of repliki){
    const d = document.createElement('div');
    const s1 = document.createElement('span'); s1.className = k === 'vera' ? 'vera' : 'kto';
    s1.textContent = k === 'vera' ? 'Вера: ' : 'Вы: ';
    const s2 = document.createElement('span'); s2.textContent = t;
    d.append(s1, s2); podpis.append(d);
  }
}

/* ---------- звук (как в стенде) ---------- */
function AC(){
  if (!ctx || ctx.state === 'closed') ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
async function mikrofon(onPcm){
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const ratio = ctx.sampleRate / 16000;
  let acc = [];
  proc.onaudioprocess = e => {
    const f = e.inputBuffer.getChannelData(0);
    const out = new Int16Array(Math.floor(f.length / ratio));
    for (let i = 0; i < out.length; i++){
      const v = f[Math.floor(i * ratio)];
      out[i] = Math.max(-32768, Math.min(32767, v * 32767));
    }
    acc.push(out);
    const total = acc.reduce((n, a) => n + a.length, 0);
    if (total >= 4000){
      const m = new Int16Array(total); let o = 0;
      for (const a of acc) { m.set(a, o); o += a.length; }
      acc = []; onPcm(m);
    }
  };
  src.connect(proc); proc.connect(ctx.destination);
  return { close(){ proc.disconnect(); src.disconnect(); stream.getTracks().forEach(t => t.stop()); } };
}
const b64 = a => { let s = ''; const u = new Uint8Array(a.buffer);
                   for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };

/* ---------- таймер ---------- */
function mmss(sek){ sek = Math.max(0, Math.ceil(sek)); return `${Math.floor(sek/60)}:${String(sek%60).padStart(2,'0')}`; }
function zapustitTaymer(){
  start = performance.now(); podskazano = false; taymerIdet = true;
  finalOtpravlen = false; zvukPosleFinala = false;
  $('#taymerBlok').hidden = false;
  clearInterval(tik);
  tik = setInterval(() => {
    const proshlo = (performance.now() - start) / 1000;
    const ostalos = LIMIT - proshlo;
    $('#vremya').textContent = mmss(ostalos);
    $('#polosa').style.width = Math.max(0, ostalos / LIMIT * 100) + '%';
    karta.classList.toggle('malo', ostalos <= 30);

    // Подсказка: человек её не слышит, разговор она не перебивает.
    if (!podskazano && ostalos <= PREDUPREDIT && ws && ws.readyState === 1){
      podskazano = true;
      ws.send(JSON.stringify({ type: 'contextual_update', text: '[САЙТ] осталось тридцать секунд' }));
    }
    if (ostalos <= 30 && ostalos > 0) sost.textContent = 'осталось полминуты';

    // Время вышло. Не режем на полуслове: ждём, пока Вера договорит, и просим попрощаться.
    // user_message, а не contextual_update — иначе в тишине она не заговорит.
    if (ostalos <= 0 && !finalOtpravlen && ws && ws.readyState === 1 && !govorit()){
      finalOtpravlen = true; finalVremya = performance.now();
      sost.textContent = 'время вышло — Вера прощается';
      ws.send(JSON.stringify({ type: 'user_message', text: '[САЙТ] время вышло' }));
    }
    if (finalOtpravlen){
      const zhdom = (performance.now() - finalVremya) / 1000;
      // договорила: звук после финала был и уже доиграл, плюс секунда тишины
      if ((zvukPosleFinala && !govorit() && ctx.currentTime > playhead + 1.2) || zhdom > ZHDAT_PROSHCHANIYA)
        polozhit('vremya');
    }
  }, 250);
}

// Три минуты начинаются, когда Вера ДОГОВОРИЛА приветствие: человек не должен
// терять 15 секунд на то, что говорит не он.
function zhdatKoncaPrivetstviya(){
  otkryto = performance.now();
  clearInterval(slezhka);
  slezhka = setInterval(() => {
    if (taymerIdet){ clearInterval(slezhka); return; }
    const tishina = zvukBylo && ctx && ctx.currentTime > playhead + 0.4;
    const zazhdalis = !zvukBylo && (performance.now() - otkryto) > 10000;
    if (tishina || zazhdalis){ clearInterval(slezhka); zapustitTaymer(); }
  }, 200);
}

/* ---------- форма ---------- */
function pokazatFormu(tekst){
  $('#formaTekst').textContent = tekst;
  $('#forma').style.display = 'block';
}
$('#forma').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#fEmail').value.trim();
  const otv = $('#formaOtvet');
  if (!email) { otv.style.color = 'var(--krasn)'; otv.textContent = 'Впишите почту.'; return; }
  $('#fKnopka').disabled = true; otv.style.color = 'var(--tusklo)'; otv.textContent = 'Отправляем…';
  try {
    const r = await fetch('/.netlify/functions/zayavka', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, imya: $('#fImya').value.trim(), sayt: $('#fSayt').value }) });
    const d = await r.json();
    otv.style.color = d.ok ? 'var(--zel)' : 'var(--krasn)';
    otv.textContent = d.text || (d.ok ? 'Готово.' : 'Не получилось.');
    if (!d.ok) $('#fKnopka').disabled = false;
  } catch (_) {
    otv.style.color = 'var(--krasn)'; otv.textContent = 'Нет связи. Напишите на support@businessinteldna.com.';
    $('#fKnopka').disabled = false;
  }
});

/* ---------- звонок ---------- */
async function pozvonit(){
  if (idyot || nabor) return;
  nabor = true;
  const [moy, seychas] = await Promise.all([MOY_OTPECHATOK, otpechatok()]);
  if (moy && seychas && moy !== seychas){
    sost.textContent = 'страница обновилась — нажмите «Позвонить» ещё раз';
    location.reload(); return;
  }
  repliki.length = 0; podpis.textContent = '';
  start = 0; zvukBylo = false; taymerIdet = false; finalOtpravlen = false; zvukPosleFinala = false;
  $('#taymerBlok').hidden = true; $('#vremya').textContent = mmss(LIMIT); $('#polosa').style.width = '100%';
  $('#forma').style.display = 'none';
  knopka.disabled = true; sost.textContent = 'соединяем…';

  let url;
  try {
    const r = await fetch(`/.netlify/functions/golos-url?liniya=kalendar` + (NASH ? `&k=${encodeURIComponent(NASH)}` : ''));
    const d = await r.json();
    if (!r.ok || !d.signed_url){
      nabor = false; knopka.disabled = false;
      if (r.status === 429){
        sost.textContent = 'линия занята';
        knopka.hidden = true;
        pokazatFormu(d.text || 'Сейчас все линии заняты. Оставьте почту — пришлём, с чего начать.');
      } else {
        sost.textContent = 'не сложилось — попробуйте через минуту';
        pokazatFormu('Линия сейчас недоступна. Оставьте почту — пришлём, с чего начать.');
      }
      return;
    }
    url = d.signed_url;
  } catch (_) {
    nabor = false; knopka.disabled = false;
    sost.textContent = 'нет связи'; pokazatFormu('Нет связи с линией. Оставьте почту — пришлём, с чего начать.');
    return;
  }

  AC();
  ws = new WebSocket(url);
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch(_) { return; }
    if (m.type === 'conversation_initiation_metadata'){
      const f = m.conversation_initiation_metadata_event?.agent_output_audio_format || 'pcm_16000';
      vyhodRate = parseInt(f.split('_')[1] || '16000', 10);
    } else if (m.type === 'ping'){
      ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
    } else if (m.type === 'audio'){
      const raw = atob(m.audio_event.audio_base_64);
      const pcm = new Int16Array(raw.length / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = (raw.charCodeAt(2*i) | (raw.charCodeAt(2*i+1) << 8)) << 16 >> 16;
      const f = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
      const buf = ctx.createBuffer(1, f.length, vyhodRate);
      buf.copyToChannel(f, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination);
      playhead = Math.max(playhead, ctx.currentTime + .06);
      src.start(playhead); playhead += buf.duration;
      istochniki.push(src);
      zvukBylo = true; posledniyZvuk = performance.now();
      if (finalOtpravlen) zvukPosleFinala = true;
    } else if (m.type === 'interruption'){
      istochniki.forEach(s => { try { s.stop(); } catch(_){} });
      istochniki.length = 0; playhead = 0;
    } else if (m.type === 'agent_response'){
      replika('vera', m.agent_response_event?.agent_response || '');
    } else if (m.type === 'user_transcript'){
      const slova = m.user_transcription_event?.user_transcript || '';
      replika('vy', slova);
      if (idyot && !taymerIdet && slova.replace(/[.\s…]/g, '')) zapustitTaymer();
    }
  };
  ws.onerror = () => { sost.textContent = 'связь оборвалась'; };
  ws.onclose = () => { if (idyot || nabor) polozhit('zakryto'); };
  ws.onopen = async () => {
    try {
      mic = await mikrofon(pcm => { if (ws && ws.readyState === 1)
        ws.send(JSON.stringify({ user_audio_chunk: b64(pcm) })); });
    } catch (_) {
      sost.textContent = 'нужен доступ к микрофону — разрешите его в браузере';
      polozhit('mikrofon'); return;
    }
    nabor = false; idyot = true;
    karta.classList.add('live');
    knopka.disabled = false; knopka.textContent = 'Положить трубку'; knopka.classList.add('otboy');
    sost.textContent = 'на линии';
    zhdatKoncaPrivetstviya();
  };
}

function polozhit(prichina){
  const bylRazgovor = idyot;
  idyot = false; nabor = false;
  clearInterval(tik); tik = null; clearInterval(slezhka); slezhka = null; taymerIdet = false;
  try { mic && mic.close(); } catch(_){} mic = null;
  try { ws && ws.close(); } catch(_){} ws = null;
  istochniki.forEach(s => { try { s.stop(); } catch(_){} });
  istochniki.length = 0; playhead = 0;
  karta.classList.remove('live', 'malo');
  knopka.disabled = false; knopka.classList.remove('otboy'); knopka.textContent = 'Позвонить ещё раз';

  if (prichina === 'mikrofon') return;
  if (bylRazgovor){
    const proshlo = start ? (performance.now() - start) / 1000 : 0;
    sost.textContent = proshlo >= LIMIT ? 'время вышло' : 'разговор завершён';
    $('#vremya').textContent = '0:00'; $('#polosa').style.width = '0%';
    pokazatFormu('Не успели продиктовать почту? Оставьте здесь — пришлём, с чего начать.');
  }
}

knopka.addEventListener('click', () => { if (idyot) polozhit('ruchnoy'); else pozvonit(); });
addEventListener('beforeunload', () => { try { ws && ws.close(); } catch(_){} });

/* ======================================================================
   ПРАВЫЙ СТОЛБЕЦ — КАЛЕНДАРЬ ВЛАДЕЛЬЦА

   Два глаза нарочно, и они проверяют друг друга:

   1) РАМКА — встроенный календарь с calendar.google.com. Панель НЕ наша, подделать её
      нельзя, и она всегда живая. Это главное доказательство. Проверено 24.09: страница
      встроенного вида не ставит X-Frame-Options, в рамку пускает.
   2) СПИСОК — текст из нашей функции, читающей публичную выгрузку .ics. Он нужен потому,
      что у нас правило: «не вытаскивается через curl — значит этого на странице нет».
      Список вытаскивается: /.netlify/functions/kalendar-sobytiya
      У него есть ЧЕСТНЫЙ изъян: Google кэширует .ics и насколько — не обещает. Поэтому
      список может отставать от рамки. Так и подписано на странице, а не спрятано.

   Рамку перезагружаем ДВУМЯ кадрами по очереди: обычная перезагрузка мигает белым,
   а на тёмной странице это выглядит поломкой. Пока грузится скрытый — виден прежний.
   Автообновление только во время разговора: перезагрузка сбрасывает навигацию внутри
   календаря, и делать это, когда человек сам листает недели, — мешать ему.
   ====================================================================== */

const ADRES_SOBYTIY = '/.netlify/functions/kalendar-sobytiya';
const CHASTO = 4000;    // во время разговора
const REDKO  = 30000;   // когда разговора нет

let kalUrl = '', kalVidim = 'A', kalZnali = null, kalGruzitsya = false;

const kadr = bukva => document.getElementById('kadr' + bukva);

function kalendarPerezagruzit() {
  if (!kalUrl || kalGruzitsya) return;
  const drugaya = kalVidim === 'A' ? 'B' : 'A';
  const skrytyy = kadr(drugaya);
  if (!skrytyy) return;
  kalGruzitsya = true;
  skrytyy.onload = () => {
    kadr(kalVidim).classList.remove('vidno');
    skrytyy.classList.add('vidno');
    kalVidim = drugaya;
    kalGruzitsya = false;
  };
  // Метка времени в адресе: без неё браузер отдаёт рамку из своего кэша, и «живой»
  // календарь показывает то, что было. Google лишний параметр игнорирует.
  skrytyy.src = kalUrl + '&_=' + Date.now();
}

function pokazatVremya(s, poyas, ves_den) {
  if (!s) return '';
  const g = s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
  const mes = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
               'августа', 'сентября', 'октября', 'ноября', 'декабря'][m - 1] || '';
  if (ves_den) return d + ' ' + mes + ', весь день';
  const ch = s.slice(9, 11), mi = s.slice(11, 13);
  const pripiska = poyas ? ' · ' + poyas : (s.endsWith('Z') ? ' · UTC' : '');
  return d + ' ' + mes + ', ' + ch + ':' + mi + pripiska;
}

function kalendarNarisovat(d) {
  const spisok = document.getElementById('spisok');
  const vzyato = document.getElementById('vzyato');
  if (!spisok) return;

  if (!d || !d.ok) {
    // Не молчим и не притворяемся пустым календарём: пустой список и «не подключено»
    // это разные вещи, и путать их — ровно та ошибка, за которую мы ругаем других.
    spisok.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'pusto beda';
    p.textContent = (d && d.text) || 'Функция календаря не отвечает.';
    spisok.appendChild(p);
    if (vzyato) vzyato.textContent = '';
    return;
  }

  if (!kalUrl && d.vstroennyy) {
    kalUrl = d.vstroennyy;
    kadr('A').src = kalUrl;
    kadr('A').classList.add('vidno');
    const otkryt = document.getElementById('otkryt');
    if (otkryt) { otkryt.href = kalUrl; otkryt.hidden = false; }
  }

  const klyuch = s => s.nachalo + '|' + s.nazvanie;
  const teper = new Set((d.sobytiya || []).map(klyuch));
  let novoe = null;
  if (kalZnali) for (const k of teper) if (!kalZnali.has(k)) novoe = k;
  kalZnali = teper;

  spisok.innerHTML = '';
  if (!(d.sobytiya || []).length) {
    const p = document.createElement('div');
    p.className = 'pusto';
    p.textContent = 'Записей на ближайшие ' + d.dney_vpered + ' дней нет. '
                  + 'Попросите Веру записать вас — строка появится здесь.';
    spisok.appendChild(p);
  }
  for (const s of d.sobytiya || []) {
    const row = document.createElement('div');
    row.className = 'zapis' + (klyuch(s) === novoe ? ' novaya' : '');
    const kogda = document.createElement('div');
    kogda.className = 'kogda';
    kogda.textContent = pokazatVremya(s.nachalo, s.poyas, s.ves_den);
    const chto = document.createElement('div');
    chto.className = 'chto';
    chto.textContent = s.nazvanie || 'без названия';
    row.appendChild(kogda); row.appendChild(chto);
    if (s.gosti && s.gosti.length) {
      const g = document.createElement('div');
      g.className = 'gost';
      g.textContent = 'гость: ' + s.gosti.join(', ');
      row.appendChild(g);
    }
    spisok.appendChild(row);
  }

  if (vzyato) {
    const t = new Date(d.vzyato);
    vzyato.textContent = 'сверено в ' + String(t.getHours()).padStart(2, '0') + ':'
                       + String(t.getMinutes()).padStart(2, '0') + ':'
                       + String(t.getSeconds()).padStart(2, '0');
  }
  if (novoe) kalendarPerezagruzit();
}

async function kalendarProchitat() {
  try {
    const r = await fetch(ADRES_SOBYTIY, { cache: 'no-store' });
    kalendarNarisovat(await r.json());
  } catch (e) {
    kalendarNarisovat({ ok: false, text: 'Не дозвонились до своей же функции: ' + e.message });
  }
}

// Один таймер на всё: сам смотрит, идёт ли разговор. Два таймера с разной частотой
// однажды разъехались бы, и один остался бы висеть после отбоя.
let kalProshloe = 0;
setInterval(() => {
  const nado = idyot ? CHASTO : REDKO;
  if (Date.now() - kalProshloe < nado) return;
  kalProshloe = Date.now();
  kalendarProchitat();
  if (idyot) kalendarPerezagruzit();
}, 1000);

const knopkaObnovit = document.getElementById('obnovit');
if (knopkaObnovit) knopkaObnovit.addEventListener('click', () => {
  kalProshloe = Date.now();
  kalendarProchitat();
  kalendarPerezagruzit();
});

kalendarProchitat();
