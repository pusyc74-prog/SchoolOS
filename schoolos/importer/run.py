"""Student import: database side. Each row runs inside its own savepoint, so one bad row
never leaves half-created records and never stops the rest."""

import re

import frappe
from frappe import _
from frappe.utils import cint, getdate, now_datetime

from schoolos.importer.parse import check_rows, group_name
from schoolos.importer.xlsx import is_example_row, read_rows

PLACEHOLDER_DOMAIN = "students.noemail"


def _file_content(file_url):
    f = frappe.get_doc("File", {"file_url": file_url})
    return f.get_content()


def load(doc):
    """Read + check the uploaded sheet. Returns (checked_rows, missing_headers)."""
    if not doc.import_file:
        frappe.throw(_("Attach the filled-in Excel template first"))
    content = _file_content(doc.import_file)
    if isinstance(content, str):
        content = content.encode()
    rows, missing = read_rows(content)
    rows = [r for r in rows if not is_example_row(r)]
    checked = check_rows(rows, today=getdate())
    db_checks(checked, doc)
    return checked, missing


def db_checks(checked, doc):
    """Checks that need the database: classes exist, re-import matches."""
    programs = set(frappe.get_all("Program", pluck="name"))
    for c in checked:
        r = c["record"]
        if r["program"] and r["program"] not in programs and not cint(doc.create_missing_classes):
            c["errors"].append(f"Class '{r['program']}' doesn't exist (tick 'Create missing classes')")
        existing = find_student(r)
        c["action"] = "update" if existing else "create"
        c["student"] = existing


def find_student(r):
    if r.get("admission_no"):
        s = frappe.db.get_value("Student", {"schoolos_admission_no": r["admission_no"]})
        if s:
            return s
    if r.get("first_name") and r.get("date_of_birth"):
        return frappe.db.get_value("Student", {
            "first_name": r["first_name"], "last_name": r.get("last_name") or ["is", "not set"],
            "date_of_birth": r["date_of_birth"],
        })
    return None


def summary_text(checked, missing):
    lines = []
    if missing:
        lines.append("Missing required columns: " + ", ".join(missing))
    ok = [c for c in checked if not c["errors"]]
    lines.append(f"{len(checked)} rows · {len(ok)} ready · {len(checked) - len(ok)} with errors · "
                 f"{sum(1 for c in ok if c.get('action') == 'update')} will update existing students")
    for c in checked:
        for e in c["errors"]:
            lines.append(f"Row {c['row']}: ERROR {e}")
    for c in checked:
        for w in c["warnings"]:
            lines.append(f"Row {c['row']}: note: {w}")
    return "\n".join(lines)


# ------------------------------------------------------------------ creation helpers
def ensure_program(name):
    if not frappe.db.exists("Program", name):
        frappe.get_doc({"doctype": "Program", "program_name": name}).insert(ignore_permissions=True)
    return name


def ensure_batch(section):
    if not frappe.db.exists("Student Batch Name", section):
        frappe.get_doc({"doctype": "Student Batch Name", "batch_name": section}).insert(ignore_permissions=True)
    return section


def ensure_group(program, section, year):
    name = group_name(program, section, year)
    if not frappe.db.exists("Student Group", name):
        frappe.get_doc({
            "doctype": "Student Group", "student_group_name": name, "group_based_on": "Batch",
            "program": program, "batch": ensure_batch(section), "academic_year": year,
        }).insert(ignore_permissions=True)
    return name


def ensure_guardian(name, mobile, email):
    if not (name or mobile or email):
        return None
    existing = None
    if mobile:
        existing = frappe.db.get_value("Guardian", {"mobile_number": ["in", [mobile, mobile[-10:]]]})
    if not existing and email:
        existing = frappe.db.get_value("Guardian", {"email_address": email})
    if existing:
        g = frappe.get_doc("Guardian", existing)
        changed = False
        if email and not g.email_address:
            g.email_address, changed = email, True
        if mobile and not g.mobile_number:
            g.mobile_number, changed = mobile, True
        if changed:
            g.save(ignore_permissions=True)
        return g.name
    return frappe.get_doc({
        "doctype": "Guardian", "guardian_name": name or "Parent", "mobile_number": mobile,
        "email_address": email, "schoolos_alerts_opt_in": 1,
    }).insert(ignore_permissions=True).name


def placeholder_email(r):
    base = re.sub(r"[^a-z0-9]+", ".", (r.get("admission_no") or f"{r['first_name']}.{r.get('last_name') or ''}").lower())
    return f"{base.strip('.')}.{frappe.generate_hash(length=5)}@{PLACEHOLDER_DOMAIN}"


def upsert_student(r, existing, year):
    guardians = []
    for rel, n, m, e in (("Father", r["father_name"], r["father_mobile"], r["father_email"]),
                         ("Mother", r["mother_name"], r["mother_mobile"], r["mother_email"])):
        g = ensure_guardian(n, m, e)
        if g:
            guardians.append((g, rel))

    values = {
        "first_name": r["first_name"], "middle_name": r["middle_name"] or None, "last_name": r["last_name"] or None,
        "gender": r["gender"], "date_of_birth": r["date_of_birth"],
        "student_mobile_number": r["student_mobile"],
        "blood_group": r["blood_group"] or None, "address_line_1": r["address"] or None,
        "city": r["city"] or None, "pincode": r["pincode"] or None,
        "schoolos_admission_no": r["admission_no"] or None,
    }
    if existing:
        doc = frappe.get_doc("Student", existing)
        doc.update({k: v for k, v in values.items() if v})
        if r["student_email"] and doc.student_email_id.endswith("@" + PLACEHOLDER_DOMAIN):
            doc.student_email_id = r["student_email"]
    else:
        ys = frappe.db.get_value("Academic Year", year, "year_start_date")
        doc = frappe.get_doc({
            "doctype": "Student", **values,
            "student_email_id": r["student_email"] or placeholder_email(r),
            "joining_date": r["joining_date"] or ys,
        })
    have = {row.guardian for row in doc.get("guardians", [])}
    for g, rel in guardians:
        if g not in have:
            doc.append("guardians", {"guardian": g, "relation": rel})
    doc.save(ignore_permissions=True) if existing else doc.insert(ignore_permissions=True)
    return doc.name


def ensure_enrollment(student, program, year, joining_date=None):
    if frappe.db.exists("Program Enrollment", {"student": student, "program": program,
                                               "academic_year": year, "docstatus": 1}):
        return
    ys = frappe.db.get_value("Academic Year", year, "year_start_date")
    pe = frappe.get_doc({"doctype": "Program Enrollment", "student": student, "program": program,
                         "academic_year": year, "enrollment_date": joining_date or ys})
    pe.insert(ignore_permissions=True)
    pe.submit()


def add_to_group(group, student, roll_no):
    g = frappe.get_doc("Student Group", group)
    rolls = {row.group_roll_number for row in g.students if row.student != student}
    for row in g.students:
        if row.student == student:
            if roll_no and roll_no not in rolls:
                row.group_roll_number = roll_no
            row.active = 1
            break
    else:
        g.append("students", {"student": student, "active": 1,
                              "group_roll_number": roll_no if roll_no and roll_no not in rolls else None})
    g.save(ignore_permissions=True)


# ------------------------------------------------------------------ job
def run(name):
    doc = frappe.get_doc("SchoolOS Student Import", name)
    doc.db_set({"status": "Importing", "started_on": now_datetime()})
    frappe.db.commit()
    skip_before = frappe.db.get_single_value("Education Settings", "user_creation_skip")
    if not cint(doc.create_student_logins):
        frappe.db.set_single_value("Education Settings", "user_creation_skip", 1)
    try:
        checked, missing = load(doc)
        if missing:
            frappe.throw(_("Missing required columns: {0}").format(", ".join(missing)))
        year = doc.academic_year
        done = failed = 0
        log = []
        todo = [c for c in checked if not c["errors"]]
        for i, c in enumerate(todo, 1):
            r = c["record"]
            sp = f"row_{c['row']}"
            frappe.db.savepoint(sp)
            try:
                ensure_program(r["program"])
                group = ensure_group(r["program"], r["section"], year)
                student = upsert_student(r, c.get("student"), year)
                ensure_enrollment(student, r["program"], year, r["joining_date"])
                add_to_group(group, student, r["roll_no"])
                frappe.db.release_savepoint(sp)
                done += 1
                log.append(f"Row {c['row']}: {'updated' if c.get('student') else 'created'} {student} · {group}")
            except Exception as e:
                frappe.db.rollback(save_point=sp)
                failed += 1
                log.append(f"Row {c['row']}: FAILED {frappe.utils.strip_html(str(e))[:300]}")
            if i % 20 == 0 or i == len(todo):
                frappe.db.commit()
                frappe.publish_progress(i * 100 / len(todo), title=_("Importing students"),
                                        doctype=doc.doctype, docname=doc.name)
        skipped = len(checked) - len(todo)
        for c in checked:
            for e in c["errors"]:
                log.append(f"Row {c['row']}: SKIPPED {e}")
        doc.reload()
        doc.db_set({
            "status": "Completed" if not (failed or skipped) else "Completed with Errors",
            "total_rows": len(checked), "valid_rows": len(todo), "imported_rows": done, "failed_rows": failed + skipped,
            "log": "\n".join(log), "finished_on": now_datetime(),
        })
    except Exception as e:
        frappe.db.rollback()
        doc.db_set({"status": "Failed", "log": str(e), "finished_on": now_datetime()})
        frappe.log_error(title=f"Student import {name} failed")
    finally:
        frappe.db.set_single_value("Education Settings", "user_creation_skip", skip_before or 0)
        frappe.db.commit()
