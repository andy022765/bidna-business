---
id: n-searchbots-index-user-agents-live
title: 'OAI-SearchBot, PerplexityBot и Claude-SearchBot индексируют сайт для поиска; заход «под живой вопрос» — это ChatGPT-User, Perplexity-User и Claude-User'
tags: [crawlers, measurement, bots]
sources: [src-20260924-openai-crawlers-doc, src-20260924-perplexity-crawlers-doc, src-20260924-anthropic-crawlers-doc]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
author_agent: geo-mekh
---

# OAI-SearchBot, PerplexityBot и Claude-SearchBot индексируют сайт для поиска; заход «под живой вопрос» — это ChatGPT-User, Perplexity-User и Claude-User

Все три вендора описывают три роли. Обучение: GPTBot, ClaudeBot. Поисковый индекс: OAI-SearchBot («используется, чтобы показывать сайты в поисковых функциях ChatGPT»), PerplexityBot («чтобы показывать и ссылаться на сайты в результатах Perplexity»), Claude-SearchBot («индексирует контент для качества поиска»). Действия пользователя: ChatGPT-User («не используется для автоматического обхода»), Perplexity-User («когда пользователь задаёт вопрос, может посетить страницу»), Claude-User. Пользовательские агенты могут не соблюдать robots.txt, потому что запрос сделал человек. Значит, заход SearchBot — признак индексации, а не того, что кто-то прямо сейчас спросил о нас.

## Links

- supports: [n-blocking-searchbot-removes-from-ai-answers]
- refined_by: [n-chatgpt-citations-overlap-bing-2025]
- claims: [c-0108, c-0113]
- sources: [src-20260924-openai-crawlers-doc, src-20260924-perplexity-crawlers-doc, src-20260924-anthropic-crawlers-doc]
