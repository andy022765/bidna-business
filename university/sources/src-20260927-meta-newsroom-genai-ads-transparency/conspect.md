# Expanding GenAI Transparency for Meta's Ads Products — conspect

**Source**: https://about.fb.com/news/2025/02/gen-ai-transparency-metas-ads-products/
**Source ID**: src-20260927-meta-newsroom-genai-ads-transparency
**Author(s)**: Pedro Pavón, Director, Monetization Policy (Meta)
**Published**: 2025-02-03, обновлено 2026-06-01
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-27

## TL;DR

С февраля 2025 Meta ставит метку «AI info» на рекламу, созданную или существенно изменённую её собственными генеративными инструментами; мелкие правки без фотореалистичного человека метку не получают. Если в объявлении есть сгенерированный ИИ фотореалистичный человек, метка стоит рядом с «Sponsored» — её видно без нажатия. Обновление 01.06.2026: Meta сама распознаёт рекламу, сделанную сторонними ИИ-инструментами, по отраслевым сигналам и ставит «AI info» в «Об этой рекламе». Обязанности обычного рекламодателя самому раскрывать ИИ пост не вводит; голос и аудио не упоминает. Справка meta.com, прочитанная для сверки, добавляет: в рекламе на соцтемы, выборы и политику рекламодатель обязан раскрывать ИИ в изображении, видео и аудио.

## Thesis

Метку ИИ в коммерческой рекламе ставит сама Meta — по своим инструментам и по сигналам сторонних; обязанность рекламодателя раскрывать есть только в политической рекламе.

## Key points

- Своими инструментами: «created or significantly edited with our generative AI creative features» → «AI info» в меню «…» или рядом с «Sponsored».
- Фотореалистичный ИИ-человек → метка рядом с «Sponsored», «not behind the three-dot menu».
- Без существенных правок и без фотореалистичного человека — «we will not apply any AI labels».
- Сторонние инструменты: «begin automatically detecting ads created or edited using third-party AI tools through industry-standard signals. When detected, we'll apply an 'AI info' label» — в «About this ad».
- Охват: изображения и видео. Аудио и голос не упомянуты.
- Сверка (meta.com/help 355108217670024): «Not all ads will have AI info, like when there are minor changes or enhancements like image resizing or color correction»; соцтемы и политика — обязательное раскрытие ИИ «image, video or audio».

## Methods / evidence

Официальное заявление о политике платформы, обновлено через 16 месяцев после публикации. Эмпирики нет. Снято WebFetch в два прохода.

## Relevance to project

Вопрос 4. Наши ролики собраны покадровым HTML-движком и ffmpeg, сгенерированного ИИ-изображения в них нет — метка не ожидается. Если использовать Kling, Higgsfield или Nano Banana с реалистичными людьми, метка вероятна: у сторонних генераторов есть отраслевые сигналы. Для продукта, который сам ИИ-голос, метка не вредит посылу. Вредит другое: сгенерированный «владелец» или «клиент» в роли настоящего — это обманный отзыв по меркам FTC (c-0609) и удар по доверию, если метка стоит рядом с «Sponsored». Правила Meta для коммерческой рекламы про синтезированный голос молчат; раскрывать ИИ в голосе заставляют законы штатов и наш стандарт (c-0604).

## Extracted artefacts

- Notes: [n-meta-ai-info-instrumenty-meta], [n-meta-ai-info-fotorealistichnyy-chelovek], [n-meta-ai-info-storonnie-ii-s-2026], [n-meta-samoraskrytie-ii-tolko-politika]
- Claims: [c-0789], [c-0790]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.meta.com/help/artificial-intelligence/355108217670024/ | How AI-generated images in ads are identified and labeled | 4/5 | прочитана для сверки, выдержка в original.md; не оформлена отдельно |
| https://www.facebook.com/business/help/1486382031937045 | About media created or edited with AI (SIEP) | 3/5 | получена в сессии, текст в staging; не обработана — to-follow |

## Verbatim quotes (если критично)

> "When these tools result in the inclusion of an AI-generated photorealistic human, the label will appear next to the Sponsored label (not behind the three-dot menu)."
