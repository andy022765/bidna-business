#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Готовность лендингов к трафику. Одна команда — один ответ.

    python3 shtab/sayty/gotovnost.py

Проверяет ЖИВОЙ сайт, а не файлы. Каждый пункт — то, что сломается у настоящего
посетителя, а не то, что красиво выглядит в исходнике. Правило дня 23.09: смотреть
на источник, а не на его след. Поэтому ключи проверяются вызовом функции, а не
списком переменных, страницы — запросом, а не сборкой.

Два пункта машина проверить не может, они помечены РУКАМИ: настоящий разговор
с Верой и настоящая отправка формы. Их закрывает человек.
"""
import json, re, ssl, sys, time, urllib.error, urllib.request
import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
UA = {"User-Agent": "BusinessIntelDNA-LinkPreview/1.0 (+https://businessinteldna.com)"}
DOM = "https://businessinteldna.com"
itogi = []


def pishem(nazvanie, ok, podrobno=""):
    itogi.append((nazvanie, ok))
    znak = "ок  " if ok is True else ("РУКИ" if ok is None else "НЕТ ")
    print("  %s %-44s %s" % (znak, nazvanie, podrobno))


def vzyat(put, tajm=45, telo=None):
    r = urllib.request.Request(DOM + put, headers=dict(UA, **({"Content-Type": "application/json"} if telo else {})),
                               data=json.dumps(telo).encode() if telo else None)
    try:
        with urllib.request.urlopen(r, timeout=tajm, context=CTX) as o:
            return o.status, o.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf8", "replace")
    except Exception as e:
        return 0, str(e)


print("\nСТРАНИЦЫ")
adresa = []
for s in ("visibility", "call-audit", "vera"):
    adresa += ["/%s/" % s, "/%s/ru/" % s, "/%s/thanks/" % s, "/%s/ru/thanks/" % s,
               "/%s/paid/" % s, "/%s/ru/paid/" % s]
adresa += ["/diagnostic/", "/diagnostic/ru/", "/diagnostic/paid/", "/diagnostic/ru/paid/"]
ploho = [u for u in adresa if vzyat(u, 25)[0] != 200]
pishem("22 страницы отдают 200", not ploho, "не 200: " + ", ".join(ploho) if ploho else "все")

print("\nОБЕЩАНИЯ ПЕРВОГО ЭКРАНА")
t0 = time.time()
kod, telo = vzyat("/.netlify/functions/proverka", 60, {"trade": "roofing contractor", "city": "Tampa"})
try:
    d = json.loads(telo)
except Exception:
    d = {}
zhivo = kod == 200 and not d.get("pozzhe") and bool(d.get("imena"))
pishem("видимость: проверка за 30 секунд работает", zhivo,
       "%.1fс · %s" % (time.time() - t0, d.get("pochemu") or ("имён %d" % len(d.get("imena") or []))))

kod, telo = vzyat("/vera/", 25)
pishem("Вера: телефон на первом экране", "424 781 1913" in telo)
pishem("демо Веры отвечает", vzyat("/vera/ru/thanks/", 25)[0] == 200 and
       urllib.request.urlopen(urllib.request.Request(
           "https://dezhurny-r4p8w2.netlify.app/demo/", headers=UA), timeout=25, context=CTX).status == 200)

print("\nСЧЁТЧИКИ И КАССА")
for p, imya in (("vidimost", "мест по видимости"), ("diagnostika", "мест по диагностике")):
    kod, telo = vzyat("/.netlify/functions/mesta?p=" + p, 25)
    try:
        d = json.loads(telo)
    except Exception:
        d = {}
    pishem("счётчик %s" % imya, isinstance(d.get("left"), int), telo[:40])
pishem("счётчик воронки отвечает", vzyat("/.netlify/functions/ev-lend?k=bidna-voronka-2026&view=1", 25)[0] == 200)

print("\nЧТО ОБЕЩАНО И НЕ АВТОМАТИЗИРОВАНО")
try:
    import subprocess
    put = "netlify-functions/submission-created.js"
    kod = open(__file__.rsplit("/shtab/", 1)[0] + "/" + put, encoding="utf-8").read()
    nuzhny = ["geo-check", "line-check", "vera-demo"]
    net = [f for f in nuzhny if f not in kod]
    pishem("письмо человеку по новым формам", not net, "не знает: " + ", ".join(net) if net else "все шесть форм")
except Exception as e:
    pishem("письмо человеку по новым формам", False, str(e)[:50])

print("\nТОЛЬКО РУКАМИ")
pishem("расшифровка после разговора с Верой приходит", None, "нужен настоящий звонок и почта")
pishem("заявка с формы доходит на support@", None, "нужна настоящая отправка формы")

plohih = sum(1 for _, o in itogi if o is False)
rukami = sum(1 for _, o in itogi if o is None)
print("\n" + "=" * 62)
print("ПРОВАЛЕНО: %d · ЖДЁТ ЧЕЛОВЕКА: %d · ВСЕГО ПРОВЕРОК: %d" % (plohih, rukami, len(itogi)))
print("ТРАФИК МОЖНО" if plohih == 0 else "ТРАФИК НЕЛЬЗЯ — сначала закрыть провалы")
sys.exit(1 if plohih else 0)
