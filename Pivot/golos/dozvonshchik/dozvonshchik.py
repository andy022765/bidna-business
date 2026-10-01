#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обкатка линии клиента: тридцать тестовых звонков машиной.

    python3 Pivot/golos/dozvonshchik/dozvonshchik.py --komu +15551234567 --proba
    python3 Pivot/golos/dozvonshchik/dozvonshchik.py --komu +15551234567 --vse
    python3 Pivot/golos/dozvonshchik/dozvonshchik.py --otchet 2026-09-26

ЗВОНИМ ПО ОДНОМУ. Это линия живого бизнеса: тридцать одновременных звонков — не обкатка,
а отказ в обслуживании его клиентам. Между звонками пауза, и её нельзя убирать «для скорости».

ЗВОНИМ ТОЛЬКО НА ПОДТВЕРЖДЁННЫЙ НОМЕР. Файл `razresheno.json` — список номеров, на которые
клиент письменно разрешил звонить. Номера нет в списке — не звоним, даже если он в команде.
Причина простая: если переадресация упадёт на живого человека, наш робот позвонит человеку
тридцать раз.

МИНУТЫ СЧИТАЕМ ОТДЕЛЬНО И КЛИЕНТУ НЕ ПИШЕМ. Решение Андрея 26.09: обкатка за наш счёт.
Отчёт клиенту показывает, ЧТО нашли, а не сколько это стоило.
"""
import argparse, base64, json, os, pathlib, re, ssl, sys, time
import urllib.error, urllib.parse, urllib.request

ZDES = pathlib.Path(__file__).resolve().parent
SCENARII = ZDES / "scenarii.json"
RAZRESHENO = ZDES / "razresheno.json"
VYHOD = ZDES / "progony"

PAUZA_MEZHDU = 20          # секунд между звонками
POTOLOK_ZVONKOV = 30
SROK_ZVONKA = 300          # ждём дольше, чем потолок разговора у агента (180 с),
                           # иначе дозвонщик сдаётся раньше, чем звонок кончится,
                           # и пишет «затянулся · 0 с» по удавшемуся звонку

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()


def env(imya):
    v = os.environ.get(imya, "").strip()
    if v:
        return v
    # Берём ПОСЛЕДНЕЕ объявление, как это делает оболочка. Первое встречавшееся
    # однажды уже стоило нам часа: в файле лежала дописанная заглушка ТОКЕН_СЮДА,
    # оболочка её перекрывала, а скрипт брал именно её и ловил «401 auth failed»
    # на живых ключах.
    naydeno = ""
    try:
        for ln in open(os.path.expanduser("~/.bidna-golos.env"), encoding="utf-8"):
            ln = ln.strip().replace("export ", "", 1)
            if ln.startswith(imya + "="):
                naydeno = ln.split("=", 1)[1].strip().strip("\"'")
    except Exception:
        pass
    return naydeno


def twilio(put, telo=None, metod=None):
    sid, tok = env("TWILIO_ACCOUNT_SID"), env("TWILIO_AUTH_TOKEN")
    osn = base64.b64encode(("%s:%s" % (sid, tok)).encode()).decode()
    dan = urllib.parse.urlencode(telo).encode() if telo else None
    r = urllib.request.Request(
        "https://api.twilio.com/2010-04-01/Accounts/%s%s" % (sid, put),
        data=dan, method=metod or ("POST" if telo else "GET"),
        headers={"Authorization": "Basic " + osn})
    try:
        with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
            return o.status, json.loads(o.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}


def eleven(put):
    r = urllib.request.Request("https://api.elevenlabs.io/v1" + put,
                               headers={"xi-api-key": env("ELEVENLABS_API_KEY")})
    try:
        with urllib.request.urlopen(r, timeout=40, context=CTX) as o:
            return json.loads(o.read().decode())
    except Exception:
        return {}


def twiml_u_elevenlabs(agent, ot, komu, scenariy, nomer_scenariya, ukazaniya=""):
    """TwiML для исходящего разговора — берём ДО звонка.

    Зачем так. Обычный путь — Twilio дёргает наш вебхук, вебхук идёт к ElevenLabs.
    Для этого вебхук должен быть в интернете, то есть выкачен; а `netlify dev --live`
    держится всего несколько минут и отдаёт Twilio 502 (проверено: 0 запросов из 12).
    Но `register-call` не спрашивает идентификатор звонка — значит TwiML можно получить
    заранее и отдать Twilio прямо в запросе полем `Twiml`. Ни туннеля, ни выкатки.
    """
    telo = json.dumps({
        "agent_id": agent, "from_number": ot, "to_number": komu, "direction": "outbound",
        "conversation_initiation_client_data": {
            "dynamic_variables": {"scenariy": scenariy, "nomer_scenariya": nomer_scenariya,
                                  "ukazaniya": ukazaniya},
        },
    }).encode()
    r = urllib.request.Request(
        "https://api.elevenlabs.io/v1/convai/twilio/register-call", data=telo, method="POST",
        headers={"xi-api-key": env("ELEVENLABS_API_KEY"), "content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=40, context=CTX) as o:
            tekst = o.read().decode()
    except urllib.error.HTTPError as e:
        print("    ElevenLabs отказал: %s %s" % (e.code, e.read().decode()[:160]))
        return ""
    except Exception as e:
        print("    ElevenLabs недоступен: %s" % e)
        return ""
    tekst = tekst.strip()
    x = json.loads(tekst).get("twiml", "") if tekst.startswith("{") else tekst
    if "<Response" not in x:
        print("    ответ не похож на TwiML: %s" % tekst[:160])
        return ""
    return x


def razresheno(nomer):
    """Номер должен лежать в списке письменных разрешений — иначе не звоним."""
    if not RAZRESHENO.exists():
        return False, "файла razresheno.json нет"
    try:
        d = json.loads(RAZRESHENO.read_text(encoding="utf-8"))
    except Exception as e:
        return False, "razresheno.json не читается: %s" % e
    for z in d:
        if z.get("nomer") == nomer:
            if not z.get("pismo"):
                return False, "нет письменного разрешения (поле pismo пустое)"
            return True, z.get("kto", "")
    return False, "номера нет в списке разрешённых"


def pozvonit(komu, scenariy, adres_funkcii, ot, agent=None):
    """Один звонок. Возвращает sid или None.

    Без `--adres` TwiML берётся заранее и едет в самом запросе — вебхук не нужен.
    С `--adres` работает старый путь через нашу выкаченную функцию."""
    if not adres_funkcii:
        x = twiml_u_elevenlabs(agent, ot, komu, scenariy["chto_govorit"], scenariy["id"],
                               scenariy.get("ukazaniya", ""))
        if not x:
            return None
        kod, d = twilio("/Calls.json", {
            "To": komu, "From": ot, "Twiml": x, "Timeout": 30,
            "StatusCallbackEvent": "completed",
        })
        if kod >= 300 or not d.get("sid"):
            print("    не дозвонились: %s %s" % (kod, json.dumps(d, ensure_ascii=False)[:160]))
            return None
        return d["sid"]
    # `baza` — тот адрес, по которому мы стучимся снаружи. Функция видит СВОЙ адрес,
    # и через туннель это другая строка (наружу netlify.live, внутрь localhost), из-за
    # чего подпись не сходится. Подделать `baza` нельзя: она внутри подписанного адреса.
    baza = "/".join(adres_funkcii.split("/")[:3])
    url = "%s?%s" % (adres_funkcii, urllib.parse.urlencode(
        {"s": scenariy["chto_govorit"], "id": scenariy["id"], "baza": baza}))
    kod, d = twilio("/Calls.json", {
        "To": komu, "From": ot,
        "Url": url, "Method": "POST",
        "Timeout": 30,
        "StatusCallbackEvent": "completed",
    })
    if kod >= 300 or not d.get("sid"):
        print("    не дозвонились: %s %s" % (kod, json.dumps(d, ensure_ascii=False)[:160]))
        return None
    return d["sid"]


def zhdat(sid):
    """Ждём конца звонка. Возвращает (статус, секунды)."""
    nachalo = time.time()
    while time.time() - nachalo < SROK_ZVONKA:
        kod, d = twilio("/Calls/%s.json" % sid)
        st = d.get("status") if kod == 200 else "?"
        if st in ("completed", "failed", "busy", "no-answer", "canceled"):
            return st, int(d.get("duration") or 0)
        time.sleep(4)
    return "затянулся", 0


def razgovor_po_zvonku(agent, sid, popytok=7, pauza=5):
    """Ищем разговор ElevenLabs по CallSid — по нему потом читаем расшифровку.

    Спрашиваем несколько раз: трубка положена раньше, чем ElevenLabs дописывает запись.
    Без ожидания дозвонщик видел «реплик 0» по звонку, который на самом деле удался,
    и объявлял сценарий сорвавшимся."""
    for n in range(popytok):
        d = eleven("/convai/conversations?agent_id=%s&page_size=12" % agent)
        for c in d.get("conversations", []):
            polnyy = eleven("/convai/conversations/%s" % c.get("conversation_id"))
            pc = (polnyy.get("metadata") or {}).get("phone_call") or {}
            if pc.get("call_sid") == sid:
                # Пустая расшифровка у ещё не закрытого разговора — ждём дальше.
                if polnyy.get("transcript") or n == popytok - 1:
                    return polnyy
                break
        time.sleep(pauza)
    return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--komu", help="номер линии клиента, +1…")
    p.add_argument("--proba", action="store_true", help="один сценарий, для проверки")
    p.add_argument("--vse", action="store_true", help="все тридцать")
    p.add_argument("--tolko", default="",
                   help="один сценарий по имени — для перепроверки после правки")
    p.add_argument("--skolko", type=int, default=0,
                   help="сколько сценариев за раз — чтобы не выбрать суточную квоту линии")
    p.add_argument("--adres", default=os.environ.get("OBKATKA_URL", ""),
                   help="адрес функции исходящего звонка")
    p.add_argument("--ot", default=os.environ.get("OBKATKA_OT", ""),
                   help="с какого номера звоним, +1…; или OBKATKA_OT")
    p.add_argument("--otchet", help="собрать отчёт по дню YYYY-MM-DD")
    a = p.parse_args()

    if a.otchet:
        return otchet(a.otchet)

    if not a.komu:
        print("  нужен --komu +1…"); return 2
    mozhno, kto = razresheno(a.komu)
    if not mozhno:
        print("  ЗВОНИТЬ НЕЛЬЗЯ: %s" % kto)
        print("  Добавьте номер в %s с полем pismo — ссылкой на письменное согласие." % RAZRESHENO.name)
        return 3

    ot = a.ot.strip()
    if not re.match(r"^\+[0-9]{8,15}$", ot):
        print("  нужен --ot: с какого нашего номера звоним, например +14242756121"); return 2

    scenarii = json.loads(SCENARII.read_text(encoding="utf-8"))
    if a.tolko:
        imena = [s.strip() for s in a.tolko.split(",") if s.strip()]
        scenarii = [s for s in scenarii if s["id"] in imena]
        if not scenarii:
            print("  нет таких сценариев: %s" % a.tolko); return 2
    elif a.proba:
        scenarii = scenarii[:1]
    elif not a.vse and not a.skolko and not a.tolko:
        print("  укажите --proba (один), --skolko N или --vse (тридцать)"); return 2
    if len(scenarii) > POTOLOK_ZVONKOV:
        print("  сценариев больше потолка %d" % POTOLOK_ZVONKOV); return 2

    agent = env("OBKATKA_AGENT") or "agent_4701m34zngp2e9cb2w5wcrd171zr"
    den = time.strftime("%Y-%m-%d")
    VYHOD.mkdir(exist_ok=True)
    fayl = VYHOD / ("%s-%s.json" % (den, a.komu.replace("+", "")))
    itogi = json.loads(fayl.read_text(encoding="utf-8")) if fayl.exists() else []
    # Сделанным считается только тот сценарий, где агент ЗАГОВОРИЛ. Звонок, который
    # сорвался (не дозвонились, подпись не сошлась, поток не поднялся), даёт ноль реплик —
    # и если считать его сделанным, прогон объявит себя пройденным, ничего не проверив.
    sdelano = {x["id"] for x in itogi if x.get("rech")}
    sorvalos = [x["id"] for x in itogi if not x.get("rech")]
    if sorvalos:
        itogi = [x for x in itogi if x.get("rech")]
        print("  перезваниваем по сорвавшимся (реплик не было): %s" % ", ".join(sorvalos))

    if a.skolko:
        ostalos = [s for s in scenarii if s["id"] not in sdelano]
        scenarii = ostalos[:a.skolko]
        print("  берём %d из %d несделанных — суточная квота линии не резиновая"
              % (len(scenarii), len(ostalos)))

    print("  обкатка %s · кому %s · сценариев %d" % (den, a.komu, len(scenarii)))
    if kto:
        print("  разрешение: %s" % kto)
    vsego_sekund = 0
    for i, s in enumerate(scenarii, 1):
        if s["id"] in sdelano:
            print("  %2d/%d %-22s уже сделан" % (i, len(scenarii), s["id"])); continue
        print("  %2d/%d %-22s %s" % (i, len(scenarii), s["id"], s["chto_govorit"][:52]))
        sid = pozvonit(a.komu, s, a.adres, ot, agent)
        if not sid:
            itogi.append({"id": s["id"], "sid": None, "status": "не дозвонились"})
            fayl.write_text(json.dumps(itogi, ensure_ascii=False, indent=1), encoding="utf-8")
            time.sleep(PAUZA_MEZHDU); continue
        st, sek = zhdat(sid)
        vsego_sekund += sek
        r = razgovor_po_zvonku(agent, sid) or {}
        rech = [{"kto": h.get("role"), "chto": (h.get("message") or "").strip()}
                for h in (r.get("transcript") or []) if (h.get("message") or "").strip()]
        itogi.append({"id": s["id"], "gruppa": s["gruppa"], "sid": sid, "status": st,
                      "sekund": sek, "chto_proveryaem": s["chto_proveryaem"],
                      "ukazaniya": s.get("ukazaniya", ""),
                      "razgovor": r.get("conversation_id"), "rech": rech})
        fayl.write_text(json.dumps(itogi, ensure_ascii=False, indent=1), encoding="utf-8")
        print("       %s · %s с · реплик %d%s"
              % (st, sek, len(rech), "  ← ПУСТО, сценарий не засчитан" if not rech else ""))
        if i < len(scenarii):
            time.sleep(PAUZA_MEZHDU)

    print("\n  готово. Тестовых минут: %.1f — это НАШ расход, клиенту не пишем."
          % (vsego_sekund / 60.0))
    print("  файл: %s" % fayl)
    return 0


def otchet(den):
    """Сводка по дню: что спрашивали, что ответили, сколько минут (для нас)."""
    fayly = sorted(VYHOD.glob("%s-*.json" % den)) if VYHOD.exists() else []
    if not fayly:
        print("  за %s прогонов нет" % den); return 1
    for f in fayly:
        d = json.loads(f.read_text(encoding="utf-8"))
        sek = sum(x.get("sekund") or 0 for x in d)
        print("\n  %s — звонков %d, наших минут %.1f" % (f.name, len(d), sek / 60.0))
        for x in d:
            otvet = next((r["chto"] for r in (x.get("rech") or []) if r["kto"] == "agent"), "")
            print("   %-22s %-12s %s" % (x["id"], x.get("status"), otvet[:70]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
