"""Message building for alerts (pure Python, no Frappe imports)."""

import re

_PLACEHOLDER = re.compile(r"\{(\w+)\}")

# Body parameters each WhatsApp template must accept, in order.
# Create templates in Meta WhatsApp Manager with exactly this many {{n}} slots.
TEMPLATE_PARAMS = {
    "Absence": ["guardian_name", "student_name", "date", "school_name"],
    "Circular": ["guardian_name", "title", "school_name", "portal_url"],
    "Report Card": ["guardian_name", "student_name", "exam", "school_name", "portal_url"],
    "Homework": ["guardian_name", "student_name", "title", "due_date", "school_name"],
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
    "Homework": (
        "{entry_type} for {student_name}: {title}",
        "Dear {guardian_name},<br><br><b>{entry_type}</b> for {student_name} ({subject}): <b>{title}</b>"
        "<br>Due: {due_date}<br><br>{body}<br><br>See all homework on the school portal: "
        '<a href="{portal_url}">{portal_url}</a><br><br>{school_name}',
    ),
    "Test": ("Test message from {school_name}", "This is a test alert from {school_name}."),
}


# Marathi versions, used when SchoolOS Settings → Alert Language = mr
DEFAULT_EMAIL_MR = {
    "Absence": (
        "{student_name} यांची {date} रोजी गैरहजेरी",
        "प्रिय {guardian_name},<br><br>{student_name} यांची {date} रोजी <b>गैरहजेरी</b> नोंदवली आहे."
        "<br>हे अनपेक्षित असल्यास कृपया शाळेशी संपर्क साधा.<br><br>{school_name}",
    ),
    "Circular": (
        "{school_name}: {title}",
        "प्रिय {guardian_name},<br><br>{body}<br><br>शाळेच्या पोर्टलवर पहा: "
        '<a href="{portal_url}">{portal_url}</a><br><br>{school_name}',
    ),
    "Report Card": (
        "{student_name} यांचे {exam} प्रगतीपत्रक तयार आहे",
        "प्रिय {guardian_name},<br><br>{student_name} ({exam}) यांचे प्रगतीपत्रक प्रसिद्ध झाले आहे. "
        'येथे पहा किंवा डाउनलोड करा: <a href="{portal_url}">{portal_url}</a><br><br>{school_name}',
    ),
    "Homework": (
        "{student_name} साठी {entry_type}: {title}",
        "प्रिय {guardian_name},<br><br>{student_name} साठी <b>{entry_type}</b> ({subject}): <b>{title}</b>"
        "<br>मुदत: {due_date}<br><br>{body}<br><br>सर्व गृहपाठ शाळेच्या पोर्टलवर पहा: "
        '<a href="{portal_url}">{portal_url}</a><br><br>{school_name}',
    ),
    "Test": ("{school_name} कडून चाचणी संदेश", "{school_name} कडून ही चाचणी सूचना आहे."),
}

ENTRY_TYPE_MR = {"Homework": "गृहपाठ", "Classwork": "वर्गकार्य", "Project": "प्रकल्प", "Note": "सूचना"}


def email_template(alert_type, lang="en"):
    """(subject, body) template for an alert type in the given language, English fallback."""
    table = DEFAULT_EMAIL_MR if lang == "mr" else DEFAULT_EMAIL
    return table.get(alert_type) or DEFAULT_EMAIL.get(alert_type) or ("{school_name}", "")


def localise_context(context, lang="en"):
    """Translate fixed values (e.g. entry type) that appear inside messages."""
    if lang == "mr" and context.get("entry_type") in ENTRY_TYPE_MR:
        return {**context, "entry_type": ENTRY_TYPE_MR[context["entry_type"]]}
    return context


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
