"""Dashboard number-crunching (pure Python, no Frappe imports)."""

from datetime import date, timedelta

from schoolos.utils.grading import percent


def daterange(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def attendance_trend(rows, start, end, skip_empty=True):
    """rows: [{date, status, count}] -> [{date, present, absent, leave, percentage}].

    Days with no attendance at all (Sundays, holidays) are skipped by default.
    Percentage = present / (present + absent + leave).
    """
    by_day = {}
    for r in rows:
        d = r["date"]
        if isinstance(d, str):
            d = date.fromisoformat(d[:10])
        day = by_day.setdefault(d, {"present": 0, "absent": 0, "leave": 0})
        key = str(r["status"]).lower()
        if key in day:
            day[key] += int(r["count"] or 0)
    out = []
    for d in daterange(start, end):
        day = by_day.get(d, {"present": 0, "absent": 0, "leave": 0})
        total = day["present"] + day["absent"] + day["leave"]
        if skip_empty and not total:
            continue
        out.append({"date": d.isoformat(), **day, "percentage": percent(day["present"], total, 1)})
    return out


def student_attendance_stats(rows, threshold=75.0, min_days=5, limit=10):
    """rows: [{student, student_name, status, count}] -> lowest-attendance students.

    Only students with at least min_days marked days and below threshold are returned,
    lowest first.
    """
    stats = {}
    for r in rows:
        s = stats.setdefault(r["student"], {
            "student": r["student"], "student_name": r.get("student_name") or r["student"],
            "present": 0, "absent": 0, "leave": 0,
        })
        key = str(r["status"]).lower()
        if key in s:
            s[key] += int(r["count"] or 0)
    flagged = []
    for s in stats.values():
        total = s["present"] + s["absent"] + s["leave"]
        if total < min_days:
            continue
        s["days"] = total
        s["percentage"] = percent(s["present"], total, 1)
        if s["percentage"] < threshold:
            flagged.append(s)
    flagged.sort(key=lambda s: (s["percentage"], s["student_name"]))
    return flagged[:limit]


def status_counts(rows, statuses=("Present", "Absent", "Leave")):
    """rows: [{status, count}] -> {status: count, total, percentage(present)}."""
    out = {s.lower().replace(" ", "_"): 0 for s in statuses}
    for r in rows:
        key = str(r["status"]).lower().replace(" ", "_")
        if key in out:
            out[key] += int(r["count"] or 0)
    total = sum(out.values())
    out["total"] = total
    present_key = statuses[0].lower().replace(" ", "_")
    out["percentage"] = percent(out[present_key], total, 1)
    return out
