# SchoolOS

Dashboards, parent alerts and board-format report cards for schools, built as an add-on
app on **Frappe Education + Frappe HR + ERPNext (v16)**. Frappe's own code is never edited:
everything lives in this app, so Frappe upgrades stay safe.

> Code name "SchoolOS" is a placeholder. Rebrand by changing the app title in `hooks.py`
> and the school name/logo/colour in **SchoolOS Settings** (per school, no code needed).

## What's in v0.5

| Area | What it does |
|---|---|
| **Principal dashboard** (`/school`) | Today's attendance %, absentees, classes not yet marked, staff present (from Frappe HR), 30-day trend, students below 75% attendance, subject averages, upcoming exams, parent alerts sent, circulars |
| **Teacher dashboard** | Today's timetable (current period highlighted), my classes' attendance status, who's absent, assessments with marks still to enter, trend, students needing attention |
| **Parent / student view** | Each child's attendance %, recent absences, latest results, today's timetable, circulars, report card PDF download |
| **Alerts** | Absence alert (once per child per day), circulars to all / a class / a section, "report card published". WhatsApp via Meta's Cloud API directly (no reseller fees) + email. Every message logged in **SchoolOS Alert Log**, deduplicated, retried hourly. **Test Mode** logs without sending. Parent consent tick-box on Guardian. |
| **Fees (principal & accounts)** | Fees tab: collected vs billed, outstanding, overdue, today's and this month's collection, monthly chart, overdue ageing (0–30 / 31–60 / 61–90 / 90+ days), pending by class, by fee head, payment modes, recent payments, and a defaulters list with parent mobile, last reminder and one-tap or bulk reminders. Uses Frappe Education's own fee invoices and ERPNext payments. |
| **Fees (parents)** | Dues per child on the home screen, invoices with fee heads, Pay Now through Education's built-in Razorpay checkout, payment history and receipt PDFs. Automatic WhatsApp/email reminders before the due date, on it, and every N days while overdue. |
| **Learning progress** | Teachers log each lesson against the subject's chapters (Course → Topics) with class notes. Parents and students see syllabus covered vs where the class should be by now, average and trend per subject, class notes, teacher notes (when shared) and a full activity timeline. Principal sees a class × subject coverage matrix. |
| **Module switches** | SchoolOS Settings → Modules: every feature is on by default; the school admin turns off what it doesn't use. Screens, alerts and scheduled jobs disappear; data is kept. |
| **Accounts** | Full mode: income vs expenses by month, surplus, cash & bank balances, salary share of income, where the money goes, bills to pay, and supplier bills / staff expense claims approved or rejected from the dashboard. Tally mode: export fee bills (Sales) and receipts (Receipt vouchers) as Tally import files plus an Excel copy. See [docs/ACCOUNTS.md](docs/ACCOUNTS.md). |
| **Leave requests** | Parents apply from the app; the class teacher approves or rejects with a note. Approved days are marked as leave (no absence alert); the parent gets an email either way. |
| **Calendar & gallery** | Month calendar of events, holidays, exams and (for parents) fee due dates, filtered to each family's classes; photo albums with a full-screen viewer. |
| **Homework & diary** | Teachers post homework, classwork, projects or notes for a section from their phone (on `/school`) or desk. Parents get an email (WhatsApp optional, off by default to save cost); students and parents see what's due. |
| **Installable app** | `/school` installs on Android / iPhone home screens with the school's own name, logo and colour (PWA). Last data shown when offline. |
| **Excel import** | One sheet, one row per student: class, section, roll no, admission/GR no, parents' mobiles. Validate first, then import in the background. Siblings share parent records; re-uploading updates students instead of duplicating. See [docs/IMPORT.md](docs/IMPORT.md). |
| **Marathi** | EN / मराठी switch on the dashboard, Marathi alert emails (SchoolOS Settings → Alert Language), Marathi report-card labels. |
| **Report cards** | Template per class & year: exam columns (Assessment Groups), optional weightage, marks breakdown (PT / NB / SE / Exam), co-scholastic areas, attendance, remarks, signatures. One click generates cards for a whole section from submitted Assessment Results. PDF layout for **CBSE** and **Maharashtra State Board**. Preset grading scales (CBSE 8-point, Maharashtra 9-point). |

Not yet (planned): store mobile app (Flutter) with push notifications, transport, library.

## Run it on your Mac

See **[docs/SETUP_MAC.md](docs/SETUP_MAC.md)**. Short version:

```bash
git clone <this repo> && cd schoolos
docker compose -f docker/compose.yml up -d
docker compose -f docker/compose.yml exec frappe bash /workspace/schoolos/docker/setup.sh
docker compose -f docker/compose.yml exec frappe bash -lc "cd ~/frappe-bench && bench start"
# finish the setup wizard at http://school.localhost:8000, then:
docker compose -f docker/compose.yml exec frappe bash -lc "cd ~/frappe-bench && bench --site school.localhost execute schoolos.demo.make_demo"
```

Open `http://school.localhost:8000/school`.

## How it fits together

```
schoolos/
  api/dashboard.py     JSON endpoints for every dashboard (web page now, mobile app later)
  api/report_card.py   generate cards for a section; PDF download for parents
  api/homework.py      post / list homework
  api/fees.py          fee collection overview, parent dues, receipts, reminders
  api/learning.py      syllabus coverage, class & teacher notes, activity timeline, lesson logging
  api/compute_fees.py  pure-Python fee and coverage maths (unit tested)
  api/accounts.py      accounts dashboard, approvals, Tally export
  api/leave.py         leave requests (apply / approve / reject)
  api/school_calendar.py  calendar and photo albums
  api/compute_accounts.py pure-Python accounts, Tally XML, calendar and leave rules (unit tested)
  modules.py           feature switches
  api/pwa.py           per-school app manifest + offline service worker
  importer/            Excel template, row checks (pure Python) and the import job
  api/compute.py       pure-Python number crunching (unit tested)
  alerts/engine.py     who to notify, WhatsApp/email delivery, logging, retries
  alerts/events.py     hooks: absence alert on attendance submit
  report_card/         marks/grade/attendance calculation (builder.py is pure Python)
  schoolos/doctype/    Settings, Alert Log, Circular, Report Card Template, Student Report Card
  schoolos/print_format/schoolos_report_card   the PDF layout
  www/school.*         the dashboard page; public/js/school.js renders it
  demo.py              demo school with 30 students
```

The mobile app (next phase) will call the same `schoolos.api.*` endpoints, so nothing
here needs rewriting, and the backend could be replaced later without changing the app.

## Tests

Logic that doesn't need a database runs anywhere with Python 3:

```bash
python3 -m pytest tests -q
```

## Who sees what

| Role | Sees |
|---|---|
| School Principal / Education Manager / System Manager | Principal tab (+ everything below if also linked) |
| User linked to an Instructor (via Employee → User ID) | My classes tab |
| User linked to a Guardian (Guardian → User, or same email) | My children tab |
| User linked to a Student | My dashboard tab |

## Licence

GPL-3.0, same as ERPNext, Frappe HR and Frappe Education. If you install this on a
client's server you must make the source available to that client.
