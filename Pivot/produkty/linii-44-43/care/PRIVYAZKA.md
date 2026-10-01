# Привязка номера CareLine DEMO к агенту «CareLine DEMO · Hiring»

*30.09.2026, для главного агента. Делает только главный агент, в вечернее окно, после выкладки стенда и «да» Андрея на окно. Сборщики номер не трогают. Секреты — только из `~/.bidna-golos.env`, в транскрипт не печатать.*

## 0. Что уже есть

| Что | Значение |
|---|---|
| Номер | **+1 929 209 9535**, Twilio `PNf8a1f3e6d8ade7dac3f3e8d69a08def2`, VoiceUrl пустой |
| Агент найма (куда привязать) | «CareLine DEMO · Hiring» `agent_2001m3sx90scf9msygm0e685h1yw` |
| Агент сиделок (номера нет, звонки приходят переводом с линии найма) | «CareLine DEMO · Caregivers» `agent_5001m3sx8yr5ee1sne6p5b8zcmwk` |
| Инструменты | 6 шт. `*_careline_demo` → `https://linii-demo-85fof.netlify.app/.netlify/functions/{okna,zapis,kandidat,semya,otkaz,perevod}` (5 — PATCH 30.09; `perevod_careline_demo` `tool_7701m3tyc9pqfmab2krhhmhbe2jq` — создан и подключён 01.10) |
| Заголовок инструментов | `x-liniya-klyuch` = workspace secret `KomtreYBZQp3NoyIGVnN`; значение — `CARELINE_DEMO_LINIYA_KLYUCH` в `~/.bidna-golos.env` |
| Переменные, которых ждут агенты | `ofis_seychas` (OPEN/CLOSED) и `kalendar` (14 дней) — по умолчанию пусто |
| Вебхук итога звонка | не подключён |
| Перевод на человека | с 01.10 вебхук `perevod_careline_demo` → функция `perevod` (§5); системный `transfer_to_number` (заглушка `+17185550199`) снят у обоих агентов |
| Лимиты агентов | одновременно 4, в сутки **20** (с 01.10, было 300), веб-вход закрыт `enable_auth`; стенд сверх того — 15 входящих в сутки (`nastroyki.limity.zvonkov_v_sutki`) |
| Хранение расшифровок | 30 дней у ElevenLabs (`privacy.retention_days`, с 01.10, к прежним разговорам не применяется); итоги на стенде — тоже 30 дней (`lib/chistka.js`) |

Всё сводно — `care/elevenlabs.json`. Правка агентов — только `care/sborka_agentov.py --primenit` (он сам отказывает на живых агентах Веры).

## 1. Стенд до привязки

1. Переменные стенда (пайпом, как в `zapusk-very/spravka.md` §6, значения не выводить):
   - `CARELINE_DEMO_LINIYA_KLYUCH` — из `~/.bidna-golos.env`; функции `okna/zapis/kandidat/semya/otkaz` сверяют с ним `x-liniya-klyuch`, чужой → `{ok:false, soobshchenie}` с HTTP 200;
   - `CARELINE_WEBHOOK_SECRET` (имя на стенде) ← `CARELINE_DEMO_WEBHOOK_SECRET` из `~/.bidna-golos.env` — появится на шаге §3.1, который делается **до** выкладки (переменная действует только с новой выкладкой);
   - для пути Б ещё `ELEVENLABS_API_KEY` (имя на стенде) ← `ELEVENLABS_STAND_KEY` (бессрочный; не замерочный `ELEVENLABS_API_KEY` с Мака) и `TWILIO_AUTH_TOKEN` (проверка `X-Twilio-Signature` в `vhod`);
   - полная таблица «имя на стенде ← имя в `~/.bidna-golos.env`» и рецепт заливки одной пачкой — `platforma/README.md`, «Переменные окружения стенда»; порядок окна — там же, «Окно выкладки».
2. Проверка функций до звонка (ответ читать по телу, не по коду):
   ```bash
   set -a; . ~/.bidna-golos.env; set +a
   S=https://linii-demo-85fof.netlify.app/.netlify/functions
   curl -s -X POST $S/okna -H 'content-type: application/json' -d '{"tip":"sobesedovanie","yazyk":"en"}'                       # без ключа → ok:false
   curl -s -X POST $S/okna -H 'content-type: application/json' -H "x-liniya-klyuch: $CARELINE_DEMO_LINIYA_KLYUCH" \
        -d '{"tip":"sobesedovanie","yazyk":"en"}' | head -c 400                                                              # → okna[{start,end,tekst}]
   ```
3. В демо-данных сиделок (`demo-dannye/`) должен быть телефон, с которого будем проверять отказ (линия сиделок узнаёт сиделку по `system__caller_id`), иначе `otkaz` честно ответит «не вижу этот номер в списке сиделок». Настоящий номер в демо-данных нарушает запрет 7 `KONTRAKT.md` — **решение Андрея** (временная DEMO-запись на номер проверяющего и её удаление после проверки); без него линия сиделок голосом проверяется только до ответа «номер не найден».

## 2. Номер → агент

**Рекомендую путь Б.** Прогоны шли ровно в его условиях: `vhod` передаёт `ofis_seychas` и `kalendar`. Без них агент сам сравнивает время и путает день. В пилоте 30.09 он сказал «закрыто» в среду в 15:40 и принял «пятницу, третье» (третье — суббота). С переменными оба случая прошли.

### Путь Б — через функцию `vhod` (register-call), как EN-линия Веры

1. `platforma/linii.json`:
   ```json
   "+19292099535": {"liniya": "care-hiring", "klient": "brightside", "agent_id": "agent_2001m3sx90scf9msygm0e685h1yw", "yazyk": "en"}
   ```
2. `vhod`: подпись Twilio → строка из `linii.json` по `To` → вызов ElevenLabs → TwiML обратно (`content-type: text/xml`):
   ```
   POST https://api.elevenlabs.io/v1/convai/twilio/register-call      (xi-api-key)
   {"agent_id": "<из linii.json>", "from_number": "<From>", "to_number": "<To>", "direction": "inbound",
    "conversation_initiation_client_data": {"dynamic_variables": {
        "ofis_seychas": "OPEN" | "CLOSED",          // America/New_York: пн–пт, 09:00 ≤ время < 17:00 → OPEN
        "kalendar": "Wednesday September 30 (today); Thursday October 1 (tomorrow); Friday October 2; …"  // 14 дней, ровно этот формат
    }}}
   ```
   Эталон формата — функция `chasy()` в `care/progony/progon.py` (так гонялись все прогоны).
3. Номер в Twilio. Сначала записать прежние `voice_url`/`voice_fallback_url` в `elevenlabs.json` → `nomer`:
   ```bash
   set -a; . ~/.bidna-golos.env; set +a
   PN=PNf8a1f3e6d8ade7dac3f3e8d69a08def2; A=https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID
   curl -s -u "$TWILIO_API_KEY:$TWILIO_API_SECRET" $A/IncomingPhoneNumbers/$PN.json | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["phone_number"],d["voice_url"],d["voice_fallback_url"],d["sms_url"])'
   curl -s -u "$TWILIO_API_KEY:$TWILIO_API_SECRET" -X POST $A/IncomingPhoneNumbers/$PN.json \
     --data-urlencode "VoiceUrl=https://linii-demo-85fof.netlify.app/.netlify/functions/vhod" -d VoiceMethod=POST \
     --data-urlencode "VoiceFallbackUrl=<TwiML Bin>" -d VoiceFallbackMethod=POST \
     --data-urlencode "SmsUrl=https://linii-demo-85fof.netlify.app/.netlify/functions/sms-vhod" -d SmsMethod=POST \
     | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("voice_url"),d.get("voice_fallback_url"),d.get("sms_url"))'
   ```
   `VoiceFallbackUrl` обязателен (стенд лёг — Twilio уйдёт на Bin). Для демо-линии владельца нет, поэтому Bin — вежливая фраза и отбой, а не `<Dial>`:
   `<Response><Say voice="Polly.Joanna">Sorry, the Brightside demo line is not available right now. Please try again later.</Say><Hangup/></Response>`. Bin заводится в консоли Twilio (консоль — на English).
   `SmsUrl` — тот же адрес, что в `platforma/README.md` (рецепт «Перевод на человека», шаг 2): ответы сиделок ДА/НЕТ, STOP/START, «не выйду»; SMS кандидатов стенд не разбирает.
   Откат: та же команда с `VoiceUrl=` (пусто) или прежним значением; SMS — `SmsUrl` на пустой Bin `<Response/>`.

### Путь А — родной импорт в ElevenLabs, как RU-номер Веры (+1 424 781 1913)

1. Импорт тройкой «API key + secret + account_auth_token» (16.09 так дало 200; 25.09 импорт нового номера дважды дал 401 — тогда сразу путь Б):
   ```
   POST https://api.elevenlabs.io/v1/convai/phone-numbers      (xi-api-key)
   {"phone_number": "+19292099535", "label": "CareLine DEMO · Hiring", "provider": "twilio",
    "sid": "$TWILIO_API_KEY", "token": "$TWILIO_API_SECRET", "account_auth_token": "$TWILIO_AUTH_TOKEN",
    "agent_id": "agent_2001m3sx90scf9msygm0e685h1yw", "enable_sms": false}
   ```
   `enable_sms: false` обязательно: иначе ElevenLabs заберёт SMS-адрес номера и отрежет будущую `sms-vhod`. Образец кода — `Pivot/golos/twilio_podklyuchit.py`: его не править (папка Веры), а скопировать в `care/` и там поменять NOMER, AGENT, METKA и добавить `enable_sms: false`; без `--pisat` скрипт только показывает.
   Если номер уже импортирован без агента: `PATCH /v1/convai/phone-numbers/{phone_number_id}` `{"agent_id": "agent_2001m3sx90scf9msygm0e685h1yw"}`.
2. Переменные `ofis_seychas`/`kalendar` на пути А даёт только **вебхук начала разговора** — функция стенда (назвать `nachalo`, в контракте её пока нет). ElevenLabs шлёт ей `{caller_id, agent_id, called_number, call_sid, conversation_id}`; ответ:
   `{"type": "conversation_initiation_client_data", "dynamic_variables": {"ofis_seychas": "...", "kalendar": "..."}}` — обе переменные обязательны.
   Подключение: вписать в `care/elevenlabs.json` `"vebhuk_nachala_url": "https://linii-demo-85fof.netlify.app/.netlify/functions/nachalo"` → `python3 care/sborka_agentov.py --primenit` (включит `enable_conversation_initiation_client_data_from_webhook`, заголовок — тот же секрет `x-liniya-klyuch`).
   Без этой функции путь А работает, но с часами хуже (см. выше).
3. Минус пути А: VoiceUrl номера принадлежит ElevenLabs; `VoiceFallbackUrl` всё равно поставить (шаг 3 пути Б, только fallback).

## 3. Итог звонка → функция `itog` (свой HMAC, не Веры)

**Порядок (проверка 30.09):** шаг 1 — **до** выкладки стенда (секрет должен попасть в переменные той же пачкой, иначе `itog` ответит 401 до следующей выкладки); шаг 2 — **после** выкладки (иначе ElevenLabs шлёт итоги в пустоту); первый звонок — после шага 2.

1. Создать вебхук рабочего пространства (секрет отдаётся ОДИН раз — сразу в `~/.bidna-golos.env`, не на экран):
   ```bash
   set -a; . ~/.bidna-golos.env; set +a
   python3 - <<'EOF'
   import json, os, subprocess, sys
   body = json.dumps({"settings": {"auth_type": "hmac", "name": "CareLine DEMO itog",
                                   "webhook_url": "https://linii-demo-85fof.netlify.app/.netlify/functions/itog"}})
   out = subprocess.run(["curl", "-s", "-X", "POST", "https://api.elevenlabs.io/v1/workspace/webhooks",
                         "-H", "xi-api-key: " + os.environ["ELEVENLABS_API_KEY"], "-H", "content-type: application/json",
                         "-d", body], capture_output=True, text=True).stdout
   d = json.loads(out or "{}")
   if not d.get("webhook_secret") or not d.get("webhook_id"):   # ошибка — без секрета на экран
       sys.exit("вебхук не создан: " + json.dumps({k: v for k, v in d.items() if "secret" not in k}, ensure_ascii=False)[:300])
   with open(os.path.expanduser("~/.bidna-golos.env"), "a") as f:
       f.write("\n# CareLine DEMO: HMAC вебхука итога звонка (itog); на стенде — CARELINE_WEBHOOK_SECRET\nCARELINE_DEMO_WEBHOOK_SECRET=%s\n" % d["webhook_secret"])
   print("webhook_id:", d["webhook_id"], "· секрет записан в ~/.bidna-golos.env")
   EOF
   ```
   `webhook_id` сразу записать в `care/elevenlabs.json` полем `"vebhuk_itoga_sozdan"` — его сборщик не читает, к агентам вебхук ещё не подключается.
2. **После выкладки:** перенести id в поле `"vebhuk_itoga_id"` → `python3 care/sborka_agentov.py --primenit` (оба агента: `post_call_webhook_id`, `events: ["transcript"]`). Сборщик откажет, если туда попадёт вебхук Веры `009c2156…`. Проверка GET: у обоих агентов новый `post_call_webhook_id`, `version_id` EN-Веры `agent_6801m3cz595hesgr7cxent1vse6r` прежний.
3. На стенде это значение кладётся в `CARELINE_WEBHOOK_SECRET` (так его ждёт `itog` с 01.10, `platforma/README.md`), пачкой из `CARELINE_DEMO_WEBHOOK_SECRET`. `ELEVENLABS_WEBHOOK_SECRET` стенд не читает вовсе: в `~/.bidna-golos.env` под этим именем секрет живой Веры. `itog` проверяет заголовок `ElevenLabs-Signature: t=…,v0=…` (HMAC-SHA256 от `"{t}.{тело}"`) так же, как `zvonok.js` Веры, и отвергает старые `t`.
4. Что приходит в `itog` для карточки `zvonki/<conversation_id>`: `analysis.data_collection_results` — namerenie, itog, kratko, imya, telefon, soobshchenie, sms_soglasie, yazyk; `analysis.transcript_summary` (en). Сообщение координатору = поле `soobshchenie`.

## 4. Первый звонок — что проверить (по записи агента, не на слух)

Звонить со своего номера, в рабочие часы NY, короткими звонками (минуты наши, ~$0,10/мин).
1. **Раскрытие:** первая фраза — «AI assistant, not a person… recorded as a text transcript».
2. **Переменные дошли** (путь Б или А с `nachalo`): «Are you open now?» — ответ по часам; «Can I come next Tuesday?» — агент называет верный вторник с датой (по календарю). В записи разговора (`GET /v1/convai/conversations/{id}`) в `conversation_initiation_client_data.dynamic_variables` есть `ofis_seychas` и `kalendar`; `producing_llm` = gemini-2.5-flash.
3. **Инструменты ходят на стенд с ключом:** короткая заявка с DEMO-именем → событие в календаре собеседований, карточка в Blobs `k-brightside/kandidaty/…`, в `GET /v1/convai/tools/{id}/executions` — 200, без `ok:false` из-за ключа.
4. **Итог звонка:** после отбоя `itog` получил вебхук с верной подписью → `zvonki/<conversation_id>` заполнен, запись в `zhurnal/<дата>`.
5. **Испанский/русский:** «¿Habla español?» → переключение, раскрытие по-испански.
6. **Линия сиделок через перевод:** «I work for you as an aide, I can't make my shift tomorrow» → `transfer_to_agent` на агента сиделок → `otkaz` на стенде с `caller_id` проверяющего (он должен быть в демо-данных, см. 1.3).
7. **«Дайте человека» в рабочие часы:** с 01.10 агент зовёт вебхук `perevod_careline_demo`; при `DRY_RUN=1` функция отвечает `ok:false` — агент не обещает перевод и принимает сообщение, в журнале `perevod_dry_run` с цепочкой, куда перевели бы. Живой перевод — только после номеров цепочек в `nastroyki.json` (решение Андрея) и `DRY_RUN=0`; четыре исхода — `platforma/README.md`, рецепт, шаг 7.
8. **Рубильник:** проверить откат VoiceUrl (путь Б) и что `VoiceFallbackUrl` отвечает фразой Bin.

## 5. Перевод на человека вебхуком `perevod` (вариант стенда, вместо заглушки)

**СДЕЛАНО 01.10 ночью** (исправления проверки): инструмент `perevod_careline_demo` = `tool_7701m3tyc9pqfmab2krhhmhbe2jq` создан из `instrumenty/perevod.json` (POST 200), id вписан в `elevenlabs.json` (`perevod_vebhuk_id`, `instrumenty.perevod`), `sborka_agentov.py --primenit` → 200 оба агента. Проверено GET: в `tool_ids` у обоих новый инструмент, `transfer_to_number` выключен (сборщик шлёт его явным null), `end_call`, `language_detection`, `transfer_to_agent` на месте; в промптах EN/ES/RU 0 упоминаний `transfer_to_number`, раздел перевода дописан; `dependent-agents` — ровно два DEMO-агента; `version_id` EN-Веры не изменился. Заодно тем же PATCH: `call_limits.daily_limit` 20 и `privacy.retention_days` 30. Тело сверено с функцией тестом `platforma/test/stend-perevod-instrument.test.js`. Ниже — как было сделано (на случай повтора).

До 01.10 в агентах был системный `transfer_to_number` на заглушку `+17185550199`. Стенд советует свой вебхук `perevod` (план Б Веры: ширма «нажмите 1», 20 с, цепочка номеров; работает на обоих путях номера, номер-мост не нужен — `platforma/README.md`, «Перевод на человека»). Решение — за главным агентом; всё готово:

1. Создать инструмент из готового тела (новый DEMO-инструмент, живые не задеваются):
   ```bash
   cd "Pivot/produkty/linii-44-43/care" && python3 - <<'EOF'
   import json, sys; sys.path.insert(0, ".")
   import sborka_agentov as SB
   st, r = SB.api("POST", "/convai/tools", json.load(open("instrumenty/perevod.json")))
   print(st, r.get("id"))
   EOF
   ```
2. id → `care/elevenlabs.json` поле `"perevod_vebhuk_id"` → `python3 care/sborka_agentov.py --primenit`. Сборщик сам: добавит инструмент обоим агентам, уберёт системный `transfer_to_number`, в промптах всех трёх языков заменит имя на `perevod_careline_demo` и допишет короткий раздел «перевод на этой линии» (вызывать молча, `ok:true` — ни слова, `ok:false` — принять сообщение).
3. Проверка: `GET /v1/convai/agents/<id>` — в `tool_ids` есть новый инструмент, в `built_in_tools` нет `transfer_to_number`; `GET /v1/convai/tools/<id>/dependent-agents` — ровно два DEMO-агента.
4. Текстовые прогоны после переключения (новый бюджет прогонов — решение Андрея): `progony/progon.py` подменяет ответ `perevod` на `{ok:true}` и считает его вызов как перевод — сценарии care-18, care-19, care-58 гоняются без изменений.
5. `system__call_sid` есть только в звонке Twilio — в текстовом прогоне и веб-разговоре перевод вебхуком не сработает (это нормально).
