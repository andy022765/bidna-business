# -*- coding: utf-8 -*-
"""Проверка SMS-согласия на ЖИВОМ сайте (или предпросмотре) — по телу ответа, не по коду.

    python3 Pivot/sms-kampaniya/proverit.py
    python3 Pivot/sms-kampaniya/proverit.py --dom https://<предпросмотр>.netlify.app

Только читает: GET страниц и ?zdorovie=1 функции (та пишет одну служебную пробу
в своё хранилище — без номеров). Согласий не создаёт и писем не шлёт.
Код возврата 1 при любой находке. Прошло чисто — можно подавать кампанию (KAMPANIYA.md).
"""
import html
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request

# Python с python.org не видит системных сертификатов macOS: без certifi каждый запрос падает
# с CERTIFICATE_VERIFY_FAILED и выглядит как «код 0» (так же сделано в shtab/sayty/reviziya.py).
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()

KAMP = os.path.dirname(os.path.abspath(__file__))
DOM = 'https://businessinteldna.com'
if '--dom' in sys.argv:
    DOM = sys.argv[sys.argv.index('--dom') + 1].rstrip('/')

UA = 'BusinessIntelDNA-Proverka/1.0 (+https://businessinteldna.com)'
beda = []


def vzyat(put):
    req = urllib.request.Request(DOM + put, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as e:
        return 0, str(e)


def tekst(h):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', h, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).lower()


def nado(put, h, frazy, net=()):
    t = tekst(h)
    for f in frazy:
        if f.lower() not in t:
            beda.append('%s: нет «%s»' % (put, f))
    for f in net:
        if f.lower() in t:
            beda.append('%s: осталось «%s»' % (put, f))


# 1. Сами страницы согласия. Netlify на выкладке переписывает атрибуты в одинарные кавычки —
#    регулярки ловят оба вида (грабля ревизии 24.09).
for put, yaz in (('/sms-consent/', 'en'), ('/sms-consent/ru/', 'ru')):
    kod, h = vzyat(put)
    if kod != 200:
        beda.append('%s: код %s' % (put, kod))
        continue
    galochki = re.findall(r"<input[^>]*type=[\"']checkbox[\"'][^>]*>", h, re.I)
    if len(galochki) != 2:
        beda.append('%s: галочек %d, ждали 2' % (put, len(galochki)))
    if any(re.search(r'\bchecked\b|\brequired\b', g) for g in galochki):
        beda.append('%s: галочка стоит заранее или обязательна' % put)
    if re.search(r"<form[^>]*\s(?:data-)?netlify(?=[\s=>/])", h, re.I):
        beda.append('%s: форма стала формой Netlify — сработает submission-created' % put)
    if 'sms-soglasie' not in h:
        beda.append('%s: форма не шлёт в sms-soglasie' % put)
    # Без method=post форма без JavaScript уходит GET-ом, и номер оседает в адресе страницы.
    if not re.search(r"<form[^>]*\bmethod=[\"']?post[\"']?[^>]*\baction=[\"']/\.netlify/functions/sms-soglasie[\"']", h, re.I):
        beda.append('%s: форма не method=post action=/.netlify/functions/sms-soglasie' % put)
    # Пиксель Meta с автосопоставлением шлёт поле телефона в Meta — против обещания «не передаём».
    if re.search(r'connect\.facebook\.net|fbq\(', h):
        beda.append('%s: на странице пиксель Meta — номер телефона уйдёт третьему лицу (30932)' % put)
    for href in ('/sms', '/privacy', '/terms'):
        if not re.search(r"href=[\"']%s[\"']" % re.escape(href), h):
            beda.append('%s: нет ссылки %s' % (put, href))
    nado(put, h, ['Business Intelligence DNA', 'Wealthboosterpro LLC', 'Msg & data rates may apply', 'STOP', 'HELP',
                  '+1 (424) 781-1913',
                  'not a condition of any purchase' if yaz == 'en' else 'не является условием',
                  'up to 8 messages per month' if yaz == 'en' else 'не больше 8 сообщений в месяц',
                  'marketing texts' if yaz == 'en' else 'рекламные sms'])

# 2. Документы описывают ЭТУ программу, а не старую «устно в звонке». Ссылка на страницу
#    согласия — настоящая <a href>: заявка обещает, что до неё можно дойти с /sms, а pandoc
#    из голого адреса ссылку не делает.
SSYLKA_SOGLASIE = r"href=[\"']https://businessinteldna\.com/sms-consent/[\"']"


def ssylka(put, h, shablon, chto):
    if not re.search(shablon, h, re.I):
        beda.append('%s: нет кликабельной ссылки на %s' % (put, chto))


kod, h = vzyat('/sms')
nado('/sms', h, ['sms-consent', 'up to 8 messages per month', 'Consent is not a condition of any purchase',
                 'No mobile information will be shared with third parties', 'REVOKE', 'OPTOUT',
                 'Marketing messages'],
     net=['verbally', 'up to 4 messages'])
ssylka('/sms', h, SSYLKA_SOGLASIE, '/sms-consent/')
kod, h = vzyat('/privacy')
nado('/privacy', h, ['sms-consent', 'up to 8 messages per month', 'equally binding', 'for 5 years',
                     'No mobile information will be shared with third parties'],
     net=['verbally asked us', 'up to 4 messages'])
ssylka('/privacy', h, SSYLKA_SOGLASIE, '/sms-consent/')
kod, h = vzyat('/contacts')
nado('/contacts', h, ['sms-consent', 'up to 8 messages per month'], net=['made verbally'])
ssylka('/contacts', h, SSYLKA_SOGLASIE, '/sms-consent/')

# 2а. Главная — первое, что открывает проверяющий по адресу бренда: английская версия
#     и ссылка на /sms в подвале (vstroit.py правит подвал в merge_site.py).
for put in ('/', '/en/'):
    kod, h = vzyat(put)
    if kod != 200:
        beda.append('%s: код %s' % (put, kod))
        continue
    ssylka(put, h, r"href=[\"']/sms[\"']", '/sms в подвале')
kod, h = vzyat('/')
ssylka('/', h, r"href=[\"']/en/[\"']", 'английскую главную /en/')

# 2б. Каждый адрес сайта из полей заявки живой: проверяющий по ним ходит.
kamp = json.load(open(os.path.join(KAMP, 'kampaniya.json'), encoding='utf-8'))
adresa = set()
for pole, v in kamp.items():
    if not pole.startswith('_'):
        for x in (v if isinstance(v, list) else [v]):
            adresa.update(re.findall(r'https://businessinteldna\.com(/[^\s,;)\'"]*)?', str(x)))
for put in sorted({a.rstrip('.') or '/' for a in adresa}):
    kod, _ = vzyat(put)
    if kod != 200:
        beda.append('адрес из заявки %s: код %s' % (put, kod))

# 2в. Пример 4 ведёт на квартал видимости (/visibility/) — оффер должен ещё висеть.
# До окна 29.09 пример 4 обещал диагностику «free for the first ten» за отзыв; окно этот оффер
# сняло (reviziya.py ловит, если он вернётся), kampaniya.json переведён на видимость.
kod, h = vzyat('/visibility/')
nado('/visibility/', h, ['quarter'])

# 3. Функция: хранилище не только поднялось, но пишет и читает.
kod, telo = vzyat('/.netlify/functions/sms-soglasie?zdorovie=1')
try:
    j = json.loads(telo)
except Exception:
    j = {}
if not (j.get('ok') and j.get('pishet')):
    beda.append('функция: хранилище не пишет — %s %s' % (kod, telo[:200]))
tekushchie = json.load(open(os.path.join(KAMP, 'tekst-soglasiya.json'), encoding='utf-8'))['tekushchaya'].values()
for v in tekushchie:
    if v not in (j.get('versii') or []):
        beda.append('функция: не знает версию текста %s' % v)
if j.get('podtverzhdenie') not in ('vyklyucheno', None) and '--posle-odobreniya' not in sys.argv:
    beda.append('функция: подтверждающее SMS «%s», а кампания ещё не одобрена' % j.get('podtverzhdenie'))

# 4. Чтение журнала без ключа закрыто.
kod, _ = vzyat('/.netlify/functions/sms-soglasie')
if kod != 404:
    beda.append('функция: GET без ключа отдаёт %s, ждали 404' % kod)

print('Проверено: %s' % DOM)
if beda:
    print('НАХОДКИ (%d):' % len(beda))
    for b in beda:
        print('  ✗ ' + b)
    sys.exit(1)
print('  ✓ /sms-consent/ и /sms-consent/ru/, /sms, /privacy, /contacts, главная, адреса заявки, функция — чисто.'
      ' Можно подавать кампанию.')
