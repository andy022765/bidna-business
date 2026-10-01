"""Живое = stage: каждая страница stage на боевом домене, по телу ответа. Только GET, кредиты почти не тратит.
    python3 zhivoe_vs_stage.py <stage> [домен]        (домен по умолчанию https://businessinteldna.com)
Проверяет:
  - каждая html-страница stage отдаёт 200 (без перехода по редиректам);
  - адреса, перекрытые 301/301! в _redirects, отдают 301 туда, куда задумано;
  - видимый текст живой страницы = видимый текст файла stage (Netlify переписывает только тег формы — в текст это не попадает);
  - llms.txt, robots.txt, sitemap.xml совпадают побайтно;
  - data-netlify не осталось ни на одной странице (без учёта регистра, обе кавычки) — иначе приём форм выключен.
Код возврата 1 при любой находке. Ходит честным UA BusinessIntelDNA-LinkPreview (счётчик роботов его не считает).
Вырос из scratchpad/vykatka/sverka.py окна 29.09. Эталон 29.09 22:30 PDT (боевая 6abc9125…): см. SKILL.md."""
import html as H, os, re, ssl, sys, urllib.error, urllib.request
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()
ST = sys.argv[1]
DOM = (sys.argv[2] if len(sys.argv) > 2 else "https://businessinteldna.com").rstrip("/")
UA = {"User-Agent": "BusinessIntelDNA-LinkPreview/1.0 (+https://businessinteldna.com)"}

class BezRedirektov(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **kw):
        return None
OPENER = urllib.request.build_opener(urllib.request.HTTPSHandler(context=CTX), BezRedirektov())

def vzyat(put):
    try:
        with OPENER.open(urllib.request.Request(DOM + put, headers=UA), timeout=25) as o:
            return o.status, o.read().decode("utf8", "replace"), ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf8", "replace"), e.headers.get("Location", "")
    except Exception as e:
        return 0, str(e), ""

def vid(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", "\n", t)
    t = H.unescape(t)
    return [l.strip() for l in t.split("\n") if l.strip()]

def adres(rel):
    if rel == "index.html": return "/"
    if rel.endswith("/index.html"): return "/" + rel[:-10]
    if rel.endswith(".html"): return "/" + rel[:-5]
    return "/" + rel

redir = {}
for s in open(os.path.join(ST, "_redirects"), encoding="utf8"):
    p = s.split()
    if len(p) >= 3 and not s.startswith("#"):
        redir[p[0]] = (p[1], p[2].rstrip("!"), p[2].endswith("!"))

bedy, str200, str301, sverka = [], 0, 0, 0
DN = re.compile(r"data-netlify\s*=\s*[\"']?true", re.I)
for koren, _, fs in os.walk(ST):
    for f in sorted(fs):
        p = os.path.join(koren, f); rel = os.path.relpath(p, ST); u = adres(rel)
        if f.endswith(".html"):
            if u in redir and redir[u][2]:
                kuda, kod, _ = redir[u]
                k, _, loc = vzyat(u)
                if str(k) != kod or not loc.endswith(kuda):
                    bedy.append("%s: ждали %s → %s, пришло %s %s" % (u, kod, kuda, k, loc))
                else:
                    str301 += 1
                continue
            k, telo, loc = vzyat(u)
            if k != 200:
                bedy.append("%s: %s %s" % (u, k, loc)); continue
            str200 += 1
            if DN.search(telo):
                bedy.append("%s: остался data-netlify — приём форм выключен" % u)
            if vid(telo) != vid(open(p, encoding="utf8").read()):
                bedy.append("%s: видимый текст живого ≠ stage" % u)
            else:
                sverka += 1
        elif f in ("llms.txt", "robots.txt", "sitemap.xml"):
            k, telo, _ = vzyat(u)
            if k != 200 or telo != open(p, encoding="utf8").read():
                bedy.append("%s: %s, содержимое ≠ stage" % (u, k))
            else:
                sverka += 1

print("200: %d · 301 по плану: %d · совпало со stage: %d" % (str200, str301, sverka))
if bedy:
    print("НАХОДКИ (%d):" % len(bedy))
    for b in bedy[:80]:
        print("  ✗ " + b)
    sys.exit(1)
print("ЧИСТО: живое = stage, data-netlify 0")
