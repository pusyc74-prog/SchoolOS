# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ReportCardTemplate(Document):
    def validate(self):
        labels, groups = set(), set()
        for e in self.exams:
            if e.label in labels:
                frappe.throw(_("Row {0}: column label {1} is used twice").format(e.idx, e.label))
            if e.assessment_group in groups:
                frappe.throw(_("Row {0}: assessment group {1} is used twice").format(e.idx, e.assessment_group))
            labels.add(e.label)
            groups.add(e.assessment_group)
            if "|" in (e.label or ""):
                frappe.throw(_("Row {0}: column label cannot contain '|'").format(e.idx))
        weights = [float(e.weightage or 0) for e in self.exams]
        if any(weights) and round(sum(weights), 2) != 100:
            frappe.msgprint(
                _("Exam weightages add up to {0}%. They are normalised, but 100% is easier to read.").format(sum(weights)),
                indicator="orange",
            )
