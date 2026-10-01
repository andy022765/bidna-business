#!/bin/bash
# Деплой businessinteldna.com. Пересобирает сайт и выкатывает вместе с функциями.
#   ./deploy.sh          — выкатить
#   ./deploy.sh rollback — вернуть предыдущий деплой
set -e
cd "$(dirname "$0")"
SITE=be8799b6-cccd-4dfd-9e12-a53e92590eb0
ST=/tmp/bidna-stage

if [ "$1" = "rollback" ]; then
  echo "Возвращаю деплой $2"
  npx --yes netlify-cli api restoreSiteDeploy --data "{\"site_id\":\"$SITE\",\"deploy_id\":\"$2\"}"
  exit 0
fi

echo "→ записываю точку отката"
npx --yes netlify-cli api getSite --data "{\"site_id\":\"$SITE\"}" \
  | python3 -c "import json,sys;print('ОТКАТ:', (json.load(sys.stdin).get('published_deploy') or {}).get('id'))"

echo "→ собираю сайт"
rm -rf "$ST" && mkdir -p "$ST"
python3 landings/_src/pravo_site.py
python3 landings/_src/list.py
python3 shtab/sayty/sborka.py >/dev/null
python3 landings/_src/merge_site.py "$ST"
# Код партнёра — последним шагом, по готовой папке: страницы делают четыре генератора,
# и вставлять в каждый значит однажды завести пятый и молча потерять партнёра.
python3 shtab/sayty/kod_partnera_vsyudu.py "$ST"

echo "→ выкатываю"
# 16.09 `deploy --prod` отдавал JSONHTTPError: Forbidden, и восемь дней мы выкатывали
# в два шага: черновик плюс публикация через restoreSiteDeploy. 24.09 проверено —
# запрет снят, --prod проходит. Пробуем прямой путь, а обходной оставляем запасным:
# запрет однажды появился сам и так же может вернуться.
# Разница не только в шаге: черновик писался в историю как context=deploy-preview,
# хотя уезжал на живой сайт, и по журналу выкаток это путало.
if npx --yes netlify-cli deploy --prod --site="$SITE" --dir="$ST" \
     --functions=netlify-functions --skip-functions-cache >/tmp/bidna-deploy.log 2>&1; then
  echo "  выкачено напрямую (--prod)"
else
  echo "  --prod не прошёл, иду в обход через черновик:"
  sed -n '1,3p' /tmp/bidna-deploy.log | sed 's/^/    /'
  OUT=$(npx --yes netlify-cli deploy --site="$SITE" --dir="$ST" \
    --functions=netlify-functions --skip-functions-cache 2>&1) || { echo "$OUT"; exit 1; }
  DID=$(echo "$OUT" | grep -o "https://[a-f0-9]*--" | head -1 | tr -d ':/htps-')
  [ -n "$DID" ] || { echo "$OUT"; echo "не нашёл id черновика"; exit 1; }
  echo "  черновик $DID → публикую"
  npx --yes netlify-cli api restoreSiteDeploy --data "{\"site_id\":\"$SITE\",\"deploy_id\":\"$DID\"}" >/dev/null
fi

echo "→ проверяю"
for u in / /business/list /expert/list /business/oplata /terms /privacy /sms /contacts /nda; do
  # -L: с 23.09 /business/oplata и /expert/oplata отдают 301 на новую диагностику.
  # Без него проверка показывала бы 301 и мы бы каждый раз гадали, поломка это или так задумано.
  printf '  %-22s %s\n' "$u" "$(curl -sL -o /dev/null -w '%{http_code}' "https://businessinteldna.com$u")"
done
printf '  %-22s %s\n' "функция list" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST https://businessinteldna.com/.netlify/functions/list -d '{}')"
