# -*- coding: utf-8 -*-
"""Правки по сводной ревизии 07.09. Только подтверждённые по файлам находки.
Меняем русский текст И его ключ в var MAP={...} одной операцией — replace по всему
файлу задевает и тело страницы, и ключ. EN-значение меняем отдельно, по ключу."""
import re, sys, pathlib

D = pathlib.Path(__file__).resolve().parent.parent
misses = []

def load(n): return (D/n).read_text(encoding='utf-8')
def save(n, s): (D/n).write_text(s, encoding='utf-8')

def ru(s, old, new, need=True):
    """Заменить русскую строку везде: и в теле, и в ключе MAP."""
    if old not in s:
        if need: misses.append(('RU', old[:70]))
        return s
    return s.replace(old, new)

def en(s, ru_key, en_new):
    """Заменить английское значение у ключа ru_key в MAP."""
    pat = re.compile('("' + re.escape(ru_key) + r'"\s*:\s*")(?:[^"\\]|\\.)*(")')
    if not pat.search(s):
        misses.append(('EN', ru_key[:70]))
        return s
    return pat.sub(lambda m: m.group(1) + en_new.replace('\\', '\\\\') + m.group(2), s, count=1)

# ─────────────────────────────────────────────────────────── ЛЕНДИНГИ
for f, seg in (('biznes.html', 'biznes'), ('ekspert.html', 'ekspert')):
    s = load(f)
    B = seg == 'biznes'

    # 1. $174 000 приписаны нам. cases/kejs-remote-cfo-process.md:72 — её находка.
    K = ('«Думала, будет очередной документ в стол.» За 3 рабочих дня Юле собрали отличие '
         'в одном предложении и нашли расхождение в учёте на $174 000, которым она не пользовалась в продажах.')
    N = ('«Думала, будет очередной документ в стол.» За 3 рабочих дня Юле собрали отличие в одном '
         'предложении — и вытащили в продажи её главное доказательство: найденное ею расхождение '
         'в учёте на $174 000, которым она до этого не пользовалась.')
    s = en(s, K, '“I thought it would be just another document for the drawer.” In 3 business days we '
                 'gave Julia her difference in one sentence — and put her strongest proof to work in '
                 'sales: a $174,000 discrepancy she had found in a client’s books and never used.')
    s = ru(s, K, N)

    # 2. Следы «Зеркала»: лид шага 1 + карточка цены.
    K = ('Одна ссылка - и мы правда открываем вашу страницу, находим тех, ' +
         ('кто стоит рядом с вами в поиске' if B else 'с кем вас сравнивают') +
         ', открываем их и показываем: какой фразой вы себя описываете, что теми же словами говорят ' +
         ('соседи' if B else 'коллеги') +
         ' и чего у вас нет из того, что клиент ищет глазами. Без регистрации, прямо здесь.')
    N = ('Три строки о ' + ('вашем деле' if B else 'вашей практике') + ' - и мы собираем лист из '
         'одиннадцати работ, из которых состоят ваши продажи, маркетинг и видимость. По каждой '
         'написано, кто её делает, когда всё поставлено: цифровой сотрудник, ваш человек по '
         'написанному нами или вы сами. Плюс схема пути клиента. Ссылку на себя можно дать, можно '
         'нет. Без регистрации, прямо здесь.')
    s = en(s, K, 'Three lines about your ' + ('business' if B else 'practice') + ' — and we build a '
                 'sheet of eleven jobs your sales, marketing and visibility are made of. Each one says '
                 'who does it once everything is in place: an AI employee, your own person following '
                 'what we write, or you. Plus a map of your client’s path. A link to yourself is '
                 'optional. No sign-up, right here.')
    s = ru(s, K, N)

    K = ('Одна ссылка → мы открываем вашу страницу и страницы соседей и показываем, '
         'чем вы для клиента отличаетесь. Без регистрации.')
    N = ('Три вопроса о ' + ('вашем деле' if B else 'вашей практике') + ' → лист из одиннадцати '
         'работ: что забирают цифровые сотрудники, что пишем мы, что остаётся вам. '
         'Плюс схема пути клиента. Без регистрации.')
    s = en(s, K, 'Three questions about your ' + ('business' if B else 'practice') + ' → a sheet of '
                 'eleven jobs: what AI employees take on, what we write, what stays with you. '
                 'Plus a map of your client’s path. No sign-up.')
    s = ru(s, K, N)

    # 3. Из «Как всё проходит» выпала оплата, а интейк мы не «присылаем».
    s = ru(s, '2 · Заявка и интейк', '2 · Оплата и анкета')
    s = en(s, '2 · Заявка и интейк', '2 · Payment and questionnaire')
    K = ('Оставляете контакт. Присылаем интейк-форму - заполняете в своём темпе, текстом или '
         'голосом, с автосохранением. Это основа для диагностики.')
    N = ('Оставляете контакты и оплачиваете диагностику картой через Stripe - первым 10 бесплатно '
         'по промокоду, дальше сумма зачтётся во внедрение. Сразу открывается анкета: примерно '
         '40–60 минут, текстом или голосом, ответы сохраняются - можно закрыть и вернуться. '
         'Это основа для диагностики.')
    s = en(s, K, 'You leave your contacts and pay for the diagnostic by card via Stripe — free for the '
                 'first 10 with a promo code, after that the amount is credited toward the build. The '
                 'questionnaire opens right away: about 40–60 minutes, by text or voice, answers are '
                 'saved — you can close it and come back. This is the basis for the diagnostic.')
    s = ru(s, K, N)

    # 4. docs/pricing.md:23 — гарантия обусловлена внедрением. На лендинге условие потерялось.
    K = 'Обещаем: каждый из этих показателей станет измеримо лучше. Насколько сильно - зависит от вас и вашего рынка.'
    N = ('Обещаем так, как написано у нас в условиях: при внедрении наших решений и выполнении '
         'рекомендаций каждый из этих показателей станет лучше. Насколько - зависит от вас и вашего '
         'рынка. Цифру за месяц мы не назовём.')
    s = en(s, K, 'We promise it the way our terms put it: if our solutions are implemented and the '
                 'recommendations followed, each of these gets better. How much depends on you and '
                 'your market. We will not name a number for the month.')
    s = ru(s, K, N)

    # 5. «Вы отдаёте доступ» против шести «доступ не нужен».
    K = 'Муж и жена, выкованные в финансах. Именно поэтому вы отдаёте доступ конкретным людям, а не команде, которую никогда не увидите.'
    N = ('Муж и жена, выкованные в финансах. Поэтому вы разговариваете с двумя конкретными людьми, '
         'а не с командой, которую никогда не увидите. И отдавать ничего не нужно: ни счетов, '
         'ни CRM, ни базы клиентов.')
    s = en(s, K, 'Husband and wife, forged in finance. So you talk to two specific people, not a team '
                 'you will never meet. And you hand over nothing: no accounts, no CRM, no client list.')
    s = ru(s, K, N)

    # 6. Ask Your Business продаётся как готовое. CLAUDE.md: это следующий проект.
    K = 'Живая система Ask Your Business - можно спросить о ' + ('рынке и цене' if B else 'своём рынке') + ' в любой момент'
    N = ('Собранная под вас система в работе: отличие, оффер, сайт и цифровые сотрудники, '
         'которыми вы пользуетесь каждый день')
    s = en(s, K, 'A system built for you and running: your difference, your offer, your site and the '
                 'AI employees you use every day')
    s = ru(s, K, N)

    # 7. «Интейк» — внутренний жаргон, клиент такого слова не знает.
    s = ru(s, 'По вашему интейку проводим глубокую диагностику',
              'По вашим ответам проводим глубокую диагностику')

    # 8. «Ядро» — третье имя внедрения на той же странице.
    s = ru(s, 'Пойдёте в ядро - оплата диагностики', 'Пойдёте во внедрение - оплата диагностики')
    s = ru(s, 'малой кровью, и она засчитывается в ядро', 'малой кровью, и она засчитывается во внедрение')

    # 9. Время входа: четыре разных числа на одну и ту же минуту.
    s = ru(s, 'Пять шагов - от 4 минут на сайте', 'Пять шагов - от пары минут на сайте')
    s = en(s, 'Пять шагов - от пары минут на сайте до карты у вас на руках.',
              'Five steps — from a couple of minutes on the site to a map in your hands.')
    s = ru(s, 'Шаг 1 · бесплатно · минута', 'Шаг 1 · бесплатно · пара минут')
    s = en(s, 'Шаг 1 · бесплатно · пара минут', 'Step 1 · free · a couple of minutes')
    s = ru(s, 'Минута сейчас - и вы увидите', 'Пара минут сейчас - и вы увидите')
    s = ru(s, 'Лист работ - около минуты', 'Лист работ - пара минут', need=B)
    s = ru(s, 'Лист практики - около минуты', 'Лист практики - пара минут', need=not B)
    K = ('Около минуты, без регистрации. Дальше - глубокая диагностика 1-на-1; первым 10 ' +
         ('бизнесам' if B else 'экспертам') + ' она бесплатна.')
    N = 'Пара минут. Без карты и без регистрации - лист собирается прямо на этой странице.'
    s = en(s, K, 'A couple of minutes. No card, no sign-up — the sheet is built right on this page.')
    s = ru(s, K, N)

    # 10. Грамматика и опечатки.
    s = ru(s, 'и кого из работ забирает машина', 'и какие из работ забирает машина')
    s = ru(s, 'Работаем из разговора, что вы рассказываете на своё усмотрение.',
              'Работаем из того, что вы рассказываете сами и на своё усмотрение.')
    s = ru(s, 'клиентов и продаж и снижение затрат', 'клиентов и продаж, а также снижение затрат')
    s = ru(s, 'Никакого call-центра', 'Никакого колл-центра')
    s = ru(s, 'и по гео-запросам', 'и по геозапросам')
    s = ru(s, 'консалтфирма - $15 000–50 000', 'консалтинговая фирма - $15 000–50 000')
    if B:  # текст от экспертной версии на бизнесовом лендинге
        s = ru(s, 'соберём под вашу практику.', 'соберём под ваше дело.')
        s = en(s, 'Вышло общо или язык не поворачивается? Это ровно та проблема, которую мы решаем: '
                  'вашу настоящую формулировку — точную и небанальную — соберём под ваше дело.',
                  'Came out generic or hard to say? That’s exactly the problem we solve — we’ll craft '
                  'your real wording, precise and non-generic, around your business.')

    # 11. Единственная всегда видимая кнопка мотала страницу вниз вместо перехода на лист.
    s = s.replace('<a class="btn btn-gold btn-nav" href="#final">',
                  '<a class="btn btn-gold btn-nav" href="list-%s.html">' % seg, 1)

    # 12. Кнопка на Calendly уводила холодного человека мимо листа и диагностики.
    s = ru(s, '<a class="btn btn-gold" href="https://calendly.com/andywar777/1hr" target="_blank" '
              'rel="noopener">Обсудить внедрение →</a>',
              '<a class="btn btn-gold" href="list-%s.html" rel="noopener">Начать с бесплатного листа →</a>'
              '<div class="tier-note">Внедрение обсуждаем после диагностики - вслепую мы его не продаём.</div>' % seg)
    s = en(s, 'Обсудить внедрение →', 'Start with the free sheet →')

    save(f, s)

# ─────────────────────────────────────────────────── ОПЛАТА / СПАСИБО
for f, w in (('spasibo-biznes.html', 'о бизнес'), ('spasibo-ekspert.html', 'о практику')):
    s = load(f)
    s2 = s.replace('чем точнее вы расскажете ' + w + ',',
                   'чем точнее вы расскажете о своём деле,')
    if s2 == s: misses.append(('SPASIBO', f))
    save(f, s2)

for f in ('oplata-biznes.html', 'oplata-ekspert.html'):
    s = load(f)
    n = len(s)
    # NDA: «за кейс» появлялось только на кассе и спорило с NDA двумя строками ниже
    s = s.replace('Первым 10 - бесплатно, за отзыв и кейс.',
                  'Первым 10 - бесплатно, в обмен на отзыв. Кейс публикуем только с вашего письменного '
                  'согласия и в том виде, который вы утвердите.')
    s = s.replace('Один заход, ~40–60 минут',
                  'Примерно 40–60 минут, и можно частями: ответы сохраняются в браузере')
    if len(s) == n: misses.append(('OPLATA', f))
    save(f, s)

print('НЕ НАЙДЕНО:', len(misses))
for k, v in misses: print(' ', k, '|', v)
