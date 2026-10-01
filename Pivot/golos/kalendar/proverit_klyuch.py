#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка доступа к календарю «Вера-демо». Ставится 25.09.2026.

    python3 Pivot/golos/kalendar/proverit_klyuch.py

Отвечает на четыре вопроса: ключ жив · Calendar API включён · календарь виден · можно ли
в него ПИСАТЬ.

ПОЧЕМУ НЕ ЧЕРЕЗ calendarList — я на этом уже ошибся. Первая версия спрашивала
`users/me/calendarList` и говорила «календарей ноль» при живом доступе: расшаренный
календарь в список служебного аккаунта САМ НЕ ПОПАДАЕТ, его туда надо добавлять
отдельным вызовом. Правильная проверка — спросить календарь ПО ЕГО АДРЕСУ.

Право записи проба здесь НЕ трогает — только сообщает, что показывает accessRole.
Настоящая проба записи, с созданием и удалением события, — `proba_zapisi.py`.
"""
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import gkal


def main():
    import os
    if not os.path.exists(gkal.KLYUCH):
        print("  ключа нет: %s" % gkal.KLYUCH)
        return 2

    try:
        print("  служебный аккаунт: %s" % gkal.pochta())
        gkal.token()
        print("  ключ живой, токен получен")
    except Exception as e:
        print("  токен НЕ получен: %s" % str(e)[:200])
        return 1

    k, d = gkal.api(gkal.kal())
    if k >= 300:
        print("  календарь НЕ виден: %s %s" % (k, d))
        print("  значит им ещё не поделились с этим адресом.")
        return 1
    print("  календарь виден: «%s», пояс %s" % (d.get("summary"), d.get("timeZone")))

    k2, d2 = gkal.api("/users/me/calendarList/" + gkal.KALENDAR.replace("@", "%40"))
    rol = d2.get("accessRole") if k2 < 300 else None
    print("  в списке аккаунта: %s%s" % (k2, " · право " + rol if rol else
          " — это НОРМА: расшаренный календарь в список сам не попадает"))

    k3, _ = gkal.api(gkal.kal("/events?maxResults=1"))
    print("  чтение событий: %s" % k3)
    print("\n  Право ЗАПИСИ этой проверкой НЕ доказано. Запустить: "
          "python3 Pivot/golos/kalendar/proba_zapisi.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
