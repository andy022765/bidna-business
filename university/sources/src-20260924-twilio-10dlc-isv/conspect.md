# Twilio Docs: ISV A2P 10DLC Onboarding Overview (modified 2026-07-21) — conspect

**Source**: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv
**Source ID**: src-20260924-twilio-10dlc-isv
**Author(s)**: Twilio Developer Education Team
**Published**: 2026-07-21
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Если платформа шлёт SMS от имени своих клиентов, она обязана создать для каждого клиента отдельный профиль и зарегистрировать отдельный бренд (со своим сбором и trust score) и кампании под каждый сценарий. Платформа отвечает за сбор данных клиента для регистрации.

## Thesis

ISV регистрирует не себя, а каждого клиента как отдельный бренд A2P 10DLC.

## Key points

- Primary Customer Profile — для платформы, Secondary — для каждого клиента.
- Каждый бренд — свой сбор и свой trust score TCR.
- Кампания — один сценарий использования; у бренда может быть несколько.
- Платформа собирает у клиентов регистрационные данные или строит самообслуживание через API.

## Methods / evidence

Документация.

## Relevance to project

Наша схема «телефония наша на Twilio» (решение 16.09) для SMS Доводчика превращает нас в ISV: у каждого клиента — свой бренд, EIN, сайт, политика и одобрение до запуска. Это надо включить в чек-лист установочного звонка и в срок запуска.

## Extracted artefacts

- Notes: [n-isv-registers-each-client-as-brand]
- Claims: [c-0605]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| — | — | — | — |

## Verbatim quotes (если критично)

> "Each Brand comes with its own Brand registration fee" — Registering Brands
