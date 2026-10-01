# Стенд прототипов линий (`platforma/`)

*30.09.2026, сборщик стенда. Сайт: **`linii-demo-85fof`** → https://linii-demo-85fof.netlify.app, site id `ea43276c-c92b-479d-b662-541651e04cf2`. Создан пустым. Выкладку, привязку номера и любые траты делает только главный агент вечерним окном — после проверки помощником-проверяющим и «да» Андрея (KONTRAKT.md, запреты 2–3). Папку с сайтом не линковать. 01.10 ночью — исправления по независимой проверке (`../PROVERKA-PERED-VYKLADKOY.md`, «Исправлено 01.10 ночью»): пределы и fail-closed, имя секрета итога, порядок окна, ключ календаря, перевод вебхуком, срок хранения.*

Многоклиентская версия функций Веры для №44 CareLine (дальше №43 NightDesk). Отдельный сайт: живые линии Веры не задевает. Данные только вымышленные (DEMO). Всё, что говорит с людьми (письма, SMS, звонки, перевод), по умолчанию в холостом режиме `DRY_RUN=1` — пишет в журнал клиента, что ушло бы.

## Как течёт звонок

```
Twilio +1 929 209 9535 ─VoiceUrl→ vhod: подпись Twilio → linii.json → предел звонков клиента (15 в сутки;
                        │          хранилище не ответило — «линия временно недоступна», ElevenLabs не зовём) → register-call
                        │          (+ dynamic_variables: ofis_seychas, kalendar) → TwiML ElevenLabs
                        └VoiceFallbackUrl→ TwiML Bin (стенд или Netlify лежит)
ElevenLabs: агент найма ⇄ агент сиделок (transfer_to_agent, без своего номера); у каждого daily_limit 20
  инструменты ─x-liniya-klyuch→ okna · zapis · kandidat · semya · otkaz · perevod (perevod_careline_demo, с 01.10)
  итог звонка ─HMAC (CARELINE_WEBHOOK_SECRET)→ itog → zvonki/<conversation_id>, согласия, журнал, сообщение координатору
SMS на номер ─SmsUrl→ sms-vhod: ДА/YES/SÍ/НЕТ на смены, STOP/START, «не выйду» (SMS кандидатов не разбираются)
Расписание: volny каждые 5 мин (волны SMS и побудка дежурного, исходящих ≤ 10 в сутки) · napominaniya каждые 15 мин
            (за 24 ч и 2 ч до встречи) · svodka 11 и 12 UTC (письмо в 7:00 по Нью-Йорку + чистка итогов звонков старше 30 дней)
Пульт /pult/?k=<ключ> → pult (снимок) · evv (CSV визитов)
Хранилище: Netlify Blobs, одно на клиента: k-<klient>
```

## Файлы

| Путь | Что |
|---|---|
| `netlify.toml` | publish `web`, функции `netlify-functions`, **esbuild**, Node 20, заголовки безопасности (CSP, noindex), расписания `svodka`, `volny`, `napominaniya` |
| `package.json` | `@netlify/blobs` **10.1.0** (с неё есть условная запись `onlyIfNew`/`onlyIfMatch`; 11.x требует Node ≥ 22.12), `npm test` |
| `linii.json` | номер → линия → клиент, без секретов: `+19292099535` (найм, агент `agent_2001m3sx90scf9msygm0e685h1yw`) и `DEMO-2` (сиделки, агент `agent_5001m3sx8yr5ee1sne6p5b8zcmwk`, живёт на том же номере — поле `nomer`, `perevod_vne_chasov`) |
| `nastroyki.json` | настройки клиента `brightside` без секретов: календари, часы (из `care/list-pravdy/brightside.json`), цепочки перевода и дежурных, адресаты, пределы (`limity`: входящих 15, исходящих 10, писем 60, SMS 200 в сутки), срок хранения итогов звонков (`hranenie.zvonki_dney` 30), правила замены. `null`/пусто = решения Андрея нет |
| `lib/` | `hranilishche` (Blobs / файлы `.data/`), `podpisi`, `otpravka` (Resend, Twilio SMS и звонки, DRY_RUN, суточные потолки), `linii`, `zhurnal`, `kalendar` (Google + фейк), `vremya` (EN/ES/RU, переменные агента `peremennyeZvonka`), `frazy` (все фразы трёх языков), `http` (обёртка инструмента), `kartochki` (+ защита от имени-заглушки), `otkazy` (A3 вокруг движка), `napominaniya` (за 24 ч и 2 ч), `chistka` (срок хранения итогов звонков), `pult-dannye` |
| `lib/care/`, `lib/shablony/` | движки `zamena.js`, `evv.js` и снимок/сводка пульта — **другие сборщики**, стенд их только зовёт |
| `netlify-functions/` | 14 функций (таблица ниже) |
| `scripts/zagruzit-demo.js` | демо-данные пульта (`demoZapisi`) в хранилище: локально или `--blobs` (по «да»). С 30.09 вечера — все коллекции контракта, включая семьи (`semi/` + `indeks/telefon/semya/`) и журнал дня `--seychas` (`zhurnal/<день>`: дописывает к строкам стенда, без дублей); пульт стенда на этих данных в момент `--seychas` совпадает с демо-снимком `demoSnimok` (`test/zagruzit-demo.test.js`) |
| `scripts/zalit-klyuch-kalendarya.js` | ключ служебного аккаунта Google `~/bidna-klyuchi/vera-kalendar.json` → Blobs стенда `kalendar-klyuch`/`sa` (шаг окна, раздел «Окно выкладки»); `--proverit` — только «есть ли ключ и тот ли»; содержимое не печатает; без `--blobs` — проба во временную папку (в Drive ключ не пишет) |
| `docs/API.md` | формат данных пульта и функций `pult`/`evv` (до 01.10 лежал в `web/pult/` и уехал бы на стенд открытым) |
| `test/` | `npm test` — 247 (01.10): стенд `stend-*.test.js`, рядом тесты движков и пульта других сборщиков |

## Функции

| Функция | Кто зовёт | Защита | Что делает |
|---|---|---|---|
| `vhod` | Twilio, голос | подпись Twilio, номер из `linii.json` | предел звонков клиента `limity.zvonkov_v_sutki` (15; повтор CallSid не считается, `ZVONKI_BEZ_KVOTY` мимо); **fail-closed с 01.10:** хранилище не поднялось или счётчик не прочитался — «Sorry, this line is temporarily unavailable…» (или `<Dial>` в `rezerv_nomer`), register-call не зовём; `register-call` с переменными агента `ofis_seychas` и `kalendar` (раздел ниже), TwiML как есть; сбой ElevenLabs — фраза на языке линии или `<Dial>` в `rezerv_nomer` |
| `sms-vhod` | Twilio, SMS | подпись Twilio | ДА/НЕТ (+код) на предложения, STOP/START (`soglasiya`, карточка сиделки), «не выйду» → отказ от единственной смены в 36 ч; ответы — через `otpravka` |
| `okna` | инструмент | `x-liniya-klyuch` | 2 ближайших окна `{start, end, tekst}`, `data_s`, честный отказ, если календарь молчит |
| `zapis` | инструмент | `x-liniya-klyuch` | время только из свежих окон; событие без гостя; карточка (+ почта в карточку, если её там нет); письмо (ключ дублей — встреча), SMS при согласии; повтор = та же встреча, другое время в том же разговоре = перенос (статус снова `booked`, флаги напоминаний сброшены); ответ на `yazyk` тела, иначе на языке карточки разговора |
| `kandidat`, `semya` | инструмент | `x-liniya-klyuch` | карточки; повтор разговора или тот же телефон — та же карточка; `podhodit:false` → `waitlist`; согласие на SMS → журнал согласий. **Имя-заглушка** (Caller, Unknown, N/A, Звонящий, Llamante…) → `{ok:false, kod:'net_imeni'}`; кандидат **без `sertifikat`** и без карточки с отбором → `{ok:false, kod:'net_otbora'}`; ничего не сохраняется |
| `otkaz` | инструмент | `x-liniya-klyuch` | сиделка по номеру звонящего → смена (дата, код клиента) → отказ → движок → первая волна SMS; мало времени или некому — побудка. **Без `prichina`** при однозначной смене → `{ok:false, kod:'net_prichiny', nuzhno_utochnit:true}` с вопросом о причине, ничего не записано |
| `perevod` | инструмент + обратные вызовы Twilio | `x-liniya-klyuch`; метка HMAC в адресах | ширма «нажмите 1», 20 с, цепочка, откат (раздел «Перевод») |
| `itog` | ElevenLabs post-call | HMAC «t=…,v0=…», 30 мин, секрет `CARELINE_WEBHOOK_SECRET` | `zvonki/<conv>` словарём пульта, согласия, раскрытие ИИ по первой реплике, письмо координатору по полю `soobshchenie` |
| `evv` | пульт | ключ пульта | CSV → `lib/care/evv.js` → `evv/<run_id>` → `{ok, progon}` |
| `pult` | пульт | ключ пульта | снимок `lib/shablony/snimok.js` (формат `docs/API.md`) + `semi`, `zhurnal` |
| `svodka` | расписание | — | 7:xx по поясу клиента, раз в сутки, `renderSvodka` → письмо, копия `svodki/<дата>`; тем же запуском раз в сутки (замок `chistka/<дата>`) — чистка итогов звонков старше `hranenie.zvonki_dney` (30): `zvonki/`, `zvonki-itog/`, `zvonki-vhod/`, `razgovory/` (`lib/chistka.js`; карточки, отказы, согласия и журнал не трогает) |
| `volny` | расписание | — | по каждому открытому отказу — решение движка (`sleduyushcheeDeystvie`): волна, побудка или ждать; смена началась — «не закрыта». Побудка — исходящий звонок с потолком `limity.ishodyashchih_v_sutki` (10): упёрлись — письмо координатору вместо звонка |
| `napominaniya` | расписание, 15 мин | — | собеседования (`kandidaty.sobesedovanie`) и оценки (`semi.ocenka`) — за 24 ч и за 2 ч, окно ±7,5 мин; SMS при согласии, иначе письмо; флаги `napominanie_24/_2` во встрече (раздел «Напоминания») |

## Инструменты агента: как стенд их понимает

- URL: `https://linii-demo-85fof.netlify.app/.netlify/functions/<функция>`. Ответ **всегда HTTP 200**: `{ok:true,…}` или `{ok:false, soobshchenie}` — фраза для звонящего; `dalshe` — указание агенту, не для произнесения.
- Заголовок `x-liniya-klyuch` — секрет линии. У CareLine DEMO **один секрет на обе линии**: workspace secret `careline_demo_x_liniya_klyuch` (secret_id `KomtreYBZQp3NoyIGVnN`), на стенде — переменная **`CARELINE_DEMO_LINIYA_KLYUCH`** с тем же значением (из `~/.bidna-golos.env`, значение не печатать). По секрету стенд находит клиента; линию — по функции (`okna`, `zapis`, `kandidat`, `semya` → найм; `otkaz` → сиделки; `perevod` → по `agent_id`). Один секрет у линий разных клиентов — отказ.
- Необязательные поля в теле сужают выбор линии: `nomer_linii` ← `system__called_number`, `agent_id` ← `system__current_agent_id`.
- **Перевод `perevod_careline_demo`** (`tool_7701m3tyc9pqfmab2krhhmhbe2jq`, создан 01.10 из `care/instrumenty/perevod.json` и подключён к обоим DEMO-агентам вместо системного `transfer_to_number`): тело `call_sid ← system__call_sid`, `conversation_id ← system__conversation_id`, `agent_id ← system__current_agent_id` (после `transfer_to_agent` это агент сиделок), `svodka`, `yazyk` (имена системных переменных сверены с документацией ElevenLabs 01.10). `nomer_linii` в теле нет намеренно: у обеих линий один номер, и он сузил бы выбор до линии найма. Нет `system__call_sid` (текстовый прогон, веб-разговор) — `kod:'net_sid'`; при `DRY_RUN=1` всегда `{ok:false, dry_run:true}` — агент не обещает перевод и принимает сообщение (`test/stend-perevod-instrument.test.js`).
- `yazyk` в теле (en/es/ru) — язык ответа: `soobshchenie`, `start_tekst`, тексты окон, письмо и SMS о записи. `zapis` и `otkaz` понимают его необязательным полем (в телах инструментов его ещё нет — поле описано в KONTRAKT.md, «Дополнения стенда 30.09 вечер»). Без него `zapis` отвечает на языке карточки этого разговора (`sohranit_kandidata`/`sohranit_semyu` шлют `yazyk` обязательным полем), `otkaz` — по-английски (агент переводит сам).
- Новые отказы с HTTP 200 (ничего не записано, `soobshchenie` — реплика звонящему, `dalshe` — указание агенту):
  | Функция | `kod` | Когда | `soobshchenie` (en) |
  |---|---|---|---|
  | `kandidat`, `semya` | `net_imeni` | имя пустое или служебное: Caller, Unknown, Applicant, N/A, Anonymous, Звонящий, Неизвестно, Llamante, Desconocido… (без регистра и диакритики; «DEMO» не в счёт; номер телефона вместо имени — тоже заглушка) | I need your first and last name first — could you spell it for me? |
  | `kandidat` | `net_otbora` | нет `sertifikat` (и нет `prichina_otkaza` листа ожидания), а карточки с отбором у разговора или телефона ещё нет | Before I save your application, I need to ask you a couple of quick questions about your certificate and your schedule. |
  | `otkaz` | `net_prichiny` + `nuzhno_utochnit:true` | смена найдена однозначно, отказа по ней нет, `prichina` пустая или «unknown/none/N/A» | What's the reason — are you sick, is it transportation, a family matter, or something else? |

## Переменные агента на старте звонка (`vhod`)

`vhod` кладёт в `register-call` поле `conversation_initiation_client_data.dynamic_variables` (сверено с документацией ElevenLabs 30.09: `dynamic_variables` — словарь строк/чисел/булевых, ответ — строка TwiML). У обоих DEMO-агентов на эти имена стоят пустые заглушки (`care/sborka_agentov.py`, `dynamic_variable_placeholders`), поэтому без них разговор тоже начинается — просто хуже.

| Переменная | Значение | Откуда |
|---|---|---|
| `ofis_seychas` | `OPEN` / `CLOSED` | часы офиса клиента `nastroyki.perevod.chasy` (лист правды: пн–пт, 09:00 ≤ t < 17:00) по поясу клиента `poyas`; часов в настройках нет — переменная не передаётся |
| `kalendar` | `Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; …` — 14 дней | местная дата клиента; ровно формат `chasy()` из `care/progony/progon.py`, на котором гонялись прогоны |

Календарь один и по-английски для всех трёх языков: пресеты ES и RU читают тот же `{{kalendar}}` (переменная одна на разговор, язык меняется посреди звонка), и прогоны ES/RU шли с английским календарём. Отдельные `kalendar_es`/`kalendar_ru` стенд не шлёт: у агентов под них нет заглушек, а новые имена без правки промптов и прогонов не нужны. Сбой расчёта — соединяем без переменных; ElevenLabs отверг их (400/422) — один повтор `register-call` без них (на живом номере переменные ещё не проверены, звонок важнее). Путь А (родной импорт номера) переменные даёт только вебхук начала разговора `nachalo` — его на стенде нет (`care/PRIVYAZKA.md`, путь А, шаг 2); функция посчитала бы их тем же `peremennyeZvonka`. Статус офиса пишется в журнал звонка (`zvonok_vhod.detali.ofis_seychas`). Формат звука агентов — `pcm_16000`, как у EN-Веры, которая с 25.09 живёт на пути Б (проверено чтением конфигурации 30.09) — менять не нужно.

## Напоминания (`napominaniya`, каждые 15 минут)

- **Что и когда:** собеседование кандидата (`kandidaty/<id>.sobesedovanie`) и оценка на дому (`semi/<id>.ocenka`) — за 24 ч и за 2 ч до начала; окно ±7,5 мин вокруг момента, полуоткрытое, поэтому срабатывает ровно один запуск. Пропустил Netlify запуск — этого напоминания нет (SMS не вовремя хуже, чем никакого).
- **Кому:** встреча в будущем и статус `new`/`booked`/`reminded` (или без статуса). `attended`, `no_show`, `rejected`, `waitlist` — никогда.
- **Канал:** SMS — только при согласии: `soglasiya/<телефон>.sms` (STOP сильнее всего), записи нет — `soglasiya.sms` карточки. Иначе (или SMS не ушло) — письмо, если есть почта: кандидат — `email`, семья — `kontakt.email` (кладёт `zapis`, если почту назвали при записи). Нет ни того, ни другого — только флаг `{kanal:null, rezultat:'net_kanala'}` и строка журнала `napominanie_net`.
- **Свежая запись:** записались меньше чем за час до момента напоминания — не шлём (`rezultat:'svezhaya_zapis'`), подтверждение только что ушло.
- **Против повтора:** флаги `napominanie_24` / `napominanie_2` = `{at, kanal, rezultat}` в самой встрече; перенос (`zapis`) создаёт новую встречу без флагов — новое время напоминается заново. Второй рубеж — ключ дублей отправки `napominanie-sms|pismo:<klient>:<event_id>:<24|2>`.
- **Текст:** на языке карточки (`yazyk`: en/es/ru, иначе английский), с отправителем-агентством и «Reply STOP to opt out» в SMS; SMS — с номера `nastroyki.sms.ot`, иначе номера линии найма. Кандидату после первого ушедшего напоминания — статус `reminded` (словарь контракта); статусы семей не трогаем.
- **Выключить у клиента:** `nastroyki.json` → `"napominaniya": {"vklyucheny": false}` (поля нет — включены). Всё наружу — через `lib/otpravka`: при `DRY_RUN=1` в журнал клиента пишется `sms_dry_run` / `pismo_dry_run`.
- **Семьи:** в сценарии семьи агент не спрашивает ни согласия на SMS, ни почты — напоминание семье сейчас уйдёт, только если согласие пришло итогом звонка (`data_collection.sms_soglasie`) или почту назвали при записи. `semya` понимает необязательное `sms_soglasie` — поле для тела инструмента и вопроса в промпте (решение сборщика агентов).

## Хранилище `k-<klient>`

Ключи контракта: `kandidaty/`, `semi/`, `sidelki/`, `klienty/`, `smeny/`, `otkazy/`, `evv/`, `zvonki/`, `soglasiya/<телефон>` (+ `istoriya[]`), `zhurnal/<дата>`. Служебные ключи стенда:

| Ключ | Зачем |
|---|---|
| `razgovory/<conversation_id>` | что сделано в разговоре: `kandidat_id`, `semya_id`, `otkaz_id`, `zapisi{tip}`, `perevod` |
| `indeks/telefon/{kandidat,semya}/<E.164>` | одна карточка на человека |
| `bron/<tip>/<start UTC>` | замок окна (двойная запись) |
| `zakrep/<smena_id>` | замок смены (двойное закрепление) |
| `predlozheniya/<E.164>` | открытые и закрытые предложения смен сиделке (код в SMS) |
| `otpravleno/<хэш ключа>` | ключ дублей писем, SMS, звонков |
| `schetchiki/<дата>` | потолки клиента: `pisem`, `sms`, `zvonkov` (входящие), `ishodyashchih` (исходящие звонки, с 01.10) |
| `zvonki-vhod/<дата>/<CallSid>`, `zvonki-itog/<conv>` | повтор вебхуков Twilio и ElevenLabs |
| `svodka/<дата>`, `svodki/<дата>` | замок и копия утренней сводки |
| `chistka/<дата>` | замок суточной чистки итогов звонков (`lib/chistka.js`) |

**Срок хранения.** `zvonki/`, `zvonki-itog/`, `zvonki-vhod/`, `razgovory/` живут `hranenie.zvonki_dney` дней (30) — их чистит `svodka` раз в сутки, запись без понятной даты не трогает. У ElevenLabs расшифровки DEMO-агентов живут столько же: `platform_settings.privacy.retention_days: 30` (с 01.10, к прежним разговорам не применяется). Журнал `zhurnal/` (там тексты писем и SMS в DRY_RUN), карточки и согласия срока пока не имеют — решение Андрея.

Отдельно: хранилище `kalendar-klyuch`, ключ `sa` — JSON служебного аккаунта Google (не в переменную: потолок Lambda 4 КБ на все переменные).

**Гонки.** Замки и правки общих записей — условной записью (`onlyIfNew` / `onlyIfMatch` по etag), замок перечитывается по случайной метке. Запись на окно — три рубежа: повтор той же встречи; замок окна; сверка с календарём после создания (из двух наших событий на окно остаётся раннее, своё свежее удаляется). «ДА» на смену: решение движка → замок `zakrep/` → движок ещё раз на свежем состоянии; опоздавшие «ДА» записываются и получают «смена уже закрыта». **[не проверено на стенде]** соблюдает ли Blobs в режиме токена `If-None-Match: *` — проверить первым делом после выкладки (ниже).

## Перевод на человека

**Коротко.** Переводить не системным `transfer_to_number`, а своим инструментом-вебхуком (план Б Веры): агент передаёт `system__call_sid`, функция `perevod` через REST Twilio обновляет **этот** звонок своим TwiML — «Соединяю…» → `<Dial timeout=20>` на первый номер цепочки → ширма «нажмите 1» (автоответчик не нажмёт) → итог `<Dial action>`: соединились — отбой, нет — следующий номер, кончились — фраза отката. Звонок и на пути А, и на пути Б живёт в **нашем** аккаунте Twilio, поэтому обновить его можем сами:

- путь А, родной импорт номера в ElevenLabs — так RU-Вера: `Pivot/golos/site/netlify-functions/perevod-ru.js`, проверено 28.09 во всех четырёх исходах (`Pivot/golos/PLAN-B-PEREVOD.md`, `plan-b/VECHER-2026-09-28.md`);
- путь Б, register-call через нашу функцию входа — так EN-Вера: `perevod.js` обновляет звонок по call_sid, проверено 26.09, оба исхода.

Системный `transfer_to_number` на пути Б не работает вовсе (у ElevenLabs нет доступа к нашему Twilio — `zvonok-vhod.js`, память `reference-twilio-bez-importa`), а на пути А ждёт ~55 с и принимает автоответчик за ответ (27.09, память `reference-perevod-avtootvetchik`).

**Второй номер-мост не нужен.** Мост (`transfer_to_number` → отдельный номер Twilio, чей VoiceUrl → `perevod?shag=vhod`) работает только на пути А, стоит $1,15/мес, добавляет третью ногу (конференцию) и не проверен. Функция его умеет, но покупать не советую.

**Рекомендация:** путь Б (проверен на EN-линии, не упирается в 401 родного импорта от 25.09) + вебхук `perevod`. Путь А — одна попытка тройкой ключей; 401 → путь Б. Перевод одинаков на обоих путях.

**Часы.** В часы офиса (пн–пт 9–17 NY, `nastroyki.perevod.chasy`) — цепочка координаторов `perevod.cepochka`. Вне часов — только линия сиделок (`perevod_vne_chasov`; «срочно ли» решает агент по промпту) и на цепочку дежурных `dezhurnye.cepochka`; линия найма вне часов — сообщение и перезвон.

### Рецепт на вечернее окно (главный агент; сборщик стенда ничего не привязывал)

0. Порядок окна целиком — раздел «Окно выкладки» ниже: стенд выложен, переменные заданы одной пачкой, `npm test` зелёный, помощник-проверяющий смотрел.
1. **TwiML Bin** для запасного адреса (консоль Twilio — на английском, по-русски ломается). У DEMO живого офиса нет: `<Response><Say>Sorry, the demo line is temporarily unavailable.</Say><Hangup/></Response>`. У живого клиента — `<Dial>` на его офис. Пустой Bin для SMS-рубильника: `<Response/>`.
2. **Номер, путь Б.** `POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers/PNf8a1f3e6d8ade7dac3f3e8d69a08def2.json` с `VoiceUrl=https://linii-demo-85fof.netlify.app/.netlify/functions/vhod`, `VoiceMethod=POST`, `VoiceFallbackUrl=<Bin>`, `VoiceFallbackMethod=POST`, `SmsUrl=https://linii-demo-85fof.netlify.app/.netlify/functions/sms-vhod`, `SmsMethod=POST` — одной командой, как в `care/PRIVYAZKA.md` §2 шаг 3 (там готовый curl; адрес SMS один и тот же в обоих файлах). SMS разбирает только ответы сиделок (ДА/НЕТ, STOP/START, «не выйду»); исходящие SMS с номера без регистрации 10DLC операторы режут — пока DRY_RUN. Номер в ElevenLabs не заводить.
   *Путь А вместо:* `POST https://api.elevenlabs.io/v1/convai/phone-numbers` тройкой «API key + secret + account auth token» по образцу `Pivot/golos/twilio_podklyuchit.py` (зашит на dna, без `--pisat` только показывает) и назначить агента найма. 401 → путь Б.
3. **Проверка входа:** запрос на `vhod` без подписи → 403; один звонок дозвонщиком с нашего номера обкатки (`--ot` обязателен) на +1 929 209 9535 → разговор у агента найма.
4. **Инструмент перевода — СДЕЛАНО 01.10:** `perevod_careline_demo` = `tool_7701m3tyc9pqfmab2krhhmhbe2jq` (тело `care/instrumenty/perevod.json`), подключён к обоим DEMO-агентам через `care/sborka_agentov.py --primenit`; системный `transfer_to_number` снят (явным null), `transfer_to_agent` и `end_call` на месте; в промптах трёх языков имя заменено и дописан раздел «перевод на этой линии» (перед вызовом молчать, `ok:true` — ни слова, `ok:false` — принять сообщение). Проверено GET: `dependent-agents` — ровно два DEMO-агента; `version_id` EN-Веры не изменился. В окне ничего делать не нужно.
5. **Номера** — решение Андрея: `perevod.cepochka` (координаторы), `dezhurnye.cepochka` (ночь и побудка). Номер перевода ≠ номеру, с которого стоит переадресация. callerId перевода — +1 929 209 9535: сохранить в контактах, иначе незнакомый номер за 20 с не возьмут. Правка `nastroyki.json` = новая выкладка.
6. `DRY_RUN=0` — только по «да» Андрея; до этого `perevod` пишет в журнал `perevod_dry_run` и Twilio не трогает.
7. **Четыре исхода** как в `PLAN-B-PEREVOD.md`: взял и нажал · взял без нажатия · не взял · сбросил. Звонок на живой телефон — только в согласованное время.
8. Записи «соединяю с…» голосом агента — по желанию (`web/zvuk/brightside/<yazyk>/`, `nastroyki.perevod.zvuk`; рецепт TTS — `.claude/skills/zapusk-very/spravka.md` §6, тратит кредиты). Без них звучит Polly.

**[не проверено]** `system__current_agent_id` после `transfer_to_agent`; `transfer_to_agent` на пути Б; режим моста `shag=vhod`.

**Итог звонка.** Вебхук post-call у агентов не подключён. Завести **свой** (не `009c2156…` Веры) на `…/.netlify/functions/itog` **до выкладки** (его HMAC-секрет — в переменные той же пачкой: на стенде `CARELINE_WEBHOOK_SECRET`, на Маке `CARELINE_DEMO_WEBHOOK_SECRET`), а `post_call_webhook_id` в обоих DEMO-агентах — **после выкладки**: раздел «Окно выкладки», шаги 1 и 7.

## Переменные окружения стенда (только имена)

Слева — имя, которое читает код стенда; справа — откуда брать значение на Маке. Имена расходятся намеренно: в `~/.bidna-golos.env` лежат и ключи живой Веры, а стенд — отдельный сайт со своими секретами (проверка 30.09).

| Имя на стенде | ← имя в `~/.bidna-golos.env` (или откуда) | Нужна | Зачем |
|---|---|---|---|
| `DRY_RUN` | — литерал `1` | да | всё наружу — в журнал; `0` — только по «да» Андрея |
| `PLATFORMA_URL` | — литерал `https://linii-demo-85fof.netlify.app` | да | адреса обратных вызовов Twilio (ширма перевода, побудка), ссылка пульта в сводке |
| `CARELINE_DEMO_LINIYA_KLYUCH` | `CARELINE_DEMO_LINIYA_KLYUCH` (то же имя, есть) | да | секрет `x-liniya-klyuch` обеих линий = workspace secret `careline_demo_x_liniya_klyuch` (`KomtreYBZQp3NoyIGVnN`) |
| `CARELINE_WEBHOOK_SECRET` | `CARELINE_DEMO_WEBHOOK_SECRET` — **заводится при создании вебхука итога** (шаг 1 окна), сейчас его нет | да | HMAC итога звонка (`itog`). **Не** `ELEVENLABS_WEBHOOK_SECRET`: под этим именем на Маке секрет живой Веры, стенд его не читает (тест `stend-itog`) |
| `ELEVENLABS_API_KEY` | `ELEVENLABS_STAND_KEY` (стендовый, бессрочный) | да (путь Б) | `register-call` в `vhod`. Не `ELEVENLABS_API_KEY` с Мака: тот замерочный и выдан на 30 дней |
| `TWILIO_ACCOUNT_SID` | `TWILIO_ACCOUNT_SID` | да | REST Twilio: перевод, SMS, побудка |
| `TWILIO_AUTH_TOKEN` | `TWILIO_AUTH_TOKEN` (мастер-токен аккаунта; субаккаунт — решение Андрея) | да | подписи `vhod`/`sms-vhod`, REST Twilio |
| `PULT_KLYUCH_BRIGHTSIDE` | `CARELINE_DEMO_PULT_KLYUCH` — **новый**, заводится в шаге 2 окна | да | ключ пульта `/pult/?k=` и `evv`, ≥ 16 символов |
| `BLOBS_TOKEN` | `CARELINE_DEMO_BLOBS_TOKEN`, если Андрей заведёт отдельный токен (app.netlify.com → User settings → Applications → Personal access tokens → New access token); иначе токен netlify CLI из `~/Library/Preferences/netlify/config.json` (как `EV_BLOBS_TOKEN` у Веры; в `~/.bidna-golos.env` его нет) | да | Blobs в режиме токена со строгой согласованностью; `SITE_ID` Netlify ставит сам |
| `RESEND_API_KEY` | `RESEND_API_KEY` | только при `DRY_RUN=0` | письма; плюс отправитель `pisma.ot` в `nastroyki.json` (решение Андрея) |
| `ZVONKI_BEZ_KVOTY` | — номера проверяющих через запятую (не секрет) | по желанию | свои номера обкатки — мимо суточного предела 15 и мимо fail-closed |
| `GOOGLE_SA_JSON` | — | нет | запасной путь; ключ кладёт `scripts/zalit-klyuch-kalendarya.js` в Blobs `kalendar-klyuch`/`sa` |

Не задавать на стенде: `ELEVENLABS_WEBHOOK_SECRET` (секрет Веры), `HRANILISHCHE_LOKALNO`, `HRANILISHCHE_PAPKA`, `KALENDAR_ADAPTER` (только для тестов; фейковый календарь живёт в памяти одного экземпляра функции).

**Заливка одной пачкой, без вывода значений** (`netlify env:set` печатает значение — вывод в `/dev/null`; переменная действует только с новой выкладкой, поэтому до шага 5):

```bash
cd /tmp && set -a && . ~/.bidna-golos.env && set +a         # значения — только в окружение этого шелла
S=ea43276c-c92b-479d-b662-541651e04cf2
zadat() { [ -n "$2" ] || { echo "$1: ПУСТО — не задаю"; return 1; }
          netlify env:set "$1" "$2" --site "$S" --force >/dev/null 2>&1 && echo "$1: ok" || echo "$1: ОШИБКА"; }
BT="${CARELINE_DEMO_BLOBS_TOKEN:-$(python3 -c 'import json,os;d=json.load(open(os.path.expanduser("~/Library/Preferences/netlify/config.json")));print(next(u["auth"]["token"] for u in d["users"].values() if (u.get("auth") or {}).get("token")))')}"
zadat DRY_RUN 1;  zadat PLATFORMA_URL https://linii-demo-85fof.netlify.app
zadat CARELINE_DEMO_LINIYA_KLYUCH "$CARELINE_DEMO_LINIYA_KLYUCH"
zadat CARELINE_WEBHOOK_SECRET "$CARELINE_DEMO_WEBHOOK_SECRET"
zadat ELEVENLABS_API_KEY "$ELEVENLABS_STAND_KEY"
zadat TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID";  zadat TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN"
zadat PULT_KLYUCH_BRIGHTSIDE "$CARELINE_DEMO_PULT_KLYUCH"
zadat BLOBS_TOKEN "$BT"; unset BT
NETLIFY_SITE_ID=$S netlify env:list --json --context production 2>/dev/null \
 | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d),'перем.,', sum(len(k)+len(v or '')+2 for k,v in d.items()),'байт из 4096'); print(' '.join(sorted(d)))"
```

Каждая строка должна сказать `ok`; «ПУСТО» — значит на Маке нет исходной переменной (шаги 1–2 окна не сделаны). Сверка — только имена и байты.

## Окно выкладки (главный агент, вечером, по «да» Андрея) — порядок

Порядок важен: переменная окружения Netlify начинает действовать только со следующей выкладкой, поэтому всё, что даёт секрет (вебхук итога), делается **до** выкладки, а всё, что зовёт стенд (вебхук у агентов, номер, первый звонок), — **после**.

0. **До окна, локально, без «да»:** `cd platforma && npm install && npm test` → 247 из 247 (Node 24 и 26; падения чужих тестов — к их сборщикам). Сборка 14 функций под Node 20, как соберёт Netlify:
   ```bash
   npm install --no-save --prefix "$TMPDIR/esb" esbuild@0.25.12      # один раз, только инструмент сборки
   mkdir -p "$TMPDIR/linii-bundles"; n=0
   for f in netlify-functions/*.js; do "$TMPDIR/esb/node_modules/.bin/esbuild" "$f" --bundle --platform=node --target=node20 \
     --format=cjs --outfile="$TMPDIR/linii-bundles/$(basename "$f")" --log-level=warning && n=$((n+1)) || echo "УПАЛО: $f"; done; echo "собрано $n из 14"
   ```
1. **Вебхук итога — ДО выкладки** (`care/PRIVYAZKA.md` §3, шаг 1): `POST /v1/workspace/webhooks` на `…/.netlify/functions/itog`; секрет — сразу в `~/.bidna-golos.env` как `CARELINE_DEMO_WEBHOOK_SECRET` (не на экран); `webhook_id` — в `care/elevenlabs.json` поле `vebhuk_itoga_sozdan` (сборщик агентов это поле не читает: к агентам вебхук пока не подключается).
2. **Новые ключи на Маке, без вывода:** ключ пульта — `printf '\n# 01.10 CareLine DEMO: ключ пульта /pult/?k=\nCARELINE_DEMO_PULT_KLYUCH=%s\n' "$(openssl rand -hex 24)" >> ~/.bidna-golos.env`; отдельный токен Blobs `CARELINE_DEMO_BLOBS_TOKEN` — если Андрей его завёл (иначе пачка возьмёт токен netlify CLI).
3. **Переменные — одной пачкой** (рецепт выше), сверка имён и байтов.
4. **Календарь DEMO:** календари уже вписаны в `nastroyki.json` (`kalendari.sobesedovanie/ocenka.kalendar`) — проверить в Google Calendar, что оба поделены с `vera-kalendar@business-intelligence-dna.iam.gserviceaccount.com` правом «Внесение изменений в мероприятия». Ключ служебного аккаунта — в Blobs стенда (ключ ~2,4 КБ, в переменные не лезет):
   ```bash
   cd platforma && SITE_ID=ea43276c-c92b-479d-b662-541651e04cf2 node scripts/zalit-klyuch-kalendarya.js --blobs            # «Залит … — сверено чтением»
   SITE_ID=ea43276c-c92b-479d-b662-541651e04cf2 node scripts/zalit-klyuch-kalendarya.js --blobs --proverit                # код 0, «тот же, что в файле»
   ```
   Токен скрипт берёт из `BLOBS_TOKEN`/`NETLIFY_AUTH_TOKEN`, иначе из netlify CLI; содержимое ключа не печатает; на чужой `SITE_ID` (например, стенд Веры) отказывает. Без ключа `okna` честно отвечает «календарь не отвечает».
5. **Выкладка:** из `platforma/`: `netlify deploy --prod --dir=web --functions=netlify-functions --skip-functions-cache --site ea43276c-c92b-479d-b662-541651e04cf2` (без `--skip-functions-cache` CLI берёт старый кеш функций — грабли `vykladka-sayta`). Откат — `netlify api restoreSiteDeploy --data '{"site_id":"ea43276c-c92b-479d-b662-541651e04cf2","deploy_id":"<прошлый>"}'`.
6. **Сразу после, чтением:** `vhod` и `sms-vhod` без подписи → 403; `pult` и `evv` без ключа → 401; `itog` без подписи → 401; инструмент с чужим ключом → 200 `{ok:false, kod:'net_dostupa'}`; `/pult/API.md` → 404 (документ больше не публикуется); `/pult/?k=<ключ>` открывает пульт и ключ уходит из адресной строки; **замок Blobs**: с Мака `SITE_ID=… BLOBS_TOKEN=… node -e` два одновременных `hranilishcheKlienta('brightside').zanyat('proverka/1', {})` → ровно один `true`; в панели Netlify → Functions у `svodka`, `volny`, `napominaniya` пометка Scheduled ([не проверено], подхватывает ли их CLI-выкладка).
7. **Вебхук итога к DEMO-агентам — ПОСЛЕ выкладки:** перенести id из `vebhuk_itoga_sozdan` в `vebhuk_itoga_id` (`care/elevenlabs.json`) → `python3 care/sborka_agentov.py --primenit` (сборщик сам откажет на вебхуке Веры `009c2156…`) → GET обоих агентов: `platform_settings.workspace_overrides.webhooks.post_call_webhook_id` = новый id; `version_id` EN-Веры `agent_6801m3cz595hesgr7cxent1vse6r` прежний; `post_call_webhook_id` рабочего пространства всё ещё null.
8. **Номер** — рецепт «Перевод на человека», шаги 1–3, и `care/PRIVYAZKA.md` §2: TwiML Bin, затем `VoiceUrl`, `VoiceFallbackUrl`, `SmsUrl` одной командой; прежние значения записать до смены.
9. **Первый звонок — только после шагов 1–8** (`care/PRIVYAZKA.md` §4): `itog` ответил 200 и `zvonki/<conv>` заполнен; `schetchiki/<дата>.zvonkov` = 1; переменные `ofis_seychas`/`kalendar` дошли; инструменты отвечают без `net_dostupa`; в журнале только `*_dry_run`.
10. Демо-данные в пульт — по «да»: `SITE_ID=… BLOBS_TOKEN=… node scripts/zagruzit-demo.js --blobs --seychas <ISO>`.

### Что проверить в окне (дополнения 30.09 вечер и 01.10)

01.10 переменная итога переименована (`CARELINE_WEBHOOK_SECRET`, таблица выше); новые пределы и срок хранения — в `nastroyki.json`, не в переменных. Всё ниже — чтением ответов и журнала, без звонков живым людям.

1. **Расписания:** в панели Netlify → Functions у `svodka` (`0 11,12 * * *`), `volny` (`*/5 * * * *`) и `napominaniya` (`*/15 * * * *`) стоит пометка Scheduled. Первые запуски `napominaniya` в логе функции: `[napominaniya] [{"klient":"brightside","vstrech":…}]`, без `oshibka`.
2. **Переменные агента дошли** (первый проверочный звонок, путь Б): `GET /v1/convai/conversations/<id>` → `conversation_initiation_client_data.dynamic_variables` содержит `ofis_seychas` (OPEN в пн–пт 9–17 NY, иначе CLOSED) и `kalendar` из 14 дней, первый — сегодняшний день Нью-Йорка с «(today)». В журнале `k-brightside/zhurnal/<дата>` у `zvonok_vhod` — тот же `ofis_seychas`. «Are you open now?» — ответ по статусу; «next Tuesday» — верная дата.
3. **Защита карточек** (curl с ключом линии, как в `care/PRIVYAZKA.md`, шаг 1.2): `kandidat` с `"imya":"Caller"` → `{"ok":false,"kod":"net_imeni",…}`; с настоящим DEMO-именем без `sertifikat` → `"kod":"net_otbora"`; в `kandidaty/` ничего нового. `otkaz` с телефоном DEMO-сиделки, датой её смены и без `prichina` → `"kod":"net_prichiny"`, в `otkazy/` пусто.
4. **Язык ответа:** `zapis`/`otkaz` с `"yazyk":"es"` → `start_tekst` и `soobshchenie` по-испански (например, «lunes 5 de octubre a las 10:00 de la mañana»).
5. **Напоминания:** DEMO-запись (DEMO-телефон, согласие на SMS) больше чем на сутки вперёд → в момент «начало − 24 ч» (±7,5 мин) в журнале `napominanie` и `sms_dry_run` с текстом «…Reminder: your interview is tomorrow…», у встречи в карточке `napominanie_24`, статус `reminded`; в «начало − 2 ч» — второе. При `DRY_RUN=1` наружу не уходит ничего.
6. **Пределы (01.10):** после первого звонка `schetchiki/<дата>.zvonkov` = 1; на шестнадцатом за сутки (не с номера из `ZVONKI_BEZ_KVOTY`) — фраза «can't take your call» и `zvonok_predel` в журнале. У агентов `platform_settings.call_limits.daily_limit` = 20 (GET). Fail-closed на живом стенде нарочно не проверять (пришлось бы ломать Blobs): он покрыт тестом и проверен на бандле `vhod` без хранилища — фраза «temporarily unavailable», ноль сетевых вызовов.
7. **Чистка (01.10):** на следующее утро после первого запуска `svodka` в логе функции строка `[svodka] чистка [{"klient":"brightside","den":…}]` без `oshibka`, в журнале дня — `chistka`.

## Аварийный рубильник (скилл `zapusk-very`, раздел «Аварийно»)

1. **Наш рычаг — голос:** VoiceUrl +1 929 209 9535 → тот же TwiML Bin, что в VoiceFallbackUrl: `POST …/IncomingPhoneNumbers/PNf8a1f3e6d8ade7dac3f3e8d69a08def2.json` с `VoiceUrl=<bin>`. Прежний VoiceUrl записать до смены; возврат той же командой.
2. **SMS:** `SmsUrl` (`https://linii-demo-85fof.netlify.app/.netlify/functions/sms-vhod`) → пустой Bin `<Response/>`; возврат — тем же адресом. Исходящие — `DRY_RUN=1` (смена переменной вступает в силу с новой выкладкой).
3. **Рычаг клиента** (живой клиент): снять переадресацию со своего номера — работает без нашей инфраструктуры.
4. Netlify `usage_exceeded` кладёт все сайты: путь Б умирает целиком — спасает VoiceFallbackUrl; путь А — агент отвечает, инструменты молчат (`reference-netlify-kredity-503`).
5. Фолбэк срабатывает только на ошибку адреса; «агент взял трубку и молчит» — рычаг 1. «Месяц не берём» — деньги, решает Андрей. Когда, что увидели, что сделали, когда вернули — в карточку.

## Сводка и летнее время

Cron Netlify — только UTC: 7:00 America/New_York = 11:00 UTC летом и 12:00 UTC зимой (ближайший перевод — 1 ноября 2026). Расписание зовёт `svodka` в 11 и 12 UTC; письмо уходит, только когда местный час клиента = `svodka.chas` (7), и раз в сутки (замок `svodka/<дата>`). Упал запуск в 7:xx — повтора в этот день нет.

## Тесты

`cd platforma && npm install && npm test` (= `node --test test/*.test.js`: работает на Node 20, 24 и 26; `node --test test/` на Node 26 падает). Только стенд: `node --test test/stend-*.test.js`. Сеть в тестах запрещена, хранилище — во временной папке, время подменяется. 01.10: 247 из 247 на Node 24 и 26; новые — `stend-perevod-instrument` (вход инструмента `perevod_careline_demo` на настоящем `linii.json`), `stend-zalit-klyuch` (скрипт ключа календаря на локальном адаптере, с подменённым HOME), `stend-chistka` (срок хранения), fail-closed в `stend-vhod`, потолок исходящих в `stend-otpravka`, имя секрета итога в `stend-itog`.

## Не проверено и решения за Андреем

Не проверено ничего на живом стенде: Blobs `onlyIfNew` в режиме токена, расписания при CLI-выкладке (в том числе `napominaniya`), `register-call` нового номера и доходят ли `ofis_seychas`/`kalendar` в разговор, перевод на этой линии, `system__current_agent_id`, календарь DEMO, письма Resend с отправителем клиента. Напоминания за 24 и 2 часа есть с 30.09 вечера (`napominaniya`), но семьям они почти не уйдут, пока сценарий семьи не спрашивает согласия на SMS или почту (раздел «Напоминания»). **За Андреем:** отправитель писем и адрес ответа, номера цепочек перевода и дежурных, момент `DRY_RUN=0`, регистрация SMS 10DLC на номер, адресаты сводки (в ссылке письма — ключ пульта); с 01.10 ещё — настоящий номер в демо-данных для проверки линии сиделок голосом (запрет 7 KONTRAKT.md), смена ключей после утечки 30.09, субаккаунт Twilio и отдельные ключи стенда (`PROVERKA-PERED-VYKLADKOY.md`, «Исправлено 01.10 ночью»).
