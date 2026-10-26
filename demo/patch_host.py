"""Turn the prototype host into the Infant Jesus School demo host:
branding, state saved across apps on the same device, absences from the attendance tool
reaching the parent app, and an 'app mode' (one full-screen installable app per role)."""

import os
import sys

SCHOOL = os.environ.get("SCHOOL", "Infant Jesus School")
COLOR = os.environ.get("COLOR", "#1E3A78")
MONOGRAM = os.environ.get("MONOGRAM") or "".join(w[0] for w in SCHOOL.split() if w[:1].isalpha())[:3].upper()


def patch(src):
    def R(old, new, count=1):
        nonlocal src
        assert src.count(old) >= 1, f"anchor not found: {old[:70]!r}"
        src = src.replace(old, new, count)

    # ---- branding
    R('brand: { name: "Demo Public School", color: "#1F3A5F", address: "Vishrambag, Sangli, Maharashtra" }',
      f'brand: {{ name: "{SCHOOL}", color: "{COLOR}", address: "" }}')

    # ---- absences: whoever the teacher marks absent today shows as absent in the parent app
    R('const absent = i === 0 ? [T, iso(addDays(TODAY, -9))] : [];',
      'const ta = S.todayAbsent || [STUDENTS[0].id];\n'
      '\t\tconst absent = [...(ta.includes(s.id) ? [T] : []), ...(i === 0 ? [iso(addDays(TODAY, -9))] : [])];')
    R('\t\t\t\tS.attMarked = true;\n',
      '\t\t\t\tS.attMarked = true;\n\t\t\t\tS.todayAbsent = absent.map((x) => x.id);\n')

    # ---- the school's icon in the app header (instead of generated initials)
    R("\tconst logo = () => `data:image/svg+xml,",
      "\tconst logo = () => APP ? \"icon-192.png\" : `data:image/svg+xml,")
    # ---- full-screen frame in app mode
    R('\tfunction frame(kind, url) {\n\t\tconst f = $("#frame");\n',
      '\tfunction frame(kind, url) {\n\t\tconst f = $("#frame");\n'
      '\t\tif (APP) { f.innerHTML = `<div class="screen appscreen" id="screen" style="--brand-shell:${S.brand.color}"></div>`; return $("#screen"); }\n')
    R('\t\t$("#screen").scrollTop = 0;\n\t}\n',
      '\t\t$("#screen").scrollTop = 0;\n\t\tif (APP) renderAppNav();\n\t}\n')

    # ---- links inside the app
    R('\t\t\telse if (href === "/desk") go("branding");\n\t\t\telse if (href === "/logout") toast("Logs out and returns to the login page");',
      '\t\t\telse if (href === "/desk") (!APP || APP.admin) ? go("branding") : toast("The school office manages this");\n'
      '\t\t\telse if (href === "/logout") APP ? (location.href = "../") : toast("Logs out and returns to the login page");')

    # ---- app mode, saved state, boot
    R('\t// ------------------------------------------------------------------ boot\n'
      '\tconst start = (location.hash || "").replace("#", "");\n'
      '\tgo(ALL.some((s) => s.id === start) ? start : "parent");\n',
      BOOT)
    R('\t// ------------------------------------------------------------------ helpers\n',
      '\t// ------------------------------------------------------------------ helpers\n'
      '\tconst APP = window.SOS_APP || null;\n')
    # save after every server call
    R('\t\t\tconst message = route(p, args);\n',
      '\t\t\tconst message = route(p, args);\n\t\t\tsaveSoon();\n')
    return src


BOOT = r'''
	// ------------------------------------------------------------------ demo state, shared by all apps on this device
	const SAVE_KEY = "ijs-demo-state";
	function snapshot() {
		return { day: T, HW, LEAVES, LESSONS, NOTES, FEES, s: { alerts: S.alerts, approvals: S.approvals, modules: S.modules,
			settings: S.settings, brand: S.brand, reminded: S.reminded, remindedCount: S.remindedCount, paidToday: S.paidToday,
			chosenMode: S.chosenMode, attMarked: S.attMarked, todayAbsent: S.todayAbsent, rcPublished: S.rcPublished } };
	}
	let lastSaved = "";
	function saveState() {
		try { const v = JSON.stringify(snapshot()); if (v !== lastSaved) { localStorage.setItem(SAVE_KEY, v); lastSaved = v; } } catch (e) {}
	}
	let saveTimer;
	function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 80); }
	function fill(target, data) {
		if (Array.isArray(target)) { target.splice(0, target.length, ...(data || [])); return; }
		Object.keys(target).forEach((k) => delete target[k]);
		Object.assign(target, data || {});
	}
	function loadState() {
		try {
			const raw = localStorage.getItem(SAVE_KEY);
			const d = raw && JSON.parse(raw);
			if (!d || d.day !== T) return false;   // a new day starts a fresh demo
			fill(HW, d.HW); fill(LEAVES, d.LEAVES); fill(LESSONS, d.LESSONS); fill(NOTES, d.NOTES); fill(FEES, d.FEES);
			Object.assign(S, d.s);
			lastSaved = raw;
			return true;
		} catch (e) { return false; }
	}
	document.addEventListener("click", () => saveSoon(), true);
	document.addEventListener("change", () => saveSoon(), true);
	window.addEventListener("pagehide", saveState);
	window.addEventListener("storage", (e) => {
		if (e.key !== SAVE_KEY) return;
		if (e.newValue === null) { location.reload(); return; }
		const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
		if (loadState() && S.current && !typing && !document.querySelector(".rzp")) go(S.current.id);
	});
	window.__resetDemo = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); };

	// ------------------------------------------------------------------ one app per role (installable)
	function renderAppNav() {
		let n = $("#appnav");
		if (!n) { n = document.createElement("nav"); n.id = "appnav"; n.setAttribute("aria-label", APP.label);
			APP.dev === "desktop" ? document.body.prepend(n) : document.body.appendChild(n); }
		const tabs = APP.tabs || [];
		const inTabs = tabs.some((t) => t.id === S.current.id) || S.current.id === APP.home;
		let html = tabs.length > 1 ? tabs.map((t) => `<button type="button" data-go="${t.id}" aria-current="${t.id === S.current.id}">${t.label}</button>`).join("") : "";
		if (!inTabs) html = `<button type="button" class="back" data-go="${APP.home}">‹ Back</button>` + html;
		if (APP.dev === "desktop" && html) html += `<a class="apps" href="../">All apps</a>`;
		n.className = `appnav ${APP.dev}`;
		n.innerHTML = html;
		n.hidden = !html;
		document.body.classList.toggle("has-appnav", !!html);
	}

	// ------------------------------------------------------------------ boot
	loadState();
	const start = (location.hash || "").replace("#", "");
	if (APP) {
		if (APP.key === "office") Object.assign(CONTEXT.principal, { full_name: "Meena Joshi", user: "accounts@school" });
		if (APP.extra && APP.extra.length) { window.__schoolosExtraMenu = APP.extra; window.__schoolosExtraGo = (id) => go(id); }
		document.body.classList.add("appmode", "app-" + APP.dev, APP.admin ? "app-admin" : "app-user");
		document.title = APP.title;
		go(ALL.some((s) => s.id === start) && start !== "home" ? start : APP.home);
	} else {
		go(ALL.some((s) => s.id === start) ? start : "parent");
	}
	saveSoon();
'''

if __name__ == "__main__":
    src = open(sys.argv[1]).read()
    open(sys.argv[2], "w").write(patch(src))
