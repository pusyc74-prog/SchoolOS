"""Accounts for the principal / trustee, built on ERPNext's books.

Two modes (SchoolOS Settings → Accounts):
- Full accounting: the accountant works in ERPNext. This dashboard shows income vs expenses,
  cash and bank balances, salary cost, bills to pay and expenses waiting for approval.
- Tally: the CA keeps Tally. SchoolOS exports fee invoices and receipts as Tally import files.
"""

import io

import frappe
from frappe import _
from frappe.utils import add_days, cint, flt, getdate, nowdate, today

from schoolos.api.common import FEE_ROLES, PRINCIPAL_ROLES, roles
from schoolos.api.compute_accounts import (
    build_tally_masters_xml, build_tally_vouchers_xml, income_expense_series, payables_summary, tally_vouchers, totals,
)
from schoolos.api.compute_fees import split_by
from schoolos.modules import require

APPROVER_ROLES = PRINCIPAL_ROLES | {"Accounts Manager"}


def _require_accounts():
    require("accounts")
    if not roles() & FEE_ROLES:
        raise frappe.PermissionError(_("Only the principal or accounts staff can see accounts"))


def _company():
    return (frappe.defaults.get_user_default("Company")
            or frappe.db.get_single_value("Global Defaults", "default_company")
            or frappe.get_all("Company", pluck="name", limit=1)[0])


def _fiscal_year(company):
    from erpnext.accounts.utils import get_fiscal_year

    fy = get_fiscal_year(today(), company=company, as_dict=True, raise_on_missing=False)
    if fy:
        return fy.name, getdate(fy.year_start_date), getdate(fy.year_end_date)
    t = getdate(today())
    start_year = t.year if t.month >= 4 else t.year - 1  # Indian financial year
    return f"{start_year}-{start_year + 1}", getdate(f"{start_year}-04-01"), getdate(f"{start_year + 1}-03-31")


def _settings():
    return frappe.get_cached_doc("SchoolOS Settings")


def mode():
    return "tally" if (_settings().accounts_mode or "").startswith("Tally") else "full"


# ------------------------------------------------------------------ dashboard
@frappe.whitelist()
def summary():
    _require_accounts()
    company = _company()
    fy, ys, ye = _fiscal_year(company)
    t = getdate(today())
    out = {"mode": mode(), "company": company, "fiscal_year": fy, "currency":
           frappe.get_cached_value("Company", company, "default_currency") or "INR",
           "can_approve": bool(roles() & APPROVER_ROLES)}
    if out["mode"] == "tally":
        out.update(_tally_status(company))
        return out

    rows = frappe.db.sql(
        """select date_format(gle.posting_date, '%%Y-%%m') as month, acc.root_type,
                  sum(case when acc.root_type = 'Income' then gle.credit - gle.debit else gle.debit - gle.credit end) as amount
           from `tabGL Entry` gle join `tabAccount` acc on acc.name = gle.account
           where gle.company = %(c)s and gle.is_cancelled = 0 and acc.root_type in ('Income', 'Expense')
             and gle.posting_date between %(ys)s and %(ye)s
           group by month, acc.root_type""",
        {"c": company, "ys": ys, "ye": ye}, as_dict=True,
    )
    series = income_expense_series(rows, ys, ye)
    this_month = t.strftime("%Y-%m")
    out["monthly"] = series
    out["year"] = totals(series, upto_month=this_month)
    out["this_month"] = next((r for r in series if r["key"] == this_month), {"income": 0, "expense": 0, "surplus": 0})

    heads = frappe.db.sql(
        """select acc.account_name as label, sum(gle.debit - gle.credit) as amount
           from `tabGL Entry` gle join `tabAccount` acc on acc.name = gle.account
           where gle.company = %(c)s and gle.is_cancelled = 0 and acc.root_type = 'Expense'
             and gle.posting_date between %(ys)s and %(ye)s
           group by acc.account_name having amount > 0 order by amount desc""",
        {"c": company, "ys": ys, "ye": ye}, as_dict=True,
    )
    out["expense_heads"] = split_by(heads, "label", top=7)
    income_heads = frappe.db.sql(
        """select acc.account_name as label, sum(gle.credit - gle.debit) as amount
           from `tabGL Entry` gle join `tabAccount` acc on acc.name = gle.account
           where gle.company = %(c)s and gle.is_cancelled = 0 and acc.root_type = 'Income'
             and gle.posting_date between %(ys)s and %(ye)s
           group by acc.account_name having amount > 0 order by amount desc""",
        {"c": company, "ys": ys, "ye": ye}, as_dict=True,
    )
    out["income_heads"] = split_by(income_heads, "label", top=5)
    salary = sum(flt(h.amount) for h in heads if any(w in (h.label or "").lower() for w in ("salar", "wage", "payroll")))
    out["salary"] = {"amount": round(salary, 2),
                     "share_of_income": round(salary * 100 / out["year"]["income"], 1) if out["year"]["income"] else None}

    out["balances"] = [
        {"account": r.account_name, "type": r.account_type, "balance": round(flt(r.balance), 2)}
        for r in frappe.db.sql(
            """select acc.account_name, acc.account_type, sum(gle.debit - gle.credit) as balance
               from `tabGL Entry` gle join `tabAccount` acc on acc.name = gle.account
               where gle.company = %(c)s and gle.is_cancelled = 0 and acc.account_type in ('Cash', 'Bank')
                 and gle.posting_date <= %(t)s
               group by acc.name order by acc.account_type desc, balance desc""",
            {"c": company, "t": t}, as_dict=True)
    ]
    out["cash_today"] = frappe.db.sql(
        """select coalesce(sum(gle.debit), 0) as received, coalesce(sum(gle.credit), 0) as paid
           from `tabGL Entry` gle join `tabAccount` acc on acc.name = gle.account
           where gle.company = %(c)s and gle.is_cancelled = 0 and acc.account_type in ('Cash', 'Bank')
             and gle.posting_date = %(t)s""",
        {"c": company, "t": t}, as_dict=True)[0]

    bills = frappe.get_all("Purchase Invoice", filters={"company": company, "docstatus": 1, "outstanding_amount": [">", 0]},
                           fields=["name", "supplier_name as supplier", "outstanding_amount as outstanding", "due_date", "bill_no"],
                           order_by="due_date asc", limit=200)
    pay = payables_summary(bills, t)
    pay["bills"] = pay["bills"][:12]
    out["payables"] = pay
    out["approvals"] = _approvals(company)
    out["recent"] = [
        {"date": str(p.posting_date), "type": p.payment_type, "party": p.party_name or p.party, "mode": p.mode_of_payment,
         "amount": flt(p.paid_amount if p.payment_type == "Pay" else p.received_amount)}
        for p in frappe.get_all("Payment Entry", filters={"company": company, "docstatus": 1},
                                fields=["posting_date", "payment_type", "party_name", "party", "mode_of_payment", "paid_amount", "received_amount"],
                                order_by="posting_date desc, creation desc", limit=10)
    ]
    return out


def _approvals(company):
    items = []
    for b in frappe.get_all("Purchase Invoice", filters={"company": company, "docstatus": 0, "schoolos_rejected": 0},
                            fields=["name", "supplier_name", "grand_total", "posting_date", "bill_no", "remarks", "owner"],
                            order_by="posting_date asc", limit=30):
        items.append({"doctype": "Purchase Invoice", "name": b.name, "who": b.supplier_name, "amount": flt(b.grand_total),
                      "date": str(b.posting_date), "what": b.remarks or (f"Bill {b.bill_no}" if b.bill_no else _("Purchase bill")),
                      "by": frappe.utils.get_fullname(b.owner)})
    if frappe.db.exists("DocType", "Expense Claim"):
        for c in frappe.get_all("Expense Claim", filters={"company": company, "docstatus": 0, "approval_status": "Draft"},
                                fields=["name", "employee_name", "total_claimed_amount", "posting_date", "remark"],
                                order_by="posting_date asc", limit=30):
            items.append({"doctype": "Expense Claim", "name": c.name, "who": c.employee_name, "amount": flt(c.total_claimed_amount),
                          "date": str(c.posting_date), "what": c.remark or _("Staff expense claim"), "by": c.employee_name})
    items.sort(key=lambda i: i["date"])
    return items


@frappe.whitelist(methods=["POST"])
def decide(doctype: str, name: str, approve: int, note: str | None = None):
    """Approve or reject a draft purchase bill or staff expense claim from the dashboard."""
    require("accounts")
    if not roles() & APPROVER_ROLES:
        raise frappe.PermissionError(_("Only the principal or accounts manager can approve"))
    if doctype not in ("Purchase Invoice", "Expense Claim"):
        frappe.throw(_("Can't approve this document type here"))
    doc = frappe.get_doc(doctype, name)
    if doc.docstatus != 0:
        frappe.throw(_("{0} has already been processed").format(name))
    approved = bool(cint(approve))
    note = (note or "").strip()
    if not approved and not note:
        frappe.throw(_("Please give a reason for rejecting"))
    # The principal usually holds no ERPNext accounting roles, and posting a bill reads accounts,
    # cost centres etc. Access was checked above (APPROVER_ROLES), so post with system rights and
    # record who approved in a comment (audit trail).
    approver, approver_name = frappe.session.user, frappe.utils.get_fullname()
    frappe.set_user("Administrator")
    try:
        if doctype == "Purchase Invoice":
            if approved:
                doc.submit()
            else:
                doc.schoolos_rejected = 1
                doc.schoolos_rejection_note = note
                doc.save()
        else:
            doc.approval_status = "Approved" if approved else "Rejected"
            if approved:
                doc.total_sanctioned_amount = doc.total_sanctioned_amount or doc.total_claimed_amount
            doc.save()
            doc.submit()
        doc.add_comment("Comment", _("{0} by {1} ({2}){3}").format(
            _("Approved") if approved else _("Rejected"), approver_name, approver, f": {note}" if note else ""))
    finally:
        frappe.set_user(approver)
    return {"name": name, "status": "Approved" if approved else "Rejected"}


# ------------------------------------------------------------------ Tally export
def _tally_cfg():
    s = _settings()
    return {
        "party_mode": "single" if (s.tally_party_mode or "").startswith("One common") else "student",
        "party_ledger": s.tally_party_ledger, "income_ledger": s.tally_income_ledger,
        "income_group": s.tally_income_group, "debtors_group": s.tally_debtors_group,
        "cash_ledger": s.tally_cash_ledger, "bank_ledger": s.tally_bank_ledger,
    }


def _fee_data(from_date, to_date):
    invs = frappe.db.sql(
        """select si.name, si.posting_date as date, coalesce(st.student_name, si.customer_name) as student_name
           from `tabSales Invoice` si left join `tabStudent` st on st.name = si.student
           where si.docstatus = 1 and ifnull(si.student, '') != '' and ifnull(si.is_return, 0) = 0
             and si.posting_date between %(f)s and %(t)s order by si.posting_date, si.name""",
        {"f": from_date, "t": to_date}, as_dict=True,
    )
    heads = {}
    if invs:
        for r in frappe.get_all("Sales Invoice Item", filters={"parent": ["in", [i.name for i in invs]]},
                                fields=["parent", "item_name", "amount"], order_by="idx asc"):
            heads.setdefault(r.parent, []).append({"head": r.item_name, "amount": flt(r.amount)})
    invoices = [{"name": i.name, "date": str(i.date), "student_name": i.student_name, "heads": heads.get(i.name, [])}
                for i in invs if heads.get(i.name)]
    cash_modes = set(frappe.get_all("Mode of Payment", filters={"type": "Cash"}, pluck="name"))
    pays = frappe.db.sql(
        """select pe.name, pe.posting_date as date, sum(per.allocated_amount) as amount, pe.mode_of_payment, pe.reference_no,
                  coalesce(st.student_name, pe.party_name) as student_name
           from `tabPayment Entry` pe
           join `tabPayment Entry Reference` per on per.parent = pe.name and per.reference_doctype = 'Sales Invoice'
           join `tabSales Invoice` si on si.name = per.reference_name and ifnull(si.student, '') != ''
           left join `tabStudent` st on st.name = si.student
           where pe.docstatus = 1 and pe.posting_date between %(f)s and %(t)s
           group by pe.name order by pe.posting_date, pe.name""",
        {"f": from_date, "t": to_date}, as_dict=True,
    )
    payments = [{"name": p.name, "date": str(p.date), "student_name": p.student_name, "amount": flt(p.amount),
                 "cash": p.mode_of_payment in cash_modes, "reference": p.reference_no} for p in pays]
    return invoices, payments


def _tally_status(company):
    st = _settings()
    last = {"on": str(st.tally_last_export_on), "range": st.tally_last_export_range} if st.tally_last_export_on else None
    t = getdate(today())
    month_start = t.replace(day=1)
    invoices, payments = _fee_data(month_start, t)
    return {"tally_company": _settings().tally_company or company, "last_export": last,
            "month_invoices": len(invoices), "month_receipts": len(payments),
            "month_received": round(sum(p["amount"] for p in payments), 2),
            "cfg": _tally_cfg()}


@frappe.whitelist()
def tally_preview(from_date: str, to_date: str):
    _require_accounts()
    invoices, payments = _fee_data(getdate(from_date), getdate(to_date))
    vouchers, ledgers = tally_vouchers(invoices, payments, _tally_cfg())
    return {"invoices": len(invoices), "receipts": len(payments), "ledgers": len(ledgers),
            "billed": round(sum(sum(h["amount"] for h in i["heads"]) for i in invoices), 2),
            "received": round(sum(p["amount"] for p in payments), 2),
            "sample": vouchers[:5]}


@frappe.whitelist()
def tally_export(from_date: str, to_date: str, part: str = "vouchers", fmt: str = "xml"):
    """Download fee vouchers for Tally. part: 'masters' (ledgers, import once) or 'vouchers'.
    fmt: 'xml' (Tally import) or 'xlsx' (for checking in Excel)."""
    _require_accounts()
    f, t = getdate(from_date), getdate(to_date)
    if t < f:
        frappe.throw(_("The end date is before the start date"))
    invoices, payments = _fee_data(f, t)
    vouchers, ledgers = tally_vouchers(invoices, payments, _tally_cfg())
    company = _settings().tally_company or _company()
    stamp = f"{f.strftime('%d%b%Y')}-{t.strftime('%d%b%Y')}"
    if fmt == "xlsx":
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "Vouchers"
        ws.append(["Date", "Voucher Type", "Voucher No", "Party", "Ledger", "Debit", "Credit", "Narration"])
        for v in vouchers:
            for e in v["entries"]:
                ws.append([v["date"], v["type"], v["number"], v["party"], e["ledger"],
                           e["amount"] if e["amount"] > 0 else None, -e["amount"] if e["amount"] < 0 else None, v.get("narration")])
        buf = io.BytesIO()
        wb.save(buf)
        content, name = buf.getvalue(), f"Fees for Tally {stamp}.xlsx"
    elif part == "masters":
        content, name = build_tally_masters_xml(company, ledgers).encode(), f"1 Tally ledgers {stamp}.xml"
    else:
        content, name = build_tally_vouchers_xml(company, vouchers).encode(), f"2 Tally vouchers {stamp}.xml"
        frappe.db.set_single_value("SchoolOS Settings", {
            "tally_last_export_on": nowdate(),
            "tally_last_export_range": f"{f.strftime('%d %b %Y')} – {t.strftime('%d %b %Y')} · {len(vouchers)} vouchers · {frappe.utils.get_fullname()}",
        })
        frappe.db.commit()
    frappe.local.response.filename = name
    frappe.local.response.filecontent = content
    frappe.local.response.type = "binary"
