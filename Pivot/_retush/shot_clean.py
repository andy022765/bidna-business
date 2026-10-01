#!/usr/bin/env python3
"""Снимок страницы с убранными контактами: прячем в DOM, а не замазываем пиксели."""
import asyncio, base64, json, subprocess, sys, urllib.request, websockets

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9333

HIDE_JS = r"""
(() => {
  const report = {links: 0, phones: 0, handles: 0};
  // 1. кликабельные контакты
  const sel = 'a[href^="tel:"],a[href^="mailto:"],a[href^="viber:"],'
            + 'a[href*="wa.me"],a[href*="api.whatsapp"],a[href*="t.me"],'
            + 'a[href*="instagram.com"],a[href*="facebook.com"]';
  document.querySelectorAll(sel).forEach(el => {
    // не трогаем то, что явно является кнопкой-действием без самого контакта в тексте
    el.style.visibility = 'hidden'; report.links++;
  });
  // 2. видимый текст: телефоны и @хендлы
  const PHONE = /(\+?\d[\d\s().-]{8,17}\d)/g;
  const HANDLE = /@[A-Za-z0-9_.]{3,32}/g;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const jobs = [];
  while (walker.nextNode()) jobs.push(walker.currentNode);
  jobs.forEach(n => {
    const p = n.parentElement;
    if (!p || ['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName)) return;
    let t = n.nodeValue;
    if (PHONE.test(t)) { t = t.replace(PHONE, m => '•'.repeat(Math.min(m.length, 14))); report.phones++; }
    if (HANDLE.test(t)) { t = t.replace(HANDLE, '@•••••••'); report.handles++; }
    if (t !== n.nodeValue) n.nodeValue = t;
  });
  return JSON.stringify(report);
})()
"""


async def shoot(url: str, out: str, width=1440, height=2400, wait=6.0):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    ws_url = json.load(urllib.request.urlopen(req))["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url, max_size=80_000_000) as ws:
        i = [0]
        async def cmd(method, params=None):
            i[0] += 1
            await ws.send(json.dumps({"id": i[0], "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == i[0]:
                    return msg.get("result", {})

        await cmd("Emulation.setDeviceMetricsOverride",
                  {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": False})
        await cmd("Page.enable")
        await cmd("Page.navigate", {"url": url})
        await asyncio.sleep(wait)
        r = await cmd("Runtime.evaluate", {"expression": HIDE_JS, "returnByValue": True})
        print("  спрятано:", r.get("result", {}).get("value"))
        await asyncio.sleep(1.2)
        shot = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        open(out, "wb").write(base64.b64decode(shot["data"]))
        print("  записан", out)


async def main():
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={PORT}", "--disable-gpu",
         "--hide-scrollbars", "--no-first-run", "--user-data-dir=/tmp/cdp-clean-profile"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(40):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=0.5)
                break
            except Exception:
                await asyncio.sleep(0.25)
        for url, out in [(sys.argv[i], sys.argv[i + 1]) for i in range(1, len(sys.argv), 2)]:
            print(url)
            await shoot(url, out)
    finally:
        proc.terminate()

asyncio.run(main())
