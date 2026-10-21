# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, formatdate, getdate

from schoolos.alerts.engine import get_settings, queue_for_students
from schoolos.api.common import instructor_for_user, is_principal, roles


class SchoolOSHomework(Document):
    def validate(self):
        if not self.instructor:
            self.instructor = instructor_for_user()
        self.validate_teacher_owns_group()
        if self.due_date and getdate(self.due_date) < getdate(self.date):
            frappe.throw(_("Due date can't be before the date"))
        if cint(self.send_whatsapp) and not cint(get_settings().homework_whatsapp):
            self.send_whatsapp = 0
            frappe.msgprint(_("WhatsApp for homework is turned off in SchoolOS Settings; parents will get email."),
                            indicator="orange", alert=True)

    def validate_teacher_owns_group(self):
        """Teachers (without admin roles) may only post to sections they teach."""
        if is_principal() or "Academics User" in roles():
            return
        mine = instructor_for_user()
        if not mine:
            frappe.throw(_("Your user isn't linked to an Instructor"), frappe.PermissionError)
        teaches = frappe.db.exists("Student Group Instructor",
                                   {"parent": self.student_group, "parenttype": "Student Group", "instructor": mine})
        if not teaches:
            frappe.throw(_("You don't teach {0}").format(self.student_group), frappe.PermissionError)

    def on_submit(self):
        students = frappe.get_all(
            "Student Group Student",
            filters={"parent": self.student_group, "parenttype": "Student Group", "active": 1},
            pluck="student",
        )
        self.db_set("recipients_count", len(students))
        settings = get_settings()
        if not (cint(self.notify_parents) and cint(settings.homework_alerts)):
            return
        channels = ["Email"] + (["WhatsApp"] if cint(self.send_whatsapp) and cint(settings.homework_whatsapp) else [])
        subject = (frappe.db.get_value("Course", self.course, "course_name") or self.course) if self.course else ""
        queue_for_students(
            "Homework", students, self.doctype, self.name,
            {
                "title": self.title,
                "entry_type": self.entry_type or "Homework",
                "subject": subject or self.student_group,
                "due_date": formatdate(self.due_date, "dd MMM") if self.due_date else "-",
                "body": self.details or "",
            },
            channels=channels,
        )
