# About event match quality — conspect

**Source**: https://www.facebook.com/business/help/765081237991954
**Source ID**: src-20260927-meta-help-event-match-quality
**Author(s)**: Meta Business Help Center
**Published**: н/д (дату инструмент не отдаёт; извлечено 2026-09-27)
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Качество совпадения событий (EMQ): оценка 0–10 для веб-событий через CAPI (action_source=website) по последним 48 часам. Приоритеты данных клиента: email и click ID — высокий, телефон, external ID, browser ID — средний, имя, город, индекс — низкий. Контакты хэшируются; законность передачи и согласия — на рекламодателе и его юристе.

## Thesis

Чем больше сильных идентификаторов клиента в серверном событии, тем лучше Meta сопоставляет события с людьми.

## Key points

- EMQ только для website-событий через CAPI.
- Шкала 0–10, окно 48 часов.
- Приоритеты параметров (email и click ID — высокий).
- Хэширование по документации.
- Условия Business Tools: законные права, запрет чувствительных данных, согласия.

## Methods / evidence

Справка вендора.

## Relevance to project

Опора c-0747: какие поля ГОЛОС кладёт в серверное событие. Напоминает о правовой стороне (c-0752).

## Extracted artefacts

- Notes: [n-meta-emq-web-only-48h], [n-meta-emq-email-clickid-high], [n-meta-business-tools-terms-lawful-hashing]
- Claims: [c-0747]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| URL инструмент не отдаёт | check your event match quality in Meta Events Manager | 3/5 | queued |
| URL инструмент не отдаёт | prohibited information | 4/5 | queued (важно для стоматологий) |
| URL инструмент не отдаёт | best practices for Conversions API | 4/5 | queued |

## Verbatim quotes (если критично)

> "the last 48 hours of data are used to calculate scores"
