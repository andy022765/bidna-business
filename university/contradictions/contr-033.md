---
id: contr-033
between: ["c-0309", "internal:Pivot/agenty/dogonyayushchiy/SPEC.md"]
topic: vera/prodavec-dovodchik
status: open
resolution: null
created: 2026-09-24
resolved: null
---

# Contradiction: Доводчик спроектирован вокруг Telegram, а клиенты наших клиентов — в основном американцы, у которых основной письменный канал SMS

## Position A

c-0309: WhatsApp — треть взрослых американцев (Pew 2025), Telegram не измеряется; дожим американского клиента — SMS и почта; конкуренты (CallSetter, My AI Front Desk, Smith.ai) дожимают SMS и почтой.

## Position B

`Pivot/agenty/dogonyayushchiy/SPEC.md` (15.09): Доводчик v1 — Telegram Business, вход через письмо с кнопкой «продолжить в Telegram»; `Pivot/golos/CENY-RYNOK.md`: «для связки: дожим в Telegram — русскоязычный клиент живёт в Telegram» как отличие.

## Why they conflict

Спецификация писалась под наши собственные продажи (покупатель — русскоязычный владелец). Для продукта, который владелец ставит своим американским клиентам, Telegram-first не работает. Это не ошибка спецификации, а разные сценарии, которые в комплекте Веры смешались.

## What would resolve it

Решение Андрея: Доводчик в комплекте Веры = SMS + почта для американских клиентов владельца + Telegram/WhatsApp для русскоязычных; Telegram-версия остаётся для нашей воронки.

## Current working assumption

Считаем, что комплект для клиента требует SMS-канала (A2P 10DLC — ветка pravo/ekonomika); Telegram — дополнительный канал для русскоязычной клиентуры.
