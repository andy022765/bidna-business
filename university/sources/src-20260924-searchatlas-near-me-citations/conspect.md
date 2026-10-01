# How LLMs Rank Local Businesses: A Study of “Near Me” Query Citations — conspect

**Source**: https://searchatlas.com/blog/how-llms-rank-local-business/
**Source ID**: src-20260924-searchatlas-near-me-citations
**Author(s)**: Manick Bhan
**Published**: 2026-01-17
**Quality**: 5/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Вендор SEO-софта разобрал 104 855 ссылок из ответов шести ИИ на запросы с «near me» (27.10–03.12.2025) и сопоставил позицию ссылки с авторитетом домена, schema, сигналами Google-карточки, смысловым соответствием и свежестью. Лучше всего с позицией связано смысловое соответствие страницы вопросу; авторитет домена — отрицательно; schema и карта — слабо.

## Thesis

В местных ИИ-ответах порядок ссылок сильнее связан со смысловым соответствием страницы, чем с классическими SEO-сигналами.

## Key points

- Смысловое соответствие ~ позиция: r ≈ 0,18–0,19 (OpenAI, Grok, AI Mode), 0,10 (Perplexity), 0,04 (Copilot).
- DA/DP/DR: отрицательная связь у большинства движков.
- Schema: от нейтральной до отрицательной, слабо положительная у Copilot и AI Mode.
- GBP Score ~ +0,16; позиция на карте и посты — нейтрально.
- Главные страницы дают наименьшее соответствие — нужны страницы под конкретные запросы.
- Gemini предпочитает свежие страницы.

## Methods / evidence

Корреляционный анализ; эмбеддинги запроса и страницы; обогащение метриками доменов и карточек. Методика описана поверхностно, «strong» для r ≈ 0,18.

## Relevance to project

Поддерживает n-relevance-context-position-strongest и c-0101/c-0110 слабой эмпирикой; важно, что меряется позиция ссылки, а не упоминание бизнеса.

## Extracted artefacts

- Notes: [n-gbp-signals-modest-in-llm-local], [n-near-me-relevance-over-authority], [n-relevance-context-position-strongest]
- Claims: [c-0101], [c-0110]
- Contradictions: —

_Качество 5, 2 заметки — по §3._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| — | — | — | нет значимых исходящих ссылок |

## Verbatim quotes (если критично)

> "LLMs treat GBP as supporting context rather than a primary ranking engine" — раздел GBP
