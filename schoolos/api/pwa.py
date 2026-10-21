"""Installable web app (PWA) for each school: the dashboard installs on a phone's home screen
with the school's own name, logo and colour. No app store needed."""

import json
import mimetypes

import frappe
from werkzeug.wrappers import Response

SW = r"""
// SchoolOS service worker: offline fallback for /school. Push notifications come later.
const CACHE = "schoolos-v1";
const SHELL = ["/school", "/assets/schoolos/css/school.css", "/assets/schoolos/js/school.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // API data: network first, last good copy if offline
  if (url.pathname.startsWith("/api/method/schoolos.api.dashboard.")) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (SHELL.some((p) => url.pathname === p)) {
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
"""


def _branding():
    s = frappe.get_cached_doc("SchoolOS Settings")
    name = (s.school_display_name
            or frappe.db.get_single_value("Education Settings", "school_college_name_abbreviation")
            or "School")
    logo = s.school_logo or frappe.db.get_single_value("Education Settings", "school_college_logo")
    return name, logo, s.primary_color or "#1F3A5F"


@frappe.whitelist(allow_guest=True)
def manifest():
    name, logo, color = _branding()
    icons = []
    if logo:
        icons.append({"src": logo, "sizes": "any", "type": mimetypes.guess_type(logo)[0] or "image/png",
                      "purpose": "any"})
    icons.append({"src": "/assets/schoolos/images/logo.svg", "sizes": "any", "type": "image/svg+xml",
                  "purpose": "any"})
    data = {
        "name": name,
        "short_name": name if len(name) <= 12 else name.split()[0][:12],
        "start_url": "/school",
        "scope": "/school",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": color,
        "icons": icons,
    }
    return Response(json.dumps(data), mimetype="application/manifest+json",
                    headers={"Cache-Control": "public, max-age=3600"})


@frappe.whitelist(allow_guest=True)
def service_worker():
    return Response(SW, mimetype="application/javascript",
                    headers={"Service-Worker-Allowed": "/school", "Cache-Control": "no-cache"})
