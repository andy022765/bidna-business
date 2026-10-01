#!/bin/bash
# Проверка патча для Веры БЕЗ правки живого кода. Копия Pivot/golos (без node_modules и web) — во
# временную папку вне Google Drive; патч — в копию; проверки Веры до и после + новая проверка метки.
# Ничего не выкладывает, в сеть не ходит (все проверки Веры на подделках), живые файлы не трогает.
#   produkty/otzyvy/site/dlya-very/proverit-patch.sh
set -e
ZDES="$(cd "$(dirname "$0")" && pwd)"
PIVOT="$(cd "$ZDES/../../../.." && pwd)"
[ -f "$PIVOT/golos/site/netlify-functions/kalendar-zapis.js" ] || { echo "нет $PIVOT/golos"; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/do/golos"
rsync -a --exclude node_modules --exclude web "$PIVOT/golos/site" "$PIVOT/golos/proverka" "$TMP/do/golos/"
cp -R "$TMP/do" "$TMP/posle"
(cd "$TMP/posle" && patch -p1 --quiet --forward < "$ZDES/vera-otzyvy.patch")
echo "→ патч лёг на копию"

progon() {  # $1 — do|posle
  cd "$TMP/$1/golos/proverka"
  for t in test_*.js; do
    [ "$t" = test_otzyvy_metka.js ] && continue
    node "$t" ../site/netlify-functions/pismo.js > /dev/null 2>&1 && echo "$t 0" || echo "$t $?"
  done
}
progon do > "$TMP/kody-do.txt"
progon posle > "$TMP/kody-posle.txt"
if diff "$TMP/kody-do.txt" "$TMP/kody-posle.txt" > /dev/null; then
  echo "→ проверки Веры: коды выхода до и после патча совпадают ($(grep -c ' 0$' "$TMP/kody-posle.txt") зелёных из $(wc -l < "$TMP/kody-posle.txt" | tr -d ' '))"
else
  echo "→ ПРОВЕРКИ ВЕРЫ РАЗОШЛИСЬ после патча:"; diff "$TMP/kody-do.txt" "$TMP/kody-posle.txt"; exit 1
fi
cd "$TMP/posle/golos/proverka"
if node test_otzyvy_metka.js > "$TMP/metka.log" 2>&1; then echo "→ новая проверка метки: $(grep -c ' ДА' "$TMP/metka.log") из $(grep -cE ' (ДА|ПРОВАЛ)' "$TMP/metka.log")"
else cat "$TMP/metka.log"; exit 1; fi
cd "$TMP/do/golos/proverka"
cp "$ZDES/test_otzyvy_metka.js" .
if node test_otzyvy_metka.js > /dev/null 2>&1; then echo "→ ВНИМАНИЕ: новая проверка проходит и без патча — она ничего не проверяет"; exit 1; fi
echo "→ без патча новая проверка падает (так и должно быть)"
echo "ГОТОВО: патч цел"
