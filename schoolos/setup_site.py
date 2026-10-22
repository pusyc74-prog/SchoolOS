"""Finish the ERPNext setup wizard from the command line (no browser needed).

Used by CI and by deploy/provision.sh on a new school server:

    bench --site school.example.in execute schoolos.setup_site.complete \
        --kwargs "{'school': 'Sunrise Public School', 'abbr': 'SPS', 'email': 'admin@sunrise.edu.in'}"

Indian defaults: INR, Asia/Kolkata, financial year April to March, standard chart of accounts.
Safe to run twice: it does nothing if the wizard is already done.
"""

import frappe
from frappe.utils import getdate, today


def _fiscal_year_dates(day=None):
    d = getdate(day or today())
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start}-04-01", f"{start + 1}-03-31"


def complete(school: str = "Demo Public School", abbr: str = "DPS", email: str = "admin@example.com",
             password: str | None = None, full_name: str = "School Admin", language: str = "English"):
    if frappe.is_setup_complete() and frappe.get_all("Company", limit=1):
        print("Setup wizard already complete.")
        return
    from frappe.desk.page.setup_wizard.setup_wizard import setup_complete

    fy_start, fy_end = _fiscal_year_dates()
    setup_complete({
        "language": language,
        "country": "India",
        "timezone": "Asia/Kolkata",
        "currency": "INR",
        "full_name": full_name,
        "email": email,
        "password": password or frappe.generate_hash(length=16),
        "company_name": school,
        "company_abbr": abbr,
        "chart_of_accounts": "Standard",
        "fy_start_date": fy_start,
        "fy_end_date": fy_end,
        "setup_demo": 0,
        "enable_telemetry": 0,
    })
    frappe.db.commit()
    frappe.clear_cache()
    print(f"Setup complete for {school} (financial year {fy_start} to {fy_end}).")


def check():
    """Print a go-live health check. Exit code is non-zero if something essential is missing.

        bench --site <site> execute schoolos.setup_site.check
    """
    rows, bad = [], 0

    def item(ok, label, hint=""):
        nonlocal bad
        bad += 0 if ok else 1
        rows.append(("OK  " if ok else "FIX ") + label + ("" if ok else f"  ->  {hint}"))

    apps = frappe.get_installed_apps()
    for app in ("frappe", "erpnext", "hrms", "education", "schoolos"):
        item(app in apps, f"app installed: {app}", f"bench --site {frappe.local.site} install-app {app}")
    item(frappe.is_setup_complete(), "setup wizard complete", "bench execute schoolos.setup_site.complete")
    item(bool(frappe.get_all("Company", limit=1)), "company exists")
    item(frappe.db.exists("Role", "School Principal"), "School Principal role", "bench migrate")
    item(frappe.db.exists("Grading Scale", "CBSE 8-Point"), "grading scales", "bench migrate")
    item(frappe.db.exists("Print Format", "SchoolOS Report Card"), "report card print format", "bench migrate")

    from frappe.utils.scheduler import is_scheduler_disabled

    item(not is_scheduler_disabled(), "scheduler enabled", "bench --site <site> enable-scheduler")
    item(bool(frappe.get_all("Email Account", filters={"enable_outgoing": 1}, limit=1)),
         "outgoing email account", "Desk -> Email Account -> set up the school's mailbox")

    s = frappe.get_single("SchoolOS Settings")
    item(bool(s.school_display_name), "school name in SchoolOS Settings", "SchoolOS Settings -> Branding")
    item(bool(s.portal_url) and str(s.portal_url).startswith("https://"), "portal URL is https",
         "SchoolOS Settings -> Portal URL, e.g. https://app.sunriseschool.in/school")
    if s.alerts_enabled and not s.dry_run and s.whatsapp_enabled:
        item(bool(s.whatsapp_phone_number_id and s.get_password("whatsapp_access_token", raise_exception=False)),
             "WhatsApp credentials", "see docs/WHATSAPP.md")
    rows.append(f"INFO Test Mode (no real messages): {'ON' if s.dry_run else 'OFF'}")
    rows.append(f"INFO students: {frappe.db.count('Student', {'enabled': 1})}, "
                f"student groups: {frappe.db.count('Student Group', {'disabled': 0})}, "
                f"instructors: {frappe.db.count('Instructor')}, guardians: {frappe.db.count('Guardian')}")
    if frappe.db.exists("User", "principal@demo.school"):
        rows.append("WARN demo logins exist (principal@demo.school ...): disable them before go-live")

    print("\n".join(rows))
    if bad:
        raise SystemExit(f"{bad} item(s) need fixing before go-live")
