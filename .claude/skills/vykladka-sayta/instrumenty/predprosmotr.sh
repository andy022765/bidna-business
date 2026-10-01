#!/bin/bash
# Предпросмотр bidna-predprosmotr (ce6c543c…): копия stage, ЗАКРЫТАЯ от индексации. Запускать из корня проекта.
#   bash .claude/skills/vykladka-sayta/instrumenty/predprosmotr.sh <stage> <папка-копии>             — примерка:
#        готовит копию, проверяет замки, печатает команду; НИЧЕГО не выкладывает, кредиты не тратит
#   bash .claude/skills/vykladka-sayta/instrumenty/predprosmotr.sh <stage> <папка-копии> --vylozhit  — выкладка
#        предпросмотра: тратит кредиты Netlify, только в окне и после «да» Андрея на окно.
# Зачем скрипт: голая команда `deploy --prod --site=…` с перепутанным id выложила бы закрытую копию на ЖИВОЙ
# в обход deploy.sh, и боевой домен выпал бы из поиска. Id предпросмотра зашит, id боевого — стоп.
# Функции едут как в deploy.sh, но на предпросмотре 0 переменных: функции там не работают, формы — да (с 25.09).
set -euo pipefail
PREV=ce6c543c-6565-4ecd-8924-0809103af909
BOY=be8799b6-cccd-4dfd-9e12-a53e92590eb0
ST=${1:?нужно: <stage> <папка-копии> [--vylozhit]}
KOP=${2:?нужно: <stage> <папка-копии> [--vylozhit]}
REZHIM=${3:-}
[ "$PREV" != "$BOY" ] || { echo "СТОП: id предпросмотра совпал с боевым"; exit 1; }
[ -f deploy.sh ] && [ -d netlify-functions ] || { echo "СТОП: запускай из корня проекта"; exit 1; }
[ -f "$ST/index.html" ] && [ -f "$ST/_redirects" ] || { echo "СТОП: $ST не похож на stage (нет index.html/_redirects)"; exit 1; }
N=$(find "$ST" -type f | wc -l | tr -d ' ')
[ "$N" -ge 90 ] || { echo "СТОП: в stage $N файлов — это не полный конвейер (26.09: 48 из 99 → / отдавал 404)"; exit 1; }
case "$KOP" in /tmp/*|/private/tmp/*) ;; *) echo "СТОП: копию держи во временной папке, не в Drive"; exit 1;; esac

rm -rf "$KOP"; cp -R "$ST" "$KOP"
printf 'User-agent: *\nDisallow: /\n' > "$KOP/robots.txt"
rm -f "$KOP/sitemap.xml"
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' >> "$KOP/_headers"

grep -qx 'Disallow: /' "$KOP/robots.txt" || { echo "СТОП: robots не закрыт"; exit 1; }
[ ! -e "$KOP/sitemap.xml" ] || { echo "СТОП: sitemap.xml остался"; exit 1; }
grep -q 'X-Robots-Tag: noindex' "$KOP/_headers" || { echo "СТОП: нет X-Robots-Tag"; exit 1; }
echo "копия готова: $KOP, файлов $(find "$KOP" -type f | wc -l | tr -d ' '); robots Disallow, sitemap убран, X-Robots-Tag noindex"

CMD=(npx --yes netlify-cli deploy --prod --site="$PREV" --dir="$KOP"
     --functions=netlify-functions --skip-functions-cache --message "ПРЕДПРОСМОТР $(date '+%d.%m %H:%M')" --json)
if [ "$REZHIM" != "--vylozhit" ]; then
  echo "ПРИМЕРКА. Выкладка предпросмотра (тратит кредиты) — тот же вызов с --vylozhit:"
  echo "  ${CMD[*]}"
  exit 0
fi
case " ${CMD[*]} " in *"$BOY"*) echo "СТОП: в команде id боевого сайта"; exit 1;; esac
"${CMD[@]}" > "$KOP.deploy.json"
python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print('предпросмотр:',d.get('deploy_id'),d.get('deploy_url') or d.get('url'))" "$KOP.deploy.json"
echo "проверь: curl -s https://bidna-predprosmotr.netlify.app/robots.txt  → Disallow: /"
