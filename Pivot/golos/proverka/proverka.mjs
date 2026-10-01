// Проверка двухшаговой отправки. node proverka.mjs <agent_id> <метка> <gryaz|chisto>
const [agentId, metka, scen] = process.argv.slice(2);
const key = process.env.ELEVENLABS_API_KEY;
const SCEN = {
  gryaz: { zhdu: 'andywar777@gmail.com', repliki: [
    'Э-э-э, здравствуйте, Вера. Скажите мне, что, какие продукты у вас есть, что вы предлагаете?',
    'Э-э-э, да, отправьте. А потом я ещё задам пару вопросов.',
    'ngwar777@gmail.com.', 'Нет.', 'A-N-G-Y-W-A-R, сэм, сэм, сэм, @gmail.com.', 'Нет, не джи, а ди.',
    'Нет, неверно. Вы неправильно п-- э-э-э, записываете адрес. Эй эн ди, а не джи. Энди.', 'Да.', 'Да, верно.'] },
  chisto: { zhdu: 'andrii+progon@businessinteldna.com', repliki: [
    'Расскажите коротко, что у вас есть?', 'Да, пришлите на почту. Потом ещё пару вопросов задам.',
    'angrii+progon@businessinteldna.com', 'Нет, не джи, а ди. Эй, эн, ди.', 'Да, верно.',
    '@@30', 'А сколько стоит диагностика?', '[САЙТ] время вышло'] },
}[scen];
const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, { headers: { 'xi-api-key': key } });
const ws = new WebSocket((await r.json()).signed_url);
const pauza = ms => new Promise(r => setTimeout(r, ms));
let playhead = 0, posl = Date.now(), convId = null, novyh = 0, otpr = 0;
const hod = []; let cur = null;
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.type === 'conversation_initiation_metadata') convId = m.conversation_initiation_metadata_event.conversation_id;
  else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
  else if (m.type === 'audio') { posl = Date.now(); if (cur && cur.ms == null) cur.ms = Date.now() - otpr; playhead = Math.max(playhead, Date.now()) + Buffer.from(m.audio_event.audio_base_64, 'base64').length / 32; }
  else if (m.type === 'agent_response') { posl = Date.now(); novyh++; if (cur) cur.v.push(m.agent_response_event.agent_response); }
  else if (m.type === 'agent_tool_response') posl = Date.now();
};
const doigrala = async () => { const t = Date.now(); while (!novyh && Date.now() - t < 15000) await pauza(100); await pauza(1300); while ((Date.now() < playhead + 700 || Date.now() - posl < 1300) && Date.now() - t < 30000) await pauza(150); };
const tishina = Buffer.alloc(8000).toString('base64');
ws.onopen = async () => {
  const iv = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ user_audio_chunk: tishina })), 250);
  cur = { ya: '(приветствие)', v: [] }; hod.push(cur); await doigrala();
  for (const t of SCEN.repliki) {
    if (t === '@@30') { ws.send(JSON.stringify({ type: 'contextual_update', text: '[САЙТ] осталось тридцать секунд' })); await pauza(1000); continue; }
    // в грязном сценарии «Да, верно» говорим, только если ещё ничего не ушло
    if (scen === 'gryaz' && t === 'Да, верно.' && hod.some(h => h.v.join(' ').match(/отправила/i))) break;
    novyh = 0; cur = { ya: t, v: [], ms: null }; hod.push(cur); otpr = Date.now();
    ws.send(JSON.stringify({ type: 'user_message', text: t })); await doigrala();
  }
  clearInterval(iv); ws.close();
  await pauza(7000);
  let d = {};
  for (let i = 0; i < 4; i++) { d = await (await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${convId}`, { headers: { 'xi-api-key': key } })).json(); if ((d.transcript || []).length > 3) break; await pauza(4000); }
  const tr = d.transcript || [];
  const rez = {}; tr.forEach(t => (t.tool_results || []).forEach(x => rez[x.request_id] = x.result_value));
  const vyzovy = tr.flatMap(t => (t.tool_calls || []).filter(x => x.tool_name === 'otpravit_ssylku').map(x => {
    const p = JSON.parse(x.params_as_json || '{}'); let o = {}; try { o = JSON.parse(rez[x.request_id] || '{}'); } catch (_) {}
    return { email: p.email, podtv: p.podtverdil, ushlo: o.ok === true && o.otpravleno !== false };
  }));
  const ushli = vyzovy.filter(v => v.ushlo).map(v => v.email);
  const agent = tr.filter(t => t.role === 'agent').map(t => t.original_message || t.message || '');
  const llm = [...new Set(tr.map(t => t.producing_llm).filter(Boolean))];
  const vyhod = tr.filter(t => t.role === 'agent').map(t => Object.values((t.llm_usage || {}).model_usage || {}).reduce((n, v) => n + ((v.output_total || {}).tokens || 0), 0));
  const maxVyhod = Math.max(0, ...vyhod), rassuzhdala = tr.filter(t => t.reasoned).length;
  const ms = hod.map(h => h.ms).filter(Boolean).sort((a, b) => a - b);
  const posl2 = hod[hod.length - 1].v.join(' '), predposl = hod[hod.length - 2]?.v.join(' ') || '';
  console.log(JSON.stringify({ metka, scen, convId, llm, maxVyhod, rassuzhdala,
    utechka: agent.filter(a => /"imya"|"shag"|"povtor"|"podtverdil"|"segment"|[{}]/.test(a)).length,
    ushli, verno: ushli.length > 0 && ushli.every(e => e === SCEN.zhdu),
    zachityvala: agent.filter(a => /Проверю по буквам/.test(a)).length,
    vyzovov: vyzovy.length, podtv_rano: vyzovy.filter(v => v.podtv && !v.ushlo).length,
    predupr: scen === 'chisto' ? predposl.trim().startsWith('У нас осталось полминуты') : null,
    proshch: scen === 'chisto' ? /Так же я могу отвечать и вашим клиентам/.test(posl2) : null,
    mediana_ms: ms[Math.floor(ms.length / 2)], hod }));
  process.exit(0);
};
setTimeout(() => { console.log(JSON.stringify({ metka, scen, oshibka: 'таймаут' })); process.exit(0); }, 300000);
