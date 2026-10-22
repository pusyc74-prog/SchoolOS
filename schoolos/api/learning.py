"""Learning progress: syllabus coverage, class notes, teacher notes and a full activity
timeline for each student. Teachers log lessons against the subject's syllabus
(Course → Topics in Frappe Education)."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, strip_html, today

from schoolos.api.common import (
    instructor_for_user, is_principal, require_login, require_principal, require_staff,
    require_student_access, require_teaches_group, roles, STAFF_ROLES, is_section_admin,
)
from schoolos.api.compute_fees import coverage, merge_activity
from schoolos.modules import enabled, require

LESSON_FIELDS = ["name", "date", "student_group", "course", "topic", "completed", "instructor_name",
                 "notes", "attachment", "homework", "creation"]


def _group_year_dates(group):
    year = frappe.db.get_value("Student Group", group, "academic_year")
    if not year:
        year = frappe.db.get_single_value("Education Settings", "current_academic_year")
    if not year:
        return None, None
    return frappe.db.get_value("Academic Year", year, ["year_start_date", "year_end_date"]) or (None, None)


def _syllabus(course):
    return frappe.get_all("Course Topic", filters={"parent": course, "parenttype": "Course"},
                          fields=["topic", "topic_name"], order_by="idx asc")


def _group_courses(group):
    program = frappe.db.get_value("Student Group", group, "program")
    course = frappe.db.get_value("Student Group", group, "course")
    if course:
        return [course]
    if not program:
        return []
    return frappe.get_all("Program Course", filters={"parent": program, "parenttype": "Program"},
                          pluck="course", order_by="idx asc")


def group_syllabus(group):
    """[{course, total, covered, percentage, expected, status, last_lesson, topics:[...]}] for one section."""
    ys, ye = _group_year_dates(group)
    logs = frappe.get_all("SchoolOS Lesson Log", filters={"student_group": group},
                          fields=["course", "topic", "completed", "date"], order_by="date desc")
    out = []
    for course in _group_courses(group):
        topics = _syllabus(course)
        done = {l.topic for l in logs if l.course == course and l.topic and cint(l.completed)}
        started = {l.topic for l in logs if l.course == course and l.topic}
        in_syllabus = {t.topic for t in topics}
        c = coverage(len(topics), len(done & in_syllabus), ys, ye, today())
        last = next((l.date for l in logs if l.course == course), None)
        c.update({
            "course": course, "last_lesson": str(last) if last else None,
            "topics": [{"topic": t.topic, "name": t.topic_name or t.topic,
                        "state": "done" if t.topic in done else "started" if t.topic in started else "todo"} for t in topics],
        })
        out.append(c)
    return out


def _main_group(student):
    rows = frappe.db.sql(
        """select sg.name from `tabStudent Group Student` sgs join `tabStudent Group` sg on sg.name = sgs.parent
           where sgs.student = %(s)s and sgs.active = 1 and sg.disabled = 0
           order by sg.group_based_on = 'Batch' desc, sg.creation desc limit 1""",
        {"s": student},
    )
    return rows[0][0] if rows else None


def _student_groups(student):
    return frappe.get_all("Student Group Student", filters={"student": student, "active": 1, "parenttype": "Student Group"},
                          pluck="parent")


def _require_teaches_student(student):
    """Teachers may write notes only about students in a section they teach (admins: anyone)."""
    if is_section_admin():
        return
    for g in _student_groups(student):
        try:
            require_teaches_group(g)
            return
        except frappe.PermissionError:
            continue
    raise frappe.PermissionError(_("You don't teach this student"))


def _teacher_notes(student, limit=20, staff=False):
    filters = {"student": student}
    if not staff:
        filters["schoolos_share_with_parent"] = 1
    return frappe.get_all("Student Log", filters=filters, fields=["name", "date", "type", "log", "owner", "creation"],
                          order_by="date desc, creation desc", limit=limit)


def _author(user):
    return frappe.utils.get_fullname(user) if user else ""


# ------------------------------------------------------------------ student / parent
@frappe.whitelist()
def student_progress(student: str):
    """Everything a parent needs to follow one child's learning."""
    require("learning")
    require_login()
    require_student_access(student)
    staff = bool(roles() & STAFF_ROLES)
    group = _main_group(student)
    groups = _student_groups(student)
    syllabus = group_syllabus(group) if group else []

    results = frappe.get_all("Assessment Result", filters={"student": student, "docstatus": 1},
                             fields=["course", "assessment_group", "assessment_plan", "total_score", "maximum_score", "grade", "modified"],
                             order_by="modified asc")
    by_course = {}
    for r in results:
        if not r.maximum_score:
            continue
        by_course.setdefault(r.course, []).append({
            "exam": frappe.db.get_value("Assessment Plan", r.assessment_plan, "assessment_name") or r.assessment_group,
            "percentage": round(flt(r.total_score) * 100 / flt(r.maximum_score), 1), "grade": r.grade,
            "date": str(r.modified)[:10],
        })
    since = add_days(today(), -30)
    hw = {}
    if groups:
        for h in frappe.get_all("SchoolOS Homework", filters={"docstatus": 1, "student_group": ["in", groups], "date": [">=", since]},
                                fields=["course"]):
            hw[h.course] = hw.get(h.course, 0) + 1

    subjects = []
    courses = [s["course"] for s in syllabus] + [c for c in by_course if c not in {s["course"] for s in syllabus}]
    syl = {s["course"]: s for s in syllabus}
    for c in courses:
        scores = by_course.get(c, [])
        s = syl.get(c, {})
        subjects.append({
            "course": c,
            "syllabus": {k: s.get(k) for k in ("total", "covered", "percentage", "expected", "status", "last_lesson")} if s else None,
            "topics": s.get("topics", []),
            "scores": scores,
            "average": round(sum(x["percentage"] for x in scores) / len(scores), 1) if scores else None,
            "latest": scores[-1] if scores else None,
            "homework_30d": hw.get(c, 0),
        })

    notes = frappe.get_all("SchoolOS Lesson Log", filters={"student_group": ["in", groups or [""]]},
                           fields=LESSON_FIELDS, order_by="date desc, creation desc", limit=25)
    teacher = [{**n, "author": _author(n.owner), "log": n.log} for n in _teacher_notes(student, staff=staff)]
    return {"group": group, "subjects": subjects, "class_notes": notes, "teacher_notes": teacher}


@frappe.whitelist()
def activity(student: str, days: int = 30):
    """Everything that happened for a student, newest first."""
    require_login()
    require_student_access(student)
    staff = bool(roles() & STAFF_ROLES)
    since = add_days(today(), -cint(days or 30))
    groups = _student_groups(student)

    att = [{"date": str(a.date), "kind": "attendance", "status": a.status, "title": a.status, "order": 1}
           for a in frappe.get_all("Student Attendance", filters={"student": student, "docstatus": 1, "status": ["!=", "Present"],
                                                                    "date": [">=", since]}, fields=["date", "status"])]
    on = {k: enabled(k) for k in ("homework", "learning", "fees", "report_cards", "leave")}
    hw = [] if not on["homework"] else [{"date": str(h.creation)[:19], "kind": "homework", "title": h.title, "course": h.course, "entry_type": h.entry_type,
           "due_date": str(h.due_date) if h.due_date else None, "order": 2}
          for h in frappe.get_all("SchoolOS Homework", filters={"docstatus": 1, "student_group": ["in", groups or [""]], "date": [">=", since]},
                                  fields=["title", "course", "entry_type", "due_date", "creation"])]
    lessons = [] if not on["learning"] else [{"date": str(l.date), "kind": "lesson", "title": l.topic or _("Class"), "course": l.course,
                "completed": cint(l.completed), "notes": strip_html(l.notes or "")[:200], "order": 3}
               for l in frappe.get_all("SchoolOS Lesson Log", filters={"student_group": ["in", groups or [""]], "date": [">=", since]},
                                       fields=["date", "topic", "course", "completed", "notes"])]
    marks = []
    for r in frappe.get_all("Assessment Result", filters={"student": student, "docstatus": 1, "modified": [">=", since]},
                            fields=["course", "assessment_plan", "total_score", "maximum_score", "grade", "modified"]):
        marks.append({"date": str(r.modified)[:19], "kind": "marks", "course": r.course,
                      "title": frappe.db.get_value("Assessment Plan", r.assessment_plan, "assessment_name") or r.course,
                      "score": flt(r.total_score), "max": flt(r.maximum_score), "grade": r.grade, "order": 4})
    notes = [] if not on["learning"] else [{"date": str(n.date), "kind": "note", "title": n.type, "text": strip_html(n.log or "")[:240],
              "author": _author(n.owner), "order": 5}
             for n in _teacher_notes(student, limit=30, staff=staff) if n.date and getdate(n.date) >= getdate(since)]
    payments = []
    if on["fees"]:
        try:
            from schoolos.api.fees import student_fees

            for p in student_fees(student)["payments"]:
                if getdate(p["date"]) >= getdate(since):
                    payments.append({"date": p["date"], "kind": "payment", "title": p.get("mode") or _("Payment"),
                                     "amount": p["amount"], "order": 6})
        except Exception:
            frappe.log_error(title="SchoolOS activity: fees")
    leaves = [] if not on["leave"] else [
        {"date": str(l.creation)[:19], "kind": "leave", "title": l.schoolos_status or "Pending", "from_date": str(l.from_date),
         "to_date": str(l.to_date), "reason": l.reason, "order": 8}
        for l in frappe.get_all("Student Leave Application", filters={"student": student, "creation": [">=", since], "docstatus": ["<", 2]},
                                fields=["creation", "schoolos_status", "from_date", "to_date", "reason"])]
    cards = [] if not on["report_cards"] else [{"date": str(c.modified)[:19], "kind": "report_card", "title": c.template, "grade": c.overall_grade, "name": c.name, "order": 7}
             for c in frappe.get_all("Student Report Card", filters={"student": student, "docstatus": 1, "modified": [">=", since]},
                                     fields=["name", "template", "overall_grade", "modified"])]
    return merge_activity(att, hw, lessons, marks, notes, payments, cards, leaves, limit=80)


# ------------------------------------------------------------------ teachers
@frappe.whitelist()
def lesson_options():
    """Sections, subjects and syllabus topics the current teacher can log lessons for."""
    require("learning")
    require_staff()
    from schoolos.api.homework import teacher_groups

    instructor = instructor_for_user()
    if instructor:
        groups = teacher_groups(instructor)
    elif is_principal() or "Academics User" in roles():
        groups = frappe.get_all("Student Group", filters={"disabled": 0}, pluck="name", order_by="student_group_name asc")
    else:
        groups = []
    data = {}
    for g in groups:
        syl = {s["course"]: s for s in group_syllabus(g)}
        data[g] = [{"course": c, "percentage": syl.get(c, {}).get("percentage"), "expected": syl.get(c, {}).get("expected"),
                    "status": syl.get(c, {}).get("status"),
                    "topics": [t for t in syl.get(c, {}).get("topics", [])]} for c in _group_courses(g)]
    return {"groups": groups, "courses": data}


@frappe.whitelist(methods=["POST"])
def post_lesson(student_group: str, course: str, topic: str | None = None, completed: int = 1,
                notes: str | None = None, date: str | None = None):
    require("learning")
    require_staff()
    require_teaches_group(student_group)
    doc = frappe.get_doc({
        "doctype": "SchoolOS Lesson Log", "student_group": student_group, "course": course,
        "topic": topic or None, "completed": cint(completed), "date": date or today(),
        "notes": frappe.utils.escape_html(notes or "").replace("\n", "<br>"),
    }).insert()
    syl = next((s for s in group_syllabus(student_group) if s["course"] == course), None)
    return {"name": doc.name, "coverage": syl and {k: syl[k] for k in ("percentage", "expected", "status", "covered", "total")}}


@frappe.whitelist(methods=["POST"])
def post_note(student: str, log: str, type: str = "General", share: int = 1):
    """A teacher's note about one student, optionally visible to parents."""
    require("learning")
    require_staff()
    if type not in ("General", "Academic", "Medical", "Achievement"):
        frappe.throw(_("Unknown note type"))
    _require_teaches_student(student)
    doc = frappe.get_doc({
        "doctype": "Student Log", "student": student, "type": type, "date": today(),
        "academic_year": frappe.db.get_single_value("Education Settings", "current_academic_year"),
        "log": frappe.utils.escape_html(log or "").replace("\n", "<br>"),
        "schoolos_share_with_parent": cint(share),
    }).insert()
    return {"name": doc.name}


@frappe.whitelist()
def group_students(student_group: str):
    """Students in a section (for the teacher's 'note about a student' picker)."""
    require_staff()
    require_teaches_group(student_group)
    return frappe.get_all("Student Group Student", filters={"parent": student_group, "parenttype": "Student Group", "active": 1},
                          fields=["student", "student_name", "group_roll_number"], order_by="group_roll_number asc")


# ------------------------------------------------------------------ principal
@frappe.whitelist()
def syllabus_overview():
    """Coverage for every active section × subject this year."""
    require("learning")
    require_principal()
    year = frappe.db.get_single_value("Education Settings", "current_academic_year")
    filters = {"disabled": 0, "group_based_on": "Batch"}
    if year:
        filters["academic_year"] = year
    rows, behind = [], 0
    courses_seen = []
    for g in frappe.get_all("Student Group", filters=filters, pluck="name", order_by="student_group_name asc"):
        cells = {}
        for s in group_syllabus(g):
            cells[s["course"]] = {k: s[k] for k in ("percentage", "expected", "status", "covered", "total")}
            if s["course"] not in courses_seen:
                courses_seen.append(s["course"])
            if s["status"] == "behind":
                behind += 1
        rows.append({"group": g, "cells": cells})
    return {"courses": courses_seen, "rows": rows, "behind": behind}
