# NEW Research: AIs are highly inconsistent when recommending brands or products; marketers should take care when tracking AI visibility — conspect

**Source**: https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/
**Source ID**: src-20260924-sparktoro-ai-inconsistency
**Author(s)**: Rand Fishkin, Patrick O
**Published**: 2026-01-27
**Quality**: 8/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Исследование SparkToro и Gumshoe: 600 добровольцев вручную прогнали 12 вопросов в ChatGPT, Claude и Google AI 2 961 раз. Списки брендов почти никогда не повторяются, порядок — ещё реже, но доля появлений бренда по многим запускам осмысленна. Живые формулировки вопросов очень разные, но набор брендов определяется намерением. Среди примеров — дилеры Volvo в Лос-Анджелесе, то есть местный формат.

## Thesis

Место бренда в ИИ-списке случайно, а доля появлений по многим запускам — пригодная метрика.

## Key points

- Одинаковый список — реже 1 из 100 запусков; одинаковый порядок — около 1 из 1000; длина списка от 2–3 до 10+.
- City of Hope: в 69 из 71 ответа ChatGPT, но первой только в 25.
- Сходство живых формулировок одного запроса 0,081; при этом Bose/Sony/Sennheiser/Apple в 55–77% из 994 ответов.
- ИИ рекомендовал неактивных инфлюенсеров и закрытые офисы.
- Совет автора: чтобы узнать набор, спрашивать 60–100 раз.

## Methods / evidence

Краудсорсинговый сбор ответов из приложений (не API), нормализация списков, метрики по методике CMU (попарная корреляция, разница рангов, смысловое сходство формулировок).

## Relevance to project

Опора c-0100 и c-0107; подтверждает наш внутренний тезис «видимость 17% одной цифрой — гороскоп». Замер в приложениях дополняет API-исследования.

## Extracted artefacts

- Notes: [n-ai-recommends-closed-businesses], [n-human-prompts-vary-intent-stable], [n-mention-share-valid-metric], [n-same-ai-list-rarely-repeats]
- Claims: [c-0100], [c-0107], [c-0111], [c-0115]
- Contradictions: —

_Отклонение от §3: 3 заметки + участие в c-0111; остальное — мнения автора._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://gumshoe.ai | Gumshoe | 1/5 | ignored: сайт вендора |
| (Carnegie Mellon, Estimating LLM Consistency) | методика | 3/5 | queued: ссылка не извлечена |

## Verbatim quotes (если критично)

> "If you don't like an answer, or your brand doesn't show up where you want it to, just ask a few more times." — основной раздел
