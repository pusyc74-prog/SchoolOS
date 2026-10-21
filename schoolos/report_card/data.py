"""Load the data a report card needs from Frappe Education."""

import frappe
from frappe.utils import cint, getdate

from schoolos.report_card.builder import attendance_summary, build_report


def template_exams(template):
    return [
        {"label": e.label, "assessment_group": e.assessment_group, "weightage": e.weightage}
        for e in template.exams
    ]


def assessment_groups_with_children(groups):
    """Expand group nodes so a parent group (e.g. 'Term 1') includes its child groups."""
    expanded = {}
    for g in groups:
        lft, rgt = frappe.db.get_value("Assessment Group", g, ["lft", "rgt"]) or (None, None)
        if lft is None:
            expanded[g] = g
            continue
        for child in frappe.get_all("Assessment Group", filters={"lft": [">=", lft], "rgt": ["<=", rgt]},
                                    pluck="name"):
            expanded.setdefault(child, g)
    return expanded  # child group -> template group


def student_results(student, template):
    """Submitted Assessment Results for the template's year/program, mapped to template groups."""
    groups = [e.assessment_group for e in template.exams]
    mapping = assessment_groups_with_children(groups)
    filters = {
        "student": student,
        "docstatus": 1,
        "academic_year": template.academic_year,
        "assessment_group": ["in", list(mapping.keys())],
    }
    if template.program:
        filters["program"] = template.program
    rows = frappe.get_all(
        "Assessment Result",
        filters=filters,
        fields=["name", "course", "assessment_group", "total_score", "maximum_score"],
    )
    if not rows:
        return []
    details = frappe.get_all(
        "Assessment Result Detail",
        filters={"parent": ["in", [r.name for r in rows]], "parenttype": "Assessment Result"},
        fields=["parent", "assessment_criteria", "score", "maximum_score"],
        order_by="idx asc",
    )
    by_parent = {}
    for d in details:
        by_parent.setdefault(d.parent, []).append(d)
    return [
        {
            "course": r.course,
            "assessment_group": mapping.get(r.assessment_group, r.assessment_group),
            "total_score": r.total_score,
            "maximum_score": r.maximum_score,
            "details": by_parent.get(r.name, []),
        }
        for r in rows
    ]


def grading_intervals(grading_scale):
    return [
        (r.threshold, r.grade_code)
        for r in frappe.get_all("Grading Scale Interval",
                                filters={"parent": grading_scale, "parenttype": "Grading Scale"},
                                fields=["threshold", "grade_code"])
    ]


def attendance_period(template):
    start, end = template.attendance_from, template.attendance_to
    if not (start and end):
        ys, ye = frappe.db.get_value("Academic Year", template.academic_year,
                                     ["year_start_date", "year_end_date"]) or (None, None)
        start, end = start or ys, end or ye
    return start, end


def student_attendance(student, template, student_group=None):
    start, end = attendance_period(template)
    filters = {"student": student, "docstatus": 1}
    if start and end:
        filters["date"] = ["between", [getdate(start), getdate(end)]]
    if student_group:
        filters["student_group"] = student_group
    # one status per day: if a student has period-wise rows, a day counts as present
    # when any row that day is Present.
    rows = frappe.get_all("Student Attendance", filters=filters, fields=["date", "status"])
    per_day = {}
    rank = {"Present": 3, "Leave": 2, "Absent": 1}
    for r in rows:
        prev = per_day.get(r.date)
        if prev is None or rank.get(r.status, 0) > rank.get(prev, 0):
            per_day[r.date] = r.status
    count_leave = cint(frappe.db.get_single_value("SchoolOS Settings", "count_leave_as_present"))
    return attendance_summary(per_day.values(), count_leave_as_present=bool(count_leave))


def program_course_order(program):
    if not program:
        return None
    return frappe.get_all("Program Course", filters={"parent": program, "parenttype": "Program"},
                          pluck="course", order_by="idx asc")


def compute(report_card):
    template = frappe.get_cached_doc("Report Card Template", report_card.template)
    report = build_report(
        template_exams(template),
        student_results(report_card.student, template),
        grading_intervals(template.grading_scale),
        pass_percentage=template.pass_percentage or 0,
        subject_order=program_course_order(report_card.program or template.program),
    )
    return template, report, student_attendance(report_card.student, template, report_card.student_group)
