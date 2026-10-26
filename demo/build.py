"""Build the Infant Jesus School demo site (static, for Netlify) into ./site.

site/
  index.html            launcher: all apps, install help, reset demo
  parents/ teachers/ students/ principal/ office/   one installable app each
  tour/                 guided tour of every screen (the prototype with its side index)
"""

import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROTO = os.path.join(HERE, "prototype")
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from patch_host import COLOR, MONOGRAM, SCHOOL, patch  # noqa: E402
from scope_css import scope  # noqa: E402

OUT = os.environ.get("OUT") or os.path.join(HERE, "site")
VERSION = "1"

APPS = [
    {"key": "parents", "label": "Parents", "short": f"{MONOGRAM} Parents", "dev": "phone", "home": "parent",
     "blurb": "Attendance, homework, fees & online payment, progress, leave, calendar and report cards for every child.",
     "tabs": []},
    {"key": "teachers", "label": "Teachers", "short": f"{MONOGRAM} Teachers", "dev": "phone", "home": "teacher",
     "blurb": "Today's periods, attendance, marks, homework, lesson log, student notes and leave approvals.",
     "tabs": []},
    {"key": "students", "label": "Students", "short": f"{MONOGRAM} Students", "dev": "phone", "home": "student",
     "blurb": "Homework and diary, timetable, results, syllabus progress and school notices.", "tabs": []},
    {"key": "principal", "label": "Principal", "short": f"{MONOGRAM} Principal", "dev": "desktop", "home": "principal", "admin": True,
     "blurb": "The whole school at a glance: attendance, fees, accounts, syllabus, staff, approvals and circulars.",
     "tabs": []},
    {"key": "office", "label": "Office & Accounts", "short": f"{MONOGRAM} Office", "dev": "desktop", "home": "fees", "admin": True,
     "blurb": "Fees and reminders, accounts and approvals, Tally export, student import, report cards and settings.",
     "tabs": [], "extra": [("import", "Import students", "users"), ("rctemplate", "Report cards", "file"), ("circular", "Send a circular", "megaphone"),
              ("alertlog", "Messages sent", "bell"), ("modules", "Modules on / off", "layers"), ("branding", "Settings", "settings")]},
]

APP_CSS = """
/* ---- app mode: one full-screen installable app */
html, body { margin: 0; }
body.appmode { overflow: hidden; }
body.appmode .shell { display: block; min-height: 0; }
body.appmode .index, body.appmode .stagehead { display: none; }
body.appmode .stage { padding: 0; }
body.appmode .frame-wrap { display: block; }
body.appmode .appscreen { height: 100vh; height: 100dvh; border-radius: 0; padding-top: 0; background: var(--panel); }
body.app-phone .appscreen { max-width: 520px; margin: 0 auto; box-shadow: var(--shadow); }
body.app-phone.has-appnav .appscreen { height: calc(100dvh - 58px - env(safe-area-inset-bottom, 0px)); }
body.app-desktop.has-appnav .appscreen { height: calc(100dvh - 50px); }
.appnav { z-index: 80; background: var(--panel); display: flex; font: 600 13px var(--f-ui); }
.appnav[hidden] { display: none; }
.appnav button, .appnav a { border: 0; background: none; color: var(--muted); cursor: pointer; text-decoration: none; white-space: nowrap; }
.appnav button[aria-current="true"] { color: var(--accent); }
.appnav.phone { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 520px; height: calc(58px + env(safe-area-inset-bottom, 0px));
	border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom, 0px); }
.appnav.phone button { flex: 1; padding: 8px 4px; font-size: 13px; }
.appnav.phone button[aria-current="true"] { box-shadow: inset 0 3px 0 var(--accent); }
.appnav.desktop { width: 100%; max-width: none; margin: 0; border-radius: 0; box-shadow: none; position: sticky; top: 0; height: 50px; align-items: center; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--line); overflow-x: auto; }
.appnav.desktop button { padding: 8px 12px; border-radius: 8px; }
.appnav.desktop button[aria-current="true"] { background: var(--accent-soft); }
.appnav.desktop .apps { margin-left: auto; padding: 8px 12px; color: var(--muted); }
.appnav .back { color: var(--accent); }
body.app-user #desk-link { display: none !important; }
"""


def head_tags(app=None):
    base = (f'<meta name="theme-color" content="{COLOR}">\n'
            f'<meta name="apple-mobile-web-app-capable" content="yes">\n'
            f'<meta name="mobile-web-app-capable" content="yes">\n'
            f'<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n')
    if not app:
        return base
    return base + (f'<link rel="manifest" href="manifest.webmanifest">\n'
                   f'<meta name="apple-mobile-web-app-title" content="{app["short"]}">\n'
                   f'<link rel="icon" href="icon-192.png">\n'
                   f'<link rel="apple-touch-icon" href="icon-180.png">\n')


SW_REG = """<script>
(function () { var sw = navigator.serviceWorker; if (sw) window.addEventListener("load", function () { sw.register("sw.js").catch(function () {}); }); })();
</script>
"""

SW = """const CACHE = "ijs-%(key)s-v%(v)s";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ijs-%(key)s-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // network first (always the latest demo), cached copy when offline
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
"""


def build_page(shell, app_js, host_js, app=None):
    html = shell
    html = html.replace("<title>SchoolOS Prototype</title>",
                        f"<title>{SCHOOL}{' · ' + app['label'] if app else ' · Guided demo'}</title>\n"
                        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                        + head_tags(app))
    html = html.replace("Demo Public School<small>SchoolOS · working prototype</small>",
                        f"{SCHOOL}<small>Guided demo</small>")
    html = html.replace("Nothing here is saved.", "Changes are kept on this device for today.")
    cfg = ""
    if app:
        cfg = "window.SOS_APP = " + json.dumps({
            "key": app["key"], "label": app["label"], "title": f"{SCHOOL} · {app['label']}", "dev": app["dev"],
            "home": app["home"], "admin": bool(app.get("admin")),
            "tabs": [{"id": i, "label": lbl} for i, lbl in app["tabs"]],
            "extra": [{"id": i, "label": lbl, "icon": ic} for i, lbl, ic in app.get("extra", [])]}) + ";\n"
    html = html.replace("/*APP_CSS*/", scope(open(os.path.join(REPO, "schoolos", "public", "css", "school.css")).read()) + APP_CSS)
    html = html.replace("/*APP_JS*/", app_js).replace("/*HOST_JS*/", cfg + host_js)
    i = html.index('<div class="shell">')
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' + html[:i]
            + (SW_REG if app else "") + "</head>\n<body>\n" + html[i:] + "\n</body>\n</html>\n")


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    body = lambda p: open(p).read().split("<body style='max-width:800px;margin:20px auto'>", 1)[1].rsplit("</body>", 1)[0]
    consts = "".join(f"const {k} = {json.dumps(v)};\n".replace("</", "<\\/") for k, v in
                     {"RC_CBSE": body(os.path.join(PROTO, "rc_cbse.html")), "RC_MH": body(os.path.join(PROTO, "rc_mh.html"))}.items())
    consts = consts.replace("DEMO PUBLIC SCHOOL, SANGLI", SCHOOL.upper()).replace("Demo Public School, Sangli", SCHOOL)
    app_js = open(os.path.join(REPO, "schoolos", "public", "js", "school.js")).read()
    assert app_js.count("(function () {") == 1
    app_js = app_js.replace("(function () {", "window.bootSchoolOS = function () {", 1)
    app_js = app_js.rstrip()[:-len("})();")] + "};\n"
    app_js = app_js.replace("location.reload();", "window.__rebootSchoolOS && window.__rebootSchoolOS();")
    host_js = consts + patch(open(os.path.join(PROTO, "host.js")).read())
    shell = open(os.path.join(PROTO, "shell.html")).read()

    from icons import make_icons

    os.makedirs(os.path.join(OUT, "tour"))
    open(os.path.join(OUT, "tour", "index.html"), "w").write(build_page(shell, app_js, host_js))
    for app in APPS:
        d = os.path.join(OUT, app["key"])
        os.makedirs(d)
        open(os.path.join(d, "index.html"), "w").write(build_page(shell, app_js, host_js, app))
        make_icons(d, app["label"])
        open(os.path.join(d, "manifest.webmanifest"), "w").write(json.dumps({
            "name": f"{SCHOOL} · {app['label']}" if app["key"] != "parents" else SCHOOL,
            "short_name": app["short"], "description": app["blurb"], "lang": "en-IN",
            "start_url": "./", "scope": "./", "display": "standalone",
            "orientation": "portrait" if app["dev"] == "phone" else "any",
            "background_color": "#ffffff", "theme_color": COLOR,
            "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                      {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                      {"src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
        }, indent=1))
        open(os.path.join(d, "sw.js"), "w").write(SW % {"key": app["key"], "v": VERSION})
    make_icons(OUT, "")
    from launcher import launcher

    open(os.path.join(OUT, "index.html"), "w").write(launcher(APPS, SCHOOL, COLOR, head_tags()))
    open(os.path.join(OUT, "netlify.toml"), "w").write(
        '[[headers]]\n  for = "/*/sw.js"\n  [headers.values]\n    Cache-Control = "no-cache"\n\n'
        '[[headers]]\n  for = "/*/manifest.webmanifest"\n  [headers.values]\n    Content-Type = "application/manifest+json"\n')
    for root, _, files in os.walk(OUT):
        for f in files:
            p = os.path.join(root, f)
            print(f"{os.path.relpath(p, OUT):40s} {os.path.getsize(p):>8}")


if __name__ == "__main__":
    main()
