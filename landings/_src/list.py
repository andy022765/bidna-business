#!/usr/bin/env python3
"""Генератор страницы «Список работ» — новая точка входа в воронку.

Оформление (head, бренд, фавикон, шапка, подвал) берётся из существующей
zerkalo-*.html, чтобы страница не разъехалась с сайтом. Меняется только тело.

Использование:  python3 landings/_src/list.py
Пишет:          landings/list-biznes.html, landings/list-ekspert.html
"""
import re, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
LAND = ROOT / 'landings'

SEG = {
    'biznes': {
        'src':   'zerkalo-biznes.html',
        'title': 'Список работ — Business Intelligence DNA',
        'h1':    'Список работ',
        'sub':   'Кто что делает в вашем деле, когда всё поставлено. И чего мы делать не будем.',
        'desc':  'Три строки о вашем деле — и вы получаете список из одиннадцати работ: '
                 'что делают цифровые сотрудники, что пишем мы, что остаётся вам. '
                 'Бесплатно, без регистрации.',
        'q1':    'Чем занимается компания и где',
        'q1ph':  'что делаете, кто покупает, сколько людей, город',
        'q2':    'Что в вашей неделе повторяется каждый раз одинаково',
        'q2ph':  'что вы или ваши люди делаете снова и снова — отвечаете, записываете, напоминаете, объясняете одно и то же',
        'q3':    'Кто отвечает клиенту первым',
        'who':   ['я лично', 'мой человек', 'как получится'],
        'band2': ('02 · Это пишем мы, говорят ваши люди', 'один раз написано — дальше работает само'),
        'dna':   'ДНК вашего бизнеса',
        'pay':   'oplata-biznes.html',
        'quiz':  'quiz-biznes.html',
        'seg':   'business',
    },
    'ekspert': {
        'src':   'zerkalo-ekspert.html',
        'title': 'Список работ — Business Intelligence DNA',
        'h1':    'Список работ',
        'sub':   'Что в вашей практике будет идти без вас. И что останется только вам.',
        'desc':  'Три строки о вашей практике — и вы получаете список из одиннадцати работ: '
                 'что пойдёт без вас, что пишем мы, что останется только вам. '
                 'Бесплатно, без регистрации.',
        'q1':    'Чем вы занимаетесь и для кого',
        'q1ph':  'что за работа, кто к вам приходит, где вы',
        'q2':    'Что вы делаете снова и снова одинаково',
        'q2ph':  'что отвечаете, объясняете, отправляете или напоминаете каждый раз заново',
        'q3':    'Когда человек пишет первым — кто отвечает',
        'who':   ['я лично', 'помощник', 'как получится'],
        'band2': ('02 · Машина готовит, отправляете вы', 'между вами и человеком никто не встаёт'),
        'dna':   'ДНК вашей практики',
        'pay':   'oplata-ekspert.html',
        'quiz':  'quiz-ekspert.html',
        'seg':   'expert',
    },
}

CSS = """
.lwrap{max-width:860px;margin:0 auto;padding:26px 18px 70px}
.emsg{font-size:13.5px;line-height:1.5;color:#ffb4b6;margin:7px 0 0}
.back{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);
  border-radius:10px;padding:11px 14px;margin:0 0 18px}
.back a{color:var(--gold);text-decoration:underline}
.lhead h1{font:700 clamp(30px,5vw,42px)/1.12 var(--serif);margin:0 0 10px;letter-spacing:-.5px}
.lhead p.s{font-size:18px;color:var(--muted);margin:0 0 6px;max-width:600px}
.axes{font:600 12px/1.6 var(--sans);letter-spacing:.12em;color:var(--gold-2);margin:14px 0 0}
.lform{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:24px 26px;margin:26px 0}
.fl{margin:0 0 18px}
.fl:last-of-type{margin-bottom:8px}
.fl label{display:block;font:600 12px/1.5 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 7px}
.fl label i{font-style:normal;text-transform:none;letter-spacing:0;font-weight:400;font-size:12.5px}
.fl input,.fl textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:13px 15px;
  font:16px/1.5 var(--sans);color:var(--ink);background:#fdfcfa;resize:vertical}
.fl textarea{min-height:96px}
.fl input:focus,.fl textarea:focus{outline:2px solid var(--gold-soft);border-color:var(--gold)}
.chips button{border:1px solid var(--line);background:#fdfcfa;border-radius:22px;padding:9px 16px;
  margin:0 8px 8px 0;font:15px var(--sans);color:var(--ink);cursor:pointer}
.chips button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.go{width:100%;border:0;border-radius:11px;background:var(--navy);color:#fff;padding:16px;
  font:700 17px var(--sans);cursor:pointer;margin-top:6px}
.go:disabled{opacity:.5;cursor:default}
.fine{font-size:13.5px;color:var(--muted);margin:12px 0 0;line-height:1.55}
.prog{display:none;margin:22px 0}
.prog .p{display:flex;gap:11px;align-items:center;padding:8px 0;font-size:15.5px;color:var(--muted)}
.prog .p b{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none;display:inline-block}
.prog .p.on b{background:var(--gold)}
.prog .p.done{color:var(--ink)}.prog .p.done b{background:var(--ok)}
.flow{width:100%;height:auto;display:block;margin:4px 0 2px}
.flowwrap{padding:18px 22px 10px;background:#fff;border-bottom:1px solid var(--line)}
.flowwrap .cap{font-size:13.5px;color:var(--muted);margin:0 0 10px}
@media(max-width:560px){.flowwrap{padding:14px 12px 8px}}
/* ЛИСТ */
#sheet{display:none}
.sh{border:1px solid rgba(20,24,48,.18);border-radius:8px;background:#fbfaf7;overflow:hidden;margin:20px 0}
.sh-h{border-bottom:2px solid var(--navy);padding:18px 22px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sh-h .t{font:700 12px var(--sans);letter-spacing:.2em;text-transform:uppercase}
.sh-h .t span{display:block;font:400 14.5px/1.5 var(--sans);letter-spacing:0;text-transform:none;color:var(--muted);margin-top:7px;max-width:430px}
.sh-h .m{font:12px/1.75 ui-monospace,Menlo,monospace;color:var(--muted);text-align:right;white-space:nowrap}
.sh-h .m b{color:var(--ink)}
.prom{padding:18px 22px;background:#fff;border-bottom:1px solid var(--line)}
.prom p{margin:0 0 9px;font-size:17px;line-height:1.6}.prom p:last-child{margin:0}
.claim{font:700 14.5px/1.5 ui-monospace,Menlo,monospace;padding:12px 15px;background:#f3f0e8;
  border-left:4px solid var(--gold);margin:16px 22px;border-radius:0 6px 6px 0}
.bh{display:flex;justify-content:space-between;gap:10px;padding:12px 22px;background:#f1eee6;
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);flex-wrap:wrap}
.bh .t{font:700 12px var(--sans);letter-spacing:.15em;text-transform:uppercase}
.bh .s{font-size:13.5px;color:var(--muted)}
.bh .n{font:700 12px ui-monospace,monospace}
.b1 .bh{border-left:5px solid #1f6f5c}.b1 .n{color:#1f6f5c}
.b2 .bh{border-left:5px solid #2a4a9c}.b2 .n{color:#2a4a9c}
.b3 .bh{border-left:5px solid #8a5a12}.b3 .n{color:#8a5a12}
.w{padding:16px 22px;border-bottom:1px solid #ece8de;display:flex;gap:15px}
.w:last-child{border-bottom:0}
.w .c{font:12px ui-monospace,monospace;color:#a9a294;width:42px;flex:none;padding-top:4px}
.w .m{flex:1;min-width:0}
.w .nm{font:700 18px/1.3 var(--sans)}
.w .nm i{font-style:normal;color:var(--muted);font-weight:500;font-size:15.5px}
.w .d{margin:6px 0 0;font-size:16px;line-height:1.55}
.w .when{margin:7px 0 0;font-size:15px;color:#3d4356;padding-left:14px;border-left:2px solid var(--gold-soft)}
.w .gv{margin:6px 0 0;font-size:14.5px;color:var(--muted)}
.ax{flex:none;font:700 10px ui-monospace,monospace;letter-spacing:.1em;padding:4px 9px;border-radius:12px;
  border:1px solid;height:fit-content;margin-top:4px;white-space:nowrap}
.ax-P{color:#8a2f28;border-color:#e2c3bf;background:#fdf3f2}
.ax-M{color:#25607f;border-color:#c2dae5;background:#f1f8fb}
.ax-V{color:#5a4098;border-color:#d3c9ec;background:#f6f3fd}
.blk{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin:0 0 18px}
.blk h3{margin:0 0 4px;font:700 20px var(--serif)}
.blk .lead{color:var(--muted);font-size:14.5px;margin:0 0 14px}
.no{padding:12px 0;border-bottom:1px solid var(--line);font-size:16px;line-height:1.55}
.no:last-child{border-bottom:0}
.no b{display:block;margin-bottom:3px}
.no span{color:var(--muted);font-size:15px}
.ord{padding:11px 0;border-bottom:1px solid var(--line);display:flex;gap:14px;font-size:16px}
.ord:last-of-type{border-bottom:0}
.ord .n{font:700 13px ui-monospace,monospace;color:var(--gold-2);flex:none;padding-top:3px}
.ord .w2 b{display:block}
.ord .w2 span{color:var(--muted);font-size:15px}
/* контакты и обрыв */
.cta{background:var(--navy);color:#fff;border-radius:16px;padding:26px 28px;margin:22px 0 0}
.cta h3{margin:0 0 8px;font:700 22px var(--serif);color:#fff}
.cta p{color:#ced3e3;font-size:16px;margin:0 0 12px}
.cta ol{padding-left:20px;margin:12px 0}
.cta ol li{margin:6px 0;color:#e6e9f2;font-size:16px}
.cta .st{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.13)}
.cta .st:last-of-type{border-bottom:0}
.cta .st .p{flex:none;width:110px;font:700 12px ui-monospace,monospace;letter-spacing:.09em;color:var(--gold-soft);padding-top:3px}
.cta .st .d{font-size:15.5px;line-height:1.55;color:#dfe3ef}
.cta .st .d b{color:#fff}
.cbox{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:18px 20px;margin:16px 0 0}
.cbox input{width:100%;border:1px solid rgba(255,255,255,.22);border-radius:9px;padding:12px 14px;
  font:16px var(--sans);background:rgba(255,255,255,.94);color:var(--ink);margin:0 0 10px}
.cbox button{width:100%;border:0;border-radius:10px;background:var(--gold);color:#20263f;padding:15px;
  font:700 16.5px var(--sans);cursor:pointer}
.cbox button:disabled{opacity:.75;cursor:default}
.cbox .cl{display:block;font:600 12px/1.5 var(--sans);letter-spacing:.09em;text-transform:uppercase;
  color:#aeb5c9;margin:0 0 6px}
.cbox .cl i{font-style:normal;text-transform:none;letter-spacing:0;font-weight:400;font-size:12.5px}
.cbox .cmsg{font-size:13.5px;line-height:1.5;margin:0 0 12px;min-height:1px}
.paysep{border-top:1px solid rgba(255,255,255,.16);margin:24px 0 0;padding:20px 0 0}
.paysep .ph{color:#fff;font-weight:700;font-size:16.5px;margin:0 0 4px}
.paysep .pd{color:#ced3e3;font-size:15px;margin:0 0 4px}
.paybtn{display:block;text-align:center;background:var(--gold);color:#20263f;border-radius:11px;
  padding:16px;font:700 17px var(--sans);text-decoration:none;margin:16px 0 0}
.next{border-top:1px solid rgba(255,255,255,.16);margin:22px 0 0;padding:20px 0 0}
.next .nh{color:#fff;font-weight:700;font-size:16.5px;margin:0 0 14px}
.nrow{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.1)}
.nrow:last-of-type{border-bottom:0}
.nrow b{display:block;color:var(--gold-soft);font-size:16.5px}
.nrow span{color:#c2c8da;font-size:14.5px}
.next .nf{color:#fff;font-weight:700;font-size:16.5px;margin:14px 0 0}
.sig{color:#8f96ab;font-size:13px;font-style:italic;margin-top:14px}
.err{background:#fdf3f2;border:1px solid #e2c3bf;border-radius:12px;padding:18px 20px;margin:18px 0;display:none}
.err a{color:var(--gold-2)}
@media(max-width:640px){.w{padding:14px 16px}.sh-h{padding:15px 16px}.claim{margin:14px 16px}}

/* ── МОБИЛЬНЫЕ ПРАВКИ (аудит 07.09.2026) ─────────────────────────────────────────── */
@media(max-width:640px){
  .chips button{padding:12px 18px}      /* было 39px высотой, минимум 44 */
  .fine{font-size:15px}                 /* было 13.5px — это читаемый текст, не метка */
  footer a{display:inline-block;padding:14px 0}
}
"""


def chips(seg):
    return ''.join(f'<button type="button" data-v="{w}">{w}</button>' for w in seg['who'])


def body(seg):
    return f"""
<div class="lwrap">

<div class="lhead" id="top">
  <h1>{seg['h1']}</h1>
  <p class="s">{seg['sub']}</p>
  <p class="s" style="font-size:16px">Одиннадцать работ. У каждой написано, кто её делает, когда всё поставлено:
     цифровой сотрудник, ваш человек по написанному нами или вы сами.</p>
  <p class="axes">ПРОДАЖИ · МАРКЕТИНГ · ВИДИМОСТЬ В НЕЙРОСЕТЯХ И НА КАРТАХ</p>
</div>

<form class="lform" id="f" autocomplete="off">
  <p class="fine" style="margin:0 0 20px">Три строки. Бесплатно, без карты и без регистрации.
     Ни одного вопроса о том, что у вас не получается.</p>
  <div class="fl">
    <label for="q1">{seg['q1']}</label>
    <input id="q1" type="text" placeholder="{seg['q1ph']}" maxlength="300">
  </div>
  <div class="fl">
    <label for="q2">{seg['q2']}</label>
    <textarea id="q2" placeholder="{seg['q2ph']}" maxlength="800"></textarea>
  </div>
  <div class="fl">
    <label>{seg['q3']}</label>
    <div class="chips" id="who">{chips(seg)}</div>
  </div>
  <div class="fl">
    <label for="q4">Ссылка на вас <i>— если есть, необязательно</i></label>
    <input id="q4" type="text" placeholder="сайт, профиль или канал" maxlength="250">
  </div>
  <input type="text" id="website" tabindex="-1" style="position:absolute;left:-9999px" aria-hidden="true">
  <button class="go" id="go" type="submit">Собрать мой список</button>
  <p class="fine">Доступ к вашим счетам, CRM и базе клиентов нам не нужен — ни здесь, ни дальше.</p>
</form>

<!-- Статическая форма для детекта Netlify. Поля должны быть объявлены здесь,
     иначе часть значений отбрасывается при приёме сабмита. -->
<form name="lead-list" data-netlify="true" netlify-honeypot="bot-field" hidden>
  <input type="text" name="client_name" />
  <input type="email" name="client_email" />
  <input type="text" name="client_tg" />
  <input type="text" name="segment" />
  <textarea name="list_text"></textarea>
  <input type="text" name="bot-field" />
</form>

<div class="prog" id="prog">
  <div class="p" data-s="1"><b></b><span>Читаем, что вы написали</span></div>
  <div class="p" data-s="2"><b></b><span>Смотрим вашу страницу</span></div>
  <div class="p" data-s="3"><b></b><span>Собираем цифровых сотрудников</span></div>
  <div class="p" data-s="4"><b></b><span>Дописываем остальное</span></div>
  <p class="fine">Строки появляются по мере того, как пишутся. Обычно минуту-две, иногда дольше.</p>
</div>

<div class="err" id="err"></div>

<div id="sheet"></div>

</div>
"""


JS = r"""
(function(){
var $=function(s){return document.querySelector(s)};
var PAY=__PAY__, QUIZ=__QUIZ__, B2T=__B2T__, B2S=__B2S__, DNA=__DNA__;
var S={who:'',ts:0,tok:'',h:'',link:null,page:null,b1:null,rest:null,extra:null};
var CACHE='bidna_list_v1';

// Замер воронки. Молчаливый: любая ошибка здесь не должна трогать страницу.
function ev(name){try{
  var d=JSON.stringify({e:name,seg:SEG}), u='/.netlify/functions/ev';
  if(navigator.sendBeacon){navigator.sendBeacon(u,new Blob([d],{type:'application/json'}));}
  else{fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:d,keepalive:true})
        .catch(function(){});}
}catch(x){}}
ev('list_open');

// список, собранный раньше, показываем сразу: иначе дневная квота съедает возврат
try{var _c=JSON.parse(localStorage.getItem(CACHE)||'null');
  if(_c&&Date.now()-_c.t<6048e5&&_c.b1){S.b1=_c.b1;S.rest=_c.rest;S.extra=_c.extra||null;S.old=_c.t;}
}catch(e){}

$('#who').addEventListener('click',function(e){
  var b=e.target.closest('button'); if(!b) return;
  [].forEach.call(this.querySelectorAll('button'),function(x){x.classList.remove('on')});
  b.classList.add('on'); S.who=b.dataset.v;
});

function mark(n,st){var p=$('.prog .p[data-s="'+n+'"]'); if(!p)return;
  p.classList.remove('on','done'); if(st)p.classList.add(st);}
function fail(msg){
  $('#prog').style.display='none';
  var e=$('#err'); e.style.display='block';
  e.innerHTML='<b>Не сложилось.</b> '+msg+'<br><br>Можно <a href="#top" onclick="location.reload()">попробовать ещё раз</a>'+
    ' или ответить на девять вопросов — <a href="'+QUIZ+'">так тоже соберём</a>.';
  window.scrollTo({top:e.offsetTop-80,behavior:'smooth'});
}
function post(step,extra){
  var b=Object.assign({step:step,ts:S.ts,tok:S.tok,h:S.h,website:$('#website').value,
    what:$('#q1').value,loop:$('#q2').value,who:S.who,link:$('#q4').value,page:S.page,seg:SEG},extra||{});
  return fetch('/.netlify/functions/list',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})
    .then(function(r){return r.json().then(function(j){ if(!r.ok){j.__code=r.status;} return j;})});
}
var FLOW='<svg class="flow" viewBox="0 0 700 636" role="img" aria-label="Путь клиента и кто его ведёт">\n<defs>\n<marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">\n  <path d="M0,0 L10,5 L0,10 z" fill="#b9b3a4"/></marker>\n<marker id="arg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">\n  <path d="M0,0 L10,5 L0,10 z" fill="#8fb3a9"/></marker>\n</defs>\n<style>\n.y{fill:#fdf6ea;stroke:#c69a4c;stroke-width:1.8}\n.m{fill:#eef6f3;stroke:#1f6f5c;stroke-width:1.8}\n.n{fill:#f6f4ef;stroke:#ded8cc;stroke-width:1.5}\n.t{font:600 15px -apple-system,\'Inter\',sans-serif;fill:#161c33}\n.tm{font:700 14px -apple-system,\'Inter\',sans-serif;fill:#1f6f5c;letter-spacing:.04em}\n.ty{font:700 14px -apple-system,\'Inter\',sans-serif;fill:#8a5a12;letter-spacing:.04em}\n.s{font:12.5px -apple-system,\'Inter\',sans-serif;fill:#6f7585}\n.l{font:11.5px -apple-system,\'Inter\',sans-serif;fill:#9a9486}\nline,path.a{stroke:#ded8cc;stroke-width:1.6;fill:none}\npath.g{stroke:#c9ded7;stroke-width:1.6;fill:none;stroke-dasharray:5 4}\n</style>\n\n<rect class="m" x="8"   y="12" width="322" height="62" rx="10"/>\n<text class="tm" x="26"  y="36">РАССКАЗЧИК</text>\n<text class="s"  x="26"  y="58">пишет, что говорить — до вопроса о цене</text>\n\n<rect class="m" x="358" y="12" width="322" height="62" rx="10"/>\n<text class="tm" x="376" y="36">СМОТРИТЕЛЬ</text>\n<text class="s"  x="376" y="58">вас называют, когда о вас спрашивают</text>\n\n<path class="a" d="M169,74 L169,92 Q169,104 181,104 L312,104" marker-end="url(#ar)"/>\n<path class="a" d="M519,74 L519,92 Q519,104 507,104 L376,104" marker-end="url(#ar)"/>\n\n<rect class="n" x="224" y="116" width="240" height="44" rx="10"/>\n<text class="t" x="344" y="144" text-anchor="middle">человек пишет вам</text>\n<line x1="344" y1="160" x2="344" y2="184" marker-end="url(#ar)"/>\n\n<rect class="m" x="154" y="190" width="380" height="64" rx="10"/>\n<text class="tm" x="174" y="214">ДЕЖУРНЫЙ</text>\n<text class="s"  x="174" y="236">отвечает за минуту, в любое время, и записывает</text>\n<line x1="344" y1="254" x2="344" y2="284" marker-end="url(#ar)"/>\n<text class="l" x="356" y="274">замолчал?</text>\n\n<rect class="m" x="154" y="290" width="380" height="64" rx="10"/>\n<text class="tm" x="174" y="314">ДОВОДЧИК</text>\n<text class="s"  x="174" y="336">возвращается к тем, кто спросил и пропал</text>\n<line x1="344" y1="354" x2="344" y2="384" marker-end="url(#ar)"/>\n\n<rect class="y" x="154" y="390" width="380" height="64" rx="10"/>\n<text class="ty" x="174" y="414">ВАША РАБОТА</text>\n<text class="s"  x="174" y="436">то, ради чего к вам и шли. Остаётся вам</text>\n<line x1="344" y1="454" x2="344" y2="484" marker-end="url(#ar)"/>\n\n<rect class="m" x="154" y="490" width="380" height="64" rx="10"/>\n<text class="tm" x="174" y="514">СБОРЩИК</text>\n<text class="s"  x="174" y="536">просит отзыв и складывает доказательства</text>\n\n<path class="g" d="M534,522 L616,522 Q640,522 640,498 L640,110 Q640,86 616,86 L560,86 L560,78" marker-end="url(#arg)"/>\n<text class="l" x="652" y="300" text-anchor="middle" transform="rotate(90 652 300)">отзывы возвращаются в тексты</text>\n\n<rect class="m" x="8"   y="596" width="15" height="15" rx="4"/>\n<text class="s" x="31"  y="608">делает машина</text>\n<rect class="y" x="160" y="596" width="15" height="15" rx="4"/>\n<text class="s" x="183" y="608">остаётся вам</text>\n</svg>';
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var AX={'ПРОДАЖИ':'P','МАРКЕТИНГ':'M','ВИДИМОСТЬ':'V'};

function work(w,showWhen){
  var a=AX[w.axis]||'';
  return '<div class="w"><div class="c">'+esc(w.code)+'</div><div class="m">'+
    '<div class="nm">'+esc(w.name)+(w.role?' <i>· '+esc(w.role)+'</i>':'')+'</div>'+
    '<p class="d">'+esc(w.does)+'</p>'+
    (showWhen&&w.when?'<p class="when">Включается: '+esc(String(w.when).replace(/^\s*[Вв]ключается[:,]?\s*/,''))+'</p>':'')+
    (w.gives?'<p class="gv">отдаёт: '+esc(w.gives)+'</p>':'')+
    '</div>'+(a?'<span class="ax ax-'+a+'">'+esc(w.axis)+'</span>':'')+'</div>';
}

function render(){
  var b1=S.b1, r=S.rest||{}, x=S.extra||{};
  var n=(b1.band1||[]).length+((r.band2||[]).length)+((r.band3||[]).length);
  var free=(b1.band1||[]).length+((r.band2||[]).length);
  var h='<div class="sh"><div class="sh-h"><div class="t">'+TITLE+'<span>'+esc(b1.who)+'</span></div>'+
    '<div class="m">ЛИСТ 1 ИЗ 1<br>РАБОТ <b>'+n+'</b><br>» ЛИСТ СОБРАН</div></div>'+
    '<div class="prom"><p>'+esc(b1.promise)+'</p>'+
    '<p style="font-size:16px;color:#4a5163">Из '+n+' работ <b>'+free+' идут без вашего участия</b>.</p></div>'+
    '<div class="claim">МАШИНЕ ОТДАЁТСЯ НЕ РЕШЕНИЕ. МАШИНЕ ОТДАЁТСЯ ПОВТОРЕНИЕ.</div>'+
    '<div class="flowwrap"><p class="cap">Путь вашего клиента и кто его ведёт</p>'+FLOW+'</div>';

  h+='<div class="b1"><div class="bh"><span class="t">01 · Это делают цифровые сотрудники</span>'+
     '<span class="s">ставим мы, работают без человека</span><span class="n">'+(b1.band1||[]).length+' РАБОТЫ</span></div>'+
     (b1.band1||[]).map(function(w){return work(w,true)}).join('')+'</div>';

  if(r.band2) h+='<div class="b2"><div class="bh"><span class="t">02 · Это пишем мы, говорят ваши люди</span>'+
     '<span class="s">один раз написано — дальше работает само</span><span class="n">'+r.band2.length+' РАБОТЫ</span></div>'+
     r.band2.map(function(w){return work(w,false)}).join('')+'</div>';

  if(r.band3) h+='<div class="b3"><div class="bh"><span class="t">03 · Остаётся вам</span>'+
     '<span class="s">не отдаётся ни машине, ни нам</span><span class="n">'+r.band3.length+' РЕШЕНИЯ</span></div>'+
     r.band3.map(function(w){return work(w,false)}).join('')+'</div>';
  h+='</div>';

  if(x.order) h+='<div class="blk"><h3>Что первым</h3><p class="lead">Здесь порядок сборки: что на чём стоит.</p>'+
     x.order.map(function(o){return '<div class="ord"><span class="n">'+esc(o.n)+'</span><span class="w2"><b>'+
       esc(o.name)+'</b><span>'+esc(o.why)+'</span></span></div>'}).join('')+
     '<p class="lead" style="margin:14px 0 0">'+esc(x.order_note||'')+'</p></div>';

  if(x.no) h+='<div class="blk"><h3>Этого мы делать не будем</h3><p class="lead">Настоящая работа. Просто не наша.</p>'+
     x.no.map(function(n){return '<div class="no"><b>'+esc(n.what)+'</b><span>→ '+esc(n.who)+'</span></div>'}).join('')+'</div>';

  h+='<div class="cta"><h3>Чтобы это поставить, нужно знать ваши цифры</h3>'+
    '<p>Список показывает состав и порядок сборки. Какие из работ ваши и какая стоит вам '+
    'дороже всех — из трёх строк не выводится.</p>'+
    '<p style="color:#fff;font-weight:700;margin:20px 0 4px">Глубокая диагностика — $500, три рабочих дня. '+
    'Первым 10 — бесплатно, в обмен на отзыв. Что делаем:</p>'+
    '<ol><li>Разбираем ваш рынок и конкурентов по открытым источникам — сами, а не с ваших слов.</li>'+
    '<li>Собираем '+DNA+' и ДНК вашего клиента — его же словами.</li>'+
    '<li>Строим карту разрывов: где именно теряете и с чего начинать.</li>'+
    '<li>Показываем, где в ваших продажах, маркетинге и видимости можно поставить цифровых '+
    'сотрудников — и какого первым по вашим деньгам.</li>'+
    '<li>Отдаём документ и разбираем один на один 45–60 минут.</li></ol>'+
    '<p>Часть работ из списка вычеркнем — окажется, что они не про вас. Это тоже результат.</p>'+
    '<form class="cbox" id="cform" novalidate><p style="margin:0 0 14px;color:#fff;font-weight:700">Куда прислать список</p>'+
      '<label class="cl" for="cn">Имя</label>'+
      '<input id="cn" type="text" placeholder="как к вам обращаться" autocomplete="name">'+
      '<label class="cl" for="ce">Email</label>'+
      '<input id="ce" type="email" placeholder="name@example.com" autocomplete="email" inputmode="email">'+
      '<label class="cl" for="ct">Telegram или телефон <i>— по желанию</i></label>'+
      '<input id="ct" type="text" placeholder="@nick или +1 …" autocomplete="tel">'+
      '<p class="cmsg" id="cmsg" role="status" aria-live="polite"></p>'+
      '<button id="csend" type="submit">Прислать список на почту</button>'+
      '<p class="sig" style="margin-top:10px">Список ваш, даже если дальше вы с нами не пойдёте. '+
        'Контакты — только чтобы было куда его прислать.</p>'+
    '</form>'+
    '<div class="paysep"><p class="ph">Готовы идти дальше?</p>'+
      '<p class="pd">Глубокая диагностика — $500, три рабочих дня. Первым 10 — бесплатно, в обмен на отзыв.</p>'+
      '<a class="paybtn" id="cpay" href="'+PAY+'">Перейти к глубокой диагностике →</a>'+
      '<p class="sig" style="text-align:center;margin-top:8px">Документ на руки и разбор один на один.</p>'+
    '</div>'+
    '<div class="next"><p class="nh">Если по результатам диагностики решите идти дальше — внедрение. Стоимость рассчитывается исходя из тех сервисов и продуктов, которые вы выбрали; диагностика засчитывается при внедрении на сумму от $2 000. Вы получаете:</p>'+
      '<div class="nrow"><b>Продающий оффер</b><span>на вашей базе, а не по шаблону</span></div>'+
      '<div class="nrow"><b>Высококонверсионный сайт</b><span>страница, на которую не стыдно вести людей</span></div>'+
      '<div class="nrow"><b>Внедрённых цифровых сотрудников</b><span>в те точки, которые нашла диагностика</span></div>'+
      '<p class="nf">Работающих, а не описанных.</p></div>'+
    '<div class="sig">Этот список собрал не человек. Мы прочитали то, что вы написали, и написали это, пока вы ждали.</div></div>';

  $('#sheet').innerHTML=h; $('#sheet').style.display='block'; $('#prog').style.display='none';
  $('#cform').addEventListener('submit',function(e){e.preventDefault();sendLead();});
  $('#cpay').addEventListener('click',function(){ev('pay_click');});
  if(!S.old) ev('list_done');
  if(!S.old){try{localStorage.setItem(CACHE,JSON.stringify(
    {t:Date.now(),b1:S.b1,rest:S.rest,extra:S.extra}))}catch(e){}}
}

function asText(){
  var b1=S.b1||{}, r=S.rest||{}, x=S.extra||{}, L=[];
  L.push('СПИСОК РАБОТ'); L.push(b1.who||''); L.push('');
  L.push(b1.promise||''); L.push('');
  L.push('МАШИНЕ ОТДАЁТСЯ НЕ РЕШЕНИЕ. МАШИНЕ ОТДАЁТСЯ ПОВТОРЕНИЕ.'); L.push('');
  function band(t,arr,when){ if(!arr||!arr.length)return;
    L.push('── '+t+' ──');
    arr.forEach(function(w){
      L.push(w.code+'  '+w.name+(w.role?' · '+w.role:'')+(w.axis?'   ['+w.axis+']':''));
      if(w.does) L.push('    '+w.does);
      if(when&&w.when) L.push('    Включается: '+w.when);
      if(w.gives) L.push('    Отдаёт: '+w.gives);
      L.push('');
    });
  }
  band('01 · ЭТО ДЕЛАЮТ ЦИФРОВЫЕ СОТРУДНИКИ', b1.band1, true);
  band('02 · ЭТО ПИШЕМ МЫ, ГОВОРЯТ ВАШИ ЛЮДИ', r.band2, false);
  band('03 · ОСТАЁТСЯ ВАМ', r.band3, false);
  if(x.order&&x.order.length){ L.push('── ЧТО ПЕРВЫМ ──');
    x.order.forEach(function(o){L.push(o.n+'  '+o.name); L.push('    '+o.why);});
    if(x.order_note) L.push('    '+x.order_note); L.push(''); }
  if(x.no&&x.no.length){ L.push('── ЭТОГО МЫ ДЕЛАТЬ НЕ БУДЕМ ──');
    x.no.forEach(function(n){L.push('• '+n.what); L.push('    → '+n.who);}); }
  return L.join('\n').slice(0,14000);
}

function ferr(sel,msg){var el=$(sel); if(!el)return; el.style.borderColor='#e5484d';
  var p=el.closest('.fl')||el.parentNode, m=p.querySelector('.emsg');
  if(!m){m=document.createElement('p'); m.className='emsg'; p.appendChild(m);}
  m.textContent=msg; el.focus();
  el.addEventListener('input',function h(){el.style.borderColor='';m.textContent='';
    el.removeEventListener('input',h)});}

function sendLead(){
  var b=$('#csend'); if(b.disabled) return;
  var n=$('#cn').value.trim(), e=$('#ce').value.trim();
  if(!n){ferr('#cn','Как к вам обращаться — одного слова хватит.');return;}
  if(!/.+@.+\..+/.test(e)){ferr('#ce','Проверьте адрес: нужен вид name@example.com.');return;}
  var d=new URLSearchParams({'form-name':'lead-list',client_name:n,client_email:e,
    client_tg:$('#ct').value.trim(),segment:SEG,list_text:asText(),'bot-field':''});
  try{localStorage.setItem('bidna_lead',JSON.stringify({name:n,email:e,tg:$('#ct').value.trim(),seg:SEG}))}catch(x){}
  b.disabled=true; b.textContent='Отправляем…';
  var m=$('#cmsg');
  fetch('/',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:d.toString()})
    .then(function(r){ if(!r.ok) throw 0;
      ev('lead');
      b.textContent='Список ушёл на '+e;
      m.style.color='#a8d5c6';
      m.textContent='Письмо придёт в течение минуты. Если его нет — посмотрите «Промоакции» и «Спам».';
    })
    .catch(function(){
      b.disabled=false; b.textContent='Прислать ещё раз';
      m.style.color='#ffb4b6';
      m.textContent='Письмо не ушло. Проверьте адрес и нажмите ещё раз — список на экране никуда не денется.';
    });
}

$('#f').addEventListener('submit',function(ev){
  ev.preventDefault();
  var bad=$('#q1').value.trim().length<8?'#q1':($('#q2').value.trim().length<12?'#q2':null);
  if(bad){ferr(bad,bad==='#q1'?'Здесь нужно чуть подробнее — что делаете и кто покупает.'
    :'Что повторяется каждую неделю — хотя бы одной фразой.');return;}
  ev('list_submit');
  $('#go').disabled=true; $('#f').style.display='none'; $('#prog').style.display='block';
  mark(1,'on');
  post('start').then(function(j){
    if(j.error==='quota'){fail('На сегодня разборов хватит — приходите завтра.');return Promise.reject('q');}
    if(j.error){fail('Проверьте две первые строки.');return Promise.reject('s');}
    S.ts=j.ts;S.tok=j.tok;S.h=j.h;S.link=j.link; mark(1,'done');
    if(!j.link){mark(2,'done');return null;}
    mark(2,'on'); return post('read').then(function(p){S.page=p&&p.ok?p:null;mark(2,'done');});
  }).then(function(){
    mark(3,'on');
    return post('band1').then(function(j){
      if(!j||!j.ok){throw new Error('band1');}
      S.b1=j; mark(3,'done'); mark(4,'on');
      render();                                   // трое сотрудников уже на экране
      return post('band1',{part:2}).then(function(j2){
        if(j2&&j2.ok&&j2.band1){ S.b1.band1=S.b1.band1.concat(j2.band1); render(); }
      }).catch(function(){});                     // не добрали двоих — список всё равно живой
    });
  }).then(function(){
    return post('rest').then(function(r){
      if(r&&r.ok){ S.rest=r; render(); }
    }).catch(function(){});
  }).then(function(){
    return post('extra').then(function(x){
      if(x&&x.ok){ S.extra=x; }
    }).catch(function(){});
  }).then(function(){
    mark(4,'done'); render();
  }).catch(function(e){
    if(e==='q'||e==='s')return;
    fail('Не получилось собрать список. Это бывает, если написано совсем коротко.');
  });
});

// возврат на страницу: показываем уже собранный список, а не гоним через квоту заново
if(S.old){
  $('#f').style.display='none';
  render();
  var n=document.createElement('p'); n.className='sig back';
  n.innerHTML='Это список, который вы уже собирали. '+
    '<a href="#" id="again">Собрать заново →</a>';
  var sh=$('#sheet'); sh.insertBefore(n, sh.firstChild);
  $('#again').addEventListener('click',function(ev){ev.preventDefault();
    try{localStorage.removeItem(CACHE)}catch(e){} location.reload();});
}
})();
"""


def build(name, seg):
    src = (LAND / seg['src']).read_text(encoding='utf-8')
    head = src[:src.index('</head>')]
    head = re.sub(r'<title>.*?</title>', f"<title>{seg['title']}</title>", head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">',
                  f'<meta name="description" content="{seg["desc"]}">', head)
    m = re.search(r'<header class="bar">.*?</header>', src, re.S)
    bar = m.group(0) if m else ''
    f = re.search(r'<footer>.*?</footer>', src, re.S)
    foot = f.group(0) if f else ''
    js = (JS.replace('TITLE', repr(seg['h1']))
            # ДВОЙНЫЕ кавычки обязательны: merge_site.py переименовывает файлы
            # внутри разделов и ищет строго "имя.html". В одинарных ссылка уедет в никуда.
            .replace('__PAY__', '"%s"' % seg['pay'])
            .replace('__QUIZ__', '"%s"' % seg['quiz'])
            .replace('__B2T__', '"%s"' % seg['band2'][0])
            .replace('__B2S__', '"%s"' % seg['band2'][1])
            .replace('__DNA__', '"%s"' % seg['dna'])
            .replace('SEG', repr(seg['seg'])))
    html = (head + f'<style>{CSS}</style></head>\n<body>\n' + bar + body(seg) + foot +
            f'\n<script>{js}</script>\n</body></html>\n')
    out = LAND / f'list-{name}.html'
    out.write_text(html, encoding='utf-8')
    return out, len(html)


if __name__ == '__main__':
    for name, seg in SEG.items():
        if not (LAND / seg['src']).exists():
            print(f'нет исходника {seg["src"]} — пропускаю {name}', file=sys.stderr); continue
        p, n = build(name, seg)
        print(f'{p.name:22s} {n//1024:4d} КБ')
