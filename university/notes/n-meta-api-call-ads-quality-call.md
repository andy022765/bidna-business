---
id: n-meta-api-call-ads-quality-call
title: "В Marketing API реклама со звонком — группа с destination_type=PHONE_CALL и optimization_goal=QUALITY_CALL и креатив с кнопкой CALL_NOW на ссылку tel:"
tags: [reklama-meta, call-ads, marketing-api]
sources: [src-20260927-meta-dev-call-ads-api]
confidence: H
created: 2026-09-27
supersedes: []
superseded_by: null
---

# В Marketing API реклама со звонком — группа с destination_type=PHONE_CALL и optimization_goal=QUALITY_CALL и креатив с кнопкой CALL_NOW на ссылку tel:

Руководство «Call Ads» для Marketing API (v25.0, извлечено 27.09.2026): группа объявлений создаётся с billing_event=IMPRESSIONS, destination_type=PHONE_CALL и optimization_goal=QUALITY_CALL; в примере таргетинга device_platforms=mobile. Креатив — object_story_spec.link_data с call_to_action type=CALL_NOW и value.link="tel:+<номер с кодом страны>". Объявление в примере создаётся со статусом PAUSED. Это те поля, которые использует и коннектор Meta Ads при сборке, поэтому таргетологу полезно видеть их в ответе коннектора и в журнале. Само руководство QUALITY_CALL не расшифровывает; по справке это оптимизация на 60-секундные звонки.

## Links

- supports: [n-meta-call-ads-five-objectives, n-meta-call-ads-optimize-60s-calls]
- refines: []
- contradicts: []
- generalizes: []
