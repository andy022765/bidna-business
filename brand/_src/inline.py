# -*- coding: utf-8 -*-
"""Инлайн-снипеты знака для вшивания в HTML: компактная геометрия, тугой viewBox.
Тянет геометрию из gen.py, чтобы знак в вебе и знак в SVG-пакете не разъезжались."""
import os, re, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)

VB = "29 12.5 42 75"          # тугая обрезка компактного знака (полоса 32..68 / 15..85 + запас на штрих)
W, H = 42, 75

def body(fname):
    """Внутренности brand-SVG без обёртки и <title>."""
    s = open(os.path.join(BRAND, fname), encoding="utf-8").read()
    s = re.sub(r"^.*?<title>.*?</title>\s*", "", s, flags=re.S)
    return s.replace("</svg>", "").strip()

def thin(s, keep=3):
    """Прореживает polyline: на 16-30px разницы не видно, а вес снипета падает втрое."""
    def cut(m):
        pts = m.group(1).split()
        pts = pts[::keep] + ([pts[-1]] if (len(pts)-1) % keep else [])
        return 'points="' + " ".join(pts) + '"'
    return re.sub(r'points="([^"]+)"', cut, s)

def inline(fname, cls="mark", extra=""):
    return (f'<svg class="{cls}" viewBox="{VB}" width="{W}" height="{H}" '
            f'aria-hidden="true" focusable="false"{extra}>' + body(fname) + '</svg>')

def favicon_uri(fname):
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}">' + thin(body(fname)) + '</svg>')
    s = re.sub(r"\s+", " ", s)
    return "data:image/svg+xml," + urllib.parse.quote(s, safe="")

if __name__ == "__main__":
    print("HEADER:\n", inline("mark/dna-mark-compact-reverse.svg")[:200], "…\n")
    for f in ("icon/favicon.svg", "icon/favicon-dark.svg"):
        u = favicon_uri(f)
        print(f, len(u), "симв.")
