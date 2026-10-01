# -*- coding: utf-8 -*-
"""Правки анкеты после ревизии:
 1. Блок 10 (материалы для сайта) — необязательный: сайт входит во внедрение, а не в диагностику.
 2. Новый мягкий вопрос про порядок вложений — чтобы приходить на стратсессию, зная вилку.
 3. Убираем дубль по отзывам (4.8 ↔ 10.4).
"""
import os, json, time
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {"anketa-b-7k3m9x.html": "biznes", "anketa-e-4q8v2n.html": "ekspert"}

BUDGET = {
 "biznes": dict(id="9.7", req=False,
   text="Если по итогам разбора мы предложим внедрение — какой <strong>порядок вложений</strong> для вас нормален? Не обязательство, а ориентир: он нужен, чтобы мы предлагали посильное, а не абстрактное.",
   hint="Можно диапазоном или «пока не думал об этом» — это тоже честный ответ.",
   options=["до $5k","$5–10k","$10–20k","$20k+","пока не думал","другое"]),
 "ekspert": dict(id="9.7", req=False,
   text="Если по итогам разбора мы предложим внедрение — какой <strong>порядок вложений</strong> для вас нормален? Не обязательство, а ориентир: он нужен, чтобы мы предлагали посильное, а не абстрактное.",
   hint="Можно диапазоном или «пока не думал об этом» — это тоже честный ответ.",
   options=["до $5k","$5–10k","$10–20k","$20k+","пока не думал","другое"]),
}

NOTE10 = ("Это понадобится на этапе внедрения, а не для самой диагностики. "
          "Есть под рукой — дайте сейчас, сэкономим время потом. Нет — спокойно пропускайте.")

for f, seg in FILES.items():
    p = os.path.join(HERE, f)
    s = open(p, encoding="utf-8").read()
    line = [l for l in s.split("\n") if l.startswith("var DATA=")][0]
    d = json.loads(line[9:].rstrip(";"))

    freed = 0
    for b in d["blocks"]:
        if str(b["num"]) == "10":
            b["sub"] = NOTE10
            for q in b["qs"]:
                if q.get("req"): q["req"] = False; freed += 1
                # дубль с 4.8 — оставляем один заход про отзывы, здесь только материалы
                if q["id"] == "10.4":
                    q["text"] = ("Файлы и ссылки на отзывы/кейсы, если они где-то лежат: скриншоты, видео, страница с отзывами. "
                                 "<em>Сами формулировки вы уже дали в 4.8 — здесь нужны именно материалы.</em>")
        if str(b["num"]) == "9":
            if not any(q["id"] == "9.7" for q in b["qs"]):
                b["qs"].append(BUDGET[seg])

    s = s.replace(line, "var DATA=" + json.dumps(d, ensure_ascii=False) + ";")
    open(p, "w", encoding="utf-8").write(s)
    time.sleep(1)
    chk = json.loads([l for l in open(p, encoding="utf-8").read().split("\n") if l.startswith("var DATA=")][0][9:].rstrip(";"))
    tot = sum(len(b["qs"]) for b in chk["blocks"])
    req = sum(1 for b in chk["blocks"] for q in b["qs"] if q.get("req"))
    has97 = any(q["id"] == "9.7" for b in chk["blocks"] for q in b["qs"])
    b10req = sum(1 for b in chk["blocks"] if str(b["num"]) == "10" for q in b["qs"] if q.get("req"))
    print(f"  ✓ {f}: вопросов {tot}, обязательных {req} (снял в блоке 10: {freed}), 9.7 добавлен: {has97}, обязательных в блоке 10: {b10req}")
