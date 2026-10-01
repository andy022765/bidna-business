'use strict';
// Отправка наружу: письма (Resend), SMS и звонки (Twilio). Единственное место, где стенд говорит с людьми.
//
// DRY_RUN=1 ПО УМОЛЧАНИЮ (KONTRAKT.md, запрет 4). Пока переменная не равна ровно «0», ничего не уходит:
// в журнал клиента пишется, что ушло бы (от кого, кому, текст). Вживую — только после «да» Андрея
// и только с заданным отправителем (nastroyki.json: pisma.ot, sms.ot — решение Андрея, в коде не угадываем).
//
// Защиты, которые действуют и в холостом режиме (чтобы прогоны проверяли то же, что будет вживую):
//   - ключ дублей: одно письмо/SMS на ключ (замок `otpravleno/<хэш ключа>`); письмо о записи — ключ по встрече;
//   - потолок в сутки на клиента (`schetchiki/<дата>`: pisem, sms, ishodyashchih): свои счётчики у каждого клиента,
//     общих с Верой нет;
//   - SMS только с согласием; отписка (STOP) сильнее любого согласия.

const crypto = require('crypto');
const { zapisat } = require('./zhurnal');
const { seychas, iso, denKlyuch, POYAS } = require('./vremya');
const { e164 } = require('./linii');

const suhoy = () => String(process.env.DRY_RUN ?? '1').trim() !== '0';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const POCHTA_OK = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function spisokPochty(komu) {
  const a = Array.isArray(komu) ? komu : String(komu || '').split(',');
  return [...new Set(a.map((x) => String(x || '').trim().toLowerCase()).filter((x) => x.length <= 120 && POCHTA_OK.test(x)))];
}

// Счётчик на сутки: +1, если не упёрлись в предел. {ok, n, posledneye}.
async function schetchik(st, pole, limit, poyas) {
  const kl = `schetchiki/${denKlyuch(seychas(), poyas)}`;
  let bylo = 0, upor = false;
  await st.obnovit(kl, (o) => {
    const x = o || {};
    bylo = Number(x[pole] || 0);
    if (limit && bylo >= limit) { upor = true; return undefined; }
    x[pole] = bylo + 1;
    return x;
  });
  if (upor) return { ok: false, n: bylo };
  return { ok: true, n: bylo + 1, posledneye: !!limit && bylo + 1 >= limit };
}
async function otkatSchetchika(st, pole, poyas) {
  const kl = `schetchiki/${denKlyuch(seychas(), poyas)}`;
  try {
    await st.obnovit(kl, (o) => {
      if (!o || !o[pole]) return undefined;
      o[pole] = Math.max(0, Number(o[pole]) - 1);
      return o;
    });
  } catch (e) { console.log('[otpravka] счётчик не откатился:', e.message); }
}

async function bron(st, klyuchDubley, kanal) {
  if (!klyuchDubley) return { nash: true, kl: null };
  const kl = `otpravleno/${sha(klyuchDubley).slice(0, 40)}`;
  const nash = await st.zanyat(kl, { at: iso(seychas()), kanal, klyuch: String(klyuchDubley).slice(0, 200) });
  return { nash, kl };
}
async function snyatBron(st, kl) {
  if (!kl) return;
  try { await st.delete(kl); } catch (e) { console.log('[otpravka] бронь не снялась:', e.message); }
}

async function twilioApi(put, telo, { metod } = {}) {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const tok = process.env.TWILIO_AUTH_TOKEN || '';
  if (!sid || !tok) return { kod: 0, telo: { oshibka: 'нет ключей Twilio' } };
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}${put}`, {
    method: metod || (telo ? 'POST' : 'GET'),
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'),
               ...(telo ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body: telo ? new URLSearchParams(telo).toString() : undefined,
  });
  const tekst = await r.text();
  let d;
  try { d = JSON.parse(tekst); } catch (_) { d = { syroe: tekst.slice(0, 200) }; }
  return { kod: r.status, telo: d };
}

// ── письмо ──────────────────────────────────────────────────────────────────
async function pismo(st, klient, { komu, tema, html, text, klyuchDubley, otvet, kto = 'sistema', obekt = null } = {}) {
  const poyas = (klient && klient.poyas) || POYAS;
  const adresa = spisokPochty(komu);
  if (!adresa.length) return { ok: false, pochemu: 'net_adresa' };

  const b = await bron(st, klyuchDubley, 'email');
  if (!b.nash) {
    await zapisat(st, { kto, chto: 'pismo_dubl_propushcheno', obekt, detali: { klyuch: klyuchDubley } }, { poyas });
    return { ok: true, uzhe: true };
  }
  const lim = Number(klient && klient.limity && klient.limity.pisem_v_sutki) || 60;
  const s = await schetchik(st, 'pisem', lim, poyas);
  if (!s.ok) {
    await snyatBron(st, b.kl);
    await zapisat(st, { kto, chto: 'pismo_potolok', obekt, detali: { limit: lim, tema } }, { poyas });
    return { ok: false, pochemu: 'potolok' };
  }

  const ot = (klient && klient.pisma && klient.pisma.ot) || null;
  const otvetNa = otvet || (klient && klient.pisma && klient.pisma.otvet) || null;
  if (suhoy()) {
    await zapisat(st, { kto, chto: 'pismo_dry_run', obekt, detali: {
      ot: ot || '(отправитель не задан — решение Андрея)', komu: adresa, otvet: otvetNa, tema,
      text: String(text || '').slice(0, 3000), klyuch: klyuchDubley || null } }, { poyas });
    return { ok: true, dry_run: true, posledneye: s.posledneye };
  }

  const key = process.env.RESEND_API_KEY;
  if (!ot || !key) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'pisem', poyas)]);
    await zapisat(st, { kto, chto: 'pismo_ne_nastroeno', obekt, detali: { net: !ot ? 'отправителя' : 'ключа Resend', tema } }, { poyas });
    return { ok: false, pochemu: !ot ? 'net_otpravitelya' : 'net_klyucha' };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json',
                 ...(klyuchDubley ? { 'Idempotency-Key': sha(klyuchDubley).slice(0, 64) } : {}) },
      body: JSON.stringify({ from: ot, to: adresa, subject: tema, html, text,
                             ...(otvetNa ? { reply_to: [otvetNa] } : {}) }),
    });
    const t = await r.text();
    if (!r.ok) {
      await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'pisem', poyas)]);
      await zapisat(st, { kto, chto: 'pismo_oshibka', obekt, detali: { status: r.status, tema } }, { poyas });
      return { ok: false, pochemu: 'resend', kod: r.status };
    }
    let id = null;
    try { id = JSON.parse(t).id || null; } catch (_) {}
    await zapisat(st, { kto, chto: 'pismo_otpravleno', obekt, detali: { komu: adresa, tema, id } }, { poyas });
    return { ok: true, id, posledneye: s.posledneye };
  } catch (e) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'pisem', poyas)]);
    await zapisat(st, { kto, chto: 'pismo_oshibka', obekt, detali: { oshibka: e.message, tema } }, { poyas });
    return { ok: false, pochemu: 'set' };
  }
}

// ── SMS ─────────────────────────────────────────────────────────────────────
// soglasie: true — вызывающий знает согласие (карточка сиделки); иначе смотрим soglasiya/<телефон>.
// otvetNaVhodyashchee: ответ человеку, который только что написал нам сам, — положительного согласия
// не требует, но отписку уважает.
// podtverzhdenieOtpiski: единственное сообщение «вы отписаны» в ответ на STOP-слово, которое Twilio не знает
// (СТОП, BAJA…) — его разрешено отправить уже отписанному номеру.
async function sms(st, klient, { ot, komu, tekst, klyuchDubley, soglasie, otvetNaVhodyashchee = false, podtverzhdenieOtpiski = false, kto = 'sistema', obekt = null } = {}) {
  const poyas = (klient && klient.poyas) || POYAS;
  const nomer = e164(komu);
  if (!nomer) return { ok: false, pochemu: 'net_nomera' };
  const zapisSogl = await st.getJSON(`soglasiya/${nomer}`);
  if (zapisSogl && zapisSogl.sms === false && !podtverzhdenieOtpiski) {
    await zapisat(st, { kto, chto: 'sms_blok_otpiska', obekt, detali: { komu: nomer } }, { poyas });
    return { ok: false, pochemu: 'otpiska' };
  }
  if (!otvetNaVhodyashchee && !podtverzhdenieOtpiski && !(soglasie === true || (zapisSogl && zapisSogl.sms === true))) {
    await zapisat(st, { kto, chto: 'sms_blok_net_soglasiya', obekt, detali: { komu: nomer } }, { poyas });
    return { ok: false, pochemu: 'net_soglasiya' };
  }
  const b = await bron(st, klyuchDubley, 'sms');
  if (!b.nash) return { ok: true, uzhe: true };
  const lim = Number(klient && klient.limity && klient.limity.sms_v_sutki) || 200;
  const s = await schetchik(st, 'sms', lim, poyas);
  if (!s.ok) {
    await snyatBron(st, b.kl);
    await zapisat(st, { kto, chto: 'sms_potolok', obekt, detali: { limit: lim } }, { poyas });
    return { ok: false, pochemu: 'potolok' };
  }
  const otNomer = e164(ot) || e164(klient && klient.sms && klient.sms.ot) || null;
  const telo = String(tekst || '').slice(0, 640);
  if (suhoy()) {
    await zapisat(st, { kto, chto: 'sms_dry_run', obekt, detali: {
      ot: otNomer || '(номер линии не куплен)', komu: nomer, tekst: telo, klyuch: klyuchDubley || null } }, { poyas });
    return { ok: true, dry_run: true };
  }
  if (!otNomer) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'sms', poyas)]);
    await zapisat(st, { kto, chto: 'sms_ne_nastroeno', obekt, detali: { net: 'номера отправителя' } }, { poyas });
    return { ok: false, pochemu: 'net_otpravitelya' };
  }
  try {
    const r = await twilioApi('/Messages.json', { From: otNomer, To: nomer, Body: telo });
    if (r.kod !== 201 && r.kod !== 200) {
      await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'sms', poyas)]);
      await zapisat(st, { kto, chto: 'sms_oshibka', obekt, detali: { status: r.kod, komu: nomer } }, { poyas });
      return { ok: false, pochemu: 'twilio', kod: r.kod };
    }
    await zapisat(st, { kto, chto: 'sms_otpravleno', obekt, detali: { komu: nomer, sid: r.telo && r.telo.sid } }, { poyas });
    return { ok: true, sid: r.telo && r.telo.sid };
  } catch (e) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'sms', poyas)]);
    return { ok: false, pochemu: 'set' };
  }
}

// ── исходящий звонок (побудка дежурного) ────────────────────────────────────
// Потолок в сутки на клиента — limity.ishodyashchih_v_sutki (по умолчанию 10), счётчик schetchiki/<дата>.ishodyashchih.
// Считается и в холостом режиме (как письма и SMS): прогон проверяет то же, что будет вживую. Упёрлись — звонка нет,
// в журнале zvonok_potolok, вызывающий решает, что вместо (budit шлёт письмо координатору).
async function zvonok(st, klient, { ot, komu, url, statusUrl, klyuchDubley, opisanie, kto = 'sistema', obekt = null } = {}) {
  const poyas = (klient && klient.poyas) || POYAS;
  const nomer = e164(komu);
  if (!nomer) return { ok: false, pochemu: 'net_nomera' };
  const b = await bron(st, klyuchDubley, 'zvonok');
  if (!b.nash) return { ok: true, uzhe: true };
  const lim = Number(klient && klient.limity && klient.limity.ishodyashchih_v_sutki) || 10;
  const s = await schetchik(st, 'ishodyashchih', lim, poyas);
  if (!s.ok) {
    await snyatBron(st, b.kl);
    await zapisat(st, { kto, chto: 'zvonok_potolok', obekt, detali: { limit: lim, komu: nomer } }, { poyas });
    return { ok: false, pochemu: 'potolok' };
  }
  const otNomer = e164(ot) || null;
  if (suhoy()) {
    await zapisat(st, { kto, chto: 'zvonok_dry_run', obekt, detali: {
      ot: otNomer || '(номер линии не куплен)', komu: nomer, opisanie: String(opisanie || '').slice(0, 500) } }, { poyas });
    return { ok: true, dry_run: true };
  }
  if (!otNomer || !url) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'ishodyashchih', poyas)]);
    return { ok: false, pochemu: 'ne_nastroeno' };
  }
  try {
    const r = await twilioApi('/Calls.json', {
      To: nomer, From: otNomer, Url: url, Method: 'POST', Timeout: '25',
      ...(statusUrl ? { StatusCallback: statusUrl, StatusCallbackMethod: 'POST', StatusCallbackEvent: 'completed' } : {}),
    });
    if (r.kod !== 201 && r.kod !== 200) {
      await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'ishodyashchih', poyas)]);
      await zapisat(st, { kto, chto: 'zvonok_oshibka', obekt, detali: { status: r.kod, komu: nomer } }, { poyas });
      return { ok: false, pochemu: 'twilio', kod: r.kod };
    }
    await zapisat(st, { kto, chto: 'zvonok_nachat', obekt, detali: { komu: nomer, sid: r.telo && r.telo.sid } }, { poyas });
    return { ok: true, sid: r.telo && r.telo.sid };
  } catch (e) {
    await Promise.all([snyatBron(st, b.kl), otkatSchetchika(st, 'ishodyashchih', poyas)]);
    return { ok: false, pochemu: 'set' };
  }
}

module.exports = { suhoy, pismo, sms, zvonok, twilioApi, spisokPochty, schetchik, POCHTA_OK };
