#!/bin/bash
# Зеркало рабочей папки «Our Business (Andrii & Masha)» в закрытый репозиторий GitHub для облачных сессий Claude Code.
# Решение Андрея 01.10.2026: «Да, переноси в репозиторий». Защита Claude не даёт главному агенту копировать папку
# в репозиторий самому (класс «Credential Leakage»), поэтому запускает Андрей:
#
#   1. На github.com/new создать ПУСТОЙ закрытый репозиторий bidna-business (без README, без .gitignore).
#   2. В Терминале:  bash "<эта папка>/shtab/github/zerkalo.sh" https://github.com/andy022765/bidna-business.git
#      Дальше — просто  bash ".../zerkalo.sh"  (адрес запомнен) перед каждой облачной сессией.
#
# Что делает: rsync папки Drive в зеркало ~/bidna-business-zerkalo (без секретов, медиа, node_modules — список ниже),
# git commit и push в main. Ключи не трогает: доступ к GitHub берётся из связки ключей Мака (git уже ходит в GitHub).
# Мастер — папка в Drive; зеркало — копия. Обратно (облако → Drive) переносит главный агент после проверки diff.
set -e
S="$(cd "$(dirname "$0")/../.." && pwd)"                     # корень рабочей папки в Drive
D="$HOME/bidna-business-zerkalo"                             # зеркало вне Drive (чтобы .git не уехал в облако Drive)
X="$S/shtab/github/zerkalo.exclude"
URL="$1"

[ -f "$X" ] || { echo "нет списка исключений $X"; exit 1; }
mkdir -p "$D"
echo "→ копирую Drive → зеркало (исключения: $X)"
rsync -a --delete --exclude-from="$X" "$S/" "$D/"
cd "$D"
if [ ! -d .git ]; then
  git init -q -b main 2>/dev/null || git init -q
  git config user.name "Andrii Zhyla"
  git config user.email "andywar777@gmail.com"
fi
cp "$X" .gitignore
cp "$S/shtab/github/README-GITHUB.md" README-GITHUB.md
# проверка, что опасного в зеркале нет
if find . -path ./.git -prune -o \( -name "Backup 2F*" -o -name "*.env" -o -name ".env*" -o -name node_modules \) -print | grep -q .; then
  echo "СТОП: в зеркале есть секреты/мусор, смотри find выше"; exit 1
fi
echo "→ размер зеркала: $(du -sh . | cut -f1), файлов: $(git ls-files 2>/dev/null | wc -l | tr -d ' ') (до коммита)"
git add -A
if git diff --cached --quiet; then echo "→ изменений нет"; else
  git commit -q -m "Зеркало рабочей папки из Google Drive, $(date '+%Y-%m-%d %H:%M')"
  echo "→ коммит: $(git log -1 --format='%h %s')"
fi
if [ -n "$URL" ]; then git remote remove origin 2>/dev/null || true; git remote add origin "$URL"; fi
git remote get-url origin >/dev/null 2>&1 || { echo "→ адрес репозитория не задан: запусти с адресом https://github.com/andy022765/bidna-business.git"; exit 0; }
echo "→ push в main ($(git remote get-url origin))"
git push -u origin main
echo "ГОТОВО: $(git remote get-url origin) · $(git log -1 --format=%h)"
