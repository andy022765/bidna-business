# Insights API — Limits & Best Practices — выписка

URL: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices
Получено: 2026-09-27, curl (документация Meta for Developers, Marketing API, публичная страница).

Полный текст здесь не хранится: это текст Meta (Meta for Developers), защищённый авторским правом. Он открывается по URL.

## Пересказ по разделам

- Документ описывает лимиты и лучшие практики Ads Insights API (Marketing API): для чего они нужны (защита производительности системы) и как их обходить.
- Смена уровней доступа: «Standard Access» переименован в Limited Access, «Advanced Access» — в Full Access; порог для Full Access снижен с 1500 до 500 вызовов Marketing API за последние 15 дней; идентификатор разрешения и уже выданные уровни доступа не меняются, код менять не нужно.
- С 10.06.2025 поле `reach` (и связанные `frequency`, `cpp`) больше не возвращается в обычных запросах с разбивками (breakdowns) и датой начала старше 13 месяцев; такие данные можно получить только асинхронными задачами (до 10 запросов на рекламный аккаунт в день), отслеживая заголовок `x-Fb-Ads-Insights-Reach-Throttle`.
- Таймауты: синхронные (`/GET`) запросы могут вернуть ошибку нехватки памяти или таймаут, асинхронные (`/POST`) — таймаут (асинхронный запрос может выполняться до часа); жёсткого лимита нет, лечится дроблением запроса (например, по диапазону дат) и вынесением уникальных метрик в отдельный вызов.
- Лимиты объёма данных на вызов (по числу строк и по числу точек для расчёта итогов, включая сводную строку) действуют и для синхронных, и для асинхронных вызовов `/insights`; при превышении — ошибка `error_code = 100` (subcode 1487534). Рекомендации: сужать запрос по датам/id, запрашивать только нужные метрики, избегать высококардинальных разбивок (`action_target_id`, `product_id`) вместе с широкими диапазонами дат вроде lifetime, работать на уровне более низких объектов (кампания/объявление) вместо аккаунта, использовать `filtering` и `date_preset`, группировать запросы через batch requests.
- Лимиты нагрузки на уровне аккаунта считаются по уровню доступа Marketing API и по бизнесу, владеющему приложением; текущая загрузка видна в заголовке `x-fb-ads-insights-throttle` (проценты по приложению и по аккаунту, плюс текущий tier); при превышении лимита — ошибка `error_code = 4`. При глобальной перегрузке `/insights` система может троттлить сложные запросы отдельной ошибкой (subcode 1504022) — рекомендуется снизить частоту и подождать. Общие рекомендации: не слать запросы пачкой без пауз, использовать данные из заголовков для отступления (back-off) ближе к 100% использования, учитывать часовой пояс аккаунта, проверять свой access tier.
- Ключевой факт про свежесть данных: отчёты обновляются каждые 15 минут и не меняются больше через 28 дней после того, как впервые попали в отчёт; после завершения показа рекламы метрики могут ещё донастраиваться пару дней.
- Асинхронные задачи: `POST .../insights` возвращает `report_run_id` (не хранить долго — истекает через 30 дней); статус (`Job Not Started` → `Job Started` → `Job Running` → `Job Completed`/`Job Failed`/`Job Skipped`) опрашивается через Ad Report Run, затем результат читается через `<AD_REPORT_RUN_ID>/insights`; начиная с Marketing API v25.0 неудачный отчёт возвращает поля кода и текста ошибки по умолчанию. Отдельный неверсионированный эндпоинт экспортирует отчёт в csv/xls по `report_run_id`.
- Расхождения с Ads Manager: с 10.06.2025 параметры `use_unified_attribution_setting` и `action_report_time` в API больше не учитываются — ответ API имитирует настройки Ads Manager. Значения атрибутируются по настройке окна атрибуции на уровне группы (как при `use_unified_attribution_setting=true`), «inline»-действия входят в окна `1d_click` или `1d_view` — отдельного окна inline больше нет. Время действия — «mixed»: действия на площадках Meta (например, клики по ссылке) отдаются по дате показа, действия вне Meta (например, покупки на сайте) — по дате конверсии. Чтобы явно получить поведение Ads Manager, нужно установить `use_unified_attribution_setting=true`.

## Короткие цитаты для сверки (дословно)

> "The revised qualification threshold for Full Access has been reduced from 1,500 to 500 Marketing API calls in the past 15 days."

> "Insights refresh every 15 minutes and do not change after 28 days of being reported"

> "Insights metrics may continue to update for a couple of days after an ad has completed"

> "inline/on-ad actions will be included in `1d_click` or `1d_view` attribution window data. After this change, standalone `inline` attribution window data will no longer be returned."

> "on-Meta actions (e.g., Link Clicks) will use impression-based reporting time; whereas off-Meta actions (e.g., Web Purchases) will leverage conversion-based reporting time."
