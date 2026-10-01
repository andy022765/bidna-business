# Invisible to the Machine: Auditing AI Restaurant, Café, and Bar Recommendation Against a Complete Market Census — conspect

**Source**: https://arxiv.org/html/2608.07069
**Source ID**: src-20260924-bali-venue-census-audit
**Author(s)**: Vladimir Pitenin
**Published**: 2026-08-07
**Quality**: 9/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Первый аудит ИИ-рекомендаций против полной переписи рынка: 4 776 кафе, ресторанов и баров в Чангу и Убуде (Бали), 2 208 ответов с поиском от ChatGPT, Claude, Gemini, Perplexity на 96 вопросов от лица разных посетителей, предрегистрированный протокол. 85,6% заведений не были названы ни разу. Вход в ответ связан с документированностью (свой сайт, объём отзывов, цена, упоминания), а рейтинг — только с первым местом. Главный сбой — рекомендации закрытых мест. Для нас это лучший найденный аналог «местного малого бизнеса в ответах ИИ».

## Thesis

Видимость местного заведения в ИИ имеет два порога: документированность решает вход в ответ, рейтинг — порядок внутри него.

## Key points

- 85,6% рынка никогда не рекомендованы, 72,6% — среди заведений с 50+ оценками; это нижняя граница.
- Вход (GLM, поправка Бенджамини–Хохберга): свой сайт OR 1,92; объём отзывов 1,64; цена 1,54; упоминания в сети 1,44; свежесть отзывов 1,41 (почти значимо); рейтинг 0,89 (незначимо); Foursquare 0,84 (незначимо).
- Первое место: рейтинг OR 1,17, объём отзывов 1,30, число обзорных доменов 1,23; упоминания в сети на этом пороге незначимы.
- Стабильность: Jaccard повторов Gemini 0,45, Perplexity 0,40, OpenAI 0,29, Claude 0,22; перефраз ниже; через две недели как в тот же день (0,375).
- Согласие движков в топ-20: Jaccard 0,33–0,54; в топ-20 всех четырёх только 8 заведений.
- Источники: 26 993 ссылки, 986 доменов; самый цитируемый — сайт одного заведения (5,3%), TripAdvisor 2,3%, Reddit и YouTube по 1,3%.
- Сбои: закрытые заведения рекомендованы 93 раза; явная выдумка — 0,08% упоминаний; 38% несовпадений — варианты имени.
- Ограничения: наблюдательный дизайн, один регион, английский, API, а не приложения; у Claude ограничен бюджет поиска.

## Methods / evidence

Полная перепись рынка из Google-листингов; предрегистрированные гипотезы; биномиальная GLM с кластеризацией по заведению, условный логит для первого места; проверка извлечения и сопоставления с измеренной ошибкой; повтор через две недели; открытые протокол, код и производные данные.

## Relevance to project

Главная опора c-0101 (что связано с входом), c-0102 (ноль — норма), c-0111 (устаревшие факты). Уточняет наш перечень работ: объём отзывов и цена текстом — в приоритете; рейтинг — не рычаг входа. Даёт внешнюю проверку нашей цифры шума (у нас Claude 13% совпадения имён за 6 дней, у них Claude 0,22 — Claude самый нестабильный в обоих замерах).

## Extracted artefacts

- Notes: [n-ai-recommends-closed-businesses], [n-engines-cite-different-sources], [n-foursquare-presence-no-effect-bali], [n-local-answer-churn-is-sampling-noise], [n-local-entry-driven-by-documentation], [n-local-queries-fragmented-across-engines], [n-most-local-venues-never-recommended], [n-own-website-can-outcite-platforms], [n-single-engine-not-the-market], [n-star-rating-orders-not-admits]
- Claims: [c-0100], [c-0101], [c-0102], [c-0105], [c-0111], [c-0112], [c-0114], [c-0115], [c-0116]
- Contradictions: [contr-012], [contr-013], [contr-014]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://norly.co | Norly Research | 1/5 | ignored: сайт спонсора, продажа |
| https://arxiv.org/abs/2606.23057 | Żatuchin, category ownership | 3/5 | queued |
| (Baig et al., 2026) | конджойнт по отелям | 3/5 | queued: ссылка не извлечена, искать по названию |
| (Iannelli and Ai, 2026) | рекомендация ассистента +4,3 п.п. брендовых поисков | 4/5 | queued: ссылка не извлечена |

## Verbatim quotes (если критично)

> "be documented before being excellent" — §6.6
> "the risk is not that AI invents restaurants; it is that AI remembers restaurants that no longer exist" — §5.8
