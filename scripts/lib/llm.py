"""LLM client shared by the content-generation scripts.

Mirrors api/_lib/llm.ts so the batch scripts and the live route talk to the
same gateway with the same model tiers. Speaks the OpenAI chat/completions
shape, so it works against 9Router (the local default), OpenRouter, or any
other OpenAI-compatible endpoint. Standard library only -- these scripts
already avoid a requirements.txt beyond pdfplumber.

Environment:
    LLM_API_KEY      required
    LLM_BASE_URL     default http://localhost:20128/v1  (9Router)
    LLM_MODEL_FAST   default ag/gemini-3.8-flash
    LLM_MODEL_SMART  default ag/gemini-3.1-pro-low
"""

from __future__ import annotations

import json
import os
import random
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Iterable

DEFAULT_BASE_URL = "http://localhost:20128/v1"
TIMEOUT_S = 120
MAX_ATTEMPTS = 5

# Thinking models spend part of max_tokens on reasoning before emitting any
# content. Without headroom a request that "should" fit returns truncated JSON
# or nothing at all, which looks like a broken model rather than a budget.
REASONING_HEADROOM = 1500

# A 429 whose reset is further out than this is a real quota wall worth
# aborting on; anything shorter is a rate-limit window to wait out.
QUOTA_WALL_SECONDS = 900


def _reset_seconds(detail: str) -> float | None:
    """Pulls the reset delay out of a 429 body, in seconds.

    Handles both 9Router's "(reset after 4s)" / "(reset after 159h 50m 50s)"
    suffix and the upstream retryDelay field.
    """
    match = re.search(r"reset after\s+([0-9hms\s]+?)\)", detail)
    if match:
        total = 0.0
        for value, unit in re.findall(r"(\d+(?:\.\d+)?)\s*([hms])", match.group(1)):
            total += float(value) * {"h": 3600, "m": 60, "s": 1}[unit]
        if total:
            return total
    match = re.search(r'"retryDelay"\s*:\s*"?([0-9.]+)s', detail)
    return float(match.group(1)) if match else None


class LlmError(RuntimeError):
    """Raised when a call fails in a way retrying will not fix."""


@dataclass
class Usage:
    prompt: int = 0
    completion: int = 0

    def __iadd__(self, other: "Usage") -> "Usage":
        self.prompt += other.prompt
        self.completion += other.completion
        return self


def is_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def endpoint() -> str:
    base = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    return f"{base}/chat/completions"


def models_for(tier: str) -> list[str]:
    """Candidate models for a tier, in preference order.

    The env vars accept a comma-separated list. Free tiers rate-limit hard and
    retire models without notice, so a single id is a single point of failure.
    """
    raw = (os.environ.get("LLM_MODEL_SMART", "ag/gemini-3.1-pro-low") if tier == "smart"
           else os.environ.get("LLM_MODEL_FAST", "ag/gemini-3.8-flash"))
    models = [m.strip() for m in raw.split(",") if m.strip()]
    return models or ["ag/gemini-3.8-flash"]


def model_for(tier: str) -> str:
    """First-choice model for a tier — kept for callers that just want a name."""
    return models_for(tier)[0]


_FALLBACK_PATTERN = re.compile(
    r"quota|429|rate.?limit|unavailable|retired|not found|404|410|no access|capacity|overload",
    re.IGNORECASE,
)


def _worth_falling_back(message: str) -> bool:
    """True for failures another model might not have."""
    return bool(_FALLBACK_PATTERN.search(message))


# JSON permits "\\/bfnrtu after a backslash. Models writing formulas emit things
# like "\(", "\frac" and "\d" inside strings, which is invalid JSON and crashed a
# 749-card run on card 703.
#
# \b and \f are deliberately excluded: they are legal JSON but a backspace or
# formfeed is never what a prose answer means, whereas "\frac" and "\beta"
# certainly are.
_VALID_ESCAPES = set('"\\/nrtu')


def repair_escapes(text: str) -> str:
    """Doubles backslashes that are not part of a valid JSON escape."""
    out = []
    in_string = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '"' and (i == 0 or text[i - 1] != "\\"):
            in_string = not in_string
            out.append(ch)
            i += 1
            continue
        if in_string and ch == "\\" and i + 1 < len(text):
            nxt = text[i + 1]
            if nxt in _VALID_ESCAPES:
                out.append(ch)
                out.append(nxt)
            else:
                # Not a legal escape -- treat it as a literal backslash.
                out.append("\\\\")
                out.append(nxt)
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def parse_json_loose(raw: str) -> Any:
    """Models wrap JSON in fences or prose often enough to need this.

    Falls back to extracting the outermost balanced object/array, and repairs
    illegal backslash escapes before giving up.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        return json.loads(repair_escapes(text))
    except json.JSONDecodeError:
        pass

    match = re.search(r"[\[{]", text)
    if not match:
        raise LlmError("model returned no JSON")
    start = match.start()
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        ch = text[i]
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == opener:
            depth += 1
        elif ch == closer:
            depth -= 1
            if depth == 0:
                candidate = text[start : i + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    try:
                        return json.loads(repair_escapes(candidate))
                    except json.JSONDecodeError as exc:
                        raise LlmError(f"model returned unparseable JSON: {exc}") from exc
    raise LlmError("model returned unbalanced JSON")


def _read_completion(raw: bytes) -> dict:
    """Normalises a completion response into the plain OpenAI JSON shape.

    9Router replies with text/event-stream even when streaming was not
    requested, so a bare json.loads fails on every call. Reassemble the deltas
    when that happens, and surface an error chunk rather than returning empty.
    """
    text = raw.decode("utf-8", "replace").strip()
    if not text:
        raise LlmError("gateway returned an empty response")

    if not text.startswith("data:"):
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LlmError(f"gateway returned non-JSON: {text[:200]}") from exc

    content: list[str] = []
    usage: dict = {}
    finish = None
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            chunk = json.loads(payload)
        except json.JSONDecodeError:
            continue
        if chunk.get("error"):
            raise LlmError(str(chunk["error"])[:300])
        if chunk.get("usage"):
            usage = chunk["usage"]
        for choice in chunk.get("choices") or []:
            content.append((choice.get("delta") or {}).get("content") or "")
            finish = choice.get("finish_reason") or finish

    joined = "".join(content)
    if not joined:
        # Thinking models spend the budget on reasoning tokens first; an empty
        # body with a length stop is almost always max_tokens set too low.
        reasoning = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens", 0)
        hint = f" (spent {reasoning} reasoning tokens -- raise max_tokens)" if reasoning else ""
        raise LlmError(f"model produced no content, finish_reason={finish}{hint}")

    return {"choices": [{"message": {"content": joined}}], "usage": usage}


def chat(
    *,
    system: str,
    user: str,
    tier: str = "fast",
    model: str | None = None,
    max_tokens: int = 2000,
    temperature: float | None = None,
    want_json: bool = True,
    usage: Usage | None = None,
) -> Any:
    """One chat completion. Returns parsed JSON when want_json, else the text.

    Retries on 429 and 5xx with exponential backoff plus jitter, because a long
    batch run will hit rate limits and losing the whole run to one 429 is the
    difference between a script you use and one you don't.
    """
    key = os.environ.get("LLM_API_KEY")
    if not key:
        raise LlmError("LLM_API_KEY is not set (see .env.example)")

    candidates = [model] if model else models_for(tier)
    last_failure = ""
    for candidate in candidates:
        try:
            return _chat_once(
                system=system, user=user, model=candidate, max_tokens=max_tokens,
                temperature=temperature, want_json=want_json, usage=usage, key=key,
            )
        except LlmError as exc:
            last_failure = str(exc)
            # A malformed prompt fails identically everywhere; only fall through
            # when the failure is about this model's availability.
            if not _worth_falling_back(last_failure):
                raise
            if candidate != candidates[-1]:
                print(f"    ! {candidate} unavailable, trying next: {last_failure[:90]}")
    raise LlmError(last_failure or "no models configured")


def _chat_once(
    *,
    system: str,
    user: str,
    model: str,
    max_tokens: int,
    temperature: float | None,
    want_json: bool,
    usage: Usage | None,
    key: str,
) -> Any:

    payload: dict[str, Any] = {
        "model": model or model_for(tier),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens + REASONING_HEADROOM,
        "temperature": temperature if temperature is not None else (0.2 if want_json else 0.6),
    }
    if want_json:
        payload["response_format"] = {"type": "json_object"}

    body = json.dumps(payload).encode("utf-8")
    last_error = ""

    for attempt in range(MAX_ATTEMPTS):
        request = urllib.request.Request(
            endpoint(),
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "X-Title": "Quant-OS content scripts",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                data = _read_completion(response.read())
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            last_error = f"HTTP {exc.code}: {detail}"
            # Distinguish a short rate-limit window from a real quota wall.
            # 9Router reports both as 429 but includes the reset delay, and
            # "reset after 4s" must be waited out, not treated as fatal --
            # failing fast on those aborted a 749-card run two thirds through.
            if "quota" in detail.lower() or "RESOURCE_EXHAUSTED" in detail:
                reset = _reset_seconds(detail)
                if reset is None or reset > QUOTA_WALL_SECONDS:
                    raise LlmError(f"model quota exhausted: {detail[:200]}") from exc
                time.sleep(min(reset, 30) + 1 + random.random())
                continue
            # 4xx other than rate limiting will not succeed on a retry.
            if exc.code != 429 and exc.code < 500:
                raise LlmError(last_error) from exc
        except LlmError:
            raise
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = str(exc)
        if attempt == MAX_ATTEMPTS - 1:
            raise LlmError(f"giving up after {MAX_ATTEMPTS} attempts -- {last_error}")
        time.sleep(min(2**attempt, 20) + random.random())

    if "error" in data and data["error"]:
        raise LlmError(str(data["error"]))

    if usage is not None:
        reported = data.get("usage") or {}
        usage += Usage(
            prompt=reported.get("prompt_tokens", 0),
            completion=reported.get("completion_tokens", 0),
        )

    choices: Iterable[dict[str, Any]] = data.get("choices") or []
    text = next(iter(choices), {}).get("message", {}).get("content")
    if not text:
        raise LlmError("model returned an empty response")

    return parse_json_loose(text) if want_json else text
