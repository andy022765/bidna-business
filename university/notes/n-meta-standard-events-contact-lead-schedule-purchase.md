---
id: n-meta-standard-events-contact-lead-schedule-purchase
title: "Для сервисного бизнеса главные стандартные события Meta: Contact — контакт по телефону, SMS, почте или в чате; Lead — оставил данные для связи; Schedule — записался; Purchase — оплатил, с суммой и валютой"
tags: [reklama-meta, pixel, sobytiya]
sources: [src-20260927-meta-help-pixel-standard-events]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# Для сервисного бизнеса главные стандартные события Meta: Contact — контакт по телефону, SMS, почте или в чате; Lead — оставил данные для связи; Schedule — записался; Purchase — оплатил, с суммой и валютой

Определения из справки Meta: Contact — «contact between a customer and your business through phone, sms, email, chat, or other means»; Lead — отправка данных с пониманием, что с человеком свяжутся (форма, заявка на пробный период); Schedule — запись на визит; Purchase — завершённая покупка, обычно страница «спасибо» или подтверждение, с параметрами value и currency. CompleteRegistration — регистрация в обмен на услугу, Subscribe и StartTrial — платная подписка и пробный период. На наших лендингах это ложится так: нажатие на номер Веры (tel:) — Contact, отправка формы — Lead, возврат со Stripe на страницу «спасибо» — Purchase с суммой. Инструмент коннектора отдаёт текст в нижнем регистре; в коде имена событий пишутся с заглавной (Lead, Contact, Purchase).

## Links

- supports: [n-meta-pixel-base-code-pageview]
- refines: []
- contradicts: []
- generalizes: []
