import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from schoolos.utils.grading import PRESET_SCALES

ROLES = ["School Principal"]

CUSTOM_FIELDS = {
    "Student": [
        {
            "fieldname": "schoolos_admission_no",
            "fieldtype": "Data",
            "label": "Admission / GR No.",
            "insert_after": "joining_date",
            "search_index": 1,
            "in_standard_filter": 1,
        },
    ],
    "Student Log": [
        {
            "fieldname": "schoolos_share_with_parent",
            "fieldtype": "Check",
            "label": "Show to parents",
            "insert_after": "type",
            "description": "Parents see this note in the app's activity and notes.",
        },
    ],
    "Guardian": [
        {
            "fieldname": "schoolos_alerts_opt_in",
            "fieldtype": "Check",
            "label": "Receive School Alerts",
            "default": "1",
            "insert_after": "alternate_number",
            "description": "Parent consents to WhatsApp / email alerts about their child.",
        },
        {
            "fieldname": "schoolos_consent_date",
            "fieldtype": "Date",
            "label": "Alert Consent Date",
            "insert_after": "schoolos_alerts_opt_in",
            "depends_on": "schoolos_alerts_opt_in",
        },
    ],
}


def after_install():
    setup()


def after_migrate():
    setup()


def setup():
    make_roles()
    create_custom_fields(CUSTOM_FIELDS, update=True)
    make_grading_scales()
    init_settings_defaults()


def init_settings_defaults():
    """Write field defaults into SchoolOS Settings the first time (singles don't get them automatically)."""
    meta = frappe.get_meta("SchoolOS Settings")
    current = frappe.db.get_singles_dict("SchoolOS Settings")
    for df in meta.fields:
        if df.default and df.fieldname not in current:
            frappe.db.set_single_value("SchoolOS Settings", df.fieldname, df.default)


def make_roles():
    for role in ROLES:
        if not frappe.db.exists("Role", role):
            frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(
                ignore_permissions=True
            )


def make_grading_scales():
    """Create preset grading scales once. Schools should confirm them with their board."""
    for name, rows in PRESET_SCALES.items():
        if frappe.db.exists("Grading Scale", name):
            continue
        doc = frappe.get_doc({
            "doctype": "Grading Scale",
            "grading_scale_name": name,
            "description": "Preset created by SchoolOS. Confirm thresholds with the board's current rules.",
            "intervals": [
                {"grade_code": code, "threshold": threshold, "grade_description": desc}
                for threshold, code, desc in rows
            ],
        })
        doc.insert(ignore_permissions=True)
        doc.submit()
