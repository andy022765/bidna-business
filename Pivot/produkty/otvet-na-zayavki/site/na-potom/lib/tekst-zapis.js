// ОТЛОЖЕНО 29.09.2026 (запись — в Calendly, см. na-potom/CHITAT.md). В выкладку не входит.
//
// Ссылки на окна и запись по клику.
//
// ССЫЛКА НЕ ЗАПИСЫВАЕТ. Письма открывают сканеры (Safe Links, почтовые антивирусы) и ходят
// по каждой ссылке. Поэтому ссылка ведёт на страницу с кнопкой, а запись — только по POST.
//
// ТОКЕН. 16 случайных байт, хранится у нас: `t:<клиент>:<токен>` → заявка, окно, почта, язык.
// Подпись не нужна — угадать 128 бит нельзя, а всё, что важно, лежит на сервере, не в ссылке.
//
// ДВОЙНАЯ ЗАПИСЬ. Три линии, по порядку:
//   1. `bron-lock:<клиент>:<заявка>` (onlyIfNew) — одна заявка записывается один раз, даже если
//      человек нажал два разных времени в двух вкладках;
//   2. `slot:<календарь>:<время>` (onlyIfNew) — два текстовых лида не займут одно окно; метка живёт
//      только пока идёт вставка, дальше занятость показывает сам календарь;
//   3. после вставки события перечитываем календарь на этом интервале. Нашлось чужое событие
//      (Вера записала голосом в ту же секунду, владелец поставил встречу руками) — удаляем СВОЁ
//      и предлагаем другое время. Уступаем всегда мы: Вера после записи не перепроверяет,
//      значит, только так на одном времени не окажутся двое.
//
// Гостя в событие не ставим: служебный аккаунт не умеет приглашать (403
// forbiddenForServiceAccounts, проверено 25.09 в kalendar-zapis.js). Человек узнаёт о встрече
// только из нашего письма — поэтому письмо после записи обязательное.

const crypto = require('crypto');
const G = require('./gkal');
const H = require('../../lib/hranilishche');
const O = require('./tekst-okna');
const K = require('./kartochka-zapis');   // склеенный паспорт: dopKalendarya

const HRAN = 'otvet';
const TOKEN_OK = /^[A-Za-z0-9_-]{22}$/;

const novyToken = () => crypto.randomBytes(16).toString('base64url');
const kTok = (k, t) => `t:${k.klient}:${t}`;
const kBron = (k, z) => `bron:${k.klient}:${z}`;
const kBronLock = (k, z) => `bron-lock:${k.klient}:${z}`;
const kSlot = (kal, iso) => `slot:${kal}:${new Date(iso).toISOString()}`;

// Выдать ссылки на окна. null — хранилища нет, и ссылки выдавать нельзя: они не откроются.
async function vydatTokeny(k, lid, okna) {
  const s = H.store(HRAN);
  if (!s) return null;
  const zhivet = (k.kalendar.ssylka_zhivet_dney || 7) * 864e5;
  const out = [];
  for (const slot of okna) {
    const t = novyToken();
    const ok = await H.polozhit(s, kTok(k, t), {
      z: lid.z, slot, pochta: lid.pochta, imya: lid.imya || '', yazyk: lid.yazyk,
      produkt: lid.produkt, forma: lid.forma || '', stranica: lid.stranica || '',
      sozdan: Date.now(), istekaet: Math.min(new Date(slot).getTime(), Date.now() + zhivet),
    });
    if (!ok) return null;
    out.push({ token: t, slot });
  }
  return out;
}

async function prochitat(k, t) {
  if (!TOKEN_OK.test(String(t || ''))) return null;
  return H.vzyat(H.store(HRAN), kTok(k, t));
}

async function bronZayavki(k, z) { return H.vzyat(H.store(HRAN), kBron(k, z)); }

// Свежие окна для того же человека: после «занято» и «время прошло».
// Лимит, чтобы страницу нельзя было дёргать бесконечно и жечь запросы к календарю.
async function novyeOkna(k, lid) {
  const r = await O.triOkna(K.dopKalendarya(k), k.kalendar.skolko_okon);
  if (!r.ok || !r.okna.length) return { ok: false, oshibka: r.oshibka || 'окон нет', ssylki: [] };
  const ssylki = await vydatTokeny(k, lid, r.okna);
  if (!ssylki) return { ok: false, oshibka: 'хранилище', ssylki: [] };
  return { ok: true, ssylki };
}

// Замок с защитой от «вечного» замка: если функция упала между замком и бронью (таймаут, сбой),
// замок остался бы навсегда и человек больше не записался бы никогда. Замок старше двух минут,
// за которым нет брони, считаем брошенным: снимаем и пробуем один раз заново.
const ZAMOK_ZHIVET = 120000;
async function vzyatZamok(s, klyuch, obj, estBron) {
  let r = await H.pervym(s, klyuch, obj);
  if (r !== false) return r;
  const byl = await H.vzyat(s, klyuch);
  if (byl && Date.now() - (byl.kogda || 0) > ZAMOK_ZHIVET && !(await estBron(byl))) {
    console.log('[zapis] брошенный замок, снимаю:', klyuch);
    await H.ubrat(s, klyuch);
    r = await H.pervym(s, klyuch, obj);
  }
  return r;
}

function peresekaetsya(e, ot, do_) {
  const nachalo = new Date((e.start && (e.start.dateTime || e.start.date)) || 0).getTime();
  const konec = new Date((e.end && (e.end.dateTime || e.end.date)) || 0).getTime();
  return nachalo < do_ && konec > ot;
}

// Главное. Возвращает { status, ... }:
//   zapisano — встреча в календаре (id, htmlLink, slot, lid);
//   uzhe     — эта заявка уже записана (slot) или записывается прямо сейчас;
//   zanyato  — окно успели занять;
//   isteklo  — окно прошло или до него меньше порога;
//   net      — токена нет или он кривой;
//   oshibka  — календарь или хранилище не ответили (записать не получилось, говорить «записано» нельзя).
async function zapisat(k, t) {
  const s = H.store(HRAN);
  if (!s) return { status: 'oshibka', pochemu: 'хранилище' };
  const lid = await prochitat(k, t);
  if (!lid) return { status: 'net' };

  const uzhe = await bronZayavki(k, lid.z);
  if (uzhe) return { status: 'uzhe', slot: uzhe.slot, lid };

  const start = new Date(lid.slot).getTime();
  const porog = (k.kalendar.ne_ranshe_pri_zapisi_chasov || 1) * 3600e3;
  if (start - Date.now() < porog) return { status: 'isteklo', lid };

  const dop = K.dopKalendarya(k);
  if (!dop.kalendar) return { status: 'oshibka', pochemu: 'нет OTVET_KALENDAR_ID', lid };

  // Линия 1: одна заявка — одна запись.
  const zamok = await vzyatZamok(s, kBronLock(k, lid.z), { t, slot: lid.slot, kogda: Date.now() },
    async () => !!(await bronZayavki(k, lid.z)));
  if (zamok === false) {
    const b = await bronZayavki(k, lid.z);
    return { status: 'uzhe', slot: b ? b.slot : lid.slot, idet: !b, lid };
  }
  if (zamok === null) return { status: 'oshibka', pochemu: 'хранилище (замок заявки)', lid };
  const otpustit = async () => { await H.ubrat(s, kBronLock(k, lid.z)); };

  // Свежая проверка занятости у Google, не верим ссылке на слово.
  const p = await O.svobodnoLi(dop, lid.slot);
  if (!p.ok) { await otpustit(); return { status: 'oshibka', pochemu: 'календарь: ' + p.oshibka, lid }; }
  if (!p.svobodno) { await otpustit(); return { status: 'zanyato', lid }; }

  // Линия 2: окно между текстовыми лидами.
  const slotKey = kSlot(dop.kalendar, lid.slot);
  const zamokSlota = await vzyatZamok(s, slotKey, { z: lid.z, kogda: Date.now() },
    async (byl) => !!(byl && byl.z && await bronZayavki(k, byl.z)));
  if (zamokSlota === false) { await otpustit(); return { status: 'zanyato', lid }; }
  if (zamokSlota === null) console.log('[zapis] метку слота не поставить, держимся на перепроверке после вставки');
  const otpustitSlot = async () => { if (zamokSlota) await H.ubrat(s, slotKey); };

  const dlina = k.kalendar.dlina_min;
  const konec = new Date(start + dlina * 60000);
  const kto = lid.imya || lid.pochta;
  const opisanie = [
    'Записано из письма-ответа на заявку (текстовый администратор).',
    lid.imya ? 'Имя: ' + lid.imya : '',
    'Почта: ' + lid.pochta,
    lid.produkt ? 'Интерес: ' + lid.produkt : '',
    lid.forma ? 'Форма: ' + lid.forma : '',
    lid.stranica ? 'Страница: ' + lid.stranica : '',
    'Заявка: ' + lid.z,
    'Гость в событие не добавлен: служебный аккаунт не может приглашать. Подтверждение человеку ушло письмом.',
  ].filter(Boolean).join('\n');

  let ins;
  try {
    ins = await G.gapi('/calendars/' + encodeURIComponent(dop.kalendar) + '/events', {
      summary: 'Звонок · ' + kto,
      description: opisanie,
      start: { dateTime: new Date(start).toISOString(), timeZone: dop.poyas },
      end: { dateTime: konec.toISOString(), timeZone: dop.poyas },
    });
  } catch (e) { ins = { kod: 0, telo: { oshibka: e.message } }; }
  if (ins.kod !== 200 || !ins.telo || !ins.telo.id) {
    console.log('[zapis] Google не записал:', ins.kod, JSON.stringify(ins.telo).slice(0, 200));
    await otpustitSlot(); await otpustit();
    return { status: 'oshibka', pochemu: 'Google: ' + ins.kod, lid };
  }
  const id = ins.telo.id;

  // Линия 3: перечитываем интервал с тем же запасом, с каким считали занятость.
  const zapas = (k.kalendar.zapas_min || 0) * 60000;
  const ot = start - zapas, do_ = konec.getTime() + zapas;
  let perepr = null;
  try {
    perepr = await G.gapi('/calendars/' + encodeURIComponent(dop.kalendar) + '/events?' + new URLSearchParams({
      timeMin: new Date(ot).toISOString(), timeMax: new Date(do_).toISOString(),
      singleEvents: 'true', showDeleted: 'false', maxResults: '50',
    }).toString());
  } catch (e) { perepr = { kod: 0, telo: {} }; }
  let predupr = '';
  if (perepr.kod === 200) {
    const chuzhie = (perepr.telo.items || []).filter(e => e.id !== id && e.status !== 'cancelled'
      && e.transparency !== 'transparent' && peresekaetsya(e, ot, do_));
    if (chuzhie.length) {
      console.log('[zapis] на это время уже есть событие, уступаем:', chuzhie.map(e => e.id).join(','));
      let ud;
      try { ud = await G.gapi('/calendars/' + encodeURIComponent(dop.kalendar) + '/events/' + encodeURIComponent(id), undefined, 'DELETE'); }
      catch (e) { ud = { kod: 0 }; }
      if (ud.kod !== 204 && ud.kod !== 200 && ud.kod !== 410) {
        // Удалить своё не вышло — теперь на времени двое. Молчать нельзя: владелец узнаёт из письма.
        await polozhitBron(s, k, lid, { slot: lid.slot, id, t, konflikt: true });
        await otpustitSlot();
        return { status: 'zapisano', id, htmlLink: ins.telo.htmlLink || '', slot: lid.slot, lid,
                 predupr: 'НА ЭТО ВРЕМЯ ЕСТЬ ДРУГАЯ ВСТРЕЧА, а удалить нашу не получилось (код ' + ud.kod + '). Разведите руками.' };
      }
      await otpustitSlot(); await otpustit();
      return { status: 'zanyato', lid, ustupili: true };
    }
  } else {
    predupr = 'Перепроверка календаря после записи не прошла (код ' + perepr.kod + '). До записи окно было свободно; на всякий случай взгляните на календарь.';
    console.log('[zapis] перепроверка не прошла:', perepr.kod);
  }

  await polozhitBron(s, k, lid, { slot: lid.slot, id, t });
  // Метка слота нужна только на время вставки. Дальше правду говорит сам календарь: если владелец
  // удалит встречу, окно должно снова стать доступным, а висящая метка держала бы его вечно.
  await otpustitSlot();
  return { status: 'zapisano', id, htmlLink: ins.telo.htmlLink || '', slot: lid.slot, lid, predupr };
}

async function polozhitBron(s, k, lid, bron) {
  const ok = await H.polozhit(s, kBron(k, lid.z), Object.assign({ kogda: Date.now() }, bron));
  if (!ok) console.log('[zapis] бронь не записалась в хранилище — повторный клик может записать ещё раз; замок заявки держит');
}

module.exports = { vydatTokeny, prochitat, zapisat, novyeOkna, bronZayavki, HRAN, TOKEN_OK };
