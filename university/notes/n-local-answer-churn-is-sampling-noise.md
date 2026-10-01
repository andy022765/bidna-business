---
id: n-local-answer-churn-is-sampling-noise
title: 'Разброс местных ответов — случайность выборки, а не дрейф: через две недели сходство такое же, как у повтора в тот же день'
tags: [measurement, stability, local]
sources: [src-20260924-bali-venue-census-audit, src-20260924-schulte-dont-measure-once]
confidence: M
created: 2026-09-24
supersedes: []
superseded_by: null
author_agent: geo-mekh
---

# Разброс местных ответов — случайность выборки, а не дрейф: через две недели сходство такое же, как у повтора в тот же день

Одинаковые вопросы в тот же день дают разные наборы заведений: Jaccard у Gemini 0,45, Perplexity 0,40, OpenAI 0,29, Claude 0,22. Перефраз с тем же смыслом снижает сходство ещё сильнее. Предрегистрированный повтор через две недели дал сходство на уровне повтора в тот же день (0,375). Schulte и др. пришли к тому же на 45 днях: межсуточная нестабильность в основном объясняется случайностью генерации. Для нас: частые замеры ловят шум, а не движение; повторов нужно больше, а сравнивать «до» и «после» надо с интервалами.

## Links

- supports: [n-ai-sources-turn-over-65pct-daily]
- claims: [c-0100, c-0114]
- sources: [src-20260924-bali-venue-census-audit, src-20260924-schulte-dont-measure-once]
