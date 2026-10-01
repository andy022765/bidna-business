#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Лист правды — две анкеты из движка интейка.

    python3 shtab/sayty/list_pravdy.py

Почему генератор, а не правка готовых файлов: 23.09 ГОЛОС починил баг прямо в
собранном list.html, я пересобрал — и баг вернулся. Правка в сгенерированном файле
не существует. Всё, что ниже, живёт здесь.

Берёт готовые анкеты интейка как движок (голосовой ввод, автосохранение, выгрузка
файлом уже отлажены), подменяет данные и чистит остатки чужого продукта.

ГЛАВНОЕ, ЧТО ЗДЕСЬ ЧИНИТСЯ. Движок взят у анкеты ДИАГНОСТИКИ, и вместе с ним
приезжает её текст: заголовок вкладки про ДНК бизнеса и экран после отправки,
обещающий стратегическую сессию, изучение рынка и документ до созвона. Человек,
сдавший лист правды к ПРИЁМКЕ ЛИНИИ, ничего этого не покупал. Поймал ГОЛОС 23.09,
до первого клиента.
"""
import io, json, os, re, subprocess, sys

ZDES = os.path.dirname(os.path.abspath(__file__))
KORENJ = os.path.dirname(os.path.dirname(ZDES))
VYHOD = os.path.join(ZDES, "dlya-golosa")

# движок · данные · куда · чем заменить заголовок и экран «что дальше»
NABORY = [
    dict(dvizhok=os.path.join(ZDES, "dlya-golosa/intake-b-9f2r5t.html"),
         dannye="list_pravdy_en_dannye.py",
         fajl="list-pravdy-t4k8m2.html",
         titul="Truth sheet — line audit",
         forma="list-pravdy-en", kluch="bidna_list_pravdy_en", vlozhenie="truth-sheet.txt",
         bylo_titul="Starting questions — building your business DNA",
         bylo_dalshe=("An email with the booking link is already on its way to you — "
                      "<b>pick a time for the strategy session</b>. Only the slots the work will "
                      "certainly be ready for are open in the calendar. In the meantime we study "
                      "your market and build your business DNA; the document reaches you before "
                      "the call, so you can read it through on your own."),
         pary=[("<h2>Received. We are starting on your study.</h2>",
                "<h2>Got it. Your sheet is with us.</h2>"),
               ("The answers come to us and we start on your study.",
                "The answers come to us and we read the sheet."),
               ("Full intake in the attached file",
                "Full truth sheet in the attached file"),
               ("We send the confirmation and the booking link there.",
                "We send the confirmation there, and the questions if any come up."),
               ("Leave your name and email — we send the booking link there",
                "Leave your name and email — that is where we reply")],
         stalo_dalshe=("We read the sheet through and come back <b>once</b> with anything still "
                       "unclear — one round, not a stream of questions. The moment you approve it, "
                       "the thirty calls begin, across a grid of hours, including the weekend and "
                       "late evening. Until you approve it, we do not dial your number once.")),
    dict(dvizhok=os.path.join(KORENJ, "landings/anketa-b-7k3m9x.html"),
         dannye="list_pravdy_ru_dannye.py",
         fajl="list-pravdy-ru-t4k8m2.html",
         titul="Лист правды — приёмка линии",
         forma="list-pravdy-ru", kluch="bidna_list_pravdy_ru", vlozhenie="list-pravdy.txt",
         bylo_titul="Вопросы для старта — сборка ДНК вашего бизнеса",
         bylo_dalshe=("На вашу почту уже ушло письмо со ссылкой на запись — <b>выберите время "
                      "стратегической сессии</b>. В календаре открыты только те слоты, к которым "
                      "разбор точно будет готов. Мы тем временем изучаем ваш рынок и собираем ДНК "
                      "бизнеса; документ придёт вам до созвона, чтобы вы прочитали его спокойно сами."),
         pary=[("<h2>Интейк получен. Мы приступаем к разбору.</h2>",
                "<h2>Готово. Лист правды у нас.</h2>"),
               ("Ответы уйдут к нам, и мы садимся за ваш разбор.",
                "Ответы уйдут к нам, и мы садимся читать лист."),
               ("одного контакта недостаточно, ответы и есть основа разбора",
                "одного контакта недостаточно, ответы и есть то, по чему мы проверяем линию"),
               ("Полный интейк — в приложенном файле",
                "Полный лист правды — в приложенном файле"),
               ("На него пришлём подтверждение и ссылку на запись разбора.",
                "На него пришлём подтверждение, а следом — вопросы, если они появятся."),
               ("Оставьте имя и email или Telegram — на них пришлём ссылку на запись",
                "Оставьте имя и email или Telegram — туда и ответим")],
         stalo_dalshe=("Мы читаем лист целиком и возвращаемся <b>один раз</b> с тем, что осталось "
                       "непонятным — один заход, а не поток вопросов. Как только вы утвердите лист, "
                       "начинаются тридцать звонков по сетке часов, включая выходной и поздний вечер. "
                       "Пока не утвердили — ваш номер мы не набираем ни разу.")),
]

STARYE_IMENA = {"intake-business-en": None, "intake-business": None}


def dannye(put):
    """Данные лежат отдельными файлами: их правят, а движок — нет."""
    tmp = os.path.join(VYHOD, "._dannye.json")
    subprocess.run([sys.executable, os.path.join(ZDES, put), tmp], check=True,
                   stdout=subprocess.DEVNULL)
    d = io.open(tmp, encoding="utf-8").read()
    os.remove(tmp)
    return d


def podmenit_data(t, novoe):
    i = t.find("var DATA=")
    d, j = 0, i + len("var DATA=")
    while True:
        c = t[j]
        if c == "{":
            d += 1
        elif c == "}":
            d -= 1
            if d == 0:
                j += 1
                break
        j += 1
    return t[:i] + "var DATA=" + novoe + t[j:]


def main():
    for n in NABORY:
        t = io.open(n["dvizhok"], encoding="utf-8").read()
        t = podmenit_data(t, dannye(n["dannye"]))
        # заголовок вкладки: он же уходит в закладку
        assert t.count("<title>%s</title>" % n["bylo_titul"]) == 1, n["fajl"] + ": заголовок не найден"
        t = t.replace("<title>%s</title>" % n["bylo_titul"], "<title>%s</title>" % n["titul"])
        # экран после отправки: чужой продукт
        assert t.count(n["bylo_dalshe"]) == 1, n["fajl"] + ": экран «что дальше» не найден"
        t = t.replace(n["bylo_dalshe"], n["stalo_dalshe"])
        # блок контактов обещает «ссылку на запись» — её в приёмке нет
        for bylo, stalo in n.get("pary", []):
            assert t.count(bylo) == 1, n["fajl"] + ": не найдено — " + bylo[:40]
            t = t.replace(bylo, stalo)
        # своё имя формы и свой ключ хранения: иначе смешается с анкетой диагностики
        for staroe in STARYE_IMENA:
            t = t.replace('<form name="%s"' % staroe, '<form name="%s"' % n["forma"])
            t = t.replace('FORMNAME="%s"' % staroe, 'FORMNAME="%s"' % n["forma"])
        t = re.sub(r'KEY="bidna_intake_\w+"', 'KEY="%s"' % n["kluch"], t)
        t = t.replace("'intake-business-en.txt'", "'%s'" % n["vlozhenie"])
        t = t.replace("'Интейк-бизнес.txt'", "'%s'" % n["vlozhenie"]).replace("'Интейк-бизнес'", "'Лист правды'")
        t = t.replace("Deep diagnostic · questionnaire", "Line audit · truth sheet")
        t = t.replace("Глубокая диагностика · анкета", "Приёмка линии · лист правды")
        put = os.path.join(VYHOD, n["fajl"])
        io.open(put, "w", encoding="utf-8").write(t)
        D = json.loads(re.search(r"var DATA=(\{.*?\});?\s*\n", t, re.S).group(1)) if False else None
        print("  %-30s %5.0f КБ · форма %s" % (n["fajl"], len(t.encode()) / 1024, n["forma"]))
    print("\nсобрано в %s" % VYHOD)


if __name__ == "__main__":
    main()
