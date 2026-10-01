# Perplexity Crawlers — conspect

**Source**: https://docs.perplexity.ai/guides/bots
**Source ID**: src-20260924-perplexity-crawlers-doc
**Author(s)**: Perplexity
**Published**: null
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Документация Perplexity о роботах: PerplexityBot — показ и ссылки в результатах поиска Perplexity, не для обучения; Perplexity-User — заходы, когда пользователь задаёт вопрос, обычно игнорирует robots.txt. Даны настройки брандмауэров.

## Thesis

PerplexityBot индексирует для поиска, Perplexity-User ходит по вопросу пользователя.

## Key points

- PerplexityBot: «designed to surface and link websites in search results on Perplexity»; рекомендуют разрешить его и его IP.
- Perplexity-User: «When users ask Perplexity a question, it might visit a web page»; «generally ignores robots.txt rules».
- Инструкции для Cloudflare/AWS WAF.

## Methods / evidence

Официальная документация.

## Relevance to project

Опора c-0108: заход PerplexityBot — индексация, а не живой вопрос.

## Extracted artefacts

- Notes: [n-blocking-searchbot-removes-from-ai-answers], [n-searchbots-index-user-agents-live]
- Claims: [c-0108]
- Contradictions: [contr-011]

_Источник качества 6 дал 2 общие заметки (вместе с документами OpenAI и Anthropic)._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.perplexity.com/perplexitybot.json | IP PerplexityBot | 2/5 | ignored: техническое |

## Verbatim quotes (если критично)

> "Since a user requested the fetch, this fetcher generally ignores robots.txt rules." — Perplexity-User
