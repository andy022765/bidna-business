# -*- coding: utf-8 -*-
"""Статическая английская версия лендинга (07.09.2026).

До этого английский жил только в браузере: var MAP={224 пары} подменял текст по клику.
Отдельного адреса не было, hreflang не было, и для поисковика с нейросетью английского
текста на домене не существовало вовсе — при том, что продаём мы в США.

Здесь те же 224 пары прогоняются по HTML на сборке. Повторяем логику toEN() из страницы:
текстовые узлы (кроме script/style), placeholder, title, meta description. Плюс закрываем
две дыры, которые toEN() пропускал и из-за которых в EN-режиме оставался русский:
атрибуты value и alt.

Готовая страница кладётся как <раздел>/en.html → адрес /business/en и /expert/en.
Имя выбрано намеренно плоским: относительные ссылки (list.html, oplata.html, img/…)
продолжают разрешаться в том же каталоге, переписывать их не нужно.
"""
import html as H
import json
import re

DOMAIN = 'https://businessinteldna.com'

# Строки, у которых пары в MAP нет или она устарела. Ключ — русский текст ДОСЛОВНО.
EXTRA = {
    'то, что делаем мы одни': 'what only we do',
    'то, что умею я один': 'what only I can do',
    'Андрей и Маша': 'Andrii and Masha',
    'Андрей': 'Andrii',
    'Маша': 'Masha',
}

SEG_EN = {
    'business': dict(
        title='The obvious choice — Business Intelligence DNA',
        desc='A free work list: three lines about your business and you see what AI employees '
             'take over in sales, marketing and visibility, what we write for you, and what '
             'stays with you. No sign-up.',
        note='The work list itself is generated in Russian for now. Prefer English? '
             'Write to us on Telegram and we will do it with you.',
        org='Positioning and AI-employee deployment for Russian-speaking business owners '
            'in the US — on site and remotely across the country. We work in Russian and '
            'English, under NDA.'),
    'expert': dict(
        title='The one they choose — Business Intelligence DNA',
        desc='A free work list: three lines about your practice and you see what will run '
             'without you, what we write for you, and what stays yours alone. No sign-up.',
        note='The work list itself is generated in Russian for now. Prefer English? '
             'Write to us on Telegram and we will do it with you.',
        org='Positioning and AI-employee deployment for Russian-speaking experts and '
            'practitioners in the US — on site and remotely across the country. We work in '
            'Russian and English, under NDA.'),
}

SKIP = re.compile(r'(<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<!--.*?-->)', re.S | re.I)
NODE = re.compile(r'>([^<>]+)<')


def _norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def _translate_text(chunk, table, misses):
    """Текстовые узлы: то, что лежит между '>' и '<'. Это ровно то, по чему ходит walk()."""
    def one(m):
        raw = m.group(1)
        t = H.unescape(raw).strip()
        if not t or not re.search(r'[А-Яа-яЁё]', t):
            return m.group(0)
        k = _norm(H.unescape(raw))
        if k in table:
            head = raw[:len(raw) - len(raw.lstrip())]
            tail = raw[len(raw.rstrip()):]
            return '>' + head + H.escape(table[k], quote=False) + tail + '<'
        misses.add(k[:120])
        return m.group(0)
    return NODE.sub(one, chunk)


def _translate_attr(chunk, attr, table, misses):
    pat = re.compile(r'(\b%s=")([^"]*)(")' % attr)

    def one(m):
        v = m.group(2)
        if not re.search(r'[А-Яа-яЁё]', v):
            return m.group(0)
        k = _norm(H.unescape(v))
        if k in table:
            return m.group(1) + H.escape(table[k], quote=True) + m.group(3)
        misses.add('@%s %s' % (attr, k[:110]))
        return m.group(0)
    return pat.sub(one, chunk)


def build_en(src_html, seg):
    """src_html — русский лендинг. Возвращает (english_html, список непереведённого)."""
    cfg = SEG_EN[seg]
    ru_url = '%s/%s/' % (DOMAIN, seg)
    en_url = '%s/%s/en' % (DOMAIN, seg)

    m = re.search(r'var MAP=(\{.*?\});', src_html, re.S)
    if not m:
        raise RuntimeError('var MAP не найден в %s' % seg)
    table = dict(json.loads(m.group(1)))
    table.update(EXTRA)

    misses = set()

    # Скрипты, стили и комментарии не трогаем: там русские ключи, они должны остаться русскими.
    parts = SKIP.split(src_html)
    for i in range(0, len(parts), 2):
        c = parts[i]
        c = _translate_text(c, table, misses)
        for a in ('placeholder', 'alt', 'value', 'aria-label'):
            c = _translate_attr(c, a, table, misses)
        parts[i] = c
    s = ''.join(parts)

    # ── голова страницы
    s = s.replace('<html lang="ru">', '<html lang="en">', 1)
    s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % H.escape(cfg['title']), s, count=1, flags=re.S)
    s = re.sub(r'<meta name="description" content="[^"]*">',
               '<meta name="description" content="%s">' % H.escape(cfg['desc'], quote=True), s, count=1)
    s = s.replace('<meta property="og:locale" content="ru_RU">',
                  '<meta property="og:locale" content="en_US">', 1)
    s = re.sub(r'<meta property="og:url" content="[^"]*">',
               '<meta property="og:url" content="%s">' % en_url, s, count=1)
    s = re.sub(r'<meta property="og:title" content="[^"]*">',
               '<meta property="og:title" content="%s">' % H.escape(cfg['title'], quote=True), s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*">',
               '<meta property="og:description" content="%s">' % H.escape(cfg['desc'], quote=True), s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*">',
               '<link rel="canonical" href="%s">' % en_url, s, count=1)

    # ── JSON-LD: язык и описание организации по-английски
    def ld(mm):
        try:
            d = json.loads(mm.group(1))
        except Exception:
            return mm.group(0)
        for node in d.get('@graph', []):
            if node.get('@type') == 'Organization':
                node['description'] = cfg['org']
            if node.get('@type') == 'WebPage':
                node['inLanguage'] = 'en'
                node['url'] = en_url
                node['@id'] = en_url + '#page'
                node['name'] = cfg['title']
                node['description'] = cfg['desc']
        return '<script type="application/ld+json">%s</script>' % json.dumps(d, ensure_ascii=False)
    s = re.sub(r'<script type="application/ld\+json">(.*?)</script>', ld, s, count=1, flags=re.S)

    # ── переключатель языка: на английской странице это ссылка назад, а не кнопка-подменялка.
    # Меняем id, чтобы скрипт страницы его не нашёл и не перезаписал текст.
    s = re.sub(r'<button id="langtoggle"([^>]*)>.*?</button>',
               lambda mm: '<a id="langlink" href="%s"%s>РУ</a>' % (ru_url, mm.group(1)),
               s, count=1, flags=re.S)

    s = _hreflang(s, ru_url, en_url)

    # ── честная сноска: список работ пока собирается по-русски
    note = ('<p class="micro" style="opacity:.8">%s <a href="https://t.me/business_int_dna" '
            'target="_blank" rel="noopener">Telegram</a>.</p>' % H.escape(cfg['note'], quote=False))
    mm = re.search(r'<p class="micro">.*?</p>', s, re.S)
    if mm:
        s = s[:mm.end()] + '\n    ' + note + s[mm.end():]

    return s, sorted(misses)


def _hreflang(s, ru_url, en_url):
    tags = ('<link rel="alternate" hreflang="ru" href="%s">\n'
            '<link rel="alternate" hreflang="en" href="%s">\n'
            '<link rel="alternate" hreflang="x-default" href="%s">\n') % (ru_url, en_url, ru_url)
    if 'hreflang' in s:
        return s
    return s.replace('</head>', tags + '</head>', 1)


def add_hreflang_ru(s, seg):
    """Ту же пару hreflang надо поставить и на русскую страницу, иначе Google не поймёт,
    что это две языковые версии одной страницы, а не дубль."""
    return _hreflang(s, '%s/%s/' % (DOMAIN, seg), '%s/%s/en' % (DOMAIN, seg))


def link_to_en(s):
    """Кнопку «EN» на русской странице превращаем в обычную ссылку на статическую
    английскую версию.

    Зачем. Кнопка подменяла текст прямо в DOM, а адрес оставался русским: поделиться
    английской страницей было нельзя, и на /<раздел>/en не вело ни одной ссылки — то есть
    поисковики и ассистенты добирались до неё только через sitemap, медленно.

    Делается на сборке, а не в исходнике: локально открытый landings/*.html должен
    по-прежнему переключаться на месте, там статической копии рядом нет.
    """
    m = re.search(r'<button id="langtoggle"([^>]*)>(.*?)</button>', s, re.S)
    if not m:
        return s
    attrs = m.group(1).replace('aria-label="Language"', 'aria-label="English version" hreflang="en"')
    s = s[:m.start()] + '<a id="langtoggle-link" href="en"%s>EN</a>' % attrs + s[m.end():]

    # Кнопки-переключателя на странице больше нет, значит вернуться из подменённого
    # состояния нечем. У того, кто раньше жал EN, в localStorage лежит 'en', и страница
    # молча перевела бы себя на месте. Прибиваем русскую страницу к русскому.
    return s.replace("var lang=localStorage.getItem('le_lang')||'ru';", "var lang='ru';", 1)
