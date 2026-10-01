# -*- coding: utf-8 -*-
"""Кнопка «поговорить с Верой» в блоке «Пятеро цифровых сотрудников» (14.09.2026).

Решение Андрея: демо Дежурного открывается В НОВОМ ОКНЕ, не в рамке — в iframe Safari
не даёт микрофон, а сайт демо закрыт от рамок заголовком X-Frame-Options.
Разницу между нами и готовым сервисом клиент видит, только когда сам поговорил с Верой
(разбор рынка, Pivot/golos/CENY-RYNOK.md) — поэтому кнопка стоит до цен.
Скрипт идемпотентный: метка DEMO VERA. Пары для EN — в var MAP, сверка внизу.
"""
import json
import pathlib
import re

L = pathlib.Path(__file__).resolve().parent.parent
DEMO = 'https://dezhurny-r4p8w2.netlify.app/demo/'

TEXT = 'Дежурного можно проверить прямо сейчас. Это голос: разрешите микрофон и спросите его про нас — что делаем, сколько, — или скажите «дорого». Вашим клиентам он будет отвечать про ваше дело и вашими словами.'
BTN = 'Поговорить с Дежурным — 3 минуты'
NOTE = 'Откроется в новом окне. Звонок бесплатный, ничего устанавливать не нужно.'
PAIRS = [
    (TEXT, 'You can test THE RESPONDER right now. It is a voice: allow the microphone and ask it about us — what we do, what it costs — or say “too expensive”. For your customers it will talk about your business, in your words.'),
    (BTN, 'Talk to THE RESPONDER — 3 minutes'),
    (NOTE, 'Opens in a new window. The call is free, nothing to install.'),
]

HTML = '''    <!-- DEMO VERA -->
    <div style="margin-top:26px;padding:22px 22px 18px;border:1px solid var(--line, rgba(0,0,0,.12));border-radius:14px">
      <p class="lead" style="margin:0 0 16px">%s</p>
      <a class="btn btn-gold" href="%s" target="_blank" rel="noopener" data-ev="demo_vera">%s</a>
      <p style="margin:12px 0 0;font-size:14px;opacity:.75">%s</p>
    </div>
''' % (TEXT, DEMO, BTN, NOTE)


def apply(name):
    p = L / name
    s = p.read_text(encoding='utf-8')
    if 'DEMO VERA' in s:
        print('%-13s кнопка уже стоит' % name)
        return
    i = s.index('id="crew"')
    j = s.index('<div class="tl">', i)
    k = s.index('\n    </div>\n', j) + len('\n    </div>\n')
    s = s[:k] + HTML + s[k:]
    m = re.search(r'var MAP=\{', s)
    have = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    add = ''.join('%s: %s, ' % (json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False))
                  for a, b in PAIRS if a not in have)
    s = s[:m.end()] + add + s[m.end():]
    p.write_text(s, encoding='utf-8')
    d = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    lost = [a for a, _ in PAIRS if a not in d]
    print('%-13s кнопка вставлена | без пары: %s' % (name, lost or 'нет'))
    if lost:
        raise RuntimeError(lost)


if __name__ == '__main__':
    for n in ('biznes.html', 'ekspert.html'):
        apply(n)
