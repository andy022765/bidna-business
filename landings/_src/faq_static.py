# -*- coding: utf-8 -*-
"""FAQ: из JavaScript в статическую разметку + новые вопросы (07.09.2026).

Зачем. FAQ собирался скриптом из массива, поэтому не существовал ни для поисковика,
ни для нейросети — видимость в которых мы на этой же странице продаём. Плюс на
английской странице он оставался РУССКИМ: en_build переводит текстовые узлы, а вопросы
жили внутри <script> и до перевода не доходили.

Что поменялось в содержании. Шесть из восьми вопросов на бизнесовой и семь из девяти
на экспертской дословно повторяли блок «Даже если» двумя экранами выше. Выброшены.
На их месте — то, чего на сайте не было нигде: где мы зарабатываем на бесплатном шаге,
что будет с контактами, почему первым десяти бесплатно, откуда берём выводы без доступа
к цифрам, «за те же деньги найму маркетолога» (панч из docs/otrabotka-vozrazheniy.md),
«у меня нет команды» и «нет сайта, только Instagram» для эксперта.

Текст прошёл: два черновика под разными углами на сегмент → судья → синтез → скептик.
Внесены все обязательные правки скептиков, в том числе возвращено условие гарантии
из docs/pricing.md — на лендинге оно было потеряно и в FAQ, и в самом блоке «Гарантии».
"""
import json
import pathlib
import re

L = pathlib.Path(__file__).resolve().parent.parent

# (вопрос, ответ, вопрос EN, ответ EN)
BIZNES = [
 ('Бесплатно — где подвох',
  'Подвоха нет. На списке мы не зарабатываем — зарабатываем на том, что дальше: глубокая '
  'диагностика $500 и само внедрение. Дойдёте туда, только если сами захотите. '
  'Не захотите — список всё равно ваш.',
  'Free — where is the catch',
  'There isn’t one. We make no money on the list. We make it on what comes next: the $500 '
  'deep-dive diagnostic and the build itself. You only get there if you decide to. '
  'If you don’t, the list is yours anyway.'),

 ('Что будет с моими контактами',
  'Список вы видите на экране сразу, ещё до контактов. Почта — чтобы прислать копию '
  'и чтобы нам было куда написать. Рассылки у нас нет: если напишем, то мы двое и по вашему '
  'делу. Базы не продаём и никому не передаём.',
  'What happens to my contact details',
  'You see the list on screen right away, before any contact details. The email is so we can '
  'send you a copy and have somewhere to write. We don’t run a mailing list: if we write, '
  'it’s the two of us and it’s about your business. We don’t sell or hand over anyone’s data.'),

 ('Может, проще нанять агентство',
  'Мы не вместо них, а до них: маркетолог и агентство гребут, а маршрут прокладываем мы. '
  'И всё, что мы соберём, остаётся вам. Агентство, когда вы расстанетесь, уносит доступы '
  'с собой.',
  'Wouldn’t it be easier to hire an agency',
  'We’re not instead of them, we come before them: a marketer or an agency rows, we chart the '
  'course. And everything we build stays with you. An agency, when you part ways, takes the '
  'logins with it.'),

 ('Дорого, ещё один расход на маркетинг',
  'Вы боитесь не суммы, а повторить слив. Поэтому первый платный шаг — глубокая диагностика, '
  'малой кровью, и эти $500 вычитаются из внедрения. Сколько будет стоить само внедрение, '
  'зависит от того, сколько сотрудников вам реально нужно и что у вас уже есть. Вслепую '
  'мы его не продаём.',
  'Expensive — one more marketing bill',
  'What you fear is not the amount, it’s repeating a flop. So the first paid step is the '
  'deep-dive diagnostic, at low stakes, and that $500 comes off the price of the build. What '
  'the build itself costs depends on how many AI employees you actually need and what you '
  'already have. We don’t sell it blind.'),

 ('Почему первым десяти бесплатно',
  'Нам нужны первые истории, на которые можно ссылаться: меняем работу на пример, это дешевле, '
  'чем платить за рекламу. Диагностика та же, без урезаний. Взамен — отзыв и разрешение '
  'рассказать вашу историю; что можно называть, а что нет, решаете вы. Кончатся места — '
  'обычная цена, $500.',
  'Why free for the first ten',
  'We need first stories we can point to: we trade the work for an example, and that is cheaper '
  'than paying for ads. The diagnostic is the same one, nothing cut. In exchange — a testimonial '
  'and permission to tell your story; what can be named and what cannot is your call. Once the '
  'places are gone, it is the usual price, $500.'),

 ('Откуда вы это возьмёте без моих цифр',
  'Из ваших ответов в анкете — то, что знаете только вы. И из того, что рынок пишет сам: '
  'отзывы, обсуждения, страницы соседей по нише. В лицо клиенты говорят вежливо, а в отзывах '
  'и обсуждениях — как есть. Счета, CRM и база для этого не нужны. Рекламу мы не продаём — '
  'значит, диагноз не будет сведён к «вам нужен трафик».',
  'Where do you get this without my numbers',
  'From your answers in the questionnaire — the part only you know. And from what the market '
  'writes on its own: reviews, threads, the pages of your neighbours in the niche. To your face '
  'customers are polite; in reviews and threads they say it as it is. Your accounts, CRM and '
  'client list are not needed for this. We don’t sell advertising — which means the diagnosis '
  'won’t come down to “you need traffic”.'),

 ('А если оплачу и ничего не сделаю',
  'Бывает, и мы это не вылечим. Диагностика даёт ясность и порядок работ, но решает и запускает '
  'человек. Если ждёте, что после оплаты что-то изменится само, — лучше не платите; скажем это '
  'до денег, а не после.',
  'What if I pay and then do nothing',
  'It happens, and we can’t cure that. The diagnostic gives you clarity and the order of the '
  'work, but a person still decides and starts. If you are expecting something to change by '
  'itself once you have paid — better not to pay; we will say so before the money, not after.'),

 ('Возьмётесь за процент от результата',
  'Нет. Процент звучит как разделение риска, а на деле требует, чтобы мы сидели в ваших счетах '
  'и продажах, — этого мы не делаем. Ту же цель закрывает бесплатный вход: первым десяти '
  'диагностика бесплатно, в обмен на отзыв.',
  'Will you work for a share of the result',
  'No. A share sounds like sharing the risk, but in practice it requires us to sit inside your '
  'books and your sales — and we don’t do that. The free entry covers the same ground: for the '
  'first ten the diagnostic is free, in exchange for a testimonial.'),

 ('Гарантируете рост выручки?',
  'При внедрении наших решений и выполнении рекомендаций поток клиентов и продажи растут, '
  'а затраты падают — за счёт того, что убираем хаос и внедряем AI-сотрудников. Конкретную '
  'цифру за месяц честно не обещает никто. Отвечаем мы за метод, за скорость и за то, '
  'что внедрение сделано.',
  'Do you guarantee revenue growth?',
  'If our solutions are implemented and the recommendations followed, the flow of customers and '
  'sales goes up and costs come down — because we take out the chaos and put AI employees in. '
  'Nobody honestly promises a specific number for the month. What we answer for is the method, '
  'the speed, and the fact that the build actually gets done.'),
]

EKSPERT = [
 ('Что я получаю бесплатно и где вы на этом зарабатываете',
  'Зарабатываем мы дальше — на диагностике и внедрении. Список стоит нам минуту машинного '
  'времени, поэтому отдаём его просто так: он открывается на экране ещё до того, как вы '
  'оставите контакты, а почта нужна, чтобы прислать копию и чтобы нам было куда написать. '
  'Список остаётся ваш, даже если дальше вы с нами не пойдёте.',
  'What do I get for free, and where do you make your money',
  'We make our money further along — on the diagnostic and the build. The list costs us a minute '
  'of machine time, so we give it away: it opens on screen before you leave any contact details, '
  'and the email is so we can send you a copy and have somewhere to write. The list stays yours '
  'even if you go no further with us.'),

 ('Почему первым десяти бесплатно и в чём подвох',
  'Диагностика та же самая, не урезанная. Взамен просим отзыв и разрешение рассказать вашу '
  'историю — что можно называть, а что нет, решаете вы. Нам нужны примеры нашей работы, '
  'на которые можно ссылаться. Когда десять наберём, диагностика будет стоить $500 для всех.',
  'Why free for the first ten, and what is the catch',
  'It is the same diagnostic, nothing cut. In exchange we ask for a testimonial and permission '
  'to tell your story — what can be named and what cannot is your call. We need examples of our '
  'own work that we can point to. Once we have ten, the diagnostic costs $500 for everyone.'),

 ('У меня нет команды — кому вы будете внедрять цифровых сотрудников',
  'Вам. Цифровой сотрудник — это не человек в штат. Это работа, которая дальше делается без вас: '
  'ответить первому, кто написал; напомнить тому, кто пропал; собрать текст; попросить отзыв, '
  'пока человек ещё под впечатлением; следить, чтобы нейросети было что о вас сказать, когда '
  'её спрашивают. Их пятеро, и работают они внутри вашей недели. Когда работаете без команды, '
  'передать это некому — поэтому и берёт машина.',
  'I have no team — who exactly are you deploying these AI employees to',
  'To you. An AI employee is not a person on the payroll. It is work that from then on happens '
  'without you: answering whoever wrote first; reminding the one who went quiet; putting the '
  'text together; asking for the review while the result is still fresh; making sure an AI has '
  'something to say about you when someone asks it. There are five of them, and they work inside '
  'your week. When you work without a team there is nobody to hand this to — which is why the '
  'machine takes it.'),

 ('У меня нет сайта, только Instagram',
  'Так у большинства, кто к нам приходит. Список соберётся и без ссылки — трёх вопросов о вашей '
  'практике хватает. Страницу, на которую вы приводите людей, делаем мы — она входит во '
  'внедрение, отдельно за неё не берём. Instagram при этом остаётся местом, где вас находят.',
  'I have no website, only Instagram',
  'That is true for most people who come to us. The list comes together without a link — three '
  'questions about your practice are enough. The page you bring people to is something we build; '
  'it is part of the build, we don’t charge for it separately. Instagram stays what it is: '
  'the place where people find you.'),

 ('А если разбираться по вечерам, своими силами',
  'Многие так и делают. Год делают. Мешает не то, что вы не умеете. Мешает то, что вечера '
  'кончаются раньше работы, а отложенное на потом откладывается навсегда. Мы забираем '
  'повторяющееся, чтобы вечер остался вам.',
  'What if I work it out myself, in the evenings',
  'Plenty of people do. They do it for a year. What gets in the way is not that you can’t. It is '
  'that evenings run out before the work does, and what is put off until later gets put off '
  'forever. We take the repeating part so the evening stays yours.'),

 ('За те же деньги найму маркетолога или подрядчика',
  'Можно. Маркетолог и агентство гребут — мы прокладываем маршрут. Нанимать гребцов, не зная '
  'курса, — самый дорогой способ плыть. Мы работаем раньше них: после нас они наконец знают, '
  'куда грести. И платите вы по-разному: маркетологу — каждый месяц, нам — один раз. То, что '
  'мы соберём, остаётся у вас.',
  'For the same money I could hire a marketer',
  'You could. A marketer or an agency rows — we chart the course. Hiring rowers without knowing '
  'the course is the most expensive way to sail. We work before them: after us they finally know '
  'where to row. And you pay differently: a marketer every month, us once. What we build stays '
  'with you.'),

 ('Дорого',
  'Вы боитесь не суммы, а повторить прошлое разочарование. Поэтому первый шаг ничего не стоит: '
  'список работ бесплатный. Глубокая диагностика — $500, а первым десяти и она бесплатна. '
  'Решение о внедрении — только после неё.',
  'Expensive',
  'What you fear is not the amount, it is repeating an old disappointment. So the first step '
  'costs nothing: the work list is free. The deep-dive diagnostic is $500 — and for the first '
  'ten it is free too. The decision about the build comes only after that.'),

 ('Гарантируете рост?',
  'При внедрении наших решений и выполнении рекомендаций вас становится видно, и вы перестаёте '
  'продавать себя ценой. Конкретную цифру за месяц честно не обещает никто. Отвечаем мы '
  'за метод, за скорость и за то, что внедрение сделано.',
  'Do you guarantee growth?',
  'If our solutions are implemented and the recommendations followed, you become visible and you '
  'stop selling yourself on price. Nobody honestly promises a specific number for the month. '
  'What we answer for is the method, the speed, and the fact that the build actually gets done.'),
]

# Блок «Гарантии» терял условие из docs/pricing.md ровно так же, как FAQ.
GUARANTEE = {
 'biznes.html': (
   '<p><b>Что мы гарантируем.</b> Рост потока клиентов и продаж, а также снижение затрат — '
   'за счёт того, что мы убираем хаос в бизнесе и внедряем AI-сотрудников. Это не «+30% выручки '
   'за месяц» с потолка: конкретную цифру за месяц честно не обещает никто.</p>',
   '<p><b>Что мы гарантируем.</b> При внедрении наших решений и выполнении рекомендаций поток '
   'клиентов и продажи растут, а затраты падают — за счёт того, что мы убираем хаос в бизнесе '
   'и внедряем AI-сотрудников. Это не «+30% выручки за месяц» с потолка: конкретную цифру '
   'за месяц честно не обещает никто.</p>',
   'If our solutions are implemented and the recommendations followed, the flow of customers and '
   'sales goes up and costs come down — because we take the chaos out of the business and put AI '
   'employees in. This is not a “+30% revenue this month” pulled out of thin air: nobody honestly '
   'promises a specific number for the month.'),
 'ekspert.html': (
   '<p><b>Что мы гарантируем.</b> Рост потока клиентов и дохода — за счёт того, что вас '
   'становится видно и вы перестаёте продавать себя ценой. Это не «100 клиентов в месяц» '
   'с потолка: конкретную цифру за месяц честно не обещает никто.</p>',
   '<p><b>Что мы гарантируем.</b> При внедрении наших решений и выполнении рекомендаций поток '
   'клиентов растёт — за счёт того, что вас становится видно и вы перестаёте продавать себя '
   'ценой. Это не «100 клиентов в месяц» с потолка: конкретную цифру за месяц честно '
   'не обещает никто.</p>',
   'If our solutions are implemented and the recommendations followed, the flow of clients goes '
   'up — because you become visible and you stop selling yourself on price. This is not '
   '“100 clients a month” pulled out of thin air: nobody honestly promises a specific number '
   'for the month.'),
}

# Разметка ровно та, которую раньше строил скрипт: классы и вложенность не меняются,
# поэтому CSS и scroll-reveal (селектор ловит #faqList .faq-item) продолжают работать.
ITEM = ('      <div class="faq-item"><div class="faq-q">%s<span class="pl">+</span></div>'
        '<div class="faq-a"><p>%s</p></div></div>')

JS_NEW = """// FAQ: разметка статическая (иначе её не видят ни поисковик, ни нейросеть),
// скрипт только раскрывает пункты.
document.querySelectorAll('#faqList .faq-item').forEach(function(it){
  var q=it.querySelector('.faq-q'), a=it.querySelector('.faq-a');
  if(!q||!a) return;
  q.setAttribute('tabindex','0'); q.setAttribute('role','button');
  q.setAttribute('aria-expanded','false');
  q.addEventListener('click',function(){
    var open=it.classList.toggle('open');
    q.setAttribute('aria-expanded',open?'true':'false');
    a.style.maxHeight = open ? a.scrollHeight+'px' : '';
  });
  q.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){e.preventDefault();q.click();}
  });
});
// Высоту раскрытого пункта надо пересчитывать: после смены языка и на повороте экрана
// текст меняет высоту, а max-height остаётся старым и обрезает ответ.
window.remeasureFaq=function(){
  document.querySelectorAll('#faqList .faq-item.open .faq-a').forEach(function(a){
    a.style.maxHeight=a.scrollHeight+'px';
  });
};
window.addEventListener('resize',window.remeasureFaq);
"""


def apply(name, faq):
    p = L / name
    s = p.read_text(encoding='utf-8')
    if '<div class="faq-item">' in s:   # в CSS «faq-item» тоже есть — ищем именно разметку
        print('%-14s FAQ уже статический, пропускаю' % name)
        return

    # 1. статическая разметка в контейнер
    cont = '<div id="faqList" style="margin-top:24px"></div>'
    if cont not in s:
        raise RuntimeError('контейнер FAQ не найден в %s' % name)
    body = '\n'.join(ITEM % (q, a) for q, a, _, _ in faq)
    s = s.replace(cont, '<div id="faqList" style="margin-top:24px">\n%s\n    </div>' % body, 1)

    # 2. массив и сборщик — вон, вместо них только раскрытие
    m = re.search(r'// FAQ\nconst faqs=\[.*?\n\}\);\n', s, re.S)
    if not m:
        raise RuntimeError('старый блок FAQ не найден в %s' % name)
    s = s[:m.start()] + JS_NEW + s[m.end():]
    s = s.replace('// FAQ is generated synchronously above; apply after load too for safety',
                  '// FAQ markup is static; the script only toggles it')

    # 3. условие гарантии — было потеряно и в FAQ, и в самом блоке «Гарантии»
    g_old, g_new, g_en = GUARANTEE[name]
    if g_old not in s:
        raise RuntimeError('блок гарантии не найден в %s' % name)
    s = s.replace(g_old, g_new, 1)

    # 4. пары в MAP: собираем программно, висячая запятая исключена по построению
    d = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    pairs = [(q, eq) for q, _, eq, _ in faq] + [(a, ea) for _, a, _, ea in faq]
    pairs.append((re.sub(r'<[^>]+>', '', g_new).replace('Что мы гарантируем. ', ''), g_en))
    add = ''.join('%s: %s, ' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                  for k, v in pairs if k not in d)
    mm = re.search(r'var MAP=\{', s)
    s = s[:mm.end()] + add + s[mm.end():]

    # 5. после смены языка пересчитать высоту раскрытого ответа
    s = s.replace("    document.documentElement.lang='en';\n  }",
                  "    document.documentElement.lang='en';\n"
                  "    if(window.remeasureFaq)window.remeasureFaq();\n  }", 1)
    s = s.replace("    document.documentElement.lang='ru';\n  }",
                  "    document.documentElement.lang='ru';\n"
                  "    if(window.remeasureFaq)window.remeasureFaq();\n  }", 1)

    p.write_text(s, encoding='utf-8')

    # сверка: каждый узел нового FAQ обязан иметь пару, иначе EN оставит русский
    d2 = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    nodes = [q for q, _, _, _ in faq] + [a for _, a, _, _ in faq]
    lost = [t for t in nodes if t not in d2]
    print('%-14s пунктов %d | пар в MAP %d | без перевода: %s | faqs-массив: %s'
          % (name, len(faq), len(d2), lost or 'нет', 'убран' if 'const faqs=[' not in s else 'ОСТАЛСЯ'))
    if lost:
        raise RuntimeError('потеряны пары: %s' % lost)


if __name__ == '__main__':
    apply('biznes.html', BIZNES)
    apply('ekspert.html', EKSPERT)
