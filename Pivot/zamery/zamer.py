#!/usr/bin/env python3
"""Прогон покупательских запросов по Perplexity и Google AI Mode, сохранение ответов."""
import json, sys, time, urllib.request, urllib.parse, asyncio, websockets, io, os

PORT = 9333
def http(path, method="GET"):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", method=method)
    return json.load(urllib.request.urlopen(req, timeout=10))

async def ask(url, wait):
    tab = http("/json/new?about:blank", "PUT")
    try:
        async with websockets.connect(tab["webSocketDebuggerUrl"], max_size=50*1024*1024) as s:
            i = [0]
            async def cmd(method, **params):
                i[0] += 1
                await s.send(json.dumps({"id": i[0], "method": method, "params": params}))
                while True:
                    m = json.loads(await s.recv())
                    if m.get("id") == i[0]:
                        return m.get("result", {})
            await cmd("Page.enable")
            await cmd("Network.setUserAgentOverride",
                userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36")
            await cmd("Emulation.setDeviceMetricsOverride", width=1440, height=1200,
                      deviceScaleFactor=1, mobile=False)
            await cmd("Page.navigate", url=url)
            await asyncio.sleep(wait)
            r = await cmd("Runtime.evaluate", expression="document.body.innerText", returnByValue=True)
            return r.get("result", {}).get("value", "") or ""
    finally:
        try: http(f"/json/close/{tab['id']}")
        except Exception: pass

QUERIES = [
 "best steakhouse in Santa Clarita",
 "where to eat steak in Canyon Country CA",
 "best prime rib near Valencia California",
 "romantic dinner restaurant Santa Clarita",
 "old school charcoal steakhouse Los Angeles county",
 "steakhouse with banquet room for parties Santa Clarita",
 "best restaurants in Canyon Country California",
 "where to celebrate an anniversary dinner Santa Clarita",
 "family owned steakhouse near Santa Clarita",
 "best steak dinner near Newhall California",
 "Backwoods Inn Santa Clarita",
]

async def main():
    out = {}
    for q in QUERIES:
        e = urllib.parse.quote_plus(q)
        out[q] = {}
        for eng, url, wait in [
            ("perplexity", f"https://www.perplexity.ai/search?q={e}", 16),
            ("google_ai",  f"https://www.google.com/search?q={e}&udm=50&hl=en&gl=us", 13),
        ]:
            try:
                out[q][eng] = await ask(url, wait)
                mark = "BW+" if "backwoods" in out[q][eng].lower() else "—"
                print(f"{mark} [{eng:10}] {q[:50]:52} {len(out[q][eng])} симв.", flush=True)
            except Exception as ex:
                out[q][eng] = f"ERROR: {ex}"
                print(f"!! [{eng}] {q}: {ex}", flush=True)
            await asyncio.sleep(3)
    io.open(os.path.join(os.path.dirname(__file__), "zamer.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, indent=1))
    print("\nсохранено в zamer.json")

asyncio.run(main())
