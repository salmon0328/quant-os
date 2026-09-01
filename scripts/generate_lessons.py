#!/usr/bin/env python3
"""Turn your reading list into structured lessons for the Learn tab.

This is the "upload more books as the knowledge base" pipeline. Drop PDFs or
plain-text excerpts of your books into ``scripts/book_sources/`` and run:

    pip install pdfplumber openai        # openai only needed for LLM mode
    python3 scripts/generate_lessons.py                 # writes src/data/lessons.generated.ts
    python3 scripts/generate_lessons.py --inspect       # print plan, write nothing
    python3 scripts/generate_lessons.py --track finance # only emit one pillar
    python3 scripts/generate_lessons.py --raw           # no LLM: chunk text into skeleton lessons

How it works
------------
1. Every file in ``scripts/book_sources/`` is turned into plain text.
   (PDFs via pdfplumber; ``.txt``/``.md`` read directly.)
2. The text is split into topic-sized chunks (~1.5k chars).
3. In LLM mode each chunk is sent to the model with a strict JSON schema and
   comes back as a Lesson: elaboration, key notes, practice questions, video
   links, and sources. In ``--raw`` mode the chunk itself becomes the
   elaboration so the pipeline still works without an API key.
4. All lessons are written to ``src/data/lessons.generated.ts`` and picked up
   by the app on next load.

LLM configuration
-----------------
Set one of these env vars; the script auto-detects which client to use:
    OPENAI_API_KEY=sk-...        (default model gpt-4o-mini)
    ANTHROPIC_API_KEY=sk-ant...  (default model claude-3-5-haiku-latest)
Override with --model.

The PDFs / excerpts stay out of git (copyright); only the generated .ts is
committed. Secrets are never written to the output file.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from dataclasses import dataclass, field

SRC_DIR = "scripts/book_sources"
OUT_PATH = "src/data/lessons.generated.ts"

PILLARS = ["academics", "programming", "ai", "finance", "research", "career"]
CHUNK_CHARS = 1800

# Keyword hints used to guess a pillar when no LLM is available.
PILLAR_HINTS = {
    "finance": ["option", "bond", "yield", "equity", "valuation", "derivative", "volatil", "swap", "forward", "black-scholes", "put-call", "interest rate", "ecf", "wacc"],
    "ai": ["regression", "neural", "gradient", "transformer", "classifier", "feature", "overfit", "embedding", "attention", "cluster"],
    "programming": ["python", "algorithm", "complexity", "big-o", "data structure", "sql", "git", "linux", "pandas", "numpy", "recursion", "hash"],
    "academics": ["theorem", "probability", "variance", "expectation", "matrix", "calculus", "eigen", "distribution", "integral", "derive"],
    "research": ["hypothesis", "ablation", "baseline", "paper", "dataset", "experimental", "reproduc", "peer review"],
    "career": ["interview", "networking", "resume", "cover letter", "recruiter", "application"],
}


@dataclass
class Chunk:
    source: str
    text: str
    order: int


def read_text(path: str) -> str:
    if path.lower().endswith(".pdf"):
        try:
            from pdfplumber import open as pdf_open  # type: ignore
        except Exception:
            sys.exit("pdfplumber is required for PDFs: pip install pdfplumber")
        out = []
        with pdf_open(path) as pdf:
            for page in pdf.pages:
                try:
                    out.append(page.extract_text() or "")
                except Exception:
                    pass
        return "\n\n".join(out)
    with open(path, encoding="utf-8", errors="ignore") as fh:
        return fh.read()


def chunk(text: str, source: str, start_order: int) -> list[Chunk]:
    text = re.sub(r"\s+\n", "\n", text)
    # Split on likely headings (short lines ending without punctuation) to keep
    # lessons topical; fall back to fixed windows.
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[Chunk] = []
    buf = ""
    order = start_order
    for p in paras:
        if len(buf) + len(p) > CHUNK_CHARS and buf:
            chunks.append(Chunk(source=source, text=buf.strip(), order=order))
            order += 1
            buf = ""
        buf = (buf + "\n\n" + p).strip()
    if buf:
        chunks.append(Chunk(source=source, text=buf.strip(), order=order))
    return chunks


def guess_pillar(text: str) -> str:
    low = text.lower()
    best, best_n = "finance", 0
    for pillar, hints in PILLAR_HINTS.items():
        n = sum(1 for h in hints if h in low)
        if n > best_n:
            best, best_n = pillar, n
    return best


SYSTEM_PROMPT = """You are a study coach. Turn the supplied book excerpt into ONE\
 lesson object. Output ONLY minified JSON (no markdown fences) matching:
{"trackId": one of %s, "title": short, "summary": one sentence,
 "difficulty": "beginner"|"intermediate"|"advanced", "tags": [..3..],
 "elaboration": "long explanation with \\n\\n between paragraphs; use lines starting with '- ' for bullets",
 "keyNotes": ["3-6 bullet takeaways"],
 "practice": [{"q": "...", "a": "..."}],   // 2-4 questions
 "videos": [{"title": "...", "url": "https://www.youtube.com/results?search_query=...", "minutes": int}],
 "sources": [{"label": "book + chapter"}],
 "estMinutes": int}
Teach, do not transcribe. Infer credible YouTube search links from the topic.""" % json.dumps(PILLARS)


def call_llm(client_kind: str, model: str, text: str) -> dict | None:
    try:
        if client_kind == "openai":
            from openai import OpenAI  # type: ignore
            c = OpenAI()
            r = c.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text[:6000]},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            return json.loads(r.choices[0].message.content)
        else:
            import anthropic  # type: ignore
            c = anthropic.Anthropic()
            r = c.messages.create(
                model=model,
                max_tokens=1500,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text[:6000]}],
            )
            content = "".join(b.text for b in r.content if b.type == "text")
            return json.loads(_first_json(content))
    except Exception as e:  # never let one bad chunk abort the run
        print(f"    ! LLM error: {e}")
        return None


def _first_json(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s)
    start = min([i for i in (s.find("{"), s.find("[")) if i >= 0], default=0)
    return s[start:]


def raw_lesson(ch: Chunk) -> dict:
    return {
        "trackId": guess_pillar(ch.text),
        "title": (ch.text.split("\n")[0][:80] or "Untitled"),
        "summary": "Auto-extracted excerpt — edit in the Learn tab to enrich.",
        "difficulty": "intermediate",
        "tags": ["imported"],
        "elaboration": ch.text,
        "keyNotes": [],
        "practice": [],
        "videos": [],
        "sources": [{"label": ch.source}],
        "estMinutes": max(5, len(ch.text) // 400),
    }


def build_lesson(ch: Chunk, idx: int, llm) -> dict:
    if llm:
        data = call_llm(llm[0], llm[1], ch.text)
        if data:
            data["trackId"] = data.get("trackId") or guess_pillar(ch.text)
            if data["trackId"] not in PILLARS:
                data["trackId"] = guess_pillar(ch.text)
            data.setdefault("tags", [])
            data.setdefault("keyNotes", [])
            data.setdefault("practice", [])
            data.setdefault("videos", [])
            data.setdefault("sources", [{"label": ch.source}])
            return data
    return raw_lesson(ch)


def emit(lessons: list[dict]) -> str:
    lines = [
        "/* eslint-disable */",
        "// AUTO-GENERATED by scripts/generate_lessons.py -- do not edit by hand.",
        "// Lessons derived from book excerpts in scripts/book_sources/. Books are not committed.",
        "",
        "export const LESSON_SEEDS: any[] = [",
    ]
    for i, l in enumerate(lessons):
        l = dict(l)
        l.setdefault("order", i)
        obj = {
            "id": f"ls-gen-{i}",
            "trackId": l.get("trackId", "finance"),
            "title": l.get("title", "Untitled"),
            "summary": l.get("summary", ""),
            "difficulty": l.get("difficulty", "intermediate"),
            "tags": l.get("tags", []),
            "elaboration": l.get("elaboration", ""),
            "keyNotes": l.get("keyNotes", []),
            "practice": l.get("practice", []),
            "videos": l.get("videos", []),
            "sources": l.get("sources", []),
            "estMinutes": int(l.get("estMinutes", 10) or 10),
            "order": int(l.get("order", i) or i),
        }
        lines.append("  " + json.dumps(obj, ensure_ascii=False) + ",")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="print plan, write nothing")
    ap.add_argument("--track", default="", help="only emit lessons for this pillar")
    ap.add_argument("--raw", action="store_true", help="skip the LLM, emit skeleton lessons")
    ap.add_argument("--model", default="", help="override LLM model name")
    ap.add_argument("--limit", type=int, default=0, help="max lessons to generate")
    args = ap.parse_args()

    files = sorted(glob.glob(f"{SRC_DIR}/*.*"))
    files = [f for f in files if f.lower().endswith((".pdf", ".txt", ".md"))]
    if not files:
        print(f"No sources in {SRC_DIR}/ — add PDFs or .txt excerpts of your books.")
        return 1

    # Pick an LLM client if configured and not in raw mode.
    llm = None
    if not args.raw:
        if os.environ.get("OPENAI_API_KEY"):
            llm = ("openai", args.model or "gpt-4o-mini")
        elif os.environ.get("ANTHROPIC_API_KEY"):
            llm = ("anthropic", args.model or "claude-3-5-haiku-latest")
        if llm:
            print(f"  LLM mode: {llm[0]} ({llm[1]})")
        else:
            print("  No OPENAI_API_KEY / ANTHROPIC_API_KEY set — falling back to --raw skeleton lessons.")

    chunks: list[Chunk] = []
    order = 0
    for f in files:
        name = os.path.basename(f)
        print(f"  reading {name}")
        text = read_text(f)
        chunks.extend(chunk(text, name, order))
        order += len(chunks)

    print(f"  {len(chunks)} topic chunks from {len(files)} file(s)")

    lessons: list[dict] = []
    for ch in chunks:
        l = build_lesson(ch, len(lessons), llm)
        if args.track and l.get("trackId") != args.track:
            continue
        lessons.append(l)
        if args.limit and len(lessons) >= args.limit:
            break

    if args.track:
        lessons = [l for l in lessons if l.get("trackId") == args.track]

    from collections import Counter
    print(f"\n  total {len(lessons)} lessons")
    print("  by pillar:", dict(Counter(l.get("trackId") for l in lessons)))

    if args.inspect:
        for l in lessons[:5]:
            print(f"   - [{l.get('trackId')}] {l.get('title')} ({l.get('estMinutes')}m)")
        return 0

    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(emit(lessons))
    print(f"\n  wrote {OUT_PATH}")
    print("  Restart / reload the app; new lessons appear under Learn.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
