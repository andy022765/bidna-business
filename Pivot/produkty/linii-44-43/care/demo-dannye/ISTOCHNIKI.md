# Источники правил EVV и допущения движка

*Прочитано 30.09.2026. Каждая страница открыта целиком: WebFetch или встроенный браузер (health.ny.gov отдаёт WebFetch 403, читали браузером), PDF разобраны в текст. Сниппеты поиска источником не считались. Движок — `platforma/lib/care/evv.js`.*

## Федеральный закон

1. **42 U.S.C. 1396b(l)** — https://www.law.cornell.edu/uscode/text/42/1396b
   (l)(5)(A), дословно: система EVV проверяет «(i) the type of service performed; (ii) the individual receiving the service; (iii) the date of the service; (iv) the location of service delivery; (v) the individual providing the service; and (vi) the time the service begins and ends». (l)(1): PCS — с 01.01.2020, HHCS — с 01.01.2023, иначе ступенчатое снижение FMAP.
2. **Medicaid.gov, Electronic Visit Verification** — https://www.medicaid.gov/medicaid/home-community-based-services/home-community-based-services-guidance-additional-resources/electronic-visit-verification
   §12006(a) 21st Century Cures Act требует EVV для PCS и HHCS с визитом на дом; PCS к 01.01.2020, HHCS к 01.01.2023; снижение FMAP до 1%. Адрес `…/guidance/electronic-visit-verification/index.html` из старых ссылок отдаёт 404.

## Нью-Йорк

3. **NYSDOH, EVV Applicable Billing Codes** — https://www.health.ny.gov/health_care/medicaid/redesign/evv/repository/app_billing_codes.htm
   Шесть элементов перечислены прямо. Managed Care: T1019 U1 — PCS Level II basic, 15 минут; S5130 U1 — PCS Level I, 15 минут; T1019 U6–U9 — CDPA; T1020 — live-in; S5125 — HHA, 15 минут; S9122 — HHA, в час; S5126 — HHA live-in, сутки (13 часов). Отсюда справочник кодов NY в движке и коды демо T1019:U1 и S5125.
4. **NYSDOH, EVV FAQ** (редакция 15.09.2026) — https://www.health.ny.gov/health_care/medicaid/redesign/evv/faqs.htm
   - PCS — с 01.01.2021, HHCS — с 01.01.2023; модель Choice, данные идут в агрегатор через eMedNY.
   - Способы: телефония, мобильное приложение, FOB. GPS не обязателен; вместо координат допустимы значения места Home или Community.
   - Сверять координаты прихода и ухода с адресом клиента — обязанность провайдера; допустимый радиус штат не задаёт, визиты по GPS OMIG проверяет в каждом случае отдельно.
   - Исправленная запись требует одобрения руководителя и документированной причины; хранить и исходные, и исправленные данные.
   - Время в EVV — точное, без округления; выставлять счёт — по текущей практике.
   - Автоматического отказа или приостановки счёта без записи EVV сейчас нет; но счёт считается соответствующим, только если у него есть совпадающая запись EVV; несоответствия — проверки NYSDOH и аудит OMIG с возвратом переплат.
5. **eMedNY, EVV** — https://www.emedny.org/evv/ — ссылки на ICD и Technical User Guide (PDF не читались: для движка не понадобились).

## Северная Каролина

6. **NC Medicaid, Electronic Visit Verification** (изменена 21.07.2026) — https://medicaid.ncdhhs.gov/EVV
   - Шесть элементов. Sandata — агрегатор штата и бесплатное решение Medicaid Direct; HHAeXchange — для Standard Plans, LME/MCO и Tailored Plans; CareBridge — для Healthy Blue.
   - Правки NCTracks: 02077 — нет EVV на дату услуги (14 дней ожидания, затем отказ); 02079 — единиц в счёте больше подтверждённых (7 дней, затем урезание до подтверждённых). Для дат услуг с 01.06.2021.
   - Округление: 0–7 минут — 0 единиц, 8–22 — 1, 23–37 — 2 и далее.
   - Ручные правки счёт не отклоняют, но их должно быть не больше 15% визитов.
   - Телефония — только с телефонов, зарегистрированных на получателя.
   - Home Health: EVV в Medicaid Direct и Standard Plans с 01.04.2023.
7. **NC EVV Service Codes List**, версия 8 от 18.02.2025 — https://medicaid.ncdhhs.gov/evv-service-codes-list/download?attachment
   State Plan PCS: 99509 HA (до 21 года), 99509 HB (агентства, 21+). CAP: S5125, S5150, T1004, T1019, T2027, S5135, S9122 TF/TG. Home Health: RC570 (помощник по уходу), RC550/RC551 (медсестра), RC420/430/440 (терапия).
8. **NC Medicaid, EVV FAQ** (22.05.2024) — https://medicaid.ncdhhs.gov/evv-frequently-asked-questions/download?attachment
   - Пропущенная отметка исправляется ручным визитом в Visit Maintenance, система требует причину.
   - Адрес, GPS и телефон при оплате счёта не проверяются; GPS смотрят на аудите после оплаты.
   - При стороннем поставщике EVV нужна отметка GPS.
   - Визиты должны быть в расписании; счёт приостанавливается, если единиц больше длительности по расписанию.
   - Home Health: 1 визит = 1 единица, 15-минутное округление не применяется.
9. **NC Medicaid, бюллетень 09.09.2025** — https://medicaid.ncdhhs.gov/blog/2025/09/09/managed-care-electronic-visit-verification-home-health-implementation-hard-launch-effective-oct-1
   С 01.10.2025 в Standard и Tailored Plans счета за HHCS без данных EVV отклоняются (Medicaid Direct — с 01.10.2023). Коды услуги в счёте должны совпадать с визитом EVV, иначе отказ «no matching data»; коды в визите и счёте должны совпадать и с авторизованными услугами.

## Формат выгрузки и ZIP

10. **HHAeXchange, Homecare V5 Flat File Import Layout** — https://knowledge.hhaexchange.com/edi/Content/Documentation/EDI/EDI-Homecare-Import-P.htm
    96 полей импорта визитов; время `YYYY-MM-DD HH:MM`; Visit Edit Reason Code и Visit Edit Action Taken обязательны при ручной правке. Отсюда имена колонок демо-выгрузки.
11. **U.S. Census Bureau, TIGERweb, 2020 Census ZCTA** — https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/7
    Внутренние точки INTPTLAT/INTPTLON для 99 ZIP Бруклина и Квинса — таблица в `platforma/lib/care/zip.js`.

## Какое правило чем подтверждено

| Правило | Подтверждение | Допущение |
|---|---|---|
| NET_USLUGI, NET_POLUCHATELYA, NET_DATY, NET_MESTA, NET_ISPOLNITELYA, NET_PRIHODA, NET_UHODA | 1, 3, 4, 6 — шесть элементов | NY: для места хватает Home/Community (4); NC: нужны GPS, телефон клиента или FOB (6, 8) |
| UHOD_RANSHE_PRIHODA | 1 — «время начала и конца» | — |
| PRAVKA_BEZ_PRICHINY | 4 (NY: причина и одобрение); 8 (NC: Visit Maintenance требует причину); 10 | в NY «критично», в NC «предупреждение» — счёт из-за правки не отклоняется (6) |
| MESTO_NE_SOVPADAET | 4 (провайдер сверяет GPS с адресом клиента); 6 (телефон клиента); 8 (GPS — аудит после оплаты) | радиус 400 м — наш, штаты числа не дают; важность «предупреждение» |
| EDINICY_BOLSHE_VREMENI | 6 — правка 02079 и таблица округления; 8 — HH: 1 визит = 1 единица | NY: только целые 15-минутные единицы — наше, NYSDOH округление не задаёт |
| PREVYSHENIE_AVTORIZACII | 9 — услуги в счёте должны совпадать с авторизованными | лимит в 15-минутных единицах за неделю с понедельника — формат нашей авторизации |
| KOD_NE_AVTORIZOVAN | 9 | авторизация на код без модификатора покрывает все его модификаторы |
| VNE_DAT_AVTORIZACII | 9; 8 (визиты до загрузки авторизации вносятся ручной правкой) | — |
| PERESECHENIE | 1 — исполнитель и время: одна сиделка не бывает в двух местах сразу | допуск 0 минут |
| VNE_RASPISANIYA, NE_TA_SIDELKA | 8 — визиты EVV должны быть в расписании (NC) | окно ±2 часа вокруг смены; в NY «предупреждение», в NC «критично» |

## Что не подтвердилось

- **G0156 нет ни в списке NY, ни в списке NC** (это код Medicare для помощника по уходу). HHA в NY Managed Care — S5125 или S9122, в NC Home Health — RC570. В демо G0156 не используется.
- **Фраза плана «NC с 01.10.2025 отклоняет счета без совпадающей записи EVV» верна только для HHCS в Standard и Tailored Plans** (9). Для PCS и CAP правки 02077/02079 действуют с дат услуг 01.06.2021, для HHCS в Medicaid Direct — с 01.10.2023. Звучит даже сильнее: в NC это действует давно.
- **Нью-Йорк сейчас не отклоняет счета автоматически** (4). Риск для агентства в NY — проверка соответствия и аудит OMIG с возвратом уже полученных денег. В продажах в NY говорить «аудит и возврат», а не «отказ в оплате». Есть ли свои автоматические правки у планов MLTC — вопрос к консультанту.
- Миссури (27.05.2026) из плана не проверялся — вне этой задачи.

## Что нужно от консультанта по биллингу EVV

1. Округление и минимальная длительность визита у планов NY (MLTC) и какие у них автоматические правки счёта по EVV.
2. Период авторизации у каждого плана (неделя с какого дня, месяц, весь срок) и в чём лимит (часы или 15-минутные единицы).
3. Настоящие имена колонок экспорта из портала HHAeXchange и из Sandata у агентства-пилота.
4. Списки кодов причин правки (reason codes, action taken) для NY и NC.
5. Радиус GPS, который план или агентство считает «дома», и политика по отметкам с мобильного телефона.
6. Модификаторы (U1–U9, TV, U2 — два клиента) и live-in (T1020, S5126): как считать сутки и 13 часов.
7. Связка «квалификация сиделки ↔ код услуги»: PCA не должна выставляться кодом HHA (S5125). Сейчас движок её не проверяет — в сигнатуре `proverit` нет справочника сиделок.
