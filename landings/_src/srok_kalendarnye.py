# -*- coding: utf-8 -*-
"""Срок ядра: «10 рабочих дней» -> «10 календарных дней» (07.09.2026, решение Андрея).

Трогаем ТОЛЬКО десятку. «3 рабочих дня» (кейс Юли) и «три рабочих дня» (диагностика)
остаются рабочими — это другой срок и другая работа.

Часы по-прежнему идут от полного интейка, а не от подписания (docs/pricing.md:99).
"""
import glob, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
FILES = (sorted(glob.glob(str(ROOT / 'landings/*.html')))
         + sorted(glob.glob(str(ROOT / 'presentations/*.html')))
         + sorted(glob.glob(str(ROOT / 'docs/*.md')))
         + [str(ROOT / 'CLAUDE.md')])

PAIRS = [
    # русский
    ('За 10 рабочих дней', 'До 10 календарных дней'),
    ('за 10 рабочих дней', 'до 10 календарных дней'),
    ('до 10 рабочих дней', 'до 10 календарных дней'),
    ('До 10 рабочих дней', 'До 10 календарных дней'),
    ('10 рабочих дней', '10 календарных дней'),
    # английский
    ('In 10 business days —', 'In up to 10 calendar days —'),
    ('in 10 business days', 'in up to 10 calendar days'),
    ('In 10 business days', 'In up to 10 calendar days'),
    ('10 business days for implementation', '10 calendar days for implementation'),
    ('10 business days. Plus 30 days', '10 calendar days. Plus 30 days'),
    ('10 business days', '10 calendar days'),
]

total = 0
for f in FILES:
    p = pathlib.Path(f)
    s = p.read_text(encoding='utf-8')
    o = s
    for a, b in PAIRS:
        s = s.replace(a, b)
    if s != o:
        p.write_text(s, encoding='utf-8')
        n = o.count('рабочих дней') - s.count('рабочих дней') + o.count('business days') - s.count('business days')
        total += n
        print('%-46s мест: %d' % (p.relative_to(ROOT), n))

print('')
print('всего заменено: %d' % total)
print('осталось «10 рабочих дней» / «10 business days»:')
left = 0
for f in FILES:
    txt = pathlib.Path(f).read_text(encoding='utf-8')
    for pat in ('10 рабочих дней', '10 business days'):
        if pat in txt:
            left += txt.count(pat)
            print('  %s: %d x %s' % (pathlib.Path(f).relative_to(ROOT), txt.count(pat), pat))
if not left:
    print('  нет')
print('')
print('«3 рабочих дня» / «three business days» (должны остаться нетронутыми):')
for f in FILES:
    txt = pathlib.Path(f).read_text(encoding='utf-8')
    for m in re.finditer(r'[Тт]ри рабочих дн[а-я]*|3 рабочих дн[а-я]*|[Tt]hree business days|3 business days', txt):
        print('  %s: %s' % (pathlib.Path(f).relative_to(ROOT), m.group(0)))
