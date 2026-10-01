'use strict';
// №43 NightDesk — промпты nightdesk/prompty/*.md против листа правды и шаблонов fair housing.
// Агент говорит только то, что есть в листе: поменял факт в листе — тест покажет, какой промпт отстал.
// Запуск: node --test test/nd-prompty.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../lib/nightdesk/sortirovka.js');

const ND = path.join(__dirname, '..', '..', 'nightdesk');
const chitat = (p) => JSON.parse(fs.readFileSync(path.join(ND, p), 'utf8'));
const L = chitat('list-pravdy/harborrow.json');
const SH = chitat('fair-housing/shablony.json').shablony;
const PF = chitat('prompty/pervye-frazy.json');
const P = {};
for (const f of ['after-hours.en', 'after-hours.es', 'leasing.en', 'leasing.es']) {
  P[f] = fs.readFileSync(path.join(ND, 'prompty', `${f}.md`), 'utf8');
}
const yaz = (f) => f.split('.')[1];
const est = (f, t) => assert.ok(P[f].includes(t), `${f}.md: нет «${t.slice(0, 90)}${t.length > 90 ? '…' : ''}»`);
const estBezRegistra = (f, t) => assert.ok(P[f].toLowerCase().includes(t.toLowerCase()), `${f}.md: нет «${t}»`);
const RASKRYTIE_ES = 'Le recuerdo que soy un asistente de inteligencia artificial, no una persona, y esta llamada se graba como transcripción de texto.';
const RASKRYTIE_EN = "Just a reminder: I'm an AI assistant, not a person, and this call is recorded as a text transcript.";

test('первые фразы: раскрытие ИИ и записи на обоих языках; у ночной линии — 911 в первой фразе', () => {
  for (const liniya of ['nd-after-hours', 'nd-leasing']) {
    assert.match(PF[liniya].en, /AI assistant, not a person/);
    assert.match(PF[liniya].en, /recorded as a text transcript/);
    assert.match(PF[liniya].es, /asistente de inteligencia artificial/);
    assert.match(PF[liniya].es, /no una persona/);
    assert.match(PF[liniya].es, /se graba como transcripción de texto/);
  }
  assert.match(PF['nd-after-hours'].en, /nine-one-one/);
  assert.match(PF['nd-after-hours'].es, /nueve uno uno/);
});

test('часы и календарь от телефонии; раскрытие при смене языка', () => {
  for (const f of Object.keys(P)) {
    for (const v of ['{{system__time}}', '{{ofis_seychas}}', '{{kalendar}}', '{{system__caller_id}}']) est(f, v);
    est(f, RASKRYTIE_ES);
    if (yaz(f) === 'es') est(f, RASKRYTIE_EN);
    assert.match(P[f], /AI assistant|asistente de inteligencia artificial/);
  }
});

test('911: точные фразы первыми словами; на линии лизинга — тоже', () => {
  est('after-hours.en', 'Please hang up and call nine-one-one now.');
  est('after-hours.en', 'Leave the apartment now and call nine-one-one from outside.');
  est('after-hours.es', 'Por favor, cuelgue y llame al nueve uno uno ahora.');
  est('after-hours.es', 'Salga del apartamento ahora y llame al nueve uno uno desde afuera.');
  est('leasing.en', 'Please hang up and call nine-one-one now.');
  est('leasing.es', 'Por favor, cuelgue y llame al nueve uno uno ahora.');
  for (const k of S.UGROZA_VSEGDA) { est('after-hours.en', k); est('after-hours.es', k); }
});

test('линия лизинга: каждый шаблон fair housing дословно, на своём языке', () => {
  for (const [k, v] of Object.entries(SH)) {
    est('leasing.en', v.en);
    est('leasing.es', v.es);
    assert.ok(k);
  }
  // и фраза про ваучеры на втором языке — на случай, если пресет языка не подхватится
  est('leasing.en', SH.vauchery.es);
  est('leasing.es', SH.vauchery.en);
  // ночная линия на вопрос о соседях отвечает тем же шаблоном
  est('after-hours.en', SH.sosedi.en);
  est('after-hours.es', SH.sosedi.es);
});

test('линия лизинга: факты всех шести объявлений — словами листа', () => {
  for (const o of L.obyavleniya) {
    for (const f of ['leasing.en', 'leasing.es']) {
      const y = yaz(f);
      estBezRegistra(f, o[`arenda_vsluh_${y}`]);
      estBezRegistra(f, o[`svobodna_vsluh_${y}`]);
      for (const pole of ['zhivotnye', 'parkovka', 'kommunalnye', 'osobennosti']) est(f, o[pole][y]);
      est(f, o.sbory[y]);
      est(f, `(code ${o.id})`.replace('code', y === 'es' ? 'código' : 'code'));
    }
  }
  est('leasing.en', L.pokazy.s_agentom.vsluh_en);
  est('leasing.es', L.pokazy.s_agentom.vsluh_es);
  est('leasing.en', L.pokazy.samostoyatelnyy.vsluh_en);
  est('leasing.es', L.pokazy.samostoyatelnyy.vsluh_es);
  est('leasing.en', L.sms.vopros_en);
  est('leasing.es', L.sms.vopros_es);
});

test('ночная линия: ответы жильцам, правило тепла NYC, заявка и SMS — словами листа', () => {
  const kluchi = ['arenda', 'penya', 'tishina', 'pereezd', 'zhivotnye', 'kurenie', 'kontakty', 'shum_seychas'];
  for (const k of kluchi) {
    est('after-hours.en', L.zhiltsam[k].en);
    est('after-hours.es', L.zhiltsam[k].es);
  }
  est('after-hours.es', L.zhiltsam.krupnyy_musor.es);
  for (const d of L.doma) {
    est('after-hours.en', d.stirka.vsluh_en);
    est('after-hours.es', d.stirka.vsluh_es);
    est('after-hours.es', d.musor.es);
    est('after-hours.es', d.posylki.es);
  }
  est('after-hours.es', L.doma.find((d) => d.id === 'seawell').parkovka.es);
  est('after-hours.en', 'twenty spaces, one hundred seventy-five dollars a month');
  est('after-hours.en', L.avarii.teplo_nyc.vsluh_en);
  est('after-hours.es', L.avarii.teplo_nyc.vsluh_es);
  estBezRegistra('after-hours.en', L.avarii.teplo_nyc.sezon_vsluh_en);
  estBezRegistra('after-hours.es', L.avarii.teplo_nyc.sezon_vsluh_es);
  est('after-hours.en', L.zayavki.chto_dalshe_en);
  est('after-hours.es', L.zayavki.chto_dalshe_es);
  est('after-hours.en', L.sms.vopros_en);
  est('after-hours.es', L.sms.vopros_es);
  for (const d of L.doma) { est('after-hours.en', d.nazvanie_vsluh); est('after-hours.en', d.adres_vsluh_en); est('after-hours.es', d.adres_vsluh_es); }
});

test('ночная линия: все категории движка в таблице, все коды dalshe описаны', () => {
  for (const f of ['after-hours.en', 'after-hours.es']) {
    for (const k of Object.keys(S.KATEGORII)) est(f, k);
    for (const d of ['SPROSIT', '911', 'PEREVOD', 'ZAYAVKA', 'SOOBSHCHENIE', 'INFO']) est(f, `dalshe ${d}`);
    for (const pole of ['lyudi_v_opasnosti', 'voda_u_elektriki', 'voda_aktivno', 'ohvat', 'temperatura_vnutri', 'otoplenie_sovsem_net', 'v_lifte_lyudi']) est(f, pole);
  }
});

test('таблица категорий: ★ стоит ровно там, где движок первым спрашивает о людях', () => {
  for (const f of ['after-hours.en', 'after-hours.es']) {
    const stroki = P[f].split('\n').filter((s) => /^\| [a-z_]/.test(s));
    assert.ok(stroki.length >= 15, `${f}: таблица категорий не найдена`);
    let kodov = 0;
    for (const s of stroki) {
      const yacheyka = s.split('|')[1];
      const zvezda = yacheyka.includes('★');
      for (const k of yacheyka.replace('★', '').split('·').map((x) => x.trim()).filter(Boolean)) {
        assert.ok(S.KATEGORII[k], `${f}: неизвестный код ${k}`);
        const v = S.sortirovat({ kategoriya: k }, L.avarii, { moment: '2026-10-07T02:10:00-04:00' });
        assert.equal(!!(v.sprosit && v.sprosit.pole === 'lyudi_v_opasnosti'), zvezda, `${f}: ${k} — ★ не совпадает с движком`);
        kodov++;
      }
    }
    assert.equal(kodov, Object.keys(S.KATEGORII).length - S.UGROZA_VSEGDA.length, `${f}: в таблице не все категории кроме угроз`);
  }
});

test('инструменты: всё названное в промптах существует; у каждой линии — свои', () => {
  const imena = new Set(fs.readdirSync(path.join(ND, 'instrumenty')).filter((f) => f.endsWith('.json'))
    .map((f) => chitat(`instrumenty/${f}`).tool_config.name));
  for (const f of Object.keys(P)) {
    for (const m of P[f].match(/\b[a-z_]+_nightdesk_demo\b/g) || []) assert.ok(imena.has(m), `${f}: нет инструмента ${m}`);
  }
  for (const f of ['after-hours.en', 'after-hours.es']) {
    for (const t of ['nayti_zhilca_nightdesk_demo', 'sortirovka_nightdesk_demo', 'perevod_nightdesk_demo', 'sozdat_zayavku_nightdesk_demo']) est(f, t);
  }
  for (const f of ['leasing.en', 'leasing.es']) {
    for (const t of ['svobodnye_okna_nightdesk_demo', 'zapisat_pokaz_nightdesk_demo', 'otpravit_ssylku_nightdesk_demo', 'sohranit_lida_nightdesk_demo', 'perevod_nightdesk_demo']) est(f, t);
    assert.ok(!P[f].includes('sortirovka_nightdesk_demo'), `${f}: лизинг не сортирует аварии — передаёт на линию жильцов`);
  }
});

test('ни одной суммы и ни одного номера телефона не из листа', () => {
  const dopustimo = {
    en: ['twenty', 'fifty', 'one hundred seventy-five', ...L.obyavleniya.map((o) => o.arenda_vsluh_en.replace(/ dollars a month$/, ''))],
    es: ['veinte', 'cincuenta', 'ciento setenta y cinco', ...L.obyavleniya.map((o) => o.arenda_vsluh_es.replace(/ dólares al mes$/, ''))],
  };
  for (const f of Object.keys(P)) {
    assert.ok(!/\$\s?\d/.test(P[f]), `${f}: сумма цифрами`);
    assert.ok(!/\+1\d{10}/.test(P[f]), `${f}: номер цифрами`);
    const slovo = yaz(f) === 'es' ? /dólares/gi : /dollars/gi;
    let m;
    while ((m = slovo.exec(P[f])) !== null) {
      const okno = P[f].slice(Math.max(0, m.index - 70), m.index).toLowerCase();
      assert.ok(dopustimo[yaz(f)].some((d) => okno.includes(d.toLowerCase())), `${f}: сумма не из листа рядом с «${okno.slice(-50)}»`);
    }
  }
  // телефон офиса — только словами листа
  est('after-hours.en', L.kompaniya.ofis.telefon_vsluh_en);
  est('after-hours.es', L.kompaniya.ofis.telefon_vsluh_es);
});

test('«guaranteed» и «compliant» встречаются только в запретах', () => {
  for (const f of Object.keys(P)) {
    for (const stroka of P[f].split('\n')) {
      if (/guarantee|garantiza|compliant|cumplimos/i.test(stroka)) {
        assert.match(stroka, /Never|Nunca/, `${f}: ${stroka.trim().slice(0, 100)}`);
      }
    }
  }
});

test('приёмка: перевод только по аварии или при открытом офисе; без перевода вне часов — прописано', () => {
  est('after-hours.en', 'When the office is CLOSED you never call perevod_nightdesk_demo for anything that is not an emergency on our list.');
  est('after-hours.es', 'Cuando la oficina está CLOSED, nunca llame a perevod_nightdesk_demo para algo que no sea una emergencia de nuestra lista.');
  est('leasing.en', 'Never call perevod_nightdesk_demo when the office is CLOSED.');
  est('leasing.es', 'Nunca llame a perevod_nightdesk_demo cuando la oficina está CLOSED.');
  est('leasing.en', 'Shall I book it?');
  est('leasing.es', '¿Lo reservo?');
});
