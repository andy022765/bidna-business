# -*- coding: utf-8 -*-
"""Юрлицо, адрес, почта и ссылки на документы в подвале лендингов (14.09.2026).

Зачем: Twilio отклонил профиль компании (коды 18601/18606) — робот не смог связать
Wealthboosterpro LLC с сайтом: на главной и лендингах юрлица не было, почта на сайте — gmail.
Идемпотентно (метка LEGAL LINE). Пары для EN — в var MAP.
"""
import json, pathlib, re, sys
L = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(L.parent / 'docs' / 'pravo'))
import _rekvizity as R

RU_LINK = ['Условия', 'Конфиденциальность', 'Контакты']
EN_LINK = ['Terms', 'Privacy', 'Contacts']
HREF = ['/terms', '/privacy', '/contacts']
LEGAL = '© 2026 %s · %s' % (R.FULL, R.ADDRESS)


def html(links):
    a = ' · '.join('<a href="%s">%s</a>' % (h, t) for h, t in zip(HREF, links))
    return ('\n  <!-- LEGAL LINE -->\n  <div class="wrap" style="display:block;margin-top:14px;font-size:13px;opacity:.7">'
            '%s · <a href="mailto:%s">%s</a> · %s</div>' % (LEGAL, R.EMAIL, R.EMAIL, a))


def apply(name):
    p = L / name
    s = p.read_text(encoding='utf-8')
    if 'LEGAL LINE' in s:
        print('%-13s подвал уже стоит' % name); return
    i = s.index('<footer>'); j = s.index('</footer>', i)
    s = s[:j] + html(RU_LINK) + '\n' + s[j:]
    m = re.search(r'var MAP=\{', s)
    have = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    pairs = list(zip(RU_LINK, EN_LINK))
    add = ''.join('%s: %s, ' % (json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False)) for a, b in pairs if a not in have)
    s = s[:m.end()] + add + s[m.end():]
    p.write_text(s, encoding='utf-8')
    print('%-13s подвал вставлен' % name)


if __name__ == '__main__':
    for n in ('biznes.html', 'ekspert.html'):
        apply(n)
