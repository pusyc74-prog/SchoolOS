"""Phone number helpers (pure Python, no Frappe imports)."""

import re

_DIGITS = re.compile(r"\D+")


def normalize_mobile(raw, default_country_code="91"):
    """Return a mobile number as digits with country code (WhatsApp format), or None.

    Indian numbers are the default:
    "98765 43210", "+91-98765-43210", "098765 43210" -> "919876543210".
    Numbers that already carry another country code (11-15 digits) are kept as-is.
    """
    if not raw:
        return None
    digits = _DIGITS.sub("", str(raw))
    if not digits:
        return None

    # 00 international prefix
    if digits.startswith("00"):
        digits = digits[2:]

    cc = default_country_code
    if cc == "91":
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) == 10:
            return "91" + digits if digits[0] in "6789" else None
        if len(digits) == 12 and digits.startswith("91"):
            return digits if digits[2] in "6789" else None

    if 11 <= len(digits) <= 15:
        return digits
    if len(digits) == 10 and cc != "91":
        return cc + digits
    return None
