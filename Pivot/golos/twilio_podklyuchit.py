#!/usr/bin/env python3
"""Подключает купленный номер Twilio к Вере нативно (не через SIP).

Почему нативно. На Plivo (SIP) перевод на живого давал односторонний звук:
Маша слышала Андрея, он её — нет. У Twilio интеграция своя, перевод штатный.

Что нужно заранее:
  TWILIO_API_KEY, TWILIO_API_SECRET — ими ElevenLabs ходит в Twilio.
  TWILIO_AUTH_TOKEN — ОТДЕЛЬНЫМ полем account_auth_token: им ElevenLabs проверяет
      подпись входящих вебхуков. Разобрано 16.09 перебором: пара «SID аккаунта +
      Auth Token» даёт 401 от Twilio, а «API-ключ + секрет + account_auth_token» — 200.
      Токен берётся в консоли Twilio на главной, блок Account Info → Auth Token.
  ELEVENLABS_API_KEY

  python3 twilio_podklyuchit.py            # показать, что будет сделано
  python3 twilio_podklyuchit.py --pisat    # сделать
"""
import json
import os
import sys

import requests

NOMER = "+14247811913"          # куплен 16.09, PN15a7260ba2a6f21b2bc24fe92ec7afcd
AGENT = "agent_1401m2bc9k58f6nrj8v51pw2v2s3"   # Дежурный · dna (Линии 03 + 05)
METKA = "Вера · Twilio"

E = "https://api.elevenlabs.io/v1/convai"
PISAT = "--pisat" in sys.argv


def nado(imya):
    v = os.environ.get(imya)
    if not v:
        sys.exit(f"нет {imya}. Токен добавить так (в терминале, не сюда):\n"
                 f"  printf 'export TWILIO_AUTH_TOKEN=%s\\n' 'ТОКЕН' >> ~/.bidna-golos.env")
    return v


def main():
    H = {"xi-api-key": nado("ELEVENLABS_API_KEY"), "content-type": "application/json"}
    kl, sek = nado("TWILIO_API_KEY"), nado("TWILIO_API_SECRET")
    tok = nado("TWILIO_AUTH_TOKEN")

    est = requests.get(f"{E}/phone-numbers", headers=H, timeout=30).json()
    svoy = next((n for n in est if n.get("phone_number") == NOMER), None)
    for n in est:
        print(f"  уже подключено: {n.get('phone_number')} · {n.get('provider')} · агент {n.get('assigned_agent') or '—'}")
    if svoy:
        print(f"\n{NOMER} уже в ElevenLabs: {svoy.get('phone_number_id')}")
    else:
        print(f"\nимпортирую {NOMER} как нативный Twilio")
        if not PISAT:
            return print("\nэто показ. сделать: python3 twilio_podklyuchit.py --pisat")
        r = requests.post(f"{E}/phone-numbers", headers=H, timeout=60, json={
            "phone_number": NOMER, "label": METKA, "provider": "twilio",
            "sid": kl, "token": sek, "account_auth_token": tok})
        print("   импорт:", r.status_code, json.dumps(r.json(), ensure_ascii=False)[:300])
        if r.status_code >= 300:
            sys.exit(1)
        svoy = r.json()

    pid = svoy.get("phone_number_id")
    print(f"цепляю агента {AGENT}")
    if not PISAT:
        return print("\nэто показ. сделать: python3 twilio_podklyuchit.py --pisat")
    r = requests.patch(f"{E}/phone-numbers/{pid}", headers=H, json={"agent_id": AGENT}, timeout=60)
    print("   привязка:", r.status_code, json.dumps(r.json(), ensure_ascii=False)[:300])
    print(f"\nГОТОВО. Звонить на {NOMER}. Плива не трогаем — старый номер пока жив.")


main()
