# -*- coding: utf-8 -*-
"""Звонки на русскую линию Веры за период — журнал линии для сверки с отчётом Meta.

Meta считает звонки частично моделью (c-0741), поэтому правда о звонках — журнал линии.
Скрипт только читает ElevenLabs: список разговоров русского агента, длительность,
номер звонящего. Наши собственные номера (проверки, дозвонщик) отделяются.

    python3 targetolog/zvonki_linii.py                       # с начала теста (28.09 10:00 LA)
    python3 targetolog/zvonki_linii.py --s 2026-09-29        # с даты (00:00 LA)
    python3 targetolog/zvonki_linii.py --s 2026-09-29 --po 2026-09-30

Ключ — ELEVENLABS_API_KEY из окружения или из ~/.bidna-golos.env. Ключ не печатается.
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import subprocess
import sys
from zoneinfo import ZoneInfo

AGENT_RU = "agent_1401m2bc9k58f6nrj8v51pw2v2s3"
LA = ZoneInfo("America/Los_Angeles")
START_TESTA = dt.datetime(2026, 9, 28, 10, 0, tzinfo=LA)
# Наши номера: линии Веры, дозвонщик, Андрей, Маша — их звонки в рекламу не считаем.
NASHI = {"+14247811913", "+14247244202", "+14242756121", "+15614516864", "+15614309795"}


def klyuch():
    k = os.environ.get("ELEVENLABS_API_KEY", "")
    if k:
        return k
    env = pathlib.Path.home() / ".bidna-golos.env"
    if env.exists():
        for s in env.read_text(encoding="utf-8").splitlines():
            s = s.strip()
            if s.startswith("export "):
                s = s[7:]
            if s.startswith("ELEVENLABS_API_KEY="):
                return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("  нет ELEVENLABS_API_KEY (ни в окружении, ни в ~/.bidna-golos.env)")


def api(put, k):
    r = subprocess.run(["curl", "-s", "-H", "xi-api-key: " + k, "https://api.elevenlabs.io" + put],
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        raise SystemExit("  ответ ElevenLabs не разобрать: " + r.stdout[:200])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--s", help="дата начала ГГГГ-ММ-ДД (00:00 LA); по умолчанию — старт теста")
    p.add_argument("--po", help="дата конца ГГГГ-ММ-ДД включительно (23:59 LA)")
    p.add_argument("--json", action="store_true", help="вывести итог одной строкой JSON")
    a = p.parse_args()
    s = (dt.datetime.fromisoformat(a.s).replace(tzinfo=LA) if a.s else START_TESTA)
    po = (dt.datetime.fromisoformat(a.po).replace(tzinfo=LA) + dt.timedelta(days=1) if a.po else None)
    k = klyuch()

    razgovory, cursor = [], None
    while True:
        q = "/v1/convai/conversations?agent_id=%s&page_size=100&call_start_after_unix=%d" % (
            AGENT_RU, int(s.timestamp()))
        if po:
            q += "&call_start_before_unix=%d" % int(po.timestamp())
        if cursor:
            q += "&cursor=" + cursor
        d = api(q, k)
        razgovory += d.get("conversations", [])
        if not d.get("has_more"):
            break
        cursor = d.get("next_cursor")

    stroki, itog = [], {"vsego": 0, "20+": 0, "60+": 0, "nashi": 0}
    posledniy = None  # время последнего не нашего звонка (для «линия, похоже, не отвечает»)
    for r in sorted(razgovory, key=lambda x: x.get("start_time_unix_secs", 0)):
        det = api("/v1/convai/conversations/" + r["conversation_id"], k)
        pc = (det.get("metadata") or {}).get("phone_call") or {}
        nomer = pc.get("external_number") or "—"
        dl = int(r.get("call_duration_secs") or 0)
        kogda = dt.datetime.fromtimestamp(r.get("start_time_unix_secs", 0), LA).strftime("%d.%m %H:%M")
        nash = nomer in NASHI
        if nash:
            itog["nashi"] += 1
        else:
            itog["vsego"] += 1
            itog["20+"] += dl >= 20
            itog["60+"] += dl >= 60
            posledniy = kogda
        skr = nomer if nash or nomer == "—" else nomer[:-4] + "····"
        stroki.append("%s  %4d с  %-14s %s%s" % (kogda, dl, skr, r["conversation_id"],
                                                 "  (наш номер)" if nash else ""))
    # Текущее время LA: у запусков по расписанию часов нет, а `date` ждёт разрешения — берут отсюда.
    seychas = dt.datetime.now(LA)
    if a.json:
        itog["posledniy_ne_nash"] = posledniy
        itog["seychas_la"] = seychas.strftime("%Y-%m-%d %H:%M")
        print(json.dumps(itog, ensure_ascii=False))
        return
    print("Русская линия, с %s%s" % (s.strftime("%d.%m %H:%M"),
                                      (" по " + (po - dt.timedelta(days=1)).strftime("%d.%m")) if po else ""))
    for x in stroki:
        print("  " + x)
    print("Итого не наших: %d · от 20 с: %d · от 60 с: %d · наших проверок: %d"
          % (itog["vsego"], itog["20+"], itog["60+"], itog["nashi"]))
    print("Последний не наш звонок: %s" % (posledniy or "—"))
    print("Сейчас (LA): %s" % seychas.strftime("%Y-%m-%d %H:%M, %a"))


if __name__ == "__main__":
    main()
