#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Рабочий лист прозвона для Маши.

Берёт 56 проверенных целей и делает одну страницу, с которой можно звонить:
номер кнопкой, сайт ссылкой, плашка Google под рукой — и ПОЛЯ, куда писать ответы.
Раньше формы не было вообще: Маша звонила, а записывать было некуда.

    python3 shtab/prozvon/sobrat.py

Страница пишется в shtab/prozvon/list.html. Открывается двойным щелчком, работает
без интернета. Ответы сохраняются в браузере сразу, по ходу набора; кнопка
«Скачать ответы» отдаёт файл для таблицы.
"""
import html, json, pathlib, re, urllib.parse

ZDES = pathlib.Path(__file__).resolve().parent
KORENJ = ZDES.parent.parent
ISTOCHNIK = KORENJ / "shtab/issledovanie/misheni-2026-09-21/gotovye.json"

# Добор. Отдельным файлом, а не правкой gotovye.json: тот — выход исследования 21.09,
# и переписывать его задним числом значит потерять возможность сказать, чем список был.
# Первые 56 собраны ПО ВИТРИНАМ ВЕНДОРОВ голосовых ботов, то есть бот там гарантирован
# по построению. Отсюда и «47% роботов» — это свойство выборки, а не рынка.
# В доборе наоборот: цели выбраны вслепую, бот неизвестен. Они и отвечают на вопрос,
# которого первые 56 задать не могли, — сколько таких вообще.
DOBOR = ZDES / "dobavleno.json"

# СПИСОК ДНЯ. С 28.09 прозвон идёт не по всей базе, а по отобранному на день списку
# с окнами звонка: `spisok-ГГГГ-ММ-ДД.json`, поля как в dobavleno.json плюс `okno`
# (когда звонить) и `poryadok` (в каком порядке внутри окна; «запас N» — резерв).
# Если такой файл есть, карточка собирается по нему: звонить по всей базе в вечернее
# окно всё равно нельзя — суточный предел двадцать звонков.
def spisok_dnya():
    fayly = sorted(ZDES.glob("spisok-????-??-??.json"))
    return fayly[-1] if fayly else None

# Ниша определяется по ОПИСАНИЮ ДЕЛА, а не по всей строке разведки: иначе ветклиника
# с зубной практикой уезжает в «Стоматолог», а HVAC с электрикой в списке услуг —
# в «Электрик». Порядок важен: узкое раньше широкого, ветклиника раньше стоматолога.
PRAVILA_NISH = [
    ("Автодилер", r"автодилер"),
    ("Ветклиника", r"ветклиник|veterinar"),
    ("Стоматолог", r"стоматолог"),
    ("Пирсинг", r"пирсинг"),
    ("Брови и ресницы", r"брови|трединг"),
    ("Медспа", r"медспа|лонжевити|antiaging"),
    ("Ночной клуб", r"ночной клуб"),
    ("Пивоварня", r"пивоварн|брюпаб"),
    ("Пекарня", r"десерт|пекарн"),
    ("Пиццерия", r"пиццери"),
    ("Ресторан", r"ресторан|стейкхаус|тако|стрит-фуд|рыбный|бар"),
    ("Аквариум", r"аквариум|зоопарк"),
    ("Гаражные ворота", r"гаражные ворота"),
    ("Деревья", r"арбористик|уход за деревь"),
    ("Вывоз мусора", r"вывоз мусора|клинаут"),
    ("Пест-контроль", r"пест-контрол"),
    ("Кровля", r"кровля"),
    ("Риэлтор", r"риэлт|недвижим"),
    ("Электрик", r"^электрика"),          # только если это основное занятие
    ("HVAC", r"hvac|отоплен|кондиционир"),
    ("Сантехник", r"сантехник"),
]
# nishi.json (три вопроса под нишу) больше не подставляется: вопросы роботу были
# приёмом приёмки — игрой в покупателя, — и с 28.09 мы так не делаем. Файл оставлен,
# ниша по-прежнему определяется и показывается.

BOT_EST = re.compile(r"\bда[,:]?\s*(бот|gubagoo|carnow|podium)|бот есть|виджет\b(?!.*нет)", re.I)
BOT_NET = re.compile(r"признаков бота нет|бота нет|виджета.*не видно", re.I)


def e164(s):
    """Номер в вид +1XXXXXXXXXX — иначе Twilio его не наберёт.

    22.09 Маша перебрала двадцать кнопок и на каждой слышала «номер записан неверно».
    Причина была в сборке: я вырезал из номера всё кроме цифр и получал 6232506492
    без +1. В исходнике номера записаны кто во что горазд: «(623) 250-6492»,
    «716-302-4488», «415.795.3403», «(772)692-8069» — формат не значит ничего,
    значат десять цифр.
    """
    c = re.sub(r"\D", "", s or "")
    if len(c) == 11 and c[0] == "1":
        c = c[1:]
    return ("+1" + c) if len(c) == 10 else None


def nomer_iz_teksta(stroka):
    """Запасной путь: у части карточек в поле номера стоит «?», а сам номер —
    в тексте разведки, после «ОСНОВНОЙ НОМЕР:» или просто рядом."""
    m = re.search(r"ОСНОВНОЙ НОМЕР:?\s*([+()\d\s.\-]{10,20})", stroka)
    if m:
        n = e164(m.group(1))
        if n:
            return n, m.group(1).strip()
    for kand in re.findall(r"[+(]?\d[\d()\s.\-]{8,18}\d", stroka):
        n = e164(kand)
        if n:
            return n, kand.strip()
    return None, None


# 23.09: ссылка «сайт» строилась как "https://" + кусок заметки целиком, если в нём
# не было скобок. Получалось https://сайт живой да, https://нет DNS, https://curl отдаёт 403.
# 38 ссылок из 66 вели в никуда. Берём первый настоящий домен, а если его нет —
# ссылку не рисуем вовсе: пустое место честнее битой ссылки, поиск в Google рядом остаётся.
DOMEN_V_TEKSTE = re.compile(r"(?<![/\w.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(/[^\s`\"'<>)\u2014,;]*)?", re.I)
NE_DOMEN = {"т.д", "т.п", "и.т.д"}


def vytashchit_domen(k):
    """Первый домен из куска заметки. Русская проза домена не даёт — вернётся пусто."""
    for m in DOMEN_V_TEKSTE.finditer(k.replace("\u2192", " ").replace("*.", "")):
        d = (m.group(1) or "").lower().rstrip(".")
        if d in NE_DOMEN or "." not in d:
            continue
        if not re.fullmatch(r"[a-z0-9.-]+", d):
            continue
        return d + (m.group(2) or "").rstrip(".,;")
    return ""


# Хвост вида «(browarc.com/treasure-coast-mall)» или «(hattonvet.com \u2192 301 \u2192 ...)»
# в названии — это заметка разведки, а не имя. Из него же выходит мусорный запрос в Google.
# «Call Dad (AC, Heating & Plumbing)» не трогаем: там нет ни домена, ни стрелки.
HVOST_ZAMETKI = re.compile(r"\s*\((?=[^()]*(?:\.(?:com|us|net|org|io|co)\b|\u2192))[^()]*\)\s*$", re.I)


def chistoe_imya(nm):
    nm = re.sub(r"^\s*\d+\.\s+", "", str(nm or ""))   # «2. Brow Arc» -> «Brow Arc»
    return HVOST_ZAMETKI.sub("", nm).strip()


def razobrat(x):
    kus = [k.strip() for k in x["stroka"].split("|")]
    z = {"imya": chistoe_imya(x["imya"]), "nomer": (x.get("nomer") or "").strip(),
         "sayt": "", "delo": "", "bot": "", "plashka": "", "verdikt": "",
         "okno": (x.get("okno") or "").strip(),
         "poryadok": str(x.get("poryadok") or "").strip(),
         "polnostyu": x["stroka"]}
    for k in kus[1:]:
        nk = k.lower()
        if nk.startswith("сайт"):
            m = re.search(r"\(([^)]+)\)", k)
            z["sayt"] = vytashchit_domen(m.group(1) if m else k)
        elif "google screened" in nk or "guaranteed" in nk or "google verified" in nk:
            z["plashka"] = k
        elif nk.startswith("годится"):
            z["verdikt"] = k
        elif not z["delo"] and not re.match(r"^[\(\d\+]", k) and "совпадает" not in nk:
            z["delo"] = k
    # бот ищем по всей строке: в исходнике он лежит где попало
    if BOT_EST.search(x["stroka"]):
        z["bot"] = "есть"
    elif BOT_NET.search(x["stroka"]):
        z["bot"] = "нет"
    else:
        z["bot"] = "неясно"
    # плашка: нас интересует только «есть/нет», остальное в подробностях
    z["plashka_est"] = bool(re.search(r"(screened|guaranteed|verified)[^|]{0,30}—\s*(да|есть)",
                                      z["plashka"], re.I))
    # ниша и три вопроса под неё
    # Сначала по описанию дела. У части карточек разведки описания нет — там первым
    # куском идут телефоны отделов; для них откатываемся на всю строку, где ниша
    # написана словами («ниша: ветклиника…», «автодилер Honda»).
    z["nisha"] = next((n for n, rx in PRAVILA_NISH if re.search(rx, z["delo"], re.I)), None) \
        if z["delo"] else None
    if not z["nisha"]:
        z["nisha"] = next((n for n, rx in PRAVILA_NISH if re.search(rx, x["stroka"], re.I)), None)
    if not z["nisha"] and "realnewyork" in x["stroka"].lower():
        z["nisha"] = "Риэлтор"
    # Номер для набора и номер для показа — разные вещи.
    z["nabor"] = e164(z["nomer"])
    z["vid"] = (z["nomer"] or "").strip()
    if not z["nabor"]:
        z["nabor"], najden = nomer_iz_teksta(x["stroka"])
        if najden:
            z["vid"] = najden
    return z


# На виду — только то, чего нет в записи или что является решением, а не фактом.
# Два поля, ради которых звоним. «Итог» уехал вниз: 22.09 он заполнялся как попало
# и ничего не значил — из записи я его достаю сам. А вот имя и почту из записи
# не достать, их называют вслух только если спросить.
GLAVNYE = [
    ("kto", "Кто ответил", ["", "человек", "бот", "голосовое меню", "автоответчик", "не взяли"]),
    ("imya_reshaet", "★ Имя: кто отвечает за телефон", None),
    ("pochta", "★ Почта — куда слать запись", None),
    # Живая ветка: час, который человек назвал своим слабым местом — в этот час
    # мы и перезваниваем. Поле СТАРОЕ (zametka) нарочно: в prozvon.js белый список
    # полей, новый ключ ушёл бы в никуда и Маша бы этого не заметила.
    ("zametka", "★ Окно, которое назвали (и заметка)", None),
]
# Под спойлером — заполнится из расшифровки записи, руками печатать не надо.
POTOM = [
    ("cena", "Про цену · дословно", None),
    ("posylka", "★ Ложная посылка · дословно", None),
    ("usluga", "Чего нет · дословно", None),
    ("zapis", "Предложили записаться", ["", "да", "нет"]),
    ("itog", "Итог", ["", "интересно", "не интересно", "перезвонить", "не дозвонилась"]),
    # Приёмка закрыта решением Андрея 24.09: продаём Веру тем, у кого бота НЕТ.
    # Робот на линии — значит автоответ у них уже есть, Веру там не предлагаем.
    ("chto", "Что продаём", ["", "Вера — первый этап $1 000 + $199",
                             "Видимость — автоответ у них уже есть",
                             "ничего", "решу потом"]),
    ("sek", "Секунд до ответа", None),
]
POLYA = GLAVNYE + POTOM


def poryadok_klyuch(z, okna):
    """Сортировка: сначала окна в том порядке, в каком их задал список, внутри окна —
    по номеру. Запас всегда в самом низу: это не цели, а замена выбывшим."""
    p = z["poryadok"]
    zapas = p.lower().startswith("запас")
    nomer = int(m.group(0)) if (m := re.search(r"\d+", p)) else 999
    return (1 if zapas else 0, okna.index(z["okno"]) if z["okno"] in okna else 99, nomer)


def main():
    dnevnoy = spisok_dnya()
    if dnevnoy:
        syrjo = json.loads(dnevnoy.read_text(encoding="utf-8"))
        print("список дня: %s" % dnevnoy.name)
    else:
        syrjo = json.loads(ISTOCHNIK.read_text(encoding="utf-8"))
        if DOBOR.exists():
            syrjo += json.loads(DOBOR.read_text(encoding="utf-8"))
    dannye = [razobrat(x) for x in syrjo]
    if dnevnoy:
        okna = list(dict.fromkeys(z["okno"] for z in dannye if z["okno"]))
        dannye.sort(key=lambda z: poryadok_klyuch(z, okna))
    e = html.escape
    ryady = []
    bez_nomera = []
    for i, z in enumerate(dannye, 1):
        tel = z["nabor"] or ""
        if not tel:
            bez_nomera.append(z["imya"])
        # Кнопка «Плашка Google». Ищем ИМЯ + ГОРОД, без русского описания: оно ломало выдачу.
        # И кодируем по правилам адреса, а не html.escape — иначе «&» в названии
        # («Way Cool Plumbing & Air») обрывал запрос на первом же слове и Маша проверяла
        # плашку не у той компании. Плашка — юридический стоп-кран, ошибаться тут нельзя.
        gorod = re.search(r"([A-Z][a-zA-Z .'-]{2,}),?\s+([A-Z]{2})\b", z["delo"] or "")
        zapros = z["imya"] + (" " + gorod.group(1).strip() + " " + gorod.group(2) if gorod else "")
        poisk = "https://www.google.com/search?q=" + urllib.parse.quote_plus(zapros)
        def vvod(k, nazv, varianty):
            idp = "%s_%d" % (k, i)
            if varianty:
                opt = "".join('<option value="%s">%s</option>' % (e(v), e(v or "—")) for v in varianty)
                el = '<select id="%s" data-k="%s" data-i="%d">%s</select>' % (idp, k, i, opt)
            else:
                el = '<input id="%s" data-k="%s" data-i="%d" type="text" autocomplete="off">' % (idp, k, i)
            return '<label for="%s"><span>%s</span>%s</label>' % (idp, e(nazv), el)

        # Окно звонка — самое важное после номера: позвонить в неурочный час
        # значит сжечь цель. Поэтому оно в шапке, а не в подробностях.
        okno = " · ".join(x for x in (z["poryadok"], z["okno"]) if x)
        okno_html = ('<p class="okno%s">%s</p>'
                     % (" zapas" if z["poryadok"].lower().startswith("запас") else "", e(okno))
                     ) if okno else ""

        glavnye = "".join(vvod(*x) for x in GLAVNYE)
        potom = "".join(vvod(*x) for x in POTOM)
        ryady.append("""
<article class="c" id="k%d">
  <header>
    <span class="nom">%d</span>
    <h2>%s</h2>
    <span class="mark %s">%s</span>
  </header>
  %s
  <p class="delo">%s</p>
  <div class="dey">
    <a class="zv%s" href="#" data-tel="%s" data-i="%d">%s</a>
    <span class="tajmer" id="t%d" hidden>00:00</span>
    %s
    <a class="ss pl" href="%s" target="_blank" rel="noopener">Плашка Google</a>
  </div>
  <div class="nabor" id="n%d" hidden>
    <span class="pod">Голосовое меню — нажимай цифры здесь</span>
    <div class="klav">%s</div>
    <span class="nazhato" id="nz%d"></span>
  </div>
  <label class="chk"><input type="checkbox" data-k="plashka_ok" data-i="%d">
    <span>Плашку проверила: <b>Google Verified НЕТ</b> — звонить можно</span></label>
  <div class="skript">
    <p class="nisha">Ниша: <b>%s</b> — вопросы уже подставлены, читать дословно</p>
    <p class="vhod">Hi — heads up, I record my calls so I don't have to write things down.
      And I'm not booking anything, so I'll be fast.
      <em>Говорим ВСЕГДА, кто бы ни ответил: запись правда идёт. Скажут «не записывайте» —
      отбой, перезваниваем без записи или пишем от руки. Дальше слушаем, КТО ответил,
      и отмечаем поле «Кто ответил» — нужная ветка подсветится сама.</em></p>

    <div class="vetka v-bot">
      <p class="zag">Ответил робот, меню или автоответчик</p>
      <p class="pravilo">Покупателя НЕ играем — ни здесь, ни с человеком. Вопросов роботу
        не задаём и на удочку его не ловим: нам нужен замер того, что слышит клиент,
        а не разговор с машиной.</p>
      <ol>
        <li><span class="sh">Дослушать</span>Дослушай приветствие до конца, не перебивая.<em>Нам нужно ровно то, что слышит клиент вечером. Оборванное приветствие — не замер</em></li>
        <li><span class="sh sh-g">Записать</span>Запиши в поле ниже, что именно он сказал.<em>Своими словами: представился ли, назвал ли часы, предложил ли записаться, дал ли выход на человека</em></li>
        <li><span class="sh">Не оставлять</span>Сообщение НЕ оставляем и кладём трубку.<em>Обратный звонок нам не нужен, а оставленное сообщение обязывает их тратить время</em></li>
      </ol>
    </div>

    <div class="vetka v-chel">
      <p class="zag">Ответил живой человек</p>
      <p class="pravilo">Подставного покупателя НЕ играем. У того, кому изображала клиента,
        почту не попросишь. Здесь мы — это мы, с первой секунды.</p>
      <ol>
        <li><span class="sh">Пустой час</span>When someone calls after hours — say eight on a Saturday evening — what happens to that call?<em>Вот ради чего звонок. Человек в два часа дня трубку и должен был снять; продаёт не отсутствие робота, а пустые часы</em></li>
        <li><span class="sh">Обе заняты</span>And when you're both with a client and the phone rings — does it go to voicemail?<em>Ответят «answering service» — это не отказ, а лучший лид: они уже платят за покрытие</em></li>
        <li><span class="sh">Кто мы</span>The reason I ask — my husband and I do one thing. We call a business's line at the hours nobody's at the desk, and we write down what the caller actually hears.<em>Одной фразой и механикой. Ни сумм, ни «вы теряете клиентов»: это утверждение, под него нужно доказательство вперёд</em></li>
        <li><span class="sh sh-g">АДРЕС</span>We'll do it for you, free, one call. You pick the hour you think is your weak spot. One page, what the caller heard, nothing to sign. Where should I send it — and who should it go to?<em>Почта — адрес доставки вещи, а не одолжение. Окно называют ОНИ: тогда это их догадка и ответ им интересен. «Who should it go to» выводит на владельца, а не на администратора. Час пишем в поле «Окно»</em></li>
        <li><span class="sh">Отказ</span>No problem at all, thanks for the minute.<em>Не дожимаем. Один звонок и одна страница — ровно то, что обещали, не больше</em></li>
      </ol>
    </div>
    <p class="pripiska">Не взяли трубку — ждём <b>до автоответчика или до тридцатой секунды</b>,
    смотря что раньше. Один звонок в сутки на номер.
    <em>Мы меряем, что слышит клиент вечером, а многие автоответчики включаются на двадцатой–двадцать
    пятой секунде. Положить на восемнадцатой и записать «никто не ответил» было бы неправдой.</em>
    Записали нас — сразу: «actually, don't book me, I'm just checking prices».<br>
    <b>Пока играет голосовое меню — молчим и нажимаем цифру.</b> Меню не слушает, речь поверх него уходит в пустоту.</p>
  </div>
  <div class="polya glav">%s</div>
  <details class="potom"><summary>Дописать руками — обычно не нужно</summary>
    <p class="zamet">Дословные цитаты берутся из записи разговора, печатать их не надо.
    Эти поля — на случай, если хочешь отметить что-то сразу.</p>
    <div class="polya">%s</div></details>
  <details><summary>Что нашла разведка</summary><p>%s</p></details>
</article>""" % (i, i, e(z["imya"]),
                 "bot" if z["bot"] == "есть" else ("nebot" if z["bot"] == "нет" else "hz"),
                 {"есть": "чат на сайте", "нет": "чата на сайте нет",
                  "неясно": "сайт не посмотрели"}[z["bot"]],
                 okno_html,
                 e(z["delo"] or ""), "" if tel else " nelzya", tel, i,
                 e(z["vid"] or tel or "номер не найден"), i,
                 ('<a class="ss" href="https://%s" target="_blank" rel="noopener">%s</a>'
                  % (e(z["sayt"]), e(z["sayt"])) if z["sayt"] else ""), poisk,
                 i, "".join('<button type="button" data-cifra="%s">%s</button>' % (c, c)
                            for c in "123456789*0#"), i,
                 i,
                 e(z["nisha"] or "не определена"),
                 glavnye, potom, e(z["polnostyu"])))

    (ZDES / "list.html").write_text(SHABLON
        .replace("@RYADY@", "\n".join(ryady))
        .replace("@VSEGO@", str(len(dannye)))
        .replace("@POLYA@", json.dumps([p[0] for p in POLYA] + ["plashka_ok"], ensure_ascii=False))
        .replace("@IMENA@", json.dumps([z["imya"] for z in dannye], ensure_ascii=False)),
        encoding="utf-8")
    print("собрано: %s · целей %d" % (ZDES / "list.html", len(dannye)))
    print("с ботом: %d · без бота: %d · неясно: %d" % (
        sum(1 for z in dannye if z["bot"] == "есть"),
        sum(1 for z in dannye if z["bot"] == "нет"),
        sum(1 for z in dannye if z["bot"] == "неясно")))
    plashki = [z["imya"] for z in dannye if z["plashka_est"]]
    print("С ПЛАШКОЙ GOOGLE (звонить нельзя): %s" % (plashki or "ни одной"))
    print("номера в виде +1XXXXXXXXXX: %d из %d" % (len(dannye) - len(bez_nomera), len(dannye)))
    if bez_nomera:
        print("БЕЗ НОМЕРА (кнопка серая): %s" % ", ".join(bez_nomera))


SHABLON = r"""<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Прозвон · @VSEGO@ целей</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root{--bg:#0a0e18;--panel:#0e1524;--card:#121a2c;--ink:#eef1f7;--dim:#97a1b8;--faint:#6b768f;
    --line:#1e2940;--rule:#2a364f;--gold:#e3c88a;--ok:#7fb069;--red:#c4675a}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',-apple-system,sans-serif;
    font-size:16px;line-height:1.5;margin:0;-webkit-font-smoothing:antialiased}
  .w{max-width:900px;margin:0 auto;padding:26px 18px 90px}
  h1{font-size:28px;margin:0 0 6px;letter-spacing:-.02em}
  .sub{color:var(--dim);margin:0 0 18px;font-size:15px}
  .panel{position:sticky;top:0;z-index:20;background:rgba(10,14,24,.94);
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
    border-bottom:1px solid var(--line);padding:11px 0;margin-bottom:18px}
  .panel .in{max-width:900px;margin:0 auto;padding:0 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .schet{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--dim)}
  .schet b{color:var(--gold)}
  .svyaz{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--faint);
    border:1px solid var(--line);border-radius:999px;padding:4px 11px}
  .svyaz.est{color:var(--ok);border-color:#2a4030}
  .svyaz.zvonim{color:var(--gold);border-color:#3b3524}
  .potolok{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--faint);
    border:1px solid var(--line);border-radius:999px;padding:4px 11px}
  .potolok.skoro{color:var(--gold);border-color:#3b3524}
  .potolok.vsyo{color:var(--red);border-color:#4a2a28}
  .tajmer{font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--gold);
    align-self:center;letter-spacing:.06em}
  .zv.idet{background:var(--red);color:#fff}
  .zv.nelzya{background:var(--panel);color:var(--faint);border:1px solid var(--rule)}
  .nabor{background:var(--panel);border:1px solid #3b3524;border-radius:10px;
    padding:13px 15px;margin:0 0 12px}
  .nabor[hidden]{display:none}
  .nabor .pod{display:block;font-family:'JetBrains Mono',monospace;font-size:11.5px;
    letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:10px}
  .klav{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:260px}
  .klav button{background:var(--bg);border:1px solid var(--rule);border-radius:8px;
    color:var(--ink);font-family:'JetBrains Mono',monospace;font-size:20px;
    padding:14px 0;cursor:pointer;min-height:52px}
  .klav button:active{background:var(--gold);color:#0a0e18}
  .nazhato{display:block;margin-top:10px;font-family:'JetBrains Mono',monospace;
    font-size:15px;color:var(--dim);letter-spacing:.3em;min-height:20px}
  .beda{background:var(--red2);border:1px solid #4a2a28;border-radius:11px;
    padding:17px 19px;margin:0 0 20px}
  .beda h3{margin:0 0 8px;font-size:18px;color:#e0897a}
  .beda p{margin:0 0 7px;font-size:15px}
  .beda p:last-child{margin:0}
  .beda b{color:var(--ink)}
  button,.knopka{background:var(--panel);color:var(--ink);border:1px solid var(--rule);
    border-radius:7px;padding:9px 14px;font-family:inherit;font-size:14px;cursor:pointer}
  button:hover{border-color:var(--gold)}
  button.glav{background:var(--gold);color:#0a0e18;border-color:var(--gold);font-weight:700}
  select.f{min-width:150px}
  .c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:14px}
  .c.gotov{opacity:.55;border-color:#2a4030}
  .c.nelzya{border-color:#4a2a28}
  .c header{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap;margin-bottom:6px}
  .nom{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--faint);min-width:24px}
  .c h2{font-size:19px;margin:0;font-weight:600;flex:1 1 auto}
  .mark{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
    padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--faint);white-space:nowrap}
  .mark.bot{color:var(--gold);border-color:#3b3524}
  .delo{color:var(--dim);font-size:14.5px;margin:0 0 12px}
  /* Окно звонка. Видно сразу под названием: позвонить в неурочный час — сжечь цель. */
  .okno{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.04em;
        color:var(--ink);background:rgba(120,160,255,.10);border:1px solid rgba(120,160,255,.28);
        border-radius:6px;padding:4px 9px;margin:0 0 10px;display:inline-block}
  .okno.zapas{background:rgba(160,160,160,.10);border-color:rgba(160,160,160,.28);color:var(--faint)}
  .melko{font-size:12.5px;color:var(--faint);line-height:1.5}
  .pripiska em{display:block;font-style:normal;color:var(--faint);font-size:12.5px;margin-top:5px}
  .dey{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:11px}
  .zv{background:var(--gold);color:#0a0e18;font-weight:700;text-decoration:none;
    padding:10px 16px;border-radius:7px;font-family:'JetBrains Mono',monospace;font-size:15px}
  .ss{background:var(--panel);color:var(--dim);text-decoration:none;padding:10px 14px;
    border-radius:7px;border:1px solid var(--rule);font-size:14px}
  .ss:hover{border-color:var(--gold);color:var(--ink)}
  .ss.pl{border-color:#3b3524;color:var(--gold)}
  .chk{display:flex;gap:9px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);
    border-radius:8px;padding:11px 13px;margin-bottom:13px;font-size:14.5px;color:var(--dim);cursor:pointer}
  .chk input{width:20px;height:20px;min-width:20px;margin:1px 0 0}
  .chk b{color:var(--ink)}
  .polya{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .polya.glav{gap:12px}
  .polya.glav select{font-size:17px;padding:12px 13px}
  .polya.glav span{color:var(--gold)}
  .potom{margin-top:12px}
  .potom .zamet{font-size:13.5px;color:var(--faint);margin:9px 0 11px}
  .polya label{display:grid;gap:4px}
  .polya span{font-family:'JetBrains Mono',monospace;font-size:12.5px;letter-spacing:.08em;
    text-transform:uppercase;color:var(--faint)}
  .polya label:has(#posylka_1),.polya span:first-letter{}
  .skript{background:var(--panel);border:1px solid var(--line);border-radius:9px;
    padding:14px 16px;margin-bottom:13px}
  .skript .nisha{margin:0 0 10px;font-size:13px;color:var(--faint)}
  .skript .nisha b{color:var(--gold)}
  .skript ol{margin:0;padding:0;list-style:none;counter-reset:sh}
  .skript li{counter-increment:sh;margin-bottom:10px;font-size:16px;color:var(--ink);line-height:1.45}
  .skript li:last-child{margin-bottom:0}
  .sh{display:block;font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--faint);margin-bottom:2px}
  .sh::before{content:counter(sh) " · "}
  .sh-g{color:var(--gold)}
  .skript li em{display:block;font-style:normal;font-size:13px;color:var(--faint);margin-top:3px}
  .skript .vhod{margin:0 0 12px;font-size:16px;color:var(--ink);line-height:1.45}
  .skript .vhod em{display:block;font-style:normal;font-size:13px;color:var(--faint);margin-top:3px}
  /* Обе ветки видны ВСЕГДА. Поле «Кто ответил» только приглушает лишнюю:
     если бы ненужная пряталась, Маша в первые секунды звонка осталась бы без текста. */
  .vetka{border-top:1px solid var(--line);padding-top:10px;margin-top:12px;transition:opacity .15s}
  .vetka .zag{margin:0 0 8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;
    letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
  .vetka.tusklo{opacity:.3}
  /* Не уехало на сервер: надпись у самого поля, а не общая плашка на странице */
  label.neuehalo span::after{content:" · не уехало на сервер";color:#e5534b;font-weight:600}
  label.neuehalo input,label.neuehalo select,label.neuehalo textarea{border-color:#e5534b!important}
  .c.neuehalo-k>header::after{content:"часть данных не уехала на сервер — досылаем сами";
    display:block;color:#e5534b;font-size:12px;margin-top:4px}
  .vetka.tusklo .zag{color:var(--faint)}
  .vetka .pravilo{margin:0 0 9px;font-size:13.5px;color:var(--faint);
    border-left:2px solid var(--gold);padding-left:9px}
  .pripiska{font-size:13px;color:var(--faint);margin:12px 0 0;line-height:1.55}
  .pripiska b{color:var(--ink)}
  .polya input,.polya select{width:100%;background:var(--bg);border:1px solid var(--rule);border-radius:6px;
    color:var(--ink);font-family:inherit;font-size:15px;padding:9px 11px}
  .polya input:focus,.polya select:focus{outline:2px solid var(--gold);outline-offset:1px;border-color:transparent}
  details{margin-top:12px}
  summary{cursor:pointer;color:var(--faint);font-size:13.5px}
  details p{color:var(--dim);font-size:13.5px;margin:9px 0 0;line-height:1.6}
  .zakon{background:#241820;border:1px solid #4a2a28;border-radius:10px;padding:15px 17px;margin:0 0 20px}
  .zakon p{margin:0 0 7px;font-size:14.5px}.zakon p:last-child{margin:0}
  .zakon b{color:#e0897a}
  .pochemu{background:var(--panel);border:1px solid var(--line);border-radius:10px;
    padding:15px 17px;margin:0 0 22px}
  .pochemu p{margin:0 0 8px;font-size:14.5px;color:var(--dim)}
  .pochemu p:last-child{margin:0}
  .pochemu b{color:var(--ink)}
  @media(max-width:640px){.polya{grid-template-columns:1fr}.w{padding:20px 14px 80px}}
</style></head><body>

<!-- sdk.twilio.com отдаёт 403 на прямой запрос (проверено 22.09), берём с jsdelivr, версия закреплена -->
<script src="https://cdn.jsdelivr.net/npm/@twilio/voice-sdk@2.18.5/dist/twilio.min.js"></script>
<div class="panel"><div class="in">
  <span class="schet">Сделано <b id="sd">0</b> из @VSEGO@ · интересно <b id="int">0</b></span>
  <span class="svyaz" id="svyaz">линия не поднята</span>
  <span class="potolok" id="potolok">сегодня 0 из 20</span>
  <select class="f" id="filtr">
    <option value="vse">Показывать все</option>
    <option value="ne">Только неотработанные</option>
    <option value="int">Только «интересно»</option>
    <option value="bot">Только с ботом</option>
  </select>
  <button class="glav" id="skachat">Скачать ответы</button>
  <button id="kopir">Скопировать</button>
</div></div>

<div class="w">
  <div class="beda" id="beda" hidden></div>
  <h1>Прозвон: @VSEGO@ целей</h1>
  <p class="sub">Ответы сохраняются сами, прямо когда печатаешь. Можно закрыть и вернуться.</p>

  <div class="zakon">
    <p><b>Перед каждым звонком — проверь плашку.</b> Кнопка «Плашка Google» открывает поиск по компании.
    Ищем <b>Google Verified</b> — синюю галочку рядом с названием. Есть галочка — <b>не звоним</b>,
    ставим прочерк и идём дальше: такой звонок стоит им денег.
    <br><span class="melko">С 20 октября 2025 Google свёл все плашки в одну: <b>Google Verified</b>
    заменила Google Guaranteed, Google Screened и License Verified by Google. Старые названия
    ещё попадаются в статьях и в нашей разведке — это то же самое.</span></p>
    <p><b>Запись объявляем первой фразой — и только после этого пишем.</b> Калифорния
    и Флорида требуют согласия всех сторон: согласие здесь — это объявление в начале
    и то, что человек продолжил разговор. Сказали «не записывайте» — выключаем запись
    сразу, дальше пишем от руки. Без объявления не записываем вообще.</p>
    <p><b>Невада — пропускаем целиком.</b> Там на такие звонки нужна лицензия частного детектива.</p>
    <p><b>Запись используем только в письме этому же бизнесу.</b> Не показываем третьим лицам,
    не кладём в общие материалы, не цитируем на сайте. Это условие, на котором запись законна.</p>
    <p><b>Двадцать звонков в день, не больше.</b> С одного номера чаще — и оператор пометит
    нас как спам, после чего не дозвонимся вообще ни до кого.</p>
  </div>

  <div class="pochemu">
    <p><b>Почему звоним всем, а не только тем, у кого «чат на сайте».</b></p>
    <p>Метка слева про <b>сайт</b>, а не про телефон. Веб-чат и голосовой робот на номере —
    разные системы: чата может не быть, а трубку возьмёт робот, и наоборот.
    <b>Что на линии — показывает только звонок.</b></p>
    <p>И звонок полезен в обе стороны — но продаём мы разное.
    <b>Не взяли трубку</b>, или <b>ответил человек и не позвал записаться</b> — это Вера,
    первый этап тысяча долларов плюс сто девяносто девять в месяц.
    <b>Ответил робот</b> — Веру НЕ предлагаем: автоответ у них уже есть. Там другой разговор:
    если проверка покажет, что их нет в ответах нейросетей, — это Видимость.
    Пустых звонков тут нет.</p>
    <p class="melko">Сколько компаний вообще зовут записаться: по исследованию Invoca —
    только 36%. Это чужой замер, не наш; своего у нас нет, и выдавать его за свой нельзя.</p>
    <p>Заполняй поле <b>«Кто ответил»</b> честно — это и есть настоящая разведка,
    а не то, что мы угадали по сайту.</p>
  </div>

@RYADY@
</div>

<script>
(function(){
  var KLYUCH='prozvon-2026-09-21', POLYA=@POLYA@, IMENA=@IMENA@;
  var D={};
  try{ D=JSON.parse(localStorage.getItem(KLYUCH)||'{}'); }catch(e){ D={}; }

  function sohranit(){ try{ localStorage.setItem(KLYUCH,JSON.stringify(D)); }catch(e){} }
  function vzyat(i){ return D[i]||(D[i]={}); }

  document.querySelectorAll('[data-k]').forEach(function(el){
    var i=el.getAttribute('data-i'), k=el.getAttribute('data-k'), z=vzyat(i);
    if(el.type==='checkbox'){ el.checked=!!z[k]; } else if(z[k]!=null){ el.value=z[k]; }
    el.addEventListener(el.tagName==='SELECT'||el.type==='checkbox'?'change':'input',function(){
      z[k]= el.type==='checkbox'? el.checked : el.value;
      sohranit(); obnovit(); if(k==='kto') vetki(i); nasever(i,k,z[k]);
    });
  });

  // Ветка скрипта по тому, кто снял трубку. Робот и человек — два разных разговора:
  // роботу мы играем покупателя и просим переслать запись, человеку представляемся
  // сами и просим адрес под бесплатный замер в его пустой час.
  function vetki(i){
    var k=document.getElementById('k'+i); if(!k) return;
    var kto=(D[i]||{}).kto||'';
    var chel = kto==='человек';
    var bot  = (kto==='бот'||kto==='голосовое меню'||kto==='автоответчик');
    var vb=k.querySelector('.v-bot'), vc=k.querySelector('.v-chel');
    if(vb) vb.classList.toggle('tusklo', chel);
    if(vc) vc.classList.toggle('tusklo', bot);
  }

  function obnovit(){
    var sd=0,int_=0;
    for(var i=1;i<=IMENA.length;i++){
      var z=D[i]||{}, k=document.getElementById('k'+i); if(!k)continue;
      var gotov = !!(z.itog && z.itog!=='');
      k.classList.toggle('gotov',gotov);
      if(gotov)sd++;
      if(z.itog==='интересно')int_++;
    }
    document.getElementById('sd').textContent=sd;
    document.getElementById('int').textContent=int_;
    for(var j=1;j<=IMENA.length;j++) vetki(j);
    filtrovat();
  }

  function filtrovat(){
    var v=document.getElementById('filtr').value;
    for(var i=1;i<=IMENA.length;i++){
      var z=D[i]||{}, k=document.getElementById('k'+i); if(!k)continue;
      var pokaz=true;
      if(v==='ne') pokaz=!(z.itog&&z.itog!=='');
      else if(v==='int') pokaz=(z.itog==='интересно');
      else if(v==='bot') pokaz=!!k.querySelector('.mark.bot');
      k.style.display=pokaz?'':'none';
    }
  }
  document.getElementById('filtr').addEventListener('change',filtrovat);



  function tablica(){
    var sh=['№','компания'].concat(POLYA), str=[sh.join('\t')];
    for(var i=1;i<=IMENA.length;i++){
      var z=D[i]||{}, r=[i,IMENA[i-1]];
      POLYA.forEach(function(k){ var v=z[k]; r.push(v===true?'да':(v===false?'':(v==null?'':String(v)))); });
      str.push(r.join('\t'));
    }
    return str.join('\n');
  }

  document.getElementById('skachat').addEventListener('click',function(){
    var b=new Blob([ '﻿'+tablica() ],{type:'text/tab-separated-values;charset=utf-8'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(b); a.download='prozvon-otvety.tsv';
    document.body.appendChild(a); a.click(); a.remove();
  });
  document.getElementById('kopir').addEventListener('click',function(){
    var t=tablica();
    if(navigator.clipboard){ navigator.clipboard.writeText(t).then(function(){
      var k=document.getElementById('kopir'); var s=k.textContent;
      k.textContent='Скопировано'; setTimeout(function(){k.textContent=s;},1500);
    }); }
  });

  obnovit();

  // ─── Ключ из адреса. Маша открывает страницу по ссылке с ?k=…
  var KEY = (location.search.match(/[?&]k=([^&]+)/) || [])[1] || '';
  // Сколько осталось — спрашиваем у сервера. Он считает по журналу Twilio.
  var OSTALOS = null;                      // null значит «пока не знаем»
  function pokazat_potolok(){
    var el=document.getElementById('potolok'); if(!el) return;
    if(OSTALOS===null){ el.textContent='считаю звонки…'; el.className='potolok'; return; }
    if(OSTALOS==='neizvestno'){
      el.textContent='счёт недоступен'; el.className='potolok skoro'; return;
    }
    el.textContent='осталось '+OSTALOS+' из 20';
    el.className='potolok'+(OSTALOS<=0?' vsyo':(OSTALOS<=3?' skoro':''));
  }
  function sprosit_schet(){
    if(!KEY) return;
    fetch('/.netlify/functions/prozvon-schet?k='+encodeURIComponent(KEY))
      .then(function(r){ return r.json(); })
      .then(function(d){
        OSTALOS = d && d.neizvestno ? 'neizvestno'
                : (d && typeof d.ostalos==='number' ? d.ostalos : 'neizvestno');
        pokazat_potolok();
      })
      .catch(function(){ OSTALOS='neizvestno'; pokazat_potolok(); });
  }

  // ─── Ответы храним У НАС, не в браузере Маши: Андрей должен видеть ход прозвона.
  // localStorage остаётся страховкой на случай, если сеть моргнёт посреди звонка.
  // Раньше отправка была «выстрелил и забыл»: ответ не читался, ошибка глушилась.
  // 24.09 так сервер день отбрасывал карточки 57–66, а страница показывала «сохранено».
  // Теперь успех — только r.ok И j.ok. Неудача — один тихий повтор через 2.5 с (сетевая
  // икота не должна мигать красным), потом пометка У ПОЛЯ: Маше важно, какая именно
  // запись не уехала. Данные уже в localStorage — это «не уехало», а не «потеряно».
  // Неуехавшее помним между загрузками и досылаем при следующем открытии.
  // Ввод не блокируем никогда: она в середине звонка.
  var POSL={};   // номер последней отправки по полю: красить или гасить решает только она
  function hvost_get(){ try{ return JSON.parse(localStorage.getItem('prozvon-neuehalo')||'{}'); }catch(e){ return {}; } }
  function hvost_set(h){ try{ localStorage.setItem('prozvon-neuehalo', JSON.stringify(h)); }catch(e){} }
  function pometit(i, pole, ploho){
    var el=document.querySelector('[data-i="'+i+'"][data-k="'+pole+'"]');
    var lab=(el && el.closest) ? el.closest('label') : null;
    if(lab) lab.classList.toggle('neuehalo', !!ploho);
    else { var kk=document.getElementById('k'+i); if(kk) kk.classList.toggle('neuehalo-k', !!ploho); }
    var h=hvost_get(), kl=i+':'+pole;
    if(ploho) h[kl]=1; else delete h[kl];
    hvost_set(h);
  }
  function nasever(i, pole, znachenie, popytka){
    if(!KEY || !window.fetch) return;
    popytka=popytka||1;
    var kl=i+':'+pole, nomer=(POSL[kl]=(POSL[kl]||0)+1);
    fetch('/.netlify/functions/prozvon',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({k:KEY,i:i,pole:pole,znachenie:znachenie})})
    .then(function(r){ return r.ok ? r.json() : {ok:false}; })
    .then(function(j){ return !!(j && j.ok); })
    .catch(function(){ return false; })
    .then(function(ok){
      if(POSL[kl]!==nomer) return;             // уже ушла более свежая отправка — решает она
      if(ok){ pometit(i, pole, false); return; }
      if(popytka<2){
        setTimeout(function(){
          if(POSL[kl]!==nomer) return;
          // повтор с ТЕКУЩИМ значением: пока ждали, она могла допечатать,
          // и старое значение затёрло бы на сервере новое
          nasever(i, pole, (D[i]||{})[pole], popytka+1);
        }, 2500);
        return;
      }
      pometit(i, pole, true);
    });
  }

  // ─── Линия. Поднимается один раз на страницу.
  var device=null, idet=null, tik=null, svyaz=document.getElementById('svyaz');
  function sostoyanie(t,k){ svyaz.textContent=t; svyaz.className='svyaz'+(k?' '+k:''); }

  function beda(zagolovok, chto){
    var el=document.getElementById('beda');
    el.innerHTML='<h3>'+zagolovok+'</h3>'+chto; el.hidden=false;
    document.querySelectorAll('.zv[data-tel]').forEach(function(a){ a.classList.add('nelzya'); });
  }

  function podnyat(){
    if(!KEY){
      sostoyanie('нет ключа');
      beda('Ссылка открыта без ключа — звонить нельзя',
        '<p>В адресе страницы должен быть <b>?k=</b> и дальше ключ. Сейчас его нет, '
       +'поэтому линия не поднимается и кнопки звонка не работают.</p>'
       +'<p><b>Что делать:</b> открой страницу по полной ссылке, которую прислал ШТАБ. '
       +'Ссылку целиком, не обрезая хвост после вопросительного знака.</p>');
      return;
    }
    if(!window.Twilio || !window.Twilio.Device){
      sostoyanie('нет связи с Twilio');
      beda('Не загрузилась телефонная библиотека',
        '<p>Скорее всего мешает блокировщик рекламы или расширение: страница берёт её '
       +'с cdn.jsdelivr.net.</p><p><b>Что делать:</b> отключи блокировщик на этом адресе '
       +'и обнови страницу. Если не помогло — открой в другом браузере.</p>');
      return;
    }
    fetch('/.netlify/functions/zvonok-token?k='+encodeURIComponent(KEY))
      .then(function(r){ if(!r.ok) throw {kod:r.status}; return r.json(); })
      .then(function(d){
        device = new Twilio.Device(d.token, {codecPreferences:['opus','pcmu']});
        device.on('registered', function(){
          sostoyanie('спрашиваю микрофон','zvonim');
          navigator.mediaDevices.getUserMedia({audio:true})
            .then(function(st){
              st.getTracks().forEach(function(x){x.stop()});
              sostoyanie('линия готова','est'); vklyuchit();
            })
            .catch(function(){
              sostoyanie('микрофон закрыт');
              beda('Нет доступа к микрофону',
                '<p>Без него звонить из браузера нельзя.</p>'
               +'<p><b>Что делать:</b> нажми на замочек слева от адреса, разреши микрофон '
               +'и обнови страницу. И надень наушники — без них твой микрофон поймает '
               +'динамик, и в записи будет эхо.</p>');
            });
        });
        device.on('error', function(e){ sostoyanie('линия: '+(e&&e.message||'сбой')); });
        device.register();
      })
      .catch(function(e){
        // 404 — ключ не тот. Всё остальное — связь: интернет, блокировщик, сбой сайта.
        // Валить одно на другое нельзя: человек будет искать не там.
        if(e && e.kod===404){
          sostoyanie('ключ не подошёл');
          beda('Ключ в ссылке не подошёл',
            '<p>Сервер отказал именно этому ключу. Скорее всего ссылка скопирована '
           +'не целиком.</p><p><b>Что делать:</b> попроси у ШТАБА свежую ссылку и открой '
           +'её полностью, вместе с хвостом после вопросительного знака.</p>');
        } else {
          sostoyanie('нет связи');
          beda('Не получилось связаться с сервером',
            '<p>Ключ тут, скорее всего, ни при чём — не прошёл сам запрос'
           +(e&&e.kod?' (ответ '+e.kod+')':'')+'.</p>'
           +'<p><b>Что делать:</b> проверь интернет и обнови страницу. Если не помогло — '
           +'отключи блокировщик на этом адресе. Если и это не помогло — скажи ШТАБУ.</p>');
        }
      });
  }

  // 23.09: кнопки вешаем ОДИН раз и НЕЗАВИСИМО от того, поднялась ли линия.
  // Так было сломано утром: vklyuchit() звали только из ветки успеха getUserMedia,
  // и при закрытом микрофоне, чужом ключе или упавшем токене обработчик не вешался
  // вовсе — href="#" просто кидал страницу наверх. Хуже того, ветка
  // «Линия не поднята — смотри красную рамку» внутри обработчика не могла сработать
  // никогда, потому что самого обработчика не было. Чинится здесь, в генераторе,
  // а не в собранном list.html: правку в html стирает следующая пересборка.
  var NAVESHENO=false;
  function vklyuchit(){
    if(NAVESHENO) return; NAVESHENO=true;
    document.querySelectorAll('.zv[data-tel]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        if(!device){
          alert('Линия не поднята — смотри красную рамку вверху страницы, там написано почему.');
          return;
        }
        if(idet){ idet.disconnect(); return; }
        if(OSTALOS===0){
          alert('На сегодня двадцать звонков сделано — это по журналу телефонии, '
              + 'а не по нажатиям. Больше с одного номера в день не звоним, иначе '
              + 'оператор пометит нас спамом. Продолжим завтра.');
          return;
        }
        pozvonit(a);
      });
    });
  }

  function chasy(el, s0){
    return setInterval(function(){
      var s=Math.floor((Date.now()-s0)/1000);
      el.textContent=('0'+Math.floor(s/60)).slice(-2)+':'+('0'+(s%60)).slice(-2);
    },1000);
  }

  function pozvonit(a){
    var i=a.getAttribute('data-i'), nomer=a.getAttribute('data-tel');
    var t=document.getElementById('t'+i), s0=Date.now(), bylo=a.textContent;
    device.connect({params:{To:nomer, kompaniya:String(i)}}).then(function(c){
      idet=c; a.classList.add('idet'); a.textContent='Положить трубку';
      var nab=document.getElementById('n'+i), nz=document.getElementById('nz'+i);
      if(nab){
        nab.hidden=false; nz.textContent='';
        nab.querySelectorAll('[data-cifra]').forEach(function(b){
          b.onclick=function(){
            var c=b.getAttribute('data-cifra');
            try{ idet.sendDigits(c); nz.textContent+=c; }catch(e){}
          };
        });
      }
      c.on('accept', function(){ if(typeof OSTALOS==='number' && OSTALOS>0){ OSTALOS--; pokazat_potolok(); } });
      t.hidden=false; t.textContent='00:00'; tik=chasy(t,s0);
      sostoyanie('идёт разговор','zvonim');

      c.on('disconnect', function(){
        clearInterval(tik); idet=null;
        a.classList.remove('idet'); a.textContent=bylo;
        var nab2=document.getElementById('n'+i);
        if(nab2){
          var nazh=document.getElementById('nz'+i).textContent;
          nab2.hidden=true;
          if(nazh){ vzyat(i).cifry=nazh; nasever(i,'cifry',nazh); }
        }
        sostoyanie('линия готова','est');
        var sek=Math.floor((Date.now()-s0)/1000);
        var sid=(c.parameters&&c.parameters.CallSid)||c.outboundConnectionId||'';
        var z=vzyat(i); z.sek=String(sek); z.call_sid=sid;
        var pole=document.getElementById('sek_'+i); if(pole) pole.value=String(sek);
        sohranit(); nasever(i,'sek',String(sek)); if(sid) nasever(i,'call_sid',sid);
        sprosit_schet();                 // после отбоя сверяемся с журналом
        if(sid) podobrat(i,sid,0);
      });
    }).catch(function(){ sostoyanie('не дозвонились','est'); });
  }

  // Запись готовится у Twilio не мгновенно — спрашиваем с паузами, не чаще.
  function podobrat(i,sid,popytka){
    if(popytka>6) return;
    setTimeout(function(){
      fetch('/.netlify/functions/zvonok-zapis?k='+encodeURIComponent(KEY)+'&sid='+encodeURIComponent(sid))
        .then(function(r){return r.json()})
        .then(function(d){
          if(d && d.gotovo && d.url){
            var z=vzyat(i); z.zapis_url=d.url; sohranit(); nasever(i,'zapis_url',d.url);
            var k=document.getElementById('k'+i);
            if(k && !k.querySelector('.zapis')){
              var a=document.createElement('a');
              a.className='ss zapis'; a.href=d.url; a.target='_blank'; a.rel='noopener';
              a.textContent='Запись разговора';
              k.querySelector('.dey').appendChild(a);
            }
          } else { podobrat(i,sid,popytka+1); }
        })
        .catch(function(){ podobrat(i,sid,popytka+1); });
    }, 5000*(popytka+1));
  }

  pokazat_potolok();
  // ─── РАЗОВАЯ ДОСЫЛКА. 24.09: сервер знал только 56 карточек, а на странице их 66,
  // и всё, что Маша печатала по целям 57–66, он МОЛЧА отбрасывал. Предел поднят,
  // но уже набранное само не уедет: наверх мы шлём только при изменении поля.
  // Шлём ТОЛЬКО карточки 57–66 и только непустые поля — по 1–56 у сервера всё есть,
  // и трогать их значит рисковать затереть более свежее чужой стариной.
  // Один раз на браузер, метка в localStorage.
  // Метку ставим ТОЛЬКО когда сервер подтвердил КАЖДОЕ поле (ШТАБ, 24.09). Первая версия
  // ставила её сразу, не дожидаясь ответа, а nasever() ответ не читает и ошибку глушит:
  // моргнула сеть или вкладку закрыли раньше — метка уже стоит, повтора нет, медспа
  // потеряны молча. Ровно тот класс, что и сам баг с пределом. Повтор безопасен:
  // сервер перезапишет то же поле тем же значением. Ключ метки новый (-v2), чтобы
  // старая версия, если успела отработать неудачно, не заперла повтор.
  (function dosylka(){
    if(!KEY || !window.fetch || !window.Promise) return;
    var METKA='prozvon-dosylka-57-66-v2';
    try{ if(localStorage.getItem(METKA)) return; }catch(e){ return; }
    var zadachi=[];
    for(var i=57;i<=66;i++){
      var z=D[i]; if(!z) continue;            // D[i], а не vzyat(): тот создал бы пустую карточку
      for(var k in z){
        if(!Object.prototype.hasOwnProperty.call(z,k)) continue;
        var v=z[k];
        if(v===''||v===null||v===undefined) continue;
        zadachi.push(fetch('/.netlify/functions/prozvon',{method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({k:KEY,i:i,pole:k,znachenie:v})})
          .then(function(r){ return r.ok ? r.json() : {ok:false}; })
          .then(function(j){ return !!(j && j.ok); })
          .catch(function(){ return false; }));
      }
    }
    if(!zadachi.length){ try{ localStorage.setItem(METKA,'pusto'); }catch(e){} return; }
    Promise.all(zadachi).then(function(itog){
      var doehalo=itog.filter(Boolean).length;
      if(doehalo===itog.length){ try{ localStorage.setItem(METKA,'1'); }catch(e){} }
      console.log('[прозвон] досылка 57-66: доехало '+doehalo+' из '+itog.length+
        (doehalo===itog.length ? '' : ' — повторим при следующей загрузке'));
    });
  })();

  // Что не уехало на сервер в прошлые открытия — досылаем сейчас, текущими значениями.
  // Пока сервер не подтвердил, пометка горит: видно, что висит.
  (function hvost(){
    var h=hvost_get(), zhivye=[];
    Object.keys(h).forEach(function(kl){
      var p=kl.split(':'), i=p[0], pole=p.slice(1).join(':'), z=D[i];
      if(z && Object.prototype.hasOwnProperty.call(z,pole)) zhivye.push([i,pole]); else delete h[kl];
    });
    hvost_set(h);
    zhivye.forEach(function(x){ pometit(x[0], x[1], true); nasever(x[0], x[1], D[x[0]][x[1]]); });
  })();

  sprosit_schet();
  vklyuchit();   // кнопки живые с первой секунды, даже если линия не поднимется
  podnyat();
})();
</script>
</body></html>
"""

if __name__ == "__main__":
    main()
