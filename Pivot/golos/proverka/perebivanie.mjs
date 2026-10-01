// Перебивание во время отправки письма. node perebivanie.mjs <agent_id> <метка>
// Приёмка 22.09, conv_3201m34zv4fsem2vgy2bjafqryvj: на 93-й секунде Вера вызвала отправку,
// звонящий в этот момент сказал «Да, я здесь. Да.», ElevenLabs записал «Tool execution was
// abandoned due to user input» — а сервер письмо всё равно отправил. Вера решила, что не отправила,
// вызвала ещё раз и получила «уже ушло». Здесь воспроизводим ровно это: говорим, пока идёт вызов.
const [agentId, metka] = process.argv.slice(2);
const key = process.env.ELEVENLABS_API_KEY;
const ADRES = 'andrii+priemka-test@businessinteldna.com';
const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, { headers: { 'xi-api-key': key } });
const ws = new WebSocket((await r.json()).signed_url);
const pauza = (ms) => new Promise((res) => setTimeout(res, ms));
let convId = null, otvetov = 0, posl = Date.now(), zhdemVyzov = false, perebili = false;
const skazat = (t) => ws.send(JSON.stringify({ type: 'user_message', text: t }));
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.type === 'conversation_initiation_metadata') convId = m.conversation_initiation_metadata_event.conversation_id;
  else if (m.type === 'ping') ws.send(JSON.stringify({ type: 'pong', event_id: m.ping_event.event_id }));
  else if (m.type === 'agent_response') { otvetov++; posl = Date.now(); }
  // Как только после «да, верно» пошло хоть что-то от агента — перебиваем, пока вызов в полёте.
  if (zhdemVyzov && !perebili && m.type !== 'ping' && m.type !== 'conversation_initiation_metadata') {
    perebili = true; skazat('Да, я здесь. Да.');
  }
};
const doigrala = async () => { const n = otvetov, t = Date.now();
  while (otvetov === n && Date.now() - t < 15000) await pauza(100);
  while (Date.now() - posl < 1500 && Date.now() - t < 25000) await pauza(100); };
ws.onopen = async () => {
  await doigrala();                                           // приветствие
  skazat('Пришлите мне, пожалуйста, подробности на почту.'); await doigrala();
  skazat(`Записывайте: ${ADRES}`); await doigrala();           // чтение по буквам
  zhdemVyzov = true; skazat('Да, верно.');
  const t = Date.now(); while (!perebili && Date.now() - t < 5000) await pauza(20);
  if (!perebili) skazat('Да, я здесь. Да.');
  await doigrala(); await pauza(3000); ws.close();
  await pauza(6000);
  let d = {};
  for (let i = 0; i < 5; i++) {
    d = await (await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${convId}`, { headers: { 'xi-api-key': key } })).json();
    if ((d.transcript || []).length > 4) break; await pauza(4000);
  }
  const vyzovy = [], rez = [];
  for (const x of d.transcript || []) {
    for (const c of x.tool_calls || []) if (c.tool_name === 'otpravit_ssylku') vyzovy.push(JSON.parse(c.params_as_json || '{}'));
    for (const c of x.tool_results || []) if (c.tool_name === 'otpravit_ssylku') rez.push(String(c.result_value || ''));
  }
  const broshen = rez.filter((v) => /abandoned/i.test(v)).length;
  const podtv = vyzovy.filter((v) => v.podtverdil === true || v.podtverdil === 'true').length;
  console.log(JSON.stringify({ metka, convId, vyzovov: vyzovy.length, s_podtverzhdeniem: podtv, broshennyh: broshen,
    otvety: rez.map((v) => v.slice(0, 70)) }, null, 1));
  process.exit(0);
};
