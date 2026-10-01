#!/usr/bin/env python3
"""
Замер русского TTS: кто быстрее и кто звучит по-русски, а не с акцентом.

Меряем ровно то, что решает в звонке — TTFB (сколько миллисекунд до ПЕРВОГО
байта звука), а не общее время генерации. В разговоре человек слышит начало,
остальное досинтезируется на лету.

  python3 zamer_tts.py --golosa          # показать русские голоса у каждого вендора
  python3 zamer_tts.py                   # прогнать все реплики через выбранные голоса
  python3 zamer_tts.py --repliki 01,07   # только эти реплики

Ключи берутся из окружения: ELEVENLABS_API_KEY, CARTESIA_API_KEY, OPENAI_API_KEY.
Вендор без ключа молча пропускается — скрипт скажет, кого не хватает.
"""
import argparse, json, os, pathlib, sys, time

import requests

BASE = pathlib.Path(__file__).parent
AUDIO = BASE / "audio"
AUDIO.mkdir(exist_ok=True)

EL_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
CA_KEY = os.environ.get("CARTESIA_API_KEY", "")
OA_KEY = os.environ.get("OPENAI_API_KEY", "")
CA_VER = os.environ.get("CARTESIA_VERSION", "2024-11-13")

# Голоса под замер. Пустой список = взять автоматически из --golosa.
# Заполняется руками после того, как послушали, что вообще есть.
GOLOSA = BASE / "golosa.json"


# ---------------------------------------------------------------- разведка голосов
def el_golosa():
    """Свои голоса + библиотека ElevenLabs с фильтром по русскому."""
    out = []
    h = {"xi-api-key": EL_KEY}
    try:
        r = requests.get("https://api.elevenlabs.io/v1/voices", headers=h, timeout=30)
        r.raise_for_status()
        for v in r.json().get("voices", []):
            out.append({"vendor": "elevenlabs", "id": v["voice_id"], "name": v.get("name", ""),
                        "otkuda": "свои", "opisanie": (v.get("labels") or {})})
    except Exception as e:
        print(f"  ! свои голоса ElevenLabs: {e}")
    try:
        r = requests.get("https://api.elevenlabs.io/v1/shared-voices",
                         headers=h, params={"page_size": 30, "language": "ru"}, timeout=30)
        r.raise_for_status()
        for v in r.json().get("voices", []):
            out.append({"vendor": "elevenlabs", "id": v.get("voice_id"), "name": v.get("name", ""),
                        "otkuda": "библиотека ru",
                        "opisanie": {"accent": v.get("accent"), "age": v.get("age"),
                                     "gender": v.get("gender"), "descriptive": v.get("descriptive")}})
    except Exception as e:
        print(f"  ! библиотека ElevenLabs: {e}")
    return out


def ca_golosa():
    out = []
    h = {"X-API-Key": CA_KEY, "Cartesia-Version": CA_VER}
    try:
        r = requests.get("https://api.cartesia.ai/voices/", headers=h,
                         params={"limit": 100}, timeout=30)
        r.raise_for_status()
        data = r.json()
        items = data.get("data", data) if isinstance(data, dict) else data
        for v in items:
            if (v.get("language") or "").lower().startswith("ru"):
                out.append({"vendor": "cartesia", "id": v.get("id"), "name": v.get("name", ""),
                            "otkuda": "ru", "opisanie": {"desc": (v.get("description") or "")[:70]}})
    except Exception as e:
        print(f"  ! голоса Cartesia: {e}")
    return out


def oa_golosa():
    # У OpenAI набор фиксированный, русский тянут все — вопрос только в акценте.
    return [{"vendor": "openai", "id": v, "name": v, "otkuda": "фикс", "opisanie": {}}
            for v in ["alloy", "ash", "ballad", "coral", "nova", "sage", "shimmer", "verse"]]


# ---------------------------------------------------------------- синтез + замер
def synth_el(voice_id, text, model="eleven_flash_v2_5"):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream"
    return requests.post(url, headers={"xi-api-key": EL_KEY, "Content-Type": "application/json"},
                         params={"output_format": "mp3_44100_128"},
                         json={"text": text, "model_id": model,
                               "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                                                  "speed": 1.0}},
                         stream=True, timeout=60)


def synth_ca(voice_id, text, model="sonic-3"):
    return requests.post("https://api.cartesia.ai/tts/bytes",
                         headers={"X-API-Key": CA_KEY, "Cartesia-Version": CA_VER,
                                  "Content-Type": "application/json"},
                         json={"model_id": model, "transcript": text, "language": "ru",
                               "voice": {"mode": "id", "id": voice_id},
                               "output_format": {"container": "mp3", "sample_rate": 44100,
                                                 "bit_rate": 128000}},
                         stream=True, timeout=60)


def synth_oa(voice_id, text, model="gpt-4o-mini-tts"):
    return requests.post("https://api.openai.com/v1/audio/speech",
                         headers={"Authorization": f"Bearer {OA_KEY}",
                                  "Content-Type": "application/json"},
                         json={"model": model, "voice": voice_id, "input": text,
                               "response_format": "mp3"},
                         stream=True, timeout=60)


SYNTH = {"elevenlabs": synth_el, "cartesia": synth_ca, "openai": synth_oa}


def zamer(golos, replika):
    """Один прогон: возвращает (ttfb_ms, total_ms, путь_к_файлу, ошибка)."""
    fn = SYNTH[golos["vendor"]]
    t0 = time.perf_counter()
    try:
        r = fn(golos["id"], replika["text"])
    except Exception as e:
        return None, None, None, f"сеть: {e}"
    if r.status_code != 200:
        body = r.text[:200].replace("\n", " ")
        return None, None, None, f"HTTP {r.status_code}: {body}"

    ttfb = None
    chunks = []
    for ch in r.iter_content(chunk_size=1024):
        if not ch:
            continue
        if ttfb is None:
            ttfb = (time.perf_counter() - t0) * 1000
        chunks.append(ch)
    total = (time.perf_counter() - t0) * 1000
    if not chunks:
        return None, None, None, "пустой ответ"

    safe = "".join(c if c.isalnum() or c in "-_" else "-" for c in golos["name"])[:24]
    path = AUDIO / f"{golos['vendor']}__{safe}__{replika['id']}.mp3"
    path.write_bytes(b"".join(chunks))
    return ttfb, total, path, None


# ---------------------------------------------------------------- запуск
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golosa", action="store_true", help="показать доступные русские голоса")
    ap.add_argument("--repliki", default="", help="через запятую: 01,07,10")
    args = ap.parse_args()

    est = {"elevenlabs": bool(EL_KEY), "cartesia": bool(CA_KEY), "openai": bool(OA_KEY)}
    net = [k for k, v in est.items() if not v]
    if net:
        print(f"нет ключа: {', '.join(net)} — эти вендоры пропускаю\n")
    if not any(est.values()):
        print("Ни одного ключа. Положи в окружение ELEVENLABS_API_KEY / CARTESIA_API_KEY / OPENAI_API_KEY.")
        sys.exit(1)

    if args.golosa:
        found = []
        if est["elevenlabs"]:
            print("ElevenLabs:"); found += el_golosa()
        if est["cartesia"]:
            print("Cartesia:");   found += ca_golosa()
        if est["openai"]:
            found += oa_golosa()
        for g in found:
            print(f"  [{g['vendor']:11}] {g['id']:26} {g['name'][:28]:30} {g['otkuda']:14} {g['opisanie']}")
        GOLOSA.write_text(json.dumps(found, ensure_ascii=False, indent=2))
        print(f"\n{len(found)} голосов → {GOLOSA.name}")
        print("Отредактируй файл: оставь 4-6 кандидатов, потом запусти без --golosa.")
        return

    if not GOLOSA.exists():
        print("Сначала: python3 zamer_tts.py --golosa"); sys.exit(1)
    golosa = [g for g in json.loads(GOLOSA.read_text()) if est.get(g["vendor"])]

    repliki = json.loads((BASE / "repliki.json").read_text())["repliki"]
    if args.repliki:
        keep = {x.strip() for x in args.repliki.split(",")}
        repliki = [r for r in repliki if r["id"].split("-")[0] in keep or r["id"] in keep]

    print(f"{len(golosa)} голосов × {len(repliki)} реплик = {len(golosa)*len(repliki)} прогонов\n")
    rows = []
    for g in golosa:
        ttfbs = []
        for rep in repliki:
            ttfb, total, path, err = zamer(g, rep)
            if err:
                print(f"  ✕ {g['vendor']:11} {g['name'][:20]:22} {rep['id']:22} {err}")
                continue
            ttfbs.append(ttfb)
            print(f"  ✓ {g['vendor']:11} {g['name'][:20]:22} {rep['id']:22} "
                  f"TTFB {ttfb:6.0f} мс   всего {total:6.0f} мс   {path.name}")
        if ttfbs:
            ttfbs.sort()
            rows.append((g, ttfbs[len(ttfbs)//2], min(ttfbs), max(ttfbs), len(ttfbs)))

    rows.sort(key=lambda x: x[1])
    out = ["# Замер русского TTS", "",
           "TTFB — время до первого байта звука. Это то, что слышит человек в трубке.", "",
           "| Вендор | Голос | TTFB p50 | мин | макс | прогонов |",
           "|---|---|---|---|---|---|"]
    for g, p50, lo, hi, n in rows:
        out.append(f"| {g['vendor']} | {g['name']} | **{p50:.0f} мс** | {lo:.0f} | {hi:.0f} | {n} |")
    out += ["", "Файлы в `audio/`. **Слушать ушами** — цифры не говорят про акцент.",
            "Ключевой файл у каждого голоса: `*__07-rusenglish.mp3` (английские слова внутри русской фразы)."]
    (BASE / "ZAMER.md").write_text("\n".join(out) + "\n")
    print("\n" + "\n".join(out))


if __name__ == "__main__":
    main()
