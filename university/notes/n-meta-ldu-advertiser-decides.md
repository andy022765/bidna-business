---
id: n-meta-ldu-advertiser-decides
title: "Отправлять ли флаг LDU, решает рекламодатель со своим юристом; поводы — отказ человека от продажи или передачи данных и сигнал GPC; цена — хуже показ, ретаргетинг и измерение"
tags: [reklama-meta, privatnost, ldu, capi]
sources: [src-20260927-meta-help-limited-data-use, src-20260927-meta-dev-capi-server-event-parameters]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Отправлять ли флаг LDU, решает рекламодатель со своим юристом; поводы — отказ человека от продажи или передачи данных и сигнал GPC; цена — хуже показ, ретаргетинг и измерение

Справка Meta: «it is up to you, with the advice of your legal counsel» — когда и слать ли флаг вообще. Пример повода — клиент отказался от продажи или передачи своих данных; второй — сигнал Global Privacy Control из браузера жителя Калифорнии или Колорадо. С флагом Meta выступает как service provider/processor и ограничивает использование данных по State-Specific Terms; эффективность падает, ретаргетинг и измерение ограничены. Технически это массив data_processing_options=["LDU"] в каждом событии CAPI (в пикселе — fbq('dataProcessingOptions', ['LDU'], 0, 0)) с кодом страны 1 или 0 и штата 1000 (Калифорния) или 0 — «определите по IP сами». Пустой массив явно означает «без ограничений».

## Links

- supports: []
- refines: [n-meta-business-tools-terms-lawful-hashing, n-meta-ldu-14-states-no-new-york]
- contradicts: []
- generalizes: []
