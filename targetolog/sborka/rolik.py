# -*- coding: utf-8 -*-
"""Сборка рекламных роликов Meta из готовых ассетов лендингов.

Почему не генератор видео. Требования ТЗ — кегль не мельче 48 px, текст по центру,
субтитры прошиты в кадр, обложка отдельным файлом — это про точность, а не про красоту.
Генератор такого не гарантирует. Здесь надписи рисуются поверх кадра как есть, поэтому
кегль ровно тот, что написан, и проверяется числом, а не на глаз.

    python3 targetolog/sborka/rolik.py noch

Правка 27.09 (приёмка A/B + новый концепт D «pismo»): движок стал сценным. Раньше
каждый ролик собирался из ОДНОГО источника, из которого просто резался диапазон кадров
под каждую подпись. Ролику D нужно три РАЗНЫХ источника подряд (видео звонка → картинка
письма в панораме → приближённая рамка), а bot после приёмки — картинка (протокол)
вместо второго видео. Поэтому план (PLANY) теперь — список «сцен», у каждой свой
источник, кадрирование и (для картинок) окно кропа; сцены просто идут одна за другой.

Правка 28.09 (концепт C «demo»): добавлен четвёртый вид сцены — `perepiska` (переписка).
У неё нет источника-видео или источника-картинки вовсе: `kadr_perepiski()` рисует кадр
целиком кодом (фон + пузыри чата + подписи), как `koncovka()` рисует свою концовку.
Подробности и почему пузыри показаны скользящим окном по два — `media/reklama-meta/CHITAT.md`,
раздел C, и комментарии у DIALOG_DEMO/kadr_perepiski/PLANY["demo"] ниже.
"""
import json
import os
import pathlib
import subprocess
import sys

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

KOREN = pathlib.Path(__file__).resolve().parents[2]
VYHOD = KOREN / "media" / "reklama-meta"
FF = imageio_ffmpeg.get_ffmpeg_exe()

FORMATY = {"916": (1080, 1920), "45": (1080, 1350)}
FON = (10, 14, 24)
BELYY = (238, 241, 247)
ZOLOTO = (227, 200, 138)

# Шрифт берём системный: на этом Маке есть Helvetica, кириллицу держит.
SHRIFTY = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
           "/System/Library/Fonts/Helvetica.ttc",
           "/Library/Fonts/Arial Bold.ttf"]


def shrift(kegl):
    for p in SHRIFTY:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, kegl)
            except Exception:
                continue
    raise SystemExit("  не нашёл шрифт с кириллицей — скажите какой ставить")


def perenos(d, tekst, f, shirina):
    # «\n» в тексте — ручной перенос (28.09: «И на какой вопрос / она не ответила» вместо висячего
    # «ответила»); каждая часть дальше переносится по ширине как раньше.
    if "\n" in tekst:
        return [s for chast in tekst.split("\n") for s in perenos(d, chast, f, shirina)]
    slova, stroki, tek = tekst.split(), [], ""
    for s in slova:
        proba = (tek + " " + s).strip()
        if d.textlength(proba, font=f) <= shirina:
            tek = proba
        else:
            if tek:
                stroki.append(tek)
            tek = s
    if tek:
        stroki.append(tek)
    return stroki


def nadpis(kadr, tekst, kegl, niz_doli=0.78, cvet=BELYY):
    """Надпись по центру, на затемнённой плашке. Кегль — ровно заданный."""
    if not tekst:
        return kadr
    im = kadr.convert("RGBA")
    sloy = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sloy)
    f = shrift(kegl)
    W, H = im.size
    stroki = perenos(d, tekst, f, int(W * 0.86))
    vysota_str = kegl * 1.28
    blok = vysota_str * len(stroki)
    verh = H * niz_doli - blok / 2
    d.rectangle([0, verh - kegl * 0.7, W, verh + blok + kegl * 0.5], fill=(10, 14, 24, 205))
    for i, s in enumerate(stroki):
        w = d.textlength(s, font=f)
        d.text(((W - w) / 2, verh + i * vysota_str), s, font=f, fill=cvet + (255,))
    return Image.alpha_composite(im, sloy).convert("RGB")


def koncovka(razmer, nomer="+1 424 781 1913"):
    W, H = razmer
    im = Image.new("RGB", (W, H), FON)
    d = ImageDraw.Draw(im)
    for tekst, kegl, dolya, cvet in [("Позвоните Вере", 84, 0.40, BELYY),
                                     (nomer, 76, 0.52, ZOLOTO),
                                     ("Демо до трёх минут", 60, 0.62, (154, 164, 184)),
                                     ("ИИ-администратор и продавец", 56, 0.72, (170, 180, 200))]:  # 28.09 Андрей: «и администратор, и продавец»
        f = shrift(kegl)
        w = d.textlength(tekst, font=f)
        d.text(((W - w) / 2, H * dolya), tekst, font=f, fill=cvet)
    return im


def _vf_dlya(kadrirovka, W, H, fps):
    """Строка -vf под три вида кадрирования: голый crop/scale, fit целиком на
    тёмное поле, приближённый кусок на тёмном поле. Общее место для видео и
    для сверки — раньше жило прямо в kadry_iz_video."""
    if kadrirovka == "fit":
        return "scale=%d:-1,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:0x0a0e18,fps=%d" % (W, W, H, fps)
    elif kadrirovka.startswith("priblizit:"):
        return ("%s,scale=%d:-1,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:0x0a0e18,fps=%d"
                 % (kadrirovka.split(":", 1)[1], W, W, H, fps))
    else:
        return "%s,scale=%d:%d,fps=%d" % (kadrirovka, W, H, fps)


def kadry_iz_video(istochnik, kadrirovka, razmer, fps=30, ss=0.0, dlitelnost=None, klyuch=0):
    """Достаём кадры уже обрезанными под формат — так текст ложится на готовый размер.

    ss/dlitelnost — окно ВНУТРИ источника (не окно в готовом ролике): с какой секунды
    источника начать и сколько секунд реально взять. Нужно, когда сцена в ролике длиннее,
    чем есть подходящего материала в источнике (пример — хук bot: подпись держится 3 с,
    а красная строка в источнике стоит подсвеченной около секунды). Если кадров не хватит
    до конца показа сцены — sobrat() сам достаёт последний кадр (см. ниже), картинка
    просто замирает, а не обрывается.

    klyuch — номер сцены, только чтобы у каждой была своя временная папка: id(istochnik)
    ненадёжен (Path — временный объект, адрес переиспользуется, и две сцены с одним
    файлом-источником схлопывались в одну папку и затирали кадры друг друга).
    """
    W, H = razmer
    papka = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / ("kadry-%d-%d" % (os.getpid(), klyuch))
    if papka.exists():
        for f in papka.glob("*.png"):
            f.unlink()
    papka.mkdir(parents=True, exist_ok=True)
    vf = _vf_dlya(kadrirovka, W, H, fps)
    cmd = [FF, "-y"]
    if ss:
        cmd += ["-ss", str(ss)]
    cmd += ["-i", str(istochnik)]
    if dlitelnost:
        cmd += ["-t", str(dlitelnost)]
    cmd += ["-vf", vf, str(papka / "%05d.png")]
    subprocess.run(cmd, capture_output=True)
    return sorted(papka.glob("*.png"))


def kadry_iz_kartinki(istochnik, razmer, kolvo_kadrov, krop_nachalo, krop_konec=None, klyuch=0):
    """Кадры анимации из статичной картинки (письмо, протокол). Окно кропа
    (x0,y0,x1,y1 в пикселях исходника) едет от krop_nachalo к krop_konec линейно —
    это и «едет по картинке», и «проявляется сверху вниз», если окно смещается по Y.
    Если krop_konec не задан — кадр статичен (просто крупный план на месте, для
    «рамки седьмого поля» и для протокола, где панорама не нужна).
    Вписываем кусок в кадр по центру, как fit у видео (та же тёмная подложка FON).

    klyuch — см. kadry_iz_video: своя временная папка на каждую сцену."""
    W, H = razmer
    img = Image.open(istochnik).convert("RGB")
    krop_konec = krop_konec or krop_nachalo
    papka = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / ("bilda-%d-%d" % (os.getpid(), klyuch))
    if papka.exists():
        for f in papka.glob("*.png"):
            f.unlink()
    papka.mkdir(parents=True, exist_ok=True)
    puti = []
    for n in range(kolvo_kadrov):
        dolya = n / max(kolvo_kadrov - 1, 1)
        x0, y0, x1, y1 = [a + (b - a) * dolya for a, b in zip(krop_nachalo, krop_konec)]
        kusok = img.crop((int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))))
        kw, kh = kusok.size
        masshtab = W / kw
        nw, nh = W, max(1, int(round(kh * masshtab)))
        kusok = kusok.resize((nw, nh), Image.LANCZOS)
        fon = Image.new("RGB", (W, H), FON)
        fon.paste(kusok, (0, (H - nh) // 2))
        put = papka / ("%05d.png" % (n + 1))
        fon.save(put)
        puti.append(put)
    return puti


def _kadry_sceny(scena, fmt, razmer, fps, klyuch):
    if scena.get("perepiska"):
        return kadry_perepiski(scena, razmer, fmt, klyuch=klyuch)
    if scena.get("kartinka"):
        dl = scena.get("dlitelnost_realnaya", scena["dlitelnost"])
        kolvo = max(1, int(round(dl * fps)))
        kn = scena["krop_nachalo"]
        kn = kn[fmt] if isinstance(kn, dict) else kn
        kk = scena.get("krop_konec")
        kk = kk[fmt] if isinstance(kk, dict) else kk
        return kadry_iz_kartinki(KOREN / scena["istochnik"], razmer, kolvo, kn, kk, klyuch=klyuch)
    kadrirovka = scena["kadrirovka"]
    kadrirovka = kadrirovka[fmt] if isinstance(kadrirovka, dict) else kadrirovka
    return kadry_iz_video(KOREN / scena["istochnik"], kadrirovka, razmer, fps,
                           ss=scena.get("ss", 0.0),
                           dlitelnost=scena.get("dlitelnost_realnaya", scena["dlitelnost"]),
                           klyuch=klyuch)


# ------------------------------------------------------------- переписка (demo)
# Новый вид сцены: не видео и не картинка, а чат-«переписка», нарисованная кодом
# целиком (как koncovka() рисует весь кадр). DIALOG_DEMO — дословные реплики
# постановочного звонка 28.09 (conv_6201m3m947ytfzht391m8vj7bmje, shtab/DOSKA.md,
# запись «Пн 28.09 — Вера и ролики»). Ничего не перефразировано и не дописано.
DIALOG_DEMO = [
    ("bot", "Сколько стоит Вера?"),
    ("vera", "Запуск голосового администратора стоит тысячу долларов, "
             "дальше сто девяносто девять в месяц."),
    ("bot", "Это дорого."),
    ("vera", "Дорого по сравнению с чем?"),
]
SERYY_PUZYR = (64, 70, 84)
VERA_PUZYR = (18, 22, 34)
DISCLAIMER_CVET = (146, 154, 172)

# Зоны разметки по форматам. 916 (Reels/Stories) — верх ~14%/низ ~35% закрыты
# интерфейсом (ТЗ demo), поэтому шапка и пузыри сидят в средней полосе, не у
# краёв. 45 (лента) — такого перекрытия нет, зоны свободнее (тот же приём, что
# niz_doli у bot/pismo: в 916 контент выше, в 45 может опускаться ниже).
# Окно чата — максимум 2 пузыря разом (см. OKNA в PLANY["demo"]), поэтому
# «predup» (мелкая строка-предупреждение) посчитан под худший стек ДВУХ пузырей
# (короткий+длинный, до ~0,42 доли в 916 и ~0,42 в 45 — см. отчёт сборки) с
# запасом, а не под все четыре реплики разом.
ZONY_PEREPISKI = {
    "916": {"zagolovok": 0.165, "start": 0.215, "otstup": 0.05,
            "kegl_zag": 50, "kegl_puzyr": 62, "zazor": 24, "predup": 0.585},  # 28.09: крупнее — на скриншоте Meta кадр читался пустым
    "45":  {"zagolovok": 0.06, "start": 0.11, "otstup": 0.065,
            "kegl_zag": 48, "kegl_puzyr": 58, "zazor": 22, "predup": 0.74},
}


def _puzyr(d, tekst, kegl, x_left, x_right, verh, sprava):
    """Один пузырь чата: округлый прямоугольник, текст внутри (строки по левому
    краю). Возвращает Y нижнего края — для стека следующего пузыря сверху вниз.
    Звонящий — серая заливка без обводки (слева); Вера — тёмная заливка с золотой
    обводкой (справа) — ровно то, что просит ТЗ («золотой обводкой/акцентом»)."""
    f = shrift(kegl)
    max_w = int((x_right - x_left) * 0.97)  # 28.09: «Дорого по сравнению с чем?» в одну строку при 62 px
    stroki = perenos(d, tekst, f, max_w)
    vysota_str = kegl * 1.30
    shirina = max(d.textlength(s, font=f) for s in stroki)
    pad_x, pad_y, radius = 28, 18, 26
    bub_w = shirina + pad_x * 2
    bub_h = vysota_str * len(stroki) + pad_y * 2
    if sprava:
        x1 = x_right
        x0 = x1 - bub_w
    else:
        x0 = x_left
        x1 = x0 + bub_w
    y0, y1 = verh, verh + bub_h
    if sprava:
        d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=VERA_PUZYR,
                             outline=ZOLOTO, width=3)
    else:
        d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=SERYY_PUZYR)
    for i, s in enumerate(stroki):
        d.text((x0 + pad_x, y0 + pad_y + i * vysota_str), s, font=f, fill=BELYY)
    return y1


def kadr_perepiski(razmer, fmt, okno):
    """Собирает целый кадр чата: фон, шапка «Вера — ИИ-администратор», пузыри
    DIALOG_DEMO по индексам из okno (по очереди сверху вниз, звонящий слева,
    Вера справа), мелкая строка-предупреждение внизу («Постановочный звонок...»)
    — держится весь ролик на каждом кадре сцены, как требует ТЗ. okno — это
    СКОЛЬЗЯЩЕЕ ОКНО (максимум 2 индекса, см. PLANY["demo"]): показываем текущую
    реплику вместе с предыдущей, а не копим все четыре разом — иначе в 9:16 стек
    пузырей выходит за безопасную зону (см. отчёт сборки, первый вариант на всех
    четырёх репликах упирался в 0,555 доли и наезжал на подпись). Рисуется
    целиком, как koncovka(), а не берётся из видео/картинки-источника."""
    W, H = razmer
    zony = ZONY_PEREPISKI[fmt]
    im = Image.new("RGB", (W, H), FON)
    d = ImageDraw.Draw(im)
    f_zag = shrift(zony["kegl_zag"])
    zag = "Вера — ИИ-администратор и продавец"  # 28.09 Андрей: «и администратор, и продавец»
    w = d.textlength(zag, font=f_zag)
    d.text(((W - w) / 2, H * zony["zagolovok"]), zag, font=f_zag, fill=ZOLOTO)
    x_left = W * zony["otstup"]
    x_right = W * (1 - zony["otstup"])
    verh = H * zony["start"]
    for idx in okno:
        kto, tekst = DIALOG_DEMO[idx]
        verh = _puzyr(d, tekst, zony["kegl_puzyr"], x_left, x_right, verh,
                      sprava=(kto == "vera"))
        verh += zony["zazor"]
    # 28.09 главный агент: предупреждение крупнее (было 30 px, правило ТЗ 6 — от 48; беру 44 в две строки,
    # чтобы влезло по ширине) — это подпись про ИИ-звонящего, её важнее всего прочитать (c-0790).
    f_d = shrift(44)
    predup = "Постановочный звонок.\nЗвонит наш тестовый бот"
    y = H * zony["predup"]
    for stroka in perenos(d, predup, f_d, W * 0.84):
        wd = d.textlength(stroka, font=f_d)
        d.text(((W - wd) / 2, y), stroka, font=f_d, fill=DISCLAIMER_CVET)
        y += 44 * 1.25
    return im


def kadry_perepiski(scena, razmer, fmt, klyuch=0):
    """Обёртка под общий интерфейс сцены (как kadry_iz_video/kadry_iz_kartinki):
    возвращает список путей к кадрам. Внутри сцены содержимое статично (пузыри
    не двигаются, стык между сценами — жёсткий монтажный кадр, как у noch/bot/
    pismo между фазами), поэтому кадр всего один — sobrat() сам держит его на
    всю длительность сцены (см. min(n, len(kadry)-1) в sobrat())."""
    im = kadr_perepiski(razmer, fmt, scena["okno"])
    papka = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / ("perep-%d-%d" % (os.getpid(), klyuch))
    if papka.exists():
        for f in papka.glob("*.png"):
            f.unlink()
    papka.mkdir(parents=True, exist_ok=True)
    put = papka / "00001.png"
    im.save(put)
    return [put]


def sobrat(teg, plan, fmt):
    razmer = FORMATY[fmt]
    fps = 30
    sceny_kadry = []
    for i, scena in enumerate(plan["sceny"]):
        kadry = _kadry_sceny(scena, fmt, razmer, fps, klyuch=i)
        if not kadry:
            raise SystemExit("  кадры не достались из %s" % scena["istochnik"])
        sceny_kadry.append(kadry)

    papka = pathlib.Path(os.environ.get("TMPDIR", "/tmp")) / ("gotovo-%s-%s" % (teg, fmt))
    if papka.exists():
        for f in papka.glob("*.png"):
            f.unlink()
    papka.mkdir(parents=True, exist_ok=True)

    nomer = 0
    oblozhka = None
    for scena, kadry in zip(plan["sceny"], sceny_kadry):
        niz = scena.get("niz_doli", 0.78)
        niz = niz[fmt] if isinstance(niz, dict) else niz
        for n in range(int(round(scena["dlitelnost"] * fps))):
            # Если реальных кадров сцены не хватает до конца показа (короткий хук из
            # приближенного окна источника) — берём последний и держим: экран замирает,
            # а не обрывается чёрным.
            src = kadry[min(n, len(kadry) - 1)]
            im = nadpis(Image.open(src), scena["tekst"], scena["kegl"], niz_doli=niz)
            if oblozhka is None:
                oblozhka = im.copy()
            nomer += 1
            im.save(papka / ("%05d.png" % nomer))
    for _ in range(int(round(plan["koncovka"] * fps))):
        nomer += 1
        koncovka(razmer).save(papka / ("%05d.png" % nomer))

    out = VYHOD / ("%s_%s.mp4" % (teg, fmt))
    VYHOD.mkdir(parents=True, exist_ok=True)
    subprocess.run([FF, "-y", "-framerate", str(fps), "-i", str(papka / "%05d.png"),
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", str(out)],
                   capture_output=True)
    oblozhka.save(VYHOD / ("%s_%s_cover.png" % (teg, fmt)))
    return out


# ------------------------------------------------------------------ концепты
# Тексты — дословно из targetolog/TZ-roliki.md. Кегль 56-64 при ширине 1080 заметно
# крупнее требуемых 48: на телефоне кадр делится примерно на 2,77, и 48 там уже мелко.
#
# niz_doli — доля высоты кадра, вокруг которой центрируется подпись (0 = верх, 1 = низ).
# Не одно число на все случаи: у noch кадрирование заполняет кадр целиком (номер, таймер,
# кнопки — в конкретных местах по высоте), а у bot/pismo кадр или картинка вписаны в
# середину с тёмными полями сверху и снизу («priblizit»/kartinka), и там надо целиться
# мимо самой картинки, а не в условную середину экрана. Числа подобраны расчётом по
# кадрам (см. отчёт сборки) и проверены на листах в targetolog/sborka/qa/.
PLANY = {
    "noch": {
        # Кадрирование и тайминг — как приняла приёмка 27.09, не трогаем: жалоба была
        # только на положение подписи, не на монтаж. Источник без полей (crop высотой
        # во весь кадр), поэтому в кадре последовательно оказываются номер (~21-29%),
        # декоративный круг-пульс (~33-50%) и кнопки приёма/отбоя (~74-83%) — подпись
        # на 0,58 садится в чистый промежуток 48-64% и на всех трёх сценах, и в обоих
        # форматах (полосы UI — это доли кадра, они одинаковы что в 916, что в 45).
        "sceny": [
            {"istochnik": "media/лендинг 3/rolik-vera.mp4",
             "kadrirovka": {"916": "crop=608:1080:376:0", "45": "crop=864:1080:248:0"},
             # ss=0,0 давал в кадре 0 чёрный экран (источник фейдится из чёрного долю
             # секунды) — обложка получалась пустой. 0,1 с — уже полностью видный
             # входящий звонок, и это же первый кадр ролика (правило 7 ТЗ).
             "ss": 0.1, "dlitelnost": 1.8,
             "tekst": "Пятница, 23:41. Вам звонят", "kegl": 64, "niz_doli": 0.58},
            {"istochnik": "media/лендинг 3/rolik-vera.mp4",
             "kadrirovka": {"916": "crop=608:1080:376:0", "45": "crop=864:1080:248:0"},
             "ss": 1.95, "dlitelnost_realnaya": 0.35, "dlitelnost": 1.2,
             "tekst": "Узнаете в понедельник", "kegl": 64, "niz_doli": 0.58},
            {"istochnik": "media/лендинг 3/rolik-vera.mp4",
             "kadrirovka": {"916": "crop=608:1080:376:0", "45": "crop=864:1080:248:0"},
             "ss": 2.75, "dlitelnost_realnaya": 5.85, "dlitelnost": 6.8,
             "tekst": "Или трубку возьмёт Вера", "kegl": 64, "niz_doli": 0.58},
        ],
        "koncovka": 2.2,
    },
    "bot": {
        # Приёмка 27.09, три правки:
        # 1) хук — источник берём НЕ с нуля, а с той секунды, где строка бота уже
        #    подсвечена красным (нашли по кадрам: подсветка стоит стабильно 5,8-7,0 с
        #    источника, дальше начинается перекрёстное растворение в журнал). Берём
        #    ss=6.0, реально забираем 1,0 с — на показ надо 3,0 с, остаток sobrat()
        #    сам держит последним кадром (см. комментарий в функции). С кадра 0 в
        #    ролике уже видна красная строка — это и есть хук.
        # 2) «журнал 30 строк» оставлен, но начинается только с 7,8 с источника —
        #    к этому моменту перекрёстное растворение чата в список уже полностью
        #    закончилось (проверено покадрово), иначе в кадр попадает нечитаемая
        #    наложенная склейка двух картинок.
        # 3) экран «Веру мы проверили на себе» — БЫЛ тем же журналом ЧУЖОГО бота
        #    с красными строками (читалось как ошибки Веры). Заменён на настоящий
        #    protokol-vera.png (найден в media/лендинг 2/original/), кадр —
        #    заголовок + подзаголовок + первая строка «было → стало».
        # Кадрирование чата и журнала (priblizit) вписывает источник в среднюю полосу
        # кадра с тёмными полями сверху/снизу (916: полоса 35-65% кадра, 45: 30-70%);
        # protokol вписан тем же принципом (fit по PIL) и садится в похожую полосу
        # (916: 41-59%, 45: 37-63%). Подпись целится МИМО этой полосы — в 916 доступнее
        # сверху (в Reels/Stories опасна нижняя четверть кадра, там кнопка «Позвонить»),
        # в 45 (лента, где кнопки поверх видео нет) — наоборот, снизу, тем же приёмом,
        # что был у обоих роликов раньше, только чуть выше, чтобы не задеть саму панель.
        "sceny": [
            {"istochnik": "media/лендинг 2/rolik-zvonok.mp4",
             "kadrirovka": {"916": "priblizit:crop=980:520:430:440",
                            "45":  "priblizit:crop=1180:600:330:410"},
             "ss": 6.0, "dlitelnost_realnaya": 1.0, "dlitelnost": 3.0,
             "tekst": "Бот пообещал клиенту бесплатный визит", "kegl": 56,
             "niz_doli": {"916": 0.26, "45": 0.82}},
            {"istochnik": "media/лендинг 2/rolik-zvonok.mp4",
             "kadrirovka": {"916": "priblizit:crop=980:520:430:440",
                            "45":  "priblizit:crop=1180:600:330:410"},
             "ss": 7.8, "dlitelnost_realnaya": 2.2, "dlitelnost": 2.6,
             "tekst": "Вы узнали последним", "kegl": 64,
             "niz_doli": {"916": 0.26, "45": 0.82}},
            {"istochnik": "media/лендинг 2/original/protokol-vera.png", "kartinka": True,
             # Заголовок + подзаголовок + шапка BEFORE/AFTER + первая строка сравнения —
             # проверено на телефонном превью (420 px), читается всё целиком, ничего
             # не обрезано по краю (крупнее — обрезает текст «AFTER» на 45).
             "krop_nachalo": (300, 170, 2900, 1000), "dlitelnost": 3.2,
             "tekst": "Веру мы сначала проверили на себе", "kegl": 50,
             "niz_doli": {"916": 0.26, "45": 0.82}},
        ],
        "koncovka": 2.6,
    },
    "pismo": {
        # Новый концепт D. Три РАЗНЫХ источника подряд:
        #   0-3 с  — видео (тот же кусок и то же кадрирование звонка, что у noch,
        #            input с 0,0 с исходника, 2,6 с реального материала — «Друзья
        #            начал» до отмотки, дальше держим последний кадр);
        #   3-7 с  — картинка письма, окно кропа едет вниз по карточке (панорама):
        #            от шапки (бейдж+заголовок+WHO+WHEN) до низа (BOOKED+NUMBER+седьмое
        #            поле) — «проявляется» через движение окна, а не самой картинки;
        #   7-10 с — та же картинка, статичный крупный план на седьмом поле (рамка
        #            «THE ONE SHE COULDN'T ANSWER», золотая обводка — она и есть
        #            «седьмое поле» из ТЗ).
        # Координаты кропа сняты по самой картинке (программный поиск текстовых полос
        # по яркости строк + рамки поля), не на глаз — см. отчёт сборки.
        # niz_doli: сцена 1 (видео без полей, как у noch) — 0,58, та же чистая полоса.
        # Сцены 2 и 3 (картинка, вписана в среднюю полосу с полями) — те же 0,26/0,82,
        # что у bot: полосы близкие (сцена 2: 916 40-60%, 45 36-64%; сцена 3: 916 45-55%,
        # 45 42-57%), тот же приём подписи «мимо полосы» их спокойно перекрывает с запасом.
        "sceny": [
            # 27.09 главный агент: открываем ПИСЬМОМ, а не звонком — первые секунды noch и pismo были из одного
            # исходника, и Meta могла счесть их похожими объявлениями (университет c-0793).
            {"istochnik": "media/лендинг 3/original/pismo-vladelcu.png", "kartinka": True,
             "krop_nachalo": (320, 140, 2880, 1040), "dlitelnost": 3.0,
             "tekst": "После каждого звонка — письмо вам", "kegl": 60,
             "niz_doli": {"916": 0.26, "45": 0.82}},
            {"istochnik": "media/лендинг 3/original/pismo-vladelcu.png", "kartinka": True,
             "krop_nachalo": (320, 140, 2880, 1040), "krop_konec": (320, 1400, 2880, 2300),
             "dlitelnost": 3.5,
             "tekst": "Кто звонил, что хотел, записался ли", "kegl": 56,
             "niz_doli": {"916": 0.26, "45": 0.82}},
            {"istochnik": "media/лендинг 3/original/pismo-vladelcu.png", "kartinka": True,
             "krop_nachalo": (260, 1760, 2940, 2260), "dlitelnost": 3.0,
             "tekst": "И на какой вопрос\nона не ответила", "kegl": 56,
             "niz_doli": {"916": 0.26, "45": 0.82}},
        ],
        "koncovka": 2.0,
    },
    "demo": {
        # Концепт C «Скажите ей «дорого»» — новая сцена «переписка» (kadr_perepiski
        # выше), а не видео/картинка: пузыри чата на тёмном фоне, дословно из
        # постановочного звонка 28.09 (conv_6201m3m947ytfzht391m8vj7bmje). Раскадровка —
        # как решил Андрей в этой задаче (не старая таблица TZ-roliki.md §2C):
        # 0-2,5 пузырь 1 + хук; 2,5-5,5 пузырь 2 (цена); 5,5-7 пузырь 3 («дорого»);
        # 7-9,5 пузырь 4 (ответ) + подпись «отвечает без уговоров»; 9,5-11,5 концовка.
        # "okno" — скользящее окно индексов DIALOG_DEMO (максимум 2 разом: текущая
        # реплика + предыдущая, для контекста) — все четыре пузыря разом не влезали
        # в безопасную зону 9:16 (см. kadr_perepiski, отчёт сборки). Кульминация
        # (сцена 4) держит именно пару «Это дорого» → «Дорого по сравнению с чем?» —
        # ровно то, ради чего ролик снят.
        # Мелкая строка «Постановочный звонок...» рисуется в kadr_perepiski на каждом
        # кадре сцены (не через tekst/nadpis) — значит держится весь ролик без пропусков.
        "sceny": [
            {"perepiska": True, "okno": [0], "dlitelnost": 2.5,
             "tekst": "Скажите ей «дорого»", "kegl": 80,
             "niz_doli": {"916": 0.46, "45": 0.50}},
            {"perepiska": True, "okno": [0, 1], "dlitelnost": 3.0,
             "tekst": "", "kegl": 48,
             "niz_doli": {"916": 0.46, "45": 0.50}},
            {"perepiska": True, "okno": [1, 2], "dlitelnost": 1.5,
             "tekst": "", "kegl": 48,
             "niz_doli": {"916": 0.46, "45": 0.50}},
            {"perepiska": True, "okno": [2, 3], "dlitelnost": 2.5,
             "tekst": "Отвечает на возражение —\nбез уговоров", "kegl": 66,
             "niz_doli": {"916": 0.46, "45": 0.50}},
        ],
        "koncovka": 2.0,
    },
}


if __name__ == "__main__":
    if not sys.argv[1:]:
        print("  укажите тег:", ", ".join(PLANY)); raise SystemExit(2)
    for teg in sys.argv[1:]:
        plan = PLANY.get(teg)
        if not plan:
            print("  нет такого концепта:", teg); continue
        for fmt in FORMATY:
            out = sobrat(teg, plan, fmt)
            razmer = out.stat().st_size if out.exists() else 0
            print("  %s %s → %s (%d КБ)" % (teg, fmt, out.name, razmer // 1024))
