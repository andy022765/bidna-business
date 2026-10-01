#!/bin/bash
# Проверка маленького пакета ЗВОНКАМИ, сразу после выкатки на стенд.
# Два вопроса, на которые тесты ответить не могут: уйдёт ли письмо-подтверждение
# записи, если сегодня на этот адрес уже уходило письмо, и не прозвучит ли русское
# слово на английской линии при отказе домена.
#     bash Pivot/golos/dozvonshchik/proverit-paket.sh
set -e
cd "$(dirname "$0")"
set -a; . ~/.bidna-golos.env 2>/dev/null; set +a

echo "→ три звонка: материалы → запись тем же адресом → мёртвый домен"
python3 dozvonshchik.py --komu +14247244202 --ot +14242756121 \
  --tolko dedup-01-materialy,dedup-02-zapis,pochta-mertvaya-01

echo
echo "→ письма за последний час"
curl -s -H "Authorization: Bearer $RESEND_API_KEY" "https://api.resend.com/emails?limit=8" \
 | python3 -c "
import json,sys
for e in (json.load(sys.stdin).get('data') or [])[:8]:
    print('  %s | %-34s | %s' % (e.get('created_at','')[11:19], ','.join(e.get('to') or []), (e.get('subject') or '')[:60]))"

echo
echo "→ русские слова в том, что видела английская Вера"
python3 - <<'PY'
import os, json, subprocess, re
k = os.environ["ELEVENLABS_API_KEY"]
def get(u):
    return json.loads(subprocess.run(["curl","-s","-H","xi-api-key: "+k,u],
                                     capture_output=True, text=True).stdout)
d = get("https://api.elevenlabs.io/v1/convai/conversations"
        "?agent_id=agent_6801m3cz595hesgr7cxent1vse6r&page_size=4")
plohih = 0
for c in d.get("conversations", []):
    r = get("https://api.elevenlabs.io/v1/convai/conversations/" + c["conversation_id"])
    kir = []
    for t in r.get("transcript", []):
        for tr in (t.get("tool_results") or []):
            s = json.dumps(tr.get("result_value"), ensure_ascii=False)
            kir += re.findall(r"[А-Яа-яЁё][А-Яа-яЁё ,.:—-]{6,60}", s)
        s2 = (t.get("message") or "")
        kir += re.findall(r"[А-Яа-яЁё][А-Яа-яЁё ,.:—-]{6,60}", s2)
    print("  %s · %s" % (c["conversation_id"], "ЧИСТО" if not kir else "КИРИЛЛИЦА: " + " | ".join(kir[:3])))
    plohih += len(kir)
print("  итог:", "ноль русских слов" if not plohih else "НАЙДЕНО %d — чинить" % plohih)
PY

echo
echo "→ НЕ ЗАБЫТЬ: убрать тестовую встречу из календаря и доложить «календарь пуст»"
