// Плохие отзывы: приём, черновик ответа, тревога владельцу по-русски, решения по кнопкам.
//
// ОТКУДА ОТЗЫВ С ТЕКСТОМ В v1: владелец вставляет его на странице /otzyv (ссылка в каждой тревоге
// и в отчёте). Письма Google менеджеру (быстрее и с текстом) — после первого клиента, который добавит
// support@ менеджером (PLAN-DLYA-ANDREYA п. 5). Опрос карточки даёт только числа — по ним уходит
// тревога без текста (lib/slezhenie.js).
//
// ЧТО СЧИТАЕМ ПЛОХИМ: 1–3★ (trevoga.zvyozd_do) и 4★ с жалобой — владелец отметил галочку или в тексте
// есть слова жалобы. Остальное принимаем, тревоги нет.
//
// ХРАНИЛИЩЕ: otzyv/<клиент>/<ГГГГ-ММ-ДД>/<id> — звёзды, автор, текст (его дал владелец, не Google),
// черновик, решение. Хранится 90 дней, как журнал.

const crypto = require('crypto');
const H = require('./hranilishche');
const V = require('./vremya');
const L = require('./limity');
const P = require('./pisma');
const SH = require('./shablony');
const C = require('./claude');

const ZHALOBA_EN = /\b(but|however|unfortunately|disappoint\w*|rude|late|waited|waiting|never|worst|terrible|awful|dirty|overcharg\w*|problem|issue|complain\w*)\b/i;
const ZHALOBA_RU = /(^|[^\p{L}])(но|однако|к сожалению|разочаров\p{L}*|груб\p{L}*|опозд\p{L}*|ждал\p{L}*|долго|плохо|грязн\p{L}*|проблем\p{L}*|жалоб\p{L}*)(?=$|[^\p{L}])/iu;
const ZHALOBA = { test: (t) => ZHALOBA_EN.test(t) || ZHALOBA_RU.test(t) };

const klOtzyv = (k, id) => `otzyv/${k.klient}/${id}`;
const ID = /^\d{4}-\d{2}-\d{2}\/[0-9a-f]{12}$/;

function negativ(k, zvyozd, tekst, zhaloba) {
  if (zvyozd <= k.trevoga.zvyozd_do) return true;
  return zvyozd === 4 && (!!zhaloba || ZHALOBA.test(String(tekst || '')));
}

// Принять отзыв от владельца. Вернёт { id, negativ }.
async function prinyat(s, k, o) {
  const teper = Date.now();
  const id = `${V.mestnyyDen(teper, k.biznes.poyas)}/${crypto.randomBytes(6).toString('hex')}`;
  const neg = negativ(k, o.zvyozd, o.tekst, o.zhaloba);
  const rec = { id, istochnik: 'vladelec', t: teper, zvyozd: o.zvyozd, avtor: o.avtor || '', tekst: o.tekst || '',
                zhaloba: !!o.zhaloba, negativ: neg, status: neg ? 'zhdet_chernovik' : 'ne_negativ' };
  if (!(await H.polozhit(s, klOtzyv(k, id), rec))) return null;
  return { id, negativ: neg };
}

// Совпадение автора с записью Веры — только подсказка («возможно, это…») и только вне медицины.
async function poiskVery(s, k, avtor, t) {
  if (k.biznes.medicina) return [];
  const imya = String(avtor || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^\p{L}'-]/gu, '');
  if (imya.length < 2) return [];
  const ot = V.mestnyyDen(t - 21 * V.DEN_MS, k.biznes.poyas);
  const aktiv = (await H.spisok(s, `aktiv/${k.klient}/`)) || [];
  const arhiv = ((await H.spisok(s, `arhiv/${k.klient}/`)) || []).filter(x => x.split('/')[2] >= ot);
  const out = [];
  for (const key of [...arhiv, ...aktiv].slice(-200)) {
    const r = await H.vzyat(s, key);
    if (!r || r.istochnik !== 'vera' || !r.imya || !r.konec || r.konec > t) continue;
    if (String(r.imya).trim().split(/\s+/)[0].toLowerCase() !== imya) continue;
    out.push({ imya: String(r.imya).slice(0, 40), kogda: V.korotko(r.konec, k.biznes.poyas), konec: r.konec });
  }
  return out.sort((a, b) => b.konec - a.konec).slice(0, 2).map(({ imya: i, kogda }) => ({ imya: i, kogda }));
}

// Черновик + письмо владельцу. Зовёт фоновая функция chernovik-background сразу после приёма.
async function obrabotat(s, k, id) {
  if (!ID.test(String(id || ''))) return { itog: 'id' };
  const rec = await H.vzyat(s, klOtzyv(k, id));
  if (!rec) return { itog: 'net' };
  if (rec.status !== 'zhdet_chernovik') return { itog: 'uzhe', status: rec.status };
  // Выключатель действует и здесь: выключено — ни Claude, ни писем. Отзыв остаётся ждать.
  const vk = await L.vklyuchen(s);
  if (!vk.vklyucheno || !k.vklyuchen) { console.log('[trevoga] выключено, черновик не пишу:', vk.pochemu || 'паспорт выключен'); return { itog: 'vyklyucheno' }; }
  const teper = Date.now();
  // Замок на черновик: повторный вызов фоновой функции (Netlify повторяет упавшие, владелец жмёт
  // «Прислать ответ» дважды) не должен звать Claude и писать владельцу второй раз. Замок старше
  // 16 минут (фоновая функция живёт до 15) считается брошенным — черновик можно писать заново.
  const zk = `zamok-chernovik/${k.klient}/${id}`;
  const z = await H.pervym(s, zk, { t: teper });
  if (z === null) return { itog: 'sboy' };
  if (z === false) {
    const byl = await H.vzyat(s, zk);
    if (byl && teper - byl.t < 16 * 60000) return { itog: 'uzhe', status: 'v_rabote' };
    await H.polozhit(s, zk, { t: teper });
  }
  rec.chernovik = await C.chernovik(s, { biznes: k.biznes.imya, medicina: k.biznes.medicina, obrazcy: k.trevoga.obrazcy_otvetov,
                                         zvyozd: rec.zvyozd, avtor: rec.avtor, tekst: rec.tekst });
  rec.chernovik.t = Date.now();
  rec.tekst_otveta = rec.chernovik.ok ? rec.chernovik.tekst : '';
  const sovpadeniya = await poiskVery(s, k, rec.avtor, rec.t);
  rec.status = 'zhdet_resheniya';

  // Письмо владельцу — в пределах суточного потолка тревог. Сверх потолка отзыв и черновик остаются
  // на странице решения, письма нет (в журнале функции — причина).
  const lk = L.kl.trevogi(k, teper);
  let pismo = { ok: false, propushcheno: true };
  if (await L.estMesto(s, lk, k.trevoga.v_sutki)) {
    pismo = await P.poslat(SH.pismoTrevoga(k, { id, zvyozd: rec.zvyozd, avtor: rec.avtor, tekst: rec.tekst,
      kogda: V.korotko(rec.t, k.biznes.poyas), chernovik: rec.chernovik, sovpadeniya }),
      `otzyvy-trevoga-${k.klient}-${id.replace('/', '-')}`, { suhoy: P.suhoyLi(k) });
    if (pismo.ok) await H.pribavit(s, lk);
  } else console.log('[trevoga] потолок тревог владельцу на сутки, письмо не шлю:', k.klient, id);
  rec.pismo = { ok: !!pismo.ok, suhoy: !!pismo.suhoy, t: teper };
  await H.polozhit(s, klOtzyv(k, id), rec);
  return { itog: 'ok', chernovik: rec.chernovik.ok, pismo: !!pismo.ok };
}

// Тревога без текста по опросу карточки. Одна на каждый новый счётчик отзывов.
async function bezTeksta(s, k, bylo, stalo, a) {
  const teper = Date.now();
  if (!(await L.vklyuchen(s)).vklyucheno) return { itog: 'vyklyucheno' };
  // Потолок — до замка: иначе тревога сверх потолка терялась насовсем (замок на это число отзывов стоял).
  const lk = L.kl.trevogi(k, teper);
  if (!(await L.estMesto(s, lk, k.trevoga.v_sutki))) { console.log('[trevoga] потолок тревог, без письма:', k.klient); return { itog: 'potolok' }; }
  // Замок от двойной тревоги на одно и то же число отзывов (параллельный прогон, сбой записи отпечатка).
  // Лежит под lim/ с датой — чистка убирает его через 14 дней, как счётчики.
  if (!(await H.pervym(s, `lim/opros/${k.klient}-${stalo.count}/${V.utcDen(teper)}`, { t: teper }))) return { itog: 'uzhe' };
  const id = `${V.mestnyyDen(teper, k.biznes.poyas)}/${crypto.randomBytes(6).toString('hex')}`;
  // В записи — только признак и границы оценки, без чисел Google (они в письме владельцу и у нас не лежат).
  const rec = { id, istochnik: 'opros', t: teper, tochno: !!a.tochno, lo: a.lo, hi: a.hi, novyh: a.novyh, negativ: true, status: 'bez_teksta' };
  await H.polozhit(s, klOtzyv(k, id), rec);
  const r = await P.poslat(SH.pismoTrevogaBezTeksta(k, { bylo, stalo, kogda: V.korotko(teper, k.biznes.poyas), tochno: !!a.tochno }),
    `otzyvy-opros-${k.klient}-${stalo.count}`, { suhoy: P.suhoyLi(k) });
  if (r.ok) await H.pribavit(s, lk);
  return { itog: r.ok ? 'ok' : 'ne_ushlo' };
}

// Решение владельца со страницы (POST): opublikoval · net · pravka (+ новый текст ответа).
async function reshit(s, k, id, d, tekst) {
  if (!ID.test(String(id || ''))) return { itog: 'id' };
  const rec = await H.vzyat(s, klOtzyv(k, id));
  if (!rec) return { itog: 'net' };
  if (rec.reshenie && ['opublikoval', 'net'].includes(rec.reshenie.d)) return { itog: 'uzhe', rec };
  if (d === 'pravka') {
    const t = String(tekst || '').replace(/\r/g, '').trim().slice(0, 2000);
    if (t.length < 5) return { itog: 'pusto', rec };
    rec.tekst_otveta = t;
    rec.reshenie = { d: 'pravka', t: Date.now() };
  } else if (d === 'opublikoval' || d === 'net') {
    rec.reshenie = { d, t: Date.now() };
    rec.status = d === 'opublikoval' ? 'opublikovan' : 'bez_otveta';
  } else return { itog: 'd', rec };
  if (!(await H.polozhit(s, klOtzyv(k, id), rec))) return { itog: 'sboy', rec };
  return { itog: 'ok', rec };
}

module.exports = { prinyat, obrabotat, bezTeksta, reshit, negativ, poiskVery, klOtzyv, ZHALOBA, ID };
