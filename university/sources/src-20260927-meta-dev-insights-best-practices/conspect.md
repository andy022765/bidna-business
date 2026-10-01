# Insights API — Limits & Best Practices — conspect

**Source**: https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices
**Source ID**: src-20260927-meta-dev-insights-best-practices
**Author(s)**: Meta for Developers (Marketing API docs)
**Published**: н/д (страница без даты; извлечено 2026-09-27)
**Quality**: 7/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Лучшие практики Insights API. Для нас важны три строки: отчёты обновляются каждые 15 минут; после окончания показа метрики могут меняться ещё пару дней; через 28 дней данные не меняются. С 10.06.2025 API повторяет Ads Manager: атрибуция по окну группы, время действий «mixed» — действия на Meta по дате показа, вне Meta по дате конверсии.

## Thesis

Цифры Meta окончательны только через 28 дней, а основные изменения идут в первые дни после показа.

## Key points

- Обновление каждые 15 минут.
- Изменения ещё пару дней после окончания показа.
- Через 28 дней — без изменений.
- С 10.06.2025: unified attribution, action_report_time=mixed.
- Остальное (лимиты запросов, асинхронные отчёты) нас не касается.

## Methods / evidence

Документация API.

## Relevance to project

Опора c-0751 и contr-113: правило «досчёт до 7 дней» — не правило Meta.

## Extracted artefacts

- Notes: [n-meta-insights-refresh-15min-frozen-28d], [n-meta-insights-mixed-report-time]
- Claims: [c-0751]
- Contradictions: —

_Отклонение от §3: канонический по баллу (7), атомарных идей 2 — остальное в конспекте._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/breakdowns | Breakdowns | 1/5 | ignored: разрезы |
| https://www.facebook.com/business/help/1997130013754737 | how conversions are attributed (Ads Manager vs Commerce Manager) | 4/5 | queued (прочитана: окно по умолчанию 7 дней клик или 1 день просмотр; отчёт по дате показа) |

## Verbatim quotes (если критично)

> "may continue to update for a couple of days"
