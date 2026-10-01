# -*- coding: utf-8 -*-
"""Сборка пульта рекламы Веры: шаблон + обложки + ролики -> pult-reklamy-very.html.

    python3 targetolog/panel/sobrat.py

__COVERS__  <- covers.json  (обложки data URI, ключи noch / bot / pismo / demo)
__VIDEOS__  <- videos.json  (ролики в хранилище ассетов артефакта: /_blob/<id>)
Публикует главный агент (Artifact publish с url живого пульта), не этот скрипт.
"""
import json
import pathlib
import sys

P = pathlib.Path(__file__).resolve().parent
t = (P / "pult.template.html").read_text(encoding="utf-8")
covers = json.loads((P / "covers.json").read_text(encoding="utf-8"))
videos = json.loads((P / "videos.json").read_text(encoding="utf-8"))
for k in ("__COVERS__", "__VIDEOS__"):
    if t.count(k) != 1:
        sys.exit("в шаблоне %s встречается %d раз(а), нужно 1" % (k, t.count(k)))
out = t.replace("__COVERS__", json.dumps(covers, ensure_ascii=False)).replace("__VIDEOS__", json.dumps(videos, ensure_ascii=False))
(P / "pult-reklamy-very.html").write_text(out, encoding="utf-8")
print("собрано: pult-reklamy-very.html, %d байт" % len(out.encode("utf-8")))
