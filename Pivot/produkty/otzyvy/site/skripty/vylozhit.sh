#!/bin/bash
# Выкладка сайта «Сборщик отзывов». НЕ запускался. Правило проекта: одно окно выкатки в день,
# по слову Андрея. Сначала тесты — не прошли, дальше не идём. Выключатель после выкладки остаётся
# как был (по умолчанию — выключено): выкладка сама ничего не включает.
#   skripty/vylozhit.sh                      — выложить и проверить
#   skripty/vylozhit.sh rollback <deploy_id>
set -e
cd "$(dirname "$0")/.."
ENVF="$HOME/.bidna-otzyvy.env"
[ -f "$ENVF" ] || { echo "нет $ENVF (см. skripty/nastroit-odin-raz.sh)"; exit 1; }
set -a; . "$ENVF"; set +a
[ -n "$OTZYVY_SITE_ID" ] || { echo "нет OTZYVY_SITE_ID"; exit 1; }
export NETLIFY_SITE_ID="$OTZYVY_SITE_ID"     # корень проекта привязан к ДРУГОМУ сайту
NL="npx --yes netlify-cli"

if [ "$1" = "rollback" ]; then
  $NL api restoreSiteDeploy --data "{\"site_id\":\"$OTZYVY_SITE_ID\",\"deploy_id\":\"$2\"}"; exit 0
fi

echo "→ зависимости (node_modules в Drive не держим: тысячи файлов в синхронизации)"
trap 'rm -rf node_modules' EXIT
npm ci --no-audit --no-fund --silent
echo "→ тесты"
npm test --silent
echo "→ точка отката"
$NL api getSite --data "{\"site_id\":\"$OTZYVY_SITE_ID\"}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('  ОТКАТ:', (d.get('published_deploy') or {}).get('id'), '·', d.get('ssl_url'))"
echo "→ выкладываю"
$NL deploy --prod --site="$OTZYVY_SITE_ID" --dir=web --functions=netlify-functions --skip-functions-cache
URL=$($NL api getSite --data "{\"site_id\":\"$OTZYVY_SITE_ID\"}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["ssl_url"])')
echo "→ проверяю $URL"
printf '  %-34s %s\n' "/otpiska (кривая ссылка → 400)" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/otpiska?t=x")"
printf '  %-34s %s\n' "/k (кривая ссылка → 404)" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/k?t=x")"
printf '  %-34s %s\n' "zdorovie без ключа → 401" "$(curl -s -o /dev/null -w '%{http_code}' "$URL/.netlify/functions/zdorovie")"
echo "  здоровье:"
curl -s -H "x-otzyvy-admin: $OTZYVY_KLYUCH_ADMINA" "$URL/.netlify/functions/zdorovie" | sed 's/^/    /'
echo "Через 2 часа снова zdorovie: puls.planirovshchik.v_norme должен стать true — значит расписание подхватилось."
