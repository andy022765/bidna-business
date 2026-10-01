#!/usr/bin/env python3
"""Подтянуть холостого тест-агента к текущему промпту и модели демо.
Инструмент у него ХОЛОСТОЙ (письма не уходят) — поэтому НЕ обновлять его через
sozdat_agenta.py: тот подставит боевые инструменты, и прогоны начнут слать письма.

  source ~/.bidna-golos.env && python3 proverka/sinhron.py
  node proverka/proverka.mjs <TEST_AGENT> "метка" chisto   # или gryaz
  node proverka/test_pismo.js "$PWD/site/netlify-functions/pismo.js"   # логика отправки на заглушках
"""
import json, os, pathlib, sys, requests
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))
import sozdat_agenta as S
TEST_AGENT = "agent_4601m2gp6y9je2ktkeykv30me35w"   # «ТЕСТ-холостой демо»
SUHOY_TOOL = "tool_6001m2gqpg26ea8vnrjq0536eejr"    # копия otpravit_ssylku с x-golos-suhoy: 1
K = os.environ["ELEVENLABS_API_KEY"]
body = {"name": "ТЕСТ-холостой демо", "conversation_config": {"agent": {"prompt": {
    "prompt": S.sobrat_prompt("demo"), "llm": S.LLM, "max_tokens": 600, "thinking_budget": 0,
    "tool_ids": [SUHOY_TOOL, "tool_0301m2bwhxs8fnqs5asp5yzyt35w"]}}}}
r = requests.patch(f"{S.API}/{TEST_AGENT}", headers={"xi-api-key": K}, json=body, timeout=60)
print(r.status_code, r.text[:200] if not r.ok else "холостой агент обновлён")
