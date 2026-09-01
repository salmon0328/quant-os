#!/usr/bin/env python3
"""Rebuild the interview flashcard deck from local PDF books.

Run from the project root:

    pip install pdfplumber
    python3 scripts/extract_flashcards.py              # rewrite src/data/flashcards.generated.ts
    python3 scripts/extract_flashcards.py --inspect    # stats only, write nothing
    python3 scripts/extract_flashcards.py --sample 3   # show sample cards
    python3 scripts/extract_flashcards.py --only 400   # one source only
    python3 scripts/extract_flashcards.py --report     # every dropped question + reason
    python3 scripts/extract_flashcards.py --repair     # send low-confidence cards to Gemini

--------------------------------------------------------------------------
Why this was rewritten
--------------------------------------------------------------------------
The previous parser glued "everything until the next question" into the answer
and then cut at a hard character cap. Measured on the committed deck that meant:

  * 29% of answers (79/270) truncated mid-sentence
  * callout / two-column table text absorbed into answers
  * every card had section "General" - topics were never recovered
  * WSP: 195 cards from 1175 bold question headings; BIWS: 75 from 238

This version separates the three jobs:

  A. STRUCTURE - use the real layout signals.
       WSP Red Book : Cambria-Bold 16.0 -> topic, Cambria-Bold 11.0 -> question,
                      Cambria 10.6 -> answer, shaded band / 2-col gap -> stop.
       BIWS 400     : Palatino-Bold 11.0 numbered -> question (the Roman ones are
                      each section's bullet summary, NOT questions), body -> answer,
                      and the book's own Table of Contents gives topic-by-page.
  B. VALIDATION - every card is checked and tagged high/medium/low, so you can
       see what to trust instead of discovering it during an interview.
  C. REPAIR (optional) - --repair sends only low-confidence cards to Gemini to
       clean the answer and confirm the topic.

Every card carries `page` so you can check it against the book, and nothing is
silently dropped: --report writes scripts/qa_report.json with each rejected
question and the reason.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from dataclasses import dataclass, field

from pdfplumber import open as pdf_open

OUT_PATH = "src/data/flashcards.generated.ts"
REPORT_PATH = "scripts/qa_report.json"

# --- layout constants, measured from the actual files -----------------------
BODY_X_MAX = 430.0        # right of this is the WSP sidebar column
TABLE_COL_GAP = 45.0      # horizontal gap marking a two-column table row
GREY = 0.3                # fill colour of callout / table shading

SECTION_SIZE = 16.0       # WSP topic heading
QUESTION_SIZE = 11.0      # WSP + BIWS question heading
BODY_SIZE = 10.6          # WSP body text

TERMINAL = ".?!"
MIN_ANSWER = 40
MAX_ANSWER = 1400         # trimmed at a sentence boundary, never mid-word

# BIWS footers / running heads that must never reach an answer.
FOOTER_RE = re.compile(
    r"(breakingintowallstreet|mergersandinquisitions|capital capable|"
    r"^\s*\d{1,3}\s*$|all rights reserved)",
    re.I,
)

# Imperative / command form: "Walk me through a DCF", "Name three multiples".
IMPERATIVE_RE = re.compile(
    r"(?i)^(walk|explain|describe|tell|define|name|list|give|state|identify|"
    r"discuss|differentiate|contrast|compare|calculate|compute|estimate|derive|"
    r"prove|show|find|let'?s|lets|imagine|say|assume|suppose|think)\b"
)
# An interrogative anywhere in the line. Many real questions open with a lead-in
# clause ("In M&A, what is...", "From the perspective of an investor, what are...")
# or a scenario ("A company is trading at 12.5x EBITDA, is it overvalued?"), so
# matching only the first word throws away perfectly good cards.
INTERROGATIVE_RE = re.compile(
    r"(?i)\b(what|why|how|when|where|which|who|whom|whose|can|could|should|"
    r"would|will|do|does|did|is|are|was|were)\b"
)

# Answers shorter than this are junk (a heading, not a real answer). Below the
# full MIN_ANSWER the card is still kept but flagged low-confidence.
MIN_KEEP = 25

SOURCES = [
    {"short": "WSP", "path": "0_WSP_RedBook.pdf",
     "deck": "IB Interview Guide (WSP)", "quality": "fair", "skip_pages": set(range(1, 13))},
    {"short": "400", "path": "Investment Banking 400 Qns.pdf",
     "deck": "IB 400 Questions (BIWS)", "quality": "high", "skip_pages": {1, 2, 3}},
    # Xinfeng Zhou, "A Practical Guide to Quantitative Finance Interviews" -
    # the quant "Green Book": brain teasers, calculus/linear algebra,
    # probability, stochastic processes. Supplied as a 213-page scan with no
    # text layer, so it must be OCR'd first (see scripts/ocr_pdf.swift).
    {"short": "Green", "path": "scripts/book_sources/green-book.txt", "text": True,
     "deck": "Quant Finance Interviews (Zhou)", "quality": "fair", "skip_pages": set()},
]


# ---------------------------------------------------------------------------
# text helpers
# ---------------------------------------------------------------------------

def clean(text: str) -> str:
    text = (text.replace("’", "'").replace("‘", "'")
                .replace("“", '"').replace("”", '"')
                .replace("–", "-").replace("—", " - ")
                .replace("→", "->").replace("\xa0", " "))
    return re.sub(r"\s+", " ", text).strip()


def looks_like_question(text: str) -> bool:
    """Permissive: a real question ends in '?', commands the reader, or contains
    an interrogative. Being wrong here costs a good card, which is worse than
    keeping one that the validation pass flags as medium/low confidence."""
    t = text.strip()
    if not t:
        return False
    if t.endswith("?"):
        return True
    if IMPERATIVE_RE.match(t):
        return True
    return bool(INTERROGATIVE_RE.search(t))


def trim_at_sentence(text: str, max_len: int = MAX_ANSWER) -> tuple[str, bool]:
    """Cut at the last sentence boundary under max_len.

    Returns (text, was_trimmed). The old version sliced at a hard cap, which is
    why ~29% of answers ended mid-sentence.
    """
    text = text.strip()
    if len(text) <= max_len:
        return text, False
    window = text[:max_len]
    last = -1
    for m in re.finditer(r"[.!?][\"')\]]?\s", window):
        last = m.end()
    if last >= max_len * 0.5:
        return window[:last].strip(), True
    space = window.rfind(" ")
    if space >= max_len * 0.8:
        return window[:space].strip() + "…", True
    return window.strip() + "…", True


# ---------------------------------------------------------------------------
# validation (layer B)
# ---------------------------------------------------------------------------

def validate(question: str, answer: str) -> tuple[str, list[str]]:
    """Return (confidence, issues) for a candidate card."""
    issues: list[str] = []

    if len(answer) < MIN_ANSWER:
        issues.append("answer_too_short")
    if not answer.rstrip().endswith((".", "?", "!", '"', "'", ")")):
        issues.append("answer_unterminated")
    if not looks_like_question(question):
        issues.append("question_not_interrogative")
    if len(question) < 12:
        issues.append("question_too_short")
    if len(question) > 300:
        issues.append("question_too_long")
    # A following question's marker leaked into this answer.
    if re.search(r"(?:^|\s)Q?\s?\d{2,3}[.:)]\s+[A-Z]", answer):
        issues.append("answer_contains_next_marker")
    # Two-column tables glue: lots of Capitals, almost no sentence punctuation.
    words = answer.split()
    if len(words) > 40 and answer.count(".") <= 1:
        issues.append("possible_table_scramble")
    if answer.count("|") > 2 or answer.count("\x00") > 0:
        issues.append("structural_marker_leak")

    if not issues:
        return "high", issues
    minor = {"question_not_interrogative", "question_too_long"}
    # An unterminated answer almost always means the layout filters dropped the
    # tail of a sentence (a table or callout sat in the middle of it), so it is
    # genuinely incomplete rather than merely untidy.
    if "answer_unterminated" in issues and len(answer) > 150:
        issues.append("answer_incomplete")
        return "low", issues
    if set(issues) <= minor:
        return "medium", issues
    return "low", issues


# ---------------------------------------------------------------------------
# shared line model
# ---------------------------------------------------------------------------

@dataclass
class Line:
    x0: float
    top: float
    font: str
    size: float
    text: str
    words: list = field(default_factory=list)

    @property
    def bold(self) -> bool:
        return "Bold" in self.font

    @property
    def is_body(self) -> bool:
        return not self.bold and abs(self.size - BODY_SIZE) < 0.4

    @property
    def is_table_row(self) -> bool:
        xs = sorted(w["x0"] for w in self.words)
        return any(b - a > TABLE_COL_GAP for a, b in zip(xs, xs[1:]))


def lines_of(page, x_max: float | None = None) -> list[Line]:
    try:
        words = page.extract_words(extra_attrs=["fontname", "size"])
    except Exception:
        return []
    buckets: dict[float, list] = {}
    for w in words:
        if x_max is not None and w["x0"] > x_max:
            continue
        buckets.setdefault(round(w["top"] / 2), []).append(w)
    out = []
    for key in sorted(buckets):
        ws = sorted(buckets[key], key=lambda x: x["x0"])
        out.append(Line(
            x0=ws[0]["x0"], top=ws[0]["top"],
            font=ws[0]["fontname"].split("+")[-1],
            size=round(ws[0]["size"], 1),
            text=" ".join(w["text"] for w in ws),
            words=ws,
        ))
    return out


def shaded_bands(page) -> list[tuple[float, float]]:
    bands = []
    for r in getattr(page, "rects", []) or []:
        colour = r.get("non_stroking_color")
        if isinstance(colour, (int, float)) and abs(colour - GREY) < 0.15:
            if r.get("height", 0) > 10 and r.get("width", 0) > 200:
                bands.append((r["top"], r["bottom"]))
    return bands


def in_band(top: float, bands) -> bool:
    return any(a - 2 <= top <= b + 2 for a, b in bands)


# ---------------------------------------------------------------------------
# WSP Red Book - layout-aware reader
# ---------------------------------------------------------------------------

def parse_red_book(path: str, skip: set[int], deck: str, quality: str, dropped: list):
    cards: list[dict] = []
    section = "General"
    q_buf: list[str] = []
    a_buf: list[str] = []
    q_page = 0
    # Full text per printed page. Kept only so the --repair pass can recover
    # content the layout filters excluded; never written to the deck.
    raw_pages: dict[int, str] = {}

    def flush():
        nonlocal q_buf, a_buf
        if not q_buf:
            q_buf, a_buf = [], []
            return
        question = clean(" ".join(q_buf))
        # Text after a hard stop belongs to a callout/table, not the answer.
        answer = clean(" ".join(x for x in a_buf if x and x != "\x00"))
        answer = answer.split("\x00")[0].strip()
        if len(answer) < MIN_KEEP:
            dropped.append({"deck": deck, "page": q_page, "question": question,
                            "reason": "no_answer_text"})
            q_buf, a_buf = [], []
            return
        # Real questions that just don't open with a verb are kept and flagged
        # rather than dropped - losing a good card costs more than a low rating.
        answer, trimmed = trim_at_sentence(answer)
        confidence, issues = validate(question, answer)
        if trimmed:
            issues.append("answer_trimmed")
            confidence = "low" if confidence == "low" else "medium"
        cards.append({"deck": deck, "section": section, "question": question[:300],
                      "answer": answer, "quality": quality, "page": q_page,
                      "confidence": confidence,
                      "raw": (raw_pages.get(q_page, "") + " " + raw_pages.get(q_page + 1, ""))[:4000]})
        q_buf, a_buf = [], []

    with pdf_open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            if page_no in skip:
                continue
            bands = shaded_bands(page)
            lines = lines_of(page, x_max=BODY_X_MAX)
            try:
                raw_pages[page_no] = page.extract_text() or ""
            except Exception:
                raw_pages[page_no] = ""

            i = 0
            while i < len(lines):
                ln = lines[i]
                text = ln.text.strip()

                if ln.bold and abs(ln.size - SECTION_SIZE) < 0.3 and text:
                    flush()
                    section = clean(text)[:60]
                    i += 1
                    continue

                if ln.bold and abs(ln.size - QUESTION_SIZE) < 0.3 and text:
                    # A continuation from the previous page starts lowercase -
                    # it belongs to the question already being built.
                    if q_buf and text[:1].islower():
                        q_buf.append(text)
                        i += 1
                        continue

                    # A paragraph wrapped around a callout leaves its tail
                    # below the next heading; keep it with the answer.
                    nxt = lines[i + 1] if i + 1 < len(lines) else None
                    if (a_buf and nxt is not None and nxt.is_body
                            and nxt.text[:1].islower()
                            and not a_buf[-1].strip().endswith(TERMINAL)):
                        a_buf.append(nxt.text.strip())
                        i += 2
                        continue

                    flush()
                    q_buf = [text]
                    q_page = page_no
                    # Merge wrapped question lines until the sentence closes.
                    j = i + 1
                    while (j < len(lines) and lines[j].bold
                           and abs(lines[j].size - QUESTION_SIZE) < 0.3):
                        q_buf.append(lines[j].text.strip())
                        j += 1
                        if clean(" ".join(q_buf)).rstrip().endswith(("?", ".")):
                            break
                    i = j
                    continue

                if ln.bold and abs(ln.size - BODY_SIZE) < 0.3 and text:
                    # Bold 10.6: a block/callout title ends the answer; a short
                    # inline label ("10-K:") structures it.
                    nxt = lines[i + 1] if i + 1 < len(lines) else None
                    starts_block = in_band(ln.top, bands) or (
                        nxt is not None and (nxt.is_table_row or in_band(nxt.top, bands))
                    )
                    if starts_block and not (len(text) <= 40 and text.endswith((":", "?"))):
                        a_buf.append("\x00")
                        i += 1
                        continue
                    if a_buf and a_buf[-1] != "\x00":
                        a_buf.append(text)
                    i += 1
                    continue

                if ln.is_body and text and q_buf:
                    if in_band(ln.top, bands) and ln.top > 0:
                        i += 1
                        continue
                    if a_buf and a_buf[-1] == "\x00":
                        i += 1
                        continue
                    if len(" ".join(a_buf)) < MAX_ANSWER:
                        a_buf.append(text)
                    i += 1
                    continue

                i += 1

    flush()
    return cards


# ---------------------------------------------------------------------------
# BIWS 400 - bold numbered questions, topics from the book's own TOC
# ---------------------------------------------------------------------------

NUM_RE = re.compile(r"^\s*(\d{1,4})[\.\)]\s+(?=[A-Z])")
TOC_RE = re.compile(r"^(.*?)\s*\.{3,}\s*(\d{1,3})\s*$")


def read_toc_400(path: str) -> list[tuple[int, str]]:
    """Parse 'Title .......... 12' rows from the contents page."""
    entries: list[tuple[int, str]] = []
    try:
        with pdf_open(path) as pdf:
            for idx in range(min(4, len(pdf.pages))):
                for ln in (pdf.pages[idx].extract_text() or "").split("\n"):
                    m = TOC_RE.match(ln.strip())
                    if m:
                        title = clean(m.group(1))
                        title = re.sub(r"\s*–\s*", " – ", title)
                        entries.append((int(m.group(2)), title))
    except Exception:
        pass
    # Fall back to the measured contents if the page cannot be read.
    if not entries:
        entries = [
            (3, "Introduction"), (5, "Technical Questions & Answers"),
            (6, "Accounting – Basic"), (19, "Accounting – Advanced"),
            (25, "Enterprise / Equity Value – Basic"), (30, "Enterprise / Equity Value – Advanced"),
            (32, "Valuation – Basic"), (43, "Valuation – Advanced"),
            (49, "Discounted Cash Flow – Basic"), (58, "Discounted Cash Flow – Advanced"),
            (61, "Merger Model – Basic"), (69, "Merger Model – Advanced"),
            (78, "LBO Model – Basic"), (85, "LBO Model – Advanced"),
            (92, "Brain Teasers"),
        ]
    return sorted(entries)


def toc_lookup(toc: list[tuple[int, str]], page: int) -> str:
    topic = toc[0][1] if toc else "General"
    for start, title in toc:
        if start <= page:
            topic = title
        else:
            break
    return topic


def parse_400(path: str, skip: set[int], deck: str, quality: str, dropped: list):
    toc = read_toc_400(path)
    cards: list[dict] = []
    cur_q: str | None = None
    cur_page = 0
    cur_section = "General"
    a_buf: list[str] = []
    raw_pages: dict[int, str] = {}

    def flush():
        nonlocal cur_q, a_buf
        if not cur_q:
            return
        question = clean(cur_q)
        answer = clean(" ".join(a_buf))
        if len(answer) < MIN_KEEP:
            dropped.append({"deck": deck, "page": cur_page, "question": question,
                            "reason": "no_answer_text"})
        else:
            answer, trimmed = trim_at_sentence(answer)
            confidence, issues = validate(question, answer)
            if trimmed:
                issues.append("answer_trimmed")
                confidence = "low" if confidence == "low" else "medium"
            cards.append({"deck": deck, "section": cur_section,
                          "question": question[:300], "answer": answer,
                          "quality": quality, "page": cur_page,
                          "confidence": confidence,
                          "raw": (raw_pages.get(cur_page, "") + " "
                                  + raw_pages.get(cur_page + 1, ""))[:4000]})
        cur_q, a_buf = None, []

    with pdf_open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            if page_no in skip:
                continue
            section = toc_lookup(toc, page_no)
            lines = lines_of(page)
            try:
                raw_pages[page_no] = page.extract_text() or ""
            except Exception:
                raw_pages[page_no] = ""

            i = 0
            while i < len(lines):
                ln = lines[i]
                text = ln.text.strip()
                if not text or FOOTER_RE.search(text):
                    i += 1
                    continue

                is_question = (
                    ln.bold and abs(ln.size - QUESTION_SIZE) < 0.4
                    and NUM_RE.match(text) and len(text) > 12
                )

                if is_question:
                    flush()
                    cur_section = section
                    cur_page = page_no
                    q_parts = [NUM_RE.sub("", text).strip()]
                    j = i + 1
                    while (j < len(lines) and lines[j].bold
                           and abs(lines[j].size - QUESTION_SIZE) < 0.4
                           and not NUM_RE.match(lines[j].text.strip())):
                        q_parts.append(lines[j].text.strip())
                        j += 1
                        if clean(" ".join(q_parts)).rstrip().endswith(("?", ".")):
                            break
                    cur_q = " ".join(q_parts)
                    i = j
                    continue

                # Roman numbered lines at the start of a section are the
                # bullet-point summary, not Q&A - skip them there only, so
                # numbered steps inside a real answer are preserved.
                if (NUM_RE.match(text) and not ln.bold
                        and (cur_q is None or not a_buf)):
                    i += 1
                    continue

                if cur_q is not None:
                    a_buf.append(text)
                i += 1

    flush()
    return cards


# ---------------------------------------------------------------------------
# Green Book (plain text / OCR)
# ---------------------------------------------------------------------------

# --- Green Book (Xinfeng Zhou, scanned -> OCR'd) ----------------------------
# Chapter names appear on nearly every page as running headers, so they double
# as topic markers and as noise to strip.
GREEN_TITLE = "A Practical Guide To Quantitative Finance Interviews"
GREEN_CHAPTERS = [
    "Brain Teasers",
    "Calculus and Linear Algebra",
    "Probability Theory",
    "Stochastic Process and Stochastic Calculus",
    "Finance",
    "Algorithms and Numerical Methods",
]

# A problem title: short, capitalised, no terminal punctuation, no maths.
TITLE_RE = re.compile(r"^[A-Z][A-Za-z0-9 ,'&\-]{2,45}$")


def split_green_span(lines: list[str]) -> tuple[list[str], list[str]]:
    """Split `answer ... next problem` into (answer_lines, next_problem_lines).

    Each Green Book problem opens with a short title line ("Light switches",
    "Infinite sequence"), so the last such line in a span marks where the
    solution ends and the following problem begins.
    """
    for idx in range(len(lines) - 1, -1, -1):
        l = lines[idx].strip()
        if not l:
            continue
        if l in GREEN_CHAPTERS or l == GREEN_TITLE:
            continue
        if re.fullmatch(r"[\d\s]+", l):
            continue
        if l.startswith("'"):  # footnote
            continue
        if TITLE_RE.fullmatch(l) and idx + 1 < len(lines):
            return lines[:idx], lines[idx:]
    # No title found - treat the whole span as the answer.
    return lines, []


def tail_from_title(lines: list[str]) -> list[str]:
    """Drop any chapter preamble before the first problem."""
    for idx in range(len(lines) - 1, -1, -1):
        l = lines[idx].strip()
        if l in GREEN_CHAPTERS or l == GREEN_TITLE:
            continue
        if TITLE_RE.fullmatch(l):
            return lines[idx:]
    return lines[-8:]


def join_lines(lines: list[str]) -> str:
    """Join OCR lines, de-hyphenating words split across a line break."""
    out = []
    for i, l in enumerate(lines):
        l = l.strip()
        if not l:
            continue
        nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
        if l.endswith("-") and nxt[:1].islower():
            out.append(l[:-1])          # "walk at the-\nb ridge" -> "walk at the bridge"
        elif l.endswith("-") and nxt[:1].isupper():
            out.append(l[:-1] + " ")
        else:
            out.append(l + " ")
    return clean("".join(out))


def parse_green_book(path: str, deck: str, quality: str, dropped: list):
    """Parse the OCR'd Green Book into 182 problem/solution cards.

    The OCR text has "=== PAGE n ===" markers, running headers and page numbers
    interleaved with the body, and each problem opens with a short title line
    followed by a statement and then a "Solution:" paragraph.
    """
    try:
        raw = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"  ! {path} not found, skipped")
        return []

    parts = re.split(r"\n=== PAGE (\d+) ===\n", raw)

    # Strip running headers / page numbers, tracking the chapter per line.
    cleaned: list[tuple[str, int, str]] = []
    chapter = GREEN_CHAPTERS[0]
    for k in range(1, len(parts), 2):
        page_no = int(parts[k])
        for line in parts[k + 1].split("\n"):
            l = line.strip()
            if not l:
                continue
            if l in GREEN_CHAPTERS:
                chapter = l
                continue
            if l == GREEN_TITLE:
                continue
            if l.startswith("'"):  # footnote line
                continue
            if re.fullmatch(r"\d{1,3}", l):  # page number
                continue
            cleaned.append((l, page_no, chapter))

    sol_idx = [i for i, (l, _, _) in enumerate(cleaned) if l.startswith("Solution:")]
    if not sol_idx:
        return []

    cards: list[dict] = []
    prev_problem = tail_from_title([l for l, _, _ in cleaned[: sol_idx[0]]])

    for k, s in enumerate(sol_idx):
        start = s
        end = sol_idx[k + 1] if k + 1 < len(sol_idx) else len(cleaned)
        span = [l for l, _, _ in cleaned[start:end]]
        if span:
            span[0] = re.sub(r"^Solution:\s*", "", span[0])

        answer_lines, next_problem = split_green_span(span)
        page = cleaned[start][1]
        chapter_at = cleaned[start][2]

        question = join_lines(prev_problem)
        answer = join_lines(answer_lines)
        prev_problem = next_problem

        if len(answer) < MIN_KEEP or len(question) < 8:
            dropped.append({"deck": deck, "page": page, "question": question[:120],
                            "reason": "no_answer_text" if len(answer) < MIN_KEEP else "question_too_short"})
            continue

        answer, trimmed = trim_at_sentence(answer)
        confidence, _ = validate(question, answer)
        if trimmed:
            confidence = "low" if confidence == "low" else "medium"
        cards.append({"deck": deck, "section": chapter_at, "question": question[:300],
                      "answer": answer, "quality": quality, "page": page,
                      "confidence": confidence})

    return cards


def parse_text_file(path: str, deck: str, quality: str, dropped: list):
    try:
        raw = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"  ! {path} not found, skipped")
        return []
    blocks = [clean(b) for b in re.split(r"\n\s*\n", raw) if clean(b)]
    cards, cur = [], None
    section = "General"
    for b in blocks:
        if len(b) < 12:
            continue
        # ALL-CAPS short lines are usually chapter headings.
        if len(b) < 60 and b.isupper():
            section = clean(b.title())[:60]
            continue
        if looks_like_question(b) and len(b) < 260:
            if cur and len(cur["answer"]) >= MIN_ANSWER:
                cards.append(cur)
            elif cur:
                dropped.append({"deck": deck, "page": 0, "question": cur["question"],
                                "reason": "no_answer_text"})
            cur = {"deck": deck, "section": section, "question": b[:300],
                   "answer": "", "quality": quality, "page": 0}
        elif cur is not None:
            cur["answer"] = (cur["answer"] + " " + b).strip()
    if cur and len(cur["answer"]) >= MIN_ANSWER:
        cards.append(cur)

    out = []
    for c in cards:
        answer, trimmed = trim_at_sentence(c["answer"])
        confidence, issues = validate(c["question"], answer)
        if trimmed:
            confidence = "low" if confidence == "low" else "medium"
        out.append({**c, "answer": answer, "confidence": confidence})
    return out


# ---------------------------------------------------------------------------
# Gemini repair pass (layer C) - stdlib only, no extra dependency
# ---------------------------------------------------------------------------

GEMINI_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
              "{model}:generateContent?key={key}")

REPAIR_PROMPT = """You are repairing a flashcard whose answer was extracted from an investment-banking interview book by a PDF parser. The parser often drops table or callout text in the middle of a sentence, leaving the answer incomplete.

QUESTION: {question}

CURRENT (INCOMPLETE) ANSWER:
{answer}

FULL TEXT OF THE RELEVANT BOOK PAGE(S):
{raw}

Task: return a complete, self-contained answer to the question.

Rules:
- Use ONLY facts present in the page text above. Do not add outside knowledge.
- Recover the missing part from the page text where it exists.
- Drop sidebar/video/callout padding that does not answer the question.
- Plain prose, no preamble, no markdown, no bullet characters.
- Must end with a full stop.
- If the page text genuinely does not answer the question, reply with exactly: SKIP
"""


def gemini(prompt: str, model: str = "gemini-2.5-flash") -> str | None:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
    req = urllib.request.Request(
        GEMINI_URL.format(model=model, key=key),
        data=body, headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:  # never let one bad call abort the run
        print(f"    ! gemini error: {e}")
        return None


def repair_pass(cards: list[dict], model: str, limit: int) -> int:
    targets = [c for c in cards if c.get("confidence") == "low"]
    if limit:
        targets = targets[:limit]
    if not targets:
        print("  nothing needs repairing")
        return 0
    print(f"  repairing {len(targets)} low-confidence card(s) with {model} …")
    fixed = 0
    for c in targets:
        out = gemini(REPAIR_PROMPT.format(
            question=c["question"], answer=c["answer"],
            raw=(c.get("raw") or c["answer"])[:4000],
        ), model)
        if not out:
            continue
        out = out.strip()
        if out.upper().startswith("SKIP") or len(out) < MIN_ANSWER:
            continue
        c["answer"] = clean(out)
        c["confidence"] = "medium"
        c["repaired"] = True
        fixed += 1
    print(f"  repaired {fixed}")
    return fixed


# ---------------------------------------------------------------------------
# emit
# ---------------------------------------------------------------------------

def ts(text: str) -> str:
    return json.dumps(text, ensure_ascii=False)


def emit(cards: list[dict]) -> str:
    lines = [
        "/* eslint-disable */",
        "// AUTO-GENERATED by scripts/extract_flashcards.py -- do not edit by hand.",
        "// Short excerpts from local study books. The PDFs themselves are not committed.",
        "// `page` is the printed page in the source book; `confidence` comes from the",
        "// validation pass (high / medium / low) so shaky cards are visible, not hidden.",
        "",
        "import type { FlashcardSeed } from '../models';",
        "",
        "export const FLASHCARD_SEEDS: FlashcardSeed[] = [",
    ]
    for c in cards:
        lines.append(
            f"  {{ deck: {ts(c['deck'])}, section: {ts(c['section'])}, "
            f"question: {ts(c['question'])}, answer: {ts(c['answer'])}, "
            f"quality: {ts(c.get('quality', 'fair'))}, page: {c.get('page', 0)}, "
            f"confidence: {ts(c.get('confidence', 'medium'))} }},"
        )
    lines += ["];", ""]
    return "\n".join(lines)


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="print stats, write nothing")
    ap.add_argument("--sample", type=int, default=0, help="print N sample cards per source")
    ap.add_argument("--only", default="", help="limit to one source (WSP, 400, Green)")
    ap.add_argument("--report", action="store_true", help="write scripts/qa_report.json")
    ap.add_argument("--repair", action="store_true", help="send low-confidence cards to Gemini")
    ap.add_argument("--model", default="gemini-2.5-flash", help="Gemini model for --repair")
    ap.add_argument("--limit", type=int, default=0, help="max cards to repair")
    args = ap.parse_args()

    all_cards: list[dict] = []
    dropped: list[dict] = []

    for src in SOURCES:
        if args.only and src["short"] != args.only:
            continue
        path = src["path"]
        if not os.path.exists(path):
            print(f"  ! {path} not found, skipped")
            continue
        try:
            if src["short"] == "Green":
                cards = parse_green_book(path, src["deck"], src["quality"], dropped)
            elif src.get("text"):
                cards = parse_text_file(path, src["deck"], src["quality"], dropped)
            elif src["short"] == "WSP":
                cards = parse_red_book(path, src["skip_pages"], src["deck"], src["quality"], dropped)
            else:
                cards = parse_400(path, src["skip_pages"], src["deck"], src["quality"], dropped)
        except FileNotFoundError:
            print(f"  ! {path} not found, skipped")
            continue

        all_cards.extend(cards)
        print(f"  {src['short']:<6} {len(cards):>4} cards")
        if args.sample:
            for c in cards[: args.sample]:
                print(f"    p{c.get('page')} [{c['section']}] {c['question'][:100]}")
                print(f"       -> {c['answer'][:180]}")

    # De-duplicate on the question text. Unlike before, keep the first seen but
    # record the duplicate so cross-book repeats stay visible in the report.
    seen: set[str] = set()
    unique: list[dict] = []
    for c in all_cards:
        key = re.sub(r"[^a-z0-9]", "", c["question"].lower())[:90]
        if key and key not in seen:
            seen.add(key)
            unique.append(c)
        else:
            dropped.append({"deck": c["deck"], "page": c.get("page", 0),
                            "question": c["question"], "reason": "duplicate"})

    if args.repair:
        repair_pass(unique, args.model, args.limit)

    print(f"\n  total {len(unique)} unique  ({len(all_cards)} candidates, "
          f"{len(all_cards) - len(unique)} duplicates)")
    print("  by deck:", dict(Counter(c["deck"] for c in unique)))
    print("  by confidence:", dict(Counter(c.get("confidence", "?") for c in unique)))

    print("\n  topics:")
    for s, n in Counter((c["deck"], c["section"]) for c in unique).most_common(20):
        print(f"    {n:>4}  {s[0]} :: {s[1]}")

    if args.report:
        with open(REPORT_PATH, "w", encoding="utf-8") as fh:
            json.dump({"kept": len(unique), "dropped": dropped}, fh, indent=2)
        print(f"\n  wrote {REPORT_PATH} ({len(dropped)} dropped)")
        for reason, n in Counter(d["reason"] for d in dropped).most_common():
            print(f"    {n:>4}  {reason}")

    if args.inspect:
        return 0

    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(emit(unique))
    print(f"\n  wrote {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
