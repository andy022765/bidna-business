# -*- coding: utf-8 -*-
"""Личные памятки к замеру в Word — отдельно Андрею и Маше, на конкретный вечер.

Берёт вопросы из kalibrovka/voprosy.json и строки из tablica-<кто>.csv, собирает
по одному .docx на человека: порядок действий, подготовка под его нейросети,
таблица вопросов в правильном порядке (вопросы с именем — последними) и что отмечать.

Запуск:  python3 sobrat_word.py 2026-09-16
"""
import csv
import json
import pathlib
import sys

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

ZDES = pathlib.Path(__file__).resolve().parent
VOPROSY = ZDES.parent / 'kalibrovka' / 'voprosy.json'
LYUDI = {'andrey': 'Андрей', 'masha': 'Маша'}

PODGOTOVKA = {
    'ChatGPT, без логина, инкогнито': [
        'Новое окно инкогнито (Cmd+Shift+N) на КАЖДЫЙ вопрос. Кнопку «Новый чат» не жать.',
        'В аккаунт не входить. Если просит войти — закрыть окно и открыть новое инкогнито.',
    ],
    'Claude, свой аккаунт, режим инкогнито': [
        'Свой аккаунт, но каждый чат — в режиме инкогнито (значок при создании чата).',
        'Поиск в интернете включён. Глубокое исследование и расширенное мышление выключены.',
        'Сохранять страницей целиком, а не печатью: 16.09 печать в PDF потеряла все ссылки на источники.',
    ],
    'ChatGPT, чистый аккаунт, временный чат': [
        'Чистый аккаунт на новую почту, память выключена, «о себе» пустое.',
        'Каждый вопрос — во временном чате.',
    ],
    'Perplexity, без логина, приватное окно': [
        'Без логина, приватное окно, режим по умолчанию (не Pro, не Research).',
    ],
    'Google AI Mode, Firefox, приватное окно': [
        'Firefox, приватное окно (Cmd+Shift+P), в Google не входить.',
        'Ссылку из GOOGLE-AI-MODE-ssylki.txt вставлять прямо в адресную строку — вопрос уже внутри ссылки.',
        'Если открылся обычный список ссылок — нажать вкладку AI Mode вверху страницы.',
    ],
}


def zagolovok(d, tekst, razmer=16, otstup=10):
    p = d.add_paragraph()
    r = p.add_run(tekst)
    r.bold = True
    r.font.size = Pt(razmer)
    p.paragraph_format.space_before = Pt(otstup)
    p.paragraph_format.space_after = Pt(4)
    return p


def stroka(d, tekst, zhirno=False, razmer=11, otstup_sleva=0):
    p = d.add_paragraph()
    r = p.add_run(tekst)
    r.bold = zhirno
    r.font.size = Pt(razmer)
    p.paragraph_format.space_after = Pt(3)
    if otstup_sleva:
        p.paragraph_format.left_indent = Pt(otstup_sleva)
    return p


def sobrat(kto, den):
    qs = {q['id']: q for q in json.loads(VOPROSY.read_text(encoding='utf-8'))['voprosy']}
    rows = [r for r in csv.DictReader(open(ZDES / ('tablica-%s.csv' % kto), encoding='utf-8-sig'))
            if r['день'] == den]
    if not rows:
        return None
    d = Document()
    d.styles['Normal'].font.name = 'Helvetica'
    d.styles['Normal'].font.size = Pt(11)

    zagolovok(d, 'Замер видимости · %s · %s' % (LYUDI[kto], '.'.join(reversed(den.split('-')))[:5]), 18, 0)
    stroka(d, 'Начинать между 19:00 и 20:00 по Лос-Анджелесу — в это же время работает наша программа. '
              'Если ответы получены в разное время, сравнивать их нельзя.')
    stroka(d, 'Всего ответов сегодня: %d. Примерно 2–3 минуты на ответ.' % len(rows), True)
    if all(qs[r['вопрос']]['opornyy'] for r in rows):
        stroka(d, 'Сегодня только шесть опорных вопросов — это контрольная точка. Проверяем, что ноль держится, '
                  'и добираем пары «приложение против программы». Новых работ по своей видимости мы не делали, '
                  'поэтому ждать перемен неоткуда: ровный результат — это хороший результат.')

    zagolovok(d, 'Порядок на каждый вопрос')
    for i, t in enumerate([
        'Открыть новое окно инкогнито.',
        'Открыть вопрос со своей страницы «%s» (где ссылкой нельзя — кнопка «Скопировать»).'
        % ('SSYLKI-%s-%s.html' % ('.'.join(reversed(den.split('-')))[:5], LYUDI[kto])),
        'Дождаться, пока ответ допишется до конца. Ничего не уточнять и не переспрашивать.',
        'Открыть список источников (Sources), чтобы ссылки были видны.',
        'Cmd+S → «Веб-страница, полностью» (Web Page, Complete), имя файла — из таблицы, папка zamer-v1/otvety/.',
        'Рядом с файлом появится папка с таким же именем и хвостом _files — её не удалять и не переименовывать.',
        'Заполнить строку в своей таблице.',
    ], 1):
        stroka(d, '%d. %s' % (i, t), otstup_sleva=12)
    stroka(d, 'Назван ли кто-то в ответе — НЕ отмечаем. Это размечу я потом, одним правилом для всех.', True)

    zagolovok(d, 'После первых трёх ответов')
    stroka(d, 'Написать мне «три готово» и подождать. Проверю, что файлы и строки в порядке, — пять минут. '
              'Если что-то не так, поправим сразу, а не после всего вечера.')

    for dv in sorted({r['нейросеть и режим'] for r in rows}):
        moi = [r for r in rows if r['нейросеть и режим'] == dv]
        zagolovok(d, '%s — %d вопросов' % (dv, len(moi)), 14)
        for t in PODGOTOVKA.get(dv, []):
            stroka(d, '• ' + t, otstup_sleva=12)
        t = d.add_table(rows=1, cols=4)
        t.style = 'Table Grid'
        for c, (tekst, shirina) in zip(t.rows[0].cells, [('№', 6), ('Вопрос — вставлять дословно', 62),
                                                         ('Имя файла', 26), ('Готово', 6)]):
            c.text = ''
            r = c.paragraphs[0].add_run(tekst)
            r.bold = True
            r.font.size = Pt(10)
        for n, row in enumerate(moi, 1):
            q = qs[row['вопрос']]
            cells = t.add_row().cells
            cells[0].text = '%d' % n
            p = cells[1].paragraphs[0]
            r = p.add_run(q['text'])
            r.font.size = Pt(10)
            if q['s_imenem']:
                r.italic = True
                pp = cells[1].add_paragraph()
                rr = pp.add_run('вопрос с нашим именем — задавать в самом конце')
                rr.font.size = Pt(8)
                rr.font.color.rgb = RGBColor(0xB3, 0x54, 0x1E)
            cells[2].paragraphs[0].add_run(row['файл']).font.size = Pt(8)
            cells[3].text = ''
        stroka(d, ' ')

    zagolovok(d, 'Что отмечать в таблице')
    for t in ['время (по Лос-Анджелесу)', 'модель на экране, если видно', 'ходила ли в интернет (есть ли источники)',
              'показала ли свои поисковые запросы', 'было ли уточнение или отказ отвечать',
              'была ли карта или карточки мест', 'была ли реклама рядом с ответом', 'сколько минут ушло',
              'заметка — всё странное']:
        stroka(d, '• ' + t, otstup_sleva=12)

    zagolovok(d, 'Чего не делать')
    for t in ['Не отвечать нейросети на уточнения и не переспрашивать.',
              'Не называть себя и не писать ничего про нас.',
              'Не заходить со своих рабочих аккаунтов: их память подмешает нашу историю.',
              'Не нажимать на ссылки на наш сайт из ответа.',
              'Не искать наш бренд в Google весь вечер.',
              'Не менять формулировку вопроса ни на букву.',
              'Не задавать вопросы с нашим именем раньше остальных.']:
        stroka(d, '• ' + t, otstup_sleva=12)

    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run('Вопросы и таблица: Pivot/agenty/smotritel/zamer-v1 — SSYLKI-%s-%s.html и tablica-%s.csv'
                  % ('.'.join(reversed(den.split('-')))[:5], LYUDI[kto], kto))
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor(0x6B, 0x6B, 0x6B)

    put = ZDES / ('Замер %s — %s.docx' % ('.'.join(reversed(den.split('-')))[:5], LYUDI[kto]))
    d.save(put)
    return put, len(rows)


if __name__ == '__main__':
    den = sys.argv[1] if len(sys.argv) > 1 else '2026-09-16'
    for kto in LYUDI:
        r = sobrat(kto, den)
        print('%s: %s (%d вопросов)' % (LYUDI[kto], r[0].name, r[1]) if r else '%s: на %s строк нет' % (LYUDI[kto], den))
