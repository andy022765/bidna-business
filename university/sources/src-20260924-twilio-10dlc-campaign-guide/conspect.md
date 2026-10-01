# Twilio: A2P 10DLC Campaign Onboarding Guide (updated 2026-09-24) — conspect

**Source**: https://support.twilio.com/hc/en-us/articles/11847054539547-A2P-10DLC-Campaign-Onboarding-Guide
**Source ID**: src-20260924-twilio-10dlc-campaign-guide
**Author(s)**: Twilio Support
**Published**: 2026-09-24
**Quality**: 6/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Что проверяют при регистрации SMS-кампании. Главное для Доводчика: устное согласие не годится для маркетинговых сообщений, нужно письменное (чекбокс на сайте, подпись, ответ на SMS). Регистрируется конкретный бизнес клиента, а не платформа; у бизнеса должен работать сайт, быть политика конфиденциальности с обещанием не передавать данные SMS-согласия и условия программы сообщений. Холодные сообщения запрещены. Нужны описание, частота, «Msg & data rates may apply», HELP и STOP, подтверждение после согласия.

## Thesis

Одобрение SMS-кампании требует документированного согласия, соответствующего типу сообщений, и полностью оформленного отправителя с сайтом и политиками.

## Key points

- Устное согласие допустимо для немаркетинговых сценариев со скриптом; для marketing — только письменное.
- Веб-форма: неотмеченный чекбокс, описание сообщений, частота, «Msg & data rates may apply», HELP, STOP, ссылки на Terms и Privacy; согласие на маркетинг и на сервисные — разными чекбоксами.
- Скрипт устного согласия: описание, частота, тарифы, HELP, STOP, ссылки на Terms и Privacy, явное «да», подтверждающее SMS.
- Privacy Policy обязана содержать фразу о непередаче SMS-согласия третьим лицам для маркетинга; Terms — программа, частота, HELP/STOP жирным, «Carriers are not liable…».
- ISV: регистрируется конкретный бизнес (пример — стоматология), а не софт-компания.
- Сайт бренда должен работать и соответствовать бренду; почта на домене компании, не gmail.
- Пример отказа: холодное сообщение владельцу дома — «Cold outreach isn't allowed».

## Methods / evidence

Требования операторов/CTIA в изложении поставщика; эмпирики нет.

## Relevance to project

Подтверждает, что наш sms.md корректен только для узкого случая: один сервисный текст по устной просьбе в звонке. Доводчик, который пишет остывшим клиентам, — маркетинг: нужно письменное согласие, собранное у клиента бизнеса (чекбокс на его сайте или ответ на SMS). У 28 из 31 контактов из тёплого списка только Instagram — без сайта с политиками их бренд SMS-кампанию не пройдёт.

## Extracted artefacts

- Notes: [n-verbal-consent-not-enough-marketing-sms], [n-10dlc-needs-client-site-privacy-terms], [n-10dlc-bans-cold-outreach-texts]
- Claims: [c-0605]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://help.twilio.com/articles/Forbidden-Message-Categories | Forbidden message categories | 3/5 | queued |

## Verbatim quotes (если критично)

> "Verbal consent is not enough for marketing use cases." — Verbal consent

> "Cold outreach isn't allowed" — Sample Messages
