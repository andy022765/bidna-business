/* Звонок Валюше прямо в браузере: клик -> гудки -> Валюша берёт трубку и говорит.
   Подключается напрямую к её "мозгу" (pipecat /api/offer) по WebRTC, без внешних SDK.

   Куда звонить (адрес сервера Валюши) берётся в таком порядке:
     1) ?bot=https://...  в адресе страницы (удобно тестить с любого устройства через туннель)
     2) window.VALYUSHA_BOT_URL (можно задать в index.html)
     3) если страница открыта локально (localhost) -> http://localhost:7860
     4) иначе пусто -> кнопка мягко уводит в Telegram (значит сервер ещё не подключён к сайту)
*/
(function () {
  "use strict";

  var TG_URL = "https://t.me/aivalysha";

  function resolveBotUrl() {
    try {
      var q = new URLSearchParams(location.search).get("bot");
      if (q) return q.replace(/\/+$/, "");
    } catch (e) {}
    if (window.VALYUSHA_BOT_URL) return String(window.VALYUSHA_BOT_URL).replace(/\/+$/, "");
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      return "http://localhost:7860";
    return "";
  }
  var BOT_URL = resolveBotUrl();

  // ---- элементы оверлея ----
  var overlay, statusEl, hintEl, hangBtn, audioEl, eqEl;
  // ---- состояние звонка ----
  var pc = null, mic = null, ringTimer = null, ringCtx = null, ringGain = null, ringOsc = null;
  var minRingUntil = 0, connected = false, closed = false;

  function el(id) { return document.getElementById(id); }

  function bind() {
    overlay = el("vCall");
    statusEl = el("vCallStatus");
    hintEl = el("vCallHint");
    hangBtn = el("vCallHang");
    audioEl = el("vCallAudio");
    eqEl = el("vCallEq");
    if (hangBtn) hangBtn.addEventListener("click", endCall);
    var x = overlay && overlay.querySelector(".call-x");
    if (x) x.addEventListener("click", endCall);
    // все кнопки-«позвонить»
    Array.prototype.forEach.call(document.querySelectorAll(".js-call"), function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); startCall(); });
    });
  }

  // ---------- гудки (Web Audio) ----------
  function startRingback() {
    try {
      ringCtx = new (window.AudioContext || window.webkitAudioContext)();
      ringGain = ringCtx.createGain();
      ringGain.gain.value = 0.0001;
      ringGain.connect(ringCtx.destination);
      ringOsc = ringCtx.createOscillator();
      ringOsc.type = "sine";
      ringOsc.frequency.value = 425; // частота гудка как в телефонии
      ringOsc.connect(ringGain);
      ringOsc.start();
      pulse();
      ringTimer = setInterval(pulse, 2200); // гудок ~1с + пауза ~1.2с
    } catch (e) { /* нет аудио — не критично */ }
  }
  function pulse() {
    if (!ringCtx) return;
    var t = ringCtx.currentTime, g = ringGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.setValueAtTime(0.16, t + 0.9);
    g.exponentialRampToValueAtTime(0.0001, t + 1.02);
  }
  function stopRingback() {
    if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    try {
      if (ringGain) {
        var t = ringCtx.currentTime;
        ringGain.gain.cancelScheduledValues(t);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      }
      if (ringOsc) ringOsc.stop(ringCtx.currentTime + 0.25);
      setTimeout(function () { try { ringCtx && ringCtx.close(); } catch (e) {} ringCtx = null; }, 400);
    } catch (e) {}
  }

  // ---------- UI ----------
  function show() { overlay.hidden = false; document.body.style.overflow = "hidden"; }
  function hide() { overlay.hidden = true; document.body.style.overflow = ""; }
  function setStatus(s) { if (statusEl) statusEl.textContent = s; }
  function setHint(h) { if (hintEl) hintEl.innerHTML = h || ""; }
  function setState(name) { if (overlay) overlay.setAttribute("data-state", name); }

  // ---------- сам звонок ----------
  function startCall() {
    if (!BOT_URL) { window.open(TG_URL, "_blank", "noopener"); return; }
    closed = false; connected = false;
    show();
    setState("ringing");
    setStatus("Звоним Валюше…");
    setHint("");
    startRingback();
    minRingUntil = Date.now() + 2600; // дать гудкам прозвучать минимум ~2.6с
    connect().catch(function (err) {
      console.error("call error:", err);
      fail();
    });
  }

  function onLive() {
    if (connected || closed) return;
    var wait = Math.max(0, minRingUntil - Date.now());
    setTimeout(function () {
      if (closed) return;
      connected = true;
      stopRingback();
      setState("live");
      setStatus("Валюша на линии");
      setHint("говорите — она вас слышит");
    }, wait);
  }

  function fail() {
    stopRingback();
    setState("error");
    setStatus("Не получилось дозвониться");
    setHint('Валюша сейчас недоступна — напишите ей в <a href="' + TG_URL + '" target="_blank" rel="noopener">Telegram</a>');
    cleanup();
  }

  // STUN + TURN: TURN-relay даёт браузеру публично достижимый адрес, и сервер за NAT
  // шлёт на него звук исходящим UDP. Без TURN звук бы не прошёл. (на тесте — бесплатный openrelay)
  var ICE_SERVERS = (window.VALYUSHA_ICE) || [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  ];

  async function connect() {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = function (e) {
      if (audioEl) { audioEl.srcObject = e.streams[0]; audioEl.play && audioEl.play().catch(function () {}); }
      onLive();
    };
    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (s === "connected") onLive();
      if (s === "failed" || s === "disconnected" || s === "closed") {
        if (!closed) { if (connected) endCall(); else fail(); }
      }
    };

    mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach(function (t) { pc.addTrack(t, mic); });

    var offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    var resp = await fetch(BOT_URL + "/api/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type, pc_id: null })
    });
    if (!resp.ok) throw new Error("offer http " + resp.status);
    var answer = await resp.json();
    await pc.setRemoteDescription(answer);
  }

  function waitIce(pc) {
    return new Promise(function (res) {
      if (pc.iceGatheringState === "complete") return res();
      var done = false, fin = function () { if (!done) { done = true; res(); } };
      var to = setTimeout(fin, 2500); // не ждать сбор кандидатов вечно
      pc.addEventListener("icegatheringstatechange", function () {
        if (pc.iceGatheringState === "complete") { clearTimeout(to); fin(); }
      });
    });
  }

  function cleanup() {
    try { if (mic) mic.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    mic = null;
    try { if (pc) pc.close(); } catch (e) {}
    pc = null;
    if (audioEl) { try { audioEl.srcObject = null; } catch (e) {} }
  }

  function endCall() {
    closed = true;
    stopRingback();
    cleanup();
    hide();
    setState("idle");
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
