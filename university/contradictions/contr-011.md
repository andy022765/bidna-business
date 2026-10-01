---
id: contr-011
between: [c-0108, internal:Pivot/agenty/smotritel/PLAN-SVOYA-VIDIMOST.md]
topic: vidimost/zamer
status: open
resolution: null
created: 2026-09-24
resolved: null
author_agent: geo-mekh
---

# Contradiction: Счётчик роботов относит OAI-SearchBot, PerplexityBot и Claude-SearchBot к «живому вопросу», а документация вендоров называет их индексирующими обходчиками

## Position A

`PLAN-SVOYA-VIDIMOST.md`, раздел «Как поймём, что работа идёт»: «выборка под живой вопрос — OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-User. Такой заход значит, что прямо сейчас кто-то спросил». Та же разметка в рабочей заметке о счётчике (23.09): в «живом вопросе» также Claude-SearchBot.

## Position B

c-0108, по документации: OAI-SearchBot «используется, чтобы показывать сайты в поисковых функциях ChatGPT», а ChatGPT-User «не используется для автоматического обхода» (OpenAI); PerplexityBot — для результатов поиска, Perplexity-User — когда пользователь задаёт вопрос (Perplexity); Claude-SearchBot индексирует для качества поиска, Claude-User — по запросу пользователя (Anthropic).

## Why they conflict

Прямое противоречие в классификации. Если оставить как есть, первый заход OAI-SearchBot на страницу будет прочитан как «нас спросили», хотя это только индексация. Промежуточный показатель завысит видимость — и в нашем кейсе, и в отчётах клиентам.

## What would resolve it

Уже разрешено первоисточниками; осталось поправить код счётчика и документы. Проверка в логах: SearchBot ходит регулярно и по sitemap, *-User — точечно на страницы.

## Current working assumption

Считать три породы: обучение (GPTBot, ClaudeBot, CCBot…), поисковый индекс (OAI-SearchBot, PerplexityBot, Claude-SearchBot), живой вопрос (ChatGPT-User, Perplexity-User, Claude-User и аналоги). Событие «настоящая видимость» — первый заход *-User. Правка — полоса ГОЛОС; без согласия Андрея код не трогаем.
