"""Показать расшифровку прогона: python3 pokazat.py care-19 [N-й прогон, по умолчанию последний]"""
import json, os, sys
import progon as PG
sid = sys.argv[1]; n = int(sys.argv[2]) if len(sys.argv) > 2 else -1
tests = PG.zagruzit(PG.TESTY, {}); tid = tests.get(sid)
runs = []
for fn in sorted(os.listdir(PG.RAW)):
    inv = json.load(open(os.path.join(PG.RAW, fn)))
    for r in inv.get("test_runs", []):
        if r.get("test_id") == tid:
            runs.append((inv.get("created_at"), r))
runs.sort(key=lambda x: x[0] or 0)
r = runs[n][1]
print("====", sid, "прогон", n, "из", len(runs), "| оценщик:", (r.get("condition_result") or {}).get("result"), "| кредиты", r.get("credits_used"))
for m in r.get("agent_responses") or []:
    if m.get("message"):
        print(f"[{m['role']}] {m['message']}")
    for c in m.get("tool_calls") or []:
        print(f"     ВЫЗОВ {c.get('tool_name')} {c.get('params_as_json')}")
    for t in m.get("tool_results") or []:
        print(f"     ОТВЕТ {t.get('tool_name')} {(t.get('result_value') or '')[:220]} {'ОШИБКА' if t.get('is_error') else ''}")
