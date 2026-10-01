# -*- coding: utf-8 -*-
"""Сборка трёх двуязычных лендингов.

    python3 shtab/sayty/sborka.py [куда]

Вход  — `istochniki/*.html` (по четыре файла на лендинг: страница и «спасибо»,
        каждая на двух языках) плюс медиа из `media/лендинг N/`.
Выход — двенадцать страниц в `<куда>/out/` для Netlify и шесть в `<куда>/preview/`
        для артефактов Claude.

Картинки и видео в проекте НЕ лежат: одно видео на 3 МБ размножилось бы
пятнадцатью копиями в Google Drive. Сборка жмёт их из `media/` каждый раз.

Переключатель языка — ссылкой, а не подменой в DOM. Ссылкой можно поделиться:
пишешь русскоязычному владельцу — даёшь сразу русский адрес. Тот же довод,
по которому `landings/_src/en_build.py` делает статическую /en на основном сайте.

Английская основная, русская в /ru. На основном сайте наоборот — там русская
главная. Эти три продаём в Штаты.
"""
import io, os, re, shutil, sys

import vid   # общий вид лендингов, правки Андрея 24.09 — см. shtab/sayty/vid.py
import zvonki  # шесть страниц-ответов /zvonki/ — см. shtab/sayty/zvonki.py

DOMAIN = "https://businessinteldna.com"
KORENJ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ISTOCHNIKI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "istochniki")
KACHESTVO = 82          # замерено: 2–3,6 МБ PNG → 20–60 КБ webp, на глаз не отличить

# ── СОПРОВОЖДЕНИЕ ПОСЛЕ КВАРТАЛА (видимость) ──────────────────────────────────
# Цифру решает ТОЛЬКО Андрей. Пока здесь None — строки на странице НЕТ ВООБЩЕ:
# лучше промолчать, чем показать цену, которой он не утверждал. Пришлёт число —
# вписать его сюда, пересобрать, и строка появится сразу в обеих версиях.
# Ставится в блок цены, сразу после «Один платёж, квартал вперёд».
SOPROVOZHDENIE = 750          # например 750 — доллары за квартал

LANDINGS = [
    # слаг          папка медиа    имена картинок (без расширения)
    ("visibility", "лендинг 1", ["otvet-ai", "tri-nahodki", "zamer-9-progonov"]),
    # plan-90-dney убран 24.09: текст внутри картинки был мелким (замечание Андрея),
    # а те же шесть вех уже стоят рядом обычным текстом — его видят и человек, и нейросеть.
    ("call-audit", "лендинг 2", ["otchet-po-zvonku", "protokol-vera"]),
    ("vera",       "лендинг 3", ["pismo-vladelcu"]),
]

# Без медиа, без формы, без «спасибо» — только страница и «оплачено».
PROSTYE = ["diagnostic"]

# В артефактах Claude каждая страница живёт на своём адресе, относительных путей
# между ними нет. Чтобы переключатель проверялся ровно так, как он будет работать
# на сайте, в превью кнопка ведёт на парный артефакт.
ARTEFAKTY = {
    "visibility": ("https://claude.ai/artifact/Vmym3vAKYXrsEK9KtrYw59",
                   "https://claude.ai/artifact/9E7TppGNm9DeSpHu7K4LsR"),
    "call-audit": ("https://claude.ai/artifact/EzauysY3f7CYHpLiQvG4jL",
                   "https://claude.ai/artifact/MZ3H6BQgPSYAY4oso4r2az"),
    "vera":       ("https://claude.ai/artifact/JW9accsUCZfGrLj7ZKg9bB",
                   "https://claude.ai/artifact/KEhiYipvz2hum367SA23eo"),
}

SWITCH_CSS = """
  .lang{position:fixed;top:14px;right:14px;z-index:60;display:grid;place-items:center;
    min-height:36px;min-width:52px;font-family:'JetBrains Mono',monospace;font-size:12px;
    letter-spacing:.14em;color:var(--dim);text-decoration:none;background:rgba(10,14,24,.78);
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
    border:1px solid var(--line);border-radius:999px;padding:0 14px}
  .lang:hover{border-color:var(--gold);color:var(--gold)}
  @media(max-width:640px){.lang{top:10px;right:10px;min-height:44px;min-width:60px;font-size:13px}}
"""



# Маяк воронки. Молчаливый: любая ошибка здесь не имеет права трогать страницу.
# Пишет в netlify-functions/ev-lend.js — отдельный счётчик трёх лендингов.
# Ни кук, ни localStorage, ни одного поля о человеке: считаем только шаги.
MAYAK = """
<script>
(function(){try{
  var SEG=%s, U='/.netlify/functions/ev-lend', SLANO=%s, bylo={};
  function ev(n){if(bylo[n])return;bylo[n]=1;try{
    var d=JSON.stringify({e:n,seg:SEG});
    if(navigator.sendBeacon){navigator.sendBeacon(U,new Blob([d],{type:'application/json'}));}
    else{fetch(U,{method:'POST',headers:{'content-type':'application/json'},body:d,keepalive:true}).catch(function(){});}
  }catch(x){}}
  ev(%s);
  addEventListener('scroll',function(){
    if(scrollY+innerHeight>=document.body.scrollHeight*0.5)ev('scroll50');
  },{passive:true});
  var pt=document.querySelector('.tw');           // первая таблица на странице — блок цены
  if(pt&&window.IntersectionObserver){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){ev('price');io.disconnect();}});},{threshold:.2});
    io.observe(pt);
  }
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a'):null;
    if(!a)return;
    if(a.classList.contains('btn'))ev('cta');
    if(a.classList.contains('lang'))ev('lang');
  },true);
  // Живое число свободных мест. Берётся из купона Stripe. Нет ключа, нет купона,
  // Stripe молчит — строка просто не показывается: лучше молчать, чем выдумать число.
  var m=document.querySelector('[data-mesta]');
  if(m){fetch('/.netlify/functions/mesta?p='+m.getAttribute('data-mesta'))
    .then(function(r){return r.json()})
    .then(function(d){if(d&&typeof d.left==='number'&&d.valid!==false&&d.left>0){
      m.textContent=d.left; m.closest('.mesta').hidden=false;}})
    .catch(function(){});}

  var f=document.querySelector('form');
  if(f){f.addEventListener('focusin',function(){ev('form_start');},{once:true});
        f.addEventListener('submit',function(){ev('submit');
          // Состояние «отправляется»: на медленной связи человек иначе жмёт второй раз.
          // Гасим кнопку СЛЕДУЮЩИМ тиком — disabled до отправки её отменяет.
          var b=f.querySelector('button[type=submit]'); if(!b||b.dataset.busy)return;
          b.dataset.busy='1'; b.textContent=SLANO;
          setTimeout(function(){b.disabled=true;b.style.opacity='.65';},0);});}
}catch(x){}})();
</script>
"""


def mayak(s, seg, pervoe):
    slano = "Отправляем…" if seg.endswith("-ru") else "Sending…"
    return s.rstrip() + "\n" + (MAYAK % ("'%s'" % seg, "'%s'" % slano, "'%s'" % pervoe)) + "\n"



# Мгновенная проверка видимости. Только на лендинге видимости: форма перестаёт быть
# обычной отправкой и показывает список прямо на странице.
#
# Заявку НЕ теряем: сначала уходит обычная отправка Netlify Forms через fetch, и только
# потом зовётся движок. Упал движок, кончилась квота, выключен JS — человек всё равно
# попал в таблицу заявок, а страница честно говорит, что разбор придёт письмом.
PROVERKA_CSS = """
  .rez{margin:22px 0 0;padding:20px 22px;background:var(--panel);border:1px solid var(--line);
    border-radius:10px}
  .rez[hidden]{display:none}
  .rez .k{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--gold);margin:0 0 10px;display:block}
  .rez ol{margin:0;padding-left:22px}
  .rez li{margin-bottom:7px;font-size:17px}
  .rez li::marker{color:var(--faint);font-family:'JetBrains Mono',monospace;font-size:13px}
  .rez .raz{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--faint);
    margin-left:8px;white-space:nowrap}
  .rez li.ty .raz{color:var(--gold)}
  .rez p{margin:14px 0 0;font-size:15px;color:var(--dim)}
  .rez .ty{color:var(--gold);font-weight:600}
  .zhdem{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--gold);
    margin-right:9px;animation:puls 1.1s ease-in-out infinite}
  @keyframes puls{0%,100%{opacity:.25}50%{opacity:1}}
  @media(prefers-reduced-motion:reduce){.zhdem{animation:none;opacity:.7}}
"""

PROVERKA_JS = """
<script>
(function(){try{
  var f=document.querySelector('form[name^="geo-check"]'); if(!f)return;
  var rez=document.getElementById('rez'); if(!rez)return;
  var RU=%s;
  // СРОК — МИНУТА, А НЕ РАБОЧИЙ ДЕНЬ. С тех пор как форму подхватывает razbor-background,
  // девять прогонов идут сразу и письмо уходит за 15-30 секунд. «В течение рабочего дня»
  // осталось здесь от статической формы и врало: замечание Андрея 24.09. Этот текст видит
  // только видимость — форма geo-check есть лишь у неё, проверено грепом по исходникам.
  var T=RU?{zhdem:'Спрашиваем ChatGPT три раза. Это занимает секунд тридцать.',
            shapka:'Кого называют сейчас',
            raz:function(n,vs){return n+' из '+vs},
            razbros:'Справа — сколько прогонов из трёх назвали. Одни и те же вопросы дают разные ответы, поэтому мы и не показываем одно число.',
            vy:'Вашего имени в этом списке нет — за этим мы и здесь.',
            est:'Вы в списке. Мы так и написали бы в разборе.',
            dalshe:'Это один движок, три прогона. Остальные шесть придут на почту в течение минуты — проверьте её через минуту.',
            pozzhe:'Движок сейчас не ответил. Ничего страшного: весь разбор придёт письмом в течение минуты.',
            kvota:'На сегодня проверки с этого адреса закончились. Разбор придёт письмом.'}
         :{zhdem:'Asking ChatGPT three times. This takes about thirty seconds.',
            shapka:'Who gets named right now',
            raz:function(n,vs){return n+' of '+vs},
            razbros:'On the right: how many of the three runs named them. The same question gives different answers, which is why we never show you a single number.',
            vy:'Your name is not on this list. That is what we are here for.',
            est:'You are on the list. We would have told you that in the read-out.',
            dalshe:'That is one engine, three runs. The other six land in your inbox within a minute — check it in a minute.',
            pozzhe:'The engine did not answer just now. No matter: the full read-out comes by email within a minute.',
            kvota:'No more checks from this address today. The read-out still comes by email.'};

  function pokazat(html){rez.innerHTML=html; rez.hidden=false;
    rez.scrollIntoView({block:'nearest',behavior:'smooth'});}

  f.addEventListener('submit',function(e){
    if(!window.fetch)return;                       // нет fetch — уходит обычной отправкой
    e.preventDefault();
    var fd=new FormData(f);
    var trade=(fd.get('trade')||'').toString().trim();
    var city=(fd.get('city')||'').toString().trim();

    // 1. Заявка. Сначала она, потом всё остальное.
    var telo=new URLSearchParams(); fd.forEach(function(v,k){telo.append(k,v)});
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
               body:telo.toString()}).catch(function(){});

    pokazat('<span class="k"><span class="zhdem"></span>'+T.zhdem+'</span>');

    // 2. Движок.
    fetch('/.netlify/functions/proverka',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({trade:trade,city:city})})
      .then(function(r){return r.json()})
      .then(function(d){
        if(!d||!d.ok||!d.imena||!d.imena.length){
          pokazat('<span class="k">'+T.shapka+'</span><p>'+
                  (d&&(d.pochemu==='gost'||d.pochemu==='vsego')?T.kvota:T.pozzhe)+'</p>');
          return;
        }
        var svoy=null, n=(fd.get('biz')||'').toString().trim().toLowerCase();
        var vsego=d.progonov||3;
        var li=d.imena.map(function(x,i){
          var imya=(typeof x==='string')?x:x.imya, raz=(typeof x==='string')?null:x.raz;
          var sam=n&&imya.toLowerCase().indexOf(n)>=0; if(sam)svoy=i;
          var bez=imya.replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]});
          return '<li'+(sam?' class="ty"':'')+'>'+bez+
                 (raz?'<span class="raz">'+T.raz(raz,vsego)+'</span>':'')+'</li>';
        }).join('');
        pokazat('<span class="k">'+T.shapka+'</span><ol>'+li+'</ol>'+
                '<p>'+(svoy===null?T.vy:T.est)+' '+T.dalshe+'</p>'+
                '<p style="font-size:13.5px;color:var(--faint)">'+T.razbros+'</p>');
      })
      .catch(function(){pokazat('<span class="k">'+T.shapka+'</span><p>'+T.pozzhe+'</p>')});
  });
}catch(x){}})();
</script>
"""


# Настоящий ответ ChatGPT на «Who is the best roofer in Tampa, FL?», снят 22.09.2026.
# Настоящий разброс по четырём прогонам, снят 22.09.2026.
PRIMER = [("Steadfast Roofing", 3), ("SCM Roofing", 3), ("Westfall Roofing", 3),
          ("Roof Panda", 2), ("The Roofing Company", 2), ("Randy Leitner Roofing", 2),
          ("Stay Dry Roofing of Tampa Bay", 1), ("Arry\u2019s Roofing Services", 1)]


def proverka(s, ru, primer=False):
    """Вешает мгновенную проверку. Только там, где есть форма geo-check."""
    if 'name="geo-check' not in s:
        return s
    s = s.replace("</style>", PROVERKA_CSS + "</style>", 1)
    s = s.replace("</form>", '</form>\n      <div class="rez" id="rez" hidden></div>', 1)
    js = PROVERKA_JS % ("true" if ru else "false")
    if primer:
        # Превью для артефакта: функций тут нет, подставляем снятый ответ и говорим об этом.
        pometka = ("Это снятый ответ ChatGPT от двадцать второго сентября. На сайте здесь "
                   "живой ответ движка." if ru else
                   "This is a real ChatGPT answer captured on 22 September. On the live site "
                   "this is fetched fresh.")
        js = js.replace("""    fetch('/.netlify/functions/proverka',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({trade:trade,city:city})})
      .then(function(r){return r.json()})""",
"""    new Promise(function(ok){setTimeout(function(){ok(%s)},1400)})""" % (
            '{ok:true,progonov:3,imena:%s,primer:%s}' % (
                "[" + ",".join('{imya:"%s",raz:%d}' % (x, r) for x, r in PRIMER) + "]",
                '"' + pometka + '"')))
        js = js.replace("'<p>'+(svoy===null?T.vy:T.est)+' '+T.dalshe+'</p>'",
                        "'<p>'+(svoy===null?T.vy:T.est)+' '+T.dalshe+'</p>'+"
                        "(d.primer?'<p style=\"color:var(--faint);font-size:13.5px\">'+d.primer+'</p>':'')")
    return s.rstrip() + "\n" + js + "\n"


# ---------------------------------------------------------------- проверка пары

def skeleton(s):
    """Последовательность тегов с классами, без <br> и без содержимого <style>."""
    s = re.sub(r"<style.*?</style>", "", s, flags=re.S)
    out = []
    for t in re.findall(r"<[a-zA-Z][^>]*>", s):
        name = t.split()[0].lstrip("<").rstrip(">")
        if name.lower() == "br":
            continue
        cls = re.search(r'class="([^"]*)"', t)
        out.append(name + "|" + (cls.group(1) if cls else ""))
    return out


def proverit_paru(imya, en, ru):
    """Языки обязаны совпадать по вёрстке. Разошлись — значит правку внесли
    в один файл и забыли про второй. Молча выкладывать такое нельзя."""
    a, b = skeleton(en), skeleton(ru)
    if a == b:
        return True
    import difflib
    print("  !! %s: вёрстка EN и RU разошлась" % imya)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b).get_opcodes():
        if op != "equal":
            print("     EN: %s" % (a[i1:i2] or "—"))
            print("     RU: %s" % (b[j1:j2] or "—"))
    return False


# ------------------------------------------------------------------- страницы

def head_inject(s, canonical, alt_en, alt_ru):
    tags = ('<link rel="canonical" href="%s">\n'
            '<link rel="alternate" hreflang="en" href="%s">\n'
            '<link rel="alternate" hreflang="ru" href="%s">\n'
            '<link rel="alternate" hreflang="x-default" href="%s">\n') % (
        canonical, alt_en, alt_ru, alt_en)
    m = re.search(r'<meta name="viewport"[^>]*>\n', s)
    if not m:
        raise SystemExit("нет meta viewport — мобильная сломается на Netlify")
    return s[:m.end()] + tags + s[m.end():]


def add_switch(s, href, label, aria, hreflang):
    s = s.replace("</style>", SWITCH_CSS + "</style>", 1)
    link = '\n<a class="lang" href="%s" hreflang="%s" aria-label="%s">%s</a>\n' % (
        href, hreflang, aria, label)
    return s.replace("</style>", "</style>" + link, 1)


def stroka_soprovozhdeniya(s, ru):
    """Продление — СТРОКОЙ В ТАБЛИЦЕ ЦЕН, а не абзацем под ней (Андрей 26.09).

    Абзацем его не видели: человек читает таблицу, доходит до итога «Квартал $1 500»
    и дальше не смотрит. В таблице строка стоит там, где на неё смотрят, и с тем же
    мелким пояснением, что у остальных строк.
    """
    if not SOPROVOZHDENIE:
        return s
    # Пробел в сумме неразрывный (&nbsp;) — иначе «$1 500» рвётся на «$1 / 500».
    itog = ('<tr class="sum"><td>Квартал</td><td class="p">$1&nbsp;500</td></tr>' if ru else
            '<tr class="sum"><td>The quarter</td><td class="p">$1,500</td></tr>')
    if s.count(itog) != 1:
        raise SystemExit("  ! строка итога в таблице цен изменилась — некуда ставить продление")
    # Описание — НЕ в строку встык, а ниже и по одному пункту в строке: слепленное
    # в одну строку оно читалось как продолжение названия (замечание Андрея 26.09).
    spisok = ('<ul style="margin:8px 0 0;padding-left:18px;font-weight:400">'
              '<li>новый замер</li><li>починка новой неправды</li>'
              '<li>правки, когда у вас что-то поменялось</li></ul>' if ru else
              '<ul style="margin:8px 0 0;padding-left:18px;font-weight:400">'
              '<li>a fresh measurement</li><li>fixing whatever new untruth turns up</li>'
              '<li>edits when something changes on your side</li></ul>')
    stroka = ('<tr class="sum"><td>Продление по желанию%s</td>'
              '<td class="p">$%d&nbsp;за&nbsp;квартал</td></tr>' % (spisok, SOPROVOZHDENIE)
              if ru else
              '<tr class="sum"><td>Renewal, if you want it%s</td>'
              '<td class="p">$%d a quarter</td></tr>' % (spisok, SOPROVOZHDENIE))
    return s.replace(itog, itog + "\n  " + stroka, 1)


def ssylki_na_zvonki(s):
    """Блок ссылок на шесть страниц /zvonki/ — только на РУССКОМ лендинге Веры.

    Ставится после сверки вёрстки EN и RU: английской пары у этих страниц нет, и такой же
    блок в английской версии вёл бы человека на русские тексты. Сверка сравнивает исходники
    до этого места, поэтому разойтись она не может."""
    yakor = ('<section><div class="w"><div class="narrow cen">\n'
             '  <h2>Три минуты, и вы сами всё поймёте.</h2>')
    if s.count(yakor) != 1:
        raise SystemExit("  ! лендинг Веры изменился — некуда ставить ссылки на /zvonki/")
    punkty = "".join('<li><a href="%s">%s</a></li>' % (u, t) for u, t in zvonki.spisok())
    blok = ('<section><div class="w"><div class="narrow">\n'
            '  <p class="eyebrow">Разобрано отдельно</p>\n'
            '  <h2>Шесть вопросов, которые задают до покупки.</h2>\n'
            '  <p>Отвечаем на каждый целиком, с ценами и с тем, кому мы не подходим. '
            'Конкурентов называем по именам.</p>\n'
            '  <ul class="zvonki">%s</ul>\n'
            '</div></div></section>\n\n' % punkty)
    # Свой стиль списку. Без него ссылки красит браузер своим синим — на тёмно-синем
    # фоне это не читается. Ровно та же грабля, что на видимости 24.09.
    stil = ("\n  .zvonki{list-style:none;padding:0;margin:18px 0 0}"
            "\n  .zvonki li{margin-bottom:11px;max-width:none}"
            "\n  .zvonki a{color:var(--gold);text-decoration:none;border-bottom:1px solid var(--rule)}"
            "\n  .zvonki a:hover{border-bottom-color:var(--gold)}\n")
    s = s.replace("</style>", stil + "</style>", 1)
    return s.replace(yakor, blok + yakor, 1)


def nanesti_vid(s):
    """Кладёт общий вид в самый конец <style>: после собственных правил страницы
    и после переключателя языка, чтобы перебивать их обычными селекторами.
    Разметку не трогает совсем — значит сверка вёрстки EN и RU от этого упасть не может."""
    if "</style>" not in s:
        raise SystemExit("  ! страница без <style> — вид наносить некуда")
    return s.replace("</style>", vid.VID + "</style>", 1)


# ── описание страницы и карточка для ссылок (26.09.2026) ──────────────────────
# До этого у четырёх наших главных страниц не было НИ описания для поисковика,
# НИ карточки для мессенджера: партнёр кидал ссылку, и получатель видел голый
# заголовок без строки и без картинки. У /zvonki/ и старых лендингов описание было.
#
# НИЧЕГО НЕ ВЫДУМЫВАЕМ. Описание — это дословно подзаголовок первого экрана
# (<p class="lede">), то есть текст, который Андрей уже утвердил и который человек
# и так видит первым. Заголовок карточки — <title> страницы. Решение ШТАБа 26.09.
#
# Картинка — кадр из ролика этой же страницы (`img/og.jpg`), без надписей и обещаний.
# У диагностики ролика нет, поэтому там фото основателей: живые лица честнее пустоты.
KARTINKA = {"diagnostic": "foto.webp"}


def opisanie_stranicy(s):
    """Подзаголовок первого экрана как есть: без тегов и лишних пробелов."""
    m = re.search(r'<p class="lede">(.*?)</p>', s, re.S)
    if not m:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip()


def dobavit_kartochku(s):
    """Дописывает в голову описание и карточку. Адрес берём из canonical — он уже
    стоит выше по сборке, и второго источника правды заводить не надо."""
    if "og:description" in s:
        return s
    kan = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    zag = re.search(r"<title>(.*?)</title>", s, re.S)
    opis = opisanie_stranicy(s)
    if not (kan and zag and opis):
        return s          # нечего писать — молча не выдумываем
    adres = kan.group(1)
    nazvanie = re.sub(r"\s+", " ", zag.group(1)).strip()
    chasti = [c for c in adres.split("/") if c and ":" not in c and "." not in c]
    slug = chasti[0] if chasti else ""
    kartinka = "%s/%s/img/%s" % (adres.split("/" + slug)[0], slug,
                                 KARTINKA.get(slug, "og.jpg")) if slug else ""
    ekran = lambda x: x.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
    blok = ('<meta name="description" content="%s">\n'
            '<meta property="og:type" content="website">\n'
            '<meta property="og:title" content="%s">\n'
            '<meta property="og:description" content="%s">\n'
            '<meta property="og:url" content="%s">\n'
            % (ekran(opis), ekran(nazvanie), ekran(opis), ekran(adres)))
    if kartinka:
        blok += ('<meta property="og:image" content="%s">\n'
                 '<meta name="twitter:card" content="summary_large_image">\n' % ekran(kartinka))
    return s.replace('<link rel="canonical"', blok + '<link rel="canonical"', 1)


# Юридические ссылки в подвале КАЖДОЙ страницы продукта, включая «спасибо»,
# «оплачено» и диагностику. Замечание Андрея 26.09: сейчас в подвале ноль ссылок,
# а договор заключается отметкой галочки — человеку надо иметь чем её прочитать.
# Делаем сборкой, а не руками по двадцати двум файлам: руками однажды забудут.
# Подписи те же, что на самих юридических страницах, — иначе человек видит на сайте
# «Оферта», а на странице «Условия» и думает, что это разные документы.
# Ссылка на /sms называется «Сообщения», а не «SMS»: слово SMS в видимом тексте — это
# обещание рассылки, которой у нас нет, и ревизия справедливо на него кричит.
PRAVO = [("/terms", "Условия", "Terms"), ("/privacy", "Конфиденциальность", "Privacy"),
         ("/nda", "NDA", "NDA"), ("/sms", "Сообщения", "Messaging"),
         ("/contacts", "Контакты", "Contacts")]


def podval_pravo(s, ru):
    """Дописывает строку юридических ссылок в конец последнего <footer>."""
    if 'href="/terms"' in s:
        return s
    # inline-block с высотой 44: на телефоне это цели пальца, а не строчки текста.
    ssylki = " · ".join(
        '<a href="%s" style="color:inherit;display:inline-block;min-height:44px;line-height:44px">'
        '%s</a>' % (u, r if ru else e) for u, r, e in PRAVO)
    # Стили ставим прямо в теге: у двадцати двух страниц свои таблицы стилей,
    # и общего класса, который есть у всех, просто нет.
    blok = ('<p style="margin:10px 0 0;font-size:13px;opacity:.72">'
            '%s</p>' % ssylki)
    i = s.rfind("</footer>")
    if i < 0:
        # У листа правды подвала нет вовсе — тогда ставим строку перед концом страницы.
        # Раньше функция здесь молча возвращала страницу как есть, и четыре анкеты,
        # где человек отдаёт свои цены, оставались без ссылки на приватность.
        j = s.rfind("</body>")
        if j < 0:
            return s
        return s[:j] + '<footer>%s</footer>\n' % blok + s[j:]
    # Закрывающие </div> перед </footer> принадлежат обёрткам — встаём внутрь них.
    hvost = s[:i]
    j = hvost.rfind("</p>")
    if j < 0:
        return s[:i] + blok + s[i:]
    return s[:j + 4] + blok + s[j + 4:i] + s[i:]


# ─────────────────────────────────────────────── верхняя строка (замечание Андрея 26.09)
# Знак, название, кнопки перехода, справа CTA. Кнопки ОБЪЁМНЫЕ — видно, что нажимаются.
# Каждая ведёт ровно в тот раздел, как названа: href="#x" и id="x" есть на странице.
# Переключатель языка не дублируем и не выбрасываем: вынимаем тот, что вставил add_switch,
# и кладём внутрь строки — иначе он висит поверх неё и на телефоне накрывает CTA.
ZNAK = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="34" height="34" aria-hidden="true" focusable="false"> <polyline points="50,15 52.82,16.17 55.56,17.33 58.17,18.5 60.58,19.67 62.73,20.83 64.56,22 66.04,23.17 67.12,24.33 67.78,25.5 68,26.67 67.78,27.83 67.12,29 66.04,30.17 64.56,31.33 62.73,32.5 60.58,33.67 58.17,34.83 55.56,36 52.82,37.17 50,38.33 47.18,39.5 44.44,40.67 41.83,41.83 39.42,43 37.27,44.17 35.44,45.33 33.96,46.5 32.88,47.67 32.22,48.83 32,50 32.22,51.17 32.88,52.33 33.96,53.5 35.44,54.67 37.27,55.83 39.42,57 41.83,58.17 44.44,59.33 47.18,60.5 50,61.67 52.82,62.83 55.56,64 58.17,65.17 60.58,66.33 62.73,67.5 64.56,68.67 66.04,69.83 67.12,71 67.78,72.17 68,73.33 67.78,74.5 67.12,75.67 66.04,76.83 64.56,78 62.73,79.17 60.58,80.33 58.17,81.5 55.56,82.67 52.82,83.83 50,85" fill="none" stroke="#f7f5f1" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/> <polyline points="50,15 47.18,16.17 44.44,17.33 41.83,18.5 39.42,19.67 37.27,20.83 35.44,22 33.96,23.17 32.88,24.33 32.22,25.5 32,26.67 32.22,27.83 32.88,29 33.96,30.17 35.44,31.33 37.27,32.5 39.42,33.67 41.83,34.83 44.44,36 47.18,37.17 50,38.33 52.82,39.5 55.56,40.67 58.17,41.83 60.58,43 62.73,44.17 64.56,45.33 66.04,46.5 67.12,47.67 67.78,48.83 68,50 67.78,51.17 67.12,52.33 66.04,53.5 64.56,54.67 62.73,55.83 60.58,57 58.17,58.17 55.56,59.33 52.82,60.5 50,61.67 47.18,62.83 44.44,64 41.83,65.17 39.42,66.33 37.27,67.5 35.44,68.67 33.96,69.83 32.88,71 32.22,72.17 32,73.33 32.22,74.5 32.88,75.67 33.96,76.83 35.44,78 37.27,79.17 39.42,80.33 41.83,81.5 44.44,82.67 47.18,83.83 50,85" fill="none" stroke="#f7f5f1" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/> <line x1="68" y1="26.67" x2="32" y2="26.67" stroke="#e3c88a" stroke-width="5.4" stroke-linecap="round"/> <line x1="32" y1="50" x2="68" y2="50" stroke="#e3c88a" stroke-width="5.4" stroke-linecap="round"/> <line x1="68" y1="73.33" x2="32" y2="73.33" stroke="#e3c88a" stroke-width="5.4" stroke-linecap="round"/> </svg>'''

PEREHODY = {
    ("vera", True):        [("#talk", "Попробовать"), ("#chto", "Что меняется"),
                            ("#cena", "Цена"), ("#voprosy", "Вопросы")],
    ("vera", False):       [("#talk", "Try it"), ("#chto", "What changes"),
                            ("#cena", "Price"), ("#voprosy", "Questions")],
    ("visibility", True):  [("#check", "Проверить"), ("#chto", "Что меняется"),
                            ("#cena", "Цена"), ("#voprosy", "Вопросы")],
    ("visibility", False): [("#check", "Check yours"), ("#chto", "What changes"),
                            ("#cena", "Price"), ("#voprosy", "Questions")],
}
CTA = {True: ("#cena", "Оплатить и начать"), False: ("#cena", "Pay and start")}

VERH_CSS = """
  .verh{position:sticky;top:0;z-index:70;background:rgba(10,14,24,.94);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line)}
  .verh .w{display:flex;align-items:center;gap:16px;min-height:68px;padding-block:9px}
  .verh .znak{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--ink);
    white-space:nowrap;flex:0 0 auto;min-height:44px}
  .verh .znak svg{display:block;flex:0 0 auto}
  .verh .imya{display:flex;flex-direction:column;line-height:1.12}
  .verh .imya b{font-weight:700;font-size:15.5px;letter-spacing:.01em}
  .verh .imya b i{font-style:normal;color:var(--gold)}
  .verh .imya span{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;
    text-transform:uppercase;color:var(--faint);margin-top:3px}
  .verh nav{display:flex;gap:8px;flex:1 1 auto;overflow-x:auto;scrollbar-width:none;
    -webkit-overflow-scrolling:touch}
  .verh nav::-webkit-scrollbar{display:none}
  /* Объём одинаковый у ВСЕХ кнопок строки, включая переключатель языка:
     светлая грань сверху, тень снизу, нажатие уводит вниз. */
  .verh a.k, .verh .lang{display:inline-grid;place-items:center;min-height:44px;padding:0 15px;
    white-space:nowrap;font-size:14px;text-decoration:none;color:var(--ink);
    background:linear-gradient(180deg,#1e2740,#141c30);
    border:1px solid var(--rule);border-radius:10px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 2px 0 rgba(0,0,0,.5);
    transition:transform .06s,box-shadow .06s,border-color .12s,color .12s}
  .verh a.k:hover, .verh .lang:hover{border-color:var(--gold);color:var(--gold)}
  .verh a.k:active, .verh .lang:active{transform:translateY(2px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 0 rgba(0,0,0,0)}
  .verh a.cta{flex:0 0 auto;color:#101624;font-weight:700;
    background:linear-gradient(180deg,#f3e0b0,var(--gold));border-color:#caa961;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 2px 0 #8d7335}
  .verh a.cta:hover{color:#101624;border-color:#8d7335}
  /* Переключатель языка живёт ВНУТРИ строки, а не поверх страницы. */
  .verh .lang{position:static;top:auto;right:auto;flex:0 0 auto;min-width:56px;
    -webkit-backdrop-filter:none;backdrop-filter:none;
    font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.14em}
  @media(max-width:900px){
    .verh .w{flex-wrap:wrap;gap:10px}
    .verh nav{order:3;width:100%;flex:1 0 100%;padding-bottom:2px}
    .verh .znak{flex:1 1 auto}
  }
  @media(max-width:390px){ .verh .imya span{display:none} }
"""


def verhnyaya_stroka(s, ru, slug):
    """Знак, название, переходы и CTA. Ставится в начало страницы, липнет к верху."""
    if 'class="verh"' in s:
        return s
    perehody = PEREHODY.get((slug, ru))
    if not perehody:
        return s
    # Каждая кнопка обязана вести в существующий раздел — иначе ссылка в пустоту.
    net = [h for h, _ in perehody if ('id="%s"' % h[1:]) not in s]
    if net:
        raise SystemExit("  ! %s/%s: нет разделов для переходов: %s" % (slug, "ru" if ru else "en", net))
    m = re.search(r'\n?<a class="lang"[^>]*>.*?</a>\n?', s, re.S)
    lang = m.group(0).strip() if m else ""
    if m:
        s = s[:m.start()] + s[m.end():]
    knopki = "".join('<a class="k" href="%s">%s</a>' % (h, n) for h, n in perehody)
    cta_h, cta_n = CTA[ru]
    podpis = "Очевидный выбор" if ru else "The Obvious Choice"
    verh = ('<header class="verh" id="top"><div class="w">'
            '<a class="znak" href="#top">%s'
            '<span class="imya"><b>Business Intelligence <i>DNA</i></b><span>%s</span></span></a>'
            '<nav>%s</nav>%s'
            '<a class="k cta" href="%s">%s</a>'
            '</div></header>') % (ZNAK, podpis, knopki, lang, cta_h, cta_n)
    s = s.replace("</style>", VERH_CSS + "</style>", 1)
    return s.replace("</style>", "</style>\n" + verh + "\n", 1)


# ─────────────────────────────────────────────── нажимаемость кнопок (Андрей 26.09)
# «При наведении кнопка слегка нажимается: чуть сдвигается вниз, тень уменьшается.
# При нажатии — глубже.» Сдвиг делаем трансформацией, а НЕ отступами: отступ двигал бы
# соседние элементы, и страница дёргалась бы под курсором.
KNOPKI_CSS = """
  .btn,.btn2{transition:transform .08s ease,box-shadow .08s ease,filter .12s ease;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 3px 0 rgba(0,0,0,.42);
    will-change:transform}
  .btn:hover,.btn2:hover{transform:translateY(2px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 1px 0 rgba(0,0,0,.42)}
  .btn:active,.btn2:active{transform:translateY(4px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 0 0 rgba(0,0,0,0)}
  .verh a.k:hover,.verh .lang:hover{transform:translateY(2px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 1px 0 rgba(0,0,0,.5)}
  .verh a.cta:hover{transform:translateY(2px);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 1px 0 #8d7335}
  /* Кому движение мешает — тому его нет, только цвет. */
  @media (prefers-reduced-motion: reduce){
    .btn,.btn2,.verh a.k,.verh .lang,.verh a.cta{transition:none}
    .btn:hover,.btn2:hover,.btn:active,.btn2:active,
    .verh a.k:hover,.verh .lang:hover,.verh a.cta:hover,
    .verh a.k:active,.verh .lang:active{transform:none}
  }
"""


def knopki_nazhimayutsya(s):
    """Одинаковое поведение у всех кнопок страницы, включая те, что в тексте."""
    if "KNOPKI-NAZHIM" in s:
        return s
    return s.replace("</style>", "/* KNOPKI-NAZHIM */" + KNOPKI_CSS + "</style>", 1)


# ------------------------------------------------- код партнёра в кассе (26.09.2026)

# Партнёрская ссылка выглядит как /vera/?p=kod. Код живёт у человека 365 дней
# (cookie И localStorage — одного мало: Safari режет localStorage у третьих сторон,
# а cookie теряется в приватном окне) и уезжает в Stripe полем client_reference_id.
# Ставится ОДНОЙ вставкой на все страницы, а не правкой каждой кнопки: касс пять,
# мест на страницах четырнадцать, и следующая кнопка появится без меня.
#
# Чего этот кусок НЕ умеет и не должен: если человек пришёл по ссылке, но оплатил
# по счёту, выставленному руками, кода в платеже не будет вовсе. Такое ловится уже
# на сервере — привязкой к почте и телефону, а что не поймалось, идёт в блок
# «не опознано» на странице «кому сколько должны».
#
# КОММЕНТАРИИ — ТОЛЬКО ЗДЕСЬ, в Python, а не внутри скрипта: скрипт уезжает на каждую страницу
# как есть, и всё, что в нём написано, читает любой, кто откроет исходник (29.09 так на /vera/ru/
# висела внутренняя арифметика комиссии партнёра). Что делает скрипт:
#  · новая ссылка перебивает старый код: человек пришёл от другого партнёра — он и привёл;
#  · метка товара едет в том же поле client_reference_id как «код_товар», иначе на сервере не отличить,
#    за что заплатили, и пришлось бы держать ещё один ключ Stripe на чтение;
#  · процент считается на сервере от назначенной суммы, а не от суммы чека (касса Веры берёт
#    запуск плюс первый месяц одним чеком) — поэтому метка товара, а не сумма.
REFERAL_JS = """
<script>/* REFERAL */(function(){
  var SROK = 365, IMYA = 'bidna_p';
  function chisto(v){ v = String(v || '').trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-]{1,31}$/.test(v) ? v : ''; }
  function izCookie(){ var m = document.cookie.match(/(?:^|;\\s*)bidna_p=([^;]*)/);
    return m ? chisto(decodeURIComponent(m[1])) : ''; }
  function zapomnit(kod){
    var do_ = new Date(Date.now() + SROK*864e5).toUTCString();
    try { document.cookie = IMYA+'='+encodeURIComponent(kod)+';path=/;max-age='+(SROK*86400)
      +';expires='+do_+';samesite=lax'+(location.protocol==='https:'?';secure':''); } catch(e){}
    try { localStorage.setItem(IMYA, kod); } catch(e){}
  }
  var izSsylki = '';
  try { izSsylki = chisto(new URLSearchParams(location.search).get('p')); } catch(e){}
  var izPamyati = '';
  try { izPamyati = chisto(localStorage.getItem(IMYA)); } catch(e){}
  var kod = izSsylki || izCookie() || izPamyati;
  if (izSsylki) zapomnit(izSsylki);
  if (!kod) return;
  var TOVARY = {
    '28E6oz3V6abMbPLbY7frW03': 'vera1', 'eVqfZ92R23NoaLH1jtfrW07': 'vera1',
    'cNi8wHdvG4RsbPLe6ffrW05': 'vis1',  'bJe00b8bm83E7zv2nxfrW08': 'vis1',
    'cNi3cn63e5Vw6vr3rBfrW06': 'diag',  '3cI4grezKgAa8Dz2nxfrW02': 'audit',
    '00wdR10IU0Bc2fbaU3frW04': 'svyazka'
  };
  function pometit(){
    var a = document.querySelectorAll('a[href*="buy.stripe.com"]');
    for (var i = 0; i < a.length; i++) {
      var h = a[i].getAttribute('href') || '';
      if (h.indexOf('client_reference_id=') !== -1) continue;
      var m = h.match(/buy\\.stripe\\.com\\/([A-Za-z0-9]+)/);
      var tovar = m && TOVARY[m[1]] ? TOVARY[m[1]] : 'inoe';
      a[i].setAttribute('href', h + (h.indexOf('?') === -1 ? '?' : '&')
        + 'client_reference_id=' + encodeURIComponent(kod + '_' + tovar));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pometit);
  else pometit();
})();</script>"""


# ------------------------------- подписка у цены Веры (Андрей, 27.09.2026)

# Текст Андрея дословно. Ставится в двух местах: в строке цены таблицы «Наши цены»
# и под каждой кнопкой оплаты на страницах Веры. Только у Веры: у Видимости квартал
# вперёд, у диагностики разовый платёж — там подписки нет и писать про неё нельзя.
PODPISKA = {
    ("199", True):  "$199 в месяц. Подписка продлевается автоматически. Отменить можно в любой момент.",
    ("199", False): "$199 a month. The subscription renews automatically. Cancel anytime.",
    ("399", True):  "$399 в месяц. Подписка продлевается автоматически. Отменить можно в любой момент.",
    ("399", False): "$399 a month. The subscription renews automatically. Cancel anytime.",
}
PODPISKA_CSS = """
  .podpiska{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--dim);margin:6px 0 0}
  td.p .podpiska{margin:4px 0 0}
  @media(max-width:700px){.podpiska{font-size:15px}}"""


def podpiska_u_ceny(s, ru):
    """Подписка у цены: в таблице цен и под кнопками оплаты. Только страницы Веры."""
    if "/* PODPISKA */" in s:
        return s
    bylo = s

    # 1. В таблице цен — сразу после строки «$199 в месяц» и «$399 в месяц».
    for summa in ("199", "399"):
        hvost = " в месяц" if ru else " a month"
        obrazec = "<b>$%s</b>%s" % (summa, hvost)
        if obrazec in s:
            # Фраза Андрея начинается с самой цены, поэтому её хвост приписывается
            # к уже стоящей строке, а не повторяет «$199 в месяц» второй раз.
            hvost_frazy = PODPISKA[(summa, ru)].split(". ", 1)[1]
            s = s.replace(obrazec, obrazec
                          + '<br><small class="podpiska">%s</small>' % hvost_frazy, 1)

    # 2. Под кнопками оплаты — после абзаца с кнопкой, до подписей.
    #    Кнопки на странице Веры ведут на первый этап, значит цена одна — $199.
    stroka = '<p class="podpiska">%s</p>' % PODPISKA[("199", ru)]
    obrazec = re.compile(r'(<a[^>]+href="https://buy\.stripe\.com/[^"]+"[^>]*>.*?</a>\s*</p>)', re.S)
    s = obrazec.sub(lambda m: m.group(1) + "\n  " + stroka, s)

    if s == bylo:
        return s
    return s.replace("</style>", "/* PODPISKA */" + PODPISKA_CSS + "</style>", 1)


# ------------------------------------- под кнопкой оплаты — звонок (Андрей, 27.09.2026)

# «Остались вопросы? Забронируйте звонок» под каждой кнопкой оплаты — но НЕ прямой ссылкой
# в Calendly. Требование Андрея: «перед бронированием звонка человек обязательно оставлял
# почту, чтобы если он пообщался и ушёл, забыл, мы могли его догнать». Calendly спрашивает
# почту только у дошедших до конца; открыл календарь и бросил — для нас не существует.
# Поэтому сначала своя короткая форма, потом переход в календарь с подставленными данными.
#
# ГДЕ ИМЕННО. Не между кнопкой и её собственной подписью (`p.bsub`), а после всего блока:
# подпись объясняет кнопку, разрывать их — портить обе. Визуально строка всё равно под кнопкой.
ZVONOK_URL = "https://calendly.com/bizzinteldna/1hr"
ZVONOK_CSS = """
  .zvonok-zapis{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--dim);margin:10px 0 0}
  .zvonok-zapis .zz-vopros{margin:0 0 6px}
  /* Цвет НЕ золотой: на светлых секциях золото по белому даёт 1.47:1 — мобильный аудит
     считает такой текст нечитаемым, и он прав. Берём цвет окружающего текста: его контраст
     уже проверен, и он верен и на тёмной секции, и на светлой. Ссылку показывает подчёркивание. */
  .zvonok-zapis .zz-otkryt{background:none;border:0;padding:13px 0;min-height:44px;
    font:inherit;color:inherit;cursor:pointer;text-decoration:underline;
    text-underline-offset:4px;text-decoration-thickness:1px}
  .zvonok-zapis .zz-otkryt:hover{text-decoration-thickness:2px}
  .zvonok-zapis form{display:none;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0}
  .zvonok-zapis.otkryta form{display:flex}
  .zvonok-zapis.otkryta .zz-otkryt{display:none}
  /* 16px у поля обязательны: при меньшем iOS увеличивает всю страницу при касании. */
  .zvonok-zapis input{font:16px/1.3 inherit;min-height:44px;padding:0 12px;box-sizing:border-box;
    border:1px solid var(--rule);border-radius:8px;background:transparent;color:var(--ink);
    min-width:150px;flex:1 1 170px}
  .zvonok-zapis button[type=submit]{min-height:44px;padding:0 16px;border-radius:8px;
    border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer}
  /* Не мельче 15px: мобильный аудит считает такой текст нечитаемым, и правильно. */
  .zvonok-zapis .zz-melko{flex:1 1 100%;margin:0;font-size:15px;line-height:1.45;color:var(--faint)}
  .zvonok-zapis .zz-melko a{color:inherit}
  .zvonok-zapis .zz-beda{flex:1 1 100%;margin:0;color:var(--red)}
  @media(max-width:700px){.zvonok-zapis,.zvonok-zapis .zz-melko{font-size:15px}}"""

ZVONOK_JS = """
<script>/* ZVONOK */(function(){
  var uzly = document.querySelectorAll('.zvonok-zapis');
  for (var i = 0; i < uzly.length; i++) (function(u){
    var otkryt = u.querySelector('.zz-otkryt'), f = u.querySelector('form'),
        beda = u.querySelector('.zz-beda');
    otkryt.addEventListener('click', function(){
      u.className += ' otkryta';
      var e = f.querySelector('input[name=pochta]'); if (e) e.focus();
    });
    f.addEventListener('submit', function(ev){
      ev.preventDefault();
      beda.textContent = '';
      var knopka = f.querySelector('button[type=submit]');
      var byl = knopka.textContent; knopka.disabled = true; knopka.textContent = '…';
      var telo = {pochta: (f.pochta.value || '').trim(), imya: (f.imya.value || '').trim(),
                  otkuda: location.pathname};
      fetch('/.netlify/functions/hochet-zvonok', {method:'POST',
        headers:{'content-type':'application/json'}, body: JSON.stringify(telo)})
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d && d.ok && d.kuda) { location.href = d.kuda; return; }
          knopka.disabled = false; knopka.textContent = byl;
          beda.textContent = (d && d.pochemu) || 'Не получилось. Попробуйте ещё раз.';
        })
        .catch(function(){
          // Наша поломка не должна отнимать у человека календарь.
          location.href = '""" + ZVONOK_URL + """';
        });
    });
  })(uzly[i]);
})();</script>"""


def zvonok_pod_knopkoy(s, ru):
    """После каждой кнопки оплаты — «Остались вопросы?» и форма с почтой перед календарём."""
    if "zvonok-zapis" in s:
        return s
    forma = (
      '<div class="zvonok-zapis">'
      '<p class="zz-vopros">%s <button type="button" class="zz-otkryt">%s</button></p>'
      '<form>'
      '<input name="pochta" type="email" required autocomplete="email" placeholder="%s">'
      '<input name="imya" type="text" autocomplete="name" placeholder="%s">'
      '<button type="submit">%s</button>'
      '<p class="zz-beda"></p>'
      '<p class="zz-melko">%s <a href="/privacy">%s</a>.</p>'
      '</form></div>'
    ) % (
      ("Остались вопросы?" if ru else "Still have questions?"),
      ("Забронируйте звонок" if ru else "Book a call"),
      ("почта" if ru else "email"),
      ("имя, по желанию" if ru else "name, optional"),
      ("Выбрать время" if ru else "Pick a time"),
      ("Почта нужна, чтобы мы могли написать, если звонок не состоится." if ru
       else "We ask for your email so we can follow up if the call does not happen."),
      ("Как мы храним данные" if ru else "How we handle your data"),
    )

    obrazec = re.compile(
        r'(<a[^>]+href="https://buy\.stripe\.com/[^"]+"[^>]*>.*?</a>\s*</p>'
        r'(?:\s*<p class="bsub">.*?</p>)*)', re.S)

    def zamena(m):
        return m.group(1) + "\n  " + forma

    s2, skolko = obrazec.subn(zamena, s)
    if not skolko:
        return s
    s2 = s2.replace("</style>", ZVONOK_CSS + "</style>", 1)
    return s2.rstrip() + "\n" + ZVONOK_JS + "\n"


def kod_partnera(s):
    """Код партнёра из ?p= запоминается и уезжает в кассу. Одинаково на всех страницах."""
    if "/* REFERAL */" in s:
        return s
    return s.rstrip() + "\n" + REFERAL_JS + "\n"


def bez_kommentariev(s):
    """Строчные комментарии // из встроенных скриптов — вон из выкладки (29.09).
    Скрипт уезжает на страницу как есть, и любой, кто откроет исходник, читал наши
    внутренние заметки: арифметику комиссии партнёра, «решение Андрея такого-то числа».
    Объяснения живут здесь, в Python, рядом с кодом, а не на странице.
    Снимаем только то, что заведомо комментарий: строку целиком, начинающуюся с //,
    и хвост после кода, если перед // стоит конец инструкции и пробел. Блочные /* */
    не трогаем: /* REFERAL */ — метка, по которой kod_partnera_vsyudu.py узнаёт вставку."""
    def chistka(m):
        telo = re.sub(r"(?m)^[ \t]*//[^\n]*\n", "", m.group(2))
        telo = re.sub(r"(?m)(?<=[;{}),])[ \t]+//[ \t][^\n]*$", "", telo)
        return m.group(1) + telo + m.group(3)
    return re.sub(r"(<script(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)", chistka, s, flags=re.S)


# Метка вставки — одно слово латиницей заглавными: /* KNOPKI-NAZHIM */, /* PODPISKA */.
# По ним сборка узнаёт, что вставка уже стоит, поэтому их оставляем.
METKA_CSS = re.compile(r"/\*\s*[A-Z][A-Z0-9_-]*\s*\*/")


def bez_css_kommentariev(s):
    """Блочные комментарии /* */ из <style> — вон из выкладки (29.09).
    Там лежали наши рабочие заметки: «ОБЩИЙ ВИД 24.09 — правки Андрея», «(Андрей 26.09)»,
    «Найдено снимком 390px», «Замер 26.09». Любой, кто откроет исходник страницы, их читал.
    Объяснения остаются здесь, в Python, рядом с правилами. Трогаем только <style>:
    в CSS нет регулярных выражений и строк с «/*», в отличие от скриптов."""
    def chistka(m):
        telo = re.sub(r"/\*.*?\*/",
                      lambda k: k.group(0) if METKA_CSS.fullmatch(k.group(0)) else "",
                      m.group(2), flags=re.S)
        return m.group(1) + telo + m.group(3)
    return re.sub(r"(<style\b[^>]*>)(.*?)(</style>)", chistka, s, flags=re.S)


def kak_dokument(s, lang):
    """Полноценный документ. В артефакте скелет даёт оболочка, на Netlify её нет,
    а без <html lang> движок гадает, какой это язык. Мы эту видимость и продаём."""
    s = bez_css_kommentariev(bez_kommentariev(dobavit_kartochku(s)))
    i = s.index("</style>") + len("</style>")
    return ('<!doctype html>\n<html lang="%s">\n<head>\n%s\n</head>\n<body>\n%s\n</body>\n</html>\n'
            % (lang, s[:i].strip(), s[i:].strip()))


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8").write(text)


# --------------------------------------------------------------------- медиа

def sobrat_media(papka, kartinki, kuda):
    from PIL import Image
    src = os.path.join(KORENJ, "media", papka)
    os.makedirs(kuda, exist_ok=True)
    bylo = stalo = 0
    for pref, sub in (("d", "desktop"), ("m", "mobile")):
        for n in kartinki:
            p = os.path.join(src, sub, n + ".png")
            out = os.path.join(kuda, "%s-%s.webp" % (pref, n))
            bylo += os.path.getsize(p)
            Image.open(p).convert("RGB").save(out, "WEBP", quality=KACHESTVO, method=6)
            stalo += os.path.getsize(out)
    foto = os.path.join(src, "foto-andrii-masha.webp")
    Image.open(foto).convert("RGB").save(os.path.join(kuda, "foto.webp"),
                                         "WEBP", quality=KACHESTVO, method=6)
    # Кадр для карточки ссылки. Лежит готовым рядом с роликом: вырезается руками
    # один раз (ffmpeg -ss), чтобы сборка не зависела от наличия ffmpeg на машине.
    og = os.path.join(src, "og.jpg")
    if os.path.exists(og):
        shutil.copy(og, os.path.join(kuda, "og.jpg"))
    rolik = [f for f in os.listdir(src) if f.startswith("rolik-") and f.endswith(".mp4")]
    if len(rolik) != 1:
        raise SystemExit("в %s роликов не один, а %d" % (papka, len(rolik)))
    shutil.copy(os.path.join(src, rolik[0]), os.path.join(kuda, "rolik.mp4"))
    return bylo, stalo


# ---------------------------------------------------------------------- сборка

# ── метка почты для демо Веры (23.09.2026) ─────────────────────────────────────
# Страница «спасибо» обещает прислать расшифровку разговора на почту. Разговор живёт
# на dezhurny-r4p8w2, форма — здесь. Общей памяти у двух сайтов нет, поэтому форма
# кладёт короткий КОД (не почту!) в скрытое поле и в localStorage, сервер связывает
# код с адресом, а «спасибо» добавляет код в ссылку на разговор.
# Почты в ссылке нет намеренно: она осела бы в истории браузера, и любой с этой
# ссылкой слал бы расшифровки на чужой адрес.
METKA_FORMA = """<script>
(function(){
  var f = document.querySelector('form[name^="vera-demo"]'); if(!f) return;
  // Русская форма зовётся vera-demo-ru, английская — vera-demo. По этому суффиксу
  // и выбираем демо: у английской страницы своё, /demo-en/, и на нём английский агент.
  // До 25.09 обе страницы вели на русское демо, и англичанин слышал
  // «Добрый день, меня зовут Вера».
  var VIDZHET = 'https://dezhurny-r4p8w2.netlify.app/'
              + (/-ru$/.test(f.name || '') ? 'demo/' : 'demo-en/');
  f.addEventListener('submit', function(e){
    var t = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2,10);
    var h = f.querySelector('input[name="token"]'); if(h) h.value = t;
    try { localStorage.setItem('bidna_vera_metka', t); } catch(err){}
    // Отправляем форму сами и уводим человека СРАЗУ в разговор: промежуточная страница
    // «Вера на линии» была лишним окном (решение Андрея 23.09).
    // Если fetch недоступен или сервер отказал — НЕ мешаем: форма уходит обычным
    // способом на страницу «спасибо», как раньше. Лучше лишнее окно, чем потерянная заявка.
    if (!window.fetch || !window.FormData || !window.URLSearchParams) return;
    e.preventDefault();
    var knopka = f.querySelector('button[type=\"submit\"]');
    if (knopka) knopka.disabled = true;
    fetch('/', { method: 'POST',
                 headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                 body: new URLSearchParams(new FormData(f)).toString() })
      .then(function(r){ if(!r.ok) throw 0;
                         location.href = VIDZHET + '?t=' + encodeURIComponent(t); })
      .catch(function(){ if (knopka) knopka.disabled = false; f.submit(); });
  });
})();
</script>"""

METKA_SPASIBO = """<script>
(function(){
  var a = document.querySelector('a[href*="/demo"]'); if(!a) return;
  var t = null; try { t = localStorage.getItem('bidna_vera_metka'); } catch(e){}
  if(!t) return;                       // кода нет — ссылка остаётся как была, разговор работает
  a.href = a.href.split('?')[0] + '?t=' + encodeURIComponent(t);
})();
</script>"""


def metka_pochty(html, rol):
    """Вшивает метку в страницу Веры. rol: 'forma' — лендинг, 'spasibo' — страница спасибо."""
    if rol == "forma":
        # Скрытое поле обязано быть в СТАТИКЕ: Netlify Forms разбирает поля на выкладке,
        # поле, добавленное скриптом, до функции не доедет.
        html, n = re.subn(r'(<input type="hidden" name="form-name" value="vera-demo[^"]*">)',
                          r'\1<input type="hidden" name="token" value="">', html, count=1)
        if not n:
            raise SystemExit("  ! vera: не нашёл скрытое поле form-name — метку вшить некуда")
        dop = METKA_FORMA
    else:
        dop = METKA_SPASIBO
    # Исходники — фрагменты без <body>; оболочку добавляет kak_dokument() позже.
    # Дописываем в конец фрагмента — скрипт окажется внутри <body>, где ему и место.
    return html.rstrip() + "\n" + dop + "\n"


def main():
    # По умолчанию собираем ВНЕ проекта: папка синхронится в Google Drive, а выкладка
    # весит 10 МБ и пересобирается одной командой — незачем её туда лить.
    baza = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/bidna-sayty")
    out_dir, pre_dir = os.path.join(baza, "out"), os.path.join(baza, "preview")
    for d in (out_dir, pre_dir):
        if os.path.isdir(d):
            shutil.rmtree(d)

    ok = True
    for slug, papka, kartinki in LANDINGS:
        chitat = lambda k: io.open(os.path.join(ISTOCHNIKI, "%s-%s.html" % (slug, k)),
                                   encoding="utf-8").read()
        en, ru = chitat("en"), chitat("ru")
        thx_en, thx_ru = chitat("thanks-en"), chitat("thanks-ru")
        # «оплачено» — куда Stripe возвращает человека после платежа. Это НЕ «спасибо»:
        # то сделано под бесплатный вход и прямо говорит «карту не списывали».
        pd_en, pd_ru = chitat("paid-en"), chitat("paid-ru")
        if not proverit_paru(slug, en, ru):
            ok = False
            continue

        base = "%s/%s" % (DOMAIN, slug)
        url_en, url_ru = base + "/", base + "/ru/"

        en = re.sub(r'action="/[^"]*"', 'action="/%s/thanks"' % slug, en)
        ru = re.sub(r'action="/[^"]*"', 'action="/%s/ru/thanks"' % slug, ru)
        en = head_inject(en, url_en, url_en, url_ru)
        ru = head_inject(ru, url_ru, url_en, url_ru)

        art_en, art_ru = ARTEFAKTY[slug]
        pre_en = add_switch(en, art_ru, "RU", "Русская версия", "ru")
        pre_ru = add_switch(ru, art_en, "EN", "English version", "en")

        en = add_switch(en, "ru/", "RU", "Русская версия", "ru")
        ru = add_switch(ru, "../", "EN", "English version", "en")
        # русская лежит уровнем глубже, картинки у пары общие
        ru = ru.replace('src="img/', 'src="../img/').replace('srcset="img/', 'srcset="../img/')

        thx_en = head_inject(thx_en, base + "/thanks/", base + "/thanks/", base + "/ru/thanks/")
        thx_ru = head_inject(thx_ru, base + "/ru/thanks/", base + "/thanks/", base + "/ru/thanks/")
        thx_en = add_switch(thx_en, "../ru/thanks/", "RU", "Русская версия", "ru")
        thx_ru = add_switch(thx_ru, "../../thanks/", "EN", "English version", "en")

        pd_en = head_inject(pd_en, base + "/paid/", base + "/paid/", base + "/ru/paid/")
        pd_ru = head_inject(pd_ru, base + "/ru/paid/", base + "/paid/", base + "/ru/paid/")
        pd_en = add_switch(pd_en, "../ru/paid/", "RU", "Русская версия", "ru")
        pd_ru = add_switch(pd_ru, "../../paid/", "EN", "English version", "en")

        en, ru = proverka(en, False), proverka(ru, True)
        pre_en = proverka(pre_en, False, primer=True)
        pre_ru = proverka(pre_ru, True, primer=True)

        seg_en, seg_ru = slug + "-en", slug + "-ru"
        en, ru = mayak(en, seg_en, "view"), mayak(ru, seg_ru, "view")
        if slug == "vera":
            en, ru = metka_pochty(en, "forma"), metka_pochty(ru, "forma")
            thx_en, thx_ru = metka_pochty(thx_en, "spasibo"), metka_pochty(thx_ru, "spasibo")
        thx_en, thx_ru = mayak(thx_en, seg_en, "thanks"), mayak(thx_ru, seg_ru, "thanks")
        pd_en, pd_ru = mayak(pd_en, seg_en, "paid"), mayak(pd_ru, seg_ru, "paid")
        pre_en, pre_ru = mayak(pre_en, seg_en, "view"), mayak(pre_ru, seg_ru, "view")

        # Общий вид — на ВСЕ страницы слага разом, включая «спасибо», «оплачено»
        # и превью: иначе человек уходит со свежей страницы на старую и видит шов.
        if slug == "vera":
            ru = ssylki_na_zvonki(ru)
            pre_ru = ssylki_na_zvonki(pre_ru)

        if slug == "visibility":
            en, ru = stroka_soprovozhdeniya(en, False), stroka_soprovozhdeniya(ru, True)
            pre_en, pre_ru = stroka_soprovozhdeniya(pre_en, False), stroka_soprovozhdeniya(pre_ru, True)

        if slug in vid.PRIMENYAT:
            en, ru = nanesti_vid(en), nanesti_vid(ru)
            thx_en, thx_ru = nanesti_vid(thx_en), nanesti_vid(thx_ru)
            pd_en, pd_ru = nanesti_vid(pd_en), nanesti_vid(pd_ru)
            pre_en, pre_ru = nanesti_vid(pre_en), nanesti_vid(pre_ru)

        # Верхняя строка — только на лендингах-продуктах, где есть разделы для переходов.
        en, ru = verhnyaya_stroka(en, False, slug), verhnyaya_stroka(ru, True, slug)
        pre_en = verhnyaya_stroka(pre_en, False, slug)
        pre_ru = verhnyaya_stroka(pre_ru, True, slug)
        en, ru = podval_pravo(en, False), podval_pravo(ru, True)
        thx_en, thx_ru = podval_pravo(thx_en, False), podval_pravo(thx_ru, True)
        pd_en, pd_ru = podval_pravo(pd_en, False), podval_pravo(pd_ru, True)
        pre_en, pre_ru = podval_pravo(pre_en, False), podval_pravo(pre_ru, True)
        en, ru = knopki_nazhimayutsya(en), knopki_nazhimayutsya(ru)
        thx_en, thx_ru = knopki_nazhimayutsya(thx_en), knopki_nazhimayutsya(thx_ru)
        pd_en, pd_ru = knopki_nazhimayutsya(pd_en), knopki_nazhimayutsya(pd_ru)
        pre_en, pre_ru = knopki_nazhimayutsya(pre_en), knopki_nazhimayutsya(pre_ru)
        en, ru = kod_partnera(en), kod_partnera(ru)
        thx_en, thx_ru = kod_partnera(thx_en), kod_partnera(thx_ru)
        en, ru = zvonok_pod_knopkoy(en, False), zvonok_pod_knopkoy(ru, True)
        thx_en, thx_ru = zvonok_pod_knopkoy(thx_en, False), zvonok_pod_knopkoy(thx_ru, True)
        # Подписка ПОСЛЕ формы: обе встают сразу за абзацем кнопки, и кто позже —
        # тот ближе к ней. Порядок для человека: кнопка → условия подписки → «остались вопросы».
        if slug == "vera":
            en, ru = podpiska_u_ceny(en, False), podpiska_u_ceny(ru, True)
            pd_en, pd_ru = podpiska_u_ceny(pd_en, False), podpiska_u_ceny(pd_ru, True)
            pre_en, pre_ru = podpiska_u_ceny(pre_en, False), podpiska_u_ceny(pre_ru, True)
        pre_en, pre_ru = zvonok_pod_knopkoy(pre_en, False), zvonok_pod_knopkoy(pre_ru, True)
        pd_en, pd_ru = kod_partnera(pd_en), kod_partnera(pd_ru)
        pre_en, pre_ru = kod_partnera(pre_en), kod_partnera(pre_ru)

        for rel, text, lang in [("%s/index.html" % slug,           en,     "en"),
                                ("%s/ru/index.html" % slug,        ru,     "ru"),
                                ("%s/thanks/index.html" % slug,    thx_en, "en"),
                                ("%s/ru/thanks/index.html" % slug, thx_ru, "ru"),
                                ("%s/paid/index.html" % slug,      pd_en,  "en"),
                                ("%s/ru/paid/index.html" % slug,   pd_ru,  "ru")]:
            write(os.path.join(out_dir, rel), kak_dokument(text, lang))
        # Лист правды к приёмке (23.09.2026). Анкета вместо сорокаминутного звонка:
        # решение Андрея. Лежит внутри своего продукта, а не отдельным разделом.
        # Ссылки с лендинга на неё НЕТ — адрес шлём письмом тому, кто уже купил приёмку.
        if slug == "call-audit":
            # Один и тот же лист правды нужен ДВУМ продуктам: приёмке линии и Вере.
            # Вешаем одну анкету по двум адресам и различаем скрытым полем «produkt»:
            # форма у них общая, а письма после отправки разные. Вторая форма означала бы
            # две регистрации в Netlify и две ветки, которые однажды разъедутся.
            # Поле пишем в СТАТИКУ, а не скриптом: Netlify разбирает поля на выкладке.
            for fayl, kuda, produkt in (
                    ("list-pravdy-t4k8m2.html", "call-audit/truth-sheet-t4k8m2/index.html", "call-audit"),
                    ("list-pravdy-ru-t4k8m2.html", "call-audit/ru/truth-sheet-t4k8m2/index.html", "call-audit"),
                    ("list-pravdy-t4k8m2.html", "vera/truth-sheet-t4k8m2/index.html", "vera"),
                    ("list-pravdy-ru-t4k8m2.html", "vera/ru/truth-sheet-t4k8m2/index.html", "vera")):
                lp = os.path.join(ISTOCHNIKI, "..", "dlya-golosa", fayl)
                if not os.path.isfile(lp):
                    raise SystemExit("  ! нет листа правды: %s" % lp)
                lp_t = io.open(lp, encoding="utf-8").read()
            # Запрет индексации. В анкете человек пишет свои цены, чего он НЕ делает
            # и чего говорить нельзя — в выдаче этому не место. В robots.txt такие адреса
            # вписывать нельзя: это опубликовало бы сам адрес, который и держит страницу
            # закрытой. Поэтому метка на странице, а не в общем файле.
                if 'name="robots"' not in lp_t:
                    lp_t = lp_t.replace("<head>", '<head>\n<meta name="robots" content="noindex,nofollow">', 1)
                    if 'name="robots"' not in lp_t:
                        raise SystemExit("  ! %s: не нашёл <head>, запрет индексации не встал" % fayl)
                # Поле нужно в ДВУХ местах: в скрытой форме — чтобы Netlify его
                # зарегистрировал на выкладке, и в сборке отправки — чтобы оно доехало.
                lp_t, n1 = re.subn(r'(<input type="text" name="bot-field" />)',
                                   '<input type="hidden" name="produkt" value="%s" />\\1' % produkt,
                                   lp_t, count=1)
                lp_t, n2 = re.subn(r"(\n(\s*)fd\.append\('bot-field',''\);)",
                                   lambda m: "\n%sfd.append('produkt','%s');%s" % (m.group(2), produkt, m.group(1)),
                                   lp_t, count=1)
                if not (n1 and n2):
                    raise SystemExit("  ! %s: поле produkt не встало (форма %d, отправка %d)" % (fayl, n1, n2))
                # Юридические ссылки нужны и здесь, а особенно здесь: человек
                # отдаёт нам свои цены и правила. Решение ШТАБА 26.09.
                lp_t = podval_pravo(lp_t, fayl.startswith("list-pravdy-ru"))
                lp_t = knopki_nazhimayutsya(lp_t)
                lp_t = kod_partnera(lp_t)
                write(os.path.join(out_dir, kuda), lp_t)

        write(os.path.join(pre_dir, "%s-en/index.html" % slug), pre_en)
        write(os.path.join(pre_dir, "%s-ru/index.html" % slug), pre_ru)
        # «спасибо» кладём в превью плоскими файлами: в артефакте нет вложенных адресов
        for nm, t in (("%s-thanks-en" % slug, thx_en), ("%s-thanks-ru" % slug, thx_ru),
                      ("%s-paid-en" % slug, pd_en),    ("%s-paid-ru" % slug, pd_ru)):
            write(os.path.join(pre_dir, "spasibo", nm + ".html"), t)

        img = os.path.join(out_dir, slug, "img")
        bylo, stalo = sobrat_media(papka, kartinki, img)
        for k in ("en", "ru"):
            shutil.copytree(img, os.path.join(pre_dir, "%s-%s/img" % (slug, k)))
        print("  ок %-11s → /%s/ · /%s/ru/ · картинки %.1f МБ → %d КБ"
              % (slug, slug, slug, bylo / 1e6, stalo / 1024))

    # Простые лендинги: без роликов, без формы, без «спасибо». Только сама страница
    # и «оплачено», куда возвращает Stripe. Диагностика устроена так: кнопка ведёт
    # прямо на оплату, почту собирает сам Stripe, собирать её дважды незачем.
    # Одно медиа всё же есть — фото основателей: решение Андрея 24.09, оно на ВСЕХ
    # лендингах. Берём его из «лендинг 1», файл там один и тот же во всех трёх папках.
    for slug in PROSTYE:
        chitat = lambda k: io.open(os.path.join(ISTOCHNIKI, "%s-%s.html" % (slug, k)),
                                   encoding="utf-8").read()
        en, ru = chitat("en"), chitat("ru")
        pd_en, pd_ru = chitat("paid-en"), chitat("paid-ru")
        if not proverit_paru(slug, en, ru):
            ok = False
            continue

        base = "%s/%s" % (DOMAIN, slug)
        en = head_inject(en, base + "/", base + "/", base + "/ru/")
        ru = head_inject(ru, base + "/ru/", base + "/", base + "/ru/")
        en = add_switch(en, "ru/", "RU", "Русская версия", "ru")
        ru = add_switch(ru, "../", "EN", "English version", "en")
        ru = ru.replace('src="img/', 'src="../img/').replace('srcset="img/', 'srcset="../img/')

        pd_en = head_inject(pd_en, base + "/paid/", base + "/paid/", base + "/ru/paid/")
        pd_ru = head_inject(pd_ru, base + "/ru/paid/", base + "/paid/", base + "/ru/paid/")
        pd_en = add_switch(pd_en, "../ru/paid/", "RU", "Русская версия", "ru")
        pd_ru = add_switch(pd_ru, "../../paid/", "EN", "English version", "en")

        seg_en, seg_ru = slug + "-en", slug + "-ru"
        en, ru = mayak(en, seg_en, "view"), mayak(ru, seg_ru, "view")
        pd_en, pd_ru = mayak(pd_en, seg_en, "paid"), mayak(pd_ru, seg_ru, "paid")
        en, ru = podval_pravo(en, False), podval_pravo(ru, True)
        pd_en, pd_ru = podval_pravo(pd_en, False), podval_pravo(pd_ru, True)
        en, ru = knopki_nazhimayutsya(en), knopki_nazhimayutsya(ru)
        pd_en, pd_ru = knopki_nazhimayutsya(pd_en), knopki_nazhimayutsya(pd_ru)
        en, ru = kod_partnera(en), kod_partnera(ru)
        pd_en, pd_ru = kod_partnera(pd_en), kod_partnera(pd_ru)
        en, ru = zvonok_pod_knopkoy(en, False), zvonok_pod_knopkoy(ru, True)
        if slug == "vera":
            en, ru = podpiska_u_ceny(en, False), podpiska_u_ceny(ru, True)
            pd_en, pd_ru = podpiska_u_ceny(pd_en, False), podpiska_u_ceny(pd_ru, True)

        for rel, text, lang in [("%s/index.html" % slug,         en,    "en"),
                                ("%s/ru/index.html" % slug,      ru,    "ru"),
                                ("%s/paid/index.html" % slug,    pd_en, "en"),
                                ("%s/ru/paid/index.html" % slug, pd_ru, "ru")]:
            write(os.path.join(out_dir, rel), kak_dokument(text, lang))
        write(os.path.join(pre_dir, "%s-en/index.html" % slug), en)
        write(os.path.join(pre_dir, "%s-ru/index.html" % slug), ru)
        for nm, t in (("%s-paid-en" % slug, pd_en), ("%s-paid-ru" % slug, pd_ru)):
            write(os.path.join(pre_dir, "spasibo", nm + ".html"), t)
        from PIL import Image
        img = os.path.join(out_dir, slug, "img")
        os.makedirs(img, exist_ok=True)
        foto = os.path.join(KORENJ, "media", "лендинг 1", "foto-andrii-masha.webp")
        Image.open(foto).convert("RGB").save(os.path.join(img, "foto.webp"),
                                             "WEBP", quality=KACHESTVO, method=6)
        for kto, tekst in (("en", en), ("ru", ru)):
            shutil.copytree(img, os.path.join(pre_dir, "%s-%s/img" % (slug, kto)),
                            dirs_exist_ok=True)
            if "foto.webp" not in tekst:
                raise SystemExit("  ! %s-%s: фото основателей не на странице" % (slug, kto))
        print("  ок %-11s → /%s/ · /%s/ru/ · фото основателей" % (slug, slug, slug))

    # Шесть страниц /zvonki/. Стиль берут У ЛЕНДИНГА ВЕРЫ — тот же файл, тот же <style>.
    # Значит когда новый вид дойдёт до Веры, страницы подхватят его сами, без правки здесь.
    stil_very = re.search(r"<style>(.*?)</style>",
                          io.open(os.path.join(ISTOCHNIKI, "vera-ru.html"), encoding="utf-8").read(),
                          re.S).group(1)
    if "vera" in vid.PRIMENYAT:
        stil_very += vid.VID
    gotovo = zvonki.sobrat(stil_very, out_dir,
                           os.path.join(KORENJ, "Pivot", "agenty", "smotritel", "stranicy"))
    print("  ок zvonki      → %s" % " · ".join(u for u, _t in gotovo))

    print("\n" + ("СОБРАНО: %s" % out_dir if ok else "ЕСТЬ РАСХОЖДЕНИЯ — НЕ ВЫКЛАДЫВАТЬ"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
