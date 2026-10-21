"""Demo school for testing and sales demos.

Run after finishing the ERPNext setup wizard:
    bench --site school.localhost execute schoolos.demo.make_demo

Creates: academic year & terms, "Class 5" with 6 subjects, 30 students with
guardians, 6 teachers, ~40 days of attendance, two exams with marks, today's
timetable, homework, a circular, a CBSE report-card template and report cards.
Logins (password Demo@12345): principal@demo.school, teacher@demo.school, parent@demo.school
Test Mode stays ON, so no real WhatsApp or email goes out.
"""

import random

import frappe
from frappe.utils import add_days, getdate, today
from frappe.utils.password import update_password

PASSWORD = "Demo@12345"
GROUP = "Class 5 - A"
PROGRAM = "Class 5"
SUBJECTS = ["English", "Mathematics", "Science", "Social Studies", "Marathi", "Hindi"]
FIRST = ["Aarav", "Riya", "Vihaan", "Ananya", "Arjun", "Diya", "Kabir", "Isha", "Reyansh", "Saanvi",
         "Aditya", "Myra", "Krishna", "Anika", "Shaurya", "Kiara", "Atharv", "Pari", "Ishaan", "Navya",
         "Vivaan", "Aadhya", "Om", "Siya", "Rudra", "Tara", "Yash", "Mira", "Dev", "Avni"]
LAST = ["Patil", "Kulkarni", "Deshmukh", "Joshi", "Pawar", "Shinde", "Jadhav", "More", "Kale", "Gaikwad"]
TEACHERS = ["Sunita Kulkarni", "Rajesh Patil", "Meera Deshpande", "Anil Jadhav", "Kavita Joshi", "Prakash More"]


def make_demo():
    if frappe.db.exists("Student Group", GROUP):
        print("Demo already exists. Delete the site or the demo records to recreate it.")
        return
    random.seed(42)
    company = frappe.db.get_single_value("Global Defaults", "default_company") or frappe.get_all("Company", pluck="name")[0]
    frappe.db.set_single_value("Education Settings", "user_creation_skip", 1)

    year, term1, term2 = make_academic_calendar()
    holiday_list = ensure_holiday_list(company, year)
    courses = make_courses()
    make_program(courses)
    batch = ensure("Student Batch Name", {"batch_name": "A"})
    room = frappe.db.get_value("Room", {"room_name": "Room 5A"}) or frappe.get_doc(
        {"doctype": "Room", "room_name": "Room 5A", "seating_capacity": 40}).insert().name

    instructors, users = make_teachers(company)
    principal = make_user("principal@demo.school", "Priya", "Deshmukh",
                          ["School Principal", "Education Manager", "Academics User"])
    students, parent_user = make_students(year)

    group = frappe.get_doc({
        "doctype": "Student Group",
        "student_group_name": GROUP,
        "group_based_on": "Batch",
        "program": PROGRAM,
        "batch": batch,
        "academic_year": year,
        "academic_term": term1,
        "max_strength": 40,
        "students": [{"student": s, "active": 1} for s in students],
        "instructors": [{"instructor": i} for i in instructors],
    }).insert()

    configure_settings()  # before attendance, so today's absence triggers a (test-mode) alert
    make_attendance(group.name, students, holiday_list)
    make_timetable(group.name, courses, instructors, room)
    make_exams(group.name, courses, instructors, students, year, term1)
    make_homework(group.name, courses, instructors)
    make_circular()
    make_report_cards(group.name, year)

    frappe.db.commit()
    print(f"""
Demo ready.
  Dashboard:  /school
  Principal:  principal@demo.school / {PASSWORD}
  Teacher:    {users[0]} / {PASSWORD}
  Parent:     {parent_user} / {PASSWORD}
""")


# ---------------------------------------------------------------- helpers
def ensure(doctype, values, name_field=None):
    key = name_field or next(iter(values))
    existing = frappe.db.get_value(doctype, {key: values[key]})
    if existing:
        return existing
    return frappe.get_doc({"doctype": doctype, **values}).insert().name


def make_user(email, first, last, roles, website=False):
    if not frappe.db.exists("User", email):
        u = frappe.get_doc({
            "doctype": "User", "email": email, "first_name": first, "last_name": last,
            "send_welcome_email": 0, "user_type": "Website User" if website else "System User",
        })
        u.insert(ignore_permissions=True)
        u.add_roles(*roles)
        update_password(email, PASSWORD)
    return email


def make_academic_calendar():
    t = getdate(today())
    start_year = t.year if t.month >= 6 else t.year - 1
    name = f"{start_year}-{str(start_year + 1)[-2:]}"
    ys, ye = getdate(f"{start_year}-06-01"), getdate(f"{start_year + 1}-04-30")
    ensure("Academic Year", {"academic_year_name": name, "year_start_date": ys, "year_end_date": ye})
    mid = getdate(f"{start_year}-10-31")
    t1 = ensure_term(name, "Term 1", ys, mid)
    t2 = ensure_term(name, "Term 2", add_days(mid, 1), ye)
    frappe.db.set_single_value("Education Settings", "current_academic_year", name)
    frappe.db.set_single_value("Education Settings", "current_academic_term", t1 if t <= mid else t2)
    return name, t1, t2


def ensure_term(year, term, start, end):
    title = f"{year} ({term})"
    if not frappe.db.exists("Academic Term", title):
        frappe.get_doc({"doctype": "Academic Term", "academic_year": year, "term_name": term,
                        "term_start_date": start, "term_end_date": end}).insert()
    return title


def ensure_holiday_list(company, year):
    hl = frappe.get_cached_value("Company", company, "default_holiday_list")
    if hl:
        return hl
    ys, ye = frappe.db.get_value("Academic Year", year, ["year_start_date", "year_end_date"])
    name = f"School Holidays {year}"
    if not frappe.db.exists("Holiday List", name):
        doc = frappe.get_doc({"doctype": "Holiday List", "holiday_list_name": name,
                              "from_date": ys, "to_date": ye, "holidays": []})
        d = getdate(ys)
        while d <= getdate(ye):
            if d.weekday() == 6:
                doc.append("holidays", {"holiday_date": d, "description": "Sunday", "weekly_off": 1})
            d = add_days(d, 1)
        doc.insert()
    frappe.db.set_value("Company", company, "default_holiday_list", name)
    frappe.clear_cache(doctype="Company")
    return name


def make_courses():
    return [ensure("Course", {"course_name": s}) for s in SUBJECTS]


def make_program(courses):
    if not frappe.db.exists("Program", PROGRAM):
        frappe.get_doc({"doctype": "Program", "program_name": PROGRAM,
                        "courses": [{"course": c, "required": 1} for c in courses]}).insert()


def make_teachers(company):
    instructors, users = [], []
    for i, full in enumerate(TEACHERS):
        first, last = full.split(" ", 1)
        email = "teacher@demo.school" if i == 0 else f"teacher{i + 1}@demo.school"
        make_user(email, first, last, ["Instructor", "Academics User", "Employee"])
        emp = frappe.db.get_value("Employee", {"user_id": email})
        if not emp:
            emp = frappe.get_doc({
                "doctype": "Employee", "first_name": first, "last_name": last, "company": company,
                "gender": "Female" if first in ("Sunita", "Meera", "Kavita") else "Male",
                "date_of_birth": "1985-01-15", "date_of_joining": "2015-06-01", "status": "Active",
                "user_id": email,
            }).insert().name
        ins = frappe.db.get_value("Instructor", {"employee": emp})
        if not ins:
            ins = frappe.get_doc({"doctype": "Instructor", "naming_series": "EDU-INS-.YYYY.-",
                                  "instructor_name": full, "employee": emp, "status": "Active"}).insert().name
        instructors.append(ins)
        users.append(email)
    return instructors, users


def make_students(year):
    students = []
    parent_user = make_user("parent@demo.school", "Suresh", "Patil", ["Guardian"], website=True)
    for i, first in enumerate(FIRST):
        last = "Patil" if i in (0, 1) else random.choice(LAST)
        mobile = f"98{random.randint(10000000, 99999999)}"
        guardian = frappe.get_doc({
            "doctype": "Guardian",
            "guardian_name": "Suresh Patil" if i in (0, 1) else f"{random.choice(['Mr', 'Mrs'])} {last}",
            "mobile_number": mobile,
            "email_address": parent_user if i in (0, 1) else f"guardian{i + 1}@example.com",
            "user": parent_user if i in (0, 1) else None,
            "schoolos_alerts_opt_in": 1,
        })
        if i == 1:  # siblings share one guardian
            guardian = frappe.get_doc("Guardian", frappe.db.get_value("Guardian", {"user": parent_user}))
        else:
            guardian.insert()
        s = frappe.get_doc({
            "doctype": "Student", "first_name": first, "last_name": last,
            "student_email_id": f"student{i + 1}@demo.school",
            "student_mobile_number": mobile,
            "gender": "Female" if first in ("Riya", "Ananya", "Diya", "Isha", "Saanvi", "Myra", "Anika", "Kiara",
                                            "Pari", "Navya", "Aadhya", "Siya", "Tara", "Mira", "Avni") else "Male",
            "date_of_birth": f"2016-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            "joining_date": f"{year[:4]}-06-01",
            "guardians": [{"guardian": guardian.name, "relation": "Father"}],
        }).insert()
        pe = frappe.get_doc({"doctype": "Program Enrollment", "student": s.name, "program": PROGRAM,
                             "academic_year": year, "enrollment_date": f"{year[:4]}-06-01"})
        pe.insert()
        pe.submit()
        students.append(s.name)
    return students, parent_user


def make_attendance(group, students, holiday_list, days=40):
    holidays = set(frappe.get_all("Holiday", filters={"parent": holiday_list}, pluck="holiday_date"))
    # a few students with poor attendance so the dashboards have something to flag
    rate = {s: (0.62 if i in (5, 12, 21) else 0.8 if i in (3, 17) else 0.96) for i, s in enumerate(students)}
    d = add_days(today(), -days)
    while getdate(d) <= getdate(today()):
        if getdate(d) not in holidays and getdate(d).weekday() != 6:
            for s in students:
                roll = random.random()
                status = "Present" if roll < rate[s] else ("Leave" if roll < rate[s] + 0.01 else "Absent")
                if getdate(d) == getdate(today()) and s == students[0]:
                    status = "Absent"  # triggers a demo absence alert for the parent login
                doc = frappe.get_doc({"doctype": "Student Attendance", "student": s, "student_group": group,
                                      "date": d, "status": status})
                doc.insert()
                doc.submit()
        d = add_days(d, 1)


def make_timetable(group, courses, instructors, room):
    day = today()
    if getdate(day).weekday() == 6:
        return
    slots = [("08:30", "09:15"), ("09:15", "10:00"), ("10:15", "11:00"), ("11:00", "11:45"),
             ("12:30", "13:15"), ("13:15", "14:00")]
    for (start, end), course, ins in zip(slots, courses, instructors):
        frappe.get_doc({"doctype": "Course Schedule", "naming_series": "EDU-CSH-.YYYY.-", "student_group": group,
                        "instructor": ins, "course": course, "room": room, "schedule_date": day,
                        "from_time": start, "to_time": end}).insert()


def _criteria(names):
    for n in names:
        ensure("Assessment Criteria", {"assessment_criteria": n})


def _group(name):
    if not frappe.db.exists("Assessment Group", name):
        frappe.get_doc({"doctype": "Assessment Group", "assessment_group_name": name,
                        "parent_assessment_group": "All Assessment Groups", "is_group": 0}).insert()
    return name


def make_exams(group, courses, instructors, students, year, term):
    _criteria(["Written", "PT", "NB", "SE", "Exam"])
    exams = [
        ("Unit Test 1", -70, [("Written", 20)]),
        ("Half Yearly", -21, [("PT", 10), ("NB", 5), ("SE", 5), ("Exam", 80)]),
    ]
    ability = {s: random.uniform(0.35, 0.95) for s in students}
    for exam, offset, criteria in exams:
        _group(exam)
        for i, (course, ins) in enumerate(zip(courses, instructors)):
            date = add_days(today(), offset + i)
            if getdate(date).weekday() == 6:
                date = add_days(date, 1)
            plan = frappe.get_doc({
                "doctype": "Assessment Plan", "assessment_name": f"{exam} - {course}", "student_group": group,
                "assessment_group": exam, "grading_scale": "CBSE 8-Point", "course": course, "program": PROGRAM,
                "academic_year": year, "academic_term": term, "schedule_date": date,
                "from_time": f"{8 + i:02d}:00", "to_time": f"{8 + i:02d}:50", "examiner": ins,
                "maximum_assessment_score": sum(m for _, m in criteria),
                "assessment_criteria": [{"assessment_criteria": c, "maximum_score": m} for c, m in criteria],
            })
            plan.insert()
            plan.submit()
            for s in students:
                subj = min(1.0, max(0.15, ability[s] + random.uniform(-0.12, 0.12)))
                res = frappe.get_doc({
                    "doctype": "Assessment Result", "assessment_plan": plan.name, "student": s,
                    "student_group": group, "program": PROGRAM, "course": course, "academic_year": year,
                    "academic_term": term, "assessment_group": exam, "grading_scale": "CBSE 8-Point",
                    "maximum_score": plan.maximum_assessment_score,
                    "details": [{"assessment_criteria": c, "maximum_score": m, "score": round(m * subj)}
                                for c, m in criteria],
                })
                res.insert()
                res.submit()


def make_homework(group, courses, instructors):
    # (days ago, subject index, type, title, details, due in N days from posting)
    items = [
        (0, 1, "Homework", "Exercise 4.2, questions 1–10", "Show all working in the notebook.", 2),
        (1, 0, "Homework", "Learn the poem 'Trees' (first two stanzas)", "", 3),
        (2, 2, "Project", "Make a model of the water cycle", "Use waste material. Groups of 3.", 9),
        (4, 3, "Note", "Bring an atlas tomorrow", "", 1),
    ]
    for i, subj, kind, title, details, due_in in items:
        course, ins = courses[subj], instructors[subj]
        hw = frappe.get_doc({
            "doctype": "SchoolOS Homework", "entry_type": kind, "title": title, "details": details,
            "student_group": group, "course": course, "instructor": ins,
            "date": add_days(today(), -i), "due_date": add_days(today(), due_in - i), "notify_parents": 1,
        })
        hw.insert()
        hw.submit()


def configure_settings():
    s = frappe.get_single("SchoolOS Settings")
    s.school_display_name = s.school_display_name or "Demo Public School"
    s.school_address = s.school_address or "Vishrambag, Sangli, Maharashtra"
    s.alerts_enabled = 1
    s.dry_run = 1
    s.send_email = 1
    s.save()


def make_circular():
    c = frappe.get_doc({
        "doctype": "SchoolOS Circular", "title": "Parent-Teacher Meeting on Saturday",
        "audience": "All Students", "publish_date": today(), "send_whatsapp": 1, "send_email": 1,
        "message": "<p>Dear parents, the Half Yearly PTM is on Saturday from 9 am to 12 pm. "
                   "Please collect your child's report card from the class teacher.</p>",
    })
    c.insert()
    c.submit()


def make_report_cards(group, year):
    name = f"{PROGRAM} Term 1 (CBSE)"
    if not frappe.db.exists("Report Card Template", name):
        frappe.get_doc({
            "doctype": "Report Card Template", "template_name": name, "board": "CBSE",
            "academic_year": year, "program": PROGRAM, "report_title": "Term 1 Progress Report",
            "grading_scale": "CBSE 8-Point", "pass_percentage": 33, "show_criteria_breakdown": 1,
            "exams": [
                {"label": "Unit Test 1", "assessment_group": "Unit Test 1"},
                {"label": "Half Yearly", "assessment_group": "Half Yearly"},
            ],
            "co_scholastic_areas": [{"area": a} for a in
                                    ("Work Education", "Art Education", "Health & Physical Education", "Discipline")],
        }).insert()
    from schoolos.api.report_card import generate

    generate(name, group)
    # publish the first two (the demo parent's children) so the parent view has a PDF
    for rc in frappe.get_all("Student Report Card", filters={"template": name, "docstatus": 0},
                             order_by="roll_number asc", limit=2, pluck="name"):
        doc = frappe.get_doc("Student Report Card", rc)
        for row in doc.co_scholastic:
            row.grade = random.choice(["A", "A", "B"])
        doc.teacher_remarks = "Attentive in class and completes work on time."
        doc.save()
        doc.submit()
