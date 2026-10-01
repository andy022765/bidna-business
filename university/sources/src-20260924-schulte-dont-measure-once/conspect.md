# Don't Measure Once: Measuring Visibility in AI Search (GEO) — conspect

**Source**: https://arxiv.org/html/2604.07585
**Source ID**: src-20260924-schulte-dont-measure-once
**Author(s)**: Julius Schulte, Malte Bleeker, Philipp Kaufmann
**Published**: 2026-04-08
**Quality**: 9/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Работа Университета Санкт-Галлена о том, почему видимость в ИИ нельзя мерить одним запросом. 45–46 дней ежедневных замеров на ChatGPT, Gemini, Google AI Mode и Perplexity по 32 немецкоязычным вопросам и отдельная серия до 10 повторов в сутки. Около 65% источников меняются от дня к дню, и почти столько же — между повторами в тот же день, то есть это случайность, а не дрейф. Авторы рекомендуют не меньше 7 запусков на вопрос и считать видимость распределением.

## Thesis

Видимость в ИИ-поиске — распределение, и мерить её нужно повторными запусками по многим вопросам.

## Key points

- Межсуточный Jaccard источников 0,34–0,42, RBO 0,21–0,26; брендов 0,45–0,59.
- Повторы в пределах 24 часов: источники 0,32–0,43, бренды 0,33–0,48 — та же нестабильность.
- По движкам (сутки): источники ChatGPT 0,23, Perplexity 0,28, Gemini 0,51, AI Mode 0,32.
- Концентрация цитирований высока: Gini 0,715 в среднем, AI Mode 0,782, Perplexity 0,671.
- 57,8% запусков ChatGPT без веб-поиска (чаще на определениях).
- Бутстрэп: SE доли упоминаний бренда < 0,10 при ~7 запусках, < 0,08 при ~11; для источников — больше.
- Сходство по отдельным вопросам колеблется от <0,2 до >0,8 — нужен широкий набор вопросов.

## Methods / evidence

Ежедневный сбор 24.01–20.03.2026 со швейцарских серверов; Jaccard и RBO; словарь брендов; бутстрэп сходимости. Ограничения: одна страна и язык, поиск брендов подстрокой, артефакт CDN в данных ChatGPT.

## Relevance to project

Опора c-0100, c-0107, c-0114. Подтверждает наше внутреннее решение не мерить каждую неделю. Показывает, что 3 прогона на движок — ниже рекомендованного минимума.

## Extracted artefacts

- Notes: [n-ai-citations-highly-concentrated], [n-ai-sources-turn-over-65pct-daily], [n-geo-measurement-protocol-minimum], [n-local-answer-churn-is-sampling-noise], [n-mention-share-valid-metric], [n-no-search-answers-stay-in-denominator], [n-same-ai-list-rarely-repeats], [n-seven-runs-per-prompt-brand-rate]
- Claims: [c-0100], [c-0107], [c-0112], [c-0114], [c-0115]
- Contradictions: —

_Отклонение от §3: 3 заметки + участие в 3 других; источник сфокусирован на одном вопросе (стабильность), искусственно не дробили._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://arxiv.org/abs/2311.09735 | Aggarwal et al. | 5/5 | fetched |
| (Rejón-Guardia et al., 2025) | сторонние инструменты видимости | 2/5 | ignored: обзор инструментов, вне приоритета |

## Verbatim quotes (если критично)

> "single observations of AI visibility are misleading and risk over- or underestimating true brand presence" — §7
