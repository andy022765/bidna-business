---
id: n-cyrillic-sms-70-chars-per-segment
title: "Any Cyrillic character switches an SMS to UCS-2 encoding with 70 characters per segment (67 in multipart), making Russian texts two to three times more expensive"
tags: [ekonomika, sms, russkiy-yazyk]
sources: [src-20260924-twilio-sms-pricing-us]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
---

# Any Cyrillic character switches an SMS to UCS-2 encoding with 70 characters per segment (67 in multipart), making Russian texts two to three times more expensive

Документация Twilio: GSM-7 даёт 160 символов в сегменте (153 в составном), UCS-2 — 70 (67). Любой символ вне GSM-7 — кириллица, эмодзи, даже «умные» кавычки — переводит всё сообщение в UCS-2. Русское сообщение в 150–200 знаков — три сегмента, английское той же длины — один-два. Для Доводчика по-русски: писать коротко, длинное вести в мессенджере или почте; считать стоимость по сегментам.

## Links

- supports: [n-twilio-sms-segment-plus-carrier-fee]
- refines: []
- contradicts: []
- generalizes: []
