# CareLine (№44) — холодные письма владельцам агентств (черновики)

*30.09.2026. ТОЛЬКО ЧЕРНОВИКИ. Никому не отправлено и не отправлять без «да» Андрея (контракт, запрет 4). Метод — скилл cold-email: пишем как коллега, коротко, одна просьба, тема в 2–3 слова строчными; каждое следующее письмо несёт новое, «просто напоминаю» не пишем; прощальное письмо соблюдаем.*

## Как этим пользоваться

- **Три первых письма — три разных угла.** Одному агентству уходит **одно** из них, не все три:
  - **1A «кандидаты в выходные»** — продаёт то, что можно пустить в пилот сразу (линия найма, без медданных). Основное.
  - **1B «отказы в 5 утра»** — самая сильная боль из портрета, но модуль работает на демо-данных до BAA; в письме это сказано прямо.
  - **1C «три вопроса»** — не продажа, а просьба ответить на три вопроса. Это ровно тест досье §9 (15 разговоров, 5 названных затрат). Лучший вариант, пока у нас нет ни одного клиента.
- **Два follow-up** подходят к любому первому письму: FU1 на 3–4-й день (новое — демо-линия, «послушайте сами»), FU2 на 9–10-й (прощальное, с одним фактом и ответом цифрой). После FU2 агентству больше не пишем, если оно само не ответит.
- **Когда слать:** вторник–четверг, 9–11 утра по Нью-Йорку.
- **Если сначала был звонок человеком**, первая строка любого письма заменяется на: «Thanks for picking up this morning — here's the short version I promised.»

## Что подставлять

| Метка | Откуда | Правило |
|---|---|---|
| `[Name]` | имя с сайта агентства или из звонка | нет имени — «Hi there» (в открытых данных штата имён нет, и мы их не добираем) |
| `[Agency]` | `spisok-ny.csv`, столбец `agentstvo` или `dba` | как агентство называет себя (DBA, если есть) |
| `[OBSERVATION]` | одна строка с сайта агентства или из его объявления о вакансии | должна вести к найму или ночам; нечего сказать — удалить строку целиком |
| `[DEMO NUMBER]` | демо-номер CareLine | решение 1 плана; без номера FU1 не отправлять |
| `[Signature]` | блок подписи ниже | отправитель — решение Андрея |

## Жёсткие правила (проверять каждое письмо перед отправкой)

- Никаких цифр результата, «сэкономите», «наймёте больше», «никогда не пропустит», «заменит координатора», «HIPAA compliant» (c-0609, c-0610).
- Везде прямо: это ИИ, и он сам говорит звонящему, что он ИИ.
- Отказы, семьи, EVV — только с фразой «runs on demo data today; before your clients' data goes in, we sign a BAA».
- Не притворяться, что мы уже «говорили с агентствами» или «видели у многих» — пока это неправда.
- **CAN-SPAM:** честный отправитель и тема; письмо помечено как маркетинговое; настоящий почтовый адрес; работающая отписка, исполнять в пределах 10 рабочих дней (у нас — сразу). Подвал ниже закрывает все пункты, кроме адреса: адрес для писем выбирает Андрей (адрес регистрационного агента в Вайоминге годится, только если он принимает и пересылает почту — проверить).
- **Канал:** вручную из Gmail `support@businessinteldna.com`, малыми партиями. **Не через Resend**: его условия запрещают холодные письма (память, сверено 29.09).
- Факс из списка для рекламы не использовать: реклама по факсу без согласия запрещена федеральным законом (TCPA/JFPA — моё знание закона, в досье этого нет; при сомнении — к юристу).

---

## Письмо 1A — кандидаты в выходные (основное)

**Subject:** weekend applicants

> Hi [Name],
>
> When an HHA calls about [Agency]'s job ad at 8 PM on a Saturday, what happens to that call? [OBSERVATION]
>
> We built CareLine for that hour. It's an AI phone line, and it tells callers so. It answers applicants 24/7 in English, Spanish and Russian, asks your screening questions (certificate, area, schedule, languages) and books the ones who meet your requirements on your interview calendar. You get a summary of every call at 7 AM.
>
> It doesn't touch patient data, and you don't change your scheduling system.
>
> Worth hearing? The demo line is [DEMO NUMBER] — call it as an applicant.
>
> [Signature]

*~100 слов. Одна просьба: позвонить на демо-линию или ответить.*

---

## Письмо 1B — отказы в 5 утра

**Subject:** 5 am call-offs

> Hi [Name],
>
> Who at [Agency] gets the text when an aide calls off at 5 AM? [OBSERVATION]
>
> If the answer is "me," this may be worth two minutes. CareLine is an AI line for home care agencies. When an aide calls or texts that she can't make a shift, it ranks replacements by your rules (skills, the client's language, distance, hours), texts the top few, gives the shift to the first YES and wakes a person only if nobody takes it. A person confirms; nothing is decided by the AI's guess.
>
> Straight talk: this part runs on demo data today. Before any of your clients' data goes in, we sign a BAA.
>
> Worth a look?
>
> [Signature]

*~110 слов. Если ответ «да» — 15 минут демо по DEMO-SCRIPT.md, сцена 4B.*

---

## Письмо 1C — три вопроса (просьба, не продажа)

**Subject:** three questions

> Hi [Name],
>
> Would you answer three quick questions about nights and hiring at [Agency]? One line each is plenty.
>
> 1. When an aide calls off at 5 AM, who handles it — and what does that cost you (overtime, an assistant, your own sleep)?
> 2. When an applicant calls your ad after hours, what happens to that call?
> 3. What do you already pay for to cover nights and weekends?
>
> Why I'm asking: we're a small team building an AI phone line for home care agencies in Brooklyn and Queens, and I'd rather build it around owners' answers than our guesses. I'll send you a short summary of what other owners tell us, with no names. No pitch unless you ask for one.
>
> [Signature]

*~120 слов. Обязательство «пришлём сводку ответов без имён» — выполнять. Ответы сразу в `spisok-ny.csv` (или отдельный журнал): это пороги досье — 15 разговоров, 5 названных текущих затрат.*

---

## Follow-up 1 (3–4-й день) — послушайте сами

**Subject:** (ответом в той же цепочке) или hear it yourself

> Hi [Name],
>
> Easier than reading about it: call [DEMO NUMBER] and pretend you're an applicant who saw your ad. Try Spanish or Russian if your applicants use them.
>
> It'll tell you up front that it's an AI and that the call is recorded, ask the kind of questions an agency like yours asks, and put an interview on a demo calendar. It takes about three minutes.
>
> If this isn't something [Agency] needs, just say so and I won't keep writing.
>
> [Signature]

*~85 слов. Новое в письме — опыт, а не текст. Без демо-номера не отправлять.*

---

## Follow-up 2 (9–10-й день) — прощальное

**Subject:** closing the loop

> Hi [Name],
>
> I haven't heard back, so I'll assume now isn't the time. One thing before I go, since it touches every agency that bills Medicaid: North Carolina has rejected home health claims without EVV data since October 2025, and Missouri began re-processing mismatched claims this May and taking back payments already made.
> NC: https://medicaid.ncdhhs.gov/blog/2025/09/09/managed-care-electronic-visit-verification-home-health-implementation-hard-launch-effective-oct-1
> MO: https://dss.mo.gov/mhd/hot-tips/mass-adjustment-claims-services-requiring-electronic-visit-verification
>
> If CareLine is worth a look later, just reply with a number:
> 1 — show me the demo
> 2 — check back in three months
> 3 — not interested, please stop
>
> Either way, this is my last email.
>
> [Signature]

*~100 слов. Факт — из досье [17][18]. «Это последнее письмо» — исполнять: при ответе «3» или молчании больше не писать; «2» — напоминание в журнал через три месяца.*

---

## Подпись и подвал (одинаковые во всех письмах)

> [SENDER NAME] · [TITLE], [PRODUCT NAME]
> [PHONE] · [EMAIL]
> Business Intelligence DNA (Wealthboosterpro LLC) · [POSTAL ADDRESS]
>
> Why you got this: [Agency] is listed in New York State's public registry of licensed home care agencies. This is a marketing email from Business Intelligence DNA. Not interested? Reply "no thanks" and we won't email you again.

---

## Проверка перед отправкой (для каждого письма)

- [ ] Прочитал вслух — звучит как человек, а не как рассылка.
- [ ] «You/your» больше, чем «we/our».
- [ ] Одна просьба, одна ссылка максимум (в FU2 — две ссылки-источника, это исключение ради фактов).
- [ ] Нет запрещённых слов: replace, guaranteed, never miss, save $, increase, compliant, best-in-class, leverage.
- [ ] Фраза про ИИ на месте; про BAA — там, где речь об отказах, семьях или EVV.
- [ ] Подвал: отправитель, почтовый адрес, пометка «marketing email», отписка.
- [ ] Отправляет человек, вручную, после «да» Андрея.
