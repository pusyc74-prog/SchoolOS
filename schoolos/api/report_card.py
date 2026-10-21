import frappe
from frappe import _

from schoolos.api.common import require_staff, require_student_access

PRINT_FORMAT = "SchoolOS Report Card"


@frappe.whitelist()
def download(name: str):
    """PDF of a published report card for the student, their guardians, or staff."""
    doc = frappe.get_doc("Student Report Card", name)
    if doc.docstatus != 1:
        frappe.throw(_("This report card is not published yet"), frappe.PermissionError)
    require_student_access(doc.student)
    frappe.flags.ignore_print_permissions = True
    try:
        pdf = frappe.get_print(doc.doctype, doc.name, PRINT_FORMAT, doc=doc, as_pdf=True)
    finally:
        frappe.flags.ignore_print_permissions = False
    frappe.local.response.filename = f"Report Card - {doc.student_name or doc.student}.pdf"
    frappe.local.response.filecontent = pdf
    frappe.local.response.type = "pdf"


@frappe.whitelist(methods=["POST"])
def generate(template: str, student_group: str, submit: int = 0):
    """Create (or refresh) draft report cards for every active student in a group."""
    require_staff()
    frappe.has_permission("Student Report Card", "create", throw=True)
    group = frappe.get_doc("Student Group", student_group)
    tpl = frappe.get_doc("Report Card Template", template)
    if tpl.academic_year and group.academic_year and tpl.academic_year != group.academic_year:
        frappe.throw(_("Student group {0} is for {1}, template is for {2}").format(
            group.name, group.academic_year, tpl.academic_year))

    made = refreshed = skipped = 0
    for row in group.students:
        if not row.active:
            continue
        existing = frappe.db.get_value(
            "Student Report Card",
            {"student": row.student, "template": template, "docstatus": ["<", 2]},
            ["name", "docstatus"], as_dict=True,
        )
        if existing and existing.docstatus == 1:
            skipped += 1
            continue
        if existing:
            doc = frappe.get_doc("Student Report Card", existing.name)
            doc.flags.recompute = True
            doc.save()
            refreshed += 1
        else:
            doc = frappe.get_doc({
                "doctype": "Student Report Card",
                "student": row.student,
                "template": template,
                "student_group": group.name,
                "program": group.program or tpl.program,
                "roll_number": row.group_roll_number,
            })
            doc.insert()
            made += 1
        if int(submit):
            doc.submit()
    return {"created": made, "refreshed": refreshed, "already_published": skipped}
