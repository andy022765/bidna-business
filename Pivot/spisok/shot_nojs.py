#!/usr/bin/env python3
"""Снимок страницы В ТОМ ВИДЕ, В КАКОМ ЕЁ ОТДАЁТ СЕРВЕР.

Сырой HTML берём curl'ом под UA бота, кладём локально, подставляем <base href>,
открываем в Chrome headless с ВЫКЛЮЧЕННЫМ JavaScript и снимаем всю страницу.
Именно это видят GPTBot / ClaudeBot / PerplexityBot.

Вызов: python3 shot_nojs.py <local.html> <base-url> <out.png>
"""
import asyncio, base64, json, re, subprocess, sys, urllib.request, websockets

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9334


def prepare(src_html, base_url, out_html):
    h = open(src_html, encoding="utf-8", errors="replace").read()
    if "<base " not in h:
        h = re.sub(r"(<head[^>]*>)", r'\1<base href="%s">' % base_url, h, count=1, flags=re.I)
    open(out_html, "w", encoding="utf-8").write(h)


async def shoot(url, out, width=1440, height=3000, wait=4.0):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    ws_url = json.load(urllib.request.urlopen(req))["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url, max_size=120_000_000) as ws:
        i = [0]

        async def cmd(method, params=None):
            i[0] += 1
            await ws.send(json.dumps({"id": i[0], "method": method, "params": params or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == i[0]:
                    return msg.get("result", {})

        await cmd("Emulation.setScriptExecutionDisabled", {"value": True})
        await cmd("Emulation.setDeviceMetricsOverride",
                  {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": False})
        await cmd("Page.enable")
        await cmd("Page.navigate", {"url": url})
        await asyncio.sleep(wait)
        m = await cmd("Page.getLayoutMetrics")
        full = m.get("cssContentSize") or m.get("contentSize") or {}
        print("  размер документа:", full.get("width"), "x", full.get("height"))
        shot = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        open(out, "wb").write(base64.b64decode(shot["data"]))
        print("  записан", out)


async def main():
    src, base_url, out = sys.argv[1], sys.argv[2], sys.argv[3]
    local = out + ".src.html"
    prepare(src, base_url, local)
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={PORT}", "--disable-gpu",
         "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
         "--blink-settings=scriptEnabled=false",
         "--user-data-dir=/tmp/cdp-nojs-profile"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=0.5)
                break
            except Exception:
                await asyncio.sleep(0.25)
        await shoot("file://" + local, out)
    finally:
        proc.terminate()

asyncio.run(main())
