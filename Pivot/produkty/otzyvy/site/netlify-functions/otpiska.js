// Отписка навсегда (CAN-SPAM + RFC 8058). Адрес /otpiska?t=<подпись> стоит и в подвале письма,
// и в заголовке List-Unsubscribe.
//  • GET — страница с кнопкой. НИЧЕГО не меняет: почтовые сканеры открывают ссылки сами, и обычная
//    ссылка молча отписывала бы людей (PLAN-V1 п. 3).
//  • POST — отписка. Так приходит и кнопка на странице, и «Отписаться» из интерфейса Gmail/Yahoo
//    (тело List-Unsubscribe=One-Click). Отписка — на пару «бизнес + адрес», навсегда, срок ссылки не ограничен.
// Хранится только отпечаток адреса: сам адрес в отписке не лежит.
const blobs = require('@netlify/blobs');
const N = require('../lib/nachalo');
const H = require('../lib/hranilishche');
const K = require('../lib/kartochka');
const S = require('../lib/podpis');
const V = require('../lib/vremya');
const { stranica, E } = require('../lib/stranica');
N.podklyuchit(blobs);

const T = {
  en: { zag: 'Unsubscribe', vopros: (b) => `Stop review requests from ${b} to this address?`, knopka: 'Unsubscribe',
        gotovo_zag: 'You are unsubscribed', gotovo: (b) => `${b} will not send review requests to this address again.`,
        net_zag: 'Link not recognized', net: 'This unsubscribe link is damaged. Reply to the email and ask to be removed — we will do it by hand.',
        sboy_zag: 'Something went wrong', sboy: 'We could not save that just now. Please try again in a minute or reply to the email.' },
  ru: { zag: 'Отписка', vopros: (b) => `Больше не присылать на этот адрес просьбы об отзыве от ${b}?`, knopka: 'Отписаться',
        gotovo_zag: 'Вы отписаны', gotovo: (b) => `${b} больше не пришлёт на этот адрес просьбу об отзыве.`,
        net_zag: 'Ссылка не распознана', net: 'Ссылка отписки повреждена. Ответьте на письмо и попросите убрать вас из рассылки — сделаем вручную.',
        sboy_zag: 'Не получилось', sboy: 'Не удалось сохранить. Попробуйте через минуту или ответьте на письмо.' },
};

exports.handler = async (event) => {
  H.nachat(event);
  const q = event.queryStringParameters || {};
  const d = S.proverit(q.t, 'o');
  const y = d && d.y === 'ru' ? 'ru' : 'en';
  const t = T[y];
  if (!d || !/^[a-z0-9-]{2,30}$/.test(d.k || '') || !/^[0-9a-f]{32}$/.test(d.h || '')) return stranica(400, t.net_zag, `<p>${E(t.net)}</p>`, { yazyk: y });
  const k = K.vzyat(d.k);
  const b = k ? k.biznes.imya : (y === 'ru' ? 'этого бизнеса' : 'this business');

  if (event.httpMethod === 'POST') {
    const s = H.store('otzyvy');
    const teper = Date.now();
    const z = await H.pervym(s, `otpiska/${d.k}/${d.h}`, { t: teper });
    if (z === null) return stranica(503, t.sboy_zag, `<p>${E(t.sboy)}</p>`, { yazyk: y });
    if (z) await H.polozhit(s, `otpiska-zhurnal/${d.k}/${V.mestnyyMesyac(teper, k ? k.biznes.poyas : 'UTC')}/${d.h}`, { t: teper });
    console.log('[otpiska]', z ? 'отписан' : 'уже был отписан', d.k);
    return stranica(200, t.gotovo_zag, `<p>${E(t.gotovo(b))}</p>`, { yazyk: y });
  }
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return stranica(405, t.net_zag, '', { yazyk: y });
  const deystvie = '/otpiska?t=' + encodeURIComponent(q.t);
  return stranica(200, t.zag, `<p>${E(t.vopros(b))}</p><form method="post" action="${E(deystvie)}"><button type="submit">${E(t.knopka)}</button></form>`, { yazyk: y });
};
