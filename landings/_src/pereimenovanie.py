# -*- coding: utf-8 -*-
"""«Лист работ» -> «Список работ» (07.09.2026).
Андрей: «лист» — корявый перевод с английского, надо «список».
Заодно уходит расщепление имени: на экспертской странице продукт назывался
«лист практики», а все кнопки говорили «лист работ». Теперь везде одно имя.

Идиому «с чистого листа» не трогаем — это не наш продукт.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
FILES = ['landings/biznes.html', 'landings/ekspert.html', 'landings/_src/list.py',
         'landings/oplata-biznes.html', 'landings/oplata-ekspert.html',
         'netlify-functions/list.js', 'netlify-functions/submission-created.js']

GUARD = ' ЧИСТЫЙ '

# «практика» уходит из имени продукта — иначе получится «список практики»
PRAKTIKA = [
    ('Лист практики', 'Лист работ'), ('лист практики', 'лист работ'),
    ('Листа практики', 'Листа работ'), ('листа практики', 'листа работ'),
    ('листе практики', 'листе работ'), ('листу практики', 'листу работ'),
    ('листом практики', 'листом работ'),
]

FORMS = [('ами', 'списками'), ('ах', 'списках'), ('ам', 'спискам'), ('ов', 'списков'),
         ('ом', 'списком'), ('ы', 'списки'), ('а', 'списка'), ('у', 'списку'),
         ('е', 'списке'), ('', 'список')]
RE = re.compile(r'\b([Лл])ист(' + '|'.join(e for e, _ in FORMS if e) + r'|)\b')
MAP = dict(FORMS)


def swap(m):
    head, end = m.group(1), m.group(2)
    w = MAP[end]
    return w.capitalize() if head == 'Л' else w


for rel in FILES:
    p = ROOT / rel
    s = p.read_text(encoding='utf-8')
    o = s

    s = s.replace('чистого листа', GUARD)
    for a, b in PRAKTIKA:
        s = s.replace(a, b)
    s = s.replace('ЛИСТ РАБОТ', 'СПИСОК РАБОТ').replace('ЕГО ЛИСТ', 'ЕГО СПИСОК')
    s = RE.sub(swap, s)
    s = s.replace(GUARD, 'чистого листа')

    n = sum(1 for a, b in zip(o.split(), s.split()) if a != b)
    if s != o:
        p.write_text(s, encoding='utf-8')
    print('%-44s слов изменено ~%d' % (rel, n))

print('')
print('остатки «лист» (должна остаться только идиома):')
for rel in FILES:
    txt = (ROOT / rel).read_text(encoding='utf-8')
    for m in re.finditer(r'.{0,22}[Лл]ист[а-я]*.{0,18}', txt):
        print('  %s: %r' % (rel, m.group(0)))
