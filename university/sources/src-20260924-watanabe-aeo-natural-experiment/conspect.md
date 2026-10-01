# Disentangling Answer Engine Optimization from Platform Growth: A Log-Based Natural Experiment on ChatGPT Referral Traffic — conspect

**Source**: https://arxiv.org/html/2606.04362
**Source ID**: src-20260924-watanabe-aeo-natural-experiment
**Author(s)**: Keisuke Watanabe, Kazuki Nakayashiki
**Published**: 2026-06-03
**Quality**: 9/10
**Relevance**: 4/5
**Fetched**: 2026-09-24

## TL;DR

Полевое исследование на сайте glasp.co: в январе 2026 к части страниц применили набор AEO-работ, остальные страницы стали контролем. Переходы из ChatGPT выросли в 5,7 раза, но и нетронутые страницы выросли в 3,5 раза на росте платформы. Прерванный временной ряд даёт скачок ~1,8x, но консервативный плацебо-тест его не подтверждает. Главная мысль — сырые множители в AEO-кейсах завышают эффект.

## Thesis

Без контрольной группы рост трафика из ИИ после AEO-работ нельзя отделить от роста самих платформ.

## Key points

- Набор работ: канонические URL, новые страницы по несуществующим адресам, которые запрашивали боты, заголовки-вопросы и вводные ответы в 2–3 предложения, защита страниц с трафиком Google.
- Всего переходы ×5,7; нетронутые страницы ×3,5.
- ITS: скачок уровня ~1,82 (95% ДИ 1,31–2,54), изменение наклона незначимо.
- Плацебо-перестановка по времени: эффект не проходит консервативный порог — «наводящий».
- Органика Google на обработанных страницах не упала.

## Methods / evidence

Естественный эксперимент с контролем внутри домена, сегментированная регрессия по недельному отношению treated/control с HAC-ошибками, блочный бутстрэп, плацебо во времени; первичные логи и аналитика.

## Relevance to project

Опора c-0109 и c-0103: любой наш будущий кейс нужно строить с контролем. Два приёма (ответ в первых предложениях, «спрос из 404 ботов») можно взять в работу. Сайт контентный, не местный бизнес.

## Extracted artefacts

- Notes: [n-aeo-bundle-glasp-what-was-done], [n-geo-roi-evidence-very-weak], [n-no-proven-durable-organic-geo-effect], [n-raw-aeo-multiples-overstate]
- Claims: [c-0103], [c-0109], [c-0114]
- Contradictions: —

_Отклонение от §3: 2 заметки; источник об одном эффекте и одном наборе работ._

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://glasp.co | glasp.co | 1/5 | ignored: сайт авторов |

## Verbatim quotes (если критично)

> "headline AEO multiples substantially overstate causal effect" — Abstract
