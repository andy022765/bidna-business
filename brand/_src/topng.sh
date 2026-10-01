#!/bin/zsh
# SVG → PNG нужного размера (соцсети и мессенджеры SVG не принимают).
# Использование: topng.sh <src.svg> <out.png> <px> [фон, по умолчанию прозрачный]
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"; BG="${4:-transparent}"
# высота — из viewBox, иначе неквадратный локап растянется в квадрат
VB=$(grep -o 'viewBox="[^"]*"' "$1" | head -1 | sed 's/viewBox="//;s/"//')
H=$(python3 -c "v='$VB'.split(); print(int(round($3*float(v[3])/float(v[2]))))")
cat > "$TMP/w.html" <<EOF
<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:$BG}
img{display:block;width:${3}px;height:${H}px}
</style><img src="file://$1">
EOF
rm -f "$2"
"$CH" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --user-data-dir="$TMP/u" --window-size=$3,$H --virtual-time-budget=3000 \
  --screenshot="$2" "file://$TMP/w.html" >/dev/null 2>&1 &
pid=$!; i=0; while [ ! -s "$2" ] && [ $i -lt 25 ]; do sleep 1; i=$((i+1)); done
sleep 1; kill -9 $pid 2>/dev/null; rm -rf "$TMP"
[ -s "$2" ] && echo "ok: ${2##*/} ${3}×${H}" || echo "FAIL: $2"
