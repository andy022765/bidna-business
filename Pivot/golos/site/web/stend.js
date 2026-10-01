/* Стенд «Дежурный». Разговор идёт напрямую с облаком ElevenLabs по подписанному
   адресу — наш сервер только выдаёт этот адрес и считает квоту.

   Меряем то же, что меряет codebridge: КОНЕЦ ТВОЕЙ РЕЧИ → ПЕРВЫЙ ЗВУК ОТВЕТА.
   Это честная цифра разговора, а не время генерации на чьём-то сервере. */

const $ = s => document.querySelector(s);
const _p = new URLSearchParams(location.search);
const LINIYA = _p.get('liniya') || 'dna';
const NASH = _p.get('k') || '';   // наш ключ: звонок мимо квоты
// Метка почты (23.09). Страница «спасибо» на businessinteldna.com кладёт сюда короткий
// код, по которому сервер знает адрес человека. Самой почты в ссылке НЕТ намеренно:
// адрес осел бы в истории браузера, и любой с этой ссылкой слал бы расшифровки куда угодно.
const METKA = (_p.get('t') || '').slice(0, 40);

let ws = null, ctx = null, mic = null, session = false, dialing = false;
let vyhodRate = 16000, playhead = 0, istochniki = [];
let t0 = null;

/* ---------- лента ---------- */
const feed = $('#feed');
function stamp(){
  if (!t0) t0 = performance.now();
  const s = (performance.now() - t0) / 1000;
  return `[${String(Math.floor(s/60)).padStart(2,'0')}:${(s%60).toFixed(1).padStart(4,'0')}]`;
}
function log(cls, pre, text){
  const d = document.createElement('div');
  const span = document.createElement('span'); span.className = cls; span.textContent = pre + text;
  const t = document.createElement('span'); t.className = 't'; t.textContent = stamp();
  d.append(t, span); feed.append(d); feed.scrollTop = feed.scrollHeight;
}
const sys = m => log('sys', '· ', m);
const err = m => log('err', '✕ ', m);
const vy  = m => { bylaReplika = true; log('vy', 'ВЫ    › ', m); $('#podpis').textContent = ''; };
const ag  = m => log('ag', 'ВЕРА  › ', m);
// Видно, что она реально дёрнула инструмент, а не просто сказала «отправила».
const tool = (imya, ok, txt) => log(ok ? 'ag' : 'err', ok ? '🔧 ' : '🔧✕ ',
                                    `${imya}${txt ? ' → ' + txt : ''}`);

/* ---------- замер задержки ---------- */
const PORG = 0.02;
let poslednyayaRech = 0, agentGromkoDo = 0;
// Приветствие агента — НЕ ответ на нашу фразу. Если его мерить, в ленту попадает
// мусорная цифра вроде «44 мс» (она меряет шум микрофона против первого слова Веры).
let pervyyHodAgenta = true;
// И второй источник мусора: когда человек молчит, агент сам подаёт голос
// («Вы ещё здесь?»). Это не ответ на реплику — мерить его нельзя, иначе в медиану
// прилетают цифры вроде 9312 мс. Меряем только то, на что реально была речь.
let bylaReplika = false;
// Третий источник мусора: перебивание. Агент замолк и заговорил снова — для мерилки
// это «новый ход», и в ленту падает 41 мс. Это не ответ, а продолжение прерванного.
let bylPereboy = false;
// Четвёртый источник кривой медианы: вызов инструмента. Агент в это время не думает,
// а ходит на наш сервер за письмом или за числом мест — это работа, а не задержка
// ответа. Считаем такие ходы ОТДЕЛЬНО и в медиану разговора не кладём.
let bylInstrument = false;
const hodyInstr = [];
const hody = [];

function slyshuSebya(rms){
  volnaMic = Math.max(volnaMic, rms);
  if (rms > PORG) poslednyayaRech = performance.now();
}
function slyshuAgenta(rms){
  volnaAg = Math.max(volnaAg, rms);
  const now = performance.now();
  if (rms > PORG){
    // новый ход агента: он молчал больше 600 мс, а мы говорили меньше 10 с назад
    const novyyHod = now > agentGromkoDo + 600;
    if (novyyHod && pervyyHodAgenta){ pervyyHodAgenta = false; agentGromkoDo = now; return; }
    if (novyyHod && !bylaReplika){ agentGromkoDo = now; return; }   // агент заговорил сам
    if (novyyHod && bylPereboy){ bylPereboy = false; agentGromkoDo = now; return; }
    if (novyyHod && poslednyayaRech && now - poslednyayaRech < 10000){
      bylaReplika = false;
      const ms = Math.round(now - poslednyayaRech);
      const cherezInstrument = bylInstrument; bylInstrument = false;

      if (cherezInstrument){
        hodyInstr.push(ms);
        log('sys', '⏱ ', `${ms} мс — с вызовом инструмента (в медиану разговора не идёт)`);
      } else {
        const el = $('#lat');
        el.firstChild.textContent = ms;
        el.classList.add('svezh'); setTimeout(() => el.classList.remove('svezh'), 900);
        hody.push(ms);
        const box = $('#hody');
        const c = document.createElement('span'); c.className = 'hod'; c.textContent = ms + ' мс';
        box.append(c); while (box.children.length > 6) box.firstChild.remove();
        log('ag', '⏱ ', `${ms} мс — от конца вашей фразы до первого звука`);
      }
    }
    agentGromkoDo = now;
  }
}
const rms = buf => { let s = 0; for (let i = 0; i < buf.length; i += 4) s += buf[i]*buf[i];
                     return Math.sqrt(s / (buf.length/4)); };

/* ---------- волна ---------- */
let volnaMic = 0, volnaAg = 0, amp = 0;
(function volna(){
  const c = $('#volna'), g = c.getContext('2d');
  const W = c.width, H = c.height;
  (function risuy(){
    const cel = Math.min(1, Math.max(volnaMic, volnaAg) * 14);
    amp += (cel - amp) * (cel > amp ? .35 : .08);
    volnaMic *= .72; volnaAg *= .72;
    g.clearRect(0, 0, W, H);
    const n = 48, sh = W / n, t = performance.now() / 260;
    g.fillStyle = '#55C79A';
    for (let i = 0; i < n; i++){
      const k = Math.sin(t + i * .45) * Math.sin(t * .7 + i * .17);
      const h = Math.max(2, Math.abs(k) * amp * H * .82);
      g.globalAlpha = .25 + amp * .6;
      g.fillRect(i * sh + sh * .25, (H - h) / 2, sh * .5, h);
    }
    requestAnimationFrame(risuy);
  })();
})();

/* ---------- звук ---------- */
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
    slyshuSebya(rms(f));
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

/* ---------- состояние трубки ---------- */
const trubka = $('#trubka'), zvon = $('#zvon'), otboy = $('#otboy'), sost = $('#sost');
let tikIv = null, nachalo = 0;

function ujdiVIdle(){
  trubka.classList.remove('live');
  zvon.classList.remove('off', 'pulse'); otboy.classList.add('off');
  clearInterval(tikIv); tikIv = null;
}
function stalZhivym(){
  dialing = false; session = true;
  trubka.classList.add('live'); zvon.classList.add('off'); zvon.classList.remove('pulse');
  otboy.classList.remove('off');
  nachalo = performance.now();
  clearInterval(tikIv);
  tikIv = setInterval(() => {
    const s = (performance.now() - nachalo) / 1000;
    sost.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  }, 500);
  sost.textContent = '00:00';
}

/* ---------- звонок ---------- */
async function pozvonit(){
  if (session || dialing) return;
  dialing = true;
  t0 = null; feed.textContent = ''; $('#hody').textContent = '';
  $('#lat').firstChild.textContent = '—';
  hody.length = 0; poslednyayaRech = 0; agentGromkoDo = 0; pervyyHodAgenta = true; bylaReplika = false; bylPereboy = false;
  bylInstrument = false; hodyInstr.length = 0;
  zvon.classList.add('pulse'); sost.textContent = 'соединяем…';
  sys('набираем…');

  let url;
  try {
    const r = await fetch(`/.netlify/functions/golos-url?liniya=${encodeURIComponent(LINIYA)}`
      + (NASH ? `&k=${encodeURIComponent(NASH)}` : ''));
    const d = await r.json();
    if (!r.ok || !d.signed_url){
      err(d.text || 'линия занята — попробуйте позже');
      sost.textContent = d.text ? 'лимит на сегодня' : 'не сложилось';
      dialing = false; zvon.classList.remove('pulse'); return;
    }
    url = d.signed_url;
  } catch(e){
    err('нет связи с сервером'); sost.textContent = 'не сложилось';
    dialing = false; zvon.classList.remove('pulse'); return;
  }

  AC();
  ws = new WebSocket(url);
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch(_) { return; }

    if (m.type === 'conversation_initiation_metadata'){
      const f = m.conversation_initiation_metadata_event?.agent_output_audio_format || 'pcm_16000';
      vyhodRate = parseInt(f.split('_')[1] || '16000', 10);
      sys('линия открыта');

    } else if (m.type === 'ping'){
      ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));

    } else if (m.type === 'audio'){
      const raw = atob(m.audio_event.audio_base_64);
      const pcm = new Int16Array(raw.length / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = (raw.charCodeAt(2*i) | (raw.charCodeAt(2*i+1) << 8)) << 16 >> 16;
      const f = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
      slyshuAgenta(rms(f));
      const buf = ctx.createBuffer(1, f.length, vyhodRate);
      buf.copyToChannel(f, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(ctx.destination);
      playhead = Math.max(playhead, ctx.currentTime + .06);
      src.start(playhead); playhead += buf.duration;
      istochniki.push(src);
      if (!session) stalZhivym();

    } else if (m.type === 'interruption'){
      istochniki.forEach(s => { try { s.stop(); } catch(_){} });
      istochniki.length = 0; playhead = 0; bylPereboy = true;
      sys('вы перебили — она замолчала');

    } else if (m.type === 'agent_response'){
      ag(m.agent_response_event?.agent_response || '');

    } else if (m.type === 'agent_tool_response'){
      const e = m.agent_tool_response_event || {};
      let skazat = '';
      try {
        const r = typeof e.tool_result === 'string' ? JSON.parse(e.tool_result) : (e.tool_result || {});
        skazat = r.skazat || r.body?.skazat || '';
      } catch(_){}
      bylInstrument = true;
      tool(e.tool_name || 'инструмент', !e.is_error, skazat);

    } else if (m.type === 'user_transcript'){
      vy(m.user_transcription_event?.user_transcript || '');
    }
  };

  ws.onerror = () => err('связь оборвалась');
  ws.onclose  = () => { if (session || dialing) { sys('разговор завершён'); polozhit(true); } };

  ws.onopen = async () => {
    // Переменную отдаём ПЕРВЫМ сообщением, до звука: ElevenLabs кладёт её в запись
    // разговора, и вебхук после звонка достаёт оттуда, кому слать расшифровку.
    // Проверено живьём 23.09: переменная доезжает в conversation_initiation_client_data.
    if (METKA) {
      try { ws.send(JSON.stringify({ type: 'conversation_initiation_client_data',
                                     dynamic_variables: { metka_pochty: METKA } })); } catch(_){}
    }
    sys('микрофон…');
    try {
      mic = await mikrofon(pcm => { if (ws && ws.readyState === 1)
        ws.send(JSON.stringify({ user_audio_chunk: b64(pcm) })); });
    } catch(e){
      err('нет доступа к микрофону — разрешите его в браузере');
      polozhit(true); return;
    }
    if (!session) { stalZhivym(); sost.textContent = 'слушает…'; }
  };
}

function polozhit(tiho){
  session = false; dialing = false;
  try { mic && mic.close(); } catch(_){} mic = null;
  try { ws && ws.close(); } catch(_){} ws = null;
  istochniki.forEach(s => { try { s.stop(); } catch(_){} });
  istochniki.length = 0; playhead = 0;
  ujdiVIdle();
  if (hody.length){
    const med = a => { const x = [...a].sort((p,q) => p-q); return x[Math.floor(x.length/2)]; };
    const m = med(hody);
    sost.textContent = `медиана ${m} мс`;
    const hvost = hodyInstr.length
      ? `; с инструментом ${hodyInstr.length} — медиана ${med(hodyInstr)} мс` : '';
    log('sys', '· ', `ответов: ${hody.length}, медиана разговора ${m} мс${hvost}`);
  } else if (!tiho){
    sost.textContent = 'готова ответить';
  } else {
    sost.textContent = 'готова ответить';
  }
}

zvon.onclick  = pozvonit;
otboy.onclick = () => polozhit(false);
addEventListener('beforeunload', () => { try { ws && ws.close(); } catch(_){} });
