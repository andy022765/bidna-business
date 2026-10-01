# -*- coding: utf-8 -*-
"""Мобильные правки по аудиту 07.09.2026.

Мерялось честно: headless Chrome зажимает окно до 500px, поэтому --window-size врёт.
Эмуляция через CDP Emulation.setDeviceMetricsOverride — 390x844, DPR 3, тач, iPhone-UA.

Что нашлось на живом сайте:

1. ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ на всех четырёх лендингах. Документ 498px (бизнес),
   461 (эксперт), 522 и 451 на английских — при экране 390. Виноваты <select>
   в блоке-конструкторе: ширину нативного селекта задаёт самый длинный вариант
   («тех, кому важен результат, а не только цену» — 442px при шрифте 19px),
   а ограничения не стояло.

   Следствие, которое само по себе выглядело отдельным багом: липкая кнопка внизу
   экрана меряется от ширины ДОКУМЕНТА, а не экрана, поэтому получала 474px
   (498 − 12 − 12) и уезжала за правый край. Чинится тем же.

2. ТАЧ-ЦЕЛИ НИЖЕ 44px (минимум Apple): ссылки .pt-link — 19px высотой, логотип
   в шапке — 34px, ссылки в подвале — 17px, селекты и поле конструктора — 30–32px,
   кнопки выбора на странице списка — 39px.

3. ТЕКСТ МЕЛЬЧЕ 15px: вся таблица сравнения (14.5px, двенадцать ячеек), подписи
   конструктора, строка под кнопкой первого экрана, подвал.
   Заглавные надписи с разрядкой (eyebrow, оси) намеренно оставлены мелкими —
   они так и читаются, это метки, а не текст.

Проверено отдельно и НЕ трогаем: альбомная ориентация чистая (844px документ на
844px экране), FAQ-аккордеон работает (0 → 181px → 0, тач-цель 342x71), сетка
блока «Пятеро» на телефоне схлопывается в одну колонку, битых картинок нет,
поля форм не мельче 16px (iOS не будет зумить страницу при фокусе).
"""
import pathlib
import re

L = pathlib.Path(__file__).resolve().parent.parent
MARK = 'МОБИЛЬНЫЕ ПРАВКИ'

LANDING_CSS = """
/* ── %s (аудит 07.09.2026, эмуляция iPhone 390x844) ───────────────── */
/* Ширину нативного select задаёт самый длинный вариант. Без ограничения он
   распирал документ до 498px, и вместе с ним уезжала липкая кнопка внизу. */
.constructor select,.constructor input{max-width:100%%;box-sizing:border-box}

@media(max-width:640px){
  /* тач-цели до 44px */
  .constructor select,.constructor input{padding:9px 10px}
  p.micro a{display:inline-block;padding:13px 0}
  .attrib span{font-size:15px}
  .pt-link{display:inline-block;padding:13px 0}
  .logo{padding:5px 0}
  footer a{display:inline-block;padding:14px 0}

  /* читаемость: всё, что человек реально читает, — не мельче 15px.
     Заглавные с разрядкой (.eyebrow, .axes) оставлены как есть. */
  .vs-them,.vs-us{font-size:15.5px}
  .constructor .fill+p,.constructor p{font-size:15.5px}
  .constructor .hint{font-size:14.5px}
  .hero .micro{font-size:15px}
  .trust-line{font-size:15px}
  .fb-hint{font-size:14px}
  footer{font-size:15px}
}
""" % MARK

LIST_CSS = """
/* ── %s (аудит 07.09.2026) ─────────────────────────────────────────── */
@media(max-width:640px){
  .chips button{padding:12px 18px}      /* было 39px высотой, минимум 44 */
  .fine{font-size:15px}                 /* было 13.5px — это читаемый текст, не метка */
  footer a{display:inline-block;padding:14px 0}
}
""" % MARK


def patch_landing(name):
    p = L / name
    s = p.read_text(encoding='utf-8')
    if MARK in s:
        print('%-14s правки уже стоят' % name)
        return
    i = s.rindex('</style>')
    p.write_text(s[:i] + LANDING_CSS + s[i:], encoding='utf-8')
    print('%-14s мобильные правки добавлены' % name)


def patch_list_src():
    p = L / '_src' / 'list.py'
    s = p.read_text(encoding='utf-8')
    if MARK in s:
        print('list.py        правки уже стоят')
        return
    # CSS страницы списка лежит в переменной CSS = """..."""
    m = re.search(r'(CSS\s*=\s*r?""")(.*?)(""")', s, re.S)
    if not m:
        raise RuntimeError('блок CSS в list.py не найден')
    p.write_text(s[:m.end(2)] + LIST_CSS + s[m.end(2):], encoding='utf-8')
    print('list.py        мобильные правки добавлены')


if __name__ == '__main__':
    patch_landing('biznes.html')
    patch_landing('ekspert.html')
    patch_list_src()
