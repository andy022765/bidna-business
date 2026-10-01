# Americans and AI 2026: Chatbots, Smart Devices and Views on Impact (Pew) — conspect

**Source**: https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-2026-chatbots-smart-devices-and-views-on-impact/
**Source ID**: src-20260924-pew-americans-ai-2026
**Author(s)**: Pew Research Center
**Published**: 2026-06-17
**Quality**: 9/10
**Relevance**: 3/5
**Fetched**: 2026-09-24

## TL;DR

Независимый контрольный замер к вендорским цифрам. 49% взрослых американцев пользуются ИИ-чатботами (в 2024 было 33%), 42% — чтобы искать информацию, около четверти — ежедневно. ChatGPT пользуются 44%, Gemini 24%, Copilot 17%, Meta AI 14%, Grok 8%, Claude 6%. До 50 лет пользуются вдвое чаще, чем после 50. Вопроса про поиск местного бизнеса нет, поэтому это потолок для вендорских «45% ищут местный бизнес через ИИ», а не подтверждение.

## Thesis

Чатботы вошли в жизнь половины взрослых американцев, прежде всего как поиск информации и рабочий инструмент, но вторая половина ими не пользуется и в основном не собирается.

## Key points

- 49% пользуются чатботами, 51% нет; большинство не пользующихся не планируют начать, 6 из 10 называют причиной отсутствие интереса.
- Поиск информации — 42% взрослых; работа — 38% работающих; новости — 13%.
- Ежедневно — около четверти (12% несколько раз в день, 4% почти постоянно).
- ChatGPT 44% (год назад 34%), Gemini 24%, Copilot 17%, Meta AI 14%, Grok 8%, Claude 6%.
- До 50 лет ChatGPT пользуются 57%, после 50 — 28%.

## Methods / evidence

American Trends Panel, 5 119 взрослых США, 17–23 февраля 2026, вероятностная выборка с весами на всё взрослое население; топлайн и методика опубликованы, данные графиков скачиваются в CSV.

## Relevance to project

1. Крючок «клиенты спрашивают нейросеть» держится на уровне «почти половина взрослых пользуется чатботами, 4 из 10 — для поиска». Утверждение «большинство» ложно.
2. Какие движки мерить: Claude у потребителей 6% — для Смотрителя он вторичен по охвату (наша калибровка его включает — это нормально для нас как для бизнеса, но в отчёте клиенту вес Claude стоит объяснять). Gemini (24%) по охвату второй, а мерить его через официальный API нам запрещено условиями (см. `Pivot/agenty/smotritel/RAZVEDKA-GITHUB-2026-09-14.md`) — это дыра в замере, которую надо проговаривать.
3. Возраст: ниши с клиентами моложе 50 получают от видимости в ИИ больше.

## Extracted artefacts

- Notes: [n-half-us-adults-use-chatbots-2026], [n-chatbot-reach-chatgpt-gemini-claude]
- Claims: [c-0204], [c-0209]
- Contradictions: —

## Outbound links (tracked)

| URL | Anchor | Predicted relevance | Status |
| --- | ------ | ------------------- | ------ |
| https://www.pewresearch.org/internet/2026/06/17/how-opinions-and-use-of-ai-differ-by-age/ | How opinions and use of AI differ by age | 3/5 | queued |
| https://www.pewresearch.org/wp-content/uploads/sites/20/2026/06/PI_2026.06.17_Americans-and-AI_REPORT.pdf | полный отчёт | 3/5 | queued (разбивка по этничности/языку, если есть) |
| https://www.pewresearch.org/internet/2026/06/17/why-dont-people-use-chatbots/ | Why don't Americans use chatbots | 2/5 | queued |
| https://www.pewresearch.org/internet/2026/06/17/americans-and-ai-appendix-detailed-chart-and-tables/ | Appendix | 2/5 | queued |
| Smart devices sections | — | 1/5 | ignored: вне скоупа |

## Verbatim quotes (если критично)

> "A little under half of U.S. adults (44%) now report using the chatbot, up from 34% last year." — про ChatGPT
