#!/bin/bash
# Автозапуск замера: вечер (19:00) 16, 17 и 22 сентября · утро (9:00) только 17 сентября. Время — Лос-Анджелес.
# Ставится в личные задания пользователя (~/Library/LaunchAgents), права администратора не нужны.
#
#   ./raspisanie.sh postavit   — обновить рабочую копию и поставить расписание
#   ./raspisanie.sh obnovit    — только обновить рабочую копию (программа + вопросы)
#   ./raspisanie.sh zabrat     — перенести ответы из рабочей копии в проект на Google Drive
#   ./raspisanie.sh status     — что стоит сейчас
#   ./raspisanie.sh proverit   — разовая проверка автозапуска (один дешёвый вопрос)
#   ./raspisanie.sh snyat      — снять расписание
#
# ПОЧЕМУ КОПИЯ. Системный планировщик macOS не имеет доступа к папке Google Drive
# («Operation not permitted»), поэтому программа, вопросы и ответы живут в ~/bidna-smotritel,
# а в проект ответы переносятся командой zabrat. Если Мак спит или выключен — слот пропускается.
set -eu
ZDES="$(cd "$(dirname "$0")" && pwd)"
AGENTY="$HOME/Library/LaunchAgents"
KOPIYA="$HOME/bidna-smotritel"
IMYA=com.bidna.smotritel
# Решение Андрея 16.09: дневной слот убран (в тот же день он повторяет утренний),
# вечерний идёт всегда — он совпадает по времени с ручным проходом Андрея и Маши,
# утренний остаётся только 17.09 — он показывает, насколько ответы плывут за день.
# Замер 16.09: за четыре часа совпадение источников 33–47%, поэтому сравнивать
# вечернюю ручную работу с утренней программой нельзя.
SLOTY="utro vecher"              # bash 3.2 на Маке не знает ассоциативных массивов
chas_slota() { case "$1" in utro) echo 9 ;; vecher) echo 19 ;; esac; }
dni_slota() { case "$1" in utro) echo 17 ;; vecher) echo "16 17 22" ;; esac; }

obnovit() {
  mkdir -p "$KOPIYA/progon" "$KOPIYA/kalibrovka"
  cp "$ZDES/progon.py" "$ZDES/zapusk.sh" "$KOPIYA/progon/"
  cp "$ZDES/../kalibrovka/voprosy.json" "$KOPIYA/kalibrovka/voprosy.json"
  chmod +x "$KOPIYA/progon/zapusk.sh"
  echo "рабочая копия обновлена: $KOPIYA"
}

zabrat() {
  if [ -d "$KOPIYA/zamer-v1/api" ]; then
    mkdir -p "$ZDES/../zamer-v1/api"
    rsync -a "$KOPIYA/zamer-v1/api/" "$ZDES/../zamer-v1/api/"
    echo "перенесено в проект, файлов ответов: $(find "$ZDES/../zamer-v1/api" -name '[A-Z]*.json' | wc -l | tr -d ' ')"
  else
    echo 'в рабочей копии ответов пока нет'
  fi
}

plist_zadaniya() {   # $1 — слот, $2 — час
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
  echo '<plist version="1.0"><dict>'
  echo "  <key>Label</key><string>$IMYA.$1</string>"
  echo '  <key>ProgramArguments</key><array>'
  echo "    <string>/bin/bash</string><string>$KOPIYA/progon/zapusk.sh</string><string>$1</string>"
  echo '  </array>'
  echo '  <key>StartCalendarInterval</key><array>'
  for d in $(dni_slota "$1"); do
    echo "    <dict><key>Month</key><integer>9</integer><key>Day</key><integer>$d</integer>"
    echo "    <key>Hour</key><integer>$2</integer><key>Minute</key><integer>0</integer></dict>"
  done
  echo '  </array>'
  echo "  <key>StandardOutPath</key><string>$KOPIYA/launchd.log</string>"
  echo "  <key>StandardErrorPath</key><string>$KOPIYA/launchd.log</string>"
  echo '  <key>RunAtLoad</key><false/>'
  echo '</dict></plist>'
}

postavit() {
  obnovit
  mkdir -p "$AGENTY"
  for slot in $SLOTY; do
    chas="$(chas_slota "$slot")"
    plist="$AGENTY/$IMYA.$slot.plist"
    plist_zadaniya "$slot" "$chas" > "$plist"
    launchctl bootout "gui/$UID/$IMYA.$slot" 2>/dev/null || true
    launchctl bootstrap "gui/$UID" "$plist"
    echo "поставлено: $slot в $chas:00, дни $(dni_slota "$slot") сентября"
  done
  date +'часовой пояс Мака сейчас: %Z (нужен PDT/PST). Время: %F %H:%M'
}

snyat() {
  for slot in $SLOTY; do
    launchctl bootout "gui/$UID/$IMYA.$slot" 2>/dev/null || true
    rm -f "$AGENTY/$IMYA.$slot.plist"
    echo "снято: $slot"
  done
}

status() {
  launchctl list | grep -i smotritel || echo 'заданий Смотрителя не стоит'
  ls -la "$AGENTY"/$IMYA.*.plist 2>/dev/null || true
}

proverit() {
  obnovit
  echo 'проверка: планировщик запускает один дешёвый вопрос (слот proba, только ChatGPT)'
  plist="$AGENTY/$IMYA.proverka.plist"
  {
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    echo '<plist version="1.0"><dict>'
    echo "  <key>Label</key><string>$IMYA.proverka</string>"
    echo '  <key>ProgramArguments</key><array>'
    echo '    <string>/bin/bash</string><string>-c</string>'
    echo "    <string>export SMOTRITEL_BAZA=$KOPIYA; /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 $KOPIYA/progon/progon.py --slot proba --tolko N12 --dvizhki openai</string>"
    echo '  </array>'
    echo "  <key>StandardOutPath</key><string>$KOPIYA/proverka.log</string>"
    echo "  <key>StandardErrorPath</key><string>$KOPIYA/proverka.log</string>"
    echo '  <key>RunAtLoad</key><false/>'
    echo '</dict></plist>'
  } > "$plist"
  : > "$KOPIYA/proverka.log"
  launchctl bootout "gui/$UID/$IMYA.proverka" 2>/dev/null || true
  launchctl bootstrap "gui/$UID" "$plist"
  launchctl kickstart -k "gui/$UID/$IMYA.proverka"
  for i in $(seq 1 30); do
    grep -q 'месяц' "$KOPIYA/proverka.log" 2>/dev/null && break
    sleep 2
  done
  launchctl bootout "gui/$UID/$IMYA.proverka" 2>/dev/null || true
  rm -f "$plist"
  echo '--- что записал планировщик:'
  cat "$KOPIYA/proverka.log" 2>/dev/null || echo 'журнал пуст'
}

case "${1:-}" in
  postavit) postavit ;;
  obnovit) obnovit ;;
  zabrat) zabrat ;;
  snyat) snyat ;;
  status) status ;;
  proverit) proverit ;;
  *) echo 'нужно одно слово: postavit, obnovit, zabrat, snyat, status или proverit'; exit 2 ;;
esac
