#!/usr/bin/env python3
"""Запрещает перебивать инструмент письма, пока он выполняется.

Зачем. Приёмка 22.09, conv_3201m34zv4fsem2vgy2bjafqryvj, 93-я секунда: Вера вызвала отправку,
звонящий в этот момент заговорил, ElevenLabs записал «Tool execution was abandoned due to user
input». Вызов был брошен со стороны агента — а сервер письмо ОТПРАВИЛ (Resend 16:42:08).
Вера решила, что не отправила, позвала снова и получила «уже ушло». Человек в этот момент
слышит одно, а происходит другое.

Проверено на тестовом агенте 22.09: при interruption_mode=allow перебивание даёт брошенный
вызов (1 из 1), при disable_during_tool — ноль из двух прогонов, вызов доходит целиком.

ЖИВАЯ ПРАВКА: tool_2001 стоит и на телефонной Вере, и на демо. Запускать только в окне
выкатки и только после «да» Андрея.

  python3 ne_perebivat.py            # показать
  python3 ne_perebivat.py --pisat    # сделать
"""
import os
import sys

import requests

BOEVOY = "tool_2001m2bm2p52fhk94msqx44ea2w0"   # otpravit_ssylku у «Дежурный · dna» и «Дежурный · demo»
REZHIM = "disable_during_tool"                  # глушит перебивание только на время вызова
KL = os.environ.get("ELEVENLABS_API_KEY")
if not KL:
    sys.exit("нет ELEVENLABS_API_KEY — source ~/.bidna-golos.env")
H = {"xi-api-key": KL}
B = "https://api.elevenlabs.io/v1/convai/tools"
PISAT = "--pisat" in sys.argv

k = requests.get(f"{B}/{BOEVOY}", headers=H, timeout=30).json()["tool_config"]
print(f"{BOEVOY} · {k['name']} · сейчас interruption_mode = {k.get('interruption_mode')}")
if k.get("interruption_mode") == REZHIM:
    sys.exit("уже стоит, делать нечего")
if not PISAT:
    sys.exit(f"это показ. сделать: python3 {os.path.basename(__file__)} --pisat")
k["interruption_mode"] = REZHIM
r = requests.patch(f"{B}/{BOEVOY}", headers=H, json={"tool_config": k}, timeout=60)
print("   ", r.status_code, r.json().get("tool_config", {}).get("interruption_mode") if r.status_code == 200 else r.text[:200])
