#!/usr/bin/env python3
"""Сырой HTML без единого <script>: что реально видно и что display:none."""
import asyncio, base64, json, re, subprocess, sys, urllib.request, websockets

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9335

JS = r"""
(() => {
  const out = {sections: [], textLen: 0, bodyH: document.body.scrollHeight};
  document.querySelectorAll('body > *, section, header, footer, main').forEach(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out.sections.push({
      tag: el.tagName, cls: (el.className||'').toString().slice(0,60),
      disp: cs.display, vis: cs.visibility, op: cs.opacity, h: Math.round(r.height)
    });
  });
  out.textLen = (document.body.innerText||'').trim().length;
  out.text = (document.body.innerText||'').trim().slice(0, 1500);
  return JSON.stringify(out);
})()
"""


async def run(local, out_png):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/new?about:blank", method="PUT")
    ws_url = json.load(urllib.request.urlopen(req))["webSocketDebuggerUrl"]
    async with websockets.connect(ws_url, max_size=120_000_000) as ws:
        i = [0]

        async def cmd(m, p=None):
            i[0] += 1
            await ws.send(json.dumps({"id": i[0], "method": m, "params": p or {}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("id") == i[0]:
                    return msg.get("result", {})

        await cmd("Emulation.setDeviceMetricsOverride",
                  {"width": 1440, "height": 1200, "deviceScaleFactor": 2, "mobile": False})
        await cmd("Page.enable")
        await cmd("Page.navigate", {"url": "file://" + local})
        await asyncio.sleep(5)
        r = await cmd("Runtime.evaluate", {"expression": JS, "returnByValue": True})
        data = json.loads(r["result"]["value"])
        print("body scrollHeight:", data["bodyH"], " innerText length:", data["textLen"])
        for s in data["sections"]:
            print(f"  {s['tag']:<8} h={s['h']:<6} disp={s['disp']:<12} vis={s['vis']:<8} op={s['op']:<5} {s['cls']}")
        print("\n--- TEXT ---\n", data["text"])
        m = await cmd("Page.getLayoutMetrics")
        cs = m.get("cssContentSize", {})
        await cmd("Emulation.setDeviceMetricsOverride",
                  {"width": 1440, "height": max(1200, int(cs.get("height", 1200))),
                   "deviceScaleFactor": 2, "mobile": False})
        await asyncio.sleep(1)
        shot = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        open(out_png, "wb").write(base64.b64decode(shot["data"]))
        print("\nзаписан", out_png, "высота документа", cs.get("height"))


async def main():
    src, base_url, out_png = sys.argv[1], sys.argv[2], sys.argv[3]
    h = open(src, encoding="utf-8", errors="replace").read()
    h = re.sub(r"<script\b.*?</script>", "", h, flags=re.S | re.I)
    h = re.sub(r"<script\b[^>]*/?>", "", h, flags=re.I)
    if "<base " not in h:
        h = re.sub(r"(<head[^>]*>)", r'\1<base href="%s">' % base_url, h, count=1, flags=re.I)
    local = out_png + ".noscript.html"
    open(local, "w", encoding="utf-8").write(h)
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={PORT}", "--disable-gpu",
         "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
         "--user-data-dir=/tmp/cdp-probe-profile"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=0.5)
                break
            except Exception:
                await asyncio.sleep(0.25)
        await run(local, out_png)
    finally:
        proc.terminate()

asyncio.run(main())
