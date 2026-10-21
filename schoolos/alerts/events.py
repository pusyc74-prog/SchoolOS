"""Document event handlers wired in hooks.py."""

import frappe
from frappe.utils import cint, formatdate, getdate, today

from schoolos.alerts.engine import get_settings, queue_for_students


def on_student_attendance_submit(doc, method=None):
    if doc.status != "Absent":
        return
    settings = get_settings()
    if not (cint(settings.alerts_enabled) and cint(settings.absence_alerts)):
        return
    if cint(settings.absence_only_today) and getdate(doc.date) != getdate(today()):
        return
    # One alert per student per day, even with period-wise (course schedule) attendance.
    queue_for_students(
        "Absence",
        [doc.student],
        "Student Attendance",
        doc.name,
        {"date": formatdate(doc.date, "dd MMM yyyy")},
        dedup_reference=str(getdate(doc.date)),
    )
