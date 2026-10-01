# -*- coding: utf-8 -*-
"""«Зеркало» — бесплатный артефакт на входе в воронку. Заменяет квиз как главный вход.

Человек даёт ссылку на себя. Мы реально открываем его страницу, реально ищем соседей
по нише, реально открываем их — и показываем, какой фразой он себя описывает рядом с их
фразами. Никакого театра: каждая строчка прогресса — это шаг, который правда завершился.

Квиз никуда не делся: он стал запасной веткой для тех, у кого в интернете нет ничего.
Движок — netlify-functions/mirror.js, четыре шага (page → rivals → fetch → verdict).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from funnel import CSS, MARK, FAV, SEG, HERE

SEGJS = {"biznes": "business", "ekspert": "expert"}

TXT = {
 "biznes": dict(
   who="владельца бизнеса",
   h1="Посмотрите на себя глазами вашего клиента",
   lede="Дайте ссылку на то, где вы себя представляете. Мы откроем вашу страницу, найдём тех, "
        "кто стоит рядом с вами в поиске, откроем их — и покажем, какой фразой вы себя описываете "
        "и что теми же словами говорят соседи.",
   ph2="Делаем ремонт квартир под ключ в Москве",
   near="кто стоит рядом с вами",
   nearN="соседей по нише"),
 "ekspert": dict(
   who="эксперта",
   h1="Посмотрите на себя глазами вашего клиента",
   lede="Дайте ссылку на то, где вы себя представляете. Мы откроем вашу страницу, найдём тех, "
        "с кем вас сравнивают, откроем их — и покажем, какой фразой вы себя описываете "
        "и что теми же словами говорят коллеги по полю.",
   ph2="Помогаю фаундерам запускать продукты",
   near="с кем вас сравнивают",
   nearN="коллег по полю"),
}

EXTRA_CSS = """
.f{display:grid;gap:6px;margin:18px 0}
.f label{font-weight:600;font-size:15px}
.f input{width:100%;font-family:var(--sans);font-size:16.5px;color:var(--ink);padding:14px 16px;
 border-radius:12px;border:1.5px solid var(--line);background:var(--paper)}
.f input:focus{outline:0;border-color:var(--gold)}
.f .hint{font-size:14px;color:var(--muted)}
.f.miss input{border-color:#e5484d}
.hp{position:absolute;left:-9999px;opacity:0;height:0}
.alt{text-align:center;margin-top:18px;font-size:15px}
.alt a{color:var(--muted);text-decoration:underline;text-underline-offset:3px}
/* честный прогресс: каждая строка зажигается, когда шаг ПРАВДА завершился */
.prog{list-style:none;padding:0;margin:0}
.prog li{display:flex;gap:13px;padding:13px 0;border-bottom:1px solid rgba(20,24,48,.07);opacity:.35;transition:opacity .3s}
.prog li:last-child{border-bottom:0}
.prog li.on,.prog li.done{opacity:1}
.prog .dot{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--line);margin-top:2px;
 display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff}
.prog li.on .dot{border-color:var(--gold);border-right-color:transparent;animation:sp .8s linear infinite}
.prog li.done .dot{border-color:var(--ok);background:var(--ok)}
.prog li.done .dot::after{content:"✓"}
.prog li.fail .dot{border-color:#e5484d;background:#e5484d}
.prog li.fail .dot::after{content:"!"}
.prog li.fail{opacity:1}
@keyframes sp{to{transform:rotate(360deg)}}
.prog b{display:block;font-weight:600}
.prog .found{font-size:14.5px;color:var(--muted);margin-top:2px}
/* результат */
.quote{font-family:var(--serif);font-size:clamp(20px,3.2vw,26px);line-height:1.35;margin:0;
 padding-left:18px;border-left:3px solid var(--gold)}
.qsrc{font-size:13.5px;color:var(--muted);margin-top:8px;padding-left:21px}
.nb{padding:14px 0;border-bottom:1px solid rgba(20,24,48,.07)}
.nb:last-child{border-bottom:0}
.nb .nm{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
.nb .ln{font-size:16.5px;margin-top:3px}
.echo{background:#fdf6e6;border:1px solid #e8d5a8;border-radius:13px;padding:16px 20px;margin-top:18px}
table.cmp{width:100%;border-collapse:collapse;margin-top:6px;font-size:15px}
table.cmp th,table.cmp td{padding:11px 8px;border-bottom:1px solid rgba(20,24,48,.09);text-align:center}
table.cmp th:first-child,table.cmp td:first-child{text-align:left;width:44%}
table.cmp thead th{font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
table.cmp .me{background:rgba(198,154,76,.09)}
table.cmp .yes{color:var(--ok);font-weight:700}
table.cmp .no{color:#c2c6d0;font-weight:700}
.fix{background:linear-gradient(180deg,#1b2557,#0f1430);color:#fff;border-radius:14px;padding:20px 22px;margin-top:18px}
.fix .k{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft);font-weight:600}
.fix .v{font-size:18px;margin-top:6px}
.cliff{text-align:center;padding:6px 0 2px}
.cliff .c{font-size:18px;max-width:560px;margin:0 auto}
.made{font-size:14.5px;color:var(--muted);text-align:center;margin-top:26px;padding-top:20px;border-top:1px solid var(--line)}
.err{background:#fdecec;border:1px solid #f3c4c4;border-radius:13px;padding:16px 20px;margin:18px 0}
#work,#res,#fail{display:none}
"""

JS = r"""
(function(){
  // Кавычки ДВОЙНЫЕ намеренно: merge_site.py переименовывает файлы внутри разделов,
  // а ищет он строго '"имя.html"'. В одинарных кавычках ссылки бы не переписались.
  var SEG="__SEG__", QUIZ="__QUIZ__", PAY="__PAY__";
  var $=function(id){return document.getElementById(id)};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

  var step=function(n,cls,found){
    var li=$('s'+n); if(!li) return;
    li.className='prog-li '+cls;
    if(found!=null) li.querySelector('.found').innerHTML=found;
  };
  var api=function(body){
    return fetch('/.netlify/functions/mirror',{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(j){
        if(!r.ok) throw new Error(j.error||('http_'+r.status)); return j;})});
  };

  // ─── экран 1 → запуск ───
  $('go').addEventListener('click',function(){
    var link=$('link'), what=$('what');
    var bad=false;
    [link,what].forEach(function(el){
      var empty=!el.value.trim();
      el.parentNode.className='f'+(empty?' miss':''); if(empty) bad=true;
    });
    if(bad) return;
    $('start').style.display='none';
    $('work').style.display='block';
    run(link.value.trim(), what.value.trim(), $('website').value);
  });

  // ─── цепочка из четырёх шагов ───
  // Каждый шаг — отдельный вызов: синхронная функция Netlify живёт 40с,
  // а вся работа занимает ~40–50с и в один вызов не влезает.
  var NICHE='', WHAT='';

  // Кэш готового разбора на неделю. «Зеркало» бесплатное, но каждый прогон стоит нам денег,
  // поэтому повторный запрос по той же ссылке отдаём из памяти браузера — мгновенно и даром.
  var TTL=7*24*3600*1000;
  function ckey(link,what){
    var s=(link+'|'+what).toLowerCase(), h=0;
    for(var i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; }
    return 'bidna_zerkalo_'+(h>>>0).toString(36);
  }
  function cget(link,what){
    try{
      var v=JSON.parse(localStorage.getItem(ckey(link,what))||'null');
      if(v && (Date.now()-v.at)<TTL) return v;
    }catch(e){}
    return null;
  }
  function cput(link,what,data){
    try{ localStorage.setItem(ckey(link,what), JSON.stringify(
      {at:Date.now(), page:data.page, live:data.live, verdict:data.verdict})); }catch(e){}
  }
  function run(link, what, hp){
    var auth=null, page=null, rv=null, live=null;
    WHAT=what;

    var hit=cget(link,what);
    if(hit){                      // уже разбирали эту ссылку — показываем сразу, ничего не тратим
      for(var i=1;i<=4;i++) step(i,'done');
      setTimeout(function(){ render(hit.verdict, hit.page, hit.live||[]); }, 200);
      return;
    }

    step(1,'on');
    api({step:'page', link:link, what:what, segment:SEG, website:hp})
    .then(function(p){
      page=p; auth={token:p.token, ts:p.ts, host:p.host};
      if(p.ok){
        step(1,'done','Открылась: <b style="font-weight:600;color:var(--ink)">'+esc((p.title||p.host).slice(0,90))+'</b>');
      }else{
        // мёртвая ссылка — это не ошибка, это самый сильный вывод
        step(1,'fail','По этой ссылке ничего не открылось. Это тоже результат — разберём ниже.');
      }
      step(2,'on');
      return api({step:'rivals', token:auth.token, ts:auth.ts, host:auth.host,
                  what:what, title:p.title, desc:p.desc, text:p.text});
    })
    .then(function(r){
      rv=r; NICHE=r.niche||'';
      var names=(r.rivals||[]).map(function(x){return esc(x.name)}).join(' · ');
      step(2,'done','<b style="font-weight:600;color:var(--ink)">'+esc(r.niche||'—')+
        (r.geo?', '+esc(r.geo):'')+'</b>'+(names?'<br>'+names:''));
      step(3,'on');
      return api({step:'fetch', token:auth.token, ts:auth.ts, host:auth.host, rivals:r.rivals||[]});
    })
    .then(function(f){
      live=f.rivals||[];
      step(3,'done','Открылось '+live.length+' из '+(f.tried||0)+': '+
        live.map(function(x){return esc(x.name)}).join(' · '));
      step(4,'on');
      return api({step:'verdict', token:auth.token, ts:auth.ts, host:auth.host,
                  segment:SEG, what:what, niche:rv.niche, geo:rv.geo, me:page, rivals:live});
    })
    .then(function(v){
      step(4,'done');
      cput(link, what, {page:page, live:live, verdict:v});
      setTimeout(function(){render(v, page, live)}, 350);
    })
    .catch(function(e){
      var m=(e&&e.message)||'';
      $('work').style.display='none';
      $('fail').style.display='block';
      $('failwhy').textContent =
        m==='quota'  ? 'На сегодня разборов хватит.' :
        m==='no_key' ? 'Разбор временно недоступен.' :
                       'Что-то сломалось на нашей стороне.';
      $('failhint').textContent = m==='quota'
        ? 'Мы открываем страницы и сравниваем вживую, и каждый разбор нам чего-то стоит — поэтому в день их несколько. Возвращайтесь завтра, а пока можно пройти разбор по вопросам: он работает всегда.'
        : 'Попробуйте ещё раз — или пройдите короткий разбор по вопросам, он работает всегда.';
    });
  }

  // ─── экран 3: пять ходов ───
  function render(v, page, live){
    var h='';
    // 1. зеркало
    h+='<div class="card"><div class="eyebrow">Ход 1 · зеркало</div>'+
       '<h2 style="margin:10px 0 16px">Вот как вы себя описываете</h2>'+
       '<p class="quote">'+esc(v.line)+'</p>'+
       '<div class="qsrc">'+(page.ok?'дословно с вашей страницы':'ваша собственная формулировка — страница не открылась')+'</div>';
    if((v.neighbors||[]).length){
      h+='<h2 style="font-size:19px;margin:24px 0 4px">А вот что говорят рядом</h2>';
      v.neighbors.forEach(function(n,i){
        h+='<div class="nb"><div class="nm">'+esc(n.name)+'</div><div class="ln">«'+esc(n.line)+'»</div></div>';
      });
    }
    if(v.echo) h+='<div class="echo">'+esc(v.echo)+'</div>';
    h+='</div>';

    // 2. механизм
    h+='<div class="card"><div class="eyebrow">Ход 2 · почему так выходит</div>'+
       '<p style="margin:12px 0 0;font-size:17.5px">'+esc(v.mechanism)+'</p></div>';

    // 3. таблица четырёх галочек
    if((v.table||[]).length && live.length){
      h+='<div class="card"><div class="eyebrow">Ход 3 · что видит клиент</div>'+
         '<h2 style="margin:10px 0 14px">Четыре вещи, которые он ищет глазами</h2>'+
         '<div style="overflow-x:auto"><table class="cmp"><thead><tr><th></th><th class="me">Вы</th>';
      live.forEach(function(r){ h+='<th>'+esc(shortName(r.name))+'</th>'; });
      h+='</tr></thead><tbody>';
      v.table.forEach(function(row){
        h+='<tr><td>'+esc(row.label)+'</td>'+
           '<td class="me '+(row.you?'yes':'no')+'">'+(row.you?'✓':'—')+'</td>';
        live.forEach(function(_,i){
          var t=(row.them||[])[i];
          h+='<td class="'+(t?'yes':'no')+'">'+(t?'✓':'—')+'</td>';
        });
        h+='</tr>';
      });
      h+='</tbody></table></div></div>';
    }

    // 4. направление + чем чиним
    h+='<div class="card"><div class="eyebrow">Ход 4 · куда это чинится</div>'+
       '<p style="margin:12px 0 0;font-size:17.5px">'+esc(v.direction)+'</p>';
    if(v.howwefix) h+='<div class="fix"><div class="k">Чем чиним</div><div class="v">'+esc(v.howwefix)+'</div></div>';
    h+='</div>';

    // 5. обрыв
    h+='<div class="card cliff"><div class="eyebrow">Дальше</div>'+
       '<p class="c" style="margin:12px auto 0">'+esc(v.cliff)+'</p>'+
       '<a class="btn" href="'+PAY+'">Разобрать глубоко — $500</a>'+
       '<div class="note" style="text-align:center">Ответы на 67 вопросов, ваш рынок, ДНК бизнеса и клиента, '+
       'карта разрывов по приоритету, документ на руки и сессия один на один.</div></div>';

    // мягкий сбор: человек уже получил ценность, теперь предлагаем прислать её и остаться на связи
    h+='<div class="card" id="keep"><div class="eyebrow">Забрать с собой</div>'+
       '<h2 style="margin:10px 0 6px">Прислать это зеркало на почту</h2>'+
       '<p style="margin:0 0 4px;color:var(--muted);font-size:15.5px">Не обязательно. '+
       'Оставьте контакты — пришлём разбор письмом, чтобы он не потерялся вместе с вкладкой.</p>'+
       '<div class="f"><input id="kn" type="text" placeholder="Имя" autocomplete="name"></div>'+
       '<div class="f"><input id="ke" type="email" placeholder="Почта" autocomplete="email"></div>'+
       '<div class="f"><input id="kt" type="text" placeholder="Telegram (если удобнее там)"></div>'+
       '<button class="btn wide" id="ks">Прислать мне зеркало</button>'+
       '<div class="note" id="kmsg"></div></div>';

    // подпись: показываем, а не заявляем
    h+='<div class="made">Этот разбор собрал не человек. Мы открыли вашу страницу'+
       (live.length?(' и '+live.length+' '+plural(live.length,'страницу соседа','страницы соседей','страниц соседей')):'')+
       ', сравнили и написали это, пока вы ждали. Платная диагностика устроена так же — только в разы глубже и по вашим ответам.</div>';

    $('work').style.display='none';
    $('out').innerHTML=h;
    $('res').style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});
    wireKeep(page, v);
  }

  // Контакты уходят в Netlify Forms и заодно ложатся в localStorage:
  // страница оплаты и анкета читают тот же ключ bidna_lead и подставляют их сами.
  function wireKeep(page, v){
    var btn=$('ks'); if(!btn) return;
    btn.addEventListener('click', function(){
      var nm=$('kn').value.trim(), em=$('ke').value.trim(), tg=$('kt').value.trim();
      if(!em && !tg){ $('kmsg').textContent='Оставьте почту или Telegram — иначе прислать некуда.'; return; }
      btn.disabled=true; btn.textContent='Отправляем…';
      var fd=new FormData();
      fd.append('form-name','lead-zerkalo');
      fd.append('client_name',nm); fd.append('client_email',em); fd.append('client_tg',tg);
      fd.append('segment',SEG);
      fd.append('mirror_host', page && page.host ? page.host : '');
      fd.append('mirror_niche', NICHE||'');
      fd.append('mirror_what', WHAT||'');
      try{ localStorage.setItem('bidna_lead', JSON.stringify({name:nm,email:em,tg:tg})); }catch(e){}
      fetch('/',{method:'POST',body:fd}).catch(function(){}).then(function(){
        btn.textContent='Готово';
        $('kmsg').textContent='Записали. Пришлём разбор и больше ничем донимать не будем.';
      });
    });
  }
  // «Петрович (услуги ремонта)» в шапке таблицы не помещается — режем по границе слова
  function shortName(n){
    n=String(n||'').replace(/\s*\([^)]*\)\s*$/,'').trim();
    if(n.length<=16) return n;
    var cut=n.slice(0,16), sp=cut.lastIndexOf(' ');
    return (sp>7?cut.slice(0,sp):cut)+'…';
  }
  function plural(n,a,b,c){var m=n%10,h=n%100;
    return (m===1&&h!==11)?a:((m>=2&&m<=4)&&(h<10||h>=20))?b:c}
})();
"""


def page_shell(title, desc, body, seg, extra_js=""):
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{FAV}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}{EXTRA_CSS}</style>
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
{extra_js}
</body>
</html>
"""


def mirror_page(seg):
    t = TXT[seg]
    quiz = f"quiz-{seg}.html"
    pay = f"oplata-{seg}.html"
    js = JS.replace("__SEG__", SEGJS[seg]).replace("__QUIZ__", quiz).replace("__PAY__", pay)

    steps = [
        ("Открываем вашу страницу", "смотрим, что там видит человек"),
        (f"Ищем, {t['near']}", "определяем нишу и находим прямых соседей"),
        ("Открываем их страницы", "читаем, какими словами они себя описывают"),
        ("Сравниваем", "собираем зеркало"),
    ]
    prog = "\n".join(
        f'  <li class="prog-li" id="s{i+1}"><span class="dot"></span>'
        f'<span><b>{h}</b><span class="found">{p}</span></span></li>'
        for i, (h, p) in enumerate(steps))

    body = f"""
<div id="start">
<div class="head">
  <div class="eyebrow">Бесплатно · около минуты</div>
  <h1 class="t">{t['h1']}</h1>
  <p class="lede">{t['lede']}</p>
</div>

<div class="card">
  <div class="f">
    <label for="link">Где вы себя представляете</label>
    <input id="link" type="text" inputmode="url" autocomplete="url"
           placeholder="сайт, Instagram, Telegram, LinkedIn — что угодно">
    <span class="hint">Если по ссылке ничего не откроется — это тоже результат, и довольно важный.</span>
  </div>
  <div class="f">
    <label for="what">Одной строкой: чем занимаетесь и для кого</label>
    <input id="what" type="text" placeholder="{t['ph2']}">
  </div>
  <input class="hp" id="website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button class="btn wide" id="go">Показать зеркало</button>
  <div class="note">Ничего не регистрируем. Чтобы показать зеркало, почта не нужна —
  смотрим только то, что и так открыто всем.</div>
</div>

<div class="alt"><a href="{quiz}">У меня пока нет ничего в интернете →</a></div>
</div>

<div id="work">
<div class="head">
  <div class="eyebrow">Работаем</div>
  <h1 class="t">Смотрим на вас так, как смотрит клиент</h1>
  <p class="lede">Это не анимация — каждый пункт загорается, когда шаг правда закончен.</p>
</div>
<div class="card"><ul class="prog">
{prog}
</ul></div>
</div>

<div id="res">
<div class="head">
  <div class="eyebrow">Ваше зеркало</div>
  <h1 class="t">Вот что видит человек, который вас сравнивает</h1>
</div>
<div id="out"></div>
</div>

<form name="lead-zerkalo" data-netlify="true" netlify-honeypot="bot-field" hidden>
  <input type="text" name="client_name" /><input type="email" name="client_email" />
  <input type="text" name="client_tg" /><input type="text" name="segment" />
  <input type="text" name="mirror_host" /><input type="text" name="mirror_niche" />
  <input type="text" name="mirror_what" /><input type="text" name="bot-field" />
</form>

<div id="fail">
<div class="head"><h1 class="t">Не сложилось</h1></div>
<div class="err"><b id="failwhy"></b><br><span id="failhint"></span></div>
<a class="btn" href="{quiz}">Пройти разбор по вопросам</a>
</div>
"""
    title = f"Зеркало: как вас видит клиент · Business Intelligence DNA"
    desc = ("Дайте ссылку на себя — мы откроем вашу страницу, найдём соседей по нише и покажем, "
            "какой фразой вы себя описываете рядом с ними. Бесплатно, около минуты.")
    return page_shell(title, desc, body, seg, f"<script>{js}</script>")


def w(name, content):
    open(os.path.join(HERE, name), "w", encoding="utf-8").write(content)
    print("  ✓", name, f"({len(content)//1024} КБ)")


if __name__ == "__main__":
    for seg in ("biznes", "ekspert"):
        w(f"zerkalo-{seg}.html", mirror_page(seg))
