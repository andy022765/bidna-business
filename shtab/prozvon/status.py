#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Статусы отправленных писем в Resend — только чтение, ничего не шлёт.

    set -a; . ~/.bidna-golos.env; set +a
    python3 shtab/prozvon/status.py Pivot/spisok/partnery/pisma-partneram-den1.json

Берёт адреса из файла писем, id — из журнала ~/bidna-prozvon-zapisi/otpravleno.json,
спрашивает у Resend последнее событие (delivered / bounced / complained / sent …).
"""
import json, os, pathlib, ssl, sys, urllib.request, urllib.error
import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
UZHE = pathlib.Path.home() / "bidna-prozvon-zapisi" / "otpravleno.json"

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    klyuch = os.environ.get("RESEND_API_KEY") or sys.exit("нет RESEND_API_KEY — сначала: set -a; . ~/.bidna-golos.env; set +a")
    pisma = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    bylo = json.loads(UZHE.read_text()) if UZHE.exists() else {}
    itog = {}
    for p in pisma:
        adres, imya = p["adres"], p["imya"]
        eid = bylo.get(adres)
        if not eid:
            print("НЕ ОТПРАВЛЯЛОСЬ  %-28s %s" % (imya, adres)); itog["не отправлялось"] = itog.get("не отправлялось", 0) + 1; continue
        r = urllib.request.Request("https://api.resend.com/emails/" + eid,
            headers={"Authorization": "Bearer " + klyuch, "Accept": "application/json",
                     "User-Agent": "BusinessIntelDNA-Mailer/1.0 (+https://businessinteldna.com)"})
        try:
            with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
                sob = json.load(o).get("last_event", "?")
        except urllib.error.HTTPError as e:
            sob = "ошибка %s" % e.code
        itog[sob] = itog.get(sob, 0) + 1
        print("%-16s %-28s %s" % (sob, imya, adres))
    print("\nИТОГО:", ", ".join("%s — %d" % kv for kv in sorted(itog.items())))

if __name__ == "__main__":
    main()
