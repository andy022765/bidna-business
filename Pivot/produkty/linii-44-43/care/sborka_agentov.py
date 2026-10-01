#!/usr/bin/env python3
"""Сборка DEMO-агентов CareLine (№44) в ElevenLabs из промптов care/prompty/*.md.

  python3 sborka_agentov.py --pokazat     показать, что уйдёт (ничего не пишет)
  python3 sborka_agentov.py --primenit    создать агентов (если их нет в elevenlabs.json) или PATCH только их

Трогает ТОЛЬКО агентов «CareLine DEMO · …», чьи id записаны в care/elevenlabs.json.
Живые агенты Веры (dna, EN, календарь, demo, проверяльщик) — отказ до любого запроса.
Ключ ElevenLabs — из ~/.bidna-golos.env (последнее объявление), не печатается.
Образец ручек — GET агента «Дежурный · English» 30.09.2026 (модель, голос, ASR, очередь реплик, end_call).
"""
import json, os, ssl, sys, urllib.request, urllib.error

TUT = os.path.dirname(os.path.abspath(__file__))
EL_JSON = os.path.join(TUT, "elevenlabs.json")

ZHIVYE = {
    "agent_1401m2bc9k58f6nrj8v51pw2v2s3", "agent_6801m3cz595hesgr7cxent1vse6r",
    "agent_6601m3b4dr6ve48b0p0wkne7ecdb", "agent_8501m2f3wdhye8fadxmks4z8hp31",
    "agent_4701m34zngp2e9cb2w5wcrd171zr", "agent_4601m2gp6y9je2ktkeykv30me35w",
}

VOICE_SARAH = "EXAVITQu4vr4xnSDxMaL"
NOMER_PEREVODA_ZAGLUSHKA = "+17185550199"   # вымышленный 555-01xx; с 01.10 не используется: perevod_vebhuk_id задан (вебхук perevod)

LINII = {
    "care-hiring": {
        "imya": "CareLine DEMO · Hiring",
        "prompt": "hiring",
        "instrumenty": ["svobodnye_okna", "zapisat", "sohranit_kandidata", "sohranit_semyu"],
        "max_s": 480,
        "first": {
            "en": "Hi, you've reached Brightside Home Care. I'm an AI assistant, not a person, and this call is recorded as a text transcript. You can talk to me in English, Spanish or Russian. How can I help you today?",
            "es": "Hola, se ha comunicado con Brightside Home Care. Soy un asistente de inteligencia artificial, no una persona, y esta llamada se graba como transcripción de texto. ¿En qué puedo ayudarle?",
            "ru": "Здравствуйте, это Brightside Home Care. Я ИИ-ассистент, не человек, и разговор записывается в виде текста. Чем могу помочь?",
        },
        "perevod_uslovie": "ONLY during office hours — Monday to Friday, 09:00 to 17:00 New York time — when the caller asks for a person. Never on Saturday or Sunday, never before 09:00 or from 17:00 on.",
        "agent_uslovie": "The caller is one of our own caregivers who can't work a shift, is running late, or has a problem on a shift.",
        "agent_kuda": "care-caregivers",
    },
    "care-caregivers": {
        "imya": "CareLine DEMO · Caregivers",
        "prompt": "caregivers",
        "instrumenty": ["otkaz_ot_smeny"],
        "max_s": 300,
        "first": {
            "en": "Hi, this is the Brightside Home Care caregiver line. I'm an AI assistant, not a person, and this call is recorded as a text transcript. You can talk to me in English, Spanish or Russian. How can I help?",
            "es": "Hola, esta es la línea de cuidadores de Brightside Home Care. Soy un asistente de inteligencia artificial, no una persona, y esta llamada se graba como transcripción de texto. ¿En qué puedo ayudarle?",
            "ru": "Здравствуйте, это линия сиделок Brightside Home Care. Я ИИ-ассистент, не человек, и разговор записывается в виде текста. Чем могу помочь?",
        },
        "perevod_uslovie": "Someone is in danger, or there is an urgent problem on a shift happening now or starting within a few hours (any hour); or the caller asks for a person during office hours — Monday to Friday, 09:00 to 17:00 New York time.",
        "agent_uslovie": "The caller is a job applicant or a family looking for home care.",
        "agent_kuda": "care-hiring",
    },
}

SOFT = {"en": ("One moment…", ["Just a second…"]),
        "es": ("Un momento…", ["Un segundito…"]),
        "ru": ("Секунду…", ["Одну минуту…"])}
KONEC = {"en": "We're out of time for this call. If anything is still open, please call us back. Goodbye.",
         "es": "Se nos acabó el tiempo de esta llamada. Si queda algo pendiente, vuelva a llamarnos. Adiós.",
         "ru": "Время звонка закончилось. Если что-то осталось, перезвоните нам, пожалуйста. До свидания."}
KEYWORDS = ["Brightside", "HHA", "PCA", "CNA", "Medicaid", "Dana", "Flushing", "Bensonhurst", "Brighton Beach", "Sheepshead Bay"]

DATA_COLLECTION = {
    "namerenie": {"type": "string", "description": "Why the person called: kandidat (job applicant), semya (family looking for care), otkaz (caregiver can't work a shift), smena_seychas (caregiver late or a problem on a shift), soobshchenie (message for the coordinator), spam, drugoe."},
    "itog": {"type": "string", "description": "Outcome in a few words, e.g.: interview booked, assessment booked, waiting list, not qualified, call-off recorded, transferred to a person, transferred to the other line, message taken, no action."},
    "kratko": {"type": "string", "description": "Two short sentences for the coordinator: what the caller wanted and what was done. Never include medical details, age, family, origin or immigration details."},
    "imya": {"type": "string", "description": "Caller's first and last name exactly as spelled and confirmed in the call; empty string if not given."},
    "telefon": {"type": "string", "description": "Confirmed callback phone number in E.164 format; empty string if not given."},
    "soobshchenie": {"type": "string", "description": "The message for the coordinator if the caller left one, including any question the assistant could not answer; empty string otherwise."},
    "sms_soglasie": {"type": "boolean", "description": "true only if the caller clearly agreed to receive text messages in this call; otherwise false."},
    "yazyk": {"type": "string", "description": "Language of the call: en, es, ru or other."},
}

_CTX = None


def _ctx():
    global _CTX
    if _CTX is None:
        try:
            import certifi
            _CTX = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            _CTX = ssl.create_default_context()
    return _CTX


def env(name, path=os.path.expanduser("~/.bidna-golos.env")):
    val = None
    with open(path, encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            if s.startswith("export "):
                s = s[7:]
            if "=" in s:
                k, v = s.split("=", 1)
                if k.strip() == name:
                    v = v.strip()
                    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
                        v = v[1:-1]
                    val = v
    return val


def api(method, path, body=None):
    for a in ZHIVYE:
        if a in path and method != "GET":
            sys.exit(f"СТОП: {method} на живого агента {a} запрещён")
    req = urllib.request.Request("https://api.elevenlabs.io/v1" + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, context=_ctx(), timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw[:2000].decode("utf-8", "replace")}


def prochitat(imya):
    p = os.path.join(TUT, "prompty", imya)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def sistemnye(liniya, cfg, el):
    bt = {
        "end_call": {"type": "system", "name": "end_call",
                     "description": "Hang up. Only after the caller has said goodbye or said they need nothing else, or for a robocall or long silence. Never in the same turn as a question.",
                     "params": {"system_tool_type": "end_call"}},
        "language_detection": {"type": "system", "name": "language_detection",
                               "description": "Switch to Spanish (es) or Russian (ru) when the caller speaks it or asks for it; back to English (en) if they ask. Never switch because of an accent or a single foreign word.",
                               "params": {"system_tool_type": "language_detection"}},
        "transfer_to_number": {"type": "system", "name": "transfer_to_number",
                               "description": "Connects the live call to a human coordinator. Only in the situations the prompt allows (office OPEN, or an urgent shift problem on the caregiver line). NEVER used to leave or take a message — you take messages yourself in the conversation.",
                               "params": {"system_tool_type": "transfer_to_number",
                                          "transfers": [{"transfer_destination": {"type": "phone", "phone_number": NOMER_PEREVODA_ZAGLUSHKA},
                                                         "condition": cfg["perevod_uslovie"], "transfer_type": "conference"}],
                                          "enable_client_message": True}},
    }
    if el.get("perevod_vebhuk_id"):
        # Явный null, а не «нет ключа»: ElevenLabs мог бы слить built_in_tools с прежними и оставить системный перевод
        # (урок Pivot/golos/plan-b/pereklyuchatel.py 28.09). Набор шлём целиком, после записи сверяем GET-ом.
        bt["transfer_to_number"] = None
    kuda = (el.get("agenty", {}).get(cfg["agent_kuda"]) or {}).get("agent_id")
    if kuda:
        bt["transfer_to_agent"] = {"type": "system", "name": "transfer_to_agent", "description": "",
                                   "params": {"system_tool_type": "transfer_to_agent",
                                              "transfers": [{"agent_id": kuda, "condition": cfg["agent_uslovie"], "delay_ms": 0,
                                                             "enable_transferred_agent_first_message": False}]}}
    return bt


PEREVOD_VEBHUK_TEKST = {
    "en": "\n\n## TRANSFER ON THIS LINE\nperevod_careline_demo puts the caller through to a person. Call it without announcing anything — the phone system itself tells the caller they are being connected. If it answers ok true, say nothing more: a person takes over. If it answers ok false, say the meaning of soobshchenie and take a message. Never promise to stay on the line.\n",
    "es": "\n\n## LA TRANSFERENCIA EN ESTA LÍNEA\nperevod_careline_demo comunica a la persona con alguien del equipo. Llámalo sin anunciar nada: el sistema telefónico mismo le dice que la están comunicando. Si responde ok true, no digas nada más: una persona toma la llamada. Si responde ok false, di el sentido de soobshchenie y toma un mensaje. Nunca prometas quedarte en la línea.\n",
    "ru": "\n\n## ПЕРЕВОД НА ЭТОЙ ЛИНИИ\nperevod_careline_demo соединяет звонящего с человеком. Вызывай его молча — телефонная система сама скажет, что соединяет. Ответ ok true — дальше ни слова: трубку берёт человек. Ответ ok false — скажи смысл soobshchenie и прими сообщение. Никогда не обещай «останусь на линии».\n",
}


def perevod_vebhukom(tekst, yaz, el):
    """Если в elevenlabs.json есть perevod_vebhuk_id — системный transfer_to_number заменяется вебхуком perevod_careline_demo (вариант стенда)."""
    if not el.get("perevod_vebhuk_id") or tekst is None:
        return tekst
    return tekst.replace("transfer_to_number", "perevod_careline_demo") + PEREVOD_VEBHUK_TEKST[yaz]


def konfig(liniya, el):
    cfg = LINII[liniya]
    en = perevod_vebhukom(prochitat(f"{cfg['prompt']}.en.md"), "en", el)
    tool_ids = [el["instrumenty"][k]["id"] for k in cfg["instrumenty"]]
    if el.get("perevod_vebhuk_id"):
        tool_ids.append(el["perevod_vebhuk_id"])
    cc = {
        "asr": {"quality": "high", "provider": "scribe_realtime", "user_input_audio_format": "pcm_16000", "keywords": KEYWORDS},
        "turn": {"turn_timeout": 4.0, "turn_eagerness": "eager", "spelling_patience": "auto", "speculative_turn": True,
                 "soft_timeout_config": {"timeout_seconds": 2.0, "message": SOFT["en"][0], "additional_soft_timeout_messages": SOFT["en"][1],
                                         "use_llm_generated_message": False, "randomize_fillers": True,
                                         # живые агенты держат 2 (GET 01.10): с 3 каждый --primenit «менял» бы поле
                                         "max_soft_timeouts_per_generation": 2, "disable_until_first_user_message": True}},
        "tts": {"model_id": "eleven_flash_v2", "voice_id": VOICE_SARAH, "agent_output_audio_format": "pcm_16000",
                "optimize_streaming_latency": 4, "stability": 0.65, "speed": 1.0, "similarity_boost": 0.8,
                "text_normalisation_type": "system_prompt"},
        "conversation": {"text_only": False, "max_duration_seconds": cfg["max_s"]},
        "agent": {
            "first_message": cfg["first"]["en"], "language": "en",
            # статус офиса и календарь на 14 дней считает стенд (vhod / вебхук начала разговора) — модель время не сравнивает;
            # пусто = агент считает сам по {{system__time}} (хуже: пилот 30.09 — «закрыто» в среду 15:40)
            "dynamic_variables": {"dynamic_variable_placeholders": {"ofis_seychas": "", "kalendar": ""}},
            "disable_first_message_interruptions": True,
            "max_conversation_duration_message": KONEC["en"],
            "prompt": {"prompt": en, "llm": "gemini-2.5-flash", "temperature": 0.2, "max_tokens": 600, "thinking_budget": 0,
                       "ignore_default_personality": True, "timezone": "America/New_York",
                       "backup_llm_config": {"preference": "override", "order": ["gpt-4.1-mini"]}, "cascade_timeout_seconds": 2.5,
                       "tool_ids": tool_ids, "built_in_tools": sistemnye(liniya, cfg, el)},
        },
    }
    presets = {}
    for yaz in ("es", "ru"):
        p = perevod_vebhukom(prochitat(f"{cfg['prompt']}.{yaz}.md"), yaz, el)
        if not p:
            continue
        presets[yaz] = {"overrides": {
            "agent": {"first_message": cfg["first"][yaz], "language": yaz, "max_conversation_duration_message": KONEC[yaz],
                      "prompt": {"prompt": p}},
            "turn": {"soft_timeout_config": {"message": SOFT[yaz][0], "additional_soft_timeout_messages": SOFT[yaz][1]}},
            "tts": {"model_id": "eleven_flash_v2_5"},
        }}
    cc["language_presets"] = presets
    ps = {
        "summary_language": "en",
        "data_collection": DATA_COLLECTION,
        # retention_days 30 — расшифровки у ElevenLabs живут 30 дней, как итоги звонков на стенде (lib/chistka.js);
        # к старым разговорам (прогоны) не применяется: apply_to_existing_conversations по умолчанию false.
        "privacy": {"record_voice": False, "retention_days": 30},
        # daily_limit 20 (проверка 30.09: кошелёк общий с Верой, бюджет $80 на месяц). Стенд сверх того держит
        # 15 входящих в сутки (nastroyki.limity.zvonkov_v_sutki). Текстовым прогонам 20 в сутки мало —
        # на день прогонов поднимать отдельным PATCH (решение главного агента) и возвращать.
        "call_limits": {"agent_concurrency_limit": 4, "daily_limit": 20, "bursting_enabled": False},
        "auth": {"enable_auth": True},
    }
    # Вебхуки подключаются только когда их id/адрес вписаны в elevenlabs.json (делает главный агент по PRIVYAZKA.md).
    # НИКОГДА не вебхук Веры 009c2156e8ab44a6bd8ef8cc007b6bde.
    vi = el.get("vebhuk_itoga_id")
    vn = el.get("vebhuk_nachala_url")
    if vi or vn:
        if vi == "009c2156e8ab44a6bd8ef8cc007b6bde":
            sys.exit("СТОП: это вебхук Веры — у CareLine свой")
        wo = {}
        if vi:
            wo["webhooks"] = {"post_call_webhook_id": vi, "events": ["transcript"], "transcript_format": "json"}
        if vn:
            wo["conversation_initiation_client_data_webhook"] = {"url": vn, "request_headers": {"x-liniya-klyuch": {"secret_id": el["sekret"]["secret_id"]}}}
            ps["overrides"] = {"enable_conversation_initiation_client_data_from_webhook": True}
        ps["workspace_overrides"] = wo
    return cfg["imya"], cc, ps


def main():
    el = json.load(open(EL_JSON, encoding="utf-8"))
    primenit = "--primenit" in sys.argv
    for liniya in ("care-caregivers", "care-hiring"):
        imya, cc, ps = konfig(liniya, el)
        ag = el.setdefault("agenty", {}).setdefault(liniya, {})
        aid = ag.get("agent_id")
        bt = cc["agent"]["prompt"]["built_in_tools"]
        print(f"{liniya}: {imya} · id={aid or '—'} · промпт EN {len(cc['agent']['prompt']['prompt'])} зн. · "
              f"языки: en+{','.join(cc['language_presets']) or '—'} · инструменты: {len(cc['agent']['prompt']['tool_ids'])} + "
              f"{','.join(k for k, v in bt.items() if v)}")
        if not primenit:
            continue
        if aid:
            if aid in ZHIVYE:
                sys.exit("СТОП: в elevenlabs.json живой агент")
            st, cur = api("GET", f"/convai/agents/{aid}")
            if st != 200 or not str(cur.get("name", "")).startswith("CareLine DEMO"):
                sys.exit(f"СТОП: агент {aid} не «CareLine DEMO» (HTTP {st})")
            st, r = api("PATCH", f"/convai/agents/{aid}", {"conversation_config": cc, "platform_settings": ps, "name": imya})
        else:
            st, r = api("POST", "/convai/agents/create", {"conversation_config": cc, "platform_settings": ps, "name": imya,
                                                          "tags": ["DEMO", "CareLine"]})
            if st == 200:
                ag["agent_id"] = r["agent_id"]
        print("   →", st, (r.get("agent_id") or "") if st == 200 else json.dumps(r, ensure_ascii=False)[:1500])
        if st != 200:
            sys.exit(1)
        ag["imya"] = imya
    if primenit:
        with open(EL_JSON, "w", encoding="utf-8") as f:
            json.dump(el, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
