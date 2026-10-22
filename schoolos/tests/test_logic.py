"""Logic tests: every number SchoolOS shows is recomputed here straight from the database
(independently of the app's own code) and must match. Plus the edge cases behind each rule:
duplicates, audiences, opt-outs, module switches, date limits, WhatsApp/email delivery.

    bench --site <test site> run-tests --app schoolos --module schoolos.tests.test_logic
"""

import json
import re
from contextlib import contextmanager
from datetime import timedelta
from unittest.mock import MagicMock, patch

import frappe
from frappe.utils import add_days, flt, getdate, nowdate, today
from frappe.utils.password import set_encrypted_password

from schoolos.demo import GROUP
from schoolos.tests.test_integration import (
    PARENT, PRINCIPAL, TEACHER, SchoolOSTestCase, is_holiday, school_day,
)

S = "SchoolOS Settings"


@contextmanager
def settings(**values):
    """Temporarily change SchoolOS Settings."""
    old = {k: frappe.db.get_single_value(S, k) for k in values}
    for k, v in values.items():
        frappe.db.set_single_value(S, k, v)
    frappe.clear_document_cache(S, S)
    try:
        yield
    finally:
        for k, v in old.items():
            frappe.db.set_single_value(S, k, v)
        frappe.clear_document_cache(S, S)


def logs(**filters):
    return frappe.get_all("SchoolOS Alert Log", filters=filters,
                          fields=["name", "student", "channel", "recipient", "status", "message", "params", "template"])


def make_group(name, students=()):
    if frappe.db.exists("Student Group", name):
        return frappe.get_doc("Student Group", name)
    return frappe.get_doc({
        "doctype": "Student Group", "student_group_name": name, "group_based_on": "Activity",
        "academic_year": frappe.db.get_value("Student Group", GROUP, "academic_year"),
        "students": [{"student": s, "active": 1} for s in students],
    }).insert(ignore_permissions=True)


def make_teacher_not_in_group(email="teacher.other@demo.school"):
    """An instructor who teaches no demo section."""
    if not frappe.db.exists("User", email):
        u = frappe.get_doc({"doctype": "User", "email": email, "first_name": "Other", "last_name": "Teacher",
                            "send_welcome_email": 0, "user_type": "System User"})
        u.append_roles("Instructor", "Academics User", "Employee")
        u.insert(ignore_permissions=True)
    emp = frappe.db.get_value("Employee", {"user_id": email})
    if not emp:
        company = frappe.get_all("Company", pluck="name")[0]
        emp = frappe.get_doc({"doctype": "Employee", "first_name": "Other", "last_name": "Teacher", "company": company,
                              "gender": "Male", "date_of_birth": "1985-01-01", "date_of_joining": "2015-06-01",
                              "status": "Active", "user_id": email}).insert(ignore_permissions=True).name
    if not frappe.db.get_value("Instructor", {"employee": emp}):
        frappe.get_doc({"doctype": "Instructor", "naming_series": "EDU-INS-.YYYY.-",
                        "instructor_name": "Other Teacher", "employee": emp,
                        "status": "Active"}).insert(ignore_permissions=True)
    return email


def make_plain_user(email="nobody@demo.school"):
    if not frappe.db.exists("User", email):
        u = frappe.get_doc({"doctype": "User", "email": email, "first_name": "No", "last_name": "Children",
                            "send_welcome_email": 0, "user_type": "Website User"})
        u.append_roles("Guardian")
        u.insert(ignore_permissions=True)
    return email


# ---------------------------------------------------------------- attendance numbers
class TestAttendanceNumbers(SchoolOSTestCase):
    def raw_status_counts(self, day):
        rows = frappe.db.sql("""select status, count(distinct student) from `tabStudent Attendance`
                                where docstatus = 1 and date = %s group by status""", day)
        return {k: int(v) for k, v in rows}

    def test_principal_today_matches_register(self):
        from schoolos.api.dashboard import principal

        with self.set_user(PRINCIPAL):
            d = principal()
        raw = self.raw_status_counts(today())
        a = d["attendance_today"]
        self.assertEqual(a["present"], raw.get("Present", 0))
        self.assertEqual(a["absent"], raw.get("Absent", 0))
        self.assertEqual(a["leave"], raw.get("Leave", 0))
        total = sum(raw.get(k, 0) for k in ("Present", "Absent", "Leave"))
        self.assertEqual(a["total"], total)
        if total:
            self.assertAlmostEqual(a["percentage"], round(raw.get("Present", 0) * 100 / total, 1), places=1)
        g = next(x for x in d["groups_today"] if x["student_group"] == GROUP)
        self.assertEqual(g["strength"], 30)
        self.assertEqual(g["marked"], total > 0)
        self.assertEqual(GROUP in d["groups_unmarked"], total == 0)

    def test_trend_matches_register(self):
        from schoolos.api.dashboard import principal

        with self.set_user(PRINCIPAL):
            d = principal()
        for point in d["trend"][-10:]:
            raw = self.raw_status_counts(point["date"])
            self.assertEqual(point["present"], raw.get("Present", 0), point["date"])
            self.assertEqual(point["absent"], raw.get("Absent", 0), point["date"])

    def test_low_attendance_list_is_right(self):
        from schoolos.api.dashboard import principal

        with self.set_user(PRINCIPAL):
            d = principal()
        w, threshold = d["window"], d["window"]["threshold"]
        rows = frappe.db.sql("""select student, status, count(distinct date) from `tabStudent Attendance`
                                where docstatus = 1 and date between %s and %s group by student, status""",
                             (w["start"], w["end"]))
        per = {}
        for s, st, n in rows:
            per.setdefault(s, {"Present": 0, "Absent": 0, "Leave": 0})[st] = int(n)
        expected = {}
        for s, c in per.items():
            total = sum(c.values())
            pct = round(c["Present"] * 100 / total, 1) if total else 0
            if total >= 5 and pct < threshold:
                expected[s] = pct
        shown = {r["student"]: r["percentage"] for r in d["low_attendance"]}
        self.assertTrue(expected, "demo should have students below the threshold")
        for s, pct in shown.items():
            self.assertIn(s, expected)
            self.assertAlmostEqual(pct, expected[s], places=1)
        if len(expected) <= 15:
            self.assertEqual(set(shown), set(expected))
        self.assertEqual([r["percentage"] for r in d["low_attendance"]],
                         sorted(r["percentage"] for r in d["low_attendance"]), "lowest first")

    def test_child_attendance_percentage(self):
        from schoolos.api.dashboard import student

        child = self.children[0]
        with self.set_user(PARENT):
            d = student(child)
        w = d["window"]
        rows = frappe.db.sql("""select date, status from `tabStudent Attendance`
                                where docstatus = 1 and student = %s and date between %s and %s""",
                             (child, w["start"], w["end"]))
        rank = {"Present": 3, "Leave": 2, "Absent": 1}
        day = {}
        for dt, st in rows:
            if dt not in day or rank[st] > rank[day[dt]]:
                day[dt] = st
        present = sum(1 for s in day.values() if s == "Present")
        self.assertEqual(d["attendance"]["working_days"], len(day))
        self.assertEqual(d["attendance"]["present"], present)
        self.assertAlmostEqual(d["attendance"]["percentage"], round(present * 100 / len(day), 2), places=2)
        absences = sorted((str(k) for k, v in day.items() if v == "Absent"), reverse=True)[:5]
        self.assertEqual(d["recent_absences"], absences)
        if not is_holiday(today()):
            self.assertIn(str(getdate(today())), d["recent_absences"], "demo marks child 1 absent today")

    def test_leave_counts_as_present_setting(self):
        from schoolos.api.dashboard import student

        child = self.children[0]
        with self.set_user(PARENT):
            base = student(child)["attendance"]
        with settings(count_leave_as_present=1), self.set_user(PARENT):
            alt = student(child)["attendance"]
        self.assertEqual(alt["working_days"], base["working_days"])
        expected = round((base["present"] + base["leave"]) * 100 / base["working_days"], 2)
        self.assertAlmostEqual(alt["percentage"], expected, places=2)

    def test_teacher_absent_list(self):
        from schoolos.api.dashboard import teacher

        with self.set_user(TEACHER):
            d = teacher()
        raw = set(frappe.get_all("Student Attendance", filters={"docstatus": 1, "date": today(), "status": "Absent",
                                                                 "student_group": GROUP}, pluck="student"))
        self.assertEqual({r["student"] for r in d["absent_today"]}, raw)


# ---------------------------------------------------------------- fees numbers
class TestFeeNumbers(SchoolOSTestCase):
    def year_invoices(self):
        from schoolos.api.fees import _year

        _y, ys, ye = _year()
        cond, params = "", {}
        if ys and ye:
            cond, params = "and posting_date between %(ys)s and %(ye)s", {"ys": ys, "ye": ye}
        return frappe.db.sql(f"""select name, student, grand_total, outstanding_amount, due_date
                                 from `tabSales Invoice` where docstatus = 1 and ifnull(is_return, 0) = 0
                                 and ifnull(student, '') != '' {cond}""", params, as_dict=True)

    def test_summary_totals_match_books(self):
        from schoolos.api.fees import summary

        with self.set_user(PRINCIPAL):
            s = summary()
        inv = self.year_invoices()
        t = getdate(today())
        billed = sum(flt(i.grand_total) for i in inv)
        out = sum(flt(i.outstanding_amount) for i in inv)
        overdue = sum(flt(i.outstanding_amount) for i in inv if i.due_date and getdate(i.due_date) < t)
        self.assertAlmostEqual(s["billed"], billed, places=1)
        self.assertAlmostEqual(s["outstanding"], out, places=1)
        self.assertAlmostEqual(s["collected"], billed - out, places=1)
        self.assertAlmostEqual(s["overdue"], overdue, places=1)
        self.assertAlmostEqual(s["collection_pct"], round((billed - out) * 100 / billed, 1), places=1)
        # every rupee collected is a real payment against these invoices
        names = [i.name for i in inv]
        paid = frappe.db.sql("""select coalesce(sum(per.allocated_amount), 0) from `tabPayment Entry Reference` per
                                join `tabPayment Entry` pe on pe.name = per.parent
                                where pe.docstatus = 1 and per.reference_doctype = 'Sales Invoice'
                                and per.reference_name in %s""", (tuple(names),))[0][0]
        self.assertAlmostEqual(s["collected"], flt(paid), places=1)

    def test_breakdowns_add_up(self):
        from schoolos.api.fees import summary

        with self.set_user(PRINCIPAL):
            s = summary()
        self.assertAlmostEqual(sum(b["amount"] for b in s["ageing"]), s["overdue"], places=1)
        self.assertAlmostEqual(sum(g["outstanding"] for g in s["groups"]), s["outstanding"], places=1)
        self.assertAlmostEqual(sum(g["billed"] for g in s["groups"]), s["billed"], places=1)
        self.assertAlmostEqual(sum(d["outstanding"] for d in s["defaulters"]), s["outstanding"], places=1)
        self.assertEqual(s["students_with_dues"], len(s["defaulters"]))
        self.assertEqual(s["students_overdue"], sum(1 for d in s["defaulters"] if d["overdue"] > 0))
        overdue_order = [d["overdue"] for d in s["defaulters"]]
        self.assertEqual(overdue_order, sorted(overdue_order, reverse=True), "biggest overdue first")
        self.assertAlmostEqual(sum(m["amount"] for m in s["modes"]), s["collected"], places=0)

    def test_ageing_buckets_by_days_late(self):
        from schoolos.api.fees import summary

        with self.set_user(PRINCIPAL):
            s = summary()
        t = getdate(today())
        edges = [(0, 30), (31, 60), (61, 90), (91, 100000)]
        expect = [0.0] * 4
        for i in self.year_invoices():
            if flt(i.outstanding_amount) > 0.005 and i.due_date and getdate(i.due_date) < t:
                late = (t - getdate(i.due_date)).days
                for k, (lo, hi) in enumerate(edges):
                    if lo <= late <= hi:
                        expect[k] += flt(i.outstanding_amount)
                        break
        for b, e in zip(s["ageing"], expect):
            self.assertAlmostEqual(b["amount"], e, places=1, msg=b["label"])

    def test_parent_dues_match_invoices(self):
        from schoolos.api.fees import for_student

        for child in self.children:
            with self.set_user(PARENT):
                f = for_student(child)
            rows = frappe.db.sql("""select grand_total, outstanding_amount, due_date from `tabSales Invoice`
                                    where docstatus = 1 and student = %s and ifnull(is_return, 0) = 0""",
                                 child, as_dict=True)
            self.assertAlmostEqual(f["total"], sum(flt(r.grand_total) for r in rows), places=1)
            self.assertAlmostEqual(f["outstanding"], sum(flt(r.outstanding_amount) for r in rows), places=1)
            self.assertAlmostEqual(f["paid"], f["total"] - f["outstanding"], places=1)
            pend = sorted([r for r in rows if flt(r.outstanding_amount) > 0.005], key=lambda r: getdate(r.due_date))
            if pend:
                self.assertIsNotNone(f["next_due"])
            for inv in f["invoices"]:
                self.assertAlmostEqual(sum(flt(h.get("amount") or 0) for h in inv["heads"]), inv["total"], places=0)

    def test_payment_reduces_dues_everywhere(self):
        from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

        from schoolos.api.fees import for_student, summary

        with self.set_user(PRINCIPAL):
            before = summary()
        inv = next(i for i in self.year_invoices() if flt(i.outstanding_amount) > 0)
        with self.set_user(PARENT if inv.student in self.children else PRINCIPAL):
            child_before = for_student(inv.student)["outstanding"]
        pe = get_payment_entry("Sales Invoice", inv.name)
        pe.reference_no, pe.reference_date = "IT-1", nowdate()
        pe.paid_amount = pe.received_amount = 1000
        pe.references[0].allocated_amount = 1000
        pe.insert()
        pe.submit()
        with self.set_user(PRINCIPAL):
            after = summary()
            self.assertAlmostEqual(for_student(inv.student)["outstanding"], child_before - 1000, places=1)
        self.assertAlmostEqual(after["outstanding"], before["outstanding"] - 1000, places=1)
        self.assertAlmostEqual(after["collected"], before["collected"] + 1000, places=1)
        self.assertAlmostEqual(after["collected_today"], before["collected_today"] + 1000, places=1)

    def test_reminders_once_per_day_and_respect_switches(self):
        from schoolos.api.fees import remind, send_scheduled_reminders

        with self.set_user(PRINCIPAL):
            first = remind()
            second = remind()
        self.assertGreater(first["messages"], 0)
        self.assertEqual(second["messages"], 0, "a second click the same day must not message parents again")
        before = frappe.db.count("SchoolOS Alert Log", {"alert_type": "Fee Reminder"})
        with settings(module_fees=0):
            send_scheduled_reminders()
        with settings(fee_reminders=0):
            send_scheduled_reminders()
        self.assertEqual(frappe.db.count("SchoolOS Alert Log", {"alert_type": "Fee Reminder"}), before)


# ---------------------------------------------------------------- accounts numbers
class TestAccountNumbers(SchoolOSTestCase):
    def test_income_expense_and_cash_match_ledger(self):
        from schoolos.api.accounts import _company, _fiscal_year, summary

        with settings(accounts_mode="Full accounting in SchoolOS"), self.set_user(PRINCIPAL):
            s = summary()
        company = _company()
        _fy, ys, _ye = _fiscal_year(company)
        month_end = (getdate(today()).replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        inc, exp = frappe.db.sql("""select
                coalesce(sum(case when a.root_type='Income' then g.credit - g.debit end), 0),
                coalesce(sum(case when a.root_type='Expense' then g.debit - g.credit end), 0)
            from `tabGL Entry` g join `tabAccount` a on a.name = g.account
            where g.company=%s and g.is_cancelled=0 and g.posting_date between %s and %s""",
                                 (company, ys, month_end))[0]
        self.assertAlmostEqual(s["year"]["income"], flt(inc), places=1)
        self.assertAlmostEqual(s["year"]["expense"], flt(exp), places=1)
        self.assertAlmostEqual(s["year"]["surplus"], flt(inc) - flt(exp), places=1)
        self.assertAlmostEqual(sum(m["income"] for m in s["monthly"] if m["key"] <= today()[:7]), flt(inc), places=1)
        # cash + bank = money received - money paid (demo has no opening balances / journals)
        recv, paid = frappe.db.sql("""select coalesce(sum(case when payment_type='Receive' then received_amount end),0),
                                             coalesce(sum(case when payment_type='Pay' then paid_amount end),0)
                                      from `tabPayment Entry` where docstatus=1 and company=%s
                                      and posting_date <= %s""", (company, today()))[0]
        self.assertAlmostEqual(sum(b["balance"] for b in s["balances"]), flt(recv) - flt(paid), places=1)

    def test_fee_income_reaches_the_books(self):
        """Every fee invoice in the year is income in the ledger (no fee left out of accounts)."""
        from schoolos.api.accounts import _company, _fiscal_year

        company = _company()
        _fy, ys, ye = _fiscal_year(company)
        fees = frappe.db.sql("""select coalesce(sum(base_net_total), 0) from `tabSales Invoice`
                                where docstatus=1 and company=%s and ifnull(student,'')!=''
                                and posting_date between %s and %s""", (company, ys, ye))[0][0]
        income = frappe.db.sql("""select coalesce(sum(g.credit - g.debit), 0) from `tabGL Entry` g
                                  join `tabAccount` a on a.name = g.account
                                  where g.company=%s and g.is_cancelled=0 and a.root_type='Income'
                                  and g.voucher_type='Sales Invoice' and g.posting_date between %s and %s""",
                               (company, ys, ye))[0][0]
        self.assertAlmostEqual(flt(fees), flt(income), places=1)

    def test_tally_totals_match_fees(self):
        import xml.etree.ElementTree as ET

        from schoolos.api.accounts import tally_export, tally_preview
        from schoolos.tests.test_integration import take_response

        f = str(frappe.db.get_value("Academic Year", frappe.db.get_value("Student Group", GROUP, "academic_year"),
                                    "year_start_date"))
        t = nowdate()
        billed = frappe.db.sql("""select coalesce(sum(sii.amount), 0) from `tabSales Invoice Item` sii
                                  join `tabSales Invoice` si on si.name = sii.parent
                                  where si.docstatus=1 and ifnull(si.student,'')!='' and ifnull(si.is_return,0)=0
                                  and si.posting_date between %s and %s""", (f, t))[0][0]
        with settings(accounts_mode="Tally (export fees to Tally)"), self.set_user(PRINCIPAL):
            p = tally_preview(f, t)
            tally_export(f, t, "vouchers", "xml")
            _k, _n, xml = take_response()
        self.assertAlmostEqual(p["billed"], flt(billed), places=1)
        root = ET.fromstring(xml)
        sales = [v for v in root.iter("VOUCHER") if v.get("VCHTYPE") == "Sales"]
        receipts = [v for v in root.iter("VOUCHER") if v.get("VCHTYPE") == "Receipt"]
        self.assertEqual(len(sales), p["invoices"])
        self.assertEqual(len(receipts), p["receipts"])

        def credits(vs):
            return sum(float(a.text) for v in vs for a in v.iter("AMOUNT") if float(a.text) > 0)

        self.assertAlmostEqual(credits(sales), p["billed"], places=1)
        self.assertAlmostEqual(credits(receipts), p["received"], places=1)
        for v in sales + receipts:
            self.assertTrue(re.fullmatch(r"\d{8}", v.findtext("DATE") or ""), "Tally date must be YYYYMMDD")


# ---------------------------------------------------------------- report cards
class TestReportCardNumbers(SchoolOSTestCase):
    def test_marks_grade_attendance(self):
        from schoolos.api.report_card import generate

        template = frappe.get_doc("Report Card Template",
                                  frappe.get_all("Report Card Template", pluck="name", limit=1)[0])
        with self.set_user(PRINCIPAL):
            generate(template.name, GROUP)
        cards = frappe.get_all("Student Report Card", filters={"template": template.name, "docstatus": 0},
                               pluck="name", limit=5)
        self.assertTrue(cards)
        groups = [e.assessment_group for e in template.exams]
        intervals = sorted(frappe.get_all("Grading Scale Interval", filters={"parent": template.grading_scale},
                                          fields=["threshold", "grade_code"]), key=lambda r: -flt(r.threshold))

        def grade(p):
            return next((r.grade_code for r in intervals if p >= flt(r.threshold)), "")

        for name in cards:
            rc = frappe.get_doc("Student Report Card", name)
            obt, mx = frappe.db.sql("""select coalesce(sum(total_score),0), coalesce(sum(maximum_score),0)
                                       from `tabAssessment Result` where docstatus=1 and student=%s
                                       and academic_year=%s and assessment_group in %s""",
                                    (rc.student, template.academic_year, tuple(groups)))[0]
            self.assertAlmostEqual(flt(rc.total_obtained), flt(obt), places=1, msg=name)
            self.assertAlmostEqual(flt(rc.total_maximum), flt(mx), places=1, msg=name)
            pct = round(flt(obt) * 100 / flt(mx), 2)
            self.assertAlmostEqual(flt(rc.overall_percentage), pct, places=1, msg=name)
            self.assertEqual(rc.overall_grade, grade(pct), name)
            self.assertAlmostEqual(sum(flt(s.total_obtained) for s in rc.subjects), flt(rc.total_obtained), places=1)
            for s in rc.subjects:
                self.assertEqual(s.grade, grade(flt(s.percentage)), f"{name} {s.course}")
                self.assertEqual(bool(s.passed), flt(s.percentage) >= flt(template.pass_percentage))
            self.assertEqual(rc.result, "Pass" if all(s.passed for s in rc.subjects) else "Needs Improvement")
            ys, ye = frappe.db.get_value("Academic Year", template.academic_year, ["year_start_date", "year_end_date"])
            present = frappe.db.sql("""select count(distinct date) from `tabStudent Attendance`
                                       where docstatus=1 and student=%s and status='Present' and student_group=%s
                                       and date between %s and %s""",
                                    (rc.student, GROUP, template.attendance_from or ys, template.attendance_to or ye))[0][0]
            self.assertEqual(int(rc.days_present), int(present), name)


# ---------------------------------------------------------------- syllabus
class TestSyllabusNumbers(SchoolOSTestCase):
    def test_coverage_matches_lesson_log(self):
        from schoolos.api.learning import group_syllabus

        ys, ye = frappe.db.get_value("Academic Year", frappe.db.get_value("Student Group", GROUP, "academic_year"),
                                     ["year_start_date", "year_end_date"])
        t = getdate(today())
        expected_pct = round(max(0, min(1, (t - getdate(ys)).days / (getdate(ye) - getdate(ys)).days)) * 100, 1)
        for row in group_syllabus(GROUP):
            topics = set(frappe.get_all("Course Topic", filters={"parent": row["course"], "parenttype": "Course"},
                                        pluck="topic"))
            done = set(frappe.get_all("SchoolOS Lesson Log", filters={"student_group": GROUP, "course": row["course"],
                                                                      "completed": 1, "topic": ["is", "set"]},
                                      pluck="topic")) & topics
            self.assertEqual(row["total"], len(topics), row["course"])
            self.assertEqual(row["covered"], len(done), row["course"])
            if topics:
                pct = round(len(done) * 100 / len(topics), 1)
                self.assertAlmostEqual(row["percentage"], pct, places=1)
                self.assertAlmostEqual(row["expected"], expected_pct, places=1)
                status = "ahead" if pct >= expected_pct + 10 else "behind" if pct < expected_pct - 10 else "on track"
                self.assertEqual(row["status"], status, row["course"])
        maths = next(r for r in group_syllabus(GROUP) if "Math" in r["course"])
        others = [r["percentage"] for r in group_syllabus(GROUP) if "Math" not in r["course"]]
        self.assertLess(maths["percentage"], min(others), "demo: Mathematics is deliberately behind")

    def test_logging_same_topic_twice_counts_once(self):
        from schoolos.api.learning import group_syllabus, post_lesson

        row = group_syllabus(GROUP)[0]
        todo = [t for t in row["topics"] if t["state"] == "todo"]
        if not todo:
            self.skipTest("syllabus already complete")
        with self.set_user(TEACHER):
            a = post_lesson(GROUP, row["course"], todo[0]["topic"])
            b = post_lesson(GROUP, row["course"], todo[0]["topic"])
        self.assertEqual(a["coverage"]["covered"], row["covered"] + 1)
        self.assertEqual(b["coverage"]["covered"], row["covered"] + 1)


# ---------------------------------------------------------------- alerts
class TestAlertRules(SchoolOSTestCase):
    def circular(self, audience="Student Group", group=GROUP, whatsapp=0, email=1):
        c = frappe.get_doc({"doctype": "SchoolOS Circular", "title": f"IT {frappe.generate_hash(length=6)}",
                            "audience": audience, "student_group": group if audience == "Student Group" else None,
                            "publish_date": today(), "send_whatsapp": whatsapp, "send_email": email,
                            "message": "<p>Test</p>"}).insert()
        c.submit()
        return c

    def test_circular_reaches_only_its_audience(self):
        other = make_group("IT Circular Group", [self.other_child])
        c = self.circular(group=other.name)
        sent_to = {r.student for r in logs(reference_name=c.name)}
        self.assertEqual(sent_to, {self.other_child})
        self.assertEqual(frappe.db.get_value("SchoolOS Circular", c.name, "recipients_count"), 1)

        c2 = self.circular(group=GROUP)
        self.assertEqual({r.student for r in logs(reference_name=c2.name)}, set(self.students))

    def test_opted_out_parent_gets_nothing(self):
        g = frappe.get_all("Student Guardian", filters={"parent": self.other_child}, pluck="guardian")[0]
        frappe.db.set_value("Guardian", g, "schoolos_alerts_opt_in", 0)
        try:
            c = self.circular(group=GROUP)
            self.assertNotIn(self.other_child, {r.student for r in logs(reference_name=c.name)})
        finally:
            frappe.db.set_value("Guardian", g, "schoolos_alerts_opt_in", 1)

    def test_master_switches(self):
        with settings(alerts_enabled=0):
            c = self.circular()
            self.assertFalse(logs(reference_name=c.name))
        with settings(circular_alerts=0):
            c = self.circular()
            self.assertFalse(logs(reference_name=c.name))
        with settings(module_circulars=0):
            c = self.circular()
            self.assertFalse(logs(reference_name=c.name))
        with settings(whatsapp_enabled=0):
            c = self.circular(whatsapp=1, email=1)
            self.assertEqual({r.channel for r in logs(reference_name=c.name)}, {"Email"})

    def test_marathi_messages(self):
        with settings(alert_language="mr"):
            c = self.circular()
        msg = logs(reference_name=c.name)[0].message
        self.assertTrue(re.search("[ऀ-ॿ]", msg), "Marathi alert should contain Devanagari text")

    def test_one_absence_alert_per_child_per_day(self):
        from schoolos.alerts.engine import queue_for_students

        s = self.children[0]
        n1 = queue_for_students("Absence", [s], "Student", s, {"date": today()}, dedup_reference=f"abs|{today()}")
        n2 = queue_for_students("Absence", [s], "Student", s, {"date": today()}, dedup_reference=f"abs|{today()}")
        self.assertEqual(n2, 0)
        self.assertGreaterEqual(n1, 0)

    def test_whatsapp_delivery_payload_and_failure(self):
        from schoolos.alerts.engine import deliver, retry_failed
        from schoolos.alerts.messages import TEMPLATE_PARAMS

        with settings(dry_run=0, whatsapp_enabled=1, whatsapp_phone_number_id="123456", whatsapp_api_version="v23.0",
                      whatsapp_language="en", circular_template="school_circular"):
            set_encrypted_password(S, S, "test-token", "whatsapp_access_token")
            frappe.clear_document_cache(S, S)
            with patch("frappe.enqueue"):
                c = self.circular(whatsapp=1, email=0)
            wa = [r for r in logs(reference_name=c.name) if r.channel == "WhatsApp"]
            self.assertTrue(wa)
            row = wa[0]
            self.assertRegex(row.recipient, r"^91\d{10}$")
            self.assertEqual(len(json.loads(row.params)), len(TEMPLATE_PARAMS["Circular"]))

            ok = MagicMock(status_code=200)
            ok.json.return_value = {"messages": [{"id": "wamid.TEST"}]}
            with patch("requests.post", return_value=ok) as post:
                deliver(row.name)
            url, kw = post.call_args[0][0], post.call_args[1]
            self.assertEqual(url, "https://graph.facebook.com/v23.0/123456/messages")
            self.assertEqual(kw["headers"]["Authorization"], "Bearer test-token")
            body = kw["json"]
            self.assertEqual(body["to"], row.recipient)
            self.assertEqual(body["type"], "template")
            self.assertEqual(body["template"]["name"], "school_circular")
            done = frappe.get_doc("SchoolOS Alert Log", row.name)
            self.assertEqual((done.status, done.provider_message_id), ("Sent", "wamid.TEST"))
            deliver(row.name)  # already sent: must not send twice

            bad = MagicMock(status_code=400, text="bad")
            bad.json.return_value = {"error": {"message": "Template name does not exist"}}
            with patch("requests.post", return_value=bad):
                deliver(wa[1].name if len(wa) > 1 else row.name)
            if len(wa) > 1:
                failed = frappe.get_doc("SchoolOS Alert Log", wa[1].name)
                self.assertEqual(failed.status, "Failed")
                self.assertIn("Template name does not exist", failed.error)
                with patch("frappe.enqueue") as enq:
                    retry_failed()
                self.assertIn(wa[1].name, [c.kwargs.get("log") for c in enq.call_args_list])

    def test_email_delivery(self):
        from schoolos.alerts.engine import deliver

        with settings(dry_run=0):
            with patch("frappe.enqueue"):
                c = self.circular(email=1)
            row = [r for r in logs(reference_name=c.name) if r.channel == "Email"][0]
            with patch("frappe.sendmail") as sm:
                deliver(row.name)
            self.assertEqual(sm.call_args.kwargs["recipients"], [row.recipient])
            self.assertEqual(frappe.db.get_value("SchoolOS Alert Log", row.name, "status"), "Sent")

    def test_test_mode_never_sends(self):
        from schoolos.alerts.engine import deliver

        with patch("frappe.enqueue"):
            c = self.circular(whatsapp=1, email=1)
        with patch("requests.post") as post, patch("frappe.sendmail") as sm:
            for r in logs(reference_name=c.name):
                deliver(r.name)
        post.assert_not_called()
        sm.assert_not_called()
        self.assertEqual({r.status for r in logs(reference_name=c.name)}, {"Dry Run"})


# ---------------------------------------------------------------- access & rules
class TestRules(SchoolOSTestCase):
    def test_each_module_switch_blocks_its_endpoint(self):
        from schoolos.api import accounts, fees, homework, leave, learning, school_calendar

        child = self.children[0]
        t = getdate(today())
        cases = {
            "fees": (PARENT, lambda: fees.for_student(child)),
            "accounts": (PRINCIPAL, accounts.summary),
            "homework": (PARENT, lambda: homework.for_student(child)),
            "learning": (PARENT, lambda: learning.student_progress(child)),
            "leave": (PARENT, lambda: leave.for_student(child)),
            "calendar": (PARENT, lambda: school_calendar.month(t.year, t.month, child)),
        }
        for key, (user, fn) in cases.items():
            with self.set_user(user):
                fn()  # works while on
            with settings(**{f"module_{key}": 0}), self.set_user(user):
                with self.assertRaises(frappe.PermissionError, msg=key):
                    fn()

    def test_teacher_of_other_section(self):
        from schoolos.api.homework import post
        from schoolos.api.leave import apply, decide, pending

        other = make_teacher_not_in_group()
        with self.set_user(PARENT):
            r = apply(self.children[0], school_day(20), school_day(20), "Function")
        with self.set_user(other):
            self.assertNotIn(r["name"], [x["name"] for x in pending()])
            with self.assertRaises(frappe.PermissionError):
                decide(r["name"], 1, "")
            with self.assertRaises(frappe.PermissionError):
                post(GROUP, "x", "Homework", None, "x", school_day(1))

    def test_leave_rules(self):
        from schoolos.api.leave import apply, withdraw

        child = self.children[1]
        with self.set_user(PARENT):
            for f, t in [(add_days(today(), -10), add_days(today(), -10)),  # too long ago
                         (school_day(3), add_days(school_day(3), 31)),       # longer than 30 days
                         (school_day(3), "")]:                                # missing date
                with self.assertRaises(frappe.ValidationError, msg=f"{f}..{t}"):
                    apply(child, f, t, "x")
            with self.assertRaises(frappe.ValidationError):
                apply(child, school_day(25), school_day(25), "   ")       # no reason
            r = apply(child, school_day(25), school_day(26), "Trip")
            with self.assertRaises(frappe.ValidationError):
                apply(child, school_day(26), school_day(26), "overlap")   # overlapping request
        with self.set_user(make_plain_user()):
            with self.assertRaises(frappe.PermissionError):
                withdraw(r["name"])

    def test_homework_audience(self):
        from schoolos.api.homework import for_student, post

        other = make_group("IT Homework Group", [self.other_child])
        with self.set_user(PRINCIPAL):
            mine = post(GROUP, "IT for class 5", "Homework", None, "x", school_day(2))
            theirs = post(other.name, "IT for other group", "Homework", None, "x", school_day(2))
        self.assertEqual(mine["students"], 30)
        self.assertEqual(theirs["students"], 1)
        with self.set_user(PARENT):
            titles = {h.title for h in for_student(self.children[0])}
        self.assertIn("IT for class 5", titles)
        self.assertNotIn("IT for other group", titles)

    def test_calendar_audience(self):
        from schoolos.api.school_calendar import month

        other = make_group("IT Calendar Group", [self.other_child])
        day = school_day(4)
        for title, aud, grp, pub in [("IT all", "All Students", None, 1), ("IT other group", "Student Group", other.name, 1),
                                     ("IT my group", "Student Group", GROUP, 1), ("IT draft", "All Students", None, 0)]:
            frappe.get_doc({"doctype": "SchoolOS Event", "title": title, "event_type": "Event", "start_date": day,
                            "audience": aud, "student_group": grp, "published": pub}).insert()
        d = getdate(day)

        def titles(user, student=None):
            with self.set_user(user):
                m = month(d.year, d.month, student)
            return {i.get("title") for i in m["items"]}

        parent = titles(PARENT, self.children[0])
        self.assertTrue({"IT all", "IT my group"} <= parent)
        self.assertNotIn("IT other group", parent)
        self.assertNotIn("IT draft", parent)
        staff = titles(PRINCIPAL)
        self.assertTrue({"IT all", "IT my group", "IT other group"} <= staff)
        self.assertNotIn("IT draft", staff)

    def test_guest_and_no_children(self):
        from schoolos.api.dashboard import parent

        with self.set_user(make_plain_user()):
            self.assertEqual(parent()["children"], [])
