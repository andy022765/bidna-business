# -*- coding: utf-8 -*-
"""Устойчивый критерий протокола v2: назвали ли клиента и достаточно ли устойчиво.

Правило (PROTOKOL-V2.md, решение Андрея 25.09), считается отдельно по каждому
сочетанию «вопрос × язык × движок»:
  · устойчиво назван — 4 повтора из 7 и чаще;
  · мелькание — 1–3 из 7: в отчёт идёт, результатом НЕ считается ни в одну сторону;
  · не назван — 0 из 7.
Условие возврата денег: ни одного «устойчиво назван» за весь замер.

Запуск:  python3 kriteriy-v2.py zamer-v4 [--imya "Название клиента"] [--porog 4]
"""
import argparse
import collections
import json
import pathlib
import re
import sys

ZDES = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ZDES / 'zamer-v1'))
import razmetka as R   # одно правило разметки на все наборы


def sobrat(papka, imya):
    """По каждому (вопрос, язык, движок) — сколько повторов назвали клиента и сколько всего."""
    qs = {q['id']: q for q in json.loads((ZDES / papka / 'voprosy.json').read_text(encoding='utf-8'))['voprosy']}
    nayden = re.compile(imya, re.I) if imya else R.NASHE_IMYA
    itog = collections.defaultdict(lambda: [0, 0])
    for f in sorted((ZDES / papka / 'api').glob('*/*/*/[A-Z]*.json')):
        z = R.razmetit_api(f)
        if not z or z['rezhim'] != 'poisk':
            continue
        q = qs.get(z['vopros'])
        if not q:
            continue
        klyuch = (z['vopros'], q.get('lang', '?'), z['dvizhok'])
        est = bool(nayden.search(z['tekst'])) or any(
            nayden.search(d) for d in z['domeny'])
        itog[klyuch][0] += est
        itog[klyuch][1] += 1
    return qs, itog


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('papka')
    ap.add_argument('--imya', help='кого ищем; по умолчанию — нас самих')
    ap.add_argument('--porog', type=int, default=4, help='сколько повторов из семи считаем устойчивым')
    a = ap.parse_args()
    R.nachalo()
    qs, itog = sobrat(a.papka, a.imya)
    if not itog:
        sys.exit('ответов нет')

    ustoychivo = [k for k, (e, n) in itog.items() if e >= a.porog]
    melkanie = [k for k, (e, n) in itog.items() if 0 < e < a.porog]
    print('НАБОР %s · кого ищем: %s · порог устойчивости: %d из 7\n'
          % (a.papka, a.imya or 'нас самих', a.porog))
    print('%-6s %-4s %-11s %8s  %s' % ('вопрос', 'яз', 'движок', 'повторов', 'итог'))
    for (qid, lang, dv), (e, n) in sorted(itog.items()):
        if e >= a.porog:
            slovo = 'УСТОЙЧИВО НАЗВАН'
        elif e:
            slovo = 'мелькание, не в счёт'
        else:
            slovo = 'не назван'
        print('%-6s %-4s %-11s %4d/%-3d  %s' % (qid, lang, dv, e, n, slovo))

    nepolnye = [k for k, (e, n) in itog.items() if n < 7]
    print()
    if nepolnye:
        print('⚠️  НЕПОЛНЫЙ ЗАМЕР: %d сочетаний собраны меньше чем на 7 повторов.' % len(nepolnye))
        print('    По неполным критерий не применяется — считать их «не назван» нельзя,')
        print('    это была бы наша ошибка, выданная за результат клиента.')
    if ustoychivo:
        print('РЕЗУЛЬТАТ: устойчиво назван %d раз. Условие возврата НЕ наступило.' % len(ustoychivo))
    elif nepolnye:
        print('РЕЗУЛЬТАТ: устойчивых попаданий нет, но замер неполный — вывод о возврате делать рано.')
    else:
        print('РЕЗУЛЬТАТ: ни одного устойчивого попадания за весь замер.')
        print('УСЛОВИЕ ВОЗВРАТА НАСТУПИЛО.' if not melkanie else
              'УСЛОВИЕ ВОЗВРАТА НАСТУПИЛО. Мелькания (%d) на это не влияют — так записано в протоколе.'
              % len(melkanie))


if __name__ == '__main__':
    main()
