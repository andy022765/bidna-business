# -*- coding: utf-8 -*-
"""Разметка ответов замера и сверка «приложение против программы».

Одно правило на всех: ответы людей (PDF, сохранённые страницы, txt) и ответы программы (JSON)
размечаются одинаково, иначе сравнивать нельзя.

Что считаем:
  · НАЗВАЛИ ЛИ НАС — имя целиком «Business Intelligence DNA» или домен businessinteldna.com.
    «BI DNA», «ДНК бизнеса», имена Андрея и Маши считаются отдельно и в долю не входят
    (правило из kalibrovka/VOPROSY.md).
  · МЕСТО В СПИСКЕ НЕ СЧИТАЕМ. Никогда. Анти-гарантия.
  · ИСТОЧНИКИ — домены, по ним сверяем приложение с программой.
  · ХОДИЛА ЛИ В ИНТЕРНЕТ — по пометке о поиске (у людей) и по числу оплаченных поисков (у программы).

Запуск:
  python3 razmetka.py                 # всё, что есть
  python3 razmetka.py --den 2026-09-17
  python3 razmetka.py --sverka        # только таблица «приложение против программы»
"""
import argparse
import collections
import hashlib
import os
import glob
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import proverka_otvetov as P   # разбор файлов людей уже написан там

ZDES = pathlib.Path(__file__).resolve().parent
API = ZDES / 'api'
OTVETY = ZDES / 'otvety'

IMENA_KESH = ZDES_KESH = None   # заполняется в nachalo()
# у людей пометка о поиске выглядит по-разному в разных нейросетях
POISK_LYUDI = re.compile(r'Searched the web|Searching the web|Искал[а]? в интернете|Ищу в интернете|'
                         r'Поиск в (?:сети|интернете)|Sources|Источники|Цитаты|Citations', re.I)

NASHE_IMYA = re.compile(r'business\s+intelligence\s+dna|businessinteldna', re.I)
POCHTI_NASHE = re.compile(r'\bbi\s*dna\b|днк\s+бизнеса|андрей\s+жила|andrii\s+zhyla|maryna\s+zhyla', re.I)
IMYA_FAYLA = re.compile(r'^([A-Z]+\d+)_([a-z0-9-]+)_(\d{4}-\d{2}-\d{2})_(andrey|masha)\.')
# как человек называл нейросеть в имени файла → как она зовётся у программы
PARA = {'chatgpt-bez-logina': 'openai', 'chatgpt-login': 'openai', 'claude': 'anthropic',
        'perplexity': 'perplexity', 'google-ai': None}   # у AI Mode пары через API нет


def nachalo():
    global ZDES_KESH, IMENA_KESH
    ZDES_KESH = ZDES / 'imena-kesh.json'
    IMENA_KESH = json.loads(ZDES_KESH.read_text(encoding='utf-8')) if ZDES_KESH.exists() else {}


def sohranit_kesh():
    ZDES_KESH.write_text(json.dumps(IMENA_KESH, ensure_ascii=False, indent=0), encoding='utf-8')


def nazvannye_kompanii(tekst, metka):
    """Кого назвали в ответе. Достаём дешёвой моделью, одинаково для человека и для программы.
    Результат кладём в кеш: один и тот же ответ второй раз не оплачиваем."""
    klyuch = hashlib.sha256(tekst.encode()).hexdigest()[:16]
    if klyuch in IMENA_KESH:
        return set(IMENA_KESH[klyuch])
    import anthropic
    for line in (pathlib.Path.home() / '.bidna-smotritel.env').read_text(encoding='utf-8').splitlines():
        if line.startswith('ANTHROPIC_API_KEY=') and line.split('=', 1)[1].strip():
            os.environ.setdefault('ANTHROPIC_API_KEY', line.split('=', 1)[1].strip())
    c = anthropic.Anthropic(max_retries=2, timeout=120)
    r = c.messages.create(
        model='claude-haiku-4-5', max_tokens=500,
        system='Ты извлекаешь из ответа нейросети названия компаний, сервисов и людей, которых она НАЗВАЛА '
               'как исполнителей или варианты. Верни только JSON-массив строк, без пояснений. '
               'Не включай: названия самих нейросетей, площадки-каталоги (Yelp, Google Maps, Reddit), '
               'общие слова. Имя пиши так, как оно стоит в тексте.',
        messages=[{'role': 'user', 'content': tekst[:12000]}])
    zapisat_rashod(r.usage.input_tokens, r.usage.output_tokens)
    t = ''.join(b.text for b in r.content if b.type == 'text')
    try:
        spisok = [str(x).strip() for x in json.loads(t[t.find('['):t.rfind(']') + 1])]
    except Exception:
        spisok = []
    spisok = sorted({x.lower() for x in spisok if 1 < len(x) < 60})
    IMENA_KESH[klyuch] = spisok
    return set(spisok)


# Одну и ту же компанию нейросети называют по-разному: «WorldSpeak School» и «WorldSpeak Preschool»,
# «Intiwasi» и «Intiwasi Spanish Immersion School». Сравнение по буквам считало это разными именами
# и занижало совпадение. Сравниваем по опорному слову — самому длинному неродовому.
RODOVYE = {'the', 'and', 'llc', 'inc', 'ltd', 'corp', 'company', 'group', 'partners', 'partner',
           'associates', 'consulting', 'consultants', 'services', 'service', 'solutions', 'solution',
           'school', 'preschool', 'schoolhouse', 'academy', 'center', 'centre', 'advisors', 'advisory',
           'strategies', 'strategic', 'capital', 'ventures', 'global', 'virtual', 'digital', 'collective',
           'cfo', 'cfos', 'fractional', 'tax', 'accounting', 'finance', 'financial', 'ai', 'app', 'com',
           'immersion', 'spanish', 'language', 'bilingual', 'kids', 'children', 'learning', 'education',
           'answering', 'receptionist', 'voice', 'phone', 'call', 'calls', 'agency', 'studio', 'labs',
           'для', 'бизнеса', 'сервис', 'компания', 'групп'}


def opornoe(imya):
    """Опорное слово названия: самое длинное слово, которое не родовое."""
    slova = [w for w in re.findall(r'[a-zа-яё0-9]{3,}', imya.lower()) if w not in RODOVYE]
    return max(slova, key=len) if slova else re.sub(r'[^a-zа-яё0-9]', '', imya.lower())


def shozhie(ia, ib):
    """Сколько названий совпало и сколько всего разных. Жадное сопоставление, без повторов."""
    svobodnye = list(ib)
    sovpalo = 0
    for x in ia:
        kx = opornoe(x)
        for y in list(svobodnye):
            ky = opornoe(y)
            if kx == ky or (len(kx) >= 5 and kx in y.lower()) or (len(ky) >= 5 and ky in x.lower()):
                svobodnye.remove(y)
                sovpalo += 1
                break
    vsego = len(ia) + len(ib) - sovpalo
    return sovpalo, vsego


def dolya_imen(ia, ib):
    s, v = shozhie(ia, ib)
    return (s / v * 100) if v else None


def zapisat_rashod(vhod, vyhod):
    """Разметка ест тот же ключ Anthropic, что и замер. Считаем её отдельно, иначе потолок врёт.

    Пишем ТОКЕНЫ, а не доллары: цену называем только по консоли, не по своей оценке.
    """
    put = ZDES / 'razmetka-rashod.json'
    d = json.loads(put.read_text(encoding='utf-8')) if put.exists() else {'model': 'claude-haiku-4-5',
                                                                          'vyzovov': 0, 'vhod': 0, 'vyhod': 0}
    d['vyzovov'] += 1
    d['vhod'] += int(vhod)
    d['vyhod'] += int(vyhod)
    put.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding='utf-8')


def domeny(text_ili_spisok):
    if isinstance(text_ili_spisok, str):
        ssyl = re.findall(r'https?://[^\s")\']+', text_ili_spisok)
    else:
        ssyl = [s.get('url') or '' for s in text_ili_spisok]
    out = set()
    for u in ssyl:
        m = re.match(r'https?://(?:www\.)?([^/:\s]+)', u)
        if m and not re.match(r'(chatgpt|openai|claude|anthropic|perplexity|google|gstatic|mapbox)\.', m.group(1)):
            out.add(m.group(1).lower())
    return out


def razmetit_ruchnoy(put):
    t = P.tekst_fayla(put)
    m = IMYA_FAYLA.match(put.name)
    return {
        'istochnik': 'человек', 'vopros': m.group(1), 'dvizhok_fayla': m.group(2), 'den': m.group(3), 'kto': m.group(4),
        'nazvali_nas': bool(NASHE_IMYA.search(t)), 'pochti': bool(POCHTI_NASHE.search(t)),
        # У PDF из ChatGPT ссылки и пометка о поиске теряются при печати: «нет» тут означало бы враньё.
        # То же у Google AI Mode: он рисует список источников скриптом, в сохранённой странице их нет.
        # Если нет ни пометки, ни доменов, а файл печатный или это AI Mode — пишем «неизвестно» (None).
        'hodila_v_internet': (True if (re.search(POISK_LYUDI, t) or domeny(t))
                              else (None if (put.suffix.lower() == '.pdf'
                                             or m.group(2) == 'google-ai') else False)),
        'domeny': domeny(t), 'tekst': t, 'znakov': len(t), 'fayl': put.name,
    }


def razmetit_api(put):
    d = json.loads(put.read_text(encoding='utf-8'))
    if d.get('status') != 'ok':
        return None
    v = d['vyzhimka']
    t = v['tekst']
    return {
        'istochnik': 'программа', 'vopros': d['vopros_id'], 'dvizhok': d['dvizhok'], 'rezhim': d['rezhim'],
        'den': d['den'], 'slot': d['slot'],
        'nazvali_nas': bool(NASHE_IMYA.search(t)) or any('businessinteldna' in (s.get('domen') or '') for s in v['istochniki']),
        'pochti': bool(POCHTI_NASHE.search(t)), 'hodila_v_internet': bool(v['poiskovyh_vyzovov']),
        'domeny': {s['domen'] for s in v['istochniki'] if s.get('domen')}, 'tekst': t, 'znakov': len(t), 'fayl': put.name,
    }


def sobrat(den=None):
    ruch, api = [], []
    for f in sorted(OTVETY.iterdir()):
        if f.is_file() and IMYA_FAYLA.match(f.name) and f.suffix.lower() in ('.pdf', '.txt', '.html', '.htm'):
            if den and den not in f.name:
                continue
            ruch.append(razmetit_ruchnoy(f))
    for f in sorted(API.glob('*/*/*/[A-Z]*.json')):
        if den and ('/%s/' % den) not in str(f):
            continue
        if '/proba/' in str(f):
            continue
        z = razmetit_api(f)
        if z:
            api.append(z)
    return ruch, api


def dolya(zapisi, klyuch=lambda z: True):
    nabor = [z for z in zapisi if klyuch(z) and not z['vopros'].startswith(('B', 'P'))]
    if not nabor:
        return '—'
    return '%d из %d' % (sum(z['nazvali_nas'] for z in nabor), len(nabor))


def ustoychivost(ruch, api):
    """Держится ли ответ во времени: один и тот же источник, тот же вопрос, разные дни.

    Это ответ на вопрос «можно ли мерить видимость раз в месяц». Если у одного и того же
    человека в том же приложении через шесть дней список названных компаний почти другой,
    то разовый замер ничего не доказывает — нужен повтор и квартал, а не месяц.
    """
    print('\n=== ДЕРЖИТСЯ ЛИ ОТВЕТ ВО ВРЕМЕНИ (один источник, тот же вопрос, разные дни)')
    gnezda = collections.defaultdict(dict)
    for r in ruch:
        gnezda[('человек', r['dvizhok_fayla'], r['kto'], r['vopros'])][r['den']] = r
    for z in api:
        if z['slot'] == 'vecher' and z['rezhim'] == ('poisk' if z['dvizhok'] == 'perplexity' else 'auto'):
            gnezda[('программа', z['dvizhok'], '—', z['vopros'])][z['den']] = z
    itog = collections.defaultdict(list)
    for (istochnik, dv, kto, _), po_dnyam in gnezda.items():
        dni = sorted(po_dnyam)
        for i in range(len(dni) - 1):
            for j in range(i + 1, len(dni)):
                x, y = po_dnyam[dni[i]], po_dnyam[dni[j]]
                ix, iy = nazvannye_kompanii(x['tekst'], x['fayl']), nazvannye_kompanii(y['tekst'], y['fayl'])
                d = dolya_imen(ix, iy)
                if d is not None:
                    itog[(istochnik, dv, kto, dni[i], dni[j])].append(d)
    if not itog:
        print('  пар за разные дни пока нет')
        return
    print('%-10s %-20s %-7s %-23s %5s %12s' % ('источник', 'нейросеть', 'кто', 'дни', 'пар', 'имена общие'))
    for (istochnik, dv, kto, d1, d2), v in sorted(itog.items()):
        print('%-10s %-20s %-7s %-23s %5d %11.0f%%' % (istochnik, dv, kto, '%s → %s' % (d1[5:], d2[5:]), len(v),
                                                       sum(v) / len(v)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--den')
    ap.add_argument('--sverka', action='store_true')
    ap.add_argument('--imena', action='store_true',
                    help='сравнивать по НАЗВАННЫМ компаниям (платный проход дешёвой моделью, с кешем)')
    a = ap.parse_args()
    nachalo()
    ruch, api = sobrat(a.den)
    if not ruch and not api:
        sys.exit('данных нет')

    if not a.sverka:
        print('=== НАЗВАЛИ ЛИ НАС (вопросы с нашим именем не в счёт)')
        print('  человек:  ', dolya(ruch), '· программа:', dolya(api))
        pochti_r = [z for z in ruch if z['pochti']], [z for z in api if z['pochti']]
        print('  похожие упоминания (BI DNA, ДНК бизнеса, имена основателей): человек %d, программа %d'
              % (len(pochti_r[0]), len(pochti_r[1])))
        print('\n=== ХОДИЛА ЛИ В ИНТЕРНЕТ')
        for imya, nabor, kl in (('человек', ruch, 'dvizhok_fayla'), ('программа', api, 'dvizhok')):
            po = collections.defaultdict(lambda: [0, 0, 0])
            for z in nabor:
                if z['hodila_v_internet'] is None:
                    po[z[kl]][2] += 1
                else:
                    po[z[kl]][0] += z['hodila_v_internet']
                    po[z[kl]][1] += 1
            print('  %-10s' % imya, ' · '.join(
                '%s %d из %d%s' % (k, v[0], v[1], (' (+%d неизвестно: печать в PDF)' % v[2]) if v[2] else '')
                for k, v in sorted(po.items())))

    print('\n=== ПРИЛОЖЕНИЕ ПРОТИВ ПРОГРАММЫ (совпадение сайтов-источников, один вопрос, один день)')
    api_po = {(z['den'], z['dvizhok'], z['rezhim'], z['vopros'], z['slot']): z for z in api}
    stroki = collections.defaultdict(list)
    for r in ruch:
        dv = PARA.get(r['dvizhok_fayla'])
        if not dv:
            continue
        # сравниваем с вечерним прогоном того же дня в обычном режиме — он идёт одновременно с людьми
        k = (r['den'], dv, 'auto' if dv != 'perplexity' else 'poisk', r['vopros'], 'vecher')
        z = api_po.get(k)
        if not z:
            continue
        obshie, vse = r['domeny'] & z['domeny'], r['domeny'] | z['domeny']
        imena_r = nazvannye_kompanii(r['tekst'], r['fayl']) if a.imena else set()
        imena_z = nazvannye_kompanii(z['tekst'], z['fayl']) if a.imena else set()
        # совпадение имён считаем с учётом разных написаний одной компании
        stroki[(r['den'], r['dvizhok_fayla'], r['kto'])].append({
            'vopros': r['vopros'], 'sovpalo': (len(obshie) / len(vse) * 100) if vse else None,
            'imena': dolya_imen(imena_r, imena_z),
            'oba_iskali': (None if r['hodila_v_internet'] is None
                           else r['hodila_v_internet'] == z['hodila_v_internet']),
            'nazvali_odinakovo': r['nazvali_nas'] == z['nazvali_nas'],
        })
    if not stroki:
        print('  пар для сравнения пока нет (нужен вечерний прогон того же дня)')
        return
    print('%-11s %-20s %-7s %5s %12s %12s %12s %12s' % ('день', 'нейросеть', 'кто', 'пар', 'имена общие', 'сайты общие', 'поиск так же', 'бренд так же'))
    for (den, dv, kto), v in sorted(stroki.items()):
        est = [x['sovpalo'] for x in v if x['sovpalo'] is not None]
        est_i = [x.get('imena') for x in v if x.get('imena') is not None]
        poisk = ((round(sum(1 for x in v if x['oba_iskali']) / max(1, sum(1 for x in v if x['oba_iskali'] is not None)) * 100))
                 if any(x['oba_iskali'] is not None for x in v) else None)
        print('%-11s %-20s %-7s %5d %12s %12s %12s %11d%%' % (
            den, dv, kto, len(v),
            ('%.0f%%' % (sum(est_i) / len(est_i))) if est_i else '—',
            ('%.0f%%' % (sum(est) / len(est))) if est else '—',
            ('%d%%' % poisk) if poisk is not None else 'нет данных',
            round(sum(x['nazvali_odinakovo'] for x in v) / len(v) * 100)))
    if a.imena:
        # база для сравнения: насколько расходятся между собой ДВА прогона самой программы.
        # Без неё непонятно, велики ли 20% — может, столько же даёт обычный разброс.
        pary = collections.defaultdict(dict)
        for z in api:
            if z['rezhim'] in ('auto', 'poisk') and z['slot'] in ('utro', 'vecher'):
                pary[(z['den'], z['dvizhok'], z['rezhim'], z['vopros'])][z['slot']] = z
        sravnili = []
        for k, v in pary.items():
            if 'utro' in v and 'vecher' in v and any(r['vopros'] == k[3] and PARA.get(r['dvizhok_fayla']) == k[1] for r in ruch):
                a_im = nazvannye_kompanii(v['utro']['tekst'], v['utro']['fayl'])
                b_im = nazvannye_kompanii(v['vecher']['tekst'], v['vecher']['fayl'])
                d = dolya_imen(a_im, b_im)
                if d is not None:
                    sravnili.append(d)
        if sravnili:
            print('\nБАЗА ДЛЯ СРАВНЕНИЯ: два прогона самой программы (утро против вечера, те же вопросы) —')
            print('  общих названных компаний %.0f%% на %d парах. С этим и надо сравнивать цифры выше.'
                  % (sum(sravnili) / len(sravnili), len(sravnili)))
        sohranit_kesh()
    if a.imena:
        ustoychivost(ruch, api)
    print('\nМесто в списке не считаем принципиально — ни здесь, ни в отчётах клиентам.')
    if not a.imena:
        print('Сравнение по названным компаниям не считалось: добавьте --imena (платный проход, с кешем).')


if __name__ == '__main__':
    main()
