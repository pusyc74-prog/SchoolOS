# Acceptance test: school sign-off

School: ______________________  Site: ______________________  Version (commit): ________

Done on the school's own site with its real classes and students, **in Test Mode** (no real
messages go to parents). Use real phones. Tick **Yes** or **No**, and write what happened for
every No. We fix each No and you test that line again.

## 1. Office / admin

| # | Do this | Expected | Yes | No / notes |
|---|---|---|---|---|
| 1.1 | Open `https://<site>/school` on a laptop and a phone | School name, logo and colour show | ☐ | |
| 1.2 | Count the students per section in Desk → Student Group | Matches the register | ☐ | |
| 1.3 | Open 5 random students | Name, class, roll no, GR no, parents and mobiles are right | ☐ | |
| 1.4 | Find two siblings | They share the same parent record | ☐ | |
| 1.5 | Add one new student through the Excel import | Imported and placed in the right section | ☐ | |
| 1.6 | Upload the same sheet again | Nothing is duplicated | ☐ | |
| 1.7 | SchoolOS Settings → turn off one module (e.g. Calendar), reload `/school` | It disappears for everyone; turn it on again and it comes back | ☐ | |
| 1.8 | SchoolOS Settings → Send Test to your own email / mobile | A log entry shows "Dry Run" (Test Mode) | ☐ | |

## 2. Teacher (on a phone)

| # | Do this | Expected | Yes | No / notes |
|---|---|---|---|---|
| 2.1 | Log in, open My classes | Only my sections; today's timetable | ☐ | |
| 2.2 | Mark today's attendance with 1–2 absentees | Dashboard updates; Alert Log shows an absence alert per absentee's parent | ☐ | |
| 2.3 | Post homework with a due date | Parents of that section see it; others don't | ☐ | |
| 2.4 | Try to post for a section I don't teach | Not offered / refused | ☐ | |
| 2.5 | Log today's lesson against a chapter | Syllabus % for that subject goes up | ☐ | |
| 2.6 | Write a note about a student (shared with parent) | The parent sees it in Progress | ☐ | |
| 2.7 | Approve one leave request and reject one with a reason | Approved days show "Leave" in attendance; no absence alert for them; parent sees both decisions | ☐ | |
| 2.8 | Enter marks for one test (Desk) | Results show for the student and parent | ☐ | |

## 3. Parent (own phone, own login)

| # | Do this | Expected | Yes | No / notes |
|---|---|---|---|---|
| 3.1 | Open the link, "Add to Home Screen" (Android and iPhone) | The app icon has the school's name; it opens full-screen | ☐ | |
| 3.2 | Home | Only my children; attendance %, dues, homework due | ☐ | |
| 3.3 | Change the address to another student's ID | "You can't view this student" | ☐ | |
| 3.4 | Progress tab | Subjects with syllabus covered vs expected; class and teacher notes | ☐ | |
| 3.5 | Fees tab | Invoices and payments match the office register; receipt PDF downloads | ☐ | |
| 3.6 | Pay Now (if Razorpay is on), with Razorpay test keys | Payment recorded, dues go down, receipt available | ☐ | |
| 3.7 | Apply for leave | The class teacher sees it in their list | ☐ | |
| 3.8 | Calendar and Gallery | School events, holidays, my child's exams and fee dates; photos open | ☐ | |
| 3.9 | Report card (after it's published) | PDF opens; marks, grades and attendance are right | ☐ | |
| 3.10 | Switch to मराठी | Screens in Marathi; wording reads naturally | ☐ | |
| 3.11 | Turn on airplane mode and open the app | Last data shows with an "offline" note | ☐ | |

## 4. Principal

| # | Do this | Expected | Yes | No / notes |
|---|---|---|---|---|
| 4.1 | Principal dashboard | Today's attendance %, sections not yet marked, staff present, low-attendance list match reality | ☐ | |
| 4.2 | Fees tab | Collected, pending and overdue per class match the accounts register | ☐ | |
| 4.3 | Send reminders to defaulters (Test Mode) | Alert Log shows one reminder per parent; no duplicates when sent twice the same day | ☐ | |
| 4.4 | Publish a circular to one class | Only that class's parents get it (Alert Log) | ☐ | |
| 4.5 | Generate report cards for a section, publish two | The parents of those two see the PDF | ☐ | |
| 4.6 | Syllabus overview | Class × subject coverage looks right | ☐ | |

## 5. Accounts

| # | Do this | Expected | Yes | No / notes |
|---|---|---|---|---|
| 5.1 | Accounts tab (full mode) | Income, expenses, cash and bank balances match the books | ☐ | |
| 5.2 | Approve one supplier bill, reject one with a reason | Approved bill is posted; rejected one shows the reason | ☐ | |
| 5.3 | Tally mode: export last month (ledgers, then vouchers) | Imports into a **test company** in Tally; totals match | ☐ | |

## 6. Safety

| # | Check | Yes | No / notes |
|---|---|---|---|
| 6.1 | The site opens only on https (padlock) | ☐ | |
| 6.2 | A teacher cannot open Fees or Accounts | ☐ | |
| 6.3 | A parent cannot open the principal, teacher, fees or accounts pages | ☐ | |
| 6.4 | Last night's backup exists on the server and in the school's Google Drive | ☐ | |

---

All lines are Yes (or the open ones are agreed in writing as "after go-live").

Principal: ______________________  Date: __________

For us: ______________________  Date: __________

Go-live date agreed: __________. Test Mode is turned off on that morning.
