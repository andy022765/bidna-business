// Живой прогон записи в календарь. Симуляция ElevenLabs здесь не годится: она инструменты
// НЕ выполняет, а отдаёт заглушку «Tool Called» — значит настоящей записи ей не доказать.
// Здесь открывается настоящий разговор по сокету, и инструменты срабатывают по-настоящему.
// Запуск: node Pivot/golos/proverka/progon_zapis.mjs <agent_id>

const agentId = process.argv[2] || 'agent_6601m3b4dr6ve48b0p0wkne7ecdb';
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('нет ELEVENLABS_API_KEY'); process.exit(2); }

const REPLIKI = [
  'Здравствуйте. Хочу записаться на разговор.',
  'Когда у вас ближайшее свободное? Я в Нью-Йорке.',
  'Давайте первое, которое вы назвали.',
  'Почта: a n d r i i, плюс, k a l e n d a r, собака, b u s i n e s s i n t e l d n a, точка, com',
  'Да, всё верно.',
  'Пётр. Поговорить хочу про приём звонков.',
  'Спасибо, всё.',
];

const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
                      { headers: { 'xi-api-key': key } });
const { signed_url } = await r.json();
const ws = new WebSocket(signed_url);
const pauza = ms => new Promise(x => setTimeout(x, ms));
let convId = null, novyh = 0, posl = Date.now(), playhead = 0;

ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.type === 'conversation_initiation_metadata') convId = m.conversation_initiation_metadata_event.conversation_id;
  else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
  else if (m.type === 'audio') { posl = Date.now(); playhead = Math.max(playhead, Date.now()) + Buffer.from(m.audio_event.audio_base_64, 'base64').length / 32; }
  else if (m.type === 'agent_response') { posl = Date.now(); novyh++; }
};
const doigrala = async () => {
  const t = Date.now();
  while (!novyh && Date.now() - t < 20000) await pauza(100);
  await pauza(1200);
  while ((Date.now() < playhead + 700 || Date.now() - posl < 1400) && Date.now() - t < 40000) await pauza(150);
};
const tishina = Buffer.alloc(8000).toString('base64');

ws.onopen = async () => {
  const iv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ user_audio_chunk: tishina })), 250);
  await doigrala();                                   // приветствие
  for (const t of REPLIKI) { novyh = 0; ws.send(JSON.stringify({ type: 'user_message', text: t })); await doigrala(); }
  clearInterval(iv); ws.close();
  await pauza(7000);

  let d = {};
  for (let i = 0; i < 5; i++) {
    d = await (await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${convId}`, { headers: { 'xi-api-key': key } })).json();
    if ((d.transcript || []).length > 3) break;
    await pauza(4000);
  }
  const tr = d.transcript || [];
  const rez = {};
  tr.forEach(t => (t.tool_results || []).forEach(x => rez[x.request_id] = x.result_value));

  console.log('=== РАСШИФРОВКА ===');
  for (const t of tr) {
    const m = (t.original_message || t.message || '').trim();
    if (m) console.log(`${t.role === 'user' ? 'ОН:  ' : 'ВЕРА:'} ${m}`);
    for (const c of (t.tool_calls || [])) {
      console.log(`      → ${c.tool_name} ${(c.params_as_json || '').slice(0, 200)}`);
      const o = rez[c.request_id];
      if (o) console.log(`      ← ${String(o).slice(0, 300)}`);
    }
  }
  const zapisi = tr.flatMap(t => (t.tool_calls || []).filter(c => c.tool_name === 'zapisat_na_vstrechu')
    .map(c => { let o = {}; try { o = JSON.parse(rez[c.request_id] || '{}'); } catch (_) {} return o; }));
  const udalos = zapisi.find(z => z.zapisano === true);
  console.log('\n=== ИТОГ ===');
  console.log('разговор:', convId);
  console.log('вызовов записи:', zapisi.length, '· записалось:', !!udalos);
  if (udalos) console.log('uri:', udalos.uri, '\nсобытие:', udalos.sobytie, '\nвремя:', udalos.start_time);
  process.exit(udalos ? 0 : 1);
};
