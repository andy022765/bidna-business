# OpenAI API pricing (docs, as of 2026-09-24) — conspect

**Source**: https://platform.openai.com/docs/pricing
**Source ID**: src-20260924-openai-api-pricing
**Author(s)**: OpenAI
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Цены OpenAI на 24.09.2026: флагман gpt-6-sol $2/$10, gpt-6-luna $0.10/$0.50, chat-latest (модель ChatGPT) $5/$30 за миллион токенов. Голос: gpt-realtime-2.1 — аудио $32 вход / $64 выход (кэш $0.40), текст $4/$24; gpt-realtime-2.1-mini — аудио $10/$20; gpt-live-1 — $0.05 за минуту сессии плюс модель. Веб-поиск — $10 за 1 000 вызовов плюс токены найденного контента по цене модели.

## Thesis

Голосовой агент на OpenAI Realtime сопоставим по цене минуты с ElevenLabs, а вызов ChatGPT с поиском для замера стоит несколько центов.

## Key points

- chat-latest $5 / $0.50 cached / $30 за 1M.
- gpt-realtime-2.1: audio $32/$64, cached $0.40; text $4/$24.
- gpt-realtime-2.1-mini: audio $10/$20.
- gpt-live-1: $0.05/мин (оплата посекундно), модель и инструменты отдельно.
- Web search (all models): $10.00 / 1k calls + search content tokens по цене модели.
- Транскрипция: gpt-transcribe $0.0045/мин, realtime-whisper $0.017/мин.

## Methods / evidence

Прайс-лист. Поминутная цена Realtime в токенах не указана — пересчёт наш и помечен как оценка.

## Relevance to project

Для замера Видимости через chat-latest с поиском: $0.01 за поиск + ~10 тыс. токенов контента ($0.05) + ответ ~800 токенов ($0.024) ≈ $0.08 за вызов (оценка; память 15.09 давала ~$0.027). Как альтернатива ElevenLabs: gpt-realtime-2.1 по нашей грубой оценке $0.05–0.10/мин, но это не замер.

## Extracted artefacts

- Notes: [n-openai-realtime-and-search-prices]
- Claims: [c-0620], [c-0621]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| — | — | — | — |

## Verbatim quotes (если критично)

> Web search: "$10.00 / 1k calls"
