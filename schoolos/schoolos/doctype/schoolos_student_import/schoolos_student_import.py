# Copyright (c) 2026, SchoolOS contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from schoolos.importer.run import load, summary_text


class SchoolOSStudentImport(Document):
    def validate(self):
        if self.has_value_changed("import_file") and not self.is_new():
            self.status = "Draft"

    @frappe.whitelist()
    def check_file(self):
        """Validate the sheet without importing. Writes the result to the log."""
        checked, missing = load(self)
        ok = [c for c in checked if not c["errors"]]
        self.total_rows = len(checked)
        self.valid_rows = len(ok)
        self.failed_rows = len(checked) - len(ok)
        self.imported_rows = 0
        self.log = summary_text(checked, missing)
        self.status = "Validated" if (ok and not missing) else "Draft"
        self.save()
        return {"total": len(checked), "ready": len(ok), "missing": missing}

    @frappe.whitelist()
    def start_import(self):
        if self.status not in ("Validated", "Completed with Errors"):
            frappe.throw(_("Click Validate first and fix any missing columns"))
        self.db_set("status", "Queued")
        frappe.enqueue("schoolos.importer.run.run", name=self.name, queue="long", timeout=3600,
                       enqueue_after_commit=True, job_id=f"schoolos-import-{self.name}", deduplicate=True)
        return "Queued"


@frappe.whitelist()
def download_template(academic_year: str | None = None):
    from schoolos.importer.xlsx import build_template

    frappe.has_permission("SchoolOS Student Import", "read", throw=True)
    school = frappe.db.get_single_value("SchoolOS Settings", "school_display_name") or ""
    frappe.local.response.filename = "Student Import Template.xlsx"
    frappe.local.response.filecontent = build_template(school, academic_year or "")
    frappe.local.response.type = "binary"
