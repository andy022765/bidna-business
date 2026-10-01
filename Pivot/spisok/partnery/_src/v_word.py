# -*- coding: utf-8 -*-
"""Word-версии файлов партнёрки через общий docs/_src/md2docx.py (сам скрипт не трогаем).
Перед ним: склеиваем продолжения пунктов списков, блок кода -> отдельные строки `кода`."""
import re, sys, pathlib
PROJ = pathlib.Path("/Users/andriizhyla/Library/CloudStorage/GoogleDrive-andywar777@gmail.com/My Drive/Андрей/Private/Investment/DNA for Businesses/Our Business (Andrii & Masha)")
sys.path.insert(0, str(PROJ / "docs/_src"))
import md2docx
SRC = PROJ / "Pivot/spisok/partnery"
TMP = pathlib.Path("/tmp") / "partnery_docx_tmp"; TMP.mkdir(exist_ok=True)
ITEM = re.compile(r'^\s*([-*]|\d+\.)\s+')

def prep(md):
    out, code, in_item = [], False, False
    for ln in md.split("\n"):
        if ln.strip().startswith("```"):
            code = not code; in_item = False; continue
        if code:
            if ln.strip(): out += ["`%s`" % ln.rstrip(), ""]
            continue
        if ITEM.match(ln):
            out.append(ln); in_item = True; continue
        if in_item and ln.startswith("  ") and ln.strip() and not ITEM.match(ln):
            out[-1] = out[-1].rstrip() + " " + ln.strip(); continue
        in_item = False
        out.append(ln)
    return "\n".join(out)

for name in sys.argv[1:]:
    t = TMP / (name + ".md")
    t.write_text(prep((SRC / (name + ".md")).read_text(encoding="utf-8")), encoding="utf-8")
    print(md2docx.build(str(t), str(SRC / (name + ".docx"))))
