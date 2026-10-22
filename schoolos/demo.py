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
    make_syllabus_and_lessons(group.name, courses, instructors, year)
    make_teacher_notes(students)
    make_circular()
    make_report_cards(group.name, year)
    make_fees(students, company, year)
    make_calendar_and_gallery(group.name, holiday_list)
    make_leave_request(students[0], group.name)
    make_bills_for_approval(company)

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


SYLLABUS = {
    "English": ["Nouns", "Pronouns", "Verbs", "Adjectives", "Tenses", "Poem: Trees", "Story: The Lost Kite", "Letter Writing",
                "Comprehension", "Articles", "Prepositions", "Essay Writing"],
    "Mathematics": ["Large Numbers", "Addition & Subtraction", "Multiplication", "Division", "Factors & Multiples", "Fractions",
                    "Decimals", "Measurement", "Area & Perimeter", "Geometry: Angles", "Data Handling", "Patterns"],
    "Science": ["Living & Non-living", "Plants: Photosynthesis", "Animals & Habitats", "Food & Nutrition", "Water Cycle",
                "Air & Weather", "Our Body", "Health & Hygiene", "Light & Shadows", "Simple Machines", "Soil", "Natural Resources"],
    "Social Studies": ["Our Country", "Maps & Directions", "Maharashtra", "Rivers of India", "Our Government", "Festivals",
                       "Transport & Communication", "Early Humans", "Indus Valley", "Climate Zones", "Agriculture", "Industries"],
    "Marathi": ["वर्णमाला", "शब्द व वाक्य", "कविता: पाऊस", "गोष्ट: चतुर कावळा", "नाम", "सर्वनाम", "क्रियापद", "पत्रलेखन",
                "निबंध", "म्हणी", "समानार्थी शब्द", "वाचन"],
    "Hindi": ["वर्णमाला", "संज्ञा", "सर्वनाम", "कविता: चिड़िया", "क्रिया", "विशेषण", "कहानी: ईमानदार लकड़हारा", "पत्र लेखन",
              "निबंध", "मुहावरे", "विलोम शब्द", "पठन"],
}


def make_syllabus_and_lessons(group, courses, instructors, year):
    """12 chapters per subject; lessons logged so coverage varies (Mathematics behind on purpose)."""
    progress = {"English": 6, "Mathematics": 3, "Science": 6, "Social Studies": 5, "Marathi": 5, "Hindi": 7}
    notes = {
        "Nouns": "Common and proper nouns with examples from the classroom. Worksheet page 12.",
        "Large Numbers": "Place value up to crores using the Indian system. Practise reading numbers aloud.",
        "Plants: Photosynthesis": "Leaf experiment with iodine. Students drew the process in their notebooks.",
        "Maps & Directions": "Used the school map to learn the four directions. Homework: draw your route home.",
    }
    for course, ins in zip(courses, instructors):
        names = SYLLABUS.get(course, [])
        doc = frappe.get_doc("Course", course)
        if not doc.get("topics"):
            for n in names:
                if not frappe.db.exists("Topic", n):
                    frappe.get_doc({"doctype": "Topic", "topic_name": n}).insert()
                doc.append("topics", {"topic": n, "topic_name": n})
            doc.save()
        done = progress.get(course, 4)
        for k, n in enumerate(names[: done + 1]):
            frappe.get_doc({
                "doctype": "SchoolOS Lesson Log", "student_group": group, "course": course, "topic": n,
                "completed": 1 if k < done else 0, "instructor": ins,
                "date": add_days(today(), -(done - k) * 9 - 1),
                "notes": notes.get(n, f"Covered {n}. Revise the textbook exercise at home."),
            }).insert()


def make_teacher_notes(students):
    for student, kind, text in [
        (students[0], "Achievement", "Won second place in the inter-school spelling bee. Very proud of him!"),
        (students[0], "Academic", "Needs more practice with long division; please revise exercise 4.2 at home."),
        (students[1], "General", "Helpful and kind to classmates; volunteered to lead the morning assembly."),
    ]:
        frappe.get_doc({"doctype": "Student Log", "student": student, "type": kind, "date": add_days(today(), -random.randint(1, 12)),
                        "log": text, "schoolos_share_with_parent": 1}).insert()


def make_fees(students, company, year):
    """Three quarterly instalments per student, most paid, a few defaulters."""
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

    for item, rate in (("Tuition Fee", 12000), ("Transport Fee", 3000), ("Activity Fee", 1500)):
        if not frappe.db.exists("Item", item):
            frappe.get_doc({"doctype": "Item", "item_code": item, "item_name": item, "item_group": "Services"
                            if frappe.db.exists("Item Group", "Services") else "All Item Groups",
                            "is_stock_item": 0, "stock_uom": "Nos", "standard_rate": rate}).insert()
    if not frappe.db.exists("Mode of Payment", "UPI"):
        cash = frappe.db.get_value("Company", company, "default_cash_account")
        frappe.get_doc({"doctype": "Mode of Payment", "mode_of_payment": "UPI", "type": "Bank",
                        "accounts": [{"company": company, "default_account": cash}] if cash else []}).insert()
    ys = getdate(frappe.db.get_value("Academic Year", year, "year_start_date"))
    dues = [getdate(f"{ys.year}-06-10"), getdate(f"{ys.year}-09-10"), getdate(f"{ys.year}-12-10")]
    defaulters = {5, 12, 21}
    partial = {3, 17}
    errors = 0
    for i, student in enumerate(students):
        customer = frappe.db.get_value("Student", student, "customer")
        if not customer:
            continue
        for q, due in enumerate(dues):
            items = [{"item_code": "Tuition Fee", "qty": 1, "rate": 12000}]
            if i % 3 == 0:
                items.append({"item_code": "Transport Fee", "qty": 1, "rate": 3000})
            if q == 0:
                items.append({"item_code": "Activity Fee", "qty": 1, "rate": 1500})
            posting = min(add_days(due, -25), getdate(today()))
            try:
                si = frappe.get_doc({"doctype": "Sales Invoice", "customer": customer, "company": company, "student": student,
                                     "set_posting_time": 1, "posting_date": posting, "due_date": max(due, posting), "items": items})
                si.insert()
                si.submit()
            except Exception as e:
                errors += 1
                if errors == 1:
                    print("Demo fees skipped (check Accounts setup):", e)
                break
            if due > getdate(today()) or i in defaulters or (q == 1 and i % 4 == 1):
                continue
            pe = get_payment_entry("Sales Invoice", si.name)
            pe.mode_of_payment = random.choice(["UPI", "UPI", "UPI", "Cash"])
            pe.posting_date = min(add_days(due, random.randint(-8, 6)), getdate(today()))
            pe.reference_no = f"UPI{random.randint(10**9, 10**10 - 1)}"
            pe.reference_date = pe.posting_date
            if i in partial and q == 1:
                half = si.grand_total / 2
                pe.paid_amount = pe.received_amount = half
                pe.references[0].allocated_amount = half
            try:
                pe.insert()
                pe.submit()
            except Exception as e:
                print("Demo payment skipped:", e)
                return


def make_calendar_and_gallery(group, holiday_list):
    t = getdate(today())
    events = [
        ("Parent-Teacher Meeting", "PTM", 3, None, "09:00", "Classrooms"),
        ("Unit Test 2 begins", "Exam", 6, 10, None, None),
        ("Annual Sports Day", "Sports", 14, None, "08:00", "School ground"),
        ("Science Exhibition", "Event", 21, None, "10:00", "Hall"),
        ("Diwali vacation", "Holiday", 9, 15, None, None),
        ("Class 5 trip to Panhala", "Trip", 18, None, "07:00", "Panhala Fort"),
    ]
    for title, kind, start, end, time, place in events:
        frappe.get_doc({"doctype": "SchoolOS Event", "title": title, "event_type": kind,
                        "start_date": add_days(t, start), "end_date": add_days(t, end) if end else None,
                        "start_time": time, "location": place, "audience": "All Students" if kind != "Trip" else "Student Group",
                        "student_group": group if kind == "Trip" else None, "published": 1,
                        "description": f"{title}. More details from the class teacher."}).insert()
    for d, name in [(add_days(t, 25), "Guru Nanak Jayanti")]:
        if holiday_list and not frappe.db.exists("Holiday", {"parent": holiday_list, "holiday_date": d}):
            hl = frappe.get_doc("Holiday List", holiday_list)
            if getdate(hl.from_date) <= getdate(d) <= getdate(hl.to_date):
                hl.append("holidays", {"holiday_date": d, "description": name, "weekly_off": 0})
                hl.save()
    try:
        photos = [_demo_photo(f"Sports Day {i + 1}", hue) for i, hue in enumerate([(31, 120, 180), (220, 140, 40), (40, 150, 90), (170, 60, 90), (90, 80, 170)])]
        frappe.get_doc({"doctype": "SchoolOS Album", "title": "Independence Day & Sports Week", "date": add_days(t, -12),
                        "audience": "All Students", "published": 1, "description": "Flag hoisting, march past and races.",
                        "photos": [{"image": url, "caption": cap} for url, cap in photos]}).insert()
    except Exception as e:
        print("Demo album skipped:", e)


def _demo_photo(caption, rgb):
    """A simple generated image so the demo gallery has something to show."""
    import io

    from PIL import Image, ImageDraw

    img = Image.new("RGB", (960, 640), rgb)
    d = ImageDraw.Draw(img)
    for k in range(0, 960, 60):
        d.line([(k, 640), (k + 300, 0)], fill=tuple(min(255, c + 25) for c in rgb), width=18)
    d.text((40, 580), caption, fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    f = frappe.get_doc({"doctype": "File", "file_name": caption.lower().replace(" ", "-") + ".jpg", "is_private": 0,
                        "content": buf.getvalue()}).insert()
    return f.file_url, caption


def make_leave_request(student, group):
    try:
        frappe.get_doc({"doctype": "Student Leave Application", "student": student, "student_group": group,
                        "attendance_based_on": "Student Group", "from_date": add_days(today(), 2), "to_date": add_days(today(), 3),
                        "reason": "Family function in Kolhapur.", "schoolos_status": "Pending"}).insert(ignore_permissions=True)
    except Exception as e:
        print("Demo leave request skipped:", e)


def make_bills_for_approval(company):
    """Two supplier bills waiting for the principal (skipped if the books aren't set up)."""
    try:
        for name in ("Sai Stationers", "MSEDCL"):
            if not frappe.db.exists("Supplier", name):
                frappe.get_doc({"doctype": "Supplier", "supplier_name": name,
                                "supplier_group": frappe.db.get_value("Supplier Group", {"is_group": 0}) or "All Supplier Groups"}).insert()
        if not frappe.db.exists("Item", "School Supplies"):
            frappe.get_doc({"doctype": "Item", "item_code": "School Supplies", "item_name": "School Supplies", "is_stock_item": 0,
                            "item_group": frappe.db.get_value("Item Group", {"is_group": 0}) or "All Item Groups", "stock_uom": "Nos"}).insert()
        for supplier, amount, remark in (("Sai Stationers", 38500, "Notebooks and chart paper for October"),
                                         ("MSEDCL", 42150, "Electricity bill, September")):
            frappe.get_doc({"doctype": "Purchase Invoice", "supplier": supplier, "company": company, "posting_date": today(),
                            "due_date": add_days(today(), 10), "remarks": remark,
                            "items": [{"item_code": "School Supplies", "qty": 1, "rate": amount}]}).insert()
    except Exception as e:
        print("Demo bills skipped (finish the Accounts setup first):", e)


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
