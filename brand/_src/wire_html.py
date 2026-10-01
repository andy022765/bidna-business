# -*- coding: utf-8 -*-
"""Вшивает знак A (компакт, выворот) в лендинги / квизы / интейки вместо старых столбиков
+ ставит фавикон дата-URI (чтобы деплой зипом не тянул лишних файлов)."""
import os, re, sys, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inline import inline, favicon_uri

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "landings")
BARS = '<span class="bars"><i></i><i></i><i></i><i></i></span>'
MARK = inline("mark/dna-mark-compact-reverse.svg")

FAV = ('<link rel="icon" href="%s">\n'
       '<link rel="icon" href="%s" media="(prefers-color-scheme: dark)">\n'
       % (favicon_uri("icon/favicon.svg"), favicon_uri("icon/favicon-dark.svg")))

# (файл, css-селектор-родитель, высота знака в px, css старых столбиков — regex)
JOBS = [
    ("biznes.html",        ".logo",   30),
    ("ekspert.html",       ".logo",   30),
    ("quiz-biznes.html",   ".brand",  20),
    ("quiz-ekspert.html",  ".brand",  20),
    ("intake-biznes.html", ".logo",   24),
    ("intake-ekspert.html",".logo",   24),
]

BARS_CSS = re.compile(r"^\s*\.(?:logo|brand) \.bars.*$\n?", re.M)

for name, sel, h in JOBS:
    p = os.path.join(ROOT, name)
    s = open(p, encoding="utf-8").read()
    orig = s

    n_bars = s.count(BARS)
    s = s.replace(BARS, MARK)

    # старые правила .bars → одно правило .mark
    removed = len(BARS_CSS.findall(s))
    s = BARS_CSS.sub("", s)
    rule = f"{sel} .mark{{height:{h}px;width:auto;display:block;flex:none}}\n"
    # ставим правило туда, где было первое правило столбиков — сразу после объявления родителя
    anchor = re.search(r"^" + re.escape(sel) + r"\{[^\n]*\n", s, re.M)
    s = s[:anchor.end()] + rule + s[anchor.end():]

    # фавикон — перед первым <link rel="preconnect"> или сразу после <title>
    n_fav = 0
    if 'rel="icon"' not in s:
        m = re.search(r"</title>\n", s)
        s = s[:m.end()] + FAV + s[m.end():]
        n_fav = 2

    # доступное имя ссылки-логотипа: на мобиле вордмарк прячется через display:none
    s = s.replace('<a class="logo" href="#top">',
                  '<a class="logo" href="#top" aria-label="Business Intelligence DNA">')

    open(p, "w", encoding="utf-8").write(s)
    print(f"{name:22} знак×{n_bars}  css-правил снято:{removed}  фавикон:{n_fav}  {len(orig)}→{len(s)}")
