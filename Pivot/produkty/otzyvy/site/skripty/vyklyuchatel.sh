#!/bin/bash
# Общий выключатель Сборщика (Blobs, хранилище otzyvy, ключ nastroyki/vyklyuchatel). По умолчанию — выключено:
# нет записи — нет работы. Включать только по слову Андрея. НЕ запускался.
#   skripty/vyklyuchatel.sh sostoyanie | vkl | vykl
set -e
ENVF="$HOME/.bidna-otzyvy.env"
[ -f "$ENVF" ] || { echo "нет $ENVF"; exit 1; }
set -a; . "$ENVF"; set +a
export NETLIFY_SITE_ID="$OTZYVY_SITE_ID"
NL="npx --yes netlify-cli"
KOGDA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
case "$1" in
  sostoyanie) $NL blobs:get otzyvy nastroyki/vyklyuchatel || echo "записи нет — ВЫКЛЮЧЕНО" ;;
  vkl)  $NL blobs:set otzyvy nastroyki/vyklyuchatel "{\"vklyucheno\":true,\"kto\":\"$USER\",\"kogda\":\"$KOGDA\"}" && echo "ВКЛЮЧЕНО" ;;
  vykl) $NL blobs:set otzyvy nastroyki/vyklyuchatel "{\"vklyucheno\":false,\"kto\":\"$USER\",\"kogda\":\"$KOGDA\"}" && echo "выключено" ;;
  *) echo "использование: $0 sostoyanie | vkl | vykl"; exit 1 ;;
esac
