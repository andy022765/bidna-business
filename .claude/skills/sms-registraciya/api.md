# Запросы API Twilio по шагам

Авторизация: Basic `TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN` из `~/.bidna-golos.env`. Тело — form-urlencoded:
массивы повторяющимися параметрами, bool строками `'true'`/`'false'`. Скрипты скилла делают это сами (`_twilio.py`).
Хосты: `trusthub.twilio.com/v1` (профили), `messaging.twilio.com/v1` (бренд, сервис, кампания),
`api.twilio.com/2010-04-01` (номера, адреса, баланс).

## Шаг 1. Профиль компании (Customer Profile) — руками человека

**Primary (наш) — только консоль.** API: `400 This operation is restricted via API for Primary Customer Profiles.
Use Twilio Console instead` (14.09). Политика `RN6433641899984f951173ef1738c3bdd0`. Наш: `BU64761052fe6d498b4e6e66fdb6d74d41`,
подан 14.09 04:33 UTC → отказ 15.09 02:38 UTC (18601, 18606) → одобрен 15.09 07:49 UTC.

**Secondary (клиент).** EIN и реквизиты вводит человек в консоли (Trust Hub → Customer Profiles, «Switch Customer Profile»).
**Агент эти вызовы не делает никогда: налоговые номера вводит только человек.** Ниже — справка по документации ISV
(`twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api`, прочитано 29.09, вживую не проверено),
чтобы понимать, что заполняет человек, и читать готовый профиль по SID.
1. `POST trusthub/v1/CustomerProfiles` — `FriendlyName`, `Email` (НАШ адрес для уведомлений), `PolicySid=RNdfbf3fae0e1107f8aded0e7cead80bf5`.
2. `POST trusthub/v1/EndUsers` `Type=customer_profile_business_information`, `Attributes` JSON: business_name,
   business_identity, business_industry, business_type, business_registration_identifier,
   business_registration_number, business_regions_of_operation, website_url.
3. `POST trusthub/v1/EndUsers` `Type=authorized_representative_1`: first_name, last_name, email, phone_number,
   business_title, job_position.
4. `POST 2010-04-01/Accounts/{SID}/Addresses.json`, затем `POST trusthub/v1/SupportingDocuments`
   `Type=customer_profile_address`, `Attributes={"address_sids": "AD…"}`.
5. `POST trusthub/v1/CustomerProfiles/{BU}/EntityAssignments` `ObjectSid=` — каждый IT…, RD… и наш Primary `BU6476…`.
6. `POST …/CustomerProfiles/{BU}/Evaluations PolicySid=RNdfbf…` → `compliant`, затем `POST …/CustomerProfiles/{BU}
   Status=pending-review`.

Читать готовый профиль агенту можно: `GET trusthub/v1/CustomerProfiles/{BU}` → `status`.
Бренд подаём только на `twilio-approved` (шаг 3).

## Шаг 2. A2P-профиль (TrustProduct) — делает `podat_brend.py --go`
29.09 делали руками через curl; ветка скрипта вживую не исполнялась.
1. `POST trusthub/v1/TrustProducts` — `FriendlyName=<Клиент> A2P Messaging Profile`, `Email=<почта уведомлений>`,
   `PolicySid=RNb0d4771c2c98518d916a3d4cd70a8f8b` («A2P Messaging: Local - Business», принимает primary и secondary
   business — проверено чтением политики 29.09).
2. `POST trusthub/v1/EndUsers` — `Type=us_a2p_messaging_profile_information`,
   `Attributes={"company_type":"private","brand_contact_email":"<имя>@<домен клиента>"}`; для public ещё
   `stock_exchange`, `stock_ticker`.
3. `POST trusthub/v1/TrustProducts/{BU}/EntityAssignments` дважды: `ObjectSid=IT…` и `ObjectSid=BU<профиль компании>`.
4. `POST …/TrustProducts/{BU}/Evaluations PolicySid=RNb0d…` → `status: compliant`.
5. `POST …/TrustProducts/{BU} Status=pending-review` → in-review. У нас 17:23 → twilio-approved к 17:29 PDT.

## Шаг 2а. Черновик A2P-профиля не прошёл политику (draft) — вживую не делали
1. Что внутри: `GET …/TrustProducts/{BU}/EntityAssignments` (нужны оба: IT… и BU профиля компании) и
   `GET …/TrustProducts/{BU}/Evaluations` → последняя `results` (что именно не так). Это показывает
   `podat_brend.py --a2p BU… --dorabotat` без `--go`. Оба GET проверены 29.09 на наших профилях.
2. Поправить EndUser: `POST trusthub/v1/EndUsers/{IT…}` с полными новыми `Attributes` (так 29.09 меняли почту support@ → andrii@).
   Нет привязки — `POST …/TrustProducts/{BU}/EntityAssignments ObjectSid=…`.
3. `podat_brend.py --a2p BU… --dorabotat --go` — заново Evaluations, при `compliant` → `Status=pending-review`.
4. Консольный черновик `BUb8259bae…` так не дорабатывать: его заполняла сломанная форма.

## Шаг 3. Бренд — проверено 29.09 (curl), делает `podat_brend.py --go --brend`. $4.50
- Сначала `GET messaging/v1/a2p/BrandRegistrations` — нет ли уже бренда на этот профиль.
- Профиль компании обязан быть `twilio-approved`: плата берётся при создании бренда, даже если он не пройдёт.
- `POST messaging/v1/a2p/BrandRegistrations` — `CustomerProfileBundleSid=BU<профиль>`, `A2PProfileBundleSid=BU<A2P>`,
  `SkipAutomaticSecVet=true`. STANDARD + skip = Low Volume Standard, $4.50; без skip — $46.
- A2P-профиль может быть in-review (так и было в 17:27 PDT).
- `GET …/BrandRegistrations/{BN}` раз в минуту: `status`, `identity_status`, `tcr_id`, `failure_reason`.
  У нас PENDING → APPROVED ~3 мин.

## Шаг 7. Сервис, номера, кампания — проверено 29.09, делает `podat_kampaniyu.py --go`. $15 + $1.50/мес
1. `POST messaging/v1/Services` — `FriendlyName=<Клиент> A2P`, **`UseInboundWebhookOnNumber=true`**.
   Без флага сервис перехватит входящие SMS с вебхука номера (у нас 781-1913 шлёт их в ElevenLabs).
2. `POST messaging/v1/Services/{MG}/PhoneNumbers` — `PhoneNumberSid=PN…`. Номер — только в одном сервисе.
3. `GET …/Services/{MG}/Compliance/Usa2p` — кампании ещё нет?
4. `POST …/Services/{MG}/Compliance/Usa2p` — все поля `kampaniya.json` без ключей с «_».
   У нас в поданной кампании `opt_out_message` и `help_message` оказались текстами Twilio, а не нашими: на сервисе нет
   Advanced Opt-Out (29.09, 22:05). `--tolko-servis` останавливается между пунктами 2 и 3, чтобы успеть его включить.

## Шаг 8. Статус, проверки и переподача (статус — только чтение, всё собирает `status.py`)
- `GET messaging/v1/Services/{MG}/Compliance/Usa2p/{QE}` → `campaign_status`, `errors`, `rate_limits`,
  `opt_out_message`, `help_message` (полей `age_gated`, `direct_lending`, ссылок privacy/terms в ответе нет — проверено 29.09).
- `GET messaging/v1/Services/{MG}` → `use_inbound_webhook_on_number`, `us_app_to_person_registered`.
- `GET messaging/v1/Services/{MG}/PhoneNumbers`.
- `GET 2010-04-01/Accounts/{SID}/IncomingPhoneNumbers.json` → `sms_url`, `voice_url` не изменились.
- `GET 2010-04-01/Accounts/{SID}/Balance.json` → списания.
- **Переподача FAILED — правка на месте** (документация `troubleshooting-and-rectifying-a2p-campaigns`, прочитано 29.09;
  вживую не делали; делает `podat_kampaniyu.py --pravka QE… --go`):
  `POST messaging/v1/Services/{MG}/Compliance/Usa2p/{QE}` — все 7 полей обязательны даже при правке одного:
  `Description`, `MessageFlow`, `MessageSamples`, `HasEmbeddedLinks`, `HasEmbeddedPhone`, `AgeGated`, `DirectLending`.
  Статус возвращается в проверку. «A vetting fee is assessed only once per Campaign» — новых $15 нет.
- **DELETE кампании** — СТОП: удалить одобренную = остановить все SMS сервиса; новая кампания = новые $15 и 5–15 дней.

## Шаг 9. Advanced Opt-Out — консоль, API не нашли
По документации (`messaging/tutorials/advanced-opt-out`, прочитано 29.09): Communications → Messaging → Services →
сервис → вкладка Opt-out → «Enable advanced opt-out». Русский в списке языков есть. Без него Twilio сам отвечает на
STOP, UNSUBSCRIBE, END, QUIT, STOPALL, REVOKE, OPTOUT, CANCEL своими английскими текстами. Вживую не открывали.

## Шаг 10. Клиент ушёл — СТОП, необратимо, вживую не делали
1. `DELETE messaging/v1/Services/{MG}/PhoneNumbers/{PN…}` — снять номер клиента с сервиса.
2. `DELETE messaging/v1/Services/{MG}/Compliance/Usa2p/{QE}` — удалить кампанию. До этого $1.50 идут каждый месяц.
3. Бренд и профили не удаляем: ежемесячной платы с них нет. Номер — решение Андрея (скилл `zapusk-very`).
