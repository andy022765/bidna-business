#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проба права ЗАПИСИ в «Вера-демо»: создать → прочитать → удалить.

    python3 Pivot/golos/kalendar/proba_zapisi.py

Зачем отдельной пробой. Чтение доказывает только чтение. «Внесение изменений в мероприятия»
для ВНЕШНЕГО адреса в закрытом Workspace могло не пройти — это был камень номер один
в разборе стороны клиента. Пока событие не создано и не удалено нашими руками, право записи
не проверено, чем бы ни отвечал calendars.get.

Событие ставится на год вперёд и удаляется тут же. Если проба упадёт между созданием
и удалением — в календаре останется запись с заголовком «ПРОБА ЗАПИСИ, удалить»,
и её видно глазами.
"""
import datetime as dt
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import gkal

ZAGOLOVOK = "ПРОБА ЗАПИСИ, удалить"


def main():
    nachalo = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=365)
    konec = nachalo + dt.timedelta(minutes=30)
    telo = {
        "summary": ZAGOLOVOK,
        "description": "Проверка права записи служебного аккаунта. Удаляется сразу.",
        "start": {"dateTime": nachalo.strftime("%Y-%m-%dT%H:%M:%S") + "Z"},
        "end": {"dateTime": konec.strftime("%Y-%m-%dT%H:%M:%S") + "Z"},
    }

    k, d = gkal.api(gkal.kal("/events"), telo, "POST")
    print("  1. создать:   %s %s" % (k, d.get("id") if k < 300 else d))
    if k >= 300:
        print("\n  ПРАВА ЗАПИСИ НЕТ. Нужно право «Внесение изменений в мероприятия», "
              "а не «Просмотр всех сведений».")
        return 1
    eid = d["id"]

    k2, d2 = gkal.api(gkal.kal("/events/" + eid))
    print("  2. прочитать: %s %s" % (k2, d2.get("summary") if k2 < 300 else d2))

    k3, d3 = gkal.api(gkal.kal("/events/" + eid), None, "DELETE")
    print("  3. удалить:   %s %s" % (k3, "" if k3 in (200, 204) else d3))

    k4, d4 = gkal.api(gkal.kal("/events/" + eid))
    ushlo = (k4 == 404) or (isinstance(d4, dict) and d4.get("status") == "cancelled")
    print("  4. проверить, что ушло: %s %s" % (k4, "пусто" if ushlo else d4))

    ok = k2 < 300 and k3 in (200, 204) and ushlo
    print("\n  %s" % ("ПРАВО ЗАПИСИ ЕСТЬ: событие создано, прочитано и удалено." if ok
                      else "ЧТО-ТО НЕ СОШЛОСЬ — смотреть выше построчно."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
