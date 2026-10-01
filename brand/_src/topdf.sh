#!/bin/zsh
# HTML → PDF через Chrome headless. Chrome часто не выходит сам — поэтому фон + kill.
# Использование: topdf.sh <src.html> <out.pdf>
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
UDD="$(mktemp -d)"
rm -f "$2"          # иначе ожидание «файл появился» проходит мгновенно на старом файле
"$CH" --headless=new --disable-gpu --no-first-run --no-default-browser-check --no-pdf-header-footer \
  --user-data-dir="$UDD" --virtual-time-budget=4000 --print-to-pdf="$2" "file://$1" >/dev/null 2>&1 &
pid=$!; i=0
while [ ! -s "$2" ] && [ $i -lt 40 ]; do sleep 1; i=$((i+1)); done
sleep 1; kill -9 $pid 2>/dev/null; rm -rf "$UDD"
[ -s "$2" ] && echo "ok: $2 ($(stat -f%z "$2") байт)" || echo "FAIL: $2"
