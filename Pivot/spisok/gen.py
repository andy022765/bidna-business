#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Панель «Одиннадцать заходов» — из desyatka-ispravlennaya.json в готовую страницу."""
import json, io, html, re, sys, os

# путь берём от самого скрипта — чтобы работало на любой машине, где лежит папка проекта
P = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]

d = json.load(io.open(f'{P}/desyatka-ispravlennaya.json', encoding='utf-8'))
lyudi = json.load(io.open(f'{P}/lyudi_plus.json', encoding='utf-8'))
podp = {}
for x in lyudi:
    k = x['karty'].get('ig', {})
    if k.get('podpischikov'):
        podp[x['imya']] = k['podpischikov']

E = lambda s: html.escape(s or '', quote=True)

def para(t):
    """Абзацы из текста с переводами строк."""
    blocks = [b.strip() for b in re.split(r'\n\s*\n', (t or '').strip()) if b.strip()]
    # одиночный перенос внутри абзаца — это перенос в редакторе, а не в тексте: склеиваем
    return ''.join('<p>' + ' '.join(E(b).split('\n')) + '</p>' for b in blocks)

def instrument(s):
    """Короткое имя инструмента из длинного обоснования."""
    head = re.split(r'\.\s|\sЧЕМ ПОДТВЕРЖДЕНО', s or '', maxsplit=1)[0]
    head = head.strip(' .,—')
    zamena = {
        'ДНК бизнеса + ДНК клиента + оффер + сайт': 'ДНК и сайт',
        'Видимость в нейросетях (GEO), квартал вперёд': 'Видимость',
        'Видимость в нейросетях (GEO), квартал вперёд ($1500)': 'Видимость',
        'Дежурный': 'Дежурный',
        'Продукт определяется на звонке, по ответу на вопрос о потоке': 'Сначала поток',
        'Продукт определяется на звонке': 'Сначала поток',
        'Сначала цифра потока': 'Сначала поток',
        'Дежурный как МАРШРУТИЗАТОР, не как консультант': 'Дежурный-маршрутизатор',
    }
    for k, v in zamena.items():
        if head.startswith(k): return v
    if head.startswith('ДНК'): return 'ДНК и сайт'
    if 'идимость' in head: return 'Видимость'
    if head.startswith('Дежурный'): return 'Дежурный'
    return head[:24]

def korotko(imya):
    """Имя и фамилия для узкой колонки: скобки и вторые фамилии убираем."""
    base = re.sub(r'\s*\([^)]*\)', '', imya)      # (Annie), (Shot of Art)
    base = re.split(r'\s*/\s*', base)[0].strip()  # Шадрина / La Brusciano
    return ' '.join(base.split()[:2])

rail, cards = [], []
for p in d['desyatka']:
    i = p['mesto']
    tep = 'тёпл' in (p['teplo'] or '')
    inst = instrument(p['chto_prodayom'])
    pod = podp.get(p['imya'], '')
    rail.append(
        f'<button class="row" data-go="{i}" type="button" aria-controls="k{i}">'
        f'<span class="row-n">{i:02d}</span>'
        f'<span class="row-mid"><span class="row-name">{E(korotko(p["imya"]))}</span>'
        f'<span class="row-inst">{E(inst)}</span></span>'
        f'<span class="row-right"><span class="dot" data-dot="{i}"></span>'
        f'<span class="row-t {"warm" if tep else "cold"}">{"тёплый" if tep else "холодный"}</span>'
        f'</span></button>')

    cards.append(f'''<article class="card" id="k{i}" data-card="{i}"{'' if i == 1 else ' hidden'}>
 <div class="card-head">
  <span class="card-n">{i:02d}</span>
  <div>
   <h2>{E(p['imya'])}</h2>
   <p class="card-delo">{E(p['delo'])}</p>
  </div>
 </div>
 <div class="meta">
  <span class="tag {'warm' if tep else 'cold'}">{E(p['teplo'])}</span>
  <span class="tag inst">{E(inst)}</span>
  {f'<span class="tag aud">{E(pod)} в инстаграме</span>' if pod else ''}
 </div>
{f'''
 <p class="buy"><span class="buy-l">покупает на самом деле</span>
  {E(p['pokupaet'])} <em>· пункт {E(p['punkt'])} из 24</em></p>''' if p.get('pokupaet') else ''}
{f'''
 <p class="obmen"><span class="obmen-l">без оплаты · {E(p['obmen_tag'])}</span>
  {E(p['obmen'])}</p>''' if p.get('obmen') else ''}

 <div class="track" role="group" aria-label="Отметка о работе">
  <span class="track-l">Отметка</span>
  <div class="track-b">
   <button type="button" class="st" data-st="none"  data-for="{i}">не писали</button>
   <button type="button" class="st" data-st="sent"  data-for="{i}">написали</button>
   <button type="button" class="st" data-st="reply" data-for="{i}">ответил</button>
   <button type="button" class="st" data-st="call"  data-for="{i}">созвон</button>
  </div>
 </div>

 <section class="blok">
  <h3>Сообщение — можно отправлять как есть</h3>
  <div class="msg" id="m{i}">{para(p['pervyy_hod'])}</div>
  <button type="button" class="copy" data-copy="{i}">Скопировать сообщение</button>
 </section>

 <section class="blok two">
  <div>
   <h3>Что продаём и чем это подтверждено</h3>
   {para(p['chto_prodayom'])}
  </div>
  <div>
   <h3>Чек</h3>
   {para(p['chek'])}
  </div>
 </section>

 <details class="skept">
  <summary>Что здесь поменяли скептики</summary>
  {para(p['chto_izmenilos'])}
 </details>
{f'''
 <details class="skept">
  <summary>Прежняя версия сообщения, до рамки 24</summary>
  <div class="msg old">{para(p['pervyy_hod_v1'])}</div>
 </details>''' if p.get('pervyy_hod_v1') else ''}

 <section class="zam">
  <label class="zam-l" for="z{i}">Заметки — видят оба, сохраняется само</label>
  <textarea class="zam-t" id="z{i}" data-zam="{i}" rows="2"
   placeholder="Что поправить в тексте, что спросить у Маши, что выяснили на звонке…"></textarea>
  <span class="zam-s" data-zam-s="{i}"></span>
 </section>

 <nav class="flip">
  <button type="button" class="flip-b" data-go="{i-1 if i > 1 else len(d['desyatka'])}">← предыдущий</button>
  <button type="button" class="flip-b" data-go="{i+1 if i < len(d['desyatka']) else 1}">следующий →</button>
 </nav>
</article>''')

pravila = ''.join(f'<li>{E(r)}</li>' for r in d['pravila'])
vyvod = para(d['vyvod'])
vyb = ''.join(f'<p><b>{E(v["imya"])}</b> — {E(v["pochemu"])}</p>' for v in d.get('vybrosheny', []))
N = len(d['desyatka'])

SCRIPT = r'''
(() => {
  const cards = [...document.querySelectorAll('[data-card]')];
  const rows  = [...document.querySelectorAll('.row')];
  const N = cards.length;
  let live = 1;

  function go(n) {
    n = ((n - 1 + N) % N) + 1;
    live = n;
    cards.forEach(c => { c.hidden = (+c.dataset.card !== n); });
    rows.forEach(r => r.classList.toggle('on', +r.dataset.go === n));
    const st = document.querySelector('.stage');
    if (st && st.getBoundingClientRect().top < -40) st.scrollIntoView({block: 'start'});
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (b) { go(+b.dataset.go); }
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') go(live + 1);
    if (e.key === 'ArrowLeft')  go(live - 1);
  });
  go(1);

  // ——— режим отправки: прячем внутренний разбор. Умолчание — спрятано.
  const KL = 'bidna-rezhim';
  const knopka = document.getElementById('rezh');
  const nota = document.querySelector('.rezh-n');
  function rezhim(tiho) {
    document.body.classList.toggle('tiho', tiho);
    if (knopka) {
      knopka.setAttribute('aria-pressed', tiho ? 'true' : 'false');
      knopka.querySelector('.rezh-t').textContent = tiho ? 'режим отправки' : 'виден разбор';
    }
    if (nota) nota.textContent = tiho ? 'внутренний разбор скрыт' : 'внутренний разбор на экране';
    try { localStorage.setItem(KL, tiho ? '1' : '0'); } catch (_) {}
  }
  let tiho = true;
  try { tiho = localStorage.getItem(KL) !== '0'; } catch (_) {}
  rezhim(tiho);
  if (knopka) knopka.addEventListener('click', () => rezhim(!document.body.classList.contains('tiho')));

  // копирование
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const box = document.getElementById('m' + b.dataset.copy);
    const txt = [...box.querySelectorAll('p')].map(p => p.innerText).join('\n\n');
    let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; } catch (_) {}
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy'); ta.remove();
      } catch (_) {}
    }
    if (!ok) {
      const r = document.createRange(); r.selectNodeContents(box);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    b.textContent = ok ? 'Скопировано' : 'Выделено — скопируйте руками';
    b.classList.add('done');
    setTimeout(() => { b.textContent = 'Скопировать сообщение'; b.classList.remove('done'); }, 2200);
  });

  // ——— общие отметки
  const IMENA = {};
  rows.forEach(r => { IMENA[r.dataset.go] = r.querySelector('.row-name').textContent; });
  const state = {};
  const PODPIS = {none: '', sent: 'написали', reply: 'ответил', call: 'созвон'};

  function paint() {
    let sent = 0, reply = 0, call = 0;
    for (let i = 1; i <= N; i++) {
      const s = state[i] || 'none';
      const dot = document.querySelector(`[data-dot="${i}"]`);
      if (dot) { dot.className = 'dot s-' + s; dot.title = PODPIS[s] || 'не писали'; }
      document.querySelectorAll(`.st[data-for="${i}"]`).forEach(b => {
        b.classList.toggle('on', b.dataset.st === s);
      });
      if (s === 'sent' || s === 'reply' || s === 'call') sent++;
      if (s === 'reply' || s === 'call') reply++;
      if (s === 'call') call++;
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('c-sent', sent); set('c-reply', reply); set('c-call', call);
    const bar = document.getElementById('bar');
    if (bar) bar.style.width = Math.min(100, call * 10) + '%';
  }
  paint();

  claude.use('db').then(db => {
    if (!db) return;                       // без общих отметок страница работает как есть
    const tally = document.querySelector('.tally');
    if (tally) tally.classList.add('live');
    db.collection('otmetki').onSnapshot(snap => {
      snap.docs.forEach(doc => {
        const v = doc.data() || {};
        if (v.sostoyanie) state[doc.id] = v.sostoyanie;
        else delete state[doc.id];
      });
      paint();
    }, () => {});
    document.addEventListener('click', async e => {
      const b = e.target.closest('.st');
      if (!b) return;
      const i = b.dataset.for, s = b.dataset.st;
      state[i] = s; paint();
      try {
        await db.doc('otmetki/' + i).set({
          sostoyanie: s, imya: IMENA[i] || '', kogda: new Date().toISOString(),
        });
      } catch (_) {}
    });

    // ——— заметки: общие, автосохранение
    const boxes = [...document.querySelectorAll('[data-zam]')];
    const trogal = new Set();                       // что сейчас правит этот человек
    db.collection('zametki').onSnapshot(snap => {
      snap.docs.forEach(doc => {
        const el = document.getElementById('z' + doc.id);
        if (!el || trogal.has(doc.id)) return;      // чужую правку не вписываем поверх своей
        const v = (doc.data() || {}).tekst || '';
        if (el.value !== v) el.value = v;
      });
    }, () => {});

    const tajmery = {};
    boxes.forEach(el => {
      const i = el.dataset.zam;
      const znak = document.querySelector(`[data-zam-s="${i}"]`);
      const sohrani = async () => {
        try {
          await db.doc('zametki/' + i).set({
            tekst: el.value, imya: IMENA[i] || '', kogda: new Date().toISOString(),
          });
          if (znak) { znak.textContent = 'сохранено'; znak.classList.add('on');
            setTimeout(() => znak.classList.remove('on'), 1600); }
        } catch (_) {
          if (znak) { znak.textContent = 'не сохранилось'; znak.classList.add('on'); }
        }
      };
      el.addEventListener('input', () => {
        trogal.add(i);
        clearTimeout(tajmery[i]);
        tajmery[i] = setTimeout(sohrani, 900);
      });
      el.addEventListener('blur', () => {
        clearTimeout(tajmery[i]); trogal.delete(i); sohrani();
      });
    });
  });
})();
'''

STYLE = r'''
:root{
  --paper:#F1F2F4; --surface:#FFFFFF; --sunk:#E9EBEF;
  --ink:#12161C; --ink-2:#39414C; --muted:#69727F; --rule:#DCDFE5;
  --indigo:#31408F; --indigo-soft:#E6E9F6;
  --ochre:#8C6210; --ochre-soft:#F5EDDC;
  --green:#1C6B4A; --green-soft:#DFEEE6;
  --shadow:0 1px 2px rgba(18,22,28,.05), 0 6px 20px -12px rgba(18,22,28,.22);
  --measure:64ch;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#0F1217; --surface:#171C24; --sunk:#12161D;
  --ink:#E7EAEF; --ink-2:#BAC2CD; --muted:#8B95A3; --rule:#293240;
  --indigo:#93A4EE; --indigo-soft:#1D2540;
  --ochre:#D9A63F; --ochre-soft:#33280F;
  --green:#63C093; --green-soft:#12301F;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -14px rgba(0,0,0,.7);
}}
:root[data-theme="dark"]{
  --paper:#0F1217; --surface:#171C24; --sunk:#12161D;
  --ink:#E7EAEF; --ink-2:#BAC2CD; --muted:#8B95A3; --rule:#293240;
  --indigo:#93A4EE; --indigo-soft:#1D2540;
  --ochre:#D9A63F; --ochre-soft:#33280F;
  --green:#63C093; --green-soft:#12301F;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px -14px rgba(0,0,0,.7);
}

*{box-sizing:border-box}
body{background:var(--paper); color:var(--ink);
  font:400 16px/1.62 "Golos Text","Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased; padding:0 0 5rem}
h1,h2,h3{font-family:Literata,Georgia,"Times New Roman",serif; text-wrap:balance; margin:0}
p{margin:0 0 .85em}
p:last-child{margin-bottom:0}
b,strong{font-weight:600}

.wrap{max-width:1180px; margin:0 auto; padding:0 1.5rem}

/* ——— шапка */
.top{border-bottom:1px solid var(--rule); background:var(--surface);
  padding:2.6rem 0 1.6rem; margin-bottom:2rem}
.brand{font:500 .68rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.19em; text-transform:uppercase; color:var(--muted); margin-bottom:1rem}
.top h1{font-size:clamp(2rem,5.2vw,3.1rem); font-weight:700; letter-spacing:-.022em; line-height:1.04}
.dek{max-width:58ch; color:var(--ink-2); margin:.9rem 0 0; font-size:1.02rem}

.tally{display:flex; flex-wrap:wrap; gap:1.6rem 2.4rem; align-items:flex-end;
  margin-top:1.9rem; padding-top:1.5rem; border-top:1px solid var(--rule)}
.tally-i{display:flex; flex-direction:column; gap:.15rem}
.tally-n{font:700 1.9rem/1 Literata,Georgia,serif; font-variant-numeric:tabular-nums;
  letter-spacing:-.02em}
.tally-l{font:500 .66rem/1.3 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.13em; text-transform:uppercase; color:var(--muted)}
.tally-goal{flex:1 1 220px; min-width:200px}
.goal-bar{height:6px; background:var(--sunk); border-radius:99px; overflow:hidden; margin-top:.5rem}
.goal-bar span{display:block; height:100%; background:var(--green); width:0;
  transition:width .35s ease}
.tally-note{font-size:.8rem; color:var(--muted); margin-top:.45rem}
.tally .sync{font:500 .64rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.1em;
  text-transform:uppercase; color:var(--muted); opacity:0}
.tally.live .sync{opacity:1; color:var(--green)}

/* ——— раскладка */
.board{display:grid; grid-template-columns:266px minmax(0,1fr); gap:2.2rem; align-items:start}
@media (max-width:900px){ .board{grid-template-columns:1fr; gap:1.4rem} }

.rail{display:flex; flex-direction:column; gap:2px; position:sticky; top:1rem;
  background:var(--surface); border:1px solid var(--rule); border-radius:10px;
  padding:6px; box-shadow:var(--shadow)}
@media (max-width:900px){ .rail{position:static; flex-direction:row; overflow-x:auto;
  gap:6px; padding:8px} }
.row{display:flex; align-items:center; gap:.6rem; width:100%; text-align:left;
  background:none; border:0; border-radius:7px; padding:.5rem .55rem; cursor:pointer;
  color:inherit; font:inherit; font-size:.88rem}
.row:hover{background:var(--sunk)}
.row.on{background:var(--indigo-soft)}
.row:focus-visible{outline:2px solid var(--indigo); outline-offset:1px}
@media (max-width:900px){ .row{flex:0 0 auto; min-width:150px} }
.row-n{font:600 .7rem/1 "IBM Plex Mono",ui-monospace,monospace; color:var(--muted);
  font-variant-numeric:tabular-nums}
.row.on .row-n{color:var(--indigo)}
.row-mid{display:flex; flex-direction:column; min-width:0; flex:1}
.row-name{font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.row-inst{font-size:.72rem; color:var(--muted); white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis}
.row-right{display:flex; align-items:center; gap:.4rem; flex-shrink:0}
.row-t{font:500 .6rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.06em}
.row-t.warm{color:var(--ochre)} .row-t.cold{color:var(--muted)}
.dot{width:7px; height:7px; border-radius:99px; background:transparent;
  box-shadow:inset 0 0 0 1px var(--rule)}
.dot.s-sent{background:var(--indigo); box-shadow:none}
.dot.s-reply{background:var(--ochre); box-shadow:none}
.dot.s-call{background:var(--green); box-shadow:none}

/* ——— карточка */
.card{background:var(--surface); border:1px solid var(--rule); border-radius:12px;
  padding:1.9rem 2rem 1.5rem; box-shadow:var(--shadow)}
@media (max-width:600px){ .card{padding:1.4rem 1.2rem} }
.card-head{display:flex; gap:1rem; align-items:baseline}
.card-n{font:600 .8rem/1 "IBM Plex Mono",ui-monospace,monospace; color:var(--indigo);
  font-variant-numeric:tabular-nums; padding-top:.35rem}
.card h2{font-size:clamp(1.35rem,3.1vw,1.85rem); font-weight:700; letter-spacing:-.016em;
  line-height:1.16}
.card-delo{color:var(--ink-2); margin:.45rem 0 0; font-size:.95rem; max-width:var(--measure)}
.meta{display:flex; flex-wrap:wrap; gap:.4rem; margin:1.1rem 0 0}
.tag{font:500 .68rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.05em;
  padding:.4rem .55rem; border-radius:5px; background:var(--sunk); color:var(--ink-2)}
.tag.warm{background:var(--ochre-soft); color:var(--ochre)}
.tag.cold{background:var(--sunk); color:var(--muted)}
.tag.inst{background:var(--indigo-soft); color:var(--indigo)}

.track{display:flex; align-items:center; gap:.8rem; flex-wrap:wrap;
  margin:1.3rem 0 0; padding:.7rem .8rem; background:var(--sunk); border-radius:8px}
.track-l{font:500 .64rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.13em;
  text-transform:uppercase; color:var(--muted)}
.track-b{display:flex; gap:4px; flex-wrap:wrap}
.st{font:inherit; font-size:.8rem; padding:.34rem .7rem; border-radius:99px; cursor:pointer;
  border:1px solid var(--rule); background:var(--surface); color:var(--ink-2)}
.st:hover{border-color:var(--indigo)}
.st.on{background:var(--indigo); border-color:var(--indigo); color:#fff}
:root[data-theme="dark"] .st.on{color:#0F1217}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]) .st.on{color:#0F1217} }
.st:focus-visible{outline:2px solid var(--indigo); outline-offset:2px}

.blok{margin:1.7rem 0 0; padding-top:1.4rem; border-top:1px solid var(--rule)}
.blok h3{font-size:.95rem; font-weight:600; margin:0 0 .7rem}
.blok.two{display:grid; grid-template-columns:1.7fr 1fr; gap:1.6rem}
.blok.two h3{margin-top:0}
.blok.two>div>p{font-size:.9rem; color:var(--ink-2)}
@media (max-width:700px){ .blok.two{grid-template-columns:1fr; gap:1.2rem} }

.msg{background:var(--sunk); border-left:2px solid var(--indigo); border-radius:0 8px 8px 0;
  padding:1.1rem 1.2rem; max-width:var(--measure); font-size:.95rem}
.copy{margin-top:.85rem; font:inherit; font-size:.86rem; font-weight:500;
  padding:.55rem 1.1rem; border-radius:7px; cursor:pointer;
  border:1px solid var(--indigo); background:var(--indigo); color:#fff}
:root[data-theme="dark"] .copy{color:#0F1217}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]) .copy{color:#0F1217} }
.copy:hover{filter:brightness(1.08)}
.copy.done{background:var(--green); border-color:var(--green)}
.copy:focus-visible{outline:2px solid var(--ink); outline-offset:2px}

.tally-rezh{display:flex; flex-direction:column; gap:.3rem; align-items:flex-start}
.rezh{font:500 .74rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.06em;
  padding:.6rem .9rem; border-radius:99px; cursor:pointer; border:1px solid var(--rule);
  background:var(--surface); color:var(--ink-2); white-space:nowrap}
.rezh:hover{border-color:var(--indigo); color:var(--indigo)}
.rezh:focus-visible{outline:2px solid var(--indigo); outline-offset:2px}
.rezh[aria-pressed="true"]{background:var(--indigo); border-color:var(--indigo); color:#fff}
:root[data-theme="dark"] .rezh[aria-pressed="true"]{color:#0F1217}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]) .rezh[aria-pressed="true"]{color:#0F1217} }
.rezh-n{font-size:.74rem; color:var(--muted); margin:0}
/* режим отправки: внутренний слой прячем */
body.tiho .blok.two, body.tiho .skept, body.tiho .obmen{display:none}
.buy{margin:.9rem 0 0; font-size:.9rem; color:var(--ink-2); max-width:var(--measure);
  padding:.55rem .75rem; background:var(--green-soft); border-radius:7px}
.buy-l{font:600 .62rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.13em;
  text-transform:uppercase; color:var(--green); margin-right:.5rem}
.buy em{font-style:normal; color:var(--muted); font-size:.82rem}
.obmen{margin:.5rem 0 0; font-size:.88rem; color:var(--ink-2); max-width:var(--measure);
  padding:.55rem .75rem; background:var(--ochre-soft); border-radius:7px}
.obmen-l{font:600 .62rem/1 "IBM Plex Mono",ui-monospace,monospace; letter-spacing:.11em;
  text-transform:uppercase; color:var(--ochre); margin-right:.5rem}
.msg.old{border-left-color:var(--muted); opacity:.85; margin-top:.9rem}
.zam{margin:1.4rem 0 0; padding-top:1.2rem; border-top:1px solid var(--rule)}
.zam-l{display:block; font:500 .66rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:.5rem}
.zam-t{width:100%; max-width:var(--measure); font:inherit; font-size:.92rem; color:var(--ink);
  background:var(--sunk); border:1px solid var(--rule); border-radius:8px; padding:.7rem .8rem;
  resize:vertical; min-height:2.8rem}
.zam-t:focus{outline:2px solid var(--indigo); outline-offset:1px; border-color:var(--indigo)}
.zam-s{display:inline-block; margin-top:.35rem; font:500 .66rem/1 "IBM Plex Mono",monospace;
  letter-spacing:.08em; text-transform:uppercase; color:var(--green); opacity:0;
  transition:opacity .2s}
.zam-s.on{opacity:1}
.skept{margin:1.5rem 0 0; padding-top:1.2rem; border-top:1px solid var(--rule)}
.skept summary{cursor:pointer; font:500 .78rem/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.09em; text-transform:uppercase; color:var(--muted)}
.skept summary:hover{color:var(--ink)}
.skept p{font-size:.87rem; color:var(--ink-2); margin-top:.9rem; max-width:var(--measure)}

.flip{display:flex; justify-content:space-between; gap:.6rem; margin-top:1.6rem;
  padding-top:1.1rem; border-top:1px solid var(--rule)}
.flip-b{font:inherit; font-size:.82rem; color:var(--muted); background:none; border:0;
  cursor:pointer; padding:.35rem .1rem}
.flip-b:hover{color:var(--indigo)}
.flip-b:focus-visible{outline:2px solid var(--indigo); outline-offset:2px}

/* ——— низ */
.tail{margin-top:3.2rem; display:grid; grid-template-columns:1fr 1fr; gap:2rem}
@media (max-width:860px){ .tail{grid-template-columns:1fr} }
.tail section{background:var(--surface); border:1px solid var(--rule); border-radius:12px;
  padding:1.6rem 1.7rem; box-shadow:var(--shadow)}
.tail h2{font-size:1.15rem; font-weight:700; margin-bottom:.9rem; letter-spacing:-.01em}
.tail p{font-size:.9rem; color:var(--ink-2)}
.tail ol{margin:0; padding-left:1.2rem; display:flex; flex-direction:column; gap:.75rem}
.tail li{font-size:.86rem; color:var(--ink-2); line-height:1.55}
.tail li::marker{color:var(--indigo); font-family:"IBM Plex Mono",monospace; font-size:.75rem}
.vyb{margin-top:1.2rem; padding-top:1rem; border-top:1px solid var(--rule)}
.vyb h3{font-size:.78rem; font-family:"IBM Plex Mono",monospace; letter-spacing:.11em;
  text-transform:uppercase; color:var(--muted); margin-bottom:.7rem}
.vyb p{font-size:.84rem}
.pod{margin-top:2.6rem; padding-top:1.2rem; border-top:1px solid var(--rule);
  font-size:.78rem; color:var(--muted); display:flex; justify-content:space-between;
  flex-wrap:wrap; gap:.6rem}
@media (prefers-reduced-motion: reduce){ *{transition:none!important} }
'''

doc = f'''<title>Шестнадцать заходов</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&family=Golos+Text:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>{STYLE}</style>

<header class="top">
 <div class="wrap">
  <div class="brand">Business Intelligence DNA · неделя 09.09.2026</div>
  <h1>Шестнадцать заходов</h1>
  <p class="dek">Кому пишем на этой неделе, чем открываем разговор и что продаём первым.
   Отобрано из 31 контакта: разведка по каждому, отбор в три угла, трое скептиков,
   плюс пятеро добора 12.09 — их факты перепроверены живьём. Сообщения написаны через рамку
   24 обещаний: первым абзацем идёт то, что человек получает в итоге. Готовы к отправке
   без правок. Заметки в карточках общие: что напишет один, видит другой.</p>
  <div class="tally">
   <div class="tally-i"><span class="tally-n" id="c-sent">0</span><span class="tally-l">написали</span></div>
   <div class="tally-i"><span class="tally-n" id="c-reply">0</span><span class="tally-l">ответили</span></div>
   <div class="tally-i"><span class="tally-n" id="c-call">0</span><span class="tally-l">созвонов</span></div>
   <div class="tally-rezh">
    <button type="button" id="rezh" class="rezh" aria-pressed="true">
     <span class="rezh-t">режим отправки</span>
    </button>
    <p class="rezh-n">внутренний разбор скрыт</p>
   </div>
   <div class="tally-goal">
    <span class="tally-l">цель недели — 10 созвонов</span>
    <div class="goal-bar"><span id="bar"></span></div>
    <p class="tally-note">Шестнадцать писем: волна 1 во вторник — тёплые, среда — холодные.
     Холодные отвечают примерно один из трёх-четырёх. <span class="sync">отметки общие</span></p>
   </div>
  </div>
 </div>
</header>

<div class="wrap">
 <div class="board">
  <nav class="rail" aria-label="Заходы">{''.join(rail)}</nav>
  <div class="stage">{''.join(cards)}</div>
 </div>

 <div class="tail">
  <section>
   <h2>Правила на весь список</h2>
   <ol>{pravila}</ol>
  </section>
  <section>
   <h2>Почему список такой</h2>
   {vyvod}
   <div class="vyb"><h3>Кто вышел из списка</h3>{vyb}</div>
  </section>
 </div>

 <div class="pod">
  <span>Разведка, отбор и скептики — {N} карточек, 49 претензий, 21 критичная.</span>
  <span>Внутренний документ. Работаем под NDA.</span>
 </div>
</div>

<script>{SCRIPT}</script>
'''
io.open(OUT, 'w', encoding='utf-8').write(doc)
print(f'{OUT}: {len(doc)} символов, {N} карточек')
