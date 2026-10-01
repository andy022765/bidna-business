# Call Ads (Marketing API guide, v25.0) — conspect

**Source**: https://developers.facebook.com/documentation/ads-commerce/marketing-api/call-ads
**Source ID**: src-20260927-meta-dev-call-ads-api
**Author(s)**: Meta for Developers (Marketing API docs)
**Published**: н/д (страница без даты; извлечено 2026-09-27)
**Quality**: 7/10
**Relevance**: 5/5
**Fetched**: 2026-09-27

## TL;DR

Руководство Marketing API v25.0 по рекламе со звонком. Цели кампании — OUTCOME_AWARENESS, ENGAGEMENT, LEADS, SALES, TRAFFIC. Группа: destination_type=PHONE_CALL, optimization_goal=QUALITY_CALL, billing_event=IMPRESSIONS. Креатив: кнопка CALL_NOW со ссылкой tel:. Ограничения: аудитория 18+, номер из той же страны, что аудитория. Рекомендация — указать часы работы на странице Facebook.

## Thesis

Реклама со звонком в API — это связка PHONE_CALL + QUALITY_CALL + CALL_NOW с ограничениями по возрасту и стране номера.

## Key points

- Права: ads_management, pages_manage_ads, pages_read_engagement, pages_show_list; токен страницы с задачей ADVERTISE.
- Цели: пять OUTCOME_* (как в справке).
- Группа: PHONE_CALL, QUALITY_CALL, IMPRESSIONS; в примере device_platforms=mobile.
- Креатив: object_story_spec.link_data, call_to_action CALL_NOW, value.link=tel:+номер.
- Объявление в примере — PAUSED.
- Ограничения: 18+; номер той же страны; рекомендация — часы работы на странице.

## Methods / evidence

Документация API с примерами запросов (воспроизводимо).

## Relevance to project

Коннектор Meta Ads работает поверх этого API: таргетолог увидит эти поля в ответах. Подтверждает c-0740 (QUALITY_CALL) и c-0742 (18+, страна номера).

## Extracted artefacts

- Notes: [n-meta-call-ads-five-objectives], [n-meta-api-call-ads-quality-call], [n-meta-call-ads-audience-18-plus-same-country]
- Claims: [c-0740], [c-0742]
- Contradictions: —

_Отклонение от §3: канонический по баллу (7), атомарных идей 2 (QUALITY_CALL; ограничения 18+ и страна номера) — остальное (шаги API) в конспекте._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/call-ads/callback-feature | Callback feature | 3/5 | queued |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/bidding/overview/billing-events | Optimization Goals and Bidding Events Overview | 3/5 | queued (для A) |
| https://www.facebook.com/business/help/237108475737601 | View metrics for call ads | 5/5 | обработана: src-20260927-meta-help-call-ads-metrics |

## Verbatim quotes (если критично)

— (полный текст страницы сохранён в original.md)
