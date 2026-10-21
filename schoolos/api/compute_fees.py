"""Fee and learning-progress maths (pure Python, no Frappe imports)."""

from datetime import date, timedelta

AGEING = [("0–30 days", 0, 30), ("31–60 days", 31, 60), ("61–90 days", 61, 90), ("90+ days", 91, 10**6)]


def _d(v):
    if v is None or isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def summarize_invoices(invoices, today, due_soon_days=30):
    """invoices: [{name, student, student_name, group, grand_total, outstanding_amount, due_date}]

    Returns totals, ageing buckets, class-wise rows and a defaulters list.
    """
    today = _d(today)
    billed = outstanding = overdue = due_soon = 0.0
    buckets = {label: {"label": label, "amount": 0.0, "students": set()} for label, *_ in AGEING}
    by_group, by_student = {}, {}
    for inv in invoices:
        g = inv.get("group") or "Not in a section"
        total = float(inv.get("grand_total") or 0)
        out = float(inv.get("outstanding_amount") or 0)
        due = _d(inv.get("due_date"))
        billed += total
        outstanding += out
        row = by_group.setdefault(g, {"group": g, "billed": 0.0, "outstanding": 0.0, "students": set(), "with_dues": set()})
        row["billed"] += total
        row["outstanding"] += out
        row["students"].add(inv["student"])
        if out <= 0.005:
            continue
        row["with_dues"].add(inv["student"])
        s = by_student.setdefault(inv["student"], {
            "student": inv["student"], "student_name": inv.get("student_name") or inv["student"], "group": g,
            "outstanding": 0.0, "overdue": 0.0, "oldest_due": None, "invoices": 0,
        })
        s["outstanding"] += out
        s["invoices"] += 1
        if due and due < today:
            overdue += out
            s["overdue"] += out
            if s["oldest_due"] is None or due < s["oldest_due"]:
                s["oldest_due"] = due
            late = (today - due).days
            for label, lo, hi in AGEING:
                if lo <= late <= hi:
                    buckets[label]["amount"] += out
                    buckets[label]["students"].add(inv["student"])
                    break
        elif due and due <= today + timedelta(days=due_soon_days):
            due_soon += out

    groups = []
    for r in by_group.values():
        groups.append({
            "group": r["group"], "billed": round(r["billed"], 2), "outstanding": round(r["outstanding"], 2),
            "collected": round(r["billed"] - r["outstanding"], 2),
            "collection_pct": round((r["billed"] - r["outstanding"]) * 100 / r["billed"], 1) if r["billed"] else None,
            "students": len(r["students"]), "with_dues": len(r["with_dues"]),
        })
    groups.sort(key=lambda r: (-r["outstanding"], r["group"]))

    defaulters = []
    for s in by_student.values():
        s["days_overdue"] = (today - s["oldest_due"]).days if s["oldest_due"] else 0
        s["oldest_due"] = s["oldest_due"].isoformat() if s["oldest_due"] else None
        s["outstanding"] = round(s["outstanding"], 2)
        s["overdue"] = round(s["overdue"], 2)
        defaulters.append(s)
    defaulters.sort(key=lambda s: (-s["overdue"], -s["days_overdue"], -s["outstanding"], s["student_name"]))

    collected = billed - outstanding
    return {
        "billed": round(billed, 2),
        "collected": round(collected, 2),
        "outstanding": round(outstanding, 2),
        "overdue": round(overdue, 2),
        "due_soon": round(due_soon, 2),
        "collection_pct": round(collected * 100 / billed, 1) if billed else None,
        "students_with_dues": len(by_student),
        "students_overdue": sum(1 for s in defaulters if s["overdue"] > 0),
        "ageing": [{"label": b["label"], "amount": round(b["amount"], 2), "students": len(b["students"])}
                   for b in buckets.values()],
        "groups": groups,
        "defaulters": defaulters,
    }


def collection_series(payments, start, end, by="day"):
    """payments: [{date, amount}] -> [{key, amount}] for every day (or month) from start to end."""
    start, end = _d(start), _d(end)
    sums = {}
    for p in payments:
        d = _d(p["date"])
        key = d.isoformat() if by == "day" else d.strftime("%Y-%m")
        sums[key] = sums.get(key, 0.0) + float(p.get("amount") or 0)
    out = []
    if by == "day":
        d = start
        while d <= end:
            out.append({"key": d.isoformat(), "amount": round(sums.get(d.isoformat(), 0.0), 2)})
            d += timedelta(days=1)
    else:
        y, m = start.year, start.month
        while (y, m) <= (end.year, end.month):
            k = f"{y:04d}-{m:02d}"
            out.append({"key": k, "amount": round(sums.get(k, 0.0), 2)})
            m += 1
            if m == 13:
                y, m = y + 1, 1
    return out


def split_by(rows, key, value="amount", top=6):
    """Sum value by key, largest first; anything past `top` grouped into 'Other'."""
    sums = {}
    for r in rows:
        k = r.get(key) or "Other"
        sums[k] = sums.get(k, 0.0) + float(r.get(value) or 0)
    items = sorted(sums.items(), key=lambda kv: -kv[1])
    head, tail = items[:top], items[top:]
    if tail:
        head.append(("Other", sum(v for _, v in tail)))
    return [{"label": k, "amount": round(v, 2)} for k, v in head]


def next_due(invoices, today):
    """Earliest unpaid due date on or after today (or the oldest overdue one)."""
    today = _d(today)
    unpaid = [i for i in invoices if float(i.get("outstanding_amount") or 0) > 0.005 and i.get("due_date")]
    if not unpaid:
        return None
    overdue = sorted((i for i in unpaid if _d(i["due_date"]) < today), key=lambda i: _d(i["due_date"]))
    if overdue:
        return {"date": str(overdue[0]["due_date"])[:10], "amount": float(overdue[0]["outstanding_amount"]), "overdue": True}
    upcoming = sorted(unpaid, key=lambda i: _d(i["due_date"]))
    return {"date": str(upcoming[0]["due_date"])[:10], "amount": float(upcoming[0]["outstanding_amount"]), "overdue": False}


def reminder_due(due_date, today, days_before=3, overdue_every=7):
    """Should an unpaid invoice get a reminder today? Returns 'upcoming', 'overdue' or None."""
    due, today = _d(due_date), _d(today)
    if not due:
        return None
    delta = (due - today).days
    if delta == days_before or (days_before and delta == 0):
        return "upcoming"
    if delta < 0 and overdue_every and (-delta) % overdue_every == 0:
        return "overdue"
    return None


# ------------------------------------------------------------------ learning
def coverage(total_topics, covered_topics, year_start, year_end, today):
    """Syllabus coverage vs where the class should be by now.

    expected = share of the academic year elapsed. status: ahead / on track / behind.
    """
    ys, ye, today = _d(year_start), _d(year_end), _d(today)
    pct = round(covered_topics * 100.0 / total_topics, 1) if total_topics else None
    expected = None
    if ys and ye and ye > ys:
        span = (ye - ys).days
        expected = round(max(0.0, min(1.0, (today - ys).days / span)) * 100, 1)
    status = None
    if pct is not None and expected is not None:
        status = "ahead" if pct >= expected + 10 else "behind" if pct < expected - 10 else "on track"
    return {"total": total_topics, "covered": covered_topics, "percentage": pct, "expected": expected, "status": status}


def merge_activity(*streams, limit=60):
    """Each stream is a list of {date, kind, title, ...}. Newest first, stable by kind order."""
    items = [i for s in streams for i in s if i.get("date")]
    items.sort(key=lambda i: (str(i["date"])[:19], i.get("order", 0)), reverse=True)
    return items[:limit]
