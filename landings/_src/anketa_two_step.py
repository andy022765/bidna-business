# -*- coding: utf-8 -*-
"""Анкета в два шага: сначала контакты — и они уходят к нам СРАЗУ, отдельной отправкой.
Иначе человек, бросивший анкету на середине, остаётся для нас безымянным, хотя уже заплатил."""
import os, re, time
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {"anketa-b-7k3m9x.html": ("intake-business", "biznes"),
         "anketa-e-4q8v2n.html": ("intake-expert", "ekspert")}

for f, (form, seg) in FILES.items():
    p = os.path.join(HERE, f)
    s = open(p, encoding="utf-8").read()
    before = s

    # 1. скрытая форма для шага 1
    s = s.replace(f'<form name="{form}" data-netlify="true"',
        f'''<form name="intake-start" data-netlify="true" netlify-honeypot="bot-field" hidden>
  <input type="text" name="client_name" /><input type="email" name="client_email" />
  <input type="text" name="client_tg" /><input type="text" name="segment" /><input type="text" name="bot-field" />
</form>

<form name="{form}" data-netlify="true"''')

    # 2. кнопка «Продолжить» в блоке контактов + всё остальное прячем
    s = s.replace('''    </div>
  </div>
  <div class="voicebanner" id="voiceBanner">''',
'''    </div>
    <button class="btn btn-gold" id="startBtn" style="margin-top:14px;width:100%">Продолжить к вопросам →</button>
    <div class="note" id="startNote" style="margin-top:10px;color:var(--muted);font-size:14px">Дальше — 67 вопросов, один заход. Ответы сохраняются в браузере: можно закрыть и вернуться.</div>
  </div>
  <div id="rest" hidden>
  <div class="voicebanner" id="voiceBanner">''')

    # закрыть обёртку перед скрытой формой отправки (после блока submit)
    s = s.replace('''    <button class="btn btn-gold big-submit" id="btnSubmit">✓ Завершить и отправить</button>''',
'''    <button class="btn btn-gold big-submit" id="btnSubmit">✓ Завершить и отправить</button>''')

    # 3. логика шага 1
    s = s.replace("var cName=document.getElementById('c_name')",
f'''(function(){{
  // шаг 1: контакты уходят немедленно, отдельной формой
  var rest=document.getElementById('rest'), sb=document.getElementById('startBtn'), sn=document.getElementById('startNote');
  var ct=document.getElementById('contactTop');
  function open2(){{ rest.hidden=false; sb.style.display='none'; if(sn) sn.style.display='none'; }}
  try{{ if(store['__started']) open2(); }}catch(e){{}}
  sb.addEventListener('click', function(e){{
    e.preventDefault();
    var n=document.getElementById('c_name').value.trim(),
        m=document.getElementById('c_email').value.trim(),
        g=document.getElementById('c_tg').value.trim();
    if(!n || !/.+@.+\\..+/.test(m)){{ ct.classList.add('miss'); (n?document.getElementById('c_email'):document.getElementById('c_name')).focus(); return; }}
    sb.disabled=true; sb.textContent='Секунду…';
    var fd=new FormData();
    fd.append('form-name','intake-start');
    fd.append('client_name',n); fd.append('client_email',m); fd.append('client_tg',g);
    fd.append('segment','{seg}'); fd.append('bot-field','');
    fetch('/',{{method:'POST',body:fd}}).catch(function(){{}}).then(function(){{
      try{{ store['__started']=1; store['__c_name']=n; store['__c_email']=m; store['__c_tg']=g;
            localStorage.setItem(KEY,JSON.stringify(store)); }}catch(e){{}}
      open2(); ct.classList.remove('miss');
      window.scrollTo({{top:rest.offsetTop-80,behavior:'smooth'}});
    }});
  }});
}})();

var cName=document.getElementById('c_name')''')

    assert s != before, f
    # закрыть <div id="rest"> перед </body>
    s = s.replace("</body>", "</div>\n</body>", 1) if '<div id="rest" hidden>' in s else s
    open(p, "w", encoding="utf-8").write(s)
    time.sleep(1)
    chk = open(p, encoding="utf-8").read()
    print(f"  ✓ {f}: intake-start={chk.count('intake-start')}, startBtn={chk.count('startBtn')}, rest={chk.count('id=\"rest\"')}")
