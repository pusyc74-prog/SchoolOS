"""Fee and learning-progress maths.  Run: python3 -m pytest tests -q"""

from datetime import date

from schoolos.api.compute_fees import (
    collection_series, coverage, merge_activity, next_due, reminder_due, split_by, summarize_invoices,
)

TODAY = date(2026, 10, 21)


def inv(name, student, group, total, out, due):
    return {"name": name, "student": student, "student_name": student.title(), "group": group,
            "grand_total": total, "outstanding_amount": out, "due_date": due}


INVOICES = [
    inv("I1", "riya", "5-A", 12000, 0, "2026-06-10"),           # paid
    inv("I2", "riya", "5-A", 12000, 12000, "2026-11-10"),       # due in 20 days
    inv("I3", "kabir", "5-A", 12000, 12000, "2026-08-10"),      # 72 days late
    inv("I4", "kabir", "5-A", 12000, 6000, "2026-10-01"),       # 20 days late, part paid
    inv("I5", "om", "6-B", 15000, 15000, "2026-06-10"),         # 133 days late
    inv("I6", "siya", "6-B", 15000, 0, "2026-06-10"),           # paid
]


def test_totals():
    s = summarize_invoices(INVOICES, TODAY)
    assert s["billed"] == 78000
    assert s["outstanding"] == 45000
    assert s["collected"] == 33000
    assert s["overdue"] == 33000            # I3 + I4 + I5
    assert s["due_soon"] == 12000           # I2
    assert s["collection_pct"] == round(33000 * 100 / 78000, 1)
    assert s["students_with_dues"] == 3 and s["students_overdue"] == 2


def test_ageing():
    a = {b["label"]: b for b in summarize_invoices(INVOICES, TODAY)["ageing"]}
    assert a["0–30 days"]["amount"] == 6000
    assert a["61–90 days"]["amount"] == 12000
    assert a["90+ days"]["amount"] == 15000 and a["90+ days"]["students"] == 1
    assert a["31–60 days"]["amount"] == 0


def test_class_wise_and_defaulters():
    s = summarize_invoices(INVOICES, TODAY)
    g = {r["group"]: r for r in s["groups"]}
    assert g["5-A"]["outstanding"] == 30000 and g["5-A"]["with_dues"] == 2 and g["5-A"]["students"] == 2
    assert g["6-B"]["collection_pct"] == 50.0
    assert [r["group"] for r in s["groups"]] == ["5-A", "6-B"]       # most pending first
    d = s["defaulters"]
    assert [x["student"] for x in d] == ["kabir", "om", "riya"]      # most overdue first
    assert d[0]["overdue"] == 18000 and d[0]["days_overdue"] == 72 and d[0]["oldest_due"] == "2026-08-10"
    assert d[2]["overdue"] == 0 and d[2]["days_overdue"] == 0


def test_empty():
    s = summarize_invoices([], TODAY)
    assert s["billed"] == 0 and s["collection_pct"] is None and s["defaulters"] == []


def test_collection_series():
    pays = [{"date": "2026-10-19", "amount": 500}, {"date": "2026-10-19", "amount": 250}, {"date": "2026-10-21", "amount": 100}]
    days = collection_series(pays, "2026-10-19", "2026-10-21")
    assert days == [{"key": "2026-10-19", "amount": 750}, {"key": "2026-10-20", "amount": 0}, {"key": "2026-10-21", "amount": 100}]
    months = collection_series([{"date": "2026-11-02", "amount": 9}, {"date": "2027-01-05", "amount": 1}], "2026-11-01", "2027-01-31", by="month")
    assert [m["key"] for m in months] == ["2026-11", "2026-12", "2027-01"] and months[1]["amount"] == 0


def test_split_by():
    rows = [{"mode": m, "amount": a} for m, a in [("UPI", 50), ("Cash", 30), ("UPI", 20), ("Card", 5), ("NEFT", 1)]]
    assert split_by(rows, "mode", top=2) == [{"label": "UPI", "amount": 70}, {"label": "Cash", "amount": 30}, {"label": "Other", "amount": 6}]


def test_next_due_prefers_overdue():
    assert next_due(INVOICES[2:4], TODAY) == {"date": "2026-08-10", "amount": 12000.0, "overdue": True}
    assert next_due(INVOICES[:2], TODAY) == {"date": "2026-11-10", "amount": 12000.0, "overdue": False}
    assert next_due([INVOICES[0]], TODAY) is None


def test_reminder_schedule():
    assert reminder_due("2026-10-24", TODAY, days_before=3) == "upcoming"
    assert reminder_due("2026-10-21", TODAY, days_before=3) == "upcoming"   # due today
    assert reminder_due("2026-10-23", TODAY, days_before=3) is None
    assert reminder_due("2026-10-14", TODAY, overdue_every=7) == "overdue"  # 7 days late
    assert reminder_due("2026-10-15", TODAY, overdue_every=7) is None
    assert reminder_due(None, TODAY) is None


def test_coverage():
    c = coverage(20, 6, "2026-06-01", "2027-04-30", TODAY)
    assert c["percentage"] == 30.0
    assert 40 < c["expected"] < 45                 # ~142 of 333 days
    assert c["status"] == "behind"
    assert coverage(10, 6, "2026-06-01", "2027-04-30", TODAY)["status"] == "ahead"
    assert coverage(0, 0, "2026-06-01", "2027-04-30", TODAY)["percentage"] is None


def test_merge_activity():
    a = [{"date": "2026-10-20", "kind": "absent"}, {"date": "2026-10-18", "kind": "absent"}]
    b = [{"date": "2026-10-21 09:00:00", "kind": "homework"}, {"date": None, "kind": "x"}]
    out = merge_activity(a, b, limit=2)
    assert [i["kind"] for i in out] == ["homework", "absent"]
