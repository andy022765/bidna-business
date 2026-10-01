# -*- coding: utf-8 -*-
"""Таблицы к отчёту замера видимости. ТОЛЬКО ЧТЕНИЕ: в API не ходит, файлов не пишет.

Закрывает то, чего не умеют скрипты Смотрителя (собрано 29.09 для скилла zamer-vidimosti):
  · полнота по сочетаниям, включая выпавший движок (у kriteriy-v2 выпавший движок = нет строки);
  · «назван» раздельно: в ТЕКСТЕ ответа и ТОЛЬКО В ИСТОЧНИКАХ (kriteriy-v2 складывает оба);
  · фильтр по дню и слоту (kriteriy-v2 берёт все дни папки, включая proba);
  · верхний источник по вопросу и по движку, доля .ru/.by по движку и языку, model_v_otvete;
  · --traty: трата за месяц по ВСЕМ наборам, включая ID вида V1R (регулярка progon.py их не видит).
Вердикт «условие возврата» НЕ печатает нарочно: решает Андрей, по правилам из SKILL.md.

  python3 tablicy.py zamer-v5 --den 2026-10-01 --slot den
  python3 tablicy.py zamer-k-<клиент> --imya "<regex>" --primery 3
  python3 tablicy.py zamer-v2-posle --povtorov 1          # наборы Веры, протокол v1
  python3 tablicy.py --traty 2026-10
"""
import argparse
import collections
import json
import pathlib
import re
import sys

KOREN = pathlib.Path(__file__).resolve().parents[3]
SM = KOREN / 'Pivot' / 'agenty' / 'smotritel'
sys.dont_write_bytecode = True   # не оставлять .pyc в папке проекта
sys.path.insert(0, str(SM / 'zamer-v1'))
import razmetka as R   # одно правило «это мы» на все наборы: R.NASHE_IMYA

DVIZHKI = ('openai', 'anthropic', 'perplexity')


def otvety(papka, den, slot):
    for f in sorted((SM / papka / 'api').glob('*/*/*/[A-Z]*.json')):
        s = f.parent.parent.name
        if (slot and s != slot) or (not slot and s == 'proba') or (den and f.parent.parent.parent.name != den):
            continue
        yield json.loads(f.read_text(encoding='utf-8'))


def traty(mesyac):
    s, n = collections.Counter(), collections.Counter()
    for f in SM.glob('zamer-*/api/*/*/*/*.json'):
        if f.name.startswith('_'):
            continue
        d = json.loads(f.read_text(encoding='utf-8'))
        if str(d.get('den', '')).startswith(mesyac):
            s[d.get('dvizhok')] += sum(p.get('cena', 0.0) for p in d.get('popytki', []))
            n[d.get('dvizhok')] += 1
    print('ТРАТА %s по файлам всех наборов (оценка; точно — консоли вендоров):' % mesyac)
    for k in DVIZHKI:
        print('  %-10s $%.2f  (%d файлов)' % (k, s[k], n[k]))
    print('  Разметка Haiku сюда не входит: zamer-v1/razmetka-rashod.json, в токенах.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('papka', nargs='?')
    ap.add_argument('--imya', help='регулярка клиента; по умолчанию — мы (R.NASHE_IMYA)')
    ap.add_argument('--den')
    ap.add_argument('--slot', help='по умолчанию все слоты, кроме proba')
    ap.add_argument('--povtorov', type=int, default=7, help='сколько повторов ждём (v2 — 7, наборы Веры — 1)')
    ap.add_argument('--primery', type=int, default=0, help='показать N кусков текста с совпадением — проверить регулярку')
    ap.add_argument('--traty', metavar='ГГГГ-ММ')
    a = ap.parse_args()
    if a.traty:
        return traty(a.traty)
    if not a.papka:
        ap.error('нужна папка набора или --traty')

    rx = re.compile(a.imya, re.I) if a.imya else R.NASHE_IMYA
    qs = {q['id']: q for q in json.loads((SM / a.papka / 'voprosy.json').read_text(encoding='utf-8'))['voprosy']}
    st = collections.defaultdict(collections.Counter)          # (q, dv) → статусы
    naz = collections.defaultdict(lambda: [0, 0, 0])           # (q, dv) → [в тексте, только в источниках, ok]
    dom = collections.defaultdict(collections.Counter)         # (q, dv) → домен → в скольких ответах
    zony = collections.defaultdict(lambda: [0, 0])             # (dv, lang) → [.ru/.by, всего доменов]
    modeli, dni, primery = collections.defaultdict(collections.Counter), collections.Counter(), collections.defaultdict(list)
    vne = 0
    for d in otvety(a.papka, a.den, a.slot):
        if d.get('rezhim') != 'poisk' or d.get('vopros_id') not in qs:
            continue
        k = (d['vopros_id'], d['dvizhok'])
        st[k][d.get('status')] += 1
        dni['%s %s' % (d.get('den'), d.get('slot'))] += 1
        vne += bool(d.get('vne_okna'))
        if d.get('status') != 'ok':
            continue
        v = d['vyzhimka']
        domeny = {s['domen'] for s in v['istochniki'] if s.get('domen')}
        m = rx.search(v['tekst'])
        v_ist = any(rx.search(x) for x in domeny)
        naz[k][0] += bool(m)
        naz[k][1] += bool(v_ist and not m)
        naz[k][2] += 1
        dom[k].update(domeny)
        lang = qs[d['vopros_id']].get('lang', '?')
        zony[(d['dvizhok'], lang)][0] += sum(1 for x in domeny if re.search(r'\.(ru|by)$', x))
        zony[(d['dvizhok'], lang)][1] += len(domeny)
        modeli[d['dvizhok']][v.get('model_v_otvete')] += 1
        if m and len(primery[k]) < a.primery:
            t = v['tekst']
            primery[k].append('…%s…' % t[max(0, m.start() - 60):m.end() + 60].replace('\n', ' '))

    ozhidaem = [(q, dv) for q in sorted(qs) for dv in DVIZHKI if dv != 'anthropic' or qs[q].get('opornyy')]
    print('НАБОР %s · дни/слоты: %s · кого ищем: %s' % (a.papka, dict(dni) or '—', a.imya or 'нас (NASHE_IMYA)'))
    if vne:
        print('ВНИМАНИЕ: %d ответов помечены vne_okna — раскрыть в отчёте.' % vne)
    print('\n%-6s %-4s %-10s %6s %9s %11s %8s  %s' % ('вопрос', 'яз', 'движок', 'ok', 'в тексте', 'только ист.', 'не ok', 'итог по тексту / по тексту+ист.'))
    porog = 4 if a.povtorov == 7 else None
    nepolno, ust_t, ust_ti = [], 0, 0
    for k in ozhidaem:
        t, i, n = naz[k]
        ne_ok = sum(c for s, c in st[k].items() if s != 'ok')
        if n < a.povtorov:
            nepolno.append(k)
            itog = 'НЕПОЛНО (%d из %d) — добрать, не читать' % (n, a.povtorov)
        elif porog:
            f = lambda e: 'устойчиво' if e >= porog else ('мелькание' if e else 'не назван')
            itog = '%s / %s' % (f(t), f(t + i))
            ust_t += t >= porog
            ust_ti += t + i >= porog
        else:
            itog = 'протокол v1: только счёт, без вердикта'
        print('%-6s %-4s %-10s %6d %9d %11d %8d  %s' % (k[0], qs[k[0]].get('lang', '?'), k[1], n, t, i, ne_ok, itog))
    print('\nПолнота: ожидали %d сочетаний × %d повторов; неполных %d.' % (len(ozhidaem), a.povtorov, len(nepolno)))
    if porog and not nepolno:
        print('Устойчиво назван: по тексту %d · по тексту+источникам (как kriteriy-v2) %d из %d сочетаний.'
              % (ust_t, ust_ti, len(ozhidaem)))

    print('\nВЕРХНИЙ ИСТОЧНИК (доля ответов, где домен есть в источниках; > 50% — у вопроса есть «хозяин»):')
    for q in sorted(qs):
        vse = collections.Counter()
        n_vse = 0
        stroka = []
        for dv in DVIZHKI:
            n = naz[(q, dv)][2]
            if not n:
                continue
            vse.update(dom[(q, dv)])
            n_vse += n
            x, c = dom[(q, dv)].most_common(1)[0] if dom[(q, dv)] else ('—', 0)
            stroka.append('%s %s %.0f%%' % (dv, x, c / n * 100))
        if n_vse:
            x, c = vse.most_common(1)[0] if vse else ('—', 0)
            print('  %-5s все: %s %.0f%%%s · %s' % (q, x, c / n_vse * 100, '  ← ХОЗЯИН' if c / n_vse > 0.5 else '', ' · '.join(stroka)))

    print('\nДОЛЯ .ru/.by СРЕДИ ДОМЕНОВ-ИСТОЧНИКОВ (по движку и языку):')
    for (dv, lang), (r, n) in sorted(zony.items()):
        print('  %-10s %-3s %3.0f%%  (%d из %d)' % (dv, lang, r / n * 100 if n else 0, r, n))
    print('\nМОДЕЛЬ В ОТВЕТЕ (записать в отчёт «до», сверить в «после»):')
    for dv in DVIZHKI:
        if modeli[dv]:
            print('  %-10s %s' % (dv, dict(modeli[dv])))
    if primery:
        print('\nСОВПАДЕНИЯ РЕГУЛЯРКИ В ТЕКСТЕ (проверить глазами, нет ли ложных):')
        for k in sorted(primery):
            for p in primery[k]:
                print('  %s %s: %s' % (k[0], k[1], p))
    print('\nВердикт о возврате денег здесь не печатается: см. SKILL.md, «Решение о возврате».')


if __name__ == '__main__':
    main()
