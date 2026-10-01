---
id: n-unregistered-10dlc-extra-fees-filtering
title: "Unregistered A2P traffic on US long codes is filtered and charged extra carrier fees"
tags: [sms, twilio, 10dlc]
sources: [src-20260924-twilio-10dlc-fees]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
---

# Unregistered A2P traffic on US long codes is filtered and charged extra carrier fees

Обзор A2P 10DLC в документации Twilio: все, кто шлёт SMS с 10-значных номеров в США через приложение, обязаны регистрироваться, операторы считают весь трафик Twilio прикладным. Незарегистрированный трафик получает дополнительные сборы операторов и сильнее фильтруется. Значит, «отправим пару сообщений без регистрации» не вариант даже для теста на реальных клиентах.

## Links

- supports: [n-10dlc-fees-per-client-brand]
- refines: []
- contradicts: []
- generalizes: []
