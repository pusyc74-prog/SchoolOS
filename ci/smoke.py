"""HTTP smoke test against a running site, the way a browser or phone would use it.

    python ci/smoke.py http://school.localhost:8000

Logs in as each demo user, opens /school, calls every read endpoint and checks the access walls.
Exit code 1 if anything fails. Needs only the Python standard library + requests.
"""

import sys
from datetime import date

import requests

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
HOST = sys.argv[2] if len(sys.argv) > 2 else None  # Host header when BASE is an IP
PASSWORD = "Demo@12345"
failures = []


def session(user=None):
    s = requests.Session()
    if HOST:
        s.headers["Host"] = HOST
    if user:
        r = s.post(f"{BASE}/api/method/login", data={"usr": user, "pwd": PASSWORD}, timeout=60)
        check(r.status_code == 200, f"login {user}", r)
    return s


def check(ok, label, resp=None):
    print(("PASS " if ok else "FAIL ") + label + ("" if ok or resp is None else f"  [{resp.status_code}] {resp.text[:300]}"))
    if not ok:
        failures.append(label)


def call(s, method, expect=200, http="GET", **params):
    url = f"{BASE}/api/method/schoolos.api.{method}"
    r = s.post(url, data=params, timeout=120) if http == "POST" else s.get(url, params=params, timeout=120)
    check(r.status_code == expect, f"{http} {method} -> {expect}", r)
    try:
        return r.json().get("message")
    except Exception:
        return r


today = date.today()

# ---------------------------------------------------------------- guest
g = session()
r = g.get(f"{BASE}/api/method/schoolos.api.pwa.manifest", timeout=60)
check(r.status_code == 200 and "start_url" in r.text, "guest: app manifest", r)
r = g.get(f"{BASE}/api/method/schoolos.api.pwa.service_worker", timeout=60)
check(r.status_code == 200 and "fetch" in r.text, "guest: service worker", r)
call(g, "dashboard.parent", expect=403)
call(g, "fees.summary", expect=403)
r = g.get(f"{BASE}/school", timeout=60, allow_redirects=False)
check(r.status_code in (200, 301, 302, 303), "guest: /school answers (login prompt)", r)

# ---------------------------------------------------------------- principal
p = session("principal@demo.school")
r = p.get(f"{BASE}/school", timeout=60)
check(r.status_code == 200 and "school.js" in r.text, "principal: /school page", r)
for asset in ("/assets/schoolos/js/school.js", "/assets/schoolos/css/school.css"):
    r = p.get(BASE + asset, timeout=60)
    check(r.status_code == 200 and len(r.content) > 1000, f"asset {asset}", r)
ctx = call(p, "dashboard.get_context")
check(isinstance(ctx, dict) and "principal" in ctx.get("views", []), "principal: sees principal view")
for m in ("dashboard.principal", "fees.summary", "accounts.summary", "learning.syllabus_overview", "leave.pending",
          "school_calendar.albums", "homework.post_options", "learning.lesson_options"):
    call(p, m)
call(p, "school_calendar.month", year=today.year, month=today.month)
fy_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1).isoformat()
call(p, "accounts.tally_preview", from_date=fy_start, to_date=today.isoformat())
r = p.get(f"{BASE}/api/method/schoolos.api.accounts.tally_export",
          params={"from_date": fy_start, "to_date": today.isoformat(), "part": "masters"}, timeout=120)
check(r.status_code == 200 and b"<ENVELOPE>" in r.content, "principal: Tally masters download", r)
r = p.get(f"{BASE}/api/method/schoolos.api.homework.post", params={"student_group": "x", "title": "x"}, timeout=60)
check(r.status_code in (403, 405), "POST-only endpoint refuses GET", r)

# ---------------------------------------------------------------- teacher
t = session("teacher@demo.school")
ctx = call(t, "dashboard.get_context")
check(isinstance(ctx, dict) and "teacher" in ctx.get("views", []) and "principal" not in ctx.get("views", []),
      "teacher: sees only teacher views")
call(t, "dashboard.teacher")
call(t, "leave.pending")
call(t, "dashboard.principal", expect=403)
call(t, "fees.summary", expect=403)
call(t, "accounts.summary", expect=403)

# ---------------------------------------------------------------- parent
pa = session("parent@demo.school")
ctx = call(pa, "dashboard.get_context")
check(isinstance(ctx, dict) and "parent" in ctx.get("views", []), "parent: sees parent view")
d = call(pa, "dashboard.parent")
kids = [c["student"] for c in (d or {}).get("children", [])]
check(len(kids) == 2, "parent: two children")
for kid in kids[:1]:
    call(pa, "dashboard.student", student=kid)
    fees = call(pa, "fees.for_student", student=kid)
    call(pa, "learning.student_progress", student=kid)
    call(pa, "learning.activity", student=kid)
    call(pa, "homework.for_student", student=kid)
    call(pa, "leave.for_student", student=kid)
    call(pa, "school_calendar.month", year=today.year, month=today.month, student=kid)
    for c in (d.get("children") or []):
        for rc in c.get("report_cards") or []:
            r = pa.get(f"{BASE}/api/method/schoolos.api.report_card.download", params={"name": rc["name"]}, timeout=120)
            check(r.status_code == 200 and r.content[:4] == b"%PDF", "parent: report card PDF", r)
            break
    paid = [i for i in (fees or {}).get("invoices", []) if i["outstanding"] < i["total"]]
    if paid:
        r = pa.get(f"{BASE}/api/method/schoolos.api.fees.receipt", params={"invoice": paid[0]["invoice"]}, timeout=120)
        check(r.status_code == 200 and r.content[:4] == b"%PDF", "parent: fee receipt PDF", r)
call(pa, "dashboard.principal", expect=403)
call(pa, "fees.summary", expect=403)
call(pa, "accounts.summary", expect=403)
call(pa, "dashboard.teacher", expect=403)
others = [s for s in (call(p, "learning.group_students", student_group="Class 5 - A") or []) if s["student"] not in kids]
if others:
    call(pa, "dashboard.student", expect=403, student=others[0]["student"])
    call(pa, "fees.for_student", expect=403, student=others[0]["student"])

print(f"\n{len(failures)} failure(s)")
sys.exit(1 if failures else 0)
