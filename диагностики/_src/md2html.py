# -*- coding: utf-8 -*-
"""Клиентский markdown → фирменный печатный HTML на базе _шаблон-KLIENT.html.
Чтобы рендер в PDF был шагом агента, а не ручной вёрсткой каждый раз.
Использование: md2html.py <in.md> <out.html> "<кикер>"
"""
import os, re, sys, html

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # диагностики/
TPL  = os.path.join(HERE, "_шаблон-KLIENT.html")

def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t

def build(md):
    lines = md.split("\n")
    title = byline = ""
    out, i, n = [], 0, 0
    # заголовок и подпись
    while i < len(lines):
        L = lines[i].strip()
        if L.startswith("# "):  title = L[2:].strip(); i += 1; continue
        if L.startswith("---"): i += 1; break
        if L and not title: i += 1; continue
        if L and title and not byline: byline = L; i += 1; continue
        i += 1
    body, buf, mode = [], [], None

    def flush():
        nonlocal buf, mode
        if not buf: return
        if mode == "ul":
            body.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in buf) + "</ul>")
        elif mode == "quote":
            body.append('<div class="variants"><p style="margin:0"><strong>'
                        + " ".join(inline(x) for x in buf) + "</strong></p></div>")
        else:
            for p in buf: body.append(f"<p>{inline(p)}</p>")
        buf, mode = [], None

    summary_open = False
    for L in lines[i:]:
        s = L.strip()
        if not s:
            flush(); continue
        if s.startswith("*") and s.endswith("*") and s.count("*") == 2:
            flush(); body.append(f'<div class="footer-note">{inline(s.strip("*"))}</div>'); continue
        if s.startswith("---"):
            flush(); continue
        if s.startswith("### "):
            flush(); body.append(f'<h3>{inline(s[4:].strip())}</h3>'); continue
        if s.startswith("## "):
            flush()
            if summary_open: body.append("</div>"); summary_open = False
            h = s[3:].strip()
            m = re.match(r'^(\d+)\.\s*(.+)$', h)
            if m:
                nn = m.group(1); body.append(f'<section><h2><span class="num">{nn}</span> {inline(m.group(2))}</h2>')
            elif "Коротко" in h:
                body.append(f'<div class="summary"><p class="lbl">{inline(h)}</p>'); summary_open = True
            else:
                body.append(f'<section><h2>{inline(h)}</h2>')
            continue
        if s.startswith("> "):
            if mode != "quote": flush(); mode = "quote"
            buf.append(s[2:]); continue
        if s.startswith("- "):
            if mode != "ul": flush(); mode = "ul"
            buf.append(s[2:]); continue
        if mode in ("ul", "quote"): flush()
        mode = "p"; buf.append(s)
    flush()
    if summary_open: body.append("</div>")
    return title, byline, "\n".join(body)

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    kicker  = sys.argv[3] if len(sys.argv) > 3 else "Глубокая диагностика"
    compact  = "--compact" in sys.argv         # для двухстраничного «Диагноза»
    internal = "--internal" in sys.argv        # внутренняя версия: другой цвет, плашка
    title, byline, body = build(open(src, encoding="utf-8").read())
    t = open(TPL, encoding="utf-8").read()
    t = t.replace("{{КОМПАНИЯ}}", title)
    t = re.sub(r'<p class="kicker">.*?</p>', f'<p class="kicker">{html.escape(kicker)}</p>', t, count=1)
    t = t.replace("<h1>{{ЗАГОЛОВОК}}</h1>", f"<h1>{html.escape(title)}</h1>")
    t = re.sub(r'<p class="byline">.*?</p>', f'<p class="byline">{html.escape(byline)}</p>', t, count=1)
    # вырезаем всё демо-тело шаблона между byline и футером, кладём своё
    t = re.sub(r'(<p class="byline">.*?</p>\s*</header>)(.*?)(\s*<div class="footer">)',
               lambda m: m.group(1) + "\n\n" + body + "\n" + m.group(3), t, flags=re.S)
    if internal:
        t = t.replace('<div class="brandhead">',
            '<div class="internal">Внутренний документ · клиенту не отправлять</div>\n  <div class="brandhead">', 1)
    t = t.replace("{{КОМПАНИЯ_РОД}}", "компании")
    t = re.sub(r'\{\{[^}]+\}\}', '', t)
    # стиль для сноски внизу
    extra = ("  h3{font-family:\"Helvetica Neue\",Arial,sans-serif;color:var(--ink);font-size:11.5pt;"
             "margin:16px 0 6px;break-after:avoid}\n")
    extra += "  .footer-note{font-size:9pt;color:var(--muted);font-style:italic;margin-top:18px}\n"
    if internal:   # красный акцент вместо золота + плашка в шапке
        extra += ("  :root{--gold:#a33a3a;--gold-deep:#8f2f2f}\n"
                  "  .accentbar{background:#a33a3a}\n"
                  "  .summary{border-left-color:#a33a3a;background:#fbf4f4}\n"
                  "  .internal{border:1.5px solid #a33a3a;background:#fbf4f4;color:#8f2f2f;"
                  "font-family:\"Helvetica Neue\",Arial,sans-serif;font-weight:700;font-size:9pt;"
                  "letter-spacing:.12em;text-transform:uppercase;padding:8px 14px;border-radius:6px;"
                  "margin:0 0 14px;text-align:center}\n")
    if compact:   # «Диагноз» обязан влезать в две страницы — иначе его не перешлют
        extra += ("  @page{margin:15mm 16mm 12mm 16mm}\n"
                  "  body{font-size:10pt;line-height:1.45}\n"
                  "  h1{font-size:21pt;margin-bottom:8px}\n"
                  "  .brandhead{margin-bottom:12px}\n"
                  "  .brandhead .mark{height:24px}\n"
                  "  section{margin-top:14px}\n"
                  "  h2{font-size:13pt;margin-bottom:6px}\n"
                  "  p{margin:0 0 8px}\n"
                  "  .summary{padding:12px 16px;margin:14px 0 16px}\n"
                  "  .variants{padding:10px 14px;margin:6px 0 10px}\n"
                  "  .footer{margin-top:16px;padding-top:8px}\n"
                  "  .footer .seal{width:40px;height:40px}\n")
    t = t.replace("</style>", extra + "</style>")
    open(dst, "w", encoding="utf-8").write(t)
    print(f"  ✓ {os.path.basename(dst)} — заголовок: {title[:50]}")
