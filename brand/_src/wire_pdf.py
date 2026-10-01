# -*- coding: utf-8 -*-
"""Вшивает бренд в вёрстку клиентской диагностики (печатный HTML → Chrome --print-to-pdf).
Логотип-локап сверху первой страницы, круглая печать в подвале."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from inline import inline, body, VB

def brand_css():
    return """
  /* ── Бренд ───────────────────────────────────────────────────────── */
  .brandhead{ display:flex; align-items:center; gap:9px; margin:0 0 18px; }
  .brandhead .mark{ height:30px; width:auto; display:block; flex:none; }
  .brandhead .wm{
    font-family:"Helvetica Neue", Arial, sans-serif; font-weight:700;
    font-size:9.5pt; letter-spacing:.14em; text-transform:uppercase; color:var(--ink);
  }
  .brandhead .wm b{ color:var(--gold-deep); font-weight:700; }
  .footer{ display:flex; align-items:flex-start; gap:16px; }
  .footer .seal{ width:52px; height:52px; flex:none; margin-top:2px; }
  .footer .ftext{ flex:1; }
"""

MARK = inline("mark/dna-mark-compact.svg", extra=' style="height:30px"')
SEAL = ('<svg class="seal" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
        + body("seal/seal.svg") + '</svg>')

HEAD = f'''  <div class="brandhead">
    {MARK}
    <span class="wm">Business Intelligence <b>DNA</b></span>
  </div>
'''

def patch(path):
    s = open(path, encoding="utf-8").read()
    # палитра — как в вебе, чтобы знак не спорил с акцентами документа
    s = s.replace("--ink:#1b2a41;         /* глубокий навигацкий */",
                  "--ink:#1b2557;         /* бренд-навигацкий (как в вебе) */")
    s = s.replace("--gold:#b0863f;        /* приглушённое золото — акцент */",
                  "--gold:#c69a4c;        /* бренд-золото — акцент */\n    --gold-deep:#b0812f;   /* тёмное золото — мелкий текст на бумаге */")
    s = s.replace("color:var(--gold);\n    margin:0 0 10px;", "color:var(--gold-deep);\n    margin:0 0 10px;")   # kicker
    s = s.replace("font-size:7.5pt; color:var(--gold); font-weight:700;",
                  "font-size:7.5pt; color:var(--gold-deep); font-weight:700;")                                    # brandfoot
    s = s.replace("</style>", brand_css() + "</style>")
    # название бренда теперь в логотипе — в кикере оно дублировалось
    s = re.sub(r'(<p class="kicker">)Business Intelligence DNA · ([^<]*)', r'\1\2', s)
    if 'class="brandhead"' not in s:
        s = s.replace("  <header>\n", HEAD + "\n  <header>\n", 1)
    # подвал: печать слева, текст справа
    s = re.sub(r'(<div class="footer">)\s*\n(\s*)(Материал конфиденциален[^\n]*)\n\s*(<div class="brandfoot">[^<]*</div>)',
               lambda m: f'{m.group(1)}\n{m.group(2)}{SEAL}\n{m.group(2)}<div class="ftext">{m.group(3)}\n{m.group(2)}  {m.group(4)}</div>', s)
    open(path, "w", encoding="utf-8").write(s)
    print("patched:", os.path.basename(path))

if __name__ == "__main__":
    for p in sys.argv[1:]:
        patch(p)
