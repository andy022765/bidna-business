---
id: n-elevenagents-llm-extra-burst-double
title: "On ElevenAgents the LLM is billed on top of the minute price, and calls above the concurrency limit cost double"
tags: [ekonomika, elevenlabs, vera]
sources: [src-20260924-elevenlabs-agents-pricing]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
---

# On ElevenAgents the LLM is billed on top of the minute price, and calls above the concurrency limit cost double

LLM оплачивается отдельно по выбранной модели и списывается с баланса ElevenLabs. Наш замер $0.0943/мин при прайсе $0.08 означает ~$0.014/мин на LLM (Gemini в замере 16.09, около 10–15% счёта). Burst — до трёх раз сверх лимита одновременных звонков по $0.16/мин. Текстовое сообщение агента — $0.003. Телефонию ElevenLabs не берёт: её выставляет Twilio или SIP-провайдер.

## Links

- supports: [n-elevenagents-billed-per-minute-008]
- refines: []
- contradicts: []
- generalizes: []
