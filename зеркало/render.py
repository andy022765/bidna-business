# -*- coding: utf-8 -*-
"""Рендер результатов обкатки «Зеркала» в читаемый вид.

Показывает ровно то, что увидел бы сам человек на сайте, плюс служебную врезку
(что удалось прочитать, кого нашли, сколько заняло) — она клиенту не показывается.
Источник — JSON-выгрузки прогона, лежат в _исходники/.
"""
import os, sys, json, glob, html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "landings", "_src"))
sys.path.insert(0, os.path.join(ROOT, "brand", "_src"))
from funnel import CSS
from mirror import EXTRA_CSS
from inline import inline, favicon_uri

MARK = inline("mark/dna-mark-compact-reverse.svg")
FAV = ('<link rel="icon" href="%s">' % favicon_uri("icon/favicon.svg"))
e = lambda s: html.escape(str(s if s is not None else ""))

SERVICE_CSS = """
.svc{background:#eef1f7;border:1px solid #ccd4e6;border-radius:13px;padding:16px 20px;margin:18px 0;font-size:14.5px}
.svc b.k{display:inline-block;min-width:180px;color:#4a5270}
.svc .row{padding:3px 0}
.badge{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
 padding:3px 9px;border-radius:6px;background:#dfe5f3;color:#39406a;margin-left:6px}
.badge.warn{background:#fbe6c8;color:#7a5310}
.badge.bad{background:#fadcdc;color:#8c2020}
.who{font-size:15px;color:var(--muted);margin:2px 0 0}
"""

def shell(title, body):
    return f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{e(title)}</title>{FAV}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}{EXTRA_CSS}{SERVICE_CSS}</style></head>
<body>
<header class="bar"><div class="row">
  <span class="logo">{MARK}<span>Business Intelligence <span class="g">DNA</span></span></span>
</div></header>
<div class="wrap">
{body}
<footer>Обкатка «Зеркала» · внутренний документ · {len(body)//1000} КБ</footer>
</div></body></html>"""


def short_name(n):
    n = str(n or "").split("(")[0].strip()
    if len(n) <= 16:
        return n
    cut = n[:16]; sp = cut.rfind(" ")
    return (cut[:sp] if sp > 7 else cut) + "…"


def render_one(d):
    p, v = d["person"], d["verdict"]
    page, soc = d["page"], d.get("social") or {}
    live = [r for r in d["fetched"].get("rivals", []) if r.get("ok")]

    # ── служебная врезка: её клиент не видит ──
    if page.get("ok"):
        read = 'страницу прочитали напрямую<span class="badge">сайт</span>'
    elif page.get("social"):
        got = "шапка профиля найдена" if soc.get("bio") else "шапку профиля найти не удалось"
        cls = "" if soc.get("bio") else " warn"
        read = f'соцсеть, машина её не читает — добирали поиском: {got}<span class="badge{cls}">соцсеть</span>'
    else:
        read = f'ссылка не открылась ({e(page.get("reason"))})<span class="badge bad">мёртвая ссылка</span>'

    svc = f"""<div class="svc">
  <div class="row"><b class="k">Ссылка</b> <a href="{e(p['link'])}" target="_blank" rel="noopener">{e(p['link'])}</a></div>
  <div class="row"><b class="k">Сегмент</b> {'эксперт' if p['segment']=='expert' else 'бизнес'}</div>
  <div class="row"><b class="k">Что удалось прочитать</b> {read}</div>"""
    if soc.get("bio"):
        svc += f'\n  <div class="row"><b class="k">Шапка профиля</b> «{e(soc["bio"])}»</div>'
    if soc.get("audience"):
        svc += f'\n  <div class="row"><b class="k">Аудитория</b> {e(soc["audience"])}</div>'
    svc += f"""
  <div class="row"><b class="k">Ниша (определил сам)</b> {e(d['rivals'].get('niche'))}</div>
  <div class="row"><b class="k">Гео</b> {e(d['rivals'].get('geo'))}</div>
  <div class="row"><b class="k">Соседи</b> открыл {d['fetched'].get('opened')} из {d['fetched'].get('tried')}: """ + \
        " · ".join(f'<a href="{e(r["url"])}" target="_blank" rel="noopener">{e(r["name"])}</a>' for r in live) + f"""</div>
  <div class="row"><b class="k">Время</b> {d.get('total')} c</div>
</div>"""

    # ── дальше ровно то, что увидел бы человек ──
    h = f"""<div class="head">
  <div class="eyebrow">Обкатка · {e(p['name'])}</div>
  <h1 class="t">Вот что видит человек, который вас сравнивает</h1>
  <p class="who">{e(p['what'])}</p>
</div>
{svc}"""

    h += f"""<div class="card"><div class="eyebrow">Ход 1 · зеркало</div>
<h2 style="margin:10px 0 16px">Вот как вы себя описываете</h2>
<p class="quote">{e(v.get('line'))}</p>
<div class="qsrc">{'дословно с вашей страницы' if page.get('ok') else ('шапка профиля из открытых источников' if soc.get('bio') else 'ваша собственная формулировка — страницу машина не читает')}</div>"""
    nb = v.get("neighbors") or []
    if nb:
        h += '<h2 style="font-size:19px;margin:24px 0 4px">А вот что говорят рядом</h2>'
        for n in nb:
            h += f'<div class="nb"><div class="nm">{e(n.get("name"))}</div><div class="ln">«{e(n.get("line"))}»</div></div>'
    if v.get("echo"):
        h += f'<div class="echo">{e(v["echo"])}</div>'
    h += "</div>"

    h += f"""<div class="card"><div class="eyebrow">Ход 2 · почему так выходит</div>
<p style="margin:12px 0 0;font-size:17.5px">{e(v.get('mechanism'))}</p></div>"""

    rows = v.get("table") or []
    if rows and live:
        h += """<div class="card"><div class="eyebrow">Ход 3 · что видит клиент</div>
<h2 style="margin:10px 0 14px">Четыре вещи, которые он ищет глазами</h2>
<div style="overflow-x:auto"><table class="cmp"><thead><tr><th></th><th class="me">Вы</th>"""
        for r in live:
            h += f"<th>{e(short_name(r.get('name')))}</th>"
        h += "</tr></thead><tbody>"
        for row in rows:
            yes = bool(row.get("you"))
            h += f'<tr><td>{e(row.get("label"))}</td><td class="me {"yes" if yes else "no"}">{"✓" if yes else "—"}</td>'
            them = row.get("them") or []
            for i in range(len(live)):
                t = bool(them[i]) if i < len(them) else False
                h += f'<td class="{"yes" if t else "no"}">{"✓" if t else "—"}</td>'
            h += "</tr>"
        h += "</tbody></table></div></div>"

    h += f"""<div class="card"><div class="eyebrow">Ход 4 · куда это чинится</div>
<p style="margin:12px 0 0;font-size:17.5px">{e(v.get('direction'))}</p>"""
    if v.get("howwefix"):
        h += f'<div class="fix"><div class="k">Чем чиним</div><div class="v">{e(v["howwefix"])}</div></div>'
    h += "</div>"

    h += f"""<div class="card cliff"><div class="eyebrow">Дальше</div>
<p class="c" style="margin:12px auto 0">{e(v.get('cliff'))}</p></div>"""
    return shell(f"Зеркало · {p['name']}", h)


if __name__ == "__main__":
    src = os.path.join(HERE, sys.argv[1], "_исходники")
    out = os.path.join(HERE, sys.argv[1])
    for f in sorted(glob.glob(os.path.join(src, "*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        # в той же папке лежит список людей — это не результат прогона
        if not isinstance(d, dict) or "person" not in d:
            continue
        name = os.path.basename(f).replace(".json", ".html")
        open(os.path.join(out, name), "w", encoding="utf-8").write(render_one(d))
        print("  ✓", name)
