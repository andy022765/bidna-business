#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Полная ревизия лендингов по живому сайту.

    python3 shtab/sayty/reviziya.py

Проверяет НЕ файлы, а то, что отдаёт домен. Каждая проверка здесь — след конкретного
ляпа, найденного 23.09. Если проверка кажется странной, значит на ней уже обожглись.
"""
import json, re, ssl, sys, urllib.error, urllib.request
import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
UA = {"User-Agent": "BusinessIntelDNA-LinkPreview/1.0 (+https://businessinteldna.com)"}
DOM = "https://businessinteldna.com"
# Предпросмотр до выкатки: python3 reviziya.py --dom https://<черновая-выкладка>.netlify.app
# Так ШТАБ принимает работу ГОЛОСА ДО того, как её увидит Андрей и до живой выкатки.
if "--dom" in sys.argv:
    DOM = sys.argv[sys.argv.index("--dom") + 1].rstrip("/")
    print("ПРОВЕРЯЮ ПРЕДПРОСМОТР:", DOM)
# Приёмка (call-audit) закрыта решением Андрея 24.09 — её страницы проверяются отдельно: как закрытые.
SLUGI = ["visibility", "vera", "diagnostic"]
bed = []
stranicy = {}


class BezRedirektov(urllib.request.HTTPRedirectHandler):
    """Не ходить по 301. Нужно там, где сам редирект и есть проверяемое поведение."""
    def redirect_request(self, *a, **kw):
        return None


def vzyat(put, po_redirektam=True):
    # CTX обязателен в ОБЕИХ ветках: без него запросы падают молча и всё выглядит как «отдаёт 0».
    otkryt = (urllib.request.urlopen if po_redirektam
              else urllib.request.build_opener(urllib.request.HTTPSHandler(context=CTX),
                                               BezRedirektov()).open)
    try:
        with otkryt(urllib.request.Request(DOM + put, headers=UA),
                    timeout=25, **({"context": CTX} if po_redirektam else {})) as o:
            return o.status, o.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e:
        # 301 без хождения по нему прилетает сюда — для нас это УСПЕХ, а не ошибка.
        return e.code, ""
    except Exception:
        return 0, ""


def beda(gde, chto):
    bed.append((gde, chto))


def golo(n):
    print("\n" + n)


# ─────────────────────────────────────────────── собираем страницы
adresa = []
for s in SLUGI:
    adresa += ["/%s/" % s, "/%s/ru/" % s, "/%s/paid/" % s, "/%s/ru/paid/" % s]
    if s != "diagnostic":
        adresa += ["/%s/thanks/" % s, "/%s/ru/thanks/" % s]
golo("СТРАНИЦЫ")
for u in adresa:
    k, t = vzyat(u)
    stranicy[u] = t
    if k != 200:
        beda(u, "отдаёт %s" % k)
print("  проверено %d, не 200: %d" % (len(adresa), sum(1 for u in adresa if not stranicy[u])))

# ─────────────────────────────────────────────── кнопки никуда
golo("КНОПКИ И ССЫЛКИ — НЕТ ЛИ ВЕДУЩИХ В ПУСТОТУ")
vnutr = 0
for u, t in stranicy.items():
    if not t:
        continue
    # Netlify на выкладке переписывает тег формы в одинарные кавычки (id='forma') — это валидный
    # HTML, браузер якорь находит. Искать только двойные значило кричать на здоровые кнопки (24.09).
    yakorya = set(re.findall(r'''id=["']([^"']+)["']''', t))
    for h in set(re.findall(r'href="([^"]+)"', t)):
        if h.startswith("#"):
            if h[1:] and h[1:] not in yakorya:
                beda(u, "якорь %s никуда не ведёт" % h)
            vnutr += 1
        elif h.startswith("/"):
            vnutr += 1
            k, _ = vzyat(h)
            if k not in (200, 301, 302):
                beda(u, "ссылка %s отдаёт %s" % (h, k))
print("  внутренних ссылок и якорей проверено: %d" % vnutr)

# ─────────────────────────────────────────────── оплата
golo("ПУТЬ К ОПЛАТЕ ЕСТЬ ВЕЗДЕ")
for u, t in stranicy.items():
    if not t or "/paid/" in u:
        continue
    if "buy.stripe.com" not in t:
        beda(u, "нет ни одной ссылки на оплату")
ssylki = set()
for t in stranicy.values():
    ssylki |= set(re.findall(r"https://buy\.stripe\.com/[A-Za-z0-9]+", t))
print("  разных ссылок оплаты на сайте: %d" % len(ssylki))
for s in sorted(ssylki):
    k, _ = vzyat("/") if False else (0, "")
    try:
        with urllib.request.urlopen(urllib.request.Request(s, headers=UA), timeout=25, context=CTX) as o:
            if o.status != 200:
                beda(s, "ссылка оплаты отдаёт %s" % o.status)
    except Exception as e:
        beda(s, "ссылка оплаты не открылась: %s" % str(e)[:40])

# ─────────────────────────────────────────────── ляпы 23.09
golo("ЛЯПЫ, КОТОРЫЕ МЫ ВСКРЫЛИ СЕГОДНЯ")
LYAPY = [
    # «до $5 000 в месяц» на видимости — цена АГЕНТСТВ, она законна. Ловим только нашу.
    ("от $5 000 / from $5,000", r"(?:[Вв]недрение|[Ii]mplementation)[^.]{0,40}\$\s?5[  ,]000",
     "отменённая цена внедрения"),
    ("сорок минут", r"[Сс]орок минут|[Ff]orty minutes|forty-minute", "звонок отменён, утверждаем письмом"),
    # На приёмке «в течение рабочего дня» — правда: бесплатный звонок делаем руками.
    # Ловим только там, где обещан АВТОМАТИЧЕСКИЙ разбор.
    ("в течение рабочего дня", r"прогон[^.]{0,60}в течение рабочего дня|runs[^.]{0,60}within one business day",
     "разбор приходит за секунды"),
    ("номер 888", r"888[  ]?481[  ]?0868", "сломан перевод на живого, должен быть 424"),
    # Calendly: 27.09 Андрей — «под каждой кнопкой оплаты: остались вопросы, забронируйте звонок». Правило 23.09 снято, проверка — ниже.
    ("ДНК/DNA в анкете", r"сборка ДНК вашего бизнеса|building your business DNA", "чужой продукт"),
]
for imya, rx, pochemu in LYAPY:
    gde = [u for u, t in stranicy.items() if t and re.search(rx, t)]
    print("  %-26s %s" % (imya, ("ЧИСТО" if not gde else "НАЙДЕНО: " + ", ".join(gde))))
    for u in gde:
        beda(u, "%s — %s" % (imya, pochemu))

# ─────────────────────────────────────────────── согласованность
golo("СОГЛАСОВАННОСТЬ")
for u, t in stranicy.items():
    if not t:
        continue
    yaz = "ru" if "/ru/" in u else "en"
    m = re.search(r'<html lang="(\w+)"', t)
    if m and m.group(1) != yaz:
        beda(u, "язык страницы %s, а адрес %s" % (m.group(1), yaz))
    if "<title>" not in t:
        beda(u, "нет заголовка")
    if 'name="viewport"' not in t:
        beda(u, "нет viewport — мобильные сломаются")
    if len(re.findall(r"hreflang=", t)) < 2:
        beda(u, "нет пары hreflang")
# цифры справа объяснены
for s in ("visibility", "vera"):
    for u in ("/%s/" % s, "/%s/ru/" % s):
        t = stranicy.get(u, "")
        if t and not re.search(r"взятые с их собственных сайтов|taken from their own sites", t):
            beda(u, "в блоке цены не сказано, чьи цифры справа")
# демо Веры — три минуты и в браузере, и по телефону (решение Андрея 26.09). Прежнее правило
# 23.09 требовало абзац «В браузере — три минуты… по телефону — до пятнадцати», его Андрей велел убрать целиком.
for u in ("/vera/", "/vera/ru/"):
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", stranicy.get(u, "")))
    for m in re.finditer(r"\+1[  ]?424[  ]?\d{3}[  ]?\d{4}", tx):
        if not re.search(r"3 минут|тр[её]х минут|три минуты|3 minutes|three minutes", tx[m.end():m.end() + 120]):
            beda(u, "у номера %s не сказано «до 3 минут»" % m.group(0))

# ─────────────────────────────────────────────── одно имя одному документу
# 23.09: один и тот же документ звался на Вере и приёмке «лист правды», «brief»,
# «fact sheet», «список вопросов» и имел то двенадцать полей, то двадцать два вопроса.
# У ВИДИМОСТИ документ другой и называется «список вопросов» — он и должен.
golo("ОДНО ИМЯ ОДНОМУ ДОКУМЕНТУ")
IMENA = {
    "visibility": (r"список вопросов|question list", r"лист(?:а|у|ом|е)? правды|truth sheet"),
    "vera":       (r"лист(?:а|у|ом|е)? правды|truth sheet", r"список вопросов|question list"),
}
for slug, (svoy, chuzhoy) in IMENA.items():
    svoih = chuzhih = 0
    for u, t in stranicy.items():
        if not t or not u.startswith("/%s/" % slug):
            continue
        tx = re.sub(r"<[^>]+>", " ", t)
        svoih += len(re.findall(svoy, tx, re.I))
        for m in re.finditer(chuzhoy, tx, re.I):
            beda(u, "документ назван чужим именем: «%s»" % m.group(0))
            chuzhih += 1
    print("  %-12s своё имя ×%d, чужих %d" % (slug, svoih, chuzhih))
# третьи имена и старая цифра — только там, где это не «Паспорт линии» ($150, у него поля свои)
for u, t in stranicy.items():
    if not t:
        continue
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))
    for m in re.finditer(r"fact sheet|\bbriefs?\b|двенадцать полей|twelve[- ]field", tx, re.I):
        okno = tx[max(0, m.start() - 95):m.end() + 45]
        # «Паспорт линии» ($150) и «Паспорт фактов» ($300) — ДРУГИЕ товары,
        # свои поля и своё имя у них законны.
        if any(s in okno for s in ("Паспорт линии", "Line Passport",
                                   "Паспорт фактов", "Fact Sheet",
                                   "Двадцать пять утвержд", "Twenty-five statements")):
            continue
        beda(u, "третье имя или старая цифра: «%s»" % m.group(0))
# созвон отменён и здесь
for u, t in stranicy.items():
    if t and re.search(r"[Дд]вадцать минут разговора|[Tt]wenty minutes on the phone", t):
        beda(u, "двадцатиминутный созвон — утверждаем письмом")

# ─────────────────────────────────────────────── старая воронка
# 24.09: ревизия смотрела только на четыре новых лендинга, а старая воронка
# (главная → /business/ → список работ → оплата → спасибо → анкета) всё это время
# жила рядом, была полностью боеспособна и могла взять $500 по своим ссылкам Stripe.
# Решение Андрея 24.09 (вариант 1): вход перекрыть, страницы не удалять.
golo("СТАРАЯ ВОРОНКА")
ZAKRYTYE = ["/business/anketa-b-7k3m9x", "/expert/anketa-e-4q8v2n", "/business/intake-b-9f2r5t"]
STARAYA_OPLATA = ["/business/oplata", "/expert/oplata"]
# 1. анкеты живы — на них ссылается «оплачено» НОВОЙ диагностики, удалять нельзя
for u in ZAKRYTYE:
    k, tt = vzyat(u)
    if k not in (200, 301, 302):
        beda(u, "закрытая анкета отдаёт %s — по ней приходят оплатившие" % k)
    elif k == 200 and "noindex" not in tt.lower():
        beda(u, "нет метки noindex; в robots.txt вписывать НЕЛЬЗЯ — это опубликует адрес")
print("  закрытых анкет проверено: %d" % len(ZAKRYTYE))
# 2. старые страницы оплаты должны уводить на новую диагностику, а не продавать сами
for u in STARAYA_OPLATA:
    # БЕЗ хождения по редиректу: с 23.09 эти адреса отдают 301 на новую диагностику,
    # а у неё СВОЯ законная касса. Пойдя по редиректу, проверка видела кассу назначения
    # и ругалась на исправленное. Проверяем первый ответ, а не конечную страницу.
    k, tt = vzyat(u, po_redirektam=False)
    if k in (301, 302, 308):
        continue
    if k == 200 and "buy.stripe.com" in tt:
        beda(u, "старая страница оплаты всё ещё берёт деньги — должна уводить на /diagnostic/")
    elif k not in (200, 301, 302, 308):
        beda(u, "старая страница оплаты отдаёт %s — ожидали 301 на /diagnostic/" % k)
print("  старых страниц оплаты: %d" % len(STARAYA_OPLATA))
# 3. один продукт — одна касса. Любая ссылка Stripe вне этих четырёх = вторая касса.
NASHI = {"cNi3cn63e5Vw6vr3rBfrW06": "диагностика $500",
         "cNi8wHdvG4RsbPLe6ffrW05": "видимость $1500",
         "28E6oz3V6abMbPLbY7frW03": "Вера $1000",
         "eVqfZ92R23NoaLH1jtfrW07": "Вера $1000, русская",  # 25.09: …frW03 вёз русского покупателя на английское «оплачено»
         "bJe00b8bm83E7zv2nxfrW08": "видимость $1500, русская",  # 25.09: то же у …frW05 → /visibility/ru/paid/
}  # приёмка $450 (…frW02) снята с сайта 24.09 — встретится где-то снова, значит лишняя касса.
# …frW00, …frW01, …frW02 выключены в Stripe 25.09 (ГОЛОС). …frW04 «оба этапа $2 500» жива, но кнопки на неё нет — решение Андрея.
VSE = adresa + ZAKRYTYE + STARAYA_OPLATA + ["/", "/business/", "/expert/", "/business/en",
      "/expert/en", "/business/list", "/expert/list", "/business/spasibo", "/expert/spasibo"]
kassy = {}
for u in VSE:
    tt = stranicy.get(u) or vzyat(u)[1]
    for s in set(re.findall(r"buy\.stripe\.com/(\w+)", tt)):
        kassy.setdefault(s, set()).add(u)
for s, gde in sorted(kassy.items()):
    if s not in NASHI:
        beda(", ".join(sorted(gde)), "лишняя касса buy.stripe.com/%s" % s)
print("  касс на сайте: %d, лишних: %d" % (len(kassy), sum(1 for s in kassy if s not in NASHI)))
# 4. кнопки «оплачено» новой диагностики ведут в живые анкеты — эту дыру чуть не прорубили сами
for u in ("/diagnostic/paid/", "/diagnostic/ru/paid/"):
    tt = stranicy.get(u, "")
    celi = re.findall(r'href="(https?://businessinteldna\.com)?(/[^"]*(?:anketa|intake)[^"]*)"', tt)
    if not celi:
        beda(u, "после оплаты диагностики некуда идти — нет ссылки на анкету")
    for _, c in celi:
        k, _t = vzyat(c)
        if k != 200:
            beda(u, "анкета после оплаты отдаёт %s: %s" % (k, c))
print("  выходов после оплаты диагностики проверено: 2")

# ─────────────────────────────────────────────── фото основателей
# 24.09, решение Андрея: новое фото на ВСЕХ лендингах, старое нигде не осталось.
# Проверяем не «есть тег img», а что картинка реально отдаётся и что она одна и та же.
golo("ФОТО ОСНОВАТЕЛЕЙ")
import hashlib, urllib.parse
otpechatki = {}
for slug in SLUGI:
    for u in ("/%s/" % slug, "/%s/ru/" % slug):
        tt = stranicy.get(u, "")
        if not tt:
            continue
        m = re.search(r'<img src="([^"]*foto\.webp)"[^>]*width="(\d+)" height="(\d+)"', tt)
        if not m:
            beda(u, "нет фото основателей")
            continue
        src, w, h = m.groups()
        put = urllib.parse.urljoin(u, src)          # ../img/foto.webp с /vera/ru/ → /vera/img/foto.webp
        try:
            with urllib.request.urlopen(urllib.request.Request(DOM + put, headers=UA),
                                        timeout=25, context=CTX) as o:
                telo = o.read()
        except Exception as ex:
            beda(u, "фото не грузится: %s (%s)" % (put, str(ex)[:30]))
            continue
        otpechatki.setdefault(hashlib.md5(telo).hexdigest(), []).append(u)
        if (int(w), int(h)) != (820, 850):
            beda(u, "размер в разметке %sx%s, а файл 820x850 — картинку растянет" % (w, h))
print("  страниц с фото: %d, разных картинок: %d"
      % (sum(len(v) for v in otpechatki.values()), len(otpechatki)))
if len(otpechatki) > 1:
    for _, gde in sorted(otpechatki.items())[1:]:
        beda(", ".join(gde), "тут стоит ДРУГОЕ фото, а должно быть одно на всех")

# ─────────────────────────────────────────────── закрытое остаётся закрытым
# 24.09: приёмку закрыли — страницы уводят 301 на Веру, а листы правды под ней живут
# (пятнадцати компаниям письмами обещана бесплатная приёмка, на «да» нужен этот адрес).
golo("ЗАКРЫТАЯ ПРИЁМКА")
class _NeIdti(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
_op = urllib.request.build_opener(_NeIdti, urllib.request.HTTPSHandler(context=CTX))
for u, cel in (("/call-audit/", "/vera/"), ("/call-audit/paid/", "/vera/"), ("/call-audit/thanks/", "/vera/"),
               ("/call-audit/ru/", "/vera/ru/"), ("/call-audit/ru/paid/", "/vera/ru/"),
               ("/call-audit/ru/thanks/", "/vera/ru/"), ("/priemka", "/vera/ru/")):
    try:
        with _op.open(urllib.request.Request(DOM + u, headers=UA), timeout=25) as o:
            beda(u, "закрытая страница снова открыта (%s)" % o.status)
    except urllib.error.HTTPError as e:
        loc = (e.headers.get("Location") or "").rstrip("/")
        if e.code != 301 or not loc.endswith(cel.rstrip("/")):
            beda(u, "ждали 301 на %s, пришло %s → %s" % (cel, e.code, loc or "—"))
for u in ("/call-audit/truth-sheet-t4k8m2", "/call-audit/ru/truth-sheet-t4k8m2"):
    k, tt = vzyat(u)
    if k != 200:
        beda(u, "лист правды под приёмкой отдаёт %s — на «да» из писем его не открыть" % k)
    elif "noindex" not in tt.lower():
        beda(u, "лист правды без noindex")
for u in ("/sitemap.xml", "/llms.txt"):
    k, tt = vzyat(u)
    if re.search(r"call-audit", tt):
        beda(u, "в %s снова приёмка" % u)
print("  закрытых адресов проверено: 7, листов правды: 2")

# ─────────────────────────────────────────────── цифра стоит рядом со своим источником
# 24.09: на лендинге Веры две чужие цифры стояли без источника, а к 86% мы сами дописали
# «в США» — у Hiya это опрос по шести странам. Безымянное «по замеру» для нейросетей шум,
# а по-английски под такое утверждение FTC требует доказательство.
golo("ЦИФРЫ С ИСТОЧНИКОМ")
ISTOCHNIKI = [  # (цифра, чей замер, чего в источнике нет)
    (r"36\s?%", r"Invoca", None),
    (r"86\s?%", r"Hiya", r"в США|in the US|в Штатах"),
]
for u in ("/vera/", "/vera/ru/"):
    tt = stranicy.get(u, "")
    if not tt:
        continue
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", tt))
    if re.search(r"(?<![\d.])64\s?%", tx):
        beda(u, "64% — наша арифметика, у Invoca сказано «только 36% просят»")
    for cifra, kto, nelzya in ISTOCHNIKI:
        for m in re.finditer(cifra, tx):
            okno = tx[max(0, m.start() - 220):m.end() + 220]
            if not re.search(kto, okno):
                beda(u, "%s без источника рядом (%s)" % (m.group(0), kto))
            if nelzya and re.search(nelzya, tx[m.start():m.end() + 90]):
                beda(u, "%s: «в США» — у источника этого нет" % m.group(0))
print("  страниц проверено: 2")

# ─────────────────────────────────────────────── замечания Андрея по видимости, 24.09
# Нашёл глазами то, мимо чего ревизия проходила. Каждое — теперь проверка.
golo("ВИДИМОСТЬ: ЗАМЕЧАНИЯ АНДРЕЯ")
ZAMECHANIYA = [
    (r"час разговора|час созвона|hour-long call|one-hour call|an hour of conversation",
     "час разговора — его давно нет, шлём форму"),
    (r"в течение (?:рабочего )?дня|within (?:one )?(?:business )?day",
     "«в течение дня» — ответ приходит за минуту"),
    (r"зачт[её]тся|credited against", "обещание зачёта $500 — убрано решением Андрея"),
    (r"[Пп]очему не дороже|[Ww]hy not (?:more|higher)", "форма «почему не дороже» — убрана решением Андрея"),
]
for u in [a for a in stranicy if a.startswith("/visibility/")]:
    tt = stranicy.get(u, "")
    if not tt:
        continue
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", tt))
    for rx, chto in ZAMECHANIYA:
        m = re.search(rx, tx)
        if m:
            beda(u, "%s («%s»)" % (chto, m.group(0)))
print("  страниц видимости проверено: %d" % len([a for a in stranicy if a.startswith("/visibility/")]))

# ─────────────────────────────────────────────── шесть страниц видимости /zvonki/ (с 25.09)
# Их цель — чтобы нейросети нашли и процитировали. Поэтому проверяем не только «открывается»,
# но и что их можно найти: индексируемы, в карте сайта, в llms.txt, есть ссылки с Веры.
golo("СТРАНИЦЫ /zvonki/")
ZVONKI = ["/zvonki/poka-rabotayu/", "/zvonki/ne-teryat/", "/zvonki/vecher-i-vyhodnye/",
          "/zvonki/skolko-teryayu/", "/zvonki/po-russki/", "/zvonki/chelovek-ili-robot/"]
_, sitemap = vzyat("/sitemap.xml")
_, llms = vzyat("/llms.txt")
_, vera_ru = vzyat("/vera/ru/")
for u in ZVONKI:
    k, tt = vzyat(u)
    if k != 200:
        beda(u, "отдаёт %s" % k); continue
    if "noindex" in tt.lower():
        beda(u, "стоит noindex — нейросети её не найдут")
    # На предпросмотре карты сайта нет нарочно — копия не должна спорить с живым за выдачу (25.09).
    if DOM == "https://businessinteldna.com" and u not in sitemap:
        beda(u, "нет в sitemap.xml")
    if u not in llms:
        beda(u, "нет в llms.txt")
    if u not in vera_ru:
        beda(u, "нет ссылки с /vera/ru/")
    if "<!--" in tt or "ЧЕРНОВИК" in tt:
        beda(u, "в коде остались служебные пометки черновика")
    if re.search(r"888[  ]?481", tt):
        beda(u, "старый номер 888")
    if not re.search(r"424[  ]?781[  ]?1913", tt):
        beda(u, "нет действующего номера 424")
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", tt))
    for cifra, kto in ((r"36\s?%", "Invoca"), (r"86\s?%", "Hiya")):
        for m in re.finditer(cifra, tx):
            if not re.search(kto, tx[max(0, m.start() - 220):m.end() + 220]):
                beda(u, "%s без источника рядом (%s)" % (m.group(0), kto))
    if re.search(r"86\s?%[^.]{0,90}(?:в США|in the US)", tx):
        beda(u, "86% с «в США» — у Hiya этого нет")
    if re.search(r"(?<![\d.])64\s?%", tx):
        beda(u, "64% — наша арифметика вместо «36% просят»")
print("  страниц /zvonki/ проверено: %d" % len(ZVONKI))

# ─────────────────────────────────────────────── шесть страниц /vidimost/ и кейс /kejs/ (с 01.10)
# Страницы для нейросетей: проверяем не только «открывается», но и что их можно найти,
# что цены не разъехались с источником правды и что цитаты Юли дословные.
golo("СТРАНИЦЫ /vidimost/ И /kejs/")
VIDIMOST = ["/vidimost/chatgpt-nazyval/", "/vidimost/neyroset-sovetuet/", "/vidimost/proverka-otvetov/",
            "/vidimost/neverye-dannye/", "/vidimost/cena/", "/vidimost/sayt-zakryt-ot-robotov/"]
KEJS = "/kejs/yulia-remote-cfo/"
CITATY_YULI = [
    "Честно говоря, сначала я думала, что это будет очередной красивый документ, который в итоге просто останется лежать в столе.",
    "Вместо общего предложения бухгалтерских и CFO-услуг у меня появилось чёткое направление — финансовая реконструкция, контролёрская дисциплина, CFO-поддержка принятия решений и практический опыт владельца бизнеса.",
    "Я рекомендую эту команду экспертам и владельцам бизнеса, у которых есть сильный опыт и реальная ценность, но которые пока не могут превратить их в ясное, убедительное и отличающееся от конкурентов позиционирование.",
]
# Суммы, которые вправе стоять на этих страницах: квартал, диагностика, чужие цены со страницы видимости.
DOLLARY_OK = {"$29", "$99", "$190", "$400", "$450", "$500", "$600", "$1 500", "$3 500", "$4 540", "$29–99"}
_, sitemap_v = vzyat("/sitemap.xml")
_, llms_v = vzyat("/llms.txt")
_, vis_ru = vzyat("/visibility/ru/")
for u in VIDIMOST + [KEJS]:
    k, tt = vzyat(u)
    if k != 200:
        beda(u, "отдаёт %s" % k); continue
    if "noindex" in tt.lower():
        beda(u, "стоит noindex — нейросети её не найдут")
    if DOM == "https://businessinteldna.com" and u not in sitemap_v:
        beda(u, "нет в sitemap.xml")
    if u not in llms_v:
        beda(u, "нет в llms.txt")
    if u not in vis_ru:
        beda(u, "нет ссылки с /visibility/ru/")
    if '<link rel="canonical" href="https://businessinteldna.com%s">' % u not in tt:
        beda(u, "canonical не на себя")
    if "<!--" in tt or "ЧЕРНОВИК" in tt or "СТРАНИЦЫ (02.10" in tt:
        beda(u, "в коде остались служебные пометки черновика")
    ld = re.findall(r'<script type="application/ld\+json">(.*?)</script>', tt, re.S)
    try:
        tipy = {n.get("@type") for n in json.loads(ld[0])["@graph"]} if ld else set()
    except Exception:
        tipy = set()
    tx = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", tt, flags=re.S)))
    tx = tx.replace("\xa0", " ").replace("&nbsp;", " ")
    if not {"Organization", "WebPage"} <= tipy:
        beda(u, "в разметке нет Organization/WebPage")
    if re.search(r"\]\(|`", tx):
        beda(u, "в видимом тексте остался сырой markdown ([текст](адрес) или `код`)")
    if re.search(r"\$\d{1,2} \d{3}(?!\d)", re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", tt, flags=re.S).replace("&nbsp;", "")) and \
       re.search(r"\$\d{1,2} \d{3}(?!\d)", re.sub(r"<[^>]+>", "", re.sub(r"<(script|style)[^>]*>.*?</\1>|<meta[^>]*>", " ", tt, flags=re.S))):
        beda(u, "цена с обычным пробелом («$1 500») — может разорваться по строкам")
    if "FAQPage" in tipy and not re.search(r"Вопросы", tx):
        beda(u, "FAQPage без видимого раздела вопросов")
    if u in VIDIMOST:
        if "Service" not in tipy:
            beda(u, "в разметке нет Service")
        if "/visibility/ru/" not in tt:
            beda(u, "нет ссылки на /visibility/ru/")
        for d in set(re.findall(r"\$\d[\d ]*(?:–\d+)?", tx)):
            d = d.strip()
            if d not in DOLLARY_OK:
                beda(u, "сумма «%s» вне списка из источника правды" % d)
        for pr in re.split(r"(?<=[.!?]) ", tx):
            if re.search(r"возвращаем|вернём", pr) and "устойчиво" not in pr and "Ноль упоминаний" not in pr \
                    and "не называли" not in pr:
                beda(u, "условие возврата без слова «устойчиво»: «%s…»" % pr[:70])
    else:
        if not {"Article", "Review"} <= tipy:
            beda(u, "в разметке нет Article/Review")
        for c in CITATY_YULI:
            if c not in tx:
                beda(u, "цитата Юли не дословная или пропала: «%s…»" % c[:40])
        if re.search(r"174\s?000|\$174", tx):
            beda(u, "число из закрытых цифр Юли")
print("  страниц /vidimost/ и /kejs/ проверено: %d" % (len(VIDIMOST) + 1))


# ─────────────────────────────────────────────── формы принимаются
# 25.09 Андрей нажал «Открыть звонок» в предпросмотре и получил 404. Причина: на сайте, где приём форм
# у Netlify не включён (на новых сайтах он выключен по умолчанию), атрибут data-netlify остаётся в коде
# как есть, и отправка POST на страницу «спасибо» падает в 404. Подключённую форму Netlify переписывает
# сам и атрибут убирает. На живом такая форма — это сломанная воронка.
golo("ФОРМЫ ПРИНИМАЮТСЯ")
nepodkl = 0
for u, t in stranicy.items():
    for f in re.findall(r"<form\b[^>]*>", t or ""):
        if re.search(r"data-netlify\s*=", f):
            nepodkl += 1
            beda(u, "форма %s не подключена к приёму Netlify — отправка даст 404"
                 % (re.search(r'''name=["']([^"']+)''', f) or re.search(r"(<form)", f)).group(1))
print("  страниц проверено: %d, неподключённых форм: %d" % (len(stranicy), nepodkl))


def vidimyj(tt):
    """Только то, что видит человек: без скриптов, стилей и тегов."""
    tt = re.sub(r"<script.*?</script>|<style.*?</style>", " ", tt, flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", tt))


# ─────────────────────────────────────────────── всё на нашей стороне (решение Андрея 25.09)
# «Всё на нашей стороне. Мы просто подключаем клиенту сервис». До 25.09 оферта, privacy и NDA
# обещали: сервисы регистрируются на ваше имя, платите вы, при сдаче передаём владение.
# Фраза про Stripe («даже если бы мы захотели посмотреть на вашу карту») верна — под проверку не попадает.
golo("ВСЁ НА НАШЕЙ СТОРОНЕ")
NA_NAS = (r"регистриру\w* на ваше имя|оформл\w* на ваше имя|на ваше имя и вашу почту|платите за него вы"
          r"|передаём вам владение|оплату таких сервисов после сдачи ведёте вы|банковская карта"
          r"|registered (?:in|to|under) your name|accounts? (?:are |is )?(?:in|under) your name"
          r"|your own account|your (?:credit |bank )?card on file")
YURI = ["/terms", "/privacy", "/nda"]
for u in YURI + list(stranicy):
    tx = vidimyj(stranicy.get(u) or vzyat(u)[1])
    for m in re.finditer(NA_NAS, tx, re.I):
        beda(u, "«%s» — всё на нашей стороне, решение Андрея 25.09" % m.group(0))
print("  страниц проверено: %d" % (len(YURI) + len(stranicy)))

# ─────────────────────────────────────────────── SMS не обещаем
# Вердикт: кампанию на SMS не подаём — одно сообщение не туда стоит от $500 по TCPA. 25.09 английская
# /vera/ обещала «follow-up by email and text», а русская пара — «в переписке». Сверка пар ГОЛОСА смотрит
# вёрстку, а не смысл, поэтому обещание шире русского прошло незамеченным.
golo("SMS НЕ ОБЕЩАЕМ")
SMS = r"email and text|\bby text\b|\bvia text\b|text messag\w*|\btext (?:you|them|back)\b|\bSMS\b|\bсмс\b"
# Исключены ЯВНО, а не составом набора: на /sms обязательные формулировки оператора связи (7 совпадений
# по делу), в privacy/terms/nda — согласие на сообщения. Добавят их в общий список — правило не закричит (ГОЛОС, 25.09).
SMS_PO_DELU = {"/sms", "/privacy", "/terms", "/nda"}
for u in [a for a in list(stranicy) + ZVONKI if a.rstrip("/") not in SMS_PO_DELU]:
    tx = vidimyj(stranicy.get(u) or vzyat(u)[1])
    for m in re.finditer(SMS, tx, re.I):
        beda(u, "обещание SMS? «%s» — кампании на SMS у нас нет" % tx[max(0, m.start() - 40):m.end() + 20].strip())
print("  страниц проверено: %d" % (len(stranicy) + len(ZVONKI)))

# ─────────────────────────────────────────────── имена этапов для клиента (решение Андрея 25.09)
# Этапы Веры для клиента — «Администратор» и «Менеджер по продажам». Дежурный, Продавец, Доводчик — внутренние.
# ГОЛОС доложил «ноль», а на /zvonki/ остались «Связка сразу» и «голосовой дежурный» в ссылке назад.
# Обычные слова про чужие службы («дежурные операторы», «дежурная служба») — можно: регистр и соседнее слово важны.
golo("ИМЕНА ДЛЯ КЛИЕНТА")
VNUTR = r"\bДежурн\w*|голосово\w* дежурн\w*|\bПродав(?:ец|ца|цу|цом)\b|\bДоводчик\w*|надстройк\w*|\b[Сс]вязк\w*"
for u in [a for a in stranicy if a.startswith("/vera/")] + ZVONKI:
    tx = vidimyj(stranicy.get(u) or vzyat(u)[1])
    for m in re.finditer(VNUTR, tx):
        beda(u, "внутреннее имя для клиента: «%s»" % tx[max(0, m.start() - 30):m.end() + 20].strip())
print("  страниц проверено: %d" % (len([a for a in stranicy if a.startswith("/vera/")]) + len(ZVONKI)))

# ─────────────────────────────────────────────── подписку не называем «без автопродления»
# 25.09 ночью, сверено в Stripe: касса Веры — подписка ($1 000 разово + $199 каждый месяц сами), а страницы
# Веры обещали «без автопродления». Оферта 4.6 называет абонентку повторяющимся платежом. У видимости и
# диагностики разовые платежи — там эти слова правда, поэтому смотрим только страницы с подписочной кассой.
golo("ПОДПИСКА БЕЗ «БЕЗ АВТОПРОДЛЕНИЯ»")
PODPISKA = {"28E6oz3V6abMbPLbY7frW03", "eVqfZ92R23NoaLH1jtfrW07"}  # Вера EN/RU: recurring $199/мес
BEZ_AVTO = r"no auto.?renew\w*|без автопродлени\w*|ни автопродлени\w*"
s_podpiskoj = 0
for u, t in stranicy.items():
    if not PODPISKA & set(re.findall(r"buy\.stripe\.com/(\w+)", t or "")):
        continue
    s_podpiskoj += 1
    for m in re.finditer(BEZ_AVTO, vidimyj(t), re.I):
        beda(u, "«%s» — а касса здесь подписка, $199 списываются сами" % m.group(0))
print("  страниц с подписочной кассой: %d" % s_podpiskoj)
# 27.09 «да» Андрея: «$199 в месяц. Подписка продлевается автоматически. Отменить можно в любой момент.»
import html as _html
for u in ("/vera/", "/vera/ru/"):
    tx = _html.unescape(vidimyj(stranicy.get(u) or ""))     # &nbsp; и регистр не должны ломать проверку
    if not re.search(r"продлевается\s+автоматически|renews\s+automatically", tx, re.I):
        beda(u, "у цены нет «Подписка продлевается автоматически» (решение Андрея 27.09)")
    if not re.search(r"отменить\s+можно\s+в\s+любой\s+момент|cancel\s+(?:any\s*time|at\s+any\s+time)", tx, re.I):
        beda(u, "у цены нет «Отменить можно в любой момент» (решение Андрея 27.09)")
# 27.09 Андрей: «Дожимает письмами тех, кто не решил» — продукт досылает только письма (Telegram не подключён, SMS не обещаем)
for u, tt in stranicy.items():
    if re.search(r"дожимает\s+в\s+переписке", _html.unescape(vidimyj(tt or "")), re.I):
        beda(u, "«Дожимает в переписке» — канал не назван; решение Андрея 27.09: «Дожимает письмами тех, кто не решил»")

# ─────────────────────────────────────────────── замечания Андрея по лендингам, 26.09
# Каждая строка — его слово, сказанное вслух. Вернётся фраза — ревизия закричит.
golo("ЗАМЕЧАНИЯ АНДРЕЯ 26.09")
VERA = [u for u in stranicy if u.startswith("/vera/")]
LENDY = ["/vera/", "/vera/ru/", "/visibility/", "/visibility/ru/"]
PRODUKT = [u for u in stranicy if stranicy.get(u)]
ZAPRET_26 = [  # (где, выражение, почему)
    (VERA, r"пятнадцати минут|15 минут|four minutes|4 minutes", "демо — три минуты везде"),
    (VERA, r"[Уу]йти можно в любой\.|Leave any month", "строку «$1 000, дальше $199, уйти в любой» — убрать"),
    (VERA, r"[Тт]ам она не сможет предупредить|she cannot warn you", "абзац про время в «Попробовать» — убрать целиком"),
    (VERA, r"автопродлени\w*|auto-renewal", "Вера: слово «автопродление» не ставим — подписка звучит только строкой Андрея 27.09"),
    (VERA, r"[Мм]ежду вами и работой никого нет|nobody between you and the work", "фразу «никого нет» — убрать"),
    (VERA, r"[Пп]исьмо после звонка выше|post-call email shown above", "абзац в подвале — убрать"),
    (VERA, r"[Мм]ы дороже за три вещи|We cost more for three things", "«дороже за три вещи» — переписать"),
    (VERA, r"2[–-]4 недел\w*|2[–-]4 weeks|two to four weeks|через две-четыре недели", "второй этап — «по вашей готовности», не «2–4 недели» (Андрей 26.09)"),
    (LENDY, r"[Сс]озваниваться не обязательно|No call required", "«созваниваться не обязательно» — убрать"),
    (LENDY, r"[Дд]оплачивать ничего не нужно|[Nn]othing more to pay", "«доплачивать ничего не нужно» — убрать"),
    (LENDY, r"[Оо]на в подарок|it comes free", "просто «в подарок», без «она»"),
    # Видимость, 26.09: в розницу не продаём; замер — по протоколу v2 (7 повторов, 2 языка), решение 25.09 п. 7
    (["/visibility/", "/visibility/ru/"], r"[Вв]ыберите одну работу|pick one job", "в розницу не продаём — «одну работу» убрать"),
    (["/visibility/", "/visibility/ru/"], r"по три прогона|three runs each[^.]{0,40}(?:day|zero|ninety|measure)|двадцати семи до сорока пяти",
     "замер — семь повторов на двух языках (протокол v2), не «по три»"),
    # 26.09 ГОЛОС: замер — запросы к API, браузера нет, скриншоту взяться неоткуда
    (["/visibility/", "/visibility/ru/"], r"(?:разница|точк\w*|замер\w*)[^.]{0,30}со скриншотами|(?:difference|baseline|captured)[^.]{0,30}with screenshots",
     "скриншотов замер не делает — обещание убрать"),
    (["/visibility/", "/visibility/ru/"], r"[Кк]аждый движок гоняется по три раза|each engine (?:runs|is run) three times",
     "замер — семь повторов на двух языках, не «по три раза»"),
]
for gde, rx, pochemu in ZAPRET_26:
    for u in gde:
        for m in re.finditer(rx, vidimyj(stranicy.get(u) or "")):
            beda(u, "%s («%s»)" % (pochemu, m.group(0)))
# верхняя строка: знак, название, переходы — и каждый переход ведёт в свой раздел
for u in LENDY:
    t = stranicy.get(u) or ""
    shapka = re.search(r"(?is)<(header|nav)\b.*?</\1>", t)
    if not shapka:
        beda(u, "нет верхней строки с переходами"); continue
    perehody = re.findall(r'href="#([^"]+)"', shapka.group(0))
    if len(perehody) < 4:
        beda(u, "в верхней строке переходов %d — мало" % len(perehody))
    if "buy.stripe.com" not in shapka.group(0) and not re.search(r'class="[^"]*(?:cta|btn)', shapka.group(0)):
        beda(u, "в верхней строке нет кнопки CTA")
# подвал: оферта и политика на каждой странице продукта
for u in PRODUKT:
    podval = re.search(r"(?is)<footer\b.*?</footer>", stranicy[u])
    ssylki_p = podval.group(0) if podval else ""
    for nado in ("/terms", "/privacy"):
        if nado not in ssylki_p:
            beda(u, "в подвале нет ссылки %s" % nado)
# плашка Netlify — её вставляет сам Netlify, в исходниках её нет
for u in PRODUKT:
    if "/.netlify/scripts/hud" in stranicy[u]:
        beda(u, "Netlify вставляет свою плашку (hud?variant=public)")
print("  страниц проверено: %d" % len(PRODUKT))

# ─────────────────────────────────────────────── оферта = касса (решение Андрея 26.09)
# «$1 000 + $199 за первый месяц в день оплаты — всё верно; дальше списывается само». Оферта обещала
# первый платёж абонентки в день включения, а «оба этапа сразу» — с бесплатным первым месяцем, которого касса не даёт.
golo("ОФЕРТА = КАССА")
_, oferta = vzyat("/terms")
of = vidimyj(oferta)
for rx, pochemu in ((r"первый платёж\s*—\s*в день включения", "первый платёж абонентки — в день оплаты, не включения"),
                    (r"[Аа]бонентка начинается в день включения", "абонентка начинается с оплаты"),
                    (r"первый месяц абонентки бесплатн\w*|first month free", "бесплатного первого месяца касса не даёт")):
    for m in re.finditer(rx, of):
        beda("/terms", "%s («%s»)" % (pochemu, m.group(0)))
for m in re.finditer(VNUTR if "VNUTR" in dir() else r"$^", of):
    beda("/terms", "внутреннее имя в оферте: «%s»" % of[max(0, m.start() - 30):m.end() + 20].strip())
for m in re.finditer(r"The Responder|The Seller", of):
    beda("/terms", "внутреннее имя в оферте: «%s»" % m.group(0))
print("  оферта проверена")

# ─────────────────────────────────────────────── касса на языке страницы
# 26.09 ГОЛОС нашёл: русская «спасибо» видимости вела на английскую кассу (…frW05 вместо …frW08).
# Правило выше считало РАЗНЫЕ кассы, а не то, что касса совпадает с языком страницы.
golo("КАССА НА ЯЗЫКЕ СТРАНИЦЫ")
KASSA_RU = {"eVqfZ92R23NoaLH1jtfrW07": "Вера", "bJe00b8bm83E7zv2nxfrW08": "видимость"}
KASSA_EN = {"28E6oz3V6abMbPLbY7frW03": "Вера", "cNi8wHdvG4RsbPLe6ffrW05": "видимость"}
for u in PRODUKT:
    ru = "/ru/" in u
    for s in set(re.findall(r"buy\.stripe\.com/(\w+)", stranicy[u])):
        if ru and s in KASSA_EN:
            beda(u, "русская страница ведёт на английскую кассу (%s, …%s)" % (KASSA_EN[s], s[-5:]))
        if not ru and s in KASSA_RU:
            beda(u, "английская страница ведёт на русскую кассу (%s, …%s)" % (KASSA_RU[s], s[-5:]))
print("  страниц проверено: %d" % len(PRODUKT))

# ─────────────────────────────────────────────── под каждой кнопкой оплаты — звонок (Андрей, 27.09)
golo("ПОД КНОПКОЙ ОПЛАТЫ — ЗАБРОНИРОВАТЬ ЗВОНОК")
s_knopkami = 0
for u in [a for a in stranicy if re.match(r"^/(vera|visibility|diagnostic)/(ru/)?$", a)]:
    t0 = stranicy.get(u) or ""
    for m in re.finditer(r'<a[^>]+href="https://buy\.stripe\.com/[^"]+"', t0):
        s_knopkami += 1
        # 27.09 уточнение Андрея: сначала почта, потом Calendly — элемент с классом zvonok-zapis
        if "zvonok-zapis" not in t0[m.end():m.end() + 1500]:
            beda(u, "под кнопкой оплаты нет «Забронируйте звонок» (форма с почтой → Calendly, класс zvonok-zapis)")
print("  кнопок оплаты проверено: %d" % s_knopkami)

# ─────────────────────────────────────────────── окно 29.09 (Андрей: «Да, исправляй все три вечером»)
# Главная — к нынешней линейке; диагностика без «первым десяти» и зачёта (теперь подарок к Вере и кварталу);
# на Вере ни внутренней арифметики в исходнике, ни «проверки чужих ботов»; видимость — новый сайт, не одна страница.
golo("ОКНО 29.09: ГЛАВНАЯ, ДИАГНОСТИКА, ВЕРА, ВИДИМОСТЬ")
_, glav_ru = vzyat("/")
_, glav_en = vzyat("/en/")
for u, tt, nado in (("/", glav_ru, ("/vera/ru/", "/visibility/ru/", "/diagnostic/ru/")),
                    ("/en/", glav_en, ("/vera/", "/visibility/", "/diagnostic/"))):
    if not tt:
        beda(u, "главная не отдаётся")
        continue
    for h in nado:
        if 'href="%s"' % h not in tt:
            beda(u, "на главной нет ссылки на %s" % h)
    if re.search(r"""href=["']/(?:expert|business)/["']""", tt):
        beda(u, "главная снова ведёт в старую воронку «эксперт или бизнес»")
DIAG = ["/diagnostic/", "/diagnostic/ru/", "/diagnostic/paid/", "/diagnostic/ru/paid/"]
OKNO_29 = [  # (где, выражение, почему)
    (DIAG, r"FIRST10|[Пп]ервым (?:десяти|10)\b|[Ff]ree for the first ten", "«первым десяти бесплатно» убрано — диагностика в подарок к Вере и кварталу"),
    (DIAG, r"зач[её]тся|засчитыва\w*|credited against|\$\s?2[  ,]000", "зачёт диагностики убран — теперь подарок"),
    (DIAG, r"[Сс]писок из семи|list of seven", "пунктов в документе шесть"),
    (DIAG, r"[Сс]ессия сорок|session runs|booking link|ссылкой на запись", "диагностика без созвона (решение 24.09)"),
    (DIAG, r"приёмка телефонной линии|phone line audit|голосов\w* дежурн\w*|voice receptionist", "старая линейка (приёмка, «дежурный»)"),
    ([u for u in stranicy if u.startswith("/vera/")], r"проверку чужих ботов|audits of other people", "проверку чужих ботов отдельно не продаём"),
    (["/visibility/", "/visibility/ru/"], r"одну страницу, которую|single page engines|[Сс]траница, которую читают|A page engines",
     "видимость: с согласия проверяем сайт, дорабатываем или делаем новый (Андрей 29.09)"),
]
for gde, rx, pochemu in OKNO_29:
    for u in gde:
        for m in re.finditer(rx, vidimyj(stranicy.get(u) or "")):
            beda(u, "%s («%s»)" % (pochemu, m.group(0)))
for u, tt in list(stranicy.items()) + [("/", glav_ru), ("/en/", glav_en)]:
    if re.search(r"239[.,]80|назначенных Андреем", tt or ""):
        beda(u, "в исходнике страницы внутренняя арифметика комиссии партнёра")
# Проверка черновика 29.09 нашла то же самое на /zvonki/: зачёт диагностики «в первый платёж
# за внедрение» (и в разметке FAQPage), а шесть страниц обещали «без автопродления» при кассе-подписке.
# Правило про подписку выше смотрит только страницы с кассой — у /zvonki/ кассы нет, и оно молчало.
zv = {u: (stranicy.get(u) or vzyat(u)[1]) for u in ZVONKI}
for u, tt in zv.items():
    for rx, pochemu in ((r"засчитыва\w*|зач[её]тся|первый платёж за внедрение",
                         "зачёт диагностики убран — к Вере и кварталу видимости в подарок"),
                        (BEZ_AVTO, "Вера — подписка, продлевается автоматически (Андрей 27.09)")):
        # и видимый текст, и разметка FAQPage: её читают нейросети
        for m in re.finditer(rx, _html.unescape(tt or ""), re.I):
            beda(u, "%s («%s»)" % (pochemu, m.group(0)))
# llms.txt и карта сайта — нынешняя линейка; старая воронка под noindex и из них убрана.
_, llms_t = vzyat("/llms.txt")
_, karta_t = vzyat("/sitemap.xml")
for m in re.finditer(r"ДЕЖУРН\w*|ДОВОДЧИК\w*|ДОГОНЯЮЩ\w*|РАССКАЗЧИК\w*|СБОРЩИК\w*|СМОТРИТЕЛ\w*"
                     r"|voice receptionist|цифров\w* сотрудник\w*|AI employees", llms_t or ""):
    beda("/llms.txt", "старая линейка или внутреннее имя: «%s»" % m.group(0))
for imya, tt in (("/llms.txt", llms_t), ("/sitemap.xml", karta_t)):
    for m in re.finditer(r"businessinteldna\.com/(?:business|expert)\b[^\s\"<)]*", tt or ""):
        beda(imya, "ведёт на старую воронку: %s" % m.group(0))
for u in ("/business/", "/expert/", "/business/en", "/expert/en", "/business/list", "/expert/list"):
    k, tt = vzyat(u)
    if k == 200 and not re.search(r'<meta name="robots" content="[^"]*noindex', tt):
        beda(u, "старая воронка без noindex — нейросети читают отменённые условия")
# Рабочие заметки в <style>: «правки Андрея», «Замер 26.09» и т.п. Метки вставок (KNOPKI-NAZHIM,
# PODPISKA) — одно слово латиницей заглавными, они нужны сборке.
for u, tt in list(stranicy.items()) + list(zv.items()) + [("/", glav_ru), ("/en/", glav_en)]:
    for st in re.findall(r"<style\b[^>]*>(.*?)</style>", tt or "", re.S):
        for m in re.finditer(r"/\*.*?\*/", st, re.S):
            if not re.fullmatch(r"/\*\s*[A-Z][A-Z0-9_-]*\s*\*/", m.group(0)):
                beda(u, "рабочий комментарий в исходнике: «%s»" % re.sub(r"\s+", " ", m.group(0))[:60])
print("  страниц проверено: %d" % (len(stranicy) + len(zv) + 2))

golo("ИТОГ")
if not bed:
    print("  ЧИСТО. Ревизия прошла без единой находки.")
else:
    print("  НАХОДОК: %d" % len(bed))
    for gde, chto in bed:
        print("   · %-30s %s" % (gde, chto))
sys.exit(1 if bed else 0)
