# -*- coding: utf-8 -*-
"""Проверка ручных ответов (PDF) до того, как человек потратит весь вечер.

Что смотрит по каждому файлу: имя разобрано правильно · вопрос в файле тот самый и ровно один ·
ответ не обрезан · ходила ли нейросеть в интернет · сколько поисковых запросов видно.
Ничего не меняет и не удаляет — только печатает.

Запуск:  python3 proverka_otvetov.py [2026-09-16]
"""
import json
import pathlib
import re
import sys
import unicodedata

from pypdf import PdfReader

ZDES = pathlib.Path(__file__).resolve().parent
OTVETY = ZDES / 'otvety'
VOPROSY = ZDES.parent / 'kalibrovka' / 'voprosy.json'
IMYA = re.compile(r'^([A-Z]+\d+)_([a-z0-9-]+)_(\d{4}-\d{2}-\d{2})_(andrey|masha)\.(pdf|txt|html?|webarchive)$')
POISK = re.compile(r'Searched the web|Searching the web|Искал[а]? в интернете|Ищу в интернете|'
                   r'Поиск в (?:сети|интернете)|Sources|Источники|Citations|Цитаты', re.I)


def chisto(s):
    """Печать из браузера рвёт слова пробелами и подменяет буквы — сводим к сравнимому виду."""
    s = unicodedata.normalize('NFKD', s or '').lower()
    s = s.replace('ĸ', 'к').replace('́', '')
    return re.sub(r'[^0-9a-zа-яё]+', '', s)


SLUZHEBNOE = re.compile(r'claude\.ai|chatgpt\.com|perplexity\.ai|google\.com|New chat|Incognito chat|'
                        r'^\s*\d+/\d+\s*$|^\s*\d{1,2}/\d{1,2}/\d{2,4}|aren.t saved|Write a message|Ask anything', re.I)


def telo_otveta(t):
    """Печать из браузера дописывает шапку и подвал (адрес страницы, дату, «2/2») — это не ответ."""
    return [ln for ln in t.split('\n') if ln.strip() and not SLUZHEBNOE.search(ln)]


def tekst_html(put):
    """Сохранённая страница: берём текст и заодно адреса ссылок — в PDF их не видно."""
    h = put.read_text(encoding='utf-8', errors='ignore')
    h = re.sub(r'<(script|style|noscript|svg)[\s\S]*?</\1>', ' ', h, flags=re.I)
    # у ссылок ChatGPT в хвосте стоит utm_source=chatgpt.com — отсеивать надо по домену, а не по строке
    ssylki = [u for u in re.findall(r'href="(https?://[^"]+)"', h)
              if not re.match(r'https?://(www\.)?(chatgpt\.com|openai\.com|help\.openai\.com|cdn\.|fonts\.)', u)]
    t = re.sub(r'<[^>]+>', ' ', h)
    for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&quot;', '"'), ('&#39;', "'"), ('&lt;', '<'), ('&gt;', '>')):
        t = t.replace(a, b)
    return re.sub(r'[ \t]+', ' ', t) + '\n' + '\n'.join(dict.fromkeys(ssylki))


def tekst_fayla(put):
    if put.suffix.lower() in ('.html', '.htm'):
        return tekst_html(put)
    if put.suffix.lower() == '.txt':
        return put.read_text(encoding='utf-8', errors='ignore')
    return tekst_pdf(put)


def tekst_pdf(put):
    try:
        return '\n'.join(p.extract_text() or '' for p in PdfReader(put).pages)
    except Exception as e:
        return '!!ОШИБКА ЧТЕНИЯ: %s' % e


def main():
    den = sys.argv[1] if len(sys.argv) > 1 else None
    qs = {q['id']: q for q in json.loads(VOPROSY.read_text(encoding='utf-8'))['voprosy']}
    faily = sorted(f for f in OTVETY.iterdir()
                   if f.suffix.lower() in ('.pdf', '.txt', '.html', '.htm') and not f.name.startswith('.'))
    if den:
        faily = [f for f in faily if den in f.name]
    if not faily:
        print('файлов нет')
        return
    print('проверяю %d файлов\n' % len(faily))
    bed = []
    for f in faily:
        m = IMYA.match(f.name)
        if not m:
            bed.append('%s — имя не по образцу (нужно N01_claude_2026-09-16_andrey.pdf)' % f.name)
            continue
        qid, dvizhok, dat, kto, _ = m.groups()
        q = qs.get(qid)
        t = tekst_fayla(f)
        if t.startswith('!!'):
            bed.append('%s — %s' % (f.name, t))
            continue
        tc = chisto(t)
        svoy = q and chisto(q['text'])[:60] in tc
        chuzhie = [x['id'] for x in qs.values() if x['id'] != qid and chisto(x['text'])[:60] in tc]
        poiskov = len(re.findall(POISK, t))
        # обрыв ловим не по знаку в конце: ответ часто кончается плашкой источника без точки.
        # Признак настоящего обрыва — последняя строка оборвана на середине слова.
        stroki = telo_otveta(t)
        # у сохранённой страницы обрыва быть не может: там весь разговор целиком
        oborvan = f.suffix.lower() not in ('.html', '.htm') and bool(stroki) and bool(re.search(r'[A-Za-zА-Яа-яЁё]{2,}\u2026?$', stroki[-1].strip())) and len(stroki[-1].strip()) > 80
        print('%-42s %5d знаков · поиск: %-3s · %s' % (f.name, len(t), 'да' if poiskov else 'нет',
                                                       'вопрос совпал' if svoy else 'ВОПРОС НЕ НАЙДЕН'))
        if chuzhie:
            bed.append('%s — в файле ещё и другие вопросы: %s (значит спрашивали в одном чате)' % (f.name, ', '.join(chuzhie)))
        if not svoy:
            bed.append('%s — вопроса %s в файле нет: проверьте, тот ли ответ сохранён' % (f.name, qid))
        if oborvan:
            bed.append('%s — похоже, текст обрывается: «…%s»' % (f.name, stroki[-1].strip()[-40:]))
        if len(t) < 400:
            bed.append('%s — подозрительно мало текста (%d знаков)' % (f.name, len(t)))
    est = {IMYA.match(f.name).group(1) for f in faily if IMYA.match(f.name)}
    print('\nсохранено вопросов: %d — %s' % (len(est), ', '.join(sorted(est))))
    print('\n'.join(['', 'НАДО ПОСМОТРЕТЬ:'] + ['  · ' + x for x in bed]) if bed else '\nвсё чисто, можно идти дальше')


if __name__ == '__main__':
    main()
