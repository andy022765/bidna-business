# -*- coding: utf-8 -*-
"""Блок «Пятеро цифровых сотрудников» на оба лендинга (07.09.2026).

Зачем: имена ДЕЖУРНЫЙ / ДОВОДЧИК / РАССКАЗЧИК / СБОРЩИК / СМОТРИТЕЛЬ зашиты в движок
и до сих пор не встречались на сайте ни разу — человек видел их только после трёх вопросов.
Это единственная незаимствуемая конкретика продукта.

Текст прошёл: черновики под тремя углами → два судьи → синтез → скептик → правка →
независимая приёмка. Внесены все правки приёмки.

Каждая русская строка блока обязана иметь пару в var MAP, иначе EN-переключатель
оставит её русской. Внизу файла — сверка, она падает, если пара потерялась.
"""
import json
import pathlib
import re

L = pathlib.Path(__file__).resolve().parent.parent
AX = ('<span style="display:block;margin-top:5px;font-weight:600;font-size:11px;'
      'letter-spacing:.12em;color:var(--gold-2)">%s</span>')


def row(name, axis, what):
    return ('      <div class="tl-row"><div class="tl-when">%s%s</div>'
            '<div class="tl-what">%s</div></div>' % (name, AX % axis, what))


# ─────────────────────────────────────────────────────────────── БИЗНЕС
# Порядок — по пути клиента, как его перечисляет лид этого же блока.
B_ROWS = [
 ('СМОТРИТЕЛЬ', 'ВИДИМОСТЬ',
  'Ваш покупатель всё чаще спрашивает не поиск, а нейросеть: к кому пойти. Та называет '
  'несколько имён и про каждое говорит абзац. Берёт она его с открытых страниц. Работа '
  'СМОТРИТЕЛЯ — чтобы этому абзацу было откуда взяться. То же самое СМОТРИТЕЛЬ держит '
  'на Google Maps, Yelp и в поиске. Раз в месяц докладывает: назвали вас или нет, какими '
  'словами и кого назвали рядом.'),
 ('РАССКАЗЧИК', 'МАРКЕТИНГ',
  'РАССКАЗЧИК пишет то, что человек читает до того, как спросит цену: от «а что это вообще '
  'такое» до «сколько это стоит». Ничего не публикует и не снимает — пишет, что говорить. '
  'Закрывает вопросы, которые принесли остальные четверо.'),
 ('ДЕЖУРНЫЙ', 'ПРОДАЖИ',
  'Сообщение приходит в девять вечера. Отвечают утром. К утру человек написал ещё троим. '
  'ДЕЖУРНЫЙ отвечает за минуту, в любое время. Выясняет, с чем пришли, задаёт два вопроса, '
  'предлагает время.'),
 ('ДОВОДЧИК', 'ПРОДАЖИ',
  'Спросил цену и пропал. Так и висит в переписке. ДОВОДЧИК не даёт этому заглохнуть: '
  'готовит сообщение под конкретного человека, вам остаётся нажать «отправить».'),
 ('СБОРЩИК', 'МАРКЕТИНГ',
  'У СБОРЩИКА один момент — когда работа сдана и человеку ещё есть что сказать. Тогда он '
  'и просит отзыв, а с ним доказательства. Фото «до и после», замеры, бумаги. Кладёт всё '
  'туда, откуда РАССКАЗЧИК берёт слова.'),
]

B_HTML = """<!-- FIVE EMPLOYEES -->
<section class="sec" id="crew">
  <div class="wrap" style="max-width:820px">
    <div class="eyebrow">Пятеро цифровых сотрудников</div>
    <h2>На дороге к вам шесть шагов. Пять из них мы забираем.</h2>
    <p class="lead">Клиент вас нашёл. Почитал. Написал. Замолчал. Вернулся и купил. Ушёл довольным и никому про вас не сказал. Пять из этих шагов повторяются у каждого клиента одинаково, их и забирают пятеро. Покупку не заберёт никто — она остаётся вам.</p>
    <p class="lead">У вас есть бригада и менеджеры. Но на этих шагах всё равно стоите вы. Вечером в телефоне, в дороге, в выходной. Решения остаются вам. Пятеро забирают то, что повторяется каждую неделю.</p>

    <div class="tl">
%s
    </div>

    <p class="lead" style="margin-top:26px">В списке работ вы увидите всех пятерых на своём деле. Ставить их разом не нужно: в списке сказано, какие три работы ставятся первыми и почему.</p>
    <p style="margin:0"><a class="pt-link" href="list-biznes.html" rel="noopener">Показать их на моём деле →</a></p>
  </div>
</section>
""" % '\n'.join(row(*r) for r in B_ROWS)

B_MAP = [
 ('Пятеро цифровых сотрудников', 'The five AI employees'),
 ('На дороге к вам шесть шагов. Пять из них мы забираем.',
  'There are six steps on the road to you. We take five of them.'),
 ('Клиент вас нашёл. Почитал. Написал. Замолчал. Вернулся и купил. Ушёл довольным и никому про вас не сказал. Пять из этих шагов повторяются у каждого клиента одинаково, их и забирают пятеро. Покупку не заберёт никто — она остаётся вам.',
  'A customer found you. Read about you. Wrote. Went quiet. Came back and paid. Left happy and told nobody about you. Five of those steps run the same way with every customer, and the five take them over. Nobody takes the purchase — that one stays with you.'),
 ('У вас есть бригада и менеджеры. Но на этих шагах всё равно стоите вы. Вечером в телефоне, в дороге, в выходной. Решения остаются вам. Пятеро забирают то, что повторяется каждую неделю.',
  'You have a crew and managers. Yet on those steps it is still you standing there. On your phone at night, on the road, on a day off. The decisions stay with you. The five take what repeats every week.'),
 ('СМОТРИТЕЛЬ', 'THE KEEPER'), ('РАССКАЗЧИК', 'THE STORYTELLER'),
 ('ДЕЖУРНЫЙ', 'THE RESPONDER'), ('ДОВОДЧИК', 'THE CLOSER'),
 ('СБОРЩИК', 'THE COLLECTOR'),
 ('ПРОДАЖИ', 'SALES'), ('МАРКЕТИНГ', 'MARKETING'), ('ВИДИМОСТЬ', 'VISIBILITY'),
 (B_ROWS[0][2],
  'Your buyer now asks an AI, not a search engine, who to go to. It names a few businesses '
  'and says a paragraph about each one. It takes that paragraph off open pages. THE KEEPER’s '
  'job is to make sure there is something for that paragraph to come from. THE KEEPER holds the '
  'same thing on Google Maps, Yelp and in search. Once a month he reports: were you named or '
  'not, in what words, and who was named next to you.'),
 (B_ROWS[1][2],
  'THE STORYTELLER writes what a person reads before asking the price: from “what even is '
  'this” to “what does it cost”. He posts nothing and films nothing — he writes what to say. '
  'He closes the questions the other four bring back.'),
 (B_ROWS[2][2],
  'A message comes in at nine in the evening. The answer goes out in the morning. By morning '
  'the person has written to three other places. THE RESPONDER answers within a minute, at any '
  'hour. He works out what they came for, asks two questions, offers a time.'),
 (B_ROWS[3][2],
  'Asked the price and vanished. Still hanging there in the chat. THE CLOSER keeps it from '
  'dying: he writes the message for that particular person, and all you do is hit send.'),
 (B_ROWS[4][2],
  'THE COLLECTOR has one moment — when the job is done and the person still has something to '
  'say. That is when he asks for the review, and for the proof along with it. Before-and-after '
  'photos, measurements, paperwork. He files it all where THE STORYTELLER gets his words.'),
 ('В списке работ вы увидите всех пятерых на своём деле. Ставить их разом не нужно: в списке сказано, какие три работы ставятся первыми и почему.',
  'In the work list you will see all five of them applied to your own business. There is no need '
  'to put them all in at once: the list says which three jobs go in first, and why.'),
 ('Показать их на моём деле →', 'Show them on my business →'),
]

# ─────────────────────────────────────────────────────────────── ЭКСПЕРТ
# Порядок — коды движка 01.01–01.05: ровно то, что человек получит одним кликом.
E_ROWS = [
 ('ДЕЖУРНЫЙ', 'ПРОДАЖИ',
  'Первое сообщение почти всегда одно и то же. Что за формат, сколько стоит, есть ли время. '
  'На него отвечает Дежурный — за минуту, в любое время. Спрашивает, с чем человек пришёл, '
  'и предлагает время. Говорит вашими словами, переписку вы видите.'),
 ('ДОВОДЧИК', 'ПРОДАЖИ',
  'Человек спросил и замолчал. Чаще не из-за цены — просто закрутился. Доводчик ведёт таким '
  'счёт и через несколько дней кладёт вам готовое сообщение. Вам остаётся нажать «отправить».'),
 ('РАССКАЗЧИК', 'МАРКЕТИНГ',
  'Рассказчик берёт одно ваше отличие и раскладывает по готовности человека. От «я про такое '
  'даже не думал» до «сколько стоит». Ничего не публикует и не снимает — пишет, что говорить. '
  'Закрывает вопросы, которые принесли остальные.'),
 ('СБОРЩИК', 'МАРКЕТИНГ',
  'Просить отзыв — работа Сборщика. Он делает это, пока человек ещё под впечатлением от '
  'результата. А ответы раскладывает так, чтобы ими можно было пользоваться.'),
 ('СМОТРИТЕЛЬ', 'ВИДИМОСТЬ',
  'Ваш клиент всё чаще спрашивает не знакомых, а нейросеть — по-английски, профессией '
  'и городом: «financial advisor in Tampa». Смотритель следит, чтобы у нейросети было что '
  'о вас сказать. Заодно Google Maps и Yelp. Раз в месяц докладывает: назвали вас или нет '
  'и кого назвали рядом.'),
]

E_HTML = """<!-- FIVE EMPLOYEES -->
<section class="sec" style="background:var(--paper)" id="crew">
  <div class="wrap" style="max-width:820px">
    <div class="eyebrow">Пятеро цифровых сотрудников</div>
    <h2>Машине мы отдаём повторение. Решения оставляем вам.</h2>
    <p class="lead">Вы работаете сами или почти сами. Значит, часть работ просто не делается — вы в это время с клиентом. Путь клиента редко обрывается на мастерстве. Обрывается на стыках, где вы не успеваете.</p>
    <p class="lead">В вашей неделе много одинакового: те же вопросы, те же объяснения. Одно и то же вы рассказываете в переписке и знакомым за ужином. Пятеро забирают именно это. Думать и вести человека остаётся вам.</p>

    <div class="tl">
%s
    </div>

    <p class="lead" style="margin-top:26px">Ставим не всех разом. В списке есть и порядок — что на чём стоит.</p>

    <div class="signer" style="margin-top:26px"><div class="who"><b>Андрей</b><q>Я однажды нанял команду раньше, чем понял, что строю. Работали честно, только не в ту сторону. Поэтому здесь сначала состав — и только потом деньги.</q></div></div>

    <p class="lead">Три строки — и вы увидите весь состав, поимённо. Дальше решать вам.</p>
  </div>
</section>
""" % '\n'.join(row(*r) for r in E_ROWS)

E_MAP = [
 ('Пятеро цифровых сотрудников', 'The five AI employees'),
 ('Машине мы отдаём повторение. Решения оставляем вам.',
  'We hand the repetition to the machine. The decisions stay with you.'),
 ('Вы работаете сами или почти сами. Значит, часть работ просто не делается — вы в это время с клиентом. Путь клиента редко обрывается на мастерстве. Обрывается на стыках, где вы не успеваете.',
  'You work alone, or nearly alone. Which means some of the work simply does not get done — '
  'you are with a client at the time. A client’s path rarely breaks on your craft. It breaks '
  'at the joints, where you cannot keep up.'),
 ('В вашей неделе много одинакового: те же вопросы, те же объяснения. Одно и то же вы рассказываете в переписке и знакомым за ужином. Пятеро забирают именно это. Думать и вести человека остаётся вам.',
  'A lot in your week is the same: the same questions, the same explanations. You tell the same '
  'thing in messages and to friends over dinner. That is exactly what the five take over. '
  'Thinking, and carrying the person through, stays with you.'),
 ('ДЕЖУРНЫЙ', 'THE RESPONDER'), ('ДОВОДЧИК', 'THE CLOSER'),
 ('РАССКАЗЧИК', 'THE STORYTELLER'), ('СБОРЩИК', 'THE COLLECTOR'),
 ('СМОТРИТЕЛЬ', 'THE KEEPER'),
 ('ПРОДАЖИ', 'SALES'), ('МАРКЕТИНГ', 'MARKETING'), ('ВИДИМОСТЬ', 'VISIBILITY'),
 (E_ROWS[0][2],
  'The first message is almost always the same one. What the format is, what it costs, whether '
  'there is time. THE RESPONDER answers it — within a minute, at any hour. He asks what the '
  'person came for and offers a time. He speaks in your words, and you see the whole thread.'),
 (E_ROWS[1][2],
  'Someone asked, then went quiet. Usually not over price — they just got busy. THE CLOSER keeps '
  'count of those and a few days later puts a ready message in front of you. All you do is hit send.'),
 (E_ROWS[2][2],
  'THE STORYTELLER takes the one thing that makes you different and lays it '
  'out by how ready the person is. From “I had never even thought about this” to “what does it '
  'cost”. He posts nothing and films nothing — he writes what to say. He closes the questions '
  'the others bring back.'),
 (E_ROWS[3][2],
  'Asking for the review is THE COLLECTOR’s job. He does it while the result is still fresh for '
  'the person. And he files the answers so they can actually be used.'),
 (E_ROWS[4][2],
  'Your client now asks an AI rather than a friend — in English, by profession and city: '
  '“financial advisor in Tampa”. THE KEEPER makes sure the AI has something to say about you. '
  'Google Maps and Yelp too. Once a month he reports: were you named or not, and who was named '
  'next to you.'),
 ('Ставим не всех разом. В списке есть и порядок — что на чём стоит.',
  'We do not put all five in at once. The list carries the order too — what rests on what.'),
 ('Андрей', 'Andrii'),
 ('Я однажды нанял команду раньше, чем понял, что строю. Работали честно, только не в ту сторону. Поэтому здесь сначала состав — и только потом деньги.',
  'I once hired a team before I understood what I was building. They worked honestly, just in the '
  'wrong direction. That is why here the make-up comes first, and the money only after.'),
 ('Три строки — и вы увидите весь состав, поимённо. Дальше решать вам.',
  'Three lines — and you see the whole line-up, by name. After that it is your call.'),
]

SEG = {'biznes.html': (B_HTML, B_MAP), 'ekspert.html': (E_HTML, E_MAP)}
ANCHOR = '<!-- QUIZ FUNNEL LINK -->'
NODE = re.compile(r'>([^<>]+)<')


def apply(name):
    p = L / name
    s = p.read_text(encoding='utf-8')
    html, pairs = SEG[name]

    if 'FIVE EMPLOYEES' in s:
        print('%-14s блок уже стоит, пропускаю' % name)
        return
    if ANCHOR not in s:
        raise RuntimeError('якорь %s не найден в %s' % (ANCHOR, name))

    s = s.replace(ANCHOR, html + '\n' + ANCHOR, 1)

    m = re.search(r'var MAP=\{', s)
    have = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    add = ''.join('%s: %s, ' % (json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False))
                  for a, b in pairs if a not in have)
    s = s[:m.end()] + add + s[m.end():]
    p.write_text(s, encoding='utf-8')

    # сверка: у каждого текстового узла блока обязана быть пара, иначе EN оставит русский
    d = json.loads(re.search(r'var MAP=(\{.*?\});', s, re.S).group(1))
    nodes = {re.sub(r'\s+', ' ', t).strip() for t in NODE.findall(html)}
    nodes = {t for t in nodes if t and re.search(r'[А-Яа-яЁё]', t)}
    lost = sorted(t for t in nodes if t not in d)
    print('%-14s вставлен | узлов %d | пар в MAP %d | без пары: %s'
          % (name, len(nodes), len(d), lost or 'нет'))
    if lost:
        raise RuntimeError('потеряны пары: %s' % lost)


if __name__ == '__main__':
    for n in SEG:
        apply(n)
