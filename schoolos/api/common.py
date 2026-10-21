"""Who is the current user to the school? Used by every dashboard endpoint."""

import frappe
from frappe import _

PRINCIPAL_ROLES = {"School Principal", "Education Manager", "System Manager"}
STAFF_ROLES = PRINCIPAL_ROLES | {"Academics User", "Instructor"}
FEE_ROLES = PRINCIPAL_ROLES | {"Accounts Manager", "Accounts User"}


def roles(user=None):
    return set(frappe.get_roles(user or frappe.session.user))


def is_principal(user=None):
    return bool(roles(user) & PRINCIPAL_ROLES)


def require_principal():
    if not is_principal():
        raise frappe.PermissionError(_("Only the principal or school admins can see this"))


def require_staff():
    if not roles() & STAFF_ROLES:
        raise frappe.PermissionError(_("Only school staff can do this"))


def require_login():
    if frappe.session.user == "Guest":
        raise frappe.PermissionError(_("Please log in"))


def instructor_for_user(user=None):
    user = user or frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user, "status": "Active"}, "name")
    if not employee:
        return None
    return frappe.db.get_value("Instructor", {"employee": employee, "status": "Active"}, "name")


def student_for_user(user=None):
    user = user or frappe.session.user
    student = frappe.db.get_value("Student", {"user": user, "enabled": 1}, "name")
    if student:
        return student
    email = frappe.db.get_value("User", user, "email")
    if email:
        return frappe.db.get_value("Student", {"student_email_id": email, "enabled": 1}, "name")
    return None


def guardian_children(user=None):
    """Students the user is a guardian of (uses Education's own guardian matching)."""
    from education.education.api import get_guardians_for_user

    guardians = get_guardians_for_user(user)
    if not guardians:
        return []
    students = frappe.get_all(
        "Student Guardian",
        filters={"parenttype": "Student", "guardian": ["in", guardians]},
        pluck="parent",
        distinct=True,
    )
    if not students:
        return []
    return frappe.get_all("Student", filters={"name": ["in", students], "enabled": 1},
                          fields=["name", "student_name", "image"], order_by="student_name asc")


def can_view_student(student, user=None):
    user = user or frappe.session.user
    if roles(user) & STAFF_ROLES:
        return True
    if student_for_user(user) == student:
        return True
    return any(c.name == student for c in guardian_children(user))


def require_student_access(student):
    if not student or not can_view_student(student):
        raise frappe.PermissionError(_("You can't view this student"))


def require_teaches_group(student_group):
    """Teachers (without admin/academics roles) may only post for sections they teach."""
    r = roles()
    if r & PRINCIPAL_ROLES or "Academics User" in r:
        return
    mine = instructor_for_user()
    if not mine:
        frappe.throw(_("Your user isn't linked to an Instructor"), frappe.PermissionError)
    if not frappe.db.exists("Student Group Instructor",
                            {"parent": student_group, "parenttype": "Student Group", "instructor": mine}):
        frappe.throw(_("You don't teach {0}").format(student_group), frappe.PermissionError)
