# Twilio SMS pricing — United States, carrier fees, plus SMS character limit / UCS-2 docs — conspect

**Source**: https://www.twilio.com/en-us/sms/pricing/us
**Source ID**: src-20260924-twilio-sms-pricing-us
**Author(s)**: Twilio
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

SMS в США: $0.0083 за исходящий и входящий сегмент (long code), MMS $0.022/$0.0165; сверху сбор оператора за сегмент: AT&T $0.0035, T-Mobile $0.0045 (и $0.0025 за входящий), Verizon $0.0045, прочие $0.004–0.005. Номер $1.15/мес. Неуспешное сообщение — $0.001. Сегмент на кириллице (UCS-2) вмещает 70 символов (67 в составном), латиница — 160 (153), поэтому русское сообщение стоит в 2–3 раза дороже английского той же длины.

## Thesis

Стоимость SMS определяется сегментами, а кириллица делает сегменты вдвое короче.

## Key points

- Long code: SMS out $0.0083, in $0.0083; MMS out $0.022, in $0.0165.
- Carrier fees (long code, SMS out): AT&T $0.0035, T-Mobile $0.0045, Verizon $0.0045, US Cellular $0.005, прочие $0.004.
- 10DLC регистрационные сборы — отдельно (src-20260924-twilio-10dlc-fees).
- UCS-2: 70 символов в одном сегменте, 67 в составном; любой не-GSM символ (кириллица, эмодзи, «умные» кавычки) переводит всё сообщение в UCS-2.
- Failed message processing fee $0.001.

## Methods / evidence

Прайс и справочная документация.

## Relevance to project

Для Доводчика по-русски сообщение в 150–200 знаков = 3 сегмента ≈ $0.04 с учётом сбора оператора. На маржу почти не влияет, но это аргумент писать коротко и вести длинную переписку в мессенджерах или почте.

## Extracted artefacts

- Notes: [n-twilio-sms-segment-plus-carrier-fee], [n-cyrillic-sms-70-chars-per-segment]
- Claims: [c-0619]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://twiliodeved.github.io/message-segment-calculator/ | segment calculator | 1/5 | ignored: инструмент |

## Verbatim quotes (если критично)

> "This reduces the character length limit of the message to 70 characters" — character-limit doc
