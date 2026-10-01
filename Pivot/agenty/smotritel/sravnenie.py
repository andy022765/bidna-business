# -*- coding: utf-8 -*-
"""Два набора вопросов рядом: что меняется в ответе от того, КАК спрошено.

Сравнивает только те нейросети, которые есть в обоих наборах, иначе сравнение нечестное.

Запуск:  python3 sravnenie.py zamer-v2 zamer-v3 [--imena]
"""
import argparse
import collections
import json
import pathlib
import sys

ZDES = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ZDES / 'zamer-v1'))
import razmetka as R


def nabor(papka, rezhim='poisk'):
    d = json.loads((ZDES / papka / 'voprosy.json').read_text(encoding='utf-8'))
    qs = {q['id']: q for q in d['voprosy']}
    otvety = []
    for f in sorted((ZDES / papka / 'api').glob('*/*/*/[A-Z]*.json')):
        z = R.razmetit_api(f)
        if z and z['rezhim'] == rezhim:
            otvety.append(z)
    return d, qs, otvety


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('papki', nargs=2)
    ap.add_argument('--imena', action='store_true')
    ap.add_argument('--rezhim', default='poisk')
    a = ap.parse_args()
    R.nachalo()
    nabory = [nabor(p, a.rezhim) for p in a.papki]
    obshie = set.intersection(*[{z['dvizhok'] for z in n[2]} for n in nabory])
    print('СРАВНЕНИЕ ДВУХ НАБОРОВ · режим %s · нейросети в обоих: %s'
          % (a.rezhim, ', '.join(sorted(obshie)) or 'нет общих'))
    if not obshie:
        sys.exit('сравнивать нечего')
    itogo = {}
    for papka, (d, qs, otvety) in zip(a.papki, nabory):
        otvety = [z for z in otvety if z['dvizhok'] in obshie]
        print('\n=== %s (%s) · ответов %d' % (papka, d['versiya'], len(otvety)))
        nazvali_kogo = vsego = 0
        for qid in sorted(qs):
            svoi = [z for z in otvety if z['vopros'] == qid]
            if not svoi:
                continue
            c = collections.Counter()
            for z in svoi:
                c.update(z['domeny'])
            verh, dolya = (c.most_common(1)[0][0], c.most_common(1)[0][1] / len(svoi) * 100) if c else ('—', 0)
            k = sum(1 for z in svoi if R.nazvannye_kompanii(z['tekst'], z['fayl'])) if a.imena else 0
            nazvali_kogo += k
            vsego += len(svoi)
            print('  %-4s назвали %s · верхний %s (%.0f%%) · %s'
                  % (qid, ('%d из %d' % (k, len(svoi))) if a.imena else '—', verh, dolya, qs[qid]['text'][:58]))
        itogo[papka] = (nazvali_kogo, vsego)
        if a.imena and vsego:
            print('  ИТОГО по набору: назвали хоть кого-то %d из %d (%.0f%%)'
                  % (nazvali_kogo, vsego, nazvali_kogo / vsego * 100))
    if a.imena and len(itogo) == 2:
        (p1, (k1, v1)), (p2, (k2, v2)) = itogo.items()
        print('\nРАЗНИЦА: %s — %.0f%% ответов с именами, %s — %.0f%%. Это %+.0f пункта.'
              % (p1, k1 / v1 * 100, p2, k2 / v2 * 100, k2 / v2 * 100 - k1 / v1 * 100))
        print('ОГОВОРКА: во втором наборе изменены СРАЗУ ДВЕ вещи — география (США) и форма вопроса'
              ' («кто может» вместо «что делать»). Какая из них сработала, по этим данным сказать нельзя.')
    R.sohranit_kesh()


if __name__ == '__main__':
    main()
