# We Analyzed 137K Sites: 97% of llms.txt Files Never Get Read — conspect

**Source**: https://ahrefs.com/blog/llmstxt-study/
**Source ID**: src-20260924-ahrefs-llmstxt-137k
**Author(s)**: Louise Linehan, Xibeijia Guan
**Published**: 2026-06-15
**Quality**: 6/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

По логам 137 210 доменов (май 2026): llms.txt есть у 28%, 97% этих файлов не запросил никто. Из запросов к остальным 3% — почти все боты, большинство не ИИ; PerplexityBot читал реже Slackbot. К несуществующим llms.txt ИИ-боты не ходят. Google в мае 2026 назвал файл ненужным для Поиска.

## Thesis

llms.txt почти никто не читает, и особым каналом к ИИ-поиску он не является.

## Key points

- 28% доменов публикуют llms.txt (верхняя граница).
- 97% файлов — ноль запросов за месяц.
- 96% запросов к читаемым файлам — боты; 77% из них не ИИ; 19,5% — ИИ-инструменты (GPTBot, Claude-Code); 12% — GEO-проверялки.
- Нет запросов ИИ-ботов к отсутствующим llms.txt.
- Отдельное исследование SE Ranking (~300 тыс. доменов, через SEJ): нет связи llms.txt с цитированием.

## Methods / evidence

Логи серверов и аналитика Ahrefs, классификация 12 категорий агентов.

## Relevance to project

Опора c-0104. Наблюдение, что Perplexity цитировал наш llms.txt дословно, объясняется тем, что файл проиндексирован как обычная страница; особой роли у него нет.

## Extracted artefacts

- Notes: [n-google-ignores-llmstxt-special-markup], [n-llmstxt-mostly-unread]
- Claims: [c-0104]
- Contradictions: —

_Качество 6, 1 собственная заметка + участие в n-google-ignores-llmstxt-special-markup._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/ | SE Ranking via SEJ | 3/5 | fetched: учтено в заметке, отдельным источником не оформлено |

## Verbatim quotes (если критично)

> "97% of those files received zero traffic in May 2026. Nothing fetched them at all." — Top findings
