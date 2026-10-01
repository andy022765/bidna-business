# Call Ads (Marketing API guide, v25.0) — выписка

URL: https://developers.facebook.com/documentation/ads-commerce/marketing-api/call-ads
Получено: 2026-09-27, curl (документация Meta for Developers, Marketing API, публичная страница).

Полный текст здесь не хранится: это текст Meta (Meta for Developers), защищённый авторским правом. Он открывается по URL.

## Пересказ по разделам

- Руководство Marketing API (v25.0) описывает создание рекламы со звонком (кнопка «Позвонить» в самом объявлении) в четыре шага: кампания → группа объявлений → креатив → объявление.
- Перед стартом нужны: рекламный аккаунт с действующим способом оплаты, загруженные на серверы Meta ассеты, токен доступа страницы от человека с правом ADVERTIZE и разрешения `ads_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list`. Рекомендация — указать часы работы бизнеса в настройках страницы Facebook.
- Ограничения (Limitations): целевая аудитория должна быть 18 лет и старше; номер телефона в кнопке действия должен быть из той же страны, что и целевая аудитория.
- Шаг 1 — кампания (`POST .../campaigns`): обязательные поля `name`, `objective` (одно из `OUTCOME_AWARENESS`, `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC`), `special_ad_categories`.
- Шаг 2 — группа объявлений (`POST .../adsets`): обязательные `bid_amount`, `billing_event` (значение `IMPRESSIONS`), `campaign_id`, `daily_budget`, `destination_type` (значение `PHONE_CALL`), `name`, `optimization_goal` (значение `QUALITY_CALL` для рекламы со звонком), `targeting`; в примере таргетинга — `device_platforms: ["mobile"]`.
- Шаг 3 — креатив (`POST .../adcreatives`): обязательны `name` и `object_story_spec`; для рекламы со звонком в `object_story_spec.link_data` задаётся `call_to_action` с `type = CALL_NOW` и `value` — ссылкой вида `tel:+номер_с_кодом_страны`. Поддерживаются карусель, изображение, только текст и видео.
- Шаг 4 — объявление (`POST .../ads`): связывает `adset_id` и `creative_id`, обязательны ещё `name` и `status`; в примере статус — `PAUSED` (объявление создаётся на паузе).
- Дальше руководство отсылает к отдельному гайду по отправке объявления на модерацию и к списку связанных справочников API (метрики звонков в Ads Manager, кампании, креатив, объявления, таргетинг, цели оптимизации и события биллинга).

## Короткие цитаты для сверки (дословно)

> "the target audience must be 18 years old or older"

> "the phone number included in Call to Action must be from the same country as the target audience"

> "optimization_goal` set to `QUALITY_CALL` for call ads"

> "call_to_action` with `type` set to `CALL_NOW` and `value` as the phone number for your business"

> "destination_type` set to `PHONE_CALL`"
