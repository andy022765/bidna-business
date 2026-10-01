# GEO: Generative Engine Optimization — conspect

**Source**: https://arxiv.org/html/2311.09735
**Source ID**: src-20260924-geo-aggarwal-kdd2024
**Author(s)**: Pranjal Aggarwal, Vishvak Murahari, Tanmay Rajpurohit, Ashwin Kalyan, Karthik Narasimhan, Ameet Deshpande
**Published**: 2024-06-28
**Quality**: 9/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Статья, которая ввела термин GEO. Авторы формализовали «генеративный движок» (поиск + LLM, ответ со ссылками), собрали GEO-bench на 10 000 вопросов из 25 областей и проверили девять способов переписать текст источника. Лучшие приёмы (добавить ссылки на источники, цитаты, статистику) дали относительный прирост 30–40% по доле ответа, набивка ключевыми словами не помогла. Важно для нас как первоисточник цифры «+40%», которую рынок GEO пересказывает как обещание.

## Thesis

Контент можно переписать так, чтобы генеративный движок чаще и заметнее использовал его в ответе, и это отличается от классического SEO.

## Key points

- Метрики видимости: Position-Adjusted Word Count (доля слов ответа с учётом позиции ссылки) и Subjective Impression (оценка моделью).
- Движок в эксперименте получает 5 заранее найденных источников; меряется доля ответа, а не то, найдёт ли поиск страницу.
- Cite Sources / Quotation Addition / Statistics Addition: +30–40% по PAWC и +15–30% по Subjective Impression в среднем.
- Для источника на 5-м месте прирост 98–115%, для источника на 1-м месте −20…−30%: метод помогает слабым и может вредить сильным.
- «Авторитетный тон» и набивка ключевыми словами почти не работают; на Perplexity набивка −10% от базы.
- Эффективность приёмов зависит от темы (статистика — право и госуправление, мнения; цитаты — история, люди и общество).
- На живом Perplexity.ai: цитаты +22% по PAWC, статистика до +37% по субъективной метрике.
- Ограничения авторов: движки меняются, влияние на ранжирование в поиске не оценивали.

## Methods / evidence

Контролируемый эксперимент на собственном движке (GPT-3.5 + поиск) и проверка на Perplexity; относительные изменения метрик против базовой линии без оптимизации; открытые код и данные.

## Relevance to project

Даёт первоисточник для разговора о «+40%»: это условный эффект внутри ответа, а не попадание в него (n-geo-plus40-conditional-on-retrieval). Поддерживает часть нашей практики: факты и цифры на странице, без набивки ключей. Не даёт доказательств для местного бизнеса и для обещаний результата (c-0103).

## Extracted artefacts

- Notes: [n-evidence-rich-text-helps-lower-ranked], [n-geo-plus40-conditional-on-retrieval], [n-keyword-stuffing-fails-generative], [n-no-proven-durable-organic-geo-effect]
- Claims: [c-0103]
- Contradictions: [contr-014]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://generative-engines.com/GEO/ | code and data | 2/5 | ignored: код бенчмарка, для продажи не нужен |
| https://arxiv.org/abs/2607.14035 | (внешний) критический обзор | 5/5 | fetched: src-20260924-geo-critical-survey-2026 |

## Verbatim quotes (если критично)

> "GEO can boost visibility by up to 40% in generative engine responses" — Abstract
