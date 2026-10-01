# -*- coding: utf-8 -*-
"""Юридические страницы сайта: договор-оферта, политика конфиденциальности, NDA.

Тексты живут в docs/pravo/*.md — там их правят. Отсюда они собираются в страницы
и кладутся в КОРЕНЬ сайта: /dogovor, /privacy, /nda. Корень, а не раздел, потому что
разделов два (бизнес и эксперт), а документы общие — иначе пришлось бы держать
две копии и следить, чтобы они не разъехались.

Реквизиты подставляются из docs/pravo/_rekvizity.py — одно место правды.
Если в готовой странице осталась незаполненная заглушка, сборка падает: пустить
на сайт договор с «[НАЗВАНИЕ LLC]» хуже, чем не пустить ничего.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / 'docs' / 'pravo'))

# Адреса — /terms, /privacy, /nda: сами документы ссылаются друг на друга именно так,
# менять пути значило бы править перекрёстные ссылки внутри трёх текстов.
DOCS = [
    ('terms',    'Условия работы', 'То, на чём мы работаем. Принимаются отметкой перед оплатой.'),
    ('privacy',  'Конфиденциальность', 'Какие данные мы собираем, кому передаём и как их удалить.'),
    ('sms',      'Условия сообщений', 'Когда и почему мы пишем в SMS, и как это отключить.'),
    ('contacts', 'Контакты', 'Кто мы, где находимся и как с нами связаться.'),
    ('nda',      'Соглашение о неразглашении', 'Взаимное NDA — для тех, кому нужна подписанная бумага.'),
]

# /sms и /contacts обязательны для регистрации A2P 10DLC у операторов связи:
# с 30.06.2026 ссылки на политику и условия — обязательные поля заявки, и проверяющий
# открывает их руками. Требования: публично, без логина, на том же домене.

PAGE = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}} — Business Intelligence DNA</title>
<meta name="description" content="{{desc}}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://businessinteldna.com/{{slug}}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--navy:#1b2557;--navy-deep:#0f1430;--gold:#c69a4c;--gold-2:#b0812f;--gold-soft:#e3c88a;
 --paper:#f7f5f0;--card:#fffefb;--ink:#171b2e;--muted:#5d6480;--line:rgba(23,27,46,.14);
 --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
 --serif:'Playfair Display',Georgia,serif}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.65 var(--sans);
 -webkit-font-smoothing:antialiased}
.bar{background:var(--navy-deep);padding:14px 0}
.bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.wrap{max-width:780px;margin:0 auto;padding:0 22px}
.logo{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;
 font-weight:700;font-size:15px;letter-spacing:.02em;padding:5px 0}
.logo .g{color:var(--gold-soft)}
.logo .mark{height:30px;width:auto;display:block;flex:none}
.back{color:var(--gold-soft);text-decoration:none;font-size:14.5px;font-weight:600;
 padding:11px 0;display:inline-block}
.head{padding:44px 0 8px}
.eyebrow{font-size:12.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
 color:var(--gold-2);margin-bottom:10px}
h1{font:600 clamp(28px,5vw,40px)/1.15 var(--serif);margin:0 0 10px;letter-spacing:-.01em}
.lede{color:var(--muted);font-size:17px;margin:0 0 6px;max-width:62ch}
.meta{color:var(--muted);font-size:14.5px;margin:18px 0 0;padding:14px 16px;
 background:var(--card);border:1px solid var(--line);border-radius:12px}
.doc{padding:26px 0 60px}
.doc h2{font:600 22px/1.3 var(--serif);margin:38px 0 10px;padding-top:20px;
 border-top:1px solid var(--line)}
.doc h2:first-child{margin-top:8px;border-top:0;padding-top:0}
.doc h3{font:600 17.5px/1.4 var(--sans);margin:26px 0 8px}
.doc p{margin:0 0 14px;max-width:68ch}
.doc ul,.doc ol{margin:0 0 16px;padding-left:22px;max-width:68ch}
.doc li{margin:7px 0}
.doc strong{font-weight:600}
.doc a{color:var(--gold-2)}
.doc table{width:100%;border-collapse:collapse;margin:0 0 18px;font-size:15.5px}
.doc th,.doc td{border:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:top}
.doc th{background:rgba(198,154,76,.1);font-weight:600}
.doc hr{border:0;border-top:1px solid var(--line);margin:30px 0}
.doc blockquote{margin:0 0 16px;padding:14px 18px;background:var(--card);
 border-left:3px solid var(--gold);border-radius:0 10px 10px 0;color:var(--muted)}
.doc code{font:500 14px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
 background:rgba(198,154,76,.14);padding:2px 6px;border-radius:5px}
footer{background:var(--navy-deep);color:#aeb4d0;padding:34px 0;font-size:15px;margin-top:20px}
footer a{color:var(--gold-soft);text-decoration:none;display:inline-block;padding:8px 0}
footer .req{color:#8890b0;font-size:14px;margin-top:10px;line-height:1.6}
.tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 4px}
.tabs a{font-size:14.5px;font-weight:600;text-decoration:none;color:var(--muted);
 border:1px solid var(--line);border-radius:999px;padding:10px 16px;background:var(--card)}
.tabs a.on{background:var(--navy);color:#fff;border-color:var(--navy)}
/* Таблицы цен шире телефона: на 390 документ раздувался до 647 px и страница ехала вбок.
   Прокручиваем САМУ таблицу, а не страницу (аудит 26.09). */
@media(max-width:700px){
  .doc table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
}
/* Ссылки подвала — цели пальца, а не строчки: было 43 и 17 px по высоте,
   а «NDA» ещё и 32 px по ширине. Узкие добираем горизонтальным полем. */
footer a{min-height:44px;min-width:44px;line-height:28px;text-align:center}
/* Те же 44 px в ШАПКЕ: знак и почта в строке реквизитов тоже цели пальца. */
.bar .logo{display:inline-flex;align-items:center;min-height:44px}
.meta a{display:inline-block;min-height:44px;line-height:44px}
footer .req a{min-height:44px;line-height:44px;padding:0;text-align:left}
@media(max-width:640px){
  body{font-size:16.5px}
  footer a{padding:13px 0}
}
@media print{
  .bar,.tabs,footer,.back{display:none}
  body{background:#fff;font-size:11.5pt}
  .doc h2{page-break-after:avoid}
}
</style>
</head>
<body>
<header class="bar"><div class="wrap">
  <a class="logo" href="/">{{mark}}<span>Business Intelligence <span class="g">DNA</span></span></a>
  <a class="back" href="/">← На сайт</a>
</div></header>

<div class="wrap head">
  <div class="eyebrow">{{eyebrow}}</div>
  <h1>{{title}}</h1>
  <p class="lede">{{desc}}</p>
  <div class="tabs">{{tabs}}</div>
  <div class="meta">{{meta}}</div>
</div>

<main class="wrap doc">
{{body}}
</main>

<footer><div class="wrap">
  <div><a href="/terms">Условия</a> · <a href="/privacy">Конфиденциальность</a> ·
  <a href="/nda">NDA</a> · <a href="https://t.me/business_int_dna" target="_blank" rel="noopener">Telegram</a></div>
  <div class="req">{{req}}</div>
</div></footer>
</body>
</html>
"""


def render():
    import pypandoc
    import _rekvizity as R

    brand_src = ROOT / 'brand' / '_src'
    sys.path.insert(0, str(brand_src))
    try:
        from inline import inline
        mark = inline('mark/dna-mark-compact-reverse.svg')
    except Exception:
        mark = ''

    req = ('%s · %s · <a href="mailto:%s">%s</a>'
           % (R.FULL, R.ADDRESS, R.EMAIL, R.EMAIL))

    out = []
    for slug, title, desc in DOCS:
        src = ROOT / 'docs' / 'pravo' / (slug + '.md')
        if not src.exists():
            print('  ! нет %s — страница не собрана' % src.name)
            continue
        md = src.read_text(encoding='utf-8')
        md, left = R.fill(md)
        if left:
            raise SystemExit('В %s остались незаполненные заглушки: %s' % (src.name, left))

        # дата документа берётся из первой строки вида «Редакция от ...», если она есть
        m = re.search(r'^\s*(Редакция|Версия|Действует)[^\n]*', md, re.M)
        meta = m.group(0).strip() if m else 'Редакция от 7 сентября 2026 года.'
        meta += ('  Услуги оказывает %s, %s. Вопросы по документам — '
                 '<a href="mailto:%s">%s</a>.' % (R.FULL, R.ADDRESS, R.EMAIL, R.EMAIL))

        md = md.replace('EMAIL_SUPPORT_PLACEHOLDER', getattr(R, 'EMAIL_SUPPORT', R.EMAIL))
        body = pypandoc.convert_text(md, 'html5', format='markdown+smart')
        # заголовок первого уровня уже стоит в шапке страницы — из тела убираем
        body = re.sub(r'<h1[^>]*>.*?</h1>', '', body, count=1, flags=re.S)
        body = re.sub(r'\sid="[^"]*"', '', body)

        tabs = ''.join(
            '<a href="/%s"%s>%s</a>' % (s, ' class="on"' if s == slug else '', t)
            for s, t, _ in DOCS)

        html = PAGE
        for k, v in dict(slug=slug, title=title, desc=desc, body=body, tabs=tabs,
                         meta=meta, mark=mark, req=req, eyebrow='Документы').items():
            html = html.replace('{{%s}}' % k, v)
        dst = ROOT / 'landings' / (slug + '.html')
        dst.write_text(html, encoding='utf-8')
        out.append(dst)
        print('  ✓ %-14s %d КБ' % (slug + '.html', len(html) // 1024))
    return out


if __name__ == '__main__':
    render()
