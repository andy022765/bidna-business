# 2025 Out-of-cycle changes (Marketing API) — conspect

**Source**: https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025
**Source ID**: src-20260927-meta-dev-occ-2025
**Author(s)**: Meta for Developers (Marketing API docs)
**Published**: 2025-12-08
**Quality**: 7/10
**Relevance**: 3/5
**Fetched**: 2026-09-27

## TL;DR

Журнал изменений Marketing API вне версий за 2025 год. Для нас две записи. С 12.01.2026 окна 7d_view и 28d_view не возвращают данных; история уникальных метрик и почасовых разрезов — 13 месяцев, разреза по частоте — 6 месяцев. С 10.06.2025 API повторяет Ads Manager по атрибуции и времени действий. Прочие записи (Бразилия, Threads, финансовая категория) не про нас.

## Thesis

В 2025–2026 Meta урезала окна просмотра и глубину истории в отчётах API.

## Key points

- 12.01.2026: 7d_view и 28d_view — без данных.
- История: 13 месяцев (уникальные, почасовые), 6 месяцев (частота).
- 10.06.2025: unified attribution, mixed report time.
- 14.01.2025: категория FINANCIAL_PRODUCTS_SERVICES вместо CREDIT (для C — правила).

## Methods / evidence

Журнал изменений вендора с датами.

## Relevance to project

Опора c-0750 (что удалено) и c-0751 (время отчёта).

## Extracted artefacts

- Notes: [n-meta-view-windows-7d-28d-removed-2026], [n-meta-insights-mixed-report-time]
- Claims: [c-0750], [c-0751]
- Contradictions: —

_Отклонение от §3: канонический по баллу (7), атомарная идея одна своя и одна общая с Insights best practices._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026 | 2026 Out-of-cycle changes | 3/5 | queued (прочитана: DMA → Comscore Markets с 22.06.2026 — для A; новые функции Advantage+ creative — для C) |
| https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights#discrepancy-with-ads-manager | discrepancy with Ads Manager guidance | 4/5 | обработана: src-20260927-meta-dev-insights-best-practices |

## Verbatim quotes (если критично)

— (полный текст страницы сохранён в original.md)
