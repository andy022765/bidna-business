---
id: n-meta-capi-action-source-phone-call
title: "В Conversions API есть action_source=phone_call — «конверсия произошла по телефону»; любое значение action_source даёт измерение, аудитории и оптимизацию"
tags: [reklama-meta, capi, zvonki]
sources: [src-20260927-meta-dev-capi-server-event-parameters]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# В Conversions API есть action_source=phone_call — «конверсия произошла по телефону»; любое значение action_source даёт измерение, аудитории и оптимизацию

Параметры серверного события (Meta for Developers, извлечено 27.09.2026): action_source обязателен и принимает email, website, app, phone_call, chat, physical_store, system_generated, business_messaging, other; отправляя событие, рекламодатель подтверждает, что значение верное. Примечание: все значения дают измерение и аудитории, все дают и оптимизацию. Для событий сайта обязателен event_source_url. Документация по офлайн-событиям для магазинов требует physical_store, а для итога звонка Веры естественное значение — phone_call.

## Links

- supports: [n-meta-capi-accepts-phone-and-offline]
- refines: [n-meta-capi-event-time-max-7-days]
- contradicts: []
- generalizes: []
