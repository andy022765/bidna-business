# 2025 Out-of-cycle changes (Marketing API) — выписка

URL: https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025
Получено: 2026-09-27, curl (документация Meta for Developers, Marketing API, публичная страница).

Полный текст здесь не хранится: это текст Meta (Meta for Developers), защищённый авторским правом. Он открывается по URL.

## Пересказ по разделам

- Страница — хронологический (от новых к старым) журнал внецикловых изменений Marketing API за 2025 год.
- 08.12.2025 — для аудиторий Бразилии в `regional_regulated_categories` добавлено значение `BRAZIL_REGULATION` (с полями `universal_beneficiary` и `universal_payer`), чтобы не получать ошибку «No beneficiary/payer provided».
- 29.10.2025 — новая метрика `instagram_profile_visits` (визиты в профиль Instagram после клика по CTA, фото профиля или юзернейму), для всех версий API.
- 28.10.2025 — для Threads доступны Advantage+ catalog ads (пока только изображения и карусели изображений).
- 13.10.2025 — важное для отчётности изменение, вступает в силу 12.01.2026 для всех версий: окна атрибуции 7-day view-through (`7d_view`) и 28-day view-through (`28d_view`) больше не возвращают данных; глубина истории ограничена — уникальные метрики и почасовые разбивки доступны только за 13 месяцев, разбивка по частоте показа (`frequency_value`) — за 6 месяцев, разбивка MMM переводится только в асинхронные задачи.
- 09.10.2025 — плейсмент Messenger Inbox (`messenger_home`) с 11.11.2025 нельзя использовать при создании и таргетинге объявлений (с версии API v23.0+).
- 06.10.2025 — для Threads доступна карусель изображений (без кастомизации по плейсменту и видео в карточках).
- 18.09.2025 — с 06.10.2025, в ответ на регламент ЕС о прозрачности политической рекламы (TTPA), реклама о социальных темах, выборах и политике в Евросоюзе больше не разрешена.
- 02.09.2025 — в Catalog API можно синхронизировать `live_special_price` — цену на время прямого эфира (с версии v23.0+).
- 19.08.2025 — в таргетинг по месту добавлен источник `COMSCORE_MARKET` (Comscore Markets) наравне с зонами DMA — и при создании групп, и в поиске таргетинга.
- 18.08.2025 — при создании кампании появилось поле `is_adset_budget_sharing` (с версии v21.0+): при значении True рекламодатель может делиться с другими группами кампании до 20% бюджета (ad set budget sharing).
- 15.08.2025 — для Threads доступны видеообъявления, и Threads добавлен как `publisher_platform` в настройку кастомизации ассетов по плейсменту.
- 01.05.2025 — в promoted object группы добавлено поле для семантического типа ценности (`value_semantic_type`) — для кампаний с целью максимизации общей ценности (с версии v22.0+).
- 31.03.2025 — в таргетинг по плейсменту и кастомизации ассетов добавлен плейсмент `notification`, для всех версий.
- 10.03.2025 — анонс изменения Ads Insights API, вступает в силу 10.06.2025 для всех версий: (1) чтобы уменьшить расхождения с Ads Manager, параметры `use_unified_attribution_setting` и `action_report_time` перестают учитываться, ответ API имитирует настройки Ads Manager; (2) чтобы повысить производительность API, `reach` больше не возвращается в запросах с разбивками (breakdowns) и датой начала старше 13 месяцев — такие данные можно получить только асинхронными задачами.
- 14.01.2025 — новое значение специальной категории рекламы `FINANCIAL_PRODUCTS_SERVICES` (финансовые продукты и услуги) заменяет собой `CREDIT` начиная с этой даты; после неё создание рекламы с категорией `CREDIT` завершится ошибкой; на бизнесы с этой категорией распространяются те же ограничения аудитории, что и на жильё и трудоустройство.

## Короткие цитаты для сверки (дословно)

> "Data for 7-day view-through (`action_attribution_windows=7d_view`) and 28-day view-through (`action_attribution_windows=28d_view`) attribution windows will no longer be available and will return no data"

> "Limited to 13 months: All breakdowns for unique-count fields (like `unique_actions` and `cost_per_unique_action_type`); and hourly breakdowns for all fields"

> "On June 10, 2025, Ads Insights API behavior will change in two ways"

> "advertisers can now share up to 20% of their budget with other ad sets in the same campaign."

> "`CREDIT` will no longer be a valid special ad category selection after it is deprecated on January 14, 2025."
