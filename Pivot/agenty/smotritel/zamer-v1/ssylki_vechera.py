# -*- coding: utf-8 -*-
"""Страница на один вечер: только те вопросы и те нейросети, которые человек делает сегодня.

Берёт строки из tablica-<кто>.csv за нужный день и собирает по странице на человека:
текст вопроса, кнопка «открыть», кнопка «скопировать» и имя файла из таблицы.
Ничего не придумывает: и текст вопроса, и имя файла — те же, что уйдут в разметку.

Запуск:  python3 ssylki_vechera.py 2026-09-22
"""
import csv
import html
import json
import pathlib
import sys
from urllib.parse import quote

ZDES = pathlib.Path(__file__).resolve().parent
VOPROSY = ZDES.parent / 'kalibrovka' / 'voprosy.json'
LYUDI = {'andrey': 'Андрей', 'masha': 'Маша'}
# как открывать вопрос в каждой нейросети: ('кнопка-ссылка' | 'копировать текст' | 'копировать ссылку')
KAK = {
    'chatgpt-bez-logina': ('ссылка', 'Открыть в ChatGPT', 'https://chatgpt.com/?q=%s'),
    'chatgpt-login': ('ссылка', 'Открыть во временном чате', 'https://chatgpt.com/?q=%s&temporary-chat=true'),
    'perplexity': ('ссылка', 'Открыть в Perplexity', 'https://www.perplexity.ai/search?q=%s'),
    'claude': ('текст', 'Скопировать вопрос', None),
    'google-ai': ('ссылка-копия', 'Скопировать ссылку для Firefox', 'https://www.google.com/search?udm=50&q=%s'),
}
POYASNENIE = {
    'claude': 'Claude ссылкой открыть нельзя — копируем вопрос и вставляем в новый чат в режиме инкогнито.',
    'google-ai': 'Нажимать на ссылку нельзя: откроется обычное окно с вашим аккаунтом. Копируем и вставляем '
                 'в адресную строку приватного окна Firefox.',
    'chatgpt-bez-logina': 'Каждый вопрос — в НОВОМ окне инкогнито. В аккаунт не входить.',
    'perplexity': 'Приватное окно, без логина, режим по умолчанию (не Pro, не Research).',
}
STIL = """:root{--bg:#f7f5f1;--ink:#1d1d1f;--mut:#6b6b6b;--card:#fff;--line:#e3ded4;--acc:#1f4fa8}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--ink:#eee;--mut:#9a9a9a;--card:#1f1f1f;--line:#333;--acc:#8fb0ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font:16px/1.45 -apple-system,system-ui,sans-serif}
.w{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:22px 0 6px}
.n{color:var(--mut);font-size:14px;margin:0 0 14px}
.q{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0}
.q.br{border-style:dashed}
.h b{font-size:15px}.h span{font-size:12px;color:var(--mut);margin-left:8px}.h .im{color:#b3541e}
.t{margin:6px 0 10px;white-space:pre-wrap}
.f{font-size:12px;color:var(--mut);margin:8px 0 0;word-break:break-all}
.bs{display:flex;flex-wrap:wrap;gap:8px}
.b{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border:1px solid var(--line);
border-radius:8px;color:var(--acc);text-decoration:none;background:transparent;font:inherit;font-size:14px;cursor:pointer}
.done{opacity:.45}"""


def stranica(kto, den, gruppy, qs):
    bloki = []
    for metka, podpis, rows in gruppy:
        rezhim, nadpis, shablon = KAK[metka]
        kuski = []
        for n, r in enumerate(rows, 1):
            q = qs[r['вопрос']]
            adres = (shablon % quote(q['text'])) if shablon else ''
            if rezhim == 'ссылка':
                knopka = '<a class="b" href="%s" target="_blank" rel="noopener noreferrer">%s</a>' % (
                    html.escape(adres), nadpis)
            else:
                dannye = adres if rezhim == 'ссылка-копия' else q['text']
                knopka = '<button class="b c" data-v="%s" data-n="%s">%s</button>' % (
                    html.escape(dannye, quote=True), html.escape(nadpis), nadpis)
            kuski.append(
                '<div class="q%s"><div class="h"><b>%d. %s</b>%s</div><div class="t">%s</div>'
                '<div class="bs">%s</div><p class="f">имя файла: %s</p></div>'
                % (' br' if q['s_imenem'] else '', n, q['id'],
                   ' <span class="im">с нашим именем — делать ПОСЛЕДНИМ</span>' if q['s_imenem'] else '',
                   html.escape(q['text']), knopka, html.escape(r['файл'])))
        bloki.append('<h2>%s — %d вопросов</h2><p class="n">%s</p>%s'
                     % (html.escape(podpis), len(rows), POYASNENIE.get(metka, ''), '\n'.join(kuski)))
    return """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Замер %s — %s</title>
<style>%s</style></head><body><div class="w">
<h1>Замер видимости · %s · %s</h1>
<p class="n">Начинать между 19:00 и 20:00 по Лос-Анджелесу — в это же время работает программа.
Ответ дожидаемся до конца, раскрываем источники, ничего не уточняем и не переспрашиваем.
Сохраняем страницей целиком: Cmd+S → «Веб-страница, полностью» → имя файла из карточки → папка zamer-v1/otvety/.
После первых трёх — написать «три готово» и подождать проверку.</p>
%s
</div><script>
document.querySelectorAll('button.c').forEach(function(b){b.addEventListener('click',function(){
 navigator.clipboard.writeText(b.dataset.v).then(function(){
  b.textContent='Скопировано';setTimeout(function(){b.textContent=b.dataset.n},1500)});
});});
</script></body></html>""" % (den, LYUDI[kto], STIL, LYUDI[kto], '.'.join(reversed(den.split('-')))[:5], '\n'.join(bloki))


def main():
    den = sys.argv[1] if len(sys.argv) > 1 else '2026-09-22'
    qs = {q['id']: q for q in json.loads(VOPROSY.read_text(encoding='utf-8'))['voprosy']}
    for kto in LYUDI:
        rows = [r for r in csv.DictReader(open(ZDES / ('tablica-%s.csv' % kto), encoding='utf-8-sig'))
                if r['день'] == den]
        if not rows:
            print('%s: строк на %s нет' % (LYUDI[kto], den))
            continue
        gruppy, poryadok = [], []
        for r in rows:
            metka = r['файл'].split('_')[1]
            if metka not in poryadok:
                poryadok.append(metka)
        for metka in poryadok:
            svoi = [r for r in rows if r['файл'].split('_')[1] == metka]
            svoi.sort(key=lambda r: qs[r['вопрос']]['s_imenem'])   # вопрос с именем — последним
            gruppy.append((metka, svoi[0]['нейросеть и режим'], svoi))
        put = ZDES / ('SSYLKI-%s-%s.html' % ('.'.join(reversed(den.split('-')))[:5], LYUDI[kto]))
        put.write_text(stranica(kto, den, gruppy, qs), encoding='utf-8')
        print('%s: %s (%d вопросов, %d нейросети)' % (LYUDI[kto], put.name, len(rows), len(gruppy)))


if __name__ == '__main__':
    main()
