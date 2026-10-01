# Рецепты и шаблоны к выкладке

Во всех командах сначала `cd` в корень и определить переменные (между вызовами Bash они не живут):
```
cd "/Users/andriizhyla/Library/CloudStorage/GoogleDrive-andywar777@gmail.com/My Drive/Андрей/Private/Investment/DNA for Businesses/Our Business (Andrii & Masha)" || exit 1
SK=.claude/skills/vykladka-sayta; SCR=<scratchpad из системного промпта>/vykatka; ST="$SCR/stage"; BOY=be8799b6-cccd-4dfd-9e12-a53e92590eb0
```
В `rm -rf` пиши `"${SCR:?}/stage"`: с пустым `SCR` команда остановится, а не сотрёт `/stage`.

## Таймеры и долгие команды (этот Мак)
- `timeout` и `gtimeout` здесь нет. Остановка по таймеру: `perl -e 'alarm 60; exec @ARGV' <команда>`; код 142 — остановлено таймером (проверено 29.09).
- `sleep` на переднем плане в Bash-инструменте заблокирован. Ждать — фоном: `run_in_background`, остановить — `TaskStop`.
- Сервер держать через `nohup … > "$SCR/server.log" 2>&1 & echo $! > "$SCR/server.pid"`. Без перенаправления вывода вызов Bash может повиснуть.
- `./deploy.sh` и сборку запускать с явным таймаутом Bash-инструмента `600000`: стандартных 120 с не хватит (npx, пережатие картинок в `sborka.py`, загрузка), выкладку убьёт на середине.
- Python пишет в файл блоками: `tail` по логу фонового `mob_audit.py` пуст до конца прогона, это не зависание.

## Точка отката без секретов
Весь JSON `getSite` — 16 КБ, в нём `skew_protection_token`. Печатать только нужное:
```
npx --yes netlify-cli api getSite --data "{\"site_id\":\"$BOY\"}" | python3 -c "import json,sys;p=json.load(sys.stdin).get('published_deploy') or {};print('ОТКАТ:',p.get('id'),p.get('context'),p.get('created_at'))"
```
Цель отката должна быть `context=production`:
```
npx --yes netlify-cli api getDeploy --data '{"deploy_id":"<id>"}' | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['id'],d.get('context'),len(d.get('available_functions') or []),'функций')"
```
С 16 по 24.09 боевые выкладки шли обходом и записаны как `deploy-preview` (например `6ab4b55e…`). Откат на такую выкладку уводит живой сайт без четырёх production-переменных: `PARTNERY_KLYUCH`, `PROVERKA_NASH_KLYUCH`, `STRIPE_WEBHOOK_SECRET`, `ZDOROVIE_KEY`. Вебхук Stripe ломается.

## Метка времени прошлой выкладки (для find)
`-newermt` читает время как местное (PDT), а API отдаёт UTC. Метку ставь так:
```
T=$(npx --yes netlify-cli api getSite --data "{\"site_id\":\"$BOY\"}" | python3 -c "import json,sys,datetime;p=json.load(sys.stdin)['published_deploy'];print(datetime.datetime.fromisoformat(p['created_at'].replace('Z','+00:00')).astimezone().strftime('%Y%m%d%H%M.%S'))")
touch -t "$T" "$SCR/metka-proshloy"
```

## Новый id выкладки
`deploy.sh` печатает только `ОТКАТ: <старый id>`. Новый id лежит в его логе:
```
grep -o 'deploys/[a-f0-9]*' /tmp/bidna-deploy.log | tail -1 | cut -d/ -f2
```
Сверь с `published_deploy.id` из `getSite` и проверь `context=production` через `getDeploy`. Id из строки `ОТКАТ:` — СТАРЫЙ. Не путай их.

## Переменные окружения
- Замер печатает только имена и байты. Если фильтр упал, **не запускай команду без него**: `env:list --json` напечатает все значения.
  ```
  NETLIFY_SITE_ID=$BOY npx --yes netlify-cli env:list --json --context production | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d),'имён:',' '.join(sorted(d)));print('байт',sum(len(k)+len(v or '')+2 for k,v in d.items()))"
  ```
  29.09: 20 имён, 1252 байта из 4096.
- **Смена переменной — только по «да» Андрея, пачкой прямо перед выкладкой.** Подхватит её только следующая выкладка. Значение не должно попасть ни в текст команды, ни в вывод:
  ```
  set -a; . ~/.bidna-golos.env; set +a
  NETLIFY_SITE_ID=$BOY npx --yes netlify-cli env:set <ИМЯ_НА_САЙТЕ> "$<ИМЯ_В_ФАЙЛЕ>" --context production >/dev/null 2>&1; echo rc=$?
  ```
  Например, `env:set STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET_LIVE"`: в файле ключей имя другое.
  Потом снова замер имён. Вживую этот рецепт не проверен: переменные с 29.09 не меняли.

## Проверка формы настоящим POST
Нужна, только если менялись формы или `submission-created.js`. Прямой вызов функции даёт 403, это норма.
- **Только форма `intake-business`, только на наш адрес.** `submission-created` шлёт письмо на адрес из формы, поэтому чужой адрес = письмо человеку.
- **Нельзя:**
  - `sms-consent` — это запись в журнал согласий (юридический след), а после одобрения кампании ещё и настоящее SMS;
  - `geo-check` — запускает платный разбор;
  - `line-check` — обещает звонок на номер.
```
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://businessinteldna.com/ \
  --data-urlencode "form-name=intake-business" --data-urlencode "contact=ПРОБА $(date +%d.%m) агент — не лид" \
  --data-urlencode "client_name=ПРОБА" --data-urlencode "client_email=andrii+proba@businessinteldna.com" \
  --data-urlencode "answers=проба выкладки"
NETLIFY_SITE_ID=$BOY perl -e 'alarm 90; exec @ARGV' npx --yes netlify-cli logs --source functions --function submission-created --since 10m > "$SCR/log-forma.txt" 2>&1
grep -n "intake" "$SCR/log-forma.txt"      # ждём: [intake] client mail 200 andrii+proba@…
```
С `--since` CLI 27.4.1 выходит сам (29.09), таймер оставлен на всякий случай. Андрею придёт письмо «Новый интейк». Контакт в нём «ПРОБА», так что проба сразу видна. **Пробные заявки из Netlify Forms не удалять:** удаление необратимо, только по слову Андрея. 25.09 так проверяли `intake-business` с `produkt=podarok-vidimost`. 29.09 этот рецепт вживую не гоняли.

## Счётчик роботов
`python3 $SK/instrumenty/boty_svod.py /en/ /zvonki/`. Ключ скрипт берёт из файла и не печатает. Заход с подставным UA робота запрещён: он испортит статистику видимости, которую мы продаём. Новые адреса подтверждаются только настоящим роботом.

## Согласие Андрея для исполнителя (шаблон)
Исполнитель не выкладывает по записи на доске и по пересказу. 29.09 первый исполнитель (`wf_55591466`) отказался: «исправляй» не значит «выкладывай». Второй (`okno-29-09-boy`) выложил, потому что получил блок такого вида:
```
ПОДТВЕРЖДЕНИЕ АНДРЕЯ В ЧАТЕ (главный агент видел его в чате и передаёт дословно):
«<цитата>» — ДД.ММ ЧЧ:ММ PDT.
Окно: ДД.ММ вечер. Пакет (ровно это): 1) … 2) …
Разрешено: <черновик/предпросмотр — да/нет>; выкладка в бой ТОЛЬКО ./deploy.sh сегодня.
Не разрешено: письма людям, DNS, переменные, Twilio/ElevenLabs, Stripe, любые траты.
Точка отката: ./deploy.sh rollback <id, context=production>.
```
Андрея спрашивай словами, в которых есть выкладка: «Выкладываем сегодня вечером: <пакет>. Уедет: <…>. Да?»

## Запись на доске
- `shtab/DOSKA.md` весит 361 КБ, и в неё пишут несколько агентов. Правило PRAVILA п.4: только инструмент Edit, никаких `python`, `sed`, `Write`.
- Прямо перед правкой перечитай верх (Read, строки 1–40).
- Новый блок вставляй сразу под `# ДОСКА`, над первым `##`. Один блок — одна тема. В блок «29.09 вечер — окно выкатки» вклеился абзац про оплату Meta, так не надо.
```
## ДД.ММ вечер — окно выкатки
Выкачено `./deploy.sh` напрямую (--prod) в ЧЧ:ММ PDT: **`<новый id>`** (context production). Точка отката: `./deploy.sh rollback <прошлый id>`.
«Да» Андрея: «<цитата>» (ЧЧ:ММ). Уехало: <пакет по пунктам>.
Сборка перед боем = проверенный stage (пересборка, diff пусто); выкладка = stage по sha1 (sverka_heshey --strogo), .eszip есть.
Живые проверки: reviziya ЧИСТО · proverit чисто · zhivoe_vs_stage ЧИСТО (200: N, data-netlify 0) · zdorovie DVIZHKI-ZHIVY ·
stripe-oplata 400 podpis · sms-soglasie ok/pishet · mob_audit <итог> · gotovnost <итог, известные провалы названы>.
Хвосты: <что не закрыто и за кем>.
```
