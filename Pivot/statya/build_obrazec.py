#!/usr/bin/env python3
"""Страница-образец: два ДНК на выдуманных данных.

Метод в три слоя — это и есть содержание, поэтому слои размечены визуально:
каждый абзац получает свою полосу слева по метке ФАКТ / АНАЛИЗ / ГИПОТЕЗА / не проверено.
"""
import html, json, re, sys
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / 'obrazec_src.json'          # кладёт воркфлоу: {biz, kli, intro}
WEB = '--web' in sys.argv          # версия для сайта: со своей шапкой
OUT = HERE / ('obrazec-dnk-web.html' if WEB else 'obrazec-dnk.html')
STATYA = 'https://ai-agency-k7m2x9.netlify.app'

LAYERS = [
    (re.compile(r'^\s*(?:\*\*)?ФАКТ\b'),            'fact',  'Факт'),
    (re.compile(r'^\s*🔷'),                          'anal',  'Анализ'),
    (re.compile(r'^\s*⚠️'),                          'hypo',  'Гипотеза'),
    (re.compile(r'^\s*🟥'),                          'open',  'Не проверено'),
]


LEAD = re.compile(
    r'^\s*(?:\*\*)?(?:ФАКТ|🔷\s*АНАЛИЗ|⚠️\s*ГИПОТЕЗА|🟥\s*(?:ОТКРЫТО)?)(?:\*\*)?'
    r'\s*(?:\([^)]*\))?\s*[/:—–-]*\s*')


def strip_lead(s: str) -> str:
    """Метку показывает полоса или чип — из текста её убираем, вместе с разделителем."""
    return LEAD.sub('', s, count=1).lstrip(' /:—–-')


# метка уже стоит плашкой — второй раз словом в тексте её повторять не надо
DUP_FULL = re.compile(r'(\U0001F537|\u26a0\ufe0f|\U0001F7E5)\s*\*\*\s*'
                      r'(?:АНАЛИЗ|ГИПОТЕЗА|ОТКРЫТО)\s*[,.:;—–-]*\s*\*\*\s*[,.:;—–-]*\s*')
DUP_HEAD = re.compile(r'(\U0001F537|\u26a0\ufe0f|\U0001F7E5)\s*(\*\*)?\s*'
                      r'(?:АНАЛИЗ|ГИПОТЕЗА|ОТКРЫТО)\s*[,.:;—–-]+\s*(.?)')


def dedup_mark(t: str) -> str:
    t = DUP_FULL.sub(lambda m: m.group(1) + ' ', t)
    return DUP_HEAD.sub(lambda m: f"{m.group(1)} {m.group(2) or ''}{m.group(3).upper()}", t)


def inline(t: str) -> str:
    t = dedup_mark(html.escape(t, quote=False))
    t = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'\1', t)      # ссылки наружу снимаем
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', t)
    def code(m):
        s = m.group(1)
        if s.startswith('ФАКТ'):
            return f'<span class="chip fact">{s}</span>'
        return f'<code>{s}</code>'
    t = re.sub(r'`(.+?)`', code, t)
    # значки слоёв внутри строки — тоже подсвечиваем
    t = t.replace('🔷 АНАЛИЗ', '<span class="chip anal">АНАЛИЗ</span>')
    t = t.replace('⚠️ ГИПОТЕЗА', '<span class="chip hypo">ГИПОТЕЗА</span>')
    t = re.sub(r'🟥\s*(?:ОТКРЫТО)?', '<span class="chip open">не проверено</span> ', t)
    t = t.replace('🔷', '<span class="chip anal">анализ</span> ')
    t = t.replace('⚠️', '<span class="chip hypo">гипотеза</span> ')
    return t


def layer_of(text: str):
    for rx, cls, label in LAYERS:
        if rx.match(text):
            return cls, label
    return None, None


def table(rows):
    head, *body = [r for r in rows if not re.match(r'^\s*\|[\s:|-]+\|\s*$', r)]
    def cells(r, tag):
        parts = [c.strip() for c in r.strip().strip('|').split('|')]
        return ''.join(f'<{tag}>{inline(c)}</{tag}>' for c in parts)
    out = ['<div class="tw"><table><thead><tr>' + cells(head, 'th') + '</tr></thead><tbody>']
    for r in body:
        out.append('<tr>' + cells(r, 'td') + '</tr>')
    out.append('</tbody></table></div>')
    return ''.join(out)


def md(src: str) -> str:
    out, para, lst, tbl, quote = [], [], [], [], []

    def flush():
        nonlocal para, lst, tbl, quote
        if tbl:
            out.append(table(tbl)); tbl = []
        if para:
            t = ' '.join(para).strip(); para = []
            cls, label = layer_of(t)
            if cls:
                out.append(f'<p class="L {cls}"><span class="tag">{label}</span>{inline(strip_lead(t))}</p>')
            else:
                out.append(f'<p>{inline(t)}</p>')
        if lst:
            items = []
            for i in lst:
                cls, label = layer_of(i)
                mark = f'<span class="tag">{label}</span>' if cls else ''
                body = strip_lead(i) if cls else i
                items.append(f'<li class="{cls or ""}">{mark}{inline(body)}</li>')
            out.append('<ul>' + ''.join(items) + '</ul>'); lst = []
        if quote:
            out.append('<blockquote><p>' + inline(' '.join(quote)) + '</p></blockquote>'); quote = []

    for raw in src.split('\n'):
        line = raw.rstrip()
        if not line.strip():
            flush(); continue
        if line.lstrip().startswith('|'):
            if para or lst: flush()
            tbl.append(line); continue
        if tbl: flush()
        m = re.match(r'^(#{1,4})\s+(.*)$', line)
        if m:
            flush()
            lvl = min(len(m.group(1)) + 1, 5)
            out.append(f'<h{lvl}>{inline(m.group(2))}</h{lvl}>'); continue
        if line.strip() in ('---', '***'):
            flush(); out.append('<hr>'); continue
        if line.startswith('> '):
            if para or lst: flush()
            quote.append(line[2:].strip()); continue
        if quote: flush()
        if re.match(r'^\s*[-*]\s+', line):
            if para: flush()
            lst.append(re.sub(r'^\s*[-*]\s+', '', line)); continue
        if lst: flush()
        para.append(line.strip())
    flush()
    return '\n'.join(out)


CSS = """
:root{
  --ground:#F6F8F5; --surface:#FFFFFF; --ink:#14181C; --ink-2:#3A443E; --muted:#5B665F;
  --rule:#DDE3DD; --rule-soft:#EBEFEA; --accent:#17795A;
  --fact:#2F6F4F; --anal:#2B5D86; --hypo:#8A6212; --open:#9B3B36;
  --fact-bg:#ECF4EF; --anal-bg:#EBF1F7; --hypo-bg:#F8F2E4; --open-bg:#F9EDEC;
  --measure:44rem;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --ground:#0F1211; --surface:#161A17; --ink:#E7EBE6; --ink-2:#C3CBC5; --muted:#95A099;
  --rule:#272D29; --rule-soft:#1C211E; --accent:#55C79A;
  --fact:#6FC29A; --anal:#7FB3DE; --hypo:#D9B463; --open:#E08B85;
  --fact-bg:#14231C; --anal-bg:#151F28; --hypo-bg:#241E10; --open-bg:#261715;
}}
:root[data-theme="dark"]{
  --ground:#0F1211; --surface:#161A17; --ink:#E7EBE6; --ink-2:#C3CBC5; --muted:#95A099;
  --rule:#272D29; --rule-soft:#1C211E; --accent:#55C79A;
  --fact:#6FC29A; --anal:#7FB3DE; --hypo:#D9B463; --open:#E08B85;
  --fact-bg:#14231C; --anal-bg:#151F28; --hypo-bg:#241E10; --open-bg:#261715;
}
*{box-sizing:border-box}
body{background:var(--ground); color:var(--ink); padding:0 1.25rem 5rem;
  font:400 1rem/1.68 Literata,Georgia,serif; -webkit-font-smoothing:antialiased}
.wrap{max-width:var(--measure); margin:0 auto}
p{margin:0} a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent); outline-offset:3px}

.top{max-width:var(--measure); margin:0 auto; padding:2.5rem 0 0;
  font:500 .7rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.14em;
  text-transform:uppercase; color:var(--muted)}
.top a{color:var(--muted)}
h1{font:600 clamp(1.8rem,4.5vw,2.6rem)/1.12 Fraunces,Georgia,serif;
  font-variation-settings:"SOFT" 8,"WONK" 1,"opsz" 72; letter-spacing:-.02em;
  margin:1.2rem 0 0; text-wrap:balance}
.lead{margin:1.4rem 0 0; display:flex; flex-direction:column; gap:.9rem; color:var(--ink-2)}
.warn{margin:1.6rem 0 0; padding:.9rem 1.1rem; border-left:3px solid var(--hypo);
  background:var(--hypo-bg); color:var(--ink);
  font:500 .92rem/1.6 "IBM Plex Mono",ui-monospace,monospace}

.legend{display:grid; grid-template-columns:repeat(auto-fit,minmax(9rem,1fr)); gap:1px;
  margin:1.6rem 0 0; background:var(--rule); border:1px solid var(--rule); border-radius:3px;
  overflow:hidden}
.legend div{background:var(--surface); padding:.75rem .85rem; display:flex;
  flex-direction:column; gap:.25rem}
.legend b{font:600 .68rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.1em;
  text-transform:uppercase}
.legend span{font-size:.82rem; color:var(--muted); line-height:1.45}
.legend .f b{color:var(--fact)} .legend .a b{color:var(--anal)}
.legend .h b{color:var(--hypo)} .legend .o b{color:var(--open)}

.doc{max-width:var(--measure); margin:3.5rem auto 0; display:flex;
  flex-direction:column; gap:1rem}
.doc h2{font:600 1.6rem/1.2 Fraunces,Georgia,serif; font-variation-settings:"opsz" 40;
  margin:0; padding-bottom:.7rem; border-bottom:2px solid var(--ink); letter-spacing:-.012em}
.doc h3{font:600 1.18rem/1.3 Fraunces,Georgia,serif; margin:1.8rem 0 -.3rem}
.doc h4{font:600 1rem/1.35 Fraunces,Georgia,serif; margin:1.2rem 0 -.4rem}
.doc h5{font:600 .92rem/1.4 "IBM Plex Mono",ui-monospace,monospace; margin:1rem 0 -.5rem;
  letter-spacing:.02em; color:var(--muted); text-transform:uppercase; font-size:.72rem}
hr{border:0; height:1px; background:var(--rule); margin:2rem 0}
blockquote{margin:.4rem 0; padding:.9rem 1.1rem; background:var(--surface);
  border-left:3px solid var(--accent); border-radius:0 3px 3px 0}
blockquote p{font-size:1.02rem; line-height:1.6}
ul{margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:.55rem}
ul li{padding-left:1.1rem; position:relative}
ul li::before{content:""; position:absolute; left:0; top:.72em; width:.45rem; height:1px;
  background:var(--rule)}
code{font:500 .86em/1 "IBM Plex Mono",ui-monospace,monospace; background:var(--rule-soft);
  padding:.1em .35em; border-radius:3px}

/* избранные куски */
.picks{max-width:var(--measure); margin:3.5rem auto 0; display:flex;
  flex-direction:column; gap:1.1rem}
.picks h2{font:600 1.6rem/1.2 Fraunces,Georgia,serif; margin:0; letter-spacing:-.012em}
.picks-lead{color:var(--muted); font-size:.94rem; margin:0 0 .6rem}
.frag{margin:0; background:var(--surface); border:1px solid var(--rule);
  border-radius:4px; padding:1.15rem 1.25rem; display:flex; flex-direction:column; gap:.6rem}
.frag-src{font:500 .64rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.13em;
  text-transform:uppercase; color:var(--muted)}
.frag h3{font:600 1.18rem/1.28 Fraunces,Georgia,serif; margin:0; letter-spacing:-.008em}
.frag-note{color:var(--ink-2); font-size:.96rem; line-height:1.6; margin:0;
  padding-bottom:.7rem; border-bottom:1px solid var(--rule-soft)}
.frag-body{display:flex; flex-direction:column; gap:.7rem; font-size:.94rem}
.frag-body h3,.frag-body h4,.frag-body h5{font-size:.95rem; margin:.4rem 0 -.2rem}
.frag-body table{min-width:0; font-size:.82rem}
.picks-end{margin:1.4rem 0 0; padding-top:1.2rem; border-top:1px solid var(--rule);
  font:400 .82rem/1.5 "IBM Plex Mono",ui-monospace,monospace; color:var(--muted)}

/* слои метода */
.L{padding:.7rem .95rem .7rem 1.1rem; border-left:3px solid; border-radius:0 3px 3px 0}
.L .tag{display:block; font:600 .62rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.13em; text-transform:uppercase; margin-bottom:.4rem}
.L.fact{border-color:var(--fact); background:var(--fact-bg)} .L.fact .tag{color:var(--fact)}
.L.anal{border-color:var(--anal); background:var(--anal-bg)} .L.anal .tag{color:var(--anal)}
.L.hypo{border-color:var(--hypo); background:var(--hypo-bg)} .L.hypo .tag{color:var(--hypo)}
.L.open{border-color:var(--open); background:var(--open-bg)} .L.open .tag{color:var(--open)}
li.fact,li.anal,li.hypo,li.open{padding-left:0}
li.fact::before,li.anal::before,li.hypo::before,li.open::before{display:none}
li .tag{font:600 .6rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.12em;
  text-transform:uppercase; margin-right:.5rem; padding:.15rem .4rem; border-radius:2px}
li.fact .tag{color:var(--fact); background:var(--fact-bg)}
li.anal .tag{color:var(--anal); background:var(--anal-bg)}
li.hypo .tag{color:var(--hypo); background:var(--hypo-bg)}
li.open .tag{color:var(--open); background:var(--open-bg)}

.chip{display:inline-block; font:600 .62rem/1.35 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.1em; text-transform:uppercase; padding:.2rem .42rem; border-radius:2px;
  vertical-align:.06em; white-space:nowrap}
.chip.fact{color:var(--fact); background:var(--fact-bg)}
.chip.anal{color:var(--anal); background:var(--anal-bg)}
.chip.hypo{color:var(--hypo); background:var(--hypo-bg)}
.chip.open{color:var(--open); background:var(--open-bg)}
.icons{margin:.9rem 0 0; font:400 .8rem/1.6 "IBM Plex Mono",ui-monospace,monospace;
  color:var(--muted)}

.tw{overflow-x:auto; border:1px solid var(--rule); border-radius:3px; background:var(--surface)}
table{border-collapse:collapse; width:100%; font-size:.88rem; min-width:34rem}
th,td{text-align:left; padding:.65rem .8rem; border-bottom:1px solid var(--rule-soft);
  vertical-align:top; line-height:1.5}
th{font:600 .66rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.1em;
  text-transform:uppercase; color:var(--muted); border-bottom:1px solid var(--rule);
  white-space:nowrap}
tr:last-child td{border-bottom:0}

.back{max-width:var(--measure); margin:4rem auto 0; padding-top:1.5rem;
  border-top:1px solid var(--rule); display:flex; flex-direction:column; gap:.8rem}
.back a.cta{align-self:flex-start; display:inline-flex; gap:.5rem; text-decoration:none;
  background:var(--ink); color:var(--ground); padding:.85rem 1.15rem; border-radius:2px;
  font:500 .9rem/1 "IBM Plex Mono",ui-monospace,monospace}
.back a.cta::after{content:"→"; opacity:.55}
.back p{color:var(--muted); font-size:.9rem}
"""


def fragments(items) -> str:
    """Шесть отобранных кусков — то, ради чего сюда кликают. Документы целиком лежат ниже."""
    if not items:
        return ''
    cards = []
    for f in items:
        cards.append(
            '<figure class="frag">'
            f'<span class="frag-src">{html.escape(f["otkuda"])}</span>'
            f'<h3>{inline(f["zagolovok"])}</h3>'
            f'<p class="frag-note">{inline(f["podpis"])}</p>'
            f'<div class="frag-body">{md(f["tekst"])}</div>'
            '</figure>')
    n = len(cards)
    slovo = {5: 'Пять', 6: 'Шесть', 7: 'Семь', 8: 'Восемь'}.get(n, str(n))
    mest = 'место' if n == 1 else ('места' if n < 5 else 'мест')
    return ('<section class="picks">'
            '<h2>Что здесь стоит посмотреть</h2>'
            f'<p class="picks-lead">{slovo} {mest} из двух разборов. Каждое читается отдельно. '
            'Целиком документы лежат ниже — но их можно и не открывать.</p>'
            + ''.join(cards) +
            '<div class="picks-end">Дальше — оба разбора целиком, без сокращений.</div>'
            '</section>')


def main():
    d = json.loads(SRC.read_text())
    head = ('<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<meta name="robots" content="noindex">\n') if WEB else ''
    doc = f"""{head}<title>Образец ДНК на выдуманных данных</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Literata:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>{CSS}</style>
<div class="top">Business Intelligence DNA <a href="{STATYA}">← к статье</a></div>
<header class="wrap">
  <h1>Как выглядит разбор бизнеса</h1>
  <div class="lead">{md(d['intro'])}</div>
  <p class="warn">Компания и владелец в этих документах выдуманы. Данные реальных
  клиентов мы не показываем — ни с именем, ни без.</p>
  <div class="legend">
    <div class="f"><b>Факт</b><span>из интервью или проверено в открытых источниках</span></div>
    <div class="a"><b>Анализ</b><span>наш вывод из фактов</span></div>
    <div class="h"><b>Гипотеза</b><span>догадка, требует проверки</span></div>
    <div class="o"><b>Не проверено</b><span>данных не хватает, помечено честно</span></div>
  </div>
  <p class="icons">В таблицах: ✅ — аргумент в нише уже занят · 🔓 — вероятно свободен ·
  🚫 — использовать нельзя.</p>
</header>
{fragments(d.get('fragmenty') or [])}
<article class="doc">
{md(d['biz'])}
</article>
<article class="doc">
{md(d['kli'])}
</article>
<div class="back">
  <a class="cta" href="{STATYA}">Вернуться к статье</a>
  <p>На реальном бизнесе объём больше: добавляется живая разведка по вашей нише,
  вашим соседям и тому, что о вас отвечают нейросети.</p>
</div>
"""
    OUT.write_text(doc)
    print(f'{OUT.name}: {len(doc)//1024} КБ')


main()
