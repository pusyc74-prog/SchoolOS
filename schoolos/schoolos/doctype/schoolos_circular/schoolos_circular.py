# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import cint

from schoolos.alerts.engine import get_settings, queue_for_students


class SchoolOSCircular(Document):
    def on_submit(self):
        students = get_audience(self.audience, self.program, self.student_group)
        self.db_set("recipients_count", len(students))
        settings = get_settings()
        if not cint(settings.circular_alerts):
            return
        channels = [c for c, on in (("WhatsApp", self.send_whatsapp), ("Email", self.send_email)) if cint(on)]
        if not channels:
            return
        queue_for_students(
            "Circular",
            students,
            self.doctype,
            self.name,
            {"title": self.title, "body": self.message or ""},
            channels=channels,
        )


def get_audience(audience, program=None, student_group=None):
    """Return active student IDs for a circular audience."""
    if audience == "Student Group" and student_group:
        return frappe.get_all(
            "Student Group Student",
            filters={"parent": student_group, "parenttype": "Student Group", "active": 1},
            pluck="student",
        )
    if audience == "Program" and program:
        filters = {"program": program, "docstatus": 1}
        year = frappe.db.get_single_value("Education Settings", "current_academic_year")
        if year:
            filters["academic_year"] = year
        enrolled = set(frappe.get_all("Program Enrollment", filters=filters, pluck="student"))
        if not enrolled:
            return []
        return frappe.get_all("Student", filters={"name": ["in", list(enrolled)], "enabled": 1}, pluck="name")
    return frappe.get_all("Student", filters={"enabled": 1}, pluck="name")
