# -*- coding: utf-8 -*-
"""Перестройка воронки под оплату: лендинг/квиз → страница оплаты → Stripe →
страница «спасибо» → анкета (неочевидный адрес). Старый адрес интейка → заглушка.
Обе воронки (бизнес/эксперт) собираются из одного источника, чтобы не разъезжались."""
import os, re, sys, shutil
BRAND = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "brand")
sys.path.insert(0, os.path.join(BRAND, "_src"))
from inline import inline, favicon_uri

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # landings/
MARK = inline("mark/dna-mark-compact-reverse.svg")
FAV  = ('<link rel="icon" href="%s">\n<link rel="icon" href="%s" media="(prefers-color-scheme: dark)">'
        % (favicon_uri("icon/favicon.svg"), favicon_uri("icon/favicon-dark.svg")))

# Неугадываемые адреса анкет — «мягкий гейт»: ссылку выдаёт только страница после оплаты.
ANKETA = {"biznes": "anketa-b-7k3m9x.html", "ekspert": "anketa-e-4q8v2n.html"}

# Stripe Payment Links (выданы Андреем 04.09.2026). У каждого сегмента свой:
# редирект After payment ведёт на свою страницу «спасибо» и свою анкету.
PAY_URL = {
  "biznes":  "https://buy.stripe.com/4gM14f77ifw65rn5zJfrW01",
  "ekspert": "https://buy.stripe.com/3cI4grcrC2Jkg612nxfrW00",
}

SEG = {
 "biznes": dict(
   word="бизнеса", word2="бизнес", who="владельца бизнеса",
   dna="ДНК вашего бизнеса", tg="https://t.me/business_int_dna",
   pain="перестали сравнивать по цене и он стал очевидным выбором"),
 "ekspert": dict(
   word="практики", word2="практику", who="эксперта",
   dna="ДНК вашей практики", tg="https://t.me/business_int_dna",
   pain="вас стало видно — и выбирали вас, а не того, кто громче"),
}

CSS = """
:root{--navy:#1b2557;--navy-deep:#0f1430;--gold:#c69a4c;--gold-2:#b0812f;--gold-soft:#e3c88a;
--cream:#f5f3ee;--paper:#fff;--ink:#1a1a2e;--muted:#5f6472;--line:rgba(20,24,48,.12);--ok:#2f9e57;
--sans:'Inter',-apple-system,Segoe UI,Roboto,sans-serif;--serif:'Playfair Display',Georgia,serif}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--cream);font-size:16.5px;line-height:1.6;-webkit-font-smoothing:antialiased;padding-bottom:70px}
h1,h2{font-family:var(--serif);font-weight:600;line-height:1.2;margin:0}
a{color:var(--gold-2)}
b,strong{font-weight:600}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.bar{background:var(--navy-deep);color:#fff}
.bar .row{max-width:760px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:10px}
.logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:14px}
.logo .mark{height:24px;width:auto;display:block;flex:none}
.logo .g{color:var(--gold-soft)}
.head{padding:44px 0 6px}
.eyebrow{font-weight:600;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-2)}
h1.t{font-size:clamp(27px,4.6vw,40px);margin:12px 0 10px;letter-spacing:-.01em}
.lede{font-size:18px;color:#3b4053;margin:0 0 4px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:24px 26px;margin:22px 0}
.card h2{font-size:21px;margin-bottom:12px}
ul.get{list-style:none;padding:0;margin:0}
ul.get li{position:relative;padding:9px 0 9px 30px;border-bottom:1px solid rgba(20,24,48,.07)}
ul.get li:last-child{border-bottom:0}
ul.get li::before{content:"";position:absolute;left:4px;top:17px;width:9px;height:9px;border-radius:50%;background:var(--gold)}
ol.steps{counter-reset:s;list-style:none;padding:0;margin:0}
ol.steps li{counter-increment:s;position:relative;padding:10px 0 10px 44px;border-bottom:1px solid rgba(20,24,48,.07)}
ol.steps li:last-child{border-bottom:0}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:11px;width:28px;height:28px;border-radius:50%;
 border:1.5px solid var(--gold);color:var(--gold-2);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.pricebox{background:linear-gradient(180deg,#1b2557,#0f1430);color:#fff;border-radius:16px;padding:28px 26px;margin:26px 0;text-align:center}
.pricebox .p{font-family:var(--serif);font-size:46px;font-weight:700;line-height:1;margin:6px 0}
.pricebox .n{font-size:14px;color:#c3c9e6}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;font-weight:600;font-size:17px;
 padding:16px 30px;border-radius:12px;text-decoration:none;background:linear-gradient(180deg,var(--gold-soft),var(--gold));color:#3a2a08;
 border:0;cursor:pointer;margin-top:14px}
.btn:active{transform:translateY(1px)}
.btn.wide{width:100%}
.note{font-size:14.5px;color:var(--muted);margin-top:12px}
.cf{display:grid;gap:10px;margin-top:16px;text-align:left}
.cf input{width:100%;font-family:var(--sans);font-size:16px;color:#fff;padding:13px 15px;border-radius:11px;
 border:1.5px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07)}
.cf input::placeholder{color:#9aa2c4}
.cf input:focus{outline:0;border-color:var(--gold-soft);background:rgba(255,255,255,.11)}
.cf.miss input{border-color:#e5484d}
.promo{background:rgba(227,200,138,.12);border:1px solid var(--gold-soft);border-radius:13px;
 padding:16px 18px;margin-top:16px;text-align:left;font-size:15px;line-height:1.55}
.promo b.code{display:inline-block;font-size:20px;letter-spacing:.08em;color:#fff;
 background:rgba(255,255,255,.12);padding:4px 12px;border-radius:8px;margin:6px 0}
.codrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}
.copybtn{font-family:var(--sans);font-weight:600;font-size:14px;padding:8px 14px;border-radius:9px;
 border:1px solid var(--gold-soft);background:transparent;color:var(--gold-soft);cursor:pointer}
.copybtn:hover{background:rgba(227,200,138,.14)}
.copybtn.done{border-color:#7fe0a6;color:#7fe0a6}
.trust{display:flex;gap:9px;align-items:flex-start;font-size:14.5px;color:#3b4053;margin:9px 0}
.trust span:first-child{flex:none}
.warn{background:#fdf6e6;border:1px solid #e8d5a8;border-radius:13px;padding:16px 20px;font-size:15px;margin:20px 0}
footer{margin-top:34px;padding:22px 0;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
@media(max-width:560px){.card{padding:20px 18px}.pricebox{padding:24px 18px}}
"""

def page(title, body, seg):
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title}</title>
{FAV}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header class="bar"><div class="row">
  <span class="logo">{MARK}<span>Business Intelligence <span class="g">DNA</span></span></span>
</div></header>
<div class="wrap">
{body}
<footer>Работаем под NDA · доступ к вашим счетам, CRM и базе клиентов не нужен ·
<a href="{SEG[seg]['tg']}" target="_blank" rel="noopener">Telegram</a></footer>
</div>
</body>
</html>
"""

# ─────────────────────────── СТРАНИЦА ОПЛАТЫ ───────────────────────────
GET = {
 "biznes": [
  ("🧬","ДНК вашего бизнеса","Ваше отличие — одним предложением, которое работает и на сайте, и в разговоре. Плюс несущая логика: из чего ваш продукт состоит и в каком порядке даёт результат."),
  ("👤","ДНК вашего клиента","Портрет вашего покупателя его же словами: за что он реально платит, чего боится, чем возражает. Этим языком потом пишутся тексты и ведутся продажи."),
  ("🗺️","Карта разрывов","Где именно вы теряете клиентов — по приоритету, а не списком. И какой рычаг трогать первым."),
  ("🔍","Разбор конкурентов","Мы сами смотрим на ваш рынок по открытым источникам, а не верим на слово. Что показывают они, чего не показываете вы, где ваше белое пятно."),
  ("🤖","3 AI-точки роста","Ровно три места, где AI даёт вам деньги или время — привязанные к вашим потерям, а не «внедрите нейросети»."),
  ("📄","Документ на руки","Всё перечисленное — оформленным PDF. Останется у вас, даже если дальше вы с нами не пойдёте."),
  ("🎙️","Стратегическая сессия 45–60 мин","Разбор один на один по готовому документу: что делать первым, в каком порядке и почему."),
 ],
 "ekspert": [
  ("🧬","ДНК вашей практики","Ваше отличие — одним предложением, которое работает и на сайте, и вживую. Плюс несущая логика: из чего складывается ваш результат и в каком порядке."),
  ("👤","ДНК вашего клиента","Портрет вашего клиента его же словами: за что он реально платит, чего боится, чем возражает. Этим языком потом пишутся тексты и ведутся продажи."),
  ("🗺️","Карта разрывов","Где именно вас не видно и где вы теряете клиентов — по приоритету. И какой рычаг трогать первым."),
  ("🔍","Разбор коллег по полю","Мы сами смотрим на ваше поле по открытым источникам, а не верим на слово. Что показывают они, чего не показываете вы, где ваше белое пятно."),
  ("🤖","3 AI-точки роста","Ровно три места, где AI даёт вам поток, цену или время — привязанные к вашей ситуации, а не «внедрите нейросети»."),
  ("📄","Документ на руки","Всё перечисленное — оформленным PDF. Останется у вас, даже если дальше вы с нами не пойдёте."),
  ("🎙️","Стратегическая сессия 45–60 мин","Разбор один на один по готовому документу: что делать первым, в каком порядке и почему."),
 ],
}

STEPS = [
 ("Оплачиваете диагностику","Картой, безопасно через Stripe. Сумма зачтётся в первый платёж, если пойдёте на внедрение."),
 ("Сразу открывается анкета","Один заход, ~40–60 минут. Ответы сохраняются в браузере — можно отложить и вернуться."),
 ("Мы уходим работать — 3 рабочих дня","Изучаем ваш рынок, конкурентов и ваши ответы. Собираем ДНК, карту разрывов и AI-точки."),
 ("Выбираете время сессии","Сразу после анкеты письмо со ссылкой на запись. В календаре открыты только те слоты, к которым разбор будет готов."),
 ("Получаете документ, потом созвон","PDF приходит до встречи — читаете спокойно сами. На сессии разбираем, а не презентуем."),
]

def pay_page(seg):
    g = SEG[seg]
    pay = PAY_URL.get(seg, "")
    items = "\n".join(
      f'  <li><b>{ic} {b}</b><br><span style="color:var(--muted);font-size:15px">{s}</span></li>'
      for ic,b,s in GET[seg])
    steps = "\n".join(f'  <li><b>{h}</b><br><span style="color:var(--muted);font-size:15px">{p}</span></li>'
                      for h,p in STEPS)
    body = f"""<div class="head">
  <div class="eyebrow">Шаг 1 из 2 · оплата</div>
  <h1 class="t">Глубокая диагностика {g['word']}</h1>
  <p class="lede">Разбираем, почему выбирают не вас, и собираем {g['dna']} — чтобы {g['pain']}.</p>
</div>

<div class="card">
  <h2>Что вы получаете</h2>
  <ul class="get">
{items}
  </ul>
</div>

<div class="card">
  <h2>Как это устроено</h2>
  <ol class="steps">
{steps}
  </ol>
</div>

<div class="warn">
  <b>Честно, до оплаты.</b> Мы не называем цифру результата за месяц — её честно не обещает никто.
  Мы отвечаем за другое: вы получите разбор по вашему делу, а не общие слова, и уйдёте с документом
  и понятным первым шагом. Если по вашей ситуации мы не увидим, где вам это выгодно, — скажем прямо,
  а не будем натягивать выводы, чтобы продать следующий шаг.
</div>

<div class="pricebox">
  <div class="n">Глубокая диагностика</div>
  <div class="p">$500</div>
  <div class="n">Зачтётся в первый платёж за внедрение</div>
  <div id="step1">
    <div class="n" style="margin-top:14px">Первым 10 — бесплатно, за отзыв и кейс. Промокод покажем на следующем шаге.</div>
    <div class="n" style="margin-top:18px">Оставьте контакты — на них придёт разбор и ссылка на запись</div>
    <div class="cf" id="cf">
      <input type="text"  id="c_name"  placeholder="Имя" autocomplete="name">
      <input type="email" id="c_email" placeholder="Email" autocomplete="email">
      <input type="text"  id="c_tg"    placeholder="Telegram (@ник), по желанию" autocomplete="off">
    </div>
    <a class="btn wide" id="contBtn" href="#">Продолжить →</a>
  </div>

  <div id="step2" hidden>
    <div class="promo" id="promoBox"></div>
    <!-- PAYMENT_URL — подставить сюда Stripe Payment Link, одно место на воронку -->
    <a class="btn wide" id="payBtn" href="#" rel="noopener">Перейти к оплате →</a>
  </div>

</div>

<div class="trust"><span>🔒</span><span>Работаем под NDA. Доступ к вашим счетам, CRM и базе клиентов нам не нужен и мы его не просим — всё только с ваших слов и из открытых источников.</span></div>
<div class="trust"><span>👤</span><span>Ведут лично Андрей и Маша: предприниматель и экс-CFO. Не отдел, не подрядчик.</span></div>
<div class="trust"><span>💬</span><span>Есть вопрос до оплаты — <a href="{g['tg']}" target="_blank" rel="noopener">напишите в Telegram</a>, ответим лично.</span></div>

<form name="lead-diagnostika" data-netlify="true" netlify-honeypot="bot-field" hidden>
  <input type="text" name="client_name" /><input type="email" name="client_email" />
  <input type="text" name="client_tg" /><input type="text" name="segment" /><input type="text" name="bot-field" />
</form>

<script>
// ЕДИНСТВЕННОЕ место, где живёт ссылка на оплату. Вставить Stripe Payment Link и всё заработает.
var PAYMENT_URL = "{pay}";
var PROMO = "FIRST10";
(function(){{
  var pay=document.getElementById('payBtn'), cont=document.getElementById('contBtn');
  var s1=document.getElementById('step1'), s2=document.getElementById('step2');
  var nm=document.getElementById('c_name'), em=document.getElementById('c_email'), tg=document.getElementById('c_tg');
  if(PAYMENT_URL){{ pay.href=PAYMENT_URL; }}
  else{{
    pay.href="{g['tg']}"; pay.target="_blank"; pay.rel="noopener";
    pay.textContent="Написать нам — выставим счёт →";
  }}
  function ok(){{ return nm.value.trim() && /.+@.+\..+/.test(em.value.trim()); }}
  function promoHtml(left){{
    var tail = (left===null||left===undefined) ? ''
      : ' Осталось мест: <b>'+left+'</b> из 10.';
    return 'Диагностика первым 10 — бесплатно.' + tail
      + '<div class="codrow"><b class="code">'+PROMO+'</b>'
      + '<button class="copybtn" id="copyBtn" type="button">Скопировать</button></div>'
      + 'Вставьте код на странице оплаты — сумма станет $0. Условие одно: после диагностики мы попросим '
      + 'короткий отзыв и разрешение рассказать ваш кейс.';
  }}
  function noPromoHtml(){{
    return 'Бесплатные места первой десятки уже разобраны — сейчас диагностика по обычной цене, $500. '
      + 'Она зачтётся в первый платёж, если пойдёте на внедрение.';
  }}
  function bindCopy(){{
    var c=document.getElementById('copyBtn'); if(!c) return;
    c.addEventListener('click', function(){{
      var done=function(){{ c.textContent='Скопировано ✓'; c.classList.add('done'); }};
      if(navigator.clipboard && navigator.clipboard.writeText){{
        navigator.clipboard.writeText(PROMO).then(done, fallback);
      }} else fallback();
      function fallback(){{
        var t=document.createElement('textarea'); t.value=PROMO;
        t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select();
        try{{ document.execCommand('copy'); done(); }}catch(e){{}}
        document.body.removeChild(t);
      }}
    }});
  }}
  function reveal(){{
    var box=document.getElementById('promoBox');
    if(!PAYMENT_URL){{
      box.innerHTML='Спасибо, записали. Онлайн-оплата подключается — напишите нам, выставим счёт.';
      s1.hidden=true; s2.hidden=false; return;
    }}
    box.innerHTML=promoHtml(); bindCopy();      // показываем сразу, счётчик подтянется следом
    s1.hidden=true; s2.hidden=false;
    fetch('/.netlify/functions/promo-status')
      .then(function(r){{ return r.ok?r.json():null; }})
      .then(function(d){{
        if(!d || d.unknown) return;                       // ключа нет — оставляем как есть
        if(d.valid===false || d.left===0){{ box.innerHTML=noPromoHtml(); return; }}
        box.innerHTML=promoHtml(d.left); bindCopy();
      }})
      .catch(function(){{}});
  }}

  // Контакты уже взяты на «Листе работ» — второй раз не спрашиваем.
  // Заполняем скрытые поля из bidna_lead и сразу показываем промокод и кнопку оплаты.
  try{{
    var L=JSON.parse(localStorage.getItem('bidna_lead')||'null');
    if(L && L.name && /.+@.+\..+/.test(L.email||'')){{
      nm.value=L.name; em.value=L.email; tg.value=L.tg||'';
      reveal();
    }}
  }}catch(e){{}}
  cont.addEventListener('click', function(e){{
    e.preventDefault();
    if(!ok()){{ document.getElementById('cf').classList.add('miss'); (nm.value.trim()?em:nm).focus(); return; }}
    cont.textContent='Секунду…';
    var fd=new FormData();
    fd.append('form-name','lead-diagnostika');
    fd.append('client_name',nm.value.trim());
    fd.append('client_email',em.value.trim());
    fd.append('client_tg',tg.value.trim());
    fd.append('segment','{seg}');
    fd.append('bot-field','');
    try{{ localStorage.setItem('bidna_lead', JSON.stringify(
      {{name:nm.value.trim(), email:em.value.trim(), tg:tg.value.trim()}})); }}catch(e){{}}
    fetch('/',{{method:'POST',body:fd}}).catch(function(){{}}).then(reveal);  // контакт не сохранился — человека всё равно пропускаем
  }});
}})();
</script>
"""
    return page(f"Глубокая диагностика {g['word']} — $500 · Business Intelligence DNA", body, seg)

# ─────────────────────────── СТРАНИЦА ПОСЛЕ ОПЛАТЫ ───────────────────────────
def thanks_page(seg):
    g = SEG[seg]; a = ANKETA[seg]
    body = f"""<div class="head">
  <div class="eyebrow">Шаг 2 из 2 · анкета</div>
  <h1 class="t">Оплата прошла. Теперь — ваши ответы.</h1>
  <p class="lede">Дальше всё зависит от одного захода: чем точнее вы расскажете о {g['word2']},
  тем предметнее будет разбор. Общими словами хорошая диагностика не собирается.</p>
</div>

<div class="card" style="text-align:center">
  <h2 style="margin-bottom:6px">Анкета для сборки {g['dna']}</h2>
  <p style="color:var(--muted);margin:0 0 4px">Один заход, примерно 40–60 минут.
  Ответы сохраняются прямо в браузере — можно закрыть и вернуться, ничего не потеряется.</p>
  <a class="btn" href="{a}">Открыть анкету →</a>
  <div class="note"><b>Сохраните эту страницу в закладки.</b> По ней вы вернётесь к анкете,
  если закроете вкладку. Ссылка личная — она не выложена на сайте.</div>
</div>

<div class="card">
  <h2>Что будет дальше</h2>
  <ol class="steps">
    <li><b>Вы заполняете анкету</b><br><span style="color:var(--muted);font-size:15px">Как закончите — нажмёте кнопку отправки, ответы придут нам.</span></li>
    <li><b>Сразу приходит письмо со ссылкой на запись</b><br><span style="color:var(--muted);font-size:15px">Выбираете время стратегической сессии. В календаре открыты только те слоты, к которым разбор точно будет готов.</span></li>
    <li><b>Мы уходим работать</b><br><span style="color:var(--muted);font-size:15px">Изучаем ваш рынок и конкурентов по открытым источникам, собираем ДНК и карту разрывов.</span></li>
    <li><b>Документ приходит до созвона</b><br><span style="color:var(--muted);font-size:15px">PDF с разбором — читаете спокойно сами. На сессии разбираем его вместе, а не презентуем.</span></li>
  </ol>
</div>

<div class="trust"><span>🔒</span><span>Всё под NDA. Доступ к счетам, CRM и базе клиентов не нужен.</span></div>
<div class="trust"><span>💬</span><span>Что-то пошло не так или анкета не открывается — <a href="{g['tg']}" target="_blank" rel="noopener">напишите в Telegram</a>.</span></div>
"""
    return page(f"Оплата прошла — переходим к анкете · Business Intelligence DNA", body, seg)

# ─────────────────────────── ЗАГЛУШКА НА СТАРОМ АДРЕСЕ ───────────────────────────
def stub_page(seg):
    g = SEG[seg]
    body = f"""<div class="head">
  <div class="eyebrow">Анкета</div>
  <h1 class="t">Анкета открывается после оплаты диагностики</h1>
  <p class="lede">Раньше она лежала по этой ссылке. Мы поменяли порядок: сначала оплата,
  потом анкета — так мы садимся за вашу диагностику сразу, а не собираем ответы «на всякий случай».</p>
</div>

<div class="card" style="text-align:center">
  <h2 style="margin-bottom:6px">Глубокая диагностика {g['word']} — $500</h2>
  <p style="color:var(--muted);margin:0">Зачтётся в первый платёж за внедрение. Первым 10 — бесплатно, по промокоду.</p>
  <a class="btn" href="oplata-{seg}.html">Перейти к оплате →</a>
  <div class="note">Уже оплатили, но потеряли ссылку на анкету?
  <a href="{g['tg']}" target="_blank" rel="noopener">Напишите нам</a> — пришлём заново.</div>
</div>
"""
    return page("Анкета — Business Intelligence DNA", body, seg)

# ─────────────────────────── СБОРКА ───────────────────────────
def w(name, content):
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(content)
    print("  ✓", name)

if __name__ == "__main__":
    for seg in ("biznes", "ekspert"):
        # 1. анкета переезжает на неочевидный адрес (мягкий гейт)
        old, new = f"intake-{seg}.html", ANKETA[seg]
        if os.path.exists(os.path.join(HERE, old)) and not os.path.exists(os.path.join(HERE, new)):
            shutil.copy(os.path.join(HERE, old), os.path.join(HERE, new))
            print("  ✓", new, "(анкета переехала)")
        # 2. новые страницы воронки
        w(f"oplata-{seg}.html",  pay_page(seg))
        w(f"spasibo-{seg}.html", thanks_page(seg))
        # 3. старый адрес — заглушка с объяснением
        w(old, stub_page(seg))
