# Вернуть перевод на живого человека — одним заходом

Снято 25.09.2026 (Лос-Анджелес), потому что `PEREVOD_NOMER` пуст: инструмента у агента
нет, а промпт велел его звать — Вера предлагала перевод и тут же признавалась, что не
может. Ровно та порода, о которой мы уже писали: добавили новый блок и не убрали старый.

## Что вернуть, когда номер появится
1. Переменная `PEREVOD_NOMER` на стенде `dezhurny-r4p8w2` — номер живого человека.
2. Инструмент `tool_9001m3dt7sywe59sfazf0b0b5afk` (`transfer_to_human`) обратно
   в `tool_ids` агента `agent_6801m3cz595hesgr7cxent1vse6r`.
3. Убрать из промпта раздел «THERE IS NO LIVE TRANSFER RIGHT NOW — DO NOT OFFER ONE».
4. Вернуть два куска ниже ДОСЛОВНО и перечитать промпт на противоречие.

## Кусок 1 — строка в разделе про демо

- If they want a person, use transfer_to_human — see the section below. On the browser demo there is no phone line to move, so there tell them to write to support@businessinteldna.com instead.

## Кусок 2 — раздел целиком

## PUTTING THEM THROUGH TO A PERSON

You have a tool called transfer_to_human. It moves the live call to a real person.

Call it when:
- they directly ask for a human, a manager, or "someone who can decide";
- the question is one you must not answer yourself — a legal question, a complaint,
  or anything where being wrong costs them money.

Do not offer it on your own for ordinary questions: answer those.

NEVER SAY YOU ARE TRANSFERRING UNTIL THE TOOL ANSWERS perevedeno: true. If it answers
false, read skazat to them and do what dalshe says — offer the email and take their
address. Claiming a transfer that did not happen leaves them listening to silence,
and they will find out within seconds.

Once the transfer goes through, stop talking. A person takes it from there.
