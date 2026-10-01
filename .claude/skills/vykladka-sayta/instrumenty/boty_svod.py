"""Счётчик роботов нейросетей: кто и когда последний раз заходил на адреса. Только чтение.
    python3 boty_svod.py [префикс адреса ...]      например: python3 boty_svod.py /en/ /zvonki/
Ключ BOTY_KEY берёт из ~/.bidna-golos.env и НЕ печатает. Заходить на сайт с подставным UA робота нельзя:
это испортит статистику видимости, которую мы продаём. Новые адреса подтверждаются только настоящим роботом.
Эталон 29.09 22:40 PDT: отметок 49; /en/ и /zvonki/ — заходов ещё не было (edge-функция на них стоит с 29.09)."""
import json, os, re, ssl, sys, urllib.request
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()
k = None
for s in open(os.path.expanduser("~/.bidna-golos.env"), encoding="utf-8"):
    m = re.match(r"\s*(?:export\s+)?BOTY_KEY=['\"]?([^'\"\s]+)", s)
    if m:
        k = m.group(1)
if not k:
    sys.exit("нет BOTY_KEY в ~/.bidna-golos.env")
r = urllib.request.Request("https://businessinteldna.com/.netlify/functions/boty?k=" + k,
                           headers={"User-Agent": "BusinessIntelDNA-LinkPreview/1.0"})
d = json.load(urllib.request.urlopen(r, timeout=25, context=CTX))
pref = sys.argv[1:]
print("отметок всего:", d.get("otmetok"))
naydeno = {p: 0 for p in pref}
for poroda, boty in (d.get("svod") or {}).items():
    for bot, puti in boty.items():
        for put, v in puti.items():
            if pref and not any(put.startswith(p) for p in pref):
                continue
            for p in pref:
                if put.startswith(p):
                    naydeno[p] += 1
            print("  %-10s %-22s %-40s последний %s" % (poroda, bot, put, v.get("posledniy")))
for p, n in naydeno.items():
    if not n:
        print("  %s — заходов роботов ещё не было" % p)
