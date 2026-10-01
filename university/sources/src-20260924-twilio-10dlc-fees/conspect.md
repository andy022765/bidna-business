# Twilio: Pricing and Fees for A2P 10DLC Service (updated 2026-06-15) — conspect

**Source**: https://support.twilio.com/hc/en-us/articles/1260803965530-Pricing-and-Fees-for-A2P-10DLC-Service
**Source ID**: src-20260924-twilio-10dlc-fees
**Author(s)**: Twilio Support
**Published**: 2026-06-15
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Любая отправка SMS приложением с обычного 10-значного номера в США требует регистрации A2P 10DLC: бренд (кто шлёт) и кампания (что и зачем). Сборы с 01.08.2025: бренд Low Volume Standard или Sole Proprietor — $4.50 разово, Standard — $46 (с вторичной проверкой), проверка кампании — $15, ежемесячно за кампанию $1.50 (low volume mixed) … $10 (standard). Незарегистрированный трафик фильтруется и облагается доп. сборами. Плюс сбор оператора за каждый сегмент.

## Thesis

SMS через Twilio в США стоят не только поминутно: на каждого отправителя нужны разовые и ежемесячные регистрационные сборы TCR.

## Key points

- Brand: Sole Prop $4.50, Low Volume Standard $4.50 (нужен EIN, <6 000 сообщений в день), Standard $46.
- Campaign: $15 за проверку; ежемесячно Sole Prop $2, Standard $10, Low-volume mixed $1.50.
- С 01.08.2025: Authentication Plus $12.50 за повтор (публичные коммерческие бренды), апелляция $11.
- Low Volume Mixed: до 2 000 сегментов в день на T-Mobile, минимальная пропускная способность.
- Незарегистрированный трафик: доп. сборы и фильтрация (обзор A2P 10DLC).
- Сбор оператора — за каждый исходящий сегмент; T-Mobile берёт и за входящие.

## Methods / evidence

Прайс поставщика. Цифры — сборы TCR, переданные без наценки (по словам Twilio).

## Relevance to project

Если Доводчик шлёт SMS от имени клиента, каждый клиент — отдельный бренд со своими сборами и сроком одобрения. Это меньше $20 разово и $1.50–10 в месяц, то есть на маржу почти не влияет, но добавляет шаг и ожидание в запуск.

## Extracted artefacts

- Notes: [n-10dlc-fees-per-client-brand], [n-unregistered-10dlc-extra-fees-filtering]
- Claims: [c-0605], [c-0619]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://help.twilio.com/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ | Campaign Vetting FAQ | 3/5 | queued |

## Verbatim quotes (если критично)

> "US A2P Campaign use case registration fees: $15 vetting fee" — Registration Fees
