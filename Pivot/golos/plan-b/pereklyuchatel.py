#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""План Б: переключатель перевода на русской линии (агент dna).

    python3 Pivot/golos/plan-b/pereklyuchatel.py --status
    python3 Pivot/golos/plan-b/pereklyuchatel.py --vklyuchit   # свой перевод: функция perevod-ru
    python3 Pivot/golos/plan-b/pereklyuchatel.py --otkatit     # назад на системный transfer_to_number

ЧТО ДЕЛАЕТ --vklyuchit. Сперва проверяет, что выкатка на месте (функция отвечает, обе фразы
отдаются как audio/mpeg), — без этого не трогает агента. Потом заводит (или находит)
инструмент-вебхук perevod_na_andreya → добавляет его агенту → снимает системный
transfer_to_number → меняет в промпте абзац про перевод и общую формулу «Соединяю, одну
секунду» (иначе «соединяю» прозвучит дважды: голосом модели и записью). Всё проверяет чтением.

ВСТРОЕННЫЕ ИНСТРУМЕНТЫ ШЛЁМ ЦЕЛИКОМ. У агента включён и end_call; если отправить только
transfer_to_number, а ElevenLabs примет это как замену всего набора, Вера перестанет класть
трубку (замечание ревью 28.09). Поэтому берём набор из GET, меняем один ключ, шлём весь,
и после записи проверяем, что end_call на месте.

ОТКАТ. Выкатка не нужна — всё живёт у ElevenLabs. Меняет назад только то, что меняло включение:
абзац (из otkat-agent-dna.json), формулу, tool_ids, системный перевод. Полная копия агента
с секретами — ~/.bidna-agent-dna-do-plana-b-2026-09-28.json (права 600, не в Drive).
Если ElevenLabs не примет перевод в форме из GET — вернуть его руками в кабинете:
Agents → «Дежурный · dna» → Tools → Transfer to number (номер +15614516864, conference).

Секрет заголовка берётся из ~/.bidna-golos.env (GOLOS_PISMO_SECRET) и никуда не печатается.
"""
import argparse, json, pathlib, sys, urllib.error, urllib.request

ZDES = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ZDES.parent / "dozvonshchik"))
import dozvonshchik as d          # env() и TLS-контекст — те же, что у дозвонщика

AGENT = "agent_1401m2bc9k58f6nrj8v51pw2v2s3"
IMYA = "perevod_na_andreya"
BAZA = "https://dezhurny-r4p8w2.netlify.app"
URL = BAZA + "/.netlify/functions/perevod-ru"
ZVUKI = [BAZA + "/zvuk/soedinyayu.mp3", BAZA + "/zvuk/ne-otvetil.mp3"]
OTKAT = ZDES / "otkat-agent-dna.json"

STARYY_NACHALO = "Тогда скажи ВСЛУХ, до вызова инструмента"
NOVYY_NACHALO = "Тогда вызови инструмент perevod_na_andreya"
KONEC = "### НА ДЕМО"

STARAYA_FORMULA = "Формула: «Этот вопрос лучше решит [имя]. Соединяю, одну секунду.»"
NOVAYA_FORMULA = "Фразу «Соединяю…» сама не произносишь: при переводе её говорит инструмент перевода."

NOVYY_ABZAC = (
    "Тогда вызови инструмент perevod_na_andreya. Перед вызовом ничего не говори: фразу «Соединяю с Андреем, "
    "одну минуту. Не ответит — он перезвонит сам или напишет вам на почту.» звонящему скажет сам инструмент, "
    "твоим голосом. После вызова тоже молчи — дальше звонок ведёт перевод.\n\n"
    "НИКОГДА не обещай, что останешься на линии, вернёшься, дождёшься вместе с человеком или перезвонишь сама. "
    "После перевода твоё соединение заканчивается, и вернуться ты не можешь физически. Проверка 27.09: сказала "
    "«я останусь с вами» — и пропала.\n\n"
    "В поле svodka — одна короткая строка: зачем звонит человек. Её слышит только Андрей, до того как взять "
    "звонок. Без имени, телефона и почты.\n\n"
    "Инструмент ответил perevedeno: false — перевода не было. Тогда скажи то, что в skazat, и сделай, что в "
    "dalshe. Никогда не говори, что переводишь, если инструмент не ответил perevedeno: true.\n"
    "Никогда не переводишь: из любопытства, «просто поговорить», за скидкой, с жалобой на то, что говорит "
    "программа. Не соединилось — «Андрей сейчас не может ответить. Ваш вопрос он увидит сегодня же.» — и письмо, "
    "если его ещё не было.\n\n"
)

OPISANIE = (
    "Переводит звонок на Андрея. Вызывай ТОЛЬКО по разделу «ПЕРЕВОД НА АНДРЕЯ»: случай А — человек сказал, "
    "что диагностика у него уже пройдена, что он уже ваш клиент или что Андрей просил с ним связаться; "
    "случай Б — сошлись все три условия сразу (своими словами готов платить или начинать сейчас; вопрос, без "
    "которого он не заплатит, и ответа на него нет в инструкции; сам просит живого человека). Перед вызовом "
    "ничего не говори: фразу «Соединяю с Андреем…» скажет сам инструмент. После вызова молчи. Ответ "
    "perevedeno: false — перевода не было: скажи skazat и сделай, что в dalshe."
)


def api(put, metod="GET", telo=None):
    dan = json.dumps(telo).encode() if telo is not None else None
    r = urllib.request.Request("https://api.elevenlabs.io/v1" + put, data=dan, method=metod,
                               headers={"xi-api-key": d.env("ELEVENLABS_API_KEY"),
                                        "content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=40, context=d.CTX) as o:
            t = o.read().decode()
            return o.status, (json.loads(t) if t.strip().startswith(("{", "[")) else {})
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        return e.code, {"oshibka": t[:600]}


def agent():
    kod, a = api("/convai/agents/" + AGENT)
    if kod != 200:
        sys.exit("агент не прочитался: %s %s" % (kod, a))
    return a


def prompt_chast(a):
    return a["conversation_config"]["agent"]["prompt"]


def proverit_vykatku():
    """Без выкатки включать нельзя: Вера позовёт функцию, которой нет (404), и промолчит."""
    ok = True
    for u in ZVUKI:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, method="GET"), timeout=20, context=d.CTX) as o:
                tip = o.headers.get("content-type", "")
                dlina = len(o.read())
                hor = o.status == 200 and tip.startswith("audio/mpeg") and dlina > 20000
                print("  фраза %-16s %s %s %d байт — %s" % (u.rsplit("/", 1)[1], o.status, tip, dlina,
                                                          "ок" if hor else "ПЛОХО"))
                ok = ok and hor
        except urllib.error.HTTPError as e:
            print("  фраза %s — %s ПЛОХО" % (u.rsplit("/", 1)[1], e.code)); ok = False
    try:
        urllib.request.urlopen(urllib.request.Request(URL, data=b"{}", method="POST",
                               headers={"content-type": "application/json"}), timeout=20, context=d.CTX)
        print("  функция без секрета ответила 200 — ПЛОХО (ждали 401)"); ok = False
    except urllib.error.HTTPError as e:
        print("  функция без секрета —", e.code, "ок" if e.code == 401 else "ПЛОХО (ждали 401)")
        ok = ok and e.code == 401
    return ok


def konfig_instrumenta(secret):
    return {"tool_config": {
        "type": "webhook", "name": IMYA, "description": OPISANIE,
        "response_timeout_secs": 20, "disable_interruptions": False,
        "force_pre_tool_speech": False, "pre_tool_speech": "auto", "execution_mode": "immediate",
        "api_schema": {
            "url": URL, "method": "POST", "content_type": "application/json",
            "request_headers": {"x-golos-secret": secret, "content-type": "application/json"},
            "request_body_schema": {
                "type": "object", "description": "Перевод звонка на Андрея",
                "required": ["call_sid", "svodka"],
                "properties": {
                    "call_sid": {"type": "string", "description": "",
                                 "dynamic_variable": "system__call_sid"},
                    "svodka": {"type": "string",
                               "description": "Одна короткая строка: зачем звонит человек. "
                                              "Без имени, телефона и почты."},
                    "yazyk": {"type": "string", "description": "", "constant_value": "ru"},
                },
            },
        },
    }}


def nayti_instrument():
    kod, d_ = api("/convai/tools")
    for t in (d_.get("tools") or []):
        if (t.get("tool_config") or {}).get("name") == IMYA:
            return t.get("id")
    return None


def status():
    a = agent()
    pr = prompt_chast(a)
    ids = pr.get("tool_ids") or []
    imena = []
    for tid in ids:
        _, t = api("/convai/tools/" + tid)
        imena.append("%s=%s" % ((t.get("tool_config") or {}).get("name"), tid[-6:]))
    p = pr.get("prompt", "")
    bt = pr.get("built_in_tools") or {}
    print("  инструменты:", ", ".join(imena))
    print("  встроенные включены:", ", ".join(k for k, v in bt.items() if v) or "—")
    print("  промпт: старый абзац —", p.count(STARYY_NACHALO), "· новый —", p.count(NOVYY_NACHALO),
          "· старая формула —", p.count(STARAYA_FORMULA), "· новая —", p.count(NOVAYA_FORMULA))
    return a


def vklyuchit():
    secret = d.env("GOLOS_PISMO_SECRET")
    if not secret:
        sys.exit("нет GOLOS_PISMO_SECRET в ~/.bidna-golos.env")
    print("  проверка выкатки:")
    if not proverit_vykatku():
        sys.exit("выкатка не на месте — агента не трогаю")

    a = agent()
    pr = prompt_chast(a)
    p = pr.get("prompt", "")
    i = p.find(STARYY_NACHALO)
    j = p.find(KONEC, i)
    if p.count(STARYY_NACHALO) != 1 or j < 0:
        sys.exit("старый абзац не найден ровно один раз — промпт меняли? Ничего не трогаю.")
    if p.count(STARAYA_FORMULA) != 1:
        sys.exit("общая формула «Соединяю, одну секунду» не найдена ровно один раз. Ничего не трогаю.")
    staryy = p[i:j]
    otkat = json.loads(OTKAT.read_text(encoding="utf-8"))
    if staryy not in otkat["prompt"]:
        sys.exit("старый абзац расходится с otkat-agent-dna.json — сверить руками. Ничего не трогаю.")

    tid = nayti_instrument()
    if tid:
        kod, otv = api("/convai/tools/" + tid, "PATCH", konfig_instrumenta(secret))
        print("  инструмент уже был, обновлён:", kod, tid[-6:])
    else:
        kod, otv = api("/convai/tools", "POST", konfig_instrumenta(secret))
        tid = otv.get("id")
        print("  инструмент заведён:", kod, (tid or "")[-6:])
    if kod not in (200, 201) or not tid:
        sys.exit("инструмент не заведён: %s %s" % (kod, json.dumps(otv, ensure_ascii=False)[:400]))

    bt = dict(pr.get("built_in_tools") or {})
    byl_end_call = bool(bt.get("end_call"))
    bt["transfer_to_number"] = None
    ids = [x for x in (pr.get("tool_ids") or []) if x != tid] + [tid]
    novyy = (p[:i] + NOVYY_ABZAC + p[j:]).replace(STARAYA_FORMULA, NOVAYA_FORMULA)
    kod, otv = api("/convai/agents/" + AGENT, "PATCH", {"conversation_config": {"agent": {"prompt": {
        "prompt": novyy, "tool_ids": ids, "built_in_tools": bt}}}})
    if kod != 200:
        sys.exit("агент не обновился (ничего не поменялось): %s %s" % (kod, json.dumps(otv, ensure_ascii=False)[:400]))
    print("  агент обновлён:", kod)
    a = status()
    pr = prompt_chast(a)
    p2 = pr.get("prompt", "")
    bt2 = pr.get("built_in_tools") or {}
    assert tid in (pr.get("tool_ids") or []), "инструмента нет у агента"
    assert not bt2.get("transfer_to_number"), "системный перевод остался"
    assert (not byl_end_call) or bt2.get("end_call"), "ПРОПАЛ end_call — сразу --otkatit!"
    assert p2.count(NOVYY_NACHALO) == 1, "новый абзац не встал"
    assert p2.count(STARAYA_FORMULA) == 0 and p2.count(NOVAYA_FORMULA) == 1, "формула не заменилась"
    assert "client_message" not in p2, "в промпте остался client_message"
    print("  ВКЛЮЧЕНО: перевод русской линии идёт через perevod-ru")


def otkatit():
    otkat = json.loads(OTKAT.read_text(encoding="utf-8"))
    a = agent()
    pr = prompt_chast(a)
    p = pr.get("prompt", "")
    oi = otkat["prompt"].find(STARYY_NACHALO)
    oj = otkat["prompt"].find(KONEC, oi)
    i = p.find(NOVYY_NACHALO)
    j = p.find(KONEC, i) if i >= 0 else -1
    if i >= 0 and j > i:
        novyy = p[:i] + otkat["prompt"][oi:oj] + p[j:]
        print("  промпт: новый абзац заменён старым, остальное не тронуто")
    elif p.count(STARYY_NACHALO) == 1:
        novyy = p
        print("  промпт: старый абзац и так на месте")
    else:
        novyy = otkat["prompt"]
        print("  промпт: ни нового, ни старого абзаца — ставлю промпт целиком из otkat-agent-dna.json")
    novyy = novyy.replace(NOVAYA_FORMULA, STARAYA_FORMULA)

    bt = dict(pr.get("built_in_tools") or {})
    byl_end_call = bool(bt.get("end_call"))
    bt["transfer_to_number"] = otkat["transfer_to_number"]
    kod, otv = api("/convai/agents/" + AGENT, "PATCH", {"conversation_config": {"agent": {"prompt": {
        "prompt": novyy, "tool_ids": otkat["tool_ids"], "built_in_tools": bt}}}})
    if kod != 200:
        sys.exit("откат не прошёл (%s): %s\nВернуть руками в кабинете ElevenLabs — см. шапку файла."
                 % (kod, json.dumps(otv, ensure_ascii=False)[:400]))
    a = status()
    pr = prompt_chast(a)
    p2 = pr.get("prompt", "")
    bt2 = pr.get("built_in_tools") or {}
    assert bt2.get("transfer_to_number"), "системный перевод не вернулся"
    assert (not byl_end_call) or bt2.get("end_call"), "ПРОПАЛ end_call"
    assert p2.count(STARYY_NACHALO) == 1, "старый абзац не вернулся"
    assert p2.count(STARAYA_FORMULA) == 1, "старая формула не вернулась"
    print("  ОТКАЧЕНО: русская линия на системном transfer_to_number")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--status", action="store_true")
    g.add_argument("--vklyuchit", action="store_true")
    g.add_argument("--otkatit", action="store_true")
    x = ap.parse_args()
    if x.status:
        status()
    elif x.vklyuchit:
        vklyuchit()
    else:
        otkatit()
