# Кампания A2P 10DLC в Twilio — тексты и порядок подачи

Собрано 29.09.2026, поправлено тем же вечером по двум проверкам (соответствие A2P и код). **НЕ ПОДАНО.**
Машинная версия полей — `kampaniya.json` (имена полей API Twilio), три SMS-текста в ней `sobrat.py`
сверяет с `tekst-soglasiya.json` буква в букву.

Бренд: **Wealthboosterpro LLC dba Business Intelligence DNA**, Low Volume Standard,
`BNd8e5587960b8d914a87262c338ae75e4`, TCR `B98FX5S`, одобрен 29.09. Номер: **+1 424 781 1913**.

## Когда подавать

Только когда `python3 Pivot/sms-kampaniya/proverit.py` по живому домену прошёл чисто. Проверяющий
открывает страницу согласия и условия по ссылкам из заявки. Сегодня (29.09) на живом:

- `/sms-consent/` отдаёт 404: страницы нет;
- `/sms`, `/privacy`, `/contacts` описывают другую программу: SMS только по устной просьбе в звонке,
  одно сообщение, «дожимов не будет». Заявка с галочкой на сайте и дожимом с этим расходится,
  а расхождение с собственными условиями — самая частая причина отказа.

Отказ денег повторно не съест: $15 за проверку берут один раз на кампанию, повторная подача
бесплатна. Но каждый круг проверки стоит дней, а их и так 5–15 рабочих.

## Тип кампании: Low Volume Mixed (`LOW_VOLUME`)

Почему он:
1. **Сообщений у нас три вида:** подтверждения и напоминания о записи (по классификации Twilio
   Account Notification), ответы на вопросы (Customer Care), дожим и предложения (Marketing).
   Одна кампания узкого типа покрыла бы только один вид. Отправлять дожим по кампании
   «уведомления» нельзя, это нарушение, за которое блокируют номер.
2. **Low Volume Mixed разрешает любое сочетание видов.** Описание типа в API: «Low throughput,
   any combination of use-cases». Для бренда LVS это обычный выбор.
3. **Потолок нам не мешает:** до 2 000 сегментов в сутки на T-Mobile и 3,75 сообщения в секунду
   на всех операторах. У нас единицы в день.
4. **Дешевле всех:** $1,50 в месяц плюс разовые $15 за проверку. `MIXED` в каталоге Twilio
   «reserved for specific consumer service industry», это не мы.

## Два согласия, а не одно: так требует Twilio

Отказ 30913: согласие на рекламные сообщения нельзя склеивать с согласием на служебные.
Поэтому на странице две отдельные галочки, обе пустые: «по заявке и записи» и **рекламная**
«Marketing texts: follow-ups and offers» / «Рекламные SMS: повторные сообщения и предложения».
Слово «рекламные» стоит в самой подписи галочки и в раскрытии («the second box covers marketing
messages»), как в образце Twilio к 30924/30925. «Напоминания» — только в первой галочке, чтобы
виды не пересекались. Отказы 30923 и 30931: форму должно быть можно сохранить без согласия.
Сохраняется и без галочек, тогда в журнал пишется отказ, а если номер раньше соглашался,
это отзыв согласия.

**Решение за Андреем (да/нет): вторая галочка (рекламная) остаётся?**
Она делает кампанию рекламной и меняет обещание в `/privacy` «дожимов не будет» на «только
по отдельной галочке». Если «нет», галочку убираем. Это новая версия текста (en-1.1/ru-1.1),
четвёртый пример в заявке меняем на служебный. Дело на полчаса, но решить надо **до подачи**.

---

## Поля заявки (вставлять как есть, английский)

Во всех полях ни одной кириллической буквы (отказ 30910: заявка только на английском) — `sobrat.py`
это проверяет. О русских сообщениях сказано по-английски в Description.

Бренд в реестре (TCR) называется **Wealthboosterpro LLC**: поля DBA в профиле Twilio нет (проверено
чтением профиля 29.09). Подписываемся мы «Business Intelligence DNA», поэтому связь названа прямо:
Description начинается с «registered trade name (DBA) of Wealthboosterpro LLC», а в примере 1 и в
OptIn/OptOut/Help после бренда стоит «(Wealthboosterpro LLC)» (отказы 30918, 30907).

**Campaign use case:** Low Volume Mixed (`LOW_VOLUME`)

**Campaign description** (1055 знаков, допустимо 40–4096):

> Business Intelligence DNA is the registered trade name (DBA) of Wealthboosterpro LLC, a small US consulting firm for small business owners: we set up AI phone receptionists, help businesses get named by AI assistants, and run business diagnostics. English pages: https://businessinteldna.com/en/, https://businessinteldna.com/vera/ and https://businessinteldna.com/diagnostic/. Many of our clients are Russian-speaking owners of US businesses, so some messages are sent in Russian; they carry the same brand name and STOP instructions as the English samples. We text people who contacted us about our services and then opted in on our website. Messages are: (1) confirmations and reminders of calls they booked with us, and replies to questions they asked us; (2) marketing messages, only for people who ticked a separate optional marketing box: follow-ups and offers about the service they asked us about. We never text anyone who has not opted in on our website, and we never buy, rent or import phone numbers. Expected volume is a few messages per day.

`/en/` появляется вечерней выкладкой 29.09 (merge_site.py). `proverit.py` перед подачей проверяет,
что каждый адрес из полей заявки отвечает 200; если `/en/` не выехала — убрать её из Description.

**Message flow / call to action** (1842 знака, допустимо 40–2048):

> End users opt in only in writing, on our website, and opting in is optional. People first contact us (website form, email, phone call or Telegram); we then email them a link to our public SMS preferences page https://businessinteldna.com/sms-consent/ (Russian version with the same checkboxes and disclosures, translated: https://businessinteldna.com/sms-consent/ru/). No login is needed; the page is linked from our SMS Terms at https://businessinteldna.com/sms. On the page the user enters a US mobile number and may tick two separate checkboxes, both unchecked by default and both optional: (1) texts about their request and appointments; (2) marketing texts: follow-ups and offers about the service they asked about. The form can be saved with neither box ticked, and nothing else we provide depends on it. Next to the checkboxes the page states the brand name Business Intelligence DNA (Wealthboosterpro LLC), that the messages are recurring and automated, the kinds of messages, 'Consent is not a condition of any purchase', 'Message frequency varies, up to 8 messages per month', 'Msg & data rates may apply', 'Reply STOP to cancel at any time; reply HELP for help', the sending number, that no mobile information will be shared with third parties or affiliates for marketing or promotional purposes, and links to our SMS Terms (https://businessinteldna.com/sms), Privacy Policy (https://businessinteldna.com/privacy) and Terms of Service (https://businessinteldna.com/terms). After opt-in we send one confirmation text with the program name, frequency, rates and HELP/STOP instructions. The keyword START only re-subscribes a number that opted in on the page and later replied STOP; there is no keyword opt-in. For every opt-in we record the number, the boxes ticked, date and time, IP address, browser, page and consent text version.

«Linked from our SMS Terms» правда только потому, что в `/sms` ссылка стоит автоссылкой
`<https://…/sms-consent/>`: голый адрес pandoc ссылкой не делает, а форму `[текст](адрес)` ломает
`_rekvizity.fill()` (примет за заглушку и уронит выкладку).

**Message samples** (5 из допустимых 2–5; в каждом бренд и STOP, все на английском):

1. `Business Intelligence DNA (Wealthboosterpro LLC): your call with Andrii is booked for Thu, Oct 8 at 11:00 AM PT. The Zoom link is in your email. Need another time? Just reply. Reply STOP to opt out.` — подтверждение записи; бренд с юрлицом (198)
2. `Business Intelligence DNA: thanks for your question about Vera, our AI receptionist and sales rep. Prices and how it works: https://businessinteldna.com/vera/ Questions? Call +1 424 781 1913. Reply STOP to opt out.` — ответ на вопрос, ссылка и телефон (214)
3. `Business Intelligence DNA: hi [First name], the proposal for [Business name] that you asked for is in your inbox. Want to go ahead or have questions? Just reply. Reply STOP to opt out.` — повторное сообщение по запрошенному предложению, рекламное (184)
4. `Business Intelligence DNA: hi [First name], you asked how to get your business named by ChatGPT and other AI assistants. Our visibility quarter: https://businessinteldna.com/visibility/ Want to start? Just reply. Reply STOP to opt out.` — предложение, рекламное; квартал видимости как на `/visibility/` (223)
5. `Business Intelligence DNA: reminder, your call with Andrii is tomorrow, [Date], at [Time] PT. The Zoom link is in your email. Reply STOP to opt out.` — напоминание (148)

Пример 4 должен совпадать с живым оффером: `proverit.py` проверяет, что на `/visibility/` ещё висит
квартал («quarter»). (До окна 29.09 здесь была диагностика «free for the first ten» за отзыв — окно её сняло.)

**Флаги:**

| Поле | Значение | Почему |
|---|---|---|
| Embedded links (`HasEmbeddedLinks`) | **Yes** | ссылки на свой домен businessinteldna.com; сокращатели (bit.ly и т. п.) не используем, их операторы режут |
| Embedded phone (`HasEmbeddedPhone`) | **Yes** | в примере 2 и в HELP номер +1 424 781 1913 |
| Age-gated content (`AgeGated`) | No | |
| Direct lending (`DirectLending`) | No | |
| Subscriber opt-in (`SubscriberOptIn`) | Yes | |

**Opt-in keywords:** `START` — только повторная подписка после STOP; это сказано в MessageFlow (отказ 30917).

**Opt-in message** (185 знаков, два сегмента; допустимо 20–320). Его же функция шлёт после первой галочки.
Без перечня видов: человек мог отметить только одну галочку.

> Business Intelligence DNA (Wealthboosterpro LLC): you're signed up for the texts you chose on our site. Up to 8 msgs/mo. Msg & data rates may apply. Reply HELP for help, STOP to cancel.

**Opt-out keywords:** `STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, OPTOUT` — REVOKE и OPTOUT стандартные у Twilio с 2025 года по правилу FCC; те же слова названы в `/sms`, пункт 5.

**Opt-out message** (133):

> Business Intelligence DNA (Wealthboosterpro LLC): you're unsubscribed and will get no more texts from us. Reply START to resubscribe.

**Help keywords:** `HELP, INFO`

**Help message** (173):

> Business Intelligence DNA (Wealthboosterpro LLC): help at support@businessinteldna.com or +1 424 781 1913. Up to 8 msgs/mo. Msg & data rates may apply. Reply STOP to cancel.

**Privacy policy URL:** `https://businessinteldna.com/privacy`
**Terms and conditions URL:** `https://businessinteldna.com/sms`

---

## Как подать (API: консоль у Андрея показывает кривой русский перевод Twilio)

Все три шага — запросы на запись в Twilio и деньги. Делать **после** чистого `proverit.py`
и с подтверждением трат от Андрея: $15 разово плюс $1,50 в месяц. Последний известный баланс
$10,66, автопополнение включено 25.09.

1. **Сервис сообщений так, чтобы входящие SMS остались у ElevenLabs:**
   `POST https://messaging.twilio.com/v1/Services`
   `FriendlyName=BIDNA SMS` · **`UseInboundWebhookOnNumber=true`**. С этим флагом входящие идут
   на вебхук самого номера, как сейчас. Без него сервис перехватит их на свой адрес.
2. **Кампания:** `POST https://messaging.twilio.com/v1/Services/{MG…}/Compliance/Usa2p`, поля из
   `kampaniya.json` без ключей с «_». Массивы (`MessageSamples`, `*Keywords`) передаются
   повторяющимися параметрами. В этот момент списываются $15.
3. **Номер 424 в сервис:** `POST /v1/Services/{MG…}/PhoneNumbers` `PhoneNumberSid=PN…`.
   Предлагаю ставить **после одобрения**: до него слать всё равно нельзя, а номер до последнего
   живёт как сейчас.
4. Статус: `GET /v1/Services/{MG…}/Compliance/Usa2p/QE2c6890da8086d771620e9b13fadeba0b` →
   `campaign_status` и `errors`.

## Что должно быть готово до ПЕРВОГО SMS (не до подачи)

1. **Ответы на SMS никто не читает.** Входящие на 424 уходят в ElevenLabs. Английский STOP Twilio
   обработает сам на уровне сервиса. Русское «СТОП», которое обещают `/sms` и страница, нет.
   По правилу FCC (действует с апреля 2025) отзыв согласия принимается «любым разумным способом», поэтому
   «стоп» по-русски тоже отзыв. Нужен приём входящих: СТОП, ОТПИСКА и т. п. пишутся в
   `nomer/<номер>` как `otozvano`. Проверить, берёт ли Advanced Opt-Out кириллические слова;
   если нет, нужен свой обработчик.
2. **Отправки напоминаний и дожима пока нет.** Любая будущая отправка обязана перед SMS читать
   `nomer/<номер>` и слать только по отмеченному виду: `servis` или `dozhim`, и не при `otozvano`.
3. **Дожим — реклама:** не раньше 8:00 и не позже 21:00 по времени получателя. Во Флориде
   строже: 8:00–20:00 и не больше трёх в сутки.
4. **Подтверждающее SMS** включить после одобрения переменными `SMS_PODTVERZHDAT=1`,
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`. Около 200 байт
   к потолку 4 КБ переменных, мерить до выкладки.
5. **Ссылку на страницу согласия людям не рассылать до одобрения.** Страница висит для проверяющего.
   Правило ревизии «SMS НЕ ОБЕЩАЕМ» на продуктовых страницах остаётся, пока путь не пройден на себе.
6. **Advanced Opt-Out на сервисе сообщений** с текстами из заявки (OptOut, Help, OptIn для START).
   Иначе на STOP и HELP уйдут стандартные ответы Twilio без бренда, а не зарегистрированные.
7. **MessageFlow описывает поток, которого пока нет:** письмо со ссылкой на страницу согласия и
   подтверждающее SMS. До первого SMS — ссылка в письме-ответе и `SMS_PODTVERZHDAT=1` (пункт 4),
   иначе заявка разойдётся с делом.
8. **Согласия, записанные до одобрения, для рассылки не годятся:** среди них может быть тестовый
   номер проверяющего, и подтверждающее SMS им не уходило. Правило для любой будущей отправки:
   слать только номерам, у которых в `nomer/<номер>` `podtverzhdenie` начинается с `otpravleno`.
9. **Пиксель Meta (план 01.10) не ставить на `/sms-consent/` и `/sms-consent/ru/`.** Автосопоставление
   хеширует поле телефона и шлёт в Meta — это передача номера третьему лицу для рекламы, прямо против
   обещания на странице и в `/privacy` (30932). `sobrat.py` и `proverit.py` падают, если найдут на
   этих страницах `connect.facebook.net` или `fbq(`. Пункт 5 русской части `/privacy` («пикселей нет»)
   менять в ту же выкладку, что и пиксель.

Источники требований: ошибки Twilio 30887, 30907, 30908, 30909, 30910, 30913, 30917, 30918, 30919, 30920,
30922, 30923, 30924, 30925, 30931, 30932, 30934 (twilio.com/docs/api/errors/…), новые слова отписки по
правилу FCC (twilio.com/en-us/changelog/opt-out-additional-keywords-added-per-fcc-ruling),
ресурс Usa2p и каталог типов кампаний (twilio.com/docs/messaging/api/usapptoperson-resource,
…/usapptopersonusecase-resource), памятка Twilio «Improving your chances of A2P 10DLC
registration approval», FAQ по проверке кампаний (help.twilio.com, статья 11587910480155).
