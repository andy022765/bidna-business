#!/usr/bin/env python3
"""
Заводит (или обновляет) агента-Дежурного в облаке ElevenLabs.
Промпт собирается из PROMPT-DEZHURNY.md — общая рамка плюс выбранная линия.

  python3 sozdat_agenta.py --liniya dna --golos IExsTwnJMk9vWMW4SzsN
  python3 sozdat_agenta.py --liniya dna --golos ... --obnovit agent_xxx
"""
import argparse, json, os, pathlib, re, sys, requests

BASE = pathlib.Path(__file__).parent
KEY = os.environ.get("ELEVENLABS_STAND_KEY") or os.environ.get("ELEVENLABS_API_KEY", "")
API = "https://api.elevenlabs.io/v1/convai/agents"

# Модель — ЯВНО и живая. 14.09 выяснилось: «gemini-2.0-flash» ElevenLabs молча отдаёт
# gemini-3.5-flash с рассуждениями (поле producing_llm в записи звонка), и именно она
# трижды зачитала вслух JSON вызова инструмента. Сравнение шести моделей на двухшаговой
# отправке письма (24 разговора): 2.5-flash — 4 из 4 верных адресов, «полминуты» и
# прощание верно, самая дешёвая (~$0.005/мин). GPT-4.1/5.4 mini не предупреждают,
# Haiku не исправляет буквы. Прогон: Pivot/golos/proverka/.
LLM = "gemini-2.5-flash"

# Линия = из каких разделов промпта собирается + первая фраза + свои лимиты.
# Демо (04) не дублирует линию 03, а кладётся поверх неё: знания и воронка те же,
# меняются только время и поведение в конце.
LINII = {
    "realtor": {"razdely": ["Линия 01"],
                "pervaya": "Добрый день, офис Северная Звезда, меня зовут Вера, я виртуальный ассистент. Вы по покупке, по продаже или по аренде?"},
    "klinika": {"razdely": ["Линия 02"],
                "pervaya": "Добрый день, клиника, меня зовут Вера, я виртуальный ассистент. Вы записаться или по уже назначенному визиту?"},
    "dna":     {"razdely": ["Линия 03", "Линия 05"],   # 05 — продавец поверх дежурного (14.09)
                # телефонная линия: предупреждение о расшифровке обязательно (оферта 1.1 п. 3.4.4, согласие всех сторон FL/CA)
                "pervaya": "Добрый день, Business Intelligence DNA, меня зовут Вера, я виртуальный ассистент, разговор сохраняется в виде текста. Вы по диагностике или по внедрению?",
                # продавцу 15 минут (решение Андрея 15.09: «6 минут очень мало»); без konec вендор резал молча
                "max_sec": 900, "soft_timeout": 1.8, "telefon": True,
                "konec": "Время звонка вышло. Спасибо за разговор! Если остались вопросы — позвоните ещё раз."},
    # Демо на лендинге. 180 секунд — решение Андрея 14.09: 400 минут стенда в месяц
    # при трёх минутах на разговор это ~133 демо. За 30 секунд до конца страница шлёт
    # агенту contextual_update, и Вера сворачивается сама, а не обрывается.
    "demo":    {"razdely": ["Линия 03", "Линия 04", "Линия 05"],
                "pervaya": "Добрый день, Business Intelligence DNA, меня зовут Вера, я виртуальный ассистент. У нас с вами три минуты — спрашивайте, что интересно.",
                # 3 минуты разговора отсчитываются на странице ПОСЛЕ приветствия (решение
                # Андрея 14.09), плюс прощальная реплика — вендору даём запас, чтобы не резал
                # на полуслове. Закрывает линию страница, этот потолок — только страховка.
                "max_sec": 240, "soft_timeout": 2.0,
                "konec": "Спасибо за разговор! Так же я могу отвечать и вашим клиентам — под ваше дело и вашими словами."},
}


def sobrat_prompt(liniya):
    """Общая рамка + разделы нужной линии из markdown."""
    md = (BASE / "PROMPT-DEZHURNY.md").read_text()
    ramka = re.search(r"```\n(.*?)\n```", md, re.S).group(1).strip()
    kuski = []
    for zagolovok in LINII[liniya]["razdely"]:
        m = re.search(rf"## {zagolovok} — .*?\n(.*?)(?=\n---|\Z)", md, re.S)
        if not m:
            print(f"нет раздела «{zagolovok}» в промпте"); sys.exit(1)
        # служебные <!-- комментарии --> для нас, до модели не доходят
        kuski.append(re.sub(r"\*\*|`", "", re.sub(r"<!--.*?-->", "", m.group(1), flags=re.S)).strip())
    return f"{ramka}\n\nТВОЯ КОНКРЕТНАЯ РОЛЬ\n" + "\n\n".join(kuski)


def instrumenty():
    """Инструменты, которые агент может дёргать в разговоре (отправка письма и т.п.)."""
    p = BASE / "instrumenty.json"
    return list(json.loads(p.read_text()).values()) if p.exists() else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--liniya", default="dna", choices=list(LINII))
    ap.add_argument("--golos", required=True)
    ap.add_argument("--model", default="eleven_flash_v2_5")
    ap.add_argument("--obnovit", default="")
    args = ap.parse_args()
    if not KEY:
        print("нет ELEVENLABS_STAND_KEY"); sys.exit(1)

    L = LINII[args.liniya]
    prompt, pervaya = sobrat_prompt(args.liniya), L["pervaya"]
    telo = {
        "name": f"Дежурный · {args.liniya}",
        "conversation_config": {
            "agent": {
                "prompt": {"prompt": prompt, "llm": LLM,
                           "temperature": 0.2,
                           # 600, не 160: 2.5-flash рассуждает, и рассуждения едят этот лимит. При 160
                           # на поправке адреса оставалось два слова («Простите, не») и не влезал вызов
                           # инструмента. Замер 14.09: нужно до 178. Длину реплики держит промпт, не лимит.
                           "max_tokens": 600,
                           # Рассуждения ВЫКЛ (14.09): с продавцом Вера проговаривала вслух английские рассуждения,
                           # выдумывала test@test.com, 90% ответов до 1,7 с. Без них 24 прогона: утечек 0,
                           # почта с поправкой 2 из 2, задержка 90% 0,83 с.
                           "thinking_budget": 0,
                           # 15.09 телефон: основная модель дважды не ответила, платформа ждала 4 с и уходила
                           # на gpt-4o — ответ через 10–11 с с россыпью «Секунду… Так…». Запасная — быстрая, порог 2,5 с.
                           "backup_llm_config": {"preference": "override", "order": ["gpt-4.1-mini"]},
                           "cascade_timeout_seconds": 2.5,
                           "tool_ids": instrumenty()},
                "first_message": pervaya,
                "language": "ru",
                "disable_first_message_interruptions": True,
                # фраза, которой вендор закрывает разговор по потолку времени
                "max_conversation_duration_message": L.get("konec", ""),
            },
            "tts": {"model_id": args.model, "voice_id": args.golos,
                    # 4 — максимально агрессивная оптимизация начала звука
                    # stability выше — подача ровнее. На 0.5 она «играла» интонацией
                    # и диктовка букв звучала с надрывом; администратору это не идёт.
                    "optimize_streaming_latency": 4, "speed": 1.0,
                    "stability": 0.65, "similarity_boost": 0.8},
            "asr": {"quality": "high", "language": "ru"},
            # Потолок длины разговора. По умолчанию у вендора 600 секунд — то есть
            # один «звонок» мог съесть десять минут тарифа из 275. Наши настоящие
            # разговоры укладываются в 5–6 минут, ставим 360 с запасом.
            "conversation": {"max_duration_seconds": L.get("max_sec", 360)},
            # Ручки, из-за которых медиана была ~2 с:
            #   speculative_turn — начинает думать, НЕ дожидаясь подтверждения,
            #     что человек договорил (главный выигрыш);
            #   turn_eagerness eager — короче пауза перед решением «он закончил»;
            #   turn_timeout 4 — не ждать 7 секунд тишины.
            "turn": {"turn_timeout": 4.0, "turn_eagerness": "eager",
                     "speculative_turn": True, "mode": "turn",
                     # Распознавание у них жёстко "high" — понизить нельзя, задержку
                     # ~2 с на managed-схеме не убрать. Поэтому закрываем её голосом:
                     # короткое русское «секунду», пока думает. По умолчанию там
                     # зашито английское "Hhmmmm...yeah." — в русской линии это мина.
                     "soft_timeout_config": {
                         "timeout_seconds": L.get("soft_timeout", 1.4),  # демо 2.0: «минутку» перед прощанием звучало нелепо
                         # 15.09: короткое «Секунду…» голос выкрикивал, «Сейчас посмотрю» непонятно (что смотрит?) — Андрей
                         "message": "Так…",
                         "additional_soft_timeout_messages": ["Минутку…", "Одну секунду…"],
                         "randomize_fillers": True,
                         "max_soft_timeouts_per_generation": 1,
                         "use_llm_generated_message": False,
                         "disable_until_first_user_message": True,
                     }},
        },
    }
    # Только телефонная линия: положить трубку после прощания и перевод на Андрея в крайнем случае.
    # На SIP-транке (Plivo) ElevenLabs умеет только conference-перевод (дозванивается через исходящий транк).
    if L.get("telefon"):
        telo["conversation_config"]["agent"]["prompt"]["built_in_tools"] = {
            "end_call": {"type": "system", "name": "end_call", "description": "",
                         "params": {"system_tool_type": "end_call"}},
            "transfer_to_number": {"type": "system", "name": "transfer_to_number",
                "description": "Перевод на Андрея — только по разделу «ПЕРЕВОД НА АНДРЕЯ» в инструкции.",
                "params": {"system_tool_type": "transfer_to_number", "transfers": [{
                    "transfer_destination": {"type": "phone", "phone_number": "+15614516864"},
                    "condition": "Transfer in EITHER of two cases. CASE A: the caller says their diagnostics is already done, that they are already a client, or that Andrei asked them to call - this alone is enough, transfer immediately, do not verify, and never offer them the free review. CASE B: ALL THREE at once: (1) the caller said in their own words they are ready to PAY or START NOW; (2) they have a question that blocks the payment and is not answered in the instructions; (3) they ask for a live person. For a NEW caller, asking to speak with Andrei, saying it is urgent, having an important topic, or refusing to talk to a program is NOT a reason to transfer.",
                    "transfer_type": "conference"}]}},
        }

    if args.obnovit:
        r = requests.patch(f"{API}/{args.obnovit}", headers={"xi-api-key": KEY}, json=telo, timeout=60)
    else:
        r = requests.post(f"{API}/create", headers={"xi-api-key": KEY}, json=telo, timeout=60)

    print(f"HTTP {r.status_code}")
    try:
        d = r.json()
    except Exception:
        print(r.text[:600]); sys.exit(1)
    if r.status_code >= 300:
        print(json.dumps(d, ensure_ascii=False)[:900]); sys.exit(1)

    aid = d.get("agent_id", args.obnovit)
    print(f"агент: {aid}")
    p = BASE / "agenty.json"
    reg = json.loads(p.read_text()) if p.exists() else {}
    reg[args.liniya] = {"agent_id": aid, "golos": args.golos, "model": args.model}
    p.write_text(json.dumps(reg, ensure_ascii=False, indent=2))
    print(f"→ {p.name}  (для env GOLOS_AGENTS)")
    print(json.dumps({k: v["agent_id"] for k, v in reg.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
