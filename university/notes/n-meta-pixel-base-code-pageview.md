---
id: n-meta-pixel-base-code-pageview
title: "Базовый код пикселя ставится в <head> каждой страницы сайта и уже содержит событие PageView"
tags: [reklama-meta, pixel]
sources: [src-20260927-meta-help-pixel-standard-events]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Базовый код пикселя ставится в <head> каждой страницы сайта и уже содержит событие PageView

По справке «Specifications for Meta Pixel standard events» (402791146561655, извлечено 27.09.2026) базовый код пикселя вставляется между <head> и </head> на каждой странице, один идентификатор на весь сайт. Событие PageView входит в базовый код и срабатывает при загрузке любой страницы с ним. Стандартные события (Lead, Contact, Purchase и другие) добавляются отдельными вызовами fbq('track', …) только там, где нужно считать действие. ViewContent говорит лишь о визите на важную страницу, а не о том, что человек там сделал.

## Links

- supports: [n-meta-standard-events-contact-lead-schedule-purchase]
- refines: []
- contradicts: []
- generalizes: []
