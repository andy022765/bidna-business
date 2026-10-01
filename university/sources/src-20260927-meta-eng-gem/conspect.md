# Meta's Generative Ads Model (GEM): The Central Brain Accelerating Ads Recommendation AI Innovation — conspect

**Source**: https://engineering.fb.com/2025/11/10/ml-applications/metas-generative-ads-model-gem-the-central-brain-accelerating-ads-recommendation-ai-innovation/
**Source ID**: src-20260927-meta-eng-gem
**Author(s)**: Engineering at Meta, команда Ads Recommendation
**Published**: 2025-11-10
**Quality**: 6/10
**Relevance**: 3/5
**Fetched**: 2026-09-27

## TL;DR

Инженерный блог Meta (10.11.2025, изменено 02.12.2025) о GEM — фундаментальной модели рекомендаций рекламы, обученной «в масштабе LLM». Она учится на рекламных и органических взаимодействиях всех поверхностей, потому что клики и конверсии редки, и передаёт знания сотням моделей ранжирования. Признаки — длинные последовательности действий человека и атрибуты пользователя и объявления, включая «представление креатива». Самоотчёт: +5% конверсий в Instagram и +3% в ленте Facebook (Q2 2025).

## Thesis

Одна большая модель, обученная на всём поведении, повышает точность прогнозов всех моделей ранжирования рекламы.

## Key points

- Данные: рекламные и органические взаимодействия; сигналы кликов и конверсий «очень разрежены».
- Признаки: последовательности (тысячи событий истории) и непоследовательные (возраст, место, формат, представление креатива).
- Перенос знаний между поверхностями (Instagram → Facebook) и в сотни вертикальных моделей через дистилляцию.
- Архитектура в 4 раза эффективнее прежних моделей; обучение на тысячах GPU.
- Самоотчёт по приросту конверсий; в Q3 2025 — удвоение отдачи от данных и вычислений.

## Methods / evidence

Инженерное описание; приросты без методики (bias.protocol_sponsored).

## Relevance to project

Для вопроса брифа 5 и правила «креатив — это тоже таргетинг» (инструкция §6). Первоисточник подтверждает, что представление креатива — входной признак ранжирования. Утверждения «особенно у нового рекламодателя» в нём нет (c-0715). Прогноз для маленького рекламодателя строится на поведении всей аудитории: единицы звонков — не «пустота», но и не выход из обучения.

## Extracted artefacts

- Notes: [n-meta-gem-learns-organic-and-ads-sparse-signals], [n-meta-gem-creative-representation-is-feature]
- Claims: [c-0715]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://engineering.fb.com/2026/08/03/ml-applications/training-gem-at-llm-scale-meta-ads-recommendation-foundation-model/ | GEM training at LLM scale (2026) | 1/5 | queued (to-follow) |
| https://engineering.fb.com/2026/07/15/ai-research/exploring-hierarchical-interest-representation-for-meta-ads-deep-funnel-optimization/ | hierarchical interest representation, deep funnel (2026) | 3/5 | queued (to-follow; просмотрена — исследование, статус внедрения не ясен) |

## Verbatim quotes (если критично)

> "meaningful signals — such as clicks and conversions — are very sparse."
