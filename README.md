# SchoolOS

Dashboards, parent alerts and board-format report cards for schools, built as an add-on
app on **Frappe Education + Frappe HR + ERPNext (v16)**. Frappe's own code is never edited:
everything lives in this app, so Frappe upgrades stay safe.

> Code name "SchoolOS" is a placeholder. Rebrand by changing the app title in `hooks.py`
> and the school name/logo/colour in **SchoolOS Settings** (per school, no code needed).

## What's in v0.1

| Area | What it does |
|---|---|
| **Principal dashboard** (`/school`) | Today's attendance %, absentees, classes not yet marked, staff present (from Frappe HR), 30-day trend, students below 75% attendance, subject averages, upcoming exams, parent alerts sent, circulars |
| **Teacher dashboard** | Today's timetable (current period highlighted), my classes' attendance status, who's absent, assessments with marks still to enter, trend, students needing attention |
| **Parent / student view** | Each child's attendance %, recent absences, latest results, today's timetable, circulars, report card PDF download |
| **Alerts** | Absence alert (once per child per day), circulars to all / a class / a section, "report card published". WhatsApp via Meta's Cloud API directly (no reseller fees) + email. Every message logged in **SchoolOS Alert Log**, deduplicated, retried hourly. **Test Mode** logs without sending. Parent consent tick-box on Guardian. |
| **Report cards** | Template per class & year: exam columns (Assessment Groups), optional weightage, marks breakdown (PT / NB / SE / Exam), co-scholastic areas, attendance, remarks, signatures. One click generates cards for a whole section from submitted Assessment Results. PDF layout for **CBSE** and **Maharashtra State Board**. Preset grading scales (CBSE 8-point, Maharashtra 9-point). |

Not in v0.1 (planned): fees & UPI payments, mobile app (Flutter), push notifications,
transport, library, Marathi UI.

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
