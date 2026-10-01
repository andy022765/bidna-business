# The Language of the Question Selects the Market: Query Language and Exit IP as Separable Factors in Commercial Recommendations from a Generative Search Interface — conspect

**Source**: https://arxiv.org/html/2608.30052
**Source ID**: src-20260924-zatuchin-query-language-market
**Author(s)**: Dmitrij Żatuchin
**Published**: 2026-08-30
**Quality**: 7/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Контролируемая проба на ChatGPT (браузер без логина и API, август 2026): 234 запуска, четыре страны выхода, шесть языков, по шесть повторов. Язык вопроса, а не место, решает, появятся ли местные поставщики вообще; IP решает, какой страны поставщиков назовут. Русский из Эстонии — средняя ступень. Первое место нестабильно одинаково в браузере и API.

## Thesis

Язык вопроса выбирает рынок, чьих поставщиков называет ИИ, а IP выбирает страну.

## Key points

- На языке страны глобальный бренд первым 1 из 24; на английском местные в Эстонии и Турции 0 из 6.
- Турецкий вопрос из Берлина — немецкие поставщики на турецком; русский из Таллина — эстонские поставщики.
- Русский из Эстонии: эстонский поставщик 4 из 6, глобальный 6 из 6; эстонский — местный 6 из 6; английский — 0.
- Контрольная категория без эффекта языка; автор связывает это с национальным регулированием категории.
- Первое место менялось на 4 из 6 вопросов одинаково в браузере, API с поиском и без.

## Methods / evidence

Малый факторный эксперимент (язык × страна выхода), пустое состояние аккаунта, кодирование ответов одним инструментом, отрицательный контроль.

## Relevance to project

Прямо касается нашей аудитории: русскоязычный покупатель в США. Опора c-0106 и contr-010. Выборка мала — выводы M/L; закрывается нашим двуязычным замером.

## Extracted artefacts

- Notes: [n-english-audit-understates-local-brands], [n-query-language-gates-local-suppliers], [n-russian-query-middle-tier], [n-same-ai-list-rarely-repeats]
- Claims: [c-0100], [c-0106]
- Contradictions: [contr-010]

_Отклонение от §3: 2 заметки; эксперимент малый и об одном механизме._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2606.23165 | Language Blind Spot | 5/5 | fetched: src-20260924-zatuchin-language-blind-spot |

## Verbatim quotes (если критично)

> "query language, and not location, decides whether local suppliers appear at all" — Abstract
