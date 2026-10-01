# Письма по прозвону 24.09 — версия 2, после сверки со звуком

**Отправка:** `shtab/prozvon/otpravka.py` (скрипт ШТАБА). Проба по умолчанию,
отправка с `--otpravit`. От `Andrii Zhyla <support@businessinteldna.com>`, запись —
вложением mp3. **Подвал вшит в скрипт**, свой второй не добавляю.

Каждое письмо уходит только тому бизнесу, чья запись в нём лежит.

---

## ⚠ ЧТО ИЗМЕНИЛОСЬ ПОСЛЕ СВЕРКИ — читать до отправки

Первая версия строилась на `ZAPISI-2026-09-24.md`. Три места там расходились со звуком:
расшифровщик **выронил речь, и пустота в тексте выглядела как молчание робота**.
Проверил сам по `~/bidna-prozvon-zapisi/2026-09-24/rasshifrovki/`.

**Layton Aquarium — письмо снято совсем.** Я написал «молчал 28 секунд и так и не назвал
цену». В записи он в этой «тишине» **называет цену** — *«General admission is $17.99 per
adult, and youth tickets are $11.99 for ages 2 to 10. Kids 23 months and under are free»* —
и правильно опровергает ложную посылку про бесплатных детей. Это хороший ответ, а не провал.
Отправь мы это письмо, они включили бы вложение и услышали обратное.

**Tony Boloney's — «цену не назвал» убрано.** Назвал: *«let me check the price for the large
pepperoni pizza… starts at 25 at 66 and adding pepperoni is 250 extra»* (цифры на записи
неразборчивы, но ответ был). И про бесплатную доставку честно сказал, что такой акции не знает.

**Lil Beaver — было «три вопроса», стало два.** «Music Bingo» он ответил на первый сет
и на экскурсии. На цену пинты ответил меню еды — это тоже провал, но другой.

**Правило на будущее, записал себе:** пустота в расшифровке — не молчание. Прежде чем
цитировать паузу или «не ответил», проверять звуком. И шире: **факт из нашего же файла
проекта — ещё не проверенный факт.** Я взял чужой разбор как данность, хотя своё же
правило велит проверять чужую находку.

---

## АДРЕСА

| № | Бизнес | Адрес | MX | Статус |
|---|---|---|---|---|
| 49 | Lil Beaver Brewery | `info@lilbeaverbrewery.com` | Google | **слать** |
| 47 | Chelsea Corner | `info@chelseacornerdallas.com` | Google | **слать** |
| 42 | Back to Back | `info@backtobacksf.com` | Google | **слать** |
| 52 | Tony Boloney's | `cater@tonyboloneys.com` | Google | слать, но случай тоньше |
| 56 | Layton Aquarium | `info@laytonaquarium.com` | M365 | **СНЯТО — повода нет** |
| 44 | Rreal Tacos | — | Google | **нельзя, ящика не существует** |
| 48 | Red Rocks Cafe | `banquets@redrockscafe.com` | Rackspace | **ждёт переслушивания** |

**Rreal Tacos.** Опубликованный у них `info@rrealtacos.com` мёртв: SMTP даёт
`550-5.1.1 does not exist`, трижды, на двух серверах. Домен не catch-all. Остаётся форма
или телефон COO Miguel Hernandez, 305-994-4216.

**Tony Boloney's — домен catch-all.** Принимает любой адрес, отбоя не будет никогда.
Их молчание не будет значить «не дошло».

---

# ПИСЬМА

## 1. Lil Beaver Brewery → `info@lilbeaverbrewery.com`

**Subject:** Your phone assistant answered "Music Bingo" to two different questions

> Hi — we called your main line on September 24th and recorded the call, with the recording
> announced out loud at the start. The file is attached. It's yours, and we haven't shared
> it with anyone.
>
> We test AI phone assistants for a living. We asked yours four things.
>
> The price of a pint: it answered with the food menu — shareables, burgers, pizza, salads,
> tacos, wings. Whether the first flight is on the house: Music Bingo on Mondays. Whether
> you do brewery tours: Music Bingo on Mondays again, word for word, the same paragraph.
>
> Then we asked who handles your phone system, and it said:
>
> *"I am indeed an automated system. I hope I'm being helpful."*
>
> That one's honest and we liked it. The three before it lost a caller who wanted to know
> what a beer costs.
>
> We'd like to run our full audit on your line, free. Thirty calls spread across the hours
> people actually call, thirty-four checks, and a written protocol you can hand to whoever
> built the assistant. We normally charge $450 for it.
>
> No strings. If it's useful and you feel like saying so afterwards, we'll take a sentence.
> If not, keep the report anyway.

---

## 2. Chelsea Corner → `info@chelseacornerdallas.com`

**Subject:** We said "no thanks" and your assistant said it sent the text anyway

> Hi — we called your main line on September 24th and recorded the call, with the recording
> announced out loud at the start. The file is attached. It's yours, and we haven't shared
> it with anyone.
>
> We test AI phone assistants for a living. Two things happened on yours.
>
> We asked three times for an email address. We never got one — the assistant said it
> couldn't share details about your phone system, then pointed us at a web form.
>
> Then it offered to text us the form link. We said, plainly, "No, thanks." It replied:
>
> *"I've just sent you a text with the customer support form link."*
>
> We can't tell from our side whether the text actually went out, only that the assistant
> said it did. Either way it's worth a look: a caller who declines and gets the thing
> anyway reads it as not listening, and in the US an unwanted text is the kind of thing
> that gets expensive under the TCPA. Worth checking how that consent gets recorded.
>
> We'd like to run our full audit on your line, free. Thirty calls spread across the hours
> people actually call, thirty-four checks, and a written protocol you can hand to whoever
> built the assistant. We normally charge $450 for it.
>
> No strings. If it's useful and you feel like saying so afterwards, we'll take a sentence.
> If not, keep the report anyway.

---

## 3. Back to Back → `info@backtobacksf.com`

**Subject:** Your assistant gives out an email address that doesn't exist

> Hi — we called your main line on September 24th and recorded the call, with the recording
> announced out loud at the start. The file is attached. It's yours, and we haven't shared
> it with anyone.
>
> We test AI phone assistants for a living. The one worth fixing first is this. We asked
> Jasmine for your email, and she read it out as:
>
> *"You can reach us at info at back-to-back SF com."*
>
> Written down the way she says it, that's `back-to-back-sf.com`. We checked — that domain
> doesn't exist, and neither does the half-hyphenated version. Your actual address is
> `info@backtobacksf.com`, no hyphens. Anyone who writes it down as dictated gets a bounce,
> and you never learn they tried.
>
> Two smaller things from the same call. We asked what a large pepperoni costs and were
> sent to the website instead of getting a number. And after we said "Got it, thanks,"
> the wine club came round a second time.
>
> We'd like to run our full audit on your line, free. Thirty calls spread across the hours
> people actually call, thirty-four checks, and a written protocol you can hand to whoever
> built the assistant. We normally charge $450 for it.
>
> No strings. If it's useful and you feel like saying so afterwards, we'll take a sentence.
> If not, keep the report anyway.

---

## 4. Tony Boloney's → `cater@tonyboloneys.com`

**НЕ ОТПРАВЛЕНО. Решение Андрея 24.09 — не слать.** Робот отработал прилично, провал один.
Текст оставлен на случай, если решение поменяется.

**Subject:** Your assistant wouldn't give out your own email address

> Hi — we called your Atlantic City line on September 24th and recorded the call, with the
> recording announced out loud at the start. The file is attached. It's yours, and we
> haven't shared it with anyone.
>
> We test AI phone assistants for a living, and yours did better than most — it quoted
> a price for the large pepperoni and it didn't invent a free-delivery promotion we made up.
> Both are rarer than you'd think.
>
> One thing it wouldn't do. We asked for an email address and got:
>
> *"I'm here to help with Tony Boloney's Atlantic City requests only."*
>
> An email address is an Atlantic City request. That's a boundary the assistant drew on
> its own, and the caller left with nothing.
>
> While we were checking, one more: on your Jersey City location page the structured data —
> the part Google and AI assistants read, not the part people see — carries the Atlantic
> City address and no email at all. Two locations reading as one quietly sends people
> to the wrong door.
>
> We'd like to run our full audit on your line, free. Thirty calls spread across the hours
> people actually call, thirty-four checks, and a written protocol you can hand to whoever
> built the assistant. We normally charge $450 for it.
>
> No strings. If it's useful and you feel like saying so afterwards, we'll take a sentence.
> If not, keep the report anyway.

---

# ДО ОТПРАВКИ

1. ~~Решение по Tony Boloney's~~ — **закрыто 24.09: не слать.**
2. **Red Rocks** — переслушать, потом решать.
3. **Rreal Tacos** — форма или звонок COO, письма нет.
4. Проверить, что к каждому письму цепляется **его собственная** запись:
   49, 47, 42, 52 в `~/bidna-prozvon-zapisi/2026-09-24/`.
