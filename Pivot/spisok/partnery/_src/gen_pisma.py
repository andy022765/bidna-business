# -*- coding: utf-8 -*-
import json, pathlib
ROOT = pathlib.Path("/Users/andriizhyla/Library/CloudStorage/GoogleDrive-andywar777@gmail.com/My Drive/Андрей/Private/Investment/DNA for Businesses/Our Business (Andrii & Masha)/Pivot/spisok/partnery")

# 27.09 по Андрею: сначала простыми словами, что делаем; название - только в подписи.
DIAG = "делаем глубокую диагностику бизнеса по трём направлениям: продукт и рынок, целевая аудитория, конкуренты;"
GOLOS = ("ставим на телефон голосовых помощников, администратора и менеджера по продажам: они берут трубку, "
         "отвечают по прайсу, записывают клиента и доводят до оплаты;")
# Андрей 27.09: «именно должно звучать: делаем так, чтобы нейросети называли вас» (объект - клиенты партнёра)
VIDNO = "делаем так, чтобы нейросети, ChatGPT и другие, называли их, когда спрашивают, к кому обратиться."
WHO_FULL = "Мы с женой Машей помогаем владельцам бизнеса в США:\n- " + DIAG + "\n- " + GOLOS + "\n- " + VIDNO
WHO_VERA = ("Мы с женой Машей ставим владельцам бизнеса в США голосовых помощников на телефон, администратора "
            "и менеджера по продажам: они берут трубку, отвечают по прайсу, записывают клиента и доводят до оплаты.")
# Андрей 27.09: «просто 20% от суммы продажи… не надо писать эти цифры… любые покупки новых продуктов - так же 20%»
OFFER_FULL = ("Ищем партнёров, которым русскоязычные владельцы уже доверяют. Вы знакомите нас с клиентом и получаете 20% "
              "от суммы, когда он впервые покупает любой наш продукт. Купит потом другой продукт, в том числе новый, "
              "которого сегодня ещё нет, - снова 20%. Клиент за вами навсегда. Если мы вернём ему деньги, ваше останется "
              "у вас. Ежемесячная плата и продления в расчёт не идут.")
# Fuse, Утлик, Драмшев - о видимости ни слова (решение 26.09: сами продают SEO/видимость). 28.09 главный агент добавил
# будущие продукты по общему правилу Андрея 27.09: «все, кто становится нашими партнёрами… новые продукты… будут получать
# реферальную комиссию». Ждёт «да» Андрея на формулировку.
OFFER_VERA = ("Ищем партнёров, которым русскоязычные владельцы уже доверяют. Вы знакомите нас с клиентом и получаете 20% "
              "от суммы, когда он впервые покупает администратора или менеджера по продажам. Купит потом второго из них "
              "или наш новый продукт, которого сегодня ещё нет, - снова 20%. Клиент за вами навсегда. Если мы вернём ему "
              "деньги, ваше останется у вас. Ежемесячная плата и продления в расчёт не идут.")
OFFER_ECHO = ("Ищем партнёров, которым русскоязычные владельцы уже доверяют. Вам предлагаем рекламу вместо денег. Вы знакомите "
              "нас с клиентом, и когда он впервые покупает любой наш продукт, мы размещаем у вас рекламу на 20% от суммы. "
              "Купит потом другой продукт, в том числе новый, которого сегодня ещё нет, - снова реклама на 20%. Клиент за вами "
              "навсегда. Если мы вернём ему деньги, реклама за него останется за вами. Ежемесячная плата и продления "
              "в расчёт не идут.")
DISCLOSE = "Клиенту вы говорите о вознаграждении, готовая фраза есть в пакете."
DISCLOSE_ECHO = "Рядом с рекомендацией вы пишете, что за приведённых клиентов мы размещаем у вас рекламу, готовая фраза есть в пакете."
CPA = "По клиентам, которым вы делаете аудит, обзор или компиляцию отчётности, вознаграждения нет - так требует AICPA."
SF = "Если договор с State Farm такого не разрешает, просто скажите."
ASK = "Прислать пакет? В нём условия и что о нас можно говорить."
SIGN = "Андрей\nBusiness Intelligence DNA"

# Английское письмо (ШТАБ 27.09: Major Point - русский на их сайте не подтверждён)
EN = ["My wife Masha and I help business owners in the US:\n"
      "- we run an in-depth business diagnostic across three areas: product and market, target audience, competitors;\n"
      "- we put voice assistants on the phone, a receptionist and a sales manager: they pick up, answer from the price "
      "list, book the client and follow through to payment;\n"
      "- we make sure AI assistants, ChatGPT and others, name them when people ask who to turn to.",
      None,  # строка «I'm writing because…»
      "We're looking for partners whom Russian-speaking owners already trust. You introduce us to a client and get "
      "20% of the amount when they first buy any of our products. If they later buy another product, including a new "
      "one that doesn't exist yet, it's 20% again. The client stays yours for good. If we ever refund them, your share "
      "stays with you. Monthly fees and renewals don't count.",
      "You tell the client you receive a referral fee, and the package has a ready line for that.",
      "Shall I send you the package? It has the terms and what can and can't be said about us.",
      "Andrii\nBusiness Intelligence DNA"]

# Порядок отправки (Андрей 27.09: «штук по 10»): первый день - 10 сильных, второй - 5
DEN1 = [1, 9, 15, 14, 5, 3, 4, 6, 2, 8]
DEN2 = [13, 12, 17, 18, 19]

# kanal: email -> otpravka.py; forma/telefon -> руками, скрипт не шлёт
L = [
 dict(n=1, imya="Tale Taxes", adres="Info@taletaxes.com", kanal="email", priv="Арюна, здравствуйте. Меня зовут Андрей.",
      tema="Арюна, предложение о партнёрстве", tip="full", cpa=True,
      why="вы сами ведёте эфиры и YouTube о налогах в США для владельцев бизнеса и учите их QuickBooks",
      prov="✓ русская страница для бизнеса, YouTube «Aryuna Tale - налоги в США», курс QuickBooks"),
 dict(n=2, imya="ProTax Center", adres="info@protaxcenter.com", kanal="email", priv="Здравствуйте. Меня зовут Андрей.",
      tema="Предложение о партнёрстве", tip="full", cpa=True,
      why="вы ведёте бизнес клиентов на русском, английском и украинском, и клиент у вас с первого дня говорит с живым бухгалтером",
      prov="✓ «Мы работаем на английском, русском и украинском языках. Без колл-центров - с первого дня вы работаете с реальным бухгалтером». Лицензию CPA на сайте не нашёл: делают reviews/compilations, поэтому абзац AICPA оставил"),
 dict(n=3, imya="Tax Target Group", adres="secretary@taxtargetgroup.com", kanal="email", priv="Роман, здравствуйте. Меня зовут Андрей.",
      tema="Для Романа Фурмана: предложение о партнёрстве", tip="full", cpa=True,
      why="у вас 25 человек из 27 в команде говорят по-русски",
      prov="✓ «Languages: Russian, English» у 25 из 27 на странице команды. Адрес - секретаря, поэтому имя в теме"),
 dict(n=4, imya="McLan Accounting", adres="info@mclancpa.com", kanal="email", priv="Здравствуйте. Меня зовут Андрей.",
      tema="Предложение о партнёрстве", tip="full", cpa=True,
      why="вы с 1985 года ведёте бухгалтерию бизнеса на русском, английском и украинском, от грузоперевозок до медицины и такси",
      prov="✓ «We offer comprehensive services in English, Russian, and Ukrainian»; с 1985; грузоперевозки, медицина, Uber/Lyft"),
 dict(n=5, imya="Steadfast Accounting", adres="info@steadfastaccounting.us", kanal="email", priv="Лиана, здравствуйте. Меня зовут Андрей.",
      tema="Лиана, предложение о партнёрстве", tip="full", cpa=False,
      why="у вас на сайте уже работает свой ИИ-помощник по налогам, и объяснять, зачем владельцу ИИ, вам не нужно",
      prov="✓ русская версия сайта в коде; свой ИИ-помощник на сайте. EA, не CPA - абзац AICPA не нужен"),
 dict(n=6, imya="Sharp Accountancy", adres="info@sharpaccountancy.com", kanal="email", priv="Асмик, здравствуйте. Меня зовут Андрей.",
      tema="Асмик, предложение о партнёрстве", tip="full", cpa=True,
      why="вы в Глендейле ведёте клиентов на русском, армянском и английском",
      prov="✓ «our range of services are offered in English, Russian, and Armenian»"),
 dict(n=7, imya="Ella Yelkin State Farm", adres="", kanal="форма на ellayelkin.com или statefarm.com - вставить руками", priv="Элла, здравствуйте. Меня зовут Андрей.",
      tema="", tip="full", cpa=False, sf=True,
      why="в вашем офисе говорят по-русски, и вы страхуете коммерческое авто и грузоперевозчиков Брайтона",
      prov="✓ «Russian Bilingual office», «говорим по русски»; коммерческое авто ведёт сотрудник. Почты на сайтах нет"),
 dict(n=8, imya="United Brokerage", adres="CSR@Lookitover.com", kanal="email", priv="Здравствуйте. Меня зовут Андрей.",
      tema="Для Jonathan Vinokur: предложение о партнёрстве", tip="full", cpa=False,
      why="вы с 1984 года страхуете бизнес в Бруклине, и у вас есть русская версия сайта",
      prov="✓ русская версия: «Комплексные бизнес-страховые решения…». Адрес - клиентской службы, поэтому имя в теме"),
 dict(n=9, imya="CoverToday", adres="info@covertoday.com", kanal="email", priv="Здравствуйте. Меня зовут Андрей.",
      tema="Для Giorgi Nazarov: предложение о партнёрстве", tip="full", cpa=False,
      why="у вас есть отдельные страницы для HVAC-подрядчиков и мастеров по ремонту техники, а это как раз наши клиенты",
      prov="✓ «serving the Russian-speaking community», /ru/business-insurance, страницы HVAC и ремонта техники"),
 dict(n=10, imya="Galit Fuller State Farm", adres="", kanal="только телефон; почты нет - письмом не дотянуться", priv="Галит, здравствуйте. Меня зовут Андрей.",
      tema="", tip="full", cpa=False, sf=True,
      why="вы страхуете в Шерман-Оукс и говорите по-русски",
      prov="State Farm: «Languages: … Russian» ✓; русский за ней лично в реестре CDI - со слов разведки"),
 dict(n=11, imya="Rob Perelmuter State Farm", adres="", kanal="только телефон; почты нет - письмом не дотянуться", priv="Роб, здравствуйте. Меня зовут Андрей.",
      tema="", tip="full", cpa=False, sf=True,
      why="вы агент State Farm по малому бизнесу, и в вашем офисе говорят по-русски",
      prov="✓ Russian, Ukrainian в языках; «Small Business Premier Agent» - со слов разведки"),
 dict(n=12, imya="Major Point Insurance", adres="service@mpgetinsured.com", kanal="email", priv="Hi Mikhail, my name is Andrii.",
      tema="Mikhail, a partnership proposal", tip="full", cpa=False, en=True,
      why="you insure businesses in West Hollywood and, per the California Department of Insurance agent directory, speak Russian",
      prov="**По-английски - решение ШТАБА 27.09:** русский на их сайте не подтверждён. Русский у Патюка - из реестра CDI «Find an Agent» (фильтр по языку), проверяла разведка 26.09 в headless Chrome, я не перепроверял. Страхование бизнеса - с их сайта, со слов разведки"),
 dict(n=13, imya="Diamante Insurance", adres="mail@diamanteins.com", kanal="email", priv="Здравствуйте. Меня зовут Андрей.",
      tema="Предложение о партнёрстве", tip="full", cpa=False,
      why="вы страхуете коммерческое авто в Бруклине, и у вас говорят по-русски",
      prov="✓ 26.09 ночью: страница Progressive - «knowsLanguage: English, Russian», «Commercial Auto»; почта оттуда же"),
 dict(n=14, imya="Spicy Media", adres="wow@spicymedia.us", kanal="email", priv="Андрей, здравствуйте. Меня зовут Андрей.",
      tema="Андрей, предложение о партнёрстве", tip="full", cpa=False,
      why="вы ведёте рекламу для русскоязычных предпринимателей в США",
      prov="✓ кейсы «для русскоязычных предпринимателей в США». Почта найдена 26.09 ночью на spicymedia.us - это их адрес поддержки. Можно вместо почты Telegram @andrew_spicy - тогда руками"),
 dict(n=15, imya="Бюро «Лира»", adres="artemakulov@gmail.com", kanal="email", priv="Артём, здравствуйте. Меня зовут Андрей.",
      tema="Артём, предложение о партнёрстве", tip="full", cpa=False,
      why="вы с 2017 года ведёте рекламу сантехникам, мастерам по HVAC и электрикам в США, а это как раз наши клиенты",
      prov="✓ «Мы с 2017 года помогаем локальным сервисным бизнесам в США - таким как сантехники, мастера по HVAC, электрики…»"),
 dict(n=16, imya="Echo Ru", adres="", kanal="форма echoru.com/contact-us/ - вставить руками; почты на сайте нет", priv="Здравствуйте. Меня зовут Андрей.",
      tema="", tip="echo", cpa=False,
      why="вы медиа русскоязычного Лос-Анджелеса, и у вас справочник русских бизнесов",
      prov="✓ «local news and information for the Russian-speaking community of Los Angeles», справочник 574 записи"),
 dict(n=17, imya="Fuse Club", adres="club@fuseservice.com", kanal="email", priv="Руслан, здравствуйте. Меня зовут Андрей.",
      tema="Руслан, предложение о партнёрстве", tip="vera", cpa=False,
      why="вы собрали сообщество русскоязычных предпринимателей в США, а подкаст Fuse Club как раз про бизнес в сфере услуг для дома",
      prov="✓ «Fuse Service CSN helps Russian-speaking professionals and entrepreneurs in the U.S.». Только администратор и менеджер по продажам, без видимости"),
 dict(n=18, imya="uMarketing, Сергей Утлик", adres="info@umarketing.us", kanal="email", priv="Сергей, здравствуйте. Меня зовут Андрей.",
      tema="Сергей, предложение о партнёрстве", tip="vera", cpa=False,
      why="вы ведёте сообщество русскоязычных предпринимателей в США",
      prov="✓ «Сообщество русскоязычных предпринимателей в США». Только администратор и менеджер по продажам, без видимости"),
 dict(n=19, imya="Netrocket, Даниил Драмшев", adres="contact@netrocket.pro", kanal="email", priv="Даниил, здравствуйте. Меня зовут Андрей.",
      tema="Даниил, предложение о партнёрстве", tip="vera", cpa=False,
      why="вы берёте интервью у русскоязычных владельцев бизнеса в сфере услуг для дома в США, а ваши зрители как раз наши клиенты",
      prov="✓ YouTube-интервью с владельцами home services. Только администратор и менеджер по продажам, без видимости: сам продаёт AI SEO"),
]

def abzacy(x):
    if x.get("en"):
        a = list(EN); a[1] = "I'm writing because %s." % x["why"]
        return [x["priv"]] + a
    who = WHO_VERA if x["tip"] == "vera" else WHO_FULL
    offer = {"full": OFFER_FULL, "vera": OFFER_VERA, "echo": OFFER_ECHO}[x["tip"]]
    a = [x["priv"], who, "Пишу вам, потому что %s." % x["why"], offer,
         DISCLOSE_ECHO if x["tip"] == "echo" else DISCLOSE]
    if x.get("cpa"): a.append(CPA)
    if x.get("sf"): a.append(SF)
    a += [ASK, SIGN]
    return a

def zapis(x):
    return dict(kartochka="partner-%02d" % x["n"], data="2026-09-27", adres=x["adres"], imya=x["imya"],
                tema=x["tema"], abzacy=abzacy(x), bez_zapisi=True, podval="partner-en" if x.get("en") else "partner",
                # ШТАБ 27.09: холодные письма партнёрам - с отдельного домена (Андрей разрешил), ответы - на основной
                otpravitel="Andrii Zhyla <andrii@bizzinteldna.com>")
po_n = {x["n"]: x for x in L}
assert sorted(DEN1 + DEN2) == sorted(x["n"] for x in L if x["kanal"] == "email")
old = ROOT / "pisma-partneram.json"
if old.exists(): old.unlink()
for imya_f, spisok in (("pisma-partneram-den1.json", DEN1), ("pisma-partneram-den2.json", DEN2)):
    (ROOT / imya_f).write_text(json.dumps([zapis(po_n[n]) for n in spisok], ensure_ascii=False, indent=1), encoding="utf-8")
pisma = DEN1 + DEN2

out = []
for x in L:
    a = abzacy(x)
    head = "### %d. %s" % (x["n"], x["imya"])
    if x["kanal"] == "email":
        meta = "**Кому:** `%s` · **Тема:** %s" % (x["adres"], x["tema"])
    else:
        meta = "**Почты нет.** %s. Текст тот же, подвал в форму не нужен." % x["kanal"].capitalize()
    body = "\n>\n".join("\n".join("> " + s for s in p.split("\n")) for p in a)
    out.append("%s\n\n%s\n\n%s\n\n*Откуда строка:* %s\n" % (head, meta, body, x["prov"]))
(ROOT / "_pisma_body.md").write_text("\n".join(out), encoding="utf-8")
print(len(pisma), "в json;", len(L), "всего")
for x in L:
    a = abzacy(x); print(x["n"], len(" ".join(a).split()), "слов")
