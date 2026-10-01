#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сторож: жив ли сайт. Ставится 24.09.2026.

ЗАЧЕМ. 23.09 весь бизнес лежал на `usage_exceeded` — страницы, функции и API Netlify разом.
Заметилось СЛУЧАЙНО, потому что ШТАБ в ту минуту гонял ревизию. Могло провисеть до утра.

ПОЧЕМУ НЕ НА NETLIFY. В тот раз легли и функции, и API. Сторож, живущий там же, в нужную
минуту молчит громче всех. Он обязан стоять на чужой земле — здесь это Мак, и у этого
есть своя цена: спящий Мак не сторожит. Честный ответ — сторонний монитор, см. CHITAT.md.

ЧТО ПРОВЕРЯЕТ — три РАЗНЫЕ машины, потому что ложатся они порознь:
  статическую страницу · страницу с кассой · функцию.

ЧЕТЫРЕ ПРАВИЛА, БЕЗ КОТОРЫХ СТОРОЖ БЕСПОЛЕЗЕН:
  1. читаем ТЕЛО ответа, а не только код: «503 · usage_exceeded» экономит десять минут,
     которые 23.09 были потеряны на выяснение причины;
  2. пишем на ПЕРЕХОД, а не на каждый тик: упал — одно сообщение, поднялся — одно.
     Поток уведомлений человек глушит, и сторожа больше нет;
  3. не верим одному промаху: два подряд, потом кричим. Одиночный таймаут — это сеть;
  4. раз в сутки — признак жизни. Молчащий сторож и сторож, которого нет, неразличимы.

Запуск: python3 storozh.py [--proba] [--tiho]
  --proba  подменить один адрес заведомо мёртвым: проверка самой тревоги
  --tiho   ничего не отправлять, только показать, что было бы
"""

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

DOM = "https://businessinteldna.com"
VERA = "https://dezhurny-r4p8w2.netlify.app"

# Три разные машины. Если добавляешь — добавляй РАЗНОГО рода, а не ещё одну статику.
CELI = [
    ("страница", DOM + "/visibility/ru/", 200, "Ваше имя"),
    # Именно ЛЕНДИНГ, а не «оплачено»: на странице после оплаты кассы нет и быть не должно.
    # Проверка 24.09 это и вскрыла — сторож объявлял живую страницу упавшей.
    ("касса", DOM + "/vera/ru/", 200, "buy.stripe.com"),
# 24.09: цель переведена с p=vidimost на p=diagnostika. Причина: Андрей снял
# ограничение «четыре клиента в квартал», и когда он уберёт предел в самой кассе
# Stripe, ответ по vidimost может измениться — сторож закричал бы на здоровый сайт.
# Ложная тревога убивает сторожа надёжнее молчания. У диагностики живой купон FIRST10.
    ("функция", DOM + "/.netlify/functions/mesta?p=diagnostika", 200, '"left"'),
    ("Вера", VERA + "/", 200, "<!doctype html"),
]

SOSTOYANIE = os.path.expanduser("~/.bidna-storozh.json")
TAYMAUT = 20
PROMAHOV_DO_TREVOGI = 2
# Питон с python.org не видит системные корневые сертификаты macOS. Проверку НЕ отключаем:
# просроченный сертификат — это тоже падение, и сторож, которому всё равно, его проспит.
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()
UA = {"User-Agent": "BusinessIntelDNA-Storozh/1.0"}


def seychas():
    return datetime.now(timezone.utc).astimezone()


def proverit(url, zhdem_kod, zhdem_tekst):
    """Возвращает (ok, chto). chto — короткая причина, годная для сообщения."""
    t0 = time.time()
    try:
        r = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(r, timeout=TAYMAUT, context=CTX) as o:
            kod = o.status
            # Читаем страницу ЦЕЛИКОМ, а не первые килобайты: проверка 24.09 показала,
            # что ссылка на кассу лежит на 22-й тысяче байт, и сторож объявлял живую
            # страницу упавшей. Потолок — чтобы не втянуть случайно огромный файл.
            telo = o.read(600000).decode("utf8", "replace")
    except urllib.error.HTTPError as e:
        telo = ""
        try:
            telo = e.read(1000).decode("utf8", "replace")
        except Exception:
            pass
        return False, "%s%s" % (e.code, prichina(telo))
    except Exception as e:
        return False, "нет связи (%s)" % type(e).__name__
    ms = int((time.time() - t0) * 1000)
    if kod != zhdem_kod:
        return False, "%s%s" % (kod, prichina(telo))
    if zhdem_tekst and zhdem_tekst.lower() not in telo.lower():
        # Код 200, а содержимое не то — страница-заглушка или подменённый ответ.
        return False, "200, но нет «%s»" % zhdem_tekst[:24]
    return True, "%s за %d мс" % (kod, ms)


def prichina(telo):
    """Вытащить причину из тела. 23.09 она была написана прямым текстом
    в JSON — и именно её не хватало в первом сообщении о падении."""
    t = (telo or "").strip()
    if not t:
        return ""
    try:
        d = json.loads(t)
        for k in ("error", "message", "code"):
            if d.get(k):
                return " · %s" % str(d[k])[:60]
    except Exception:
        pass
    return " · %s" % t.replace("\n", " ")[:60]


def poslat(text, tiho=False):
    tok = os.environ.get("TG_BOT_TOKEN", "")
    chat = os.environ.get("DOGON_GRUPPA", "")
    if tiho or not tok or not chat:
        print("  [не отправлено] " + text.replace("\n", " | "))
        return False
    data = urllib.parse.urlencode({
        "chat_id": chat, "text": text, "disable_web_page_preview": "true",
    }).encode()
    try:
        req = urllib.request.Request(
            "https://api.telegram.org/bot%s/sendMessage" % tok, data=data)
        with urllib.request.urlopen(req, timeout=20, context=CTX) as o:
            return json.load(o).get("ok", False)
    except Exception as e:
        print("  телеграм не принял:", e)
        return False


def chitat():
    try:
        return json.load(open(SOSTOYANIE, encoding="utf-8"))
    except Exception:
        return {}


def pisat(s):
    tmp = SOSTOYANIE + ".tmp"
    json.dump(s, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, SOSTOYANIE)


ISHODNIK = os.path.expanduser(
    "~/Library/CloudStorage/GoogleDrive-andywar777@gmail.com/My Drive/Андрей/Private/"
    "Investment/DNA for Businesses/Our Business (Andrii & Masha)/Pivot/golos/storozh/storozh.py")


def sverit_s_ishodnikom():
    """Рабочая копия живёт вне Drive, исходник — в проекте. Когда-нибудь кто-то поправит
    исходник и решит, что починил сторожа. Под launchd проект недоступен и мы молчим;
    при ручном запуске — видно сразу, а руками его запускают как раз когда чинят."""
    import hashlib
    try:
        a = hashlib.md5(open(__file__, "rb").read()).hexdigest()
        b = hashlib.md5(open(ISHODNIK, "rb").read()).hexdigest()
    except Exception:
        return  # под launchd проект не читается — это нормально, не шумим
    if a != b and os.path.realpath(__file__) != os.path.realpath(ISHODNIK):
        print("  ВНИМАНИЕ: рабочая копия и исходник РАЗОШЛИСЬ.")
        print("  Работает: %s" % __file__)
        print("  Исходник: %s" % ISHODNIK)
        print("  Обновить: cp \"%s\" \"%s\"" % (ISHODNIK, __file__))


# КРЕДИТЫ NETLIFY ЗДЕСЬ НЕ ЧИТАЕМ — И ЭТО РЕШЕНИЕ, А НЕ ПРОПУСК.
# 24.09 я добавил чтение `capabilities.credits` и в тот же день выбросил: поле МЁРТВОЕ.
# Доказательство в самом аккаунте: период идёт с 2026-09-01, `grace_topup_granted_at`
# = 2026-09-17 (Netlify выдавал аварийное пополнение), 23-го кредиты кончились снова
# и положили весь бизнес — а `used` при этом показывает 0. Живой счётчик после двух
# исчерпаний за период нулём не бывает.
# Оставить его значило бы дать ЛОЖНОЕ СПОКОЙСТВИЕ: предупреждение не сработало бы
# никогда, а повод смотреть панель мы бы сняли. Это хуже, чем не иметь его вовсе.
# Предупреждение ЗАРАНЕЕ дают две штатные настройки Netlify, обе за Андреем:
#   auto_topup_enabled (сейчас false) и credit_alert_percentage (сейчас null).
# Сторож ловит сам обвал: `usage_exceeded` приходит в теле 503 и попадает в сообщение.
# Это честный сигнал по факту, и не надо выдавать его за предупреждение.


def main():
    proba = "--proba" in sys.argv
    sverit_s_ishodnikom()
    tiho = "--tiho" in sys.argv
    celi = list(CELI)
    if proba:
        # Заведомо мёртвый адрес на том же домене: проверяем сам механизм тревоги.
        celi.append(("ПРОБА", DOM + "/takogo-adresa-net-storozh-proba", 200, ""))

    s = chitat()
    promahi = s.get("promahi", {})
    lezhit = bool(s.get("lezhit"))
    bedy, zhivy = [], []

    for imya, url, kod, tekst in celi:
        ok, chto = proverit(url, kod, tekst)
        print("  %-10s %-6s %s" % (imya, "ок" if ok else "БЕДА", chto))
        if ok:
            promahi[imya] = 0
            zhivy.append(imya)
        else:
            promahi[imya] = promahi.get(imya, 0) + 1
            if promahi[imya] >= PROMAHOV_DO_TREVOGI:
                bedy.append("%s — %s" % (imya, chto))

    t = seychas().strftime("%d.%m %H:%M")
    if bedy and not lezhit:
        poslat("🔴 САЙТ НЕ ОТВЕЧАЕТ · %s\n\n%s\n\nПроверено дважды подряд, это не сеть."
               % (t, "\n".join(bedy)), tiho)
        lezhit = True
    elif not bedy and lezhit:
        poslat("🟢 Сайт снова отвечает · %s\n\nПроверено: %s."
               % (t, ", ".join(zhivy)), tiho)
        lezhit = False

    # Признак жизни раз в сутки — иначе молчащий сторож неотличим от мёртвого.
    den = seychas().strftime("%Y-%m-%d")
    if not bedy and s.get("den_privet") != den:
        poslat("Сторож жив · %s\nОтвечают: %s." % (t, ", ".join(zhivy)), tiho)
        s["den_privet"] = den

    s.update({"promahi": promahi, "lezhit": lezhit,
              "posledniy": seychas().isoformat(timespec="seconds")})
    pisat(s)
    print("  итог: %s" % ("ЛЕЖИТ" if bedy else "всё отвечает"))
    return 1 if bedy else 0


if __name__ == "__main__":
    sys.exit(main())
