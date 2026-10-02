# -*- coding: utf-8 -*-
"""Сборка ОДНОГО сайта под домен businessinteldna.com:
   /  и /en/    — главная: Вера · видимость · диагностика (с 29.09; до того — выбор эксперт / бизнес)
   /business/*  — старая воронка для владельца бизнеса (с 29.09 noindex, вне карты сайта и llms.txt)
   /expert/*    — старая воронка для эксперта (так же)
Внутри разделов файлы переименованы в короткие имена, ссылки переписаны."""
import datetime, json, os, re, shutil, sys
BRAND = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "brand")
sys.path.insert(0, os.path.join(BRAND, "_src"))
from inline import inline, favicon_uri
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import en_build

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))          # корень проекта
L    = os.path.join(ROOT, "landings")
P    = os.path.join(ROOT, "presentations")
OUT  = sys.argv[1]

# Шесть страниц /zvonki/ собирает shtab/sayty/zvonki.py. Адреса берём ОТТУДА же,
# чтобы карта сайта и llms.txt не разъехались с тем, что реально собралось.
sys.path.insert(0, os.path.join(ROOT, "shtab", "sayty"))
import zvonki
import vidimost  # семь страниц /vidimost/ и /kejs/ (01.10)

MARK = inline("mark/dna-mark-compact-reverse.svg")

# Netlify на бесплатном тарифе подмешивает поверх страницы iframe «Powered by Netlify».
# В исходнике его нет — вставляется на лету скриптом /.netlify/scripts/hud.
# Решение Андрея (04.09): прятать. Уйдёт само, если проект переведут на платный план.
NO_BADGE = '<style>#nl-badge-frame,iframe[title="Powered by Netlify"]{display:none!important}</style>'

def zapret_indeksacii(t, imya):
    """Метка noindex в <head>. Падаем, если вставить некуда: тихо отдать анкету
    в индекс хуже, чем не собрать сайт."""
    if 'name="robots"' in t:
        return t
    novy = t.replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
    if 'name="robots"' not in novy:
        raise SystemExit("  ! %s: не нашёл <head>, запрет индексации не встал" % imya)
    return novy


def staraya_voronka(t, imya):
    """noindex на всё, что лежит в /business/ и /expert/ (29.09).
    С главной туда больше не ведём, а на страницах — прежняя линейка: «первым десяти
    бесплатно», зачёт диагностики, созвон на час. Нейросеть, прочитав их, называла бы
    клиенту то, чего мы уже не продаём, — ровно против видимости, которую мы продаём.
    Страницы НЕ удаляем: на анкеты ведёт «оплачено» новой диагностики, а по старым
    письмам люди приходят прямо сюда. Ссылки по ним ходить не мешаем (follow).
    У квизов нет ни <head>, ни <body> — ставим сразу за charset."""
    if 'name="robots"' in t:
        return t
    meta = '<meta name="robots" content="noindex">'
    if "<head>" in t:
        novy = t.replace("<head>", "<head>\n" + meta, 1)
    elif re.search(r'<meta charset="[^"]*">', t):
        novy = re.sub(r'(<meta charset="[^"]*">)', r"\1\n" + meta, t, count=1)
    else:
        raise SystemExit("  ! %s: некуда поставить noindex — старая страница ушла бы в индекс" % imya)
    return novy


def strip_badge(t):
    if "</head>" in t:
        return t.replace("</head>", NO_BADGE + "\n</head>", 1)
    if "<body" in t:                      # у квизов нет закрывающего </head>
        i = t.index("<body")
        return t[:i] + NO_BADGE + "\n" + t[i:]
    return NO_BADGE + "\n" + t
FAV  = ('<link rel="icon" href="%s">\n<link rel="icon" href="%s" media="(prefers-color-scheme: dark)">'
        % (favicon_uri("icon/favicon.svg"), favicon_uri("icon/favicon-dark.svg")))

SEG = {
  # dop — файлы, которые просто копируются в раздел как есть. Английская анкета лежит
  # здесь же, в landings/, и едет вместе с остальным: отдельная копия руками потерялась бы
  # на первой же выкатке. Форма и ключ хранения у неё СВОИ (intake-business-en,
  # bidna_intake_business_en) — иначе английские ответы падали бы в русскую корзину Netlify,
  # а человек видел бы в браузере чужие ответы: домен-то общий.
  "business": dict(src="biznes",  anketa="anketa-b-7k3m9x.html", deck="biznes.html",
                   dop=["intake-b-9f2r5t.html"]),
  "expert":   dict(src="ekspert", anketa="anketa-e-4q8v2n.html", deck="ekspert.html"),
}

def build_section(seg, cfg):
    d = os.path.join(OUT, seg); os.makedirs(os.path.join(d, "img"), exist_ok=True)
    s = cfg["src"]
    # (откуда, куда)
    pairs = [(f"{s}.html","index.html"), (f"zerkalo-{s}.html","zerkalo.html"),
             (f"list-{s}.html","list.html"),
             (f"quiz-{s}.html","quiz.html"),
             (f"oplata-{s}.html","oplata.html"), (f"spasibo-{s}.html","spasibo.html"),
             (f"intake-{s}.html","intake.html"), (cfg["anketa"], cfg["anketa"])]
    pairs += [(f, f) for f in cfg.get("dop", [])]
    # внутри раздела ссылки становятся короткими
    ren = {f"zerkalo-{s}.html":"zerkalo.html", f"list-{s}.html":"list.html", f"quiz-{s}.html":"quiz.html", f"oplata-{s}.html":"oplata.html",
           f"spasibo-{s}.html":"spasibo.html", f"intake-{s}.html":"intake.html"}
    for src, dst in pairs:
        t = open(os.path.join(L, src), encoding="utf-8").read()
        for a, b in ren.items():
            t = t.replace(f'href="{a}"', f'href="{b}"').replace(f'"{a}"', f'"{b}"')
        if dst == "index.html":
            # Английская версия собирается ПОСЛЕ переименования ссылок и кладётся плоско
            # как en.html — тогда list.html, oplata.html и img/ разрешаются из того же
            # каталога и переписывать пути не нужно.
            en, miss = en_build.build_en(t, seg)
            if miss:
                print(f"    ! /{seg}/en — без перевода: {len(miss)}")
                for x in miss[:5]:
                    print(f"      · {x}")
            open(os.path.join(d, "en.html"), "w", encoding="utf-8").write(
                strip_badge(staraya_voronka(en, seg + "/en.html")))
            t = en_build.link_to_en(en_build.add_hreflang_ru(t, seg))
        # Анкеты прячутся неугадываемым адресом, а это везение, не политика: ClaudeBot
        # к нам уже приходил. В robots.txt их вписывать НЕЛЬЗЯ — этим публикуется сам
        # адрес, который их и прячет. Только метка на странице (решение Андрея 23.09).
        if any(k in dst for k in ("anketa-", "intake-b-", "intake-e-")):
            t = zapret_indeksacii(t, dst)
        t = staraya_voronka(t, "%s/%s" % (seg, dst))
        open(os.path.join(d, dst), "w", encoding="utf-8").write(strip_badge(t))
    deck = open(os.path.join(P, cfg["deck"]), encoding="utf-8").read()
    deck = staraya_voronka(deck, seg + "/presentation.html")
    open(os.path.join(d, "presentation.html"), "w", encoding="utf-8").write(strip_badge(deck))
    for i in ("andrii-office","couple-selfie","founders","julia-desk","masha-podium"):
        shutil.copy(os.path.join(L, "img", i + ".webp"), os.path.join(d, "img", i + ".webp"))
    return len(os.listdir(d)) - 1 + 5

# Главная — нынешняя линейка: Вера · видимость · диагностика (решение Андрея 29.09,
# «исправляй все три вечером»). До 29.09 здесь стоял выбор «эксперт или бизнес» — он вёл
# в старую воронку, которой больше не продаём. /business/ и /expert/ живут дальше по прямым
# ссылкам (там анкеты оплативших), но с главной на них не ведём.
# Одна разметка на два языка: русская в корне, английская в /en/. Так пара не разъедется —
# текст в словаре, вёрстка одна.
GLAVNAYA = {
  "ru": dict(
    lang="ru", put="/", para="/en/", para_yaz="en", para_nadpis="English",
    title="Business Intelligence DNA — Вера, видимость в нейросетях, глубокая диагностика",
    opisanie="Вера — ИИ-администратор и продавец на ваших звонках. Видимость — делаем так, чтобы нейросети называли ваш бизнес. Глубокая диагностика — где вы теряете клиентов.",
    h1="Берём ваши звонки и делаем так, чтобы нейросети вас называли",
    sub="Три вещи для владельца бизнеса. Каждую можно взять отдельно. Вслепую не ставим: не знаете, где теряете клиентов, — начните с диагностики.",
    karty=[
      dict(href="/vera/ru/", k="ИИ-администратор и продавец", h="Вера",
           p="Берёт трубку на второй секунде, отвечает по вашему прайсу и записывает в ваш календарь. На втором этапе продаёт и дожимает письмами тех, кто не решил. Номер остаётся ваш. Доделываем и включаем в Веру без доплаты: ответ за минуту на заявки с вашего сайта и просьбу об отзыве в Google после визита.",
           cena="Запуск $1&nbsp;000 + $199 в месяц, подписка", go="Открыть →"),
      dict(href="/visibility/ru/", k="Видимость в нейросетях", h="Ваше имя в ответе",
           p="Делаем так, чтобы ChatGPT и другие нейросети называли ваш бизнес, когда спрашивают, к кому обратиться. С вашего согласия проверяем сайт и дорабатываем, а если он не годится — делаем новый. Не назвал ни один движок — возвращаем всё до доллара.",
           cena="$1&nbsp;500 за квартал вперёд", go="Бесплатно за 30 секунд →"),
      dict(href="/diagnostic/ru/", k="Глубокая диагностика", h="Где вы теряете клиентов",
           p="Для случая, когда болит везде или непонятно где. Разбор вашего дела по открытым источникам и вашим ответам. Документ за три рабочих дня: где вы теряете клиентов и какой рычаг трогать первым.",
           cena="$500 · к Вере и к кварталу видимости — в подарок", go="Открыть →"),
    ],
    tel="+1 424 781 1913", tel_href="+14247811913",
    tel_txt="Позвоните Вере прямо сейчас, это тот самый агент, а не запись",
    tel_sub="Русская линия · до трёх минут · ничего заполнять не надо",
    bloki=[
      ("Кто мы",
       "<p>Business Intelligence DNA — Андрей и Маша, Wealthboosterpro LLC, Каспер, Вайоминг. Андрей — предприниматель с тридцатилетним опытом: финансовый холдинг, налоговая оптимизация корпораций, стратегия. Маша — экс-CFO крупной корпорации: психология клиента, переговоры, доведение до конца. Работаем с владельцами бизнеса в США по-русски и по-английски.</p>"),
      ("Как мы работаем",
       "<ul><li><b>Вслепую не ставим.</b> Не знаете, где теряете клиентов, — начните с глубокой диагностики. Знаете — берите нужную работу.</li>"
       "<li><b>Проверить до оплаты.</b> Вере можно позвонить прямо сейчас. По видимости — бесплатная проверка за 30 секунд: видно, кого нейросети называют вместо вас.</li>"
       "<li><b>Деньги и доступы.</b> Работаем под NDA. Доступа к вашим деньгам, счетам и базе клиентов не просим.</li>"
       "<li><b>Что обещаем и что нет.</b> Ни процента роста, ни количества заявок, ни срока окупаемости. По видимости: если после квартала вас устойчиво не назвала ни одна нейросеть, возвращаем все $1&nbsp;500.</li></ul>"),
      ("Кому это нужно",
       "<p>Владельцу небольшого бизнеса в США, который сам берёт трубку, теряет звонки на объекте, вечером и в выходные и видит, что покупатели всё чаще спрашивают ChatGPT, к кому обратиться, — а его в ответе нет.</p>"),
      ("Почитать перед решением",
       "<ul><li><a href=\"/zvonki/poka-rabotayu/\">Кто ответит на звонки, пока вы работаете</a></li>"
       "<li><a href=\"/zvonki/po-russki/\">Кто ответит на звонки по-русски</a></li>"
       "<li><a href=\"/vidimost/chatgpt-nazyval/\">Кто в США сделает так, чтобы ChatGPT называл вашу компанию</a></li>"
       "<li><a href=\"/vidimost/cena/\">Сколько стоит продвижение в AI-поиске</a></li>"
       "<li><a href=\"/kejs/yulia-remote-cfo/\">Кейс: Julia Dospehoff, Remote CFO, Тампа</a></li></ul>"),
    ],
    niz="Вслепую не ставим · Работаем под NDA · Андрей и Маша",
    yur=("Условия", "Конфиденциальность", "Контакты", "Сообщения"),
  ),
  "en": dict(
    lang="en", put="/en/", para="/", para_yaz="ru", para_nadpis="Русский",
    title="Business Intelligence DNA — Vera, AI visibility, deep diagnostic",
    opisanie="Vera, an AI receptionist and sales rep on your phone line. Visibility: we get AI assistants to name your business. Deep diagnostic: where you lose customers.",
    h1="We answer your calls and get AI assistants to name you",
    sub="Three things for a business owner. Each one can be bought on its own. We don't install AI blindly: if you can't tell where you lose customers, start with the diagnostic.",
    karty=[
      dict(href="/vera/", k="AI receptionist and sales rep", h="Vera",
           p="Picks up on the second ring, answers from your own price list and books into your calendar. At stage two she sells and follows up by email with anyone undecided. Your number stays yours. Coming soon, included in Vera at no extra cost: a reply within a minute to inquiries from your website, and a Google review request after each visit.",
           cena="Setup $1,000 + $199 a month, subscription", go="Open →"),
      dict(href="/visibility/", k="Visibility in AI answers", h="Your name in the answer",
           p="We get ChatGPT and other AI assistants to name your business when people ask who to hire. With your consent we check your site and improve it, and if it can't be saved, we build a new one. If not one engine names you, you get every dollar back.",
           cena="$1,500 per quarter, paid upfront", go="Free check in 30 seconds →"),
      dict(href="/diagnostic/", k="Deep diagnostic", h="Where you lose customers",
           p="For when everything hurts at once or you can't tell where. A study of your business from open sources and your own answers. A document in three working days: where you lose customers and which lever to pull first.",
           cena="$500 · free with Vera or a quarter of visibility", go="Open →"),
    ],
    tel="+1 424 724 4202", tel_href="+14247244202",
    tel_txt="Call Vera right now. It is the real agent, not a recording",
    tel_sub="English line · up to three minutes · nothing to fill in",
    bloki=[
      ("Who we are",
       "<p>Business Intelligence DNA is Andrii and Masha, Wealthboosterpro LLC, Casper, Wyoming. Andrii is an entrepreneur with thirty years of experience: a financial holding, corporate tax optimization, strategy. Masha is a former CFO of a large corporation: client psychology, negotiation, getting things finished. We work with business owners in the US in English and Russian.</p>"),
      ("How we work",
       "<ul><li><b>We don't install AI blindly.</b> If you can't tell where you lose customers, start with the deep diagnostic. If you can, take the work you need.</li>"
       "<li><b>Check before you pay.</b> Call Vera right now. For visibility, a free 30-second check shows who AI assistants name instead of you.</li>"
       "<li><b>Money and access.</b> We work under NDA. We never ask for access to your money, accounts or customer base.</li>"
       "<li><b>What we promise and what we don't.</b> No growth percentage, no lead count, no payback date. For visibility: if after the quarter not one AI engine names you consistently, you get the full $1,500 back.</li></ul>"),
      ("Who it's for",
       "<p>An owner of a small US business who answers the phone themselves, misses calls on the job, in the evening and on weekends, and notices that customers increasingly ask ChatGPT who to hire, and their name isn't in the answer.</p>"),
      ("Read before you decide",
       "<ul><li><a href=\"/vera/\">Vera: AI receptionist and sales rep</a></li>"
       "<li><a href=\"/visibility/\">Visibility: your name in AI answers</a></li>"
       "<li><a href=\"/diagnostic/\">Deep diagnostic: where you lose customers</a></li></ul>"),
    ],
    niz="We don't install AI blindly · Under NDA · Andrii and Masha",
    yur=("Terms", "Privacy", "Contacts", "Messaging"),
  ),
}

GLAVNAYA_CSS = """<style>
:root{--navy:#1b2557;--navy-deep:#0f1430;--gold:#c69a4c;--gold-soft:#e3c88a;--cream:#f5f3ee;
--sans:'Inter',-apple-system,Segoe UI,Roboto,sans-serif;--serif:'Playfair Display',Georgia,serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
 padding:40px 20px;font-family:var(--sans);color:#fff;background-color:#0f1430;
 background-image:radial-gradient(1100px 600px at 50% -10%,#232f6b 0%,#1b2557 42%,#0f1430 100%)}
.verh{width:100%;max-width:1040px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:34px}
.logo{display:flex;align-items:center;gap:11px}
.logo .mark{height:40px;width:auto;display:block;flex:none}
.logo b{font-weight:700;font-size:17px;letter-spacing:.02em}
.logo .g{color:var(--gold-soft)}
a.yaz{color:#c3c9e6;font-size:15px;text-decoration:none;border:1px solid rgba(255,255,255,.22);border-radius:22px;
 padding:0 16px;min-height:44px;display:inline-flex;align-items:center}
a.yaz:hover{border-color:var(--gold);color:#fff}
h1{font-family:var(--serif);font-weight:600;font-size:clamp(28px,4.4vw,44px);line-height:1.15;
 margin:0 0 14px;text-align:center;max-width:27ch}
.sub{color:#c3c9e6;font-size:17px;line-height:1.5;text-align:center;margin:0 0 40px;max-width:60ch}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;width:100%;max-width:1040px}
a.card{display:flex;flex-direction:column;text-decoration:none;color:#fff;background:rgba(255,255,255,.055);
 border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:28px 26px;transition:.18s}
a.card:hover{background:rgba(255,255,255,.09);border-color:var(--gold);transform:translateY(-2px)}
a.card .k{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft);font-weight:600}
a.card h2{font-family:var(--serif);font-weight:600;font-size:25px;margin:10px 0 10px}
a.card p{color:#c3c9e6;font-size:15.5px;line-height:1.55;margin:0 0 16px}
a.card .cena{color:#fff;font-weight:600;font-size:15px;margin-top:auto;padding-top:6px}
a.card .go{color:var(--gold-soft);font-weight:600;font-size:15px;margin-top:12px}
.foot{margin-top:36px;color:#9aa2c4;font-size:14px;text-align:center}
.foot a{color:#c3c9e6}
a.tel{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:30px;width:100%;max-width:1040px;
 text-decoration:none;color:#fff;border:1px solid var(--gold);border-radius:18px;padding:20px 22px;background:rgba(198,154,76,.08)}
a.tel span{color:#c3c9e6;font-size:15.5px;text-align:center}
a.tel b{font-family:var(--serif);font-size:clamp(26px,3.6vw,34px);color:var(--gold-soft);letter-spacing:.02em}
a.tel small{color:#9aa2c4;font-size:13.5px;text-align:center}
a.tel:hover{background:rgba(198,154,76,.15)}
.blok{width:100%;max-width:820px;margin-top:40px}
.blok h2{font-family:var(--serif);font-weight:600;font-size:26px;margin:0 0 12px;color:#fff}
.blok p,.blok li{color:#c3c9e6;font-size:16.5px;line-height:1.6}
.blok p{margin:0}
.blok ul{margin:0;padding-left:20px}
.blok li{margin:0 0 8px}
.blok b{color:#fff}
.blok a{color:var(--gold-soft)}
.blok a:hover{color:#fff}
@media(max-width:900px){.cards{grid-template-columns:1fr;max-width:560px}}
@media(max-width:640px){.foot a{display:inline-block;padding:14px 0}.sub{font-size:16px}a.card p{font-size:16px}}
</style>"""


def glavnaya(yaz):
    """Главная на одном языке. Вёрстка общая, текст из GLAVNAYA."""
    d = GLAVNAYA[yaz]
    dom = "https://businessinteldna.com"
    karty = "".join(
        '    <a class="card" href="%(href)s">\n'
        '      <div class="k">%(k)s</div>\n'
        '      <h2>%(h)s</h2>\n'
        '      <p>%(p)s</p>\n'
        '      <span class="cena">%(cena)s</span>\n'
        '      <span class="go">%(go)s</span>\n'
        '    </a>\n' % k for k in d["karty"])
    yur = d["yur"]
    bloki_html = "".join('  <section class="blok"><h2>%s</h2>%s</section>\n' % b for b in d["bloki"])
    org = json.dumps({"@context": "https://schema.org", "@type": "Organization",
                      "name": "Business Intelligence DNA", "legalName": "Wealthboosterpro LLC",
                      "url": dom + "/", "telephone": d["tel"],
                      "address": {"@type": "PostalAddress", "streetAddress": "5830 E 2nd St Ste 7000",
                                  "addressLocality": "Casper", "addressRegion": "WY",
                                  "postalCode": "82609", "addressCountry": "US"},
                      "description": d["opisanie"]}, ensure_ascii=False)
    return ("""<!doctype html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(opisanie)s">
<link rel="canonical" href="%(dom)s%(put)s">
<link rel="alternate" hreflang="ru" href="%(dom)s/">
<link rel="alternate" hreflang="en" href="%(dom)s/en/">
<link rel="alternate" hreflang="x-default" href="%(dom)s/">
""" % dict(d, dom=dom)) + '<script type="application/ld+json">' + org + '</script>\n' + FAV + """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
""" + GLAVNAYA_CSS + """
</head>
<body>
  <div class="verh"><div class="logo">""" + MARK + """<b>Business Intelligence <span class="g">DNA</span></b></div>
  <a class="yaz" href="%(para)s" hreflang="%(para_yaz)s" lang="%(para_yaz)s">%(para_nadpis)s</a></div>
  <h1>%(h1)s</h1>
  <p class="sub">%(sub)s</p>
  <div class="cards">
""" % d + karty + """  </div>
  <a class="tel" href="tel:%(tel_href)s"><span>%(tel_txt)s</span><b>%(tel)s</b><small>%(tel_sub)s</small></a>
""" % d + bloki_html + """
  <div class="foot">%(niz)s · <a href="https://t.me/business_int_dna" target="_blank" rel="noopener">Telegram</a></div>
""" % d + """  <div class="foot" style="margin-top:6px;font-size:12px;opacity:.7;line-height:44px">© 2026 Wealthboosterpro LLC (DBA Business Intelligence DNA) · 5830 E 2nd St Ste 7000, Casper, WY 82609 · <a style="display:inline-block;min-height:44px;line-height:44px" href="mailto:support@businessinteldna.com">support@businessinteldna.com</a> · <a style="display:inline-block;min-height:44px;min-width:44px;line-height:44px;text-align:center" href="/terms">%s</a> · <a style="display:inline-block;min-height:44px;min-width:44px;line-height:44px;text-align:center" href="/privacy">%s</a> · <a style="display:inline-block;min-height:44px;min-width:44px;line-height:44px;text-align:center" href="/contacts">%s</a> · <a style="display:inline-block;min-height:44px;min-width:44px;line-height:44px;text-align:center" href="/sms">%s</a></div>
</body>
</html>
""" % yur


ROBOTS = """User-agent: *
Allow: /

Sitemap: https://businessinteldna.com/sitemap.xml
"""
# CCBot и прочих намеренно НЕ закрываем: мы продаём видимость у ассистентов,
# закрываться от краулеров, которые их кормят, — против собственного продукта.

# /business/* и /expert/* из карты сайта убраны 29.09: это старая линейка, страницы стоят
# под noindex (см. staraya_voronka), а карта, которая зовёт поисковик на noindex, спорит сама с собой.

# Четыре продукта, английская основная, русская в /ru. Страницы «спасибо» и «оплачено»
# в карту не идут: это шаги воронки, их незачем показывать поисковику и нейросети.
# Приёмка закрыта как отдельный продукт (решение Андрея 24.09) — из карты сайта убрана.
# Страницы при этом продолжают СОБИРАТЬСЯ: под /call-audit/ живёт лист правды,
# он обещан письмами пятнадцати компаниям. PRODUKTY правит только sitemap.
PRODUKTY = ["visibility", "vera", "diagnostic"]


def sitemap():
    day = datetime.date.today().isoformat()
    # Главная — пара: русская в корне, английская в /en/. В карте — с той же парой ссылок,
    # что стоит в самих страницах, иначе карта и страница говорят о языках разное.
    para = ('<xhtml:link rel="alternate" hreflang="ru" href="https://businessinteldna.com/"/>'
            '<xhtml:link rel="alternate" hreflang="en" href="https://businessinteldna.com/en/"/>'
            '<xhtml:link rel="alternate" hreflang="x-default" href="https://businessinteldna.com/"/>')
    rows = "".join(
        f'  <url><loc>https://businessinteldna.com{u}</loc><lastmod>{day}</lastmod>{para}</url>\n'
        for u in ("/", "/en/"))
    alts = ""
    for pr in PRODUKTY:
        alts += (f'  <url><loc>https://businessinteldna.com/{pr}/</loc>'
                 f'<lastmod>{day}</lastmod>'
                 f'<xhtml:link rel="alternate" hreflang="en" href="https://businessinteldna.com/{pr}/"/>'
                 f'<xhtml:link rel="alternate" hreflang="ru" href="https://businessinteldna.com/{pr}/ru/"/>'
                 f'</url>\n')
        alts += (f'  <url><loc>https://businessinteldna.com/{pr}/ru/</loc>'
                 f'<lastmod>{day}</lastmod>'
                 f'<xhtml:link rel="alternate" hreflang="ru" href="https://businessinteldna.com/{pr}/ru/"/>'
                 f'<xhtml:link rel="alternate" hreflang="en" href="https://businessinteldna.com/{pr}/"/>'
                 f'</url>\n')
    for u, _t in zvonki.spisok() + vidimost.spisok():
        alts += (f'  <url><loc>https://businessinteldna.com{u}</loc>'
                 f'<lastmod>{day}</lastmod></url>\n')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + rows + alts + "</urlset>\n")


# llms.txt — то, что нейросеть читает о нас первым. С 29.09 — нынешняя линейка из трёх вещей,
# как на главной. Внутренних имён (ДЕЖУРНЫЙ, ДОВОДЧИК и прочие) здесь быть не должно: для клиента
# этапы Веры — «администратор» и «менеджер по продажам». Старые /business/ и /expert/ не упоминаем —
# они под noindex. Цены — ровно как на страницах продуктов, цифр результата нет.
LLMS = """# Business Intelligence DNA

> Три вещи для владельцев бизнеса в США. Вера — ИИ-администратор и продавец на ваших звонках.
> Видимость — делаем так, чтобы нейросети называли ваш бизнес. Глубокая диагностика — где вы
> теряете клиентов. Каждую можно взять отдельно. Вслепую не ставим: не знаете, где теряете
> клиентов, — начните с диагностики. Ведут двое, Андрей и Маша: предприниматель и экс-CFO.
> Работаем под NDA.
>
> Three things for business owners in the US. Vera, an AI receptionist and sales rep on your
> phone line. Visibility: we get AI assistants to name your business. A deep diagnostic of where
> you lose customers. Each one can be bought on its own. We don't install AI blindly: if you
> can't tell where you lose customers, start with the diagnostic. Run by two people, Andrii and
> Masha: an entrepreneur and a former CFO. Under NDA.

## Три вещи, каждая отдельно / Three things, each sold on its own

Главная: https://businessinteldna.com/ (русский) · https://businessinteldna.com/en/ (English).
У страниц продуктов английская версия в корне, русская — в /ru/.
Product pages: English at the root, Russian under /ru/.

- **«Вера» — ИИ-администратор и продавец / Vera, AI receptionist and sales rep.**
  Этап 1, администратор: запуск $1,000 + $199 в месяц. $199 в месяц — подписка, продлевается
  автоматически, отменить можно в любой момент; первый месяц оплачивается вместе с запуском.
  1,000 минут разговоров в месяц, сверх — $0.25 за минуту. Отвечает на входящие звонки
  круглосуточно по вашему прайсу, записывает в ваш календарь, шлёт письмо после каждого
  звонка, переводит на живого человека. Ставится на ваш действующий номер через переадресацию.
  Этап 2, менеджер по продажам: продаёт и дожимает письмами тех, кто не решил. +$1,500
  к запуску, дальше $399 в месяц, 1,500 минут.
  AI receptionist and sales rep for inbound calls, around the clock. Setup $1,000 + $199 a month
  (a subscription that renews automatically; cancel anytime). Stage two sells and follows up
  by email with anyone undecided: +$1,500, then $399 a month.
  https://businessinteldna.com/vera/ · https://businessinteldna.com/vera/ru/
- **Видимость в ответах нейросетей / AI visibility** — $1,500 за квартал вперёд.
  Делаем так, чтобы ChatGPT и другие нейросети называли ваш бизнес, когда спрашивают,
  к кому обратиться. Видимость держится на сайте: с согласия владельца проверяем сайт
  и дорабатываем, а если он не годится — делаем новый. Три-пять замороженных вопросов
  покупателя, три движка, по семь повторов на каждом из двух языков, замер в нулевой
  и девяностый день. Не назвал ни один движок — возвращаем всё.
  $1,500 per quarter, paid upfront. We get ChatGPT and other AI assistants to name your
  business. With the owner's consent we check the site and improve it, or build a new one
  if it can't be saved. If not one engine names you, you get every dollar back.
  https://businessinteldna.com/visibility/ · https://businessinteldna.com/visibility/ru/
- **Глубокая диагностика / Deep-dive diagnostic** — $500 фиксом, три рабочих дня
  от полной анкеты, без созвона. К Вере и к кварталу видимости — в подарок.
  Документ на руки: где вы теряете клиентов и какой рычаг трогать первым.
  $500 once, three working days from the completed questionnaire, no call.
  Free with Vera or a quarter of visibility.
  https://businessinteldna.com/diagnostic/ · https://businessinteldna.com/diagnostic/ru/

## Страницы / Pages

- [Главная](https://businessinteldna.com/) — русский
- [Home](https://businessinteldna.com/en/) — English
- [Вера](https://businessinteldna.com/vera/ru/) · [Vera](https://businessinteldna.com/vera/)
- [Видимость в нейросетях](https://businessinteldna.com/visibility/ru/) · [AI visibility](https://businessinteldna.com/visibility/)
- [Глубокая диагностика](https://businessinteldna.com/diagnostic/ru/) · [Deep diagnostic](https://businessinteldna.com/diagnostic/)
- [Telegram](https://t.me/business_int_dna)

## Разобранные вопросы про приём звонков / Answered questions on call handling

Страницы на русском, каждая отвечает на один вопрос целиком: что делать, кому подходит,
кому не подходит, сколько стоит и кого ещё называют на рынке.
Russian-language pages, one question each, with prices and named alternatives.

- [Кто ответит на звонки, пока вы работаете](https://businessinteldna.com/zvonki/poka-rabotayu/)
- [Кому отдать приём звонков, чтобы перестать их терять](https://businessinteldna.com/zvonki/ne-teryat/)
- [Кто примет звонки вечером и в выходные](https://businessinteldna.com/zvonki/vecher-i-vyhodnye/)
- [Сколько звонков вы пропускаете и сколько теряете на этом денег](https://businessinteldna.com/zvonki/skolko-teryayu/)
- [Кто ответит на звонки по-русски, пока вы один](https://businessinteldna.com/zvonki/po-russki/)
- [Нанять человека на телефон или поставить голосового робота](https://businessinteldna.com/zvonki/chelovek-ili-robot/)

## Видимость в нейросетях: разобранные вопросы и кейс / AI visibility: answered questions and a case

Страницы на русском: шесть вопросов про видимость компании в ответах нейросетей и один кейс.
Russian-language pages: six questions on company visibility in AI answers, and one case study.

- [Кто в США сделает так, чтобы ChatGPT называл вашу компанию](https://businessinteldna.com/vidimost/chatgpt-nazyval/)
- [Как сделать, чтобы нейросеть советовала вашу компанию](https://businessinteldna.com/vidimost/neyroset-sovetuet/)
- [Кто проверит, что нейросети говорят о вашей компании](https://businessinteldna.com/vidimost/proverka-otvetov/)
- [Есть ли услуга исправить неверные данные о вашей компании в ответах нейросетей](https://businessinteldna.com/vidimost/neverye-dannye/)
- [Продвижение в AI-поиске для малого бизнеса: кто делает и сколько стоит](https://businessinteldna.com/vidimost/cena/)
- [Сайт закрыт для роботов ИИ: кто проверит и откроет](https://businessinteldna.com/vidimost/sayt-zakryt-ot-robotov/)
- [Кейс: как эксперту с 15-летним опытом помогли стать понятной рынку](https://businessinteldna.com/kejs/yulia-remote-cfo/)

## Чего мы не обещаем / What we do not promise

Конкретных цифр и сроков результата. Отвечаем за метод, скорость и глубину, а не
за «+30% выручки за месяц».
We do not promise specific result numbers or deadlines. We answer for the method,
the speed and the depth — not for a percentage.
"""


if __name__ == "__main__":
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    # Юридические страницы — в КОРЕНЬ, потому что разделов два, а документы общие.
    # Без этого они генерировались в landings/ и никуда не ехали: /terms, /privacy,
    # /sms, /contacts, /nda отдавали 404. Наступили на это 13.09.2026.
    for slug in ("terms", "privacy", "sms", "contacts", "nda"):
        src = os.path.join(L, slug + ".html")
        if os.path.exists(src):
            shutil.copy(src, os.path.join(OUT, slug + ".html"))
        else:
            print("  ! юр-страница не собрана: " + slug)
    print("  ✓ /terms /privacy /sms /contacts /nda")

    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(strip_badge(glavnaya("ru")))
    os.makedirs(os.path.join(OUT, "en"), exist_ok=True)
    open(os.path.join(OUT, "en", "index.html"), "w", encoding="utf-8").write(strip_badge(glavnaya("en")))
    for seg, cfg in SEG.items():
        n = build_section(seg, cfg)
        print(f"  ✓ /{seg}/ — {n} файлов")
    # Три продуктовых лендинга: visibility · call-audit · vera, по шесть страниц на каждый
    # (английская, русская, «спасибо» и «оплачено» на двух языках) плюс сжатые картинки и ролик.
    # Собирает их отдельный сборщик shtab/sayty/sborka.py — исходное медиа в проекте не лежит,
    # 27 МБ жмутся в ~1 МБ на каждой сборке. Копируем папку целиком, а не по именам: страницы
    # добавляются (18 вместо 12 уже на второй день), и список имён устарел бы молча.
    # Нет сборки — падаем. Это та же грабля, из-за которой юр-страницы девять дней никуда не ехали:
    # скрипт работал, его просто никто не звал, и никто этого не заметил.
    SAYTY = os.environ.get("SAYTY_OUT", os.path.expanduser("~/bidna-sayty/out"))
    if not os.path.isdir(SAYTY):
        raise SystemExit("  ! сборки лендингов нет: %s — сначала python3 shtab/sayty/sborka.py" % SAYTY)
    fayly = 0
    stranic = 0
    for koren, _, imena in os.walk(SAYTY):
        for f in imena:
            src = os.path.join(koren, f)
            dst = os.path.join(OUT, os.path.relpath(src, SAYTY))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy(src, dst)
            fayly += 1
            if f == "index.html":
                stranic += 1
    # Число держим руками намеренно: добавилась страница — сборка падает и заставляет
    # это заметить. Сработало 23.09: лист правды к приёмке уронил сборку, как и задумано.
    # 32 = три продукта по шесть страниц + диагностика на четыре + лист правды на двух языках
    # + шесть страниц /zvonki/ (25.09) + шесть /vidimost/ и кейс /kejs/ (01.10) = 39.
    if stranic != 39:
        raise SystemExit("  ! ждали 39 страниц лендингов, в сборке %d — проверь sborka.py" % stranic)
    print("  ✓ /visibility /call-audit /vera /diagnostic — %d страниц, %d файлов" % (stranic, fayly))

    # ── подарочная анкета к кварталу видимости (24.09.2026) ─────────────────
    # Андрей дарит глубокую диагностику каждому, кто взял квартал. Анкета та же самая,
    # что у платной диагностики, — ДВА адреса на один файл, как у листа правды.
    # Различаем скрытым полем `produkt`: письма после отправки у них разные.
    #
    # ПОЛЕ ПИШЕМ В СТАТИКУ, а не скриптом: Netlify разбирает поля форм на выкладке,
    # и то, что дописано в браузере, до функции не доезжает. На этом мы уже спотыкались.
    #
    # Имя формы НЕ меняем. Вторая форма означала бы вторую регистрацию в Netlify и вторую
    # ветку в письмах, которые однажды разъедутся, — та же причина, что у листа правды.
    # (исходник, куда, метка). Метка различает, к какому продукту подарок: письма разные.
    PODAROK = [
        ("anketa-b-7k3m9x.html", "visibility/ru/podarok-anketa-p8r3k6/index.html", "podarok-vidimost"),
        ("intake-b-9f2r5t.html", "visibility/podarok-anketa-p8r3k6/index.html",    "podarok-vidimost"),
        ("anketa-b-7k3m9x.html", "vera/ru/podarok-anketa-v6n2q8/index.html",       "podarok-vera"),
        ("intake-b-9f2r5t.html", "vera/podarok-anketa-v6n2q8/index.html",          "podarok-vera"),
    ]
    for ishodnik, kuda, metka in PODAROK:
        put = os.path.join(L, ishodnik)
        if not os.path.isfile(put):
            raise SystemExit("  ! нет анкеты для подарка: %s" % put)
        a = open(put, encoding="utf-8").read()
        a, n1 = re.subn(r'(<input type="text" name="bot-field" />)',
                        '<input type="hidden" name="produkt" value="%s" />\\1' % metka,
                        a, count=1)
        a, n2 = re.subn(r"(\n(\s*)fd\.append\('bot-field',''\);)",
                        lambda m: "\n%sfd.append('produkt','%s');%s" % (m.group(2), metka, m.group(1)),
                        a, count=1)
        if not (n1 and n2):
            raise SystemExit("  ! %s: метка подарка не встала (форма %d, отправка %d)" % (ishodnik, n1, n2))
        a = zapret_indeksacii(a, kuda)
        d = os.path.join(OUT, kuda)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        open(d, "w", encoding="utf-8").write(a)
    print("  ✓ подарочных анкет: %d — видимость и Вера, по две на продукт" % len(PODAROK))

    # Короткие адреса анкет. В CLAUDE.md записан адрес без раздела, а анкеты живут
    # внутри /business/ и /expert/ — 17.09 проверено: короткий отдавал 404. Человек,
    # которому послали такую ссылку, упирался в пустую страницу, как было с Calendly.
    # Короткие адреса русскими словами ЛАТИНИЦЕЙ (решение Андрея 23.09). Кириллицы
    # в адресах не бывает. Ведут сразу на русскую версию: человеку не надо диктовать
    # ещё и «слэш ру». «vidimost» отменено самим Андреем в пользу «geo» — одно слово
    # на продукт, иначе мы сами не вспомним, какую ссылку дали. Для Веры взят
    # «dezhurny»: /vera уже занят английским лендингом, перехват сломал бы его.
    # Старые кассы за тот же продукт. Найдено 23.09: главная → /business/ → список работ
    # → /business/oplata → рабочая ссылка Stripe. Это ВТОРАЯ и ТРЕТЬЯ касса за диагностику
    # $500, и за ними никто не следил. Решение Андрея: вход перекрыть, страницы не удалять —
    # на старые анкеты ведёт оплаченная диагностика, снести их значит выдать 404 тому,
    # кто уже заплатил. Обе русские, новая диагностика одна на обе двери.
    # ВАЖНО: 301 закрывает путь С САЙТА. Прямые ссылки из старых писем живут, пока
    # ссылки в Stripe active — это отдельное дело и оно за Андреем.
    # Восклицательный знак обязателен. Без него Netlify отдаёт СУЩЕСТВУЮЩИЙ файл и правило
    # молча не применяется — проверено живьём 23.09: страницы продолжали отдавать 200
    # со ссылкой на кассу. «301!» перекрывает файл.
    STARYE_KASSY = [
        "/business/oplata       /diagnostic/ru/  301!",
        "/business/oplata.html  /diagnostic/ru/  301!",
        "/expert/oplata         /diagnostic/ru/  301!",
        "/expert/oplata.html    /diagnostic/ru/  301!",
    ]

    # Приёмка закрыта как отдельный продукт (решение Андрея 24.09): её страницы уводим
    # на Веру, внутрь которой тридцать тестовых звонков теперь и входят.
    # ЗВЁЗДОЧКИ НЕТ НАРОЧНО: /call-audit/truth-sheet-t4k8m2 остаётся живым — он обещан
    # письмами пятнадцати компаниям, и подстановочный шаблон увёл бы и его.
    # Восклицательный знак обязателен: без него Netlify отдаёт существующий файл.
    PRIEMKA = [
        "/call-audit/           /vera/      301!",
        "/call-audit            /vera/      301!",
        "/call-audit/paid/      /vera/      301!",
        "/call-audit/thanks/    /vera/      301!",
        "/call-audit/ru/        /vera/ru/   301!",
        "/call-audit/ru/paid/   /vera/ru/   301!",
        "/call-audit/ru/thanks/ /vera/ru/   301!",
    ]

    KOROTKIE = PRIEMKA + STARYE_KASSY + [
        "/geo          /visibility/ru/   301",
        "/priemka      /vera/ru/         301!",   # приёмка закрыта 24.09
        "/dezhurny     /vera/ru/         301",
        "/diagnostika  /diagnostic/ru/   301",
    ]

    REDIRECTS = "\n".join(KOROTKIE + [
        "/anketa-b-7k3m9x       /business/anketa-b-7k3m9x  301",
        "/anketa-b-7k3m9x.html  /business/anketa-b-7k3m9x  301",
        "/anketa-e-4q8v2n       /expert/anketa-e-4q8v2n    301",
        "/anketa-e-4q8v2n.html  /expert/anketa-e-4q8v2n    301",
    ]) + "\n"
    for name, body in (("robots.txt", ROBOTS), ("sitemap.xml", sitemap()),
                       ("llms.txt", LLMS), ("_redirects", REDIRECTS)):
        open(os.path.join(OUT, name), "w", encoding="utf-8").write(body)
    print("  ✓ / и /en/ — главная (Вера · видимость · диагностика) + robots.txt, sitemap.xml, llms.txt, _redirects")
