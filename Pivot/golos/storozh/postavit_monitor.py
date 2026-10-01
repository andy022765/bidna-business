#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ставит проверки в UptimeRobot. Ставится 24.09.2026.

ЗАЧЕМ. 23.09 кончились кредиты Netlify и лёг весь бизнес. Наш сторож живёт на Маке
Андрея — спящий Мак не сторожит. UptimeRobot стоит на чужой земле.

API — ТОЛЬКО v3, И ЭТО ВЫЯСНЕНО ЖИВЬЁМ, А НЕ ИЗ СПРАВКИ.
Сначала писал на v2: справка у неё полнее, и на ней есть таблица параметров.
Но на бесплатном тарифе v2 отвечает `access_denied` — «You are not allowed to use some
settings with your current plan» — и отбивает ЛЮБОЕ создание, даже простейшего монитора
без слова и без контакта. Проверено перебором: дело не в типе и не в полях, а в самой v2.
Читать v2 при этом можно, писать нельзя. v3 создаёт нормально.

ЗНАЧЕНИЯ ПОЛЕЙ ТОЖЕ ВЫЯСНЕНЫ ЖИВЬЁМ: в справке v3 их нет вовсе, но API сам перечисляет
допустимые в тексте ошибки 400. Отсюда `ALERT_NOT_EXISTS`, `CaseSensitive`, timeout 0–60.

ОГРАНИЧЕНИЕ ЧАСТОТЫ: 10 запросов в минуту на бесплатном (заголовок `x-ratelimit-limit`).
Пауза между вызовами обязательна, иначе сыплется 403 — на этом я уже спотыкался.

КОНТАКТ ТРЕВОГИ ИЩЕМ, А НЕ СОЗДАЁМ. Почтовый контакт требует подтверждения по ссылке
из письма, а ящик `support@` ни одно окно не видит. При регистрации UptimeRobot заводит
контакт на почту аккаунта сам — его и берём.

ЗАПУСК:
    python3 postavit_monitor.py            # поставить
    python3 postavit_monitor.py --pokazat  # показать, ничего не меняя
    python3 postavit_monitor.py --proba    # поставить ПЯТУЮ, заведомо падающую (проверка тревоги)
    python3 postavit_monitor.py --ubrat-probu
Ключ — `UPTIMEROBOT_API_KEY` в `~/.bidna-golos.env`. В переписку ключ не пишем.
"""

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

API = "https://api.uptimerobot.com/v3"
PAUZA = 8
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

# Те же четыре цели, что у сторожа на Маке: разного рода нарочно. 23.09 легло всё разом,
# но следующий раз может положить что-то одно. Слова проверены живьём 24.09.
CELI = [
    ("BIDNA · видимость (касса на странице)",
     "https://businessinteldna.com/visibility/ru/", "buy.stripe.com"),
    ("BIDNA · Вера (телефон на странице)",
     "https://businessinteldna.com/vera/ru/", "424 781 1913"),
# 24.09: цель переведена с p=vidimost на p=diagnostika. Причина: Андрей снял
# ограничение «четыре клиента в квартал», и когда он уберёт предел в самой кассе
# Stripe, ответ по vidimost может измениться — сторож закричал бы на здоровый сайт.
# Ложная тревога убивает сторожа надёжнее молчания. У диагностики живой купон FIRST10.
    ("BIDNA · функция mesta (функции живы)",
     "https://businessinteldna.com/.netlify/functions/mesta?p=diagnostika", "left"),
    ("BIDNA · сайт Веры (второй проект)",
     "https://dezhurny-r4p8w2.netlify.app/demo/", "demo.js"),
# 26.09: пятая цель. 25.09 у OpenAI кончились деньги, бесплатная проверка видимости
# умерла ДЛЯ ВСЕХ, и мы узнали об этом через сутки и случайно. Страница при этом отдавала
# 200 и слово «buy.stripe.com» на месте — прежние четыре цели такое не ловят.
# Эндпоинт делает настоящий платный вызов в один токен (у /v1/models деньги не видны)
# и держит ответ в кэше двенадцать минут, поэтому сторож его не разорит.
    ("BIDNA · движки видимости (деньги на счетах)",
     "https://businessinteldna.com/.netlify/functions/zdorovie", "DVIZHKI-ZHIVY"),
]
PROBA_IMYA = "BIDNA · ПРОБА ТРЕВОГИ (удалить после проверки)"
PROBA_URL = "https://businessinteldna.com/visibility/ru/"
PROBA_SLOVO = "etogo-slova-na-stranice-net-proverka-trevogi"

INTERVAL = 300


def klyuch():
    k = os.environ.get("UPTIMEROBOT_API_KEY", "").strip()
    if k:
        return k
    try:
        for ln in open(os.path.expanduser("~/.bidna-golos.env"), encoding="utf-8"):
            ln = ln.strip().replace("export ", "", 1)
            if ln.startswith("UPTIMEROBOT_API_KEY="):
                return ln.split("=", 1)[1].strip().strip("\"'")
    except Exception:
        pass
    return ""


def call(metod, put, telo=None):
    r = urllib.request.Request(
        API + put,
        data=json.dumps(telo).encode() if telo is not None else None,
        headers={"Authorization": "Bearer " + klyuch(),
                 "Content-Type": "application/json", "Accept": "application/json"},
        method=metod)
    try:
        with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
            t = o.read().decode("utf8", "replace")
            return o.status, (json.loads(t) if t.strip().startswith(("{", "[")) else t)
    except urllib.error.HTTPError as e:
        t = e.read().decode("utf8", "replace")
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t[:300]
    except Exception as e:
        return 0, str(e)[:150]


def monitor(imya, url, slovo, kontakt):
    return {"type": "KEYWORD", "url": url, "friendlyName": imya,
            "interval": INTERVAL, "timeout": 30,
            # ALERT_NOT_EXISTS: тревога, когда слова НЕТ. Именно это нам и нужно —
            # страница может отдать 200 и быть пустой или подменённой.
            "keywordType": "ALERT_NOT_EXISTS", "keywordCaseType": "CaseSensitive",
            "keywordValue": slovo,
            "assignedAlertContacts": [{"alertContactId": kontakt,
                                       "threshold": 0, "recurrence": 0}]}


def vse_monitory():
    k, d = call("GET", "/monitors?limit=50")
    return {m.get("friendlyName"): m for m in (d.get("data") or [])} if k == 200 else {}


def main():
    if not klyuch():
        print("  Ключа нет. В ~/.bidna-golos.env строкой:")
        print("    export UPTIMEROBOT_API_KEY=<ключ из UptimeRobot → My Settings → API>")
        return 2

    k, d = call("GET", "/alert-contacts")
    if k != 200:
        print("  контакты не прочитались:", d)
        return 1
    kont = d.get("data") or []
    for c in kont:
        print("  контакт id=%s тип=%s статус=%s %s"
              % (c.get("id"), c.get("type"), c.get("status"), c.get("value")))
    pochta = [c for c in kont if str(c.get("type")).lower().startswith("email")]
    svoy = next((c for c in pochta if "support@businessinteldna.com" in str(c.get("value"))),
                pochta[0] if pochta else None)
    if not svoy:
        print("\n  ПОЧТОВОГО КОНТАКТА НЕТ — мониторы не ставлю, тревоге некуда идти.")
        print("  Андрею: My Settings → Alert Contacts → добавить support@businessinteldna.com")
        return 3
    kid = svoy["id"]
    print("  тревога пойдёт на: %s (id %s)" % (svoy.get("value"), kid))
    # Статус контакта сам по себе ничего не доказывает: доставку решает только
    # проверка падением (--proba). Отсюда и её обязательность.
    time.sleep(PAUZA)

    est = vse_monitory()
    time.sleep(PAUZA)

    if "--ubrat-probu" in sys.argv:
        m = est.get(PROBA_IMYA)
        if not m:
            print("  пробного монитора нет — убирать нечего")
            return 0
        k, _ = call("DELETE", "/monitors/%s" % m["id"])
        print("  пробный %s удалён: %s" % (m["id"], k))
        return 0 if k in (200, 204) else 1

    if "--pokazat" in sys.argv:
        for imya, _, _ in CELI + [(PROBA_IMYA, 0, 0)]:
            m = est.get(imya)
            print("  %-46s %s" % (imya, ("id %s · %s" % (m.get("id"), m.get("status")))
                                  if m else "нет"))
        return 0

    spisok = [(PROBA_IMYA, PROBA_URL, PROBA_SLOVO)] if "--proba" in sys.argv else CELI
    plohih = 0
    for imya, url, slovo in spisok:
        if imya in est:
            print("  %-46s уже стоит, id %s" % (imya, est[imya].get("id")))
            continue
        k, d = call("POST", "/monitors", monitor(imya, url, slovo, kid))
        if k in (200, 201):
            m = d.get("data") or d
            print("  %-46s поставлено, id %s" % (imya, m.get("id")))
        else:
            plohih += 1
            print("  %-46s НЕ ПОСТАВИЛОСЬ (%s): %s"
                  % (imya, k, json.dumps(d, ensure_ascii=False)[:160]))
        time.sleep(PAUZA)
    return 1 if plohih else 0


if __name__ == "__main__":
    sys.exit(main())
