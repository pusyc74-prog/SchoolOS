"""Grading helpers (pure Python, no Frappe imports)."""

# Preset scales created on install if missing. Thresholds are minimum percentages.
# Schools must confirm these match their board's current circulars before use.
PRESET_SCALES = {
    "CBSE 8-Point": [
        (91, "A1", "Outstanding"),
        (81, "A2", "Excellent"),
        (71, "B1", "Very Good"),
        (61, "B2", "Good"),
        (51, "C1", "Fair"),
        (41, "C2", "Average"),
        (33, "D", "Pass"),
        (0, "E", "Needs Improvement"),
    ],
    "Maharashtra 9-Point": [
        (91, "A1", "Outstanding"),
        (81, "A2", "Excellent"),
        (71, "B1", "Very Good"),
        (61, "B2", "Good"),
        (51, "C1", "Fair"),
        (41, "C2", "Average"),
        (33, "D", "Pass"),
        (21, "E1", "Needs Improvement"),
        (0, "E2", "Needs Improvement"),
    ],
}


def grade_for(percentage, intervals):
    """Return the grade code for a percentage.

    intervals: iterable of (threshold, grade_code) or dicts with those keys.
    Picks the highest threshold that the percentage meets. Returns "" if none.
    """
    if percentage is None:
        return ""
    pairs = []
    for row in intervals or []:
        if isinstance(row, dict):
            pairs.append((float(row.get("threshold") or 0), row.get("grade_code") or ""))
        else:
            pairs.append((float(row[0] or 0), row[1]))
    for threshold, code in sorted(pairs, key=lambda p: p[0], reverse=True):
        if float(percentage) >= threshold:
            return code
    return ""


def percent(obtained, maximum, digits=2):
    """Safe percentage; None when maximum is 0 or missing."""
    if not maximum:
        return None
    return round(float(obtained or 0) * 100.0 / float(maximum), digits)
