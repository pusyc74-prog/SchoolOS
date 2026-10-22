"""Feature switches. Every module is on by default; the school admin turns off what isn't used
(SchoolOS Settings → Modules). Turning a module off hides its screens, endpoints, alerts and
scheduled jobs. Its data stays, so turning it back on restores everything."""

import frappe
from frappe import _
from frappe.utils import cint

MODULES = {
    "fees": "Fees & online payment",
    "accounts": "Accounts dashboard & Tally export",
    "homework": "Homework & diary",
    "learning": "Lessons, syllabus & teacher notes",
    "report_cards": "Report cards",
    "circulars": "Circulars",
    "leave": "Leave requests from parents",
    "calendar": "Calendar & photo gallery",
    "staff": "Staff attendance on dashboard",
}


def enabled(key):
    s = frappe.get_cached_doc("SchoolOS Settings")
    value = s.get(f"module_{key}")
    return True if value is None else bool(cint(value))


def all_enabled():
    return {k: enabled(k) for k in MODULES}


def require(key):
    if not enabled(key):
        frappe.throw(_("{0} is turned off for this school").format(_(MODULES.get(key, key))), frappe.PermissionError)
