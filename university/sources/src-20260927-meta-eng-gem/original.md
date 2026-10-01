# Meta's Generative Ads Model (GEM): The Central Brain Accelerating Ads Recommendation AI Innovation — выписка

URL: https://engineering.fb.com/2025/11/10/ml-applications/metas-generative-ads-model-gem-the-central-brain-accelerating-ads-recommendation-ai-innovation/
Получено: 2026-09-27, curl (инженерный блог Meta, публичная статья, извлечение и очистка HTML из engineering.fb.com).

Полный текст здесь не хранится: это текст Meta (инженерный блог engineering.fb.com), защищённый авторским правом. Он открывается по URL.

## Пересказ по разделам

- GEM (Generative Ads Recommendation Model) — фундаментальная модель рекламных рекомендаций Meta, обученная «в масштабе больших языковых моделей» на тысячах GPU; крупнейшая такая модель в индустрии рекомендательных систем.
- Данные для обучения — контент объявлений и вовлечённость людей одновременно в рекламе и в органике. Причина: ежедневно миллиарды взаимодействий пользователь-объявление, но значимые сигналы (клики, конверсии) «очень разрежены» — модель должна обобщать по разным пользователям и поверхностям.
- Признаки делятся на последовательные (история действий человека — тысячи событий) и непоследовательные — атрибуты пользователя и объявления: возраст, место, формат объявления и «представление креатива» (creative representation).
- Перенос знаний между поверхностями (например, вовлечённость в видео в Instagram улучшает прогнозы для ленты Facebook) и дальше — в сотни «вертикальных» моделей ранжирования (VM) через дистилляцию, представление и разделение параметров; эффективность такого переноса знаний вдвое (2x) выше стандартной дистилляции.
- Архитектура GEM в 4 раза эффективнее прежних моделей ранжирования Meta на том же объёме данных и вычислений; новый обучающий стек даёт 23-кратный рост эффективных FLOPS при использовании в 16 раз большего числа GPU и росте загрузки GPU (MFU) в 1,43 раза.
- Результаты (самоотчёт Meta, без раскрытия методики): запуск GEM дал +5% конверсий рекламы в Instagram и +3% в ленте Facebook (Q2); в Q3 архитектурные улучшения удвоили отдачу от того же объёма данных и вычислений.
- Инженерные детали обучения: время старта задачи обучения сокращено в 5 раз, время компиляции PyTorch 2.0 — в 7 раз (кэширование).
- Планы на будущее: GEM должна научиться на всей экосистеме Meta — органике и рекламе в тексте, картинках, аудио и видео на Facebook и Instagram, двигаясь к единой модели, которая ранжирует и органический контент, и рекламу.

## Короткие цитаты для сверки (дословно)

> "meaningful signals — such as clicks and conversions — are very sparse."

> "GEM is trained on ad content and user engagement data from both ads and organic interactions."

> "such as user and ad attributes — e.g., age, location, ad format, and creative representation"

> "GEM only delivers impact if its knowledge can be efficiently transferred to hundreds of user-facing vertical models (VMs)."

> "a 5% increase in ad conversions on Instagram and a 3% increase in ad conversions on Facebook Feed in Q2."

> "now 4x more efficient at driving ad performance gains for a given amount of data and compute"
