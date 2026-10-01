'use strict';
/**
 * Утренняя сводка CareLine владельцу агентства (7:00 по поясу клиента), на английском.
 *
 * renderSvodka(dannye) → { tema, html, text }
 *
 * dannye — снимок в формате docs/API.md, собранный на момент отправки
 * (lib/shablony/snimok.js → sobratSnimok({ ..., seychas: 7:00 })). Из снимка берутся:
 *   vchera                итоги вчерашнего дня (звонки, кандидаты, записи, отказы, EVV)
 *   otkazy                лента отказов: вчерашние + всё, что ещё открыто
 *   kandidaty             вчерашние кандидаты: причины отказа, кто ждёт перезвона
 *   evv.posledniy/progony последняя проверка EVV
 *   sobesedovaniya        собеседования на сегодня
 *   klient, demo, sformirovano
 * Плюс необязательное поле dannye.ssylka_pult — ссылка «Open the dashboard» (https://… или путь /…).
 *
 * Письмо сверстано таблицами с inline-стилями: без <style>, картинок, скриптов и внешних ресурсов.
 * Все строки из данных экранируются. Пустой день не ломает шаблон.
 */

const YAZYKI = { en: 'English', es: 'Spanish', ru: 'Russian', zh: 'Chinese', ht: 'Haitian Creole' };
const LINII = { 'care-hiring': 'hiring line', 'care-caregivers': 'caregiver line' };
// Стенд (lib/kartochki.js) хранит HHA/PCA/CNA/net, демо-снимок — строчными: подпись без учёта регистра.
const SERT = { hha: 'HHA', pca: 'PCA', cna: 'CNA', net: 'no certificate' };
const sertPodpis = (s) => (s ? SERT[String(s).trim().toLowerCase()] || null : null);

/** Итоги звонков: [единственное, множественное]. Число ставится впереди. */
const ITOGI = {
  zapisan: ['interview booked', 'interviews booked'],
  ocenka: ['home assessment booked', 'home assessments booked'],
  ne_podhodit: ['did not qualify', 'did not qualify'],
  list_ozhidaniya: ['added to the waitlist', 'added to the waitlist'],
  perezvon: ['callback requested', 'callbacks requested'],
  otkaz_prinyat: ['call-off recorded', 'call-offs recorded'],
  soobshchenie: ['message for staff', 'messages for staff'],
  perevod: ['transferred to staff', 'transferred to staff'],
  net_soglasiya: ['declined the recorded AI call', 'declined the recorded AI call'],
  sbros: ['hung up early', 'hung up early'],
  oshibka: ['technical error', 'technical errors'],
};
const PORYADOK_ITOGOV = Object.keys(ITOGI);
const mestoItoga = (k) => { const i = PORYADOK_ITOGOV.indexOf(k); return i < 0 ? 999 : i; };

const PRICHINY = {
  net_sertifikata: 'no HHA or PCA certificate',
  tolko_cna: 'CNA only',
  vne_rayona: 'outside the service area',
  grafik: 'availability',
  net_transporta: 'no transportation',
  pravo_na_rabotu: 'work authorization',
  opyt: 'experience',
  yazyk: 'language',
  drugoe: 'other',
};

const KRITICHNO = new Set(['kritichno', 'critical', 'high', 'vysokaya', 'blokiruet']);

/** Причины отказа от смены — коды инструмента otkaz_ot_smeny; свободный текст выводится как есть. */
const PRICHINY_SMENY = { bolezn: 'illness', semya: 'family reasons', transport: 'transportation', drugoe: 'other reason' };

const CVET = {
  fon: '#eef0f4',
  karta: '#ffffff',
  chernila: '#141a3a',
  tekst: '#2b3150',
  tusklo: '#5a6078',
  liniya: '#dfe2ea',
  sinij: '#1b2557',
  zoloto: '#c69a4c',
  ok: '#1f6b45',
  vnimanie: '#8a5a00',
  ploho: '#9b2c24',
  info: '#1b2557',
};
const SHRIFT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// ---------- утилиты ----------

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const n0 = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const pl = (n, odno, mnogo) => (n === 1 ? odno : mnogo);
const chislo = (n, odno, mnogo) => `${n} ${pl(n, odno, mnogo)}`;
/** Точка в конце предложения — одна: сокращённое имя «Juana R.» в конце не даёт «Juana R..» (как fraza() в web/pult/pult.js). */
const tochka = (s) => (/[.!?…]["”»']?$/.test(s) ? s : `${s}.`);

function spisok(chasti) {
  const c = chasti.filter(Boolean);
  if (c.length <= 1) return c.join('');
  if (c.length === 2) return `${c[0]} and ${c[1]}`;
  return `${c.slice(0, -1).join(', ')} and ${c[c.length - 1]}`;
}

function bezopasnayaSsylka(u) {
  if (typeof u !== 'string') return null;
  const s = u.trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(s)) return s;
  return null;
}

function formaty(poyas) {
  const f = (o) => new Intl.DateTimeFormat('en-US', { timeZone: poyas, ...o });
  const vremya = f({ hour: 'numeric', minute: '2-digit' });
  const denKorotko = f({ weekday: 'short', month: 'short', day: 'numeric' });
  const data = f({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const ymd = (iso) => {
    const p = {};
    for (const x of data.formatToParts(new Date(iso))) p[x.type] = x.value;
    return `${p.year}-${p.month}-${p.day}`;
  };
  const dlinnyyDen = (ymdStr) => {
    const [g, m, d] = ymdStr.split('-').map(Number);
    // полдень UTC того же календарного дня: дата не уедет из-за пояса
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
      .format(new Date(Date.UTC(g, m - 1, d, 12)));
  };
  const korotkiyDen = (ymdStr) => {
    const [g, m, d] = ymdStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
      .format(new Date(Date.UTC(g, m - 1, d, 12)));
  };
  const ok = (iso) => iso && !isNaN(new Date(iso));
  return {
    ymd,
    vremya: (iso) => (ok(iso) ? vremya.format(new Date(iso)) : ''),
    denKorotko: (iso) => (ok(iso) ? denKorotko.format(new Date(iso)) : ''),
    dlinnyyDen,
    korotkiyDen,
    /** Смена: «Wed, Sep 30, 3:00 PM to 7:00 PM»; день опускается, если это den. */
    smena(start, end, den) {
      if (!ok(start)) return '';
      const s = new Date(start);
      const d = ymd(start) === den ? '' : `${denKorotko.format(s)}, `;
      return ok(end) ? `${d}${vremya.format(s)} to ${vremya.format(new Date(end))}` : `${d}${vremya.format(s)}`;
    },
  };
}

function kritichno(v) { return KRITICHNO.has(String(v || '').toLowerCase()); }

// ---------- содержание (общая часть для html и text) ----------

function sobratSoderzhanie(dannye) {
  const d = dannye || {};
  const klient = d.klient || {};
  const poyas = klient.poyas || 'America/New_York';
  const F = formaty(poyas);
  const nazvanie = klient.nazvanie || 'Your agency';
  const demo = !!d.demo;

  const segodnya = d.sformirovano ? F.ymd(d.sformirovano) : (d.segodnya && d.segodnya.data) || null;
  const v = d.vchera || {};
  const den = v.data || null;
  const zv = v.zvonki || {};
  const ka = v.kandidaty || {};
  const so = v.sobesedovaniya || {};
  const ot = v.otkazy || {};
  const ev = v.evv || {};

  const otkazy = Array.isArray(d.otkazy) ? d.otkazy : [];
  const kandidaty = Array.isArray(d.kandidaty) ? d.kandidaty : [];
  const vDen = (iso) => !!iso && !!den && F.ymd(iso) === den;

  // отказы: вчерашние, и всё, что сейчас открыто
  const otkazyVchera = otkazy.filter((o) => vDen(o.soobshcheno));
  const otkryty = otkazy.filter((o) => o.status === 'eskalaciya' || o.status === 'v_rabote');
  const nezakrytyVchera = otkazy.filter((o) => o.status === 'ne_zakryta'
    && (vDen(o.soobshcheno) || (o.smena && vDen(o.smena.start))));

  const opisatSmenu = (o) => {
    const sm = o.smena || {};
    const gde = [sm.klient_kod, sm.rayon ? `(${sm.rayon})` : null].filter(Boolean).join(' ');
    return [F.smena(sm.start, sm.end, den), gde].filter(Boolean).join(', ');
  };
  const kto = (o) => (o.sidelka && o.sidelka.imya) || 'A caregiver';
  const statusOtkaza = (o) => {
    const esk = o.eskalaciya_v ? F.vremya(o.eskalaciya_v) : null;
    switch (o.status) {
      case 'zakryta': {
        const za = o.zakryta_za_min !== null && o.zakryta_za_min !== undefined ? ` in ${chislo(o.zakryta_za_min, 'minute', 'minutes')}` : '';
        const zam = o.zamena && o.zamena.imya ? ` by ${o.zamena.imya}` : '';
        return { ton: 'ok', tekst: tochka(`Filled${za}${zam}${esk ? `, after the on-call coordinator was called at ${esk}` : ''}`) };
      }
      case 'ne_zakryta':
        return { ton: 'ploho', tekst: `Not filled.${esk ? ` The on-call coordinator was called at ${esk}.` : ''}` };
      case 'eskalaciya':
        return { ton: 'vnimanie', tekst: `Still open. The on-call coordinator was called at ${esk}.` };
      default:
        return { ton: 'info', tekst: 'Offers are out; waiting for replies.' };
    }
  };

  // что требует внимания
  const vnimanie = [];
  for (const o of otkryty) {
    vnimanie.push({
      ton: 'vnimanie',
      tekst: `Shift still open: ${opisatSmenu(o)}. ${kto(o)} called off at ${F.vremya(o.soobshcheno)}${o.eskalaciya_v ? `; the on-call coordinator was called at ${F.vremya(o.eskalaciya_v)}` : ''}.`,
    });
  }
  for (const o of nezakrytyVchera) {
    vnimanie.push({
      ton: 'ploho',
      tekst: `Shift went unfilled: ${opisatSmenu(o)}. ${kto(o)} called off at ${F.vremya(o.soobshcheno)}${o.eskalaciya_v ? `; the on-call coordinator was called at ${F.vremya(o.eskalaciya_v)}` : ''}.`,
    });
  }
  const evv = d.evv || {};
  const posl = evv.posledniy || null;
  const kritPosl = posl ? (posl.isklyucheniya || []).filter((x) => kritichno(x.vazhnost)) : [];
  if (kritPosl.length) {
    vnimanie.push({
      ton: 'ploho',
      tekst: `${chislo(kritPosl.length, 'EVV issue', 'EVV issues')} to fix before billing, from the check of ${F.denKorotko(posl.zagruzheno)}, ${F.vremya(posl.zagruzheno)}.`,
    });
  }
  const zhdutPerezvona = kandidaty.filter((k) => vDen(k.created_at) && k.podhodit === true && !k.sobesedovanie && k.status === 'new');
  if (zhdutPerezvona.length) {
    vnimanie.push({
      ton: 'info',
      tekst: tochka(`${chislo(zhdutPerezvona.length, 'qualified applicant is', 'qualified applicants are')} waiting for a callback: ${spisok(zhdutPerezvona.map((k) => k.imya || 'no name given'))}`),
    });
  }

  // звонки
  const vsegoZv = n0(zv.vsego);
  const yazyki = Object.entries(zv.po_yazykam || {}).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${YAZYKI[k] || k.toUpperCase()} ${n}`);
  const linii = Object.entries(zv.po_liniyam || {}).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${LINII[k] || k} ${n}`);
  const itogi = Object.entries(zv.po_itogam || {})
    .sort((a, b) => mestoItoga(a[0]) - mestoItoga(b[0]))
    .map(([k, n]) => (ITOGI[k] ? `${n} ${pl(n, ITOGI[k][0], ITOGI[k][1])}` : `${n} ${k.replace(/_/g, ' ')}`));
  const zvonkiStroki = vsegoZv === 0 ? ['No calls.'] : [
    `${chislo(vsegoZv, 'call', 'calls')}, ${chislo(n0(zv.minut), 'minute', 'minutes')} in total.`,
    yazyki.length ? `By language: ${yazyki.join(', ')}.` : null,
    linii.length > 1 ? `By line: ${linii.join(', ')}.` : null,
    itogi.length ? `Outcomes: ${spisok(itogi)}.` : null,
  ].filter(Boolean);

  // найм
  const kandVchera = kandidaty.filter((k) => vDen(k.created_at));
  const prichiny = {};
  for (const k of kandVchera) {
    if (k.podhodit !== false) continue;
    const p = PRICHINY[k.prichina_otkaza] || (k.prichina_otkaza ? String(k.prichina_otkaza).replace(/_/g, ' ') : 'other');
    prichiny[p] = (prichiny[p] || 0) + 1;
  }
  const prichinyTekst = Object.entries(prichiny).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`);
  const novyh = n0(ka.novyh);
  const naymStroki = [];
  if (novyh === 0) naymStroki.push('No new applicants.');
  else {
    naymStroki.push(`${chislo(novyh, 'new applicant', 'new applicants')}: ${n0(ka.podhodyat)} met your requirements, ${n0(ka.ne_podhodyat)} did not${prichinyTekst.length ? ` (${prichinyTekst.join(', ')})` : ''}.`);
  }
  naymStroki.push(n0(so.zapisano) ? `${chislo(n0(so.zapisano), 'interview', 'interviews')} booked.` : 'No interviews booked.');
  if (n0(so.naznacheno)) {
    const ostalos = n0(so.naznacheno) - n0(so.prishli) - n0(so.ne_prishli);
    naymStroki.push(`Interviews held: ${n0(so.naznacheno)} scheduled, ${n0(so.prishli)} attended, ${chislo(n0(so.ne_prishli), 'no-show', 'no-shows')}${ostalos > 0 ? `, ${ostalos} not marked yet` : ''}.`);
  }

  // отказы
  const vsegoOt = n0(ot.vsego);
  const otkazyItog = vsegoOt === 0 ? 'No call-offs.' : `${chislo(vsegoOt, 'call-off', 'call-offs')}: ${spisok([
    n0(ot.zakryto) ? `${n0(ot.zakryto)} filled${ot.mediana_min !== null && ot.mediana_min !== undefined && n0(ot.zakryto) > 1 ? ` (median ${chislo(ot.mediana_min, 'minute', 'minutes')})` : ''}` : null,
    n0(ot.eskalaciya) ? `${n0(ot.eskalaciya)} still open` : null,
    n0(ot.ne_zakryto) ? `${n0(ot.ne_zakryto)} not filled` : null,
    n0(ot.v_rabote) ? `${n0(ot.v_rabote)} waiting for replies` : null,
  ])}.`;
  const otkazySpisok = otkazyVchera.slice().sort((a, b) => new Date(a.soobshcheno) - new Date(b.soobshcheno)).map((o) => {
    const s = statusOtkaza(o);
    return {
      ton: s.ton,
      zagolovok: `${F.vremya(o.soobshcheno)}: ${kto(o)}${o.prichina ? ` (${PRICHINY_SMENY[o.prichina] || String(o.prichina).toLowerCase()})` : ''}`,
      tekst: `Shift ${opisatSmenu(o)}. ${s.tekst}`,
    };
  });

  // EVV
  const evvStroki = [];
  const evvPunkty = [];
  if (n0(ev.progonov)) {
    const progonyVchera = (evv.progony || []).filter((r) => vDen(r.zagruzheno));
    const kogda = progonyVchera.length === 1 ? ` at ${F.vremya(progonyVchera[0].zagruzheno)}` : '';
    const shtat = progonyVchera.length === 1 && progonyVchera[0].shtat ? ` against ${progonyVchera[0].shtat} rules` : '';
    evvStroki.push(`Checked ${chislo(n0(ev.strok), 'visit', 'visits')}${kogda}${shtat}: ${chislo(n0(ev.isklyucheniy), 'issue', 'issues')}, ${n0(ev.kritichnyh)} to fix before billing.`);
  } else if (posl) {
    evvStroki.push(`No EVV file was uploaded yesterday. Latest check: ${F.denKorotko(posl.zagruzheno)}, ${chislo((posl.isklyucheniya || []).length, 'issue', 'issues')}, ${kritPosl.length} to fix before billing.`);
  } else {
    evvStroki.push('No EVV checks yet. Upload a visit export from the dashboard.');
  }
  for (const x of kritPosl.slice(0, 3)) {
    const vz = x.vizit || {};
    const gde = [x.vizit_id, vz.data ? F.korotkiyDen(vz.data) : null, vz.klient_kod, vz.sidelka || vz.sidelka_id].filter(Boolean).join(', ');
    evvPunkty.push({ ton: 'ploho', zagolovok: `${x.pravilo_tekst || String(x.pravilo || 'Issue').replace(/_/g, ' ')}: ${gde}`, tekst: `${x.chto_ne_tak || ''} Fix: ${x.kak_ispravit || ''}`.trim() });
  }
  if (kritPosl.length > 3) evvStroki.push(`${kritPosl.length - 3} more to fix before billing are listed in the dashboard.`);

  // сегодняшние собеседования
  const sobesSegodnya = (Array.isArray(d.sobesedovaniya) ? d.sobesedovaniya : [])
    .filter((s) => segodnya && s.start && F.ymd(s.start) === segodnya)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((s) => ({
      vremya: F.vremya(s.start),
      tekst: `${s.imya || 'Applicant'}${[YAZYKI[s.yazyk], sertPodpis(s.sertifikat)].filter(Boolean).length ? ` (${[YAZYKI[s.yazyk], sertPodpis(s.sertifikat)].filter(Boolean).join(', ')})` : ''}`,
    }));

  // тема
  const chastiTemy = [chislo(vsegoZv, 'call', 'calls')];
  if (n0(so.zapisano)) chastiTemy.push(chislo(n0(so.zapisano), 'interview booked', 'interviews booked'));
  const nezakr = nezakrytyVchera.length + otkryty.length;
  if (nezakr) chastiTemy.push(`${chislo(nezakr, 'shift', 'shifts')} not filled`);
  else if (vsegoOt) chastiTemy.push(`${chislo(vsegoOt, 'call-off', 'call-offs')} covered`);
  if (n0(ev.kritichnyh)) chastiTemy.push(`${chislo(n0(ev.kritichnyh), 'EVV issue', 'EVV issues')} to fix`);
  const pomechen = /demo/i.test(nazvanie);
  const tema = `${demo && !pomechen ? '[DEMO] ' : ''}${nazvanie}, ${den ? F.korotkiyDen(den) : 'yesterday'}: ${chastiTemy.join(', ')}`;

  const zagolovokDnya = den ? F.dlinnyyDen(den) : 'yesterday';
  const preheader = `Yesterday: ${spisok(chastiTemy)}.${vnimanie.length ? ` ${chislo(vnimanie.length, 'item needs', 'items need')} attention.` : ''}`;

  return {
    nazvanie, demo, zagolovokDnya, preheader, tema,
    kpi: [
      { podpis: 'Calls', chislo: vsegoZv, pod: vsegoZv ? `${chislo(n0(zv.minut), 'minute', 'minutes')}` : 'none yesterday' },
      { podpis: 'New applicants', chislo: novyh, pod: novyh ? `${n0(ka.podhodyat)} met requirements` : 'none yesterday' },
      { podpis: 'Interviews booked', chislo: n0(so.zapisano), pod: n0(so.naznacheno) ? `held: ${n0(so.prishli)} attended, ${chislo(n0(so.ne_prishli), 'no-show', 'no-shows')}` : 'none held yesterday' },
      { podpis: 'Call-offs', chislo: vsegoOt, pod: vsegoOt ? `${n0(ot.zakryto)} filled${n0(ot.ne_zakryto) + n0(ot.eskalaciya) ? `, ${n0(ot.ne_zakryto) + n0(ot.eskalaciya)} not filled` : ''}` : 'none yesterday' },
    ],
    vnimanie,
    zvonkiStroki,
    naymStroki,
    otkazyItog,
    otkazySpisok,
    evvStroki,
    evvPunkty,
    sobesSegodnya,
    segodnyaTekst: segodnya ? F.dlinnyyDen(segodnya) : 'today',
    ssylka: bezopasnayaSsylka(d.ssylka_pult),
    poyas,
  };
}

// ---------- HTML ----------

const ZNAK = { ok: '&#9679;', vnimanie: '&#9650;', ploho: '&#9632;', info: '&#9675;' };
const TON_CVET = { ok: CVET.ok, vnimanie: CVET.vnimanie, ploho: CVET.ploho, info: CVET.info };

function htmlRazdel(zagolovok, telo) {
  return `
<tr><td style="padding:24px 28px 0 28px;">
  <h2 style="margin:0 0 10px 0;font-family:${SHRIFT};font-size:17px;line-height:24px;font-weight:700;color:${CVET.chernila};">${esc(zagolovok)}</h2>
  ${telo}
</td></tr>`;
}

function htmlAbzacy(stroki) {
  return stroki.map((s) => `<p style="margin:0 0 6px 0;font-family:${SHRIFT};font-size:15px;line-height:22px;color:${CVET.tekst};">${esc(s)}</p>`).join('');
}

function htmlPunkty(punkty) {
  if (!punkty.length) return '';
  const stroki = punkty.map((p) => `
    <tr>
      <td valign="top" width="22" style="width:22px;padding:2px 0 10px 0;font-family:${SHRIFT};font-size:14px;line-height:22px;color:${TON_CVET[p.ton] || CVET.info};" aria-hidden="true">${ZNAK[p.ton] || ZNAK.info}</td>
      <td valign="top" style="padding:0 0 10px 0;font-family:${SHRIFT};font-size:15px;line-height:22px;color:${CVET.tekst};">${p.zagolovok ? `<strong style="color:${CVET.chernila};">${esc(p.zagolovok)}</strong><br>` : ''}${esc(p.tekst)}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${stroki}</table>`;
}

function htmlKpi(kpi) {
  const yacheyka = (k) => `
      <td width="50%" valign="top" style="width:50%;padding:6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;background:${CVET.fon};border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <div style="font-family:${SHRIFT};font-size:13px;line-height:18px;color:${CVET.tusklo};">${esc(k.podpis)}</div>
            <div style="font-family:${SHRIFT};font-size:28px;line-height:34px;font-weight:700;color:${CVET.chernila};">${esc(k.chislo)}</div>
            <div style="font-family:${SHRIFT};font-size:13px;line-height:18px;color:${CVET.tusklo};">${esc(k.pod)}</div>
          </td></tr>
        </table>
      </td>`;
  return `
<tr><td style="padding:18px 22px 0 22px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    <tr>${yacheyka(kpi[0])}${yacheyka(kpi[1])}</tr>
    <tr>${yacheyka(kpi[2])}${yacheyka(kpi[3])}</tr>
  </table>
</td></tr>`;
}

function renderHtml(c) {
  const vnimanie = c.vnimanie.length ? `
<tr><td style="padding:22px 28px 0 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid #e3c9c5;background:#fbf1ef;border-radius:8px;">
    <tr><td style="padding:16px 18px 6px 18px;">
      <h2 style="margin:0 0 10px 0;font-family:${SHRIFT};font-size:17px;line-height:24px;font-weight:700;color:${CVET.chernila};">Needs attention</h2>
      ${htmlPunkty(c.vnimanie.map((x) => ({ ton: x.ton, tekst: x.tekst })))}
    </td></tr>
  </table>
</td></tr>` : '';

  const otkazyTelo = htmlAbzacy([c.otkazyItog]) + htmlPunkty(c.otkazySpisok);
  const evvTelo = htmlAbzacy(c.evvStroki.slice(0, 1)) + htmlPunkty(c.evvPunkty) + htmlAbzacy(c.evvStroki.slice(1));
  const sobesTelo = c.sobesSegodnya.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${c.sobesSegodnya.map((s) => `
      <tr>
        <td valign="top" width="86" style="width:86px;padding:0 0 8px 0;font-family:${SHRIFT};font-size:15px;line-height:22px;font-weight:700;color:${CVET.chernila};white-space:nowrap;">${esc(s.vremya)}</td>
        <td valign="top" style="padding:0 0 8px 0;font-family:${SHRIFT};font-size:15px;line-height:22px;color:${CVET.tekst};">${esc(s.tekst)}</td>
      </tr>`).join('')}</table>`
    : htmlAbzacy(['No interviews on the calendar today.']);

  const knopka = c.ssylka ? `
<tr><td style="padding:26px 28px 4px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr><td style="background:${CVET.sinij};border-radius:8px;">
      <a href="${esc(c.ssylka)}" style="display:inline-block;padding:13px 22px;font-family:${SHRIFT};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">Open the dashboard</a>
    </td></tr>
  </table>
</td></tr>` : '';

  const demoPolosa = c.demo ? `
<tr><td style="padding:10px 28px;background:#f3e8d2;font-family:${SHRIFT};font-size:13px;line-height:18px;color:#5c4210;">
  Demo data. All names, phone numbers and records in this summary are fictional.
</td></tr>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(c.tema)}</title>
</head>
<body style="margin:0;padding:0;background:${CVET.fon};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CVET.fon};">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${CVET.fon};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;background:${CVET.karta};border-radius:10px;overflow:hidden;">
<tr><td style="padding:22px 28px 20px 28px;background:${CVET.sinij};">
  <div style="font-family:${SHRIFT};font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.04em;color:${CVET.zoloto};">CareLine morning summary</div>
  <h1 style="margin:6px 0 2px 0;font-family:${SHRIFT};font-size:22px;line-height:28px;font-weight:700;color:#ffffff;">${esc(c.nazvanie)}</h1>
  <div style="font-family:${SHRIFT};font-size:15px;line-height:22px;color:#d6daea;">Yesterday, ${esc(c.zagolovokDnya)}</div>
</td></tr>
${demoPolosa}
${vnimanie}
${htmlKpi(c.kpi)}
${htmlRazdel('Calls', htmlAbzacy(c.zvonkiStroki))}
${htmlRazdel('Hiring', htmlAbzacy(c.naymStroki))}
${htmlRazdel('Call-offs and replacements', otkazyTelo)}
${htmlRazdel('EVV visit check', evvTelo)}
${htmlRazdel(`Interviews today, ${c.segodnyaTekst}`, sobesTelo)}
${knopka}
<tr><td style="padding:26px 28px 26px 28px;">
  <p style="margin:0;padding-top:16px;border-top:1px solid ${CVET.liniya};font-family:${SHRIFT};font-size:12px;line-height:18px;color:${CVET.tusklo};">
    CareLine answers your hiring and caregiver lines with an AI voice assistant. Every call starts with a notice that the caller is talking to an AI and that the call is recorded. This summary is built from yesterday's call records and uploads. Times are shown in ${esc(c.poyas === 'America/New_York' ? 'Eastern Time' : c.poyas)}.
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

// ---------- текст ----------

function renderText(c) {
  const L = [];
  const punkt = (p) => `- ${p.zagolovok ? `${tochka(p.zagolovok)} ` : ''}${p.tekst}`;
  L.push(`CareLine morning summary`);
  L.push(c.nazvanie);
  L.push(`Yesterday, ${c.zagolovokDnya}`);
  if (c.demo) L.push('', 'Demo data. All names, phone numbers and records in this summary are fictional.');
  if (c.vnimanie.length) {
    L.push('', 'NEEDS ATTENTION');
    for (const x of c.vnimanie) L.push(punkt(x));
  }
  L.push('', 'AT A GLANCE');
  for (const k of c.kpi) L.push(`${k.podpis}: ${k.chislo} (${k.pod})`);
  L.push('', 'CALLS', ...c.zvonkiStroki);
  L.push('', 'HIRING', ...c.naymStroki);
  L.push('', 'CALL-OFFS AND REPLACEMENTS', c.otkazyItog);
  for (const p of c.otkazySpisok) L.push(punkt(p));
  L.push('', 'EVV VISIT CHECK', c.evvStroki[0]);
  for (const p of c.evvPunkty) L.push(punkt(p));
  for (const s of c.evvStroki.slice(1)) L.push(s);
  L.push('', `INTERVIEWS TODAY, ${c.segodnyaTekst.toUpperCase()}`);
  if (c.sobesSegodnya.length) for (const s of c.sobesSegodnya) L.push(`${s.vremya}  ${s.tekst}`);
  else L.push('No interviews on the calendar today.');
  if (c.ssylka) L.push('', `Open the dashboard: ${c.ssylka}`);
  L.push('', `CareLine answers your hiring and caregiver lines with an AI voice assistant. Every call starts with a notice that the caller is talking to an AI and that the call is recorded. Times are shown in ${c.poyas === 'America/New_York' ? 'Eastern Time' : c.poyas}.`);
  return `${L.join('\n')}\n`;
}

// ---------- вход ----------

function renderSvodka(dannye) {
  const c = sobratSoderzhanie(dannye);
  return { tema: c.tema, html: renderHtml(c), text: renderText(c) };
}

module.exports = { renderSvodka };
