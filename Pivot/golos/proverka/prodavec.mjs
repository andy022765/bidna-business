// Прогон продавческих сценариев на холостом агенте. node prodavec.mjs <agent_id> <сценарий> <метка>
// Письма не уходят: у холостого агента инструмент с x-golos-suhoy.
import { readFileSync } from 'node:fs';
const [agentId, scen, metka] = process.argv.slice(2);
const repliki = JSON.parse(readFileSync(new URL('./scenarii_prodavec.json', import.meta.url)))[scen];
const key = process.env.ELEVENLABS_API_KEY;
const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, { headers: { 'xi-api-key': key } });
const ws = new WebSocket((await r.json()).signed_url);
const pauza = ms => new Promise(r => setTimeout(r, ms));
let playhead = 0, posl = Date.now(), convId = null, novyh = 0;
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.type === 'conversation_initiation_metadata') convId = m.conversation_initiation_metadata_event.conversation_id;
  else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
  else if (m.type === 'audio') { posl = Date.now(); playhead = Math.max(playhead, Date.now()) + Buffer.from(m.audio_event.audio_base_64, 'base64').length / 32; }
  else if (m.type === 'agent_response') { posl = Date.now(); novyh++; }
  else if (m.type === 'agent_tool_response') posl = Date.now();
};
// ждём ответ и дольше тишины: у модели бывают рассуждения на 2–3 с, раньше скрипт её перебивал
const doigrala = async () => { const t = Date.now(); while (!novyh && Date.now() - t < 20000) await pauza(100); await pauza(2500); while ((Date.now() < playhead + 900 || Date.now() - posl < 2500) && Date.now() - t < 40000) await pauza(150); };
const tishina = Buffer.alloc(8000).toString('base64');
ws.onopen = async () => {
  const iv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ user_audio_chunk: tishina })), 250);
  novyh = 0; await doigrala();
  for (const t of repliki) {
    if (t === '@@30') { ws.send(JSON.stringify({ type: 'contextual_update', text: '[САЙТ] осталось тридцать секунд' })); await pauza(1000); continue; }
    novyh = 0; ws.send(JSON.stringify({ type: 'user_message', text: t })); await doigrala();
  }
  clearInterval(iv); ws.close(); await pauza(9000);
  let d = {};
  for (let i = 0; i < 5; i++) { d = await (await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${convId}`, { headers: { 'xi-api-key': key } })).json(); if ((d.transcript || []).length > 4 && d.status === 'done') break; await pauza(5000); }
  const rez = {}; (d.transcript || []).forEach(t => (t.tool_results || []).forEach(x => rez[x.request_id] = x.result_value));
  const hod = (d.transcript || []).map(t => {
    const met = ((t.conversation_turn_metrics || {}).metrics || {});
    const calls = (t.tool_calls || []).map(c => `${c.tool_name}(${c.params_as_json}) → ${(rez[c.request_id] || '').slice(0, 90)}`);
    return { kto: t.role === 'agent' ? 'ВЕРА' : 'ЧЕЛОВЕК', text: t.original_message || t.message || '', instrumenty: calls,
      ttfb: met.convai_llm_service_ttfb ? +met.convai_llm_service_ttfb.elapsed_time.toFixed(2) : null, rassuzhdala: !!t.reasoned };
  }).filter(h => h.text || h.instrumenty.length);
  console.log(JSON.stringify({ metka, scen, convId, hod }));
  process.exit(0);
};
setTimeout(() => { console.log(JSON.stringify({ metka, scen, oshibka: 'таймаут' })); process.exit(0); }, 360000);
