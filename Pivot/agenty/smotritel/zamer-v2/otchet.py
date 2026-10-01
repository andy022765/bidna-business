# -*- coding: utf-8 -*-
"""Нулевая точка по шести замороженным вопросам: что видит покупатель до нашей работы.

По каждому вопросу: называют ли нас · называют ли вообще хоть кого-то · кто верхний источник
и какую долю ответов он держит. Доля верхнего источника выше половины означает, что у вопроса
уже есть хозяин и страницу придётся писать против вендора с деньгами.

Правила разметки — те же, что у v1 (`zamer-v1/razmetka.py`), чтобы декабрь считался так же.

Запуск:  python3 otchet.py [--imena]
"""
import argparse
import collections
import json
import pathlib
import sys

ZDES = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ZDES.parent / 'zamer-v1'))
import razmetka as R   # одно правило разметки на все наборы замера

VOPROSY = ZDES / 'voprosy.json'
API = ZDES / 'api'


def sobrat():
    out = []
    for f in sorted(API.glob('*/*/*/[A-Z]*.json')):
        z = R.razmetit_api(f)
        if z:
            out.append(z)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--imena', action='store_true', help='считать, называют ли вообще исполнителей (платно, с кешем)')
    ap.add_argument('--rezhim', default='poisk', choices=('poisk', 'auto', 'oba'),
                    help='по умолчанию принудительный поиск — вывод калибровки v1')
    a = ap.parse_args()
    R.nachalo()
    d = json.loads(VOPROSY.read_text(encoding='utf-8'))
    qs = {q['id']: q for q in d['voprosy']}
    vse = sobrat()
    if not vse:
        sys.exit('ответов нет — сначала прогон')
    if a.rezhim != 'oba':
        vse = [z for z in vse if z['rezhim'] == a.rezhim]

    print('НУЛЕВАЯ ТОЧКА · список %s · заморожен %s · не менять до %s'
          % (d['versiya'], d['zamorozheno'], d['ne_menyat_do']))
    print('режим: %s · ответов %d · дни: %s\n'
          % ({'poisk': 'принудительный поиск', 'auto': 'обычный', 'oba': 'оба'}[a.rezhim],
             len(vse), ', '.join(sorted({z['den'] for z in vse}))))

    nas_vsego = sum(z['nazvali_nas'] for z in vse)
    print('НАЗВАЛИ ЛИ НАС: %d из %d\n' % (nas_vsego, len(vse)))

    hozyaeva = []
    for qid in sorted(qs):
        svoi = [z for z in vse if z['vopros'] == qid]
        if not svoi:
            continue
        c = collections.Counter()
        for z in svoi:
            c.update(z['domeny'])
        verh, dolya = ('—', 0.0)
        if c:
            verh, n = c.most_common(1)[0]
            dolya = n / len(svoi) * 100
        s_imenami = ''
        if a.imena:
            k = sum(1 for z in svoi if R.nazvannye_kompanii(z['tekst'], z['fayl']))
            s_imenami = ' · назвали хоть кого-то %d из %d' % (k, len(svoi))
        print('%s  %s' % (qid, qs[qid]['text']))
        print('     ответов %d · разных сайтов %d · верхний источник %s (%.0f%%)%s'
              % (len(svoi), len(c), verh, dolya, s_imenami))
        print('     дальше: %s' % ', '.join('%s %d' % (x, n) for x, n in c.most_common(6)[1:]))
        if dolya > 50:
            hozyaeva.append((qid, verh, dolya))
        print()
    if hozyaeva:
        print('У ЭТИХ ВОПРОСОВ УЖЕ ЕСТЬ ХОЗЯИН (верхний источник больше половины):')
        for qid, verh, dolya in hozyaeva:
            print('  %s — %s, %.0f%% ответов. Писать страницу придётся против него.' % (qid, verh, dolya))
    else:
        print('Вопросов с готовым хозяином нет: ни один источник не держит больше половины ответов.')
    if a.imena:
        R.sohranit_kesh()


if __name__ == '__main__':
    main()
