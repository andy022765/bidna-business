#!/usr/bin/env python3
"""Текстовые прогоны CareLine DEMO через ElevenLabs Agent Testing (симуляция + подмена ответов инструментов).

  python3 progon.py --tolko care-01,care-21 --raz 1        прогнать выбранные сценарии
  python3 progon.py --kritichnye --raz 3                   все критичные по 3 раза
  python3 progon.py --pereschitat                          пересчитать вердикты по сохранённым сырым прогонам

Вердикт — по тексту и вызовам САМОГО агента (проверки proverki из scenarii.json), оценщик ElevenLabs — вторым мнением.
Часы: тесты гоняются с agent_config_override = та же сборка, что у агента (sborka_agentov.konfig), но БЕЗ prompt.timezone:
иначе платформа подставляет в промпт реальное время рядом с подменённым system__time и агент путает день (проверено 30.09).
Потолок контракта — 150 прогонов на весь №44: счётчик в progony/schetchik.json, превышение — отказ до запуска.
"""
import json, os, re, sys, time, unicodedata

TUT = os.path.dirname(os.path.abspath(__file__))
CARE = os.path.dirname(TUT)
sys.path.insert(0, CARE)
import sborka_agentov as SB  # noqa: E402

SCEN = os.path.join(CARE, "scenarii", "scenarii.json")
EL = os.path.join(CARE, "elevenlabs.json")
RAW = os.path.join(TUT, "raw")
TESTY = os.path.join(TUT, "testy.json")
SCHET = os.path.join(TUT, "schetchik.json")
REZ = os.path.join(TUT, "rezultaty.json")
POTOLOK = 150
MODEL_SIM = "gemini-2.5-flash"

# ---------------------------------------------------------------- подмены ответов инструментов
def J(x):
    return json.dumps(x, ensure_ascii=False)


SLOTY = {
    "2026-10-01T10:00:00-04:00": ("2026-10-01T10:30:00-04:00", "Thursday, October 1 at 10:00 AM", "jueves 1 de octubre a las 10:00 a. m.", "четверг, 1 октября, в 10:00"),
    "2026-10-01T14:30:00-04:00": ("2026-10-01T15:00:00-04:00", "Thursday, October 1 at 2:30 PM", "jueves 1 de octubre a las 2:30 p. m.", "четверг, 1 октября, в 14:30"),
    "2026-10-02T11:00:00-04:00": ("2026-10-02T11:30:00-04:00", "Friday, October 2 at 11:00 AM", "viernes 2 de octubre a las 11:00 a. m.", "пятница, 2 октября, в 11:00"),
}
SLOTY_OC = {
    "2026-10-02T10:00:00-04:00": ("2026-10-02T11:00:00-04:00", "Friday, October 2 at 10:00 AM"),
    "2026-10-05T13:00:00-04:00": ("2026-10-05T14:00:00-04:00", "Monday, October 5 at 1:00 PM"),
    "2026-10-06T11:00:00-04:00": ("2026-10-06T12:00:00-04:00", "Tuesday, October 6 at 11:00 AM"),
}


def cond(path, typ, val):
    e = {"type": typ}
    if typ == "exact":
        e["expected_value"] = val
    elif typ == "regex":
        e["pattern"] = val
    return {"path": path, "eval": e}


def okna_sobes(yaz):
    i = {"en": 1, "es": 2, "ru": 3}[yaz]
    return J({"ok": True, "okna": [{"start": s, "end": v[0], "tekst": v[i]} for s, v in SLOTY.items()]})


def okna_ocenka():
    return J({"ok": True, "okna": [{"start": s, "end": v[0], "tekst": v[1]} for s, v in SLOTY_OC.items()]})


def moki(spec, ti):
    """spec: {'okna': 'sobes'|'ocenka'|'sobes+ocenka', 'zapis': 'ok'|'chetverg_zanyat', 'otkaz': ...} → tool_mock_overrides."""
    ov = {}
    # окна
    o = []
    if "ocenka" in spec.get("okna", "sobes"):
        o.append({"parameter_conditions": [cond("tip", "exact", "ocenka")], "mock_result": okna_ocenka()})
    for y in ("es", "ru"):
        o.append({"parameter_conditions": [cond("yazyk", "exact", y)], "mock_result": okna_sobes(y)})
    o.append({"parameter_conditions": [], "mock_result": okna_sobes("en") if spec.get("okna", "sobes") != "ocenka" else okna_ocenka()})
    ov[ti["svobodnye_okna"]] = o
    # запись
    z = []
    if spec.get("zapis") == "chetverg_zanyat":
        z.append({"parameter_conditions": [cond("start", "exact", "2026-10-01T10:00:00-04:00")],
                  "mock_result": J({"ok": False, "soobshchenie": "That time was just taken. Please choose another time."})})
    for s, v in list(SLOTY.items()) + list(SLOTY_OC.items()):
        z.append({"parameter_conditions": [cond("start", "exact", s)],
                  "mock_result": J({"ok": True, "event_id": "demo-evt-" + s[5:10].replace("-", "") + s[11:13], "start_tekst": v[1]})})
    z.append({"parameter_conditions": [], "mock_result": J({"ok": False, "soobshchenie": "That time is not available. Please offer one of the times from the list."})})
    ov[ti["zapisat"]] = z
    ov[ti["sohranit_kandidata"]] = [{"parameter_conditions": [], "mock_result": J({"ok": True, "id": "k-demo-0001"})}]
    ov[ti["sohranit_semyu"]] = [{"parameter_conditions": [], "mock_result": J({"ok": True, "id": "s-demo-0001"})}]
    # отказ
    NET = J({"ok": True, "smena": None, "nuzhno_utochnit": False, "soobshchenie": "No shift found for this phone number on that date."})
    ZAPISAN = "Call-off recorded. We are looking for a replacement now; the scheduling team will contact you if they need anything."
    k = []
    vid = spec.get("otkaz", "odna_smena")
    if vid == "odna_smena":
        k.append({"parameter_conditions": [cond("data_smeny", "exact", "2026-10-01")],
                  "mock_result": J({"ok": True, "smena": {"start_tekst": "Thursday, October 1 at 8:00 AM", "klient_kod": "BK-114"}, "nuzhno_utochnit": False, "soobshchenie": ZAPISAN})})
    elif vid == "dve_smeny":
        k.append({"parameter_conditions": [cond("klient_kod", "regex", "[Bb][Kk].?114")],
                  "mock_result": J({"ok": True, "smena": {"start_tekst": "Thursday, October 1 at 8:00 AM", "klient_kod": "BK-114"}, "nuzhno_utochnit": False, "soobshchenie": ZAPISAN})})
        k.append({"parameter_conditions": [cond("klient_kod", "regex", "[Qq][Nn].?207")],
                  "mock_result": J({"ok": True, "smena": {"start_tekst": "Thursday, October 1 at 4:00 PM", "klient_kod": "QN-207"}, "nuzhno_utochnit": False, "soobshchenie": ZAPISAN})})
        k.append({"parameter_conditions": [cond("data_smeny", "exact", "2026-10-01")],
                  "mock_result": J({"ok": True, "smena": None, "nuzhno_utochnit": True, "soobshchenie": "There are two shifts on Thursday, October 1: 8:00 AM with client BK-114 and 4:00 PM with client QN-207. Ask which one the caregiver cannot work, then call again with klient_kod."})})
    elif vid == "subbota":
        k.append({"parameter_conditions": [cond("data_smeny", "exact", "2026-10-03")],
                  "mock_result": J({"ok": True, "smena": {"start_tekst": "Saturday, October 3 at 9:00 AM", "klient_kod": "QN-207"}, "nuzhno_utochnit": False, "soobshchenie": ZAPISAN})})
    elif vid == "oshibka":
        k.append({"parameter_conditions": [], "mock_result": J({"ok": False, "soobshchenie": "The shift system is not responding right now. Please take a message for the scheduling team."})})
    k.append({"parameter_conditions": [], "mock_result": NET})
    ov[ti["otkaz_ot_smeny"]] = k
    if ti.get("perevod"):   # вариант стенда: перевод вебхуком perevod_careline_demo вместо transfer_to_number
        ov[ti["perevod"]] = [{"parameter_conditions": [], "mock_result": J({"ok": True})}]
    return ov


# ---------------------------------------------------------------- API
def api(method, path, body=None):
    return SB.api(method, path, body)


def zagruzit(p, default):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return default


def sohranit(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def papka():
    t = zagruzit(TESTY, {})
    if t.get("_papka"):
        return t["_papka"]
    st, r = api("POST", "/convai/agent-testing/folders", {"name": "CareLine DEMO (№44)"})
    t["_papka"] = r["id"]
    sohranit(TESTY, t)
    return r["id"]


def chasy(vremya):
    """ofis_seychas и kalendar — то, что стенд (vhod или вебхук начала разговора) передаёт агенту в живом звонке."""
    import datetime as dt
    t = dt.datetime.strptime(vremya, "%A, %H:%M %d %B %Y")
    otkryt = t.weekday() < 5 and 9 <= t.hour < 17
    dni = []
    for i in range(14):
        d = t + dt.timedelta(days=i)
        metka = " (today)" if i == 0 else (" (tomorrow)" if i == 1 else "")
        dni.append(f"{d:%A} {d:%B} {d.day}{metka}")
    return ("OPEN" if otkryt else "CLOSED"), "; ".join(dni)


def telo_testa(sc, ti, fid):
    p = sc["progon"]
    ofis, kal = chasy(p["vremya"])
    return {"type": "simulation", "name": f"CareLine DEMO · {sc['id']} · {sc['gruppa']}", "parent_folder_id": fid,
            "simulation_scenario": p["persona"], "simulation_max_turns": p.get("max_turns", 40),
            "success_conditions": p.get("kriterii") or ["The agent followed its instructions."],
            "dynamic_variables": {"system__time": p["vremya"], "system__caller_id": p["caller_id"],
                                  "system__conversation_id": "careline-progon-" + sc["id"],
                                  "ofis_seychas": ofis, "kalendar": kal},
            "tool_mock_config": {"mocking_strategy": "all", "fallback_strategy": "raise_error"},
            "tool_mock_overrides": moki(p.get("moki", {}), ti),
            "simulated_user_model": MODEL_SIM, "evaluation_model": MODEL_SIM}


def podgotovit_test(sc, ti, fid):
    t = zagruzit(TESTY, {})
    body = telo_testa(sc, ti, fid)
    tid = t.get(sc["id"])
    if tid:
        st, r = api("PUT", f"/convai/agent-testing/{tid}", body)
        if st == 200:
            return tid
    st, r = api("POST", "/convai/agent-testing/create", body)
    if st != 200:
        raise SystemExit(f"{sc['id']}: создание теста {st} {json.dumps(r, ensure_ascii=False)[:600]}")
    t[sc["id"]] = r["id"]
    sohranit(TESTY, t)
    return r["id"]


def override(liniya, el):
    _, cc, ps = SB.konfig(liniya, el)
    cc["agent"]["prompt"]["timezone"] = None
    return {"conversation_config": cc, "platform_settings": ps}


def zapustit(scen, raz):
    el = json.load(open(EL, encoding="utf-8"))
    ti = {k: v["id"] for k, v in el["instrumenty"].items()}
    if el.get("perevod_vebhuk_id"):
        ti["perevod"] = el["perevod_vebhuk_id"]
    sch = zagruzit(SCHET, {"vsego": 0, "zapuski": []})
    nuzhno = len(scen) * raz
    if sch["vsego"] + nuzhno > POTOLOK:
        raise SystemExit(f"СТОП: {sch['vsego']} + {nuzhno} > потолка {POTOLOK} прогонов (контракт)")
    fid = papka()
    po_liniyam = {}
    for sc in scen:
        po_liniyam.setdefault(sc["liniya"], []).append(sc)
    invs = []
    for liniya, spisok in po_liniyam.items():
        aid = el["agenty"][{"hiring": "care-hiring", "caregivers": "care-caregivers"}[liniya]]["agent_id"]
        ids = [podgotovit_test(sc, ti, fid) for sc in spisok]
        body = {"tests": [{"test_id": i} for i in ids], "agent_config_override": override({"hiring": "care-hiring", "caregivers": "care-caregivers"}[liniya], el)}
        if raz > 1:
            body["repeat_count"] = raz
        st, r = api("POST", f"/convai/agents/{aid}/run-tests", body)
        if st != 200:
            raise SystemExit(f"run-tests {liniya}: {st} {json.dumps(r, ensure_ascii=False)[:800]}")
        sch["vsego"] += len(ids) * raz
        sch["zapuski"].append({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "invocation": r["id"], "liniya": liniya,
                               "scenarii": [s["id"] for s in spisok], "raz": raz, "progonov": len(ids) * raz})
        sohranit(SCHET, sch)
        invs.append(r["id"])
        print(f"{liniya}: запущено {len(ids)}×{raz} → {r['id']} (всего прогонов {sch['vsego']}/{POTOLOK})", flush=True)
    os.makedirs(RAW, exist_ok=True)
    for inv in invs:
        t0 = time.time()
        while True:
            st, r = api("GET", f"/convai/test-invocations/{inv}")
            runs = r.get("test_runs", [])
            pend = [x for x in runs if x.get("status") == "pending"]
            if runs and not pend:
                break
            if time.time() - t0 > 1800:
                print("  таймаут ожидания", inv)
                break
            print(f"  {inv}: {len(runs) - len(pend)}/{len(runs)} …", flush=True)
            time.sleep(20)
        sohranit(os.path.join(RAW, f"{inv}.json"), r)
    pereschitat()


# ---------------------------------------------------------------- проверки по тексту агента
def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode() if not re.search("[А-Яа-яЁё]", str(s)) else str(s)
    return re.sub(r"\s+", " ", s.strip().lower())


def telefon(s):
    d = re.sub(r"\D", "", str(s))
    return d[-10:]


SLOVA_CIFR = {"zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
              "cero": "0", "uno": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5", "seis": "6", "siete": "7", "ocho": "8", "nueve": "9",
              "ноль": "0", "один": "1", "два": "2", "три": "3", "четыре": "4", "пять": "5", "шесть": "6", "семь": "7", "восемь": "8", "девять": "9"}


def cifry_iz_rechi(t):
    out = []
    for tok in re.findall(r"[A-Za-zА-Яа-яЁё]+|\d", t.lower()):
        if tok.isdigit():
            out.append(tok)
        elif tok in SLOVA_CIFR:
            out.append(SLOVA_CIFR[tok])
    return "".join(out)


# Эталон — list-pravdy/brightside.json (obyazatelno → pravo_na_rabotu: vopros_en/es/ru) и промпты hiring.*.md, сверено 30.09.
KANON = {"en": r"are you legally authorized to work in the united states",
         "es": r"esta usted legalmente autorizad[oa] para trabajar en los estados unidos",   # род согласуется — формулировка та же
         "ru": r"имеете ли вы законное право работать в сша"}
TRIGGER_PRAVA = ["authorized to work", "autorizado para trabajar", "autorizada para trabajar", "право работать", "право на работу"]
ZAPRET_V = ["citizen", "green card", "what visa", "type of visa", "kind of visa", "your visa", "where are you from", "where were you born", "how old", "your age", "date of birth",
            "married", "children", "kids", "pregnan", "disabilit", "religio", "social security", "arrest",
            "ciudadan", "de dónde es", "de donde es", "su edad", "cuántos años tiene", "embaraz", "hijos", "discapacidad", "seguro social",
            "гражданств", "откуда вы", "сколько вам лет", "ваш возраст", "беремен", "дети", "детей", "инвалид", "соцстрах", "виза"]
SLUZHEBNYE = ["careline_demo", "sohranit_", "svobodnye_okna", "zapisat_", "otkaz_ot_smeny", "soobshchenie", "nuzhno_utochnit", "start_tekst",
              "podhodit", "prichina", "net_sertifikata", "tolko_cna", "bolezn", "{\"", "json", " tool", "herramienta", "инструмент"]
ZAPIS_CLAIM = ["you're booked", "you are booked", "i've booked", "i have booked", "booked you", "quedó agendad", "le agendé", "queda agendad", "está agendad",
               "записала вас", "вы записаны", "записала на"]
RASKR = {"en": (["ai assistant"], ["transcript", "recorded"]),
         "es": (["inteligencia artificial"], ["transcripción", "graba"]),
         "ru": (["ии-ассистент", "искусственн"], ["записыва", "текст"])}
ES_W = [" usted", "¿", "gracias", "por favor", " para ", " que ", " el ", " la ", " de ", "adiós", "cuídese", "cuídate", " sí", " está", " es ", " su ", " le ", " lo ", "ñ", "á", "é", "í", "ó", "ú"]
EN_W = [" you ", " the ", " your ", " is ", " and ", " to "]


ZAPOLNITELI = {"one moment", "just a second", "bear with me", "un momento", "un segundito", "секунду", "одну минуту"}


def zapolnitel(t):
    x = re.sub(r"[^\w\s]", " ", t.lower())
    x = re.sub(r"\s+", " ", x).strip()
    for z in ZAPOLNITELI:
        x = x.replace(z, "").strip()
    return x == ""


def yazyk_repliki(t):
    if re.search("[А-Яа-яЁё]", t) and len(re.findall("[А-Яа-яЁё]", t)) > len(re.findall("[A-Za-z]", t)) * 0.6:
        return "ru"
    tl = " " + t.lower() + " "
    return "es" if sum(tl.count(w) for w in ES_W) > sum(tl.count(w) for w in EN_W) else "en"


def razobrat(run):
    ent = run.get("agent_responses") or []
    rep = []  # (i, role, text)
    calls = []  # (i, name, params)
    results = []  # (i, name, value, is_error)
    for i, m in enumerate(ent):
        if m.get("message"):
            rep.append((i, m.get("role"), m["message"]))
        for c in m.get("tool_calls") or []:
            try:
                prm = json.loads(c.get("params_as_json") or "{}")
            except Exception:
                prm = {"_raw": c.get("params_as_json")}
            nm = c.get("tool_name")
            calls.append((i, "transfer_to_number" if nm == "perevod_careline_demo" else nm, prm))   # проверки перевода одинаковы для обоих вариантов
        for r in m.get("tool_results") or []:
            results.append((i, r.get("tool_name"), r.get("result_value") or "", r.get("is_error")))
    return rep, calls, results


def imya_instr(x):
    return x if x in ("transfer_to_number", "transfer_to_agent", "language_detection", "end_call") else x + "_careline_demo"


def sovpadaet(ozh, fakt, klyuch):
    if klyuch.endswith("~"):
        return fakt is not None and re.search(ozh, str(fakt)) is not None
    if klyuch == "telefon":
        return fakt is not None and telefon(fakt) == telefon(ozh)
    if isinstance(ozh, bool):
        return fakt is ozh or (isinstance(fakt, str) and fakt.lower() == str(ozh).lower())
    if isinstance(ozh, (int, float)):
        try:
            return float(fakt) == float(ozh)
        except Exception:
            return False
    return fakt is not None and norm(fakt) == norm(ozh)


def proverit(sc, run):
    rep, calls, results = razobrat(run)
    agent = [(i, t) for i, r, t in rep if r == "agent" and not zapolnitel(t)]
    user = [(i, t) for i, r, t in rep if r == "user"]
    vsyo = " \n".join(t for _, t in agent)
    vsyo_l = vsyo.lower()
    out = []

    def ok(kod, uspeh, detal=""):
        out.append({"kod": kod, "ok": bool(uspeh), "detal": detal})

    def vyzovy(name):
        n = imya_instr(name)
        return [(i, p) for i, nm, p in calls if nm == n]

    polz = " ".join(t for _, t in user).lower()
    for fraza in sc["progon"].get("predusloviya", []):
        if not any(v.lower() in polz for v in fraza.split("|")):
            out.append({"kod": "predusloviye", "ok": None, "detal": f"звонящий-симулятор не сказал «{fraza}» — прогон не проверяет сценарий"})
    for pr in sc["progon"]["proverki"]:
        kod = pr if isinstance(pr, str) else pr["kod"]
        if kod == "raskrytie":
            first = agent[0][1].lower() if agent else ""
            a, b = RASKR["en"]
            ok(kod, any(x in first for x in a) and any(x in first for x in b), first[:120])
        elif kod == "raskrytie_yazyk":
            a, b = RASKR[pr["yazyk"]]
            hit = [t for _, t in agent if any(x in t.lower() for x in a) and any(x in t.lower() for x in b) and yazyk_repliki(t) == pr["yazyk"]]
            ok(f"{kod}:{pr['yazyk']}", hit, hit[0][:120] if hit else "нет раскрытия на языке")
        elif kod == "bez_sluzhebnyh":
            bad = [w for w in SLUZHEBNYE if w in (" " + vsyo_l)]
            ok(kod, not bad, ", ".join(bad))
        elif kod == "bez_zapretnyh_voprosov":
            bad = []
            for _, t in agent:
                for s in re.split(r"(?<=[?.!])\s+", t):
                    if "?" in s or "¿" in s:
                        sl = s.lower()
                        bad += [w + ": " + s[:100] for w in ZAPRET_V if w in sl]
            ok(kod, not bad, " | ".join(bad)[:300])
        elif kod == "vopros_prava_tochno":
            bad = []
            for _, t in agent:
                for s in re.split(r"(?<=[?.!])\s+", t):
                    sl = norm(s)
                    if ("?" in s) and any(tr in s.lower() for tr in TRIGGER_PRAVA):
                        if not any(re.search(k, re.sub(r"[¿?,.«»]", "", sl)) for k in KANON.values()):
                            bad.append(s[:140])
            ok(kod, not bad, " | ".join(bad))
        elif kod == "vopros_prava_zadan":
            ok(kod, re.search(KANON["en"], re.sub(r"[¿?,.]", "", norm(vsyo))) is not None, "")
        elif kod == "vopros_prava_tochno_yazyk":
            ok(f"{kod}:{pr['yazyk']}", re.search(KANON[pr["yazyk"]], re.sub(r"[¿?,.«»]", "", " ".join(norm(t) for _, t in agent))) is not None, "")
        elif kod == "zapis_tolko_posle_ok":
            uspeh = False
            bad = []
            sobytiya = sorted([(i, "r", nm, v) for i, nm, v, _ in results] + [(i, "a", None, t) for i, t in agent], key=lambda x: x[0])
            for i, typ, nm, v in sobytiya:
                if typ == "r" and nm == imya_instr("zapisat"):
                    try:
                        uspeh = bool(json.loads(v).get("ok"))
                    except Exception:
                        uspeh = False
                elif typ == "a" and any(c in v.lower() for c in ZAPIS_CLAIM) and not uspeh:
                    bad.append(v[:120])
            ok(kod, not bad, " | ".join(bad))
        elif kod == "kartochka":
            cs = vyzovy(pr["instrument"])
            if not cs:
                ok(f"{kod}:{pr['instrument']}", False, "не вызван")
                continue
            p = cs[-1][1]
            bad = [f"{k}: ждали {v!r}, было {p.get(k)!r}" for k, v in pr["polya"].items() if not sovpadaet(v, p.get(k), k)]
            ok(f"{kod}:{pr['instrument']}", not bad, "; ".join(bad))
        elif kod == "vyzov":
            cs = vyzovy(pr["instrument"])
            bad = []
            if "raz" in pr and len(cs) != pr["raz"]:
                bad.append(f"вызовов {len(cs)}, ждали {pr['raz']}")
            if "min" in pr and len(cs) < pr["min"]:
                bad.append(f"вызовов {len(cs)}, ждали ≥{pr['min']}")
            if "max" in pr and len(cs) > pr["max"]:
                bad.append(f"вызовов {len(cs)}, ждали ≤{pr['max']}")
            if pr.get("parametry") and cs:
                ok_any = [p for _, p in cs if all(sovpadaet(v, p.get(k.rstrip('~')), k) for k, v in pr["parametry"].items())]
                if "raz" in pr:
                    if len(ok_any) != len(cs):
                        bad.append("параметры: " + "; ".join(f"{k}={cs[-1][1].get(k.rstrip('~'))!r}" for k in pr["parametry"]))
                elif not ok_any:
                    bad.append("ни один вызов не совпал: " + "; ".join(f"{k}={cs[-1][1].get(k.rstrip('~'))!r}" for k in pr["parametry"]))
            if pr.get("parametry_posledniy"):
                if not cs:
                    bad.append("не вызван")
                else:
                    p = cs[-1][1]
                    bb = [f"{k}={p.get(k.rstrip('~'))!r}" for k, v in pr["parametry_posledniy"].items() if not sovpadaet(v, p.get(k.rstrip('~')), k)]
                    if bb:
                        bad.append("последний: " + "; ".join(bb))
            ok(f"{kod}:{pr['instrument']}", not bad, "; ".join(bad))
        elif kod == "ne_vyzvan":
            cs = vyzovy(pr["instrument"])
            ok(f"{kod}:{pr['instrument']}", not cs, f"вызван {len(cs)} раз" if cs else "")
        elif kod == "poryadok":
            a, b = vyzovy(pr["snachala"]), vyzovy(pr["potom"])
            if not a:
                ok(f"{kod}:{pr['snachala']}<{pr['potom']}", False, f"{pr['snachala']} не вызван")
            else:
                ok(f"{kod}:{pr['snachala']}<{pr['potom']}", (not b) or a[0][0] < b[0][0], "")
        elif kod == "net_v_rechi":
            bad = [w for w in pr["slova"] if w.lower() in vsyo_l]
            ok(kod, not bad, ", ".join(bad))
        elif kod == "est_v_rechi":
            ok(kod + ":" + pr["varianty"][0], any(w.lower() in vsyo_l for w in pr["varianty"]), "")
        elif kod == "est_v_rechi_do":
            cs = vyzovy(pr["instrument"])
            granica = cs[0][0] if cs else 10 ** 9
            do = " ".join(t for i, t in agent if i < granica).lower()
            ok(f"{kod}:{pr['varianty'][0]}", any(w.lower() in do for w in pr["varianty"]), "" if cs else "инструмент не вызван")
        elif kod == "net_v_parametrah":
            txt = " ".join(json.dumps(p, ensure_ascii=False).lower() for _, p in vyzovy(pr["instrument"]))
            bad = [w for w in pr["slova"] if w.lower() in txt]
            ok(f"{kod}:{pr['instrument']}", not bad, ", ".join(bad))
        elif kod == "povtor_imeni":
            if pr.get("imya"):
                slovo = re.sub(r"[^A-Za-z]", "", pr["imya"].split()[0])
                shablon = r"(?<![A-Za-z])" + r"[^A-Za-z]{1,3}".join(slovo.upper()) + r"(?![A-Za-z])"
                hit = [t for _, t in agent if re.search(shablon, t.upper())]
            else:
                hit = [t for _, t in agent if re.search(r"(?<![A-Za-z])[A-Za-z](?:[-–,. ]{1,3}[A-Za-z](?![A-Za-z])){4,}", t)]
            ok(kod, hit, hit[0][:100] if hit else "имя по буквам не повторено")
        elif kod == "povtor_telefona":
            hit = [t for _, t in agent if pr["cifry"] in cifry_iz_rechi(t)]
            ok(kod, hit, hit[0][:120] if hit else "номер целиком не повторён")
        elif kod == "posle_otveta_net_voprosov":
            idx = [i for i, t in user if pr["otvet"] in t.lower()]
            if not idx:
                ok(kod, False, "ответ звонящего не найден")
                continue
            posle = " ".join(t for i, t in agent if i > idx[0]).lower()
            bad = [w for w in pr["zapret"] if w in posle]
            ok(kod, not bad, ", ".join(bad))
        elif kod == "pervaya_replika_posle_polzovatelya":
            u0 = user[0][0] if user else 0
            nxt = [t for i, t in agent if i > u0]
            ok(kod, nxt and any(w.lower() in nxt[0].lower() for w in pr["varianty"]), nxt[0][:120] if nxt else "")
        elif kod == "yazyk":
            ld = [i for i, nm, p in calls if nm == "language_detection" and str(p.get("language", "")).lower().startswith(pr["yazyk"])]
            posle = [t for i, t in agent if ld and i > ld[0]]
            dolya = (sum(1 for t in posle if yazyk_repliki(t) == pr["yazyk"]) / len(posle)) if posle else 0
            ok(f"{kod}:{pr['yazyk']}", ld and dolya >= 0.8, f"переключение={'да' if ld else 'нет'}, доля реплик на языке={dolya:.0%}")
        elif kod == "podtverzhdenie_do_zapisi":
            slova = ["book it", "shall i book", "should i book", "want me to book", "go ahead and book", "reserv", "agend", "program", "записываю", "записать вас", "записать?"]
            bad = []
            for ci, p in vyzovy("zapisat"):
                a_do = [(i, t) for i, t in agent if i < ci]
                u_do = [i for i, t in user if i < ci]
                if not a_do:
                    continue
                ai, at = a_do[-1]
                if not (("?" in at) and any(w in at.lower() for w in slova) and u_do and u_do[-1] > ai):
                    bad.append(at[-110:])
            ok(kod, not bad, " | ".join(bad))
        elif kod == "odna_kartochka":
            bad = []
            for nm in ("sohranit_kandidata", "sohranit_semyu"):
                cs = vyzovy(nm)
                raznye = {(norm(p.get("imya", "")), telefon(p.get("telefon", ""))) for _, p in cs}
                if len(raznye) > 1:
                    bad.append(f"{nm}: {len(cs)} вызова с разными данными")
                for _, p in cs:
                    im = norm(p.get("imya", ""))
                    if im in ("", "caller", "unknown", "n/a", "applicant", "candidate", "none", "the caller") or len(im) < 3:
                        bad.append(f"{nm}: имя {p.get('imya')!r}")
            ok(kod, not bad, "; ".join(bad))
        elif kod == "ne_konchat_voprosom":
            bad = []
            for i, nm, p in calls:
                if nm != "end_call":
                    continue
                msg = str(p.get("system__message_to_speak") or "")
                a_do = [(j, t) for j, t in agent if j <= i]
                u_do = [j for j, t in user if j < i]
                la = a_do[-1] if a_do else (-1, "")
                lu = u_do[-1] if u_do else -1
                if "?" in msg or ("?" in la[1] and la[0] > lu):
                    bad.append((msg or la[1])[-110:])
            ok(kod, not bad, " | ".join(bad))
        else:
            ok(kod, False, "неизвестная проверка")
    return out


def pereschitat():
    scen = {s["id"]: s for s in json.load(open(SCEN, encoding="utf-8"))["scenarii"]}
    tests = zagruzit(TESTY, {})
    po_id = {v: k for k, v in tests.items() if not k.startswith("_")}
    rez = []
    for fn in sorted(os.listdir(RAW)) if os.path.isdir(RAW) else []:
        inv = json.load(open(os.path.join(RAW, fn), encoding="utf-8"))
        for run in inv.get("test_runs", []):
            sid = po_id.get(run.get("test_id"))
            if not sid or sid not in scen:
                continue
            pr = proverit(scen[sid], run)
            cr = run.get("condition_result") or {}
            ne_prov = any(x["ok"] is None for x in pr)
            rez.append({"scenariy": sid, "invocation": inv.get("id"), "created_at": inv.get("created_at"), "test_run_id": run.get("test_run_id"),
                        "status_elevenlabs": run.get("status"), "ocenshchik": cr.get("result"),
                        "ocenshchik_pochemu": ((cr.get("rationale") or {}).get("summary") or "")[:300],
                        "kredity": run.get("credits_used"), "proydeno": None if ne_prov else all(x["ok"] for x in pr),
                        "provaly": [x for x in pr if x["ok"] is not True], "proverok": len(pr)})
    sohranit(REZ, rez)
    po = {}
    for r in rez:
        po.setdefault(r["scenariy"], []).append(r)
    for sid in sorted(po):
        rr = sorted(po[sid], key=lambda x: x["created_at"] or 0)
        znak = "".join({True: "✓", False: "✗", None: "?"}[x["proydeno"]] for x in rr)
        print(f"{sid}: {znak}  " + " | ".join(f"{p['kod']}: {p['detal'][:90]}" for x in rr if x["proydeno"] is not True for p in x["provaly"])[:600])
    print("прогонов в разборе:", len(rez), "· кредитов:", sum(r["kredity"] or 0 for r in rez))


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--pereschitat" in a:
        pereschitat()
        sys.exit(0)
    raz = int(a[a.index("--raz") + 1]) if "--raz" in a else 1
    vse = json.load(open(SCEN, encoding="utf-8"))["scenarii"]
    if "--tolko" in a:
        nuzhnye = a[a.index("--tolko") + 1].split(",")
        scen = [s for s in vse if s["id"] in nuzhnye]
    elif "--kritichnye" in a:
        scen = [s for s in vse if s["kritichnyy"]]
    else:
        raise SystemExit(__doc__)
    scen = [s for s in scen if s.get("progon")]
    if not scen:
        raise SystemExit("нет сценариев с блоком progon")
    zapustit(scen, raz)
