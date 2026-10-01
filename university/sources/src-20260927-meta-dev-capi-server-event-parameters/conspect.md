# Server Event Parameters (Conversions API) — conspect

**Source**: https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event
**Source ID**: src-20260927-meta-dev-capi-server-event-parameters
**Author(s)**: Meta for Developers (Marketing API docs)
**Published**: н/д (страница без даты; извлечено 2026-09-27)
**Quality**: 7/10
**Relevance**: 5/5
**Fetched**: 2026-09-27

## TL;DR

Поля серверного события Conversions API. event_name и event_id — ключ дедупликации с пикселем (окно 48 часов, при разнице до 5 минут побеждает браузер). event_time — не старше 7 дней, иначе отклоняется весь запрос. action_source обязателен, среди значений есть phone_call. event_source_url обязателен для событий сайта. data_processing_options — флаг LDU с кодами страны и штата. Есть original_event_data и customer_segmentation.

## Thesis

Серверное событие Meta описывается небольшим набором обязательных полей, и от них зависят дедупликация, приём и приватность.

## Key points

- event_id + event_name: дедупликация 48 часов, браузер в приоритете при разнице до 5 минут.
- event_time ≤ 7 дней, иначе ошибка всего запроса.
- action_source: email, website, app, phone_call, chat, physical_store, system_generated, business_messaging, other.
- event_source_url обязателен для веб-событий.
- opt_out=true — событие только для атрибуции, без оптимизации.
- data_processing_options ['LDU'], страна 1/0, штат 1000/0.

## Methods / evidence

Документация API.

## Relevance to project

Техническая основа задач ГОЛОСУ: event_id для Purchase из Stripe (c-0746), phone_call для итога звонка Веры (c-0748), LDU (c-0752).

## Extracted artefacts

- Notes: [n-meta-capi-accepts-phone-and-offline], [n-meta-capi-action-source-phone-call], [n-meta-capi-event-time-max-7-days], [n-meta-capi-dedup-event-id-48h], [n-meta-ldu-advertiser-decides]
- Claims: [c-0746], [c-0748], [c-0752]
- Contradictions: —

_Отклонение от §3: канонический по баллу (7), атомарных идей 3 и фрагмент в n-meta-ldu-advertiser-decides — остальное в конспекте._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters | Customer Information Parameters | 5/5 | queued |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events | Deduplicate Pixel and Server Events | 4/5 | queued (прочитана) |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/data-processing-options | Data Processing options | 4/5 | queued (прочитана) |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/original-event | Original Event Data Parameters | 2/5 | ignored: для отложенных событий приложений |

## Verbatim quotes (если критично)

— (полный текст страницы сохранён в original.md)
