# Taylor v. ConverseNow Technologies, No. 25-cv-00990-SI (N.D. Cal. Aug. 11, 2025) — order denying motion to dismiss — conspect

**Source**: https://www.govinfo.gov/content/pkg/USCOURTS-cand-3_25-cv-00990/pdf/USCOURTS-cand-3_25-cv-00990-0.pdf
**Source ID**: src-20260924-taylor-v-conversenow
**Author(s)**: Judge Susan Illston, US District Court N.D. Cal.
**Published**: 2025-08-11
**Quality**: 7/10
**Relevance**: 5/5
**Fetched**: 2026-09-24

## TL;DR

Прямой аналог нашего Дежурного: ИИ-ассистент ConverseNow отвечает на звонки в пиццерии Domino's, принимает заказ, адрес и карту. Звонящая не знала, что разговор идёт через третью компанию. Суд отказал в прекращении дела по CIPA §631 и §632: вендор может считаться «третьей стороной», если способен использовать данные звонков для своих целей (улучшать свой продукт), а имя, адрес и карта делают разговор конфиденциальным. Для нас это главный судебный прецедент по ИИ-ресепшенам.

## Thesis

Поставщик ИИ-ассистента, который может использовать данные звонков для улучшения своего продукта, правдоподобно является третьей стороной, перехватывающей разговор без согласия, по CIPA.

## Key points

- Факты: ИИ представлялся «сотрудником» точки, звонящая думала, что говорит только с Domino's; согласия на участие ConverseNow никто не спрашивал.
- Суд принял тест «capability» (Javier v. Assurance IQ), а не «extension»: важно, может ли вендор использовать данные для себя, а не доказал ли истец фактическое использование.
- Довод: сайт и политика вендора говорят, что система учится на миллионах разговоров и улучшает свои продукты.
- Суд опирается на похожие дела: Gladstone v. Amazon Web Services (Amazon Connect), Yockey v. Salesforce, Turner v. Nuance, Tate v. VITAS.
- §632: сообщение имени, адреса и данных карты достаточно для «конфиденциальной коммуникации» на стадии иска; отсылка на «пепперони» не помогла ответчику.
- Итог: ходатайство о прекращении отклонено полностью; дело идёт дальше как групповое.

## Methods / evidence

Судебное толкование статута на основании доводов иска; эмпирики нет. Стадия ранняя, итог по существу неизвестен.

## Relevance to project

Прямо касается схемы, где ElevenLabs (и мы с нашей обвязкой) стоим между звонящим и бизнесом клиента. Если провайдер вправе использовать данные для своих продуктов, иск против него и, возможно, против бизнеса проходит первую стадию. Отсюда требования к продукту: Вера в первой фразе говорит, что она ИИ-ассистент бизнеса и что разговор записывается и обрабатывается; не принимает номера карт голосом; у провайдеров включён запрет обучения на данных, где он есть.

## Extracted artefacts

- Notes: [n-ai-voice-vendor-third-party-capability], [n-name-address-card-make-call-confidential], [n-ai-assistant-posing-as-staff-litigation-trigger], [n-cipa-capability-test-growing-majority], [n-vendor-self-learning-marketing-used-as-evidence]
- Claims: [c-0602], [c-0603]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.courtlistener.com/docket/69595438/taylor-v-conversenow-technologies-inc/ | docket | 4/5 | queued (следить за итогом) |

## Verbatim quotes (если критично)

> "the Court adopts the capability approach and considers defendant to be a third party" — p.8
