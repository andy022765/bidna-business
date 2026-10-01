# -*- coding: utf-8 -*-
"""Сверка спецификации ПЕРЕД запуском: новый текст объявления или новая аудитория группы.

Полномочие Андрея 30.09 ~11:15: «Да, разреши ему делать новые тексты и аудитории».
Скрипт — нижняя планка чек-листа (длины, хвост, стоп-слова, ролики, кнопка, адрес, бюджет, гео, язык).
То, что машиной не проверить (совпадение с роликом, обращение к атрибутам зрителя, обещание результата
без стоп-слов), агент проверяет глазами по AGENT.md (на Маке — .claude/agents/targetolog.md), раздел «Новые тексты и аудитории».

    python3 sverka.py bot_t2                 # = specs/bot_t2.json (облако: из корня репозитория)
    python3 sverka.py "<полный путь>.json"

Тип определяется сам: есть "creative" — объявление, есть "targeting" — группа.
Ответ: «СВЕРКА: ОК …» (код 0) или «СВЕРКА: НЕ ПРОШЛО» со списком причин (код 1). Файлы не меняет.
Продлили тест или сменили бюджет (слово Андрея) — поправить KONEC/BYUDZHET здесь и MAX_END в хуке денег
(облако: .claude/hooks/meta_money_guard.py; Мак: ~/.claude/hooks/meta_money_guard.py).
"""
import json
import pathlib
import re
import sys

PAPKA = pathlib.Path(__file__).resolve().parent            # корень репозитория (на Маке — targetolog/)
PAGE = "269332329600895"
TEL = "tel:+14247811913"
SAYT = "https://businessinteldna.com/vera/ru/"
OPISANIE = "Отвечает и продаёт"                             # бриф §0 п.17–18, не менять
# Хвост основного текста — слова Андрея (бриф §0 п.3 и п.17), дословно, не менять
HVOST = ("Вера ответит по-русски. По-английски, как вашим клиентам, — перейдите на английскую версию сайта "
         "(businessinteldna.com/vera) или позвоните +1 424 724 4202\nНа втором этапе Вера продаёт: отвечает на "
         "возражения, шлёт предложение, пока человек на линии, и дожимает письмами тех, кто не решил")
# Ролики и обложки, которые можно брать (v2 с концовкой «ИИ-администратор и продавец», demo — v3 крупная).
# v1 и demo_v2 — нельзя. Источник — targetolog/MEDIA-META.md и specs/*.json.
ROLIKI = {
    "noch":  {"916": ("990175700759340", "ddd76f9a8dfaa5e64511f42cc12fb9eb"),
              "45":  ("1654128656294099", "e02f30b9291e97f02fd0cbb0288ba170")},
    "bot":   {"916": ("1668544274815475", "8ab1a08b70639e6470548b04fa229697"),
              "45":  ("3377685262440067", "71d0eb87a685978ea9f6e22d7c454df9")},
    "pismo": {"916": ("1627063082193681", "a84ccc77ded7a8de364e64539b8c9420"),
              "45":  ("1003220109429409", "3e8d876d1c8324205f6ba0b8218699e2")},
    "demo":  {"916": ("975087865647571", "3774f1177302fc473d979f8e4e27327f"),
              "45":  ("3680889168745192", "013fac4e30ae2ee557702fe20caa4237")},
}
# 30.09: ролики, которые собрала и загрузила облачная проверка (AGENT.md «Новые ролики»), — teksty/roliki.json вида
# {"<тег>": {"916": ["video_id", "thumbnail_hash"], "45": ["video_id", "thumbnail_hash"]}}; дописываются к ROLIKI.
# Правила (.claude/, AGENT.md, этот файл) запуски не правят, а JSON — можно; поэтому список живёт там.
try:
    for _teg, _fmt in json.loads((PAPKA / "teksty" / "roliki.json").read_text("utf-8")).items():
        ROLIKI[_teg] = {k: tuple(v) for k, v in _fmt.items()}
except FileNotFoundError:
    pass
POZ_916 = {"story", "facebook_reels"}
POZ_45 = {"feed", "marketplace"}

# Группа: деньги и даты не меняются (слово Андрея), меняется только аудитория
KAMPANIYA = "120249932374020430"
BYUDZHET = 1500                                   # центы, $15 в день
KONEC = "2026-10-07T23:59:00-0700"
TSENTRY = {"LA": (34.0522, -118.2437), "NY": (40.7128, -74.006)}
RADIUS_MIN, RADIUS_MAX = 10, 50                   # мили; 50 — предел Meta для точки
POZICII = {"feed", "marketplace", "story", "facebook_reels"}   # только те, под которые у роликов есть формат
KLYUCHI_TARGETINGA = {"age_min", "age_max", "geo_locations", "publisher_platforms", "facebook_positions",
                      "device_platforms", "locales", "targeting_automation", "flexible_spec"}

LIMIT_TEKST = 125      # видимая часть основного текста (c-0792)
LIMIT_ZAG = 40         # заголовок (c-0792)

# Стоп-слова изменяемой части и заголовка. Проверка по нижнему регистру, «ё» → «е».
STOP = [
    (r"гарант|окуп|прибыл|выручк|доход|заработ|удво|утро[ия]|больше (клиент|заяв|звонк|продаж|запис|денег)"
     r"|рост продаж|вырастут|увелич|не пропуст|ни одн|никогда не|перестан|заменит|как живой|не отличить|не ошиба",
     "обещание результата — в рекламе только механика (анти-гарантия, бриф §6, c-0786)"),
    (r"русск|росси|соотечеств|земляк|для наших|наших в |эмигр|иммигр|славян|украин|\bснг\b|вашем язык|родном язык",
     "что Вера русская, не подчёркиваем; к происхождению и языку зрителя не обращаемся (бриф §6, c-0780)"),
    (r"рассроч|кредит|\bдолг(и|ов|ам|ами|ах)?\b|банкрот|теряете|бизнес теряет|убытк",
     "финансы зрителя и рассрочка — правило Meta (c-0783, c-0784)"),
    (r"ваканс|нанима|найм|зарплат|резюме", "язык найма — особая категория «занятость» (c-0784)"),
    (r"круглосуточ|без выходн|без автопродл", "запрет брифа §6 («круглосуточно» — не отличие, «без автопродления» — неправда)"),
    # 30.09 ревизия: то, чего Вера на русской линии сейчас не делает (бриф §0 п.3, п.11, п.13; SMS клиентам не обещаем)
    (r"английск|english|перезвон(ит|им|ят)\b|\bсмс\b|\bsms\b|эсэмэс",
     "обещание того, чего Вера не делает: русская линия на английский не переходит (про английский — только хвост), "
     "перезвона нет, SMS не обещаем (бриф §0 п.3, п.11, п.13)"),
    (r"не уйд|не уход|не потеря", "обещание результата — в рекламе только механика (анти-гарантия, бриф §6, c-0786)"),
    (r"земляч", "что Вера русская, не подчёркиваем; к происхождению зрителя не обращаемся (бриф §6, c-0780)"),
    (r"chatgpt|openai|\bgpt|gemini|claude|perplexity|google|гугл|яндекс|alexa|siri|elevenlabs|twilio|\bmeta\b"
     r"|фейсбук|facebook|инстаграм|instagram|whatsapp|ватсап|телеграм|telegram",
     "чужие бренды — только в рекламе Видимости (c-0799)"),
    (r"успейте|только сегодня|осталось|последний шанс|скидк|\bакци[яиюей]|лайк|поделитесь|отметьте|подпишитесь"
     r"|комментар|не поверите|\bшок|\bсекрет(?!ар)|до и после",
     "приманки, ложная срочность, тизеры — правило Meta (c-0787)"),
]


def norm(s):
    # неразрывный и прочие дефисы → обычный, чтобы «AI‑администратор» не падал ложно
    return s.lower().replace("ё", "е").replace("‐", "-").replace("‑", "-")


def spisok(x):
    """Живой ответ Meta отдаёт массивы как {"0": …, "1": …}; для проверок приводим к списку."""
    if isinstance(x, dict) and x and all(str(k).isdigit() for k in x):
        return [x[k] for k in sorted(x, key=lambda k: int(k))]
    return x


def est_slovari_massivy(x):
    if isinstance(x, dict):
        if x and all(str(k).isdigit() for k in x):
            return True
        return any(est_slovari_massivy(v) for v in x.values())
    if isinstance(x, list):
        return any(est_slovari_massivy(v) for v in x)
    return False


# Поля, которые живая группа отдаёт только на чтение — в спецификацию для ads_create_ad_set не переносятся
TOLKO_CHTENIE = {"page_types", "dt_consolidation_state"}


def proverit_frazu(t, chto, limit, oshibki):
    if not t.strip():
        oshibki.append(f"{chto}: пусто")
        return
    if len(t) > limit:
        oshibki.append(f"{chto}: {len(t)} знаков, предел {limit}")
    if "\n" in t:
        oshibki.append(f"{chto}: перевод строки — изменяемая часть одним абзацем")
    if "!" in t:
        oshibki.append(f"{chto}: «!» — без восклицаний (c-0787)")
    if re.search(r"\d", re.sub(r"\b\d{1,2}:\d{2}\b", "", t)):
        oshibki.append(f"{chto}: цифры — никаких чисел (разрешено только время вида 23:41 из ролика)")
    kaps = [w for w in re.findall(r"[A-Za-zА-Яа-яЁё]{3,}", t) if w.isupper() and w not in {"HVAC"}]
    if kaps:
        oshibki.append(f"{chto}: капс {kaps} (c-0787)")
    bukvy = re.findall(r"[A-Za-zА-Яа-яЁё]", t)
    lat = re.findall(r"[A-Za-z]", re.sub(r"\bAI\b|\bHVAC\b", "", t))
    if bukvy and len(lat) > 0.1 * len(bukvy):
        oshibki.append(f"{chto}: много латиницы — текст по-русски (кроме AI, HVAC)")
    n = norm(t)
    for pat, pochemu in STOP:
        naydeno = sorted({m.group(0) for m in re.finditer(pat, n)})
        if naydeno:
            oshibki.append(f"{chto}: «{'», «'.join(naydeno)}» — {pochemu}")


def sverka_obyavleniya(d, oshibki):
    c = d.get("creative")
    if isinstance(c, str):
        c = json.loads(c)
    if (c.get("object_story_spec") or {}).get("page_id") != PAGE:
        oshibki.append(f"object_story_spec.page_id не {PAGE}")
    a = c.get("asset_feed_spec") or {}
    for k, n in (("bodies", 1), ("titles", 1), ("descriptions", 1)):
        if len(a.get(k) or []) != n:
            oshibki.append(f"{k}: нужен ровно {n} вариант (иначе Meta сама смешивает тексты)")
    body = ((a.get("bodies") or [{}])[0]).get("text", "")
    zag = ((a.get("titles") or [{}])[0]).get("text", "")
    opis = ((a.get("descriptions") or [{}])[0]).get("text", "")
    chast = ""
    if not body.endswith("\n\n" + HVOST):
        oshibki.append("основной текст: хвост (строка про английский и строка про второй этап) не дословно — "
                       "берётся из specs/, не меняется (бриф §0 п.3, п.17)")
    else:
        chast = body[: -len("\n\n" + HVOST)]
        proverit_frazu(chast, "изменяемая часть", LIMIT_TEKST, oshibki)
        n = norm(chast)
        if not re.search(r"\bвер(а|у|ы|е|ой)\b", n):
            oshibki.append("изменяемая часть: нет имени «Вера»")
        if not re.search(r"\b(ai|ии)[- ]администратор", n):
            oshibki.append("изменяемая часть: нет «AI-администратор» / «ИИ-администратор» — человек до звонка должен знать, что ответит ИИ")
        if not re.search(r"прода[ве]", n):
            oshibki.append("изменяемая часть: нет «продавец» / «продаёт» — позиционирование «администратор И продавец» (Андрей 28.09)")
    proverit_frazu(zag, "заголовок", LIMIT_ZAG, oshibki)
    if opis != OPISANIE:
        oshibki.append(f"описание: «{opis}» — должно быть «{OPISANIE}» (бриф §0 п.18)")
    if a.get("ad_formats") != ["SINGLE_VIDEO"]:
        oshibki.append("ad_formats не [SINGLE_VIDEO]")
    if a.get("optimization_type") != "PLACEMENT":
        oshibki.append("optimization_type не PLACEMENT")
    if a.get("call_to_actions") != [{"type": "CALL_NOW", "value": {"link": TEL}}]:
        oshibki.append(f"кнопка: нужна ровно CALL_NOW → {TEL}")
    if a.get("link_urls") != [{"website_url": SAYT}]:
        oshibki.append(f"link_urls: нужен ровно {SAYT} (без адреса Meta не публикует)")
    vid = a.get("videos") or []
    metki = {}
    ispolz = set()
    for v in vid:
        para = (v.get("video_id"), v.get("thumbnail_hash"))
        naydeno = [(kt, fm) for kt, f in ROLIKI.items() for fm, p in f.items() if p == para]
        if not naydeno:
            oshibki.append(f"ролик {para}: не из списка разрешённых (или обложка не своя) — v1 и demo_v2 нельзя")
            continue
        kt, fm = naydeno[0]
        ispolz.add(kt)
        for l in v.get("adlabels") or []:
            metki[l.get("name")] = fm
    if len(vid) != 2 or len(ispolz) != 1 or sorted(metki.values()) != ["45", "916"]:
        oshibki.append("ролики: нужна пара одного концепта — 9:16 и 4:5, у каждого своя метка adlabels")
    for r in a.get("asset_customization_rules") or []:
        poz = set((r.get("customization_spec") or {}).get("facebook_positions") or [])
        fm = metki.get((r.get("video_label") or {}).get("name"))
        if (fm == "916" and poz != POZ_916) or (fm == "45" and poz != POZ_45) or fm is None:
            oshibki.append(f"правило формата {sorted(poz)} → ролик не того формата (9:16 — Stories/Reels, 4:5 — лента/Marketplace)")
    if len(a.get("asset_customization_rules") or []) != 2:
        oshibki.append("asset_customization_rules: нужно два правила (9:16 и 4:5)")
    dof = ((c.get("degrees_of_freedom_spec") or {}).get("creative_features_spec") or {})
    for k in ("text_optimizations", "enhance_cta", "add_text_overlay", "video_auto_crop"):
        if (dof.get(k) or {}).get("enroll_status") != "OPT_OUT":
            oshibki.append(f"улучшение Advantage+ {k} не OPT_OUT — Meta может переписать текст (c-0791)")
    return f"объявление · ролик {'/'.join(sorted(ispolz)) or '?'} · изменяемая часть {len(chast)} зн. · заголовок {len(zag)} зн.\n" \
           f"ТЕКСТ: {chast}\nЗАГОЛОВОК: {zag}"


def sverka_gruppy(d, oshibki):
    for k, v in (("campaign_id", KAMPANIYA), ("billing_event", "IMPRESSIONS"), ("optimization_goal", "QUALITY_CALL"),
                 ("destination_type", "PHONE_CALL"), ("bid_strategy", "LOWEST_COST_WITHOUT_CAP"),
                 ("daily_budget", BYUDZHET), ("end_time", KONEC)):
        if d.get(k) != v:
            oshibki.append(f"{k} = {d.get(k)!r}, должно быть {v!r} — бюджет, даты, ставки и цель не меняются (деньги — слово Андрея)")
    for k in ("bid_amount", "bid_constraints", "lifetime_budget", "budget_schedule_specs", "campaign_spec",
              "daily_spend_cap", "lifetime_spend_cap"):
        if k in d:
            oshibki.append(f"{k}: лишнее поле — это деньги или ставки")
    po = d.get("promoted_object")
    if isinstance(po, str):
        po = json.loads(po)
    if (po or {}).get("page_id") != PAGE:
        oshibki.append(f"promoted_object.page_id не {PAGE}")
    t = d.get("targeting")
    if isinstance(t, str):
        t = json.loads(t)
    t = t or {}
    if est_slovari_massivy(t):
        oshibki.append("targeting: массивы в виде {\"0\": …} — это вид живого ответа Meta; в спецификации — списки [...] "
                       "(бери за основу последнюю specs/gruppa_*.json, а не ответ ads_get_ad_entities)")
    chtenie = sorted(k for k in t if k in TOLKO_CHTENIE or k.startswith("effective_"))
    if chtenie:
        oshibki.append(f"targeting: {chtenie} — поля только для чтения из живой группы, в спецификацию не переносятся")
    lishnie = set(t) - KLYUCHI_TARGETINGA - set(chtenie)
    if lishnie:
        oshibki.append(f"targeting: ключи {sorted(lishnie)} — не из разрешённых (пол, исключения, поведения, "
                       f"Instagram и прочее — только предложением)")
    t = {k: spisok(v) for k, v in t.items()}
    if isinstance(t.get("geo_locations"), dict):
        t["geo_locations"] = {k: spisok(v) for k, v in t["geo_locations"].items()}
    amin, amax = t.get("age_min"), t.get("age_max")
    if not (isinstance(amin, int) and isinstance(amax, int) and 18 <= amin < amax <= 65):
        oshibki.append(f"возраст {amin}–{amax}: нужно 18 ≤ от < до ≤ 65")
    g = t.get("geo_locations") or {}
    if set(g) - {"custom_locations", "location_types"}:
        oshibki.append(f"гео: {sorted(set(g) - {'custom_locations', 'location_types'})} — только точки NY и LA с радиусом")
    naydeno = []
    for m in g.get("custom_locations") or []:
        if not isinstance(m, dict):
            oshibki.append(f"гео: точка {m!r} не объект")
            continue
        kto = [n for n, (la, lo) in TSENTRY.items()
               if abs(float(m.get("latitude", 0)) - la) < 0.01 and abs(float(m.get("longitude", 0)) - lo) < 0.01]
        if not kto:
            oshibki.append(f"гео: точка {m.get('latitude')},{m.get('longitude')} — не центр NY или LA")
            continue
        naydeno += kto
        r = m.get("radius")
        if m.get("distance_unit") != "mile" or not isinstance(r, (int, float)) or not RADIUS_MIN <= r <= RADIUS_MAX:
            oshibki.append(f"гео {kto[0]}: радиус {r} {m.get('distance_unit')} — нужно {RADIUS_MIN}–{RADIUS_MAX} миль")
    if sorted(naydeno) != ["LA", "NY"]:
        oshibki.append(f"гео: нужны обе точки, NY и LA, по одной (сейчас {naydeno}) — решение Андрея 27.09")
    lt = g.get("location_types") or []
    if not lt or set(lt) - {"home", "recent"}:
        oshibki.append(f"location_types {lt}: только home и/или recent")
    if t.get("locales") != [17]:
        oshibki.append(f"locales {t.get('locales')}: только [17] (Russian)")
    if t.get("publisher_platforms") != ["facebook"]:
        oshibki.append("publisher_platforms: только facebook (Instagram — после теста, решение Андрея)")
    poz = t.get("facebook_positions") or []
    if not poz or set(poz) - POZICII:
        oshibki.append(f"facebook_positions {poz}: только из {sorted(POZICII)}, хотя бы одна")
    if t.get("device_platforms") != ["mobile"]:
        oshibki.append("device_platforms: только mobile (реклама со звонком, c-0742)")
    if (t.get("targeting_automation") or {}).get("advantage_audience") != 0:
        oshibki.append("targeting_automation.advantage_audience должно быть 0 — иначе места и язык перестают быть жёсткими (c-0707)")
    fs = t.get("flexible_spec")
    if fs is not None:
        try:
            ok_id = {str(x.get("id")) for x in json.loads((PAPKA / "teksty" / "interesy.json").read_text("utf-8")).get("interesy", [])}
        except Exception:
            ok_id = set()
        for blok in spisok(fs) or []:
            if not isinstance(blok, dict):
                oshibki.append("flexible_spec: блок не объект")
                continue
            if set(blok) - {"interests"}:
                oshibki.append(f"flexible_spec: {sorted(set(blok) - {'interests'})} — только интересы (поведения, демография — нет)")
            for i in spisok(blok.get("interests")) or []:
                if not isinstance(i, dict):
                    oshibki.append(f"интерес {i!r}: не объект {{id, name}}")
                    continue
                if str(i.get("id")) not in ok_id:
                    oshibki.append(f"интерес {i.get('id')} {i.get('name')!r}: ID нет в teksty/interesy.json — "
                                   f"выдумывать ID нельзя (правило коннектора)")
    return (f"группа · возраст {amin}–{amax} · радиус "
            f"{[m.get('radius') for m in g.get('custom_locations') or [] if isinstance(m, dict)]} · плейсменты {poz} · "
            f"интересы {'есть' if fs else 'нет'}")


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    arg = sys.argv[1]
    put = pathlib.Path(arg) if "/" in arg else PAPKA / "specs" / (arg if arg.endswith(".json") else arg + ".json")
    try:
        d = json.loads(put.read_text("utf-8"))
    except Exception as e:
        print(f"СВЕРКА: НЕ ПРОШЛО\n- файл {put}: {e}")
        sys.exit(1)
    oshibki = []
    try:
        if "creative" in d:
            itog = sverka_obyavleniya(d, oshibki)
        elif "targeting" in d:
            itog = sverka_gruppy(d, oshibki)
        else:
            print("СВЕРКА: НЕ ПРОШЛО\n- нет ни creative, ни targeting")
            sys.exit(1)
    except Exception as e:   # кривая спецификация не должна ронять скрипт без строки «СВЕРКА»
        print(f"СВЕРКА: НЕ ПРОШЛО — {put.name}\n- спецификация не разбирается ({type(e).__name__}: {e}); "
              f"бери за основу specs/ этого ролика или последнюю specs/gruppa_*.json")
        sys.exit(1)
    if oshibki:
        print("СВЕРКА: НЕ ПРОШЛО — " + put.name)
        for o in oshibki:
            print("- " + o)
        print(itog)
        sys.exit(1)
    print("СВЕРКА: ОК — " + put.name + " · " + itog)
    if "creative" in d:
        print("Дальше — проверка глазами (targetolog.md «Новые тексты и аудитории»): совпадает с роликом, "
              "нет обращения к атрибутам зрителя, нет обещания результата словами, не повтор провалившегося текста.")
    else:
        print("Дальше — глазами: меняется одна вещь и ровно та, на которую указал повод (Д3/Д4), объявления — те же.")


if __name__ == "__main__":
    main()
