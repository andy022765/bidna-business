#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Страница подтверждения находок — для живого человека, с телефона.

Терминал для этого не нужен. Человек читает находки, отвечает «да» или «нет»
по номерам, ШТАБ записывает ответы его именем. Подтверждает всё равно человек:
меняется только способ ввода, не то, кто решает.

    python3 stranica.py --imya 2026-09-22 > /куда-нибудь/index.html
"""
import argparse
import html
import json
import pathlib
import sys

ZDES = pathlib.Path(__file__).resolve().parent
NARUSHENA, KONFLIKT = "нарушена", "конфликт правил"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--imya", required=True)
    a = ap.parse_args()

    f = ZDES / "progony" / a.imya / "protokol.json"
    if not f.exists():
        sys.exit("нет %s" % f)
    d = json.loads(f.read_text(encoding="utf-8"))
    sc = {s["id"]: s for s in json.loads((ZDES / "scenarii.json").read_text(encoding="utf-8"))["scenarii"]}

    nar, konf = [], []
    for sid, v in sorted(d.items()):
        for h in v["nahodki"]:
            if h["verdikt"] == NARUSHENA:
                nar.append((sid, h))
            elif h["verdikt"] == KONFLIKT:
                konf.append((sid, h))

    e = html.escape

    def karta(i, sid, h, konflikt=False):
        sek = h.get("sekunda")
        sled = h.get("sledstviya") or []
        kody = h["proverka"] + ("" if not sled else " + " + ", ".join(sled))
        return """
  <div class="n%s">
    <div class="sh"><span class="num">%s</span>
      <span class="kod">%s</span>
      <span class="gde">звонок %s%s · %s</span></div>
    <blockquote>%s</blockquote>
    %s
  </div>""" % (
            " konf" if konflikt else "",
            "—" if konflikt else str(i),
            e(kody),
            e(sid),
            "" if sek is None else (" · %s с" % sek),
            e(sc.get(sid, {}).get("cel", "")),
            e((h.get("citata") or "").strip()) or "<i>без цитаты</i>",
            ("<p class=\"ch\">%s</p>" % e(h["chto_menyat"])) if h.get("chto_menyat") else "")

    body = []
    if nar:
        body.append('<h2>Находки — по каждой нужен ответ</h2>')
        body.append('<p class="lede">Прочитай и скажи по номерам: <b>1 да, 2 нет, 3 да</b> — '
                    'и так далее. «Нет» значит «это не находка, убрать из протокола».</p>')
        for i, (sid, h) in enumerate(nar, 1):
            body.append(karta(i, sid, h))
    else:
        body.append('<h2>Нарушений не помечено</h2>')

    if konf:
        body.append('<h2>Конфликты правил — это не находки</h2>')
        body.append('<p class="lede">Здесь агент прав, а неправо <b>правило</b>: он выполнил '
                    'требование закона, которого автор задания не заложил. В протокол нарушением '
                    'не идёт. Правится лист правды. Смотри и скажи, согласен ли.</p>')
        seen = set()
        for sid, h in konf:
            k = (h["proverka"], (h.get("citata") or "")[:40])
            if k in seen:
                continue
            seen.add(k)
            body.append(karta(0, sid, h, konflikt=True))
        body.append('<p class="fine">Одна и та же зашитая фраза во всех звонках — '
                    'поэтому показана один раз, а не %d.</p>' % len(konf))

    shablon = """<title>Подтверждение находок</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root{--bg:#0a0e18;--panel:#0e1524;--ink:#eef1f7;--dim:#97a1b8;--faint:#6b768f;
    --line:#1e2940;--gold:#e3c88a;--red:#c4675a;--red2:#241820;--ok2:#16211a;--ok:#7fb069}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',-apple-system,sans-serif;
    font-size:17px;line-height:1.55;margin:0;-webkit-font-smoothing:antialiased}
  .w{max-width:760px;margin:0 auto;padding:52px 22px 80px}
  h1{font-size:clamp(28px,5vw,40px);line-height:1.06;margin:0 0 14px;letter-spacing:-.03em;font-weight:700}
  h2{font-size:22px;margin:40px 0 10px;letter-spacing:-.02em}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:12.5px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--gold);margin:0 0 14px}
  .lede{color:var(--dim);margin:0 0 22px}
  .n{background:var(--red2);border:1px solid #4a2a28;border-radius:11px;padding:17px 19px;margin:0 0 12px}
  .n.konf{background:var(--panel);border-color:var(--line)}
  .sh{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:10px}
  .num{display:grid;place-items:center;min-width:28px;height:28px;border-radius:50%;
    background:var(--gold);color:#0a0e18;font-weight:700;font-size:15px}
  .konf .num{background:var(--line);color:var(--faint)}
  .kod{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--gold);letter-spacing:.06em}
  .konf .kod{color:var(--dim)}
  .gde{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--faint)}
  blockquote{margin:0;padding:0 0 0 14px;border-left:2px solid var(--line);
    font-size:16.5px;color:var(--ink)}
  .ch{margin:11px 0 0;font-size:15px;color:var(--dim)}
  .fine{font-size:14px;color:var(--faint)}
  .kak{background:var(--ok2);border:1px solid #2a4030;border-radius:11px;padding:18px 20px;margin:26px 0 0}
  .kak p{margin:0 0 8px} .kak p:last-child{margin:0}
  .kak b{color:var(--ok)}
  @media(max-width:640px){.w{padding:38px 17px 60px}}
</style>
<div class="w">
  <p class="eyebrow">Приёмка нашей Веры · @IMYA@</p>
  <h1>Подтверди находки</h1>
  <p class="lede">Ни одна строка ниже не подтверждена. Это пометки программы и модели.
  Подтвердить может только живой человек — мы это обещаем на лендинге, значит так и делаем.</p>
@TELO@
  <div class="kak">
    <p><b>Что делать.</b> Ответь мне в чате по номерам: например «1 да, 2 да, 3 нет, 4 да, 5 да».</p>
    <p>Запишу твоим именем в протокол. «Нет» — строка уходит из отчёта совсем.</p>
    <p>Если удобнее руками в терминале: <code>python3 shtab/priemka/sudya.py --imya @IMYA@ --podtverdit</code></p>
  </div>
</div>"""
    # Подстановка заменой, а не через %: в CSS есть «50%» и «%» ломает форматирование.
    print(shablon.replace("@IMYA@", e(a.imya)).replace("@TELO@", "\n".join(body)))


if __name__ == "__main__":
    main()
