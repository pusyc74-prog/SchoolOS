"""Unit tests for the parts of SchoolOS that don't need a Frappe site.

Run from the repo root:  python -m pytest tests -q
"""

from datetime import date

from schoolos.alerts.messages import (
    dedup_key, render, template_params, whatsapp_template_payload,
)
from schoolos.api.compute import attendance_trend, status_counts, student_attendance_stats
from schoolos.report_card.builder import attendance_summary, build_report
from schoolos.utils.grading import PRESET_SCALES, grade_for, percent
from schoolos.utils.phone import normalize_mobile

CBSE = [(t, c) for t, c, _ in PRESET_SCALES["CBSE 8-Point"]]


# ---------- phone
def test_phone_indian_formats():
    assert normalize_mobile("98765 43210") == "919876543210"
    assert normalize_mobile("+91-98765-43210") == "919876543210"
    assert normalize_mobile("098765 43210") == "919876543210"
    assert normalize_mobile("0091 9876543210") == "919876543210"


def test_phone_rejects_bad():
    assert normalize_mobile("") is None
    assert normalize_mobile(None) is None
    assert normalize_mobile("12345") is None
    assert normalize_mobile("0233 2345678") is None  # landline-style 10 digits starting 0/2


def test_phone_foreign_kept():
    assert normalize_mobile("+971 50 123 4567") == "971501234567"


# ---------- grading
def test_grade_boundaries():
    assert grade_for(91, CBSE) == "A1"
    assert grade_for(90.99, CBSE) == "A2"
    assert grade_for(33, CBSE) == "D"
    assert grade_for(32.9, CBSE) == "E"
    assert grade_for(None, CBSE) == ""
    assert grade_for(50, [{"threshold": 40, "grade_code": "P"}]) == "P"


def test_percent_safe():
    assert percent(5, 0) is None
    assert percent(45, 50) == 90.0


# ---------- report card
EXAMS = [
    {"label": "Term 1", "assessment_group": "T1", "weightage": 0},
    {"label": "Term 2", "assessment_group": "T2", "weightage": 0},
]


def _res(course, group, score, maximum, details=None):
    return {"course": course, "assessment_group": group, "total_score": score,
            "maximum_score": maximum, "details": details or []}


def test_report_plain_totals():
    results = [
        _res("Maths", "T1", 80, 100), _res("Maths", "T2", 90, 100),
        _res("English", "T1", 30, 100), _res("English", "T2", 30, 100),
        _res("Science", "X", 99, 100),  # group not in template -> ignored
    ]
    r = build_report(EXAMS, results, CBSE, pass_percentage=33)
    assert r["exam_labels"] == ["Term 1", "Term 2"]
    subj = {s["course"]: s for s in r["subjects"]}
    assert set(subj) == {"Maths", "English"}
    assert subj["Maths"]["percentage"] == 85.0 and subj["Maths"]["grade"] == "A2"
    assert subj["English"]["passed"] is False
    assert r["overall"]["result"] == "Needs Improvement"
    assert r["overall"]["percentage"] == 57.5


def test_report_weighted_and_missing_exam():
    exams = [
        {"label": "Half Yearly", "assessment_group": "HY", "weightage": 40},
        {"label": "Annual", "assessment_group": "AN", "weightage": 60},
    ]
    results = [
        _res("Maths", "HY", 50, 100), _res("Maths", "AN", 100, 100),
        _res("Hindi", "AN", 70, 100),  # missed half yearly
    ]
    r = build_report(exams, results, CBSE)
    subj = {s["course"]: s for s in r["subjects"]}
    assert subj["Maths"]["percentage"] == 80.0  # 50*0.4 + 100*0.6
    assert subj["Hindi"]["percentage"] == 70.0  # only annual counts
    assert subj["Hindi"]["exams"][0]["obtained"] is None
    assert r["overall"]["result"] == "Pass"


def test_report_plain_overall_matches_grand_total():
    results = [_res("Maths", "T1", 90, 100), _res("Maths", "T2", 90, 100), _res("Science", "T1", 60, 100)]
    r = build_report(EXAMS, results, CBSE)
    o = r["overall"]
    assert (o["obtained"], o["maximum"]) == (240, 300)
    assert o["percentage"] == 80.0  # 240/300, not the 75% average of subject percentages


def test_report_aggregates_multiple_results_and_criteria():
    d1 = [{"assessment_criteria": "Written", "score": 30, "maximum_score": 40},
          {"assessment_criteria": "Oral", "score": 8, "maximum_score": 10}]
    d2 = [{"assessment_criteria": "Written", "score": 35, "maximum_score": 40}]
    results = [_res("Science", "T1", 38, 50, d1), _res("Science", "T1", 35, 40, d2)]
    r = build_report(EXAMS, results, CBSE)
    cell = r["subjects"][0]["exams"][0]
    assert cell["obtained"] == 73 and cell["maximum"] == 90
    crit = {c["criteria"]: c for c in cell["criteria"]}
    assert crit["Written"]["obtained"] == 65 and crit["Written"]["maximum"] == 80


def test_report_subject_order():
    results = [_res("A", "T1", 1, 2), _res("B", "T1", 1, 2), _res("C", "T1", 1, 2)]
    r = build_report(EXAMS, results, CBSE, subject_order=["C", "A"])
    assert [s["course"] for s in r["subjects"]] == ["C", "A", "B"]


def test_report_empty():
    r = build_report(EXAMS, [], CBSE)
    assert r["subjects"] == [] and r["overall"]["percentage"] is None


def test_attendance_summary():
    s = attendance_summary(["Present"] * 18 + ["Absent"] * 1 + ["Leave"] * 1)
    assert s["working_days"] == 20 and s["percentage"] == 90.0
    s2 = attendance_summary(["Present"] * 18 + ["Leave"] * 2, count_leave_as_present=True)
    assert s2["percentage"] == 100.0


# ---------- dashboard compute
def test_trend_skips_empty_days():
    rows = [
        {"date": "2026-10-19", "status": "Present", "count": 9},
        {"date": "2026-10-19", "status": "Absent", "count": 1},
        {"date": date(2026, 10, 21), "status": "Present", "count": 5},
    ]
    t = attendance_trend(rows, date(2026, 10, 19), date(2026, 10, 21))
    assert [d["date"] for d in t] == ["2026-10-19", "2026-10-21"]
    assert t[0]["percentage"] == 90.0


def test_low_attendance():
    rows = [
        {"student": "S1", "student_name": "Asha", "status": "Present", "count": 6},
        {"student": "S1", "student_name": "Asha", "status": "Absent", "count": 4},
        {"student": "S2", "student_name": "Ravi", "status": "Present", "count": 10},
        {"student": "S3", "student_name": "Mira", "status": "Absent", "count": 2},  # < min_days
    ]
    low = student_attendance_stats(rows, threshold=75, min_days=5)
    assert [s["student"] for s in low] == ["S1"] and low[0]["percentage"] == 60.0


def test_status_counts():
    c = status_counts([{"status": "Present", "count": 3}, {"status": "Absent", "count": 1}])
    assert c == {"present": 3, "absent": 1, "leave": 0, "total": 4, "percentage": 75.0}
    staff = status_counts([{"status": "On Leave", "count": 2}],
                          statuses=("Present", "Absent", "On Leave", "Half Day", "Work From Home"))
    assert staff["on_leave"] == 2 and staff["percentage"] == 0.0


# ---------- messages
def test_render_and_params():
    ctx = {"guardian_name": "Mr Patil", "student_name": "Riya", "date": "21 Oct", "school_name": "Demo"}
    assert render("Hi {guardian_name}, {missing}", ctx) == "Hi Mr Patil, {missing}"
    assert template_params("Absence", ctx) == ["Mr Patil", "Riya", "21 Oct", "Demo"]
    assert template_params("Circular", {})[0] == "-"


def test_whatsapp_payload():
    p = whatsapp_template_payload("919876543210", "school_absence_alert", "mr", ["a", "b"])
    assert p["template"]["language"]["code"] == "mr"
    assert p["template"]["components"][0]["parameters"][1] == {"type": "text", "text": "b"}
    assert "components" not in whatsapp_template_payload("1", "t", "en", [])["template"]


def test_dedup_key_stable():
    assert dedup_key("Absence", "STU-1|2026-10-21", "919876543210", "WhatsApp") == \
        "Absence|STU-1|2026-10-21|919876543210|WhatsApp"
