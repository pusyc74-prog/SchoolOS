# Importing a school's students from Excel

Most schools already have their students in an Excel sheet or their old software can export
one. SchoolOS takes **one sheet, one row per student**, and creates everything else:
classes, sections, parents, enrolments and class lists.

## Steps

1. Desk → **SchoolOS Student Import** → **New**. Pick the **Academic Year**, save.
2. Click **Download Template**. Open it in Excel or Google Sheets.
3. Paste the school's data into the **Students** sheet (row 2 is an example: overwrite it).
   Required (red) columns: **Class, Section, First Name, Gender, Date of Birth**.
4. Attach the file, save, click **Validate**. The log lists every problem by row number.
   Fix them in Excel, attach again, validate again.
5. Click **Start Import**. It runs in the background; the page updates when done.
   Rows that still have errors are skipped and listed in the log; everything else is imported.

## What gets created

| From the sheet | Becomes |
|---|---|
| Class (e.g. "Class 5") | Program (created if missing, when "Create missing classes" is ticked) |
| Class + Section | Student Group, e.g. **Class 5 - A (2026-27)** |
| Each row | Student, Program Enrollment for the year, a place in the section with the roll number |
| Father / Mother name, mobile, email | Guardian records linked to the student, ready for alerts |

## Good to know

- **Siblings**: give them the same parent mobile number. They're linked to one Guardian,
  so the parent sees both children in one login and gets one alert per child.
- **Re-importing** the same sheet later updates students instead of duplicating them.
  Students are matched by **Admission / GR No**, or by first name + last name + date of birth.
- **Student logins** are off by default (young children don't need them). Students without
  an email get a placeholder address ending in `@students.noemail`; nothing is sent to it.
- **Mobile numbers** can be typed any common way (`98765 43210`, `+91-98765-43210`,
  `098765 43210`); they're stored in WhatsApp format.
- Dates as **DD-MM-YYYY**. Gender as Male / Female / Other (M / F accepted).
- Each row is saved on its own: a problem in one row never leaves half-created records.

## Fees and online payment

Fees come from Frappe Education's own setup: **Fee Structure → Fee Schedule**, which creates
one invoice per student. SchoolOS reads those invoices and their payments; nothing extra to set up.

- **Online payment**: Desk → **Education Settings** → enter the school's Razorpay key and secret.
  Parents then see **Pay** on every unpaid fee. Without a key they're asked to pay at the office.
- **Reminders**: SchoolOS Settings → *Automatic Fee Reminders* (days before due, repeat interval).
  The Fees tab also has **Remind all overdue** and per-student reminders.

## Syllabus

Each subject's chapters live in Desk → **Course** → *Topics*. Teachers then log lessons from
`/school` (My classes → *Log today's lesson*) and coverage updates automatically.
