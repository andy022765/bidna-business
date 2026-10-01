# Контракт сборки №44 CareLine и №43 NightDesk

*30.09.2026. Общие договорённости для всех, кто собирает прототипы. План со схемами: https://claude.ai/artifact/4GRMVWcFHKyUPCP6CXGCQf (копия `plan/`). Меняешь контракт — пиши сюда и в итоговый отчёт.*

## Жёсткие запреты (действуют до «да» Андрея)

1. **Не трогать живое:** `Pivot/golos/site/` и всё в `Pivot/golos/` только ЧИТАТЬ. Наши агенты ElevenLabs (dna, EN, календарь, demo) и их инструменты не PATCH-ить и не удалять. VoiceUrl наших номеров не менять.
2. **Не выкладывать** ничего на Netlify, не создавать сайты. Код только в этой папке, проверка локально (`node --test`).
3. **Не тратить деньги:** не покупать номера, не менять тарифы, не включать платные функции.
4. **Не писать и не звонить людям.** Никаких писем, SMS и звонков на внешние номера. Отправку делать через адаптер с режимом `DRY_RUN=1` по умолчанию: пишет в журнал, что ушло бы.
5. **Ключи Anthropic проекта не использовать** (ключ сайта делится с живой воронкой, ключ Смотрителя — с замерами).
6. **Секреты не печатать и не класть в Drive.** Ключи — только из `~/.bidna-golos.env` (скрипты берут ПОСЛЕДНЕЕ объявление переменной), в код — через `process.env`.
7. Данные только вымышленные, помеченные `DEMO`. Никаких настоящих имён и телефонов людей.

Разрешено: создавать НОВЫХ агентов и НОВЫЕ инструменты ElevenLabs с пометкой `DEMO` в имени (в пределах оплаченного тарифа), текстовые прогоны разговоров (не больше 150 на весь №44).

## Папки

```
Pivot/produkty/linii-44-43/
  KONTRAKT.md            этот файл
  plan/                  план со схемами (html)
  platforma/             стенд прототипов (будущий отдельный сайт Netlify)
    netlify.toml
    netlify-functions/   функции (JS, CommonJS, node 20, esbuild)
    lib/                 общие модули: хранилище, подписи, отправка, журнал, движки
      care/              движки №44: zamena.js, evv.js
      nightdesk/         движки №43 (позже)
    web/                 статические страницы: /pult/, /demo/care/, /demo/nightdesk/
    linii.json           карта «номер → линия → клиент» (без секретов)
    test/                тесты node --test
  care/                  №44: лист правды, промпты, инструменты, сценарии, демо-данные, прогоны
    list-pravdy/brightside.json
    prompty/{en,es,ru}.md
    instrumenty/*.json   тела для POST /v1/convai/tools
    scenarii/scenarii.json
    demo-dannye/         сиделки, клиенты, смены, авторизации, выгрузки EVV
    progony/             результаты текстовых прогонов
  nightdesk/             №43 (позже)
  prodazhi/care/         пакет продаж №44 (черновики)
  prodazhi/nightdesk/
```

## Клиенты и линии

- Демо-клиент №44: `brightside` — «Brightside Home Care (DEMO)», Бруклин и Квинс, NY; 45 сиделок, 60 клиентов; языки EN, ES, RU, ZH, HT.
- Демо-клиент №43: `harborrow` — «Harbor Row Property Management (DEMO)», 3 дома, 180 квартир (позже).
- `linii.json`: `{ "<E.164 номер>": { "liniya": "care-hiring" | "care-caregivers" | "nd-after-hours" | "nd-leasing", "klient": "brightside", "agent_id": "<ElevenLabs>", "yazyk": "en" } }`. Пока номеров нет — ключи вида `"DEMO-1"`.

## Хранилище (Netlify Blobs, на стенде; локально — адаптер в файлы `platforma/.data/`)

Хранилище: одно на клиента, имя `k-<klient>`. Ключи:

| Ключ | Что | Поля |
|---|---|---|
| `kandidaty/<id>` | кандидат A1 | id, created_at, istochnik (call/sms), conversation_id, yazyk, imya, telefon, email, sertifikat (HHA/PCA/CNA/net), rayon, zip, transport (bool), grafik {dni[], chasy}, yazyki[], opyt_let, pravo_na_rabotu (bool/null), podhodit (bool), prichina_otkaza, sobesedovanie {start,end,event_id}\|null, status (new/booked/reminded/attended/no_show/rejected/waitlist), soglasiya {zapis, ii, sms} |
| `semi/<id>` | обращение семьи A2 | id, created_at, conversation_id, kontakt {imya, telefon}, rayon, zip, chasy_v_nedelyu, oplata (private/medicaid/ltc/unknown), srochnost, ocenka {start,end,event_id}\|null, status |
| `sidelki/<id>` | сиделка | id, imya, telefon, yazyki[], navyki[], zip, maks_chasov_v_nedelyu, chasov_na_etoy_nedele, nadezhnost (0..1), znaet_klientov[], sms_soglasie (bool), aktivna |
| `klienty/<id>` | клиент агентства | id, kod, zip, yazyk, trebovaniya_navyki[], avtorizacii[] |
| `smeny/<id>` | смена | id, klient_id, sidelka_id, start, end, kod_uslugi, status (scheduled/calloff/offered/filled/unfilled) |
| `otkazy/<id>` | отказ A3 | id, smena_id, sidelka_id, prichina, soobshcheno, kanal, volny [{at, sidelki[]}], otvety [{sidelka_id, otvet, at}], zakreplena_za, zakreplena_v, eskalaciya_v |
| `evv/<run_id>` | прогон A4 | run_id, zagruzheno, shtat, strok, isklyucheniya [{vizit_id, pravilo, vazhnost, chto_ne_tak, kak_ispravit}] |
| `zvonki/<conversation_id>` | итог звонка | conversation_id, liniya, nachalo, dlitelnost_s, yazyk, namerenie, itog, kratko, soglasiya |
| `soglasiya/<telefon>` | журнал согласий | telefon, zapis, ii, sms, istochnik, at |
| `zhurnal/<YYYY-MM-DD>` | журнал действий | массив {at, kto, chto, obekt} |

Время — ISO 8601 с часовым поясом клиента (`America/New_York`). Телефоны — E.164.

## Функции стенда (`platforma/netlify-functions/`)

| Функция | Кто зовёт | Что делает |
|---|---|---|
| `vhod` | Twilio, голос | подпись Twilio → `linii.json` → `register-call` ElevenLabs → TwiML |
| `sms-vhod` | Twilio, SMS | подпись → ответы «ДА/YES/SÍ/НЕТ» на предложения смен, STOP/START → согласия |
| `okna` | инструмент агента | свободные окна собеседований или оценок (Google Calendar, служебный аккаунт) |
| `zapis` | инструмент агента | записать на собеседование/оценку, метка для письма |
| `kandidat` | инструмент агента | сохранить карточку кандидата |
| `semya` | инструмент агента | сохранить обращение семьи |
| `otkaz` | инструмент агента | зафиксировать отказ от смены, запустить подбор |
| `perevod` | инструмент агента / TwiML | перевод на человека с ширмой «нажмите 1», 20 с, цепочка номеров |
| `itog` | ElevenLabs post-call | HMAC → карточка звонка → журнал |
| `evv` | пульт | загрузка CSV → правила → исключения |
| `pult` | страница пульта | данные для пульта по ключу `?k=` |
| `svodka` | расписание 7:00 | утренняя сводка письмом (в DRY_RUN — в журнал) |

Инструменты агента зовут функции с заголовком `x-liniya-klyuch` (секрет линии из переменных стенда). Итог звонка — подпись HMAC как у Веры. Twilio — проверка `X-Twilio-Signature`.

## Инструменты агента: параметры (webhook, POST JSON)

Системные переменные ElevenLabs объявлять как `dynamic_variable`, модель их не заполняет: `system__conversation_id`, `system__caller_id`. Клиент линии берётся из `linii.json` по номеру, в теле его нет.

| Инструмент | Тело запроса | Ответ |
|---|---|---|
| `svobodnye_okna` → `okna` | tip (`sobesedovanie`/`ocenka`), data_s (YYYY-MM-DD, необяз.), yazyk | okna [{start, end, tekst}] — tekst на языке звонящего, например «Thursday, October 2 at 10:00 AM» |
| `zapisat` → `zapis` | tip, start, imya, telefon, email (необяз.), conversation_id | ok, event_id, start_tekst |
| `sohranit_kandidata` → `kandidat` | imya, telefon, email, sertifikat, rayon, zip, transport, grafik_dni[], grafik_chasy, yazyki[], opyt_let, pravo_na_rabotu, podhodit, prichina_otkaza, sms_soglasie, yazyk, conversation_id | ok, id |
| `sohranit_semyu` → `semya` | imya, telefon, rayon, zip, chasov_v_nedelyu, oplata, srochnost, yazyk, conversation_id | ok, id |
| `otkaz_ot_smeny` → `otkaz` | caller_id, data_smeny (необяз.), klient_kod (необяз.), prichina, conversation_id | ok, smena {start_tekst, klient_kod}\|null, nuzhno_utochnit (bool), soobshchenie |
| перевод на человека | системный `transfer_to_number` на номер функции `perevod` (ширма «нажмите 1», как `perevod-ru.js`) | — |

Ошибка инструмента — всегда JSON `{ok:false, soobshchenie}` с фразой, которую агент может сказать, и HTTP 200 (иначе агент молчит).

## Движки (без модели)

- `lib/care/zamena.js` — `podobrat(smena, sidelki, smeny, pravila) → [{sidelka_id, ball, prichiny[]}]`: фильтр (навыки, язык клиента, свободное время, лимит часов, sms_soglasie, активна), ранжирование (расстояние по zip, знает клиента, надёжность). `sleduyushchayaVolna(otkaz, reyting, pravila)`, `prinyatOtvet(otkaz, sidelka_id, otvet)` с защитой от двойного закрепления. Правила по умолчанию: волна 3, ожидание 15 мин, эскалация за 2 ч до начала.
- `lib/care/evv.js` — `proverit(vizity, avtorizacii, smeny, shtat) → isklyucheniya[]`. Правила: шесть полей EVV (услуга, получатель, дата, место, исполнитель, время начала и конца), отметки, место против адреса клиента, длительность против авторизации, пересечения визитов одной сиделки, даты и коды авторизации. Штаты: NY, NC.

## Приёмка №44 (из плана)

Раскрытие ИИ и запись — 100%. Линия найма: 40 сценариев, критичные 3 из 3, остальные ≥90%. Запись: событие + письмо + карточка, без дублей. Имена, телефоны, даты — 0 ошибок в карточках. Отказы: 20 из 20 без двойного закрепления, незакрытая смена будит дежурного. EVV: 30 из 30 подложенных ошибок, 0 ложных на чистой выгрузке. Пульт и сводка в 7:00.

## Дополнения care (30.09, сборка агентов) — что должен знать стенд

Id и всё остальное — `care/elevenlabs.json`. Тела инструментов — `care/instrumenty/*.json` (поля строго по таблице выше).

- **Секрет:** один на обе линии клиента `brightside`: `x-liniya-klyuch` = workspace secret ElevenLabs `careline_demo_x_liniya_klyuch`; значение — `~/.bidna-golos.env` → `CARELINE_DEMO_LINIYA_KLYUCH`. Инструменты общие для двух агентов одного клиента, поэтому стенд по секрету узнаёт клиента, а линию — по функции. Нужны раздельные секреты линий — второй секрет + копии инструментов.
- **URL инструментов** — с 30.09 `https://linii-demo-85fof.netlify.app/.netlify/functions/<функция>` (PATCH пяти инструментов сделан, id в `care/elevenlabs.json`).
- **Перечни значений** в телах (модель заполняет только их): `sertifikat` HHA/PCA/CNA/net; `prichina_otkaza` net_sertifikata/tolko_cna/drugoe; `oplata` private/medicaid/ltc/unknown; `srochnost` srochno/nedelya/pozzhe/ne_znayu; `prichina` (отказ) bolezn/semya/transport/drugoe; `yazyk` en/es/ru; `grafik_dni[]` mon…sun; `pravo_na_rabotu` не приходит = не уверен (null).
- **Карточку кандидата не шлём** при «нет права на работу» и «не может ездить» (итог звонка хранит факт); лист ожидания = `podhodit:false` + `prichina_otkaza`.
- **`zapis`:** агент зовёт один раз на звонок; передумал после записи — не перезаписывает, а оставляет сообщение. Желательно сделать `zapis` идемпотентной по `conversation_id` (повтор = перенос, не второе событие). `start_tekst` агент переводит сам — `zapis` может отвечать по-английски.
- **`otkaz`:** агент всегда шлёт `data_smeny` (посчитанную и подтверждённую звонящим), `klient_kod` — только если назвали. Имён клиентов агент не произносит и не передаёт; коды клиентов в демо-данных — `BK-###` (Бруклин), `QN-###` (Квинс). `soobshchenie` агент читает звонящему как есть — писать для звонящего, без внутренних слов.
- **Итог звонка (`itog`):** поля `data_collection` агентов — namerenie (kandidat/semya/otkaz/smena_seychas/soobshchenie/spam/drugoe), itog, kratko, imya, telefon, soobshchenie, sms_soglasie, yazyk; `summary_language` en. Сообщение координатору = поле `soobshchenie` итога: отдельного инструмента «сообщение» нет. Вебхук post-call у агентов **не подключён** (стенда нет); подключать свой, НЕ `009c2156…` Веры.
- **Перевод:** системный `transfer_to_number` на заглушку `+17185550199` (вымышленный 555-01xx) — заменить на номер Twilio, чей VoiceUrl → `perevod`. Линия найма переводит только в часы офиса (пн–пт 09:00–17:00 NY); линия сиделок — ещё и ночью при срочном по смене. Между линиями — системный `transfer_to_agent` (без повторного приветствия).
- **Время:** агенты читают `{{system__time}}` (у агента `prompt.timezone = America/New_York`). В текстовых прогонах `timezone` снимается через `agent_config_override` — иначе платформа подмешивает реальное время к подменённому (проверено 30.09).
- **НОВОЕ 30.09 — две переменные от стенда при старте звонка:** `ofis_seychas` = `OPEN`/`CLOSED` (America/New_York, пн–пт, 09:00 ≤ t < 17:00) и `kalendar` = 14 дней строкой `Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; …` (эталон — `chasy()` в `care/progony/progon.py`). Путь Б: `vhod` кладёт их в `register-call` → `conversation_initiation_client_data.dynamic_variables`. Путь А: только через вебхук начала разговора (функция `nachalo`, ответ `{type: "conversation_initiation_client_data", dynamic_variables: {…}}`). Зачем: без них модель сама сравнивает время и путает день — в прогонах 30.09 «закрыто» в среду 15:40, перевод вне часов, «пятница, третье» принято за пятницу; с переменными эти сценарии прошли. Пусто — агент работает, но хуже. Подробно — `care/PRIVYAZKA.md`.
- **НОВОЕ 30.09 — `kandidat` и `semya` делать upsert по `conversation_id`:** модель стабильно зовёт сохранение дважды (после отбора и после вопроса про SMS) с одинаковыми именем и телефоном — второй вызов должен обновить ту же карточку, а не завести вторую. Имя приходит латиницей, как продиктовано по буквам.
- **НОВОЕ 30.09 — защита от «пустого» имени (просьба к стенду, прогонами не проверено):** на `imya` пустое или служебное (`Caller`, `Unknown`, `Applicant`, `N/A`) `kandidat`/`semya` отвечают `{ok:false, soobshchenie:"I need your first and last name first — could you spell it for me?"}` и ничего не пишут. Зачем: на итоговых промптах агент всё ещё «сохраняет сообщение» вызовом `sohranit_kandidata` с именем «Caller» (care-19, care-31) — в пульте появился бы мусорный кандидат в листе ожидания. С таким ответом агент сам спросит имя. Сделать надёжно — отдельная функция «сообщение координатору» (сейчас сообщение = поле `soobshchenie` итога).
- **НОВОЕ 30.09 — порядок разговора найма (v3):** сначала контакты (имя по буквам, телефон, почта, согласие на SMS), потом вопросы отбора, потом одна карточка, окна, «Shall I book it?», запись. Вопрос про SMS теперь «о вашей заявке — например, напоминание о собеседовании» (лист правды обновлён).
- **Перевод, вариант стенда (`platforma/README.md`):** вебхук `perevod` вместо системного `transfer_to_number`. Тело инструмента готово — `care/instrumenty/perevod.json` (в ElevenLabs НЕ создан: ждёт решения главного агента); как переключить агентов — `care/PRIVYAZKA.md`, раздел 5.

## Решения Андрея 30.09 и что изменилось (дописано главным агентом)

- Андрей отметил в плане: d1 деньги до $80 — да; d2 отдельный сайт Netlify — да; d3 подрядчики — после демо; d4 названия CareLine и NightDesk.
- **Куплен номер CareLine DEMO: +1 929 209 9535** (Twilio `PNf8a1f3e6d8ade7dac3f3e8d69a08def2`, 30.09 20:13 UTC). VoiceUrl пустой — подключаем в вечернее окно выкладки вместе со стендом. Номер для NightDesk — когда №43 дойдёт до звонков.
- **Создан пустой сайт стенда:** `linii-demo-85fof` → https://linii-demo-85fof.netlify.app, id `ea43276c-c92b-479d-b662-541651e04cf2`. Кода там нет. Закрыт от поиска: заголовок `X-Robots-Tag: noindex, nofollow` + `web/robots.txt` с `Disallow: /`.
- **Запреты 2 и 3 для сборщиков остаются:** выкладку, привязку номера, покупки делает только главный агент, вечерним окном, после проверки помощником-проверяющим и «да» Андрея на окно.
- **Движки (дополнения сборщика движков):** сигнатуры те же, добавлены необязательные аргументы: `reyting` в `eskalaciyaNuzhna`, `kontekst` в `prinyatOtvet`, `klienty` в `proverit`. Ответы: `sleduyushchayaVolna` → `{sidelki, ostalos, kod}`; `prinyatOtvet` → `{rezultat, otkaz, izmeneno, soobshchenie}`. Новое `sleduyushcheeDeystvie` — одно решение на тик (разослать волну / будить дежурного / ждать); если вся волна ответила «НЕТ», следующая уходит сразу.
- **EVV, поправка к продажам:** Северная Каролина отклоняет счета личного ухода без EVV с 01.06.2021, home health в управляемых планах — с 01.10.2025. **Нью-Йорк автоматически не отклоняет** — риск там в аудите OMIG и возврате выплаченного. В текстах для NY говорить «аудит и возврат», не «отказ в оплате».

## Дополнения платформы (30.09, сборщик стенда) — подробно в `platforma/README.md`

- **`platforma/nastroyki.json`** — настройки клиента без секретов (календари по типу встречи, часы из листа правды, цепочки `perevod.cepochka` и `dezhurnye.cepochka`, адресаты, пределы, правила замены). `linii.json`: `+19292099535` (найм) и `DEMO-2` (сиделки на том же номере: поля `nomer`, `perevod_vne_chasov`), у обеих `klyuch_env: CARELINE_DEMO_LINIYA_KLYUCH`.
- **Линия инструмента:** по секрету — клиент; при общем секрете линию задаёт функция (`okna`/`zapis`/`kandidat`/`semya` → care-hiring, `otkaz` → care-caregivers) или `agent_id` в теле (← `system__current_agent_id`). Один секрет у разных клиентов — отказ.
- **Новая функция `volny`** (раз в 5 мин): по каждому открытому отказу — `sleduyushcheeDeystvie` движка (волна / побудка / ждать); смена началась без замены → `smeny.status = unfilled`.
- **Перевод** — не системный `transfer_to_number`, а вебхук `perevod` с телом `{call_sid ← system__call_sid, conversation_id, agent_id ← system__current_agent_id, svodka, yazyk}`: работает на обоих путях номера, второй номер-мост не нужен (рецепт — README, «Перевод на человека»).
- **Служебные ключи хранилища:** `razgovory/`, `indeks/telefon/`, `bron/`, `zakrep/`, `predlozheniya/`, `otpravleno/`, `schetchiki/`, `zvonki-vhod/`, `zvonki-itog/`, `svodka/`, `svodki/`. Добавочные поля: `sobesedovanie.zapisano_v`, `otkazy.{kod, liniya_klyuch, zakrit, ne_zakryta_v, eskalaciya}`, `smeny.sidelka_id_do_otkaza`, `zvonki.{namerenie_agenta, itog_agenta, imya, soobshchenie, raskrytie_ii, telefon, kandidat_id, semya_id, otkaz_id}`, `soglasiya.istoriya[]`, `soglasiya.istochnik` `sms_stop`/`sms_start`.
- **Итог:** `namerenie` агента (kandidat/semya/otkaz/smena_seychas/soobshchenie/spam/drugoe) → словарь пульта (rabota/semya/otkaz/drugoe); факт сервера (запись, отказ, карточка в разговоре) сильнее слов агента; непустое `soobshchenie` → письмо на `pisma.koordinatoru` (ключ дублей — разговор). `podhodit:false` → статус `waitlist`.
- **Ответ `zapis` и `otkaz` по-английски**, пока в их телах нет `yazyk` (функции его понимают).
- **Тесты стенда** — `test/stend-*.test.js`; `npm test` = `node --test test/*.test.js` (работает на Node 20 и 26). Чужие тесты называть своими префиксами: 30.09 сборщик стенда затёр одноимённый `test/svodka.test.js` сборщика пульта.

## Дополнения стенда 30.09 вечер (сборщик стенда) — подробно в `platforma/README.md`

- **`vhod` → переменные агента.** В `register-call` уходит `conversation_initiation_client_data.dynamic_variables = {ofis_seychas, kalendar}` (сверено с документацией ElevenLabs: словарь строк, ответ — строка TwiML). `ofis_seychas` = `OPEN`/`CLOSED` по `nastroyki.perevod.chasy` (пн–пт, 09:00 ≤ t < 17:00, пояс клиента); часов в настройках нет — переменная не передаётся. `kalendar` — 14 дней ровно в формате `chasy()` из `care/progony/progon.py`, по-английски для всех трёх языков (пресеты ES/RU читают тот же `{{kalendar}}`, прогоны шли так). Других переменных стенд не шлёт: у агентов заглушки только на эти две. Сбой расчёта — соединяем без переменных; ElevenLabs их не принял (400/422) — один повтор `register-call` без них. Путь А по-прежнему требует функцию `nachalo` — **не сделана** (посчитала бы тем же `peremennyeZvonka` из `lib/vremya.js`).
- **`kandidat`/`semya` — защита от карточки-заглушки.** HTTP 200 `{ok:false, kod, soobshchenie, dalshe}`, ничего не сохраняется (только строка журнала):
  - `kod:"net_imeni"` — `imya` пустое или служебное: Caller, Unknown, Applicant, Candidate, N/A, Anonymous, None, «No name», Звонящий, Неизвестно, Аноним, «Без имени», Llamante, Desconocido, Anónimo, «Sin nombre»… — без регистра и диакритики; «DEMO» не в счёт; номер телефона вместо имени — тоже заглушка. `soobshchenie`: «I need your first and last name first — could you spell it for me?» (es/ru — на языке `yazyk`). Журнал: `kandidat_bez_imeni` / `semya_bez_imeni`.
  - `kod:"net_otbora"` (только `kandidat`) — нет `sertifikat`, а карточки с отбором у этого разговора или телефона ещё нет. `soobshchenie`: «Before I save your application, I need to ask you a couple of quick questions about your certificate and your schedule.»; `dalshe`: «хочет только оставить сообщение — больше не зови, прими сообщение в разговоре». Лист ожидания без `sertifikat` в теле понятен по `prichina_otkaza`: `net_sertifikata` → `net`, `tolko_cna` → `CNA`. Второй вызов того же разговора без `sertifikat` — правка той же карточки (сертификат не теряется). Журнал: `kandidat_bez_otbora`.
- **`otkaz` — причина обязательна.** Смена найдена однозначно, отказа по ней ещё нет, `prichina` пустая (или «unknown», «none», «N/A») — ничего не записано: `{ok:false, kod:"net_prichiny", nuzhno_utochnit:true, smena:null, soobshchenie:"What's the reason — are you sick, is it transportation, a family matter, or something else?", dalshe}` (es/ru — словами промптов линии сиделок). Незнакомый номер, нет смены, несколько смен, уже записанный отказ — ответы прежние. Слова вне перечня понимаются: sick/enferm*/болез*/забол* → `bolezn`, famil*/семья → `semya`, transport*/транспорт → `transport`, иное непустое → `drugoe`. Журнал: `otkaz_bez_prichiny`. **Просьба к сборщику агентов:** в промптах линии сиделок (раздел 5, шаг 6) сейчас «ok false → не записано, прими сообщение»; добавить «ok false и nuzhno_utochnit true → задай вопрос из soobshchenie и вызови снова с prichina».
- **`yazyk` в `zapisat` и `otkaz_ot_smeny` (для сборщика агентов, тела `care/instrumenty/`).** Добавить необязательное свойство, как в `sohranit_kandidata`: `"yazyk": {"type": "string", "description": "Language of the conversation right now.", "enum": ["en", "es", "ru"]}` (в `required` не включать). С ним `start_tekst`, `soobshchenie`, письмо и SMS о записи — на языке звонящего. Без него `zapis` отвечает на языке карточки этого разговора, `otkaz` — по-английски. Пункт «Ответ `zapis` и `otkaz` по-английски» в «Дополнениях платформы» выше этим заменён.
- **`zapis`:** имя-заглушка в теле → имя из карточки разговора (в календаре и письме нет «Caller»); почта из записи ложится в карточку, если её там нет (`kandidaty.email`, `semi.kontakt.email` — новое поле); перенос возвращает статус `reminded` → `booked`.
- **Новая функция `napominaniya`** (расписание `*/15 * * * *`): собеседования (`kandidaty.sobesedovanie`) и оценки (`semi.ocenka`) — за 24 ч и за 2 ч до начала, окно ±7,5 мин (ровно один запуск). Только статусы `new`/`booked`/`reminded`, только будущие встречи. SMS — только при согласии (`soglasiya/<телефон>.sms`, STOP сильнее; нет записи — `soglasiya.sms` карточки), иначе письмо, если есть почта; иначе только флаг. Записались меньше чем за час до момента напоминания — не шлём. Текст — на языке карточки. Кандидату после первого ушедшего напоминания — статус `reminded`. Всё через `lib/otpravka` (DRY_RUN). Выключить у клиента — `nastroyki.napominaniya.vklyucheny: false`.
- **Новые поля и ключи.** `sobesedovanie.napominanie_24`, `sobesedovanie.napominanie_2`, `ocenka.napominanie_24`, `ocenka.napominanie_2` = `{at, kanal: sms|email|null, rezultat}` (перенос создаёт встречу без флагов; повторное сохранение карточки той же встречи флаги не стирает); `semi.kontakt.email`; `semi.soglasiya.sms` (необязательное `sms_soglasie` в `sohranit_semyu` — в тело инструмента, если в сценарий семьи добавят вопрос о SMS; сейчас семьям напоминание уйдёт только по согласию из итога звонка или по почте, названной при записи). Ключи дублей: `napominanie-sms:<klient>:<event_id>:<24|2>`, `napominanie-pismo:…`. Журнал: `napominanie`, `napominanie_net`; `zvonok_vhod.detali.ofis_seychas`.
- **Поправки по ходу.** Повторный звонок сиделки про смену в статусе `calloff` (волна не ушла — некому) слышал «смены не вижу»; теперь «отказ уже записан» (`lib/otkazy.js`, `blizhayshieSmeny`). В испанских SMS время в конце предложения давало «a. m..» — вторая точка убрана.
- **Проверка:** `npm test` — 157 из 157 (стенд 110, было 85), Node 26; все 14 функций собираются esbuild (`--target=node20`). Сеть в тестах запрещена, отправка — DRY_RUN.

## Исправления проверки 01.10 ночью (помощник по находкам `PROVERKA-PERED-VYKLADKOY.md`) — что изменилось в договорённостях

- **Деньги.** `nastroyki.limity`: `zvonkov_v_sutki` 15 (было 60), новое `ishodyashchih_v_sutki` 10 — потолок исходящих звонков (`lib/otpravka.zvonok`, счётчик `schetchiki/<дата>.ishodyashchih`; упёрлись — побудка дежурного уходит письмом координатору). `vhod` **fail-closed**: хранилище не поднялось или счётчик упал — фраза «линия временно недоступна» (`frazy.liniya_vremenno`), `register-call` не зовётся. У DEMO-агентов `platform_settings.call_limits.daily_limit` 20 (было 300).
- **Имя секрета итога на стенде — `CARELINE_WEBHOOK_SECRET`** (значение с Мака — `CARELINE_DEMO_WEBHOOK_SECRET`, заводится при создании вебхука). `ELEVENLABS_WEBHOOK_SECRET` стенд не читает: это секрет живой Веры. Таблица «имя на стенде ← имя в `~/.bidna-golos.env`» и порядок окна (вебхук до выкладки, к агентам — после) — `platforma/README.md`.
- **Перевод.** Вебхук `perevod_careline_demo` = `tool_7701m3tyc9pqfmab2krhhmhbe2jq` создан и подключён к обоим DEMO-агентам; системный `transfer_to_number` снят. Строка таблицы «Инструменты агента: параметры» про перевод читается теперь так: вебхук `perevod`, тело `{call_sid ← system__call_sid, conversation_id ← system__conversation_id, agent_id ← system__current_agent_id, svodka, yazyk}`.
- **Срок хранения.** `nastroyki.hranenie.zvonki_dney` 30: функция `svodka` раз в сутки (замок `chistka/<дата>`) удаляет `zvonki/`, `zvonki-itog/`, `zvonki-vhod/`, `razgovory/` старше срока (`lib/chistka.js`). У DEMO-агентов `privacy.retention_days` 30.
- **Ключ календаря** кладёт `platforma/scripts/zalit-klyuch-kalendarya.js` (Blobs `kalendar-klyuch`/`sa`, только на стенд, содержимое не печатает).
- **API пульта** переехал в `platforma/docs/API.md` (не публикуется). Ключ пульта после загрузки уходит из адреса в `sessionStorage` вкладки.
- **Проверка:** `npm test` — 247 из 247 (Node 24 и 26); 14 функций собираются esbuild под node20.
