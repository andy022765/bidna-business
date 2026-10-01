# Gemini API Additional Terms of Service (effective 2026-03-23, page updated 2026-04-28) — conspect

**Source**: https://ai.google.dev/gemini-api/terms
**Source ID**: src-20260924-gemini-api-terms
**Author(s)**: Google
**Published**: 2026-03-23
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Перепроверка нашего вывода 14.09 подтверждена. Для Grounding with Google Search: нельзя кэшировать, анализировать, обучаться, собирать ссылки, отслеживать и хранить результаты, кроме узких исключений (показ пользователю, история чата, до 2 лет только для оценки отображения в своём приложении). Показывать результат можно только тому пользователю, который задал вопрос. Для Grounding with Google Maps — аналогичные ограничения. Значит, Gemini с поиском для замера видимости использовать нельзя.

## Thesis

Условия Gemini API запрещают использовать ответы с поиском Google для анализа и мониторинга, то есть для замера видимости.

## Key points

- Grounding используется только в своём приложении и показывается только спросившему пользователю.
- Запрет: cache, frame, syndicate, resell, analyze, train on, learn from; запрет автоматического сбора ссылок и индексации.
- Запрет copy/store/tracking; исключения узкие (до 2 лет для оценки отображения в своём приложении, история чата пользователя).
- Google хранит промпты и ответы с поиском 30 дней.
- Grounding with Google Maps: показ только спросившему, без изменений и вкраплений.

## Methods / evidence

Текст условий.

## Relevance to project

Подтверждает вывод Смотрителя 14.09 (память project-agent-smotritel): Gemini с поиском нельзя. Для Видимости это значит, что Gemini мы честно не меряем через API, а AI Overviews и AI Mode — только через DataForSEO (серая зона, отдельный вопрос) или руками.

## Extracted artefacts

- Notes: [n-gemini-grounding-forbids-analysis-tracking]
- Claims: [c-0613]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://cloud.google.com/terms/service-terms | Google Cloud service terms | 2/5 | ignored: не про Gemini API |

## Verbatim quotes (если критично)

> "cache, frame, syndicate, resell, analyze, train on, or otherwise learn from Grounded Results" — Use Restrictions
