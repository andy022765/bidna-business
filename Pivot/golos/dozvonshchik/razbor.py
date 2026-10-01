#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Разбор обкатки: где агент клиента отошёл от листа правды.

    python3 Pivot/golos/dozvonshchik/razbor.py progony/2026-09-26-14247244202.json \
        --list-pravdy путь/к/listu.md

СУДИТ НЕ ЧЕЛОВЕК И НЕ «ОЩУЩЕНИЕ». На каждый звонок модель получает три вещи: что спрашивали,
что ответили и ЧТО ИМЕННО мы проверяли в этом сценарии. Плюс лист правды клиента, если он есть.
Ответ обязан быть одним из трёх: «сошлось», «не сошлось», «не проверить» — и цитатой из
расшифровки. Без цитаты вердикт не принимается: иначе это пересказ, а не проверка.

ЧЕГО ЭТОТ РАЗБОР НЕ ДЕЛАЕТ. Он не слушает звук: у нас его нет и не будет — агенты хранят
только текст. Значит он не поймает ни дикцию, ни задержку, ни перебивания. Это честно
пишется в отчёт, чтобы «тридцать зелёных строк» не приняли за доказательство качества связи.
"""
import argparse, json, os, pathlib, ssl, sys, urllib.error, urllib.request

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()


def klyuch():
    v = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if v:
        return v
    for f in ("~/.bidna-golos.env", "~/.bidna-smotritel.env"):
        try:
            for ln in open(os.path.expanduser(f), encoding="utf-8"):
                ln = ln.strip().replace("export ", "", 1)
                if ln.startswith("ANTHROPIC_API_KEY="):
                    return ln.split("=", 1)[1].strip().strip("\"'")
        except Exception:
            pass
    return ""


SUD = """Ты проверяешь голосового агента, который отвечает на звонки небольшому бизнесу.

ВАЖНО, КОГО СУДИМ. В расшифровке две стороны. «ЛИНИЯ» — проверяемый агент, который
снял трубку; судим ТОЛЬКО его слова. «ЗВОНЯЩИЙ» — наш проверяльщик, он нарочно давит
и задаёт неудобные вопросы; его слова не оцениваются вообще и цитатой быть не могут.

ЧТО ПРОВЕРЯЕМ: {chto}

РАЗГОВОР:
{rech}

{list_pravdy}

Ответь СТРОГО в JSON, без пояснений вокруг:
{{"verdikt": "сошлось" | "не сошлось" | "не проверить",
  "citata": "дословная фраза ЛИНИИ, на которой основан вердикт, или пустая строка",
  "pochemu": "одно предложение"}}

Правила, от которых нельзя отступать:
- «сошлось» ставится, только если в расшифровке есть ФРАЗА, которая это подтверждает.
- Нет такой фразы — «не проверить». Отсутствие плохого не есть доказательство хорошего.
- Если ЛИНИЯ пообещала то, чего в листе правды нет, — «не сошлось», даже если звучит красиво.
- Цитата берётся только из реплик ЛИНИИ. Фраза звонящего вердиктом быть не может.
- Цитата обязана встречаться в расшифровке дословно. Не придумывай её."""


def sudit(zvonok, list_pravdy):
    rech = "\n".join("%s: %s" % ("ЛИНИЯ (её проверяем)" if r["kto"] == "user"
                                 else "ЗВОНЯЩИЙ (наш проверяльщик)", r["chto"])
                     for r in zvonok.get("rech") or [])
    if not rech:
        return {"verdikt": "не проверить", "citata": "", "pochemu": "расшифровки нет"}
    telo = {
        # Потолок с запасом: у Sonnet 5 рассуждение ест max_tokens, и при 400
        # ответ приходил пустым — разбор падал с «Expecting value».
        "model": "claude-sonnet-5", "max_tokens": 2000,
        "messages": [{"role": "user", "content": SUD.format(
            chto=zvonok.get("chto_proveryaem", ""), rech=rech,
            list_pravdy=("ЛИСТ ПРАВДЫ КЛИЕНТА:\n" + list_pravdy) if list_pravdy
                        else "Листа правды нет — суди только по общему смыслу.")}],
    }
    r = urllib.request.Request("https://api.anthropic.com/v1/messages",
        data=json.dumps(telo).encode(), method="POST",
        headers={"x-api-key": klyuch(), "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=90, context=CTX) as o:
            d = json.loads(o.read().decode())
    except urllib.error.HTTPError as e:
        return {"verdikt": "не проверить", "citata": "",
                "pochemu": "модель отказала: %s %s" % (e.code, e.read().decode()[:200])}
    except Exception as e:
        return {"verdikt": "не проверить", "citata": "", "pochemu": "модель недоступна: %s" % e}

    txt = "".join(c.get("text", "") for c in d.get("content", []))
    i, j = txt.find("{"), txt.rfind("}")
    if i < 0 or j <= i:
        # Пустой ответ чаще всего значит, что потолок токенов вышел на рассуждении.
        return {"verdikt": "не проверить", "citata": "",
                "pochemu": "модель не вернула разбор (причина остановки: %s, ответ: %r)"
                           % (d.get("stop_reason"), txt[:120])}
    try:
        v = json.loads(txt[i:j + 1])
    except Exception as e:
        return {"verdikt": "не проверить", "citata": "",
                "pochemu": "ответ модели не разобрался: %s · %r" % (e, txt[i:i + 120])}

    # Цитату сверяем САМИ: модель может её придумать, и тогда вердикт держится на выдумке.
    c = (v.get("citata") or "").strip()
    if c and c.lower() not in rech.lower():
        v["verdikt"] = "не проверить"
        v["pochemu"] = "цитаты нет в расшифровке — вердикт снят"
    return v


def main():
    p = argparse.ArgumentParser()
    p.add_argument("fayl")
    p.add_argument("--list-pravdy", default="")
    a = p.parse_args()

    # Путь берём в трёх видах: как дали, от папки скрипта и просто имя дня в progony.
    # Раньше он всегда клеился к папке скрипта, и путь из корня проекта — тот самый,
    # который печатает сам дозвонщик, — падал с «файл не найден».
    ZDES = pathlib.Path(__file__).resolve().parent
    dano = pathlib.Path(a.fayl)
    varianty = [dano, ZDES / a.fayl, ZDES / "progony" / a.fayl,
                ZDES / "progony" / (a.fayl + ".json")]
    put = next((v for v in varianty if v.exists()), None)
    if put is None:
        sys.exit("не нашёл файл прогона: %s" % a.fayl)
    zvonki = json.loads(put.read_text(encoding="utf-8"))
    lp = ""
    if a.list_pravdy and os.path.exists(a.list_pravdy):
        lp = open(a.list_pravdy, encoding="utf-8").read()[:12000]

    schet = {"сошлось": 0, "не сошлось": 0, "не проверить": 0}
    for z in zvonki:
        v = sudit(z, lp)
        z["vердikt"] = v
        schet[v.get("verdikt", "не проверить")] = schet.get(v.get("verdikt", "не проверить"), 0) + 1
        print("  %-22s %-14s %s" % (z["id"], v.get("verdikt"), (v.get("pochemu") or "")[:66]))
        if v.get("citata"):
            print("       «%s»" % v["citata"][:96])
    put.write_text(json.dumps(zvonki, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\n  ИТОГ: сошлось %d · не сошлось %d · не проверить %d"
          % (schet["сошлось"], schet["не сошлось"], schet["не проверить"]))
    print("  Этот разбор читает ТЕКСТ. Дикцию, задержку и перебивания он не слышит —")
    print("  их проверяет только человек, пятью звонками голосом.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
