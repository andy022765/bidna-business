# Контракт №43 NightDesk: функции стенда и модель данных

*30.09.2026, сборщик №43 (подготовка без трат). Продолжение `../KONTRAKT.md`: все его запреты действуют, архитектура та же, что у №44 CareLine. Меняешь контракт — пиши сюда и в итоговый отчёт.*

**Статус.** Готовы данные, движки, промпты, сценарии, провокации, тела инструментов и этот контракт. Агентов, инструментов и секрета в ElevenLabs нет. Номера нет. Функций `nd-*` на стенде нет: стенд — файлы сборщика стенда (`platforma/netlify-functions/`, `platforma/nastroyki.json`, `platforma/linii.json`), сюда мы не писали. Всё ниже — задание для него.

## 1. Папки №43

```
nightdesk/
  KONTRAKT-ND.md                этот файл
  list-pravdy/harborrow.json    лист правды DEMO: 3 дома, 180 квартир, аварии, инструкции, дежурные, подрядчики,
                                6 объявлений, критерии аренды, ответы жильцам, источники права (ссылки, проверено 30.09)
  fair-housing/shablony.json    запретные темы и нейтральные шаблоны EN/ES (одинаковые всем)
  fair-housing/provokacii.json  60 провокаций: вопрос, ожидаемое поведение, эталон из шаблонов, типичная ошибка
  fair-housing/proverit.js      CLI: проверка реплик правилами, выгрузка JSONL для модели zillow
  fair-housing/KLASSIFIKATOR.md как подключить zillow/fair-housing-guardrail (весов нет, лицензия OpenRAIL-S)
  prompty/after-hours.{en,es}.md  ночная линия жильцов (Б1, Б3)
  prompty/leasing.{en,es}.md      линия лизинга (Б2, Б5)
  prompty/pervye-frazy.json       первые реплики с раскрытием ИИ и записи
  scenarii/scenarii.json        50 сценариев nd-01…nd-50 (kritichnyy) + 30 вопросов вне листа
  instrumenty/*.json            8 тел для POST /v1/convai/tools (имена *_nightdesk_demo, URL стенда)
  demo-dannye/zhiltsy.json      16 демо-жильцов для поиска по номеру
  nastroyki/sobrat.js           сборка блока настроек клиента и черновика линий из листа правды
  nastroyki/harborrow.nastroyki.json  → влить в platforma/nastroyki.json как есть
  nastroyki/linii.chernovik.json      → влить в platforma/linii.json (DEMO-3, DEMO-4)
  elevenlabs.chernovik.json     черновик агентов (не созданы)
platforma/lib/nightdesk/
  sortirovka.js                 движок Б1: сортировка, правила тепла NYC, цепочка с ширмой, TwiML, заявка
  fair-housing.js               движок Б5: проверка текстов правилами (EN/ES), белый список шаблонов
platforma/test/nd-*.test.js     64 теста (node --test)
```

## 2. Клиент и линии

- Клиент `harborrow` — «Harbor Row Property Management (DEMO)», Бруклин: Tidewater House (41 Harbor Row, 72 кв., лифт), Seawell Court (215 Seawell Place, 60 кв., лифт, гараж), Kestrel Gardens (780 Kestrel Avenue, 48 кв., без лифта). Пояс America/New_York, языки линии EN/ES.
- Линии (черновик `nastroyki/linii.chernovik.json`): `DEMO-3` → `nd-after-hours` (ночь и выходные: аварии, заявки, вопросы жильцов), `DEMO-4` → `nd-leasing` (номер из объявлений). Между ними — системный `transfer_to_agent`.
- Секрет `x-liniya-klyuch` — один на обе линии клиента: workspace secret `nightdesk_demo_x_liniya_klyuch`, значение в `~/.bidna-golos.env` → `NIGHTDESK_DEMO_LINIYA_KLYUCH`; в телах инструментов стоит заглушка `ZAPOLNIT_secret_id_nightdesk_demo_x_liniya_klyuch` — заменить на secret_id после создания. Линию стенд узнаёт по `agent_id` (← `system__current_agent_id`, есть в каждом теле).
- Настройки клиента — блок `harborrow` из `nastroyki/harborrow.nastroyki.json` (собран `sobrat.js` из листа; руками не править). Новое в нём — ветка `nightdesk`: `avarii`, `instrukcii`, `doma` (где вентили и щиток), `dezhurnye.cepochka` (с ролями), `ofis_perevod`, `podryadchiki`, `eskalaciya` (20 с, круги каждые 10 мин, 3 круга), `obeshchanie_perezvona`, `zayavki`, `obyavleniya` (ссылки), `fair_housing_odobrennye` (белый список для проверки SMS).

## 3. Хранилище `k-harborrow` (Netlify Blobs; локально — `.data/`)

| Ключ | Что | Поля |
|---|---|---|
| `obekty/<id>` | дом или объявление | дом: id, tip `dom`, nazvanie, adres, zip, kvartir, etazhey, lift, gde_voda{en,es}, gde_shchit{en,es}, super{imya, telefon}; объявление: id (`tw-3c`…), tip `obyavlenie`, dom, kvartira, spalen, vannyh, arenda_usd, svobodna_s, status (svobodna / pokazy / zayavka / sdana), ssylki{obyavlenie, zayavka, pokaz}. Факты для агента — только из листа правды (в промпте), не из хранилища |
| `zhiltsy/<id>` | жилец | id, dom, kvartira, imya, telefony[], yazyk, sms_soglasie, aktiven. **Больше ничего:** ни детей, ни возраста, ни ваучеров, ни инвалидности. Индекс `indeks/telefon/zhilec/<E.164>` → id |
| `avarii/<id>` | угроза жизни или авария по списку | id (`AV-<YYYYMMDD>-<HHMM>-<4 знака>`), created_at, conversation_id, liniya, kategoriya, uroven (ugroza_zhizni / avaria), prichina, po_spisku, dom, adres, kvartira, opisanie, telefon (звонящего), zhilec_id, yazyk, instrukciya (код), eskalaciya (состояние движка — §6), zayavka_id, status (otkryta / prinyata / ne_prinyata / zakryta), zakryta_v, kto_zakryl |
| `zayavki/<nomer>` | заявка на ремонт | nomer (`HR-1001`…), created_at, conversation_id, istochnik (call/sms), dom, adres, kvartira (`COMMON` — места общего пользования), kategoriya, uroven, opisanie, dostup (da / tolko_pri_mne / net), dostup_primechanie, zhivotnye, imya, telefon, sms_soglasie, foto_ssylka_otpravlena, avaria_id, status (new / naznachena / v_rabote / sdelana / otmenena), istoriya[{at, status, kto}], pms{sistema (email / rent_manager), otpravleno_v, vneshniy_id} — позже |
| `lidy/<id>` | лид лизинга | id, created_at, razgovory[], kanal (call/sms), imya, telefon, email, obyavleniya[], data_vezda (YYYY-MM), spalen, voprosy_dlya_ofisa[], sms_soglasie, yazyk, pokaz_id, ssylki[{tip, kanal, at}], status (new / pokaz_zapisan / pokaz_sostoyalsya / zayavka_podana / zakryt), fh_preduprezhdeniya[]. **Запрещённые поля навсегда:** доход, работа, ваучер, дети и состав семьи, возраст, инвалидность, происхождение, язык дома, религия, судимость, гражданство. Индекс `indeks/telefon/lid/<E.164>` |
| `pokazy/<id>` | показ | id, created_at, conversation_id, lid_id, obyavlenie_id, dom, kvartira, tip (s_agentom / samostoyatelnyy), start, end, event_id, gde (`building entrance`), status (zapisan / sostoyalsya / ne_prishel / otmenen / perenesen) |
| `zvonki/<conversation_id>` | итог звонка (общий с №44) | поля №44 + namerenie №43, dom, kvartira, avaria_id, zayavka_ids[], lid_id, pokaz_id, raskrytie_ii, fh_narusheniya[] (проверка реплик агента правилами) |
| `soglasiya/<телефон>`, `zhurnal/<дата>` | как в №44 | — |

Служебные: `razgovory/<conv>` {avaria_id, zayavka_ids[], lid_id, pokaz_id, perevod}; `schetchiki/zayavki` (номер HR — условной записью); `indeks/avarii-otkrytye/<id>` (для расписания); `bron/pokaz/<obyavlenie>/<start UTC>` (замок окна показа); `otpravleno/`, `schetchiki/<дата>` — как в №44.

## 4. Функции стенда для №43

| Функция | Кто зовёт | Защита | Что делает |
|---|---|---|---|
| `nd-zhilec` **новая** | инструмент | `x-liniya-klyuch` | caller_id → `indeks/telefon/zhilec` → `{ok, nayden, dom, adres_vsluh, kvartira, kvartira_vsluh}` (`kvartiraVsluh` из движка, язык из тела). Имён не отдаёт. Не нашёл — `{ok:true, nayden:false}` |
| `nd-sortirovka` **новая** | инструмент | ключ | `sortirovat(тело, nightdesk.avarii, {moment: сейчас, poyas})` → при уровне ugroza/avaria upsert `avarii/<id>` по conversation_id (повторный вызов обновляет ту же аварию; сигнал — только если уровень вырос); ugroza → `novayaEskalaciya(rezhim 'signal')` → SMS всем (`tekstSms … 'ugroza'`) и звонок-побудка дежурному 1. Ответ — `otvetInstrumenta(вердикт, {yazyk, dom, instrukcii})`: `{ok, uroven, skazat, sprosit, dalshe}` |
| `nd-perevod` **новая** | инструмент + Twilio | ключ; метки HMAC в адресах | Авария разговора (`razgovory/<conv>.avaria_id`, уровень avaria) → `sostavitCepochku(kategoriya, nightdesk, {ofisOtkryt})` → `novayaEskalaciya(rezhim 'perevod')` → обновить звонок по `call_sid` TwiML `twimlPerevoda` (вступление `frazaZhilcu('soedinyayu')`, первый номер). Нет аварии и офис OPEN → цепочка офиса (`ofis_perevod.cepochka_lizinga` для лизинга, `cepochka_avarii` для ночной линии), как `perevod.js`. Иначе `{ok:false, soobshchenie}`. Обратные вызовы — §6 |
| `nd-eskalaciya` **новая** | расписание, каждые 2 мин | — | по `indeks/avarii-otkrytye` — `sleduyushcheeDeystvie(esk, сейчас)`: следующий круг побудки, сторож зависших звонков (нет обратного вызова > 150 с), «не принята» в пульт и сводку |
| `nd-zayavka` **новая** | инструмент | ключ | `novayaZayavka(тело, {nomer, at, doma})` → `proveritZayavku` (нет поля → `{ok:false, soobshchenie}` с вопросом, ничего не пишет) → номер `nomerZayavki(счётчик)` → связь с аварией разговора → письмо офису (DRY_RUN — журнал) → SMS со ссылкой на фото, только при `sms_soglasie`. Ответ `{ok, nomer, nomer_vsluh}` |
| `nd-lid` **новая** | инструмент | ключ | upsert по conversation_id и телефону; `voprosy_dlya_ofisa` через `fair-housing.proverit`: нарушение → вопрос не записывать, факт — в журнал и `fh_preduprezhdeniya` |
| `nd-ssylka` **новая** | инструмент | ключ | ссылка из `nightdesk.obyavleniya` (или `kriterii_ssylka`); SMS — только при `sms_soglasie=true` (журнал согласий) и после `proverit()` текста; email — через `otpravka`; DRY_RUN — журнал |
| `okna` **расширить** | инструмент | ключ | `tip: 'pokaz'` + `obyavlenie_id` → календарь `kalendari.pokaz` (пн–пт 10–17, 30 мин, 3 окна в ответе); бронь по объявлению |
| `zapis` **расширить** | инструмент | ключ | `tip: 'pokaz'` → событие «Showing <код> — <имя>», `pokazy/<id>`, связь с лидом; повтор = та же встреча (как у №44) |
| `vhod` **расширить** | Twilio | подпись | линии DEMO-3/DEMO-4; `ofis_seychas`, `kalendar` — как у CareLine. По желанию `temperatura_snaruzhi` не нужна: её подставляет `nd-sortirovka` |
| `itog` **расширить** | ElevenLabs post-call | HMAC | словарь `namerenie` №43 (`elevenlabs.chernovik.json`); **страховка жизни:** namerenie `ugroza`, а аварии в разговоре нет (жилец положил трубку раньше инструмента) → создать аварию по caller_id и запустить сигнал; реплики агента — через `fair-housing.proverit` → `zvonki.fh_narusheniya` |
| `pult`, `svodka` **расширить** | — | ключ пульта | разделы №43 — §8 |

Инструмент всегда отвечает HTTP 200: `{ok:true,…}` или `{ok:false, soobshchenie}` — фраза для звонящего (KONTRAKT.md).

## 5. Инструменты агента (тела — `instrumenty/*.json`)

| Инструмент | Функция | Тело (модель заполняет) | Системные (dynamic_variable) | Ответ |
|---|---|---|---|---|
| `nayti_zhilca_nightdesk_demo` | nd-zhilec | yazyk | caller_id, conversation_id, agent_id | ok, nayden, dom, adres_vsluh, kvartira, kvartira_vsluh |
| `sortirovka_nightdesk_demo` | nd-sortirovka | kategoriya (28 кодов движка), lyudi_v_opasnosti, zapah_gaza, dym_ili_ogon, co_signal, voda_u_elektriki, voda_aktivno, potolok_provis, ohvat, temperatura_vnutri, edinicy, otoplenie_sovsem_net, avtomat_proveren, v_lifte_lyudi, dom, kvartira, opisanie, yazyk | caller_id, conversation_id, agent_id | ok, uroven, kategoriya, skazat, sprosit, pole, dalshe (SPROSIT / 911 / PEREVOD / ZAYAVKA / SOOBSHCHENIE / INFO) |
| `perevod_nightdesk_demo` | nd-perevod | svodka (англ., без имён и номеров), yazyk | call_sid, conversation_id, agent_id | ok, perevedeno, soobshchenie (`obeshchanie_perezvona`), dalshe |
| `sozdat_zayavku_nightdesk_demo` | nd-zayavka | dom, kvartira, kategoriya, opisanie, dostup, zhivotnye, imya, telefon, sms_soglasie, yazyk | caller_id, conversation_id, agent_id | ok, nomer, nomer_vsluh |
| `svobodnye_okna_nightdesk_demo` | okna | tip `pokaz`, obyavlenie_id, data_s, yazyk | agent_id | okna [{start, end, tekst}] |
| `zapisat_pokaz_nightdesk_demo` | zapis | tip `pokaz`, obyavlenie_id, start, imya, telefon, email, yazyk | conversation_id, agent_id | ok, event_id, start_tekst |
| `sohranit_lida_nightdesk_demo` | nd-lid | imya, telefon, email, obyavleniya[], data_vezda, spalen, voprosy_dlya_ofisa[], sms_soglasie, yazyk | conversation_id, agent_id | ok, id |
| `otpravit_ssylku_nightdesk_demo` | nd-ssylka | tip (obyavlenie / zayavka / kriterii / samostoyatelnyy_pokaz), obyavlenie_id, kanal (sms / email), telefon, email, sms_soglasie, yazyk | conversation_id, agent_id | ok, kanal |

Перевод — вебхук `perevod_nightdesk_demo` (`pre_tool_speech: off`, как `perevod_careline_demo`), не системный `transfer_to_number`: на пути Б системный не работает вовсе, на пути А принимает автоответчик за ответ (`platforma/README.md`, «Перевод на человека»).

## 6. Движок `lib/nightdesk/sortirovka.js` и перевод с ширмой

**Сортировка.** `sortirovat(otvety, spisok, {moment, poyas})` — детерминированно, по ответам агента. Порядок: (1) угроза жизни — по категории (8 категорий, список управляющего может добавить, но не убрать) или по признаку (газ, дым, тревога CO, люди в опасности, вода у электрики, люди в лифте) → 911, сигнал, без вопросов; (2) для аварий из списка и «другого» сначала ★ «есть ли пострадавшие»; (3) не в списке → заявка; (4) условия внутри категорий: течь идёт/остановлена/провис потолка; тепло — правило HPD (1.10–31.05; 6–22 ч при <55°F снаружи — ≥68°F; 22–6 ч — ≥62°F; °C пересчитываются; снаружи неизвестно — считаем холодно), весь дом — авария; горячая вода — авария, если без неё несколько квартир; свет — улица = Con Edison и заявка, квартира — сначала щиток; лифт — «есть ли кто внутри». Неизвестный ответ на вопрос безопасности = худший случай. Нет ответа — вердикт `SPROSIT` с вопросом на языке звонящего.

**Цепочка.** `sostavitCepochku` → дежурный 1 → дежурный 2 → подрядчик по категории (`rezhim 'perevod'`); в часы офиса — офис → подрядчик; сигнал (`'signal'`) — только люди. Состояния и переходы — шапка `sortirovka.js`; одно решение на событие — `primenitIshod(esk, {shag, krug, ishod, at}) → {esk, deystviya}`; действия: `zvonok`, `sms`, `fraza_zhilcu`, `pult`, `zhdat`, `svodka`. Опоздавший или повторный обратный вызов (другой шаг или круг) ничего не двигает.

**TwiML (как `Pivot/golos/site/netlify-functions/perevod-ru.js`, план Б, 4 из 4 исходов 28.09):**
1. `nd-perevod` (инструмент) → `twimlPerevoda({nomer, callerId: номер линии, zhdatS: 20, adresShirmy, adresItoga, vstuplenie})`.
2. `?shag=shirma&a=<avaria>&i=<шаг>&r=<круг>&k=<метка>` → `twimlShirmy({tekst: tekstShirmy(avaria), adresPrinyat})` — два `<Gather numDigits=1>` (6 и 5 с), потом `<Hangup/>`.
3. `?shag=prinyat` → `twimlPrinyat(Digits)`: любая цифра — соединить, иначе отбой.
4. `?shag=itog` → `ishodPerevoda(DialCallStatus, DialBridged)` → `primenitIshod` → следующий `twimlPerevoda` без вступления, или `twimlOtkata` («никто не смог ответить… перезвонят на этот номер») + SMS всем + побудка.
5. Побудка (сигнал): REST-звонок дежурному с `url=?shag=budit` (`twimlSignala`), `budit-otvet` (цифра → отметить `nazhal`), `StatusCallback=?shag=budit-status` (`ishodSignala` → `primenitIshod`).
Метка `k = HMAC(секрет линии, 'nd-perevod:<avaria>:<шаг>:<круг>')` — `lib/podpisi.metka`, как `perevod.js`. DRY_RUN=1 — Twilio не трогаем: в журнал «кому позвонили бы», цепочку двигает тестовый прогон.

**Заявка.** `novayaZayavka` (адрес — из листа по `dom`, не из слов модели), `proveritZayavku` (дом, квартира, описание, доступ, имя, телефон; «Caller»/«Unknown» = нет имени), `nomerZayavki(n)` → `HR-1000+n`, `nomerVsluh` — цифрами.

## 7. Движок `lib/nightdesk/fair-housing.js`

`proverit(tekst, {odobrennye})` → `{ok, narusheniya[{kod, klass, fragment}], preduprezhdeniya, ostatok}`. Вырезает дословные предложения одобренных текстов (`odobrennyeIz(shablony, kriterii)` или `nightdesk.fair_housing_odobrennye`), остаток — правилами EN/ES. Любое упоминание ваучеров вне дословного шаблона — нарушение. Где звать на стенде: `nd-ssylka` и любые SMS/письма лидам — перед отправкой; `nd-lid` — вопросы для офиса; `itog` — реплики агента. Модель zillow — офлайн на прогонах (`fair-housing/KLASSIFIKATOR.md`).

## 8. Пульт и утренняя сводка (Б4)

Разделы для `harborrow` (в порядке важности): **аварии** (угрозы жизни отдельно; кто принял и через сколько секунд; «не принята» — красным первой строкой сводки); **заявки** (новые за ночь по домам, с доступом); **лиды** (новые, вопросы без ответа); **показы** (сегодня и завтра); **звонки** (всего, брошенные, перевод не удался); **fair housing** (флаги проверяльщика по звонкам и SMS — норма 0); **согласия SMS**. Сводка — 7:00 America/New_York, как у №44.

## 9. Переменные стенда (только имена)

Новые: `NIGHTDESK_DEMO_LINIYA_KLYUCH`, `PULT_KLYUCH_HARBORROW`. Общие с №44: `DRY_RUN=1`, `BLOBS_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `ELEVENLABS_API_KEY`, `ELEVENLABS_WEBHOOK_SECRET`, `PLATFORMA_URL`. Погода для правила тепла днём — без ключа: api.weather.gov (наблюдения станции KNYC, нужен заголовок User-Agent, кэш 15 мин) **[не проверено]**; не ответила — движок считает «холодно».

## 10. Приёмка №43 (план) и чем проверяется

| Критерий плана | Порог | Где |
|---|---|---|
| Угрозы жизни: 911 и сигнал дежурному | 100% | движок — `nd-sortirovka.test.js` (9 сценариев, 8 категорий + признаки); агент — прогоны nd-01…09 (проверки `911_pervym`, `bez_voprosov_do_911`, `konec_posle_911`) |
| Перевод по цепочке: нажал / взял без нажатия / не взял / сбросил | 4 из 4 | движок — тесты цепочки (+ «никто», «жилец положил трубку», офис открыт); живьём — 4 звонка дозвонщиком, как 28.09 |
| Заявка: адрес, квартира, описание, доступ | 100% без потерь | `proveritZayavku` на стенде + прогоны nd-22…31 (`zayavka_polnaya`) |
| 30 вопросов вне листа | 0 выдуманных фактов | `scenarii.json → voprosy_vne_lista`; шаблон `ne_znayu` |
| 60 провокаций fair housing | 0 нарушений по классификатору и вручную; ответ про ваучеры одинаковый везде | правила — `nd-fair-housing.test.js` (эталоны 0, ошибки 60/60); модель — после весов; ваучеры — `nd-dannye`/`nd-prompty` |
| Раскрытие ИИ и записи | 100% звонков | `pervye-frazy.json`, `nd-prompty.test.js`; прогоны — проверка `raskrytie` |

Критичные сценарии — 35 из 50, каждый 3 из 3 подряд (как №44).

## 11. Не проверено и решения за Андреем

Не проверено: ни одной строки на стенде (функций `nd-*` нет), ни одного прогона агента; погода NWS; поведение `transfer_to_agent` между линиями №43.
**За Андреем:** (1) письмо Zillow за весами классификатора — или своё обучение, или жить на правилах до юриста; (2) лицензия OpenRAIL-S против Apache 2.0 в README — к юристу вместе с шаблонами Б2; (3) юрист по fair housing до продажи Б2 (уже в плане): шаблоны, критерии аренды, формулировка про судимость; (4) чьи живые телефоны стоят в цепочке на демо (звонок живому человеку — только по согласию, в оговорённое время); (5) номер NightDesk DEMO — в пределах одобренных $80, когда дойдёт очередь; (6) «жилец настаивает» — будить дежурного или нет (по умолчанию нет).
