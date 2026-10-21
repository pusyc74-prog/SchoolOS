"""Message building for alerts (pure Python, no Frappe imports)."""

import re

_PLACEHOLDER = re.compile(r"\{(\w+)\}")

# Body parameters each WhatsApp template must accept, in order.
# Create templates in Meta WhatsApp Manager with exactly this many {{n}} slots.
TEMPLATE_PARAMS = {
    "Absence": ["guardian_name", "student_name", "date", "school_name"],
    "Circular": ["guardian_name", "title", "school_name", "portal_url"],
    "Report Card": ["guardian_name", "student_name", "exam", "school_name", "portal_url"],
    "Test": ["guardian_name", "school_name"],
}

DEFAULT_EMAIL = {
    "Absence": (
        "{student_name} was marked absent on {date}",
        "Dear {guardian_name},<br><br>{student_name} was marked <b>absent</b> on {date}."
        "<br>If this is unexpected, please contact the school.<br><br>{school_name}",
    ),
    "Circular": (
        "{school_name}: {title}",
        "Dear {guardian_name},<br><br>{body}<br><br>View on the school portal: "
        '<a href="{portal_url}">{portal_url}</a><br><br>{school_name}',
    ),
    "Report Card": (
        "{student_name}'s report card for {exam} is ready",
        "Dear {guardian_name},<br><br>The report card for {student_name} ({exam}) "
        'has been published. View or download it here: <a href="{portal_url}">{portal_url}</a>'
        "<br><br>{school_name}",
    ),
    "Test": ("Test message from {school_name}", "This is a test alert from {school_name}."),
}


def render(text, context):
    """Replace {key} placeholders; unknown keys are left untouched."""
    if not text:
        return ""
    return _PLACEHOLDER.sub(lambda m: str(context.get(m.group(1), m.group(0))), text)


def template_params(alert_type, context):
    """Ordered WhatsApp body parameters for an alert type."""
    keys = TEMPLATE_PARAMS.get(alert_type, [])
    return [str(context.get(k) or "-")[:60] for k in keys]


def whatsapp_template_payload(to, template_name, language, params):
    """Build a WhatsApp Cloud API 'template' message payload."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language or "en"}},
    }
    if params:
        payload["template"]["components"] = [
            {"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}
        ]
    return payload


def dedup_key(alert_type, reference, recipient, channel):
    """One alert per type + reference + recipient + channel."""
    return "|".join(str(x) for x in (alert_type, reference, recipient, channel))[:140]
