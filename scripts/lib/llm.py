"""OpenRouter client shared by the content-generation scripts.

Mirrors api/_lib/llm.ts so the batch scripts and the live route talk to the
same provider with the same model tiers. Standard library only -- these
scripts already avoid a requirements.txt beyond pdfplumber.

Environment:
    OPENROUTER_API_KEY      required
    OPENROUTER_MODEL_FAST   default anthropic/claude-haiku-4.5
    OPENROUTER_MODEL_SMART  default anthropic/claude-sonnet-5
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

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
TIMEOUT_S = 120
MAX_ATTEMPTS = 5


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
    return bool(os.environ.get("OPENROUTER_API_KEY"))


def model_for(tier: str) -> str:
    if tier == "smart":
        return os.environ.get("OPENROUTER_MODEL_SMART", "anthropic/claude-sonnet-5")
    return os.environ.get("OPENROUTER_MODEL_FAST", "anthropic/claude-haiku-4.5")


def parse_json_loose(raw: str) -> Any:
    """Models wrap JSON in fences or prose often enough to need this.

    Falls back to extracting the outermost balanced object/array.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text)
    try:
        return json.loads(text)
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
                return json.loads(text[start : i + 1])
    raise LlmError("model returned unbalanced JSON")


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
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise LlmError("OPENROUTER_API_KEY is not set (see .env.example)")

    payload: dict[str, Any] = {
        "model": model or model_for(tier),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature if temperature is not None else (0.2 if want_json else 0.6),
    }
    if want_json:
        payload["response_format"] = {"type": "json_object"}

    body = json.dumps(payload).encode("utf-8")
    last_error = ""

    for attempt in range(MAX_ATTEMPTS):
        request = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "X-Title": "Quant-OS content scripts",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:300]
            last_error = f"HTTP {exc.code}: {detail}"
            # 4xx other than rate limiting will not succeed on a retry.
            if exc.code != 429 and exc.code < 500:
                raise LlmError(last_error) from exc
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
