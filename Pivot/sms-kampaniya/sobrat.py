# -*- coding: utf-8 -*-
"""Страницы согласия на SMS: /sms-consent/ (английская, основная) и /sms-consent/ru/.

    python3 sobrat.py           — собрать в ./out/ и проверить (сайт не трогает)
    python3 sobrat.py <ST>      — то же + разложить в папку собранного сайта <ST>;
                                  так её зовёт deploy.sh после merge_site.py

Что делает:
  1. Читает tekst-soglasiya.json — единственное место правды для текста согласия.
  2. Считает отпечаток sha256 каждой версии текста и вписывает его в sms-soglasie.js
     (блок VERSII): функция записывает в журнал, на какую версию согласился человек.
  3. Собирает две страницы и проверяет их на требования операторов связи — галочки
     не стоят заранее, есть бренд, частота, «Msg & data rates», STOP/HELP, «не условие
     покупки», ссылки на /sms /privacy /terms, форма уходит POST (без JS номер не должен
     попасть в адрес страницы), пикселя Meta нет. Нет чего-то — падает.
  3а. Сверяет заявку kampaniya.json: тексты SMS = tekst-soglasiya.json, ни одной кириллической
     буквы в полях (отказ 30910), юрлицо рядом с брендом (30918), слова STOP/HELP из заявки
     названы в pravo/sms.md, а ссылки на страницу согласия в pravo/ — настоящие ссылки
     (pandoc не делает их из голого адреса) и не ломают _rekvizity.fill().
  4. С аргументом <ST> дополнительно падает, если:
       · копия функции в netlify-functions/ разошлась с исходником;
       · /sms (docs/pravo/sms.md) ещё описывает старую программу «только устно в звонке» —
         страница согласия, противоречащая условиям, хуже, чем никакой.

Почему адрес /sms-consent/, а не /sms/consent. /sms — это файл sms.html в корне,
обязательное поле заявки в Twilio. Папка sms/ рядом с ним заставила бы Netlify выбирать
между sms.html и каталогом — рисковать страницей, которую проверяющий открывает первой,
незачем.
"""
import hashlib
import html
import json
import os
import re
import shutil
import sys

KAMP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(KAMP))            # «Our Business (Andrii & Masha)»
ISTOCHNIK = os.path.join(KAMP, 'tekst-soglasiya.json')
FUNKCIYA = os.path.join(KAMP, 'sms-soglasie.js')
FUNKCIYA_NA_SAYTE = os.path.join(ROOT, 'netlify-functions', 'sms-soglasie.js')
KAMPANIYA = os.path.join(KAMP, 'kampaniya.json')
OUT = os.path.join(KAMP, 'out')

ADRES = {'en': 'sms-consent/index.html', 'ru': 'sms-consent/ru/index.html'}
URL = {'en': '/sms-consent/', 'ru': '/sms-consent/ru/'}
DOMEN = 'https://businessinteldna.com'


def otpechatok(tekst):
    """Отпечаток версии: sha256 от канонического JSON блока «tekst»."""
    s = json.dumps(tekst, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


def vpisat_versii(d):
    """Переписать блок VERSII в исходнике функции. Возвращает True, если файл изменился."""
    versii = {k: {'yazyk': v['yazyk'], 'sha256': otpechatok(v['tekst'])}
              for k, v in sorted(d['versii'].items())}
    podtv = {'en': d['sms']['podtverzhdenie_en'], 'ru': d['sms']['podtverzhdenie_ru']}
    stroki = ['// <<VERSII — блок пишет Pivot/sms-kampaniya/sobrat.py из tekst-soglasiya.json. Руками не править.',
              'const VERSII = {']
    stroki += ['  %s: { "yazyk": %s, "sha256": %s }%s' % (
        json.dumps(k), json.dumps(v['yazyk']), json.dumps(v['sha256']),
        ',' if i < len(versii) - 1 else '') for i, (k, v) in enumerate(versii.items())]
    stroki += ['};', 'const PODTVERZHDENIE = {']
    stroki += ['  %s: %s%s' % (json.dumps(k), json.dumps(v, ensure_ascii=False), ',' if k == 'en' else '')
               for k, v in podtv.items()]
    stroki += ['};', '// VERSII>>']
    blok = '\n'.join(stroki)

    js = open(FUNKCIYA, encoding='utf-8').read()
    novy, n = re.subn(r'// <<VERSII.*?// VERSII>>', lambda _: blok, js, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('  ! в sms-soglasie.js не нашёл блок // <<VERSII … // VERSII>>')
    if novy != js:
        open(FUNKCIYA, 'w', encoding='utf-8').write(novy)
        return True
    return False


def znak():
    """Знак бренда тем же способом, что у юр-страниц. Нет — страница без знака, не падаем."""
    try:
        sys.path.insert(0, os.path.join(ROOT, 'brand', '_src'))
        from inline import inline, favicon_uri
        return (inline('mark/dna-mark-compact-reverse.svg'),
                '<link rel="icon" href="%s">' % favicon_uri('icon/favicon.svg'))
    except Exception as e:
        print('  · знак бренда не подтянулся (%s) — собираю без него' % e)
        return '', ''


# Шрифты — системные, без Google Fonts: страница собирает номер телефона, и лишнего
# стороннего сервиса на ней быть не должно (раздел 6 политики его бы не описывал).
PAGE = """<!doctype html>
<html lang="{{lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{desc}}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{{canonical}}">
<link rel="alternate" hreflang="en" href="https://businessinteldna.com/sms-consent/">
<link rel="alternate" hreflang="ru" href="https://businessinteldna.com/sms-consent/ru/">
{{favicon}}
<style>
:root{--navy:#1b2557;--navy-deep:#0f1430;--gold:#c69a4c;--gold-2:#9a6f24;--gold-soft:#e3c88a;
 --paper:#f7f5f0;--card:#fffefb;--ink:#171b2e;--muted:#565d78;--line:rgba(23,27,46,.16);
 --ok:#1f6b45;--ok-bg:#e7f3ec;--err:#9b2c2c;--err-bg:#fbeaea;
 --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
 --serif:Georgia,'Times New Roman',serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}
.bar{background:var(--navy-deep)}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.logo{display:inline-flex;align-items:center;gap:10px;min-height:52px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em}
.logo .g{color:var(--gold-soft)}
.logo .mark{height:30px;width:auto;display:block;flex:none}
.bar nav{display:flex;gap:14px}
.bar nav a{color:var(--gold-soft);text-decoration:none;font-size:14.5px;font-weight:600;min-height:44px;display:inline-flex;align-items:center}
.head{padding:36px 0 4px}
.eyebrow{font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-2);margin-bottom:8px}
h1{font:600 clamp(27px,5.4vw,38px)/1.18 var(--serif);margin:0 0 12px}
.lede{color:var(--muted);margin:0 0 6px}
form{margin:22px 0 10px;padding:22px 20px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.pole{margin:0 0 18px}
.pole label{display:block;font-weight:600;font-size:15.5px;margin-bottom:6px}
.pole label small{font-weight:400;color:var(--muted)}
.pole input{width:100%;font:inherit;font-size:17px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);min-height:48px}
.pole input:focus,.vybor input:focus-visible{outline:3px solid rgba(198,154,76,.45);outline-offset:1px}
.pole .pod{font-size:14px;color:var(--muted);margin-top:5px}
.vybor{display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:10px;margin:0 0 12px;cursor:pointer;background:#fff}
.vybor input{flex:none;width:24px;height:24px;margin:2px 0 0;accent-color:var(--navy);cursor:pointer}
.vybor span{font-size:15.5px;line-height:1.5}
.raskrytie{font-size:14.5px;line-height:1.55;color:var(--ink);margin:14px 0 18px;padding:12px 14px;background:rgba(198,154,76,.1);border-radius:10px}
.raskrytie a,.meta a,.doc a{color:var(--gold-2)}
button{font:inherit;font-weight:700;font-size:17px;color:#fff;background:var(--navy);border:0;border-radius:10px;padding:13px 28px;min-height:48px;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
.itog{margin:14px 0 0;padding:12px 14px;border-radius:10px;font-size:15.5px;display:none}
.itog.ok{display:block;background:var(--ok-bg);color:var(--ok)}
.itog.err{display:block;background:var(--err-bg);color:var(--err)}
.itog.info{display:block;background:rgba(27,37,87,.07);color:var(--navy)}
/* Ответ без JavaScript: функция возвращает на страницу с #якорем, блок показывает :target */
.bezjs{display:none;margin:14px 0 0;padding:12px 14px;border-radius:10px;font-size:15.5px}
.bezjs:target{display:block}
.bezjs.ok{background:var(--ok-bg);color:var(--ok)}
.bezjs.err{background:var(--err-bg);color:var(--err)}
.bezjs.info{background:rgba(27,37,87,.07);color:var(--navy)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.doc{padding:4px 0 40px;color:var(--muted);font-size:15.5px}
.doc p{margin:0 0 10px}
footer{background:var(--navy-deep);color:#aeb4d0;padding:26px 0;font-size:14.5px}
footer a{color:var(--gold-soft);text-decoration:none;display:inline-block;min-height:44px;line-height:44px;margin-right:14px}
footer .req{color:#8890b0;font-size:13.5px;line-height:1.6;margin-top:6px}
#nl-badge-frame,iframe[title="Powered by Netlify"]{display:none!important}
</style>
</head>
<body>
<header class="bar"><div class="wrap">
  <a class="logo" href="/">{{mark}}<span>Business Intelligence <span class="g">DNA</span></span></a>
  <nav><a href="{{drugoy_url}}" hreflang="{{drugoy_lang}}" lang="{{drugoy_lang}}">{{drugoy_yazyk}}</a><a href="/">{{nazad}}</a></nav>
</div></header>

<main class="wrap">
  <div class="head">
    <div class="eyebrow">{{eyebrow}}</div>
    <h1>{{h1}}</h1>
    <p class="lede">{{lede}}</p>
  </div>

  <form id="forma" method="post" action="/.netlify/functions/sms-soglasie" novalidate data-versiya="{{versiya}}" data-yazyk="{{lang}}">
    <input type="hidden" name="versiya" value="{{versiya}}">
    <input type="hidden" name="yazyk" value="{{lang}}">
    <div class="pole">
      <label for="telefon">{{telefon}}</label>
      <input id="telefon" name="telefon" type="tel" inputmode="tel" autocomplete="tel" placeholder="(555) 123-4567" maxlength="20">
      <div class="pod">{{telefon_podskazka}}</div>
    </div>
    <div class="pole">
      <label for="pochta">{{pochta}} <small>({{neobyaz}})</small></label>
      <input id="pochta" name="pochta" type="email" autocomplete="email" maxlength="120">
      <div class="pod">{{pochta_podskazka}}</div>
    </div>

    <label class="vybor"><input type="checkbox" name="servis" id="servis"><span>{{galochka_servis}}</span></label>
    <label class="vybor"><input type="checkbox" name="dozhim" id="dozhim"><span>{{galochka_dozhim}}</span></label>

    <p class="raskrytie">{{raskrytie}}</p>

    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="sayt" tabindex="-1" autocomplete="off"></label></div>
    <button type="submit" id="knopka">{{knopka}}</button>
    <div class="itog" id="itog" role="status" aria-live="polite"></div>
{{bez_js}}
    <noscript><p class="itog info" style="display:block">{{noscript}}</p></noscript>
  </form>

  <div class="doc">
    <p>{{potom}}</p>
    <p>{{chego_net}}</p>
  </div>
</main>

<footer><div class="wrap">
  <div>{{ssylki}}</div>
  <div class="req">Wealthboosterpro LLC (DBA Business Intelligence DNA) · 5830 E 2nd St Ste 7000, Casper, WY 82609, USA · <a href="mailto:support@businessinteldna.com">support@businessinteldna.com</a></div>
</div></footer>

<script type="application/json" id="soobshcheniya">{{soobshcheniya}}</script>
<script>
(function () {
  var f = document.getElementById('forma');
  var itog = document.getElementById('itog');
  var knopka = document.getElementById('knopka');
  var T = JSON.parse(document.getElementById('soobshcheniya').textContent);

  function nomer(s) {
    var d = String(s || '').replace(/\\D/g, '');
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    if (d.length !== 10 || d.charAt(0) < '2' || d.charAt(3) < '2') return null;
    return '+1' + d;
  }
  function krasivo(t) { return '+1 (' + t.slice(2, 5) + ') ' + t.slice(5, 8) + '-' + t.slice(8); }
  function pokazat(tekst, vid) { itog.className = 'itog ' + vid; itog.textContent = tekst; }
  function otkuda() {
    try { return (new URLSearchParams(location.search).get('ot') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40); }
    catch (e) { return ''; }
  }

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var servis = f.servis.checked, dozhim = f.dozhim.checked;
    var vvod = f.telefon.value.trim(), tel = nomer(vvod);
    if (!vvod && !servis && !dozhim) { pokazat(T.pusto, 'info'); return; }
    if (!tel) { pokazat(T.nomer, 'err'); f.telefon.focus(); return; }
    knopka.disabled = true;
    pokazat(T.zhdem, 'info');
    fetch('/.netlify/functions/sms-soglasie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        telefon: tel, pochta: f.pochta.value.trim(), servis: servis, dozhim: dozhim,
        versiya: f.getAttribute('data-versiya'), yazyk: f.getAttribute('data-yazyk'),
        stranica: location.origin + location.pathname, ot: otkuda(), sayt: f.sayt.value
      })
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false }; });
    }).then(function (j) {
      if (j && j.ok) pokazat((servis || dozhim ? T.da : T.net).replace('{n}', krasivo(tel)), 'ok');
      else pokazat((j && j.pochemu) || T.oshibka, 'err');
    }).catch(function () {
      pokazat(T.oshibka, 'err');
    }).then(function () { knopka.disabled = false; });
  });
})();
</script>
</body>
</html>
"""

# Что обязано стоять на странице (сверяем по видимому тексту, без регистра).
# Источник требований — ошибки Twilio 30913 / 30923 / 30925 / 30931 и памятка Twilio
# по одобрению кампаний: бренд, частота, «Msg & data rates», STOP/HELP, ссылки на условия
# и политику, галочка не стоит заранее, согласие не условие покупки, отказаться можно.
NADO = {
    'en': ['business intelligence dna', 'wealthboosterpro llc', 'not a condition of any purchase',
           'message frequency varies', 'up to 8 messages per month', 'msg & data rates may apply',
           'reply stop', 'help', 'no mobile information will be shared with third parties',
           '+1 (424) 781-1913', 'separate choice', 'recurring automated text messages',
           'marketing texts', 'the second box covers marketing messages'],
    'ru': ['business intelligence dna', 'wealthboosterpro llc', 'не является условием',
           'частота разная', 'не больше 8 сообщений в месяц', 'msg & data rates may apply',
           'stop', 'стоп', 'help', 'помощь', 'третьим лицам', '+1 (424) 781-1913', 'отдельный выбор',
           'регулярные автоматические sms', 'рекламные sms', 'вторая галочка — рекламные сообщения'],
}


def vidimyy_tekst(h):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', h, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', html.unescape(t)).lower()


def proverit(yazyk, h):
    beda = []
    vt = vidimyy_tekst(h)
    for s in NADO[yazyk]:
        if s not in vt:
            beda.append('нет фразы «%s»' % s)
    galochki = re.findall(r'<input[^>]*type="checkbox"[^>]*>', h)
    if len(galochki) != 2:
        beda.append('галочек %d, ждали 2 (служебные и дожим — раздельно, ошибка 30913)' % len(galochki))
    for g in galochki:
        if re.search(r'\bchecked\b|\brequired\b', g):
            beda.append('галочка стоит заранее или обязательна: %s (ошибки 30925 / 30923)' % g)
    # Атрибут netlify / data-netlify, а не слово: action="/.netlify/functions/…" — это наша функция.
    if re.search(r'<form[^>]*\s(?:data-)?netlify(?=[\s=>/])', h, re.I) or 'netlify-honeypot' in h \
            or 'name="form-name"' in h:
        beda.append('форма помечена для Netlify Forms — сработает submission-created.js и пришлёт «интейк»')
    for href in ('/sms', '/privacy', '/terms'):
        if 'href="%s"' % href not in h:
            beda.append('нет ссылки %s' % href)
    if '/.netlify/functions/sms-soglasie' not in h:
        beda.append('форма шлёт не в sms-soglasie')
    # Без method="post" форма без JavaScript уходит GET-ом: номер и почта оседают в адресе,
    # истории браузера и логах Netlify (замечание проверки 29.09).
    if not re.search(r'<form[^>]*\bmethod="post"[^>]*\baction="/\.netlify/functions/sms-soglasie"', h):
        beda.append('форма без method="post" action="/.netlify/functions/sms-soglasie"')
    for pole in ('versiya', 'yazyk'):
        if not re.search(r'<input type="hidden" name="%s" value="[^"]+">' % pole, h):
            beda.append('нет скрытого поля %s — без JS функция не узнает версию текста' % pole)
    for kod in BEZ_JS:
        if 'id="%s"' % kod not in h:
            beda.append('нет блока ответа без JS #%s' % kod)
    # Пиксель Meta с автосопоставлением хеширует поле телефона и шлёт в Meta: это передача
    # мобильного номера третьему лицу для рекламы — против обещания на этой же странице.
    if re.search(r'connect\.facebook\.net|fbq\(', h):
        beda.append('пиксель Meta на странице с номером телефона (обещание «не передаём», отказ 30932)')
    if 'name="robots" content="noindex' not in h:
        beda.append('нет noindex')
    if 'fonts.googleapis' in h:
        beda.append('Google Fonts на странице с номером телефона')
    if '{{' in h:
        beda.append('незаполненная заглушка {{…}}')
    return beda


# Ответ без JavaScript: функция отвечает 303 на /sms-consent/#<код>. Коды те же, что в функции.
BEZ_JS = {'sohraneno': 'ok', 'bez-sms': 'ok', 'pusto': 'info', 'oshibka-nomer': 'err', 'oshibka': 'err'}


def sobrat_stranicy(d):
    mark, favicon = znak()
    gotovo = {}
    for yazyk in ('en', 'ru'):
        ver = d['tekushchaya'][yazyk]
        v = d['versii'][ver]
        if v['yazyk'] != yazyk:
            raise SystemExit('  ! версия %s помечена языком %s, а стоит для %s' % (ver, v['yazyk'], yazyk))
        ui = d['ui'][yazyk]
        drugoy = 'ru' if yazyk == 'en' else 'en'
        ssylki = ''.join('<a href="%s">%s</a>' % (u, html.escape(t)) for u, t in ui['ssylki'])
        # Текст согласия (галочки и раскрытие) — HTML из источника, вставляем как есть:
        # он и есть то, на что считается отпечаток. Остальное экранируем.
        zamena = {k: html.escape(ui[k]) for k in (
            'lang', 'title', 'desc', 'nazad', 'drugoy_yazyk', 'eyebrow', 'h1', 'lede', 'telefon',
            'telefon_podskazka', 'pochta', 'pochta_podskazka', 'neobyaz', 'knopka', 'potom',
            'chego_net', 'noscript')}
        zamena.update(v['tekst'])
        zamena.update(
            versiya=ver, canonical=DOMEN + URL[yazyk], drugoy_url=URL[drugoy], drugoy_lang=drugoy,
            mark=mark, favicon=favicon, ssylki=ssylki,
            soobshcheniya=json.dumps(ui['soobshcheniya'], ensure_ascii=False).replace('</', '<\\/'),
            bez_js=''.join('    <p class="bezjs %s" id="%s" role="status">%s</p>\n' % (vid, kod, html.escape(ui['bez_js'][kod]))
                           for kod, vid in BEZ_JS.items()).rstrip('\n'))
        h = PAGE
        for k, val in zamena.items():
            h = h.replace('{{%s}}' % k, val)
        beda = proverit(yazyk, h)
        if beda:
            raise SystemExit('  ! %s (%s):\n    - %s' % (URL[yazyk], ver, '\n    - '.join(beda)))
        gotovo[yazyk] = h
        print('  ✓ %-18s %s · %d КБ' % (URL[yazyk], ver, len(h.encode('utf-8')) // 1024))
    return gotovo


def sverit_kampaniyu(d):
    """Тексты SMS в заявке Twilio и в функции — одни и те же."""
    if not os.path.exists(KAMPANIYA):
        print('  · kampaniya.json нет — сверку с заявкой пропускаю')
        return
    k = json.load(open(KAMPANIYA, encoding='utf-8'))
    pary = [('OptInMessage', 'podtverzhdenie_en'), ('OptOutMessage', 'otpiska_en'), ('HelpMessage', 'pomoshch_en')]
    for pole, nashe in pary:
        if k.get(pole) != d['sms'][nashe]:
            raise SystemExit('  ! kampaniya.json %s расходится с tekst-soglasiya.json sms.%s' % (pole, nashe))
        if not 20 <= len(k[pole]) <= 320:
            raise SystemExit('  ! %s: %d знаков, Twilio принимает 20–320' % (pole, len(k[pole])))
    for i, s in enumerate(k.get('MessageSamples', []), 1):
        if 'Business Intelligence DNA' not in s or 'STOP' not in s or not 20 <= len(s) <= 1024:
            raise SystemExit('  ! пример %d: нет бренда / STOP или длина вне 20–1024' % i)
    for pole, lo, hi in (('Description', 40, 4096), ('MessageFlow', 40, 2048)):
        if not lo <= len(k.get(pole, '')) <= hi:
            raise SystemExit('  ! %s: %d знаков, нужно %d–%d' % (pole, len(k.get(pole, '')), lo, hi))
    if 'https://businessinteldna.com/sms-consent/' not in k['MessageFlow']:
        raise SystemExit('  ! в MessageFlow нет адреса страницы согласия')
    # Отказ 30910: заявка только на английском. Русские сообщения описаны словами в Description.
    for pole, v in k.items():
        if not pole.startswith('_') and re.search('[\u0400-\u04ff]', json.dumps(v, ensure_ascii=False)):
            raise SystemExit('  ! %s: кириллица в поле заявки — отказ 30910 (заявка только на английском)' % pole)
    # Отказы 30918 / 30907: в реестре (TCR) бренд зовётся Wealthboosterpro LLC — поля DBA в профиле
    # Twilio нет, — а подписываемся мы Business Intelligence DNA. Связь должна быть видна.
    for pole in ('Description', 'OptInMessage', 'OptOutMessage', 'HelpMessage'):
        if 'Wealthboosterpro LLC' not in k[pole]:
            raise SystemExit('  ! %s без «Wealthboosterpro LLC» (бренд в TCR — юрлицо, отказ 30918)' % pole)
    if not any('Wealthboosterpro LLC' in s for s in k['MessageSamples']):
        raise SystemExit('  ! ни в одном примере нет «Wealthboosterpro LLC» (отказ 30918)')
    # Отказ 30917: заявлено слово подписки — в MessageFlow должно быть сказано, как оно работает.
    for slovo in k.get('OptInKeywords', []):
        if slovo not in k['MessageFlow']:
            raise SystemExit('  ! слово подписки %s не описано в MessageFlow (отказ 30917)' % slovo)
    # /sms обещает то же, что заявка: каждое слово отписки и помощи там названо (30887).
    sms_md = open(os.path.join(KAMP, 'pravo', 'sms.md'), encoding='utf-8').read()
    for slovo in k.get('OptOutKeywords', []) + k.get('HelpKeywords', []):
        if not re.search(r'\b%s\b' % re.escape(slovo), sms_md):
            raise SystemExit('  ! слово %s из заявки не названо в pravo/sms.md' % slovo)
    print('  ✓ kampaniya.json сходится с текстами SMS, длины в пределах Twilio, кириллицы нет')


def sverit_pravo():
    """Ссылки на страницу согласия в pravo/ — настоящие <a href>, и юр-сборку они не ломают.

    pandoc (pravo_site.py) не делает ссылку из голого адреса, а форму [текст](адрес) ломает
    _rekvizity.fill(): любые [...] он принимает за незаполненную заглушку, и падает вся выкладка.
    Поэтому только автоссылки <https://…>. Проверяем тем же fill() и, если есть, тем же pandoc.
    """
    sys.dont_write_bytecode = True      # не оставлять __pycache__ в docs/pravo/
    try:
        sys.path.insert(0, os.path.join(ROOT, 'docs', 'pravo'))
        import _rekvizity as R
    except Exception as e:
        print('  · _rekvizity не подтянулся (%s) — сверку заглушек пропускаю' % e)
        R = None
    try:
        import pypandoc
    except Exception:
        pypandoc = None
    kuski = {'pravo/sms.md': open(os.path.join(KAMP, 'pravo', 'sms.md'), encoding='utf-8').read()}
    for patch in ('pravo/privacy.patch', 'pravo/contacts.patch'):
        stroki = open(os.path.join(KAMP, patch), encoding='utf-8').read().splitlines()
        kuski[patch] = '\n'.join(x[1:] for x in stroki if x.startswith('+') and not x.startswith('+++'))
    for imya, md in kuski.items():
        if '<https://businessinteldna.com/sms-consent/' not in md:
            raise SystemExit('  ! %s: нет автоссылки <https://businessinteldna.com/sms-consent/…>' % imya)
        if R is not None:
            _, ostalos = R.fill(md.replace('{{DATA_VYKLADKI}}', '1 октября 2026 года'))
            if ostalos:
                raise SystemExit('  ! %s: _rekvizity.fill() увидит заглушки %s — pravo_site.py упадёт' % (imya, ostalos))
        if pypandoc is not None:
            body = pypandoc.convert_text(md, 'html5', format='markdown+smart')
            if 'href="https://businessinteldna.com/sms-consent/' not in body:
                raise SystemExit('  ! %s: pandoc не сделал ссылку на /sms-consent/' % imya)
    print('  ✓ pravo/: ссылки на /sms-consent/ кликабельные%s, заглушек для _rekvizity нет'
          % ('' if pypandoc else ' (pandoc не найден, проверено только по тексту)'))


def v_sayt(st, gotovo):
    # 1. Функция на сайте = исходник.
    if not os.path.exists(FUNKCIYA_NA_SAYTE):
        raise SystemExit('  ! нет netlify-functions/sms-soglasie.js — страница без функции ничего не сохранит.\n'
                         '    Скопируйте: python3 Pivot/sms-kampaniya/vstroit.py')
    if open(FUNKCIYA_NA_SAYTE, 'rb').read() != open(FUNKCIYA, 'rb').read():
        raise SystemExit('  ! netlify-functions/sms-soglasie.js разошлась с Pivot/sms-kampaniya/sms-soglasie.js.\n'
                         '    Правили исходник — скопируйте: cp Pivot/sms-kampaniya/sms-soglasie.js netlify-functions/')
    # 2. /sms описывает ЭТУ программу, а не старую «только устно».
    sms_md = open(os.path.join(ROOT, 'docs', 'pravo', 'sms.md'), encoding='utf-8').read()
    if 'sms-consent' not in sms_md or re.search(r'Consent is given \*\*verbally', sms_md):
        raise SystemExit('  ! docs/pravo/sms.md ещё про старую программу (устное согласие в звонке).\n'
                         '    Сначала: python3 Pivot/sms-kampaniya/vstroit.py')
    for yazyk, h in gotovo.items():
        put = os.path.join(st, ADRES[yazyk])
        os.makedirs(os.path.dirname(put), exist_ok=True)
        open(put, 'w', encoding='utf-8').write(h)
    print('  ✓ разложено в %s: /sms-consent/ и /sms-consent/ru/' % st)


def main():
    d = json.load(open(ISTOCHNIK, encoding='utf-8'))
    for ver, v in d['versii'].items():
        print('  · %s sha256 %s…' % (ver, otpechatok(v['tekst'])[:16]))
    if vpisat_versii(d):
        print('  ✓ блок VERSII в sms-soglasie.js обновлён — не забудьте скопировать функцию на сайт')
    sverit_kampaniyu(d)
    sverit_pravo()
    gotovo = sobrat_stranicy(d)

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    for yazyk, h in gotovo.items():
        put = os.path.join(OUT, ADRES[yazyk])
        os.makedirs(os.path.dirname(put), exist_ok=True)
        open(put, 'w', encoding='utf-8').write(h)

    if len(sys.argv) > 1:
        st = sys.argv[1]
        if not os.path.isdir(st):
            raise SystemExit('  ! нет папки собранного сайта %s' % st)
        v_sayt(st, gotovo)


if __name__ == '__main__':
    main()
