# Running SchoolOS on your Mac

Everything runs inside Docker, so nothing is installed on the Mac itself apart from Docker.
Works on Apple Silicon (M1–M4) and Intel Macs.

## 1. Install Docker Desktop (once)

1. Download Docker Desktop for Mac from docker.com and install it.
2. Open Docker Desktop → **Settings → Resources** and give it at least **6 GB memory**
   (8 GB if your Mac has 16 GB). Apply & restart.

## 2. Get the code

```bash
cd ~
git clone https://github.com/<owner>/schoolos.git
cd schoolos
```

## 3. Start the containers

```bash
docker compose -f docker/compose.yml up -d
```

This starts MariaDB, Redis, Mailpit (a fake mailbox) and a Frappe container.

## 4. One-time setup (15–30 minutes)

```bash
docker compose -f docker/compose.yml exec frappe bash /workspace/schoolos/docker/setup.sh
```

It downloads Frappe v16, ERPNext, Frappe HR and Frappe Education, creates the site
`school.localhost`, and installs SchoolOS. Admin login: **Administrator / admin**.

## 5. Start the server

```bash
docker compose -f docker/compose.yml exec frappe bash -lc "cd ~/frappe-bench && bench start"
```

Leave this terminal open. Stop with **Ctrl+C**.

## 6. Finish the ERPNext setup wizard

Open **http://school.localhost:8000**, log in as Administrator / admin and complete the
wizard (Country: India, Currency: INR, any company name, e.g. "Demo Public School").

## 7. Load the demo school

In a **second** terminal:

```bash
cd ~/schoolos
docker compose -f docker/compose.yml exec frappe bash -lc "cd ~/frappe-bench && bench --site school.localhost execute schoolos.demo.make_demo"
```

Takes a few minutes. Then open **http://school.localhost:8000/school** and log in as:

| User | Password | Sees |
|---|---|---|
| principal@demo.school | Demo@12345 | Principal dashboard |
| teacher@demo.school | Demo@12345 | Teacher dashboard |
| parent@demo.school | Demo@12345 | Two children, report card PDF |

Use a private/incognito window to be logged in as two users at once.

## 8. Check the alerts

- **Desk → SchoolOS Alert Log**: every alert the demo generated (status "Dry Run" because
  Test Mode is on).
- Turn **Test Mode off** in **SchoolOS Settings**, mark a student absent for today
  (**Student Attendance Tool**), and the email appears in Mailpit at
  **http://localhost:8025**.
- WhatsApp needs a Meta Cloud API number first: see [WHATSAPP.md](WHATSAPP.md).

## 9. Try it on your phone

Phones on the same Wi-Fi can open `http://<your-mac-ip>:8000/school`
(find the IP in System Settings → Wi-Fi → Details). For phones outside your network,
use a free tunnel:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

It prints a temporary `https://….trycloudflare.com` link. Because Frappe picks the site by
hostname, first run once:
`docker compose -f docker/compose.yml exec frappe bash -lc "cd ~/frappe-bench && bench use school.localhost"`
(setup.sh already does this).

## Everyday use

| Task | Command (from `~/schoolos`) |
|---|---|
| Start everything | `docker compose -f docker/compose.yml up -d` then step 5 |
| Stop everything | `docker compose -f docker/compose.yml stop` |
| Shell in the container | `docker compose -f docker/compose.yml exec frappe bash` |
| After pulling new code | in the container: `cd ~/frappe-bench && bench --site school.localhost migrate` |
| Wipe and start again | `docker compose -f docker/compose.yml down -v` (deletes all data) |

Code edits you make in `~/schoolos` on the Mac show up in the container immediately.
Python changes need a restart of `bench start`; JS/CSS changes need a browser refresh.

## Troubleshooting

- **`school.localhost` doesn't open**: use `http://localhost:8000` instead (setup.sh sets
  it as the default site).
- **Setup stopped half-way**: run setup.sh again; it skips steps already done.
- **"Please set a default Holiday List"** when marking attendance: Desk → Company → set
  Default Holiday List (the demo does this for you).
- **Teacher sees "not linked to an Instructor"**: the teacher's Employee record needs
  **User ID** set, and the Instructor must link to that Employee.
