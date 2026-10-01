---
id: n-isv-registers-each-client-as-brand
title: "A platform sending SMS for its customers must register each customer as its own 10DLC brand"
tags: [sms, twilio, 10dlc, shema-postavki]
sources: [src-20260924-twilio-10dlc-isv]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
---

# A platform sending SMS for its customers must register each customer as its own 10DLC brand

Документация Twilio для ISV: для каждого клиента создаётся отдельный Secondary Customer Profile и регистрируется отдельный бренд со своим сбором и trust score, плюс кампания на каждый сценарий. В руководстве по кампаниям прямо: для софта для стоматологов регистрируется конкретная клиника, а не софтверная компания. Наша схема «телефония наша на Twilio» (16.09) делает нас ISV для SMS Доводчика: нужен EIN, адрес, сайт и политики каждого клиента.

## Links

- supports: [n-10dlc-fees-per-client-brand, n-10dlc-needs-client-site-privacy-terms]
- refines: []
- contradicts: []
- generalizes: []
