#!/bin/bash
# ОДИН РАЗ перед первой выкладкой. НЕ запускался. Ничего не шлёт и ничего не выкладывает.
#   skripty/nastroit-odin-raz.sh sekrety     — два случайных секрета в ~/.bidna-otzyvy.env (если их там нет)
#   skripty/nastroit-odin-raz.sh sozdat      — новый сайт Netlify
#   skripty/nastroit-odin-raz.sh peremennye  — переменные сайта (значения в вывод не печатаются)
#   skripty/nastroit-odin-raz.sh klyuch      — ключ служебного аккаунта календаря в Blobs этого сайта
#
# Секреты — только в ~/.bidna-otzyvy.env (вне Google Drive), формат KEY=VALUE:
#   OTZYVY_SITE_ID=<id сайта>                  — после шага sozdat
#   OTZYVY_SECRET=<hex 64>                     — подпись ссылок в письмах. НЕ МЕНЯТЬ после первых писем:
#                                                 сломаются ссылки отписки (при смене — старый в OTZYVY_SECRET_STARYY)
#   OTZYVY_KLYUCH_ADMINA=<hex 48>              — zdorovie, zapusk, фоновая функция черновика
#   OTZYVY_RESEND_KEY=re_...                   — ОТДЕЛЬНЫЙ аккаунт Resend на support@ (PLAN-DLYA-ANDREYA п. 6.9а)
#   OTZYVY_PLACES_KEY=...                      — Google Maps Platform, только Places API (New), ограничение по API
#   OTZYVY_ANTHROPIC_KEY=sk-ant-...            — отдельное рабочее пространство otzyvy с лимитом $5 (п. 6.9б)
#   EV_BLOBS_TOKEN=<Netlify personal access token> — без него Blobs из функции не поднимаются и метки Веры не читаются
#   OTZYVY_BAZA_URL=https://<сайт>.netlify.app — адрес для ссылок из писем
#
# ГРАБЛИ (из памяти проекта):
#  • `netlify` берёт привязку из КОРНЯ проекта (.netlify/state.json — чужой сайт). Поэтому везде
#    NETLIFY_SITE_ID и --site с ИДЕНТИФИКАТОРОМ.
#  • env:set печатает значение в вывод — секреты задаём через api с выводом в /dev/null.
#  • переменные подхватываются только выкладкой.
set -e
cd "$(dirname "$0")/.."
ENVF="$HOME/.bidna-otzyvy.env"
NL="npx --yes netlify-cli"

if [ "$1" = "sekrety" ]; then
  touch "$ENVF"; chmod 600 "$ENVF"
  grep -q '^OTZYVY_SECRET=' "$ENVF" || echo "OTZYVY_SECRET=$(openssl rand -hex 32)" >> "$ENVF"
  grep -q '^OTZYVY_KLYUCH_ADMINA=' "$ENVF" || echo "OTZYVY_KLYUCH_ADMINA=$(openssl rand -hex 24)" >> "$ENVF"
  echo "готово: $ENVF (значения не печатаю). Остальные ключи — строками KEY=VALUE туда же."
  exit 0
fi

if [ "$1" = "sozdat" ]; then
  echo "→ создаю сайт (имя с хвостом, чтобы не угадывали)"
  $NL sites:create --name "otzyvy-$(openssl rand -hex 3)" --disable-linking
  echo "Запиши site_id в $ENVF как OTZYVY_SITE_ID и запусти: $0 peremennye"
  exit 0
fi

[ -f "$ENVF" ] || { echo "нет $ENVF"; exit 1; }
set -a; . "$ENVF"; set +a
[ -n "$OTZYVY_SITE_ID" ] || { echo "нет OTZYVY_SITE_ID"; exit 1; }
export NETLIFY_SITE_ID="$OTZYVY_SITE_ID"

if [ "$1" = "peremennye" ]; then
  echo "→ переменные сайта (значения в вывод не печатаются)"
  ACC=$($NL api getSite --data "{\"site_id\":\"$OTZYVY_SITE_ID\"}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["account_id"])')
  export ACC
  DATA=$(python3 - <<'PY'
import os, json
keys = ["OTZYVY_SECRET","OTZYVY_KLYUCH_ADMINA","OTZYVY_RESEND_KEY","OTZYVY_PLACES_KEY","OTZYVY_ANTHROPIC_KEY","EV_BLOBS_TOKEN","OTZYVY_BAZA_URL"]
body = [{"key": k, "scopes": ["functions"], "values": [{"context": "all", "value": os.environ[k]}]} for k in keys if os.environ.get(k)]
body.append({"key": "OTZYVY_SUHOY", "scopes": ["functions"], "values": [{"context": "all", "value": "1"}]})
print(json.dumps({"account_id": os.environ["ACC"], "site_id": os.environ["OTZYVY_SITE_ID"], "body": body}))
PY
)
  $NL api createEnvVars --data "$DATA" >/dev/null && echo "  готово; OTZYVY_SUHOY=1 — первая выкладка холостая"
  exit 0
fi

if [ "$1" = "klyuch" ]; then
  echo "→ ключ календаря в хранилище этого сайта (как у Веры: переменной он не влезает)"
  $NL blobs:set kalendar-klyuch sa --input "$HOME/bidna-klyuchi/vera-kalendar.json"
  exit 0
fi

echo "использование: $0 sekrety | sozdat | peremennye | klyuch"
