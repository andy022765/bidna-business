#!/usr/bin/env python3
"""Собирает страницу статьи-кейса из statya.md.

  python3 build.py            -> index.html, картинки ссылками (для деплоя)
  python3 build.py --inline   -> statya-inline.html, картинки в data URI (для артефакта)
"""
import base64, html, mimetypes, re, sys
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).parent
INLINE = '--inline' in sys.argv

TELEGRAM = 'https://t.me/business_int_dna'
TG_TEXT  = ('Здравствуйте. Прочитал статью про пять AI-инструментов. '
            'Хочу разобрать своё дело и получить пошаговую стратегию внедрения.')
CALENDLY = 'https://calendly.com/bizzinteldna/1hr'   # «Стратегическая сессия», 1 ч.
# Старый аккаунт andywar777 отдаёт 404 целиком; актуальный привязан к bizzinteldna@gmail.com
TELEFON_VERY = '+14247811913'          # наш номер, куплен 16.09; Веру слушают живьём

# какой файл встаёт на место какого [СКРИН: ...]
OBRAZEC = '/obrazec/'   # страница-образец на том же острове
YULIA_SITE = 'https://remotecfo.netlify.app'   # актуальный живой сайт Юли
# = Julia Dospehoff/landing/index-new.html, вычитан целиком; версия с ценами и отзывом

# Что человек получает на руки. Без счётчиков слов и строк — просто перечень.
PAKET = [
    ('Разбор вашего дела',      'чем отличаетесь, на чём это держится и где мы пока гадаем', True),
    ('Разбор вашего покупателя', 'кто платит, чего боится, какими словами про это говорит', True),
    ('Оффер',                   'что предлагаете и почему это трудно сравнивать по цене', False),
    ('Сайт',                    'собранный целиком, на двух языках', False),
    ('Разбор рынка',            'кто рядом, что обещают и чем заняты соседние ниши', False),
]


def _paket_row(w, d, is_dnk):
    inner = f'<span class="pk-w">{w}</span><span class="pk-d">{d}</span>'
    if is_dnk:
        return (f'<a class="paket-row link" href="{OBRAZEC}">{inner}'
                f'<span class="pk-go">посмотреть, как выглядит →</span></a>')
    return f'<div class="paket-row">{inner}</div>'


ARTEFAKTY = ('<figure class="wide paket">'
             '<div class="paket-grid">'
             + ''.join(_paket_row(*r) for r in PAKET)
             + '</div>'
             f'<a class="cta" href="{OBRAZEC}">Открыть оба разбора целиком</a>'
             '<figcaption>Всё это собрано за три рабочих дня. '
             'Её личного времени ушло 140 минут разговора. '
             'Разборы открываются на выдуманной компании — '
             'чужие документы мы не показываем.</figcaption>'
             '</figure>')

LIVE = {
    ('стоматолог', 'comfort', 'подзвонити'):
                 ('https://svettutest.github.io/shablony-demo/stomatologia/',
                   'comfort-dental.example', 'sait-stomatologia.jpg',
                   'Стоматология в Киеве. Внизу слева — кнопка, за которой отвечает голосовой агент.'),
    ('роман', 'ильин', 'коучинг', 'интерфейс'):
                 ('https://roma-kp-site.vercel.app', 'roma-system.example', 'sait-roma.jpg',
                   'Персональный коучинг. Тёмный первый экран, всё живое.'),
    ('вилл', 'sawah', 'убуд', 'бали'):
                 ('https://svettutest.github.io/shablony-demo/villa/', 'villa-sawah.example',
                   'sait-villa.jpg', 'Аренда виллы на Бали.'),
    ('детейлинг', 'grafit', 'алматы'):
                 ('https://svettutest.github.io/shablony-demo/detailing/', 'grafit.example',
                   'sait-detailing.jpg', 'Детейлинг-студия в Алматы.'),
}


def live_site(line: str) -> str:
    """Постер грузится мгновенно, настоящий сайт поднимается по клику и прокручивается."""
    low = line.lower()
    for keys, (url, host, shot, cap) in LIVE.items():
        if not any(k in low for k in keys):
            continue
        chrome = f'<div class="chrome"><i></i><i></i><i></i><b>{host}</b></div>'
        poster = (f'<img src="{img_src(shot)}" alt="" loading="lazy" decoding="async">'
                  if shot else '')
        if INLINE:
            # в артефакте чужие окна запрещены политикой безопасности — уводим ссылкой
            inner = (f'<a class="viewport shot" href="{url}" target="_blank" rel="noopener">'
                     f'{poster}<span class="launch">Открыть живой сайт</span></a>')
        else:
            inner = (f'<div class="viewport shot" data-src="{url}">{poster}'
                     f'<button class="launch" type="button">Полистать живой сайт</button></div>')
        return (f'<figure class="wide live"><div class="browser">{chrome}{inner}</div>'
                f'<figcaption>{html.escape(cap)} '
                f'<a href="{url}" target="_blank" rel="noopener">открыть отдельно</a>'
                f'</figcaption></figure>')
    return ''


SHOTS = [
    (('первый экран стоматологии',), ['sait-stomatologia.jpg'],
     'Семейная стоматология, Киев. Внизу слева — кнопка голосового агента. Контакты убраны.'),
    (('коллаж',), ['sait-roma.jpg', 'sait-villa.jpg', 'sait-detailing.jpg'],
     'Коучинг · вилла на Бали · детейлинг-студия. Контакты убраны.'),
    (('таблица замеров', 'замеров по 11'), [], ''),                     # рисуем таблицей, не картинкой
    (('ahrefs',), ['geo-ahrefs.jpg'],
     'Ahrefs: ответы ИИ по движкам. Домен и название проекта закрыты по договорённости с клиентом.'),
    (('copilot', 'utm_source', 'адресная строка'),
     ['geo-copilot.jpg', 'geo-utm-copilot.jpg'],
     'Copilot рекомендует товар против названного конкурента — и метка utm_source=copilot.com в адресной строке.'),
    (('bing', '1.3k', 'цитат за три месяца'), ['geo-bing-1300.jpg'],
     'Bing Webmaster, AI Performance: 1.3K цитат за три месяца, график стартует с нуля.'),
    (('статистики голосового',), [], ''),              # картинки нет — пропускаем
]

ZAMERY = [('08.06.2026', 0, '0%'), ('07.07.2026', 3, '27%'),
          ('29.07.2026', 7, '63,6%'), ('11.08.2026', 10, '90,9%'),
          ('02.09.2026', 9, '81,8%')]


def img_src(name: str) -> str:
    p = HERE / 'img' / name
    if not INLINE:
        return f'img/{name}'
    mime = mimetypes.guess_type(p.name)[0] or 'image/jpeg'
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()


def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'`(.+?)`', r'<code>\1</code>', t)
    return t


def figure(keyword_line: str) -> str:
    low = keyword_line.lower()
    for keys, files, cap in SHOTS:
        if any(k.lower() in low for k in keys):
            if 'таблица замеров' in keys:
                rows = ''.join(
                    f'<tr><td class="d">{d}</td>'
                    f'<td class="n">{n} из 11</td>'
                    f'<td class="bar"><span style="--w:{n/11*100:.0f}%"></span></td>'
                    f'<td class="p">{p}</td></tr>' for d, n, p in ZAMERY)
                return ('<figure class="wide tbl"><table class="zamery">'
                        '<caption>Одни и те же 11 запросов в Perplexity. '
                        'Список зафиксирован 8 июня и с тех пор не менялся.</caption>'
                        '<thead><tr><th>Дата замера</th><th>Цитируется</th>'
                        '<th></th><th>Доля</th></tr></thead>'
                        f'<tbody>{rows}</tbody></table></figure>')
            if not files:
                return ''
            imgs = ''.join(
                f'<img src="{img_src(f)}" alt="" loading="lazy" decoding="async">'
                for f in files)
            cls = 'shots' + (' pair' if len(files) == 2 else ' trio' if len(files) > 2 else '')
            return (f'<figure class="wide"><div class="{cls}">{imgs}</div>'
                    f'<figcaption>{html.escape(cap)}</figcaption></figure>')
    return ''


def spec(text: str) -> str:
    """«Срок — … Ваше участие — … Дальше — …» превращаем в паспорт инструмента."""
    m = re.split(r'\s*Ваше участие\s*—\s*', text, maxsplit=1)
    if len(m) != 2:
        return ''
    srok = m[0].strip()
    m2 = re.split(r'\s*Дальше\s*—?\s*', m[1], maxsplit=1)
    uch = m2[0].strip().rstrip('.')
    dalshe = (m2[1].strip() if len(m2) > 1 else '')
    srok = re.sub(r'^(Срок|Сколько это займёт)\s*—?\s*', '', srok).strip().rstrip('.')
    cells = [('Срок', srok), ('Ваше участие', uch), ('Дальше', dalshe.rstrip('.'))]
    return '<dl class="spec">' + ''.join(
        f'<div><dt>{k}</dt><dd>{inline(v)}</dd></div>' for k, v in cells if v) + '</dl>'


def cta(text: str) -> str:
    m = (re.match(r'\*\*→\s*(.+?)\s*\*\*(?:\s*—\s*(.+))?$', text)
         or re.match(r'\*\*(.+?)\s*→\s*\*\*(?:\s*—\s*(.+))?$', text))
    if not m:
        return ''
    label, note = m.group(1), m.group(2)
    if note is None and ' — ' in label:
        label, note = label.split(' — ', 1)
    low = label.lower()
    if 'юли' in low or 'поклацать' in low or 'пакет' in low:
        href, cls, ext = YULIA_SITE, 'cta', True
    elif 'позвонить' in low or 'вере' in low:
        href, cls, ext = f'tel:{TELEFON_VERY}', 'cta call', False
    elif 'telegram' in low:
        href, cls, ext = f'{TELEGRAM}?text={quote(TG_TEXT)}', 'cta tg', True
    else:
        href, cls, ext = CALENDLY, 'cta', True
    tgt = ' target="_blank" rel="noopener"' if ext else ''
    out = f'<a class="{cls}" href="{href}"{tgt}>{html.escape(label)}</a>'
    if note:
        out += f'<p class="cta-note">{inline(note)}</p>'
    return f'<div class="cta-row">{out}</div>'


def build_body(md: str) -> str:
    out, para, lst, quote = [], [], [], []

    def flush():
        nonlocal para, lst, quote
        if para:
            t = ' '.join(para).strip()
            para = []
            if t.startswith('**') and '→' in t and t.rstrip().endswith('**'):
                out.append(cta(t))
            elif re.match(r'^(Срок|Сколько это займёт)\b', t) and 'Ваше участие' in t:
                out.append(spec(t) or f'<p>{inline(t)}</p>')
            elif t.startswith('[ЖИВОЙ САЙТ'):
                out.append(live_site(t))
            elif t.startswith('[АРТЕФАКТЫ ЮЛИ'):
                out.append(ARTEFAKTY)
            elif t.startswith('[СКРИН'):
                out.append(figure(t))
            elif t.startswith('<sub>') or t.startswith('&lt;sub&gt;'):
                inner = re.sub(r'&lt;/?sub&gt;|</?sub>', '', t)
                out.append(f'<p class="podpis">{inline(inner)}</p>')
            elif t.startswith('<small>'):
                out.append(f'<p class="fineprint">{inline(re.sub(r"</?small>", "", t))}</p>')
            else:
                out.append(f'<p>{inline(t)}</p>')
        if lst:
            items = ''.join(f'<li>{inline(i)}</li>' for i in lst)
            lst = []
            out.append(f'<ul>{items}</ul>')
        if quote:
            out.append('<blockquote><p>' + inline(' '.join(quote)) + '</p></blockquote>')
            quote = []

    for raw in md.split('\n'):
        line = raw.rstrip()
        if not line.strip():
            flush(); continue
        if line.startswith('# '):
            continue                                   # заголовок отдаём в шапку
        if line.strip() == '---':
            flush(); out.append('<hr>'); continue
        if line.startswith('## '):
            flush()
            t = line[3:].strip()
            m = re.match(r'^(\d)\.\s*(.+)$', t)
            if m:
                title, price = m.group(2), ''
                mp = re.match(r'^(.+?)\s+—\s+((?:от\s+)?\$|ретейнер).*$', title)
                if mp:
                    price = title[len(mp.group(1)):].lstrip(' —')
                    title = mp.group(1)
                out.append(f'</section><section class="tool" id="t{m.group(1)}">'
                           f'<header class="tool-head">'
                           f'<span class="tool-num">{int(m.group(1)):02d}</span>'
                           f'<h2>{inline(title)}</h2>'
                           + (f'<span class="tool-price">{inline(price)}</span>' if price else '')
                           + '</header>')
            else:
                out.append(f'</section><section><h2>{inline(t)}</h2>')
            continue
        if line.startswith('### '):
            flush(); out.append(f'<h3>{inline(line[4:].strip())}</h3>'); continue
        if line.startswith('> '):
            flush() if (para or lst) else None
            quote.append(line[2:].strip()); continue
        if line.startswith('- '):
            if para: flush()
            lst.append(line[2:].strip()); continue
        if quote: flush()
        para.append(line.strip())
    flush()
    body = '\n'.join(out)
    return ('<section class="lede">' + body + '</section>').replace('<section class="lede"></section>', '', 1)


# Заголовок — из первой строки statya.md, одно место правды. До 17.09 он был зашит здесь
# константой, и правка статьи его не меняла: скептик 17.09 поймал, что цифра осталась бы на живом.
TITLE = next(l[2:].strip() for l in Path(__file__).with_name('statya.md')
             .read_text(encoding='utf-8').splitlines() if l.startswith('# '))

CSS = """
:root{
  --ground:#F6F8F5; --surface:#FFFFFF; --ink:#14181C; --ink-2:#3A443E;
  --muted:#5B665F; --rule:#DDE3DD; --rule-soft:#EBEFEA;
  --accent:#17795A; --accent-soft:#E6F1EB; --shadow:14 24 18;
  --measure:37rem; --wide:60rem;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#0F1211; --surface:#161A17; --ink:#E7EBE6; --ink-2:#C3CBC5;
  --muted:#95A099; --rule:#272D29; --rule-soft:#1C211E;
  --accent:#55C79A; --accent-soft:#16281F; --shadow:0 0 0;
}}
:root[data-theme="dark"]{
  --ground:#0F1211; --surface:#161A17; --ink:#E7EBE6; --ink-2:#C3CBC5;
  --muted:#95A099; --rule:#272D29; --rule-soft:#1C211E;
  --accent:#55C79A; --accent-soft:#16281F; --shadow:0 0 0;
}
*{box-sizing:border-box}
body{
  background:var(--ground); color:var(--ink);
  font:400 1.0625rem/1.72 Literata,Georgia,"Times New Roman",serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  padding:0 1.25rem 6rem;
}
.wrap{max-width:var(--wide); margin:0 auto}
article{display:flex; flex-direction:column}
section{display:flex; flex-direction:column; gap:1.15rem; max-width:var(--measure);
  margin:0 auto; width:100%; padding:0}
section+section{margin-top:3.25rem}
p{margin:0; text-wrap:pretty}
strong{font-weight:600; color:var(--ink)}
code{font:500 .88em/1 "IBM Plex Mono",ui-monospace,monospace;
  background:var(--accent-soft); color:var(--accent);
  padding:.12em .38em; border-radius:3px; word-break:break-all}
hr{border:0; height:1px; background:var(--rule); max-width:var(--measure);
  width:100%; margin:2.75rem auto 0}
a{color:var(--accent); text-underline-offset:.18em}
:focus-visible{outline:2px solid var(--accent); outline-offset:3px; border-radius:2px}

/* шапка */
.masthead{max-width:var(--wide); margin:0 auto; padding:2.5rem 0 0;
  display:flex; gap:.6rem; align-items:baseline; flex-wrap:wrap;
  font:500 .7rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.14em; text-transform:uppercase; color:var(--muted)}
.masthead b{color:var(--ink); font-weight:600}
.masthead span{color:var(--rule)}
.hero{max-width:var(--wide); margin:0 auto; padding:1.5rem 0 0; display:block}
h1{
  font:600 clamp(2rem,5.2vw,3.4rem)/1.1 Fraunces,Georgia,serif;
  font-variation-settings:"SOFT" 8,"WONK" 1,"opsz" 96;
  letter-spacing:-.022em; margin:0; text-wrap:balance; max-width:19ch;
}
h1 .sum{color:var(--accent); font-variant-numeric:tabular-nums; white-space:nowrap}

/* заголовки */
h2{font:600 clamp(1.45rem,3vw,1.95rem)/1.2 Fraunces,Georgia,serif;
  font-variation-settings:"SOFT" 6,"WONK" 1,"opsz" 40;
  letter-spacing:-.014em; margin:0; text-wrap:balance}
h3{font:600 1.08rem/1.35 Fraunces,Georgia,serif; font-variation-settings:"opsz" 20;
  margin:1.1rem 0 -.35rem; letter-spacing:-.005em}

/* блок инструмента */
.tool-head{display:grid; grid-template-columns:auto 1fr; gap:.35rem 1rem;
  align-items:baseline; padding-bottom:.9rem; border-bottom:2px solid var(--ink)}
.tool-num{font:600 .82rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.1em; color:var(--accent); padding-top:.42em}
.tool-price{grid-column:2; font:500 .82rem/1.4 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--muted); letter-spacing:.02em}

/* цитаты */
blockquote{margin:.35rem 0; padding:0 0 0 1.15rem; border-left:2px solid var(--accent);
  color:var(--ink-2); font-style:italic}
blockquote p{font-size:1.02rem}

/* списки */
ul{margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:.6rem}
ul li{padding-left:1.15rem; position:relative}
ul li::before{content:""; position:absolute; left:0; top:.72em; width:.5rem; height:1px;
  background:var(--accent)}

/* паспорт инструмента */
.spec{display:grid; grid-template-columns:repeat(3,1fr); gap:1px; margin:.6rem 0 0;
  background:var(--rule); border:1px solid var(--rule); border-radius:2px; overflow:hidden}
.spec>div{background:var(--surface); padding:.85rem .95rem; display:flex;
  flex-direction:column; gap:.3rem}
.spec dt{font:500 .66rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.12em; text-transform:uppercase; color:var(--muted)}
.spec dd{margin:0; font-size:.88rem; line-height:1.5; color:var(--ink-2)}
@media (max-width:620px){.spec{grid-template-columns:1fr}}

/* доказательства */
figure{margin:1.6rem 0; display:flex; flex-direction:column; gap:.6rem;
  width:min(var(--wide),calc(100vw - 2.5rem));
  margin-left:50%; transform:translateX(-50%)}
figure.tbl{width:min(44rem,calc(100vw - 2.5rem))}
figure img{display:block; width:100%; height:auto; border:1px solid var(--rule);
  border-radius:3px; background:var(--surface)}
.shots{display:flex; flex-direction:column; gap:.75rem}
.shots.pair,.shots.trio{display:grid; gap:.75rem}
.shots.pair{grid-template-columns:1fr}
.shots.trio{grid-template-columns:repeat(3,1fr)}
.shots.trio img{object-fit:cover; object-position:top; aspect-ratio:3/4}
@media (max-width:640px){.shots.trio{grid-template-columns:1fr}
  .shots.trio img{aspect-ratio:auto}}
figcaption{font:400 .78rem/1.5 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--muted); letter-spacing:.005em}

/* таблица замеров */
.zamery{width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums;
  font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.82rem}
.zamery caption{caption-side:bottom; padding-top:.7rem; text-align:left;
  color:var(--muted); font-size:.78rem; line-height:1.5}
.zamery th{text-align:left; font-weight:500; color:var(--muted); padding:0 .8rem .5rem 0;
  border-bottom:1px solid var(--rule); font-size:.68rem; letter-spacing:.1em;
  text-transform:uppercase; white-space:nowrap}
.zamery td{padding:.62rem .8rem .62rem 0; border-bottom:1px solid var(--rule-soft)}
.zamery tr:last-child td{border-bottom:1px solid var(--rule)}
.zamery .n{white-space:nowrap; color:var(--ink)}
.zamery .p{text-align:right; color:var(--muted); white-space:nowrap}
.zamery .bar{width:45%; min-width:5rem}
.zamery .bar span{display:block; height:.42rem; border-radius:1px;
  background:var(--accent); width:var(--w); min-width:2px; opacity:.9}
.zamery tr:first-child .bar span{background:var(--rule); opacity:1}

/* кнопки */
.cta-row{display:flex; flex-direction:column; gap:.5rem; margin:.7rem 0 0;
  align-items:flex-start}
.cta{display:inline-flex; align-items:center; gap:.5rem; text-decoration:none;
  font:500 .9rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.01em;
  color:var(--ground); background:var(--ink); padding:.85rem 1.15rem; border-radius:2px;
  transition:transform .12s ease, opacity .12s ease}
.cta::after{content:"→"; opacity:.55}
.cta:hover{opacity:.88; transform:translateY(-1px)}
.cta.call{background:var(--accent); color:#fff}
:root[data-theme="dark"] .cta.call,
:root:not([data-theme="light"]) .cta.call{color:#0F1211}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .cta.call{color:#fff}}
.cta.tg{background:transparent; color:var(--ink); border:1px solid var(--rule)}
.cta-note{font-size:.86rem; color:var(--muted); max-width:34rem}
@media (prefers-reduced-motion:reduce){.cta{transition:none} .cta:hover{transform:none}}

/* пакет, который получила Юля */
.paket-grid{display:flex; flex-direction:column; border-top:1px solid var(--rule)}
.paket-row{display:grid; grid-template-columns:minmax(9rem,14rem) 1fr;
  gap:.25rem 1.2rem; align-items:baseline; padding:.85rem 0;
  border-bottom:1px solid var(--rule-soft)}
.pk-w{font-weight:600; font-size:1.02rem}
.pk-d{color:var(--muted); font-size:.88rem; line-height:1.45}
figure.paket .cta{align-self:flex-start; margin-top:.4rem}
a.paket-row{text-decoration:none; color:inherit; transition:background .12s ease}
a.paket-row:hover{background:var(--accent-soft)}
.pk-go{grid-column:2 / -1; font:500 .74rem/1 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--accent); padding-top:.15rem}
@media (max-width:620px){
  .paket-row{grid-template-columns:1fr; row-gap:.2rem}
  .pk-go{grid-column:1 / -1}
}

/* живые окна сайтов */
.browser{border:1px solid var(--rule); border-radius:6px; overflow:hidden; background:var(--surface)}
.chrome{display:flex; align-items:center; gap:.4rem; padding:.55rem .75rem;
  background:var(--rule-soft); border-bottom:1px solid var(--rule)}
.chrome i{width:.55rem; height:.55rem; border-radius:50%; background:var(--rule); flex:none}
.chrome b{margin-left:.6rem; font:400 .72rem/1 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--muted); font-weight:400}
.viewport{position:relative; display:block; height:min(66vh,520px); overflow:hidden;
  text-decoration:none; background:var(--rule-soft)}
.viewport img{display:block; width:100%; height:auto}
.viewport::after{content:""; position:absolute; inset:auto 0 0 0; height:8rem;
  background:linear-gradient(transparent,var(--ground)); pointer-events:none}
.launch{position:absolute; left:50%; bottom:1.5rem; transform:translateX(-50%);
  background:var(--ink); color:var(--ground); border:0; cursor:pointer;
  padding:.85rem 1.2rem; border-radius:2px; white-space:nowrap;
  font:500 .88rem/1 "IBM Plex Mono",ui-monospace,monospace;
  box-shadow:0 6px 20px rgba(0,0,0,.18)}
.launch:hover{opacity:.9}
.viewport.loaded{background:var(--surface)}
.viewport.loaded img,.viewport.loaded .launch,.viewport.loaded::after{display:none}
.viewport.loaded iframe{position:absolute; inset:0; border:0; width:1280px;
  transform:scale(var(--s,.7)); transform-origin:0 0}
.hint{font:400 .74rem/1.5 "IBM Plex Mono",ui-monospace,monospace; color:var(--muted)}

/* мелкий шрифт */
.fineprint{font:400 .76rem/1.6 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--muted); margin-top:2.5rem; padding-top:1.1rem;
  border-top:1px solid var(--rule)}
.colophon{max-width:var(--measure); margin:0 auto; width:100%}
"""

HEAD_H1 = TITLE

SCRIPT = r"""<script>
(function(){
  function fit(vp){
    var s = vp.clientWidth / 1280;
    vp.style.setProperty('--s', s.toFixed(4));
    var f = vp.querySelector('iframe');
    if (f) f.style.height = Math.ceil(vp.clientHeight / s) + 'px';
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.launch');
    if (!btn) return;
    var vp = btn.closest('.viewport');
    if (!vp || vp.classList.contains('loaded')) return;
    var f = document.createElement('iframe');
    f.src = vp.dataset.src;
    f.loading = 'eager';
    f.setAttribute('title', 'Живой сайт');
    vp.appendChild(f);
    vp.classList.add('loaded');
    fit(vp);
    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Сайт живой: прокручивайте прямо внутри окна.';
    vp.closest('figure').appendChild(hint);
  });
  addEventListener('resize', function(){
    document.querySelectorAll('.viewport.loaded').forEach(fit);
  });
})();
</script>
"""


def main():
    md = (HERE / 'statya.md').read_text()
    body = build_body(md)
    doc = f"""<title>Пять инструментов, которые заменяют отдел</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Literata:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>{CSS}</style>
<div class="wrap">
  <div class="masthead">
    <b>Business Intelligence DNA</b><span>/</span>AI Agency for Business<span>/</span>сентябрь 2026
  </div>
  <header class="hero"><h1>{HEAD_H1}</h1></header>
</div>
<article class="wrap">
{body}
</section>
</article>
{SCRIPT}"""
    doc = doc.replace('<section class="lede">\n</section>', '')
    out = HERE / ('statya-inline.html' if INLINE else 'index.html')
    out.write_text(doc)
    kb = len(doc.encode()) // 1024
    print(f'{out.name}: {kb} КБ, картинки {"в data URI" if INLINE else "ссылками"}')

main()
