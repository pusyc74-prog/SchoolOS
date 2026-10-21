"""Student import: column definitions and row checks (pure Python, no Frappe imports).

One row per student. Parents/guardians are on the same row; siblings who share a
parent's mobile number are linked to the same Guardian record.
"""

import re
from datetime import date, datetime

from schoolos.utils.phone import normalize_mobile

# (key, header in the template, required, example value, help text)
COLUMNS = [
    ("program", "Class", True, "Class 5", "Class / standard. Created if it doesn't exist."),
    ("section", "Section", True, "A", "Division / section within the class."),
    ("roll_no", "Roll No", False, 7, "Number only."),
    ("admission_no", "Admission / GR No", False, "GR-2019-0412", "Used to find the student again on re-import."),
    ("first_name", "First Name", True, "Riya", ""),
    ("middle_name", "Middle Name", False, "Suresh", ""),
    ("last_name", "Last Name", False, "Patil", ""),
    ("gender", "Gender", True, "Female", "Male, Female or Other (M / F also accepted)."),
    ("date_of_birth", "Date of Birth", True, "14-05-2016", "DD-MM-YYYY."),
    ("joining_date", "Joining Date", False, "01-06-2021", "DD-MM-YYYY. Blank = start of academic year."),
    ("student_mobile", "Student Mobile", False, "", ""),
    ("student_email", "Student Email", False, "", "Needed only if the student will log in."),
    ("blood_group", "Blood Group", False, "B+", "A+, A-, B+, B-, AB+, AB-, O+, O-"),
    ("address", "Address", False, "12, Vishrambag", ""),
    ("city", "City", False, "Sangli", ""),
    ("pincode", "Pincode", False, "416415", ""),
    ("father_name", "Father Name", False, "Suresh Patil", ""),
    ("father_mobile", "Father Mobile", False, "9876543210", "10-digit Indian mobile. Used for WhatsApp alerts."),
    ("father_email", "Father Email", False, "suresh@example.com", ""),
    ("mother_name", "Mother Name", False, "Anita Patil", ""),
    ("mother_mobile", "Mother Mobile", False, "9876501234", ""),
    ("mother_email", "Mother Email", False, "", ""),
]
HEADERS = {c[1].lower(): c[0] for c in COLUMNS}
REQUIRED = [c[0] for c in COLUMNS if c[2]]
BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def map_headers(header_row):
    """Return {column_index: key} for recognised headers (case/space-insensitive)."""
    out = {}
    for i, h in enumerate(header_row):
        key = HEADERS.get(re.sub(r"\s+", " ", str(h or "")).strip().rstrip("*").strip().lower())
        if key:
            out[i] = key
    return out


def parse_date(v):
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"'{s}' is not a date (use DD-MM-YYYY)")


def parse_gender(v):
    s = str(v or "").strip().lower()
    return {"m": "Male", "male": "Male", "boy": "Male", "f": "Female", "female": "Female", "girl": "Female",
            "o": "Other", "other": "Other"}.get(s)


def _text(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def clean_row(raw, today=None):
    """raw: {key: cell value}. Returns (record, errors, warnings)."""
    today = today or date.today()
    r = {k: _text(raw.get(k)) for k, *_ in COLUMNS}
    errors, warnings = [], []

    for k in REQUIRED:
        if not r[k]:
            errors.append(f"{dict((c[0], c[1]) for c in COLUMNS)[k]} is required")

    if r["gender"]:
        g = parse_gender(r["gender"])
        if not g:
            errors.append(f"Gender '{r['gender']}' not recognised (use Male / Female / Other)")
        r["gender"] = g or r["gender"]

    for k, label in (("date_of_birth", "Date of Birth"), ("joining_date", "Joining Date")):
        try:
            r[k] = parse_date(raw.get(k)) if raw.get(k) not in (None, "") else None
        except ValueError as e:
            errors.append(f"{label}: {e}")
            r[k] = None
    if r["date_of_birth"] and r["date_of_birth"] >= today:
        errors.append("Date of Birth must be in the past")

    if r["roll_no"]:
        try:
            r["roll_no"] = int(float(r["roll_no"]))
        except ValueError:
            errors.append(f"Roll No '{r['roll_no']}' must be a number")
            r["roll_no"] = None
    else:
        r["roll_no"] = None

    for k, label in (("student_mobile", "Student Mobile"), ("father_mobile", "Father Mobile"),
                     ("mother_mobile", "Mother Mobile")):
        if r[k]:
            n = normalize_mobile(r[k])
            if not n:
                errors.append(f"{label} '{r[k]}' is not a valid mobile number")
            r[k] = n
        else:
            r[k] = None

    for k, label in (("student_email", "Student Email"), ("father_email", "Father Email"),
                     ("mother_email", "Mother Email")):
        if r[k]:
            r[k] = r[k].lower()
            if not _EMAIL.match(r[k]):
                errors.append(f"{label} '{r[k]}' is not a valid email")

    if r["blood_group"]:
        bg = r["blood_group"].upper().replace(" ", "")
        bg = bg.replace("POSITIVE", "+").replace("NEGATIVE", "-").replace("VE", "")
        if bg in BLOOD_GROUPS:
            r["blood_group"] = bg
        else:
            warnings.append(f"Blood Group '{r['blood_group']}' ignored")
            r["blood_group"] = ""

    if not (r["father_mobile"] or r["mother_mobile"] or r["father_email"] or r["mother_email"]):
        warnings.append("No parent mobile or email: this family won't get alerts")
    if r["father_mobile"] and not r["father_name"]:
        r["father_name"] = f"Father of {r['first_name']}".strip()
    if r["mother_mobile"] and not r["mother_name"]:
        r["mother_name"] = f"Mother of {r['first_name']}".strip()

    return r, errors, warnings


def check_rows(rows, today=None):
    """rows: list of raw dicts (in file order). Returns list of
    {row: excel_row_number, record, errors, warnings} with cross-row checks
    (duplicate admission numbers, duplicate roll numbers in a section)."""
    out = []
    seen_adm, seen_roll = {}, {}
    for i, raw in enumerate(rows):
        if not any(_text(v) for v in raw.values()):
            continue
        rec, errs, warns = clean_row(raw, today)
        n = i + 2  # header is row 1
        if rec["admission_no"]:
            if rec["admission_no"] in seen_adm:
                errs.append(f"Admission No {rec['admission_no']} repeats row {seen_adm[rec['admission_no']]}")
            seen_adm.setdefault(rec["admission_no"], n)
        if rec["roll_no"] is not None and rec["program"] and rec["section"]:
            key = (rec["program"], rec["section"], rec["roll_no"])
            if key in seen_roll:
                errs.append(f"Roll No {rec['roll_no']} repeats row {seen_roll[key]} in {rec['program']} {rec['section']}")
            seen_roll.setdefault(key, n)
        out.append({"row": n, "record": rec, "errors": errs, "warnings": warns})
    return out


def group_name(program, section, academic_year):
    return f"{program} - {section} ({academic_year})"
