#!/bin/bash
# Кладёт в lib/ свежую копию календаря Веры. gkal.js здесь НЕ правим: один файл на голос и Сборщика,
# чтобы арифметика поясов у них не разъехалась. Тест test-pasport-pisma.js сверяет копию побайтно.
set -e
cd "$(dirname "$0")/.."
SRC="../../../golos/site/kalendar-lib/gkal.js"
[ -f "$SRC" ] || { echo "нет $SRC"; exit 1; }
cp "$SRC" lib/gkal.js
shasum -a 256 "$SRC" lib/gkal.js
