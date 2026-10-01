# -*- coding: utf-8 -*-
"""Расшифровка разговора из ElevenLabs — файлом, чтобы её мог прочитать ШТАБ.

У ШТАБА ключа ElevenLabs нет, а верить моему пересказу он не обязан: пересказ — это
уже моя трактовка. Поэтому кладём ответ API КАК ЕСТЬ, без правок.

Ключи из ответа не убираем по одной причине — их там нет: API отдаёт разговор,
а не настройки. На всякий случай перед записью проверяем, что в файле не оказалось
строки, похожей на ключ, и падаем, если оказалась.

    python3 Pivot/golos/proverka/vygruzki/vygruzit.py conv_… [conv_… …]
"""
import json
import os
import pathlib
import re
import subprocess
import sys

TUT = pathlib.Path(__file__).resolve().parent
OPASNO = re.compile(r"(sk_[A-Za-z0-9]{20,}|rk_(live|test)_[A-Za-z0-9]{20,}"
                    r"|whsec_[A-Za-z0-9]{12,}|xi-api-key)")


def vzyat(cid, klyuch):
    r = subprocess.run(["curl", "-s", "-H", "xi-api-key: " + klyuch,
                        "https://api.elevenlabs.io/v1/convai/conversations/" + cid],
                       capture_output=True, text=True)
    return r.stdout


def main():
    klyuch = os.environ.get("ELEVENLABS_API_KEY", "")
    if not klyuch:
        print("  нет ELEVENLABS_API_KEY"); raise SystemExit(2)
    if not sys.argv[1:]:
        print("  укажите идентификаторы разговоров"); raise SystemExit(2)
    for cid in sys.argv[1:]:
        syroe = vzyat(cid, klyuch)
        if OPASNO.search(syroe):
            print("  %s: в ответе нашлось похожее на ключ — НЕ записываю" % cid); continue
        try:
            d = json.loads(syroe)
        except Exception:
            print("  %s: ответ не разобрать" % cid); continue
        if d.get("detail"):
            print("  %s: %s" % (cid, json.dumps(d["detail"], ensure_ascii=False)[:120])); continue
        put = TUT / (cid + ".json")
        put.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
        # Рядом — читаемая расшифровка, чтобы не разбирать JSON глазами.
        stroki = []
        for t in d.get("transcript", []):
            m = (t.get("message") or "").strip()
            if m:
                stroki.append("[%ss] %-6s %s" % (t.get("time_in_call_secs"), t.get("role"), m))
            for tc in (t.get("tool_calls") or []):
                stroki.append("        >> %s %s" % (tc.get("tool_name"),
                              json.dumps(tc.get("params_as_json") or {}, ensure_ascii=False)[:300]))
            for tr in (t.get("tool_results") or []):
                stroki.append("        << %s %s" % (tr.get("tool_name"),
                              json.dumps(tr.get("result_value"), ensure_ascii=False)[:400]))
        md = d.get("metadata") or {}
        shapka = ["разговор: %s" % cid,
                  "длительность: %s с" % md.get("call_duration_secs"),
                  "причина конца: %s" % md.get("termination_reason"),
                  "агент: %s" % d.get("agent_id"), ""]
        (TUT / (cid + ".txt")).write_text("\n".join(shapka + stroki) + "\n", encoding="utf-8")
        print("  %s → %s.json и %s.txt (%d реплик)" % (cid, cid, cid, len(stroki)))


if __name__ == "__main__":
    main()
