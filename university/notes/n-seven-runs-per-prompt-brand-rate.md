---
id: n-seven-runs-per-prompt-brand-rate
title: 'Для оценки доли упоминаний бренда нужно не меньше 7 запусков на вопрос, для источников — 8 и больше'
tags: [measurement, sample-size]
sources: [src-20260924-schulte-dont-measure-once, src-20260924-zatuchin-sampling-completeness]
confidence: M
created: 2026-09-24
supersedes: []
superseded_by: null
author_agent: geo-mekh
---

# Для оценки доли упоминаний бренда нужно не меньше 7 запусков на вопрос, для источников — 8 и больше

Бутстрэп-анализ Schulte и др. на 10 повторах: стандартная ошибка доли упоминаний бренда падает ниже 0,10 примерно к 7 запускам и ниже 0,08 к 11; для покрытия источников нужно больше. Авторы советуют минимум 7 запусков на вопрос в день и большой набор разных вопросов, потому что сходство по отдельным вопросам колеблется от 0,2 до 0,8. Обзор 2026 года предупреждает, что это стартовая точка, а не стандарт: число повторов подбирается по нужной ширине интервала. Наши 3 прогона на движок ниже этой планки.

## Links

- supports: [n-geo-measurement-protocol-minimum, n-grounded-brand-lists-close-fast]
- refines: [n-mention-share-valid-metric]
- claims: [c-0107, c-0115]
- sources: [src-20260924-schulte-dont-measure-once, src-20260924-zatuchin-sampling-completeness]
