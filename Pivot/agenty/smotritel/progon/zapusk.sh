#!/bin/bash
# Один слот замера. Запускается сам по расписанию (raspisanie.sh) или руками: ./zapusk.sh utro
#
# Работает НЕ в папке Google Drive: системный планировщик macOS туда не пускает
# («Operation not permitted»). Рабочая копия программы и вопросов лежит в ~/bidna-smotritel,
# туда же падают ответы. Обновить копию: raspisanie.sh obnovit. Забрать ответы в проект: raspisanie.sh zabrat.
set -u
SLOT="${1:-}"
[ -z "$SLOT" ] && { echo "нужен слот: utro, den или vecher"; exit 2; }

export SMOTRITEL_BAZA="$HOME/bidna-smotritel"
PY=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3
DEN="$(TZ=America/Los_Angeles date +%F)"
ZHURNAL="$SMOTRITEL_BAZA/zamer-v1/api/$DEN/$SLOT/_zhurnal.log"
mkdir -p "$(dirname "$ZHURNAL")"

NABOR=""
[ "$DEN" = "2026-09-22" ] && NABOR="--nabor opornye"   # 22.09 повторяем только шесть опорных

{
  echo "=== $(TZ=America/Los_Angeles date '+%F %H:%M:%S %Z') · слот $SLOT $NABOR"
  caffeinate -i "$PY" "$SMOTRITEL_BAZA/progon/progon.py" --slot "$SLOT" $NABOR   # caffeinate не даёт Маку уснуть
  echo "=== код выхода: $?"
} >> "$ZHURNAL" 2>&1
