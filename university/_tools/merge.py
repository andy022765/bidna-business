#!/usr/bin/env python3
"""Сводит staging всех веток в общие файлы университета: INDEX.md, graph/edges.jsonl,
queue/to-follow.md и обратные ссылки из backlinks-external.md. Идемпотентен: повторный
запуск пересобирает таблицы из staging и файлов, а не дописывает дубли."""
import json, re, sys
from pathlib import Path

STAGE = Path(__file__).parent
U = Path("/Users/andriizhyla/Library/CloudStorage/GoogleDrive-andywar777@gmail.com/My Drive/Андрей/Private/Investment/DNA for Businesses/Our Business (Andrii & Masha)/university")
KEYS = ["vnutr", "geo-mekh", "geo-rynok", "vera", "auditoriya", "prodazhi", "pravo-ekonomika"]

def rows(fname):
    out = {}
    for k in KEYS:
        p = STAGE / k / fname
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s.startswith("|") or s.startswith("| ID") or re.match(r"^\|\s*-{2,}", s):
                continue
            rid = s.strip("|").split("|")[0].strip()
            if rid and rid not in out:
                out[rid] = s
    return [out[k] for k in sorted(out)]

def fm(path):
    t = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---", t, re.S)
    return m.group(1) if m else ""

def fm_get(text, key):
    m = re.search(rf"^{key}:\s*(.+)$", text, re.M)
    return m.group(1).strip().strip("'\"") if m else ""

# --- таблицы индекса ---
src = rows("index-sources.md")
notes = rows("index-notes.md")
claims = rows("index-claims.md")
contr = rows("index-contradictions.md")

# синтезы — из самих файлов
syn = []
for p in sorted((U / "syntheses").glob("syn-*.md")):
    t = p.read_text(encoding="utf-8")
    m = re.search(r"_Last updated:\s*([0-9-]+)[^_]*?(\d+)\s*sources?[^_]*?(\d+)\s*claims", t)
    upd, ns, nc = (m.group(1), m.group(2), m.group(3)) if m else ("2026-09-24", "—", "—")
    title = t.splitlines()[0].replace("# Synthesis:", "").strip()
    syn.append(f"| {p.stem} | {title[:110]} | {upd} | {ns} | {nc} |")

exps = []
for p in sorted((U / "experiments").glob("exp-*.md")):
    f = fm(p)
    exps.append(f"| {p.stem} | {fm_get(f, 'question')[:140]} | {fm_get(f, 'result')[:160]} | {fm_get(f, 'confidence')} |")

verd = []
for p in sorted((U / "verdicts").glob("v-*.md")):
    f = fm(p)
    verd.append(f"| {p.stem} | {fm_get(f, 'decision')[:180]} | {fm_get(f, 'confidence')} |")

def section(title, header, sep, body):
    return f"## {title}\n\n{header}\n{sep}\n" + "\n".join(body) + "\n"

idx = (U / "INDEX.md").read_text(encoding="utf-8")
head = idx[: idx.index("## Sources")]
new = head + "\n\n".join([
    section("Sources", "| ID | Title | Author | Date | Quality | Relevance | Status |", "|----|-------|--------|------|---------|-----------|--------|", src),
    section("Notes", "| ID | Title | Confidence |", "|----|-------|------------|", notes),
    section("Claims", "| ID | Statement | Confidence |", "|----|-----------|------------|", claims),
    section("Syntheses", "| ID | Topic | Last updated | Sources | Claims |", "|----|-------|--------------|---------|--------|", syn),
    section("Contradictions", "| ID | Between | Status |", "|----|---------|--------|", contr),
    section("Experiments", "| ID | Question | Result | Confidence |", "|----|----------|--------|------------|", exps),
    section("Verdicts", "| ID | Decision | Confidence |", "|----|----------|------------|", verd),
])
(U / "INDEX.md").write_text(new, encoding="utf-8")

# --- граф ---
seen, edges, bad = set(), [], 0
for k in KEYS:
    p = STAGE / k / "edges.jsonl"
    if not p.exists():
        continue
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            bad += 1
            continue
        key = (e.get("from"), e.get("to"), e.get("type"))
        if key in seen:
            continue
        seen.add(key)
        edges.append(json.dumps(e, ensure_ascii=False))
extra = STAGE / "edges-coordinator.jsonl"
if extra.exists():
    for line in extra.read_text(encoding="utf-8").splitlines():
        if line.strip():
            e = json.loads(line); key = (e.get("from"), e.get("to"), e.get("type"))
            if key not in seen:
                seen.add(key); edges.append(json.dumps(e, ensure_ascii=False))
(U / "graph" / "edges.jsonl").write_text("\n".join(edges) + "\n", encoding="utf-8")

# --- очередь ---
tf = (U / "queue" / "to-follow.md").read_text(encoding="utf-8")
base = tf[: tf.index("## Queue")]
parts = []
for k in KEYS:
    p = STAGE / k / "to-follow.md"
    if p.exists():
        body = re.sub(r"^#.*\n", "", p.read_text(encoding="utf-8"), count=1).strip()
        body = re.sub(r"^## Queue\s*\n", "", body, flags=re.M)
        parts.append(f"### {k}\n\n{body}\n")
(U / "queue" / "to-follow.md").write_text(base + "## Queue\n\n" + "\n".join(parts) + "\n## Done\n\n<!-- пусто -->\n", encoding="utf-8")

# --- обратные ссылки ---
bl_done = 0
bl = STAGE / "vera" / "backlinks-external.md"
if bl.exists():
    for line in bl.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^- (\S+) → (\S+) \((\w+)\)", line)
        if not m:
            continue
        a, b, typ = m.groups()
        p = U / "notes" / f"{a}.md"
        if not p.exists():
            continue
        t = p.read_text(encoding="utf-8")
        if b in t:
            continue
        add = f"- {typ}: [{b}] (обратная ссылка, ветка vera)"
        t = t.rstrip("\n") + ("\n" if "## Links" in t else "\n\n## Links\n\n") + add + "\n"
        p.write_text(t, encoding="utf-8"); bl_done += 1

# --- проверка висящих ссылок в графе ---
ids = {p.stem for d in ("notes", "claims", "contradictions", "syntheses", "verdicts", "experiments") for p in (U / d).glob("*.md")}
ids |= {p.name for p in (U / "sources").iterdir() if p.is_dir()}
for sub in ("_rejected", "_borderline"):
    d = U / "sources" / sub
    if d.exists():
        ids |= {p.name for p in d.iterdir() if p.is_dir()}
dangling = set()
for line in edges:
    e = json.loads(line)
    for x in (e.get("from"), e.get("to")):
        if x and not str(x).startswith("internal:") and x not in ids:
            dangling.add(x)

print(f"sources {len(src)} · notes {len(notes)} · claims {len(claims)} · syntheses {len(syn)} · contr {len(contr)} · exps {len(exps)} · verdicts {len(verd)}")
print(f"edges {len(edges)} (bad json {bad}) · backlinks added {bl_done} · dangling ids {len(dangling)}")
if dangling:
    print("dangling sample:", sorted(dangling)[:25])
