"""School calendar and photo gallery.

The calendar merges: SchoolOS Events, holidays from the school's Holiday List, exams
(Assessment Plans) and, for a child, fee due dates. Parents only see items meant for their
children (whole school, their class, or their section). Staff see everything.
"""

import calendar as _cal
from datetime import date

import frappe
from frappe import _
from frappe.utils import add_days, cint, getdate, strip_html, today

from schoolos.api.common import STAFF_ROLES, guardian_children, require_login, require_student_access, roles, student_for_user
from schoolos.api.compute_accounts import audience_match
from schoolos.modules import enabled, require


def _scope(student=None):
    """(is_staff, programs, groups) for the viewer, or for one child when given."""
    if student:
        require_student_access(student)
        students = [student]
    elif roles() & STAFF_ROLES:
        return True, set(), set()
    else:
        students = [c.name for c in guardian_children()]
        me = student_for_user()
        if me:
            students.append(me)
    if not students:
        return False, set(), set()
    groups = set(frappe.get_all("Student Group Student", filters={"student": ["in", students], "active": 1,
                                                                  "parenttype": "Student Group"}, pluck="parent"))
    programs = set(frappe.get_all("Program Enrollment", filters={"student": ["in", students], "docstatus": 1}, pluck="program"))
    return False, programs, groups


def _visible(row, staff, programs, groups):
    return staff or audience_match(row, programs, groups)


@frappe.whitelist()
def month(year: int | None = None, month: int | None = None, student: str | None = None):
    require("calendar")
    require_login()
    t = getdate(today())
    year, month = cint(year) or t.year, cint(month) or t.month
    first, last = date(year, month, 1), date(year, month, _cal.monthrange(year, month)[1])
    staff, programs, groups = _scope(student)
    items = []

    for e in frappe.get_all("SchoolOS Event", filters={"published": 1, "start_date": ["<=", last]},
                            or_filters={"end_date": [">=", first], "start_date": [">=", first]},
                            fields=["name", "title", "event_type", "start_date", "end_date", "start_time", "audience",
                                    "program", "student_group", "location", "description"]):
        if _visible(e, staff, programs, groups):
            items.append({"date": str(e.start_date), "end_date": str(e.end_date or e.start_date), "type": e.event_type,
                          "title": e.title, "time": str(e.start_time)[:5] if e.start_time else None,
                          "place": e.location, "details": strip_html(e.description or "")[:400]})

    company = frappe.defaults.get_user_default("Company") or frappe.db.get_single_value("Global Defaults", "default_company")
    hl = frappe.get_cached_value("Company", company, "default_holiday_list") if company else None
    if hl:
        for h in frappe.get_all("Holiday", filters={"parent": hl, "holiday_date": ["between", [first, last]], "weekly_off": 0},
                                fields=["holiday_date", "description"]):
            items.append({"date": str(h.holiday_date), "end_date": str(h.holiday_date), "type": "Holiday",
                          "title": strip_html(h.description or _("Holiday"))})

    exam_filters = {"docstatus": 1, "schedule_date": ["between", [first, last]]}
    if not staff:
        exam_filters["student_group"] = ["in", list(groups) or [""]]
    seen = set()
    for x in frappe.get_all("Assessment Plan", filters=exam_filters,
                            fields=["assessment_name", "course", "schedule_date", "from_time", "student_group"],
                            order_by="schedule_date asc, from_time asc", limit=300):
        key = (str(x.schedule_date), x.assessment_name if not staff else x.course)
        if key in seen:
            continue
        seen.add(key)
        items.append({"date": str(x.schedule_date), "end_date": str(x.schedule_date), "type": "Exam",
                      "title": x.assessment_name or x.course, "time": str(x.from_time)[:5] if x.from_time else None,
                      "place": None if staff else (x.student_group or "").split(" (")[0]})

    if student and enabled("fees"):
        try:
            from schoolos.api.fees import student_fees

            for inv in student_fees(student)["invoices"]:
                if inv["outstanding"] > 0.005 and inv["due_date"] and first <= getdate(inv["due_date"]) <= last:
                    items.append({"date": inv["due_date"], "end_date": inv["due_date"], "type": "Fee due",
                                  "title": _("Fee due"), "amount": inv["outstanding"]})
        except Exception:
            frappe.log_error(title="SchoolOS calendar: fees")

    items.sort(key=lambda i: (i["date"], i.get("time") or "", i["title"]))
    upcoming_to = add_days(t, 30)
    upcoming = [i for i in items if t <= getdate(i["end_date"]) and getdate(i["date"]) <= upcoming_to]
    return {"year": year, "month": month, "items": items, "upcoming": upcoming[:12]}


@frappe.whitelist()
def albums(student: str | None = None, limit: int = 24):
    require("calendar")
    require_login()
    staff, programs, groups = _scope(student)
    rows = frappe.get_all("SchoolOS Album", filters={"published": 1},
                          fields=["name", "title", "date", "audience", "program", "student_group", "description"],
                          order_by="date desc", limit=cint(limit) * 3 or 72)
    out = []
    for a in rows:
        if not _visible(a, staff, programs, groups):
            continue
        photos = frappe.get_all("SchoolOS Album Photo", filters={"parent": a.name, "parenttype": "SchoolOS Album"},
                                fields=["image", "caption"], order_by="idx asc")
        if not photos:
            continue
        out.append({"name": a.name, "title": a.title, "date": str(a.date), "description": a.description,
                    "cover": photos[0].image, "count": len(photos), "photos": photos[:4]})
        if len(out) >= cint(limit or 24):
            break
    return out


@frappe.whitelist()
def album(name: str):
    require("calendar")
    require_login()
    a = frappe.get_doc("SchoolOS Album", name)
    staff, programs, groups = _scope()
    if not a.published or not _visible(a.as_dict(), staff, programs, groups):
        raise frappe.PermissionError(_("You can't view this album"))
    return {"name": a.name, "title": a.title, "date": str(a.date), "description": a.description,
            "photos": [{"image": p.image, "caption": p.caption} for p in a.photos]}
