# Does Anthropic crawl data from the web, and how can site owners block the crawler? — conspect

**Source**: https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
**Source ID**: src-20260924-anthropic-crawlers-doc
**Author(s)**: Anthropic
**Published**: 2026-04-07
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Справка Anthropic (07.04.2026) о трёх роботах: ClaudeBot — обучение, Claude-User — заходы по вопросу пользователя, Claude-SearchBot — индексация для качества поиска. Закрытие Claude-User или Claude-SearchBot снижает видимость в ответах Claude. Соблюдают robots.txt и Crawl-delay; IP не публикуют.

## Thesis

Роли роботов Anthropic разделены так же: обучение, поисковый индекс, действия пользователя.

## Key points

- ClaudeBot: сбор для обучения; закрытие — исключение будущих материалов из обучения.
- Claude-User: доступ к сайтам, когда люди задают вопросы Claude.
- Claude-SearchBot: «navigates the web to improve search result quality»; закрытие снижает видимость в поиске.
- Уважают robots.txt и Crawl-delay; блокировка по IP ненадёжна.

## Methods / evidence

Официальная справка.

## Relevance to project

Опора c-0108 и n-blocking-searchbot-removes-from-ai-answers.

## Extracted artefacts

- Notes: [n-blocking-searchbot-removes-from-ai-answers], [n-searchbots-index-user-agents-live]
- Claims: [c-0108]
- Contradictions: [contr-011]

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| — | — | — | нет значимых исходящих ссылок |

## Verbatim quotes (если критично)

> "Disabling Claude-SearchBot on your site prevents our system from indexing your content for search optimization" — таблица роботов
