# -*- coding: utf-8 -*-
"""Все кнопки лендинга ведут на бесплатный лист (07.09.2026, решение Андрея).

Было: пять кнопок вели сразу на oplata, минуя бесплатный вход. Человек попадал
на кассу, не увидев ценности. Теперь единственный вход в воронку — лист,
а оплата живёт на самом листе после того, как человек его получил.

Подписи переписаны, чтобы текст кнопки совпадал с тем, куда она ведёт:
кнопка «Оплатить диагностику», ведущая на бесплатный лист, — обман ожидания.

Порядок жёсткий (грабли rewire.py): сначала ВСЕ замены текста, потом один раз MAP.
"""
import os, re, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (RU было, RU стало, EN стало)
BTN = [
 ("Перейти к диагностике (первым 10 бесплатно) →", "Начать с бесплатного листа →", "Start with the free work sheet →"),
 ("Разобрать мой случай на диагностике →", "Разобрать мой случай — начать с листа →", "Look at my case — start with the sheet →"),
 ("Хочу так же — к диагностике →", "Хочу так же — собрать лист →", "I want the same — build my sheet →"),
 ("Оплатить диагностику →", "Начать с бесплатного листа →", "Start with the free work sheet →"),
 ("Записаться", "Собрать лист", "Build my sheet"),
]

for seg in ("biznes", "ekspert"):
    p = os.path.join(HERE, f"{seg}.html")
    s = open(p, encoding="utf-8").read()
    before = len(s)

    n = s.count(f'href="oplata-{seg}.html"')
    s = s.replace(f'href="oplata-{seg}.html"', f'href="list-{seg}.html"')

    changed = []
    for old, new, en in sorted(BTN, key=lambda t: -len(t[0])):
        if old not in s:
            print(f"  ! {seg}: не найдено «{old[:44]}…»"); continue
        s = s.replace(old, new)
        changed.append((old, new, en))

    m = re.search(r'var MAP=(\{.*?\});', s, re.S)
    assert m, f"{seg}: MAP не найден"
    MAP = json.loads(m.group(1))
    for old, new, en in changed:
        MAP.pop(old, None)
        MAP[new] = en
    s = s[:m.start(1)] + json.dumps(MAP, ensure_ascii=False) + s[m.end(1):]

    open(p, "w", encoding="utf-8").write(s)
    print(f"  ✓ {seg}.html — кнопок переведено на лист: {n}, подписей переписано: {len(changed)}, "
          f"строк в MAP: {len(MAP)}")
