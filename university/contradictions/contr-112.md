---
id: contr-112
between: [n-meta-crm-integration-fit-200-leads, n-meta-qualified-leads-website-and-instant-forms]
topic: reklama-meta/zvonki-i-izmerenie
status: open
resolution: null
created: 2026-09-27
resolved: null
---

# Contradiction: Документация Meta: «квалифицированные лиды» только для инстант-форм; справка Meta 2026: и для форм на сайте

## Position A

Документация «Conversions API for CRM Integration»: цель Conversion Leads «currently only compatible with Facebook/Instagram's Lead Ads (Instant Forms)». Ссылка: [n-meta-crm-integration-fit-200-leads].

## Position B

Справка «About performance goals for lead ads» (782657799338685): «this performance goal can be used with both website forms and instant forms», с отдельным экспериментом для форм на сайте (21.08–14.09.2025). Ссылка: [n-meta-qualified-leads-website-and-instant-forms].

## Why they conflict

Два документа Meta расходятся в области применения цели. Вероятнее, документация для разработчиков отстаёт от интерфейса.

## What would resolve it

Проверка в Ads Manager: предлагается ли цель «максимум квалифицированных лидов» при месте конверсии «Website» после подключения CAPI.

## Current working assumption

Справка свежее (упоминает апрель и август 2026) — считаем, что формы на сайте поддерживаются. Для нас вопрос отложен вместе с шагом 4 (contr-111).
