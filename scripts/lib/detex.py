"""Convert LaTeX fragments in generated card text into readable plain text.

The card prompts ask for plain-text formulas, but models fall back to LaTeX on
harder topics anyway -- 23% of the generated quant bank came back with \\[ ... \\]
blocks. The drill renders answers as plain text, so that would display as
literal backslashes.

This is deliberately a readability pass, not a maths renderer: the goal is a
line a person can read on a flashcard, not typeset output.
"""

from __future__ import annotations

import re

# Symbols worth spelling out, since the plain-text card is read, not parsed.
_SYMBOLS = {
    r"\\alpha": "alpha", r"\\beta": "beta", r"\\gamma": "gamma", r"\\delta": "delta",
    r"\\epsilon": "epsilon", r"\\varepsilon": "epsilon", r"\\theta": "theta",
    r"\\lambda": "lambda", r"\\mu": "mu", r"\\nu": "nu", r"\\pi": "pi",
    r"\\rho": "rho", r"\\sigma": "sigma", r"\\tau": "tau", r"\\phi": "phi",
    r"\\omega": "omega", r"\\Delta": "Delta", r"\\Sigma": "Sigma",
    r"\\Omega": "Omega", r"\\Pi": "Pi", r"\\Gamma": "Gamma",
    r"\\infty": "infinity", r"\\partial": "d", r"\\cdot": "*", r"\\times": "x",
    r"\\leq": "<=", r"\\geq": ">=", r"\\neq": "!=", r"\\approx": "~=",
    r"\\le": "<=", r"\\ge": ">=", r"\\ne": "!=", r"\\lt": "<", r"\\gt": ">",
    r"\\to": "->", r"\\rightarrow": "->", r"\\Rightarrow": "=>",
    r"\\in": " in ", r"\\sim": " ~ ", r"\\pm": "+/-", r"\\ldots": "...",
    r"\\dots": "...", r"\\quad": " ", r"\\qquad": "  ",
    r"\\left": "", r"\\right": "", r"\\bigl": "", r"\\bigr": "",
    r"\\Bigl": "", r"\\Bigr": "", r"\\displaystyle": "",
}

# Spacing commands whose next character is often a letter (\,dt), so they must
# NOT carry the word-boundary lookahead the named symbols use.
_SPACING = {r"\\,": " ", r"\\;": " ", r"\\:": " ", r"\\!": "", r"\\ ": " "}


def _strip_braces(text: str) -> str:
    """Turn {x} into x where the braces are only LaTeX grouping."""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"\{([^{}]*)\}", r"\1", text)
    return text


def detex(text: str) -> str:
    if "\\" not in text and "$" not in text:
        return text

    out = text

    # Display and inline maths delimiters -> plain inline text.
    out = re.sub(r"\\\[\s*", " ", out)
    out = re.sub(r"\s*\\\]", " ", out)
    out = re.sub(r"\\\(\s*", "", out)
    out = re.sub(r"\s*\\\)", "", out)
    out = re.sub(r"\$\$?", "", out)

    # Structures that need their arguments reordered.
    out = re.sub(r"\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}", r"(\1)/(\2)", out)
    out = re.sub(r"\\dfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}", r"(\1)/(\2)", out)
    out = re.sub(r"\\sqrt\s*\{([^{}]*)\}", r"sqrt(\1)", out)
    out = re.sub(r"\\text(?:rm|bf|it)?\s*\{([^{}]*)\}", r"\1", out)
    out = re.sub(r"\\mathrm\s*\{([^{}]*)\}", r"\1", out)
    out = re.sub(r"\\mathbb\s*\{([^{}]*)\}", r"\1", out)
    out = re.sub(r"\\operatorname\s*\{([^{}]*)\}", r"\1", out)
    out = re.sub(r"\\(?:sum|int)\s*_\s*\{([^{}]*)\}\s*\^\s*\{([^{}]*)\}",
                 lambda mm: ("sum" if "sum" in mm.group(0) else "integral") + f" from {mm.group(1)} to {mm.group(2)} of ", out)
    out = re.sub(r"\\sum", "sum", out)
    out = re.sub(r"\\int", "integral", out)
    out = re.sub(r"\\exp\s*\{([^{}]*)\}", r"exp(\1)", out)
    out = re.sub(r"\\log|\\ln|\\max|\\min|\\lim|\\Pr", lambda mm: mm.group(0)[1:], out)

    for pattern, replacement in _SPACING.items():
        out = re.sub(pattern, replacement, out)
    # Longest first, so \leq is not matched as \le followed by "q".
    for pattern in sorted(_SYMBOLS, key=len, reverse=True):
        out = re.sub(pattern + r"(?![A-Za-z])", _SYMBOLS[pattern], out)

    # Environments: keep the rows, drop the scaffolding.
    out = re.sub(r"\\begin\{[^}]*\}|\\end\{[^}]*\}", " ", out)
    out = out.replace("\\\\", " ")
    out = out.replace("&", " ")

    # Sub/superscripts: x^{2} -> x^2, x_{i} -> x_i.
    out = re.sub(r"\^\s*\{([^{}]*)\}", r"^(\1)", out)
    out = re.sub(r"_\s*\{([^{}]*)\}", r"_\1", out)
    out = re.sub(r"\^\((\w)\)", r"^\1", out)

    out = _strip_braces(out)

    # Anything left is a command we do not handle; drop the backslash rather
    # than leave it on screen.
    out = re.sub(r"\\([A-Za-z]+)", r"\1", out)
    out = out.replace("\\", "")

    out = re.sub(r"[ \t]{2,}", " ", out)
    out = re.sub(r" +([,.;:)])", r"\1", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()
