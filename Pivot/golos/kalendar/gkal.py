#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Общее для работы с Google Calendar из терминала: токен и вызовы.

Библиотек Google на этом Маке нет и ставить их ради нескольких вызовов незачем —
JWT собираем на `cryptography`, которая уже есть. Заодно видно, что именно уходит в Google.

КЛЮЧ ЛЕЖИТ ВНЕ ПАПКИ ПРОЕКТА — `~/bidna-klyuchi/vera-kalendar.json`. Папка синхронизируется
в Google Drive, и ключ в ней означал бы ключ в облаке.
"""
import base64, json, os, ssl, time, urllib.error, urllib.parse, urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

KLYUCH = os.path.expanduser("~/bidna-klyuchi/vera-kalendar.json")
SCOPE = "https://www.googleapis.com/auth/calendar"
BAZA = "https://www.googleapis.com/calendar/v3"

# Календарь «Вера-демо». Не секрет: адрес лежит и в переменных сайта, и в записях.
KALENDAR = ("c_2bbff76ade45767b2810a2958fb645cd1b523e20bfd127fc31fd821897a988e1"
            "@group.calendar.google.com")

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

_tok = {"znachenie": None, "do": 0}


def token():
    """Токен с запасом: переиспользуем, пока не истёк."""
    if _tok["znachenie"] and time.time() < _tok["do"] - 60:
        return _tok["znachenie"]
    k = json.load(open(KLYUCH))
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=")
    now = int(time.time())
    zag = b64(json.dumps({"alg": "RS256", "typ": "JWT", "kid": k["private_key_id"]}).encode())
    telo = b64(json.dumps({"iss": k["client_email"], "scope": SCOPE,
                           "aud": "https://oauth2.googleapis.com/token",
                           "iat": now, "exp": now + 3600}).encode())
    pk = serialization.load_pem_private_key(k["private_key"].encode(), password=None)
    podpis = b64(pk.sign(zag + b"." + telo, padding.PKCS1v15(), hashes.SHA256()))
    jwt = (zag + b"." + telo + b"." + podpis).decode()
    r = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=urllib.parse.urlencode(
            {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": jwt}).encode())
    with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
        d = json.load(o)
    _tok["znachenie"], _tok["do"] = d["access_token"], now + int(d.get("expires_in", 3600))
    return _tok["znachenie"]


def pochta():
    return json.load(open(KLYUCH))["client_email"]


def api(put, telo=None, metod="GET"):
    """Возвращает (код, ответ). Тело ошибки отдаём как есть: секретов в нём нет, а причина есть."""
    dan = json.dumps(telo).encode() if telo is not None else None
    r = urllib.request.Request(BAZA + put, data=dan, method=metod,
                              headers={"Authorization": "Bearer " + token(),
                                       "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
            t = o.read().decode("utf8", "replace")
            return o.status, (json.loads(t) if t.strip().startswith(("{", "[")) else t)
    except urllib.error.HTTPError as e:
        t = e.read().decode("utf8", "replace")
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, t[:300]
    except Exception as ex:
        return 0, {"error": type(ex).__name__ + ": " + str(ex)[:120]}


def kal(put=""):
    return "/calendars/" + urllib.parse.quote(KALENDAR) + put
