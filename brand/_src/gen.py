# -*- coding: utf-8 -*-
"""Генератор фирменного пакета Business Intelligence DNA.
Знак A (Data Helix) + печать E (Helix Seal). Геометрия — из утверждённой доски концептов."""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen

TAU = math.pi * 2
HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = sys.argv[1]

# ── Палитра: взята с живых лендингов (landings/biznes.html :root) ────────────
NAVY      = "#1b2557"
NAVY_DEEP = "#0f1430"
GOLD      = "#c69a4c"
GOLD_DEEP = "#b0812f"
GOLD_SOFT = "#e3c88a"
CREAM     = "#f7f5f1"

# ── Геометрия спирали ────────────────────────────────────────────────────────
def helix(k, amp, y0, y1, n):
    out = []
    for i in range(n):
        t  = i / (n - 1)
        ph = TAU * k * t
        y  = y0 + (y1 - y0) * t
        out.append((50 + amp * math.sin(ph), 50 - amp * math.sin(ph), y))
    return out

def f(v):        return f"{v:.2f}".rstrip("0").rstrip(".")
def pts(seq):    return " ".join(f"{f(x)},{f(y)}" for x, y in seq)

def strands(h, color, w):
    a = [(p[0], p[2]) for p in h]
    b = [(p[1], p[2]) for p in h]
    g = ('<polyline points="%s" fill="none" stroke="%s" stroke-width="%s" '
         'stroke-linecap="round" stroke-linejoin="round"/>')
    return g % (pts(a), color, f(w)) + "\n  " + g % (pts(b), color, f(w))

def rungs(h, idx, color, w, min_span=0.0):
    out = []
    for i in idx:
        x1, x2, y = h[i]
        if abs(x1 - x2) < min_span:
            continue
        out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" '
                   'stroke-width="%s" stroke-linecap="round"/>'
                   % (f(x1), f(y), f(x2), f(y), color, f(w)))
    return "\n  ".join(out)

# Мастер-геометрия знака A — ровно с доски концептов
A_K, A_AMP, A_Y0, A_Y1, A_N = 1.35, 20, 16, 84, 41
A_RUNGS = list(range(3, A_N - 2, 4))

def mark_a(stroke, rung, sw=2.4, rw=3.4, min_span=0.0, rung_idx=None):
    h = helix(A_K, A_AMP, A_Y0, A_Y1, A_N)
    return strands(h, stroke, sw) + "\n  " + rungs(
        h, A_RUNGS if rung_idx is None else rung_idx, rung, rw, min_span)

# Компакт: та же спираль, но 1.5 оборота — симметрична, замыкается сверху и снизу
C_K, C_AMP, C_Y0, C_Y1, C_N = 1.5, 18, 15, 85, 61
def mark_compact(stroke, rung, sw=4.2, rw=5.4):
    h = helix(C_K, C_AMP, C_Y0, C_Y1, C_N)
    return strands(h, stroke, sw) + "\n  " + rungs(h, [10, 30, 50], rung, rw)

def scaled(inner, s, cx=50, cy=50):
    t = f"translate({f(cx - cx*s)},{f(cy - cy*s)}) scale({f(s)})"
    return f'<g transform="{t}">\n  {inner}\n  </g>'

# ── Шрифт → контуры ──────────────────────────────────────────────────────────
_cache = {}
def inter(wght):
    if wght not in _cache:
        ft = TTFont(os.path.join(HERE, "Inter.ttf"))
        _cache[wght] = instantiateVariableFont(ft, {"wght": wght, "opsz": 28}, inplace=True)
    return _cache[wght]

def run(text, wght, size, tracking=0.0, colors=None, default="#000"):
    """Возвращает (svg-группа с началом координат на левом баselineе, ширина)."""
    ft   = inter(wght)
    upem = ft["head"].unitsPerEm
    cmap = ft.getBestCmap(); gs = ft.getGlyphSet(); hm = ft["hmtx"]
    s    = size / upem
    x, parts = 0.0, []
    for ch in text:
        gn  = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: str(int(round(v)))); gs[gn].draw(pen); d = pen.getCommands()
        if d.strip():
            col = (colors or {}).get(ch, default)
            parts.append(f'<path d="{d}" transform="translate({f(x)},0)" fill="{col}"/>')
        x += hm[gn][0] + tracking * upem
    width = (x - tracking * upem) * s
    body = "\n    ".join(parts)
    return f'<g transform="scale({s:.6f},{-s:.6f})">\n    {body}\n  </g>', width

def cap_h(wght, size):
    return inter(wght)["OS/2"].sCapHeight / inter(wght)["head"].unitsPerEm * size

# ── Сборка SVG ───────────────────────────────────────────────────────────────
HEAD = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
        'width="{w}" height="{h}" role="img" aria-label="{t}">\n  <title>{t}</title>\n  ')

def svg(w, h, body, title, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>\n  ' if bg else ""
    return HEAD.format(w=f(w), h=f(h), t=title) + b + body + "\n</svg>\n"

def write(path, content):
    p = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(content)
    return path

files = []
W = files.append

# ── 1. Знак ──────────────────────────────────────────────────────────────────
W(write("mark/dna-mark.svg",
    svg(100, 100, mark_a(NAVY, GOLD), "Business Intelligence DNA — знак")))
W(write("mark/dna-mark-reverse.svg",
    svg(100, 100, mark_a(CREAM, GOLD_SOFT), "Business Intelligence DNA — знак, выворот")))
W(write("mark/dna-mark-mono-navy.svg",
    svg(100, 100, mark_a(NAVY, NAVY), "Business Intelligence DNA — знак, один цвет")))
W(write("mark/dna-mark-mono-white.svg",
    svg(100, 100, mark_a("#ffffff", "#ffffff"), "Business Intelligence DNA — знак, белый")))
W(write("mark/dna-mark-mono-black.svg",
    svg(100, 100, mark_a("#000000", "#000000"), "Business Intelligence DNA — знак, чёрный")))
W(write("mark/dna-mark-compact.svg",
    svg(100, 100, mark_compact(NAVY, GOLD), "Business Intelligence DNA — знак для малых размеров")))
W(write("mark/dna-mark-compact-reverse.svg",
    svg(100, 100, mark_compact(CREAM, GOLD_SOFT), "Знак для малых размеров, выворот")))

# ── 2. Локапы ────────────────────────────────────────────────────────────────
def lockup_h(ink, gold, name, title):
    """Знак + двухстрочный вордмарк: BUSINESS INTELLIGENCE / DNA."""
    M, GAP = 64, 18                       # размер знака, отступ до текста
    eb_size, eb_track = 8.4, 0.235
    dna_size = 34.0
    eb, eb_w   = run("BUSINESS INTELLIGENCE", 500, eb_size, eb_track, default=ink)
    dna, dna_w = run("DNA", 800, dna_size, 0.02, colors={"N": gold}, default=ink)
    cap_dna = cap_h(800, dna_size)
    text_h  = eb_size + 9 + cap_dna
    H = max(M, text_h) + 8
    my = (H - M) / 2
    tx = M + GAP
    ty_eb  = (H - text_h) / 2 + eb_size
    ty_dna = ty_eb + 9 + cap_dna
    body = (f'<g transform="translate(0,{f(my)}) scale({f(M/100)})">\n  '
            + mark_a(ink, gold) + "\n  </g>\n  "
            + f'<g transform="translate({f(tx)},{f(ty_eb)})">{eb}</g>\n  '
            + f'<g transform="translate({f(tx)},{f(ty_dna)})">{dna}</g>')
    return write(name, svg(tx + max(eb_w, dna_w), H, body, title))

W(lockup_h(NAVY,  GOLD,      "lockup/lockup-h.svg",         "Business Intelligence DNA"))
W(lockup_h(CREAM, GOLD_SOFT, "lockup/lockup-h-reverse.svg", "Business Intelligence DNA, выворот"))
W(lockup_h("#000000", "#000000", "lockup/lockup-h-mono-black.svg", "Business Intelligence DNA, чёрный"))
W(lockup_h("#ffffff", "#ffffff", "lockup/lockup-h-mono-white.svg", "Business Intelligence DNA, белый"))

def lockup_inline(ink, gold, name, title):
    """Знак + одна строка: Business Intelligence DNA. Для шапки сайта."""
    M, GAP = 40, 12
    size = 17.0
    a, aw = run("Business Intelligence ", 600, size, 0.012, default=ink)
    b, bw = run("DNA", 700, size, 0.012, default=gold)
    cap = cap_h(600, size)
    H  = M + 6
    ty = (H + cap) / 2
    tx = M + GAP
    body = (f'<g transform="translate(0,{f((H-M)/2)}) scale({f(M/100)})">\n  '
            + mark_a(ink, gold) + "\n  </g>\n  "
            + f'<g transform="translate({f(tx)},{f(ty)})">{a}</g>\n  '
            + f'<g transform="translate({f(tx+aw)},{f(ty)})">{b}</g>')
    return write(name, svg(tx + aw + bw, H, body, title))

W(lockup_inline(NAVY,  GOLD,      "lockup/lockup-inline.svg",         "Business Intelligence DNA"))
W(lockup_inline(CREAM, GOLD_SOFT, "lockup/lockup-inline-reverse.svg", "Business Intelligence DNA, выворот"))

def lockup_v(ink, gold, name, title):
    """Знак сверху, вордмарк по центру. Для титула PDF и обложки презентации."""
    M, GAP = 76, 20
    eb_size, eb_track, dna_size = 9.0, 0.26, 30.0
    eb, eb_w   = run("BUSINESS INTELLIGENCE", 500, eb_size, eb_track, default=ink)
    dna, dna_w = run("DNA", 800, dna_size, 0.02, colors={"N": gold}, default=ink)
    cap_dna = cap_h(800, dna_size)
    Wd = max(M, eb_w, dna_w) + 8
    H  = M + GAP + eb_size + 9 + cap_dna + 4
    body = (f'<g transform="translate({f((Wd-M)/2)},2) scale({f(M/100)})">\n  '
            + mark_a(ink, gold) + "\n  </g>\n  "
            + f'<g transform="translate({f((Wd-eb_w)/2)},{f(M+GAP+eb_size)})">{eb}</g>\n  '
            + f'<g transform="translate({f((Wd-dna_w)/2)},{f(M+GAP+eb_size+9+cap_dna)})">{dna}</g>')
    return write(name, svg(Wd, H, body, title))

W(lockup_v(NAVY,  GOLD,      "lockup/lockup-v.svg",         "Business Intelligence DNA"))
W(lockup_v(CREAM, GOLD_SOFT, "lockup/lockup-v-reverse.svg", "Business Intelligence DNA, выворот"))

# ── 3. Печать (концепт E) — оправа КРУГЛАЯ, решение Андрея 03.09 ────────────────────────────────────────────────────
SEAL_S = 0.60                              # спираль внутри печати = знак A × 0.60
SEAL_RUNGS = list(range(3, A_N - 2, 8))    # рунги через один: мелкий размер

def seal_inner(color, sw=3.6, rw=5.0):
    h = helix(A_K, A_AMP, A_Y0, A_Y1, A_N)
    inner = strands(h, color, sw) + "\n  " + rungs(h, SEAL_RUNGS, color, rw, min_span=3)
    return scaled(inner, SEAL_S)

W(write("seal/seal.svg", svg(100, 100,
    f'<circle cx="50" cy="50" r="42" fill="{NAVY}"/>\n  '
    f'<circle cx="50" cy="50" r="42" fill="none" stroke="{GOLD}" stroke-width="1.8"/>\n  '
    + seal_inner(GOLD_SOFT), "Business Intelligence DNA — круглая печать")))

W(write("seal/seal-mono-black.svg", svg(100, 100,
    '<circle cx="50" cy="50" r="42" fill="#000000"/>\n  '
    + seal_inner("#ffffff"), "Круглая печать, чёрно-белая")))

W(write("seal/seal-outline.svg", svg(100, 100,
    f'<circle cx="50" cy="50" r="42" fill="none" stroke="{NAVY}" stroke-width="1.8"/>\n  '
    + seal_inner(NAVY), "Круглая печать, контурная — для тиснения и штампа")))

# ── 4. Иконка приложения — навылет, платформа сама скруглит ──────────────────
def app_icon(name, bg, color, title, r=0):
    rc = f' rx="{f(r)}"' if r else ""
    return write(name, svg(100, 100,
        f'<rect width="100" height="100"{rc} fill="{bg}"/>\n  '
        + scaled(strands(helix(A_K, A_AMP, A_Y0, A_Y1, A_N), color, 3.4) + "\n  "
                 + rungs(helix(A_K, A_AMP, A_Y0, A_Y1, A_N), SEAL_RUNGS, color, 4.8, min_span=3),
                 0.66), title))

W(app_icon("icon/app-icon.svg", NAVY, GOLD_SOFT, "Business Intelligence DNA — иконка приложения"))
W(app_icon("icon/app-icon-rounded.svg", NAVY, GOLD_SOFT,
           "Иконка приложения со скруглением", r=22))

# Фавикон: компактная геометрия, прозрачный фон
W(write("icon/favicon.svg", svg(100, 100,
    mark_compact(NAVY, GOLD), "Business Intelligence DNA")))
W(write("icon/favicon-dark.svg", svg(100, 100,
    mark_compact(CREAM, GOLD_SOFT), "Business Intelligence DNA")))

print("\n".join(sorted(files)))
print("---", len(files), "файлов")
