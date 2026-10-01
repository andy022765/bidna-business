#!/usr/bin/env python3
"""Таблица прохождения для ITOGI.md из rezultaty.json.
  python3 tablica.py            печатает markdown
  python3 tablica.py --v-itogi  вставляет таблицу в ITOGI.md между метками <!-- TABLICA --> … <!-- /TABLICA -->
Серия сценария = прогоны, запущенные после последней правки промпта, которая его касалась: берём 3 последних прогона."""
import json, os, sys, time

TUT = os.path.dirname(os.path.abspath(__file__))
scen = {s["id"]: s for s in json.load(open(os.path.join(os.path.dirname(TUT), "scenarii", "scenarii.json"), encoding="utf-8"))["scenarii"]}
rez = json.load(open(os.path.join(TUT, "rezultaty.json"), encoding="utf-8"))
sch = json.load(open(os.path.join(TUT, "schetchik.json"), encoding="utf-8"))

po = {}
for r in rez:
    po.setdefault(r["scenariy"], []).append(r)

stroki = ["| Сценарий | Что проверяем | Все прогоны (по порядку) | Последние 3 | 3 из 3 | Оценщик ElevenLabs (посл. 3) | Что не прошло в последних 3 |",
          "|---|---|---|---|---|---|---|"]
vsego_krit = 0
tri_iz_treh = 0
for sid in sorted(s for s in scen if scen[s]["kritichnyy"]):
    vsego_krit += 1
    rr = sorted(po.get(sid, []), key=lambda x: x["created_at"] or 0)
    Z = {True: "✓", False: "✗", None: "?"}
    znaki = "".join(Z[x["proydeno"]] for x in rr) or "—"
    posl = [x for x in rr if x["proydeno"] is not None][-3:]
    ok3 = len(posl) == 3 and all(x["proydeno"] for x in posl)
    tri_iz_treh += ok3
    ocen = "".join({"success": "✓", "failure": "✗"}.get(x["ocenshchik"], "?") for x in posl) or "—"
    prov = "; ".join(sorted({p["kod"] for x in posl if x["proydeno"] is False for p in x["provaly"]})) or ""
    kratko = scen[sid]["chto_proveryaem"].split(":")[0][:70]
    stroki.append(f"| {sid} | {kratko} | {znaki} | {''.join(Z[x['proydeno']] for x in posl) or '—'} | {'да' if ok3 else 'нет'} | {ocen} | {prov} |")

kred = sum(r["kredity"] or 0 for r in rez)
itog = (f"**Критичных сценариев: {vsego_krit}. Прошли 3 из 3 (последние три прогона): {tri_iz_treh} — {tri_iz_treh * 100 // max(vsego_krit, 1)}%.**  \n"
        f"Прогонов потрачено: {sch['vsego']} из 150 (включая 2 пробных). Кредитов ElevenLabs на разобранные прогоны: {kred:,}".replace(",", " ") + f" (≈{kred // max(len(rez), 1)} на прогон).  \n"
        f"Обновлено: {time.strftime('%d.%m.%Y %H:%M')}.")
md = itog + "\n\n" + "\n".join(stroki)

if "--v-itogi" in sys.argv:
    p = os.path.join(TUT, "ITOGI.md")
    s = open(p, encoding="utf-8").read()
    a, b = s.index("<!-- TABLICA -->") + len("<!-- TABLICA -->"), s.index("<!-- /TABLICA -->")
    s = s[:a] + "\n" + md + "\n" + s[b:]
    open(p, "w", encoding="utf-8").write(s)
    print("ITOGI.md обновлён")
else:
    print(md)
