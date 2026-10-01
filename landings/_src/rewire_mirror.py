# -*- coding: utf-8 -*-
"""Перевод входа воронки с квиза на «Зеркало» (05.09.2026, решение Андрея).

Квиз не удаляем: он становится запасной веткой для тех, у кого в интернете нет ничего.
Ссылка на него живёт на самой странице зеркала («У меня пока нет ничего в интернете»).

ГРАБЛИ, НА КОТОРЫЕ УЖЕ НАСТУПАЛИ (см. rewire.py): смещения regex нельзя брать до replace.
Поэтому порядок жёсткий: сначала ВСЕ замены текста, и только потом один раз пересобираем MAP.
Плюс замены сортируем от длинных к коротким — иначе «Начните с бесплатного AI-разбора»
съест начало «Начните с бесплатного AI-разбора: за 4 минуты покажем…».
"""
import os, re, json
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (RU было, RU стало, EN стало)
COMMON = [
 ("Пройти бесплатный AI-разбор →", "Показать зеркало — бесплатно →", "Show me the mirror — free →"),
 ("Начать с бесплатного AI-разбора →", "Начать с зеркала — бесплатно →", "Start with the mirror — free →"),
 ("Пройти AI-разбор без риска →", "Показать зеркало без риска →", "Show me the mirror, risk-free →"),
 ("Хочу так - пройти AI-разбор →", "Хочу так - показать зеркало →", "I want this - show me the mirror →"),
 ("Пройти AI-разбор →", "Показать зеркало →", "Show me the mirror →"),
 ("Шаг 1 · бесплатно · 4 минуты", "Шаг 1 · бесплатно · минута", "Step 1 · free · one minute"),
 ("1 · Бесплатный AI-разбор", "1 · Бесплатное зеркало", "1 · Free mirror"),
 ("AI-разбор на сайте", "Зеркало на сайте", "The mirror, on the site"),
 ("Начните с бесплатного AI-разбора", "Начните с зеркала", "Start with the mirror"),
 ("4 минуты, 9 вопросов → ваша оценка видимости и первый инсайт. Без регистрации.",
  "Одна ссылка → мы открываем вашу страницу и страницы соседей и показываем, чем вы для клиента отличаетесь. Без регистрации.",
  "One link → we open your page and your neighbours' pages and show what sets you apart in the client's eyes. No sign-up."),
 ("4 минуты и 9 вопросов прямо на сайте. Сразу видите свою оценку видимости и первый инсайт.",
  "Одна ссылка прямо на сайте. Мы открываем вашу страницу, находим соседей по нише и показываем зеркало.",
  "One link, right on the site. We open your page, find your neighbours in the niche and show you the mirror."),
 ("Начинаете с бесплатного AI-разбора. Захотите глубже - глубокая диагностика (первым 10 бесплатно, дальше $500 и зачтётся во внедрение). Что бы вы ни решили - вы ничего не теряете.",
  "Начинаете с бесплатного зеркала. Захотите глубже - глубокая диагностика (первым 10 бесплатно, дальше $500 и зачтётся во внедрение). Что бы вы ни решили - вы ничего не теряете.",
  "You start with the free mirror. Want to go deeper - the deep-dive diagnostic (first 10 free, then $500 and credited toward implementation). Whatever you decide - you lose nothing."),
]

BIZ = [
 ("Начните с бесплатного AI-разбора: за 4 минуты покажем, почему вас выбирают по цене и в какой точке AI поднимет продажи или срежет затраты.",
  "Начните с зеркала: дайте ссылку на себя — и мы покажем, какой фразой вы себя описываете и что теми же словами говорят те, с кем вас сравнивают.",
  "Start with the mirror: give us a link to yourself — and we'll show you the phrase you describe yourself with, and the same words used by everyone you're compared to."),
 ("Бесплатный AI-разбор: где вы теряете клиентов",
  "Бесплатное зеркало: как вас видит клиент",
  "A free mirror: how your client sees you"),
 ("9 вопросов - и AI соберёт персональный разбор: почему вас выбирают по цене, насколько рынок видит ваше отличие (оценка в баллах) и одна точка, где AI поднимет продажи или срежет затраты. Без регистрации, прямо здесь.",
  "Одна ссылка - и мы правда открываем вашу страницу, находим тех, кто стоит рядом с вами в поиске, открываем их и показываем: какой фразой вы себя описываете, что теми же словами говорят соседи и чего у вас нет из того, что клиент ищет глазами. Без регистрации, прямо здесь.",
  "One link - and we really do open your page, find who stands next to you in search, open them too, and show you: the phrase you describe yourself with, the same words your neighbours use, and what you're missing that clients look for. No sign-up, right here."),
 ("4 минуты, без регистрации. Дальше - глубокая диагностика 1-на-1; первым 10 бизнесам она бесплатна.",
  "Около минуты, без регистрации. Дальше - глубокая диагностика 1-на-1; первым 10 бизнесам она бесплатна.",
  "About a minute, no sign-up. Next - a 1-on-1 deep-dive diagnostic; free for the first 10 businesses."),
 ("4 минуты сейчас - и вы увидите, почему выбирают по цене и где AI даст вам результат.",
  "Минута сейчас - и вы увидите себя глазами клиента, который вас с кем-то сравнивает.",
  "A minute now - and you'll see yourself through the eyes of a client who is comparing you with someone else."),
 ("Начните прямо на сайте: 9 вопросов, и AI соберёт ваш разбор. Захотите глубже - глубокая диагностика 1-на-1, первым 10 бизнесам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Начните прямо на сайте: дайте ссылку, и мы соберём ваше зеркало. Захотите глубже - глубокая диагностика 1-на-1, первым 10 бизнесам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Start right on the site: give us a link and we'll build your mirror. Want to go deeper - a 1-on-1 deep-dive diagnostic, free for the first 10 businesses. Three questions you'll answer on the diagnostic:"),
 # заодно чиним устаревшее описание воронки: интейк давно стал анкетой после оплаты,
 # а созвон — стратсессией 45–60 мин
 ("Бесплатный AI-разбор - 4 минуты. Дальше интейк-форму заполняете в своём темпе (текстом или голосом), а созвон по диагностике - 40–60 минут. Именно из узкого горла эта работа и вытаскивает.",
  "Зеркало - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Именно из узкого горла эта работа и вытаскивает.",
  "The mirror takes about a minute. Then you fill in the questionnaire at your own pace, and the diagnostic strategy session is 45–60 minutes. This work is exactly what pulls you out of the bottleneck."),
 ("Бесплатный AI-разбор - 4 минуты, интейк-форму заполняете в своём темпе, а созвон по диагностике - 40–60 минут. Эта работа вытаскивает из узкого горла, а не добавляет его.",
  "Зеркало - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Эта работа вытаскивает из узкого горла, а не добавляет его.",
  "The mirror takes about a minute, you fill in the questionnaire at your own pace, and the strategy session is 45–60 minutes. This work pulls you out of the bottleneck, it doesn't add one."),
]

EXP = [
 ("Начните с бесплатного AI-разбора: за 4 минуты покажем, где вы теряете клиентов и в какой точке AI даст вам деньги или время.",
  "Начните с зеркала: дайте ссылку на себя — и мы покажем, какой фразой вы себя описываете и что теми же словами говорят коллеги по полю.",
  "Start with the mirror: give us a link to yourself — and we'll show you the phrase you describe yourself with, and the same words your peers are using."),
 ("Бесплатный AI-разбор: ваш Индекс видимости",
  "Бесплатное зеркало: как вас видит клиент",
  "A free mirror: how your client sees you"),
 ("9 вопросов - и AI соберёт персональный разбор: где вы теряете клиентов, насколько рынок вас видит (оценка в баллах) и одна точка, где AI даст вам результат. Без регистрации, прямо здесь.",
  "Одна ссылка - и мы правда открываем вашу страницу, находим тех, с кем вас сравнивают, открываем их и показываем: какой фразой вы себя описываете, что теми же словами говорят коллеги и чего у вас нет из того, что клиент ищет глазами. Без регистрации, прямо здесь.",
  "One link - and we really do open your page, find who you're compared to, open them too, and show you: the phrase you describe yourself with, the same words your peers use, and what you're missing that clients look for. No sign-up, right here."),
 ("4 минуты, без регистрации. Дальше - глубокая диагностика 1-на-1; первым 10 экспертам она бесплатна.",
  "Около минуты, без регистрации. Дальше - глубокая диагностика 1-на-1; первым 10 экспертам она бесплатна.",
  "About a minute, no sign-up. Next - a 1-on-1 deep-dive diagnostic; free for the first 10 experts."),
 ("4 минуты сейчас - и вы увидите, где теряете и где AI даст вам результат.",
  "Минута сейчас - и вы увидите себя глазами клиента, который вас с кем-то сравнивает.",
  "A minute now - and you'll see yourself through the eyes of a client who is comparing you with someone else."),
 ("Начните прямо на сайте: 9 вопросов, и AI соберёт ваш разбор. Захотите глубже - глубокая диагностика 1-на-1, первым 10 экспертам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Начните прямо на сайте: дайте ссылку, и мы соберём ваше зеркало. Захотите глубже - глубокая диагностика 1-на-1, первым 10 экспертам она бесплатна. Три вопроса, на которые вы ответите уже на диагностике:",
  "Start right on the site: give us a link and we'll build your mirror. Want to go deeper - a 1-on-1 deep-dive diagnostic, free for the first 10 experts. Three questions you'll answer on the diagnostic:"),
 ("Бесплатный AI-разбор - 4 минуты. Дальше интейк-форму заполняете в своём темпе (текстом или голосом), а созвон по диагностике - 40–60 минут. Это всё ваше участие, дальше работаем мы.",
  "Зеркало - около минуты. Дальше анкету заполняете в своём темпе, а стратсессия по диагностике - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "The mirror takes about a minute. Then you fill in the questionnaire at your own pace, and the diagnostic strategy session is 45–60 minutes. That's your entire part - from there we do the work."),
 ("Бесплатный AI-разбор - 4 минуты, интейк-форму заполняете в своём темпе, а созвон по диагностике - 40–60 минут. Это всё ваше участие, дальше работаем мы.",
  "Зеркало - около минуты, анкету заполняете в своём темпе, а стратсессия - 45–60 минут. Это всё ваше участие, дальше работаем мы.",
  "The mirror takes about a minute, you fill in the questionnaire at your own pace, and the strategy session is 45–60 minutes. That's your entire part - from there we do the work."),
]

for seg, extra in (("biznes", BIZ), ("ekspert", EXP)):
    p = os.path.join(HERE, f"{seg}.html")
    s = open(p, encoding="utf-8").read()
    before = len(s)

    # 1. ссылки: вход воронки теперь зеркало
    n = s.count(f'href="quiz-{seg}.html"')
    s = s.replace(f'href="quiz-{seg}.html"', f'href="zerkalo-{seg}.html"')

    # 2. тексты — от длинных к коротким, иначе короткая съест начало длинной
    pairs = sorted(COMMON + extra, key=lambda t: -len(t[0]))
    changed = []
    for old, new, en in pairs:
        assert old in s, f"{seg}: не найдено «{old[:60]}…»"
        s = s.replace(old, new)
        changed.append((old, new, en))

    # 3. и только теперь MAP — на уже изменённом тексте, одним проходом
    m = re.search(r'var MAP=(\{.*?\});', s, re.S)
    assert m, f"{seg}: MAP не найден"
    MAP = json.loads(m.group(1))
    for old, new, en in changed:
        MAP.pop(old, None)
        MAP[new] = en
    s = s[:m.start(1)] + json.dumps(MAP, ensure_ascii=False) + s[m.end(1):]

    open(p, "w", encoding="utf-8").write(s)
    print(f"  ✓ {seg}.html — ссылок на зеркало: {n}, замен: {len(changed)}, "
          f"строк в MAP: {len(MAP)}, {before}→{len(s)}")
