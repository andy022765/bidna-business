---
id: n-meta-view-windows-7d-28d-removed-2026
title: "С 12 января 2026 окна атрибуции 7d_view и 28d_view в Ads Insights API больше не возвращают данных"
tags: [reklama-meta, atribuciya, marketing-api]
sources: [src-20260927-meta-dev-occ-2025]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# С 12 января 2026 окна атрибуции 7d_view и 28d_view в Ads Insights API больше не возвращают данных

Изменение вне цикла от 13.10.2025 в Marketing API (для всех версий с 12.01.2026): данные по окнам 7-day view-through и 28-day view-through больше недоступны и возвращаются пустыми. Заодно ограничена глубина истории: уникальные метрики и почасовые разрезы — 13 месяцев, разрез по частоте — 6 месяцев; разрез MMM — только асинхронно. Коннектор Meta Ads читает отчёты через этот API, поэтому запрос с такими окнами вернёт пустоту, а не ошибку. Для сравнения периодов брать окна из оставшихся (1d_click, 7d_click, 1d_view) и одинаковые.

## Links

- supports: [n-meta-click-through-link-clicks-only]
- refines: [n-meta-insights-mixed-report-time]
- contradicts: []
- generalizes: []
