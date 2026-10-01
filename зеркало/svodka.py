# -*- coding: utf-8 -*-
"""Сводка обкатки «Зеркала» на живых людях. Собирается из тех же JSON, что и разборы."""
import os, sys, json, glob, html
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "landings", "_src")); sys.path.insert(0, os.path.join(ROOT, "brand", "_src"))
from funnel import CSS
from mirror import EXTRA_CSS
from inline import inline, favicon_uri
MARK = inline("mark/dna-mark-compact-reverse.svg")
FAV = '<link rel="icon" href="%s">' % favicon_uri("icon/favicon.svg")
e = lambda s: html.escape(str(s or ""))

EXTRA = """
.bug{border-left:3px solid var(--ok);background:#f1faf4;border-radius:0 12px 12px 0;padding:14px 18px;margin:12px 0}
.bug .h{font-weight:600;margin-bottom:4px}
.bug .st{font-size:12px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;color:var(--ok)}
.warnbox{border-left:3px solid #c2410c;background:#fff5ed;border-radius:0 12px 12px 0;padding:14px 18px;margin:12px 0}
.warnbox .h{font-weight:600;margin-bottom:4px;color:#9a3412}
table.p{width:100%;border-collapse:collapse;font-size:14.5px;margin-top:8px}
table.p th,table.p td{padding:11px 8px;border-bottom:1px solid rgba(20,24,48,.09);text-align:left;vertical-align:top}
table.p thead th{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
table.p a{font-weight:600}
.money{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:12px}
.money div{background:var(--paper);border:1px solid var(--line);border-radius:13px;padding:16px 18px}
.money .v{font-family:var(--serif);font-size:26px;font-weight:600;margin-top:4px}
.money .k{font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
@media(max-width:640px){.money{grid-template-columns:1fr}}
"""

def load():
    out = []
    for f in sorted(glob.glob(os.path.join(HERE, "обкатка-2026-09-05", "_исходники", "0*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        if isinstance(d, dict) and "person" in d:
            d["_file"] = os.path.basename(f).replace(".json", ".html")
            out.append(d)
    return out

def build():
    data = load()
    rows = ""
    for d in data:
        p, v = d["person"], d["verdict"]
        soc = d.get("social") or {}
        live = [r for r in d["fetched"].get("rivals", []) if r.get("ok")]
        bio = f'«{e(soc["bio"][:90])}…»' if soc.get("bio") else '<span style="color:var(--muted)">не нашлась — взяли его собственную строку</span>'
        rows += f"""<tr>
  <td><a href="{e(d['_file'])}">{e(p['name'])}</a><br>
      <span style="font-weight:400;color:var(--muted);font-size:13px">{'эксперт' if p['segment']=='expert' else 'бизнес'}</span></td>
  <td>{bio}</td>
  <td>{e(d['rivals'].get('niche'))}<br><span style="color:var(--muted);font-size:13px">{e(d['rivals'].get('geo'))}</span></td>
  <td>{len(live)}<br><span style="color:var(--muted);font-size:13px">{e(' · '.join(r['name'][:22] for r in live[:3]))}</span></td>
  <td>{d.get('total')} c</td></tr>"""

    body = f"""<div class="head">
  <div class="eyebrow">Внутренний документ · 5 сентября 2026</div>
  <h1 class="t">Обкатка «Зеркала» на живых людях</h1>
  <p class="lede">Пять реальных контактов. Задача была не показать красивый результат, а найти,
  где «Зеркало» врёт или тупит. Нашлось многое — и всё найденное уже починено и выкачено.
  Имена кликабельны: откроется разбор ровно в том виде, в каком его увидел бы сам человек.</p>
</div>

<div class="card">
  <h2 style="margin:0 0 6px">Пятеро</h2>
  <div style="overflow-x:auto"><table class="p"><thead><tr>
    <th>Кто</th><th>Шапка профиля (дословно)</th><th>Ниша — определил сам</th><th>Соседи</th><th>Время</th>
  </tr></thead><tbody>{rows}</tbody></table></div>
</div>

<div class="card">
  <div class="eyebrow">Главное про аудиторию</div>
  <h2 style="margin:10px 0 10px">Ни у одного из пятерых нет сайта</h2>
  <p style="margin:0 0 12px;font-size:17px">Всё присутствие — Instagram. И это не мелочь, а <b>сам продукт</b>:
  профиль не читает ни поисковый робот, ни AI-ассистент, к которому придёт их клиент.
  Всё, что видно снаружи ленты, — шапка на две строки.</p>
  <p style="margin:0 0 12px">Посмотрите на колонку с шапками. У Малены половину занимают подарки и стрелочка вниз.
  У Игоря и Кристины шапку не удалось достать даже поиском — то есть их описания нет и в выдаче.
  У Ирины шапка есть, но и она перечисляет регалии, а не отвечает, во что человек попадёт и на каких условиях.</p>
  <p style="margin:0"><b>Это и есть их разрыв</b>, и «Зеркало» показывает его буквально: вот ваша строка,
  вот строки соседей, вот четыре вещи, которых у вас нет. Для этой аудитории артефакт попадает точнее,
  чем для владельцев сайтов — при условии, что мы не врём им про «мёртвую ссылку». Это и было главной починкой.</p>
</div>

<div class="card">
  <div class="eyebrow">Что сломалось на живых людях</div>
  <h2 style="margin:10px 0 14px">Семь багов, все починены</h2>

  <div class="bug"><div class="st">Починено</div><div class="h">1. Instagram притворялся живой страницей</div>
  Отдаёт роботу 707 КБ скриптов и 9 символов текста. Очистка снимала теги <i>до</i> раскодирования
  HTML-сущностей — из них снова рождалась разметка, выходило «120 символов», и проверка на непустоту
  это пропускала. У троих из пяти галочки считались по base64-мусору.</div>

  <div class="bug"><div class="st">Починено</div><div class="h">2. Ветка соцсетей не включалась</div>
  Включалась только при провале загрузки, а он формально удавался. Теперь соцсеть определяется по адресу
  всегда, планка «непустой страницы» для них выше.</div>

  <div class="bug"><div class="st">Починено</div><div class="h">3. Шаги вылетали за стену Netlify в 40 секунд</div>
  Поиск соседей для Ирины — 115 секунд, поиск профиля Андрея — 224. На сайте это дало бы 502.
  Вшит дедлайн 34 с мягкой деградацией.</div>

  <div class="bug"><div class="st">Починено</div><div class="h">4–6. Три несовместимости моделей подряд</div>
  Sonnet не принимает <code>fallbacks</code>. Haiku не принимает adaptive thinking. Haiku не принимает
  <code>effort</code>. И требует <code>allowed_callers</code> на инструменте поиска. Каждая вылезала
  отдельным падением; теперь различия сведены в одну таблицу возможностей.</div>

  <div class="bug"><div class="st">Починено</div><div class="h">7. Длинный ответ поиска = вылет за стену</div>
  Модель выдавала по 2700 токенов описаний соседей, и это тянуло время: у троих из пяти шаг не уложился.
  Ограничили длину — стало 15–25 секунд вместо вылета.</div>
</div>

<div class="card">
  <div class="eyebrow">Деньги — теперь по факту, а не на глазок</div>
  <h2 style="margin:10px 0 6px">26 центов за прогон</h2>
  <p style="margin:0 0 6px;color:var(--muted);font-size:15px">Замерено на этих же пятерых. Движок
  теперь пишет стоимость каждого вызова в логи Netlify.</p>
  <div class="money">
    <div><div class="k">Профиль · Haiku</div><div class="v">$0.01</div></div>
    <div><div class="k">Соседи · Sonnet</div><div class="v">$0.14</div></div>
    <div><div class="k">Вердикт · Opus</div><div class="v">$0.11</div></div>
  </div>
  <p style="margin:14px 0 0">Главная статья — не наши тексты, а <b>результаты веб-поиска</b>: один такой
  вызов вливает в модель 30–75 тысяч токенов. Поэтому шаг «профиль» переведён на Haiku (стало в десять раз
  дешевле и при этом заработало), Opus оставлен только на вердикте — том тексте, который читает человек.</p>
  <p style="margin:10px 0 0">При 26 центах <b>$20 — это около 75 разборов</b>. Защита: кэш на неделю
  (повторный запрос по той же ссылке бесплатен) и квота 5 прогонов в день на браузер.
  Настоящий потолок — лимит расходов в консоли Anthropic.</p>
</div>

<div class="card">
  <div class="eyebrow">Что ещё слабо</div>
  <h2 style="margin:10px 0 14px">Честно про недостатки</h2>
  <div class="warnbox"><div class="h">Соседи для персональных брендов подбираются грубо</div>
  Кристине в соседи попали Грант Кардон и Грэм Стефан — это мировые звёзды с миллионами подписчиков,
  а не те, с кем её реально сравнивает клиент в Лос-Анджелесе. Малене — «Красный Халат», российская
  франшиза, к Майами отношения не имеющая. Для компаний с сайтом поиск работает точнее.</div>
  <div class="warnbox"><div class="h">Таблица четырёх галочек иногда пустая у всех</div>
  У Ирины ни она, ни три соседа не показывают ни цены, ни устройства работы — вся таблица в прочерках.
  Формально честно, но как довод слабо: клиенту нечего сравнивать.</div>
  <div class="warnbox"><div class="h">Шапку профиля достаём через раз</div>
  Поиск по Instagram-хендлу нестабилен: у двоих из пяти шапки не нашлось. Не страшно — тогда берём
  его собственную строку, а сам факт «вас не видно даже поиску» довод сильный. Но повторяемость низкая.</div>
</div>
"""
    return f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Обкатка «Зеркала» — сводка</title>{FAV}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}{EXTRA_CSS}{EXTRA}</style></head><body>
<header class="bar"><div class="row"><span class="logo">{MARK}<span>Business Intelligence <span class="g">DNA</span></span></span></div></header>
<div class="wrap">{body}
<footer>Внутренний документ · обкатка «Зеркала» · 5 сентября 2026</footer>
</div></body></html>"""

if __name__ == "__main__":
    p = os.path.join(HERE, "обкатка-2026-09-05", "СВОДКА.html")
    open(p, "w", encoding="utf-8").write(build())
    print("  ✓ СВОДКА.html пересобрана")
