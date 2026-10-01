#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Письма по прозвону: запись разговора — вложением, тому же бизнесу, чью линию проверяли.

Этим скриптом ШТАБ отправил письма 23.09 (14 адресов, 12 компаний, журнал —
~/bidna-prozvon-zapisi/otpravleno.json). До 24.09 он лежал во временных файлах сессии,
поэтому окно ПИСЬМА его не нашло. Теперь живёт здесь.

    set -a; . ~/.bidna-golos.env; set +a          # отсюда RESEND_API_KEY
    python3 shtab/prozvon/otpravka.py pisma.json               # ПРОБА: покажет, ничего не шлёт
    python3 shtab/prozvon/otpravka.py pisma.json --otpravit    # отправит

ОТПРАВИТЕЛЬ: по умолчанию «Andrii Zhyla <support@businessinteldna.com>». Если в записи письма есть
поле "otpravitel" (письма партнёрам — «Andrii Zhyla <andrii@bizzinteldna.com>»), берётся оно.
Флаг --s-osnovnogo игнорирует поле и шлёт с основного домена. reply_to всегда support@businessinteldna.com.

ОТЛОЖЕННАЯ ОТПРАВКА: --v=2026-09-28T07:00 (время Лос-Анджелеса) [--shag=2] — письма уходят в Resend сейчас,
а Resend рассылает их сам: первое в указанное время, каждое следующее на shag минут позже.
До этого времени письмо можно отменить: POST https://api.resend.com/emails/<id>/cancel.

pisma.json — список:
    [{"kartochka": "49", "data": "2026-09-24", "adres": "info@...", "imya": "Lil Beaver Brewery",
      "tema": "...", "abzacy": ["абзац", "«цитата — станет выделенной вставкой»", ...]}]
Запись берётся из ~/bidna-prozvon-zapisi/<data>/<kartochka>.mp3 (так лежат с 24.09),
а если там нет — из ~/bidna-prozvon-zapisi/<kartochka>.mp3 (так лежали 22–23.09).

ПИСЬМА БЕЗ ЗАПИСИ (партнёрам и всем, кому нечего прикладывать): в записи письма
    "bez_zapisi": true, "podval": "partner"      (или "partner-en" — тот же подвал по-английски)
— тогда вложения нет, а подвал русский, без слов про запись разговора (CAN-SPAM: что это
деловое предложение, физический адрес, отказ ответом «нет»).

ЗАЩИТА ОТ ДВОЙНОЙ ОТПРАВКИ: кому уже ушло — записано в otpravleno.json, второй раз не уйдёт.
По умолчанию ПРОБА: без --otpravit ни одного письма не уходит.
"""
import base64, datetime, json, os, pathlib, ssl, sys, time, urllib.error, urllib.request
from zoneinfo import ZoneInfo
import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
ZAP = pathlib.Path.home() / "bidna-prozvon-zapisi"
UZHE = ZAP / "otpravleno.json"

PODVAL = ("<hr style='border:none;border-top:1px solid #ddd;margin:26px 0 14px'>"
"<p style='font-size:12px;color:#666;line-height:1.5'>"
"Andrii Zhyla · Business Intelligence DNA<br>"
"Wealthboosterpro LLC, 5830 E 2nd St Ste 7000, Casper, WY 82609<br>"
"support@businessinteldna.com<br><br>"
"The call was recorded with a spoken announcement at the start, as Florida and California law "
"require of us. The recording has not been shared with anyone and will not be, unless you give "
"written permission. Reply STOP and we won't write again.</p>")

PODVAL_PARTNER = ("<hr style='border:none;border-top:1px solid #ddd;margin:26px 0 14px'>"
"<p style='font-size:12px;color:#666;line-height:1.5'>"
"Andrii Zhyla · Business Intelligence DNA<br>"
"Это письмо - деловое предложение Business Intelligence DNA.<br>"
"Wealthboosterpro LLC, 5830 E 2nd St Ste 7000, Casper, WY 82609<br>"
"support@businessinteldna.com<br><br>"
"Не хотите больше писем от нас - ответьте «нет», и мы больше не напишем.</p>")
PODVAL_PARTNER_TEXT = ("\n\n--\nAndrii Zhyla · Business Intelligence DNA\n"
"Это письмо - деловое предложение Business Intelligence DNA.\n"
"Wealthboosterpro LLC, 5830 E 2nd St Ste 7000, Casper, WY 82609\n"
"support@businessinteldna.com\n\n"
"Не хотите больше писем от нас - ответьте «нет», и мы больше не напишем.")
PODVAL_PARTNER_EN = ("<hr style='border:none;border-top:1px solid #ddd;margin:26px 0 14px'>"
"<p style='font-size:12px;color:#666;line-height:1.5'>"
"Andrii Zhyla · Business Intelligence DNA<br>"
"This email is a business proposal from Business Intelligence DNA.<br>"
"Wealthboosterpro LLC, 5830 E 2nd St Ste 7000, Casper, WY 82609<br>"
"support@businessinteldna.com<br><br>"
"If you'd rather not hear from us, reply \"no\" and we won't write again.</p>")
PODVAL_PARTNER_EN_TEXT = ("\n\n--\nAndrii Zhyla · Business Intelligence DNA\n"
"This email is a business proposal from Business Intelligence DNA.\n"
"Wealthboosterpro LLC, 5830 E 2nd St Ste 7000, Casper, WY 82609\n"
"support@businessinteldna.com\n\n"
"If you'd rather not hear from us, reply \"no\" and we won't write again.")
PODVALY = {"partner": (PODVAL_PARTNER, PODVAL_PARTNER_TEXT), "partner-en": (PODVAL_PARTNER_EN, PODVAL_PARTNER_EN_TEXT)}


def telo_pisma(abzacy):
    out = []
    for x in abzacy:
        if x.startswith("«") and x.endswith("»"):
            out.append("<blockquote style='margin:0 0 14px;padding:10px 16px;border-left:3px solid #d87f70;"
                       "color:#333;font-style:italic'>%s</blockquote>" % x[1:-1])
        else:
            out.append("<p style='margin:0 0 14px'>%s</p>" % x.replace("\n", "<br>"))
    return "".join(out)


def zapis(p):
    for f in (ZAP / p["data"] / (p["kartochka"] + ".mp3"), ZAP / (p["kartochka"] + ".mp3")):
        if f.exists() and f.stat().st_size > 1000:
            return f
    return None

OSNOVNOJ = "Andrii Zhyla <support@businessinteldna.com>"


def otpravitel(p, s_osnovnogo=False):
    return OSNOVNOJ if s_osnovnogo else (p.get("otpravitel") or OSNOVNOJ)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    otpravit = "--otpravit" in sys.argv
    s_osnovnogo = "--s-osnovnogo" in sys.argv
    arg = dict(a[2:].split("=", 1) for a in sys.argv[2:] if a.startswith("--") and "=" in a)
    start = None
    if "v" in arg:
        start = datetime.datetime.fromisoformat(arg["v"]).replace(tzinfo=ZoneInfo("America/Los_Angeles"))
        if start <= datetime.datetime.now(ZoneInfo("America/Los_Angeles")):
            sys.exit("время --v уже прошло: %s" % start)
    shag = int(arg.get("shag", "2"))
    nomer = 0
    pisma = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    bylo = json.loads(UZHE.read_text()) if UZHE.exists() else {}
    klyuch = os.environ.get("RESEND_API_KEY")
    if otpravit and not klyuch:
        sys.exit("нет RESEND_API_KEY — сначала: set -a; . ~/.bidna-golos.env; set +a")
    print("РЕЖИМ: %s\n" % ("ОТПРАВКА" if otpravit else "ПРОБА — ничего не уходит"))
    for p in pisma:
        adres, imya = p["adres"], p["imya"]
        if adres in bylo:
            print("пропуск    %-30s уже уходило %s" % (imya, bylo[adres])); continue
        bez = bool(p.get("bez_zapisi"))
        f = None if bez else zapis(p)
        if not f and not bez:
            print("НЕТ ЗАПИСИ %-30s карточка %s, дата %s — не шлём без записи" % (imya, p["kartochka"], p["data"])); continue
        imya_fayla = "" if bez else "call-%s-%s.mp3" % (imya.lower().replace(" ", "-").replace("&", "and").replace("'", ""), p["data"])
        kogda = None
        if start:
            kogda = start + datetime.timedelta(minutes=shag * nomer); nomer += 1
        kogda_txt = (" в " + kogda.strftime("%d.%m %H:%M %Z")) if kogda else ""
        if not otpravit:
            if bez:
                print("проба      %-30s → %-34s «%s» без вложения, подвал %s, от %s%s" % (imya, adres, p["tema"][:50], p.get("podval", "zvonok"), otpravitel(p, s_osnovnogo), kogda_txt))
            else:
                print("проба      %-30s → %-34s «%s» + %s (%d КБ)" % (imya, adres, p["tema"][:50], imya_fayla, f.stat().st_size // 1024))
            continue
        telo = {"from": otpravitel(p, s_osnovnogo), "to": [adres],
                "reply_to": "support@businessinteldna.com", "subject": p["tema"],
                "html": telo_pisma(p["abzacy"]) + PODVALY.get(p.get("podval"), (PODVAL,))[0]}
        if p.get("podval") in PODVALY:
            telo["text"] = "\n\n".join(p["abzacy"]) + PODVALY[p["podval"]][1]
        if kogda:
            telo["scheduled_at"] = kogda.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if f:
            telo["attachments"] = [{"filename": imya_fayla, "content": base64.b64encode(f.read_bytes()).decode()}]
        r = urllib.request.Request("https://api.resend.com/emails", data=json.dumps(telo).encode(),
            headers={"Authorization": "Bearer " + klyuch, "Content-Type": "application/json",
                     "User-Agent": "BusinessIntelDNA-Mailer/1.0 (+https://businessinteldna.com)",
                     "Accept": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=120, context=CTX) as o:
                j = json.load(o); bylo[adres] = j.get("id")
                UZHE.write_text(json.dumps(bylo, ensure_ascii=False, indent=1))
                print("%s %-30s %-34s id=%s%s" % ("ЗАПЛАНИРОВ" if kogda else "ОТПРАВЛЕНО", imya, adres, j.get("id"), kogda_txt))
        except urllib.error.HTTPError as e:
            print("НЕ УШЛО    %-30s %-34s %s %s" % (imya, adres, e.code, e.read()[:200].decode("utf8", "replace")))
        except Exception as e:
            print("НЕ УШЛО    %-30s %-34s %s" % (imya, adres, str(e)[:120]))
        time.sleep(0.7)


if __name__ == "__main__":
    main()
