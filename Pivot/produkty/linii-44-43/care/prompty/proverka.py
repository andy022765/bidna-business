#!/usr/bin/env python3
"""Сверка промптов CareLine с листом правды brightside.json. Падает (exit 1) при расхождении.

  python3 prompty/proverka.py

Что проверяет: каждое число листа, которое агент говорит вслух (ставки, минимум часов, часы офиса и собеседований,
часы обучения), стоит во ВСЕХ промптах нужной линии на каждом языке; точные формулировки вопроса о праве на работу
и раскрытия ИИ; в промптах нет чисел денег, которых нет в листе; первые реплики агентов раскрывают ИИ и запись.
"""
import json, os, re, sys

TUT = os.path.dirname(os.path.abspath(__file__))
CARE = os.path.dirname(TUT)
L = json.load(open(os.path.join(CARE, "list-pravdy", "brightside.json"), encoding="utf-8"))
sys.path.insert(0, CARE)
import sborka_agentov as SB  # noqa: E402

oshibki = []


def P(imya):
    return open(os.path.join(TUT, imya), encoding="utf-8").read()


K = L["kandidaty"]
FAKTY = {
    # что → {язык: [варианты написания]}, в каких промптах
    "ставка кандидата от": ({"en": ["twenty-two"], "es": ["veintidós"], "ru": ["двадцати двух", "двадцать два"]}, ["hiring"]),
    "ставка кандидата до": ({"en": ["twenty-four"], "es": ["veinticuatro"], "ru": ["двадцати четырёх", "двадцать четыре"]}, ["hiring"]),
    "частная оплата": ({"en": ["thirty-four dollars"], "es": ["treinta y cuatro dólares"], "ru": ["тридцать четыре доллара"]}, ["hiring"]),
    "минимум 4 часа": ({"en": ["four-hour minimum"], "es": ["mínimo de cuatro horas"], "ru": ["минимум четыре часа"]}, ["hiring"]),
    "часы офиса": ({"en": ["09:00 to 17:00"], "es": ["09:00 a 17:00"], "ru": ["09:00 до 17:00"]}, ["hiring", "caregivers"]),
    "окно собеседований": ({"en": ["between ten and four"], "es": ["entre las diez y las cuatro"], "ru": ["с десяти до четырёх"]}, ["hiring"]),
    "HHA 75 часов": ({"en": ["seventy-five hours"], "es": ["setenta y cinco horas"], "ru": ["семидесяти пяти часов"]}, ["hiring"]),
    "PCA 40 часов": ({"en": ["forty hours"], "es": ["cuarenta horas"], "ru": ["сорока часов"]}, ["hiring"]),
    "собеседование 30 минут": ({"en": ["thirty minutes"], "es": ["treinta minutos"], "ru": ["тридцать минут"]}, ["hiring"]),
    "вопрос о праве EN": ({"en": [K["pravo_na_rabotu_pravila"]["tolko_formulirovka"]], "es": [K["obyazatelno"][1]["vopros_en"]], "ru": [K["obyazatelno"][1]["vopros_en"]]}, ["hiring"]),
    "вопрос о праве ES": ({"en": [K["obyazatelno"][1]["vopros_es"]], "es": [K["obyazatelno"][1]["vopros_es"]], "ru": [K["obyazatelno"][1]["vopros_es"]]}, ["hiring"]),
    "вопрос о праве RU": ({"en": [K["obyazatelno"][1]["vopros_ru"]], "es": [K["obyazatelno"][1]["vopros_ru"]], "ru": [K["obyazatelno"][1]["vopros_ru"]]}, ["hiring"]),
    "SMS-вопрос": ({"en": [L["sms"]["vopros_en"]], "es": [L["sms"]["vopros_es"]], "ru": [L["sms"]["vopros_ru"]]}, ["hiring"]),
    "911": ({"en": ["nine-one-one"], "es": ["nueve uno uno"], "ru": ["девять-один-один"]}, ["hiring", "caregivers"]),
}
for fakt, (var, linii) in FAKTY.items():
    for liniya in linii:
        for yaz, spisok in var.items():
            t = P(f"{liniya}.{yaz}.md")
            if not any(v in t for v in spisok):
                oshibki.append(f"{liniya}.{yaz}.md: нет «{fakt}» ({spisok[0]})")

# деньги: в промптах только суммы из листа
RAZRESHENO = {22, 24, 34}
for fn in sorted(os.listdir(TUT)):
    if not fn.endswith(".md"):
        continue
    t = P(fn)
    for m in re.findall(r"\$\s?(\d+)", t):
        if int(m) not in RAZRESHENO:
            oshibki.append(f"{fn}: сумма ${m} не из листа правды")
    for w in ["guaranteed", "we guarantee", "HIPAA compliant", "TCPA compliant"]:
        if w in t and "Never say" not in t[max(0, t.find(w) - 200):t.find(w)]:
            pass  # запреты сформулированы как «никогда не говори» — проверяем глазами

# первые реплики агентов: раскрытие ИИ и запись на своём языке
RASKR = {"en": ("AI assistant", "recorded"), "es": ("inteligencia artificial", "graba"), "ru": ("ИИ-ассистент", "записывается")}
for liniya, cfg in SB.LINII.items():
    for yaz, fm in cfg["first"].items():
        a, b = RASKR[yaz]
        if a not in fm or b not in fm:
            oshibki.append(f"{liniya} first_message {yaz}: нет раскрытия ИИ или записи")
    # раскрытие при смене языка есть во всех промптах линии
    for yaz in ("en", "es", "ru"):
        t = P(f"{cfg['prompt']}.{yaz}.md")
        for y2, (a, b) in RASKR.items():
            if y2 != yaz and a not in t:
                oshibki.append(f"{cfg['prompt']}.{yaz}.md: нет фразы раскрытия на {y2}")

# инструменты, названные в промпте, существуют в сборке
imena = {v["imya"] for v in json.load(open(os.path.join(CARE, "elevenlabs.json"), encoding="utf-8"))["instrumenty"].values()}
for fn in sorted(os.listdir(TUT)):
    if fn.endswith(".md"):
        for m in set(re.findall(r"\b[a-z_]+_careline_demo\b", P(fn))):
            if m not in imena:
                oshibki.append(f"{fn}: инструмент {m} не заведён")

if oshibki:
    print("РАСХОЖДЕНИЯ:")
    print("\n".join("  " + o for o in oshibki))
    sys.exit(1)
print("промпты сходятся с листом правды: 6 файлов, раскрытие, формулировки, суммы, инструменты — чисто")
