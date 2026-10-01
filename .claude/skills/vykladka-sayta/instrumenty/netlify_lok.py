# Запуск (вывод обязательно в файл, иначе вызов Bash может повиснуть):
#   nohup python3 netlify_lok.py <stage> <порт> > <scr>/server.log 2>&1 & echo $! > <scr>/server.pid
#   остановить: kill $(cat <scr>/server.pid)
# Потом: python3 shtab/sayty/reviziya.py --dom http://127.0.0.1:<порт>
# Функций нет (/.netlify/functions/* = 404) — их проверять только на живом.
"""Локальная копия поведения Netlify для ревизии stage (черновик закрыт входом в Netlify, 401).
Умеет: pretty URLs (/terms → terms.html), папка без слэша → 301 на слэш (как Netlify),
_redirects с 301 и 301! (принудительные), тег формы без data-netlify (как после выкладки).
НЕ умеет: _headers, правила со * и :splat, правила 200 (подмена) — при их появлении печатает предупреждение
в server.log; тогда такие адреса проверяй на черновике/живом. sitemap, hreflang, canonical указывают на боевой
домен — их здесь не проверить запросами, для них instrumenty/stage_ssylki.py."""
import http.server, os, re, sys
KOREN = sys.argv[1]; PORT = int(sys.argv[2])
PRAVILA = []
for s in open(os.path.join(KOREN, "_redirects"), encoding="utf8"):
    p = s.split()
    if len(p) >= 3 and not s.startswith("#"):
        if "*" in p[0] or ":splat" in p[1] or not p[2].rstrip("!").startswith("30"):
            print("ВНИМАНИЕ: правило не поддержано локально:", s.strip(), flush=True)
            continue
        PRAVILA.append((p[0], p[1], p[2].rstrip("!"), p[2].endswith("!")))
if os.path.exists(os.path.join(KOREN, "_headers")):
    print("ВНИМАНИЕ: _headers локально не применяется", flush=True)
def fayl(put):
    put = put.split("?")[0]
    k = os.path.join(KOREN, put.lstrip("/"))
    for c in ([os.path.join(k, "index.html")] if put.endswith("/") else [k, k + ".html", os.path.join(k, "index.html")]):
        if os.path.isfile(c): return c
    return None
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        put = self.path.split("?")[0]
        f = fayl(put)
        for ot, kuda, kod, sila in PRAVILA:
            if put == ot and (sila or not f):
                self.send_response(int(kod)); self.send_header("Location", kuda); self.end_headers(); return
        # Netlify: папка без слэша (/vera) → 301 на /vera/, если нет файла vera.html
        if f and not put.endswith("/") and f.endswith(os.sep + "index.html") \
                and not os.path.isfile(os.path.join(KOREN, put.lstrip("/") + ".html")):
            self.send_response(301); self.send_header("Location", put + "/"); self.end_headers(); return
        if not f:
            self.send_response(404); self.end_headers(); self.wfile.write(b"404"); return
        b = open(f, "rb").read()
        if f.endswith(".html"):
            t = b.decode("utf8")
            t = re.sub(r"(<form\b[^>]*?)\s+data-netlify=[\"']true[\"']", r"\1", t, flags=re.I)
            b = t.encode("utf8")
            ct = "text/html; charset=utf-8"
        else:
            ct = {".txt":"text/plain; charset=utf-8",".xml":"application/xml",".webp":"image/webp",".mp4":"video/mp4",".png":"image/png",".svg":"image/svg+xml",".js":"text/javascript",".css":"text/css"}.get(os.path.splitext(f)[1], "application/octet-stream")
        self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    do_HEAD = do_GET
print("слушаю http://127.0.0.1:%d  (%s)" % (PORT, KOREN), flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
