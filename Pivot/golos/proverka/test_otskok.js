// Проверка отметки об отскоке. node test_otskok.js ../site/netlify-functions/otskok.js
const crypto=require('crypto');
const Module=require('module'); const mem=new Map(); const orig=Module._load;
Module._load=function(r,...a){ if(r==='@netlify/blobs') return { getStore:()=>({
  get:async k=>mem.has(k)?mem.get(k):null, set:async(k,v)=>{mem.set(k,v===undefined?'':v)} })};
  return orig.call(this,r,...a); };
const SEK='whsec_'+Buffer.from('tajnaja-stroka-dlja-proverki').toString('base64');
process.env.OTSKOK_SECRET=SEK; process.env.RESEND_API_KEY='k';
process.env.GOLOS_VLADELEC='support@businessinteldna.com';
const pisma=[];
global.fetch=async(u,o)=>{ pisma.push(JSON.parse(o.body)); return {status:200,ok:true,text:async()=>'{}'} };
const {handler}=require(require('path').resolve(process.argv[2]));

const podpisat=(telo,id,ts)=>{
  const k=Buffer.from(SEK.replace(/^whsec_/,''),'base64');
  return 'v1,'+crypto.createHmac('sha256',k).update(`${id}.${ts}.${telo}`).digest('base64');
};
let n=0;
const zvat=async(payload,{id,ts,sig,metod='POST'}={})=>{
  const telo=JSON.stringify(payload);
  id=id||('msg_'+(++n)); ts=ts||String(Math.floor(Date.now()/1000));
  return handler({httpMethod:metod, body:telo,
    headers:{'svix-id':id,'svix-timestamp':ts,'svix-signature':sig||podpisat(telo,id,ts)}});
};
const otskok=(komu,tip='Permanent',soob='550 5.1.1 user unknown')=>({
  type:'email.bounced', created_at:'2026-09-23T20:00:00Z',
  data:{email_id:'e'+Math.random().toString(36).slice(2,9), to:[komu], subject:'Разбор по видимости',
        bounce:{type:tip, subType:'General', message:soob}}});
let bed=0; const p=(t,ok,x='')=>{if(!ok)bed++;console.log('  '+t.padEnd(64),ok?'ДА':'ПРОВАЛ',x)};
(async()=>{
  p('чужая подпись не проходит', (await zvat(otskok('a@b.com'),{sig:'v1,AAAA'})).statusCode===401);
  p('без заголовков не проходит', (await handler({httpMethod:'POST',body:'{}',headers:{}})).statusCode===401);
  const staryTs=String(Math.floor(Date.now()/1000)-4000);
  p('старая метка времени не проходит (защита от повтора)', (await zvat(otskok('a@b.com'),{ts:staryTs})).statusCode===401);
  p('GET закрыт', (await handler({httpMethod:'GET',headers:{}})).statusCode===405);

  pisma.length=0;
  await zvat(otskok('ivan@gmail.com'));
  p('навсегда: отметка ушла владельцу', pisma.length===1 && pisma[0].to[0]==='support@businessinteldna.com');
  p('в теме виден адрес', /ivan@gmail\.com/.test(pisma[0].subject), pisma[0].subject);
  p('сказано, что не дойдёт', /не дойдёт/.test(pisma[0].subject+pisma[0].html));
  p('объяснена причина — опечатка при живом домене', /домен живой, а ящика/.test(pisma[0].html));
  p('есть «что делать»', /Что делать/.test(pisma[0].html));

  pisma.length=0;
  await zvat(otskok('petr@gmail.com','Transient','451 try again'));
  p('временный отскок: тон мягче, без «не дойдёт»', pisma.length===1 && !/не дойдёт/.test(pisma[0].subject));

  pisma.length=0;
  await zvat({type:'email.complained',created_at:'',data:{email_id:'c1',to:['x@y.com'],subject:'T'}});
  p('жалоба на спам: отдельный текст', pisma.length===1 && /спам/.test(pisma[0].subject+pisma[0].html));

  pisma.length=0;
  await zvat({type:'email.delivered',data:{to:['x@y.com']}});
  p('доставленное письмо не беспокоит', pisma.length===0);

  pisma.length=0;
  await zvat(otskok('support@businessinteldna.com'));
  p('отскок письма ВЛАДЕЛЬЦУ петлю не заводит', pisma.length===0);

  pisma.length=0;
  const odin=otskok('dubl@gmail.com');
  await zvat(odin); await zvat(odin);
  p('повтор вебхука не шлёт вторую отметку', pisma.length===1, 'писем '+pisma.length);

  console.log(bed?`\nПРОВАЛОВ: ${bed}`:'\nВСЕ ПРОВЕРКИ ОТСКОКА ПРОШЛИ');
  process.exit(bed?1:0);
})();
