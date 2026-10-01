"""Синтаксис встроенных <script> во всех .html папки (node --check). JSON-LD пропускает.
    python3 js_check.py <stage>
Эталон 29.09: 145 ок, 0 с ошибкой. Перенесено из временной папки сессии окна 29.09."""
import os, re, sys, subprocess, tempfile
papka = sys.argv[1]; ok = bad = 0; plohie = []
tmp = tempfile.mkdtemp()
for koren, _, fs in os.walk(papka):
    for f in fs:
        if not f.endswith(".html"): continue
        p = os.path.join(koren, f); t = open(p, encoding="utf8").read()
        for i, m in enumerate(re.finditer(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", t, re.S)):
            attrs, body = m.group(1), m.group(2)
            if "ld+json" in attrs or "application/json" in attrs: continue
            if not body.strip(): continue
            fn = os.path.join(tmp, "s.js"); open(fn, "w", encoding="utf8").write(body)
            r = subprocess.run(["node", "--check", fn], capture_output=True, text=True)
            if r.returncode == 0: ok += 1
            else:
                bad += 1; plohie.append("%s #%d: %s" % (os.path.relpath(p, papka), i, (r.stderr.strip().splitlines() or [''])[-1][:120]))
print("скриптов ок %d, с ошибкой %d" % (ok, bad))
for x in plohie[:30]: print("  ", x)
