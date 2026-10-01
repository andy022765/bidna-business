# Meta Andromeda: Supercharging Advantage+ automation with the next-gen personalized ads retrieval engine — conspect

**Source**: https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/
**Source ID**: src-20260927-meta-eng-andromeda
**Author(s)**: Engineering at Meta, команда рекламы (~45 названных участников)
**Published**: 2024-12-02
**Quality**: 5/10
**Relevance**: 4/5
**Fetched**: 2026-09-27

## TL;DR

Инженерный блог Meta (02.12.2024) об Andromeda — новой системе первой ступени показа рекламы (retrieval). Она отбирает из десятков миллионов объявлений несколько тысяч кандидатов; дальше модели ранжирования предсказывают ценность и выбирают показ. Andromeda построена на NVIDIA Grace Hopper и MTIA, с иерархическим индексом и моделью в 10 000 раз большей ёмкости. Цель — справиться с ростом числа креативов от Advantage+ и генеративного ИИ. В планах — более разнообразный набор кандидатов.

## Thesis

Отбор кандидатов теперь делает большая нейросеть, рассчитанная на взрывной рост числа креативов.

## Key points

- Retrieval — первая ступень: десятки миллионов → несколько тысяч; решение о показе — на ранжировании.
- Рост числа объявлений: Advantage+ (аудитории, бюджет, плейсменты, креатив) и генеративный ИИ (больше 15 млн объявлений за месяц от миллиона рекламодателей).
- Иерархический индекс, обучаемый вместе с моделью; ёмкость модели ×10 000; эластичность модели.
- Самоотчёт: +6% recall, +8% качества рекламы на отдельных сегментах; +22% ROAS у включивших Advantage+ creative; +7% конверсий при генерации картинок.
- Планы: авторегрессионная функция потерь — более разнообразные кандидаты.

## Methods / evidence

Инженерное описание; приросты — самоотчёт без методики (bias.protocol_sponsored). Статье 21 месяц.

## Relevance to project

Для вопроса брифа 5 и проверки себя таргетологом (инструкция §10). Андромеда — отбор кандидатов, а не «вся Meta» и не «читатель креатива», как её пересказывали практики в разобранных уроках (notes_fg1.md). Для числа объявлений: платформе выгоден объём креативов, но справка об объёме предостерегает маленького рекламодателя. Отсюда c-0714: разнообразие концептов, а не количество.

## Extracted artefacts

- Notes: [n-meta-andromeda-retrieval-stage-first-cut], [n-meta-andromeda-built-for-creative-volume]
- Claims: [c-0714], [c-0715]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://engineering.fb.com/2024/11/19/data-infrastructure/sequence-learning-personalized-ads-recommendations/ | sequence learning for personalized ads | 2/5 | queued (to-follow) |
| https://engineering.fb.com/2026/08/05/ml-applications/from-user-sequences-to-scaling-laws-a-multi-stage-architecture-for-metas-ads-ranking/ | multi-stage architecture for ads ranking (2026) | 3/5 | queued (to-follow; просмотрена) |
| https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/ | ads service kernel scheduler (2026) | 0/5 | ignored: инфраструктура серверов |

## Verbatim quotes (если критично)

> "Retrieval is the first step in our multi-stage ads recommendation system."
