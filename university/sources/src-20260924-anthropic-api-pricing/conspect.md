# Anthropic Claude API pricing (docs, as of 2026-09-24) — conspect

**Source**: https://platform.claude.com/docs/en/about-claude/pricing
**Source ID**: src-20260924-anthropic-api-pricing
**Author(s)**: Anthropic
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Цены за миллион токенов (вход/выход): Haiku 4.5 $1/$5, Sonnet 5 $2/$10 (вводная цена стала постоянной, повышения до $3/$15 не будет), Opus 5 $5/$25, Opus 5.5 $4/$20. Чтение кэша — 0.1× входа (Opus 5.5 — 0.05×), запись кэша 1.25× (5 мин) или 2× (1 час). Batch — минус 50%. Веб-поиск — $10 за 1 000 поисков плюс токены результатов.

## Thesis

Claude Sonnet 5 за $2/$10 и поиск за $10/1 000 делают замер и переписку Доводчика дешёвыми относительно цены услуг.

## Key points

- Haiku 4.5 $1/$5; Sonnet 5 $2/$10; Opus 5 $5/$25; Opus 5.5 $4/$20.
- Сноска: Sonnet 5 $2/$10 — теперь стандартная цена, запланированное на 01.09.2026 повышение отменено.
- Cache read 0.1× (Opus 5.5 0.05×), cache write 1.25× / 2×.
- Batch API −50%.
- Web search $10 / 1 000 поисков + токены результатов; web fetch без доплаты.

## Methods / evidence

Прайс-лист.

## Relevance to project

Подтверждает таблицу в памяти reference-api-grabli (Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5). Для замера Видимости вызов Claude с поиском ≈ $0.06–0.08 (совпадает с замером $0.078).

## Extracted artefacts

- Notes: [n-claude-api-prices-sept-2026]
- Claims: [c-0620]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| — | — | — | — |

## Verbatim quotes (если критично)

> Web search: "$10 per 1,000 searches"
