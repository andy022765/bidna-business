# Compare Conversions API setup options — conspect

**Source**: https://www.facebook.com/business/help/433493041367251
**Source ID**: src-20260927-meta-help-capi-setup-options
**Author(s)**: Meta Business Help Center
**Published**: н/д (дату инструмент не отдаёт; извлечено 2026-09-27)
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Сравнение способов подключить Conversions API. Meta-enabled — бесплатно, в один клик, только веб, дублирует события пикселя и сам их дедуплицирует. Прямая интеграция — разработчик, 2–4 недели, любые источники; для офлайн- и app-событий это единственный путь. Партнёры — коммерческие платформы, теги, мессенджеры, CRM; Stripe не назван.

## Thesis

Серверную копию событий сайта можно получить без кода, а всё, чего нет в браузере, — только своей интеграцией.

## Key points

- Meta-enabled: free, one click, pixel only, web, авто-дедупликация.
- Прямая: 2–4 недели (1–2 при готовом вебе), web/app/offline/CRM/переписка.
- Партнёры: Shopify, WooCommerce, Wix, BigCommerce; Adobe, GTM, Tealium; мессенджеры; CRM.
- Офлайн и app — только прямая интеграция.
- Stripe не упоминается.

## Methods / evidence

Сравнительная таблица вендора.

## Relevance to project

Прямой ответ на вопрос брифа о Stripe (c-0754) и основа задач ГОЛОСУ: сначала Meta-enabled CAPI, потом свой Purchase из вебхука Stripe и итог звонка.

## Extracted artefacts

- Notes: [n-meta-enabled-capi-web-one-click], [n-meta-capi-offline-app-direct-only], [n-meta-capi-partners-no-stripe]
- Claims: [c-0748], [c-0754]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.facebook.com/business/help/260370078559247 | about partner integrations for website events | 4/5 | queued (прочитана: Stripe нет, есть Zapier, LeadsBridge, Make) |
| https://www.facebook.com/business/help/317857030149451 | connecting your CRM using Conversions API for CRM | 2/5 | queued |
| URL инструмент не отдаёт | developer best practices for Conversions API | 4/5 | queued |

## Verbatim quotes (если критично)

> "direct integration is the only available option at this time"
