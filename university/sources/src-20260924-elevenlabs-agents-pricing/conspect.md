# ElevenLabs ElevenAgents pricing (as of 2026-09-24) + plan page — conspect

**Source**: https://elevenlabs.io/pricing/agents
**Source ID**: src-20260924-elevenlabs-agents-pricing
**Author(s)**: ElevenLabs
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Новая модель цен ElevenAgents: агенты считаются в минутах звонка, а не в общем пуле кредитов. Включённые минуты и одновременные звонки: Free 15/4, Starter $6 — 75/6, Creator $22 — 275/10, Pro $99 — 1 238/20, Scale $299 — 3 738/30, Business $990 — 12 375/40. Дополнительная минута $0.08, при превышении одновременности (burst, до 3×) — $0.16. LLM оплачивается сверху по выбранной модели, текстовое сообщение агента — $0.003. Телефонию ElevenLabs не берёт, её выставляет Twilio или SIP-провайдер. BAA для HIPAA — только Enterprise.

## Thesis

Минута ElevenLabs-агента стоит $0.08 плюс LLM на любом тарифе; тариф определяет включённые минуты и одновременность, а не цену минуты.

## Key points

- Included call minutes: 15 / 75 / 275 / 1 238 / 3 738 / 12 375 (Free…Business).
- Additional call $0.080/мин на всех тарифах; burst $0.160/мин; text message $0.003.
- Concurrent calls: 4 / 6 / 10 / 20 / 30 / 40.
- «ElevenAgents plans are billed by call minutes, not by the shared credit pool.»
- LLM: «billed separately on top, based on the model you choose».
- Enterprise: BAAs for HIPAA customers, elevated concurrency.
- Годовая оплата = 10 месяцев цены.

## Methods / evidence

Прайс-лист и FAQ поставщика.

## Relevance to project

Снимает вопрос «двух счётчиков» (551 против 945 кредитов на минуту, память reference-sebestoimost-golosa): для агентов теперь считаются минуты. Наш замер $0.0943/мин = $0.08 + ~$0.014 LLM совпадает с прайсом. Тариф Creator $22 почти всегда достаточен для одного клиента до ~275 минут, дальше $0.08 за минуту; Pro $99 оправдан с ~1 000 минут. Одновременность 10 звонков на Creator — ограничение для клиентов с пиковой нагрузкой.

## Extracted artefacts

- Notes: [n-elevenagents-billed-per-minute-008], [n-elevenagents-llm-extra-burst-double], [n-elevenlabs-baa-enterprise-only]
- Claims: [c-0616], [c-0617], [c-0614]
- Contradictions: [contr-061]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://elevenlabs.io/docs/agents-platform/overview | Agents docs | 2/5 | queued |

## Verbatim quotes (если критично)

> "billed by call minutes, not by the shared credit pool" — FAQ
