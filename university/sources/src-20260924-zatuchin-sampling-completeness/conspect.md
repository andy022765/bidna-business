# Sampling Completeness in Generative Search: Brand and Cited-Domain Accumulation under Repeated Queries — conspect

**Source**: https://arxiv.org/html/2609.05059
**Source ID**: src-20260924-zatuchin-sampling-completeness
**Author(s)**: Dmitrij Żatuchin
**Published**: 2026-09-04
**Quality**: 9/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Короткая работа о том, сколько повторов нужно, чтобы увидеть весь набор компаний, которые ИИ называет на покупательский вопрос. 50 вопросов × 6 движков × 15 запусков, открытое извлечение 1 470 организаций. Без веб-поиска движки продолжают называть новые имена и на 15-м запуске; с поиском список короткий (медиана 8) и закрывается. Один запуск показывает 62–77% набора из пяти. Один движок не показывает рынок.

## Thesis

Полнота выборки повторных ответов определяется включённым поиском: с ним список закрывается быстро, без него — нет.

## Key points

- Пять движков без поиска: новые организации на 15-м запуске в 86–92% ячеек; репертуар 15–31.
- Perplexity sonar с поиском: медиана 8 организаций, 100% оценки Chao2 к 15-му запуску.
- Один запуск видит 62–72% (без поиска) и 77% (с поиском) набора пяти запусков.
- Медианный вопрос: 38 организаций по шести движкам, 15 из них — в одном движке; лучший движок видит 83% объединения.
- Процитированные домены продолжают накапливаться на всех горизонтах.

## Methods / evidence

Кривые накопления видов (разрежение, оценка Chao2) на 4 500 свежих ответах (сентябрь 2026) плюс повторный анализ открытого набора 3 750 ответов; классификатор-LLM с ручной выборочной проверкой; данные и код открыты.

## Relevance to project

Опора c-0107 и c-0115: при трёх повторах мы видим лишь часть набора; для режима без поиска «хотя бы одно упоминание» — слабый сигнал. Поддерживает c-0105.

## Extracted artefacts

- Notes: [n-engines-cite-different-sources], [n-grounded-brand-lists-close-fast], [n-seven-runs-per-prompt-brand-rate], [n-single-engine-not-the-market]
- Claims: [c-0100], [c-0102], [c-0105], [c-0107], [c-0115]
- Contradictions: —

_Отклонение от §3: 2 собственные заметки; работа короткая (5 страниц), две идеи._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2609.04047 | The Dice Roll Method | 4/5 | queued |
| https://arxiv.org/abs/2607.13304 | variance components of non-determinism | 4/5 | queued |
| https://github.com/Rankfor/rankfor-open/tree/main/research/recommendation-saturation | data and code | 3/5 | queued |
| https://arxiv.org/abs/2507.05301 | News source citing patterns in AI search | 3/5 | queued |

## Verbatim quotes (если критично)

> "grounded brand lists are cheap to finish; ungrounded brand lists and citation maps are open-ended at practical budgets" — §5
