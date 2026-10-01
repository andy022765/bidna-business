# Meta Andromeda: Supercharging Advantage+ automation with the next-gen personalized ads retrieval engine — выписка

URL: https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/
Получено: 2026-09-27, curl (инженерный блог Meta, публичная статья, извлечение и очистка HTML из engineering.fb.com).

Полный текст здесь не хранится: это текст Meta (инженерный блог engineering.fb.com), защищённый авторским правом. Он открывается по URL.

## Пересказ по разделам

- Andromeda — новая система первой ступени показа рекламы (retrieval): из десятков миллионов кандидатов-объявлений она отбирает несколько тысяч релевантных; окончательный набор для показа определяет следующая ступень — более крупные и сложные модели ранжирования.
- Две проблемы масштаба, которые решает Andromeda: объём кандидатов (retrieval обрабатывает на три порядка больше объявлений, чем следующие ступени) и жёсткие ограничения по задержке отклика.
- Рост числа объявлений подпитывают автоматизация Advantage+ (создание аудиторий, распределение бюджета, плейсменты, генерация креативов) и генеративный ИИ: больше миллиона рекламодателей за месяц создали генеративными инструментами Meta больше 15 млн объявлений.
- Архитектура: нейросеть под NVIDIA Grace Hopper Superchip и MTIA, иерархический индекс объявлений, обучаемый совместно с моделью ранжирования; ёмкость модели увеличена в 10 000 раз.
- Результаты внедрения на Instagram и Facebook (самоотчёт Meta, без раскрытия методики): +6% recall у retrieval и +8% качества рекламы на отдельных сегментах; рекламодатели, ранее не использовавшие Advantage+ creative и включившие его, получили +22% ROAS; по оценке Meta, генерация картинок даёт рекламодателям +7% конверсий.
- Технические детали: сегмент-зависимая «эластичность модели» (model elasticity) даёт ещё +10x к эффективности инференса; кастомные GPU-операции ускорили извлечение признаков и пропускную способность более чем в 100 раз по сравнению с прежними CPU-компонентами; сквозная пропускная способность модели (QPS) выросла более чем в 3 раза.
- Планы на будущее: переход архитектуры на авторегрессионную функцию потерь ради более разнообразного набора кандидатов-объявлений; с новым поколением GPU и MTIA Meta рассчитывает ещё примерно на 1000-кратный рост сложности модели.

## Короткие цитаты для сверки (дословно)

> "Retrieval is the first step in our multi-stage ads recommendation system."

> "selecting ads from tens of millions of ad candidates into a few thousand relevant ad candidates"

> "achieved +6% recall improvement to the retrieval system, delivering +8% ads quality improvement on selected segments."

> "they experienced a 22% increase in ROAS from our ads"

> "more than a million advertisers used our generative AI (GenAI) tools to create more than 15 million ads in a month"

> "a meaningful increase of model capacity (10,000x) for enhanced personalization"
