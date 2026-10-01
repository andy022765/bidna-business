#!/bin/bash
# Обёртка для launchd. Он не читает профиль оболочки, поэтому ключи подставляем сами.
# Ключи живут ВНЕ проекта: папка синхронится в Google Drive.
set -a
[ -f "$HOME/.bidna-golos.env" ] && . "$HOME/.bidna-golos.env"
set +a
cd "$(dirname "$0")"
exec /usr/bin/env python3 storozh.py "$@"
