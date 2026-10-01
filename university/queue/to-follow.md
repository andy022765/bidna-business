# To-follow queue (BFS)

Внутренняя очередь ссылок, найденных внутри уже обработанных источников. Пополняется автоматически на шаге 7 пайплайна (см. METHODOLOGY.md §4).

Формат:

```
- <URL>
  parent: <source-id>
  anchor: "<anchor text>"
  predicted_relevance: X/5
  depth: N
  status: queued | fetched | rejected
  note: (optional) why it's important
```

## Queue

### vnutr

- https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
  parent: internal:Pivot/koncepciya-ssha/KONCEPCIYA-SSHA.html
  anchor: "FCC 24-17 о голосах ИИ"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: основание «ИИ-голос = artificial voice по TCPA»; в razvedka fcc.gov отдавал 403 — текст не читан целиком

- https://www.ftc.gov/news-events/news/press-releases/2025/08/ftc-sues-stop-air-ai-using-deceptive-claims-about-business-growth-earnings-potential-refund
  parent: internal:Pivot/koncepciya-ssha/KONCEPCIYA-SSHA.html
  anchor: "FTC против Air AI"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: прецедент в нашей категории; гарантия возврата признана обманом (razvedka svod:292)

- https://www.ftc.gov/news-events/news/press-releases/2026/03/air-ai-its-owners-will-be-banned-marketing-business-opportunities-settle-ftc-charges-company-misled
  parent: internal:Pivot/koncepciya-ssha/KONCEPCIYA-SSHA.html
  anchor: "мировое Air AI"
  predicted_relevance: 5/5
  depth: 1
  status: queued

- https://www.law.cornell.edu/uscode/text/47/227
  parent: internal:Pivot/koncepciya-ssha/KONCEPCIYA-SSHA.html
  anchor: "47 U.S.C. § 227 (TCPA)"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://le.utah.gov/~2025/bills/sbillenr/SB0226.pdf
  parent: internal:shtab/issledovanie/razvedka-2026-09-19/pravo-2026.md
  anchor: "Юта 13-75: раскрытие ИИ"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://support.google.com/business/answer/16190256
  parent: internal:shtab/issledovanie/razvedka-2026-09-19/kritik.md
  anchor: "Google Ask for Me"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Гугл звонит в бизнес вместо клиента; не работает в 5 штатах; записывает звонки — довод для Веры

- https://ai.google.dev/gemini-api/terms
  parent: internal:Pivot/agenty/smotritel/RAZVEDKA-GITHUB-2026-09-14.md
  anchor: "Gemini с поиском — запрет хранить/анализировать ответы"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://www.anthropic.com/legal/consumer-terms
  parent: internal:Pivot/agenty/smotritel/RAZVEDKA-GITHUB-2026-09-14.md
  anchor: "запрет доступа ботом кроме API"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://developers.google.com/my-business/content/prereqs
  parent: internal:shtab/issledovanie/razvedka-2026-09-19/kritik.md
  anchor: "GBP API: профиль старше 60 дней"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://arxiv.org/abs/2608.07069
  parent: internal:docs/vidimost-tovarnyy-biznes.md
  anchor: "аудит 4 776 заведений — что влияет на попадание в ответы"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: наш тезис «число отзывов влияет, рейтинг нет» держится на нём

- https://arxiv.org/abs/2601.00912
  parent: internal:docs/vidimost-tovarnyy-biznes.md
  anchor: "Discovery Gap — малые бренды, ссылающиеся сайты и Reddit"
  predicted_relevance: 5/5
  depth: 1
  status: queued

- https://elevenlabs.io/docs/reception-ai/billing/plans-and-pricing
  parent: internal:Pivot/golos/CENY-RYNOK.md
  anchor: "ElevenLabs Reception $29/$79/$199"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: вендор о себе (bias.protocol_sponsored); прямой конкурент Веры на том же движке

- https://www.servicetitan.com/press/bill-joplins-air-conditioning-and-heating-books-over-90-of-calls-with-servicetitan-ai-voice-agent
  parent: internal:Pivot/koncepciya-ssha/KONCEPCIYA-SSHA.html
  anchor: "Bill Joplin's — ServiceTitan AI voice agent"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: вендор о своём клиенте; у нас уже разобрано как «не Retell, в среднем 70%»

- https://core.telegram.org/bots/api#businessbotrights
  parent: internal:Pivot/agenty/dogonyayushchiy/SPEC.md
  anchor: "BusinessBotRights.can_reply — окно 24 часа"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: ограничение Доводчика (c-0020)

## Без URL в наших файлах — найти первоисточник

- «Теряется 14–44% звонков по отраслям» (CallRail, Invoca, Numa) — стоит на живом `/vera/`; parent: internal:shtab/issledovanie/razvedka-2026-09-19/chast1_otvety.md:159-163
- «Замер на 70 млн звонков: 64% компаний не просят купить или записаться» — стоит на `/vera/`; источник в наших файлах не найден
- «86% звонков с неизвестного номера в США не берут» — стоит на `/vera/`; parent: internal:shtab/DOSKA.md (19.09)
- «Microsoft Clarity с 13.05.2026 и Search Console с 03.06.2026 бесплатно отдают видимость в ИИ» — стоит на `/visibility/`; parent: internal:shtab/issledovanie/razvedka-2026-09-19/chast1_otvety.md:61
- «Google LSA с 01.10.2026 списывает неотвеченный звонок >20 с как лид» (Search Engine Land / Roundtable) — parent: internal:shtab/DOSKA.md (19.09)
- «Каждый шестой малый бизнес имеет робота/IVR» (Talkdesk, 2025) — parent: mem:reference-vyborka-vendorov.md; не проверено
- Условия ElevenLabs про PHI/BAA (дословная цитата от 17.09 без URL) — parent: internal:Pivot/golos/KLINIKI-I-HIPAA.md
- Невада: лицензия для тайного покупателя / NRS 648 — parent: internal:shtab/DOSKA.md (20.09), internal:shtab/issledovanie/voronka-2026-09-20/kritik.md

### geo-mekh

- https://whitespark.ca/blog/case-study-the-prevalence-of-ai-overviews-in-local-search/
  parent: src-20260924-elev8-ai-search-stats (rejected aggregator)
  anchor: "AI Overviews appear on 68% of local business-type queries"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: 540 запросов, 6 ниш, 3 города США; где в местных запросах показываются AIO, а где карта. Вендор местного SEO, пометить bias

- https://arxiv.org/abs/2602.12187
  parent: src-20260924-geo-critical-survey-2026
  anchor: "SAGEO Arena"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: единственный сквозной тест с поиском и переранжированием; переписывание страницы снижает находимость

- https://arxiv.org/abs/2605.25517
  parent: src-20260924-geo-critical-survey-2026
  anchor: "Vishwakarma et al., What gets cited (SIGIR 2026)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: факторный эксперимент на 252 000 запусков; явные цены и свежие даты как факторы цитирования

- https://doi.org/10.18653/v1/2026.findings-acl.52
  parent: src-20260924-geo-critical-survey-2026
  anchor: "Kirsten et al., Characterizing web search in the age of generative AI (ACL 2026)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: рецензируемый аудит 4 706 запросов в США и Германии; стабильность AIO против органики

- https://proceedings.neurips.cc/paper_files/paper/2025/hash/27aa3aeff0f8460a7b43d30fa6c5c
  parent: src-20260924-geo-critical-survey-2026
  anchor: "C-SEO Bench: Does conversational SEO work?"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: ссылка из списка литературы обрезана, искать по названию

- https://arxiv.org/abs/2609.04047
  parent: src-20260924-zatuchin-sampling-completeness
  anchor: "The Dice Roll Method: a standardized protocol for repeated-query auditing"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: готовый протокол повторных замеров, сверить со Смотрителем

- https://arxiv.org/abs/2607.13304
  parent: src-20260924-zatuchin-sampling-completeness
  anchor: "variance-components decomposition of non-determinism in LLM brand answers"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: число повторов для стабильного среднего

- https://github.com/Rankfor/rankfor-open/tree/main/research/recommendation-saturation
  parent: src-20260924-zatuchin-sampling-completeness
  anchor: "data and code"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: открытые данные, можно пересчитать под наш критерий гарантии (c-0115)

- https://arxiv.org/abs/2606.25787
  parent: src-20260924-zatuchin-language-blind-spot
  anchor: "How Large Language Models Source Brand Reputation Across Languages and Markets"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: язык и рынок как факторы источников; к c-0106

- https://arxiv.org/abs/2606.23057
  parent: src-20260924-bali-venue-census-audit
  anchor: "Who owns the AI recommendation? category ownership"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://arxiv.org/abs/2607.23893
  parent: поиск geo-mekh (язык)
  anchor: "Who Gets Named: Citation Type Predicts Individual Naming by Grounded Language Models"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: кого из людей называют; касается «продукт — сам человек» (риэлторы, эксперты)

- https://arxiv.org/abs/2606.20065
  parent: поиск geo-mekh (замер)
  anchor: "GEO at Scale: Measuring Brand Visibility Across AI Search Engines (Ranqo)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: вендорская работа (bias.protocol_sponsored), 100K+ ответов; подборки «best X» как самый цитируемый формат; малые бренды на первом замере

- https://arxiv.org/abs/2604.27790
  parent: поиск geo-mekh
  anchor: "How Generative AI Disrupts Search: An Empirical Study of Google Search, Gemini, and AI Overviews (Grossman et al., SIGIR 2026)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: 11 500 запросов, Jaccard 0,11–0,18 между органикой, AIO и Gemini

- https://arxiv.org/pdf/2601.00912
  parent: src-20260924-discovery-gap-sharma
  anchor: "PDF полной работы"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитан только абстракт; разобрать методику и таблицы

- https://help.openai.com/en/articles/9237897-chatgpt-search
  parent: поиск geo-mekh
  anchor: "Searching the web with ChatGPT (OpenAI Help)"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: curl и WebFetch получили 403; нужен первоисточник о сторонних поисковых провайдерах, местоположении по IP и переписывании запроса («top restaurants San Francisco»)

- https://help.openai.com/en/articles/10093903-chatgpt-search-for-enterprise-and-edu
  parent: поиск geo-mekh
  anchor: "ChatGPT search for Enterprise and Edu (упоминает Bing)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: вероятно тоже 403; первоисточник связки ChatGPT и Bing

- https://www.implicator.ai/openais-rivalry-paradox-chatgpt-reportedly-leans-on-google-results/
  parent: src-20260924-seer-searchgpt-bing
  anchor: "ChatGPT reportedly leans on Google results (via SerpApi)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: вторичный пересказ The Information (22.08.2025); искать первоисточник или документы дела DOJ

- https://www.seerinteractive.com/insights/how-chatgpt-search-will-shape-your-strategy
  parent: src-20260924-seer-searchgpt-bing
  anchor: "how often ChatGPT uses training data vs web search"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.brightlocal.com/research/local-consumer-review-survey/
  parent: src-20260924-brightlocal-ai-listings
  anchor: "Local Consumer Review Survey 2026 (45% используют ИИ для поиска местного бизнеса)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: для листов auditoriya/nishi и prodazhi (спрос), не для механики

- https://ahrefs.com/blog/
  parent: src-20260924-ahrefs-schema-citations
  anchor: "AI Assistants Prefer to Cite Fresher Content (17 Million Citations Analyzed)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: свежесть как фактор; точный URL не извлечён

- (Omniscient Digital, 23 000+ citations, ~77% off-page)
  parent: src-20260924-elev8-ai-search-stats (rejected aggregator)
  anchor: "77% of the sources cited in AI answers about a brand are off-page"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: URL не извлечён, искать первоисточник; к contr-013

- https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/
  parent: src-20260924-ahrefs-llmstxt-137k
  anchor: "SE Ranking: llms.txt no effect on 300k domains"
  predicted_relevance: 3/5
  depth: 1
  status: fetched
  note: учтено в n-llmstxt-mostly-unread; первоисточник SE Ranking не открывали

- https://developers.google.com/search/docs/appearance/ai-features
  parent: src-20260924-google-ai-optimization-guide
  anchor: "AI features and your website"
  predicted_relevance: 4/5
  depth: 1
  status: fetched
  note: содержание перекрывается с руководством; уникальное (переобход от дней до месяцев) учтено в n-google-ai-features-core-search-index

- https://support.google.com/business/answer/3403100
  parent: src-20260924-google-gbp-verification
  anchor: "Add or remove Business Profile managers"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: проверить, что может менеджер без владельца (для таблицы трудозатрат)

- (Baig et al., 2026 — конджойнт по отелям; Iannelli and Ai, 2026 — рекомендация ассистента поднимает брендовые поиски на 4,3 п.п.)
  parent: src-20260924-bali-venue-census-audit
  anchor: "conjoint hotels / assistant recommendation lifts same-brand searches"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: ссылки не извлечены; Iannelli & Ai — редкое причинное свидетельство, что рекомендация ИИ двигает спрос

## Done

- https://arxiv.org/html/2311.09735 → src-20260924-geo-aggarwal-kdd2024
- https://arxiv.org/html/2607.14035 → src-20260924-geo-critical-survey-2026
- https://arxiv.org/html/2509.08919 → src-20260924-chen-geo-dominate-ai-search
- https://arxiv.org/html/2608.07069 → src-20260924-bali-venue-census-audit
- https://arxiv.org/html/2604.07585 → src-20260924-schulte-dont-measure-once
- https://arxiv.org/html/2609.05059 → src-20260924-zatuchin-sampling-completeness
- https://arxiv.org/html/2608.30052 → src-20260924-zatuchin-query-language-market
- https://arxiv.org/html/2606.23165 → src-20260924-zatuchin-language-blind-spot
- https://arxiv.org/abs/2601.00912 → src-20260924-discovery-gap-sharma
- https://arxiv.org/html/2606.04362 → src-20260924-watanabe-aeo-natural-experiment
- SparkToro, Google (руководство, GBP, подтверждение, отзывы), OpenAI/Perplexity/Anthropic (роботы), BrightLocal (×2), Seer, Search Atlas, Ahrefs (×2), Yelp → см. index-sources.md
- https://www.elev8operations.com/guides/ai-search-statistics-for-local-businesses-2026 → rejected (вторичный агрегатор)

### geo-rynok

- https://www.brightlocal.com/research/ (AI-отчёт BrightLocal о рекомендациях местного бизнеса, анонсирован в LCRS 2026)
  parent: src-20260924-brightlocal-lcrs-2026
  anchor: "We'll be digging more into the link between AI and local business recommendations"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: вероятный первоисточник «31% ищут местный бизнес через ИИ минимум раз в месяц; 43% перепроверяют в Google (июль 2026, 1 200+)» — цитирует Ermin без ссылки; также «ChatGPT 31% / AI Mode 23% / 88% перепроверяют» из пересказов

- https://www.brightlocal.com/research/local-consumer-review-survey-2025/
  parent: src-20260924-brightlocal-lcrs-2026
  anchor: "Previous editions 2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: проверить формулировку вопроса 2025 — объясняет ли она скачок 6% → 45%

- https://peec.ai/pricing
  parent: src-20260924-squarespace-ai-search-smb
  anchor: "Peec AI"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: цены рендерятся скриптом; без браузера не снять. Вторичные: $95/$245/$495, €75–89

- https://www.brightlocal.com (Managed Local SEO Services — состав работ за $1 299/мес)
  parent: src-20260924-brightlocal-pricing
  anchor: "Fully Managed Local SEO Service"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://help.brightlocal.com/hc/en-us/articles/37989673412114-What-is-Local-AI-Visibility
  parent: src-20260924-brightlocal-pricing
  anchor: "What is Local AI Visibility"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://updating.ai (Partner Program — оптовые цены white-label)
  parent: src-20260924-updating-ai-offer
  anchor: "See the Partner Program"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://otterly.ai (Agency Partners — условия партнёрства и white-label)
  parent: src-20260924-otterly-pricing
  anchor: "Agency Partners"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- WebFX GEO cost guide (26.05.2026)
  parent: src-20260924-citevio-dental-geo-pricing
  anchor: "WebFX GEO cost guide"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: первоисточник агентских вилок $1 500–5 000

- Digital Elevator AEO/GEO pricing guide (11.05.2026)
  parent: src-20260924-citevio-dental-geo-pricing
  anchor: "Digital Elevator pricing guide"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://searchengineland.com/ai-local-visibility-report-2026-468085
  parent: src-20260924-citevio-dental-geo-pricing
  anchor: "SOCi 2026 Local Visibility Index"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: curl дал 403; возможно, уже у geo-mekh. Первоисточник: https://www.soci.ai/insights/lvi/

- https://getcourtyard.ai/state-of-ai-visibility
  parent: src-20260924-courtyard-pricing
  anchor: "The State of AI Visibility 2026"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: механика (60% ответов уклоняются, цена не находится у ~3 из 4 бизнесов); скачано в staging raw/courtyard-state.html — отдать geo-mekh

- https://ermin.ai (кейсы, разбор салона в Манхэттене целиком; услуга Google Карты — цена)
  parent: src-20260924-ermin-ai-geo-ru
  anchor: "Читать разбор целиком"
  predicted_relevance: 4/5
  depth: 1
  status: queued

- https://www.ftc.gov/news-events/news/press-releases/2026/07/ftc-seeks-public-comment-policy-statement-addressing-ai-accuracy
  parent: src-20260924-ftc-active-listening
  anchor: "FTC policy statement addressing AI accuracy (из выдачи)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: передать pravo-ekonomika

- https://www.ftc.gov/news-events/news/press-releases/2026/08/ftc-finalizes-orders-cox-media-group-two-other-firms-settling-charges-they-deceived-customers-about
  parent: src-20260924-ftc-active-listening
  anchor: "finalized orders"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://openai.com/index/testing-ads-in-chatgpt/ и https://www.axios.com/2026/05/05/openai-self-serve-ad-platform
  parent: src-20260924-profound-series-d
  anchor: "Ads Studio / ChatGPT ads"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: оба отдали 403; нужен первоисточник о самостоятельном рекламном кабинете ChatGPT для бизнеса США (05.05.2026) — меняет формулу «место в ИИ нельзя купить»

- https://clientsfrommaps.com/gmbm ; https://liraltd.com/local-business-promotion-google-maps-usa/ ; https://svoi.us/companies
  parent: src-20260924-goupdigital-ru
  anchor: "русскоязычные подрядчики локального продвижения в США (из выдачи)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: проверить, продают ли что-то про ИИ и по каким ценам

- https://www.rush-agency.ru/prodvizhenie-sajta-v-ai/ ; https://vc.ru/marketing/3105745-geo-prodvizhenie-v-nevrosnetyakh-stoimost-i-budjet
  parent: src-20260924-ermin-ai-geo-ru
  anchor: "GEO-агентства России, цены в рублях (из выдачи)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: якорь «СНГ-цены» для русскоязычного покупателя; Rush заявляет работу на США

- Telegram-чаты и каналы русскоязычных предпринимателей США (Нью-Йорк, Майами, Лос-Анджелес, Чикаго)
  parent: c-0206
  anchor: "поиск предложений «продвижение в нейросетях»"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: вне возможностей WebSearch; нужен ручной просмотр Андреем/Машей

- https://www.pewresearch.org/wp-content/uploads/sites/20/2026/06/PI_2026.06.17_Americans-and-AI_REPORT.pdf
  parent: src-20260924-pew-americans-ai-2026
  anchor: "полный отчёт"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: есть ли разбивка по языку дома / месту рождения

### vera

- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7013259
  parent: src-20260924-habel-ai-voice-disclosure-2026
  anchor: "Selling with AI Voice Agents — полный текст"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: fetch_failed: Cloudflare. Нужны страна, отрасль, вход/выход звонка — закрывает contr-032.
- https://doi.org/10.1016/j.dss.2025.114579
  parent: src-20260924-habel-ai-voice-disclosure-2026
  anchor: "Jing et al. 2025, Emotion vs. information: AI-powered call systems, field experiment (Decision Support Systems)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Ещё один полевой эксперимент с ИИ-звонками; аннотация в Crossref отсутствует.
- https://arxiv.org/html/2609.11137
  parent: src-20260924-hiya-state-of-call-2026
  anchor: "The Machines Are Calling: automated and synthetic voices in unwanted inbound calls (arXiv, 09.2026)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Доля синтетических голосов в нежелательных звонках — фон недоверия к ИИ-голосу.
- https://arxiv.org/pdf/2603.29888
  parent: src-20260924-luo-chatbot-disclosure-2019
  anchor: "Generative AI in Action: field experiment Alibaba customer service (2026)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Enterprise — пограничный; но полевые данные о реакции клиентов на GenAI.
- https://www.researchgate.net/publication/362792567_Effect_of_SMS_reminders_on_Attendance_Rates_for_Healthcare_Appointments_A_Systematic_Review_Meta-Analysis
  parent: src-20260924-cochrane-sms-reminders-2013
  anchor: "Метаанализ SMS-напоминаний 2022"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Обновить размер эффекта c-0308.
- https://www.clio.com/resources/legal-trends/
  parent: src-20260924-clio-secret-shopper-2024
  anchor: "Clio Legal Trends Report 2024, полный текст"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Методика тайной покупки, разбивка по практикам (иммиграция, травмы).
- https://www.invoca.com/blog/how-much-missed-sales-calls-cost-home-services-businesses
  parent: src-20260924-invoca-lead-conversion-2026
  anchor: "Invoca: 27% звонков в дом-сервис без ответа, <3% оставляют голосовое"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Сырой HTML уже в staging raw/invoca-hs.html; вендор, без методики.
- https://www.searchenginejournal.com/chatgpt-calls-turn-into-leads-more-often-invoca-report/582400/
  parent: src-20260924-invoca-lead-conversion-2026
  anchor: "SEJ: звонки из ChatGPT чаще становятся лидами"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Для связки Видимость ↔ Вера (ветка vidimost).
- https://www.salesforce.com/resources/research-reports/state-of-the-connected-customer/
  parent: src-20260924-gartner-customers-ai-service-2024
  anchor: "Salesforce State of the Connected Customer (72% важно, человек или ИИ)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Проверить формулировку и выборку.
- https://www.surveymonkey.com/curiosity/customer-service-statistics/
  parent: src-20260924-gartner-customers-ai-service-2024
  anchor: "SurveyMonkey 12.2025: 79% из 2 017 американцев предпочитают человека"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Свежий опрос США о человеке против ИИ.
- https://www.metrigy.com/how-ai-voice-agents-handle-peak-customer-demand/
  parent: src-20260924-gartner-customers-ai-service-2024
  anchor: "Metrigy Q1 2026 Consumer CX Index: 59,1% готовы попробовать ИИ при эскалации"
  predicted_relevance: 3/5
  depth: 2
  status: queued
  note: Подкрепляет c-0307.
- https://www.podium.com/pricing/
  parent: src-20260924-hatch-pricing
  anchor: "Podium AI Employee (голос + текст)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Цены по запросу; комплект-конкурент.
- https://www.goodcall.com/pricing
  parent: src-20260924-myaifrontdesk-pricing
  anchor: "Goodcall: $79/$129/$249 за 100/250/500 уникальных клиентов, минуты без лимита"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Сырой HTML в staging raw/p-goodcall.html; альтернативная единица цены — «уникальный клиент».
- https://newo.ai/pricing/
  parent: src-20260924-myaifrontdesk-pricing
  anchor: "Newo.ai: $0 + $1,75/единица или $299 за 200 единиц (единица ≈ звонок или 30 SMS)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Сырой HTML в staging raw/p-newo.html; общая единица голос+текст — пример для абонентки Доводчика.
- https://www.slang.ai/pricing
  parent: src-20260924-smithai-pricing
  anchor: "Slang.ai (рестораны): $399/$599 за точку, английский и испанский"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: Сырой HTML в staging raw/p-slang.html; ниша рестораны.
- https://www.gosameday.com/pricing
  parent: src-20260924-smithai-pricing
  anchor: "Sameday (дом-сервис) — цены рендерятся JS"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Нужен браузерный рендер; браузер запрещён брифом.
- https://www.avoca.ai/pricing
  parent: src-20260924-smithai-pricing
  anchor: "Avoca (дом-сервис) — страница пустая без JS"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Нужен браузерный рендер.
- https://www.arini.ai/pricing
  parent: src-20260924-smithai-pricing
  anchor: "Arini (стоматологии) — страница пустая без JS"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: В прозвоне 23.09 Arini стоит у стоматологий Normandy Lake.
- https://www.retellai.com/pricing
  parent: src-20260924-highlevel-pricing
  anchor: "Retell: $0,07–0,31/мин"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Покрывает ветка pravo-ekonomika (ekonomika/sebestoimost).
- https://vapi.ai/pricing
  parent: src-20260924-highlevel-pricing
  anchor: "Vapi: $0,05/мин хостинг + провайдеры"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Покрывает ветка pravo-ekonomika.
- https://help.gohighlevel.com/support/solutions/articles/155000006652
  parent: src-20260924-highlevel-pricing
  anchor: "HighLevel AI Product Pricing Update (поминутная цена Voice AI)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: Закрыть поминутную цену голоса у агентств.
- https://voicegenie.ai/en/voice-ai-agent-in-russian
  parent: src-20260924-casegen-russian-intake
  anchor: "VoiceGenie: Russian voice AI agent"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Проверить, продаёт ли кто-то русскоязычным владельцам в США.
- https://www.openmic.ai/language/russian
  parent: src-20260924-casegen-russian-intake
  anchor: "OpenMic: Russian voice agent"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: 
- https://elevenlabs.io/agents/bilingual-answering-service
  parent: src-20260924-casegen-russian-intake
  anchor: "ElevenLabs: bilingual answering service"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Движок Веры; есть ли у ElevenLabs готовый продукт, конкурирующий с нами.
- https://journals.sagepub.com/doi/full/10.1177/14614448231203695
  parent: src-20260924-pew-social-media-use-2025
  anchor: "Trauthig & Woolley 2025: мессенджеры в диаспорах США"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Мессенджеры иммигрантских общин; про русскоязычных — проверить.
- https://www.leadsixty.com/guides/how-ai-receptionists-work
  parent: src-20260924-411locals-unanswered-calls
  anchor: "разбор происхождения 62% (источник «2013–2015» из нашей разведки 19.09)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Нужен, чтобы закрыть contr-030.
- https://web.archive.org/web/2016/https://411locals.us/small-business-owners-dont-answer-62-of-phone-calls/
  parent: src-20260924-411locals-unanswered-calls
  anchor: "архив 411 Locals"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Проверить, были ли даты замера в ранней версии статьи.
- https://www.callrail.com/
  parent: src-20260924-callrail-lead-benchmarks-2025
  anchor: "полный отчёт CallRail 01.2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Определение «пропущенного» и период.
- https://www.leadresponsemanagement.org/lrm_study/
  parent: src-20260924-mit-insidesales-lead-response
  anchor: "LRM study page"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: Вряд ли что-то новое.
- https://doi.org/10.1016/j.jbusres.2026
  parent: src-20260924-habel-ai-voice-disclosure-2026
  anchor: "Hunter, Gonzalez, Habel 2026, Journal of Business Research — ИИ-агенты в продажах (обзор)"
  predicted_relevance: 2/5
  depth: 2
  status: queued
  note: DOI не найден; искать по названию.

### auditoriya

- https://www2.census.gov/programs-surveys/acs/data/pums/2024/1-Year/ (csv_pny, csv_pca, csv_pfl, csv_pnj, csv_pwa, csv_pil, csv_ppa — ~224 МБ)
  parent: src-20260924-acs-yazyk-doma-russkiy
  anchor: "ACS PUMS 2024 микроданные"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: единственный способ получить прямое число русско- и украиноязычных владельцев фирм по отраслям (LANP × COW × INDP); закрывает c-0403 и c-0415. Большая загрузка — ждёт разрешения Андрея. Census API теперь требует ключ (регистрация запрещена).
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3233673
  parent: src-20260924-lane-2021-doverie-russkoyazychnyh
  anchor: "Kogan et al. 2018 — мотивация русскоязычных предпринимателей (11 владельцев фирм на 3–20 сотрудников)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: fetch_failed (SSRN/ResearchGate 403), см. _borderline/src-20260924-kogan-2018-russian-entrepreneurs
- https://www.migrationpolicy.org/article/ukrainian-immigrants-united-states
  parent: src-20260924-acs-mesto-rozhdeniya-sng
  anchor: "MPI: Ukrainian Immigrants in the United States"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: fetch_failed (Cloudflare 403), см. _borderline/src-20260924-mpi-ukrainian-immigrants
- https://rusrek.com/mall/repair_and_construction_services-b122_0-ru/
  parent: src-20260924-svoi-us-katalog
  anchor: "Русская реклама: ремонтно-строительные услуги (доска объявлений)"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: 403 Cloudflare; проверить, есть ли русскоязычные ремесленники в объявлениях (опровергает или подтверждает n-remeslenniki-pochti-net-v-russkih-katalogah)
- https://tgstat.com/
  parent: src-20260924-telegram-soobshchestva-ssha
  anchor: "статистика Telegram-каналов (охваты постов, ER)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: поиск и теги 403; нужны охваты постов, а не только подписчики
- https://t.me/SalesCHATIKbot
  parent: src-20260924-telegram-soobshchestva-ssha
  anchor: "прайс рекламы сети CHATIK"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: бот, без входа не открыть; прайс узнать вручную (Андрей/Маша)
- https://www.youtube.com/@IlyaLantsman
  parent: src-20260924-youtube-instagram-ssha
  anchor: "Хочешь стать героем интервью? Запишись"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: условия гостевого эфира; без форм и регистраций с нашей стороны — только прочитать
- https://svoi.us/vloggers
  parent: src-20260924-svoi-us-katalog
  anchor: "Русскоязычные влоггеры в США"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: сохранён (vloggers.html), не разобран
- https://cvsa.org/news/elp-oosc-06252025
  parent: src-20260924-fmcsa-non-domiciled-cdl-rule
  anchor: "English Proficiency как out-of-service критерий с 25.06.2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: 403 Cloudflare; нужен как первоисточник к n-angliyskiy-u-voditeley-snyatie-s-reysa
- https://www.cnbc.com/2025/12/10/trump-transportation-duffy-truckers-fired-english.html
  parent: src-20260924-iri-entrepreneurial-spirit-2026
  anchor: "9 500 водителей сняты с дорог (декабрь 2025)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
- https://ukrainetaskforce.org/ukrainian-truck-drivers-at-risk-due-to-new-final-rule-that-restricts-noncitizen-eligibility-for-commercial-drivers-licenses/
  parent: src-20260924-freightwaves-ukrainskie-trakisty
  anchor: "Ukrainian Truck Drivers at Risk"
  predicted_relevance: 3/5
  depth: 1
  status: queued
- https://www.health.ny.gov/health_care/medicaid/redesign/mrt90/mltc_policy/2024/24-04_memo.htm
  parent: search (auditoriya)
  anchor: "CDPAP: переход на единого фискального посредника PPL"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: исторически крупная русскоязычная ниша Бруклина (home care); 600–700 посредников закрылись в 2025 — проверить, что стало с русскоязычными агентствами
- https://www.uscis.gov/humanitarian/uniting-for-ukraine/re-parole-process-for-certain-ukrainian-citizens-and-their-immediate-family-members
  parent: search (auditoriya)
  anchor: "U4U re-parole; TPS Ukraine до 19.10.2026 (по сниппету)"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: подтвердить дату TPS первоисточником
- https://www.dhs.gov/sites/default/files/2024-12/2024_1104_dmo_plcy_uniting_for_ukraine_process_overview_and_assessment.pdf
  parent: search (auditoriya)
  anchor: "DHS: U4U overview and assessment (158 тыс. прибывших к 30.09.2023)"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: скачан в staging raw/dhs-u4u.pdf, не обработан (данные только на 2023 год)
- https://www.roofingcontractor.com/articles/100649-2025-homeowner-roofing-survey-tracking-the-journey
  parent: src-20260924-roofing-contractor-homeowner-2026
  anchor: "опрос домовладельцев 2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued
- https://www.fieldboss.com/blog/hvacs-real-problem-isnt-price-its-poor-communication/
  parent: search (auditoriya)
  anchor: "HVAC: 50% предпочитают звонок"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: вендор — пометить protocol_sponsored
- https://ua2usa.org/impact-study
  parent: src-20260924-ise-ua2usa-ukrainskiy-biznes
  anchor: "полный отчёт UA2USA"
  predicted_relevance: 3/5
  depth: 1
  status: queued

### prodazhi

- https://www.census.gov/library/working-papers/2026/adrm/CES-WP-26-25.html
  parent: src-20260924-census-btos-ai-use-2026
  anchor: "The Microstructure of AI Diffusion: Evidence from Firms, Business Functions, and Worker Tasks"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: причины неиспользования ИИ и ИИ в обслуживании клиентов по размерам фирм — закрывает contr-050

- https://www.census.gov/data/experimental-data-products/business-trends-and-outlook-survey.html
  parent: src-20260924-census-btos-ai-use-2026
  anchor: "BTOS Data (AI supplement)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: ряды по отраслям наших ниш (строительство, услуги, перевозки) и функции «customer service»

- https://www.nfib.com/news/press-release/new-nfib-report-how-small-businesses-incorporate-tech-and-ai-advancements/
  parent: src-20260924-nfib-small-business-technology-2025
  anchor: "NFIB press release (methodology)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: 403 при загрузке curl и WebFetch; нужен режим отбора и опроса

- https://quickbooks.intuit.com/r/small-business-data/ai-impact-report/
  parent: (поиск по вопросу 4 брифа)
  anchor: "2026 AI Impact Report (Intuit QuickBooks, 34,000+ owners, University of Chicago)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: curl не отдаёт страницу; PDF отчёта «без почты» — найти прямую ссылку; барьеры и ИИ в работе с клиентами

- https://quickbooks.intuit.com/r/small-business-data/april-2025-survey/
  parent: (поиск)
  anchor: "Small Business Insights April 2025 (2,200+ US businesses)"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://advocacy.sba.gov/ (поиск «artificial intelligence small business» 2025–2026)
  parent: (бриф, вопрос 4)
  anchor: "SBA Office of Advocacy — AI and small business"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://localiq.com/blog/2026-seo-insights/
  parent: src-20260924-localiq-smb-marketing-trends-2026
  anchor: "Insights from 300+ SMBs on SEO, GEO & Website Traffic in 2026"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: возражения владельцев именно к GEO

- https://www.goldmansachs.com/community-transformation/10000-small-businesses-voices/insights/ai-presents-a-major-opportunity-for-small-businesses
  parent: src-20260924-goldman-10ksb-ai-survey-2026
  anchor: "AI Presents a Major Opportunity for Small Businesses"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.gartner.com/en/newsroom (поиск «3x More Likely to Use Third-Party GenAI Than Company-Provided Chatbots»)
  parent: src-20260924-gartner-customers-prefer-no-ai-cs
  anchor: "Customers Are 3x More Likely to Use Third-Party GenAI"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_2_advertising/
  parent: (вопрос 2 брифа: юристы как партнёры)
  anchor: "ABA Model Rule 7.2 + этические мнения палат штатов (NY, CA, FL) о получении юристом вознаграждения от поставщика"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: до первого разговора с юристом-партнёром

- (поиск) state insurance code — referral fees paid to licensed insurance agents by non-insurance vendors (CA, NY, FL)
  parent: (вопрос 2 брифа)
  anchor: "страховые агенты как партнёры"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.dca.ca.gov/cba/ (California Business and Professions Code §5061 — commissions for CPAs)
  parent: src-20260924-aicpa-code-1-520-referral-fees
  anchor: "штатные правила о комиссиях CPA"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.journalofaccountancy.com/issues/2020/nov/cpa-referrals-unintended-consequences/
  parent: src-20260924-aicpa-code-1-520-referral-fees
  anchor: "Unintended consequences of professional referrals"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://journals.sagepub.com/doi/abs/10.1509/jmr.14.0653
  parent: src-20260924-schmitt-referral-programs-value-2011
  anchor: "How Customer Referral Programs Turn Social Capital into Economic Capital (2018)"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://www.facebook.com/business/help/1852644738394400
  parent: (дополнение координатора: языковой таргетинг Meta)
  anchor: "Advertising in multiple languages on Meta technologies"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: закрыто для curl/WebFetch, снимок Wayback пустой; нужен ручной просмотр

- https://transparency.meta.com/policies/ad-standards/ (раздел Personal Attributes)
  parent: (дополнение координатора)
  anchor: "Meta Advertising Standards — Personal Attributes"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: можно ли в тексте рекламы писать «для русскоязычных владельцев»

- https://metadata.io/b2b-advertising-benchmarks
  parent: src-20260924-metadata-b2b-meta-ads-cost-2026
  anchor: "B2B Advertising Benchmarks 2026 (method, company-size cuts)"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://ads.telegram.org/tos
  parent: src-20260924-telegram-ad-platform-docs
  anchor: "Telegram Ad Platform Terms of Service"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: плюс официальное подтверждение таргетинга по пользователям/странам (кабинет Stars/евро) — сейчас только сторонние обзоры

- (поиск) YouTube in-stream / Demand Gen cost per lead B2B 2025–2026 benchmark
  parent: (дополнение координатора)
  anchor: "YouTube-реклама: CPV/CPL"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: сначала ответ Андрея, входит ли YouTube-реклама (кабинет Google Ads) в запрет

- https://business.yelp.com/yelp-receptionist-demo/
  parent: src-20260924-yelp-host-receptionist-launch-2025
  anchor: "Yelp Receptionist — pricing and terms"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: вероятно, берёт полоса vera/rynok-i-ceny

- https://blog.yelp.com/news/fall-product-release-2025/
  parent: src-20260924-yelp-host-receptionist-launch-2025
  anchor: "Fall Product Release 2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- https://instantly.ai/blog/email-sequence-benchmarks-2026-whats-a-good-open-rate-reply-rate-and-cost-per-meeting/
  parent: src-20260924-instantly-cold-email-benchmark-2026
  anchor: "Email Sequence Benchmarks 2026 (cost per meeting)"
  predicted_relevance: 3/5
  depth: 1
  status: queued

- (поиск) Podium contract terms — 12-month auto-renew, первоисточник
  parent: src-20260924-podium-ai-employee-page (_rejected)
  anchor: "Podium contract"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: довод для возражения «контракт»

- (поиск) Ebsta / Pavilion 2024 B2B Sales Benchmarks — partner referrals share of pipeline vs revenue
  parent: (поиск по вопросу 2)
  anchor: "partner referrals 10% of pipeline, 31% of revenue"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: цифра пришла из вторичного пересказа, не проверена

- https://digitalapplied.com/blog/webinar-statistics-2026-attendance-conversion-data
  parent: (поиск по вебинарам)
  anchor: "12,400 B2B webinars, median live attend 41.6%"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: агрегатор; найти первоисточник (GoTo / BrightTALK benchmark)

### pravo-ekonomika

- https://openai.com/policies/services-agreement/
  parent: src-20260924-gemini-api-terms
  anchor: "OpenAI Services Agreement / Usage Policies"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: fetch_failed (403) — нужен для c-0613: можно ли хранить и анализировать ответы API с поиском (замер Видимости). Лежит в _borderline.

- https://www.perplexity.ai/hub/legal/perplexity-api-terms-of-service
  parent: src-20260924-perplexity-api-pricing
  anchor: "API terms"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: fetch_failed (403); c-0613.

- https://telnyx.com/pricing/call-control
  parent: src-20260924-retell-pricing
  anchor: "Telnyx voice pricing"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: страница на JS, цифр в HTML нет; в расчёте цены Telnyx из TELEFONIYA-ALTERNATIVY.md.

- http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0501/Sections/0501.616.html
  parent: src-20260924-florida-ftsa-501-059
  anchor: "Florida Telemarketing Act §501.616"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: часы и лимит частоты продажных звонков/текстов во Флориде (наша аудитория, кейс Тампа).

- https://www.fcc.gov/document/fcc-proposes-first-ai-generated-robocall-robotext-rules
  parent: src-20260924-fcc-24-17-ai-voice
  anchor: "AI disclosure NPRM (2024)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: статус правила о раскрытии ИИ в звонках; может распространить раскрытие на любые звонки.

- https://www.courtlistener.com/docket/69595438/taylor-v-conversenow-technologies-inc/
  parent: src-20260924-taylor-v-conversenow
  anchor: "docket"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: следить за итогом (класс, мировое, решение по существу). CourtListener блокирует наши инструменты — искать копии на govinfo.gov.

- https://www.nortonrosefulbright.com/en-us/knowledge/publications/c3cfc1aa/court-dismisses-autonation-cipa-suit-on-jurisdiction-grounds
  parent: search (CIPA AI receptionist 2026)
  anchor: "AutoNation / Invoca dismissal (06.2026)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: контрпример к c-0602 (прекращено по юрисдикции); найти сам приказ.

- https://basilai.app/articles/2026-06-21-in-re-otter-ai-privacy-litigation-may-2026-hearing-explained.html
  parent: search (CIPA AI 2026)
  anchor: "In re Otter.AI Privacy Litigation"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: вторичный; искать приказ N.D. Cal. (08.2026) — ИИ-запись встреч, CIPA.

- https://www.sidley.com/en/insights/newsupdates/2026/09/californias-sb-690-clears-the-legislature-what-it-means-for-cipa-website-tracking-claims
  parent: search (SB 690)
  anchor: "SB 690 clears legislature (09.2026)"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: по поиску — касается только pen register на сайтах, звонков не меняет; проверить подписан ли и текст.

- https://le.utah.gov/xcode/Title13/Chapter75/13-75.html
  parent: src-20260924-maine-ai-chatbot-disclosure
  anchor: "Utah AI Policy Act"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: раскрытие ИИ по вопросу / для регулируемых профессий.

- https://www.ftc.gov/legal-library/browse/rules/rule-use-consumer-reviews-testimonials
  parent: src-20260924-ftc-operation-ai-comply
  anchor: "Consumer Reviews Rule (16 CFR 465)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: запрет фальшивых отзывов и покупки отзывов — прямо касается работ по отзывам в Видимости.

- https://www.ftc.gov/legal-library/browse/cases-proceedings/donotpay
  parent: src-20260924-ftc-operation-ai-comply
  anchor: "DoNotPay case"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: текст приказа о «замене профессионала».

- https://www.ftc.gov/system/files/ftc_gov/pdf/AiraiMotionforTRO.pdf
  parent: src-20260924-ftc-air-ai-case
  anchor: "Motion for TRO"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: доказательная база FTC (скриншоты рекламы).

- https://www.twilio.com/en-us/hipaa/eligible-products-and-services
  parent: src-20260924-twilio-hipaa
  anchor: "HIPAA eligible products"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: входят ли Programmable Voice и Media Streams.

- https://help.twilio.com/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ
  parent: src-20260924-twilio-10dlc-fees
  anchor: "Campaign Vetting FAQ"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: сроки одобрения кампании (влияет на срок запуска). Zendesk API: support.twilio.com/api/v2/help_center/en-us/articles/11587910480155.json (уже скачан в raw, не обработан).

- https://www.anthropic.com/legal/aup
  parent: src-20260924-anthropic-commercial-terms
  anchor: "Usage Policy"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: дочитать для c-0613 (Anthropic часть — M).

- https://dataforseo.com/pricing/ai-optimization/llm-mentions
  parent: src-20260924-dataforseo-serp-pricing
  anchor: "LLM Mentions API pricing"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: альтернатива собственному замеру; страница на JS.

- https://resend.com/pricing ; https://www.netlify.com/pricing/
  parent: exp-20260924-yunit-ekonomika
  anchor: "infra allocation $3/client"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: в расчёте заложено $3/клиент/мес без проверки.

- McLaughlin Chiropractic v. McKesson (U.S. Supreme Court, 2025); Insurance Marketing Coalition v. FCC (11th Cir., Jan 2025)
  parent: src-20260924-fcc-47-cfr-64-1200
  anchor: "статус толкований FCC и правила one-to-one consent"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: из знаний модели, не из обработанных источников; проверить первоисточники.

### meta-algoritm

Справку Meta открывать только инструментом коннектора `ads_get_help_article` (curl/WebFetch на facebook.com/business/help отвечают ошибкой). Статьи с пометкой «пришла в ответе» уже прочитаны целиком, но не оформлены источником (лимит 8–12 на агента).

- https://www.facebook.com/business/help/153514848493595
  parent: src-20260927-meta-help-significant-edits
  anchor: "about advantage+ campaign budget"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; «лучше всего подходит кампаниям хотя бы с двумя группами», CBO может отдать почти весь бюджет одной группе — к c-0718

- https://www.facebook.com/business/help/458847204894307
  parent: src-20260927-meta-help-daily-budgets
  anchor: "about campaign budgets and ad set budgets"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; ad set budget sharing (до 20% бюджета делится между группами), когда что выбирать; opportunity score «не гарантирует результат»

- https://www.facebook.com/business/help/1870791083202806
  parent: src-20260927-meta-help-daily-budgets
  anchor: "budget is too low"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; минимальный бюджет считается как дневная сумма и для lifetime-бюджета (N дней × минимум); самих сумм нет

- https://developers.facebook.com/docs/marketing-api/adset/budget-limits/
  parent: src-20260927-meta-help-daily-budgets
  anchor: "Budget limits (Marketing API)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: минимальные дневные бюджеты по типу оплаты; curl вернул 400 (редирект на /docs/marketing-api), WebFetch — обрезанный JS; нужен другой способ извлечения

- https://www.facebook.com/business/help/202297959811696
  parent: src-20260927-meta-help-audience-language
  anchor: "about location targeting in meta ads manager"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: пришла в ответе; место = «живёт, недавно был или часто бывает», точность не гарантирована, исключение мест работает по текущему и домашнему месту — первоисточник к c-0717

- https://www.facebook.com/business/help/1852644738394400
  parent: src-20260927-meta-help-audience-language
  anchor: "advertising in multiple languages on meta technologies"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; без выбора языка Meta показывает тем, кто по прогнозу понимает язык креатива; ИИ-переводы — русского среди направлений нет

- https://www.facebook.com/business/help/25941857932125812
  parent: src-20260927-meta-help-audience-controls
  anchor: "choose audience settings in advantage+ campaigns"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; тот же интерфейс для целей Sales/Leads/App promotion; «Advantage+ off» при снятии подсказок; есть маркетинговое «proven to drive performance»

- https://www.facebook.com/business/help/414975413946182
  parent: src-20260927-meta-help-audience-controls
  anchor: "use advantage+ custom audience"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: пришла в ответе; custom audience как подсказка выходит за исходный список; controls (место, возраст, язык) продолжают действовать

- https://www.facebook.com/business/help/182371508761821
  parent: src-20260927-meta-help-detailed-targeting-updates
  anchor: "about detailed targeting"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: пришла в ответе; на каких сигналах строится DT (клики по рекламе, страницы, группы, устройство, приложения)

- https://www.facebook.com/business/help/436113280262012
  parent: src-20260927-meta-help-relevance-diagnostics
  anchor: "how to use ad relevance diagnostics"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; таблица сочетаний трёх рейтингов с толкованием; «оптимизируйте под цель, а не под рейтинги»; поднять «ниже среднего» до «среднего» важнее, чем «средний» до «выше»

- https://www.facebook.com/business/help/2351270371824148
  parent: src-20260927-meta-help-relevance-diagnostics
  anchor: "about engagement rate ranking"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: пришла в ответе; «средний» = 35–55 перцентиль; только за последние 35 дней

- https://www.facebook.com/business/help/766697140509126
  parent: src-20260927-meta-help-ad-volume
  anchor: "ad limits per page"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: пришла в ответе; 250 объявлений (работающих или на проверке) на страницу у рекламодателя до $100k в самый дорогой месяц; лимит на страницу, а не на аккаунт

- https://www.facebook.com/business/help/1738164643098669
  parent: src-20260927-meta-help-ab-testing
  anchor: "about a/b testing"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: пришла в ответе; Meta не рекомендует тестировать ручным включением и выключением групп — аудитории пересекаются, результат ненадёжен

- https://www.facebook.com/business/help/423781975167984
  parent: src-20260927-meta-help-ad-auctions
  anchor: "about ad quality"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: ДЛЯ C. Пришла в ответе; систематически низкокачественные или нарушающие правила объявления могут понизить оценку ВСЕХ объявлений страницы, домена и аккаунта. Проверить, не взял ли C (у него есть src-20260927-meta-help-ad-quality-best-practices)

- (URL не дан в ответе) поиск справки: "about the flexible ad format"
  parent: src-20260927-meta-help-ad-volume
  anchor: "flexible ad format"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: ДЛЯ C. Выбор «4–6 объявлений» против «одно объявление с несколькими ассетами (до 10)»: второе экономит обучение, первое показывает, какой креатив сработал (c-0713)

- (URL не дан в ответе) поиск справки: "combine ad sets and campaigns in meta ads manager to reduce audience fragmentation"
  parent: src-20260927-meta-help-learning-phase
  anchor: "about combining ad sets"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: как Meta советует объединять группы и читать разбивки

- (поиск справки для B) "call ads optimization performance goal calls what counts as result"
  parent: src-20260927-meta-help-learning-phase
  anchor: "результат оптимизации в рекламе со звонком"
  predicted_relevance: 5/5
  depth: 1
  status: fetched
  note: ДЛЯ B — закрыто листом B: c-0740 (оптимизация на звонки 60+ с, на 20+ с нет). Ссылка внесена в c-0700 и синтез

- (поиск справки для B) "advantage detailed targeting automatically on conversion performance goal calls"
  parent: src-20260927-loomer-targeting-inputs
  anchor: "принудительное расширение аудитории по цели оптимизации"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: ДЛЯ B. По Loomer, в оригинальных аудиториях при оптимизации на конверсии Advantage DT включён принудительно; относится ли к этому цель «звонки» — не проверено (c-0709)

- https://engineering.fb.com/2026/07/15/ai-research/exploring-hierarchical-interest-representation-for-meta-ads-deep-funnel-optimization/
  parent: src-20260927-meta-eng-gem
  anchor: "Hierarchical Interest Representation for deep funnel optimization"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: просмотрена целиком (текст в scratchpad агента A); ИССЛЕДОВАНИЕ: контент страниц и товаров рекламодателя (через LLM/vision) должен помогать при редких сигналах «глубокой воронки» и для «невиданных» рекламодателей; статус внедрения не ясен — прямо про маленьких рекламодателей без пикселя

- https://engineering.fb.com/2026/08/05/ml-applications/from-user-sequences-to-scaling-laws-a-multi-stage-architecture-for-metas-ads-ranking/
  parent: src-20260927-meta-eng-andromeda
  anchor: "multi-stage architecture for Meta's ads ranking"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: просмотрена; офлайн-модель пользователя (история в тысячи событий) + онлайн-ранжирование; самоотчёт +6% конверсий Instagram, +3% Facebook; часть GEM

- https://engineering.fb.com/2026/03/31/ml-applications/meta-adaptive-ranking-model-bending-the-inference-scaling-curve-to-serve-llm-scale-models-for-ads/
  parent: src-20260927-meta-eng-gem
  anchor: "Meta Adaptive Ranking Model"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: скачана, не прочитана; сервинг LLM-размерных моделей для рекламы; самоотчёт +3% конверсий, +5% CTR (Instagram, с Q4 2025)

- https://engineering.fb.com/2026/08/03/ml-applications/training-gem-at-llm-scale-meta-ads-recommendation-foundation-model/
  parent: src-20260927-meta-eng-gem
  anchor: "GEM training at LLM scale"
  predicted_relevance: 1/5
  depth: 1
  status: queued
  note: инфраструктура обучения; для таргетолога выводов не ждём

- https://engineering.fb.com/2026/03/17/developer-tools/ranking-engineer-agent-rea-autonomous-ai-system-accelerating-meta-ads-ranking-innovation/
  parent: src-20260927-meta-eng-andromeda
  anchor: "Ranking Engineer Agent (REA)"
  predicted_relevance: 1/5
  depth: 1
  status: queued
  note: внутренний агент инженеров ранжирования; для таргетолога выводов не ждём

- https://engineering.fb.com/2024/11/19/data-infrastructure/sequence-learning-personalized-ads-recommendations/
  parent: src-20260927-meta-eng-andromeda
  anchor: "sequence learning for personalized ads recommendations"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: предшественник статьи 05.08.2026

- https://www.jonloomer.com/facebook-ads-edits-learning-phase/
  parent: src-20260927-loomer-budgeting-updates
  anchor: "Facebook Ads Edits that Trigger the Learning Phase"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: по поиску — практик пишет, что в 2025 году новое объявление не всегда перезапускает обучение; против справки (c-0702) — проверить. Сайт 403, брать снимок Wayback

- https://www.jonloomer.com/big-change-to-meta-ads-location-targeting/
  parent: src-20260927-loomer-targeting-inputs
  anchor: "Big Change to Meta Ads Location Targeting"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: Meta убрала выбор «только живущие здесь» — осталось «живут или недавно были»; к c-0717

- https://www.jonloomer.com/how-advantage-plus-audience-works/
  parent: src-20260927-loomer-targeting-inputs
  anchor: "How Advantage+ Audience Works"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: снимок Wayback 2025-08-06 скачан в scratchpad агента A, не обработан; дублирует inputs

- https://www.jonloomer.com/meta-advertising-changes-2025/
  parent: src-20260927-loomer-budgeting-updates
  anchor: "83 Changes to Meta Advertising in 2025"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: сводка изменений 2025 года — сверить, не пропущено ли что-то в обучении и бюджетах

- (проверка в кабинете, не URL) поиск детального таргетинга: «Lived in», «Expats», «Russia», «Russian»
  parent: src-20260927-meta-help-detailed-targeting-updates
  anchor: "поведения Lived in Russia/Ukraine (Formerly Expats …)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: справка о консолидации интересов 2025 их не упоминает; проверяет таргетолог чтением перед планом (c-0710). Гайды практиков 2025–2026 (audiencekitchen.com, adenslab.com) утверждают, что поведения «Expats» есть, — без проверки

### meta-izmerenie

Прочитано, но не оформлено источником (ключевые факты — в note, чтобы следующему агенту не читать заново):

- https://www.facebook.com/business/help/1549971302464645
  parent: src-20260927-meta-help-lead-ads-with-calling
  anchor: "enable the callback requests feature in call ads"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана через ads_get_help_article. У «eligible advertisers» просьба перезвонить включена по умолчанию; выгрузка таблицей требует принять условия Lead Ads; поля CSV full_name, phone_number, callback_time; фраза «spreadsheet will include leads data on 20s calls» — неясно, отдаёт ли Meta данные звонивших. Для чек-листа таргетолога: галочку callback проверять при сборке.

- https://www.facebook.com/business/help/1997130013754737
  parent: src-20260927-meta-dev-insights-best-practices
  anchor: "how conversions are attributed in Commerce Manager (раздел Ads Manager)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана. Окно по умолчанию для новых групп — 7 дней клик или 1 день просмотр; модель last-touch; Ads Manager отчитывается по дате показа — расходится с документацией API (mixed с 10.06.2025), см. n-meta-insights-mixed-report-time.

- https://www.facebook.com/legal/technology_terms
  parent: src-20260927-meta-help-event-match-quality
  anchor: "Meta Business Tools Terms"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: прочитана через WebFetch (только пересказ, редакция 03.11.2025; curl отдаёт JS-заглушку). П. 3.b — заметное уведомление на каждой странице с пикселем (что собирается, что третьи стороны используют для рекламы, как отказаться, ссылки на opt-out); 1.a — хэширование контактов; 1.h — запрет данных детей до 13 лет, здоровья, финансов; 5.d — State-Specific Terms и LDU. Важно для pravo и для задачи ГОЛОСУ (/privacy).

- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140
  parent: src-20260927-meta-help-limited-data-use
  anchor: "CCPA §1798.140 — definitions (business, share)"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитан (curl). «Business» — если выручка больше $25 млн (с индексацией), или покупает/продаёт/передаёт данные 100 000+ потребителей или домохозяйств, или получает 50%+ выручки от продажи/передачи данных. «Share» — передача третьей стороне для cross-context behavioral advertising (пиксель подпадает). Для pravo: применим ли CCPA к Wealthboosterpro LLC — скорее нет, но это вывод юриста.

- https://developers.facebook.com/documentation/ads-commerce/conversions-api/offline-events
  parent: src-20260927-meta-help-about-conversions-api
  anchor: "Sending Offline Events Using the Conversions API"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитан (curl). Для офлайн-событий магазина action_source=physical_store, загрузка в течение 62 дней; дедупликация офлайн-событий только между собой — по order_id или по данным клиента, окно 7 дней; рекомендуют грузить в реальном времени или раз в сутки.

- https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/data-processing-options
  parent: src-20260927-meta-help-limited-data-use
  anchor: "Data Processing Options for US Users"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитан (curl). Коды штатов 1000–1013 (CA 1000, CO 1001, CT 1002, FL 1003, OR 1004, TX 1005, MT 1006, DE 1007, NE 1008, NH 1009, NJ 1010, MN 1011, MD 1012, RI 1013); даты вступления от 01.06.2023 (CA) до 17.11.2025 (RI). Пиксель: fbq('dataProcessingOptions', ['LDU'], 0, 0) до fbq('init').

- https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events
  parent: src-20260927-meta-dev-capi-server-event-parameters
  anchor: "Handling Duplicate Pixel and Conversions API Events"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитан (curl). Запасной способ дедупликации — event_name + fbp/external_id — работает, только если браузерное событие пришло раньше серверного; одинаковые события только из браузера или только с сервера не склеиваются.

- https://www.facebook.com/business/help/823677331451951
  parent: src-20260927-meta-help-about-conversions-api
  anchor: "about deduplication for Meta Pixel and Conversions API events"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана. Повторяет документацию; добавляет проверку через Test Events и Meta Ads Data Advisor.

- https://www.facebook.com/business/help/260370078559247
  parent: src-20260927-meta-help-capi-setup-options
  anchor: "about partner integrations for website events"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана. В списке партнёров для веб-событий Stripe нет; есть Zapier, LeadsBridge, Integromat (Make), Square, GoDaddy, Google Tag Manager, Stape и др.

- https://www.facebook.com/business/help/2040882565969969
  parent: src-20260927-meta-help-pixel-standard-events
  anchor: "test events tool: verify app and web browser events"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана. Веб-активность пишется, только пока открыта страница Test Events; в аналитике данные появляются через 30 минут и позже; тестовые данные держатся 24 часа. Серверные события — статья 1624255387706033.

- https://www.facebook.com/business/help/952192354843755
  parent: src-20260927-meta-help-pixel-standard-events
  anchor: "set up and install the Meta Pixel"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана. В мастере установки есть вариант «Meta-enabled, web-only Conversions API» и переключатель automatic advanced matching.

- https://www.facebook.com/business/help/337196340694086
  parent: src-20260927-meta-dev-insights-best-practices
  anchor: "differences between event counts in Ads Manager, Ads Reporting and Events Manager"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана. Events Manager показывает все полученные события (в том числе не от рекламы, без дедупликации на странице источников), Ads Manager — только атрибутированные и дедуплицированные; поэтому в Ads Manager цифры ниже.

- https://www.facebook.com/business/help/311705270326952
  parent: src-20260927-meta-dev-insights-best-practices
  anchor: "about Meta's modeled conversions"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана. Модель досчитывает конверсии при неполных данных и распределяет их между кампаниями, группами и объявлениями.

- https://www.facebook.com/business/help/478879057492537
  parent: src-20260927-meta-help-about-conversions-api
  anchor: "troubleshoot additional conversions reported"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: прочитана. Метрика «additional conversions reported» видна при перекрытии дедупликации от 50% и покрытии ключами от 70%; на нашем объёме её, скорее всего, не будет.

- https://www.facebook.com/business/help/155437961572700
  parent: src-20260927-meta-help-about-conversions-api
  anchor: "upload offline event data"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана. Ручная загрузка CSV в Events Manager; загруженное нельзя удалить или исправить; результат — до 15 минут.

- https://www.facebook.com/business/help/854500742637772
  parent: src-20260927-meta-help-attribution-models-settings
  anchor: "compare attribution settings in Meta Ads Manager"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана. Сравнение 1 день просмотр / 1 день клик / 7 дней клик / 28 дней клик независимо от окна оптимизации; 28 дней клик — частичные данные, пока кампании меньше 28 дней.

- https://www.facebook.com/business/help/1055388958765938
  parent: src-20260927-meta-help-attribution-models-settings
  anchor: "set up engage-through"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: прочитана. Engage-through — 1 день после 5 секунд видео или взаимодействия без клика по ссылке; недоступен для непропускаемых in-stream.

- https://www.facebook.com/business/help/147965221941551
  parent: src-20260927-meta-dev-insights-best-practices
  anchor: "about conversion count differences with third-party reporting tools"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана (и соседняя 511923449323749). Причины расхождений с нашей аналитикой: атрибуция по показу, кросс-девайс, блокировщики, реферер, часовой пояс, дата конверсии против даты показа.

- https://www.facebook.com/business/help/387152639648383
  parent: src-20260927-meta-help-about-conversions-api
  anchor: "about Conversions API Gateway"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: прочитана. Облако от $30 в месяц; Meta советует шлюз при тратах от $300 в месяц на веб-кампании — нам не нужен.

- https://www.facebook.com/business/help/317857030149451
  parent: src-20260927-meta-dev-capi-crm-conversion-leads
  anchor: "use a partner to connect your CRM for conversion leads"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: прочитана (и 279369167153556). Lead ID 15–16 цифр; слать все стадии воронки, включая «сырой лид»; в обучении — каждое изменение статуса.

Не прочитано:

- https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters
  parent: src-20260927-meta-dev-capi-server-event-parameters
  anchor: "Customer Information Parameters"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: форматирование и хэширование email и телефона, обязательные поля для событий сайта (IP, user agent) — нужно ГОЛОСУ до реализации CAPI.

- https://developers.facebook.com/documentation/ads-commerce/marketing-api/call-ads/callback-feature
  parent: src-20260927-meta-dev-call-ads-api
  anchor: "Callback feature"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: как callback выглядит в API — поможет проверить его статус в ответе коннектора.

- (URL неизвестен) поиск в ads_get_help_article: "about call insights in meta business suite"
  parent: src-20260927-meta-help-call-ads-metrics
  anchor: "about call insights in Meta Business Suite"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: может раскрыть, как Meta получает длительность звонка.

- (URL неизвестен) поиск в ads_get_help_article: "create a lead ad with call add-on"
  parent: src-20260927-meta-help-call-ads-create
  anchor: "create a lead ad with call add-on from Meta Ads Manager"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: инстант-форма со звонком — отдельный формат; не проверен.

- (URL неизвестен) поиск в ads_get_help_article: "landing page views optimization requires pixel"
  parent: src-20260927-meta-help-pixel-standard-events
  anchor: "реклама на лендинг без пикселя"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: инструкция §4 просит проверить, что можно без пикселя (клики или просмотры страницы); в этой ветке не проверено.

- (URL неизвестен) поиск в ads_get_help_article: "when to use domain verification"
  parent: src-20260927-meta-help-aggregated-event-measurement
  anchor: "learn when to use domain verification"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: зачем верифицировать businessinteldna.com, если для событий уже не нужно.

- https://www.jonloomer.com/qvt/three-metrics-for-call-ads/
  parent: src-20260927-meta-help-call-ads-metrics
  anchor: "Three Metrics for Call Ads (Jon Loomer)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: мнение практика; curl и WebFetch — 403 Cloudflare, Wayback — 429. Может объяснить механику измерения длительности.

- https://docs.stripe.com/webhooks
  parent: src-20260927-meta-help-capi-setup-options
  anchor: "Stripe webhooks (успешная оплата)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: какое событие вебхука брать для Purchase и какую сумму — для задачи ГОЛОСУ.

- https://zapier.com/apps/facebook-conversions/integrations/stripe/1203933/log-stripe-payments-as-facebook-purchase-events
  parent: src-20260927-meta-help-capi-setup-options
  anchor: "Zapier: Stripe → Facebook Conversions"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: витрина; запасной путь без кода.

#### Для A (algoritm-i-obuchenie)

- https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026
  parent: src-20260927-meta-dev-occ-2025
  anchor: "2026 Out-of-cycle changes"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: для A. С 22.06.2026 Nielsen DMA заменены на Comscore Markets в таргетинге и отчётах (breakdowns=dma больше не работает) — касается гео NY+LA. С 06.08.2026 разрезы frequency_value, impression_device и почасовой требуют отдельного включения в Ads Manager для части аккаунтов — касается правила инструкции «частота выше 2,5» (сама метрика frequency, похоже, остаётся; проверить).

- https://www.facebook.com/business/help/782657799338685
  parent: src-20260927-meta-help-lead-ads-performance-goals
  anchor: "best practices for value optimization"
  predicted_relevance: 3/5
  depth: 1
  status: fetched
  note: для A. Пороги обучения цели «ценность»: 100+ конверсий за 14 дней, 50+ в неделю, 3+ недели, пик через 2 недели (оформлено в c-0755).

- (URL неизвестен) Advantage+ campaign setup для целей Leads и Sales
  parent: src-20260927-meta-help-call-ads-create
  anchor: "you’re starting with advantage+ campaign setup"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: для A. Реклама со звонком в Leads/Sales сразу собирается в Advantage+ campaign setup — какие ручные настройки там остаются.

#### Для C (kreativy-i-pravila)

- https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026
  parent: src-20260927-meta-dev-occ-2025
  anchor: "Advantage+ creative: Image Animation, Video Filter, Video Uncrop (28.06.2026)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: для C. Новые автоулучшения креатива, включаются и выключаются по креативу через degrees_of_freedom_spec.

- https://www.facebook.com/business/help/378168646496279
  parent: src-20260927-meta-help-lead-ads-with-calling
  anchor: "ads labeled Ad instead of Sponsored"
  predicted_relevance: 2/5
  depth: 1
  status: fetched
  note: для C. Пометка рекламы в Facebook и Instagram теперь «Ad», а не «Sponsored».

### meta-kreativy

Формат как в `queue/to-follow.md`. Статьи с пометкой «получена» уже вытянуты коннектором или WebFetch в этой сессии, но в университет не оформлены (потолок объёма). Текст политической ИИ-статьи лежит в `fetched-not-processed/`.

#### Для этого листа (C)

- https://www.facebook.com/business/help/1210227555661027
  parent: src-20260927-meta-help-ads-in-review
  anchor: "what to do if your ad is rejected"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: получена. Обжалование в Business Support Home, решение «в пределах 48 часов», повторная проверка одна на объявление (второй раз не подать), удалённое объявление обжаловать нельзя, правка или удаление не снимают нарушение с аккаунта, запрос проверки «не вредит» репутации, повторная проверка — в основном люди. Закрывает вопрос 7 брифа «как обжаловать»

- https://www.facebook.com/business/help/980593475366490
  parent: src-20260927-meta-help-instagram-video-best-practices
  anchor: "about text overlays and the safe zone for ads on facebook and instagram"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: получена. 9:16 — свободны верх, низ и бока; 1:1 и 4:5 в ленте Instagram — низ и бока; на высоких экранах Meta может увеличить креатив и обрезать всё вне зоны; с дисклеймерами в Reels — свободные нижние 40%; в Ads Manager есть переключатель «safe zone guardrail»

- https://developers.facebook.com/documentation/ads-commerce/marketing-api/creative/advantage-creative/get-started
  parent: src-20260927-meta-help-advantage-creative
  anchor: "Advantage+ creative in Marketing API"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: прочитана WebFetch. Улучшения включаются по одному через degrees_of_freedom_spec → creative_features_spec → enroll_status OPT_IN/OPT_OUT; с v22.0 пакет standard_enhancements устарел; adapt_to_placement «Default is opt-in». Имена: add_text_overlay, description_automation, enhance_cta, image_animation, image_templates, image_text_translation, image_touchups, inline_comment, text_optimizations, text_translation, translate_voiceover, video_auto_crop и др.; music — через asset_feed_spec. Ключ к тому, что коннектор ставит по умолчанию

- https://www.facebook.com/business/help/180641596861873
  parent: src-20260927-meta-help-text-in-ads-best-practices
  anchor: "about text generation in meta ads manager"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: получена. До 5 вариантов основного текста и заголовка; «currently available when primary text inputs are in english, portuguese and spanish»; по вариантам текста отчёта нет — «reporting is based on a single ad»

- https://www.facebook.com/business/help/1486382031937045
  parent: src-20260927-meta-newsroom-genai-ads-transparency
  anchor: "about media created or edited with ai (SIEP)"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена, текст в staging/fetched-not-processed. Обязательное раскрытие ИИ только для соцтем и политики; мелкие правки не раскрываются; сторонний ИИ Meta ловит сама; автоматическую метку снять нельзя

- https://www.meta.com/help/artificial-intelligence/355108217670024/
  parent: src-20260927-meta-newsroom-genai-ads-transparency
  anchor: "How AI-generated images in ads are identified and labeled on Meta"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: прочитана WebFetch для сверки, выдержка в original.md ньюсрума. Можно оформить отдельным источником и поднять n-meta-samoraskrytie-ii-tolko-politika до H

- (URL не найден) политика «unrealistic outcomes» и «non-functional landing page» в Transparency Center
  parent: src-20260927-meta-help-ad-quality-best-practices
  anchor: "unrealistic outcomes"
  predicted_relevance: 5/5
  depth: 1
  status: queued
  note: справка о качестве требует её соблюдать, в новой карте стандартов её нет. Найти текст — от него зависит уверенность c-0785

- https://transparency.meta.com/policies/ad-standards/intellectual-property-infringement/third-party-infringement/
  parent: src-20260927-meta-cs-prohibited-commercial-practices
  anchor: "Third-Party Intellectual Property Infringement"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: нужно для второй кампании (Видимость): можно ли логотипы и названия ChatGPT, Claude, Perplexity (c-0799)

- https://www.facebook.com/business/help/2489235377779939
  parent: src-20260927-meta-cs-prohibited-commercial-practices
  anchor: "about meta's health and wellness advertising policy"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена. «До/после» у Meta ограничено в здоровье, похудении и косметике, а не везде; кликбейт с обещанием результата к сроку без оговорок запрещён в контексте здоровья. Для стоматологии как ниши клиента — важно

- https://www.facebook.com/business/help/1082295769403815
  parent: src-20260927-meta-help-advantage-creative
  anchor: "turn off advantage+ creative enhancements"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: получена, строки в original.md источника. Пошаговое выключение до и после публикации; часть улучшений — только в расширенном превью

- https://www.facebook.com/business/help/620917123959992
  parent: src-20260927-meta-help-advantage-creative
  anchor: "enable text improvements"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: получена, строки в original.md источника. Text improvements включено по умолчанию, опция «use ai to identify promotional phrases»

- https://help.instagram.com/759279452000505
  parent: src-20260927-meta-help-advantage-creative
  anchor: "how to add music to ads using ads manager"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена. При улучшениях Advantage+ «there will not be a breakdown by format or ad creative variation»; Meta советует сплит-тест

- https://www.facebook.com/business/help/243916866413404
  parent: src-20260927-meta-business-creative-diversification
  anchor: "understand creative-level performance in meta ads reporting"
  predicted_relevance: 4/5
  depth: 1
  status: queued
  note: получена. Разбивка отчёта «по креативу» вводится постепенно, не охватывает dynamic creative. Для B тоже (отчётность)

- https://www.facebook.com/business/help/3523404774339991
  parent: src-20260927-meta-help-text-in-ads-best-practices
  anchor: "about automatic language translation for ads"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена. Автоперевод постепенно убирают (замена — генеративный перевод); пар с русским языком в списке нет; качество перевода Meta не гарантирует

- https://www.facebook.com/business/help/2220749868045706
  parent: src-20260927-meta-help-special-ad-categories
  anchor: "about audiences for housing, employment or financial products and services campaigns"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена, две цитаты в original.md (18–65+, все полы, город + 15 миль, без исключений мест)

- https://transparency.meta.com/policies/ad-standards/unacceptable-content/discriminatory-practices/
  parent: src-20260927-meta-ad-standards-personal-attributes
  anchor: "Discriminatory Practices"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: прочитана WebFetch (21.12.2024), выдержка в original.md. Можно оформить, если понадобится полный список защищённых признаков

- https://www.facebook.com/business/help/503640323442584
  parent: src-20260927-meta-help-ad-quality-best-practices
  anchor: "how to avoid posting clickbait on facebook"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена. Примеры утаивания и преувеличения для чек-листа хуков

- https://www.facebook.com/business/help/313752069181919
  parent: src-20260927-meta-help-ads-in-review
  anchor: "how ads about social issues, elections or politics are reviewed"
  predicted_relevance: 2/5
  depth: 1
  status: queued
  note: получена. Иммиграция и экономика — соцтемы; реклама, которая в основном продаёт услугу, авторизации может не требовать. Держаться подальше от «эмигрант», налогов и политики в текстах

- https://www.facebook.com/business/help/817989058548892
  parent: src-20260927-meta-help-instagram-video-best-practices
  anchor: "video length specifications across placements"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: получена. Предельные длины по плейсментам (истории Facebook 1–120 с и т.д.)

- https://www.facebook.com/business/ads/ad-creative/
  parent: src-20260927-meta-business-creative-diversification
  anchor: "Expand Your Ad Creative Strategy"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: официальный гид Meta по креативу; не открывали

#### Для A (algoritm-i-obuchenie)

- https://www.facebook.com/business/help/537699989762051
  parent: src-20260927-meta-help-ads-in-review
  anchor: "understand auction overlap"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: для A. Объявления одного рекламодателя в одном аукционе не конкурируют — участвует одно с наибольшей ценностью; перекрытие мешает выйти из обучения; советы — объединять группы

- https://www.facebook.com/business/help/835561738423867
  parent: src-20260927-meta-business-creative-diversification
  anchor: "about the flexible ad format"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: для A и C. До 10 изображений и видео в одном объявлении, Meta сама выбирает формат; только цели Traffic, Engagement, Sales, App promotion — для рекламы со звонком, вероятно, недоступно (проверить)

#### Для B (zvonki-i-izmerenie)

- (наблюдение, не ссылка) качество рекламы со звонком
  parent: src-20260927-meta-help-ad-quality-best-practices
  anchor: "landing page bounce rate / dwell time"
  predicted_relevance: 3/5
  depth: 1
  status: queued
  note: для B. Сигналы качества Meta для рекламы на сайт — отказы и время на странице; для рекламы со звонком аналога в справке нет. Есть ли у Meta сигнал качества по длительности звонка — вопрос к листу B

## Done

<!-- пусто -->
