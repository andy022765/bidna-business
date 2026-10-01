# -*- coding: utf-8 -*-
# Сборка каталога «Датчик + ИИ» v2: python3 build_v2.py
import json, html, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from ideas_wave1 import W1
try:
    from ideas_wave2 import W2
except ImportError:
    W2 = []
from extras import DOMAINS, PICKS, PICKS_SUB, RESERVE, DROPPED, ALSO

AX = json.load(open(os.path.join(HERE, 'arxiv_verified.json'), encoding='utf-8'))
e = html.escape

ideas = W1 + W2
order = list(DOMAINS)
ideas.sort(key=lambda d: order.index(d['dom']))
for i, d in enumerate(ideas, 1):
    d['n'] = i
by_title = {d['title']: d for d in ideas}

def weeks_max(w):
    nums = [int(x) for x in re.findall(r'\d+', w)]
    return max(nums) if nums else 99

def dots(n, cls=''):
    return '<span class="dots %s" aria-label="%d из 3">%s</span>' % (cls, n, ''.join('<i class="on"></i>' if i < n else '<i></i>' for i in range(3)))

def ax_items(ids):
    out = []
    for i in ids:
        t = AX.get(i)
        if t:
            out.append('<li><a class="id" href="https://arxiv.org/abs/%s" target="_blank" rel="noopener">%s</a> <span>%s</span></li>' % (i, i, e(t)))
    return ''.join(out)

def pat_items(ps):
    out = []
    for num, who, note in ps:
        href = 'https://patents.google.com/patent/%s/en' % num.replace('/', '').replace(' ', '')
        out.append('<li><a class="id" href="%s" target="_blank" rel="noopener">%s</a> <b>%s</b> <span>%s</span></li>' % (href, e(num), e(who), e(note)))
    return ''.join(out)

missing = []
def card(d):
    for i in d.get('arx', []):
        if i not in AX:
            missing.append((d['title'], i))
    hw = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (e(a), e(b)) for a, b in d['hw'])
    sa, sp = ax_items(d.get('arx', [])), pat_items(d.get('pat', []))
    srcs = ''
    if sa: srcs += '<div class="src"><h5>Статьи arXiv</h5><ul>%s</ul></div>' % sa
    if sp: srcs += '<div class="src"><h5>Патенты — источник идеи</h5><ul>%s</ul></div>' % sp
    fast = '1' if weeks_max(d['weeks']) <= 3 else '0'
    return f'''
<article class="idea" id="idea-{d['n']}" data-dom="{d['dom']}" data-nov="{d['nov']}" data-fast="{fast}">
  <header class="idea-h">
    <div class="idea-id"><span class="num">№{d['n']:02d}</span><span class="dom">{e(DOMAINS[d['dom']])}</span></div>
    <h3>{e(d['title'])}</h3>
    <div class="price" title="Железо прототипа">{e(d['node'])}</div>
  </header>
  <p class="tag">{e(d['tag'])}</p>
  <div class="pills">
    <span class="pill wk">Прототип: {e(d['weeks'])} нед.</span>
    <span class="pill nov">Новизна {dots(d['nov'], 'g')}</span>
    <span class="pill">{e(d['mkt'])}</span>
  </div>
  <div class="idea-body">
    <div class="col">
      <section><h4>Как собрать прототип</h4><p>{e(d['how'])}</p></section>
      <section><h4>Приборы и цены</h4><table class="bom"><tbody>{hw}</tbody></table></section>
      <section><h4>Самое сложное</h4><p>{e(d['hard'])}</p></section>
    </div>
    <div class="col">
      <section class="rec"><h4>Кому продавать</h4><p>{e(d['sell'])}</p></section>
      <section><h4>Почему сейчас</h4><p>{e(d['now'])}</p></section>
      <section><h4>Кто уже делает</h4><p>{e(d['players'])}</p></section>
    </div>
  </div>
  <footer class="sources">{srcs}</footer>
</article>'''

def row(d):
    fast = '1' if weeks_max(d['weeks']) <= 3 else '0'
    return f'''<tr data-dom="{d['dom']}" data-nov="{d['nov']}" data-fast="{fast}">
<td class="n">{d['n']:02d}</td>
<td><a href="#idea-{d['n']}">{e(d['title'])}</a><small>{e(DOMAINS[d['dom']])}</small></td>
<td class="mono">{e(d['node'])}</td>
<td class="wk">{e(d['weeks'])}</td>
<td>{dots(d['nov'], 'g')}</td>
<td>{e(d['mkt'])}</td>
</tr>'''

def pick(p):
    d = by_title[p[0]]
    return '<div class="pick"><span class="k">№%02d · %s · %s нед.</span><h3><a href="#idea-%d">%s</a></h3><p>%s</p></div>' % (d['n'], e(DOMAINS[d['dom']].lower()), e(d['weeks']), d['n'], e(d['title']), e(p[1]))

cards = ''.join(card(d) for d in ideas)
rows = ''.join(row(d) for d in ideas)
used = [k for k in DOMAINS if any(d['dom'] == k for d in ideas)]
chips = ('<button type="button" class="chip on" data-f="all" id="f-all">Все</button>'
         + ''.join('<button type="button" class="chip" data-f="%s" id="f-%s">%s</button>' % (k, k, e(DOMAINS[k])) for k in used)
         + '<span class="sep"></span><button type="button" class="chip fast" data-f="fast" id="f-fast">Прототип до 3 недель</button>'
         + '<button type="button" class="chip new" data-f="new" id="f-new">Новизна ●●●</button>')
reserve = ''.join('<li><b>%s.</b> %s</li>' % (e(a), e(b)) for a, b in RESERVE)
picks = ''.join(pick(p) for p in PICKS)
also = ', '.join('<a href="#idea-%d">№%02d %s</a>' % (by_title[t]['n'], by_title[t]['n'], e(t)) for t in ALSO)
cited = set(i for d in ideas for i in d.get('arx', []) if i in AX)

tpl = open(os.path.join(HERE, 'template_head.html'), encoding='utf-8').read() + open(os.path.join(HERE, 'template_body.html'), encoding='utf-8').read()
out = (tpl.replace('{{CARDS}}', cards).replace('{{ROWS}}', rows).replace('{{CHIPS}}', chips)
          .replace('{{RESERVE}}', reserve).replace('{{DROPPED}}', e(DROPPED)).replace('{{PICKS}}', picks).replace('{{ALSO}}', also)
          .replace('{{PICKS_SUB}}', e(PICKS_SUB)).replace('{{NIDEAS}}', str(len(ideas)))
          .replace('{{NAX}}', str(len(cited))).replace('{{NDOM}}', str(len(used))))
open(os.path.join(HERE, 'datchik-plus-ii.html'), 'w', encoding='utf-8').write(out)
print('ideas', len(ideas), 'cited arxiv', len(cited), 'missing', missing)
