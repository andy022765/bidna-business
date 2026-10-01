// «Остались вопросы? Забронируйте звонок» — почта ДО календаря.
//
// Зачем не вести сразу в Calendly. Он спрашивает почту только у тех, кто дошёл до конца
// записи. Кто открыл календарь и бросил — для нас не существует. Требование Андрея 27.09:
// «перед бронированием звонка человек обязательно оставлял почту, чтобы если он пообщался
// и ушёл, забыл, мы могли его догнать».
//
// Что делает: записывает заявку, шлёт письмо на support@ и отдаёт адрес Calendly
// с подставленными почтой и именем (параметры `email` и `name` — по справке Calendly).
// Чего НЕ делает: не узнаёт, записался ли человек в итоге. API Calendly платный, мы от него
// отказались 25.09; догоняют Андрей и Маша руками по письму.
const { getStore } = require('@netlify/blobs');

const JSON_H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const KALENDAR = 'https://calendly.com/businessinteldna-support/30min';
const V_SUTKI = 200;                       // потолок заявок в сутки, от перебора
const POHOZH_NA_POCHTU = /^[a-z0-9+_.-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function hranilishche() {
  const name = 'zvonok-pered-calendly', consistency = 'strong';
  try { return getStore({ name, consistency }); } catch (_) {}
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  for (const token of [process.env.EV_BLOBS_TOKEN, process.env.NETLIFY_API_TOKEN].filter(Boolean)) {
    try { return getStore({ name, siteID, token, consistency }); } catch (_) {}
  }
  return null;
}

const den = () => new Date().toISOString().slice(0, 10);
const ekran = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Адрес Calendly с подставленными данными. Человек всё равно может их поправить —
// предзаполнение это удобство, а не запрет.
function kuda(pochta, imya) {
  const p = new URLSearchParams();
  p.set('email', pochta);
  if (imya) p.set('name', imya);
  return KALENDAR + '?' + p.toString();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: JSON_H, body: '{"ok":false}' };

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (_) {}
  const pochta = String(b.pochta || '').trim().toLowerCase().slice(0, 120);
  const imya = String(b.imya || '').trim().replace(/[<>"]/g, '').slice(0, 60);
  const otkuda = String(b.otkuda || '').trim().slice(0, 200);

  if (!POHOZH_NA_POCHTU.test(pochta))
    return { statusCode: 200, headers: JSON_H,
      body: JSON.stringify({ ok: false, pochemu: 'Проверьте адрес почты.' }) };

  const store = hranilishche();
  const teper = new Date().toISOString();

  // Потолок на сутки. Хранилище недоступно — не держим человека: пускаем к календарю,
  // но пишем в лог. Потерять заявку хуже, чем пропустить лишнюю.
  if (store) {
    try {
      const kVsego = `${den()}:__vsego`;
      const bylo = parseInt((await store.get(kVsego)) || '0', 10);
      if (bylo >= V_SUTKI) {
        console.log('[zvonok] суточный потолок заявок', V_SUTKI);
        return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ ok: true, kuda: kuda(pochta, imya) }) };
      }
      await store.set(kVsego, String(bylo + 1));
      await store.set(`${den()}:${Date.now()}:${pochta}`,
                      JSON.stringify({ pochta, imya, otkuda, kogda: teper }));
    } catch (e) { console.log('[zvonok] заявку не записать:', e.message); }
  } else {
    console.log('[zvonok] хранилище не поднялось, заявка только письмом');
  }

  const key = process.env.RESEND_API_KEY;
  const komu = process.env.BIDNA_MAIL || 'support@businessinteldna.com';
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: 'Business Intelligence DNA <support@businessinteldna.com>',
          to: [komu], reply_to: [pochta],
          subject: `Хочет звонок: ${pochta}`,
          html: `<p><b>Хочет звонок</b></p>`
            + `<p>Почта: ${ekran(pochta)}<br>Имя: ${ekran(imya || '—')}`
            + `<br>Со страницы: ${ekran(otkuda || '—')}<br>Время: ${ekran(teper)}</p>`
            + '<p>Записался ли он в календарь — мы не знаем: платного доступа к Calendly '
            + 'у нас нет. Если встречи не видно, догоняем письмом сами.</p>',
        }),
      });
      if (!r.ok) console.log('[zvonok] Resend отказал:', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.log('[zvonok] письмо упало:', e.message); }
  } else {
    console.log('[zvonok] RESEND_API_KEY нет, письмо не ушло:', pochta);
  }

  // К календарю пускаем в любом случае: письмо или запись могли не пройти, но человек
  // хотел записаться — не мешаем ему из-за нашей поломки.
  return { statusCode: 200, headers: JSON_H, body: JSON.stringify({ ok: true, kuda: kuda(pochta, imya) }) };
};
