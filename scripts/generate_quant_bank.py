#!/usr/bin/env python3
"""Generate a quant interview question bank.

WHY
    The extracted deck is 595 investment-banking cards against 154 quant ones.
    For a quant/trading target that ratio is backwards, and no amount of
    cleaning fixes it -- the source books are banking books. This writes a
    purpose-built quant bank to sit alongside them.

    Output is committed as a normal seed module, so it ships to production with
    no runtime AI cost, exactly like the extracted deck.

USAGE
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
    python3 scripts/generate_quant_bank.py --inspect --topics 2   # read first
    python3 scripts/generate_quant_bank.py                        # full run

    Resumable: the checkpoint is written after every topic.

A NOTE ON TRUST
    Generated questions are a draft, not truth. The prompt refuses questions
    whose answer the model is not certain of, and every card is tagged
    `confidence: "medium"` so a wrong one is visibly less trustworthy than a
    book-sourced card. Spot-check before relying on them in an interview.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import llm  # noqa: E402

OUT_PATH = Path("src/data/quantbank.generated.ts")
CHECKPOINT = Path("scripts/.quantbank_checkpoint.json")
DECK_NAME = "Quant Bank (generated)"

# (topic, how many, difficulty skew, what to cover)
TOPICS: list[tuple[str, int, str, str]] = [
    ("Probability Fundamentals", 12, "beginner", "sample spaces, conditional probability, Bayes, independence, inclusion-exclusion, symmetry arguments"),
    ("Expected Value", 12, "intermediate", "linearity of expectation, indicator variables, expected value of games, optional stopping, wald's identity"),
    ("Discrete Distributions", 10, "intermediate", "binomial, poisson, geometric, negative binomial, hypergeometric, when each applies"),
    ("Continuous Distributions", 10, "intermediate", "normal, exponential, uniform, memorylessness, order statistics, transformations"),
    ("Random Walks and Martingales", 10, "advanced", "gambler's ruin, hitting times, martingale property, optional stopping theorem, reflection principle"),
    ("Markov Chains", 8, "advanced", "transition matrices, stationary distributions, absorbing states, expected hitting times"),
    ("Combinatorics and Counting", 10, "intermediate", "permutations, combinations, stars and bars, pigeonhole, derangements"),
    ("Brainteasers and Logic", 12, "intermediate", "classic interview puzzles requiring an insight rather than computation"),
    ("Statistics and Estimation", 10, "intermediate", "estimators, bias and variance, MLE, confidence intervals, hypothesis tests, p-values"),
    ("Regression and Correlation", 10, "intermediate", "OLS assumptions, interpretation of coefficients, R-squared, multicollinearity, omitted variable bias"),
    ("Linear Algebra", 8, "intermediate", "eigenvalues, positive definiteness, rank, projections, covariance matrices, PCA"),
    ("Stochastic Calculus", 10, "advanced", "brownian motion, ito's lemma, quadratic variation, SDEs, geometric brownian motion, girsanov"),
    ("Options Pricing", 12, "advanced", "black-scholes, put-call parity, risk-neutral pricing, binomial trees, early exercise, dividends"),
    ("The Greeks and Hedging", 10, "advanced", "delta, gamma, vega, theta, delta hedging P&L, gamma scalping, the variance risk premium"),
    ("Volatility", 10, "advanced", "realised vs implied, skew and smile, term structure, vol of vol, variance swaps"),
    ("Market Making", 10, "intermediate", "bid-ask spread, inventory risk, adverse selection, quoting a market, edge and P&L"),
    ("Market Microstructure", 8, "intermediate", "order types, limit order books, slippage, market impact, latency, execution algorithms"),
    ("Portfolio and Risk", 10, "intermediate", "sharpe ratio, diversification, VaR, expected shortfall, kelly criterion, correlation risk"),
    ("Mental Math and Estimation", 10, "beginner", "fast arithmetic tricks, percentage and compounding shortcuts, fermi estimation"),
    ("Algorithms for Quant Roles", 10, "intermediate", "complexity analysis, sliding windows, heaps, dynamic programming, numerical stability, floating point"),
]

SYSTEM = """You write technical interview questions for quantitative trading and quantitative research internships, at the level Optiver, SIG, Jane Street, IMC, Citadel and Jump actually ask.

RULES
- Every question must be self-contained, unambiguous, and answerable in under five minutes with pen and paper.
- Every answer must be CORRECT and must show the reasoning, not just the result. A bare number teaches nothing.
- If you are not certain a numeric result is right, ask a different question. A wrong card is much worse than a missing one.
- Prefer questions that require an insight or a derivation over questions that test recall of a definition.
- Vary difficulty across the set, and vary the form: some computational, some conceptual, some "how would you think about this".
- Do not repeat any question in the exclusion list, including reworded versions of the same problem.
- Use plain text for formulas, written inline (e.g. "E[X] = n*p", "C - P = S - K*e^(-rT)").
- No preamble in the answer, and do not restate the question.

Respond with a single JSON object and nothing else:
{"questions": [{"q": "...", "a": "...", "difficulty": "beginner|intermediate|advanced", "topic": "a specific 2-4 word sub-topic"}]}"""

USER = """TOPIC: {topic}
COVER: {cover}
DIFFICULTY SKEW: {difficulty}
WRITE: {count} questions

{exclude}"""


def ts(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit(cards: list[dict]) -> str:
    head = [
        "/* eslint-disable */",
        "// AUTO-GENERATED by scripts/generate_quant_bank.py -- do not edit by hand.",
        "//",
        "// A purpose-built quant bank. The extracted book deck is overwhelmingly",
        "// investment-banking content, which is the wrong drill for a quant target;",
        "// these cards rebalance it.",
        "//",
        "// Generated, therefore `confidence: \"medium\"` -- less trustworthy than a",
        "// card traceable to a printed page. Spot-check before relying on one.",
        "",
        "import type { FlashcardSeed } from '../models';",
        "",
        "export const QUANT_BANK_SEEDS: FlashcardSeed[] = [",
    ]
    body = [
        "  { "
        + ", ".join([
            f'deck: {ts(DECK_NAME)}',
            f'section: {ts(c["section"])}',
            f'question: {ts(c["question"])}',
            f'answer: {ts(c["answer"])}',
            'role: "quant"',
            f'difficulty: {ts(c.get("difficulty", "intermediate"))}',
            'quality: "high"',
            'confidence: "medium"',
        ])
        + " },"
        for c in cards
    ]
    return "\n".join(head + body + ["];", ""])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true", help="print results, write nothing")
    ap.add_argument("--topics", type=int, default=0, help="only process the first N topics")
    ap.add_argument("--model", default=None)
    ap.add_argument("--restart", action="store_true")
    args = ap.parse_args()

    if not llm.is_configured():
        print("LLM_API_KEY is not set. See .env.example.")
        return 1

    if args.restart and CHECKPOINT.exists():
        CHECKPOINT.unlink()
    done: dict[str, list[dict]] = {}
    if CHECKPOINT.exists():
        done = json.loads(CHECKPOINT.read_text())
        print(f"resuming: {len(done)} topic(s) already generated")

    topics = TOPICS[: args.topics] if args.topics else TOPICS
    model = args.model or llm.model_for("fast")
    usage = llm.Usage()
    print(f"{len(topics)} topic(s), model {model}\n")

    for n, (topic, count, difficulty, cover) in enumerate(topics, 1):
        if topic in done:
            print(f"[{n}/{len(topics)}] skip (done) {topic}")
            continue

        # Exclude everything already written, so topics do not overlap.
        seen = [q["question"] for cards in done.values() for q in cards]
        exclude = ""
        if seen:
            exclude = "ALREADY ASKED -- do not repeat these or reworded versions:\n" + "\n".join(
                f"- {q}" for q in seen[-120:]
            )

        try:
            out = llm.chat(
                system=SYSTEM,
                user=USER.format(topic=topic, cover=cover, difficulty=difficulty, count=count, exclude=exclude),
                model=model,
                max_tokens=6000,
                usage=usage,
            )
        except llm.LlmError as e:
            print(f"[{n}/{len(topics)}] ! {topic}: {e}")
            continue

        rows = out.get("questions") if isinstance(out, dict) else None
        if not rows:
            print(f"[{n}/{len(topics)}] ! {topic}: no questions returned")
            continue

        cards = []
        for r in rows:
            q = (r.get("q") or "").strip()
            a = (r.get("a") or "").strip()
            if len(q) < 15 or len(a) < 40:
                continue
            # Reject truncated answers: they read as complete and teach half a method.
            if a[-1] not in ".!?)\"'":
                continue
            cards.append({
                "question": q,
                "answer": a,
                "section": (r.get("topic") or topic).strip(),
                "difficulty": r.get("difficulty", difficulty),
            })

        done[topic] = cards
        print(f"[{n}/{len(topics)}] {topic}: {len(cards)} card(s)")
        if args.inspect:
            for c in cards[:3]:
                print(f"      Q: {c['question']}")
                print(f"      A: {c['answer'][:300]}")
                print(f"      [{c['difficulty']}] {c['section']}\n")
        if not args.inspect:
            CHECKPOINT.write_text(json.dumps(done, ensure_ascii=False))

    total = [c for cards in done.values() for c in cards]
    print(f"\n{len(total)} card(s) across {len(done)} topic(s) | tokens {usage.prompt} in / {usage.completion} out")

    if args.inspect:
        print("--inspect: nothing written.")
        return 0

    # Drop exact duplicate questions across topics.
    seen_q: set[str] = set()
    unique = []
    for c in total:
        key = c["question"].lower().strip()
        if key in seen_q:
            continue
        seen_q.add(key)
        unique.append(c)

    OUT_PATH.write_text(emit(unique))
    print(f"wrote {len(unique)} unique card(s) to {OUT_PATH} ({len(total) - len(unique)} duplicate(s) dropped)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
