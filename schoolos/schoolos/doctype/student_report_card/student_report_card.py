# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from schoolos.alerts.engine import get_settings, portal_url, queue_for_students
from schoolos.report_card.data import compute


class StudentReportCard(Document):
    def validate(self):
        self.validate_duplicate()
        if not self.subjects or self.flags.recompute:
            self.refresh_marks()
        if not self.co_scholastic:
            template = frappe.get_cached_doc("Report Card Template", self.template)
            for a in template.co_scholastic_areas:
                self.append("co_scholastic", {"area": a.area})

    def validate_duplicate(self):
        other = frappe.db.exists(
            "Student Report Card",
            {"student": self.student, "template": self.template, "docstatus": ["<", 2], "name": ["!=", self.name]},
        )
        if other:
            frappe.throw(_("Report card {0} already exists for this student and template").format(other))

    @frappe.whitelist()
    def refresh_marks(self):
        """Recalculate marks, grades and attendance from submitted records."""
        template, report, attendance = compute(self)
        self.exam_labels = "|".join(report["exam_labels"])
        self.set("subjects", [])
        self.set("marks", [])
        for s in report["subjects"]:
            self.append("subjects", {
                "course": s["course"],
                "total_obtained": s["total_obtained"],
                "total_maximum": s["total_maximum"],
                "percentage": s["percentage"],
                "grade": s["grade"],
                "passed": 1 if s["passed"] else 0,
            })
            for cell in s["exams"]:
                if cell["obtained"] is None:
                    continue
                self.append("marks", {
                    "course": s["course"], "exam_label": cell["label"], "criteria": "",
                    "obtained": cell["obtained"], "maximum": cell["maximum"], "grade": cell["grade"],
                })
                if cint(template.show_criteria_breakdown):
                    for c in cell["criteria"]:
                        self.append("marks", {
                            "course": s["course"], "exam_label": cell["label"], "criteria": c["criteria"],
                            "obtained": c["obtained"], "maximum": c["maximum"],
                        })
        o = report["overall"]
        self.overall_percentage = o["percentage"]
        self.overall_grade = o["grade"]
        self.result = o["result"]
        self.total_obtained = o["obtained"]
        self.total_maximum = o["maximum"]
        self.working_days = attendance["working_days"]
        self.days_present = attendance["present"]
        self.attendance_percentage = attendance["percentage"]
        return report

    def on_submit(self):
        settings = get_settings()
        if not cint(settings.report_card_alerts):
            return
        title = frappe.db.get_value("Report Card Template", self.template, "report_title") or self.template
        queue_for_students(
            "Report Card", [self.student], self.doctype, self.name,
            {"exam": title, "portal_url": portal_url(settings)},
        )

    # ---- helpers for the print format
    def get_exam_labels(self):
        return [x for x in (self.exam_labels or "").split("|") if x]

    def get_mark(self, course, exam_label, criteria=""):
        for m in self.marks:
            if m.course == course and m.exam_label == exam_label and (m.criteria or "") == (criteria or ""):
                return m
        return None

    def get_criteria(self, exam_label):
        seen = []
        for m in self.marks:
            if m.exam_label == exam_label and m.criteria and m.criteria not in seen:
                seen.append(m.criteria)
        return seen
