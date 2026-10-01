# -*- coding: utf-8 -*-
"""Шесть страниц-ответов кластера /zvonki/ — собираются из markdown СОТРУДНИКОВ.

ЗАЧЕМ ГЕНЕРАТОР, А НЕ РУКАМИ. Страницы пишет и правит соседняя полоса, а выкладывает эта.
Правка обязана доезжать одной сборкой. Ровно на этом мы уже спотыкались: правку внесли
в готовый HTML, сборка её стёрла, и утром починка исчезла.

ЧТО ОБЯЗАН ВЫРЕЗАТЬ. В черновиках есть служебные комментарии: «ЧЕРНОВИК», «пишет СОТРУДНИКИ»,
замеры и заметки для меня. Наружу нельзя даже в исходном коде страницы — значит вырезаем
комментарии целиком, а потом ПРОВЕРЯЕМ, что не осталось ни одного, и падаем, если остался.

АДРЕСА ВЗЯТЫ У АВТОРОВ. В хвосте каждого черновика автор предложил адрес (`/zvonki/po-russki/`
и так далее). Свои выдумывать незачем: короткие, читаются вслух, и кластер виден.

ЭТИ СТРАНИЦЫ ИНДЕКСИРУЕМЫЕ. В этом вся их задача: их должны найти нейросети. Значит никакого
noindex, обязательны canonical, title и описание, и они должны быть в sitemap.xml и llms.txt.
Русские, английской пары нет — поэтому hreflang НЕ ставим: он врал бы про несуществующую пару.
"""

import io
import json
import os
import re

# (файл, адрес, заголовок вкладки, описание для выдачи)
STRANICY = [
    ("U01-kto-otvetit-poka-rabotayu.md", "poka-rabotayu",
     "Кто ответит на звонки, пока вы работаете",
     "Два пути для владельца малого бизнеса в США: служба ответа с живыми операторами "
     "или голосовой агент на вашей линии. Чем отличаются, кому что подходит, сколько стоит."),
    ("U02-komu-otdat-priyom-zvonkov.md", "ne-teryat",
     "Кому отдать приём звонков, чтобы перестать их терять",
     "Три места, куда можно отдать приём звонков, и как выбрать по тому, что именно у вас "
     "ломается. Цены, ограничения и где на самом деле теряются клиенты."),
    ("U03-vecher-i-vyhodnye.md", "vecher-i-vyhodnye",
     "Кто примет звонки вечером и в выходные",
     "Три рабочих варианта для звонков в нерабочее время: дежурная служба, голосовой агент, "
     "автоответчик. Что происходит ночью и что вы видите утром."),
    ("U04-skolko-zvonkov-teryayu.md", "skolko-teryayu",
     "Сколько звонков вы пропускаете и сколько теряете на этом денег",
     "Как посчитать деньги, а не звонки, чем их считают и чего такой счёт не покажет. "
     "Честно о том, что считать пропущенные — не наш продукт."),
    ("U05-otvechaet-po-russki.md", "po-russki",
     "Кто ответит на звонки по-русски, пока вы один",
     "Американские службы ответа говорят по-английски. Что делать, если ваши клиенты звонят "
     "по-русски: два пути, цены и ограничения."),
    ("U06-chelovek-ili-robot.md", "chelovek-ili-robot",
     "Нанять человека на телефон или поставить голосового робота",
     "Сравнение трёх вариантов: человек в штате, коробочный робот за $49 и агент под ваш "
     "прайс. Честно о том, когда робот хуже живого человека."),
]

DOMEN = "https://businessinteldna.com"
KORENJ = "/zvonki"

ZAPRESHCHENO = ("ЧЕРНОВИК", "СОТРУДНИКИ", "ГОЛОСУ", "ДЛЯ ГОЛОСА", "zamer-v3", "не проверено")


# ----------------------------------------------------------------- разметка

def ekran(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def stroka(s):
    """Внутристрочное. Порядок важен: сначала экранируем, потом ссылки, потом жирный."""
    s = ekran(s)
    # Ссылки. Все внешние: rel="noopener" обязателен, этого прямо требовал ШТАБ.
    s = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)',
               r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', s)
    return s


def tablica(rows):
    """Первая строка — шапка, вторая — разделитель, остальное — тело.

    Последнему столбцу даём класс `p` (правое поле, моноширинный — так на всех лендингах),
    но ТОЛЬКО если он везде короткий. Иначе это не цена, а обычный текст, и прижимать
    его вправо нельзя."""
    def kletki(r):
        return [c.strip() for c in r.strip().strip("|").split("|")]

    shapka = kletki(rows[0])
    telo = [kletki(r) for r in rows[2:]]
    cena = bool(telo) and all(len(r) == len(shapka) and len(r[-1]) <= 18 for r in telo)

    out = ['<div class="tw"><table>']
    if any(c for c in shapka):
        out.append("<thead><tr>" + "".join(
            '<th%s>%s</th>' % (' class="p"' if (cena and i == len(shapka) - 1) else "", stroka(c))
            for i, c in enumerate(shapka)) + "</tr></thead>")
    out.append("<tbody>")
    for r in telo:
        out.append("<tr>" + "".join(
            '<td%s>%s</td>' % (' class="p"' if (cena and i == len(r) - 1) else "", stroka(c))
            for i, c in enumerate(r)) + "</tr>")
    out.append("</tbody></table></div>")
    return "\n".join(out)


def v_html(md):
    """Markdown → HTML. Покрывает ровно то, что встречается в этих шести файлах:
    h1, h2, абзацы, жирный, курсив, ссылки, маркированные и нумерованные списки,
    таблицы и горизонтальную черту. Ничего сверх — лишнее молча пропускать нельзя."""
    lines = md.split("\n")
    out, i, zagolovok = [], 0, None
    while i < len(lines):
        s = lines[i]
        goly = s.strip()

        if not goly:
            i += 1
            continue

        if goly.startswith("# "):
            zagolovok = goly[2:].strip()
            out.append("<h1>%s</h1>" % stroka(zagolovok))
            i += 1
            continue

        if goly.startswith("## "):
            out.append("<h2>%s</h2>" % stroka(goly[3:].strip()))
            i += 1
            continue

        if re.match(r"^-{3,}$", goly):
            out.append("<hr>")
            i += 1
            continue

        if goly.startswith("|"):
            blok = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                blok.append(lines[i])
                i += 1
            if len(blok) >= 2:
                out.append(tablica(blok))
            continue

        if re.match(r"^[-*] ", goly):
            punkty = []
            while i < len(lines) and re.match(r"^[-*] ", lines[i].strip()):
                punkty.append(re.sub(r"^[-*] ", "", lines[i].strip()))
                i += 1
                # продолжение пункта — строка с отступом
                while i < len(lines) and lines[i].startswith("  ") and lines[i].strip() \
                        and not re.match(r"^[-*] |^\d+\. ", lines[i].strip()):
                    punkty[-1] += " " + lines[i].strip()
                    i += 1
            out.append("<ul>" + "".join("<li>%s</li>" % stroka(p) for p in punkty) + "</ul>")
            continue

        if re.match(r"^\d+\. ", goly):
            punkty = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i].strip()):
                punkty.append(re.sub(r"^\d+\. ", "", lines[i].strip()))
                i += 1
                while i < len(lines) and lines[i].startswith("  ") and lines[i].strip() \
                        and not re.match(r"^[-*] |^\d+\. ", lines[i].strip()):
                    punkty[-1] += " " + lines[i].strip()
                    i += 1
            out.append("<ol>" + "".join("<li>%s</li>" % stroka(p) for p in punkty) + "</ol>")
            continue

        # абзац: слепляем подряд идущие строки
        kusok = []
        while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#{1,6} |\||[-*] |\d+\. |-{3,}$)", lines[i].strip()):
            kusok.append(lines[i].strip())
            i += 1
        tekst = " ".join(kusok)
        # строка целиком курсивом — это подзаголовок под H1
        m = re.match(r"^\*([^*].*)\*$", tekst)
        if m:
            out.append('<p class="lede">%s</p>' % stroka(m.group(1)))
        else:
            out.append("<p>%s</p>" % stroka(tekst))

    return zagolovok, "\n".join(out)


# --------------------------------------------------------------- разметка для машин

def voprosy(md):
    """Пары «вопрос — ответ» из последнего раздела. Нужны для FAQPage.

    Берём ТОЛЬКО то, что видно человеку на странице: FAQPage с невидимым содержимым —
    это нарушение правил разметки, и поймают на нём нас, а не того, кто посоветовал."""
    m = re.search(r"^## Вопросы.*?$(.*)", md, re.S | re.M)
    if not m:
        return []
    pary = []
    for kusok in re.finditer(r"\*\*(.+?)\*\*(.*?)(?=\n\n\*\*|\Z)", m.group(1), re.S):
        vopros = re.sub(r"\s+", " ", kusok.group(1)).strip()
        otvet = re.sub(r"\s+", " ", kusok.group(2)).strip()
        otvet = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", otvet)
        otvet = otvet.replace("**", "")
        if vopros and otvet:
            pary.append((vopros, otvet))
    return pary


def razmetka(zagolovok, opisanie, adres, pary):
    uzly = [
        {"@type": "Organization", "@id": DOMEN + "/#org",
         "name": "Business Intelligence DNA",
         "legalName": "Wealthboosterpro LLC",
         "url": DOMEN, "telephone": "+1-424-781-1913",
         "email": "support@businessinteldna.com"},
        {"@type": "WebPage", "@id": adres + "#page",
         "url": adres, "name": zagolovok, "description": opisanie,
         "inLanguage": "ru", "isPartOf": {"@id": DOMEN + "/#org"}},
    ]
    if pary:
        uzly.append({
            "@type": "FAQPage", "@id": adres + "#faq",
            "mainEntity": [{"@type": "Question", "name": v,
                            "acceptedAnswer": {"@type": "Answer", "text": o}}
                           for v, o in pary]})
    return json.dumps({"@context": "https://schema.org", "@graph": uzly},
                      ensure_ascii=False, indent=1)


# ----------------------------------------------------------------- сборка

DOP_CSS = """
  body{padding-bottom:40px}
  .statya{max-width:760px;margin:0 auto;padding:56px 24px 0}
  .statya h1{margin-bottom:18px}
  .statya h2{font-size:clamp(21px,3vw,28px);margin:44px 0 14px}
  .statya p,.statya li{font-size:17px}
  .statya table{font-size:15.5px}
  .statya th{padding:13px 14px;border-bottom:1px solid var(--rule);text-align:left;
    font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase;
    /* Замер 26.09: --dim здесь светлый (он из тёмного лендинга), а фон страницы
       кремовый — заголовки таблиц выходили 1.48:1, то есть нечитаемы. */
    color:#16203f}
  .statya th.p,.statya td.p{text-align:right;white-space:nowrap;
    font-family:'JetBrains Mono',monospace}
  .statya hr{border:0;border-top:1px solid var(--line);margin:40px 0}
  .statya a{color:var(--gold)}
  .nazad{display:block;max-width:760px;margin:44px auto 0;padding:0 24px;
    font-family:'JetBrains Mono',monospace;font-size:13px}
  .nazad a{color:var(--dim);text-decoration:none;border-bottom:1px solid var(--rule)}
  .nazad a:hover{color:var(--gold);border-bottom-color:var(--gold)}
  .sosedi{max-width:760px;margin:48px auto 0;padding:24px 24px 0;border-top:1px solid var(--line)}
  .sosedi b{display:block;font-family:'JetBrains Mono',monospace;font-size:11px;
    letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:14px}
  .sosedi ul{list-style:none;padding:0;margin:0}
  .sosedi li{margin-bottom:9px;max-width:none}
  .sosedi a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--rule)}
  .sosedi a:hover{color:var(--gold);border-bottom-color:var(--gold)}
"""


def spisok():
    """Адреса и заголовки — без сборки. Нужны, чтобы поставить ссылки на лендинг Веры
    и вписать страницы в карту сайта, не собирая их дважды."""
    return [("%s/%s/" % (KORENJ, slug), title) for _f, slug, title, _o in STRANICY]


def sobrat(stil, out_dir, ishodniki):
    """Пишет шесть страниц. Возвращает список (адрес, заголовок) для карты сайта и ссылок."""
    gotovo = []
    tela = []
    for fayl, slug, title, opisanie in STRANICY:
        put = os.path.join(ishodniki, fayl)
        if not os.path.isfile(put):
            raise SystemExit("  ! нет исходника страницы: %s" % put)
        syroe = io.open(put, encoding="utf-8").read()

        # Комментарии вон — вместе со всем, что в них написано.
        chisto = re.sub(r"<!--.*?-->", "", syroe, flags=re.S)
        if "<!--" in chisto or "-->" in chisto:
            raise SystemExit("  ! %s: остался незакрытый комментарий — на сайт нельзя" % fayl)
        for slovo in ZAPRESHCHENO:
            if slovo in chisto:
                raise SystemExit("  ! %s: в тексте осталось служебное «%s»" % (fayl, slovo))

        zagolovok, telo = v_html(chisto)
        if not zagolovok:
            raise SystemExit("  ! %s: нет заголовка первого уровня" % fayl)
        tela.append((slug, title, opisanie, zagolovok, telo, voprosy(chisto)))

    for slug, title, opisanie, zagolovok, telo, pary in tela:
        adres = "%s%s/%s/" % (DOMEN, KORENJ, slug)
        # Соседние страницы кластера: и человеку есть куда пойти, и машине видно,
        # что это не одинокая страница, а раздел.
        sosedi = "".join(
            '<li><a href="../%s/">%s</a></li>' % (s2, t2)
            for s2, t2, _o, _z, _t, _p in tela if s2 != slug)

        stranica = (
            '<title>%s</title>\n'
            '<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta name="description" content="%s">\n'
            '<link rel="canonical" href="%s">\n'
            '<meta property="og:title" content="%s">\n'
            '<meta property="og:description" content="%s">\n'
            '<meta property="og:url" content="%s">\n'
            '<meta property="og:type" content="article">\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
            'family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">\n'
            '<script type="application/ld+json">%s</script>\n'
            '<style>%s%s</style>\n'
            '<article class="statya">\n%s\n</article>\n'
            '<nav class="sosedi"><b>Рядом об этом же</b><ul>%s</ul></nav>\n'
            '<p class="nazad"><a href="/vera/ru/">← Вера: голосовой администратор на вашей линии</a></p>\n'
            # Юридические ссылки: страницы публичные, значит человеку должно быть чем
            # дойти до оферты. Замечание Андрея 26.09 было про страницы продуктов,
            # но оставлять шесть публичных страниц без них — тот же шов.
            '<p class="pravo" style="margin:22px 0 0;font-size:13px;line-height:1.9;opacity:.72">'
            '<a href="/terms" style="color:inherit">Условия</a> · '
            '<a href="/privacy" style="color:inherit">Конфиденциальность</a> · '
            '<a href="/nda" style="color:inherit">NDA</a> · '
            '<a href="/sms" style="color:inherit">Сообщения</a> · '
            '<a href="/contacts" style="color:inherit">Контакты</a></p>\n'
        ) % (ekran(title), ekran(opisanie), adres, ekran(title), ekran(opisanie), adres,
             razmetka(zagolovok, opisanie, adres, pary), stil, DOP_CSS, telo, sosedi)

        put = os.path.join(out_dir, "zvonki", slug, "index.html")
        os.makedirs(os.path.dirname(put), exist_ok=True)
        # Код партнёра ловим и здесь: касс на этих страницах нет, но человек может прийти
        # по партнёрской ссылке именно сюда и уйти платить на /vera/. Один генератор
        # без вставки — и партнёр теряет клиента молча.
        from sborka import kod_partnera, bez_kommentariev, bez_css_kommentariev
        stranica = kod_partnera(stranica)
        # Стиль взят у лендинга Веры вместе с его рабочими заметками — чистим так же,
        # как страницы продуктов (29.09): в исходнике страницы наших пометок быть не должно.
        stranica = bez_css_kommentariev(bez_kommentariev(stranica))
        io.open(put, "w", encoding="utf-8").write(
            '<!doctype html>\n<html lang="ru">\n<head>\n%s\n</head>\n<body>\n%s\n</body>\n</html>\n'
            % (stranica[:stranica.index("</style>") + 8].strip(),
               stranica[stranica.index("</style>") + 8:].strip()))
        gotovo.append(("%s/%s/" % (KORENJ, slug), title))
    return gotovo
