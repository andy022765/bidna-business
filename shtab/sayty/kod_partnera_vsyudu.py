# -*- coding: utf-8 -*-
"""Код партнёра — на КАЖДУЮ страницу собранного сайта, последним шагом сборки.

Зачем отдельным проходом. Страницы делают четыре разных генератора: sborka.py
(Вера, Видимость, диагностика, звонки), merge_site.py (корень, business, expert),
pravo_site.py (юридические), list.py. Вставлять код в каждый — значит однажды
завести пятый и молча потерять партнёра: человек придёт по ссылке на страницу
без вставки, код не запомнится, и никто об этом не узнает.

Проход идёт по готовой папке, поэтому ему всё равно, кто что собрал.
Метка `/* REFERAL */` делает его безвредно повторяемым.

    python3 shtab/sayty/kod_partnera_vsyudu.py /tmp/bidna-stage
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sborka import REFERAL_JS  # noqa: E402  единственное место правды для самого скрипта


def projti(papka):
    vsego = postavleno = bylo = 0
    for koren, _, fayly in os.walk(papka):
        for f in fayly:
            if not f.endswith(".html"):
                continue
            vsego += 1
            put = os.path.join(koren, f)
            t = io.open(put, encoding="utf-8").read()
            if "/* REFERAL */" in t:
                bylo += 1
                continue
            # Перед </body>, если он есть: скрипт должен идти после разметки,
            # иначе на тяжёлой странице он отработает раньше, чем появятся кнопки.
            if "</body>" in t:
                t = t.replace("</body>", REFERAL_JS + "\n</body>", 1)
            else:
                t = t.rstrip() + "\n" + REFERAL_JS + "\n"
            io.open(put, "w", encoding="utf-8").write(t)
            postavleno += 1
    return vsego, postavleno, bylo


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("  укажите папку собранного сайта")
        raise SystemExit(2)
    vsego, postavleno, bylo = projti(sys.argv[1])
    print("  код партнёра: страниц %d · поставлено %d · уже было %d" % (vsego, postavleno, bylo))
    if postavleno + bylo != vsego:
        print("  НЕ НА ВСЕХ СТРАНИЦАХ — это потеря партнёра, разберитесь")
        raise SystemExit(1)
