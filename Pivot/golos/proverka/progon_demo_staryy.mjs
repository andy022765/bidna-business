// ВНИМАНИЕ: Вера реально шлёт «клиентское» письмо на andrii+progon@ (падает в ящик support@ с пометкой progon) и письмо владельцу на bizzinteldna@.
// Текстовый прогон демо-Веры: те же шаги, что у Андрея, плюс отметки сайта.
const key = process.env.ELEVENLABS_API_KEY;
const r = await fetch('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=agent_8501m2f3wdhye8fadxmks4z8hp31', { headers: { 'xi-api-key': key } });
const { signed_url } = await r.json();
const ws = new WebSocket(signed_url);
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
let zhdu = null, playhead = 0;
const otvet = () => new Promise(res => { zhdu = res; });
const pauza = ms => new Promise(r => setTimeout(r, ms));
const doigrala = async () => { await pauza(1500); while (Date.now() < playhead + 800) await pauza(200); };
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
  else if (m.type === 'audio') { const dur = Buffer.from(m.audio_event.audio_base_64, 'base64').length / 2 / 16000; playhead = Math.max(playhead, Date.now()) + dur * 1000; }
  else if (m.type === 'agent_response') { console.log(T(), 'ВЕРА:', m.agent_response_event.agent_response); if (zhdu) { const z = zhdu; zhdu = null; z(); } }
  else if (m.type === 'agent_tool_response') console.log(T(), '   [инструмент]', m.agent_tool_response?.tool_name);
};
const tishina = Buffer.alloc(8000).toString('base64');
ws.onopen = async () => {
  const iv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ user_audio_chunk: tishina })), 250);
  await otvet(); await doigrala();
  const skazat = async (t) => { console.log(T(), 'Я:   ', t); ws.send(JSON.stringify({ type: 'user_message', text: t })); await otvet(); await doigrala(); };
  await skazat('Расскажите, пожалуйста, о ваших продуктах.');
  await skazat('А какие у вас цифровые сотрудники?');
  await skazat('Пришлите мне на почту, andrii+progon@businessinteldna.com');
  await skazat('Да, верно.');
  await skazat('А можно соединить с живым специалистом?');
  console.log(T(), '>>> сайт: [САЙТ] осталось тридцать секунд');
  ws.send(JSON.stringify({ type: 'contextual_update', text: '[САЙТ] осталось тридцать секунд' }));
  await pauza(1500);
  await skazat('А сколько это стоит?');
  await skazat('[САЙТ] время вышло');
  await pauza(3000);
  clearInterval(iv); ws.close(); process.exit(0);
};
setTimeout(() => { console.log('ТАЙМАУТ'); process.exit(1); }, 240000);
