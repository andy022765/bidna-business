# Справка к скиллу «Запуск Веры у клиента»

Снимок живого состояния на чтение: 29.09 (GET ElevenLabs и Twilio, `netlify env:list` через пайп, Stripe, Gmail-коннектор).
Разошлось с жизнью — правь здесь и в памяти.

## §1. Ручки агента

| Настройка | Значение (так на dna 29.09) | Клиенту |
|---|---|---|
| Модель | `llm gemini-2.5-flash` явно, `max_tokens 600`, `thinking_budget 0` | так же |
| Запасная модель | `backup_llm_config {"preference":"override","order":["gpt-4.1-mini"]}`, `cascade_timeout_seconds 2.5` | так же |
| Очередь реплик | `turn_timeout 4`, `turn_eagerness eager`, `speculative_turn true`, `spelling_patience auto`, soft timeout 1.8–2.0 с | так же |
| Голос RU | `eleven_flash_v2_5`, Sarah `EXAVITQu4vr4xnSDxMaL`, `optimize_streaming_latency 4` | так же |
| Голос EN | `eleven_flash_v2` (v2_5 для EN вендор не принимает) | так же |
| `end_call` | включён (без него «I cannot end the call» до потолка, 25.09) | включить |
| Запись звука | `privacy.record_voice false` | false |
| Письмо владельцу | `workspace_overrides.webhooks.post_call_webhook_id = 009c2156e8ab44a6bd8ef8cc007b6bde`, `events [transcript]` | тот же вебхук, но `zvonok.js` должен знать владельца по `agent_id` (§2) |
| Поля письма | `data_collection`, 7 полей: imya, telefon, pochta, zachem, biznes, obeshchali, hvost | описания полей — на языке **владельца** |
| Язык сводки | `summary_language ru` (и у EN-агента тоже ru — для русскоязычного владельца верно) | = язык **владельца**, не линии |
| Предел звонка | dna 190, EN 190 — потолок **рекламных демо**; «календарь» 240, demo 240, проверяльщик 180 | ставить сознательно: администратор с записью в 190 не укладывается, образец — 240 |
| Лимиты | dna: `daily_limit 20`, одновременно 3; остальные без лимита | **не копировать с dna** — 21-й звонок за день не пройдёт |
| Инструменты | см. §5 — **все наши, общие для нескольких агентов** | только новые инструменты клиента |

Произносимый язык задают: `agent.first_message`, `turn.soft_timeout_config.message`, `turn.soft_timeout_config.additional_soft_timeout_messages`, `agent.max_conversation_duration_message`, промпт, описания инструментов.

## §2. Где стенд зашит под одного владельца — что сделать для клиента

Настройки клиента **не в переменные** (2 387 из 4 096 байт, 29.09; превышение роняет выкладку всего сайта).
Куда: модуль с настройками клиентов рядом с функциями (как `kalendar-lib/`; функции его `require`, esbuild бандлит сам) —
ключ по `agent_id` и по номеру линии: номер линии, номер и имя владельца, язык владельца, почта для писем, календари, часы, пояс, лимит звонков.
Секретов там нет. Смена настроек = выкладка (одно окно в день). Большое/секретное — в Blobs (как ключ `kalendar-klyuch/sa`).

| Файл (`Pivot/golos/site/…`) | Что зашито | Что сделать |
|---|---|---|
| `netlify-functions/perevod-ru.js` | `NASH_RU='+14247811913'`, `KUDA='+15614516864'`, ширма `<Say ru-RU Polly.Tatyana>` «Звонок с линии Веры», `web/zvuk/soedinyayu.mp3` «Соединяю с Андреем…» | номер владельца, язык и голос ширмы, путь `web/zvuk/<slug>/` — из настроек по номеру линии (`To`). Основа для клиента — этот файл |
| `netlify-functions/perevod.js` (EN) | `TWILIO_NOMER_EN`, `PEREVOD_NOMER`; **нет ширмы** (автоответчик), **нет `<Dial action>`** («Nobody picked up» после разговора) | за основу клиенту **не брать** |
| `netlify-functions/zvonok-vhod.js` | пускает только `TWILIO_NOMER_EN`, агент `GOLOS_AGENTS.en`; суточный счётчик **один на все номера** (`den()/<sid>`, стр. 49–52), `ZVONKOV_V_SUTKI` | карта «номер → агент» из настроек; ключ счётчика `den()/<номер>/<sid>`, предел на клиента |
| `netlify-functions/zvonok.js` | письмо на один `GOLOS_VLADELEC`; потолок писем **один на все линии** `${den()}:__vsego` (стр. 376–383, 60/сутки); от `hello@`, ответ support@; карточка звонка в нашу Telegram-группу (`DOGON_GRUPPA`, `dogon-lib/signaly.js`); по `metka_pochty` — расшифровка звонящему от support@ | владелец по `d.agent_id`; счётчик `${den()}:${agent_id}:__vsego`; для агентов клиентов Telegram-карточку и `metka_pochty` выключить |
| `netlify-functions/pismo.js` | от `hello@`, ответ `support@`; жалоба/возврат (стр. 687–700) → `GOLOS_VLADELEC`, звонящий слышит «Андрей и Маша напишут вам сами»; ветки о наших продуктах `razbor`/`diagnostika` | отправитель, ответ-адрес, подпись — **по решению Андрея**; жалоба → владельцу клиента, фраза с его именем |
| `kalendar-lib/gkal.js` | один `KALENDAR_ID`, часы из `KALENDAR_*`; **в коде по умолчанию `CHAS_OT=10`**, на стенде 9 | `svobodnye(dop)` принимает перекрытие (`Object.assign(nastroyki(), dop)`, стр. 157) — передавать настройки клиента |
| `netlify-functions/kalendar-okna.js`, `kalendar-zapis.js` | зовут `nastroyki()` и `svobodnye()` без аргумента (zapis стр. 60, 111) | клиента определять по **константе** в теле инструмента (`constant_value`, как `yazyk` в `plan-b/pereklyuchatel.py`), не по полю, которое заполняет модель: один служебный аккаунт видит календари всех клиентов |
| `Pivot/golos/kalendar/gkal.py`, `proverit_klyuch.py`, `proba_zapisi.py` | календарь «Вера-демо» | параметризовать id календаря |
| `Pivot/golos/proverka/progon_zapis.mjs` | наш стенд, наши календари | то же |
| `Pivot/golos/plan-b/pereklyuchatel.py` | `AGENT` (dna), `IMYA=perevod_na_andreya`; инструмент ищет **по имени** | клиенту только образец; имена инструментов клиента — с суффиксом slug, иначе переключатель найдёт чужой |
| `Pivot/golos/plan-b/proverochnyy_zvonok.py` | агент Веры, линия, номер Андрея; при снятом `end_call` читает копию из скретчпада, **которой уже нет** (29.09) | образец; перед запуском убедись GET-ом, что `end_call` у проверяльщика включён |
| `Pivot/golos/twilio_podklyuchit.py` | номер и агент dna; без `--pisat` только показывает | образец для пути А |
| `Pivot/golos/dozvonshchik/dozvonshchik.py` | потолок 30 проверяется **до** `--skolko` (стр. 249 против 266) при 49 сценариях | работает только `--proba` и `--tolko` |
| `Pivot/golos/dozvonshchik/razbor.py` | судит слух проверяльщика; ключ из `~/.bidna-smotritel.env`; неверный `--list-pravdy` молча пропускает | см. шаг обкатки в SKILL.md |

## §3. Известные расхождения источников (29.09)

В памяти `reference-twilio-bez-importa`, `project-linejka-cen`, `project-golosovoy-dezhurny`, `reference-sebestoimost-golosa` 29.09 поставлены пометки «устарело»; документы проекта (`README.md`, `PROMPT-DEZHURNY.md`, `OCENKA.md`, `SHABLON-NISHA-1.md`, `ZADANIE-*`) не правились.

- Пределы линий: память `project-golosovoy-dezhurny` и `reference-twilio-bez-importa` — dna 900, EN 240; живое — оба 190.
- `reference-twilio-bez-importa` — «у телефонной ветки нет суточной квоты»; на деле `ZVONKOV_V_SUTKI` (по умолчанию 20) и `ZVONKI_BEZ_KVOTY` на стенде.
- `project-golosovoy-dezhurny`, `reference-sebestoimost-golosa`, `Pivot/golos/README.md` велят обновлять агента `sozdat_agenta.py` и зовут `PROMPT-DEZHURNY.md` источником правды — **неверно**, правда в GET агента. `project-golosovoy-dezhurny` пишет «перевод conference на +1 561 451 6864» — с 28.09 работает план Б.
- `project-linejka-cen` — «всё сразу $2500 — первый месяц бесплатно»; доска 26.09 — убрано во всех 5 местах, касса его не даёт. …frW04 = $2 500 + $399/мес.
- Часы календаря: `ZADANIE-ZAPIS.md` и память — «с десяти» или «с девяти»; живое `KALENDAR_CHAS_OT=9`, умолчание в `gkal.js` — 10.
- Раскрытие записи: `SHABLON-NISHA-1.md` п. 6.4 велит «разговор записывается»; звук не пишем — «recorded» не говорить. Верно второе.
- Автопродление: `Pivot/golos/english/ZADANIE-VERA-EN.md` — «No auto-renewal»; решение 27.09 — автопродление. Верно второе.
- Исходящие: `SHABLON-NISHA-1.md` (25.09) — «исходящих нет»; дозвонщик построен 25.09 ночью.
- Номер проверочных звонков: `dozvonshchik/OCENKA.md` — «не звонить с Прозвона Маши +1 424 275 6121»; `proverochnyy_zvonok.py` и `proverit-paket.sh` звонят именно с него.
- Минуты обкатки: `OCENKA.md` — «ест минуты КЛИЕНТА»; решение 26.09 — минуты наши. Верно второе.
- Живая страница листа правды для Веры (`/vera/ru/truth-sheet-t4k8m2/`) — это страница **приёмки**: заголовок «Лист правды — приёмка линии», «тридцать звонков по сетке часов, включая выходной и поздний вечер», «ваш номер мы не набираем». Генератор `shtab/sayty/list_pravdy.py` стр. 56, 77–78.
- Сторож: `Pivot/golos/storozh/CHITAT.md` — падение 23.09; память `reference-netlify-kredity-503` — 24.09.
- `PROMPT-DEZHURNY.md` отстаёт от живого dna, в нём висит отменённое 20.09 «Внедрение — от пяти тысяч»; снимки `proverka/prompt-dna-live-2026-09-28-*` сняты до плана Б.

## §4. Поиск чужого алфавита по агенту (только чтение)

GET агента отдаёт инструменты развёрнутыми в `conversation_config.agent.prompt.tools[]` — одного прохода хватает. Печатает только пути, не значения.

```bash
set -a; . ~/.bidna-golos.env; set +a
AG=agent_xxx   # агент клиента
curl -s -H "xi-api-key: $ELEVENLABS_API_KEY" "https://api.elevenlabs.io/v1/convai/agents/$AG" | python3 -c '
import json,re,sys
d=json.load(sys.stdin)
skip=re.compile(r"secret|header|token|api_key",re.I)
hits=[]
def walk(x,p=""):
    if isinstance(x,dict):
        for k,v in x.items():
            if not skip.search(k): walk(v,p+"."+k)
    elif isinstance(x,list):
        for i,v in enumerate(x): walk(v,p+"[%d]"%i)
    elif isinstance(x,str) and re.search("[А-Яа-яЁё]",x): hits.append(p)
walk(d)
print(len(hits)); print("\n".join(sorted(set(re.sub(r"\[\d+\]","[]",h) for h in hits))))
'
```
EN-линия: допустимы только `.name`, `.phone_numbers[].*` и `.platform_settings.data_collection.*.description` (если владелец русскоязычный). Прогнано 29.09 на EN: 8 путей, все допустимые. RU-линия: латиницу ищи глазами в произносимых полях (§1).

## §5. Ключи, ресурсы, id (только имена)

- `~/.bidna-golos.env` (600): `ELEVENLABS_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`/`SECRET`, `RESEND_API_KEY`, `GOLOS_PISMO_SECRET`, `GOLOS_NASH_KLYUCH`, `STRIPE_TEST_KEY`, `UPTIMEROBOT_API_KEY` и др. **Нет** `EV_BLOBS_TOKEN` (он на стенде) и **нет** `ANTHROPIC_API_KEY`.
- `~/.bidna-smotritel.env` — ключ Anthropic **Смотрителя** (лимит $20). Для разбора обкатки не брать (`reference-klyuchi-i-vykatka`: ключи не делим).
- `~/.bidna-stripe.env` — боевой Stripe, ограниченный: 29.09 GET subscriptions, charges, checkout/sessions, payment_intents, customers, invoices, events, balance_transactions — **403**; payment_links — 200. Оплату им не подтвердить.
- `~/bidna-klyuchi/vera-kalendar.json` — ключ служебного аккаунта Google (проект `business-intelligence-dna`), права 600.
- `~/bidna-klyuchi/{kalendar-tools,kalendar-tools-en,perevod-tool,en-tools}.json` — **карты «имя → tool_id» наших боевых инструментов** (49–115 байт, секрета нет). Клиенту их не подключать.
- `~/.bidna-agent-dna-do-plana-b-2026-09-28.json` — полная копия dna до плана Б (с секретом, вне Drive); в Drive `Pivot/golos/plan-b/otkat-agent-dna.json` без секрета.
- Стенд Netlify `dezhurny-r4p8w2`, id `4583b8b6-f9f4-4fae-b369-d107c8ac56a3`. Переменные — только пайпом (шаг выкладки в SKILL.md).
- Gmail-коннектор сессии = ящик **support@businessinteldna.com** (проверено 29.09 чтением; 29.09 утром падал с «Authorization … failed» — тогда файл дают Андрей/Маша).

**Агенты ElevenLabs (GET 29.09):**

| Агент | id | Номер |
|---|---|---|
| Дежурный · dna (RU, под рекламой) | `agent_1401m2bc9k58f6nrj8v51pw2v2s3` | +1 424 781 1913, родной импорт |
| Дежурный · English (EN, под рекламой) | `agent_6801m3cz595hesgr7cxent1vse6r` | +1 424 724 4202 через `zvonok-vhod` (в ElevenLabs номера нет) |
| Дежурный · календарь (RU, демо записи) | `agent_6601m3b4dr6ve48b0p0wkne7ecdb` | — |
| Дежурный · demo (браузер) | `agent_8501m2f3wdhye8fadxmks4z8hp31` | — |
| Покупатель · приёмка (проверяльщик) | `agent_4701m34zngp2e9cb2w5wcrd171zr` | — ; `record_voice true`, 180 с |

`Pivot/golos/agenty.json` знает только dna и demo.

**Наши боевые инструменты — не PATCH-ить под клиента и не подключать ему:**

| Имя | id (хвост) | Кто держит |
|---|---|---|
| otpravit_ssylku (pismo) | `…4ea2w0` | dna, календарь, demo |
| skolko_mest (mesta) | `…zyt35w` | dna, календарь, demo |
| perevod_na_andreya (perevod-ru) | `…8emr68` | dna |
| svobodnye_okna / zapisat_na_vstrechu | `…ty83hq` / `…0zmdqf` | календарь |
| send_the_link / places_left | `…qsnapm` / `…vjexwr` | EN |
| free_slots / book_the_meeting | `…6pf6nb` / `…q21bym` | EN |
| transfer_to_human (perevod) | `…0b5afk` | EN |

Проверка, кто держит инструмент: `GET /v1/convai/tools/<id>/dependent-agents` (29.09 для `…4ea2w0` → dna, календарь, demo).
Создание своего инструмента: `POST /v1/convai/tools` — образец тела `konfig_instrumenta()` в `plan-b/pereklyuchatel.py` (так завели `…8emr68` 28.09).

**Номера Twilio (GET 29.09):** +1 424 724 4202 (EN, VoiceUrl → `zvonok-vhod`) · +1 424 781 1913 (RU, VoiceUrl → `api.elevenlabs.io/twilio/inbound_call`) · +1 424 275 6121 (Прозвон Маши → `prozvon-vhod`). **VoiceFallbackUrl нет ни у одного.**

**Мониторы:** сторож `~/bidna-storozh/storozh.py` (launchd `com.bidna.storozh`, на Маке — спящий Мак не сторожит) и UptimeRobot (4 проверки, тревога на support@) смотрят страницы и корень стенда. **Линию, агента и инструменты не смотрит никто.**

**Лист правды:** `https://businessinteldna.com/vera/ru/truth-sheet-t4k8m2/` (EN `/vera/truth-sheet-t4k8m2/`), форма `list-pravdy-ru/en`, `produkt=vera`, письмо на support@ «Лист правды для Веры — <имя>» с вложением (`netlify-functions/submission-created.js` стр. 69).
**Оплата:** `netlify-functions/stripe-oplata.js` (основной сайт) шлёт на support@ «Оплата по партнёру … / Оплата без выплаты партнёру — <товар>» на `checkout.session.completed` и на продление (`invoice.paid`, `subscription_cycle` → товар «абонентка»). `invoice.payment_failed` не ловит. На живом продлении не проверено.

## §6. Рецепты

**Переменные стенда — только имена и байты** (значения в транскрипт не выводить; рецепт из `reference-4kb-peremennyh-lambda`):
```bash
cd /tmp && NETLIFY_SITE_ID=4583b8b6-f9f4-4fae-b369-d107c8ac56a3 netlify env:list --json --context production 2>/dev/null \
 | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d),'перем.,', sum(len(k)+len(v or '')+2 for k,v in d.items()),'байт из 4096'); print(' '.join(sorted(d)))"
```
29.09: 57 переменных, 2 387 байт. `netlify env:set` печатает значение — не светить.

**Фраза голосом Веры для перевода** (28.09 делали TTS голосом агента, команда в проекте не сохранена; ниже — по документации ElevenLabs, **не проверено**, расходует кредиты):
```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "content-type: application/json" \
  -d '{"text":"<Соединяю с Ириной, одну секунду.>","model_id":"eleven_flash_v2_5"}' -o soedinyayu.mp3
```
EN — `model_id eleven_flash_v2`. Прослушать ушами (ударения, имя владельца). Нужны две: «соединяю с <имя>» и откат «<имя> сейчас не смог ответить…» — текст отката взять у живого `ne-otvetil.mp3` (послушать). Ширма владельцу — `<Say>` голосом Polly на **языке владельца** (RU `Polly.Tatyana`, EN — английский голос Polly), записи не нужно.

**Минуты агента клиента** (`sostoyanie` не годится — считает весь аккаунт; прогон не проверен):
`GET /v1/convai/conversations?agent_id=<агент клиента>&page_size=100` (листать `cursor`) → сумма `call_duration_secs` за месяц; обкатка (до дня 9) — отдельно.

**Twilio: номер линии** (чтение): `GET /2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json` — поля `voice_url`, `voice_fallback_url`. Запись (`POST …/IncomingPhoneNumbers/<PN…>.json` с `VoiceUrl`/`VoiceFallbackUrl`) — только по шагам SKILL.md.

## §7. Главные документы

`Pivot/golos/PLAN-B-PEREVOD.md` · `Pivot/golos/plan-b/VECHER-2026-09-28.md` · `Pivot/golos/kalendar/STORONA-KLIENTA.md` · `Pivot/golos/kalendar/INSTRUKCIYA-KLIENTU.md` · `Pivot/golos/kalendar/ZAPASNOY-PUT-WORKSPACE.md` · `Pivot/golos/kalendar/ZADANIE-ZAPIS.md` · `Pivot/agenty/pasport-agenta/SHABLON-NISHA-1.md` · `Pivot/golos/dozvonshchik/OCENKA.md` · `Pivot/golos/storozh/CHITAT.md` · `shtab/sayty/istochniki/vera-paid-ru.html`.
Память: `project-golosovoy-dezhurny`, `project-kalendar-very`, `reference-perevod-avtootvetchik`, `reference-twilio-bez-importa`, `reference-obkatka-bez-tunnelya`, `reference-potolok-pisem-vladelcu`, `reference-yazyk-pered-instrumentom`, `project-shema-postavki`, `project-linejka-cen`, `project-priemka-very-uroki`, `reference-4kb-peremennyh-lambda`, `reference-netlify-kredity-503`, `reference-klyuchi-i-vykatka`.
