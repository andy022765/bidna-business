#!/usr/bin/env python3
"""Дописывает ветку reklama-meta (27.09) в общие файлы университета, не пересобирая то, что уже есть.

Почему не merge.py: он строит таблицы индекса только из staging, а staging первой волны (24.09) лежал во временной
папке другой сессии. Запуск merge.py без него стёр бы из INDEX.md все старые строки. Этот скрипт берёт строки,
которые уже стоят в INDEX.md, добавляет новые из staging ветки и сортирует по ID. Повторный запуск ничего не дублирует.

Запуск:  python3 merge_meta.py <папка staging с подпапками meta-*> [--dry]
"""
import json, re, sys
from pathlib import Path

U = Path(__file__).resolve().parent.parent
KEYS = ["meta-algoritm", "meta-izmerenie", "meta-kreativy"]
TABLES = {"Sources": "index-sources.md", "Notes": "index-notes.md",
          "Claims": "index-claims.md", "Contradictions": "index-contradictions.md"}


def is_row(s):
    s = s.strip()
    return s.startswith("|") and not s.startswith("| ID") and not re.match(r"^\|\s*:?-{2,}", s)


def rid(s):
    return s.strip().strip("|").split("|")[0].strip()


def staged_rows(stage, fname):
    out = {}
    for k in KEYS:
        p = stage / k / fname
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            if is_row(line) and rid(line) and rid(line) not in out:
                out[rid(line)] = line.strip()
    return out


def syn_row(p):
    t = p.read_text(encoding="utf-8")
    m = re.search(r"_Last updated:\s*([0-9-]+)[^_]*?(\d+)\s*sources?[^_]*?(\d+)\s*claims", t)
    upd, ns, nc = (m.group(1), m.group(2), m.group(3)) if m else ("2026-09-27", "—", "—")
    title = t.splitlines()[0].replace("# Synthesis:", "").strip()
    return f"| {p.stem} | {title[:110]} | {upd} | {ns} | {nc} |"


def merge_table(part, new_rows):
    """part — текст раздела INDEX.md от '## X' до следующего '## '. Возвращает (новый текст, сколько добавлено)."""
    lines = part.rstrip("\n").split("\n")
    sep = next(i for i, l in enumerate(lines) if re.match(r"^\|\s*:?-{2,}", l.strip()))
    head = lines[: sep + 1]
    body = lines[sep + 1:]
    rows = {rid(l): l.strip() for l in body if is_row(l)}
    tail = [l for l in body if l.strip() and not is_row(l)]
    added = 0
    for k, v in new_rows.items():
        if k not in rows:
            rows[k] = v
            added += 1
    out = head + [rows[k] for k in sorted(rows)] + ([""] + tail if tail else [])
    trailing = part[len(part.rstrip("\n")):] or "\n\n"  # сохраняем отступ до следующего раздела как был
    return "\n".join(out) + trailing, added


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry" in sys.argv
    if not args:
        sys.exit(__doc__)
    stage = Path(args[0])
    for k in KEYS:
        if not (stage / k).is_dir():
            print(f"нет папки staging: {stage / k}")

    # --- INDEX.md: только дописываем ---
    idx_p = U / "INDEX.md"
    parts = re.split(r"(?m)^(?=## )", idx_p.read_text(encoding="utf-8"))
    report, out = [], []
    for part in parts:
        m = re.match(r"## (\S+)", part)
        name = m.group(1) if m else None
        if name in TABLES:
            part, n = merge_table(part, staged_rows(stage, TABLES[name]))
            report.append(f"{name} +{n}")
        elif name == "Syntheses":
            new = {p.stem: syn_row(p) for p in sorted((U / "syntheses").glob("syn-reklama-meta-*.md"))}
            part, n = merge_table(part, new)
            report.append(f"Syntheses +{n}")
        out.append(part)
    new_idx = "".join(out).rstrip("\n") + "\n"

    # --- граф: дописываем уникальные рёбра ---
    g_p = U / "graph" / "edges.jsonl"
    old_lines = [l for l in g_p.read_text(encoding="utf-8").splitlines() if l.strip()]
    seen = set()
    for l in old_lines:
        try:
            e = json.loads(l)
            seen.add((e.get("from"), e.get("to"), e.get("type")))
        except json.JSONDecodeError:
            pass
    add_edges, bad = [], 0
    for k in KEYS:
        p = stage / k / "edges.jsonl"
        if not p.exists():
            continue
        for l in p.read_text(encoding="utf-8").splitlines():
            if not l.strip():
                continue
            try:
                e = json.loads(l)
            except json.JSONDecodeError:
                bad += 1
                continue
            key = (e.get("from"), e.get("to"), e.get("type"))
            if key not in seen:
                seen.add(key)
                add_edges.append(json.dumps(e, ensure_ascii=False))
    report.append(f"edges +{len(add_edges)} (битых строк {bad})")

    # --- очередь: блок ### <ключ> перед последним '## Done', старый блок того же ключа заменяется ---
    tf_p = U / "queue" / "to-follow.md"
    tf = tf_p.read_text(encoding="utf-8")
    q_added = 0
    for k in KEYS:
        p = stage / k / "to-follow.md"
        if not p.exists():
            continue
        body = re.sub(r"^#.*\n", "", p.read_text(encoding="utf-8"), count=1).strip()
        body = re.sub(r"(?m)^## Queue\s*\n", "", body)
        body = re.sub(r"(?m)^## ", "#### ", body)  # чтобы чужой '## Done' не рвал структуру очереди
        block = f"### {k}\n\n{body}\n\n"
        tf = re.sub(rf"(?ms)^### {re.escape(k)}\n.*?(?=^### |^## |\Z)", "", tf)
        i = tf.rfind("\n## Done")
        tf = (tf[: i + 1] + block + tf[i + 1:]) if i >= 0 else tf.rstrip("\n") + "\n\n" + block
        q_added += 1
    report.append(f"очередь: блоков {q_added}")

    # --- висящие ссылки в новых рёбрах ---
    ids = {p.stem for d in ("notes", "claims", "contradictions", "syntheses", "verdicts", "experiments")
           for p in (U / d).glob("*.md")}
    ids |= {p.name for p in (U / "sources").iterdir() if p.is_dir()}
    for sub in ("_rejected", "_borderline"):
        d = U / "sources" / sub
        if d.exists():
            ids |= {p.name for p in d.iterdir() if p.is_dir()}
    dangling = set()
    for l in add_edges:
        e = json.loads(l)
        for x in (e.get("from"), e.get("to")):
            if x and not str(x).startswith("internal:") and x not in ids:
                dangling.add(x)

    print(" · ".join(report))
    print(f"висящих id в новых рёбрах: {len(dangling)}" + (f" → {sorted(dangling)[:25]}" if dangling else ""))
    if dry:
        print("--dry: ничего не записано")
        return
    idx_p.write_text(new_idx, encoding="utf-8")
    if add_edges:
        g_p.write_text("\n".join(old_lines + add_edges) + "\n", encoding="utf-8")
    tf_p.write_text(tf, encoding="utf-8")
    print("записано: INDEX.md, graph/edges.jsonl, queue/to-follow.md")


if __name__ == "__main__":
    main()
