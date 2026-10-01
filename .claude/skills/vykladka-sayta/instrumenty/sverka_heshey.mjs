// Сверка файлов выкладки Netlify с локальной папкой по sha1 (только чтение API, кредиты не тратит).
//   node sverka_heshey.mjs <deploy_id> <stage> [--strogo]
// --strogo: код возврата 1, если есть отличия, лишние/недостающие файлы или нет .eszip (для проверки после боя).
// Токен берёт из ~/Library/Preferences/netlify/config.json, в вывод его не пишет.
// Кладёт список файлов выкладки рядом со stage: files-<deploy_id>.json.
//
// Три применения:
//   1) «что уедет» до боя: id ТЕКУЩЕЙ боевой + новый stage → mismatch/новые/удалённые = ровно то, что поменяется;
//   2) черновик: id черновика + stage → mismatch 0;
//   3) после боя: id НОВОЙ боевой + stage → mismatch 0, missing remotely «-».
// Норма (проверено 29.09 на боевой 6abc9125…): «нет в выкладке» только /_redirects (Netlify его не хранит файлом);
// «only remote» только /netlify.toml (его пишет CLI) и /.netlify/internal/edge-functions/{manifest.json,*.eszip,*.tar.gz}.
// Строка «edge-бандл» ниже показывает, есть ли .eszip; нет его при боевой выкладке — счётчик роботов не работает.
// Эталон 29.09 (вхолостую, 22:20 PDT): боевая 6abc9125… против пересборки — см. SKILL.md.
import fs from 'fs'; import os from 'os'; import path from 'path'; import crypto from 'crypto';
const DID = process.argv[2], STAGE = process.argv[3], STROGO = process.argv.includes('--strogo');
if (!DID || !STAGE) { console.log('нужно: <deploy_id> <stage>'); process.exit(2); }
const cfgPaths=[path.join(os.homedir(),'Library/Preferences/netlify/config.json'),path.join(os.homedir(),'.netlify/config.json')];
let tok=null; for(const p of cfgPaths){ try{ const c=JSON.parse(fs.readFileSync(p,'utf8')); const u=c.users&&c.users[c.userId]; tok=u&&u.auth&&u.auth.token; if(tok) break;}catch(e){} }
if(!tok){console.log('нет токена Netlify CLI');process.exit(2)}
let files=[]; for(let page=1;page<20;page++){ const r=await fetch(`https://api.netlify.com/api/v1/deploys/${DID}/files?page=${page}&per_page=100`,{headers:{Authorization:'Bearer '+tok}}); if(!r.ok){console.log('http',r.status,'(401/403/404 — не тот id или кончились кредиты)');process.exit(2);} const j=await r.json(); files=files.concat(j); if(j.length<100)break; }
fs.writeFileSync(path.join(path.dirname(STAGE),`files-${DID}.json`),JSON.stringify(files));
const remote=new Map(files.map(f=>[f.path,f.sha]));
let local=[]; (function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else local.push(p);}})(STAGE);
const localRel=new Set(local.map(p=>'/'+path.relative(STAGE,p)));
let ok=0,bad=[],missing=[];
for(const p of local){ const rel='/'+path.relative(STAGE,p); const sha=crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
  if(!remote.has(rel)){missing.push(rel);continue;} if(remote.get(rel)===sha) ok++; else bad.push(rel); }
const extra=[...remote.keys()].filter(k=>!localRel.has(k));
const sluzhebnye=extra.filter(k=>k==='/netlify.toml'||/^\/\.netlify\/internal\/edge-functions\/(manifest\.json|.*\.eszip|.*\.tar\.gz)$/.test(k));
const chuzhie=extra.filter(k=>!sluzhebnye.includes(k));
missing=missing.filter(k=>k!=='/_redirects'&&k!=='/_headers');   // Netlify их не хранит файлами — норма
console.log('remote files',files.length,'local',local.length,'sha match',ok,'mismatch',bad.length,'missing remotely',missing.length);
if(bad.length) console.log('  отличаются:', bad.slice(0,60).join(', ')+(bad.length>60?' …':''));
if(missing.length) console.log('  нет в выкладке (новые):', missing.slice(0,60).join(', '));
console.log('only remote (служебные):', sluzhebnye.join(', ')||'-');
console.log('only remote (прочие — удалятся/не наши):', chuzhie.join(', ')||'-');
const eszip=extra.some(k=>/\.eszip$/.test(k));
console.log('edge-бандл .eszip:', eszip ? 'есть' : 'НЕТ');
if (STROGO) { const ploho = bad.length||missing.length||chuzhie.length||!eszip; console.log(ploho ? 'ИТОГ: РАСХОЖДЕНИЕ' : 'ИТОГ: выкладка = stage'); process.exit(ploho?1:0); }
