---
id: n-meta-emq-email-clickid-high
title: "Для совпадения событий сильнее всего весят email и click ID; телефон, external_id, страна и браузерный ID — средне; имя, город, индекс — слабо"
tags: [reklama-meta, capi, emq]
sources: [src-20260927-meta-help-event-match-quality]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Для совпадения событий сильнее всего весят email и click ID; телефон, external_id, страна и браузерный ID — средне; имя, город, индекс — слабо

Таблица приоритетов из справки Meta: высокий — email и click ID (параметр fbc, из ссылки с fbclid); средний — Facebook Login ID, дата рождения, страна, телефон, external_id (свой идентификатор рекламодателя), browser ID (fbp); низкий — lead ID, имя, фамилия, город, индекс. Совет Meta — слать несколько параметров сразу. Контактные данные перед отправкой хэшируются по правилам документации для разработчиков. Для наших форм и Stripe главное — хэш email и fbc/fbp из cookie; телефон полезен, но весит меньше email.

## Links

- supports: [n-meta-emq-web-only-48h]
- refines: [n-meta-business-tools-terms-lawful-hashing]
- contradicts: []
- generalizes: []
