# -*- coding: utf-8 -*-
"""То же вшивание знака, но для презентаций (presentations/*.html)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inline import inline, favicon_uri

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "presentations")
BARS = '<span class="bars"><i></i><i></i><i></i><i></i></span>'
MARK = inline("mark/dna-mark-compact-reverse.svg")
FAV = ('<link rel="icon" href="%s">\n'
       '<link rel="icon" href="%s" media="(prefers-color-scheme: dark)">\n'
       % (favicon_uri("icon/favicon.svg"), favicon_uri("icon/favicon-dark.svg")))
BARS_CSS = re.compile(r"^\s*\.brand \.bars.*$\n?", re.M)

for name in ("biznes.html", "ekspert.html", "ekspert.src.html"):
    p = os.path.join(ROOT, name)
    s = open(p, encoding="utf-8").read()
    n = s.count(BARS); s = s.replace(BARS, MARK)
    removed = len(BARS_CSS.findall(s)); s = BARS_CSS.sub("", s)
    a = re.search(r"^\.brand\{[^\n]*\n", s, re.M)
    s = s[:a.end()] + ".brand .mark{height:26px;width:auto;display:block;flex:none}\n" + s[a.end():]
    fav = 0
    if 'rel="icon"' not in s:
        m = re.search(r"</title>\n", s); s = s[:m.end()] + FAV + s[m.end():]; fav = 2
    open(p, "w", encoding="utf-8").write(s)
    print(f"{name:20} знак×{n}  css снято:{removed}  фавикон:{fav}")
