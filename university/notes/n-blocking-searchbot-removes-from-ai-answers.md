---
id: n-blocking-searchbot-removes-from-ai-answers
title: 'Запрет поискового бота в robots.txt убирает сайт из поисковых ответов этого ИИ'
tags: [crawlers, hygiene]
sources: [src-20260924-openai-crawlers-doc, src-20260924-perplexity-crawlers-doc, src-20260924-anthropic-crawlers-doc]
confidence: H
created: 2026-09-24
supersedes: []
superseded_by: null
author_agent: geo-mekh
---

# Запрет поискового бота в robots.txt убирает сайт из поисковых ответов этого ИИ

OpenAI: сайты, закрытые от OAI-SearchBot, не показываются в поисковых ответах ChatGPT (могут остаться навигационными ссылками); изменения robots.txt учитываются примерно за 24 часа. Perplexity рекомендует разрешить PerplexityBot и его IP в брандмауэре. Anthropic: закрытие Claude-SearchBot или Claude-User снижает видимость в ответах Claude. Закрытие GPTBot и ClaudeBot касается только обучения. Проверка «не закрыт ли поисковый бот» — дешёвая и проверяемая часть услуги; готовые шаблоны robots.txt, закрывающие всех ИИ-ботов, убивают ровно ту видимость, которую мы продаём.

## Links

- supports: [n-searchbots-index-user-agents-live]
- claims: [c-0108]
- sources: [src-20260924-openai-crawlers-doc, src-20260924-perplexity-crawlers-doc, src-20260924-anthropic-crawlers-doc]
