"""Адреса для машин по stage, без сети: sitemap.xml, canonical, hreflang.
    python3 stage_ssylki.py <stage>
Локальный сервер их не проверит (там абсолютные адреса боевого домена), reviziya.py сверяет sitemap только на живом.
Проверяет:
  - каждый <loc> и xhtml:link из sitemap.xml ведёт на файл stage (pretty URLs), а не на 301 и не на noindex;
  - у каждой индексируемой страницы (без noindex) есть canonical, и он ведёт на файл stage;
  - каждый hreflang ведёт на файл stage.
Код возврата 1 при любой находке. Эталон 29.09 (stage боевой 6abc9125…): 66 html, 8 перекрыты 301!, 19 индексируемых, 14 адресов в sitemap, находок 0.
Проверен подменой 29.09: ловит canonical на несуществующую страницу, адрес без слэша и noindex-страницу в sitemap."""
import os, re, sys
ST = sys.argv[1]
DOM = "https://businessinteldna.com"
redir = set()
for s in open(os.path.join(ST, "_redirects"), encoding="utf8"):
    p = s.split()
    if len(p) >= 3 and not s.startswith("#"):
        redir.add(p[0])

def fayl(url):
    if not url.startswith(DOM):
        return None, "чужой домен"
    put = url[len(DOM):].split("#")[0].split("?")[0] or "/"
    if put in redir or put.rstrip("/") in redir:
        return None, "301 по _redirects"
    k = os.path.join(ST, put.lstrip("/"))
    kand = [os.path.join(k, "index.html")] if put.endswith("/") else [k, k + ".html"]
    for c in kand:
        if os.path.isfile(c):
            return c, None
    if not put.endswith("/") and os.path.isfile(os.path.join(k, "index.html")):
        return None, "без слэша: Netlify даст 301"
    return None, "нет файла"

def noindex(f):
    return bool(re.search(r'<meta[^>]*name=["\']robots["\'][^>]*noindex', open(f, encoding="utf8").read(), re.I))

bedy = []
sm = open(os.path.join(ST, "sitemap.xml"), encoding="utf8").read() if os.path.exists(os.path.join(ST, "sitemap.xml")) else ""
if not sm:
    bedy.append("sitemap.xml: нет файла")
for u in re.findall(r"<loc>([^<]+)</loc>", sm) + re.findall(r'xhtml:link[^>]*href="([^"]+)"', sm):
    f, pochemu = fayl(u)
    if not f:
        bedy.append("sitemap: %s — %s" % (u, pochemu))
    elif noindex(f):
        bedy.append("sitemap: %s — страница под noindex" % u)

def svoy_adres(rel):
    if rel == "index.html": return "/"
    if rel.endswith("/index.html"): return "/" + rel[:-10]
    return "/" + rel[:-5]

html = [os.path.join(k, f) for k, _, fs in os.walk(ST) for f in fs if f.endswith(".html")]
indeks = zakryto = 0
for f in sorted(html):
    rel = os.path.relpath(f, ST)
    a = svoy_adres(rel)
    if a in redir or a.rstrip("/") in redir:
        zakryto += 1          # страницу перекрывает 301! — посетитель её не видит, её ссылки не в счёт
        continue
    t = open(f, encoding="utf8").read()
    if not noindex(f):
        indeks += 1
        can = re.findall(r'<link[^>]*rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', t, re.I) + \
              re.findall(r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']canonical', t, re.I)
        if not can:
            bedy.append("%s: индексируется, а canonical нет" % rel)
        for u in can:
            if not fayl(u)[0]:
                bedy.append("%s: canonical %s — %s" % (rel, u, fayl(u)[1]))
    for tag in re.findall(r"<link[^>]*hreflang[^>]*>", t, re.I):
        m = re.search(r'href=["\']([^"\']+)', tag)
        if m and not fayl(m.group(1))[0]:
            bedy.append("%s: hreflang %s — %s" % (rel, m.group(1), fayl(m.group(1))[1]))

print("html %d (перекрыто 301: %d), индексируемых %d, адресов в sitemap %d"
      % (len(html), zakryto, indeks, len(re.findall(r"<loc>", sm))))
if bedy:
    print("НАХОДКИ (%d):" % len(bedy))
    for b in bedy[:80]:
        print("  ✗ " + b)
    sys.exit(1)
print("ЧИСТО: sitemap, canonical, hreflang ведут на файлы stage")
