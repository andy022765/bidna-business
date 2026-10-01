---
id: n-meta-capi-event-time-max-7-days
title: "Событие в Conversions API должно быть не старше 7 дней: одно просроченное событие отклоняет весь запрос"
tags: [reklama-meta, capi]
sources: [src-20260927-meta-dev-capi-server-event-parameters]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Событие в Conversions API должно быть не старше 7 дней: одно просроченное событие отклоняет весь запрос

По документации event_time — время самого события (Unix, секунды, GMT); оно может быть раньше момента отправки, но не больше чем на 7 дней. Если хоть одно событие в массиве data старше 7 дней, Meta возвращает ошибку на весь запрос и не обрабатывает ни одного события. Для магазинных событий (physical_store) документация по офлайну допускает загрузку в течение 62 дней (страница в очереди). Практически: итог звонка Веры и оплату слать сразу или хотя бы раз в сутки, а не еженедельной выгрузкой.

## Links

- supports: []
- refines: [n-meta-capi-action-source-phone-call]
- contradicts: []
- generalizes: []
