"""Accounts, calendar and leave maths (pure Python, no Frappe imports)."""

import calendar as _cal
from datetime import date, timedelta
from xml.sax.saxutils import escape


def _d(v):
    if v is None or isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def month_keys(start, end):
    start, end = _d(start), _d(end)
    y, m, out = start.year, start.month, []
    while (y, m) <= (end.year, end.month):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def income_expense_series(rows, start, end):
    """rows: [{month: 'YYYY-MM', root_type: 'Income'|'Expense', amount}] (amount already signed as
    income = credit - debit, expense = debit - credit). Returns one row per month with surplus."""
    sums = {}
    for r in rows:
        k = (r["month"], r["root_type"])
        sums[k] = sums.get(k, 0.0) + float(r.get("amount") or 0)
    out = []
    for m in month_keys(start, end):
        inc = round(sums.get((m, "Income"), 0.0), 2)
        exp = round(sums.get((m, "Expense"), 0.0), 2)
        out.append({"key": m, "income": inc, "expense": exp, "surplus": round(inc - exp, 2)})
    return out


def totals(series, upto_month=None):
    rows = [r for r in series if upto_month is None or r["key"] <= upto_month]
    inc = round(sum(r["income"] for r in rows), 2)
    exp = round(sum(r["expense"] for r in rows), 2)
    return {"income": inc, "expense": exp, "surplus": round(inc - exp, 2),
            "margin_pct": round((inc - exp) * 100 / inc, 1) if inc else None}


def payables_summary(bills, today):
    """bills: [{name, supplier, outstanding, due_date}] -> totals and the list sorted by due date."""
    today = _d(today)
    total = overdue = due_week = 0.0
    out = []
    for b in bills:
        amt = float(b.get("outstanding") or 0)
        if amt <= 0.005:
            continue
        due = _d(b.get("due_date"))
        total += amt
        is_over = bool(due and due < today)
        if is_over:
            overdue += amt
        elif due and due <= today + timedelta(days=7):
            due_week += amt
        out.append({**b, "outstanding": round(amt, 2), "overdue": is_over,
                    "days": (due - today).days if due else None, "due_date": due.isoformat() if due else None})
    out.sort(key=lambda b: (b["due_date"] or "9999"))
    return {"total": round(total, 2), "overdue": round(overdue, 2), "due_this_week": round(due_week, 2), "bills": out}


# ------------------------------------------------------------------ Tally export
def _amt(v):
    return f"{float(v):.2f}"


def _x(v):
    return escape(str(v or ""), {'"': "&quot;"})


def _envelope(company, report, messages):
    return "\n".join([
        "<ENVELOPE>",
        "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>",
        "<BODY><IMPORTDATA>",
        f"<REQUESTDESC><REPORTNAME>{report}</REPORTNAME>"
        f"<STATICVARIABLES><SVCURRENTCOMPANY>{_x(company)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>",
        "<REQUESTDATA>",
        *messages,
        "</REQUESTDATA>",
        "</IMPORTDATA></BODY>",
        "</ENVELOPE>",
    ])


def build_tally_masters_xml(company, ledgers):
    """Ledger masters to import once, before the vouchers: [{name, parent}]."""
    return _envelope(company, "All Masters", [
        '<TALLYMESSAGE xmlns:UDF="TallyUDF">'
        f'<LEDGER NAME="{_x(l["name"])}" ACTION="Create">'
        f'<NAME.LIST><NAME>{_x(l["name"])}</NAME></NAME.LIST>'
        f'<PARENT>{_x(l["parent"])}</PARENT>'
        "</LEDGER></TALLYMESSAGE>"
        for l in ledgers
    ])


def build_tally_vouchers_xml(company, vouchers):
    """Vouchers: [{type: 'Sales'|'Receipt', number, date, party, narration, entries: [{ledger, amount}]}].

    amount > 0 = debit, < 0 = credit. Tally's convention: a debit line has ISDEEMEDPOSITIVE=Yes and a
    negative AMOUNT; a credit line has ISDEEMEDPOSITIVE=No and a positive AMOUNT.
    """
    msgs = []
    for v in vouchers:
        debit = round(sum(e["amount"] for e in v["entries"] if e["amount"] > 0), 2)
        credit = round(-sum(e["amount"] for e in v["entries"] if e["amount"] < 0), 2)
        if abs(debit - credit) > 0.01:
            raise ValueError(f"Voucher {v['number']} does not balance: {debit} vs {credit}")
        lines = "".join(
            "<ALLLEDGERENTRIES.LIST>"
            f"<LEDGERNAME>{_x(e['ledger'])}</LEDGERNAME>"
            f"<ISDEEMEDPOSITIVE>{'Yes' if e['amount'] > 0 else 'No'}</ISDEEMEDPOSITIVE>"
            f"<AMOUNT>{_amt(-e['amount'])}</AMOUNT>"
            "</ALLLEDGERENTRIES.LIST>"
            for e in v["entries"]
        )
        msgs.append(
            '<TALLYMESSAGE xmlns:UDF="TallyUDF">'
            f'<VOUCHER VCHTYPE="{_x(v["type"])}" ACTION="Create">'
            f"<DATE>{_d(v['date']).strftime('%Y%m%d')}</DATE>"
            f"<VOUCHERTYPENAME>{_x(v['type'])}</VOUCHERTYPENAME>"
            f"<VOUCHERNUMBER>{_x(v['number'])}</VOUCHERNUMBER>"
            f"<PARTYLEDGERNAME>{_x(v['party'])}</PARTYLEDGERNAME>"
            f"<NARRATION>{_x(v.get('narration'))}</NARRATION>"
            f"{lines}</VOUCHER></TALLYMESSAGE>"
        )
    return _envelope(company, "Vouchers", msgs)


def tally_vouchers(invoices, payments, cfg):
    """Turn fee invoices and payments into Tally vouchers.

    invoices: [{name, date, student_name, heads: [{head, amount}]}]
    payments: [{name, date, student_name, amount, cash: bool, reference}]
    cfg: {party_mode: 'student'|'single', party_ledger, debtors_group, income_group,
          income_ledger (blank = one ledger per fee head), cash_ledger, bank_ledger}
    Returns (vouchers, ledgers).
    """
    def party(name):
        return name if cfg.get("party_mode", "student") == "student" else cfg.get("party_ledger") or "Student Fees Receivable"

    ledgers, seen = [], set()

    def need(name, parent):
        if name not in seen:
            seen.add(name)
            ledgers.append({"name": name, "parent": parent})

    vouchers = []
    for inv in invoices:
        p = party(inv["student_name"])
        need(p, cfg.get("debtors_group") or "Sundry Debtors")
        entries, total = [], 0.0
        for h in inv["heads"]:
            led = cfg.get("income_ledger") or h["head"]
            need(led, cfg.get("income_group") or "Direct Incomes")
            entries.append({"ledger": led, "amount": -round(float(h["amount"]), 2)})
            total += float(h["amount"])
        entries.insert(0, {"ledger": p, "amount": round(total, 2)})
        vouchers.append({"type": "Sales", "number": inv["name"], "date": inv["date"], "party": p,
                         "narration": f"Fees: {inv['student_name']}", "entries": entries})
    for pay in payments:
        p = party(pay["student_name"])
        need(p, cfg.get("debtors_group") or "Sundry Debtors")
        led = (cfg.get("cash_ledger") or "Cash") if pay.get("cash") else (cfg.get("bank_ledger") or "Bank")
        amt = round(float(pay["amount"]), 2)
        vouchers.append({"type": "Receipt", "number": pay["name"], "date": pay["date"], "party": p,
                         "narration": f"Fee received: {pay['student_name']}" + (f" ({pay['reference']})" if pay.get("reference") else ""),
                         "entries": [{"ledger": led, "amount": amt}, {"ledger": p, "amount": -amt}]})
    return vouchers, ledgers


# ------------------------------------------------------------------ calendar
def audience_match(ev, programs, groups):
    a = ev.get("audience") or "All Students"
    if a == "All Students":
        return True
    if a == "Program":
        return ev.get("program") in programs
    if a == "Student Group":
        return ev.get("student_group") in groups
    return False


def month_grid(year, month):
    """Weeks (Monday first) as lists of ISO dates or None for padding days."""
    cal = _cal.Calendar(firstweekday=0)
    return [[d.isoformat() if d.month == month else None for d in week] for week in cal.monthdatescalendar(year, month)]


def spread_events(events, year, month):
    """events: [{date, end_date?, ...}] -> {iso_day: [events]} for days inside the month."""
    first = date(year, month, 1)
    last = date(year, month, _cal.monthrange(year, month)[1])
    out = {}
    for e in events:
        s = _d(e["date"])
        en = _d(e.get("end_date")) or s
        if en < s:
            en = s
        d = max(s, first)
        while d <= min(en, last):
            out.setdefault(d.isoformat(), []).append(e)
            d += timedelta(days=1)
    return out


# ------------------------------------------------------------------ leave
def check_leave_dates(from_date, to_date, today, max_past_days=7, max_days=30):
    """Return an error message, or None if a parent may apply for this range."""
    if not from_date or not to_date:
        return "Choose both dates"
    try:
        f, t, today = _d(from_date), _d(to_date), _d(today)
    except (TypeError, ValueError):
        return "Choose valid dates"
    if t < f:
        return "The end date is before the start date"
    if (today - f).days > max_past_days:
        return f"Leave can be applied at most {max_past_days} days after it started"
    if (t - f).days + 1 > max_days:
        return f"Leave longer than {max_days} days must be discussed with the school"
    return None


def overlaps(a_from, a_to, b_from, b_to):
    """True if two inclusive date ranges share at least one day."""
    return _d(a_from) <= _d(b_to) and _d(b_from) <= _d(a_to)


def covered_by_leave(day, leaves):
    """leaves: [{from_date, to_date}] -> True if day falls inside any."""
    day = _d(day)
    return any(_d(l["from_date"]) <= day <= _d(l["to_date"]) for l in leaves)
