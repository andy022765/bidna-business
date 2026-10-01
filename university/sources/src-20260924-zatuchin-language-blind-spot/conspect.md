# The Language Blind Spot: How Query Language and Brand Recognition Tier Shape AI-Constructed Brand Reputation Across Twelve European Languages — conspect

**Source**: https://arxiv.org/html/2606.23165
**Source ID**: src-20260924-zatuchin-language-blind-spot
**Author(s)**: Dmitrij Żatuchin
**Published**: 2026-06-22
**Quality**: 8/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

35 640 ответов трёх движков с поиском о 66 брендах из 11 европейских рынков на 12 языках. Репутация, которую строит ИИ, зависит от языка, но главный эффект — на то, кого рекомендуют: вопрос на родном языке бренда поднимает долю рекомендаций местных лидеров на 0,80, а глобальных — на 0,15. Англоязычный мониторинг систематически занижает видимость местных брендов.

## Thesis

Мониторинг видимости только на английском даёт слепое пятно для местных брендов.

## Key points

- Среднее косинусное сходство ответов между языками 0,825; внутри семьи языков выше.
- Сдвиг доли рекомендаций при переходе EN → родной язык: +0,80 у местных лидеров, +0,15 у транснациональных.
- Тон меняется меньше, чем состав рекомендаций; английский среди самых критичных по тону.
- Стабильность больше зависит от модели, чем от языка.

## Methods / evidence

Многоязычные эмбеддинги (BGE-M3), статистические тесты, кластеризация, повторная проверка на подвыборке 20 брендов × 5 итераций. Прочитаны абстракт и введение.

## Relevance to project

Опора c-0106: для «своих» (местных, сообщественных) бизнесов язык вопроса критичен. Перенос на русский в США — экстраполяция.

## Extracted artefacts

- Notes: [n-english-audit-understates-local-brands]
- Claims: [c-0106]
- Contradictions: [contr-010]

_Отклонение от §3: 1 собственная заметка; прочитаны только абстракт и введение, в остальном источник о тоне бренда, что вне нашего листа._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2606.25787 | How LLMs source brand reputation across languages and markets | 4/5 | queued |

## Verbatim quotes (если критично)

> "An English-only audit therefore understates a local champion's AI visibility while representing a multinational's fairly." — Abstract
