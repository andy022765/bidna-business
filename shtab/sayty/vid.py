# -*- coding: utf-8 -*-
"""Общий вид лендингов — замечания Андрея 24.09.

ПОЧЕМУ ОТДЕЛЬНЫМ ФАЙЛОМ. Андрей идёт по лендингам по очереди: сначала видимость, потом,
если одобрит, то же самое на Веру и диагностику. Значит вид обязан быть в ОДНОМ месте,
а применяться к списку страниц. Переносить руками из файла в файл — верный способ
получить три разных сайта.

КУДА ЛОЖИТСЯ. В самый конец <style> страницы, после её собственных правил и после
переключателя языка. Поэтому здесь можно писать обычными селекторами: они и так позже.
Ни одной строки в разметке — значит сверка вёрстки EN и RU не может от этого упасть.

ЧТО ИМЕННО ПРОСИЛ АНДРЕЙ (его нумерация, чтобы потом было видно, что сделано):
  1 крупнее шрифт и шире картинки · 2 фон светлее, как на главной · 3 светлые блоки
  вперемешку с тёмными · 4 объёмные кнопки · 5 заметный переключатель языка · 6 светлые
  таблицы крупным шрифтом.

ФОН ВЗЯТ С ГЛАВНОЙ НЕ НА ГЛАЗ. Снят с живой businessinteldna.com 24.09:
radial-gradient(1100px 600px at 50% -10%, #232f6b 0%, #1b2557 42%, #0f1430 100%),
палитра оттуда же: navy #1b2557, navy-deep #0f1430, gold #c69a4c, cream #f5f3ee.

СВЕТЛЫЕ СЕКЦИИ ВЫБРАНЫ ПО СМЫСЛУ, А НЕ ЧЕРЕЗ ОДНУ: это три места, где человек действует
(форма, цена, последний экран) плюс одна передышка. Выбор — номерами секций, без классов
в разметке: класс пришлось бы ставить в оба языка, и однажды его поставили бы в один.
"""

SVETLYE = (3, 6, 9, 11)   # форма · цена · «полчаса на квартал» · финал с оплатой

_svet = ",".join("section:nth-of-type(%d)" % n for n in SVETLYE)


def _vnutri(chto, pravila):
    """Правило внутри всех светлых секций сразу: каждый селектор × каждая секция."""
    sel = ["section:nth-of-type(%d) %s" % (n, c.strip())
           for n in SVETLYE for c in chto.split(",")]
    return ",".join(sel) + "{" + pravila + "}"


NOVYY_VID = """
/* ═══════ ОБЩИЙ ВИД 24.09 — правки Андрея. Источник: shtab/sayty/vid.py ═══════ */

:root{
  --bg:#1b2557; --panel:#232f6b; --card:#28336f;
  --ink:#ffffff; --dim:#c3c9e6; --faint:#9aa2c4;
  --line:rgba(255,255,255,.16); --rule:rgba(255,255,255,.28);
  --gold:#e3c88a;
  --krem:#f5f3ee;        /* фон светлых секций, как на главной */
  --tyomn:#16203f;       /* текст на светлом */
  --tyomn2:#4a5578;      /* приглушённый текст на светлом */
  --zoloto-t:#8a6a22;    /* золото, читаемое на кремовом */
}

/* 2. ФОН СВЕТЛЕЕ — тот же, что на главной. Отдельным слоем, а не background-attachment:
      fixed: на мобильной Safari он дёргается при прокрутке. */
body{background:#1b2557;font-size:19px}
body::before{content:"";position:fixed;inset:0;z-index:-1;
  background:radial-gradient(1100px 600px at 50% -10%,#232f6b 0%,#1b2557 42%,#0f1430 100%)}

/* 1. КРУПНЕЕ ВЕЗДЕ */
h1{font-size:clamp(38px,6vw,66px)}
h2{font-size:clamp(28px,4.2vw,42px)}
h3{font-size:23px}
p{font-size:19px;max-width:66ch}
.lede{font-size:23px;max-width:58ch}
li{font-size:19px;max-width:62ch}
.eyebrow{font-size:13px}
.st p{font-size:19px}
.obj .q{font-size:21px}
.obj p{font-size:18.5px}
.bs p{font-size:18px}
.bs .n{font-size:12.5px}
.bsub{font-size:14.5px}
.form .note,.note{font-size:16px}
.form label{font-size:12.5px}
.form input{font-size:18px;padding:15px 14px}

/* 1. КАРТИНКИ ШИРЕ. Они стоят внутри узкой колонки — выпускаем их на ширину страницы,
      иначе «растянуть» упирается в 760px и растягивать нечего. */
/* Не через margin-left:50% + translateX(-50%): сдвиг margin-ом РАСШИРЯЕТ документ,
   и на телефоне страница уезжала вправо, а текст обрезался. Найдено снимком 390px 24.09.
   Здесь ширина растёт только отрицательными полями: когда экран уже узкой колонки,
   обе величины сравниваются, поля становятся нулевыми и переполняться нечему. */
.narrow figure{
  --shir:min(1120px, 100vw - 48px);
  --uzko:min(760px, 100vw - 48px);
  margin-left:calc((var(--shir) - var(--uzko)) / -2);
  margin-right:calc((var(--shir) - var(--uzko)) / -2)}
figure img,figure video{border-radius:14px;border:1px solid var(--line)}

/* ССЫЛКИ. В исходном стиле цвет задан ровно одной ссылке (.cena-shapka a), всё остальное
      браузер красил своим синим — на тёмно-синем фоне это и не видно, и уродливо. Нашлось
      снимком 24.09: ссылка «Что в неё входит» и новые ссылки на чужие прайсы были синими. */
a{color:var(--gold);text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
a:hover{color:#fff}
.btn,.btn:hover,.lang,.lang:hover,.cena-shapka a{text-decoration:none}

/* 4. КНОПКИ ОБЪЁМНЫЕ — у кнопки видно высоту, и она проминается при нажатии. */
.btn{font-size:20px;padding:20px 40px;border-radius:13px;
  background:linear-gradient(#efd9a6,#dcbe78);color:#1a1405;
  box-shadow:0 6px 0 #a17f3c,0 14px 26px rgba(0,0,0,.38);
  transition:transform .11s,box-shadow .11s,background .18s}
.btn:hover{background:linear-gradient(#f6e4bb,#e6cb8c)}
.btn:active{transform:translateY(5px);box-shadow:0 1px 0 #a17f3c,0 5px 12px rgba(0,0,0,.32)}
.btn.btn2{background:linear-gradient(#fff,#e7e3d7);color:#1b2557;box-shadow:0 6px 0 #a9a596,0 14px 26px rgba(0,0,0,.34)}
.btn.btn2:active{box-shadow:0 1px 0 #a9a596,0 5px 12px rgba(0,0,0,.3)}
.form button{font-size:19px;padding:18px 16px;border-radius:12px;
  background:linear-gradient(#efd9a6,#dcbe78);color:#1a1405;
  box-shadow:0 5px 0 #a17f3c,0 10px 20px rgba(0,0,0,.34);
  transition:transform .11s,box-shadow .11s}
.form button:active{transform:translateY(4px);box-shadow:0 1px 0 #a17f3c,0 4px 10px rgba(0,0,0,.3)}

/* 7. Кнопки ведут на саму форму — чтобы она не упиралась в верхний край экрана. */
#forma{scroll-margin-top:86px}

/* 5. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА — читается как переключатель, а не как подпись. */
.lang{background:var(--krem);color:#1b2557;border:2px solid var(--gold);
  font-size:14px;font-weight:600;min-height:42px;min-width:62px;
  box-shadow:0 4px 0 rgba(0,0,0,.28),0 8px 18px rgba(0,0,0,.3);letter-spacing:.1em}
.lang:hover{background:#fff;color:#1b2557;border-color:#fff}
@media(max-width:640px){.lang{min-height:46px;min-width:66px;font-size:15px}}

/* 6. ТАБЛИЦЫ СВЕТЛЫЕ И КРУПНЫЕ — на синем фоне их было не прочитать. */
.tw{background:var(--krem);border-radius:16px;padding:8px 16px;
  box-shadow:0 10px 26px rgba(0,0,0,.28)}
table{font-size:18px;color:var(--tyomn)}
td{padding:16px 14px;border-bottom:1px solid rgba(22,32,63,.14)}
td.p{color:var(--tyomn2)}
td.n{color:var(--tyomn)}
td.n small{color:var(--tyomn2);font-size:15px}
tr.h td,tr.h{color:var(--zoloto-t)}
tr.was td{color:var(--tyomn2)}
tr.sum td{color:var(--tyomn);font-weight:700;font-size:20px}
.tw a{color:#6b5216}
"""


def _svetlye_pravila():
    """3. Светлые секции. Всё, что внутри, обязано поменять цвет — иначе белым по кремовому."""
    return "\n".join([
        "",
        "/* 3. СВЕТЛЫЕ БЛОКИ ВПЕРЕМЕШКУ С ТЁМНЫМИ */",
        _svet + "{background:var(--krem);color:var(--tyomn);border-top:0}",
        _vnutri("h1,h2,h3", "color:var(--tyomn)"),
        _vnutri("p,li", "color:var(--tyomn)"),
        _vnutri(".lede,.bsub,.note,.form .note", "color:var(--tyomn2)"),
        _vnutri(".eyebrow,.st .k,.bs .n", "color:var(--zoloto-t)"),
        _vnutri("li::marker", "color:var(--zoloto-t)"),
        _vnutri("a", "color:#6b5216"),
        _vnutri(".st", "border-top-color:rgba(22,32,63,.14)"),
        _vnutri(".obj", "border-top-color:rgba(22,32,63,.14)"),
        _vnutri(".obj p", "color:var(--tyomn2)"),
        _vnutri(".obj p b,p b,strong", "color:var(--tyomn)"),
        # Форма на светлом: поля должны остаться белыми, а не сливаться с кремовым.
        _vnutri(".form", "background:#fff;border-color:rgba(22,32,63,.18);"
                         "box-shadow:0 14px 34px rgba(0,0,0,.18)"),
        _vnutri(".form input", "background:#fff;border-color:rgba(22,32,63,.28);color:var(--tyomn)"),
        _vnutri(".form input::placeholder", "color:#8a92ab"),
        _vnutri(".form label", "color:var(--tyomn2)"),
        _vnutri(".bs", "background:#fff;border-color:rgba(22,32,63,.16)"),
        # Таблица внутри светлой секции: её фон и так кремовый, снимаем лишнюю тень.
        _vnutri(".tw", "background:#fff;box-shadow:0 10px 26px rgba(0,0,0,.14)"),
        _vnutri(".quote", "border-left-color:var(--zoloto-t)"),
        # ── Контраст. Замер 26.09 браузером: светлое золото #e3c88a на белом — 1.63:1,
        # приглушённый синий в small — 2.52:1. Это не «бледно», это нечитаемо.
        # Берём тёмное золото из палитры: около 5:1 на белом, и это по-прежнему золото.
        _vnutri("tr.sum td.p, td.p b, .tw b", "color:var(--zoloto-t)"),
        _vnutri("small, td.p small", "color:var(--tyomn2)"),
        _vnutri("th, th.p", "color:var(--tyomn)"),
        # ── Тёмные плашки ВНУТРИ светлой секции. Общее правило выше красит все абзацы
        # тёмным — и на тёмной плашке текст исчезает совсем (контраст 1.00:1 на «Гарантиях»
        # Веры и в «Условиях работы» Видимости). Возвращаем им светлый, вместе с жирным.
        _vnutri(".g, .g p, .g li, .g b, .g strong, .g .t b", "color:var(--ink)"),
        _vnutri(".g .t", "color:var(--gold)"),
        "",
        "@media(max-width:760px){",
        "  body{font-size:18px}",
        "  p,li,.st p{font-size:18px}",
        "  .lede{font-size:20px}",
        "  table{font-size:16.5px}",
        "  td{padding:13px 11px}",
        "  .btn{font-size:18px;padding:18px 26px;width:100%;text-align:center}",
        "  .narrow figure{margin-left:0;margin-right:0}",
        "}",
    ])


VID = NOVYY_VID + _svetlye_pravila() + "\n"

# Кому применяем. Пока только видимость: Андрей смотрит лендинги по очереди,
# и переносить вид на Веру и диагностику он велел ПОСЛЕ одобрения.
PRIMENYAT = {"visibility", "vera"}
