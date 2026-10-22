"""Accounts, Tally export, calendar and leave rules.  Run: python3 -m pytest tests -q"""

import xml.etree.ElementTree as ET
from datetime import date

from schoolos.api.compute_accounts import (
    audience_match, build_tally_masters_xml, build_tally_vouchers_xml, check_leave_dates, covered_by_leave,
    income_expense_series, month_grid, month_keys, payables_summary, spread_events, tally_vouchers, totals,
)

TODAY = date(2026, 10, 21)


def test_month_keys_cross_year():
    assert month_keys("2026-11-15", "2027-02-01") == ["2026-11", "2026-12", "2027-01", "2027-02"]


def test_income_expense_series_and_totals():
    rows = [{"month": "2026-04", "root_type": "Income", "amount": 900},
            {"month": "2026-04", "root_type": "Expense", "amount": 400},
            {"month": "2026-04", "root_type": "Income", "amount": 100},
            {"month": "2026-06", "root_type": "Expense", "amount": 50}]
    s = income_expense_series(rows, "2026-04-01", "2026-06-30")
    assert s == [{"key": "2026-04", "income": 1000, "expense": 400, "surplus": 600},
                 {"key": "2026-05", "income": 0, "expense": 0, "surplus": 0},
                 {"key": "2026-06", "income": 0, "expense": 50, "surplus": -50}]
    t = totals(s)
    assert t == {"income": 1000, "expense": 450, "surplus": 550, "margin_pct": 55.0}
    assert totals(s, upto_month="2026-04")["expense"] == 400
    assert totals([])["margin_pct"] is None


def test_payables():
    bills = [{"name": "P1", "supplier": "A", "outstanding": 5000, "due_date": "2026-10-10"},
             {"name": "P2", "supplier": "B", "outstanding": 3000, "due_date": "2026-10-25"},
             {"name": "P3", "supplier": "C", "outstanding": 2000, "due_date": "2026-12-01"},
             {"name": "P4", "supplier": "D", "outstanding": 0, "due_date": "2026-10-01"}]
    p = payables_summary(bills, TODAY)
    assert (p["total"], p["overdue"], p["due_this_week"]) == (10000, 5000, 3000)
    assert [b["name"] for b in p["bills"]] == ["P1", "P2", "P3"]
    assert p["bills"][0]["overdue"] and p["bills"][0]["days"] == -11


CFG = {"party_mode": "student", "cash_ledger": "Cash", "bank_ledger": "HDFC Bank", "income_group": "Direct Incomes"}
INVOICES = [{"name": "SINV-1", "date": "2026-06-01", "student_name": "Riya Patil & Co",
             "heads": [{"head": "Tuition Fee", "amount": 12000}, {"head": "Activity Fee", "amount": 1500}]}]
PAYMENTS = [{"name": "PE-1", "date": "2026-06-05", "student_name": "Riya Patil & Co", "amount": 13500, "cash": False, "reference": "UPI123"},
            {"name": "PE-2", "date": "2026-06-06", "student_name": "Om", "amount": 500, "cash": True}]


def test_tally_vouchers_balance_and_ledgers():
    v, ledgers = tally_vouchers(INVOICES, PAYMENTS, CFG)
    assert [x["type"] for x in v] == ["Sales", "Receipt", "Receipt"]
    sale = v[0]
    assert sale["entries"][0] == {"ledger": "Riya Patil & Co", "amount": 13500}
    assert sum(e["amount"] for e in sale["entries"]) == 0
    assert v[1]["entries"][0]["ledger"] == "HDFC Bank" and v[2]["entries"][0]["ledger"] == "Cash"
    names = {l["name"]: l["parent"] for l in ledgers}
    assert names["Tuition Fee"] == "Direct Incomes" and names["Riya Patil & Co"] == "Sundry Debtors"
    single, led2 = tally_vouchers(INVOICES, [], {**CFG, "party_mode": "single", "income_ledger": "School Fees"})
    assert single[0]["party"] == "Student Fees Receivable"
    assert {l["name"] for l in led2} == {"Student Fees Receivable", "School Fees"}


def test_tally_xml_is_valid_and_signed_correctly():
    v, ledgers = tally_vouchers(INVOICES, PAYMENTS, CFG)
    root = ET.fromstring(build_tally_vouchers_xml("Demo School", v))
    vch = root.findall(".//VOUCHER")
    assert len(vch) == 3 and vch[0].get("VCHTYPE") == "Sales"
    assert vch[0].findtext("DATE") == "20260601"
    lines = vch[0].findall("ALLLEDGERENTRIES.LIST")
    party = lines[0]
    assert party.findtext("ISDEEMEDPOSITIVE") == "Yes" and party.findtext("AMOUNT") == "-13500.00"   # debit
    assert lines[1].findtext("ISDEEMEDPOSITIVE") == "No" and lines[1].findtext("AMOUNT") == "12000.00"  # credit
    assert vch[0].findtext("PARTYLEDGERNAME") == "Riya Patil & Co"   # escaped & round-trips
    m = ET.fromstring(build_tally_masters_xml("Demo School", ledgers))
    assert m.findtext(".//REPORTNAME") == "All Masters"
    assert len(m.findall(".//LEDGER")) == len(ledgers)


def test_tally_rejects_unbalanced():
    try:
        build_tally_vouchers_xml("X", [{"type": "Sales", "number": "1", "date": "2026-01-01", "party": "P",
                                         "entries": [{"ledger": "P", "amount": 10}, {"ledger": "I", "amount": -9}]}])
    except ValueError as e:
        assert "does not balance" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_audience():
    assert audience_match({"audience": "All Students"}, set(), set())
    assert audience_match({"audience": "Program", "program": "Class 5"}, {"Class 5"}, set())
    assert not audience_match({"audience": "Student Group", "student_group": "6-B"}, {"Class 5"}, {"5-A"})


def test_month_grid_and_spread():
    g = month_grid(2026, 10)
    assert g[0][:3] == [None, None, None] and g[0][3] == "2026-10-01"   # 1 Oct 2026 is a Thursday
    assert all(len(w) == 7 for w in g)
    ev = [{"date": "2026-10-30", "end_date": "2026-11-04", "title": "Diwali"}, {"date": "2026-10-05", "title": "PTM"}]
    s = spread_events(ev, 2026, 10)
    assert sorted(s) == ["2026-10-05", "2026-10-30", "2026-10-31"]
    assert list(spread_events(ev, 2026, 11)) == ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]


def test_leave_rules():
    assert check_leave_dates("2026-10-22", "2026-10-23", TODAY) is None
    assert "before" in check_leave_dates("2026-10-23", "2026-10-22", TODAY)
    assert "after it started" in check_leave_dates("2026-10-01", "2026-10-02", TODAY)
    assert "30 days" in check_leave_dates("2026-10-22", "2026-12-22", TODAY)
    assert covered_by_leave("2026-10-22", [{"from_date": "2026-10-21", "to_date": "2026-10-23"}])
    assert not covered_by_leave("2026-10-24", [{"from_date": "2026-10-21", "to_date": "2026-10-23"}])
