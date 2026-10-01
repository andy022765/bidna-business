# Twilio Programmable Voice pricing — United States (as of 2026-09-24) — conspect

**Source**: https://www.twilio.com/en-us/voice/pricing/us
**Source ID**: src-20260924-twilio-voice-pricing-us
**Author(s)**: Twilio
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Официальный прайс Twilio Voice по США на 24.09.2026: входящая минута на местный номер $0.0085, исходящая $0.0140, местный номер $1.15/мес, toll-free $2.15/мес и $0.022/мин входящая. Конференция от $0.0018 за участника в минуту, запись $0.0025/мин, Media Streams $0.0044/мин, Conversation Relay $0.07/мин. Для Веры телефония — копейки на фоне ElevenLabs.

## Thesis

Телефонная часть минуты Веры на Twilio — около цента.

## Key points

- Receive: local $0.0085/мин, toll-free $0.0220/мин; Make: US/Canada $0.0140/мин.
- Номера: local $1.15/мес, toll-free $2.15/мес.
- SIP interface / BYOC $0.0040/мин.
- Conference от $0.0018/участник/мин; Recording $0.0025/мин + хранение $0.0005/мин/мес.
- Media Streams $0.0044/мин; Conversation Relay $0.07/мин; Branded calling $0.12/звонок.
- Emergency calling $0.75/мес за номер.

## Methods / evidence

Прайс-лист.

## Relevance to project

Основа расчёта телефонии в exp-20260924-yunit-ekonomika. Открытый вопрос: списывает ли Twilio Media Streams ($0.0044) при нативной интеграции ElevenLabs — надо проверить по счёту; в расчёте заложено как консервативное допущение.

## Extracted artefacts

- Notes: [n-twilio-inbound-085c-number-115], [n-twilio-media-streams-may-add-044c]
- Claims: [c-0616]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.twilio.com/en-us/voice/pricing/us | CSV price list | 2/5 | ignored: тот же прайс |

## Verbatim quotes (если критично)

> Local calls: "$0.0085 / min" (receive)
