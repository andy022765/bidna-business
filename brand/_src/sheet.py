# -*- coding: utf-8 -*-
"""Контрольная простыня пакета: как знак живёт на светлом/тёмном и на малых размерах."""
import os, sys, base64
HERE = os.path.dirname(os.path.abspath(__file__)); BRAND = os.path.dirname(HERE)
def u(p): return "data:image/svg+xml;base64," + base64.b64encode(
    open(os.path.join(BRAND, p), "rb").read()).decode()
def img(p, h): return f'<img src="{u(p)}" style="height:{h}px">'

rows = [
 ("Знак — на светлом", "#fff", "".join(img("mark/dna-mark.svg", s) for s in (96,56,40,32,24,16))),
 ("Знак — выворот", "#1b2557", "".join(img("mark/dna-mark-reverse.svg", s) for s in (96,56,40,32,24,16))),
 ("Полный vs компакт на малых (32 / 24 / 16) — ниже 32px только компакт", "#fff",
  "".join(img("mark/dna-mark.svg", s) for s in (32,24,16))
  + '<span style="display:inline-block;width:1px;height:44px;background:#ddd;margin:0 26px;vertical-align:middle"></span>'
  + "".join(img("mark/dna-mark-compact.svg", s) for s in (32,24,16))),
 ("Локапы: горизонтальный / инлайн / вертикальный", "#fff",
  '<div>' + img("lockup/lockup-h.svg", 56) + '</div><div style="margin-top:18px">'
  + img("lockup/lockup-inline.svg", 26) + '</div><div style="margin-top:18px">'
  + img("lockup/lockup-v.svg", 92) + '</div>'),
 ("Локапы — выворот", "#1b2557",
  '<div>' + img("lockup/lockup-h-reverse.svg", 56) + '</div><div style="margin-top:18px">'
  + img("lockup/lockup-inline-reverse.svg", 26) + '</div>'),
 ("Печать — круглая (128 / 64 / 40 / 32)", "#fff",
  "".join(img("seal/seal.svg", s) for s in (128,64,40,32))),
 ("Печать: контур под тиснение / ч-б / иконка приложения", "#fff",
  img("seal/seal-outline.svg", 96) + img("seal/seal-mono-black.svg", 96)
  + img("icon/app-icon-rounded.svg", 96) + img("icon/app-icon.svg", 96)),
 ("Одноцветные: navy / чёрный / белый на чёрном", "#fff",
  img("mark/dna-mark-mono-navy.svg", 72) + img("mark/dna-mark-mono-black.svg", 72)
  + '<span style="display:inline-block;background:#000;padding:10px;vertical-align:middle">'
  + img("mark/dna-mark-mono-white.svg", 52) + '</span>'
  + img("lockup/lockup-h-mono-black.svg", 46)),
]
cards = "\n".join(
 f'<section style="background:{bg}"><h2 style="color:{"#8d8577" if bg=="#fff" else "#c9cee8"}">{t}</h2>'
 f'<div class="row">{c}</div></section>' for t, bg, c in rows)
open(os.path.join(HERE, "check.html"), "w", encoding="utf-8").write(f'''<!doctype html><meta charset="utf-8">
<title>Business Intelligence DNA — контроль знака</title>
<style>
 body{{margin:0;padding:26px;background:#f4f2ee;font:14px/1.4 -apple-system,Helvetica Neue,Arial}}
 section{{border-radius:14px;padding:20px 24px;margin-bottom:16px;border:1px solid rgba(0,0,0,.07)}}
 h2{{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 16px;font-weight:700}}
 .row{{display:flex;align-items:center;gap:30px;flex-wrap:wrap}}
 .row>div{{width:100%}} img{{display:inline-block;vertical-align:middle}}
</style>
{cards}
''')
print("brand/_src/check.html обновлён")
