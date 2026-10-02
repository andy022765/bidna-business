# Черновик главной — добавка текста (02.10.2026)

**Зачем.** Живая главная — 217 слов (проверка 01.10). Нейросеть, придя на домен, должна сразу найти: кто мы, что делаем,
для кого, сколько стоит, как проверить. Цель — 400+ слов.

**Что НЕ трогаем.** Заголовок, подзаголовок и три карточки (Вера, Видимость, Диагностика) остаются как есть —
`landings/_src/merge_site.py`, словарь `GLAVNAYA`. Цены в карточках не меняем.

**Что добавляем.** Четыре блока ПОД карточками, до подвала. Все цифры и условия — только из живых страниц
(`shtab/sayty/istochniki/vera-ru.html`, `visibility-ru.html`, `diagnostic-ru.html`). Новых обещаний нет.

**Выкладка.** Сессия на Маке вставляет блоки в `glavnaya()` (новый ключ словаря `GLAVNAYA`, RU и EN), разметка
Organization + FAQPage из видимых вопросов, затем `/vykladka-sayta`. Только по «да» Андрея.

---

## RU

### Кто мы

Business Intelligence DNA — Андрей и Маша, Wealthboosterpro LLC, Каспер, Вайоминг. Андрей — предприниматель
с тридцатилетним опытом: финансовый холдинг, налоговая оптимизация корпораций, стратегия. Маша — экс-CFO крупной
корпорации: психология клиента, переговоры, доведение до конца. Работаем с владельцами бизнеса в США
по-русски и по-английски.

### Как мы работаем

- **Вслепую не ставим.** Не знаете, где теряете клиентов, — начните с глубокой диагностики. Знаете — берите
  нужную работу и проходите мимо.
- **Проверить до оплаты.** Веру можно услышать прямо сейчас: позвоните на +1 424 781 1913. Видимость — бесплатная
  проверка за 30 секунд: видно, кого нейросети называют вместо вас.
- **Деньги и доступы.** Работаем под NDA. Доступа к вашим деньгам, счетам и базе клиентов не просим.
- **Что обещаем и что нет.** Ни процента роста, ни количества заявок, ни срока окупаемости. По видимости — если
  после квартала вас устойчиво не назвала ни одна нейросеть, возвращаем все $1 500.

### Кому это нужно

Владельцу небольшого бизнеса в США, который сам берёт трубку, теряет звонки на объекте, вечером и в выходные,
и видит, что покупатели всё чаще спрашивают ChatGPT, к кому обратиться, — а его в ответе нет.

### Почитать перед решением

- [Кто ответит на звонки, пока вы работаете](/zvonki/poka-rabotayu/) и [отвечает ли агент по-русски](/zvonki/po-russki/)
- [Кто в США сделает так, чтобы ChatGPT называл вашу компанию](/vidimost/chatgpt-nazyval/)
- [Сколько стоит продвижение в AI-поиске](/vidimost/cena/)
- [Кейс: Julia Dospehoff, Remote CFO, Тампа](/kejs/yulia-remote-cfo/)

---

## EN

### Who we are

Business Intelligence DNA is Andrii and Masha, Wealthboosterpro LLC, Casper, Wyoming. Andrii is an entrepreneur with
thirty years of experience: a financial holding, corporate tax optimization, strategy. Masha is a former CFO of a large
corporation: client psychology, negotiation, getting things finished. We work with business owners in the US,
in English and Russian.

### How we work

- **We don't install AI blindly.** If you can't tell where you lose customers, start with the deep diagnostic.
  If you can, take the work you need and skip it.
- **Check before you pay.** Hear Vera right now: call +1 424 781 1913. For visibility, a free 30-second check shows
  who AI assistants name instead of you.
- **Money and access.** We work under NDA. We never ask for access to your money, accounts or customer base.
- **What we promise and what we don't.** No growth percentage, no lead count, no payback date. For visibility: if after
  the quarter not one AI engine names you consistently, you get the full $1,500 back.

### Who it's for

An owner of a small US business who answers the phone themselves, misses calls on the job, in the evening and on
weekends, and notices that customers increasingly ask ChatGPT who to hire — and their name isn't in the answer.

### Read before you decide

Links to the English pages of Vera, Visibility and the diagnostic (`/vera/`, `/visibility/`, `/diagnostic/`).
English versions of /zvonki/ and /vidimost/ come later (second wave), so here we only link the three products.

---

## Проверить перед выкладкой

1. Номер +1 424 781 1913 на главной открыто — Андрей, да/нет (на рекламе он уже публичный).
2. Формулировка условия возврата сверена с `/visibility/ru/` («устойчиво названным… ни в одном сочетании»).
3. Подсчёт слов после выкладки: ≥ 400 на русской главной.
