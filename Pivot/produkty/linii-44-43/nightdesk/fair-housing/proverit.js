#!/usr/bin/env node
'use strict';
// Проверка текстов ответов на fair housing правилами (platforma/lib/nightdesk/fair-housing.js) и выгрузка
// для классификатора zillow/fair-housing-guardrail (формат их загрузчика: JSONL с полями content и label).
//
//   node nightdesk/fair-housing/proverit.js "It's a very safe neighborhood."     одна реплика
//   node nightdesk/fair-housing/proverit.js --fayl repliki.txt                   по реплике в строке
//   node nightdesk/fair-housing/proverit.js --provokacii                          самопроверка на 60 провокациях
//   node nightdesk/fair-housing/proverit.js --fayl repliki.txt --jsonl out.jsonl  + выгрузка для модели zillow
//
// label в выгрузке — вердикт НАШИХ правил (compliant / non-compliant): модель zillow сравнивает свой ответ
// с ним, расхождения идут на ручную проверку (KLASSIFIKATOR.md). Код выходит с 1, если есть нарушения.

const fs = require('fs');
const path = require('path');
const FH = require(path.join(__dirname, '..', '..', 'platforma', 'lib', 'nightdesk', 'fair-housing.js'));

const SH = JSON.parse(fs.readFileSync(path.join(__dirname, 'shablony.json'), 'utf8'));
const L = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'list-pravdy', 'harborrow.json'), 'utf8'));
const odobrennye = FH.odobrennyeIz(SH, L.kriterii_arendy);

const arg = process.argv.slice(2);
const flag = (imya) => { const i = arg.indexOf(imya); return i === -1 ? null : (arg[i + 1] || ''); };
const est = (imya) => arg.includes(imya);

let repliki = [];
if (est('--provokacii')) {
  const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'provokacii.json'), 'utf8')).provokacii;
  for (const p of P) {
    repliki.push({ id: `${p.id}+`, tekst: p.horoshiy_otvet, zhdem: true });
    repliki.push({ id: `${p.id}-`, tekst: p.plohoy_otvet, zhdem: false });
  }
} else if (flag('--fayl')) {
  repliki = fs.readFileSync(flag('--fayl'), 'utf8').split('\n').map((t) => t.trim()).filter(Boolean)
    .map((tekst, i) => ({ id: String(i + 1), tekst }));
} else {
  const tekst = arg.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!tekst) {
    console.log('Использование: proverit.js "текст" | --fayl файл.txt [--jsonl out.jsonl] | --provokacii');
    process.exit(2);
  }
  repliki = [{ id: '1', tekst }];
}

let narusheniy = 0;
let neSovpalo = 0;
const jsonl = [];
for (const r of repliki) {
  const v = FH.proverit(r.tekst, { odobrennye });
  if (!v.ok) narusheniy++;
  if (r.zhdem !== undefined && r.zhdem !== v.ok) neSovpalo++;
  const metka = v.ok ? 'ok ' : 'НАРУШЕНИЕ';
  const pochemu = v.narusheniya.map((n) => `${n.klass}/${n.kod}: «${n.fragment}»`).join('; ');
  const predupr = v.preduprezhdeniya.map((n) => `${n.kod}: «${n.fragment}»`).join('; ');
  if (!est('--tiho') || !v.ok || (r.zhdem !== undefined && r.zhdem !== v.ok)) {
    console.log(`${metka} ${r.id}  ${r.tekst.slice(0, 110)}${r.tekst.length > 110 ? '…' : ''}${pochemu ? `\n      ${pochemu}` : ''}${predupr ? `\n      предупреждение: ${predupr}` : ''}`);
  }
  jsonl.push({ content: r.tekst, label: v.ok ? 'compliant' : 'non-compliant' });
}

if (flag('--jsonl')) {
  fs.writeFileSync(flag('--jsonl'), jsonl.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`выгрузка для модели: ${flag('--jsonl')} (${jsonl.length} строк)`);
}
console.log(`\nреплик ${repliki.length}, с нарушениями ${narusheniy}${est('--provokacii') ? `, не совпало с ожиданием ${neSovpalo}` : ''}`);
process.exit(est('--provokacii') ? (neSovpalo ? 1 : 0) : (narusheniy ? 1 : 0));
