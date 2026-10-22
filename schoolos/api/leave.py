"""Leave requests: a parent applies from the app, the class teacher approves or rejects.

Built on Frappe Education's Student Leave Application. Approving submits it, which marks the
child's attendance as Leave for those days (and no absence alert goes out). Rejected requests
stay as drafts with the teacher's note, so the parent sees why.
"""

import frappe
from frappe import _
from frappe.utils import cint, escape_html, formatdate, getdate, today

from schoolos.alerts.engine import queue_for_students
from schoolos.api.common import (
    instructor_for_user, is_section_admin, require_login, require_staff, require_student_access, require_teaches_group, roles,
    PRINCIPAL_ROLES,
)
from schoolos.api.compute_accounts import check_leave_dates
from schoolos.modules import require

FIELDS = ["name", "student", "student_name", "from_date", "to_date", "reason", "total_leave_days", "student_group",
          "docstatus", "schoolos_status", "schoolos_decision_note", "schoolos_decided_by", "creation"]


def _main_group(student):
    from schoolos.api.learning import _main_group as mg

    return mg(student)


def _row(r):
    r = dict(r)
    r["status"] = r.get("schoolos_status") or ("Approved" if r.get("docstatus") == 1 else "Pending")
    r["decided_by"] = frappe.utils.get_fullname(r["schoolos_decided_by"]) if r.get("schoolos_decided_by") else None
    return r


@frappe.whitelist()
def for_student(student: str):
    require("leave")
    require_login()
    require_student_access(student)
    rows = frappe.get_all("Student Leave Application", filters={"student": student, "docstatus": ["<", 2]},
                          fields=FIELDS, order_by="from_date desc", limit=30)
    return [_row(r) for r in rows]


@frappe.whitelist(methods=["POST"])
def apply(student: str, from_date: str, to_date: str, reason: str):
    """Parent (or student) applies for leave."""
    require("leave")
    require_login()
    require_student_access(student)
    err = check_leave_dates(from_date, to_date, today())
    if err:
        frappe.throw(_(err))
    if not (reason or "").strip():
        frappe.throw(_("Please give a reason"))
    group = _main_group(student)
    doc = frappe.get_doc({
        "doctype": "Student Leave Application", "student": student, "from_date": from_date, "to_date": to_date,
        "reason": escape_html(reason.strip())[:1000], "attendance_based_on": "Student Group", "student_group": group,
        "schoolos_status": "Pending", "schoolos_applied_by": frappe.session.user,
    })
    # guardians can't create these in Frappe Education; we checked access ourselves above
    doc.insert(ignore_permissions=True)
    return _row(doc.as_dict())


@frappe.whitelist(methods=["POST"])
def withdraw(name: str):
    require("leave")
    doc = frappe.get_doc("Student Leave Application", name)
    require_student_access(doc.student)
    if doc.docstatus != 0 or (doc.schoolos_status or "Pending") != "Pending":
        frappe.throw(_("Only pending requests can be withdrawn"))
    frappe.delete_doc("Student Leave Application", name, ignore_permissions=True)
    return "ok"


@frappe.whitelist()
def pending():
    """Requests waiting for the current teacher (their sections) or for admins (all)."""
    require("leave")
    require_staff()
    filters = {"docstatus": 0, "schoolos_status": ["in", ["Pending", "", None]]}
    if not is_section_admin():
        from schoolos.api.homework import teacher_groups

        ins = instructor_for_user()
        groups = teacher_groups(ins) if ins else []
        if not groups:
            return []
        filters["student_group"] = ["in", groups]
    rows = frappe.get_all("Student Leave Application", filters=filters, fields=FIELDS, order_by="from_date asc", limit=50)
    return [_row(r) for r in rows]


@frappe.whitelist(methods=["POST"])
def decide(name: str, approve: int, note: str | None = None):
    require("leave")
    require_staff()
    doc = frappe.get_doc("Student Leave Application", name)
    if doc.student_group:
        require_teaches_group(doc.student_group)
    if doc.docstatus != 0:
        frappe.throw(_("This request has already been decided"))
    approved = bool(cint(approve))
    if not approved and not (note or "").strip():
        frappe.throw(_("Please tell the parent why the leave is rejected"))
    doc.schoolos_status = "Approved" if approved else "Rejected"
    doc.schoolos_decision_note = escape_html((note or "").strip())[:500]
    doc.schoolos_decided_by = frappe.session.user
    doc.save(ignore_permissions=True)
    if approved:
        doc.submit()  # marks attendance as Leave for each school day
    dates = formatdate(doc.from_date, "dd MMM") + (
        "" if getdate(doc.from_date) == getdate(doc.to_date) else " – " + formatdate(doc.to_date, "dd MMM"))
    queue_for_students(
        "Leave", [doc.student], doc.doctype, doc.name,
        {"status": "approved" if approved else "rejected", "dates": dates,
         "note": doc.schoolos_decision_note or ""},
        channels=["Email"], dedup_reference=f"{doc.name}|{doc.schoolos_status}",
    )
    return _row(doc.as_dict())
