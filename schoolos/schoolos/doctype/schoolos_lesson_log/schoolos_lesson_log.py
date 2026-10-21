# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from schoolos.api.common import instructor_for_user, require_teaches_group


class SchoolOSLessonLog(Document):
    def validate(self):
        if not self.instructor:
            self.instructor = instructor_for_user()
        require_teaches_group(self.student_group)
        if self.topic:
            in_syllabus = frappe.db.exists("Course Topic", {"parent": self.course, "parenttype": "Course", "topic": self.topic})
            if not in_syllabus:
                frappe.msgprint(_("{0} isn't in the {1} syllabus, so it won't count towards coverage").format(
                    self.topic, self.course), indicator="orange", alert=True)
