#!/usr/bin/env python3
"""Добавляет инструменту письма поле otvet — ответ человека дословно.

Зачем. Прогон 16.09: Вера зачитала «angrii@», человек сказал «Нет, не джи, а ди»,
она переспросила и, услышав «Да, верно», отправила письмо на СТАРЫЙ адрес.
Со стороны сервера это неотличимо от честного подтверждения — два одинаковых
вызова подряд. С полем otvet сервер видит отказ сам и не даёт отправить
(проверка в netlify-functions/pismo.js, регулярка OTKAZ).

ЖИВАЯ ПРАВКА: инструменты подцеплены к боевым агентам. Запускать только
в окне выкатки и только после «да» Андрея. Сначала выкатить сайт (pismo.js),
потом этот скрипт: иначе модель шлёт поле, которого сервер ещё не ждёт.

  python3 dobavit_otvet.py            # показать, что изменится
  python3 dobavit_otvet.py --pisat    # записать
"""
import os
import sys

import requests

KL = os.environ.get("ELEVENLABS_API_KEY")
if not KL:
    sys.exit("нет ELEVENLABS_API_KEY — source ~/.bidna-golos.env")
H = {"xi-api-key": KL}
B = "https://api.elevenlabs.io/v1/convai/tools"
PISAT = "--pisat" in sys.argv

POLE = {
    "type": "string",
    "description": (
        "Что человек ответил на чтение адреса по буквам — дословно, его словами. "
        "Не пересказывай и не приглаживай: «да», «нет, не джи, а ди», «не так». "
        "Обязательно вместе с podtverdil: true."
    ),
    "enum": None,
    "is_system_provided": False,
    "dynamic_variable": "",
    "allowed_values": None,
    "allowed_values_dynamic_variable": "",
    "constant_value": "",
    "is_omitted": False,
}


def main():
    tools = requests.get(B, headers=H, timeout=30).json().get("tools", [])
    tronuli = 0
    for t in tools:
        k = t["tool_config"]
        if k["name"] != "otpravit_ssylku":
            continue
        shema = (k.get("api_schema") or {}).get("request_body_schema") or {}
        polya = shema.get("properties") or {}
        if "podtverdil" not in polya:
            print(f"пропускаю {t['id']} — двух шагов нет (сухой инструмент)")
            continue
        if "otvet" in polya:
            print(f"уже есть  {t['id']}")
            continue
        print(f"добавляю  {t['id']} → {k['api_schema']['url']}")
        tronuli += 1
        if not PISAT:
            continue
        polya["otvet"] = POLE
        shema["properties"] = polya
        r = requests.patch(f"{B}/{t['id']}", headers=H, json={"tool_config": k}, timeout=60)
        print("   ", r.status_code, "ok" if r.status_code == 200 else r.text[:200])
    if not PISAT and tronuli:
        print(f"\nэто показ. записать: python3 {os.path.basename(__file__)} --pisat")


main()
