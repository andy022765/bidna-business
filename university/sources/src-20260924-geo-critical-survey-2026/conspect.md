# Optimizing Visibility in Generative Engines: A Critical Survey of Generative Engine Optimization (2023–2026) — conspect

**Source**: https://arxiv.org/html/2607.14035
**Source ID**: src-20260924-geo-critical-survey-2026
**Author(s)**: Olivier Martinez
**Published**: 2026-07-15
**Quality**: 8/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Критический обзор 45 работ по GEO за ноябрь 2023 — июль 2026. Автор разделяет конвейер генеративного поиска на стадии (включение поиска, обход, отбор, контекст, цитирование, заметность, усвоение, трафик) и оценивает, для каких из них есть доказательства. Вывод: доказано, что уже найденный документ можно переписать и изменить его использование; не доказано, что какая-либо техника устойчиво повышает органическую находимость в нескольких движках, и почти не доказана связь с кликами и деньгами. Для нас это главный источник того, что можно и нельзя честно обещать, и готовый протокол замера.

## Thesis

GEO — многостадийный стохастический процесс, и доказательства сильны только для эффектов после того, как документ уже найден.

## Key points

- Иерархия метрик: включение → найденность → упоминание → цитирование → заметность → покрытие → усвоение → верность → поведение; у каждой свой знаменатель.
- Стабильность: суточный Jaccard источников 0,34–0,42 (Schulte); у AIO пересечение страниц за два месяца 18% против 45% у органики (Kirsten, ACL 2026); повторы при температуре 0 меняют 9–28% решений.
- Ответы без поиска нельзя выбрасывать: 57,8% запусков ChatGPT без поиска в одной конфигурации.
- Самые надёжные рычаги: соответствие вопросу и позиция в контексте (факторный эксперимент на 252 000 запусков).
- C-SEO Bench: значимо положительны 3 из 54 сочетаний; SAGEO Arena: переписывание тела страницы снизило попадание в топ-20 на ~9%.
- Поверхности не делят источники: Jaccard 0,11–0,18 между Google, AIO, Gemini; 53% доменов AIO вне органического топ-10.
- Узнавание ≠ открытие: 99,4% против 3,32% (Sharma).
- Трафик и деньги: единственный квазиэксперимент (Glasp) — 1,82x с плацебо p > порога; «GEO +40%» отвергнуто как общее утверждение.
- Протокол: заранее определить оцениваемую величину, 3–5 перефразов, повторы в разных окнах, контроль/плацебо, кластеризация, человеческая проверка судьи-LLM.

## Methods / evidence

Критический обзорный метод (не систематический мета-анализ): отбор 45 работ, кодирование, иерархия доказательств, таблица уверенности по основным утверждениям.

## Relevance to project

Прямая опора для c-0103 (нельзя обещать результат), c-0105 (движки различаются), c-0107 (протокол замера), c-0109 (контроль в кейсах). Подтверждает решения нашего плана «не меряем каждую неделю» и «место в списке не показываем». Показывает, что наши 3 повтора ниже рекомендованного.

## Extracted artefacts

- Notes: [n-engines-cite-different-sources], [n-generic-geo-recipes-generalize-poorly], [n-geo-measurement-protocol-minimum], [n-geo-plus40-conditional-on-retrieval], [n-geo-roi-evidence-very-weak], [n-keyword-stuffing-fails-generative], [n-mention-share-valid-metric], [n-no-proven-durable-organic-geo-effect], [n-no-search-answers-stay-in-denominator], [n-raw-aeo-multiples-overstate], [n-recognition-not-recommendation], [n-relevance-context-position-strongest]
- Claims: [c-0100], [c-0103], [c-0105], [c-0107], [c-0109]
- Contradictions: [contr-014]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2604.07585 | Schulte et al. 2026 | 5/5 | fetched: src-20260924-schulte-dont-measure-once |
| https://arxiv.org/abs/2602.12187 | SAGEO Arena | 4/5 | queued |
| https://arxiv.org/abs/2605.25517 | Vishwakarma et al., What gets cited (SIGIR 2026) | 4/5 | queued |
| https://doi.org/10.18653/v1/2026.findings-acl.52 | Kirsten et al., Characterizing web search in the age of generative AI | 4/5 | queued |
| https://proceedings.neurips.cc/paper_files/paper/2025/hash/27aa3aeff0f8460a7b43d30fa6c5c | C-SEO Bench | 3/5 | queued |
| https://arxiv.org/abs/2601.00912 | Sharma 2026, Discovery Gap | 4/5 | fetched: src-20260924-discovery-gap-sharma |
| https://arxiv.org/abs/2606.04362 | Watanabe & Nakayashiki 2026 | 4/5 | fetched: src-20260924-watanabe-aeo-natural-experiment |

## Verbatim quotes (если критично)

> "no reviewed technique shows a stable, longitudinal, cross-platform causal effect on organic discoverability or downstream behavior" — Abstract
> "Rejected as a general claim: 'GEO increases visibility by 40%.'" — Table 5
