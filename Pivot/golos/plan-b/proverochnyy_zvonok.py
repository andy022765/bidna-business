#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""План Б: один проверочный звонок на русскую линию и разбор, что было на самом деле.

    python3 Pivot/golos/plan-b/proverochnyy_zvonok.py --scenariy perevod-ru-01 --metka "1: берёт и жмёт 1"

Звонит проверяльщик (агент «Покупатель · приёмка») с нашего служебного номера на Веру.
На время звонка у проверяльщика снимается end_call — иначе он кладёт трубку сразу после
«Соединяю…» (грабля из PLAN-B-PEREVOD.md) — и ВСЕГДА возвращается после, даже при ошибке.

Разбор — по первоисточникам, а не по пересказу проверяльщика:
  · входящая нога на русскую линию и её дочерняя нога на Андрея (Twilio: статус, секунды);
  · разговор Веры (ElevenLabs): какой инструмент позван и что он ответил;
  · что слышал проверяльщик (его распознавание — только подсказка: он слышит музыку как речь).
"""
import argparse, json, pathlib, sys, time, urllib.request

ZDES = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ZDES.parent / "dozvonshchik"))
import dozvonshchik as d

PROVERYALSHCHIK = "agent_4701m34zngp2e9cb2w5wcrd171zr"
VERA = "agent_1401m2bc9k58f6nrj8v51pw2v2s3"
LINIYA = "+14247811913"
OT = "+14242756121"
ANDREY_KONEC = "6864"


def end_call(vklyuchit, zapas):
    telo = {"conversation_config": {"agent": {"prompt": {"built_in_tools": {
        "end_call": zapas if vklyuchit else None}}}}}
    r = urllib.request.Request("https://api.elevenlabs.io/v1/convai/agents/" + PROVERYALSHCHIK,
                               data=json.dumps(telo).encode(), method="PATCH",
                               headers={"xi-api-key": d.env("ELEVENLABS_API_KEY"),
                                        "content-type": "application/json"})
    with urllib.request.urlopen(r, timeout=40, context=d.CTX) as o:
        return o.status


def maska(n):
    n = n or ""
    return (n[:5] + "…" + n[-4:]) if n.startswith("+") and len(n) > 8 else n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenariy", required=True)
    ap.add_argument("--metka", default="")
    a = ap.parse_args()

    sc = json.loads((ZDES.parent / "dozvonshchik" / "scenarii.json").read_text(encoding="utf-8"))
    s = next((x for x in sc if x["id"] == a.scenariy), None)
    if not s:
        sys.exit("нет сценария " + a.scenariy)

    ag = d.eleven("/convai/agents/" + PROVERYALSHCHIK)
    zapas = ag["conversation_config"]["agent"]["prompt"]["built_in_tools"].get("end_call")
    if not zapas:     # уже снят прошлым прерванным запуском — берём копию из скретчпада
        zapas = json.load(open("/private/tmp/claude-501/-Users-andriizhyla-Library-CloudStorage-GoogleDrive-andywar777-gmail-com-My-Drive--------Private/5948039a-edb0-4d79-b668-621269d74967/scratchpad/tester-agent-backup-2026-09-28.json",
                               encoding="utf-8"))["conversation_config"]["agent"]["prompt"]["built_in_tools"]["end_call"]
    nachalo = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 5))
    try:
        print("  end_call снят:", end_call(False, zapas))
        sid = d.pozvonit(LINIYA, s, "", OT, PROVERYALSHCHIK)
        if not sid:
            sys.exit("не дозвонились")
        print("  звоню:", s["id"], "·", a.metka, "· sid …" + sid[-6:])
        st, sek = d.zhdat(sid)
        print("  звонок кончился:", st, sek, "с")
    finally:
        print("  end_call возвращён:", end_call(True, zapas))

    # Входящая нога на линию и дочерняя на Андрея.
    time.sleep(6)
    kod, r = d.twilio("/Calls.json?PageSize=20&StartTime%3E=" + nachalo)
    vse = r.get("calls", [])
    vhod = [c for c in vse if c.get("direction") == "inbound" and c.get("to") == LINIYA]
    doch = [c for c in vse if (c.get("to") or "").endswith(ANDREY_KONEC)]
    print("\n  НОГИ TWILIO")
    for c in vhod + doch:
        print("   ", c["sid"][-6:], c.get("direction"), maska(c.get("from")), "→", maska(c.get("to")),
              c.get("status"), c.get("duration"), "с", "начало", (c.get("start_time") or "")[17:25],
              "конец", (c.get("end_time") or "")[17:25], "| родитель …" + (c.get("parent_call_sid") or "")[-6:])

    # Разговор Веры по sid входящей ноги.
    print("\n  ВЕРА")
    vsid = vhod[0]["sid"] if vhod else ""
    naydeno = None
    for _ in range(6):
        for cv in d.eleven("/convai/conversations?agent_id=%s&page_size=6" % VERA).get("conversations", []):
            polnyy = d.eleven("/convai/conversations/%s" % cv["conversation_id"])
            if ((polnyy.get("metadata") or {}).get("phone_call") or {}).get("call_sid") == vsid:
                naydeno = polnyy
                break
        if naydeno and naydeno.get("transcript"):
            break
        time.sleep(5)
    if naydeno:
        md = naydeno.get("metadata") or {}
        print("    разговор", naydeno.get("conversation_id"), "·", md.get("call_duration_secs"), "с ·",
              md.get("termination_reason"))
        for t in naydeno.get("transcript") or []:
            m = (t.get("message") or "").strip()
            if m:
                print("    %4ss %-5s %s" % (t.get("time_in_call_secs"), t.get("role"), m[:150]))
            for x in t.get("tool_calls") or []:
                print("          ВЫЗОВ", x.get("tool_name"), json.dumps(x.get("params_as_json") or "", ensure_ascii=False)[:160])
            for x in t.get("tool_results") or []:
                print("          ОТВЕТ", x.get("tool_name"), str(x.get("result_value"))[:160])
    else:
        print("    разговор Веры не найден по sid входящей ноги")

    # Что слышал проверяльщик.
    razg = d.razgovor_po_zvonku(PROVERYALSHCHIK, sid) or {}
    rech = [{"kto": h.get("role"), "chto": (h.get("message") or "").strip()}
            for h in (razg.get("transcript") or []) if (h.get("message") or "").strip()]
    print("\n  ПРОВЕРЯЛЬЩИК (его распознавание)")
    for x in rech:
        print("    %-6s %s" % ("сказал" if x["kto"] == "agent" else "слышал", x["chto"][:150]))

    f = ZDES.parent / "dozvonshchik" / "progony" / (time.strftime("%Y-%m-%d") + "-14247811913.json")
    itogi = json.loads(f.read_text(encoding="utf-8")) if f.exists() else []
    itogi.append({"id": s["id"] + "-planb", "metka": a.metka, "sid": sid, "status": st, "sekund": sek,
                  "vhod": vsid, "nogi_andreyu": [{"sid": c["sid"], "status": c.get("status"),
                  "sekund": c.get("duration")} for c in doch],
                  "razgovor_very": (naydeno or {}).get("conversation_id"), "rech": rech})
    f.write_text(json.dumps(itogi, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n  записано в", f.name)


if __name__ == "__main__":
    main()
