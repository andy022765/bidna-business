---
id: n-meta-insights-mixed-report-time
title: "С 10 июня 2025 API отдаёт действия вне Meta по дате конверсии, а действия на Meta — по дате показа, и всегда по окну атрибуции группы"
tags: [reklama-meta, otchet, atribuciya, marketing-api]
sources: [src-20260927-meta-dev-insights-best-practices, src-20260927-meta-dev-occ-2025]
confidence: M
created: 2026-09-27
supersedes: []
superseded_by: null
---

# С 10 июня 2025 API отдаёт действия вне Meta по дате конверсии, а действия на Meta — по дате показа, и всегда по окну атрибуции группы

Изменение, объявленное 10.03.2025 и вступившее 10.06.2025: параметры use_unified_attribution_setting и action_report_time в Insights API игнорируются, ответы повторяют Ads Manager. Значения считаются по окну атрибуции на уровне группы, «inline»-действия входят в окна 1d_click или 1d_view, отдельного окна inline больше нет. Время действия — «mixed»: действия на площадке Meta (например, клики по ссылке) — по дате показа, действия вне Meta (например, покупки на сайте) — по дате конверсии. Справка о Commerce Manager (1997130013754737, в очереди) при этом пишет, что Ads Manager отчитывается по дате показа — формулировку нужно сверить. К какому типу Meta относит звонок из объявления, документация не говорит.

## Links

- supports: [n-meta-insights-refresh-15min-frozen-28d]
- refines: [n-meta-view-windows-7d-28d-removed-2026]
- contradicts: []
- generalizes: []
