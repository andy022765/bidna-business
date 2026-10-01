#!/bin/bash
# Выкладка сайта «ответ на заявки». НЕ запускался. Правило проекта: одно окно выкатки в день,
# по слову Андрея. Сначала тесты живого пути — не прошли, дальше не идём.
# Выкладывается только web/ и функции из netlify-functions/ (ответ с ценами и ссылкой на Calendly).
# na-potom/ (своя запись, отложена 29.09) в выкладку не входит; её тесты — npm run test:na-potom.
#   skripty/vylozhit.sh          — выложить и проверить
#   skripty/vylozhit.sh rollback <deploy_id>
set -e
cd "$(dirname "$0")/.."
ENVF="$HOME/.bidna-otvet.env"
[ -f "$ENVF" ] || { echo "нет $ENVF (см. skripty/nastroit-odin-raz.sh)"; exit 1; }
set -a; . "$ENVF"; set +a
[ -n "$OTVET_SITE_ID" ] || { echo "нет OTVET_SITE_ID"; exit 1; }
export NETLIFY_SITE_ID="$OTVET_SITE_ID"     # корень проекта привязан к ДРУГОМУ сайту
NL="npx --yes netlify-cli"

if [ "$1" = "rollback" ]; then
  $NL api restoreSiteDeploy --data "{\"site_id\":\"$OTVET_SITE_ID\",\"deploy_id\":\"$2\"}"; exit 0
fi

echo "→ зависимости (node_modules в Drive не держим: 4 тыс. файлов в синхронизации)"
# Нужны только на время сборки функций; по выходу (и при сбое) убираем, иначе Drive их зальёт.
trap 'rm -rf node_modules' EXIT
npm ci --no-audit --no-fund --silent
echo "→ тесты (живой путь)"
npm test --silent
echo "→ точка отката"
$NL api getSite --data "{\"site_id\":\"$OTVET_SITE_ID\"}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('  ОТКАТ:', (d.get('published_deploy') or {}).get('id'), '·', d.get('ssl_url'))"
echo "→ выкладываю"
$NL deploy --prod --site="$OTVET_SITE_ID" --dir=web --functions=netlify-functions --skip-functions-cache
URL=$($NL api getSite --data "{\"site_id\":\"$OTVET_SITE_ID\"}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["ssl_url"])')
echo "→ проверяю $URL"
printf '  %-28s %s\n' "функции zapis нет → 404" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/.netlify/functions/zapis")"
printf '  %-28s %s\n' "zayavka без секрета → 202" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/.netlify/functions/zayavka-background" -d '{}')"
echo "  здоровье (ждём \"ok\": true; \"zapis\" — страница Calendly из паспорта):"
curl -s -H "x-otvet-secret: $OTVET_SECRET" "$URL/.netlify/functions/zdorovie" | sed 's/^/    /'
