#!/usr/bin/env python3
"""Мобильный аудит честной эмуляцией устройства (CDP), а не зажатым окном.

    python3 mob_audit.py https://bidna-predprosmotr.netlify.app

Для каждой страницы: портрет 390x844 и альбом 844x390 — ширина документа против экрана,
какие элементы вылезают за правый край и НЕ обрезаны предком, тач-цели меньше 44 px
(отдельно — ссылки внутри текста, на них правило 44 px не распространяется).
"""
import asyncio, json, subprocess, sys, time, urllib.request
import websockets

DOM = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "https://bidna-predprosmotr.netlify.app"
PORT = 9334
STRANICY = ["/", "/vera/", "/vera/ru/", "/vera/paid/", "/vera/ru/paid/", "/vera/thanks/", "/vera/ru/thanks/",
            "/visibility/", "/visibility/ru/", "/visibility/paid/", "/visibility/ru/paid/",
            "/visibility/thanks/", "/visibility/ru/thanks/", "/diagnostic/", "/diagnostic/ru/",
            "/diagnostic/paid/", "/diagnostic/ru/paid/",
            "/zvonki/poka-rabotayu/", "/zvonki/ne-teryat/", "/zvonki/vecher-i-vyhodnye/",
            "/zvonki/skolko-teryayu/", "/zvonki/po-russki/", "/zvonki/chelovek-ili-robot/",
            "/vidimost/chatgpt-nazyval/", "/vidimost/neyroset-sovetuet/", "/vidimost/proverka-otvetov/",
            "/vidimost/neverye-dannye/", "/vidimost/cena/", "/vidimost/sayt-zakryt-ot-robotov/",
            "/kejs/yulia-remote-cfo/",
            "/terms", "/privacy", "/nda", "/sms", "/contacts",
            # 29.09: /en/ (английская главная), старые /business/ /expert/ и страницы SMS-согласия —
            # раньше их гоняли копией скрипта из временной папки.
            "/en/", "/business/", "/expert/", "/sms-consent/", "/sms-consent/ru/"]
# Код возврата (с 29.09): 1, если есть горизонтальный скролл, мелкие цели, нечитаемый текст
# или страница не прочиталась. Раньше всегда был 0, итог читали глазами.
NE_PROCHLOS = []
# Страница «кому сколько должны» (рефералка, 27.09) — Андрей открывает её с телефона. Ключ берём из
# ~/.bidna-golos.env во время прогона: в этом файле (он в Google Drive) ключа быть не должно.
def _klyuch():
    import os, re
    try:
        for s in open(os.path.expanduser("~/.bidna-golos.env"), encoding="utf-8"):
            m = re.match(r"\s*(?:export\s+)?PARTNERY_KLYUCH=['\"]?([^'\"\s]+)", s)
            if m:
                return m.group(1)
    except Exception:
        pass
    return None
# Функция есть только на боевом (29.09): на локальном сервере и предпросмотре это 404 и ложное «нечитаемо»,
# а ключ незачем слать никуда, кроме своего домена.
if _klyuch() and DOM == "https://businessinteldna.com":
    STRANICY.append("/.netlify/functions/partnery?k=" + _klyuch())
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")

JS = r"""
(() => {
  const vw = document.documentElement.clientWidth;
  const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const clipped = (el) => {           // обрезан ли элемент предком с overflow != visible
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) {
        const r = p.getBoundingClientRect();
        if (r.right <= vw + 1.5) return true;
      }
    }
    return false;
  };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const over = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.left < -1000) return;                        // скрытые поля детекта форм Netlify
    if (r.right > vw + 1.5 && !clipped(el)) over.push(name(el) + ' →' + Math.round(r.right));
  });
  const small = [], inline = [];
  document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea, summary').forEach(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || r.left < -1000) return;
    if (r.width >= 44 && r.height >= 44) return;
    // честная проверка: не растянута ли зона нажатия псевдоэлементом
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let hit = 0;
    for (const dy of [-18, 18]) {
      const e2 = document.elementFromPoint(cx, cy + dy);
      if (e2 && (e2 === el || el.contains(e2))) hit++;
    }
    if (hit === 2 && r.width >= 44) return;
    const txt = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 30);
    const p = el.closest('p, li, td, figcaption, blockquote');
    const vTekste = el.tagName === 'A' && p && (p.innerText || '').trim().length > txt.length + 15;
    (vTekste ? inline : small).push(name(el) + ' «' + txt + '» ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  // контраст: текст против фактического фона (26.09 — тёмно-синий текст на тёмно-синих полосах, EN в шапке)
  const rgba = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(x => parseFloat(x)); return {r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1}; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const fonOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;          // картинка/градиент — не считаем
      const c = rgba(s.backgroundColor); if (c && c.a > 0.5) return c; } return {r: 255, g: 255, b: 255, a: 1}; };
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    if (!Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 2)) return;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || r.left < -1000 || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.3) return;
    const c = rgba(s.color), f = fonOf(el); if (!c || !f) return;
    const L1 = lum(c), L2 = lum(f), k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 3) bad.push(name(el) + ' «' + el.innerText.trim().slice(0, 28) + '» ' + k.toFixed(2) + ':1');
  });
  return JSON.stringify({vw, docW, over: over.slice(0, 8), overN: over.length, small: small.slice(0, 12),
                         smallN: small.length, inlineN: inline.length, bad: bad.slice(0, 8), badN: bad.length});
})()
"""


async def main():
    chrome = subprocess.Popen(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "--headless=new",
                               "--remote-debugging-port=%d" % PORT, "--disable-gpu", "--hide-scrollbars",
                               "--no-first-run", "--user-data-dir=/tmp/cdp-shtab-mob"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                urllib.request.urlopen("http://127.0.0.1:%d/json/version" % PORT, timeout=1); break
            except Exception:
                time.sleep(0.25)
        req = urllib.request.Request("http://127.0.0.1:%d/json/new" % PORT, method="PUT")
        ws_url = json.load(urllib.request.urlopen(req))["webSocketDebuggerUrl"]
        async with websockets.connect(ws_url, max_size=2 ** 26) as ws:
            n = 0

            async def cmd(method, **params):
                nonlocal n
                n += 1; mid = n
                await ws.send(json.dumps({"id": mid, "method": method, "params": params}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get("id") == mid:
                        return msg.get("result", {})

            await cmd("Page.enable"); await cmd("Runtime.enable")
            await cmd("Network.setUserAgentOverride", userAgent=UA)
            await cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
            itog = []
            for put in STRANICY:
                for rezhim, (w, h) in (("портрет", (390, 844)), ("альбом", (844, 390))):
                    await cmd("Emulation.setDeviceMetricsOverride", width=w, height=h, deviceScaleFactor=3, mobile=True)
                    await cmd("Page.navigate", url=DOM + put)
                    await asyncio.sleep(3.0)
                    r = await cmd("Runtime.evaluate", expression=JS, returnByValue=True)
                    try:
                        d = json.loads(r["result"]["value"])
                    except Exception:
                        print("%-28s %s: не прочиталось" % (put, rezhim)); NE_PROCHLOS.append(put); continue
                    ok = d["docW"] <= d["vw"] + 1 and d["overN"] == 0
                    pokaz = put.split("?k=")[0] + ("?k=…" if "?k=" in put else "")
                    stroka = "%-28s %-7s экран %d, документ %d %s" % (pokaz, rezhim, d["vw"], d["docW"], "✓" if ok else "✗ ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ")
                    if rezhim == "портрет":
                        stroka += " | целей <44: %d (в тексте ещё %d)" % (d["smallN"], d["inlineN"])
                    print(stroka)
                    if not ok:
                        print("      вылезают:", "; ".join(d["over"]))
                    if rezhim == "портрет" and d["smallN"]:
                        print("      мелкие цели:", "; ".join(d["small"]))
                    if rezhim == "портрет" and d.get("badN"):
                        print("      НЕЧИТАЕМО (контраст < 3:1): %d —" % d["badN"], "; ".join(d["bad"]))
                    itog.append((put, rezhim, ok, d["smallN"] if rezhim == "портрет" else 0, d.get("badN", 0) if rezhim == "портрет" else 0))
            plohih = [x for x in itog if not x[2]]
            print("\nИТОГ: страниц %d, режимов %d, с горизонтальным скроллом: %d, мелких целей (не в тексте): %d, нечитаемых текстов: %d"
                  % (len(STRANICY), len(itog), len(plohih), sum(x[3] for x in itog), sum(x[4] for x in itog)))
            if NE_PROCHLOS:
                print("НЕ ПРОЧИТАЛОСЬ: %d режимов — %s" % (len(NE_PROCHLOS), ", ".join(sorted(set(NE_PROCHLOS)))))
            return 1 if (plohih or NE_PROCHLOS or sum(x[3] for x in itog) or sum(x[4] for x in itog)) else 0
    finally:
        chrome.terminate()


sys.exit(asyncio.run(main()))
