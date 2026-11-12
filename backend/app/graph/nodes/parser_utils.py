import re
from typing import Optional

def parse_financial_number(text: str) -> Optional[float]:
    """
    RULES.md #20:
    Handle (1,234) negatives, — as zero, $ and footnote markers,
    commas, extra whitespace.
    """
    if not text:
        return None
    cleaned = text.strip()

    # Em-dash, en-dash, or hyphen as zero
    if cleaned in ("—", "-", "–", "‐", "None", "nil"):
        return 0.0

    # Remove currency signs and spaces
    cleaned = re.sub(r"[\$,\s]", "", cleaned)

    # Footnote markers like (1) or [a] or footnote characters
    # If the whole string is in parentheses (1,234), it is a negative number
    # If it is a number followed by footnote marker like 1234(1)
    # Check parenthetical negative first
    paren_match = re.match(r"^\(([0-9\.]+)\)$", cleaned)
    if paren_match:
        try:
            return -float(paren_match.group(1))
        except ValueError:
            return None

    # Strip trailing footnote markers like (1), (a), [1]
    cleaned = re.sub(r"(\([a-zA-Z0-9]\)|\[[a-zA-Z0-9]\])$", "", cleaned)

    # Normal float check
    try:
        return float(cleaned)
    except ValueError:
        return None

def detect_scale_multiplier(text: str) -> int:
    """Detect scale multiplier from text (millions, thousands, billions, or exact)."""
    t_low = text.lower()
    if "in billions" in t_low or "billion" in t_low:
        return 1_000_000_000
    if "in thousands" in t_low or "thousands" in t_low:
        return 1_000
    if "in millions" in t_low or "million" in t_low:
        return 1_000_000
    if "exact" in t_low or "single dollar" in t_low:
        return 1
    # Default US large filer scale is millions
    return 1_000_000
