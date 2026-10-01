# Overview of OpenAI Crawlers — conspect

**Source**: https://developers.openai.com/api/docs/bots
**Source ID**: src-20260924-openai-crawlers-doc
**Author(s)**: OpenAI
**Published**: null
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Документация OpenAI о роботах. Роли разделены: GPTBot — обучение, OAI-SearchBot — показ сайтов в поиске ChatGPT, ChatGPT-User — действия пользователя, OAI-AdsBot — проверка рекламы. Закрытие OAI-SearchBot убирает сайт из поисковых ответов; изменения robots.txt учитываются ~24 часа.

## Thesis

Каждый робот OpenAI имеет свою роль, и управление видимостью в ChatGPT-поиске идёт через OAI-SearchBot.

## Key points

- OAI-SearchBot: «used to surface websites in search results in ChatGPT's search features»; закрытые сайты не показываются в поисковых ответах, могут быть навигационными ссылками.
- GPTBot: только обучение; можно закрыть его и оставить OAI-SearchBot.
- ChatGPT-User: заходы по действию пользователя, «not used for crawling the web in an automatic fashion», robots.txt может не применяться, не определяет попадание в поиск.
- Опубликованы IP-диапазоны; ~24 часа на учёт robots.txt.

## Methods / evidence

Официальная документация.

## Relevance to project

Опора c-0108 (переразметка счётчика) и c-0113 (у ChatGPT свой поисковый обходчик). Даёт проверяемую работу «открытая дверь».

## Extracted artefacts

- Notes: [n-blocking-searchbot-removes-from-ai-answers], [n-searchbots-index-user-agents-live]
- Claims: [c-0108], [c-0113]
- Contradictions: [contr-011]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://openai.com/searchbot.json | IP OAI-SearchBot | 2/5 | ignored: техническое |

## Verbatim quotes (если критично)

> "ChatGPT-User is not used for crawling the web in an automatic fashion." — таблица агентов
