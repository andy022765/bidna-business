# About Conversions API — conspect

**Source**: https://www.facebook.com/business/help/2041148702652965
**Source ID**: src-20260927-meta-help-about-conversions-api
**Author(s)**: Meta Business Help Center
**Published**: н/д (дату инструмент не отдаёт; извлечено 2026-09-27)
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Зачем Conversions API. Прямая связь данных сервера, сайта, приложения или CRM с Meta; события из разных источников, включая телефон и офлайн. Offline Conversions API закрыт в мае 2025. Офлайн-конверсии идут в оптимизацию только в цели Sales с местом «сайт и магазин». CAPI ставится рядом с пикселем: меньше потерь от блокировщиков, та же оптимизация и отчёты; это не способ обойти правила приватности.

## Thesis

CAPI — серверный дубль и расширение пикселя для всех источников событий, включая офлайн.

## Key points

- Источники: сайт, магазин, почта, чаты, телефон, приложение, офлайн.
- Offline Conversions API закрыт в мае 2025.
- Офлайн в оптимизации — только Sales «сайт и магазин».
- Польза для веба (по словам Meta): надёжнее, оптимизация на поздние события, измерение, совпадения.
- Веб-события CAPI ведут себя как события пикселя; ограничения условий Business Tools те же.
- Не для обхода ATT и ePrivacy.

## Methods / evidence

Обзор вендора; утверждения о снижении цены без цифр.

## Relevance to project

Опора c-0746 (пиксель + CAPI) и c-0748 (офлайн и звонки через CAPI). Подтверждает фразу брифа-bidna §9 о звонках из CRM.

## Extracted artefacts

- Notes: [n-meta-capi-redundant-with-pixel], [n-meta-capi-accepts-phone-and-offline], [n-meta-offline-conversions-api-closed-may-2025], [n-meta-offline-optimization-sales-only]
- Claims: [c-0746], [c-0748]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.facebook.com/business/help/823677331451951 | about deduplication for Meta Pixel and Conversions API events | 5/5 | queued (прочитана) |
| https://www.facebook.com/business/help/387152639648383 | about Conversions API Gateway | 2/5 | ignored: от $30 в месяц на облаке, наш объём меньше порога $300 в месяц |
| URL инструмент не отдаёт | best practices for Conversions API | 4/5 | queued |
| https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters | Meta for Developers: Conversions API parameters | 5/5 | обработана частично: src-20260927-meta-dev-capi-server-event-parameters |

## Verbatim quotes (если критично)

> "offline conversions api will be discontinued in may 2025"
