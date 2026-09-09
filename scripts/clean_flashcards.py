#!/usr/bin/env python3
"""Repair and re-tag the extracted flashcard deck.

WHY
    scripts/extract_flashcards.py pulls Q/A pairs out of the source PDFs using
    layout signals. That works for the questions but frequently mangles the
    answers: the parser splices in sidebar text, table fragments and callouts,
    and truncates mid-sentence. 447 of the 749 cards are flagged medium or low
    confidence, and plenty of the "high" ones are run-on paragraphs covering
    three unrelated points.

    This pass sends each card to an LLM with its raw page text and asks for a
    clean, self-contained answer built only from that source text -- plus a
    role tag, so the deck can be drilled as quant / markets / IB rather than
    all 749 at once.

IDS
    cardId() in src/data/flashcards.ts is an FNV hash of the QUESTION text, so
    repairing a mangled question changes the id and would silently orphan the
    user's SRS progress. Every card therefore carries legacyIds: the hashes of
    its previous question forms. hydrate() remaps progress through them.

USAGE
    export LLM_API_KEY=...                     # see .env.example
    python3 scripts/clean_flashcards.py --inspect --sample 20   # read before writing
    python3 scripts/clean_flashcards.py                         # full run, resumable
    python3 scripts/clean_flashcards.py --only "Green Book"     # one deck

    The run checkpoints after every card, so a crash or a rate limit costs
    nothing: re-running picks up where it stopped.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import llm  # noqa: E402

SEEDS_PATH = Path("src/data/flashcards.generated.ts")
OUT_PATH = Path("src/data/flashcards.generated.ts")
CHECKPOINT = Path("scripts/.clean_checkpoint.json")
MIN_ANSWER = 40

SYSTEM = """You are repairing a flashcard extracted from a finance or quant interview book by a PDF parser. The parser interleaves sidebar text, table fragments and callouts into the answer, and often truncates mid-sentence. The question may also be corrupted -- two questions run together, or a trailing fragment from the next heading.

Your job is to produce a clean, correct, self-contained card.

RULES
- Ground the answer in the supplied text. Do not introduce facts that are not there or implied by it.
- If the supplied text is too mangled to support a correct answer, set "ok": false. A dropped card is much better than a card that teaches something wrong.
- Repair the question if it is garbled: keep the interviewer's actual question, drop spliced fragments.
- The answer must read like a strong candidate's spoken answer: 2-6 sentences, or up to 6 short bullets when the content is genuinely a list. Lead with the direct answer, then the reasoning.
- Strip all artefacts: "Read More ->", figure and page references, "IS:" / "CFS:" / "BS:" style inline labels that were table headers, and repeated boilerplate.
- Preserve real formulas. Write them inline in plain text (e.g. "C - P = S - Ke^(-rT)").
- Do not add a preamble, and do not restate the question.

TAGS
- role: "quant" for probability, statistics, stochastic calculus, brainteasers, algorithms, derivatives pricing and market-making. "markets" for macro, asset classes, trading and market structure. "ib" for accounting, valuation, DCF, LBO, M&A and other banking content.
- difficulty: "beginner" | "intermediate" | "advanced", judged against a first-round internship interview.
- topic: a short, specific topic name (2-4 words). Prefer the book's own section name when it is already specific; replace it when it is vague.

Respond with a single JSON object and nothing else:
{"ok": true, "question": "...", "answer": "...", "topic": "...", "role": "quant|markets|ib", "difficulty": "beginner|intermediate|advanced"}
or {"ok": false, "reason": "why this card cannot be salvaged"}"""

USER = """BOOK: {deck}
BOOK SECTION: {section}
PRINTED PAGE: {page}

QUESTION AS EXTRACTED:
{question}

ANSWER AS EXTRACTED (likely mangled):
{answer}"""


# --------------------------------------------------------------------------- io

def fnv1a(text: str) -> str:
    """Mirrors cardId() in src/data/flashcards.ts -- must stay in sync."""
    h = 2166136261
    for ch in text.lower():
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return f"fc-{_b36(h)}"


def _b36(n: int) -> str:
    if n == 0:
        return "0"
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = digits[r] + out
    return out


def ts_object_to_json(line: str) -> str:
    """Quote the keys of a TS object literal, ignoring anything inside strings.

    A regex cannot do this: answers legitimately contain text like
    `, IS: When depreciation increases`, and a naive key-quoting pass rewrites
    that into `,"IS": ...` and corrupts the string.
    """
    out = []
    in_string = False
    escaped = False
    i = 0
    while i < len(line):
        ch = line[i]
        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue
        # Outside a string: an identifier immediately followed by ':' is a key.
        match = re.match(r"([A-Za-z_][A-Za-z0-9_]*)\s*:", line[i:])
        if match and (not out or out[-1] in "{,[ "):
            out.append(f'"{match.group(1)}":')
            i += match.end()
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def load_seeds(path: Path) -> list[dict]:
    """Parses the generated module. Each card is one `{ ... },` line."""
    cards = []
    failures = 0
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line.startswith("{") or not line.endswith("},"):
            continue
        try:
            cards.append(json.loads(ts_object_to_json(line[:-1])))
        except json.JSONDecodeError as e:
            failures += 1
            print(f"  ! could not parse a card line: {e}")
    if failures:
        raise SystemExit(
            f"{failures} card line(s) failed to parse -- refusing to continue, "
            "since a partial read would silently drop cards."
        )
    return cards


def ts(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit(cards: list[dict]) -> str:
    head = [
        "/* eslint-disable */",
        "// AUTO-GENERATED by scripts/extract_flashcards.py, then repaired and",
        "// re-tagged by scripts/clean_flashcards.py -- do not edit by hand.",
        "//",
        "// Short excerpts from local study books. The PDFs are never committed.",
        "// `legacyIds` holds the FNV hashes of this card's previous question text,",
        "// so hydrate() can carry existing SRS progress across a re-clean.",
        "",
        "import type { FlashcardSeed } from '../models';",
        "",
        "export const FLASHCARD_SEEDS: FlashcardSeed[] = [",
    ]
    body = []
    for c in cards:
        parts = [
            f'deck: {ts(c["deck"])}',
            f'section: {ts(c["section"])}',
            f'question: {ts(c["question"])}',
            f'answer: {ts(c["answer"])}',
        ]
        if c.get("role"):
            parts.append(f'role: {ts(c["role"])}')
        if c.get("difficulty"):
            parts.append(f'difficulty: {ts(c["difficulty"])}')
        parts.append(f'quality: {ts(c.get("quality", "fair"))}')
        if c.get("page"):
            parts.append(f'page: {c["page"]}')
        parts.append(f'confidence: {ts(c.get("confidence", "medium"))}')
        legacy = [i for i in c.get("legacyIds", []) if i != fnv1a(c["question"])]
        if legacy:
            parts.append(f'legacyIds: [{", ".join(ts(i) for i in legacy)}]')
        body.append("  { " + ", ".join(parts) + " },")
    return "\n".join(head + body + ["];", ""])


# ------------------------------------------------------------------------ clean

def clean_one(card: dict, usage: llm.Usage, model: str | None) -> dict | None:
    out = llm.chat(
        system=SYSTEM,
        user=USER.format(
            deck=card.get("deck", ""),
            section=card.get("section", ""),
            page=card.get("page", "?"),
            question=card.get("question", ""),
            answer=(card.get("answer") or "")[:6000],
        ),
        model=model,
        tier="smart",
        max_tokens=2000,
        usage=usage,
    )
    if not isinstance(out, dict) or not out.get("ok"):
        return None
    question = (out.get("question") or "").strip()
    answer = (out.get("answer") or "").strip()
    if len(question) < 10 or len(answer) < MIN_ANSWER:
        return None
    # A truncated answer is worse than no card: it reads as complete and
    # teaches half a mechanism. Require terminal punctuation.
    if answer.rstrip()[-1] not in ".!?)\"'":
        return None
    return {
        **card,
        "question": question,
        "answer": answer,
        "section": (out.get("topic") or card.get("section") or "").strip(),
        "role": out.get("role"),
        "difficulty": out.get("difficulty"),
        "quality": "high",
        "confidence": "high",
        # The pre-clean id, so existing SRS progress survives the rewrite.
        "legacyIds": sorted({*card.get("legacyIds", []), fnv1a(card["question"])}),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="print results, write nothing")
    ap.add_argument("--sample", type=int, default=0, help="only process N cards")
    ap.add_argument("--only", default="", help="substring match on the deck name")
    ap.add_argument("--model", default=None, help="override $LLM_MODEL_SMART")
    ap.add_argument("--restart", action="store_true", help="discard the checkpoint")
    ap.add_argument("--partial", action="store_true",
                    help="write even though some cards were never processed (loses them)")
    args = ap.parse_args()

    if not llm.is_configured():
        print("LLM_API_KEY is not set. See .env.example.")
        return 1
    if not SEEDS_PATH.exists():
        print(f"{SEEDS_PATH} not found -- run extract_flashcards.py first.")
        return 1

    cards = load_seeds(SEEDS_PATH)
    print(f"loaded {len(cards)} cards from {SEEDS_PATH}")

    if args.restart and CHECKPOINT.exists():
        CHECKPOINT.unlink()
    done: dict[str, dict] = {}
    dropped: list[dict] = []
    if CHECKPOINT.exists():
        saved = json.loads(CHECKPOINT.read_text())
        done = saved.get("done", {})
        dropped = saved.get("dropped", [])
        print(f"resuming: {len(done)} already cleaned, {len(dropped)} already dropped")

    targets = [c for c in cards if args.only.lower() in c.get("deck", "").lower()]
    seen = {d["id"] for d in dropped}
    pending = [c for c in targets if fnv1a(c["question"]) not in done and fnv1a(c["question"]) not in seen]
    if args.sample:
        pending = pending[: args.sample]

    print(f"{len(pending)} card(s) to process with {args.model or llm.model_for('smart')}\n")
    usage = llm.Usage()

    for n, card in enumerate(pending, 1):
        key = fnv1a(card["question"])
        label = card["question"][:70].replace("\n", " ")
        try:
            cleaned = clean_one(card, usage, args.model)
        except llm.LlmError as e:
            print(f"[{n}/{len(pending)}] ! {e}")
            continue
        except Exception as e:  # noqa: BLE001 - one bad card must not end the run
            print(f"[{n}/{len(pending)}] ! unexpected {type(e).__name__}: {e}")
            continue

        if cleaned is None:
            dropped.append({"id": key, "question": card["question"][:200], "deck": card.get("deck")})
            print(f"[{n}/{len(pending)}] DROP  {label}")
        else:
            done[key] = cleaned
            print(f"[{n}/{len(pending)}] ok    [{cleaned['role']}/{cleaned['difficulty']}] {label}")
            if args.inspect:
                print(f"           Q: {cleaned['question']}")
                print(f"           A: {cleaned['answer'][:400]}")
                print(f"           topic: {cleaned['section']}\n")

        if not args.inspect:
            CHECKPOINT.write_text(json.dumps({"done": done, "dropped": dropped}, ensure_ascii=False))

    print(f"\ncleaned {len(done)} | dropped {len(dropped)} | tokens {usage.prompt} in / {usage.completion} out")

    if args.inspect:
        print("\n--inspect: nothing written.")
        return 0

    if args.sample or args.only:
        print("\n--sample/--only is a partial run; not overwriting the deck. "
              "The work is checkpointed -- re-run without those flags to finish and write.")
        return 0

    # Preserve the original deck order for cards that survived.
    final = [done[fnv1a(c["question"])] for c in cards if fnv1a(c["question"]) in done]

    # A card that was never processed is NOT the same as one deliberately
    # dropped, and conflating the two is how a rate limit two thirds of the way
    # through silently truncated the deck from 749 to 395. Only write when
    # every card has been accounted for.
    dropped_ids = {d["id"] for d in dropped}
    unprocessed = [c for c in cards
                   if fnv1a(c["question"]) not in done and fnv1a(c["question"]) not in dropped_ids]
    if unprocessed and not args.partial:
        print(f"\nRefusing to write: {len(unprocessed)} card(s) were never processed "
              f"(cleaned {len(final)}, dropped {len(dropped)}, of {len(cards)}).")
        print("Re-run to finish them -- the checkpoint resumes where this stopped. "
              "Use --partial only if you genuinely intend to discard them.")
        return 1

    if len(final) < len(cards) * 0.5:
        print(f"\nRefusing to write: only {len(final)}/{len(cards)} cards survived cleaning. "
              "Investigate before overwriting the deck.")
        return 1

    OUT_PATH.write_text(emit(final))
    roles: dict[str, int] = {}
    for c in final:
        roles[c.get("role") or "untagged"] = roles.get(c.get("role") or "untagged", 0) + 1
    print(f"wrote {len(final)} cards to {OUT_PATH}")
    print("by role:", ", ".join(f"{k} {v}" for k, v in sorted(roles.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
