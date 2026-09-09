#!/usr/bin/env python3
"""Independently re-solve every numeric quiz answer, and drop the ones that fail.

WHY
    Spot-checking the generated modules turned up a put-call parity question
    whose stored answer was 8.71 when the correct value is 10.35. A wrong
    answer key is worse than no question at all: it marks correct work as
    incorrect and teaches the wrong number.

    Prose can be read and judged. A numeric key cannot -- you only find out it
    is wrong when it contradicts you. So each one is re-derived here.

HOW
    Every numeric question is solved twice more, from the prompt alone, with
    the stored answer hidden. Then:
      - all three agree            -> keep
      - the two fresh solves agree with each other but not the stored answer
                                   -> replace the stored answer
      - the fresh solves disagree  -> nobody is confident; drop the question

USAGE
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
    python3 scripts/verify_quiz.py --dry-run
    python3 scripts/verify_quiz.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import llm  # noqa: E402

CHECKPOINT = Path("scripts/.modules_checkpoint.json")
REPORT = Path("scripts/quiz_verification.json")

SYSTEM = """You are solving a single quantitative problem. Work it out carefully and completely.

Respond with a single JSON object and nothing else:
{"working": "your derivation, briefly", "answer": <the final numeric value as a number>, "confident": true|false}

Set "confident" to false if the question is ambiguous, underspecified, or you cannot reach a single defensible number. Do not guess."""


def solve(prompt: str, model: str | None, usage: llm.Usage) -> float | None:
    try:
        out = llm.chat(system=SYSTEM, user=prompt, model=model, max_tokens=2500,
                       temperature=0.3, usage=usage)
    except llm.LlmError:
        return None
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(out, dict) or not out.get("confident"):
        return None
    try:
        return float(out["answer"])
    except (TypeError, ValueError, KeyError):
        return None


def close(a: float, b: float, rel: float = 0.02) -> bool:
    """Agreement within 2% relative, with an absolute floor for values near zero."""
    return abs(a - b) <= max(abs(a) * rel, abs(b) * rel, 1e-6)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report only, change nothing")
    ap.add_argument("--model", default=None)
    args = ap.parse_args()

    if not llm.is_configured():
        print("LLM_API_KEY is not set.")
        return 1
    if not CHECKPOINT.exists():
        print("No module checkpoint — run generate_modules.py first.")
        return 1

    data = json.loads(CHECKPOINT.read_text())
    targets = [(mid, q) for mid, m in data.items() for q in m["quiz"] if q["kind"] == "numeric"]
    model = args.model or llm.model_for("smart")
    print(f"{len(targets)} numeric question(s) to verify with {model}\n")

    usage = llm.Usage()
    kept, fixed, dropped = [], [], []

    for n, (mid, q) in enumerate(targets, 1):
        stored = float(q["answer"])
        a = solve(q["prompt"], model, usage)
        b = solve(q["prompt"], model, usage)

        if a is None or b is None or not close(a, b):
            dropped.append({"module": mid, "id": q["id"], "stored": stored,
                            "solves": [a, b], "reason": "independent solves disagree"})
            print(f"[{n}/{len(targets)}] DROP  {q['id']}: stored {stored}, solves {a} / {b}")
            continue

        consensus = (a + b) / 2
        if close(consensus, stored):
            kept.append(q["id"])
            print(f"[{n}/{len(targets)}] ok    {q['id']}")
        else:
            fixed.append({"module": mid, "id": q["id"], "was": stored, "now": consensus})
            print(f"[{n}/{len(targets)}] FIX   {q['id']}: {stored} -> {consensus}")
            if not args.dry_run:
                q["answer"] = f"{consensus:g}"
                q.pop("tolerance", None)

    print(f"\nkept {len(kept)} | corrected {len(fixed)} | dropped {len(dropped)}")
    REPORT.write_text(json.dumps({"kept": kept, "fixed": fixed, "dropped": dropped},
                                 ensure_ascii=False, indent=2))
    print(f"report written to {REPORT}")

    if args.dry_run:
        print("--dry-run: checkpoint unchanged.")
        return 0

    drop_ids = {d["id"] for d in dropped}
    for m in data.values():
        m["quiz"] = [q for q in m["quiz"] if q["id"] not in drop_ids]

    CHECKPOINT.write_text(json.dumps(data, ensure_ascii=False))
    print("checkpoint updated — re-run generate_modules.py to re-emit the module file.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
