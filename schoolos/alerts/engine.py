"""Alert queueing and delivery.

Flow: an event (attendance submitted, circular published, report card published)
calls queue_for_students(). For every guardian who opted in, one SchoolOS Alert Log
row is created per channel (deduplicated), then delivered in the background.
In Test Mode (dry_run) rows are marked "Dry Run" and nothing is sent.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, get_url, now_datetime

from schoolos.alerts.messages import (
    dedup_key, email_template, localise_context, render, template_params, whatsapp_template_payload,
)
from schoolos.utils.phone import normalize_mobile

MAX_ATTEMPTS = 3


def get_settings():
    return frappe.get_cached_doc("SchoolOS Settings")


def school_name(settings=None):
    settings = settings or get_settings()
    return (
        settings.school_display_name
        or frappe.db.get_single_value("Education Settings", "school_college_name_abbreviation")
        or frappe.db.get_default("company")
        or "School"
    )


def portal_url(settings=None):
    settings = settings or get_settings()
    return settings.portal_url or get_url("/school")


def get_contacts(student):
    """Guardians of a student who opted in, with normalised mobile numbers.

    Falls back to the student's own mobile/email if no guardian is linked.
    """
    guardians = frappe.get_all(
        "Student Guardian",
        filters={"parent": student, "parenttype": "Student"},
        pluck="guardian",
        order_by="idx asc",
    )
    contacts = []
    if guardians:
        rows = frappe.get_all(
            "Guardian",
            filters={"name": ["in", guardians]},
            fields=["name", "guardian_name", "mobile_number", "email_address", "schoolos_alerts_opt_in"],
        )
        for g in rows:
            if not cint(g.schoolos_alerts_opt_in):
                continue
            contacts.append({
                "guardian": g.name,
                "name": g.guardian_name,
                "mobile": normalize_mobile(g.mobile_number),
                "email": (g.email_address or "").strip() or None,
            })
    else:
        s = frappe.db.get_value(
            "Student", student, ["student_name", "student_mobile_number", "student_email_id"], as_dict=True
        )
        if s:
            contacts.append({
                "guardian": None,
                "name": s.student_name,
                "mobile": normalize_mobile(s.student_mobile_number),
                "email": (s.student_email_id or "").strip() or None,
            })
    return contacts


def queue_for_students(alert_type, students, reference_doctype, reference_name, context,
                       dedup_reference=None, channels=None, template=None):
    """Create alert log rows for each student's guardians and enqueue delivery.

    students: list of student IDs
    context: dict of message values; student_name / guardian_name are filled per row
    channels: subset of {"WhatsApp", "Email"}; defaults to what settings allow
    Returns number of log rows created.
    """
    settings = get_settings()
    if not cint(settings.alerts_enabled):
        return 0

    allowed = set(channels or ["WhatsApp", "Email"])
    if not cint(settings.whatsapp_enabled):
        allowed.discard("WhatsApp")
    if not cint(settings.send_email):
        allowed.discard("Email")
    if not allowed:
        return 0

    base = {"school_name": school_name(settings), "portal_url": portal_url(settings), **(context or {})}
    names = dict(frappe.get_all("Student", filters={"name": ["in", list(students)]},
                                fields=["name", "student_name"], as_list=True))
    created = []
    for student in students:
        for c in get_contacts(student):
            ctx = {**base, "student_name": names.get(student, student), "guardian_name": c["name"] or "Parent"}
            ref = dedup_reference or reference_name
            if "WhatsApp" in allowed and c["mobile"]:
                created.append(_make_log(alert_type, "WhatsApp", c["mobile"], c, student,
                                         reference_doctype, reference_name,
                                         dedup_key(alert_type, f"{ref}|{student}", c["mobile"], "WhatsApp"),
                                         ctx, settings, template))
            if "Email" in allowed and c["email"]:
                created.append(_make_log(alert_type, "Email", c["email"], c, student,
                                         reference_doctype, reference_name,
                                         dedup_key(alert_type, f"{ref}|{student}", c["email"], "Email"),
                                         ctx, settings, template))
    created = [n for n in created if n]
    for name in created:
        frappe.enqueue("schoolos.alerts.engine.deliver", log=name, queue="short", enqueue_after_commit=True)
    return len(created)


def _template_for(alert_type, settings, override=None):
    if override:
        return override
    return {
        "Absence": settings.absence_template,
        "Circular": settings.circular_template,
        "Report Card": settings.report_card_template,
        "Homework": settings.homework_template,
    }.get(alert_type)


def _make_log(alert_type, channel, recipient, contact, student, ref_dt, ref_name, key, ctx, settings, template):
    if frappe.db.exists("SchoolOS Alert Log", {"dedup_key": key}):
        return None
    lang = settings.alert_language or "en"
    ctx = localise_context(ctx, lang)
    subject_tpl, body_tpl = email_template(alert_type, lang)
    doc = frappe.get_doc({
        "doctype": "SchoolOS Alert Log",
        "alert_type": alert_type,
        "channel": channel,
        "status": "Queued",
        "recipient": recipient,
        "recipient_name": contact.get("name"),
        "guardian": contact.get("guardian"),
        "student": student,
        "reference_doctype": ref_dt,
        "reference_name": ref_name,
        "dedup_key": key,
        "template": _template_for(alert_type, settings, template) if channel == "WhatsApp" else None,
        "params": json.dumps(template_params(alert_type, ctx)) if channel == "WhatsApp" else None,
        "subject": render(subject_tpl, ctx),
        "message": render(body_tpl, ctx),
    })
    doc.insert(ignore_permissions=True)
    return doc.name


def deliver(log):
    """Send one queued alert. Safe to call again for failed rows."""
    doc = frappe.get_doc("SchoolOS Alert Log", log)
    if doc.status in ("Sent", "Dry Run", "Skipped"):
        return
    settings = get_settings()
    doc.attempts = cint(doc.attempts) + 1

    if cint(settings.dry_run):
        doc.status = "Dry Run"
        doc.error = None
        doc.save(ignore_permissions=True)
        return

    try:
        if doc.channel == "WhatsApp":
            doc.provider_message_id = send_whatsapp(doc.recipient, doc.template,
                                                    json.loads(doc.params or "[]"), settings)
        else:
            frappe.sendmail(recipients=[doc.recipient], subject=doc.subject, message=doc.message,
                            reference_doctype=doc.reference_doctype, reference_name=doc.reference_name)
        doc.status = "Sent"
        doc.sent_on = now_datetime()
        doc.error = None
    except Exception as e:
        doc.status = "Failed"
        doc.error = str(e)[:1000]
        frappe.log_error(title=f"SchoolOS alert {doc.name} failed")
    doc.save(ignore_permissions=True)


def send_whatsapp(to, template, params, settings=None):
    """Send a template message through Meta's WhatsApp Cloud API. Returns message id."""
    settings = settings or get_settings()
    phone_id = settings.whatsapp_phone_number_id
    token = settings.get_password("whatsapp_access_token", raise_exception=False)
    if not (phone_id and token and template):
        frappe.throw(_("WhatsApp is not fully configured in SchoolOS Settings"))
    version = settings.whatsapp_api_version or "v23.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    payload = whatsapp_template_payload(to, template, settings.whatsapp_language, params)

    import requests

    resp = requests.post(url, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=20)
    data = {}
    try:
        data = resp.json()
    except ValueError:
        pass
    if resp.status_code >= 400:
        err = (data.get("error") or {}).get("message") or resp.text[:300]
        raise Exception(f"WhatsApp API {resp.status_code}: {err}")
    msgs = data.get("messages") or [{}]
    return msgs[0].get("id")


def retry_failed():
    """Hourly: retry failed alerts from the last day, up to MAX_ATTEMPTS."""
    rows = frappe.get_all(
        "SchoolOS Alert Log",
        filters={
            "status": ["in", ["Failed", "Queued"]],
            "attempts": ["<", MAX_ATTEMPTS],
            "creation": [">", frappe.utils.add_days(now_datetime(), -1)],
        },
        pluck="name",
        limit=500,
    )
    for name in rows:
        frappe.enqueue("schoolos.alerts.engine.deliver", log=name, queue="short")


@frappe.whitelist()
def send_test(mobile=None, email=None):
    """Send a test alert from SchoolOS Settings (respects Test Mode)."""
    frappe.only_for(["System Manager", "Education Manager", "School Principal"])
    settings = get_settings()
    ctx = {"school_name": school_name(settings), "guardian_name": "Parent"}
    made = []
    stamp = now_datetime().isoformat()
    if mobile:
        to = normalize_mobile(mobile)
        if not to:
            frappe.throw(_("Invalid mobile number"))
        made.append(_make_log("Test", "WhatsApp", to, {"name": "Test"}, None, None, None,
                              dedup_key("Test", stamp, to, "WhatsApp"), ctx, settings,
                              settings.absence_template))
    if email:
        made.append(_make_log("Test", "Email", email, {"name": "Test"}, None, None, None,
                              dedup_key("Test", stamp, email, "Email"), ctx, settings, None))
    for name in made:
        deliver(name)
    return [frappe.db.get_value("SchoolOS Alert Log", n, ["name", "channel", "status", "error"], as_dict=True)
            for n in made]
