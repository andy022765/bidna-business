# Проверка CareLine №44 перед выкладкой

*30.09.2026, независимый проверяющий. Только чтение: файлы, GET ElevenLabs и Twilio, `npm test`, esbuild в scratchpad.*

## Вердикт: можно после правок

Блокирующих дыр в коде нет. Пять правок нужны до окна, три — до публикации номера.

**Чисто:**
- секретов в папке нет: 39 значений из `~/.bidna-golos.env` дали 0 совпадений;
- подписи, HMAC и ключи сравниваются через `timingSafeEqual` (`podpisi.js:14`);
- на бандлах без ключа: vhod и sms-vhod — 403, pult и evv — 401, инструменты — `{ok:false}`, itog — 401;
- noindex стоит; CORS нет; DRY_RUN включён по умолчанию; покупок в коде нет; Веру код не трогает;
- тесты 227 из 227 (Node 26 и 24); бандлов 14 из 14; переменные занимают около 0,8 КБ из 4;
- агенты: ИИ и запись раскрыты в первой фразе на EN/ES/RU; вопрос о праве на работу дословный, запретных вопросов нет; 5 инструментов смотрят на стенд; вебхук итога не Верин (пуст); перевод на 555-0199;
- тексты: цифр результата и гарантий нет, BAA и NC/NY указаны верно.

## Находки

| Важность | Где | Что не так и доказательство | Как исправить |
|---|---|---|---|
| до окна | `nastroyki.json:93`, агенты | 60 звонков × 8 мин ≈ $45 в день при бюджете $80 на месяц; `daily_limit` 300; если Blobs не поднялся, потолок молча снят (`vhod.js:79`). Кошельки общие с Верой, у Twilio на балансе $17,32 | лимит 10–15 звонков, `daily_limit` 20 |
| до окна | `podpisi.js:73`, `README.md:152` | стенд читает `ELEVENLABS_WEBHOOK_SECRET`, а локально это секрет Веры | переименовать переменную или составить таблицу соответствия имён |
| до окна | `PRIVYAZKA.md` §3, `README.md:181` | вебхук итога создаётся после выкладки, а переменная действует только с новой выкладкой: itog ответит 401 | создать вебхук до выкладки |
| до окна | `README.md:151` | источник ключа не указан; по заметке в памяти локальный `ELEVENLABS_API_KEY` выдан на 30 дней | брать `ELEVENLABS_STAND_KEY` |
| до окна | `README.md:163` | нет команды загрузки ключа Google в Blobs; без ключа запись не работает | дописать команду |
| решение | `PRIVYAZKA.md:35,117`, `KONTRAKT.md:13` | для проверки линии сиделок нужен настоящий номер в демо-данных — это нарушает запрет 7 | временная DEMO-запись |
| до публикации | `hiring.en.md:165`, `caregivers.en.md:35,67` | на пути Б `transfer_to_number` не работает — агент обещает соединить и срывается | вебхук `perevod` (`PRIVYAZKA.md` §5) |
| до публикации | `index.html:340,457,462` | SMS кандидатов не обрабатываются; ссылка ведёт на статичный `demo.json`; чужой номер `otkaz` не узнаёт | переписать тексты |
| до публикации | `TOCHKA:128,194` | новые промпты не прогнаны; критичных пройдено 12 из 33 | прогоны |
| потом | переменные стенда | на стенде будут мастер-токен Twilio, ключ ElevenLabs с доступом к агентам Веры, PAT Netlify и служебный аккаунт календаря Веры | субаккаунт и отдельные ключи |
| потом | `otpravka.js:194`, `podpisi.js:65`, `pult.js:323`, `svodka.js:39` | у исходящих звонков нет потолка; JSON-тело проверяется только по URL; ключ пульта остаётся в адресе | укрепить |
| потом | `web/pult/API.md`, агенты, `pult/index.html:54` | документация открыта; расшифровки хранятся бессрочно; на живом пульте плашка «вымышлено»; SmsUrl в рецептах расходится | поправить |

## После выкладки проверить

1. Заголовки и robots.txt.
2. Отказы без подписи и ключа те же; svodka, volny и napominaniya по URL не запускаются.
3. Замок Blobs; после звонка `schetchiki/<дата>.zvonkov` = 1.
4. У трёх функций в панели стоит Scheduled.
5. Первый звонок:
   - переменные `ofis_seychas` и `kalendar` дошли;
   - инструменты отвечают без `net_dostupa`;
   - itog отвечает 200;
   - `post_call_webhook_id` рабочего пространства всё ещё null;
   - в журнале только `*_dry_run`.
6. `transfer_to_agent` работает; `otkaz` и `zapis` отвечают быстрее 20 с.
7. Рубильник VoiceUrl → Bin и обратно.
8. Регресс Веры: `zvonok-vhod` без подписи — 403.

## Мой промах

Регулярное выражение напечатало в журнал сессии значения 18 переменных из `~/.bidna-golos.env`:
- BOTY_KEY/SECRET;
- ELEVENLABS_API_KEY/STAND_KEY/WEBHOOK_SECRET;
- GOLOS_NASH_KLYUCH, GOLOS_PISMO_SECRET;
- OPENAI_API_KEY_SAYT;
- OTSKOK_SECRET, RAZBOR_SECRET;
- RESEND_API_KEY;
- TWILIO_ACCOUNT_SID/API_KEY/API_SECRET/AUTH_TOKEN/PROFILE_SID;
- UPTIMEROBOT_API_KEY, VERA_ADRES_SECRET.

В Drive и в отчёт значения не попали. Менять ли ключи, решает Андрей.

## Исправлено 01.10 ночью

*Помощник по находкам. Только локальные правки и DEMO-агенты CareLine; ничего не выложено, сайт стенда и номера Twilio не тронуты, людям не писал, прогонов и симуляций не было, ключей Anthropic не трогал. Имена переменных из `~/.bidna-golos.env` выводил только безопасной командой, значения — только в окружение процесса.*

**Проверка после правок:** `npm test` — 247 из 247 на Node 24 и 26 (было 227); esbuild — 14 функций из 14 под node20; бандлы без подписи и ключа отвечают как раньше (vhod и sms-vhod — 403, pult и evv — 401, itog — 401, инструменты — 200 `net_dostupa`); бандл `vhod` без Blobs — «temporarily unavailable» и ноль сетевых вызовов. ElevenLabs: изменены только два DEMO-агента и создан один DEMO-инструмент; `version_id` EN-Веры до и после — `agtvrsn_3801m3g8q6pvf9qswjz0tk13pw4f`, хэш конфигурации тот же.

| Находка | Что сделано | Файлы |
|---|---|---|
| Деньги: 60 звонков, `daily_limit` 300, потолок снят при сбое Blobs | `limity.zvonkov_v_sutki` 15. `vhod` fail-closed: нет хранилища или счётчик упал — «Sorry, this line is temporarily unavailable…» (или офис клиента), register-call не зовётся; свои номера `ZVONKI_BEZ_KVOTY` проходят. Потолок исходящих `ishodyashchih_v_sutki` 10 в `otpravka.zvonok`: упёрлись — побудка уходит письмом координатору. DEMO-агенты: `platform_settings.call_limits.daily_limit` 300 → 20 (поле сверено с документацией; PATCH, потом GET) | `nastroyki.json`, `netlify-functions/vhod.js`, `lib/otpravka.js`, `lib/otkazy.js`, `lib/frazy.js`, `care/sborka_agentov.py`, тесты `stend-vhod`, `stend-otpravka` |
| Стенд читал `ELEVENLABS_WEBHOOK_SECRET` (на Маке это секрет Веры) | На стенде `CARELINE_WEBHOOK_SECRET` ← `CARELINE_DEMO_WEBHOOK_SECRET`; старое имя стенд не читает (тест). Таблица «имя на стенде ← имя в `~/.bidna-golos.env`» по всем переменным и рецепт заливки пачкой без вывода значений | `lib/podpisi.js`, `netlify-functions/itog.js`, `test/stend-pomoshch.js`, `test/stend-itog.test.js`, `platforma/README.md` |
| Вебхук итога создавался после выкладки | Раздел README «Окно выкладки»: вебхук и его секрет до выкладки, переменные одной пачкой, к агентам — после выкладки, первый звонок — после. `webhook_id` до выкладки лежит в `vebhuk_itoga_sozdan` (сборщик его не читает) | `platforma/README.md`, `care/PRIVYAZKA.md` §3 |
| Источник ключа ElevenLabs не указан | `ELEVENLABS_API_KEY` на стенде ← `ELEVENLABS_STAND_KEY` (бессрочный) | `platforma/README.md`, `care/PRIVYAZKA.md` §1 |
| Нет команды ключа Google в Blobs | `scripts/zalit-klyuch-kalendarya.js`: файл ключа → Blobs `kalendar-klyuch`/`sa` по site id и токену; `--proverit`; содержимое не печатает; чужой `SITE_ID` и папку в Drive отвергает. Против стенда не запускался — шаг 4 окна. Тест на локальном адаптере с вымышленным ключом и подменённым HOME | `platforma/scripts/zalit-klyuch-kalendarya.js`, `lib/kalendar.js` (экспорт `klyuchSA`), `test/stend-zalit-klyuch.test.js` |
| Путь Б: `transfer_to_number` не работает | Создан DEMO-инструмент `perevod_careline_demo` = `tool_7701m3tyc9pqfmab2krhhmhbe2jq` (вебхук на `perevod`, `call_sid` ← `system__call_sid`, `conversation_id`, `agent_id` ← `system__current_agent_id`, `svodka`, `yazyk`; имена сверены с документацией). Через `sborka_agentov.py --primenit` подключён к обоим агентам, системный перевод снят явным null; в промптах трёх языков имя заменено и дописан короткий раздел о переводе (только то, что нужно для вызова). GET: `dependent-agents` — два DEMO-агента, `end_call` и `transfer_to_agent` на месте. Тесты функции на ровно этот вход | `care/elevenlabs.json`, `care/sborka_agentov.py`, `test/stend-perevod-instrument.test.js` |
| Демо-страница: SMS кандидатов, «увидите себя», чужой номер | Кандидатам — только звонок (текст и схема «как идёт звонок кандидата»); «пример пульта на демо-данных, ваш звонок в нём не появится»; отказ от смены — «только с номера, который есть у агентства, с другого — сообщение координатору». В пустом пульте убрано «or text» | `web/demo/care/index.html`, `web/pult/pult.js` |
| Ключ пульта в адресе | Ключ читается один раз, хранится в `sessionStorage` вкладки, из адреса убирается `history.replaceState`; 401 стирает его. Проверено прогоном `pult.js` на заглушке DOM: четыре случая | `web/pult/pult.js`, `docs/API.md` |
| `API.md` открыт | Перенесён в `platforma/docs/API.md` (вне `web/`), ссылки в коде, тестах и README поправлены | `docs/API.md` и 9 файлов со ссылками |
| Расшифровки бессрочно | Итоги звонков на стенде — 30 дней (`hranenie.zvonki_dney`; чистка в `svodka` раз в сутки: `zvonki/`, `zvonki-itog/`, `zvonki-vhod/`, `razgovory/`). У DEMO-агентов `privacy.retention_days` 30 (к прежним разговорам не применяется) | `lib/chistka.js`, `netlify-functions/svodka.js`, `nastroyki.json`, `care/sborka_agentov.py`, `test/stend-chistka.test.js` |
| SmsUrl в рецептах расходится | Один адрес `https://linii-demo-85fof.netlify.app/.netlify/functions/sms-vhod` и `SmsMethod=POST` в README и в готовом curl `PRIVYAZKA.md` §2 | `platforma/README.md`, `care/PRIVYAZKA.md` |
| Плашка «всё вымышлено» на живом пульте | В режиме стенда по ключу: «demo data plus test calls to the demo line» | `web/pult/pult.js` |

**Попутно:** `sborka_agentov.py` приведён к живым агентам (`max_soft_timeouts_per_generation` 2), поэтому `--primenit` меняет только задуманное (сверено до PATCH: расхождений с живыми было ровно одно, это поле). В пульте подписаны новые строки журнала (`chistka`, `zvonok_potolok`). Дополнение в `KONTRAKT.md` — раздел «Исправления проверки 01.10 ночью».

**Осталось:**
- **Решения Андрея:** настоящий номер в демо-данных, чтобы проверить линию сиделок голосом (нарушает запрет 7; без него `otkaz` отвечает «номер не найден»); смена ключей после печати 18 значений 30.09 (токен Twilio и секреты Веры меняются только вместе с её стендом); субаккаунт Twilio и отдельные ключи стенда (сейчас в таблице — мастер-токен Twilio, стендовый ключ ElevenLabs с доступом к агентам Веры, токен Netlify); номера цепочек перевода и дежурных; момент `DRY_RUN=0`.
- **Прогоны:** промпты с новым переводом и прежние критичные сценарии (12 из 33) не прогнаны — в этой задаче прогоны запрещены. Нужны care-18, care-19, care-58 и критичные; на день прогонов `daily_limit` 20 придётся временно поднять. Возможен двойной «соединяю»: фраза модели из прежнего текста и `<Say>` функции — увидеть на прогоне.
- **Не сделано из «потом»:** JSON-тело Twilio проверяется только по URL (`podpisi.js`, `bodySHA256`) — нашим вебхукам не нужно, формы; ключ пульта в ссылке письма-сводки (`svodka.js`) оставлен — решение по API.md, раздел 6; журнал `zhurnal/` (там тексты писем и SMS в DRY_RUN) срока хранения не имеет — решение Андрея.
