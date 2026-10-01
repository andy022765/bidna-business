# Conversions API for CRM Integration — conspect

**Source**: https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration
**Source ID**: src-20260927-meta-dev-capi-crm-conversion-leads
**Author(s)**: Meta for Developers (Marketing API docs)
**Published**: н/д (страница без даты; извлечено 2026-09-27)
**Quality**: 7/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Документация по CRM-интеграции Conversions API для цели Conversion Leads. Это отдельная интеграция: события стадий воронки из CRM с Meta Lead ID. Условия: инстант-формы, 200+ лидов в месяц, загрузка не реже раза в день, целевая стадия в 28 дней, конверсия 1–40%. План — 3–4 недели до полного эффекта, из них 2–4 недели обучения. Партнёр для интеграции без кода — Zapier.

## Thesis

Оптимизация на качество лидов рассчитана на рекламодателей с сотнями лидов в месяц и ежедневной выгрузкой из CRM.

## Key points

- Отдельная интеграция CAPI для CRM.
- Lead ID 15–17 цифр (иначе click ID, телефон или email).
- 200+ лидов в месяц; ежедневно; 28 дней; 1–40%.
- План: 3–4 недели, обучение 2–4 недели.
- Только инстант-формы — расходится со справкой 2026 года (contr-112).

## Methods / evidence

Документация вендора; пороги названы ориентирами.

## Relevance to project

Опора c-0749 и contr-111: шаг 4 лестницы на нашем объёме недостижим.

## Extracted artefacts

- Notes: [n-meta-crm-integration-fit-200-leads], [n-meta-crm-integration-3-4-weeks]
- Claims: [c-0749]
- Contradictions: [contr-112]

_Отклонение от §3: канонический по баллу (7), атомарных идей 2 — остальное в конспекте._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/zapier | 3: Zapier Implementation | 2/5 | queued |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/payload-specification | Payload Specification | 3/5 | queued |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/conversion-leads-integration/how-to-find-the-lead-id | Find the Lead ID | 1/5 | ignored: не наш объём |

## Verbatim quotes (если критично)

— (полный текст страницы сохранён в original.md)
