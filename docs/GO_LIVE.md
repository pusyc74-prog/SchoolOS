# Go-live runbook

How a school goes from "signed up" to "parents using the app", in about two weeks.
Every school gets its **own server and its own site**. The demo site is never reused.

| When | What | Who |
|---|---|---|
| Day −14 | Server + domain, install | Us (school pays for the server) |
| Day −12 | Start WhatsApp + Razorpay approvals (they take days) | School, we guide |
| Day −10 | Configure the school | Us + school office |
| Day −7 | Import students, staff, fees | Us + school office |
| Day −5 | Acceptance testing ([UAT.md](UAT.md)) | School staff |
| Day −3 | Training + message to parents | Us |
| Day −1 | Cut-over checklist | Us |
| Day 0 | Live | Everyone |
| Day +1 to +14 | Daily checks | Us |

---

## Before any school: the code must be green

Every push to GitHub runs the **Tests** workflow (Actions tab):

* **Logic + screens**: about 50 unit tests (fees, accounts, Tally files, report-card maths,
  importer, calendar, leave rules) and every screen rendered in English, Marathi, Tally mode and
  with modules off.
* **Full stack**: real MariaDB with Frappe, ERPNext, HR and Education v16. It installs SchoolOS,
  builds a demo school (30 students), runs the integration tests for every role, an HTTP test that
  logs in as principal, teacher and parent, migrates twice, and runs a backup-then-restore drill.
  The logs land on the `ci-results` branch (`LATEST.md`).

**Only install a commit whose run is green.** Note its short hash in the school's record.

## Day −14: server and domain

**Server**: in the school's name, paid by the school. Ubuntu 24.04.

| Students | Server | Approx. cost |
|---|---|---|
| up to 800 | 2 vCPU, 4 GB RAM, 80 GB SSD | ₹600–900 / month |
| 800–2,500 | 2–4 vCPU, 8 GB RAM, 100 GB SSD | ₹900–2,100 / month |

Indian data centre (Mumbai/Bangalore) for speed. Any VPS provider works: the install script
only needs root SSH.

**Domain**: a subdomain of the school's own site, e.g. `app.sunriseschool.in`. Ask whoever
manages their website to add an **A record** pointing to the server IP. Wait until
`ping app.sunriseschool.in` shows the server IP.

**Install**:

```bash
ssh root@SERVER_IP
curl -fsSLO https://raw.githubusercontent.com/pusyc74-prog/SchoolOS/main/deploy/provision.sh
curl -fsSLO https://raw.githubusercontent.com/pusyc74-prog/SchoolOS/main/deploy/backup.sh
DOMAIN=app.sunriseschool.in SCHOOL="Sunrise Public School" ABBR=SPS \
ADMIN_EMAIL=office@sunriseschool.in SCHOOLOS_REF=<green commit> bash provision.sh
```

It installs everything and sets up:

* the company with INR and a financial year from April to March
* HTTPS
* a firewall
* swap
* nightly backups
* Devanagari fonts for Marathi PDFs

Test Mode is left **on**, so no real messages go out. It ends with a health check.

Then:

* Copy `/root/schoolos-secrets.txt` (admin password, DB password, **encryption key**) into the
  school's password manager and your own. Delete it from the server.
* **Offsite backup**: run `sudo -u frappe rclone config` and create a remote named `offsite` on
  the school's Google Drive (free 15 GB). Run `sudo -u frappe SITE=<domain> schoolos-backup` once
  and confirm the files appear in Drive.
* Free uptime alert: add `https://<domain>/api/method/ping` to UptimeRobot (5-minute checks, email
  to you and the school).

## Day −12: approvals that take time

* **WhatsApp** (optional; email works without it). The school creates a Meta Business account
  with its own number and you submit the templates in [WHATSAPP.md](WHATSAPP.md). Approval takes
  1–5 days, and so does the display name.
* **Online fee payment** (optional). The school opens a Razorpay account in its own name (KYC
  takes a few days). Put the keys in **Education Settings**.
* **Email**: the school's own mailbox (Google Workspace / Zoho / cPanel). Go to Desk → Email
  Account and set it as default outgoing. Send yourself a test email.

## Day −10: configure the school

Collect these from the school office (an Excel sheet is fine):

1. **Academic year and terms**: Education → Academic Year / Academic Term.
2. **Holiday list** for the year: HR → Holiday List. Set it on the Company.
3. **Classes and subjects**: Programs (Class 1…10) and Courses (subjects). Add the syllabus
   chapters as Course Topics so the progress tracking works.
4. **Staff**: an Employee for every teacher and staff member, each with a **User** (their email)
   and the right roles:

   | Person | Roles |
   |---|---|
   | Principal | School Principal, Education Manager |
   | Teacher | Instructor, Academics User, Employee, and an Instructor record linked to the Employee |
   | Office / accounts | Accounts User (or Accounts Manager), Academics User |

   A teacher only sees and posts for the sections listed on their Student Groups (Instructors
   table).
5. **Fee structure**: Fee Categories, Fee Structure per class, and Fee Schedules for each
   instalment with due dates.
6. **Grading and report cards**: pick the CBSE 8-Point or Maharashtra 9-Point scale. Set up
   Assessment Groups (Unit Test 1, Half Yearly…) and one Report Card Template per class.
7. **SchoolOS Settings**:
   * Branding: name, logo, colour.
   * **Modules**: switch off what the school won't use.
   * Alert language (English / Marathi).
   * Fee reminder days.
   * Accounts mode: full, or Tally export. For Tally, see [ACCOUNTS.md](ACCOUNTS.md).

## Day −7: data

* **Students**: SchoolOS Student Import. Download the template, the office fills one row per
  student, then **Validate** and **Start Import**. See [IMPORT.md](IMPORT.md).

  Then check the numbers with the office: students per section, and parents without a mobile
  number. The import log lists every skipped row and why.
* **Fees already paid this year**: create the Fee Schedules, then record past payments (Payment
  Entry) so that dues match the office register. Check the total dues per class against their
  register, to the rupee.
* **Opening balances** (full accounting mode only): get them from the school's CA. Leave this out
  in Tally mode.
* **Parent logins**: a guardian logs in with the email on their Guardian record. For parents
  without email, the office sets a password and shares it. Phone-OTP login is a later phase.

Run the health check and fix every `FIX` line:

```bash
sudo -u frappe -H bash -lc "cd ~/frappe-bench && bench --site <domain> execute schoolos.setup_site.check"
```

## Day −5: acceptance testing

Give the school [UAT.md](UAT.md). The principal, two teachers, the accounts person and two
parents (on their own phones) go through it, still in **Test Mode**. Every "no" becomes a fix,
and then that line is checked again. The principal signs the last page. **Do not go live without
the signature.**

## Day −3: training and parents

* 45 minutes each for teachers (attendance, homework, lessons, leave approvals), the office
  (import, fees, reminders, Tally) and the principal (dashboards, approvals, circulars).
* Message to parents (WhatsApp broadcast from the school's number):
  * the app link `https://<domain>/school` and how to log in
  * "Add to Home Screen" steps for Android and iPhone
  * whom to call for help

## Day −1: cut-over checklist

- [ ] The installed commit is green on GitHub.
- [ ] `schoolos.setup_site.check` shows no `FIX` lines.
- [ ] No demo users or demo students exist (the check warns if they do).
- [ ] The email account sends, and a test alert reaches you: SchoolOS Settings → Send Test.
- [ ] WhatsApp templates are approved (if used). A test message arrives on your phone.
- [ ] Last night's backup exists on the server **and** in offsite Drive.
- [ ] Restore drill done once on a scratch site (below).
- [ ] UptimeRobot is green.
- [ ] UAT is signed.
- [ ] **Turn Test Mode off**: SchoolOS Settings → Alerts → untick Test Mode. From now on parents
      receive real messages.

## Day 0

* Teachers mark the first attendance by 10:00. Watch **SchoolOS Alert Log** as the absence
  alerts go out. Failed messages are retried hourly. Look at the error and fix the cause (usually
  a wrong mobile number or a template name).
* Be reachable by phone all day.

## Day +1 to +14: daily checks (10 minutes)

* **Alert Log**: any `Failed`? Error Log (Desk → Error Log): anything new?
* **Backup log**: `tail /home/frappe/backup.log` shows last night's run with "copied to offsite".
* **Disk**: `df -h` stays below 70%.
* The principal is happy with the dashboard numbers. Compare attendance and dues with their
  registers once in week 1.

## Restore drill (before go-live, then every 3 months)

```bash
cd ~/frappe-bench
bench new-site restore-test.local --admin-password x --db-root-password <DB root>
bench --site restore-test.local restore sites/<domain>/private/backups/<latest>-database.sql.gz \
  --with-public-files <...>-files.tar --with-private-files <...>-private-files.tar
bench --site restore-test.local execute frappe.db.count --args "['Student']"   # same as live?
bench drop-site restore-test.local --force
```

If the server is lost, provision a new one with the same DOMAIN and restore the latest offsite
backup. Put the old **encryption key** in the new `site_config.json`, or saved passwords
(WhatsApp, email) won't decrypt.

## Rolling back

* **A bad update**: `deploy/update.sh` takes a backup first and, if anything fails, prints the
  exact commands to put the code and data back.
* **Go-live goes badly** (rare): turn Test Mode back on. The school continues on paper for
  attendance while the problem is fixed. No data is lost, because everything entered stays in the
  system.

## Monthly maintenance (what the school's monthly fee covers)

* **Updates**: once a month, after school hours, and only with a green commit.
  `SITE=<domain> bash ~/frappe-bench/apps/schoolos/deploy/update.sh` takes a backup, pulls,
  migrates, runs the check, and prints the rollback commands if anything fails.
* **Backups**: check that nightly backups and offsite copies are there. Do a restore drill every
  quarter.
* **Health**: disk, memory, Error Log and Alert Log failures. Check for Ubuntu security updates
  (these install automatically) and reboot when needed, at night.
* **New academic year** (April/June): new Academic Year and terms, promote students to their new
  sections, new fee schedules, report card templates.
* Support for the office and the principal.
