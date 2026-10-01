# Текст встречи в Calendly — «Стратегическая сессия» (calendly.com/bizzinteldna/1hr)

Написано 01.10.2026 по плану П1, п. 3 (PLAN-DLYA-ANDREYA.md). Адрес `/1hr` не менять: он зашит в
`netlify-functions/hochet-zvonok.js` основного сайта и в паспорт `site/kartochka/bid.json`.

## Зачем править
Одна и та же встреча теперь нужна двоим: человеку, который оставил почту в форме «Остались вопросы?
Забронируйте звонок» и ещё ничего не платил, и клиенту диагностики, который идёт на стратегическую сессию.
Сейчас описание обещает результаты диагностики (у первого их нет) и Google Meet (созвон в Zoom — так в
Условиях 3.2.3 и в Политике 3.8), а английские заявки видят только русский текст.

## Куда вставлять (аккаунт bizzinteldna@gmail.com, 3 минуты)
calendly.com → **Scheduling** → «Стратегическая сессия» → шестерёнка / Edit:
1. **Event name** — строка из блока «Название».
2. **Description/Instructions** — целиком блок «Описание» (русский и английский вместе).
3. **Location** — проверить, что стоит **Zoom** (или свой постоянный адрес Zoom как Custom), а не Google Meet.
4. **Booking page options → Invitee questions** — вопрос из блока «Вопрос на форме записи», галочка
   «Required» снята. Имя и почта остаются как есть: сайт подставляет их в ссылку сам.
5. **Save changes.** Адрес `/1hr` не трогать.

---

## Название
```
Звонок с Андреем и Машей · Call with Andrii & Masha
```

## Описание
```
English below.

Один календарь, два повода.

Если вы оставили почту на сайте и хотите понять, подходит ли вам Вера (голосовой администратор и продавец), видимость в нейросетях или глубокая диагностика, — это тот самый звонок. Обычно хватает 30 минут, час в календаре стоит с запасом.

Если вы оплатили диагностику и получили документ — это стратегическая сессия по нему, 45–60 минут. Документ приходит до звонка: на сессии разбираем, а не презентуем.

Как проходит. Созвон в Zoom, ссылка — в письме с подтверждением. С вами говорим мы двое: Андрей (стратегия и позиционирование) и Маша (экономика бизнеса, экс-CFO). Готовить ничего не нужно. Доступ к счетам, CRM и базе клиентов не просим.

Запись. Записываем только стратегическую сессию и только с вашего согласия: спросим вслух в первую минуту, запись ваша.

Не сможете прийти — перенесите по ссылке из подтверждения, вопросов не будет. Разговор ни к чему не обязывает. Цены — на businessinteldna.com

— — —

One calendar, two kinds of calls.

If you left your email on our site and want to find out whether Vera (the voice receptionist and sales manager), visibility in AI answers or the deep diagnostic is right for you, this is that call. Thirty minutes is usually enough; the hour is there as a margin.

If you have paid for the diagnostic and received your document, this is the strategy session on it, 45–60 minutes. The document arrives before the call: we discuss it rather than present it.

How it works. Zoom; the link is in your confirmation email. You talk to the two of us: Andrii (strategy and positioning) and Masha (business economics, former CFO). Nothing to prepare. We do not ask for access to your accounts, CRM or customer base.

Recording. We record only the strategy session, and only with your consent: we ask out loud in the first minute, and the recording is yours.

Can't make it? Reschedule with the link in your confirmation, no questions asked. The call commits you to nothing. Prices: businessinteldna.com
```

## Вопрос на форме записи (необязательный)
```
О чём поговорим? Одна-две фразы: чем занимаетесь и что хотите узнать. Если диагностика уже оплачена — напишите «диагностика». / What shall we talk about? A line or two: what you do and what you want to find out. If you have already paid for the diagnostic, write "diagnostic".
```

## Что проверено и что нет
- Цифр результата и гарантий нет (правило анти-гарантии). Вера названа «администратор и продавец».
- Zoom и правило записи — дословно по Условиям 3.2.3 / 6.2.4 и Политике 3.8 (45–60 минут, «спрашиваем вслух»).
- Нынешний текст в Calendly из облака не виден (прокси не пускает на calendly.com) — замена целиком, не правка.
- Фраза «записываем только стратегическую сессию» — обещание: ознакомительные звонки не записывать. Если не так — убрать слово «только».
