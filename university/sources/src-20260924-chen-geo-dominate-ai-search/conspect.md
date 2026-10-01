# Generative Engine Optimization: How to Dominate AI Search — conspect

**Source**: https://arxiv.org/html/2509.08919
**Source ID**: src-20260924-chen-geo-dominate-ai-search
**Author(s)**: Mahe Chen, Xiaoxuan Wang, Kaiwen Chen, Nick Koudas
**Published**: 2025-09-10
**Quality**: 8/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Большое сравнение ИИ-поиска (ChatGPT, Claude, Perplexity, Gemini через API с поиском) и Google на рейтинговых вопросах в нескольких отраслях, языках и перефразах (август 2025). Главное: ИИ-поиск систематически опирается на «заработанные» сторонние источники, а не на сайты брендов; движки сильно различаются доменами, свежестью и устойчивостью между языками; при смене языка GPT и Perplexity уходят в сайты этого языка. Есть отдельный эксперимент по местным услугам: движки почти не пересекаются по доменам.

## Thesis

ИИ-поиск выбирает источники иначе, чем Google: больше сторонних «заработанных» площадок, меньше сайтов брендов, с большими различиями между движками и языками.

## Key points

- Нишевые бренды: ChatGPT 95,1% earned / 4,9% brand / 0% social; Claude 86,3/10,6/3,2; Perplexity 73,4/9,1/17,5; Gemini 66,4/21,2/12,7.
- Местные запросы («best home cleaning near me», «top dentists in [city]»): пересечение доменов ИИ и Google 20,6% (уборка), 17,1% (кровля), 15,4% (налоги), 11,9% (стоматологи), 2,5% (автосервис), 0,1% (IT).
- Местные услуги в Торонто: попарный Jaccard доменов между движками ~0,15–0,25; уникальные домены 35–68%; общие для всех — только крупные агрегаторы.
- Языки: у GPT пересечение доменов EN↔другой язык почти нулевое; Claude стабилен и цитирует в основном английские сайты; GPT и Perplexity сильнее уходят в сайты языка вопроса.
- Пересечение брендов между языками выше, чем доменов, но ниже в длинном хвосте категорий.
- Перефразы меняют результат меньше, чем смена языка.
- Рекомендации авторов: машинно читаемый текст с обоснованиями, работа с earned media, стратегия по движкам и языкам, преодоление «перекоса к большим брендам».

## Methods / evidence

Серия контролируемых опросов через API (sonar-pro, claude-3.5-sonnet + web_search, gemini-2.5-flash с Google grounding, gpt-4o-search-preview) и Google Custom Search; извлечение доменов и брендов, классификация доменов моделью GPT-4o; Jaccard-пересечения.

## Relevance to project

Опора для c-0105 (движки расходятся), c-0106 (язык меняет источники), c-0112 (сторонние источники). Создаёт напряжение с нашим тезисом «свой сайт — главный рычаг» (contr-013). Русский язык не проверялся.

## Extracted artefacts

- Notes: [n-ai-local-overlap-with-google-low], [n-ai-search-favors-earned-media], [n-engines-cite-different-sources], [n-local-queries-fragmented-across-engines], [n-query-language-switches-source-ecosystem], [n-single-engine-not-the-market]
- Claims: [c-0105], [c-0106], [c-0112]
- Contradictions: [contr-010], [contr-013]

_Отклонение от §3: при качестве 8 выделено 4 заметки, а не 5+: остальное содержание (автомобили, электроника, кола, банки) не касается местных сервисных бизнесов, дробить его в заметки не стали._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2311.09735 | Aggarwal et al. 2024 | 5/5 | fetched: src-20260924-geo-aggarwal-kdd2024 |
| https://www.pewresearch.org/ | Pew field study AI summaries | 2/5 | ignored: поведение пользователей, вне листа механики |

## Verbatim quotes (если критично)

> "AI Search exhibit a systematic and overwhelming bias towards Earned media (third-party, authoritative sources) over Brand-owned and Social content" — Abstract
