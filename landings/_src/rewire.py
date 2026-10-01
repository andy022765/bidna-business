# -*- coding: utf-8 -*-
"""Перевод CTA лендингов с анкеты на страницу оплаты + правка текстов под новый порядок.
ВАЖНО (грабли, на которые уже наступили): смещения regex-совпадения нельзя брать до replace —
после любой замены они уже не там. Поэтому сначала ВСЕ замены текста, и только потом один раз
пересобираем EN-MAP. Иначе кусок файла затирается чужим содержимым."""
import os, re, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (RU было, RU стало, EN стало)
COMMON = [
 ("Записаться на диагностику (первым 10 бесплатно) →",
  "Перейти к диагностике (первым 10 бесплатно) →", "Go to the diagnostic (first 10 free) →"),
 ("Записаться на диагностику →", "Оплатить диагностику →", "Pay for the diagnostic →"),
 ("Поговорить с Андреем и Машей →", "Разобрать мой случай на диагностике →", "Have my case diagnosed →"),
 ("Хочу так же — записаться →", "Хочу так же — к диагностике →", "I want the same — go to the diagnostic →"),
]
TIER = {
 "biznes": ("45–60 мин 1-на-1: карта, черновик ДНК бизнеса и клиента, 3 AI-точки, первый шаг. Документ на руки. Зачтётся во внедрение.",
   "Разбираем ваш рынок и ваши ответы 3 рабочих дня: ДНК бизнеса и клиента, карта разрывов, 3 AI-точки, первый шаг. PDF на руки, дальше стратсессия 45–60 мин. Зачтётся во внедрение.",
   "Three business days on your market and your answers: business and customer DNA, a gap map, 3 AI leverage points, a first step. A PDF in your hands, then a 45–60 min strategy session. Credited toward implementation."),
 "ekspert": ("45–60 мин 1-на-1: карта, черновик ДНК практики и клиента, 3 AI-точки, первый шаг. Документ на руки. Зачтётся во внедрение.",
   "Разбираем ваше поле и ваши ответы 3 рабочих дня: ДНК практики и клиента, карта разрывов, 3 AI-точки, первый шаг. PDF на руки, дальше стратсессия 45–60 мин. Зачтётся во внедрение.",
   "Three business days on your field and your answers: practice and customer DNA, a gap map, 3 AI leverage points, a first step. A PDF in your hands, then a 45–60 min strategy session. Credited toward implementation."),
}

for seg in ("biznes", "ekspert"):
    p = os.path.join(HERE, f"{seg}.html")
    s = open(p, encoding="utf-8").read()
    before = len(s)

    n_links = s.count(f'href="intake-{seg}.html"')
    s = s.replace(f'href="intake-{seg}.html"', f'href="oplata-{seg}.html"')

    pairs = COMMON + [TIER[seg]]
    changed = []
    for old, new, en in pairs:
        assert old in s, f"{seg}: не найдено «{old[:40]}…»"
        s = s.replace(old, new)
        changed.append((old, new, en))

    # ── и только теперь трогаем MAP, на уже изменённом тексте ──
    m = re.search(r'var MAP=(\{.*?\});', s, re.S)
    assert m, f"{seg}: MAP не найден"
    MAP = json.loads(m.group(1))
    for old, new, en in changed:
        MAP.pop(old, None)
        MAP[new] = en
    s = s[:m.start(1)] + json.dumps(MAP, ensure_ascii=False) + s[m.end(1):]

    open(p, "w", encoding="utf-8").write(s)
    print(f"  ✓ {seg}.html — ссылок на оплату: {n_links}, строк в MAP: {len(MAP)}, {before}→{len(s)}")

    # ── квиз ──
    q = os.path.join(HERE, f"quiz-{seg}.html")
    s = open(q, encoding="utf-8").read()
    s = s.replace(f'var INTAKE = "intake-{seg}.html";', f'var PAY = "oplata-{seg}.html";')
    s = s.replace("'+INTAKE+'", "'+PAY+'")
    s = s.replace('Записаться на диагностику →', 'Перейти к диагностике →')
    s = re.sub(r'^var CAL = "[^"]*";\n', '', s, flags=re.M)      # объявлена, нигде не использовалась
    open(q, "w", encoding="utf-8").write(s)
    print(f"  ✓ quiz-{seg}.html")
