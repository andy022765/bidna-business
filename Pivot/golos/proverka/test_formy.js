process.env.RESEND_API_KEY='k'; process.env.BIDNA_MAIL='support@businessinteldna.com';
const pisma=[]; const zapuski=[];
global.fetch=async(u,o)=>{ if(String(u).includes('resend')) pisma.push(JSON.parse(o.body)); else zapuski.push(String(u)); return {ok:true,status:200,text:async()=>'{}',json:async()=>({})}; };
const {handler}=require(process.argv[2]);
const dat=(form,d)=>({body:JSON.stringify({payload:{form_name:form,data:d}})});
let bed=0; const p=(n,ok,x='')=>{if(!ok)bed++;console.log('  '+n.padEnd(64),ok?'ДА':'ПРОВАЛ',x);};
const raz=(s)=>s.replace(/\\u([0-9a-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
(async()=>{
  const sluchai=[
    ['geo-check-ru',{trade:'кровля',city:'Тампа',email:'ivan@gmail.com'},'ru','ChatGPT, Google AI Mode'],
    ['geo-check',{trade:'roofing',city:'Tampa',email:'john@gmail.com'},'en','three engines'],
    ['line-check-ru',{biz:'Кофейня',phone:'+18135551234',email:'ivan2@gmail.com',consent:'on'},'ru','+18135551234'],
    ['line-check',{biz:'Cafe',phone:'+18135559999',email:'john2@gmail.com',consent:'on'},'en','+18135559999'],
    ['vera-demo-ru',{email:'ivan3@gmail.com'},'ru','vera/ru/thanks'],
    ['vera-demo',{email:'john3@gmail.com'},'en','vera/thanks'],
  ];
  for(const [form,d,yaz,marker] of sluchai){
    pisma.length=0; zapuski.length=0;
    await handler(dat(form,d));
    // Видимость с 23.09 подтверждения НЕ шлёт: вместо него запускается фоновый разбор,
    // он и пишет человеку сам. Поэтому письмо одно — владельцу.
    const vidimost = form.startsWith('geo-check');
    p(form+(vidimost?': одно письмо владельцу, подтверждения НЕТ':': два письма (владельцу и человеку)'),
      pisma.length===(vidimost?1:2), 'писем '+pisma.length);
    if(vidimost){
      p(form+': разбор запущен фоновой функцией', zapuski.some(u=>u.includes('razbor-background')));
      continue;
    }
    if(pisma.length!==2) continue;
    const vlad=pisma[0], chel=pisma[1];
    p(form+': владельцу на support@', vlad.to[0]==='support@businessinteldna.com');
    p(form+': человеку на его адрес', chel.to[0]===d.email, chel.to[0]);
    p(form+': письмо человеку с support@', /support@businessinteldna\.com/.test(chel.from));
    const tt=raz(JSON.stringify(chel));
    p(form+': есть русский блок', /[А-Яа-я]{6,}/.test(tt));
    p(form+': есть английский блок', /[A-Za-z]{5,}\s+[A-Za-z]{5,}/.test(tt));
    p(form+': язык страницы идёт первым', yaz==='ru' ? tt.indexOf('\u2014\u2014\u2014')>0 && /^[^A-Za-z]*[А-Я]/.test(raz(chel.subject)) : /^[A-Za-z]/.test(raz(chel.subject)), raz(chel.subject).slice(0,58));
    p(form+': тема содержит обе версии', raz(chel.subject).includes(' / '));
    p(form+': свои поля подставлены', Object.values(d).every(v=>v==='on'||tt.includes(v)));
    const t=raz(JSON.stringify(chel));
    p(form+': не обещает лишнего (нет слова «бесплатно»/«free»)', !/бесплатн|free of charge/i.test(t));
  }
  // приёмка без согласия — владельцу должно быть видно, что звонить нельзя
  pisma.length=0;
  await handler(dat('line-check-ru',{biz:'X',phone:'+18130000000',email:'a@b.com'}));
  p('приёмка без галочки: владельцу написано «не звонить»', /НЕ — не звонить|\\u041d\\u0415/.test(JSON.stringify(pisma[0])) || raz(JSON.stringify(pisma[0])).includes('НЕТ — не звонить'));
  // без почты — человеку не шлём, владельцу шлём
  pisma.length=0;
  await handler(dat('vera-demo-ru',{}));
  p('без почты: письмо только владельцу', pisma.length===1, 'писем '+pisma.length);
  // лист правды к приёмке
  pisma.length=0;
  global.fetch=async(u,o)=>{ if(!String(u).includes('resend')) zapuski.push(String(u)); if(String(u).includes('resend')){pisma.push(JSON.parse(o.body)); return {ok:true,status:200,text:async()=>'{}'};}
    return {ok:true,status:200,arrayBuffer:async()=>new TextEncoder().encode('ответы на 22 вопроса').buffer}; };
  await handler(dat('list-pravdy-ru',{client_name:'Пётр',client_email:'petr@shop.ru',contact:'Пётр, +1813…',
    attachment:{url:'https://netlify/f.txt',filename:'fact-sheet.txt'}}));
  p('русская форма листа правды: два письма', pisma.length===2, 'писем '+pisma.length);
  p('русская: русский блок идёт первым', /^Лист правды получен/.test(raz(pisma[1].subject)), raz(pisma[1].subject).slice(0,52));
  pisma.length=0;
  await handler(dat('list-pravdy-en',{client_name:'John',client_email:'john@shop.com',contact:'John, +1813…',
    attachment:{url:'https://netlify/f.txt',filename:'fact-sheet.txt'}}));
  p('лист правды: два письма', pisma.length===2, 'писем '+pisma.length);
  if(pisma.length===2){
    const v=raz(JSON.stringify(pisma[0])), c=raz(JSON.stringify(pisma[1]));
    p('владельцу: тема про лист правды, не про диагностику', /Лист правды/.test(v) && !/диагностику/.test(v));
    p('владельцу: вложение приложено', !!pisma[0].attachments && pisma[0].attachments.length===1);
    p('человеку: НЕ зовут выбирать время на стратсессию', !/выбрать время|Calendly|calendly/.test(c));
    p('человеку: сказано, что сверяем с его же словами', /против вашей же строки/.test(c));
    p('человеку: письмо двуязычное', /[А-Яа-я]{6,}/.test(c) && /against what you wrote/.test(c));
    p('английская: английский блок первым', /^Fact sheet received/.test(raz(pisma[1].subject)), raz(pisma[1].subject).slice(0,52));
    p('человеку: дан способ поправить до звонков', /ещё не начали/.test(c) && /have not/.test(c));
  }
  pisma.length=0;
  await handler(dat('list-pravdy-en',{client_name:'X',client_email:'x@y.com'}));
  p('без вложения: владельцу сказано, что ответы не доехали', /ВЛОЖЕНИЯ НЕТ/.test(raz(JSON.stringify(pisma[0]))));
  global.fetch=async(u,o)=>{ if(!String(u).includes('resend')){zapuski.push(String(u)); return {ok:true,status:202,text:async()=>''};} pisma.push(JSON.parse(o.body)); return {ok:true,status:200,text:async()=>'{}'} };

  // Лист правды под ДВУМЯ продуктами: анкета одна, письма разные.
  global.fetch=async(u,o)=>{ if(String(u).includes('resend')){pisma.push(JSON.parse(o.body)); return {ok:true,status:200,text:async()=>'{}'};}
    return {ok:true,status:200,arrayBuffer:async()=>new TextEncoder().encode('ответы').buffer}; };
  for (const [prod, marker, chuzhoy] of [['vera','Вера и будет отвечать','звоним на вашу линию'],
                                         ['call-audit','звоним на вашу линию','Вера и будет отвечать']]) {
    pisma.length=0;
    await handler(dat('list-pravdy-ru',{client_name:'П',client_email:'p@b.com',produkt:prod,
      attachment:{url:'https://x/f.txt',filename:'f.txt'}}));
    const v=raz(JSON.stringify(pisma[0])), c=raz(JSON.stringify(pisma[1]));
    p('produkt='+prod+': письмо человеку про свой продукт', c.includes(marker) && !c.includes(chuzhoy));
    p('produkt='+prod+': тема владельцу своя',
      prod==='vera' ? /Лист правды для Веры/.test(v) : /Лист правды к приёмке/.test(v),
      (JSON.parse(v).subject||'').slice(0,40));
  }
  pisma.length=0;
  await handler(dat('list-pravdy-ru',{client_name:'П',client_email:'p@b.com'}));
  p('без поля produkt: ведём себя как приёмка (как было)', raz(JSON.stringify(pisma[1])).includes('звоним на вашу линию'));
  global.fetch=async(u,o)=>{ if(!String(u).includes('resend')){zapuski.push(String(u)); return {ok:true,status:202,text:async()=>''};} pisma.push(JSON.parse(o.body)); return {ok:true,status:200,text:async()=>'{}'} };

  // старые ветки целы
  pisma.length=0;
  await handler(dat('lead-list',{client_name:'Пётр',client_email:'p@b.com',segment:'business',list_text:'список'}));
  p('старая ветка lead-list жива', pisma.length>=1, 'писем '+pisma.length);
  console.log(bed?`\nПРОВАЛОВ: ${bed}`:'\nВСЕ ПРОВЕРКИ ФОРМ ПРОШЛИ');
  process.exit(bed?1:0);
})();
