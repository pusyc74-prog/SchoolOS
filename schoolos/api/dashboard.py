"""Dashboard data for /school. Every endpoint checks access itself.

All reads use frappe.get_all / parameterised SQL and return plain dicts, so the same
endpoints can serve the web dashboard now and the mobile app later.
"""

import frappe
from frappe.utils import add_days, cint, flt, get_timedelta, getdate, nowtime, today

from schoolos.api.common import (
    FEE_ROLES, guardian_children, instructor_for_user, is_principal, require_login,
    require_principal, require_student_access, roles, student_for_user,
)
from schoolos.api.compute import attendance_trend, status_counts, student_attendance_stats
from schoolos.api.homework import homework_for_groups
from schoolos.report_card.builder import attendance_summary


# ------------------------------------------------------------------ helpers
def _settings():
    s = frappe.get_cached_doc("SchoolOS Settings")
    return {
        "threshold": flt(s.low_attendance_threshold) or 75,
        "days": cint(s.dashboard_window_days) or 30,
    }


def _window(date=None, days=None):
    end = getdate(date or today())
    days = cint(days) or _settings()["days"]
    return add_days(end, -(days - 1)), end


def _current_term():
    year = frappe.db.get_single_value("Education Settings", "current_academic_year")
    term = frappe.db.get_single_value("Education Settings", "current_academic_term")
    return year, term


def _has_doctype(dt):
    return bool(frappe.db.exists("DocType", dt))


def _att_by_status(where, params):
    return frappe.db.sql(
        f"""select status, count(distinct student, date) as count
            from `tabStudent Attendance` where docstatus = 1 and {where}
            group by status""",
        params, as_dict=True,
    )


def _att_trend(where, params, start, end):
    rows = frappe.db.sql(
        f"""select date, status, count(distinct student) as count
            from `tabStudent Attendance`
            where docstatus = 1 and date between %(start)s and %(end)s and {where}
            group by date, status""",
        {**params, "start": start, "end": end}, as_dict=True,
    )
    return attendance_trend(rows, start, end)


def _att_by_student(where, params, start, end):
    return frappe.db.sql(
        f"""select student, student_name, status, count(distinct date) as count
            from `tabStudent Attendance`
            where docstatus = 1 and date between %(start)s and %(end)s and {where}
            group by student, student_name, status""",
        {**params, "start": start, "end": end}, as_dict=True,
    )


def _group_strength(groups):
    if not groups:
        return {}
    rows = frappe.db.sql(
        """select parent, count(*) as n from `tabStudent Group Student`
           where parenttype = 'Student Group' and active = 1 and parent in %(g)s group by parent""",
        {"g": tuple(groups)}, as_dict=True,
    )
    return {r.parent: r.n for r in rows}


def _groups_today(groups, day):
    """Per student group: strength and today's present/absent/leave."""
    if not groups:
        return []
    strength = _group_strength(groups)
    rows = frappe.db.sql(
        """select student_group, status, count(distinct student) as count
           from `tabStudent Attendance`
           where docstatus = 1 and date = %(d)s and student_group in %(g)s
           group by student_group, status""",
        {"d": day, "g": tuple(groups)}, as_dict=True,
    )
    by_group = {}
    for r in rows:
        by_group.setdefault(r.student_group, []).append(r)
    out = []
    for g in groups:
        c = status_counts(by_group.get(g, []))
        out.append({"student_group": g, "strength": strength.get(g, 0), "marked": c["total"] > 0, **c})
    out.sort(key=lambda r: (r["marked"], r["student_group"]))
    return out


def _active_groups(year=None, extra_filters=None):
    filters = {"disabled": 0}
    if year:
        filters["academic_year"] = year
    if extra_filters:
        filters.update(extra_filters)
    return frappe.get_all("Student Group", filters=filters, pluck="name", order_by="student_group_name asc")


def _subject_performance(filters):
    rows = frappe.get_all(
        "Assessment Result",
        filters={"docstatus": 1, **filters},
        fields=["course", "total_score", "maximum_score"],
        limit=20000,
    )
    agg = {}
    for r in rows:
        if not r.maximum_score:
            continue
        a = agg.setdefault(r.course, [0.0, 0])
        a[0] += flt(r.total_score) * 100.0 / flt(r.maximum_score)
        a[1] += 1
    out = [{"course": c, "average": round(s / n, 1), "results": n} for c, (s, n) in agg.items()]
    out.sort(key=lambda r: r["average"])
    return out


def _staff_today(day):
    if not _has_doctype("Attendance") or not _has_doctype("Employee"):
        return None
    total = frappe.db.count("Employee", {"status": "Active"})
    rows = frappe.db.sql(
        """select status, count(distinct employee) as count from `tabAttendance`
           where docstatus = 1 and attendance_date = %(d)s group by status""",
        {"d": day}, as_dict=True,
    )
    c = status_counts(rows, statuses=("Present", "Absent", "On Leave", "Half Day", "Work From Home"))
    checked_in = 0
    if _has_doctype("Employee Checkin"):
        checked_in = frappe.db.sql(
            """select count(distinct employee) from `tabEmployee Checkin`
               where log_type = 'IN' and date(time) = %(d)s""",
            {"d": day},
        )[0][0]
    c.update({"active_staff": total, "checked_in": checked_in})
    return c


def _recent_circulars(students=None, limit=5):
    rows = frappe.get_all(
        "SchoolOS Circular",
        filters={"docstatus": 1},
        fields=["name", "title", "publish_date", "audience", "program", "student_group", "message", "attachment"],
        order_by="publish_date desc, creation desc",
        limit=limit * 4 if students else limit,
    )
    if students is None:
        return rows[:limit]
    # keep circulars addressed to these students
    groups = set(frappe.get_all("Student Group Student",
                                filters={"student": ["in", students], "active": 1}, pluck="parent"))
    programs = set(frappe.get_all("Program Enrollment",
                                  filters={"student": ["in", students], "docstatus": 1}, pluck="program"))
    out = [r for r in rows if r.audience == "All Students"
           or (r.audience == "Student Group" and r.student_group in groups)
           or (r.audience == "Program" and r.program in programs)]
    return out[:limit]


# ------------------------------------------------------------------ endpoints
@frappe.whitelist()
def get_context():
    """What the logged-in user can see, plus branding. Called first by the page/app."""
    require_login()
    s = frappe.get_cached_doc("SchoolOS Settings")
    instructor = instructor_for_user()
    student = student_for_user()
    children = guardian_children()
    views = []
    if is_principal():
        views.append("principal")
    if roles() & FEE_ROLES:
        views.append("fees")
    if instructor:
        views.append("teacher")
    if children:
        views.append("parent")
    if student:
        views.append("student")
    return {
        "user": frappe.session.user,
        "full_name": frappe.utils.get_fullname(frappe.session.user),
        "views": views,
        "instructor": instructor,
        "student": student,
        "children": children,
        "branding": {
            "school_name": s.school_display_name
            or frappe.db.get_single_value("Education Settings", "school_college_name_abbreviation")
            or "School",
            "logo": s.school_logo
            or frappe.db.get_single_value("Education Settings", "school_college_logo"),
            "primary_color": s.primary_color or "#1F3A5F",
        },
        "today": today(),
        "roles": sorted(roles() & {"School Principal", "Education Manager", "System Manager",
                                   "Academics User", "Instructor", "Guardian", "Student"}),
    }


@frappe.whitelist()
def principal(date: str | None = None, days: int | None = None):
    require_principal()
    cfg = _settings()
    day = getdate(date or today())
    start, end = _window(day, days)
    year, term = _current_term()

    groups = _active_groups(year)
    today_rows = _att_by_status("date = %(d)s", {"d": day})
    groups_today = _groups_today(groups, day)

    perf_filters = {"academic_year": year} if year else {}
    if term:
        perf_filters["academic_term"] = term

    alerts = frappe.db.sql(
        """select status, count(*) as count from `tabSchoolOS Alert Log`
           where date(creation) = %(d)s group by status""",
        {"d": day}, as_dict=True,
    )
    upcoming = frappe.get_all(
        "Assessment Plan",
        filters={"docstatus": 1, "schedule_date": ["between", [day, add_days(day, 14)]]},
        fields=["name", "assessment_name", "course", "student_group", "schedule_date", "from_time"],
        order_by="schedule_date asc, from_time asc",
        limit=10,
    )
    return {
        "date": str(day),
        "academic_year": year,
        "academic_term": term,
        "students": {
            "active": frappe.db.count("Student", {"enabled": 1}),
            "enrolled_this_year": frappe.db.count("Program Enrollment", {"docstatus": 1, "academic_year": year})
            if year else None,
        },
        "attendance_today": status_counts(today_rows),
        "groups_today": groups_today,
        "groups_unmarked": [g["student_group"] for g in groups_today if not g["marked"]],
        "trend": _att_trend("1=1", {}, start, end),
        "low_attendance": student_attendance_stats(
            _att_by_student("1=1", {}, start, end), threshold=cfg["threshold"], limit=15),
        "staff_today": _staff_today(day),
        "subject_performance": _subject_performance(perf_filters),
        "alerts_today": {r.status: r.count for r in alerts},
        "upcoming_exams": upcoming,
        "circulars": _recent_circulars(limit=5),
        "window": {"start": str(start), "end": str(end), "threshold": cfg["threshold"]},
    }


@frappe.whitelist()
def teacher(date: str | None = None, days: int | None = None):
    require_login()
    instructor = instructor_for_user()
    if not instructor:
        raise frappe.PermissionError("Your user is not linked to an active Instructor (via Employee)")
    cfg = _settings()
    day = getdate(date or today())
    start, end = _window(day, days)

    my_groups = frappe.get_all("Student Group Instructor",
                               filters={"instructor": instructor, "parenttype": "Student Group"},
                               pluck="parent", distinct=True)
    groups = [g for g in _active_groups() if g in set(my_groups)]

    schedule = frappe.get_all(
        "Course Schedule",
        filters={"instructor": instructor, "schedule_date": day},
        fields=["name", "course", "student_group", "room", "from_time", "to_time"],
        order_by="from_time asc",
    )
    now = get_timedelta(nowtime())
    for s in schedule:
        f, t = get_timedelta(s.from_time), get_timedelta(s.to_time)
        s["now"] = bool(f and t and now and f <= now <= t)

    absent_today = []
    if groups:
        absent_today = frappe.get_all(
            "Student Attendance",
            filters={"docstatus": 1, "date": day, "status": "Absent", "student_group": ["in", groups]},
            fields=["student", "student_name", "student_group"],
            distinct=True,
        )

    pending = []
    if groups:
        plans = frappe.get_all(
            "Assessment Plan",
            filters={"docstatus": 1, "student_group": ["in", groups], "schedule_date": ["<=", day]},
            fields=["name", "assessment_name", "course", "student_group", "schedule_date"],
            order_by="schedule_date desc",
            limit=50,
        )
        strength = _group_strength(groups)
        for p in plans:
            done = frappe.db.count("Assessment Result", {"assessment_plan": p.name, "docstatus": 1})
            if done < strength.get(p.student_group, 0):
                p["entered"] = done
                p["strength"] = strength.get(p.student_group, 0)
                pending.append(p)

    where = "student_group in %(g)s" if groups else "1=0"
    params = {"g": tuple(groups) or ("",)}
    return {
        "date": str(day),
        "instructor": instructor,
        "instructor_name": frappe.db.get_value("Instructor", instructor, "instructor_name"),
        "schedule": schedule,
        "groups_today": _groups_today(groups, day),
        "absent_today": absent_today,
        "pending_marks": pending[:15],
        "recent_posts": frappe.get_all(
            "SchoolOS Homework", filters={"docstatus": 1, "instructor": instructor},
            fields=["name", "entry_type", "title", "student_group", "course", "date", "due_date", "recipients_count"],
            order_by="date desc, creation desc", limit=8),
        "trend": _att_trend(where, params, start, end),
        "low_attendance": student_attendance_stats(
            _att_by_student(where, params, start, end), threshold=cfg["threshold"], limit=10),
        "window": {"start": str(start), "end": str(end), "threshold": cfg["threshold"]},
    }


@frappe.whitelist()
def student(student: str | None = None, days: int | None = None):
    """Summary for one student. Students see themselves; guardians see their children."""
    require_login()
    student = student or student_for_user()
    require_student_access(student)
    day = getdate(today())
    start, end = _window(day, days)
    year, term = _current_term()

    info = frappe.db.get_value("Student", student, ["name", "student_name", "image", "date_of_birth"], as_dict=True)
    enrollment = frappe.get_all("Program Enrollment", filters={"student": student, "docstatus": 1},
                                fields=["program", "academic_year", "student_batch_name"],
                                order_by="enrollment_date desc", limit=1)
    groups = frappe.get_all("Student Group Student", filters={"student": student, "active": 1}, pluck="parent")

    att = frappe.get_all("Student Attendance",
                         filters={"student": student, "docstatus": 1, "date": ["between", [start, end]]},
                         fields=["date", "status"], order_by="date desc")
    per_day = {}
    rank = {"Present": 3, "Leave": 2, "Absent": 1}
    for r in att:
        if r.date not in per_day or rank.get(r.status, 0) > rank.get(per_day[r.date], 0):
            per_day[r.date] = r.status
    count_leave = bool(cint(frappe.db.get_single_value("SchoolOS Settings", "count_leave_as_present")))
    summary = attendance_summary(per_day.values(), count_leave_as_present=count_leave)
    recent_absences = [str(d) for d, s in sorted(per_day.items(), reverse=True) if s == "Absent"][:5]

    schedule = []
    if groups:
        schedule = frappe.get_all("Course Schedule",
                                  filters={"student_group": ["in", groups], "schedule_date": day},
                                  fields=["course", "instructor_name", "room", "from_time", "to_time"],
                                  order_by="from_time asc")

    res_filters = {"student": student, "docstatus": 1}
    if year:
        res_filters["academic_year"] = year
    results = frappe.get_all("Assessment Result", filters=res_filters,
                             fields=["name", "course", "assessment_group", "assessment_plan",
                                     "total_score", "maximum_score", "grade", "modified"],
                             order_by="modified desc", limit=12)
    for r in results:
        r["percentage"] = round(flt(r.total_score) * 100 / flt(r.maximum_score), 1) if r.maximum_score else None
        r["assessment_name"] = frappe.db.get_value("Assessment Plan", r.assessment_plan, "assessment_name")

    cards = frappe.get_all("Student Report Card", filters={"student": student, "docstatus": 1},
                           fields=["name", "template", "overall_percentage", "overall_grade", "result", "modified"],
                           order_by="modified desc", limit=5)
    return {
        "student": info,
        "enrollment": enrollment[0] if enrollment else None,
        "attendance": summary,
        "recent_absences": recent_absences,
        "calendar": [{"date": str(d), "status": st} for d, st in sorted(per_day.items())],
        "today_schedule": schedule,
        "results": results,
        "report_cards": cards,
        "homework": homework_for_groups(groups, days=7, limit=10),
        "circulars": _recent_circulars([student], limit=5),
        "window": {"start": str(start), "end": str(end)},
    }


def _fees_brief(student):
    try:
        from schoolos.api.fees import student_fees

        f = student_fees(student)
        return {k: f[k] for k in ("outstanding", "overdue", "paid", "total", "next_due", "currency", "pay_online")}
    except Exception:
        frappe.log_error(title="SchoolOS parent dashboard: fees")
        return None


@frappe.whitelist()
def parent():
    """All children of the logged-in guardian with a short summary each."""
    require_login()
    out = []
    for c in guardian_children():
        s = student(c.name)
        out.append({
            "student": c.name,
            "student_name": c.student_name,
            "image": c.image,
            "attendance": s["attendance"],
            "absent_recently": s["recent_absences"][:3],
            "calendar": s["calendar"],
            "enrollment": s["enrollment"],
            "latest_result": s["results"][0] if s["results"] else None,
            "homework_due": [h for h in s["homework"] if h.due_date and not h.overdue][:3],
            "fees": _fees_brief(c.name),
            "report_cards": s["report_cards"][:2],
        })
    circulars = _recent_circulars([c["student"] for c in out], limit=5) if out else []
    return {"children": out, "circulars": circulars}
