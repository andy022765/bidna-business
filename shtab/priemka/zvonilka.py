#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Звонилка приёмки. Звонит на голосовую линию и снимает расшифровки.

Как устроено. «Покупатель» — обычный managed-агент ElevenLabs со своим промптом,
которому на каждый звонок подкладывается один сценарий из scenarii.json. Он звонит
на номер линии по настоящей телефонной сети. Это важно: текстовый прогон не проверяет
слух, задержку и перебивания, а Вера ломалась именно там.

    python3 zvonilka.py --plan                    # что будет сделано и почём, БЕЗ звонков
    python3 zvonilka.py --sozdat-pokupatelya      # завести агента-покупателя (один раз)
    python3 zvonilka.py --zvonit --skolko 3       # три звонка, для пробы
    python3 zvonilka.py --zvonit                  # все тридцать
    python3 zvonilka.py --sobrat                  # добрать расшифровки по уже сделанным

ЗВОНКИ СТОЯТ ДЕНЕГ И ИДУТ ПО НАСТОЯЩЕЙ ЛИНИИ. Без --zvonit программа не набирает
ничей номер. Звонит только на НАШ номер: он зашит константой и не берётся из аргументов.

Ключи — из ~/.bidna-golos.env, в папку проекта не кладутся (она в Google Drive).
"""
import argparse
import datetime as dt
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request

import certifi

# Питон с python.org не видит системное хранилище сертификатов — тот же случай,
# что в Pivot/agenty/smotritel/progon/progon.py. Берём хранилище из certifi.
SSL_CTX = ssl.create_default_context(cafile=certifi.where())

ZDES = pathlib.Path(__file__).resolve().parent
API = "https://api.elevenlabs.io/v1"

# Номер, на который звоним. Наш собственный. Константой, не аргументом: программа,
# умеющая набрать произвольный номер, однажды его наберёт.
NASH_NOMER = "+18884810868"

# С какого номера звоним. Второй наш номер, на Twilio.
NOMER_S_KOTOROGO_ID = "phnum_3301m2p4va7jejzrnfrryycc4wee"

PAUZA_MEZHDU = 12          # секунд между звонками: не долбить линию очередью
ZHDAT_KONCA = 240          # сколько ждём завершения одного звонка, секунд


def klyuch():
    for f in (pathlib.Path.home() / ".bidna-golos.env",):
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                # В файлах ключей строки записаны через `export` — без этого не находилось.
                line = line.strip()
                if line.startswith("export "):
                    line = line[7:].strip()
                if line.startswith(("ELEVENLABS_STAND_KEY=", "ELEVENLABS_API_KEY=")):
                    v = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if v:
                        return v
    v = os.environ.get("ELEVENLABS_STAND_KEY") or os.environ.get("ELEVENLABS_API_KEY")
    if not v:
        sys.exit("нет ключа ElevenLabs: ни в ~/.bidna-golos.env, ни в окружении")
    return v


def zapros(put, metod="GET", telo=None, key=None, popytok=5):
    """Запрос с терпением к обрыву связи.

    Андрей работает с ноутбука и переключается между вайфаем и мобильным. 22.09
    прогон упал на восьмом звонке с «Network is unreachable» ровно в момент
    переключения. Прогон на полтора часа не имеет права умирать от секундного обрыва:
    сетевые ошибки ждём и повторяем, ошибки самого сервиса отдаём сразу.
    """
    data = None if telo is None else json.dumps(telo).encode("utf-8")
    posledn = None
    for n in range(popytok):
        r = urllib.request.Request(API + put, method=metod)
        r.add_header("xi-api-key", key)
        if data is not None:
            r.add_header("content-type", "application/json")
        try:
            with urllib.request.urlopen(r, data, timeout=60, context=SSL_CTX) as o:
                return json.loads(o.read().decode("utf-8") or "{}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:600]
            if e.code in (429, 500, 502, 503, 504) and n < popytok - 1:
                posledn = "%s" % e.code
                time.sleep(5 * (n + 1)); continue
            raise RuntimeError("%s %s -> %s %s" % (metod, put, e.code, body))
        except Exception as e:
            posledn = str(e)[:120]
            if n < popytok - 1:
                print("   связь пропала (%s), жду %d с" % (posledn, 10 * (n + 1)))
                time.sleep(10 * (n + 1)); continue
            raise RuntimeError("%s %s -> связь: %s" % (metod, put, posledn))
    raise RuntimeError("%s %s -> не вышло за %d попыток: %s" % (metod, put, popytok, posledn))


# ─────────────────────────────────────────────────────── промпт покупателя

RAMKA_POKUPATELYA = """Ты звонишь в компанию как обычный человек. Ты НЕ проверяющий,
НЕ тестировщик и никогда об этом не говоришь. Если тебя спросят, откуда ты, — ты просто
человек, который нашёл номер и звонит по делу.

КАК ГОВОРИТЬ
- Коротко, как в жизни. Одно-два предложения. Не зачитывай заготовку.
- Говори числами-словами, ты же говоришь вслух.
- Можно запинаться, переспрашивать, менять тему — так делают живые люди.
- Не помогай собеседнику. Не подсказывай правильный ответ и не поправляй его.
- Не хвали и не ругай. Ты не оцениваешь, ты просто звонишь.

ЧЕГО НЕ ДЕЛАТЬ
- Не говори слов «проверка», «тест», «сценарий», «приёмка», «аудит».
- Не объясняй, зачем звонишь, если не спросили.
- Не заканчивай разговор раньше, чем отработал свою задачу.
- Трубку первым не кладёшь, кроме случая, когда задача прямо этого требует.

ТВОЯ ЗАДАЧА В ЭТОМ ЗВОНКЕ
Завязка: {zavyazka}
Что делаешь по ходу: {povedenie}
{pochta}
Когда задача отработана — попрощайся обычными словами и заверши разговор."""


def svoy_adres(s, imya):
    """Каждому звонку — свой адрес через плюс: andrii+priemka-0922-02@…

    Зачем. pismo.js не шлёт второе письмо за сутки на тот же адрес: отвечает ok:true
    и «уже ушло», а сам молчит. Если все тридцать звонков идут на один адрес, после
    первого письма остальные двадцать девять «уходят» только на словах. Проверить
    доставку по ящику тогда нельзя, а судья путает эхо дедупа с настоящей отправкой.
    Нашли 22.09 по подсказке соседней сессии.
    """
    if not s.get("pochta"):
        return None
    local, domen = s["pochta"].split("@", 1)
    local = local.split("+", 1)[0]
    metka = imya.replace("-", "")[-4:]
    return "%s+priemka-%s-%s@%s" % (local, metka, s["id"], domen)


BUKVY = {"a": "эй", "b": "би", "c": "си", "d": "ди", "e": "и", "f": "эф", "g": "джи",
         "h": "эйч", "i": "ай", "j": "джей", "k": "кей", "l": "эл", "m": "эм", "n": "эн",
         "o": "оу", "p": "пи", "q": "кью", "r": "ар", "s": "эс", "t": "ти", "u": "ю",
         "v": "ви", "w": "дабл-ю", "x": "экс", "y": "уай", "z": "зи",
         "0": "ноль", "1": "один", "2": "два", "3": "три", "4": "четыре", "5": "пять",
         "6": "шесть", "7": "семь", "8": "восемь", "9": "девять",
         "+": "плюс", "-": "дефис", ".": "точка", "@": "собака"}


SLOVAMI_DOMEN = "бизнес интел ди эн эй точка ком"


def po_bukvam(adres):
    """Весь адрес — по буквам, английскими именами.

    Зачем. В первом прогоне покупатель говорил «андрей плюс приёмка», и Вера честно
    записала andrey — а такого ящика у нас нет, письмо отскочило. Домен он говорил
    словами, и распознаватель собрал из «бизнес интел ди эн эй» мёртвый
    businessintel.dadna.com. Каждый отскок бьёт по репутации домена, с которого уходят
    письма живым клиентам (Resend 22.09, сверено ГОЛОСОМ). По буквам распознаватель
    не ошибся ни разу: локальную часть он принял верно.
    """
    return ", ".join(BUKVY.get(ch, ch) for ch in adres.lower())


def promt(s, domen_slovami=False):
    """Промпт покупателя. domen_slovami — тот самый провальный случай первого прогона:
    локальную часть диктуют по буквам, а домен произносят словами. Именно на этом стыке
    распознаватель собрал мёртвый businessintel.dadna.com. Третий прогон обязан повторить
    его буква в букву, иначе мы проверим не починку, а удобный нам сценарий."""
    p = ""
    if s.get("pochta"):
        adres = s["pochta"]
        if domen_slovami:
            mestn = adres.split("@", 1)[0]
            p = ("\nЕсли попросят почту — называешь ТОЛЬКО этот адрес: %s\n"
                 "Диктуй так: сначала часть до собаки ПО БУКВАМ, слово в слово:\n«%s»,\n"
                 "потом слово «собака», потом домен ОБЫЧНЫМИ СЛОВАМИ: «%s».\n"
                 "Домен по буквам НЕ диктуй, пока тебя об этом прямо не попросят. "
                 "Попросят — продиктуй по буквам: «би ю эс, ай эн и, эс эс, ай эн ти, и эл, "
                 "ди эн эй, точка, си оу эм».\n"
                 "Когда прочитают адрес обратно — сверь. Хоть один знак не тот — "
                 "«нет, не так» и диктуй заново."
                 % (adres, po_bukvam(mestn), SLOVAMI_DOMEN))
        else:
            p = ("\nЕсли попросят почту — называешь ТОЛЬКО этот адрес: %s\n"
                 "Диктуй его ЦЕЛИКОМ по буквам, вот так, слово в слово:\n«%s».\n"
                 "Не произноси его словами, не называй имя «Андрей» — только буквы. "
                 "Когда тебе прочитают адрес обратно, сверь с этим списком букв. "
                 "Хоть одна буква не та — говори «нет, не так» и диктуй снова."
                 % (adres, po_bukvam(adres)))
    return RAMKA_POKUPATELYA.format(zavyazka=s["zavyazka"], povedenie=s["povedenie"], pochta=p)


# ─────────────────────────────────────────────────────── файлы прогона

def papka_progona(imya):
    d = ZDES / "progony" / imya
    d.mkdir(parents=True, exist_ok=True)
    return d


def scenarii():
    d = json.loads((ZDES / "scenarii.json").read_text(encoding="utf-8"))
    return d["scenarii"], d


# ─────────────────────────────────────────────────────── действия

def sozdat_pokupatelya(key):
    """Заводит агента-покупателя. Промпт подменяется на каждый звонок."""
    telo = {
        "name": "Покупатель · приёмка",
        "conversation_config": {
            "agent": {
                "prompt": {"prompt": "Заглушка. Промпт подставляется на каждый звонок.",
                           "llm": "gemini-2.5-flash", "temperature": 0.6, "max_tokens": 300},
                "first_message": "",          # пусть первым говорит тот, кому звоним
                "language": "ru",
            },
            "tts": {"model_id": "eleven_flash_v2_5"},
            "turn": {"turn_timeout": 12},
            "conversation": {"max_duration_seconds": 360},
        },
        # Без этого блока звонок обрывается на первой секунде:
        # «Override for field 'prompt' is not allowed by config». Подмена промпта
        # на старте разговора должна быть РАЗРЕШЕНА агенту явно.
        "platform_settings": {
            "overrides": {
                "conversation_config_override": {
                    "agent": {"prompt": {"prompt": True}, "first_message": True}
                }
            }
        },
    }
    f = ZDES / "pokupatel.json"
    if f.exists():   # уже заведён — обновляем, чтобы не плодить агентов на аккаунте
        aid = json.loads(f.read_text(encoding="utf-8"))["agent_id"]
        zapros("/convai/agents/%s" % aid, "PATCH", telo, key)
        print("агент-покупатель обновлён:", aid)
        return aid
    r = zapros("/convai/agents/create", "POST", telo, key)
    aid = r.get("agent_id")
    (ZDES / "pokupatel.json").write_text(json.dumps({"agent_id": aid}, ensure_ascii=False, indent=2),
                                         encoding="utf-8")
    print("агент-покупатель заведён:", aid)
    print("записан в pokupatel.json")
    return aid


def pokupatel_id():
    f = ZDES / "pokupatel.json"
    if not f.exists():
        sys.exit("агента-покупателя нет. Сначала: python3 zvonilka.py --sozdat-pokupatelya")
    return json.loads(f.read_text(encoding="utf-8"))["agent_id"]


def plan(sc, d):
    """Что будет сделано и почём. Ни одного запроса наружу."""
    print("Звонить будем на НАШ номер:", NASH_NOMER)
    print("Сценариев:", len(sc))
    okna = {}
    for s in sc:
        okna.setdefault(s["okno"], []).append(s["id"])
    for k, v in d["okna"].items():
        print("  %-14s %-18s %d звонков: %s" % (k, v, len(okna.get(k, [])), " ".join(okna.get(k, []))))
    # Цена: две стороны разговора по managed-тарифу плюс телефония.
    minut = len(sc) * 3
    el = minut * 2 * 0.10
    tel = minut * (0.014 + 0.0028)
    print("\nОценка при трёх минутах на звонок:")
    print("  минут разговора: %d (обе стороны — %d агент-минут)" % (minut, minut * 2))
    print("  ElevenLabs ~$%.2f · телефония ~$%.2f · ИТОГО ~$%.2f" % (el, tel, el + tel))
    print("\nВАЖНО: это съест минуты из квоты Веры. Проверь остаток перед прогоном.")
    print("Звонков не сделано: без --zvonit программа не набирает номер.")


def hvatit_li_kvoty(key, skolko):
    """Проверка ОСТАТКА перед стартом, а не цены прогона.

    22.09 прогон упал на 22-м звонке: кончились кредиты ElevenLabs. Я посчитал, что
    тридцать звонков стоят около двадцати долларов, и не посмотрел, сколько осталось.
    Хуже цены оказалось другое: квота общая, и вместе с прогоном встала БОЕВАЯ линия —
    Вера перестала принимать входящие. Прогон не имеет права ронять живой сервис.

    Ключ может не иметь права user_read — тогда честно говорим, что не знаем,
    и не делаем вид, что проверили.
    """
    try:
        d = zapros("/user/subscription", "GET", None, key, popytok=1)
    except RuntimeError as e:
        print("   остаток квоты не виден (%s)" % str(e)[:70])
        print("   ВНИМАНИЕ: квота общая с боевой линией. Кончится — Вера перестанет")
        print("   принимать звонки. Проверь остаток руками: elevenlabs.io → Billing.")
        return None
    lim, use = d.get("character_limit"), d.get("character_count")
    if not isinstance(lim, int) or not isinstance(use, int):
        return None
    ost = lim - use
    print("   квота: использовано %d из %d, остаток %d" % (use, lim, ost))
    return ost


def zvonit(sc, key, skolko, imya, domen_slovami=False):
    aid = pokupatel_id()
    hvatit_li_kvoty(key, skolko)
    d = papka_progona(imya)
    sdelano = {}
    f = d / "zvonki.json"
    if f.exists():
        sdelano = json.loads(f.read_text(encoding="utf-8"))

    ochered = [s for s in sc if s["id"] not in sdelano][:skolko]
    if not ochered:
        print("всё уже отзвонено по этому прогону:", imya)
        return

    print("прогон %s · в очереди %d звонков на %s" % (imya, len(ochered), NASH_NOMER))
    for i, s in enumerate(ochered, 1):
        print("\n[%d/%d] сценарий %s — %s" % (i, len(ochered), s["id"], s["cel"]))
        adres = svoy_adres(s, imya)
        if adres:
            s = dict(s, pochta=adres)
        telo = {
            "agent_id": aid,
            "agent_phone_number_id": NOMER_S_KOTOROGO_ID,
            "to_number": NASH_NOMER,
            "conversation_initiation_client_data": {
                "conversation_config_override": {
                    "agent": {"prompt": {"prompt": promt(s, domen_slovami)}}
                }
            },
        }
        try:
            r = zapros("/convai/twilio/outbound-call", "POST", telo, key)
        except RuntimeError as e:
            print("   не дозвонились:", e)
            sdelano[s["id"]] = {"oshibka": str(e), "kogda": dt.datetime.now().isoformat(timespec="seconds")}
            f.write_text(json.dumps(sdelano, ensure_ascii=False, indent=2), encoding="utf-8")
            continue
        cid = r.get("conversation_id") or r.get("callSid")
        sdelano[s["id"]] = {"conversation_id": cid, "otvet": r, "adres": adres,
                            "kogda": dt.datetime.now().isoformat(timespec="seconds")}
        f.write_text(json.dumps(sdelano, ensure_ascii=False, indent=2), encoding="utf-8")
        print("   пошёл звонок, разговор", cid)
        ждём = 0
        while ждём < ZHDAT_KONCA:
            time.sleep(15); ждём += 15
            try:
                c = zapros("/convai/conversations/%s" % cid, "GET", None, key)
            except RuntimeError:
                continue
            # Ждём только КОНЦА РАЗГОВОРА, а не конца обработки: обработка идёт
            # ещё минуты, и на тридцати звонках это лишние два часа. Расшифровки
            # добираются потом одной командой --sobrat.
            if c.get("status") in ("done", "failed", "processing"):
                m = c.get("metadata") or {}
                print("   %s · %s с · реплик: %d · %s" % (
                    c.get("status"), m.get("call_duration_secs"),
                    len([r for r in (c.get("transcript") or []) if (r.get("message") or "").strip()]),
                    m.get("termination_reason") or ""))
                break
        if i < len(ochered):
            time.sleep(PAUZA_MEZHDU)
    print("\nготово. Расшифровки добрать: python3 zvonilka.py --sobrat --imya", imya)


def para_linii(key, start_unix, moy_id):
    """Находит ВТОРУЮ запись того же звонка — сторону линии.

    У каждого звонка две записи: наш покупатель (outbound) и линия (inbound).
    Вызовы инструментов — а значит и правда о том, ушло ли письмо и на какой адрес, —
    лежат ТОЛЬКО на стороне линии. Нашли это живьём 22.09: судья искал вызовы у
    покупателя, не находил и обвинял линию в том, чего не было.
    """
    try:
        d = zapros("/convai/conversations?page_size=100", "GET", None, key)
    except RuntimeError:
        return None
    for c in d.get("conversations", []):
        if c.get("conversation_id") == moy_id:
            continue
        t = c.get("start_time_unix_secs") or 0
        if abs(t - start_unix) <= 3 and (c.get("direction") or "") == "inbound":
            return c.get("conversation_id")
    return None


def sobrat(key, imya):
    """Скачивает расшифровки обеих сторон по сделанным звонкам."""
    d = papka_progona(imya)
    f = d / "zvonki.json"
    if not f.exists():
        sys.exit("нет %s — сначала --zvonit" % f)
    sdelano = json.loads(f.read_text(encoding="utf-8"))
    (d / "razgovory").mkdir(exist_ok=True)
    est = 0
    for sid, z in sorted(sdelano.items()):
        cid = z.get("conversation_id")
        if not cid:
            continue
        out = d / "razgovory" / ("%s.json" % sid)
        if out.exists():
            est += 1
            continue
        try:
            c = zapros("/convai/conversations/%s" % cid, "GET", None, key)
        except RuntimeError as e:
            print(" %s: не забрал — %s" % (sid, e)); continue
        # Сторона линии: там вызовы инструментов и правда про отправку письма.
        m = c.get("metadata") or {}
        vtoroy = para_linii(key, m.get("start_time_unix_secs") or 0, cid)
        if vtoroy:
            try:
                c2 = zapros("/convai/conversations/%s" % vtoroy, "GET", None, key)
                c["_liniya"] = c2
            except RuntimeError as e:
                print("   (сторона линии не забралась: %s)" % e)
        out.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
        est += 1
        print(" %s: %d реплик, %s с%s" % (sid, len(c.get("transcript") or []),
                                          m.get("call_duration_secs", "?"),
                                          " · сторона линии есть" if vtoroy else " · БЕЗ стороны линии"))
    print("\nрасшифровок на диске: %d из %d" % (est, len(sdelano)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--sozdat-pokupatelya", action="store_true")
    ap.add_argument("--zvonit", action="store_true")
    ap.add_argument("--sobrat", action="store_true")
    ap.add_argument("--skolko", type=int, default=30)
    ap.add_argument("--imya", default=dt.date.today().isoformat())
    ap.add_argument("--domen-slovami", action="store_true",
                    help="домен диктуется словами — провальный случай первого прогона")
    a = ap.parse_args()

    sc, d = scenarii()
    if a.plan or not (a.sozdat_pokupatelya or a.zvonit or a.sobrat):
        plan(sc, d); return
    key = klyuch()
    if a.sozdat_pokupatelya:
        sozdat_pokupatelya(key)
    if a.zvonit:
        zvonit(sc, key, a.skolko, a.imya, a.domen_slovami)
    if a.sobrat:
        sobrat(key, a.imya)


if __name__ == "__main__":
    main()
