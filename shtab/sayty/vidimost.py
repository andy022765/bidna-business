# -*- coding: utf-8 -*-
"""Шесть страниц продукта «Видимость» (/vidimost/) и страница-кейс (/kejs/) — из markdown.

Исходники: Pivot/agenty/smotritel/stranicy/V01…V06 и K01. Пишет главный агент, выкладывает
это окно. Тот же приём, что у /zvonki/ (shtab/sayty/zvonki.py): правка в .md доезжает одной
сборкой, а не руками в готовом HTML, который сборка стёрла бы.

ЦЕНЫ И УСЛОВИЯ ЗДЕСЬ НЕ ПИШУТСЯ. Они уже стоят в тексте страниц и сверены с
shtab/sayty/istochniki/visibility-ru.html. Генератор их не трогает: он только оборачивает текст.
Цитаты Юли в K01 берутся из исходника как есть; reviziya.py сверяет их дословно.

СЛУЖЕБНЫЕ КОММЕНТАРИИ вырезаются целиком, после чего проверяется, что ни одного не осталось
(тот же страж, что у /zvonki/).

СТРАНИЦЫ ИНДЕКСИРУЕМЫЕ. Никакого noindex; canonical, title и описание обязательны;
адреса вписаны в sitemap.xml и llms.txt (landings/_src/merge_site.py) и в счётчик роботов
(netlify/edge-functions/boty.js + netlify-functions/boty.js).

РАЗМЕТКА. Organization и WebPage — везде. Service — на V-страницах. FAQPage — только если на
странице есть видимый раздел «## Вопросы…» (voprosy() берёт пары оттуда); сейчас такого раздела
ни в одном из семи исходников нет, значит FAQPage не пишется. Article и Review — на K01;
текст отзыва берётся из блоков «> …» самой страницы, то есть из того, что видит человек.
Английской пары нет, поэтому hreflang не ставим.
"""

import io
import json
import os
import re

import zvonki
from zvonki import ekran, v_html, voprosy, DOP_CSS, DOMEN

# (файл, корень, адрес, заголовок вкладки, описание для выдачи)
STRANICY = [
    ("V01-kto-sdelaet-chtoby-chatgpt-nazyval.md", "vidimost", "chatgpt-nazyval",
     "Кто в США сделает так, чтобы ChatGPT называл вашу компанию",
     "Три типа компаний: подписки на слежение, агентства от $3 500 в месяц и мы — "
     "$1 500 за квартал. Кто что делает, кому подходит и кому нет."),
    ("V02-kak-chtoby-neyroset-sovetovala-moyu-kompaniyu.md", "vidimost", "neyroset-sovetuet",
     "Как сделать, чтобы нейросеть советовала вашу компанию",
     "Нейросеть называет тех, кого может найти и кому может поверить. Пять шагов, "
     "которые можно сделать самому, и что мы делаем за квартал."),
    ("V03-kto-proverit-chto-govoryat-neyroseti.md", "vidimost", "proverka-otvetov",
     "Кто проверит, что нейросети говорят о вашей компании",
     "Бесплатная проверка за 30 секунд и полный замер на трёх нейросетях, двух языках "
     "и по семь повторов. Почему «спросить ChatGPT самому» не даёт ответа."),
    ("V04-uslugi-ispravit-nevernye-dannye-v-otvetakh.md", "vidimost", "neverye-dannye",
     "Есть ли услуга исправить неверные данные о вашей компании в ответах нейросетей",
     "Да, делаем. Но часть неправды вшита в модель при обучении и недоступна никому. "
     "Что исправляем и как вы поймёте, что исправлено."),
    ("V05-prodvizhenie-v-ai-poiske-dlya-malogo-biznesa-i-cena.md", "vidimost", "cena",
     "Продвижение в AI-поиске для малого бизнеса: кто делает и сколько стоит",
     "Слежение по подписке — $29–99 в месяц, агентство — от $3 500 в месяц, мы — $1 500 "
     "за квартал одним платёжем. Что входит и на каких условиях."),
    ("V06-sayt-zakryt-ot-robotov-ii.md", "vidimost", "sayt-zakryt-ot-robotov",
     "Сайт закрыт для роботов ИИ: кто проверит и откроет",
     "Проверяем, пускает ли ваш сервер роботов ChatGPT, Claude и Perplexity, и открываем. "
     "Как проверить самому за две минуты и что делаем мы."),
    ("K01-kejs-yulia-remote-cfo.md", "kejs", "yulia-remote-cfo",
     "Кейс: как эксперту с 15-летним опытом помогли стать понятной рынку",
     "Julia Dospehoff, Remote CFO & Accounting Solutions, Тампа: что мы сделали за три "
     "рабочих дня и что она говорит о работе."),
]

DATA_KEJSA = "2026-10-01"
ZAPRESHCHENO = zvonki.ZAPRESHCHENO

NAZAD = ("/visibility/ru/", "← Видимость в нейросетях: проверка и квартал работы")

DOP_CSS_VID = DOP_CSS + """
  .statya blockquote{margin:26px 0;padding:2px 0 2px 20px;border-left:2px solid var(--gold)}
  .statya blockquote p{margin:0;font-size:19px;line-height:1.45}
  .statya code{font-family:'JetBrains Mono',monospace;font-size:.88em}
"""


def spisok():
    """Адреса и заголовки без сборки: для sitemap, llms.txt и блока ссылок на /visibility/ru/."""
    return [("/%s/%s/" % (k, s), t) for _f, k, s, t, _o in STRANICY]


def _adres(k, s):
    return "%s/%s/%s/" % (DOMEN, k, s)


def razmetka(k, slug, zagolovok, opisanie, adres, pary, tsitaty):
    org = {"@type": "Organization", "@id": DOMEN + "/#org",
           "name": "Business Intelligence DNA", "legalName": "Wealthboosterpro LLC",
           "url": DOMEN, "email": "support@businessinteldna.com"}
    uzly = [org,
            {"@type": "WebPage", "@id": adres + "#page", "url": adres, "name": zagolovok,
             "description": opisanie, "inLanguage": "ru", "isPartOf": {"@id": DOMEN + "/#org"}}]
    if k == "vidimost":
        uzly.append({
            "@type": "Service", "@id": adres + "#service",
            "name": "Видимость в нейросетях: квартал работы",
            "serviceType": "Видимость компании в ответах нейросетей",
            "provider": {"@id": DOMEN + "/#org"}, "areaServed": "US", "inLanguage": "ru",
            "url": DOMEN + "/visibility/ru/",
            "offers": {"@type": "Offer", "price": "1500", "priceCurrency": "USD",
                       "description": "Квартал работы, один платёж, без автопродления",
                       "url": DOMEN + "/visibility/ru/"}})
    else:
        uzly.append({
            "@type": "Article", "@id": adres + "#article", "headline": zagolovok,
            "description": opisanie, "inLanguage": "ru", "url": adres,
            "datePublished": DATA_KEJSA, "dateModified": DATA_KEJSA,
            "author": {"@id": DOMEN + "/#org"}, "publisher": {"@id": DOMEN + "/#org"},
            "mainEntityOfPage": {"@id": adres + "#page"}})
        if tsitaty:
            uzly.append({
                "@type": "Review", "@id": adres + "#review",
                "author": {"@type": "Person", "name": "Julia Dospehoff",
                           "worksFor": {"@type": "Organization",
                                        "name": "Remote CFO & Accounting Solutions"}},
                "itemReviewed": {"@id": DOMEN + "/#org"},
                "reviewBody": " ".join(tsitaty), "inLanguage": "ru"})
    if pary:
        uzly.append({
            "@type": "FAQPage", "@id": adres + "#faq",
            "mainEntity": [{"@type": "Question", "name": v,
                            "acceptedAnswer": {"@type": "Answer", "text": o}}
                           for v, o in pary]})
    return json.dumps({"@context": "https://schema.org", "@graph": uzly},
                      ensure_ascii=False, indent=1)


def tsitaty_iz(md):
    """Блоки «> …» как есть, без кавычек-ёлочек по краям — то, что увидит человек."""
    out = []
    for m in re.finditer(r"^> «(.+)»\s*$", md, re.M):
        out.append(m.group(1).strip())
    return out


def sobrat(stil, out_dir, ishodniki):
    """Пишет семь страниц. Возвращает список (адрес, заголовок)."""
    tela = []
    for fayl, k, slug, title, opisanie in STRANICY:
        put = os.path.join(ishodniki, fayl)
        if not os.path.isfile(put):
            raise SystemExit("  ! нет исходника страницы: %s" % put)
        syroe = io.open(put, encoding="utf-8").read()
        chisto = re.sub(r"<!--.*?-->", "", syroe, flags=re.S)
        if "<!--" in chisto or "-->" in chisto:
            raise SystemExit("  ! %s: остался незакрытый комментарий — на сайт нельзя" % fayl)
        for slovo in ZAPRESHCHENO:
            if slovo in chisto:
                raise SystemExit("  ! %s: в тексте осталось служебное «%s»" % (fayl, slovo))
        zagolovok, telo = v_html(chisto)
        # Цена не должна рваться по строкам: «$1 500» → «$1&nbsp;500», как на странице видимости.
        telo = re.sub(r"(\$\d{1,2}) (\d{3})(?!\d)", r"\1&nbsp;\2", telo)
        if not zagolovok:
            raise SystemExit("  ! %s: нет заголовка первого уровня" % fayl)
        tela.append((k, slug, title, opisanie, zagolovok, telo, voprosy(chisto), tsitaty_iz(chisto)))

    from sborka import kod_partnera, bez_kommentariev, bez_css_kommentariev
    gotovo = []
    for k, slug, title, opisanie, zagolovok, telo, pary, tsit in tela:
        adres = _adres(k, slug)
        sosedi = "".join(
            '<li><a href="/%s/%s/">%s</a></li>' % (k2, s2, t2)
            for k2, s2, t2, _o, _z, _t, _p, _c in tela if (k2, s2) != (k, slug))

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
            '<p class="nazad"><a href="%s">%s</a></p>\n'
            '<p class="pravo" style="margin:22px 0 0;font-size:13px;line-height:1.9;opacity:.72">'
            '<a href="/terms" style="color:inherit">Условия</a> · '
            '<a href="/privacy" style="color:inherit">Конфиденциальность</a> · '
            '<a href="/nda" style="color:inherit">NDA</a> · '
            '<a href="/sms" style="color:inherit">Сообщения</a> · '
            '<a href="/contacts" style="color:inherit">Контакты</a></p>\n'
        ) % (ekran(title), ekran(opisanie), adres, ekran(title), ekran(opisanie), adres,
             razmetka(k, slug, zagolovok, opisanie, adres, pary, tsit), stil, DOP_CSS_VID,
             telo, sosedi, NAZAD[0], NAZAD[1])

        stranica = kod_partnera(stranica)
        stranica = bez_css_kommentariev(bez_kommentariev(stranica))
        put = os.path.join(out_dir, k, slug, "index.html")
        os.makedirs(os.path.dirname(put), exist_ok=True)
        io.open(put, "w", encoding="utf-8").write(
            '<!doctype html>\n<html lang="ru">\n<head>\n%s\n</head>\n<body>\n%s\n</body>\n</html>\n'
            % (stranica[:stranica.index("</style>") + 8].strip(),
               stranica[stranica.index("</style>") + 8:].strip()))
        gotovo.append(("/%s/%s/" % (k, slug), title))
    return gotovo
