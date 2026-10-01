#!/bin/bash
# ОТЛОЖЕНО 29.09.2026 вместе со своей записью (живой путь календарь не использует).
# Кладёт в na-potom/lib/ свежую копию календаря Веры. gkal.js НЕ правим здесь (PLAN-V1, п. 1):
# один файл на голос и текст, чтобы «посмотреть окна» и «записать» у них не разъехались.
# Тест na-potom/tests/test-kartochka-zapis.js сверяет копию побайтно и падает, если её забыли обновить.
set -e
cd "$(dirname "$0")/.."
SRC="../../../../golos/site/kalendar-lib/gkal.js"
[ -f "$SRC" ] || { echo "нет $SRC"; exit 1; }
cp "$SRC" lib/gkal.js
shasum -a 256 "$SRC" lib/gkal.js
