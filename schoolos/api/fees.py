"""Fees: collection overview for the principal/accounts, dues and receipts for parents,
and fee reminders. Built on Frappe Education's own fee invoices (Sales Invoice with a
`student`) and ERPNext Payment Entries, so nothing about money is duplicated here."""

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, fmt_money, formatdate, getdate, today

from schoolos.alerts.engine import get_settings, queue_for_students
from schoolos.api.common import FEE_ROLES, require_login, require_student_access, roles
from schoolos.api.compute_fees import collection_series, next_due, reminder_due, split_by, summarize_invoices
from schoolos.modules import enabled, require


def require_fee_staff():
    require("fees")
    if not roles() & FEE_ROLES:
        raise frappe.PermissionError(_("Only the principal or accounts staff can see fees"))


def _year():
    y = frappe.db.get_single_value("Education Settings", "current_academic_year")
    if not y:
        return None, None, None
    ys, ye = frappe.db.get_value("Academic Year", y, ["year_start_date", "year_end_date"]) or (None, None)
    return y, ys, ye


def _invoices(year_start=None, year_end=None, students=None):
    conds, params = ["si.docstatus = 1", "ifnull(si.is_return, 0) = 0", "ifnull(si.student, '') != ''"], {}
    if year_start and year_end:
        conds.append("si.posting_date between %(ys)s and %(ye)s")
        params.update(ys=year_start, ye=year_end)
    if students:
        conds.append("si.student in %(students)s")
        params["students"] = tuple(students)
    return frappe.db.sql(
        f"""select si.name, si.student, st.student_name, si.grand_total, si.outstanding_amount, si.due_date,
                   si.posting_date, si.status, si.currency, si.fee_schedule
            from `tabSales Invoice` si left join `tabStudent` st on st.name = si.student
            where {' and '.join(conds)}
            order by si.due_date asc""",
        params, as_dict=True,
    )


def _student_sections(students, year):
    """student -> section (batch-based student group) for the year."""
    if not students:
        return {}
    rows = frappe.db.sql(
        """select sgs.student, sg.name from `tabStudent Group Student` sgs
           join `tabStudent Group` sg on sg.name = sgs.parent
           where sgs.student in %(s)s and sgs.active = 1 and sg.disabled = 0
             and (%(y)s is null or sg.academic_year = %(y)s)
           order by sg.group_based_on = 'Batch' desc, sg.creation asc""",
        {"s": tuple(students), "y": year}, as_dict=True,
    )
    out = {}
    for r in rows:
        out.setdefault(r.student, r.name)
    return out


def _payments(invoice_names, since=None):
    if not invoice_names:
        return []
    params = {"inv": tuple(invoice_names)}
    extra = ""
    if since:
        extra = "and pe.posting_date >= %(since)s"
        params["since"] = since
    return frappe.db.sql(
        f"""select pe.name, pe.posting_date as date, per.allocated_amount as amount, pe.mode_of_payment as mode,
                   per.reference_name as invoice, pe.reference_no
            from `tabPayment Entry Reference` per join `tabPayment Entry` pe on pe.name = per.parent
            where pe.docstatus = 1 and per.reference_doctype = 'Sales Invoice' and per.reference_name in %(inv)s {extra}
            order by pe.posting_date desc, pe.creation desc""",
        params, as_dict=True,
    )


def _fee_heads(invoice_names):
    if not invoice_names:
        return []
    return frappe.db.sql(
        """select item_name as head, sum(amount) as amount from `tabSales Invoice Item`
           where parent in %(inv)s group by item_name""",
        {"inv": tuple(invoice_names)}, as_dict=True,
    )


def _guardian_mobiles(students):
    if not students:
        return {}
    rows = frappe.db.sql(
        """select sg.parent as student, g.guardian_name, g.mobile_number from `tabStudent Guardian` sg
           join `tabGuardian` g on g.name = sg.guardian where sg.parenttype = 'Student' and sg.parent in %(s)s
           order by sg.idx asc""",
        {"s": tuple(students)}, as_dict=True,
    )
    out = {}
    for r in rows:
        out.setdefault(r.student, {"guardian": r.guardian_name, "mobile": r.mobile_number})
    return out


def _last_reminders(students):
    if not students:
        return {}
    rows = frappe.db.sql(
        """select student, max(creation) as last from `tabSchoolOS Alert Log`
           where alert_type = 'Fee Reminder' and student in %(s)s group by student""",
        {"s": tuple(students)}, as_dict=True,
    )
    return {r.student: str(r.last)[:10] for r in rows}


# ------------------------------------------------------------------ principal / accounts
@frappe.whitelist()
def summary():
    require_fee_staff()
    year, ys, ye = _year()
    invs = _invoices(ys, ye)
    students = list({i.student for i in invs})
    sections = _student_sections(students, year)
    for i in invs:
        i["group"] = sections.get(i.student)
    s = summarize_invoices(invs, today())

    names = [i.name for i in invs]
    pays = _payments(names)
    t = getdate(today())
    month_start = t.replace(day=1)
    s["collected_today"] = round(sum(flt(p.amount) for p in pays if getdate(p.date) == t), 2)
    s["collected_month"] = round(sum(flt(p.amount) for p in pays if getdate(p.date) >= month_start), 2)
    s["payments_today"] = sum(1 for p in pays if getdate(p.date) == t)
    s["daily"] = collection_series([p for p in pays if getdate(p.date) > add_days(t, -30)], add_days(t, -29), t)
    s["monthly"] = collection_series(pays, ys or add_days(t, -330), ye or t, by="month") if pays or ys else []
    s["modes"] = split_by([{"mode": p.mode or "Other", "amount": p.amount} for p in pays], "mode")
    s["heads"] = split_by(_fee_heads(names), "head", top=6)
    s["recent_payments"] = [
        {"date": str(p.date), "amount": flt(p.amount), "mode": p.mode, "invoice": p.invoice,
         "student_name": next((i.student_name for i in invs if i.name == p.invoice), "")}
        for p in pays[:10]
    ]
    top = s["defaulters"][:60]
    contacts = _guardian_mobiles([d["student"] for d in top])
    reminded = _last_reminders([d["student"] for d in top])
    for d in top:
        d.update(contacts.get(d["student"], {}))
        d["last_reminder"] = reminded.get(d["student"])
    s["defaulters"] = top
    s["academic_year"] = year
    s["currency"] = invs[0].currency if invs else "INR"
    s["reminders_this_month"] = frappe.db.count(
        "SchoolOS Alert Log", {"alert_type": "Fee Reminder", "creation": [">=", month_start]})
    return s


@frappe.whitelist(methods=["POST"])
def remind(students: str | list | None = None, overdue_only: int = 1):
    """Send fee reminders now. students: list (JSON) of student IDs, or blank for everyone with dues."""
    require_fee_staff()
    if isinstance(students, str):
        students = frappe.parse_json(students) if students.strip() else None
    year, ys, ye = _year()
    invs = _invoices(ys, ye, students=students or None)
    t = getdate(today())
    per_student = {}
    for i in invs:
        if flt(i.outstanding_amount) <= 0.005:
            continue
        if cint(overdue_only) and not (i.due_date and getdate(i.due_date) < t):
            continue
        per_student.setdefault(i.student, []).append(i)
    return _queue_reminders(per_student, f"manual|{t}")


def _queue_reminders(per_student, ref):
    sent = 0
    for student, rows in per_student.items():
        amount = sum(flt(r.outstanding_amount) for r in rows)
        due = min((r.due_date for r in rows if r.due_date), default=None)
        sent += queue_for_students(
            "Fee Reminder", [student], "Sales Invoice", rows[0].name,
            {"amount": fmt_money(amount, currency=rows[0].currency or "INR"),
             "due_date": formatdate(due, "dd MMM yyyy") if due else "-"},
            dedup_reference=f"{ref}|{rows[0].name}",
        )
    return {"students": len(per_student), "messages": sent}


def send_scheduled_reminders():
    """Daily: a few days before the due date, on the due date, then every N days while overdue."""
    s = get_settings()
    if not (enabled("fees") and cint(s.alerts_enabled) and cint(s.fee_reminders)):
        return
    year, ys, ye = _year()
    t = getdate(today())
    per_student = {}
    for i in _invoices(ys, ye):
        if flt(i.outstanding_amount) <= 0.005:
            continue
        if reminder_due(i.due_date, t, cint(s.fee_days_before), cint(s.fee_overdue_every)):
            per_student.setdefault(i.student, []).append(i)
    _queue_reminders(per_student, f"auto|{t}")


# ------------------------------------------------------------------ parents / students
def razorpay_enabled():
    return bool(frappe.db.get_single_value("Education Settings", "razorpay_key"))


def student_fees(student):
    """Dues, invoices and receipts for one student (access already checked)."""
    invs = _invoices(students=[student])
    pays = _payments([i.name for i in invs])
    items = {}
    if invs:
        for r in frappe.get_all("Sales Invoice Item", filters={"parent": ["in", [i.name for i in invs]]},
                                fields=["parent", "item_name", "amount"], order_by="idx asc"):
            items.setdefault(r.parent, []).append({"head": r.item_name, "amount": flt(r.amount)})
    t = getdate(today())
    out = []
    for i in invs:
        out.append({
            "invoice": i.name, "posting_date": str(i.posting_date), "due_date": str(i.due_date) if i.due_date else None,
            "total": flt(i.grand_total), "outstanding": flt(i.outstanding_amount), "status": i.status,
            "overdue": bool(flt(i.outstanding_amount) > 0.005 and i.due_date and getdate(i.due_date) < t),
            "heads": items.get(i.name, []), "currency": i.currency,
        })
    total = sum(i["total"] for i in out)
    outstanding = sum(i["outstanding"] for i in out)
    return {
        "invoices": out,
        "payments": [{"date": str(p.date), "amount": flt(p.amount), "mode": p.mode, "invoice": p.invoice,
                      "reference": p.reference_no} for p in pays],
        "total": round(total, 2), "paid": round(total - outstanding, 2), "outstanding": round(outstanding, 2),
        "overdue": round(sum(i["outstanding"] for i in out if i["overdue"]), 2),
        "next_due": next_due([{"due_date": i["due_date"], "outstanding_amount": i["outstanding"]} for i in out], t),
        "currency": out[0]["currency"] if out else "INR",
        "pay_online": razorpay_enabled(),
    }


@frappe.whitelist()
def for_student(student: str):
    require("fees")
    require_login()
    require_student_access(student)
    return student_fees(student)


@frappe.whitelist()
def receipt(invoice: str):
    """PDF of a fee invoice / receipt for the student, their guardians or staff."""
    require("fees")
    doc = frappe.get_doc("Sales Invoice", invoice)
    if not doc.get("student") or doc.docstatus != 1:
        raise frappe.PermissionError
    require_student_access(doc.student)
    from education.education.api import get_fees_print_format

    frappe.flags.ignore_print_permissions = True
    try:
        pdf = frappe.get_print("Sales Invoice", doc.name, get_fees_print_format() or None, doc=doc, as_pdf=True)
    finally:
        frappe.flags.ignore_print_permissions = False
    frappe.local.response.filename = f"Fee receipt {doc.name}.pdf"
    frappe.local.response.filecontent = pdf
    frappe.local.response.type = "pdf"
