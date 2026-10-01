# -*- coding: utf-8 -*-
"""Калибровочный замер v1: один источник вопросов → voprosy.json + ssylki.html.

Источник правды — таблицы в VOPROSY.md. Текст вопроса берётся оттуда как есть,
поэтому руками (по ссылкам) и через API уходит одна и та же строка до буквы.
Запуск: python3 sobrat.py
"""
import html
import json
import pathlib
import re
from urllib.parse import quote

P = pathlib.Path(__file__).resolve().parent
ROW = re.compile(r'^\|\s*([A-Z]+\d+)\s*(★)?\s*\|\s*(.+?)\s*\|\s*(RU|EN)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$')
BRANDED = {'B01', 'B02', 'B03', 'P01', 'WS5', 'CFO5', 'VK5'}


def razobrat():
    gruppa, out = 'nashi', []
    for line in (P / 'VOPROSY.md').read_text(encoding='utf-8').splitlines():
        if line.startswith('### 1. '):
            gruppa = 'worldspeak'
        elif line.startswith('### 2. '):
            gruppa = 'remote-cfo'
        elif line.startswith('### 3. '):
            gruppa = 'askvita'
        m = ROW.match(line)
        if not m:
            continue
        qid, star, text, lang, chto, zhdem, gde = m.groups()
        out.append({
            'id': qid, 'opornyy': bool(star), 'text': text, 'lang': lang.lower(),
            'gruppa': gruppa, 's_imenem': qid in BRANDED,
            'rukami': 'только API' not in gde, 'chto_proveryaem': chto, 'zhdem': zhdem,
        })
    return out


def ssylki(q):
    t = quote(q['text'])
    return [
        ('ChatGPT', 'https://chatgpt.com/?q=' + t),
        ('ChatGPT временный (с логином)', 'https://chatgpt.com/?q=' + t + '&temporary-chat=true'),
        ('Perplexity', 'https://www.perplexity.ai/search?q=' + t),
        ('Google AI Mode', 'https://www.google.com/search?udm=50&q=' + t),
    ]


def stranica(qs):
    ruchnye = [q for q in qs if q['rukami']]
    # сначала нейтральные, вопросы с именем — в самом конце (правило замера)
    ruchnye.sort(key=lambda q: q['s_imenem'])
    rows = []
    for n, q in enumerate(ruchnye, 1):
        btn = ''.join('<a class="b" href="%s" target="_blank" rel="noopener noreferrer">%s</a>'
                      % (html.escape(u), html.escape(name)) for name, u in ssylki(q))
        rows.append(
            '<div class="q%s"><div class="h"><b>%d. %s</b>%s%s</div>'
            '<div class="t" id="t%s">%s</div>'
            '<div class="bs">%s<button class="b c" data-id="%s">Скопировать (для Claude)</button></div></div>'
            % (' br' if q['s_imenem'] else '', n, q['id'], ' <span>★ опорный</span>' if q['opornyy'] else '',
               ' <span class="im">с именем — в конце</span>' if q['s_imenem'] else '',
               q['id'], html.escape(q['text']), btn, q['id']))
    return """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Замер v1 — вопросы</title>
<style>
:root{--bg:#f7f5f1;--ink:#1d1d1f;--mut:#6b6b6b;--card:#fff;--line:#e3ded4;--acc:#1f4fa8}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--ink:#eee;--mut:#9a9a9a;--card:#1f1f1f;--line:#333;--acc:#8fb0ff}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,system-ui,sans-serif}
.w{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.n{color:var(--mut);font-size:14px;margin:0 0 14px}
.q{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}
.q.br{border-style:dashed}.h span{font-size:12px;color:var(--mut);margin-left:8px}.h .im{color:#b3541e}
.t{margin:6px 0 10px;white-space:pre-wrap}
.bs{display:flex;flex-wrap:wrap;gap:8px}
.b{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:8px;
color:var(--acc);text-decoration:none;background:transparent;font:inherit;font-size:14px;cursor:pointer}
</style></head><body><div class="w">
<h1>Калибровочный замер v1</h1>
<p class="n">Каждая кнопка открывает вопрос в нужной нейросети в новой вкладке. Текст не править.
Правила — в INSTRUKCIYA.md: новое окно инкогнито на каждый вопрос, ничего не уточнять, ответ сохранить в PDF.
Вопросы с именем задавать последними. Claude открыть ссылкой нельзя — копируйте текст кнопкой.</p>
%s
</div><script>
document.querySelectorAll('button.c').forEach(function(b){b.addEventListener('click',function(){
 var t=document.getElementById('t'+b.dataset.id).textContent;
 navigator.clipboard.writeText(t).then(function(){b.textContent='Скопировано';setTimeout(function(){b.textContent='Скопировать (для Claude)'},1500)});
});});
</script></body></html>
""" % '\n'.join(rows)


if __name__ == '__main__':
    qs = razobrat()
    ids = [q['id'] for q in qs]
    assert len(ids) == len(set(ids)), 'повтор номера вопроса'
    assert len(qs) == 30, 'ждал 30 вопросов, нашёл %d' % len(qs)
    (P / 'voprosy.json').write_text(json.dumps({'versiya': 'v1', 'voprosy': qs}, ensure_ascii=False, indent=1), encoding='utf-8')
    (P / 'ssylki.html').write_text(stranica(qs), encoding='utf-8')
    print('вопросов %d | руками %d | только API %d | опорных %d'
          % (len(qs), sum(q['rukami'] for q in qs), sum(not q['rukami'] for q in qs), sum(q['opornyy'] for q in qs)))
