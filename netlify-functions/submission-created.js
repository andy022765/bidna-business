// Netlify event function: fires on every verified form submission.
// Emails the intake to Andrii with the full document as a TRUE attachment (via Resend).
// Requires env var RESEND_API_KEY. If unset, it no-ops (built-in Netlify email still works).
exports.handler = async (event) => {
  try {
    console.log('[intake] v5 handler start');
    const key = process.env.RESEND_API_KEY;
    if (!key) { console.log('[intake] no RESEND_API_KEY set'); return { statusCode: 200, body: 'no key' }; }

    const parsed = JSON.parse(event.body || '{}');
    const payload = parsed.payload || parsed;
    const data = payload.data || {};
    const contact = data.contact || '(contact missing)';
    const clientEmail = (data.client_email || '').trim();
    const clientName  = (data.client_name  || '').trim();
    const formName = payload.form_name || data['form-name'] || 'intake';
      // Подарочные анкеты (24-25.09.2026): та же форма и тот же файл, но смонтированы
      // по своим адресам со скрытым полем `produkt` в статике. Подарков теперь два —
      // к кварталу видимости и к Вере, письма у них отличаются одной строкой.
      const produkt = (data.produkt || '');
      const podarok = produkt.indexOf('podarok-') === 0;
      const kChemu   = produkt === 'podarok-vera' ? 'Вере' : 'кварталу по видимости';
      const kChemuEn = produkt === 'podarok-vera' ? 'Vera' : 'your visibility quarter';
      // Английская анкета шлёт форму с суффиксом -en. До 24.09 письмо ей уходило
      // РУССКОЕ: ветка была одна. Заметил, когда ставил английский подарочный адрес.
      const poEn = /-en$/.test(formName);
    const seg = formName === 'intake-expert' ? 'expert' : 'business';
    const to = process.env.BIDNA_MAIL || 'support@businessinteldna.com';

    // Resend + кириллица: тело уходит как JSON с \uXXXX вместо русских букв.
    // Тот же приём, что ниже в ветке лидов — вынесен сюда, чтобы не повторять трижды.
    async function poslat(pismo) {
      const raw = JSON.stringify(pismo);
      let body = '';
      for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        body += c > 127 ? ('\\u' + ('000' + c.toString(16)).slice(-4)) : raw[i];
      }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: body,
      });
      return r.status;
    }

    // ── лист правды к приёмке линии (23.09.2026) ────────────────────────────
    // Отдельной веткой, потому что без неё анкета падала в ветку интейка: владельцу
    // ушло бы «Новый интейк на диагностику», а человеку — «Анкета получена, осталось
    // выбрать время» со ссылкой на стратсессию. Это другой продукт и другой следующий шаг.
    if (formName === 'list-pravdy-en' || formName === 'list-pravdy-ru') {
      const poRu = formName === 'list-pravdy-ru';
      // Один и тот же лист правды покупают ДВА продукта. Анкета общая, смысл разный:
      // приёмке он нужен, чтобы сверять линию с его же словами; Вере — чтобы отвечать
      // ими клиентам. Различаем скрытым полем, которое генератор кладёт по адресу.
      const dlyaVery = String(data.produkt || '').trim() === 'vera';
      const em = (data.client_email || data.email || '').trim();
      const nm = (data.client_name || '').trim() || '(имя не указано)';
      let vlozhenie = [];
      const att = data.attachment;
      if (att && att.url) {
        const rr = await fetch(att.url);
        const buf = Buffer.from(await rr.arrayBuffer());
        vlozhenie = [{ filename: att.filename || 'list-pravdy.txt', content: buf.toString('base64') }];
      }
      await poslat({
        from: 'Business Intelligence DNA <hello@businessinteldna.com>',
        to: [to], reply_to: em ? [em] : undefined,
        subject: (dlyaVery ? 'Лист правды для Веры — ' : 'Лист правды к приёмке линии — ') + nm,
        text: (dlyaVery
                ? 'Пришёл лист правды ДЛЯ ВЕРЫ. По нему она будет отвечать клиентам — ставим только после его утверждения.\n\n'
                : 'Пришёл лист правды. Приёмку сверяем С НИМ, а не с тем, что скажет линия.\n\n') +
              'Имя: ' + nm + '\nПочта: ' + (em || '(не указана)') +
              '\nTelegram: ' + ((data.client_tg || '').trim() || '—') +
              '\nКонтакт: ' + ((data.contact || '').trim() || '—') +
              (vlozhenie.length ? '\n\nОтветы — во вложении.' : '\n\nВЛОЖЕНИЯ НЕТ — ответы не доехали, проверить.'),
        attachments: vlozhenie.length ? vlozhenie : undefined,
      });
      let cS = 'нет почты';
      if (/.+@.+\..+/.test(em)) {
        cS = String(await poslat({
          from: 'Business Intelligence DNA <support@businessinteldna.com>',
          to: [em], reply_to: ['support@businessinteldna.com'],
          subject: dlyaVery
            ? (poRu ? 'Лист правды получен — по нему Вера и будет отвечать / Your truth sheet is in'
                    : 'Your truth sheet is in — this is what Vera will answer from / Лист правды получен')
            : (poRu ? 'Лист правды получен — звоним по нему / Fact sheet received — we call against it'
                    : 'Fact sheet received — we call against it / Лист правды получен — звоним по нему'),
          text: (function () {
            // Два продукта — два смысла одного документа. Приёмке лист нужен, чтобы
            // сверять линию с его же словами; Вере — чтобы отвечать ими клиентам.
            const RU = dlyaVery
              ? 'Получили ваш лист правды. Спасибо, это была не самая приятная работа.\n\n' +
                'Дальше: по этому листу Вера и будет отвечать вашим клиентам — по вашим ценам, ' +
                'вашим часам и вашему «этого мы не делаем». Не по общим знаниям и не по нашим ' +
                'представлениям о вашем деле.\n\n' +
                'Первого слова она не скажет, пока вы лист не утвердите. Захотите что-то поправить — ' +
                'ответьте на это письмо, мы ещё не начали.'
              : 'Получили ваш лист правды. Спасибо, это была не самая приятная работа.\n\n' +
                'Дальше: звоним на вашу линию и сверяем не с общими представлениями о хорошем ' +
                'сервисе, а ровно с тем, что вы написали. Каждая находка — против вашей же строки. ' +
                'Поэтому спорить будет не с чем.\n\n' +
                'Если что-то в листе захотите поправить до звонков — ответьте на это письмо, ' +
                'мы ещё не начали.';
            const EN = dlyaVery
              ? 'We have your truth sheet. Thank you — that was not the pleasant part.\n\n' +
                'Next: this sheet is what Vera answers your customers from — your prices, your hours, ' +
                'your "we do not do that". Not general knowledge, and not our idea of your business.\n\n' +
                'She does not say a word until you approve it. Want to change something? Reply to this ' +
                'email — we have not started yet.'
              : 'We have your fact sheet. Thank you — that was not the pleasant part.\n\n' +
                'Next: we call your line and check it against what you wrote, not against some ' +
                'general idea of good service. Every finding is measured against your own line, ' +
                'so there will be nothing to argue about.\n\n' +
                'Want to change anything before we start? Reply to this email — we have not begun yet.';
            return (poRu ? RU + '\n\n—————————————\n\n' + EN : EN + '\n\n—————————————\n\n' + RU) +
                   '\n\n—\nBusiness Intelligence DNA · support@businessinteldna.com';
          })(),
        }));
      }
      console.log('[list-pravdy]', 'владельцу ок, человеку:', cS, em, 'вложение:', vlozhenie.length);
      return { statusCode: 200, body: 'ok' };
    }

    // ── формы четырёх продуктовых лендингов (23.09.2026) ────────────────────
    // До этого дня функция знала только старую воронку. Человек, оставивший почту
    // на /visibility/, /call-audit/ или /vera/, не получал НИЧЕГО — а страница «спасибо»
    // обещала ему письмо. Обещание было ложью девять дней.
    // Вторая причина, по которой он ничего не получал: формы шлют поле `email`,
    // а функция читала только `client_email`. Ниже берём оба.
    //
    // ЧТО ЭТИ ПИСЬМА ДЕЛАЮТ И ЧЕГО НЕ ДЕЛАЮТ: это подтверждение приёма, а не сам разбор.
    // Разбор по видимости и приёмку линии пока делаем руками. Тексты ниже повторяют
    // обещание со страницы «спасибо» слово в слово и ничего сверх него не обещают.
    const NOVYE = {
      'geo-check':     ['en', 'vidimost'], 'geo-check-ru':  ['ru', 'vidimost'],
      'line-check':    ['en', 'priemka'],  'line-check-ru': ['ru', 'priemka'],
      'vera-demo':     ['en', 'vera'],     'vera-demo-ru':  ['ru', 'vera'],
    };
    if (NOVYE[formName]) {
      const [yaz, chto] = NOVYE[formName];
      const em = (data.email || data.client_email || '').trim();
      const pole = (k) => (data[k] || '').trim() || '—';
      const ru = yaz === 'ru';

      // Письмо владельцу — чтобы заявка не потерялась, даже если хук Netlify молчит.
      const ktoZachem = { vidimost: 'Видимость в нейросетях', priemka: 'Приёмка телефонной линии',
                          vera: 'Демо Веры в браузере' }[chto];
      const podrobno = chto === 'vidimost'
        ? 'Дело: ' + pole('trade') + '\nГород: ' + pole('city')
        : chto === 'priemka'
        ? 'Бизнес: ' + pole('biz') + '\nНомер для звонка: ' + pole('phone') +
          '\nПодтвердил право на номер: ' + (data.consent ? 'да' : 'НЕТ — не звонить')
        : 'Больше ничего не спрашивали.';
      await poslat({
        from: 'Business Intelligence DNA <hello@businessinteldna.com>',
        to: [to], reply_to: em ? [em] : undefined,
        subject: ktoZachem + ' — ' + (em || 'без почты'),
        text: ktoZachem + ' (' + formName + ')\n\nПочта: ' + (em || '(не указана)') +
              '\n' + podrobno + '\n\nСтраница обещала: ' +
              (chto === 'vidimost' ? 'разбор письмом в течение минуты.'
                                   : 'ответ в течение рабочего дня.'),
      });

      // ВИДИМОСТЬ: подтверждения НЕ шлём. Решение Андрея 23.09 дословно: «нахрен не надо
      // слать человеку письмо о том, что к вам придут результаты. Просто слать результаты».
      // Запускаем фоновый прогон — он сам напишет человеку, и он же напишет честно,
      // если не сложилось. Ответа не ждём: фоновая функция отвечает 202 сразу.
      if (chto === 'vidimost') {
        let zapusk = 'нет почты';
        if (/.+@.+\..+/.test(em)) {
          try {
            const rz = await fetch('https://businessinteldna.com/.netlify/functions/razbor-background', {
              method: 'POST',
              headers: { 'content-type': 'application/json',
                         'x-razbor-secret': process.env.RAZBOR_SECRET || '' },
              body: JSON.stringify({ email: em, trade: pole('trade'), city: pole('city'), yaz }),
            });
            zapusk = String(rz.status);
          } catch (e) { zapusk = 'упало: ' + (e && e.message); }
        }
        console.log('[novaya-forma]', formName, 'владельцу ок, разбор запущен:', zapusk, em);
        return { statusCode: 200, body: 'ok' };
      }

      // Остальные формы: письмо человеку — ровно то, что ему пообещала страница «спасибо».
      let cStatus = 'нет почты';
      if (/.+@.+\..+/.test(em)) {
        const T0 = {
          vidimost: {
            ru: ['Заявка принята — проверяем, кого называют вместо вас',
                 'Получили вашу заявку.\n\nСпрашиваем три движка — ChatGPT, Google AI Mode и Perplexity — ' +
                 'кто лучший в вашем деле в вашем городе. Каждый по три раза: один прогон спорит сам с собой. ' +
                 'Записываем, назвали ли вас, кого назвали вместо вас и что о вас сказали неверно.\n\n' +
                 'Разбор придёт на этот адрес в течение минуты.\n\n' +
                 'Ваше дело: ' + pole('trade') + '\nГород: ' + pole('city') + '\n\n' +
                 'Если здесь что-то неверно — ответьте на это письмо, поправим до прогона.'],
            en: ['Request received — we are checking who gets named instead of you',
                 'We have your request.\n\nWe ask three engines — ChatGPT, Google AI Mode and Perplexity — ' +
                 'who is best in your trade in your city. Three runs each: a single run argues with itself. ' +
                 'We record whether they name you, who they name instead, and what they get wrong about you.\n\n' +
                 'The write-up lands at this address within a minute.\n\n' +
                 'Your trade: ' + pole('trade') + '\nCity: ' + pole('city') + '\n\n' +
                 'If anything here is wrong, reply to this email and we will fix it before the run.'],
          },
          priemka: {
            ru: ['Заявка принята — звоним на вашу линию',
                 'Получили.\n\nЗвоним один раз на ' + pole('phone') + ' в течение рабочего дня — ' +
                 'как обычный человек с обычным вопросом. Записываем, взяли ли трубку, за сколько, ' +
                 'что сказали про цену, предложили ли запись. Если звонок записывается, ' +
                 'запись начинается с объявления вслух.\n\n' +
                 'Расшифровку и короткий отчёт пришлём на этот адрес.\n\n' +
                 'Бизнес: ' + pole('biz') + '\n\n' +
                 'Не тот номер или передумали — ответьте на это письмо, и мы не позвоним.'],
            en: ['Request received — we are calling your line',
                 'We have your request.\n\nWe call ' + pole('phone') + ' once within one business day, ' +
                 'as an ordinary person with an ordinary question. We record whether the phone was answered, ' +
                 'how fast, what was said about price, and whether a booking was offered. ' +
                 'If the call is recorded, the recording starts with a spoken notice.\n\n' +
                 'The transcript and a short report land at this address.\n\n' +
                 'Business: ' + pole('biz') + '\n\n' +
                 'Wrong number, or changed your mind? Reply to this email and we will not call.'],
          },
          vera: {
            ru: ['Вера на линии — разговор открыт',
                 'Разговор открывается прямо в браузере, на странице, с которой вы пришли: ' +
                 'https://businessinteldna.com/vera/ru/thanks/\n\n' +
                 'Три минуты, ставить ничего не надо, нужен только микрофон. Спрашивайте то, ' +
                 'что спрашивают ваши клиенты: цену, сроки, делаете ли вы вообще то, что человеку нужно.\n\n' +
                 'Расшифровку вашего разговора пришлём на этот адрес, отметив вопросы, ' +
                 'на которые она не ответила.'],
            en: ['Vera is on the line — your conversation is open',
                 'The conversation opens right in your browser, on the page you came from: ' +
                 'https://businessinteldna.com/vera/thanks/\n\n' +
                 'Three minutes, nothing to install, you only need a microphone. Ask what your own ' +
                 'customers ask: price, timing, whether you even do the thing they need.\n\n' +
                 'We will send the transcript of your conversation to this address, marking the ' +
                 'questions she could not answer.'],
          },
        }[chto];

        // Письмо всегда на ДВУХ языках, решение Андрея 23.09: по видимости к нам залетит
        // англоязычный человек, а на какой странице он оказался — не доказательство языка.
        // Первым идёт язык страницы, с которой он пришёл, вторым — второй. Гадать не надо.
        const pervy = T0[yaz], vtoroy = T0[yaz === 'ru' ? 'en' : 'ru'];
        const T = [pervy[0] + ' / ' + vtoroy[0],
                   pervy[1] + '\n\n—————————————\n\n' + vtoroy[1]];
        const podpis = ru
          ? '\n\n—\nBusiness Intelligence DNA · support@businessinteldna.com'
          : '\n\n—\nBusiness Intelligence DNA · support@businessinteldna.com';
        const r = await poslat({
          from: 'Business Intelligence DNA <support@businessinteldna.com>',
          to: [em], reply_to: ['support@businessinteldna.com'],
          subject: T[0], text: T[1] + podpis,
        });
        cStatus = String(r);
      }
      // Демо Веры: запоминаем, кому потом слать расшифровку разговора (23.09.2026).
      // Страница формы кладёт короткий код в скрытое поле и в localStorage; страница
      // «спасибо» добавляет его в ссылку на разговор. Сам адрес в ссылку НЕ попадает —
      // он едет отсюда, с сервера на сервер, под секретом.
      let metkaStatus = '—';
      const metka = String(data.token || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      if (chto === 'vera' && metka && /.+@.+\..+/.test(em)) {
        try {
          const rv = await fetch('https://dezhurny-r4p8w2.netlify.app/.netlify/functions/vera-adres', {
            method: 'POST',
            headers: { 'content-type': 'application/json',
                       'x-vera-secret': process.env.VERA_ADRES_SECRET || '' },
            body: JSON.stringify({ metka, email: em }),
          });
          metkaStatus = String(rv.status);
        } catch (e) { metkaStatus = 'упало: ' + (e && e.message); }
      }
      console.log('[novaya-forma]', formName, 'владельцу ок, человеку:', cStatus, em, 'метка:', metkaStatus);
      return { statusCode: 200, body: 'ok' };
    }

    // ── короткие лид-формы: контакты до кассы и старт анкеты ────────────────
    // Функция срабатывает на ЛЮБУЮ форму сайта. Без этой развилки лид получил бы
    // письмо «анкета получена», не заполнив анкету.
    if (formName === 'lead-diagnostika' || formName === 'lead-zerkalo' || formName === 'lead-list') {
      const nm = (data.client_name || '').trim() || '(имя не указано)';
      const em = (data.client_email || '').trim() || '(почта не указана)';
      const tg = (data.client_tg || '').trim() || '—';
      const sg = (data.segment || '').trim() || '—';
      const zerkalo = formName === 'lead-zerkalo';
      const fromList = formName === 'lead-list';
      const what = fromList
        ? 'Собрал «Список работ» и оставил контакты'
        : zerkalo
        ? 'Посмотрел «Зеркало» и оставил контакты'
        : 'Дошёл до кассы (взял промокод / собирается платить)';
      // По зеркалу мы уже знаем его ссылку и нишу — это готовый повод для первого касания.
      const sheet = (data.list_text || '').trim();
      const tail = fromList
        ? '\n\n──────── ЕГО СПИСОК ────────\n' + (sheet || '(список не приложен)')
        : zerkalo
        ? '\nЕго ссылка: ' + ((data.mirror_host || '').trim() || '—') +
          '\nНиша: ' + ((data.mirror_niche || '').trim() || '—') +
          '\nЧем занимается (его слова): ' + ((data.mirror_what || '').trim() || '—')
        : '';
      const raw = JSON.stringify({
        from: 'Business Intelligence DNA <hello@businessinteldna.com>',
        to: [to],
        subject: what + ' — ' + nm,
        text: what + '\n\nИмя: ' + nm + '\nПочта: ' + em + '\nTelegram: ' + tg +
              '\nСегмент: ' + sg + tail + '\n\nЕсли дальше он пропадёт — вот с чем его догревать.'
      });
      let body = '';
      for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        body += c > 127 ? ('\\u' + ('000' + c.toString(16)).slice(-4)) : raw[i];
      }
      const r2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: body
      });
      console.log('[lead]', formName, r2.status, em);

      // Письмо клиенту. Раньше эта ветка делала return ДО него — человек,
      // которому обещали прислать материал, не получал ничего. Ни разу, никому.
      let cStatus = 'skip';
      if (/.+@.+\..+/.test(em) && (fromList || zerkalo)) {
        const hi = nm && nm !== '(имя не указано)' ? nm + ', вот ваш список' : 'Вот ваш список';
        const payUrl = 'https://businessinteldna.com/' +
          (sg === 'expert' ? 'expert' : 'business') + '/oplata';
        const pre = sheet
          ? '<pre style="white-space:pre-wrap;font:14px/1.55 ui-monospace,Menlo,monospace;' +
            'background:#faf8f4;border:1px solid #e5e1d9;border-radius:10px;padding:16px 18px">' +
            sheet.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre>'
          : '';
        const cHtml =
          '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a2e;max-width:600px">'
          + '<p>' + hi + '. Он ваш — можно переслать партнёру или тому, кто у вас отвечает клиентам.</p>'
          + pre
          + '<p><b>Что дальше.</b> Список показывает состав. Какие из этих работ ваши, в каком порядке '
          + 'и какая стоит вам дороже всех — считается по вашим цифрам. Это глубокая диагностика: '
          + 'три рабочих дня, документ на руки и разбор один на один.</p>'
          + '<p style="margin:26px 0"><a href="' + payUrl + '" style="display:inline-block;background:#c69a4c;'
          + 'color:#3a2a08;font-weight:600;text-decoration:none;padding:14px 26px;border-radius:10px">'
          + 'Перейти к диагностике →</a></p>'
          + '<p style="color:#5f6472;font-size:14px">Работаем под NDA. Доступ к вашим счетам, CRM '
          + 'и базе клиентов нам не нужен.</p>'
          + '<p style="color:#5f6472;font-size:14px">Андрей и Маша · Business Intelligence DNA</p>'
          + '</div>';
        const cRaw2 = JSON.stringify({
          from: 'Business Intelligence DNA <hello@businessinteldna.com>',
          reply_to: [process.env.BIDNA_MAIL || 'support@businessinteldna.com'],
          to: [em],
          subject: fromList ? 'Ваш список работ' : 'Ваш разбор',
          html: cHtml
        });
        let cB = '';
        for (let i = 0; i < cRaw2.length; i++) {
          const ch = cRaw2.charCodeAt(i);
          cB += ch > 127 ? ('\\u' + ('000' + ch.toString(16)).slice(-4)) : cRaw2[i];
        }
        const cR = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: cB
        });
        cStatus = String(cR.status);
        console.log('[lead] client mail', cR.status, em);
      }
      return { statusCode: 200, body: 'lead ' + r2.status + ' client ' + cStatus };
    }

    let attachments = [];
    let filename = 'intake-' + seg + '.txt';
    const att = data.attachment;
    if (att && att.url) {
      const r = await fetch(att.url);
      const buf = Buffer.from(await r.arrayBuffer());
      filename = att.filename || filename;
      attachments = [{ filename: filename, content: buf.toString('base64') }];
      console.log('[intake] fetched attachment', filename, buf.length, 'bytes');
    } else {
      console.log('[intake] no attachment in submission');
    }

    const rawBody = JSON.stringify({
      from: 'Business Intelligence DNA <hello@businessinteldna.com>',
      to: [to],
        subject: (podarok ? 'ПОДАРОК к ' + kChemu + ' — интейк (' : 'Новый интейк на диагностику (') + seg + ')',
        text: (podarok ? 'Диагностика В ПОДАРОК к ' + kChemu + '.' : 'Новая заявка на глубокую диагностику.') + '\n\nКонтакт: ' + contact +
            '\n\nПолный интейк — во вложении (' + filename + ').',
      attachments: attachments
    });
    // Escape every non-ASCII char to \uXXXX so the request body is pure ASCII
    // (avoids "Cannot convert argument to a ByteString" with Cyrillic). Pure-ASCII logic, no high chars.
    let emailBody = '';
    for (let i = 0; i < rawBody.length; i++) {
      const code = rawBody.charCodeAt(i);
      emailBody += code > 127 ? ('\\u' + ('000' + code.toString(16)).slice(-4)) : rawBody[i];
    }

    // ── письмо клиенту: анкета принята ──────────────────────────────────────
    // СОЗВОНА БОЛЬШЕ НЕТ (решение Андрея 24.09). Раньше здесь была кнопка на Calendly
    // и обещание «осталось выбрать время». Теперь обещаем одно: документ в течение трёх
    // рабочих дней. Если вернёте созвон — вернуть и кнопку, иначе человек будет ждать
    // письма, которого нет.
    if (clientEmail) {
      const hi = clientName ? clientName + ', спасибо' : 'Спасибо';
      // Без имени «Thank you, for going…» читается сломанно — собираем фразу целиком.
      const hiEn = clientName
        ? 'Thank you, ' + clientName + ', for going all the way through.'
        : 'Thank you for going all the way through.';
      const html = poEn
        ? '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a2e;max-width:560px">'
          + '<p>' + hiEn + ' The questionnaire is long and we appreciate it.</p>'
          + (podarok ? '<p>This diagnostic is <b>free with ' + kChemuEn + '</b> — there is nothing further to pay.</p>' : '')
          + '<p>We go away and work: we study your market and your competitors through open sources and build your business DNA, '
          + 'a ranked map of the leaks and three places where AI pays off for you.</p>'
          + '<p><b>The document arrives at this address within three working days.</b> Nothing else is needed from you.</p>'
          + '<p style="color:#5f6472;font-size:14px">We work under NDA. We do not need access to your accounts, CRM or customer base.</p>'
          + '<p style="color:#5f6472;font-size:14px">Andrii &amp; Masha · Business Intelligence DNA</p>'
          + '</div>'
        : '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a2e;max-width:560px">'
          + '<p>' + hi + ', что дошли до конца. Анкета у нас — она большая, и мы это ценим.</p>'
          + (podarok ? '<p>Эта диагностика — <b>подарок к ' + kChemu + '</b>, платить за неё отдельно не нужно.</p>' : '')
          + '<p>Мы уходим работать: изучаем ваш рынок и конкурентов по открытым источникам и собираем ДНК вашего бизнеса, '
          + 'карту разрывов по приоритету и три точки, где AI даёт вам деньги или время.</p>'
          + '<p><b>Документ придёт на эту же почту в течение трёх рабочих дней.</b> От вас больше ничего не нужно.</p>'
          + '<p style="color:#5f6472;font-size:14px">Работаем под NDA. Доступ к вашим счетам, CRM и базе клиентов нам не нужен.</p>'
          + '<p style="color:#5f6472;font-size:14px">Андрей и Маша · Business Intelligence DNA</p>'
          + '</div>';
      const tema = poEn
        ? (podarok ? 'Questionnaire received — your free diagnostic is under way'
                   : 'Questionnaire received — the study is under way')
        : (podarok ? 'Анкета получена — диагностика в подарок уже в работе'
                   : 'Анкета получена — разбор уже в работе');
      const cRaw = JSON.stringify({
        from: 'Business Intelligence DNA <hello@businessinteldna.com>',
        reply_to: [process.env.BIDNA_MAIL || 'support@businessinteldna.com'],
        to: [clientEmail],
        subject: tema,
        html: html
      });
      let cBody = '';
      for (let i = 0; i < cRaw.length; i++) {
        const c = cRaw.charCodeAt(i);
        cBody += c > 127 ? ('\\u' + ('000' + c.toString(16)).slice(-4)) : cRaw[i];
      }
      const cRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: cBody
      });
      console.log('[intake] client mail', cRes.status, clientEmail, podarok ? 'ПОДАРОК' : 'платная', poEn ? 'en' : 'ru');
    } else {
      console.log('[intake] no client_email in submission — письмо клиенту не отправлено');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: emailBody
    });
    const txt = await res.text();
    console.log('[intake] resend status', res.status, txt.slice(0, 400));
    return { statusCode: 200, body: 'resend ' + res.status };
  } catch (e) {
    console.error('[intake] error', e && e.message);
    return { statusCode: 200, body: 'error: ' + (e && e.message) };
  }
};
