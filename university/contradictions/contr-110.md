---
id: contr-110
between: [internal:targetolog/INSTRUKCIYA-TARGETOLOGA.md, c-0740]
topic: reklama-meta/zvonki-i-izmerenie
status: resolved
resolution: c-0740
created: 2026-09-27
resolved: 2026-09-27
---

# Contradiction: Инструкция учит Meta на «звонке 20+ секунд», а реклама со звонком оптимизируется только на звонки 60+ секунд

## Position A

`targetolog/INSTRUKCIYA-TARGETOLOGA.md` §4, «Лестница событий»: «1. Звонок 20+ секунд (реклама с кнопкой «Позвонить» на демо-линию Веры; Meta считает звонки 20+ и 60+ с сама)» — в контексте правила «оптимизируем на событие ближе всего к деньгам». То же в `brief-bidna.md` §9.

## Position B

c-0740: в целях Traffic, Engagement, Leads и Sales реклама со звонком оптимизируется на 60-second calls (optimization_goal=QUALITY_CALL); 20-second calls — только метрика отчёта, в США — по умолчанию в колонке «Результаты».

## Why they conflict

Прямое расхождение в том, на чём учится алгоритм: выбрать оптимизацию на 20+ секунд нельзя. Часть инструкции верна — Meta действительно считает и 20+, и 60+.

## What would resolve it

Закрыто справкой Meta и руководством Marketing API (три согласованных документа).

## Current working assumption

Событие обучения — звонок 60+ секунд; метрика решений таргетолога может остаться 20+ (с обязательной строкой 60+ в отчёте). Правку инструкции делает её хозяин; здесь инструкция не меняется.
