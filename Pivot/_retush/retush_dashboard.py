#!/usr/bin/env python3
"""
Ретушь дашборда Atlas Delta перед публикацией в статье-кейсе.

Убираем всё, что принадлежит третьим лицам:
  * телеграм-юзернеймы и id клиентов в «Активных договорах рассрочки»
  * две чужие партнёрские метки с нулевым приходом в «Метках источников»

Оставляем: кассу, приход, дебиторку, цель, продукты, взносы, метки самого Влада
(@Vlad_yasko, @vlad_yasko_ai — они и есть доказательство, что канал продаёт).

Маскируем плашками, а не блюром: блюр на коротких строках известного шрифта
восстанавливается, плашка — нет.

Все координаты сняты замером по пикселям (см. _izmereniya.md), не на глаз.
Запуск:  python3 retush_dashboard.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

HERE = Path(__file__).parent
SRC  = HERE.parent / 'photo_2026-09-08_15-34-52.jpg'

WHITE = (255, 255, 255)
GRAY  = (223, 227, 236)          # тот же серый, что у прогресс-баров «взносов»

# «Активные договоры рассрочки» — колонка КЛИЕНТ.
# (верх, низ) зоны маски и правый край маски — замерены с порогом 245,
# чтобы попал и антиалиасинг верхушек букв; разделители строк не задеты.
CLIENT_ROWS = [
    (341, 371, 884),
    (381, 411, 869),
    (421, 451, 869),
    (461, 491, 869),
    (501, 523, 869),   # строка без @имени, только id
    (541, 568, 869),
    (579, 604, 869),
    (613, 643, 876),
]
CLIENT_X0   = 757
BAR_X0, BAR_W = 762, 96

# «Метки источников» — чужие метки: (x0, y0, x1, y1)
FOREIGN_TAGS = [
    (230, 501, 276, 517),   # TonyNft  — 27 стартов, 0 оплат
    (229, 643, 281, 658),   # romasio  — 1 старт,  0 оплат
]

# Колонка СУММА (для варианта, где прячем и суммы)
SUM_X0, SUM_X1 = 1022, 1075


def _bar(d, x0, cy, w, h=13):
    d.rounded_rectangle([x0, cy - h // 2, x0 + w, cy + h // 2], radius=5, fill=GRAY)


def retush(hide_sums: bool, out: Path) -> None:
    im = Image.open(SRC).convert('RGB')
    d = ImageDraw.Draw(im)

    for top, bottom, prod_x in CLIENT_ROWS:
        d.rectangle([CLIENT_X0, top, prod_x, bottom], fill=WHITE)
        _bar(d, BAR_X0, (top + bottom) // 2, BAR_W)

    for x0, y0, x1, y1 in FOREIGN_TAGS:
        d.rectangle([x0, y0, x1, y1], fill=WHITE)
        _bar(d, x0 + 2, (y0 + y1) // 2, x1 - x0 - 6, h=11)

    if hide_sums:
        for top, bottom, _ in CLIENT_ROWS:
            d.rectangle([SUM_X0, top, SUM_X1, bottom], fill=WHITE)
            _bar(d, SUM_X0 + 4, (top + bottom) // 2, SUM_X1 - SUM_X0 - 8)

    im.save(out, quality=95, subsampling=0)
    print('записан', out.name)


if __name__ == '__main__':
    retush(False, HERE / 'dashboard-85k-A-summy-vidny.jpg')
    retush(True,  HERE / 'dashboard-85k-B-summy-skryty.jpg')
