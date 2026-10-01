#!/bin/bash
# ОДИН РАЗ перед первой выкладкой. НЕ запускался. Ничего не шлёт и ничего не выкладывает.
#
# Секреты берутся из ~/.bidna-otvet.env (вне Google Drive), формат KEY=VALUE:
#   OTVET_SITE_ID=<id сайта>                 — после шага 1
#   OTVET_SECRET=<openssl rand -hex 24>      — тот же уйдёт на основной сайт
#   RESEND_API_KEY=re_...                    — лучше отдельный ключ «Sending access» на домен
#   EV_BLOBS_TOKEN=<Netlify personal access token> — без него Blobs из функции не поднимаются
#
# OTVET_SUHOY НЕ ставим (29.09): холостой первой выкладки нет — пока основной сайт не подключён,
# функция отвечает только на наши пробные вызовы с OTVET_SECRET. «Стоп» = OTVET_SUHOY=1 руками и выкладка.
#
# Календарных переменных и ключа календаря НЕТ: запись — в Calendly по ссылке из паспорта
# (решение Андрея 29.09). Для своей записи (na-potom/) они описаны в na-potom/CHITAT.md.
#
# ГРАБЛИ (из памяти проекта):
#  • `netlify` берёт привязку из КОРНЯ проекта (.netlify/state.json = business-dna-expert!). Поэтому
#    везде NETLIFY_SITE_ID и --site с ИДЕНТИФИКАТОРОМ, не именем (имя CLI не принимает).
#  • env:set печатает значение в вывод — секреты задаём через api с выводом в /dev/null.
#  • переменные подхватываются только выкладкой.
set -e
cd "$(dirname "$0")/.."
ENVF="$HOME/.bidna-otvet.env"
NL="npx --yes netlify-cli"

if [ "$1" = "sozdat" ]; then
  echo "→ шаг 1: создаю сайт (имя с хвостом, чтобы не угадывали)"
  $NL sites:create --name "otvet-$(openssl rand -hex 3)" --disable-linking
  echo "Запиши site_id в $ENVF как OTVET_SITE_ID и запусти: $0 peremennye"
  exit 0
fi

[ -f "$ENVF" ] || { echo "нет $ENVF"; exit 1; }
set -a; . "$ENVF"; set +a
[ -n "$OTVET_SITE_ID" ] || { echo "нет OTVET_SITE_ID"; exit 1; }
export NETLIFY_SITE_ID="$OTVET_SITE_ID"

if [ "$1" = "peremennye" ]; then
  echo "→ шаг 2: переменные сайта (значения в вывод не печатаются)"
  ACC=$($NL api getSite --data "{\"site_id\":\"$OTVET_SITE_ID\"}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["account_id"])')
  export ACC
  DATA=$(python3 - <<'PY'
import os, json
keys = ["OTVET_SECRET","RESEND_API_KEY","EV_BLOBS_TOKEN"]
body = [{"key": k, "scopes": ["functions"], "values": [{"context": "all", "value": os.environ[k]}]} for k in keys if os.environ.get(k)]
print(json.dumps({"account_id": os.environ["ACC"], "site_id": os.environ["OTVET_SITE_ID"], "body": body}))
PY
)
  $NL api createEnvVars --data "$DATA" >/dev/null && echo "  готово; холостого режима нет: до окна 2 сайт отвечает только на пробные заявки с секретом"
  exit 0
fi

# Шаг «klyuch» (ключ календаря в Blobs) снят 29.09 вместе со своей записью — см. na-potom/CHITAT.md.
echo "использование: $0 sozdat | peremennye"
