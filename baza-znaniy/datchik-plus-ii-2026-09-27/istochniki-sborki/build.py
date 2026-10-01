# -*- coding: utf-8 -*-
import json, html, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from ideas_data import DOMAINS, IDEAS, RESERVE, DROPPED
from global_data import GLOBAL, PATENT_MAP, OVERRIDES
for _d in IDEAS:
    _d.update(OVERRIDES.get(_d['n'], {}))

HERE = os.path.dirname(__file__)
AX = json.load(open(os.path.join(HERE, 'arxiv_verified.json')))
e = html.escape

KIND = {"ready": "готовое железо", "diy": "сборка на ESP32", "soft": "в основном софт"}
PRISK = {"low": "низкий", "mid": "средний", "high": "высокий"}

def fill(v):
    if isinstance(v, str) and v.startswith("GLOBAL_"):
        return GLOBAL.get(v, "")
    return v

def dots(n):
    return '<span class="dots" aria-label="%d из 3">%s</span>' % (n, ''.join('<i class="on"></i>' if i < n else '<i></i>' for i in range(3)))

def ax_items(ids):
    out = []
    for i in ids:
        t = AX.get(i)
        if not t:
            continue
        out.append('<li><a class="id" href="https://arxiv.org/abs/%s" target="_blank" rel="noopener">%s</a> <span>%s</span></li>' % (i, i, e(t)))
    return ''.join(out)

def pat_items(ps):
    out = []
    for num, who, note in ps:
        q = num.replace('/', '')
        href = 'https://patents.google.com/patent/%s/en' % q
        out.append('<li><a class="id" href="%s" target="_blank" rel="noopener">%s</a> <b>%s</b> <span>%s</span></li>' % (href, e(num), e(who), e(note)))
    return ''.join(out)

def card(d):
    d = {k: fill(v) for k, v in d.items()}
    if d['n'] == 19 and GLOBAL.get('GLOBAL_19_HW'):
        d['hw'] = GLOBAL['GLOBAL_19_HW']
        d['arx'] = GLOBAL.get('GLOBAL_19_ARX', [])
        d['pat'] = GLOBAL.get('GLOBAL_19_PAT', [])
        d['ptext'] = GLOBAL.get('GLOBAL_19_PTEXT', '')
    for key in ('arx_extra',):
        pass
    extra_ax = GLOBAL.get('ARX_EXTRA_%d' % d['n'], [])
    extra_pat = GLOBAL.get('PAT_EXTRA_%d' % d['n'], [])
    arx = list(d['arx']) + [x for x in extra_ax if x not in d['arx']]
    pats = list(d['pat']) + list(extra_pat)
    hw = ''.join('<tr><td>%s</td><td>%s</td></tr>' % (e(a), e(b)) for a, b in d['hw'])
    src_ax = ax_items(arx)
    src_pat = pat_items(pats)
    srcs = ''
    if src_ax:
        srcs += '<div class="src"><h5>Статьи arXiv</h5><ul>%s</ul></div>' % src_ax
    if src_pat:
        srcs += '<div class="src"><h5>Патенты</h5><ul>%s</ul></div>' % src_pat
    if not src_ax:
        srcs += '<p class="note">По этой теме на arXiv почти ничего нет — опора на патенты и журнальные статьи.</p>' if d['n'] in (15,) else ''
    return f'''
<article class="idea" id="idea-{d['n']}" data-dom="{d['dom']}" data-fit="{d['fit']}">
  <header class="idea-h">
    <div class="idea-id"><span class="num">№{d['n']:02d}</span><span class="dom">{e(DOMAINS[d['dom']])}</span></div>
    <h3>{e(d['title'])}</h3>
    <div class="price" title="Стоимость железа">{e(d['node'])}</div>
  </header>
  <p class="tag">{e(d['tag'])}</p>
  <div class="pills">
    <span class="pill fit">Для агентства {dots(d['fit'])}</span>
    <span class="pill">{KIND[d['kind']]}</span>
    <span class="pill risk-{d['prisk']}">Патенты: {PRISK[d['prisk']]}{(' · ' + e(d['ptext'])) if d['ptext'] else ''}</span>
  </div>
  <div class="idea-body">
    <div class="col">
      <section><h4>Как сделать</h4><p>{e(d['how'])}</p></section>
      <section><h4>Приборы и цены</h4><table class="bom"><tbody>{hw}</tbody></table></section>
    </div>
    <div class="col">
      <section><h4>Кому продавать</h4><p>{e(d['who'])}</p></section>
      <section><h4>Где в мире</h4><p>{e(d['world'])}</p></section>
      <section><h4>Риски</h4><p>{e(d['risk'])}</p></section>
      <section class="rec"><h4>Что делать нам</h4><p>{e(d['rec'])}</p></section>
    </div>
  </div>
  <footer class="sources">{srcs}</footer>
</article>'''

def row(d):
    d = {k: fill(v) for k, v in d.items()}
    if d['n'] == 19 and GLOBAL.get('GLOBAL_19_PTEXT') is not None:
        d['ptext'] = GLOBAL.get('GLOBAL_19_PTEXT', d['ptext'])
    return f'''<tr data-dom="{d['dom']}" data-fit="{d['fit']}">
<td class="n">{d['n']:02d}</td>
<td><a href="#idea-{d['n']}">{e(d['title'])}</a><small>{e(DOMAINS[d['dom']])}</small></td>
<td class="mono">{e(d['node'])}</td>
<td>{KIND[d['kind']]}</td>
<td><span class="dot risk-{d['prisk']}"></span>{PRISK[d['prisk']]}</td>
<td>{dots(d['fit'])}</td>
</tr>'''

pm_rows = ''.join('<tr><td class="mono"><a href="https://patents.google.com/patent/%s/en" target="_blank" rel="noopener">%s</a></td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (e(a.replace('/', '')), e(a), e(b), e(c), e(dd), e(f)) for a, b, c, dd, f in PATENT_MAP)

cards = ''.join(card(d) for d in IDEAS)
rows = ''.join(row(d) for d in IDEAS)
reserve = ''.join('<li><b>%s.</b> %s</li>' % (e(a), e(b)) for a, b in RESERVE)
chips = '<button type="button" class="chip on" data-f="all" id="f-all">Все</button>' + ''.join('<button type="button" class="chip" data-f="%s" id="f-%s">%s</button>' % (k, k, e(v)) for k, v in DOMAINS.items()) + '<button type="button" class="chip best" data-f="best" id="f-best">Лучшее для агентства</button>'
n_ax = len(AX)

tpl = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
out = (tpl.replace('{{CARDS}}', cards).replace('{{ROWS}}', rows).replace('{{RESERVE}}', reserve)
          .replace('{{DROPPED}}', e(DROPPED)).replace('{{CHIPS}}', chips).replace('{{PATMAP}}', pm_rows)
          .replace('{{NAX}}', str(n_ax)).replace('{{GLOBAL_NOTE}}', GLOBAL.get('GLOBAL_NOTE', '')))
open(os.path.join(HERE, 'datchik-plus-ii.html'), 'w', encoding='utf-8').write(out)
print('ok', len(out))
