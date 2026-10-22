"""Homework / class diary endpoints (used by /school and, later, the mobile app)."""

import frappe
from frappe.utils import add_days, cint, getdate, today

from schoolos.api.common import instructor_for_user, is_principal, require_login, require_staff, require_student_access
from schoolos.modules import enabled, require

FIELDS = ["name", "entry_type", "title", "student_group", "course", "date", "due_date",
          "instructor_name", "details", "attachment"]


def homework_for_groups(groups, days=14, limit=30):
    if not groups or not enabled("homework"):
        return []
    since = add_days(today(), -cint(days or 14))
    rows = frappe.get_all(
        "SchoolOS Homework",
        filters={"docstatus": 1, "student_group": ["in", list(groups)]},
        or_filters={"date": [">=", since], "due_date": [">=", today()]},
        fields=FIELDS,
        order_by="date desc, creation desc",
        limit=limit,
    )
    t = getdate(today())
    for r in rows:
        r["overdue"] = bool(r.due_date and getdate(r.due_date) < t)
        r["due_today"] = bool(r.due_date and getdate(r.due_date) == t)
    return rows


def student_groups(student):
    return frappe.get_all("Student Group Student", filters={"student": student, "active": 1,
                                                            "parenttype": "Student Group"}, pluck="parent")


def teacher_groups(instructor):
    groups = frappe.get_all("Student Group Instructor",
                            filters={"instructor": instructor, "parenttype": "Student Group"},
                            pluck="parent", distinct=True)
    if not groups:
        return []
    return frappe.get_all("Student Group", filters={"name": ["in", groups], "disabled": 0},
                          pluck="name", order_by="student_group_name asc")


@frappe.whitelist()
def for_student(student: str, days: int = 14):
    require_login()
    require_student_access(student)
    return homework_for_groups(student_groups(student), days)


@frappe.whitelist()
def post_options():
    """Sections and subjects the current user can post homework for."""
    require("homework")
    require_staff()
    instructor = instructor_for_user()
    if is_principal() and not instructor:
        groups = frappe.get_all("Student Group", filters={"disabled": 0}, pluck="name", order_by="student_group_name asc")
    else:
        groups = teacher_groups(instructor) if instructor else []
    programs = {g.name: g.program for g in frappe.get_all("Student Group", filters={"name": ["in", groups or [""]]},
                                                            fields=["name", "program"])}
    courses = {}
    for g, program in programs.items():
        if program:
            courses[g] = frappe.get_all("Program Course", filters={"parent": program, "parenttype": "Program"},
                                        pluck="course", order_by="idx asc")
    return {"groups": groups, "courses": courses, "types": ["Homework", "Classwork", "Project", "Note"],
            "whatsapp_allowed": bool(cint(frappe.db.get_single_value("SchoolOS Settings", "homework_whatsapp")))}


@frappe.whitelist(methods=["POST"])
def post(student_group: str, title: str, entry_type: str = "Homework", course: str | None = None,
         details: str | None = None, due_date: str | None = None, send_whatsapp: int = 0):
    """Create and publish a homework / diary entry. Parents are notified on publish."""
    require("homework")
    require_staff()
    doc = frappe.get_doc({
        "doctype": "SchoolOS Homework",
        "student_group": student_group,
        "title": (title or "").strip()[:140],
        "entry_type": entry_type or "Homework",
        "course": course or None,
        "details": frappe.utils.escape_html(details or "").replace("\n", "<br>"),
        "due_date": due_date or None,
        "send_whatsapp": cint(send_whatsapp),
        "notify_parents": 1,
    })
    doc.insert()
    doc.submit()
    return {"name": doc.name, "students": doc.recipients_count}


@frappe.whitelist()
def my_posts(limit: int = 10):
    require_staff()
    instructor = instructor_for_user()
    filters = {"docstatus": 1}
    if instructor:
        filters["instructor"] = instructor
    else:
        filters["owner"] = frappe.session.user
    return frappe.get_all("SchoolOS Homework", filters=filters, fields=FIELDS + ["recipients_count"],
                          order_by="date desc, creation desc", limit=cint(limit) or 10)
