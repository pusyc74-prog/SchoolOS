import frappe

no_cache = 1


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/school"
        raise frappe.Redirect

    s = frappe.get_cached_doc("SchoolOS Settings")
    context.school_name = (
        s.school_display_name
        or frappe.db.get_single_value("Education Settings", "school_college_name_abbreviation")
        or "School"
    )
    context.logo = s.school_logo or frappe.db.get_single_value("Education Settings", "school_college_logo")
    context.primary_color = s.primary_color or "#1F3A5F"
    context.version = frappe.get_attr("schoolos.__version__")
    context.no_cache = 1
