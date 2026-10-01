# -*- coding: utf-8 -*-
"""Смотритель, калибровочный замер v1: прогон вопросов через API нейросетей.

Что делает. Берёт утверждённые вопросы из kalibrovka/voprosy.json и задаёт их
трём нейросетям через официальные входы, с поиском в интернете и местом
Los Angeles, CA. Каждый ответ — отдельный файл: сырой ответ (для пересчёта
задним числом) и выжимка — текст, источники, поисковые запросы, модель,
число оплаченных поисков, цена, время, все попытки.

Чего НЕ делает. Не решает, назван ли бренд, и не считает долю — это разметка,
отдельным шагом, одним правилом для приложений и API. В chatgpt.com /
claude.ai / perplexity.ai роботом не ходит: условия запрещают.

Запуск (из этой папки):
  python3 progon.py --slot utro            # слот по плану недели
  python3 progon.py --plan --slot vecher   # что будет сделано и сколько стоит, без запросов
  python3 progon.py --svodka               # что лежит, чего не хватает, сколько потрачено за месяц
  python3 progon.py --slot proba --tolko N03 --dvizhki openai   # проверка программы, в замер не идёт

Гарантии. Готовый ответ (status ok и тот же отпечаток настроек) второй раз не
задаётся и не затирается. Неполный ответ, упавший поиск, пропуск по потолку —
не «готово», повторный запуск их добирает. Два запуска одного слота
одновременно не пойдут (замок). Перед стартом считается месячная трата по
файлам на диске и оценка запуска; не влезает в потолок — не стартует.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import ssl
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo

import anthropic
import certifi

ZDES = pathlib.Path(__file__).resolve().parent
# База по умолчанию — папка проекта в Google Drive. Но системный планировщик macOS в Drive
# не пускает («Operation not permitted»), поэтому автозапуск работает на копии в домашней папке:
# переменная SMOTRITEL_BAZA. Ответы оттуда переносятся в проект командой raspisanie.sh zabrat.
BAZA = pathlib.Path(os.environ.get('SMOTRITEL_BAZA') or ZDES.parent).expanduser()
VOPROSY = BAZA / 'kalibrovka' / 'voprosy.json'
ITOG = BAZA / 'zamer-v1' / 'api'
KLYUCHI = pathlib.Path.home() / '.bidna-smotritel.env'
CTX = ssl.create_default_context(cafile=certifi.where())  # у python.org-сборки на Маке своих сертификатов нет
PT = ZoneInfo('America/Los_Angeles')

# ── настройки недели. Любая правка меняет отпечаток: старые ответы перестают считаться готовыми ──
MESTO = {'type': 'approximate', 'city': 'Los Angeles', 'region': 'California',
         'country': 'US', 'timezone': 'America/Los_Angeles'}
OKNA = {'utro': (7, 11), 'den': (11, 16), 'vecher': (16, 23), 'proba': None}   # часы по Лос-Анджелесу

# режим → какой набор вопросов в нём задаём по умолчанию (vse | opornye)
DVIZHKI = {
    # chat-latest — та же модель, что отвечает в приложении ChatGPT (плавающее имя: смену ловим по заголовкам и дате)
    'openai': {'model': 'chat-latest', 'rezhimy': {'auto': 'vse', 'poisk': 'vse'}},
    # Обычный поиск, не web_search_20260209: новая версия сама гоняет код фильтрации — проба 15.09
    # дала 259 с и ~$0.27 за вызов против 19 с и ~$0.08. Sonnet 5 — как в приложении Claude.
    # Вариант Б: обычный режим на всех вопросах, принудительный поиск — только на опорных.
    'anthropic': {'model': 'claude-sonnet-5', 'tool': 'web_search_20250305', 'max_uses': 5, 'max_tokens': 16000,
                  'rezhimy': {'auto': 'vse', 'poisk': 'opornye'}},
    # у Perplexity поиск идёт всегда, режим один
    'perplexity': {'model': 'perplexity/sonar', 'rezhimy': {'poisk': 'vse'}},
}
PORYADOK_DVIZHKOV = ('openai', 'anthropic', 'perplexity')

# Оценка цены (не счёт): OpenAI — сверить с Usage после первого слота и поправить до второго.
# Perplexity возвращает точную сумму сам.
CENA = {
    'openai': {'in': 1.25, 'out': 10.0, 'poisk': 0.01},
    'anthropic': {'in': 2.0, 'out': 10.0, 'poisk': 0.01},
}
SREDNYAYA_PO_UMOLCHANIYU = {'openai': 0.03, 'anthropic': 0.08, 'perplexity': 0.006}
# Месячные потолки — чуть ниже лимитов в консолях (OpenAI $20, Anthropic $20 с 15.09, Perplexity $5).
MESYACHNYY_POTOLOK = {'openai': 18.0, 'anthropic': 19.5, 'perplexity': 4.5}

PROBLEMA_KOSHELKA = re.compile(r'insufficient_quota|exceeded your current quota|credit balance|billing|'
                               r'spend limit|usage limit|out of credits|payment required', re.I)

_lock = threading.Lock()
_rezerv = {k: 0.0 for k in DVIZHKI}
_potracheno_zapusk = {k: 0.0 for k in DVIZHKI}
_koshelek_pust = set()


class KoshelekPust(Exception):
    pass


# ── подготовка ─────────────────────────────────────────────────────────────────

def klyuchi():
    if not KLYUCHI.exists():
        sys.exit('нет файла ключей %s' % KLYUCHI)
    for line in KLYUCHI.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            if v.strip():
                os.environ.setdefault(k.strip(), v.strip())


def zagruzit_voprosy():
    d = json.loads(VOPROSY.read_text(encoding='utf-8'))
    qs = d['voprosy']
    nastroyki = json.dumps({'voprosy': [[q['id'], q['text']] for q in qs], 'dvizhki': DVIZHKI, 'mesto': MESTO},
                           sort_keys=True, ensure_ascii=False)
    return d['versiya'], hashlib.sha256(nastroyki.encode()).hexdigest()[:12], qs


def seychas_pt():
    return dt.datetime.now(PT)


# ── разбор: чистые функции от сырого ответа. Ими же можно пересобрать выжимку задним числом ──

def norm_url(u):
    if not u:
        return None, None
    try:
        p = urllib.parse.urlsplit(u)
    except ValueError:
        return u, None
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not k.lower().startswith('utm_')]
    host = (p.hostname or '').lower()
    norm = urllib.parse.urlunsplit((p.scheme.lower(), host, p.path.rstrip('/'), urllib.parse.urlencode(q), ''))
    return norm, (host[4:] if host.startswith('www.') else host)


def bez_dubley(spisok):
    """Источники в одном виде у всех: {url, domen, title}; дубли по нормализованному адресу склеиваются."""
    out, po_adresu = [], {}
    for x in spisok:
        norm, domen = norm_url(x.get('url'))
        if not norm:
            continue
        if norm in po_adresu:
            if not po_adresu[norm]['title'] and x.get('title'):
                po_adresu[norm]['title'] = x.get('title')
            continue
        z = {'url': norm, 'domen': domen, 'title': x.get('title') or None}
        po_adresu[norm] = z
        out.append(z)
    return out


def razobrat_openai(d):
    out = d.get('output') or []
    tekst = ''.join(c.get('text', '') for o in out if o.get('type') == 'message' for c in o.get('content') or [])
    zaprosy, sources, stranicy, citaty = [], [], [], []
    for o in out:
        if o.get('type') == 'web_search_call':
            a = o.get('action') or {}
            if a.get('type') == 'search':
                for z in ([a.get('query')] if a.get('query') else []) + (a.get('queries') or []):
                    if z not in zaprosy:
                        zaprosy.append(z)
                sources += [{'url': s.get('url'), 'title': s.get('title')} for s in a.get('sources') or []]
            elif a.get('type') in ('open_page', 'find_in_page'):
                stranicy.append({'deystvie': a.get('type'), 'url': a.get('url'), 'pattern': a.get('pattern')})
        if o.get('type') == 'message':
            for c in o.get('content') or []:
                citaty += [{'url': x.get('url'), 'title': x.get('title')}
                           for x in c.get('annotations') or [] if x.get('type') == 'url_citation']
    citaty = bez_dubley(citaty)
    zagolovki = {c['url']: c['title'] for c in citaty if c['title']}
    istochniki = bez_dubley(sources + citaty)          # процитированное — тоже показанный источник
    for s in istochniki:
        s['title'] = s['title'] or zagolovki.get(s['url'])
    u = d.get('usage') or {}
    vyzovov = ((d.get('tool_usage') or {}).get('web_search') or {}).get('num_requests')
    if vyzovov is None:
        vyzovov = sum(1 for o in out if o.get('type') == 'web_search_call' and (o.get('action') or {}).get('type') == 'search')
    cena = u.get('input_tokens', 0) / 1e6 * CENA['openai']['in'] + u.get('output_tokens', 0) / 1e6 * CENA['openai']['out'] \
        + vyzovov * CENA['openai']['poisk']
    problema = None
    if d.get('status') != 'completed' or d.get('incomplete_details'):
        problema = 'ответ не завершён: status=%s %s' % (d.get('status'), d.get('incomplete_details'))
    elif not tekst.strip():
        problema = 'пустой текст ответа'
    return {'tekst': tekst, 'poiskovye_zaprosy': zaprosy, 'poiskovyh_zaprosov': len(zaprosy),
            'poiskovyh_vyzovov': vyzovov, 'istochniki': istochniki, 'citaty_v_tekste': citaty,
            'citaty_dostupny': True, 'otkrytye_stranicy': stranicy, 'oshibki_poiska': [],
            'model_v_otvete': d.get('model'), 'tokeny': u, 'cena': round(cena, 5), 'cena_istochnik': 'оценка по таблице'}, problema


def razobrat_anthropic(d):
    bloki = d.get('content') or []
    tekst = ''.join(b.get('text') or '' for b in bloki if b.get('type') == 'text')
    zaprosy = []
    for b in bloki:
        if b.get('type') == 'server_tool_use' and b.get('name') == 'web_search':
            z = (b.get('input') or {}).get('query')
            if z and z not in zaprosy:
                zaprosy.append(z)
    rezultaty, oshibki = [], []
    for b in bloki:
        if b.get('type') == 'web_search_tool_result':
            c = b.get('content')
            if isinstance(c, list):
                rezultaty += [{'url': x.get('url'), 'title': x.get('title')} for x in c]
            else:   # ошибка поиска приходит объектом, а не списком — это не «ничего не нашла»
                oshibki.append({'tool_use_id': b.get('tool_use_id'), 'error_code': (c or {}).get('error_code')})
    citaty = bez_dubley([{'url': ci.get('url'), 'title': ci.get('title')} for b in bloki if b.get('type') == 'text'
                         for ci in b.get('citations') or [] if ci.get('url')])
    raundy = d.get('raundy') if isinstance(d.get('raundy'), list) else []
    tin = tcr = tcw = tout = vyzovov = 0
    for r in raundy:
        u = r.get('usage') or {}
        tin += u.get('input_tokens') or 0
        tcr += u.get('cache_read_input_tokens') or 0
        tcw += u.get('cache_creation_input_tokens') or 0
        tout += u.get('output_tokens') or 0
        vyzovov += ((u.get('server_tool_use') or {}).get('web_search_requests')) or 0
    cena = (tin + tcw) / 1e6 * CENA['anthropic']['in'] + tcr / 1e6 * CENA['anthropic']['in'] * 0.1 \
        + tout / 1e6 * CENA['anthropic']['out'] + vyzovov * CENA['anthropic']['poisk']
    stop = d.get('stop_reason')
    problema = None
    if stop != 'end_turn':
        problema = 'ответ не завершён: stop_reason=%s' % stop
    elif oshibki:
        problema = 'ошибка поиска: %s' % ', '.join(str(o['error_code']) for o in oshibki)
    elif not tekst.strip():
        problema = 'пустой текст ответа'
    return {'tekst': tekst, 'poiskovye_zaprosy': zaprosy, 'poiskovyh_zaprosov': len(zaprosy),
            'poiskovyh_vyzovov': vyzovov, 'istochniki': bez_dubley(rezultaty + citaty), 'citaty_v_tekste': citaty,
            'citaty_dostupny': True, 'otkrytye_stranicy': [], 'oshibki_poiska': oshibki,
            'model_v_otvete': d.get('model'), 'stop_reason': stop,
            'tokeny': {'input': tin, 'cache_read': tcr, 'cache_write': tcw, 'output': tout},
            'cena': round(cena, 5), 'cena_istochnik': 'оценка по таблице'}, problema


def razobrat_perplexity(d):
    out = d.get('output') or []
    tekst = ''.join(c.get('text', '') for o in out if o.get('type') == 'message' for c in o.get('content') or [])
    zaprosy, rezultaty = [], []
    for o in out:
        if o.get('type') == 'search_results':
            for z in o.get('queries') or []:
                if z not in zaprosy:
                    zaprosy.append(z)
            rezultaty += [{'url': x.get('url'), 'title': x.get('title')} for x in o.get('results') or []]
    citaty = bez_dubley([{'url': a.get('url'), 'title': a.get('title')} for o in out if o.get('type') == 'message'
                         for c in o.get('content') or [] for a in c.get('annotations') or [] if a.get('url')])
    u = d.get('usage') or {}
    vyzovov = (((u.get('tool_calls_details') or {}).get('search_web')) or {}).get('invocation') or 0
    problema = None
    if d.get('status') not in (None, 'completed'):
        problema = 'ответ не завершён: status=%s' % d.get('status')
    elif not tekst.strip():
        problema = 'пустой текст ответа'
    return {'tekst': tekst, 'poiskovye_zaprosy': zaprosy, 'poiskovyh_zaprosov': len(zaprosy),
            'poiskovyh_vyzovov': vyzovov, 'istochniki': bez_dubley(rezultaty + citaty),
            # Perplexity через API не отдаёт привязку цитат к тексту: «процитирован» = «показан в источниках»
            'citaty_v_tekste': citaty or None, 'citaty_dostupny': bool(citaty),
            'otkrytye_stranicy': [], 'oshibki_poiska': [], 'model_v_otvete': d.get('model'), 'tokeny': u,
            'cena': round(((u.get('cost') or {}).get('total_cost')) or 0.0, 5),
            'cena_istochnik': 'сумма из ответа Perplexity'}, problema


RAZOBRAT = {'openai': razobrat_openai, 'anthropic': razobrat_anthropic, 'perplexity': razobrat_perplexity}


# ── запросы: только сеть. Возвращают (сырой ответ, служебные данные ответа) ─────────────────

def post_json(url, body, headers, timeout=240):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        meta = {k: r.headers.get(k) for k in ('date', 'x-request-id', 'openai-version', 'openai-processing-ms')
                if r.headers.get(k)}
        return json.load(r), meta


def sprosit_openai(q, rezhim):
    body = {'model': DVIZHKI['openai']['model'], 'input': q,
            'tools': [{'type': 'web_search', 'user_location': MESTO}],
            'tool_choice': 'required' if rezhim == 'poisk' else 'auto',
            'include': ['web_search_call.action.sources']}
    return post_json('https://api.openai.com/v1/responses', body,
                     {'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})


def sprosit_perplexity(q, rezhim):
    body = {'model': DVIZHKI['perplexity']['model'], 'input': q,
            'tools': [{'type': 'web_search', 'user_location': MESTO}]}
    return post_json('https://api.perplexity.ai/v1/responses', body,
                     {'Authorization': 'Bearer ' + os.environ['PERPLEXITY_API_KEY'], 'Content-Type': 'application/json'})


def bez_shifrovki(x):
    """Зашифрованные поля занимают больше половины файла и разобрать их нельзя — в архив не кладём."""
    if isinstance(x, dict):
        return {k: bez_shifrovki(v) for k, v in x.items() if not (k.startswith('encrypted_') or k == 'signature')}
    if isinstance(x, list):
        return [bez_shifrovki(v) for v in x]
    return x


def sprosit_anthropic(q, rezhim):
    cfg = DVIZHKI['anthropic']
    c = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'], max_retries=0, timeout=240)   # повторы — наши, один уровень
    tool = {'type': cfg['tool'], 'name': 'web_search', 'max_uses': cfg['max_uses'], 'user_location': MESTO}
    kw = {'model': cfg['model'], 'max_tokens': cfg['max_tokens'], 'tools': [tool]}
    if rezhim == 'poisk':
        kw['tool_choice'] = {'type': 'any'}
    msgs = [{'role': 'user', 'content': q}]
    bloki, raundy = [], []
    while True:
        r = c.messages.create(messages=msgs, **kw)
        bloki += r.content
        raundy.append({'id': r.id, 'request_id': getattr(r, '_request_id', None), 'stop_reason': r.stop_reason,
                       'usage': r.usage.model_dump()})
        # длинный ход с серверным инструментом может прийти частями; больше 5 раундов — считаем неполным
        if r.stop_reason == 'pause_turn' and len(raundy) < 5:
            msgs = [{'role': 'user', 'content': q}, {'role': 'assistant', 'content': bloki}]
            kw.pop('tool_choice', None)
            continue
        break
    syroy = {'raundy': raundy, 'stop_reason': r.stop_reason, 'model': r.model,
             'content': bez_shifrovki([b.model_dump() for b in bloki])}
    return syroy, {'request_id': raundy[-1]['request_id']}


SPROSIT = {'openai': sprosit_openai, 'anthropic': sprosit_anthropic, 'perplexity': sprosit_perplexity}


# ── файлы ─────────────────────────────────────────────────────────────────────

def put_k_failu(den, slot, dvizhok, rezhim, qid, povtor=1):
    # Протокол v2: один вопрос задаётся несколько раз подряд. Первый повтор сохраняет старое имя,
    # чтобы уже собранные наборы v1 остались читаемыми без переноса.
    imya = '%s.json' % qid if povtor == 1 else '%s-%d.json' % (qid, povtor)
    return ITOG / den / slot / ('%s-%s' % (dvizhok, rezhim)) / imya


def prochitat(put):
    try:
        return json.loads(put.read_text(encoding='utf-8'))
    except Exception:
        return None


def zapisat_atomarno(put, obj):
    put.parent.mkdir(parents=True, exist_ok=True)
    vr = put.with_name(put.name + '.tmp%d' % os.getpid())
    vr.write_text(json.dumps(obj, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    os.replace(vr, put)


class Zamok:
    """Один запуск на слот. Замок от умершего процесса снимается сам."""
    def __init__(self, papka):
        self.put = papka / '.zamok'

    def __enter__(self):
        self.put.parent.mkdir(parents=True, exist_ok=True)
        for _ in range(2):
            try:
                fd = os.open(self.put, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return self
            except FileExistsError:
                try:
                    pid = int(self.put.read_text().strip() or 0)
                    os.kill(pid, 0)
                except (ValueError, ProcessLookupError):
                    self.put.unlink(missing_ok=True)
                    continue
                except PermissionError:
                    pass
                sys.exit('слот уже выполняется другим запуском (процесс %s). Второй не запускаю.' % self.put.read_text().strip())
        sys.exit('не удалось взять замок %s' % self.put)

    def __exit__(self, *a):
        self.put.unlink(missing_ok=True)


def vse_zapisi(vse_nabory=False):
    # vse_nabory=True — по всем наборам замера (zamer-v1, zamer-v2, …). Так считаются деньги:
    # кошелёк один на всех, и новый набор не должен думать, что месяц начался заново.
    papki = sorted(BAZA.glob('zamer-*/api')) if vse_nabory else [ITOG]
    for papka in papki:
        for f in sorted(papka.glob('*/*/*/*.json')):
            if re.fullmatch(r'[A-Z]+\d+(-\d+)?\.json', f.name):
                yield f, prochitat(f)


def trata_za_mesyac(mesyac):
    s = {k: 0.0 for k in DVIZHKI}
    for f, d in vse_zapisi(vse_nabory=True):
        if d and str(d.get('den', '')).startswith(mesyac) and d.get('dvizhok') in s:
            s[d['dvizhok']] += sum(p.get('cena', 0.0) for p in d.get('popytki', []))
    return s


def srednyaya_cena():
    summa, n = {k: 0.0 for k in DVIZHKI}, {k: 0 for k in DVIZHKI}
    for f, d in vse_zapisi():
        if d and d.get('status') == 'ok' and d.get('dvizhok') in summa and d.get('vyzhimka'):
            summa[d['dvizhok']] += d['vyzhimka'].get('cena', 0.0)
            n[d['dvizhok']] += 1
    return {k: (summa[k] / n[k] if n[k] >= 3 else SREDNYAYA_PO_UMOLCHANIYU[k]) for k in DVIZHKI}


# ── одна задача ───────────────────────────────────────────────────────────────

def vid_oshibki(kod, tekst):
    if PROBLEMA_KOSHELKA.search(tekst or ''):
        return 'koshelek'
    return 'vremennaya' if kod is None or kod in (408, 409, 429) or kod >= 500 else 'postoyannaya'


def odna_zadacha(z, obshchee):
    q, dv, rz, put = z['q'], z['dvizhok'], z['rezhim'], z['put']
    otpechatok, sred = obshchee['otpechatok'], obshchee['sred']
    staroe = prochitat(put)
    if staroe and staroe.get('status') == 'ok' and staroe.get('otpechatok') == otpechatok:
        return dv, 'уже готово'
    popytki = list(staroe.get('popytki', [])) if staroe and staroe.get('otpechatok') == otpechatok else []
    zapis = {'vopros_id': q['id'], 'povtor': z.get('povtor', 1),
             'vopros': q['text'], 'versiya_spiska': obshchee['versiya'], 'otpechatok': otpechatok,
             'dvizhok': dv, 'rezhim': rz, 'model_zaproshena': DVIZHKI[dv]['model'],
             'instrument': DVIZHKI[dv].get('tool', 'web_search'), 'mesto': MESTO, 'slot': z['slot'], 'den': z['den'],
             'vne_okna': obshchee['vne_okna'], 'zapusk_id': obshchee['zapusk_id']}

    with _lock:
        if dv in _koshelek_pust:
            prichina = 'кошелёк %s пуст' % dv
        elif obshchee['mesyac'][dv] + _potracheno_zapusk[dv] + _rezerv[dv] + sred[dv] > MESYACHNYY_POTOLOK[dv]:
            prichina = 'месячный потолок %s $%.2f' % (dv, MESYACHNYY_POTOLOK[dv])
        else:
            prichina = None
            _rezerv[dv] += sred[dv]          # резерв до вызова: параллельные задачи не проскочат потолок
    if prichina:
        zapis.update({'status': 'propushchen', 'prichina': prichina, 'popytki': popytki})
        zapisat_atomarno(put, zapis)
        return dv, 'propushchen: ' + prichina

    status, prichina, vyzhimka, syroy = 'oshibka', None, None, None
    try:
        for n in range(1, 4):
            t = time.time()
            p = {'n': len(popytki) + 1, 'nachalo': seychas_pt().isoformat(timespec='seconds'),
                 'zapusk_id': obshchee['zapusk_id'], 'cena': 0.0}
            kod = tekst_oshibki = None
            try:
                syroy, meta = SPROSIT[dv](q['text'], rz)
            except urllib.error.HTTPError as e:
                kod, tekst_oshibki = e.code, e.read().decode(errors='ignore')[:600]
            except anthropic.APIStatusError as e:
                kod, tekst_oshibki = e.status_code, str(e)[:600]
            except Exception as e:   # сеть, таймаут
                kod, tekst_oshibki = None, '%s: %s' % (type(e).__name__, str(e)[:500])
            if tekst_oshibki is not None:
                p.update({'ishod': 'http %s' % kod if kod else 'set', 'tekst': tekst_oshibki, 'sekund': round(time.time() - t, 1)})
                popytki.append(p)
                prichina = ('HTTP %s: ' % kod if kod else '') + tekst_oshibki[:200]
                vid = vid_oshibki(kod, tekst_oshibki)
                if vid == 'koshelek':
                    raise KoshelekPust(prichina)
                if vid == 'postoyannaya' or n == 3:
                    break
                time.sleep(15 * n)
                continue
            # ответ оплачен: разбираем; ошибку самого разбора не перезадаём за деньги
            try:
                vyzhimka, problema = RAZOBRAT[dv](syroy)
            except Exception as e:
                vyzhimka, problema = None, 'разбор упал: %s: %s' % (type(e).__name__, str(e)[:200])
            cena = vyzhimka['cena'] if vyzhimka else sred[dv]
            p.update({'ishod': problema or 'ok', 'sekund': round(time.time() - t, 1), 'cena': cena, 'meta': meta})
            popytki.append(p)
            with _lock:
                _potracheno_zapusk[dv] += cena
            if vyzhimka is None:
                status, prichina = 'oshibka_razbora', problema
                break
            if not problema:
                status, prichina = 'ok', None
                break
            status = 'oshibka_poiska' if problema.startswith('ошибка поиска') else 'nepolnyy'
            prichina = problema
            if n == 3:
                break
            time.sleep(5)
    except KoshelekPust as e:
        with _lock:
            _koshelek_pust.add(dv)
        status, prichina = 'propushchen', 'кошелёк %s пуст: %s' % (dv, str(e)[:150])
    finally:
        with _lock:
            _rezerv[dv] -= sred[dv]

    tek = prochitat(put)     # хороший ответ не затираем ничем
    if tek and tek.get('status') == 'ok' and tek.get('otpechatok') == otpechatok and status != 'ok':
        return dv, 'уже готово'
    zapis.update({'status': status, 'prichina': prichina, 'popytki': popytki, 'vyzhimka': vyzhimka, 'syroy_otvet': syroy})
    zapisat_atomarno(put, zapis)
    return dv, status if status == 'ok' else '%s: %s' % (status, (prichina or '')[:140])


# ── план и сводка ─────────────────────────────────────────────────────────────

def sostavit_zadachi(qs, den, slot, dvizhki, rezhimy, nabor, otpechatok, povtorov=1):
    zadachi, gotovo, arhiv = [], 0, []
    gruppa = lambda q: 0 if q['opornyy'] else (1 if q['rukami'] else 2)   # опорные → ручные → только API
    for q in sorted(qs, key=lambda q: (gruppa(q), q['id'])):
        for dv in dvizhki:
            for rz, nab in DVIZHKI[dv]['rezhimy'].items():
                if len(DVIZHKI[dv]['rezhimy']) > 1 and rz not in rezhimy:
                    continue
                if (nabor or nab) == 'opornye' and not q['opornyy']:
                    continue
                for povtor in range(1, povtorov + 1):
                    put = put_k_failu(den, slot, dv, rz, q['id'], povtor)
                    d = prochitat(put)
                    if d and d.get('status') == 'ok' and d.get('otpechatok') == otpechatok:
                        gotovo += 1
                        continue
                    if d and d.get('otpechatok') != otpechatok:
                        arhiv.append(put)
                    zadachi.append({'q': q, 'dvizhok': dv, 'rezhim': rz, 'put': put,
                                    'slot': slot, 'den': den, 'povtor': povtor})
    return zadachi, gotovo, arhiv


def svodka():
    if not ITOG.exists():
        print('ответов пока нет')
        return
    stroki, bitye = {}, []
    for f, d in vse_zapisi():
        if d is None:
            bitye.append(str(f.relative_to(ITOG)))
            continue
        k = (d.get('den'), d.get('slot'), '%s-%s' % (d.get('dvizhok'), d.get('rezhim')))
        s = stroki.setdefault(k, {'ok': 0, 'nepoln': 0, 'prop': 0, 'err': 0, 'cena': 0.0, 'vne': 0})
        st = d.get('status')
        s['ok' if st == 'ok' else 'prop' if st == 'propushchen' else 'nepoln' if st in ('nepolnyy', 'oshibka_poiska') else 'err'] += 1
        s['cena'] += sum(p.get('cena', 0.0) for p in d.get('popytki', []))
        s['vne'] += 1 if d.get('vne_okna') else 0
    print('%-11s %-7s %-18s %4s %8s %8s %7s %8s' % ('день', 'слот', 'нейросеть-режим', 'ok', 'неполн.', 'пропуск', 'ошибок', 'цена $'))
    for (den, slot, dr), s in sorted(stroki.items(), key=lambda x: (x[0][1] == 'proba', str(x[0]))):
        print('%-11s %-7s %-18s %4d %8d %8d %7d %8.3f%s' % (den, slot, dr, s['ok'], s['nepoln'], s['prop'], s['err'], s['cena'],
                                                         '  (вне окна: %d)' % s['vne'] if s['vne'] else ''))
    mesyac = seychas_pt().strftime('%Y-%m')
    t = trata_za_mesyac(mesyac)
    print('месяц %s: ' % mesyac + ' · '.join('%s $%.2f из $%.2f' % (k, t[k], MESYACHNYY_POTOLOK[k]) for k in PORYADOK_DVIZHKOV)
          + '  (OpenAI и Anthropic — оценка, точно в консолях; Perplexity — точно)')
    if bitye:
        print('битые файлы:', ', '.join(bitye))


def uvedomit(tekst):
    try:
        subprocess.run(['osascript', '-e', 'display notification %s with title "Смотритель"' % json.dumps(tekst, ensure_ascii=False)],
                       timeout=10, capture_output=True)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--slot', choices=tuple(OKNA))
    ap.add_argument('--den', help='по умолчанию сегодня по Лос-Анджелесу')
    ap.add_argument('--tolko', help='номера вопросов через запятую')
    ap.add_argument('--nabor', choices=('vse', 'opornye'), help='переопределить набор вопросов для всех режимов')
    ap.add_argument('--nabor-zamera', help='другой набор замера: свой список вопросов и своя папка ответов '
                                           '(например zamer-v2 — тогда voprosy.json лежит в нём же)')
    ap.add_argument('--dvizhki', default=','.join(PORYADOK_DVIZHKOV))
    ap.add_argument('--rezhimy', default='auto,poisk')
    ap.add_argument('--potokov', type=int, default=4)
    ap.add_argument('--povtorov', type=int, default=1,
                    help='сколько раз задать каждый вопрос подряд (протокол v2 — 7)')
    ap.add_argument('--vne-okna', action='store_true', help='разрешить запуск вне часов слота (помечается в ответах)')
    ap.add_argument('--plan', action='store_true', help='показать задачи и оценку цены без запросов')
    ap.add_argument('--svodka', action='store_true')
    a = ap.parse_args()

    if a.svodka:
        return svodka()
    if not a.slot:
        ap.error('нужен --slot: ' + ', '.join(OKNA))

    dvizhki = [x.strip() for x in a.dvizhki.split(',') if x.strip()]
    rezhimy = {x.strip() for x in a.rezhimy.split(',') if x.strip()}
    if not dvizhki or set(dvizhki) - set(DVIZHKI):
        ap.error('неизвестная нейросеть: %s (есть: %s)' % (', '.join(sorted(set(dvizhki) - set(DVIZHKI))), ', '.join(DVIZHKI)))
    if not rezhimy or rezhimy - {'auto', 'poisk'}:
        ap.error('режимы только auto и poisk')

    if a.nabor_zamera:
        global VOPROSY, ITOG
        VOPROSY = BAZA / a.nabor_zamera / 'voprosy.json'
        ITOG = BAZA / a.nabor_zamera / 'api'
        if not VOPROSY.exists():
            sys.exit('нет списка вопросов: %s' % VOPROSY)
    versiya, otpechatok, qs = zagruzit_voprosy()
    if a.tolko:
        nuzhno = {x.strip() for x in a.tolko.split(',') if x.strip()}
        lishnie = nuzhno - {q['id'] for q in qs}
        if lishnie:
            ap.error('таких вопросов нет: %s' % ', '.join(sorted(lishnie)))
        qs = [q for q in qs if q['id'] in nuzhno]

    sey = seychas_pt()
    den = a.den or sey.strftime('%Y-%m-%d')
    okno = OKNA[a.slot]
    vne = bool(okno) and not (okno[0] <= sey.hour < okno[1] and den == sey.strftime('%Y-%m-%d'))
    if vne and not a.vne_okna and not a.plan:
        sys.exit('сейчас %s по Лос-Анджелесу — вне окна слота %s (%d:00–%d:00). '
                 'Добор вне окна: добавьте --vne-okna (ответы будут помечены).' % (sey.strftime('%d.%m %H:%M'), a.slot, okno[0], okno[1]))

    zadachi, gotovo, arhiv = sostavit_zadachi(qs, den, a.slot, dvizhki, rezhimy, a.nabor, otpechatok, a.povtorov)
    sred = srednyaya_cena()
    mesyac = trata_za_mesyac(den[:7])
    print('список %s · отпечаток настроек %s · день %s · слот %s · %s' % (versiya, otpechatok, den, a.slot, MESTO['city']))
    if BAZA != ZDES.parent:
        print('база: %s (копия вне Google Drive — так работает автозапуск)' % BAZA)
    print('к выполнению %d, уже готово %d%s' % (len(zadachi), gotovo,
                                                ', с другими настройками (уйдут в архив) %d' % len(arhiv) if arhiv else ''))
    ne_vlezaet = []
    for k in PORYADOK_DVIZHKOV:
        n = sum(1 for z in zadachi if z['dvizhok'] == k)
        if n:
            itogo = mesyac[k] + n * sred[k]
            flag = itogo > MESYACHNYY_POTOLOK[k]
            print('  %-10s задач %3d · оценка $%.2f · за месяц станет $%.2f из $%.2f%s' % (
                k, n, n * sred[k], itogo, MESYACHNYY_POTOLOK[k], '  ← НЕ ВЛЕЗАЕТ' if flag else ''))
            if flag:
                ne_vlezaet.append(k)
    if a.plan:
        for z in zadachi:
            print('    %-6s %-10s %-6s → %s' % (z['q']['id'], z['dvizhok'], z['rezhim'], z['put'].relative_to(ZDES.parent)))
        return
    if ne_vlezaet:
        sys.exit('не запускаю: по %s оценка не влезает в месячный потолок, а частичный прогон искажает замер. '
                 'Поднимите лимит в консоли и MESYACHNYY_POTOLOK или уберите нейросеть через --dvizhki.' % ', '.join(ne_vlezaet))
    if not zadachi:
        print('делать нечего — всё готово')
        return svodka()

    klyuchi()
    zapusk_id = seychas_pt().strftime('%Y%m%d-%H%M%S') + '-%d' % os.getpid()
    papka_slota = ITOG / den / a.slot
    with Zamok(papka_slota):
        for put in arhiv:   # ответы со старыми настройками не затираем — уносим в архив
            cel = ITOG.parent / 'api-arhiv' / put.relative_to(ITOG)
            cel.parent.mkdir(parents=True, exist_ok=True)
            os.replace(put, cel.with_name('%s.%s.json' % (cel.stem, zapusk_id)))
        obshchee = {'otpechatok': otpechatok, 'versiya': versiya, 'sred': sred, 'mesyac': mesyac,
                    'vne_okna': vne, 'zapusk_id': zapusk_id}
        # по кругу между нейросетями, внутри — опорные первыми
        po_dv = [[z for z in zadachi if z['dvizhok'] == k] for k in PORYADOK_DVIZHKOV]
        krug = [z for i in range(max(len(x) for x in po_dv)) for x in po_dv if i < len(x) for z in [x[i]]]
        schet, nachalo = {}, time.time()
        with ThreadPoolExecutor(max_workers=max(1, a.potokov)) as ex:
            for i, (dv, st) in enumerate(ex.map(lambda z: odna_zadacha(z, obshchee), krug), 1):
                klyuch = 'ok' if st in ('ok', 'уже готово') else st.split(':')[0]
                schet[klyuch] = schet.get(klyuch, 0) + 1
                if klyuch != 'ok':
                    print('  [%d/%d] %s — %s' % (i, len(krug), dv, st))
                elif i % 20 == 0:
                    print('  [%d/%d] %.0f мин' % (i, len(krug), (time.time() - nachalo) / 60))
        itog = {'zapusk_id': zapusk_id, 'den': den, 'slot': a.slot, 'otpechatok': otpechatok, 'vne_okna': vne,
                'zadach': len(krug), 'uzhe_bylo_gotovo': gotovo, 'ishody': schet,
                'potracheno': {k: round(v, 4) for k, v in _potracheno_zapusk.items()},
                'minut': round((time.time() - nachalo) / 60, 1), 'koshelek_pust': sorted(_koshelek_pust)}
        zapisat_atomarno(papka_slota / ('_itog-%s.json' % zapusk_id), itog)
    print('итог запуска:', json.dumps(schet, ensure_ascii=False), '· потрачено (оценка):',
          ', '.join('%s $%.3f' % (k, v) for k, v in _potracheno_zapusk.items()))
    ne_ok = sum(v for k, v in schet.items() if k != 'ok')
    uvedomit('Слот %s %s: готово %d из %d%s' % (a.slot, den, schet.get('ok', 0), len(krug),
                                                  ', не готово %d — запустите ещё раз' % ne_ok if ne_ok else ''))
    svodka()


if __name__ == '__main__':
    main()
