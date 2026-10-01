#!/bin/bash
# Прогон ВСЕХ проверок разом, с правильными аргументами.
# Заведён 26.09.2026: половина тестов берёт путь к функции из argv[2], и запуск без него
# падает с ERR_INVALID_ARG_TYPE. Это выглядит как «девять провалов», хотя не проверено
# вообще ничего — на этом я попался дважды за один вечер.
#     bash Pivot/golos/proverka/vse.sh
cd "$(dirname "$0")" || exit 2
F="../site/netlify-functions"; R="../../../netlify-functions"
PARY=(
 "test_pismo.js|$F/pismo.js"
 "test_pismo_en.js|$F/pismo.js"
 "test_pismo_priemka.js|$F/pismo.js"
 "test_pismo_povod.js|"
 "test_pismo_zapis.js|"
 "test_kalendar.js|"
 "test_kalendar_google.js|"
 "test_kalendar_vremya_nomer.js|"
 "test_kalendar_metka.js|"
 "test_sostoyanie_minuty.js|"
 "test_perevod.js|"
 "test_perevod_ru.js|"
 "test_mesta_en.js|$F/mesta.js"
 "test_otskok.js|$F/otskok.js"
 "test_zdorovie.js|"
 "test_zvonok_ishodyashchiy.js|"
 "test_zvonok_vhod.js|"
 "test_proverka_klyuch.js|"
 "test_boty.js|$R/boty.js"
 "test_razbor.js|$R/razbor-background.js"
 "test_formy.js|$R/submission-created.js"
 "test_referal_kod.mjs|"
 "test_referal_stripe.js|"
)
# Ни один тест не должен потеряться молча: список сверяется с папкой.
NA_DISKE=$(ls test_*.js test_*.mjs 2>/dev/null | sort)
V_SPISKE=$(printf '%s\n' "${PARY[@]}" | cut -d'|' -f1 | sort)
if [ "$NA_DISKE" != "$V_SPISKE" ]; then
  echo "  СПИСОК РАЗОШЁЛСЯ С ПАПКОЙ — допишите новый тест в vse.sh:"
  diff <(echo "$V_SPISKE") <(echo "$NA_DISKE") | sed 's/^/    /'
  exit 2
fi
plohih=0
for para in "${PARY[@]}"; do
  t="${para%%|*}"; arg="${para##*|}"
  printf "  %-32s " "$t"
  if [ -n "$arg" ]; then node "$t" "$arg" >/tmp/proverka.log 2>&1
  else node "$t" >/tmp/proverka.log 2>&1; fi
  if [ $? -eq 0 ]; then echo "ок"; else echo "ПРОВАЛ"; plohih=$((plohih+1)); tail -6 /tmp/proverka.log | sed 's/^/      /'; fi
done
echo "  ── прогнано ${#PARY[@]} · провалов $plohih"
exit $((plohih ? 1 : 0))
