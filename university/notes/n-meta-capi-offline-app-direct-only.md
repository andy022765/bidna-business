---
id: n-meta-capi-offline-app-direct-only
title: "События приложения и офлайн-события (магазин, звонок из CRM) через Conversions API сейчас можно отправить только прямой интеграцией"
tags: [reklama-meta, capi, oflajn, podklyuchenie]
sources: [src-20260927-meta-help-capi-setup-options]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# События приложения и офлайн-события (магазин, звонок из CRM) через Conversions API сейчас можно отправить только прямой интеграцией

Первая строка той же статьи: для событий приложения и магазина (офлайн) через CAPI «direct integration is the only available option at this time». Партнёры CRM подключают данные лидов (Conversions API for CRM), коммерческие платформы — события своих магазинов. Для итога звонка Веры это означает свою функцию на сервере (у нас — Netlify), которая по завершении звонка отправляет событие в набор данных, или партнёра CRM, если CRM появится. Оценка Meta для прямой интеграции — 2–4 недели разработки; на нашей схеме это одна функция, но срок не проверен.

## Links

- supports: [n-meta-enabled-capi-web-one-click]
- refines: [n-meta-capi-partners-no-stripe]
- contradicts: []
- generalizes: []
