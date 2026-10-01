'use strict';
// Итог звонка: ElevenLabs post-call webhook (post_call_transcription) → карточка звонка `zvonki/<conversation_id>`
// → журнал согласий → журнал действий. Подпись — как у zvonok.js Веры: «t=…,v0=…», HMAC-SHA256, не старше 30 минут.
//
// Линия — по agent_id (linii.json), запасной путь — по номеру, на который звонили (system__called_number).
// Повтор вебхука не пишет второй раз: замок zvonki-itog/<conversation_id>; зависшую обработку (>90 с) можно повторить.
// Согласия: из data_collection агента (soglasie_zapis, soglasie_ii, sms_soglasie), если агент их собирает;
// иначе — по первой реплике: раскрыл ли агент ИИ и запись, и продолжил ли человек разговор.
// Словари: namerenie/itog агента (data_collection) переводятся в словарь пульта; факт сервера (запись, отказ,
// карточка в этом разговоре) сильнее слов агента. Писем по каждому звонку нет (звонки — в пульте и сводке в 7:00);
// письмо координатору уходит, только если агент оставил поле soobshchenie (сообщение для человека).
//
// env: CARELINE_WEBHOOK_SECRET — HMAC-секрет СВОЕГО вебхука итога (на Маке он CARELINE_DEMO_WEBHOOK_SECRET).
//      Не ELEVENLABS_WEBHOOK_SECRET: так в ~/.bidna-golos.env называется секрет живой Веры (README, «Переменные»).

const { json, syroeTelo, htmlIzTeksta } = require('../lib/http');
const otpravka = require('../lib/otpravka');
const { elevenlabsPodpisVerna } = require('../lib/podpisi');
const linii = require('../lib/linii');
const H = require('../lib/hranilishche');
const { zapisat } = require('../lib/zhurnal');
const { iso, seychas, POYAS } = require('../lib/vremya');
const { razgovorId, razgovor, obnovitSoglasiya, bul } = require('../lib/kartochki');

// Границы слова — юникодные: в JS \b не видит кириллицу, и «\bИИ\b» не сработал бы никогда.
const RASKRYTIE_II = /(?:^|[^\p{L}])(?:A\.?I\.?|IA|ИИ)(?=[^\p{L}]|$)|artificial intelligence|virtual assistant|automated assistant|inteligencia artificial|asistente virtual|искусствен|виртуальн/iu;
const RASKRYTIE_ZAPISI = /record|grabad|grabac|записыва/i;
const NAMERENIYA = new Set(['rabota', 'semya', 'otkaz', 'drugoe']);
// Словарь агентов CareLine (data_collection namerenie, KONTRAKT.md «Дополнения care») → словарь пульта.
const NAMERENIE_AGENTA = { kandidat: 'rabota', semya: 'semya', otkaz: 'otkaz', smena_seychas: 'drugoe',
  soobshchenie: 'drugoe', spam: 'drugoe', drugoe: 'drugoe' };
const ITOGI = new Set(['zapisan', 'ocenka', 'ne_podhodit', 'list_ozhidaniya', 'perezvon', 'otkaz_prinyat', 'soobshchenie',
  'perevod', 'net_soglasiya', 'sbros', 'oshibka']);

function iz(dc, imya) {
  const v = dc[imya];
  if (v === undefined || v === null) return null;
  const z = typeof v === 'object' ? (v.value ?? v.result ?? null) : v;
  return z === null || z === 'null' || z === 'None' || z === '' ? null : z;
}

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'POST') return json(405, {});
  const raw = syroeTelo(event);
  const h = event.headers || {};
  const zag = Object.entries(h).find(([k]) => k.toLowerCase() === 'elevenlabs-signature');
  const pr = elevenlabsPodpisVerna(raw, zag ? zag[1] : '');
  if (!pr.ok) {
    console.log('[itog] отбой:', pr.pochemu);
    return json(401, {});
  }
  let b;
  try { b = JSON.parse(raw); } catch (_) { return json(400, {}); }
  if (b.type && b.type !== 'post_call_transcription') return json(200, { propushcheno: b.type });

  const d = b.data || b;
  const conv = razgovorId(d.conversation_id);
  const meta = d.metadata || {};
  const analiz = d.analysis || {};
  const dv = (d.conversation_initiation_client_data && d.conversation_initiation_client_data.dynamic_variables) || {};
  const tel = meta.phone_call || {};
  const l = linii.poAgentu(d.agent_id) || linii.poNomeru(dv.system__called_number || tel.agent_number || '');
  if (!l) {
    console.log('[itog] агент не из linii.json — пропускаю');
    return json(200, { ok: false, pochemu: 'neizvestnyy_agent' });
  }
  if (!conv) return json(200, { ok: false, pochemu: 'net_conversation_id' });
  const klient = linii.klient(l.klient);
  let st = null;
  try { st = klient && H.hranilishcheKlienta(klient.id); } catch (_) { st = null; }
  if (!st) return json(503, { ok: false, pochemu: 'hranilishche' });   // ElevenLabs повторит
  const poyas = klient.poyas || POYAS;

  const teper = seychas();
  const byl = await st.getJSON(`zvonki/${conv}`);
  if (byl && byl.obrabotan) return json(200, { ok: true, povtor: true });
  const z = await st.zamok(`zvonki-itog/${conv}`, { at: teper }, { perekhvat: (s) => teper - Number(s.at || 0) > 90000 });
  if (!z.nash) return json(200, { ok: true, povtor: true });

  try {
    const dc = analiz.data_collection_results || {};
    const rz = await razgovor(st, conv);
    const transkript = Array.isArray(d.transcript) ? d.transcript : [];
    const pervaya = transkript.find((r) => r.role === 'agent' && r.message);
    const chelovekGovoril = transkript.some((r) => r.role === 'user' && r.message);
    const raskrytieII = !!(pervaya && RASKRYTIE_II.test(pervaya.message));
    const raskrytieZapisi = !!(pervaya && RASKRYTIE_ZAPISI.test(pervaya.message));

    const zapisi = (rz && rz.zapisi) || {};
    const soglasiya = {
      zapis: bul(iz(dc, 'soglasie_zapis')) ?? (raskrytieZapisi && chelovekGovoril ? true : null),
      ii: bul(iz(dc, 'soglasie_ii')) ?? (raskrytieII && chelovekGovoril ? true : null),
    };
    // Словари намерений и итогов — те же, что у пульта и сводки (lib/shablony, web/pult/demo.json).
    const kandidat = rz && rz.kandidat_id ? await st.getJSON(`kandidaty/${rz.kandidat_id}`) : null;
    const namerenieAgenta = iz(dc, 'namerenie') ? String(iz(dc, 'namerenie')).trim().toLowerCase() : null;
    // Факт сервера (что реально сохранено в этом разговоре) сильнее слов агента.
    const namerenie = rz && rz.otkaz_id ? 'otkaz' : rz && rz.kandidat_id ? 'rabota' : rz && rz.semya_id ? 'semya'
      : NAMERENIYA.has(namerenieAgenta) ? namerenieAgenta : NAMERENIE_AGENTA[namerenieAgenta] || 'drugoe';
    const itogAgenta = iz(dc, 'itog') ? String(iz(dc, 'itog')).trim().toLowerCase() : null;
    const soobshchenieKoordinatoru = String(iz(dc, 'soobshchenie') || '').trim().slice(0, 1000);
    const itog = soglasiya.zapis === false || soglasiya.ii === false ? 'net_soglasiya'
      : zapisi.sobesedovanie ? 'zapisan'
      : zapisi.ocenka ? 'ocenka'
      : rz && rz.otkaz_id ? 'otkaz_prinyat'
      : rz && rz.perevod ? 'perevod'
      : kandidat && kandidat.podhodit === false ? 'list_ozhidaniya'
      : ITOGI.has(itogAgenta) ? itogAgenta
      : !chelovekGovoril ? 'sbros'
      : 'soobshchenie';
    const sms = bul(iz(dc, 'sms_soglasie'));
    const yazykSyroy = String(iz(dc, 'yazyk') || meta.main_language || dv.system__language || l.yazyk || 'en').toLowerCase().slice(0, 2);
    const telefon = linii.e164(dv.system__caller_id || tel.external_number || '') || (rz && rz.telefon)
      || linii.e164(iz(dc, 'telefon') || '') || null;
    const nachaloMs = Number(meta.start_time_unix_secs) > 0 ? Number(meta.start_time_unix_secs) * 1000 : teper;

    const kartochka = {
      conversation_id: conv,
      liniya: l.liniya,
      agent_id: d.agent_id || null,
      nachalo: iso(nachaloMs, poyas),
      dlitelnost_s: Math.max(0, Math.round(Number(meta.call_duration_secs) || 0)),
      yazyk: /^[a-z]{2}$/.test(yazykSyroy) ? yazykSyroy : 'en',
      namerenie,
      itog,
      // kratko — одна-две фразы по-английски для пульта и сводки: поле агента, иначе резюме платформы.
      kratko: String(iz(dc, 'kratko') || analiz.transcript_summary || '').slice(0, 1500),
      namerenie_agenta: namerenieAgenta,
      itog_agenta: itogAgenta,
      imya: iz(dc, 'imya') ? String(iz(dc, 'imya')).slice(0, 80) : null,
      soobshchenie: soobshchenieKoordinatoru || null,
      soglasiya,
      raskrytie_ii: raskrytieII,
      telefon,
      kandidat_id: (rz && rz.kandidat_id) || null,
      semya_id: (rz && rz.semya_id) || null,
      otkaz_id: (rz && rz.otkaz_id) || null,
      zapisi: Object.keys(zapisi).length ? zapisi : null,
      uspeh: analiz.call_successful || null,
      obrabotan: true,
      poluchen: iso(teper, poyas),
    };
    await st.setJSON(`zvonki/${conv}`, kartochka);

    if (telefon) {
      await obnovitSoglasiya(st, telefon, { zapis: soglasiya.zapis, ii: soglasiya.ii, ...(sms !== null ? { sms } : {}) },
                             { istochnik: 'call', kto: 'itog', poyas, obekt: `zvonki/${conv}` });
    }
    // Карточке кандидата — отметка, что человек подтвердил согласия в этом звонке.
    if (kartochka.kandidat_id && (soglasiya.zapis !== null || soglasiya.ii !== null)) {
      await st.obnovit(`kandidaty/${kartochka.kandidat_id}`, (k) => {
        if (!k) return undefined;
        k.soglasiya = Object.assign({ zapis: null, ii: null, sms: null }, k.soglasiya || {});
        if (soglasiya.zapis !== null) k.soglasiya.zapis = soglasiya.zapis;
        if (soglasiya.ii !== null) k.soglasiya.ii = soglasiya.ii;
        return k;
      });
    }
    // Сообщение координатору (поле soobshchenie итога — отдельного инструмента нет): письмо, ключ дублей — разговор.
    if (soobshchenieKoordinatoru && (klient.pisma && klient.pisma.koordinatoru || []).length) {
      const kto = [kartochka.imya, telefon].filter(Boolean).join(', ') || 'caller';
      const tekstPisma = `Message from ${kto} (${l.liniya}, ${kartochka.nachalo}):\n\n${soobshchenieKoordinatoru}\n\nCall summary: ${kartochka.kratko || '—'}`;
      await otpravka.pismo(st, klient, { komu: klient.pisma.koordinatoru, tema: `${klient.nazvanie}: message from ${kto}`,
        text: tekstPisma, html: htmlIzTeksta(tekstPisma), klyuchDubley: `soobshchenie:${conv}`, kto: 'itog', obekt: `zvonki/${conv}` });
    }
    await zapisat(st, { kto: 'itog', chto: 'zvonok_itog', obekt: `zvonki/${conv}`,
                        detali: { liniya: l.liniya, namerenie, itog, dlitelnost_s: kartochka.dlitelnost_s, raskrytie_ii: raskrytieII,
                                  soobshchenie: !!soobshchenieKoordinatoru } }, { poyas });
    return json(200, { ok: true });
  } catch (e) {
    console.log('[itog] упало:', e && e.message);
    try { await st.delete(`zvonki-itog/${conv}`); } catch (_) {}
    return json(500, { ok: false });   // ElevenLabs повторит
  }
};
