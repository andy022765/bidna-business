# -*- coding: utf-8 -*-
"""Перевод входа воронки с «Зеркала» на «Лист работ» (06.09.2026, решение Андрея).

Зеркало не удаляем — страница живёт по адресу как запасная ветка.
Порядок жёсткий (грабли из rewire.py и rewire_mirror.py): сначала ВСЕ замены текста,
и только потом один раз пересобираем MAP. Замены сортируем от длинных к коротким.
"""
import os, re, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

COMMON = [
 ("Показать зеркало — бесплатно →", "Собрать лист работ — бесплатно →", "Build my work sheet — free →"),
 ("Начать с зеркала — бесплатно →", "Начать с листа работ — бесплатно →", "Start with the work sheet — free →"),
 ("Хочу так - показать зеркало →", "Хочу так - собрать лист работ →", "I want this - build my work sheet →"),
 ("Показать зеркало без риска →", "Собрать лист работ без риска →", "Build my work sheet, risk-free →"),
 ("Показать зеркало →", "Собрать лист работ →", "Build my work sheet →"),
 ("1 · Бесплатное зеркало", "1 · Бесплатный лист работ", "1 · Free work sheet"),
 ("Зеркало на сайте", "Лист работ на сайте", "The work sheet, on the site"),
 ("Начните с зеркала", "Начните с листа работ", "Start with the work sheet"),
 ("Одна ссылка прямо на сайте. Мы открываем вашу страницу, находим соседей по нише и показываем зеркало.",
  "Три вопроса прямо на сайте. Показываем, кто что делает в вашем деле, когда всё поставлено — и кого из работ забирает машина.",
  "Three questions, right on the site. We show who does what in your business once it's all set up - and which of those jobs the machine takes over."),
 ("Начинаете с бесплатного зеркала. Захотите глубже - глубокая диагностика (первым 10 бесплатно, дальше $500 и зачтётся во внедрение). Что бы вы ни решили - вы ничего не теряете.",
  "Начинаете с бесплатного листа работ. Захотите глубже - глубокая диагностика (первым 10 бесплатно, дальше $500 и зачтётся во внедрение). Что бы вы ни решили - вы ничего не теряете.",
  "You start with the free work sheet. Want to go deeper - the deep-dive diagnostic (first 10 free, then $500 and credited toward implementation). Whatever you decide - you lose nothing."),
 ("Бесплатное зеркало: как вас видит клиент",
  "Бесплатный лист работ: что у вас будет в конце",
  "A free work sheet: what you'll have at the end"),
]

BIZ = [
 ("Начните с зеркала: дайте ссылку на себя — и мы покажем, какой фразой вы себя описываете и что теми же словами говорят те, с кем вас сравнивают.",
  "Начните с листа работ: расскажите про дело в трёх строках — и мы покажем, кто что делает у вас, когда всё поставлено, и каких цифровых сотрудников туда ставим.",
  "Start with the work sheet: describe your business in three lines - and we'll show who does what once it's all set up, and which digital workers we put in."),
 ("Начните прямо на сайте: дайте ссылку, и мы соберём ваше зеркало. Захотите глубже - глубокая диагностика 1-на-1, первым 10 бизнесам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Начните прямо на сайте: три вопроса, и мы соберём ваш лист работ. Захотите глубже - глубокая диагностика 1-на-1, первым 10 бизнесам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Start right on the site: three questions and we'll build your work sheet. Want to go deeper - a 1-on-1 deep-dive diagnostic, free for the first 10 businesses. Three questions you'll answer on the diagnostic:"),
 ("Зеркало - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Именно из узкого горла эта работа и вытаскивает.",
  "Лист работ - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Именно из узкого горла эта работа и вытаскивает.",
  "The work sheet takes about a minute. Then you fill in the questionnaire at your own pace, and the diagnostic strategy session is 45–60 minutes. This work is exactly what pulls you out of the bottleneck."),
 ("Зеркало - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Эта работа вытаскивает из узкого горла, а не добавляет его.",
  "Лист работ - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Эта работа вытаскивает из узкого горла, а не добавляет его.",
  "The work sheet takes about a minute, you fill in the questionnaire at your own pace, and the strategy session is 45–60 minutes. This work pulls you out of the bottleneck, it doesn't add one."),
]

EXP = [
 ("Начните с зеркала: дайте ссылку на себя — и мы покажем, какой фразой вы себя описываете и что теми же словами говорят коллеги по полю.",
  "Начните с листа практики: расскажите про работу в трёх строках — и мы покажем, что в вашей практике пойдёт без вас и что останется только вам.",
  "Start with the practice sheet: describe your work in three lines - and we'll show what will run without you and what stays yours alone."),
 ("Начните прямо на сайте: дайте ссылку, и мы соберём ваше зеркало. Захотите глубже - глубокая диагностика 1-на-1, первым 10 экспертам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Начните прямо на сайте: три вопроса, и мы соберём ваш лист практики. Захотите глубже - глубокая диагностика 1-на-1, первым 10 экспертам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Start right on the site: three questions and we'll build your practice sheet. Want to go deeper - a 1-on-1 deep-dive diagnostic, free for the first 10 experts. Three questions you'll answer on the diagnostic:"),
 ("Зеркало - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "Лист практики - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "The practice sheet takes about a minute. Then you fill in the questionnaire at your own pace, and the diagnostic strategy session is 45–60 minutes. That's your entire part - from there we do the work."),
 ("Зеркало - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "Лист практики - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "The practice sheet takes about a minute, you fill in the questionnaire at your own pace, and the strategy session is 45–60 minutes. That's your entire part - from there we do the work."),
]

for seg, extra in (("biznes", BIZ), ("ekspert", EXP)):
    p = os.path.join(HERE, f"{seg}.html")
    s = open(p, encoding="utf-8").read()
    before = len(s)

    n = s.count(f'href="zerkalo-{seg}.html"')
    s = s.replace(f'href="zerkalo-{seg}.html"', f'href="list-{seg}.html"')

    pairs = sorted(COMMON + extra, key=lambda t: -len(t[0]))
    changed = []
    for old, new, en in pairs:
        if old not in s:
            print(f"  ! {seg}: пропускаю, не найдено «{old[:50]}…»"); continue
        s = s.replace(old, new)
        changed.append((old, new, en))

    m = re.search(r'var MAP=(\{.*?\});', s, re.S)
    assert m, f"{seg}: MAP не найден"
    MAP = json.loads(m.group(1))
    for old, new, en in changed:
        MAP.pop(old, None)
        MAP[new] = en
    s = s[:m.start(1)] + json.dumps(MAP, ensure_ascii=False) + s[m.end(1):]

    open(p, "w", encoding="utf-8").write(s)
    print(f"  ✓ {seg}.html — ссылок переведено: {n}, замен текста: {len(changed)}, "
          f"строк в MAP: {len(MAP)}, {before}→{len(s)}")
