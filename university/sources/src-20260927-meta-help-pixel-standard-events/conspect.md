# Specifications for Meta Pixel standard events — conspect

**Source**: https://www.facebook.com/business/help/402791146561655
**Source ID**: src-20260927-meta-help-pixel-standard-events
**Author(s)**: Meta Business Help Center
**Published**: н/д (дату инструмент не отдаёт; извлечено 2026-09-27)
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-27

## TL;DR

Список стандартных событий пикселя Meta с определениями и правило установки: базовый код в <head> каждой страницы (в нём PageView), код события — на нужных страницах. Для сервисного бизнеса ключевые: Contact (контакт по телефону, SMS, почте, в чате), Lead (оставил данные для связи), Schedule (запись), Purchase (оплата с суммой и валютой).

## Thesis

Минимальный пиксель — базовый код на всех страницах плюс несколько стандартных событий там, где совершается действие.

## Key points

- PageView — в базовом коде.
- Contact — любой контакт по телефону, SMS, почте, в чате.
- Lead — отправка данных, после которой свяжутся.
- Schedule — запись на визит.
- Purchase — завершённая покупка, value и currency.
- ViewContent — визит на страницу без сведений о действиях.

## Methods / evidence

Справка вендора.

## Relevance to project

Прямой ответ на вопрос брифа «что минимально нужно на лендинге» (c-0745): Contact на клик по номеру Веры, Lead на форму, Purchase на странице «спасибо» после Stripe.

## Extracted artefacts

- Notes: [n-meta-pixel-base-code-pageview], [n-meta-standard-events-contact-lead-schedule-purchase]
- Claims: [c-0745]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.facebook.com/business/help/952192354843755 | set up and install the Meta Pixel | 4/5 | queued (прочитана: варианты установки, включая Meta-enabled CAPI) |
| https://www.facebook.com/business/help/964258670337005 | about standard and custom website events | 3/5 | ignored: обзор, повторяет эту статью |

## Verbatim quotes (если критично)

> "contact between a customer and your business through phone, sms, email, chat"
