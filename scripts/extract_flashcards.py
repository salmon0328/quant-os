#!/usr/bin/env python3
"""Extract interview Q&A from local study PDFs into a TypeScript flashcard deck.

Usage:  python3 scripts/extract_flashcards.py            # regenerate deck
        python3 scripts/extract_flashcards.py --inspect  # print samples only

Only question/answer TEXT SNIPPETS are emitted (short, transformative excerpts),
not the books themselves. The PDFs stay git-ignored on purpose.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]

SOURCES = [
    {
        "key": "wsp",
        "file": "0_WSP_RedBook.pdf",
        "deck": "IB Technical (Wall Street Prep)",
        "short": "WSP",
        "skip_pages": {0, 1, 2, 3, 4, 5, 6, 7},  # cover, copyright, TOC
    },
    {
        "key": "biws",
        "file": "Investment Banking 400 Qns.pdf",
        "deck": "IB 400 Questions (BIWS)",
        "short": "400",
        "skip_pages": set(),
        "quality": "high",
    },
]

# Sections are detected from the running header of each page.
SECTION_HEADER = re.compile(
    r"^(ACCOUNTING QUESTIONS|VALUATION QUESTIONS|LBO QUESTIONS|M&A QUESTIONS"
    r"|MERGERS & ACQUISITIONS QUESTIONS|CAPITAL MARKETS QUESTIONS"
    r"|LEVERAGED BUYOUT QUESTIONS|INDUSTRY QUESTIONS|BEHAVIORAL QUESTIONS"
    r"|RESUME QUESTIONS|TECHNICAL QUESTIONS)$",
    re.I,
)

NOISE_PATTERNS = [
    re.compile(r"^Licensed to .*Email address", re.I),
    re.compile(r"^Watch Video", re.I),
    re.compile(r"^https?://(breakingintowallstreet|www\.mergersandinquisitions)", re.I),
    re.compile(r"^http://(breakingintowallstreet|www\.mergersandinquisitions)", re.I),
    re.compile(r"^Copyright", re.I),
    re.compile(r"^\d{1,3}$"),
]


# ---------------------------------------------------------------- text helpers
def column_text(page, max_cols: int = 2) -> list[str]:
    """Extract text column-by-column so multi-column layouts don't interleave."""
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    if not words:
        return []
    width = float(page.width)
    # Bucket words by horizontal centre; cluster into at most `max_cols` columns.
    centres = sorted(w["x0"] for w in words)
    gap_threshold = width * 0.18
    splits: list[float] = []
    for a, b in zip(centres, centres[1:]):
        if b - a > gap_threshold:
            splits.append((a + b) / 2)
        if len(splits) >= max_cols - 1:
            break
    bounds = [0.0, *splits, width + 1]
    cols: list[list[dict]] = [[] for _ in bounds[1:]]
    for w in words:
        c = (w["x0"] + w["x1"]) / 2
        idx = max(i for i in range(len(bounds) - 1) if c >= bounds[i])
        cols[idx].append(w)
    out = []
    for col in cols:
        if not col:
            continue
        col.sort(key=lambda w: (round(w["top"], 1), w["x0"]))
        out.append(join_words(col))
    return out


def join_words(words: list[dict]) -> str:
    lines: list[tuple[float, list[dict]]] = []
    for w in words:
        placed = False
        for ln in lines:
            if abs(ln[0] - w["top"]) <= 3:
                ln[1].append(w)
                placed = True
                break
        if not placed:
            lines.append((w["top"], [w]))
    lines.sort(key=lambda x: x[0])
    text_lines = []
    for _, ws in lines:
        ws.sort(key=lambda w: w["x0"])
        text_lines.append(" ".join(w["text"] for w in ws))
    return "\n".join(text_lines)


def clean_line(line: str) -> str:
    s = line.strip()
    s = re.sub(r"\s+", " ", s)
    return s


def is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    return any(p.match(s) for p in NOISE_PATTERNS)


# ------------------------------------------------------------ question parsing
QUESTION_END = re.compile(r"[?]\s*$")
NUMBERED_Q = re.compile(r"^\s*(\d{1,3})[.)]\s+(.{12,}?[?])\s*$")
MIN_Q_WORDS = 4
MAX_Q_WORDS = 32


def looks_like_question(s: str) -> bool:
    s = s.strip()
    if not QUESTION_END.search(s):
        return False
    if not s[0].isupper() and not s[0].isdigit():
        return False
    words = s.split()
    if not (MIN_Q_WORDS <= len(words) <= MAX_Q_WORDS):
        return False
    # Skip table-ish fragments and stray bullets.
    if re.match(r"^\(?\d{1,2}[.)]\s", s) and len(words) < 6:
        return False
    if re.search(r"\$\s?\d", s) and len(words) < 8:
        return False
    if s.endswith(": ?") or "  " in s:
        return False
    return True


def normalise_question(s: str) -> str:
    s = re.sub(r"^\s*\d{1,3}[.)]\s+", "", s.strip())
    s = re.sub(r"\s+", " ", s)
    # Ensure terminal question mark is single and spaced correctly.
    s = re.sub(r"\s+\?$", "?", s)
    s = re.sub(r"\?+$", "?", s)
    return s


def clean_answer(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    # Drop a trailing question that actually belongs to the next card.
    parts = re.split(r"(?<=[.!?])\s+", s)
    keep = []
    for p in parts:
        if looks_like_question(p) and keep:
            break
        keep.append(p)
    s = " ".join(keep).strip()
    s = re.sub(r"\s*Watch Video\s*→?\s*$", "", s).strip()
    s = re.sub(r"\s*http\S+\s*$", "", s).strip()
    s = re.sub(r"\s+Watch Video\s+→?\s+", " ", s).strip()
    # Cut at the last sentence boundary so cards never end mid-word.
    if len(s) > MAX_ANSWER_CHARS:
        head = s[:MAX_ANSWER_CHARS]
        cut = max(head.rfind(". "), head.rfind("? "), head.rfind("! "))
        s = (head[: cut + 1] if cut > 200 else head.rstrip(" ,;")) + "…"
    return s


MAX_ANSWER_CHARS = 900
MIN_ANSWER_CHARS = 60


def answer_ok(a: str) -> bool:
    """Reject answers that clearly start mid-sentence (multi-column mangling)."""
    if not a:
        return False
    if a[0].islower():
        return False
    if a[0] in "(),.;:?!–—’“”'\"":
        return False
    if len(a.split()) < 12:
        return False
    # A mangled answer often opens with a dangling connector phrase.
    if re.match(r"^(and|or|but|the|this|these|those|which|that|it|they|there|however|"
                r"in addition|for example|under|per|since|as|if|when|while)\b", a, re.I):
        return False
    return True


def question_ok(q: str) -> bool:
    if not q.endswith("?"):
        return False
    if not q[0].isupper():
        return False
    words = q.split()
    if not (5 <= len(words) <= 30):
        return False
    if sum(ch.isdigit() for ch in q) > 6:
        return False
    return True


def build_pairs(lines: list[str]) -> list[tuple[str, str]]:
    """Pair each question line with the prose that follows it."""
    pairs: list[tuple[str, str]] = []
    current_q: str | None = None
    buf: list[str] = []
    for raw in lines:
        line = clean_line(raw)
        if is_noise(line):
            continue
        m = NUMBERED_Q.match(line)
        is_q = looks_like_question(line) or bool(m)
        if is_q:
            q = normalise_question(m.group(2) if m else line)
            if current_q is not None:
                ans = clean_answer(" ".join(buf))
                if len(ans) >= MIN_ANSWER_CHARS and answer_ok(ans):
                    pairs.append((current_q, ans))
            current_q = q
            buf = []
            continue
        if current_q is not None:
            buf.append(line)
            if sum(len(x) for x in buf) > MAX_ANSWER_CHARS:
                ans = clean_answer(" ".join(buf))
                if len(ans) >= MIN_ANSWER_CHARS and answer_ok(ans):
                    pairs.append((current_q, ans))
                current_q = None
                buf = []
    if current_q is not None:
        ans = clean_answer(" ".join(buf))
        if len(ans) >= MIN_ANSWER_CHARS and answer_ok(ans):
            pairs.append((current_q, ans))
    return pairs


# ------------------------------------------------------------------ pipeline
def extract_source(spec: dict) -> list[dict]:
    path = ROOT / spec["file"]
    if not path.exists():
        print(f"  ! missing {spec['file']}", file=sys.stderr)
        return []

    page_lines: list[tuple[int, list[str]]] = []
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages):
            if i in spec["skip_pages"]:
                continue
            cols = column_text(page)
            lines: list[str] = []
            for c in cols:
                lines.extend(c.split("\n"))
            page_lines.append((i + 1, lines))

    cards: list[dict] = []
    seen: set[str] = set()
    section = "General"
    for page_no, lines in page_lines:
        head = " ".join(lines[:4])
        m = SECTION_HEADER.match(clean_line(head))
        if m:
            section = m.group(1).title().replace("M&A", "M&A")
        for q, a in build_pairs(lines):
            if not question_ok(q):
                continue
            key = q.lower()
            if key in seen:
                continue
            seen.add(key)
            cards.append(
                {
                    "q": q,
                    "a": a,
                    "deck": spec["deck"],
                    "section": section,
                    "page": page_no,
                    # BIWS is single-column → clean Q→A pairing. WSP is a
                    # multi-column magazine layout, so some answers are partial.
                    "quality": spec.get("quality", "fair"),
                }
            )
    return cards


def slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="print samples and exit")
    ap.add_argument("--out", default="src/data/flashcards.generated.ts")
    args = ap.parse_args()

    all_cards: list[dict] = []
    for spec in SOURCES:
        cards = extract_source(spec)
        print(f"{spec['short']}: {len(cards)} cards from {spec['file']}")
        all_cards.extend(cards)

    # de-dup across sources by question
    seen: set[str] = set()
    unique: list[dict] = []
    for c in all_cards:
        k = re.sub(r"[^a-z0-9]", "", c["q"].lower())
        if k in seen:
            continue
        seen.add(k)
        unique.append(c)
    print(f"total unique: {len(unique)}")

    if args.inspect:
        for c in unique[:12] + unique[-6:]:
            print("-" * 70)
            print(f"[{c['deck']} | {c['section']} | p{c['page']}] Q: {c['q']}")
            print(f"  A: {c['a'][:260]}")
        return 0

    grouped: dict[str, list[dict]] = {}
    for c in unique:
        grouped.setdefault(c["deck"], []).append(c)

    lines = [
        "// AUTO-GENERATED by scripts/extract_flashcards.py — do not edit by hand.",
        "// Source: local study books (PDFs are git-ignored). Short excerpted Q&A only.",
        "import type { FlashcardSeed } from '../models';",
        "",
        "export const FLASHCARD_SEEDS: FlashcardSeed[] = [",
    ]
    for deck, cards in grouped.items():
        lines.append(f"  // ---- {deck} ({len(cards)}) ----")
        for c in cards:
            q = json.dumps(c["q"], ensure_ascii=False)
            a = json.dumps(c["a"], ensure_ascii=False)
            sec = json.dumps(c["section"], ensure_ascii=False)
            qual = json.dumps(c.get("quality", "fair"))
            lines.append(
                f'  {{ deck: {json.dumps(deck)}, section: {sec}, question: {q}, answer: {a}, quality: {qual} }},'
            )
    lines.append("];")
    lines.append("")

    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(unique)} cards -> {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
