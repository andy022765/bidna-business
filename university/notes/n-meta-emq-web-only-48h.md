---
id: n-meta-emq-web-only-48h
title: "Качество совпадения событий (EMQ, 0–10) Meta считает только для событий сайта через CAPI и только по последним 48 часам"
tags: [reklama-meta, capi, emq]
sources: [src-20260927-meta-help-event-match-quality]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Качество совпадения событий (EMQ, 0–10) Meta считает только для событий сайта через CAPI и только по последним 48 часам

Статья «About event match quality» (765081237991954, извлечено 27.09.2026): EMQ есть у веб-событий, отправленных через Conversions API с action_source=website. Оценка от 0 до 10 складывается из качества переданных данных клиента и доли событий, совпавших с аккаунтами Meta; считается по последним 48 часам, поэтому события надо слать регулярно. Для событий звонка (phone_call) и офлайна эта статья EMQ не описывает. По словам Meta, выше EMQ — больше «дополнительных конверсий в отчёте» и ниже цена действия.

## Links

- supports: [n-meta-emq-email-clickid-high]
- refines: []
- contradicts: []
- generalizes: []
