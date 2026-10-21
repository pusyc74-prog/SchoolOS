/* SchoolOS dashboard: one page, one tab per role the user has.
   Talks only to schoolos.api.* so the mobile app can reuse the same API. */
(function () {
	const app = document.getElementById("app");
	const tabs = document.getElementById("tabs");
	let ctx = null;
	let current = null;
	let uid = 0;

	// ---------- language (English / Marathi)
	const MR = {
		"Principal": "मुख्याध्यापक", "My classes": "माझे वर्ग", "My children": "माझी मुले", "My dashboard": "माझा डॅशबोर्ड",
		"Good morning": "सुप्रभात", "Good afternoon": "नमस्कार", "Good evening": "शुभ संध्या",
		"Loading…": "लोड होत आहे…", "Log out": "बाहेर पडा", "Admin": "प्रशासन", "Install app": "ॲप इंस्टॉल करा",
		"Active students": "सक्रिय विद्यार्थी", "enrolled this year": "या वर्षी प्रवेश", "present": "उपस्थित",
		"of": "पैकी", "marked present": "उपस्थित नोंद", "Attendance not marked yet": "अजून हजेरी घेतलेली नाही",
		"Absent today": "आज गैरहजर", "On leave": "रजेवर", "Not marked": "नोंद नाही",
		"Staff present": "उपस्थित कर्मचारी", "checked in": "चेक-इन", "Parent alerts today": "आज पालकांना सूचना", "failed": "अयशस्वी",
		"Exams in 14 days": "१४ दिवसांतील परीक्षा", "Attendance, last": "हजेरी, मागील", "school days": "शाळेचे दिवस", "Target": "लक्ष्य",
		"Staff today": "आज कर्मचारी", "Present": "उपस्थित", "Absent": "गैरहजर", "Half day": "अर्धा दिवस", "Work from home": "घरून काम",
		"Sections today": "आज तुकड्या", "Needs attention": "लक्ष द्या", "below": "पेक्षा कमी", "Subject averages": "विषयनिहाय सरासरी",
		"Upcoming exams": "आगामी परीक्षा", "No exams in the next 2 weeks": "पुढील २ आठवड्यांत परीक्षा नाही", "in": "", "days": "दिवस", "Tomorrow": "उद्या", "Today": "आज",
		"Circulars": "परिपत्रके", "New circular": "नवीन परिपत्रक", "No circulars yet": "अजून परिपत्रके नाहीत",
		"Attendance is in for": "हजेरी घेतलेल्या तुकड्या:", "sections": "तुकड्या", "still to mark": "बाकी",
		"Periods today": "आजचे तास", "Attendance to mark": "हजेरी घ्यायची आहे", "Marks pending": "गुण बाकी",
		"Now teaching": "आता शिकवत आहात", "Up next": "पुढील तास", "No more periods today": "आज आणखी तास नाहीत", "ends in": "संपायला", "starts in": "सुरू होण्यास", "min": "मि.",
		"Today's timetable": "आजचे वेळापत्रक", "No classes scheduled today": "आज तास नाहीत", "No classes today": "आज तास नाहीत",
		"My classes today": "आज माझे वर्ग", "Take attendance": "हजेरी घ्या", "Enter marks": "गुण भरा", "Marks to enter": "भरायचे गुण",
		"Post homework or a note": "गृहपाठ किंवा सूचना द्या", "My recent posts": "मी अलीकडे दिलेले", "my classes": "माझे वर्ग",
		"Section": "तुकडी", "Subject": "विषय", "Type": "प्रकार", "Title": "शीर्षक", "Details (optional)": "तपशील (ऐच्छिक)",
		"Due date": "मुदत तारीख", "Also send on WhatsApp": "व्हॉट्सॲपवरही पाठवा", "Post and notify parents": "पाठवा व पालकांना कळवा",
		"Posted": "पाठवले", "students notified": "विद्यार्थ्यांच्या पालकांना कळवले", "Any subject": "कोणताही विषय",
		"Homework": "गृहपाठ", "Classwork": "वर्गकार्य", "Project": "प्रकल्प", "Note": "सूचना", "Homework & diary": "गृहपाठ व दैनंदिनी",
		"No homework posted": "गृहपाठ दिलेला नाही", "Due": "मुदत", "Due today": "आज मुदत", "Overdue": "मुदत संपली", "Homework due": "मुदत असलेला गृहपाठ",
		"Attendance": "हजेरी", "Attendance, last 30 days": "हजेरी, मागील ३० दिवस", "Leave": "रजा", "Results": "निकाल", "Latest result": "नवीनतम निकाल",
		"Report card": "प्रगतीपत्रक", "Details": "तपशील", "Back": "मागे", "Class": "वर्ग", "Strength": "पटसंख्या", "Student": "विद्यार्थी",
		"was absent today.": "आज गैरहजर होते.", "All present today.": "आज सर्व उपस्थित.", "No attendance yet today.": "आज अजून हजेरी नाही.",
		"Nothing to show": "दाखवण्यासारखे काही नाही", "No data yet": "अजून माहिती नाही", "Not enough attendance days yet": "अजून पुरेसे हजेरीचे दिवस नाहीत",
		"Something went wrong": "काहीतरी चुकले", "You're offline. Showing the last saved data.": "इंटरनेट नाही. शेवटची जतन केलेली माहिती दाखवत आहे.",
		"No children linked to your account yet. Please contact the school office.": "तुमच्या खात्याशी अजून मुले जोडलेली नाहीत. कृपया शाळेच्या कार्यालयाशी संपर्क साधा.",
		"Your account isn't linked to a student, guardian or teacher record yet. Please contact the school office.": "तुमचे खाते अजून विद्यार्थी, पालक किंवा शिक्षक नोंदीशी जोडलेले नाही. कृपया शाळेच्या कार्यालयाशी संपर्क साधा.",
	};
	let lang = "en";
	try {
		lang = localStorage.getItem("schoolos:lang") || ((navigator.language || "").startsWith("mr") ? "mr" : "en");
	} catch (e) {}
	const t = (s) => (lang === "mr" && MR[s] !== undefined ? MR[s] : s);
	const loc = () => (lang === "mr" ? "mr-IN" : "en-IN");

	// ---------- utils
	const esc = (v) =>
		String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10}%`);
	const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(loc()));
	const tone = (p, threshold = 75) => (p === null || p === undefined ? "" : p >= 90 ? "good" : p >= threshold ? "warn" : "bad");
	const toneColor = (p, th) => ({ good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" })[tone(p, th)] || "var(--faint)";
	const pill = (p, threshold) => `<span class="pill ${tone(p, threshold)}">${pct(p)}</span>`;
	const day = (d) => new Date(String(d).slice(0, 10) + "T00:00:00");
	const fmtDate = (d) => (d ? day(d).toLocaleDateString(loc(), { day: "numeric", month: "short" }) : "");
	const fmtTime = (tm) => (tm ? String(tm).slice(0, 5).replace(/^(\d):/, "0$1:") : "");
	const mins = (tm) => { const [h, m] = String(tm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
	const nowMins = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
	const stripHtml = (h) => { const d = document.createElement("div"); d.innerHTML = h || ""; return (d.textContent || "").trim(); };
	const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
	const daysUntil = (d) => Math.round((day(d) - day(todayISO())) / 86400000);
	const greeting = () => { const h = new Date().getHours(); return t(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"); };
	const firstName = (n) => String(n || "").split(/\s+/)[0];
	const longDate = () => new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" });

	// subject / person colour: a stable hue per name
	const HUES = [212, 152, 28, 268, 350, 190, 48, 320];
	const hue = (s) => { let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0; return HUES[h % HUES.length]; };
	const subj = (name) => (name ? `<span class="subj" style="--h:${hue(name)}">${esc(name)}</span>` : "");
	const initial = (name, size) => `<span class="initial" style="--h:${hue(name)};${size ? `width:${size}px;height:${size}px` : ""}">${esc(String(name || "?").trim()[0] || "?")}</span>`;

	function errorMessage(data, r) {
		let msg = data.exception || data.exc_type || r.statusText;
		try {
			const m = JSON.parse(data._server_messages || "[]")[0];
			if (m) msg = JSON.parse(m).message || msg;
		} catch (e) {}
		return stripHtml(msg);
	}
	const path = (method) => `/api/method/${method.includes(".") ? method : "schoolos.api.dashboard." + method}`;
	async function call(method, args = {}) {
		const qs = new URLSearchParams(Object.entries(args).filter(([, v]) => v !== undefined && v !== null));
		const r = await fetch(`${path(method)}?${qs}`, { headers: { Accept: "application/json" }, credentials: "same-origin" });
		const data = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(errorMessage(data, r));
		return data.message;
	}
	async function post(method, args = {}) {
		const r = await fetch(path(method), {
			method: "POST", credentials: "same-origin",
			headers: { Accept: "application/json", "Content-Type": "application/json", "X-Frappe-CSRF-Token": (window.frappe && window.frappe.csrf_token) || "" },
			body: JSON.stringify(args),
		});
		const data = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(errorMessage(data, r));
		return data.message;
	}

	// ---------- building blocks
	const card = (title, body, { sub = "", cls = "" } = {}) =>
		`<section class="card ${cls}"><h3><span>${esc(title)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</h3>${body}</section>`;
	const empty = (text) => `<div class="empty">${esc(t(text))}</div>`;
	const tile = (label, value, note = "", extra = "") =>
		`<div class="tile"><div class="label">${esc(t(label))}</div><div class="row"><div class="value">${value}</div>${extra}</div><div class="note">${note}</div></div>`;
	const chip = (label, value, alert) => `<span class="chip ${alert ? "alert" : ""}"><b>${value}</b> ${esc(t(label))}</span>`;

	function gauge(p, caption) {
		const v = Math.max(0, Math.min(100, p || 0));
		const L = Math.PI * 90;
		const tick = (q) => {
			const a = Math.PI * (1 - q / 100);
			const x1 = 100 + 80 * Math.cos(a), y1 = 100 - 80 * Math.sin(a), x2 = 100 + 98 * Math.cos(a), y2 = 100 - 98 * Math.sin(a);
			return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>`;
		};
		return `<div class="gauge" role="img" aria-label="${esc(pct(p))}">
			<svg viewBox="0 0 200 108"><path d="M10 100 A90 90 0 0 1 190 100" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="16" stroke-linecap="round"/>
			<path d="M10 100 A90 90 0 0 1 190 100" fill="none" stroke="#f3a63a" stroke-width="16" stroke-linecap="round" stroke-dasharray="${((v / 100) * L).toFixed(1)} ${L.toFixed(1)}"/>
			${tick(75)}${tick(90)}</svg>
			<div class="big">${p === null || p === undefined ? "–" : pct(p)}</div><div class="cap">${caption}</div></div>`;
	}

	function ring(p, size = 64, stroke = 8, color) {
		const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p || 0));
		return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
			<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${color || toneColor(p, 75)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/></svg>
			<span class="val" style="font-size:${Math.max(12, size / 4.6)}px">${p === null || p === undefined ? "–" : Math.round(p) + "%"}</span></div>`;
	}

	function donut(segments, size = 120) {
		const total = segments.reduce((a, s) => a + (s.value || 0), 0) || 1;
		const r = size / 2 - 12, c = 2 * Math.PI * r;
		let off = 0;
		const arcs = segments.filter((s) => s.value).map((s) => {
			const len = (s.value / total) * c;
			const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke:${s.color}" stroke-width="18" stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`;
			off += len;
			return el;
		}).join("");
		return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="18"/>${arcs}</svg>
			<span class="val" style="font-size:22px">${Math.round(((segments[0].value || 0) / total) * 100)}%</span></div>`;
	}

	function spark(values) {
		if (!values || values.length < 2) return "";
		const W = 120, H = 30, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
		const pts = values.map((v, i) => [(i * W) / (values.length - 1), H - 3 - ((v - lo) / span) * (H - 6)]);
		const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
		return `<svg class="spark-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="f" d="${d} L${W},${H} L0,${H} Z"/><path class="l" d="${d}"/></svg>`;
	}

	function area(points, target) {
		if (!points || points.length < 2) return empty("Not enough attendance days yet");
		const id = `ag${++uid}`;
		const W = 640, H = 190, L = 34, R = 46, T = 12, B = 24;
		const ys = points.map((p) => p.percentage ?? 0);
		const lo = Math.max(0, Math.min(Math.floor((Math.min(...ys) - 4) / 5) * 5, (target || 100) - 10));
		const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
		const y = (v) => T + (1 - (v - lo) / (100 - lo || 1)) * (H - T - B);
		const d = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
		const ticks = [lo, Math.round((lo + 100) / 2), 100];
		const last = ys[ys.length - 1];
		const xl = [0, Math.floor((points.length - 1) / 2), points.length - 1];
		return `<div class="area"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("Attendance"))}">
			<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>
			${ticks.map((v) => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join("")}
			${target ? `<line class="threshold" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/><text x="${W - R + 4}" y="${y(target) + 4}">${esc(t("Target"))}</text>` : ""}
			<path d="${d} L${x(points.length - 1)},${H - B} L${L},${H - B} Z" fill="url(#${id})"/>
			<path class="line" d="${d}"/>
			<circle class="end" cx="${x(points.length - 1)}" cy="${y(last)}" r="6"/>
			<text class="end-label" x="${x(points.length - 1) - 8}" y="${y(last) - 12}" text-anchor="end">${pct(last)}</text>
			${xl.map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}">${fmtDate(points[i].date)}</text>`).join("")}
		</svg></div>`;
	}

	function bars(rows, nameKey, valKey, { colorBy = "tone", max = 100, suffix = "%" } = {}) {
		if (!rows || !rows.length) return empty("No data yet");
		return `<div class="bars">${rows.map((r) => {
			const v = Number(r[valKey]) || 0;
			const col = colorBy === "subject" ? `hsl(${hue(r[nameKey])} 60% 48%)` : toneColor(v, 60);
			return `<div class="row"><span class="name" title="${esc(r[nameKey])}">${colorBy === "subject" ? subj(r[nameKey]) : esc(r[nameKey])}</span>
				<span class="track"><span class="fill" style="width:${Math.max(2, Math.min(100, (v / max) * 100))}%;background:${col}"></span></span>
				<span class="val">${Math.round(v * 10) / 10}${suffix}</span></div>`;
		}).join("")}</div>`;
	}

	function heat(groups) {
		if (!groups || !groups.length) return empty("Nothing to show");
		const sorted = [...groups].sort((a, b) => a.student_group.localeCompare(b.student_group, undefined, { numeric: true }));
		const cls = (g) => (!g.marked ? "un" : g.percentage >= 95 ? "h4" : g.percentage >= 90 ? "h3" : g.percentage >= 80 ? "h2" : "h1");
		return `<div class="heat">${sorted.map((g) => `<div class="cell ${cls(g)}" title="${esc(g.student_group)}">
			<span class="n">${esc(g.student_group.replace(/\s*\(.*\)$/, ""))}</span>
			<span class="p">${g.marked ? pct(g.percentage) : "—"}</span>
			<span class="s">${g.marked ? `${num(g.absent)} ${esc(t("Absent").toLowerCase())}` : esc(t("Not marked"))}</span></div>`).join("")}</div>
			<div class="legend"><span><i style="background:var(--good)"></i>95%+</span><span><i style="background:var(--good-bg)"></i>90–95%</span><span><i style="background:var(--warn-bg)"></i>80–90%</span><span><i style="background:var(--bad-bg)"></i>&lt;80%</span><span><i style="background:var(--soft);outline:1px dashed var(--faint)"></i>${esc(t("Not marked"))}</span></div>`;
	}

	function calendar(daysList) {
		if (!daysList || !daysList.length) return empty("Not enough attendance days yet");
		const today = todayISO();
		return `<div class="cal">${daysList.map((d) => `<span class="${esc(d.status)} ${d.date === today ? "today" : ""}" title="${fmtDate(d.date)}: ${esc(t(d.status))}"></span>`).join("")}</div>
			<div class="legend"><span><i style="background:var(--good)"></i>${t("Present")}</span><span><i style="background:var(--bad)"></i>${t("Absent")}</span><span><i style="background:var(--marigold)"></i>${t("Leave")}</span></div>`;
	}

	function timeline(schedule) {
		if (!schedule || !schedule.length) return empty("No classes scheduled today");
		const n = nowMins();
		return `<ol class="timeline">${schedule.map((s) => {
			const st = n > mins(s.to_time) ? "done" : n >= mins(s.from_time) ? "now" : "";
			return `<li class="${st}"><span class="t">${fmtTime(s.from_time)}</span><span class="dot"></span><div class="body"><b>${esc(s.course)}</b>
				<span class="meta">${esc((s.student_group || s.instructor_name || "").replace(/\s*\(.*\)$/, ""))}${s.room ? " · " + esc(s.room) : ""} · ${fmtTime(s.from_time)}–${fmtTime(s.to_time)}</span></div></li>`;
		}).join("")}</ol>`;
	}

	function homeworkList(list, showGroup) {
		if (!list || !list.length) return empty("No homework posted");
		return `<ul class="list">${list.map((h) => {
			const due = h.due_date
				? `<span class="pill ${h.overdue ? "bad" : h.due_today ? "warn" : "good"}">${esc(h.overdue ? t("Overdue") : h.due_today ? t("Due today") : t("Due") + " " + fmtDate(h.due_date))}</span>` : "";
			const body = stripHtml(h.details);
			return `<li><div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${subj(h.course)}<span class="tag">${esc(t(h.entry_type || "Homework"))}</span></div>
				<div style="margin-top:3px"><b>${esc(h.title)}</b></div>
				<div class="meta">${showGroup ? esc((h.student_group || "").replace(/\s*\(.*\)$/, "")) + " · " : ""}${esc(h.instructor_name || "")} · ${fmtDate(h.date)}</div>
				${body ? `<div class="circular-body">${esc(body.slice(0, 200))}</div>` : ""}
				${h.attachment ? `<div><a href="${esc(h.attachment)}" target="_blank" rel="noopener">Attachment</a></div>` : ""}</div>
				<div style="text-align:right;flex:none">${due}${h.recipients_count ? `<div class="meta">${num(h.recipients_count)} ✓</div>` : ""}</div></li>`;
		}).join("")}</ul>`;
	}

	function circulars(list) {
		if (!list || !list.length) return empty("No circulars yet");
		return `<ul class="list">${list.map((c) => `<li><div style="min-width:0"><b>${esc(c.title)}</b><div class="circular-body">${esc(stripHtml(c.message).slice(0, 160))}</div></div>
			<span class="meta" style="flex:none">${fmtDate(c.publish_date)}</span></li>`).join("")}</ul>`;
	}

	function people(list, threshold) {
		if (!list || !list.length) return empty("Nothing to show");
		return `<ul class="list">${list.map((r) => `<li><div class="person">${initial(r.student_name)}<div style="min-width:0"><b>${esc(r.student_name)}</b>
			<div class="meta">${num(r.absent)} ${esc(t("Absent").toLowerCase())} · ${num(r.days)} ${esc(t("days"))}</div></div></div>
			<div style="display:grid;justify-items:end;gap:4px">${pill(r.percentage, threshold)}<span class="mini"><i style="width:${r.percentage}%;background:${toneColor(r.percentage, threshold)}"></i></span></div></li>`).join("")}</ul>`;
	}

	const hero = (left, right = "") => `<section class="hero"><div class="hero-in"><div>${left}</div>${right ? `<div>${right}</div>` : ""}</div></section>`;
	const reportButtons = (cards) => (cards || []).map((c) =>
		`<a class="btn" href="/api/method/schoolos.api.report_card.download?name=${encodeURIComponent(c.name)}">${esc(t("Report card"))}: ${esc(c.template)}${c.overall_grade ? ` · <b>${esc(c.overall_grade)}</b>` : ""}</a>`).join("");

	// ---------- views
	async function principalView() {
		const d = await call("principal");
		const a = d.attendance_today, th = d.window.threshold, staff = d.staff_today;
		const groups = d.groups_today || [];
		const marked = groups.filter((g) => g.marked).length;
		const sent = (d.alerts_today["Sent"] || 0) + (d.alerts_today["Dry Run"] || 0);
		const staffIn = staff ? (staff.present || 0) + (staff.work_from_home || 0) + (staff.half_day || 0) : 0;
		const staffPct = staff && staff.active_staff ? (staffIn / staff.active_staff) * 100 : null;
		const trendVals = d.trend.map((p) => p.percentage);
		const next = d.upcoming_exams[0];
		return `
		${hero(`<div class="eyebrow">${esc(longDate())}${d.academic_term ? " · " + esc(d.academic_term) : ""}</div>
			<h1>${esc(greeting())}, ${esc(firstName(ctx.full_name))}</h1>
			<p>${esc(t("Attendance is in for"))} ${num(marked)} ${esc(t("of"))} ${num(groups.length)} ${esc(t("sections"))}${groups.length - marked ? `, ${num(groups.length - marked)} ${esc(t("still to mark"))}` : ""}.</p>
			<div class="chips">${chip("Absent today", num(a.absent))}${chip("On leave", num(a.leave))}${chip("Not marked", num(d.groups_unmarked.length), d.groups_unmarked.length)}</div>`,
			gauge(a.total ? a.percentage : null, a.total ? `${num(a.present)} ${esc(t("of"))} ${num(a.total)} ${esc(t("marked present"))}` : esc(t("Attendance not marked yet"))))}
		<div class="wrap lift">
			<div class="tiles">
				${tile("Active students", num(d.students.active), d.students.enrolled_this_year ? `${num(d.students.enrolled_this_year)} ${esc(t("enrolled this year"))}` : "", `<div style="flex:1;min-width:60px">${spark(trendVals)}</div>`)}
				${staff ? tile("Staff present", num(staffIn), `${num(staff.checked_in)} ${esc(t("checked in"))} · ${num(staff.active_staff)}`, ring(staffPct, 46, 6)) : tile("Staff present", "–")}
				${tile("Parent alerts today", num(sent), d.alerts_today["Failed"] ? `<span style="color:var(--bad)">${num(d.alerts_today["Failed"])} ${esc(t("failed"))}</span>` : "&nbsp;")}
				${tile("Exams in 14 days", num(d.upcoming_exams.length), next ? esc(next.assessment_name || next.course) : "&nbsp;")}
			</div>
			<div class="grid">
				${card(`${t("Attendance, last")} ${d.trend.length} ${t("school days")}`, area(d.trend, 90), { cls: "span2", sub: `${fmtDate(d.window.start)} – ${fmtDate(d.window.end)}` })}
				${card(t("Staff today"), staff ? `<div class="donut-row">${donut([
					{ value: staffIn, color: "var(--good)" }, { value: staff.on_leave, color: "var(--marigold)" }, { value: staff.absent, color: "var(--bad)" }])}
					<div class="donut-key"><div><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--good);margin-right:6px"></i>${t("Present")}</span><b>${num(staffIn)}</b></div>
					<div><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--marigold);margin-right:6px"></i>${t("On leave")}</span><b>${num(staff.on_leave)}</b></div>
					<div><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--bad);margin-right:6px"></i>${t("Absent")}</span><b>${num(staff.absent)}</b></div>
					<div class="meta"><span>${t("checked in")}</span><b>${num(staff.checked_in)}</b></div></div></div>` : empty("No data yet"))}
				${card(t("Sections today"), heat(groups), { cls: "span2", sub: `${num(marked)}/${num(groups.length)}` })}
				${card(t("Needs attention"), people(d.low_attendance, th), { sub: `${t("below")} ${th}%` })}
				${card(t("Subject averages"), bars(d.subject_performance, "course", "average", { colorBy: "subject" }), { sub: d.academic_term || "" })}
				${card(t("Upcoming exams"), d.upcoming_exams.length ? `<ul class="list">${d.upcoming_exams.map((e) => {
					const n = daysUntil(e.schedule_date);
					return `<li><div style="min-width:0"><b>${esc(e.assessment_name || e.course)}</b><div class="meta">${esc((e.student_group || "").replace(/\s*\(.*\)$/, ""))} · ${fmtDate(e.schedule_date)} ${fmtTime(e.from_time)}</div></div>
						<span class="pill ${n <= 2 ? "warn" : "good"}">${n <= 0 ? esc(t("Today")) : n === 1 ? esc(t("Tomorrow")) : `${esc(t("in"))} ${n} ${esc(t("days"))}`}</span></li>`;
				}).join("")}</ul>` : empty("No exams in the next 2 weeks"))}
				${card(t("Circulars"), circulars(d.circulars) + `<div class="actions"><a class="btn primary" href="/desk/schoolos-circular/new">${esc(t("New circular"))}</a></div>`)}
			</div>
		</div>`;
	}

	async function teacherView() {
		const [d, opts] = await Promise.all([call("teacher"), call("schoolos.api.homework.post_options").catch(() => null)]);
		const th = d.window.threshold;
		const unmarked = d.groups_today.filter((g) => !g.marked);
		const n = nowMins();
		const nowP = d.schedule.find((s) => n >= mins(s.from_time) && n <= mins(s.to_time));
		const nextP = d.schedule.find((s) => mins(s.from_time) > n);
		let nowCard;
		if (nowP) {
			const done = ((n - mins(nowP.from_time)) / Math.max(1, mins(nowP.to_time) - mins(nowP.from_time))) * 100;
			nowCard = `<div class="now-card"><div class="k">${esc(t("Now teaching"))}</div><b>${esc(nowP.course)}</b><div>${esc(nowP.student_group.replace(/\s*\(.*\)$/, ""))}${nowP.room ? " · " + esc(nowP.room) : ""}</div>
				<div class="prog"><i style="width:${done.toFixed(0)}%"></i></div><div class="meta" style="color:inherit;opacity:.85;margin-top:6px">${esc(t("ends in"))} ${mins(nowP.to_time) - n} ${esc(t("min"))}</div></div>`;
		} else if (nextP) {
			nowCard = `<div class="now-card"><div class="k">${esc(t("Up next"))}</div><b>${esc(nextP.course)}</b><div>${esc(nextP.student_group.replace(/\s*\(.*\)$/, ""))} · ${fmtTime(nextP.from_time)}</div>
				<div class="meta" style="color:inherit;opacity:.85;margin-top:6px">${esc(t("starts in"))} ${mins(nextP.from_time) - n} ${esc(t("min"))}</div></div>`;
		} else {
			nowCard = `<div class="now-card"><div class="k">${esc(t("Today's timetable"))}</div><b>${esc(t("No more periods today"))}</b></div>`;
		}
		return `
		${hero(`<div class="eyebrow">${esc(longDate())}</div><h1>${esc(greeting())}, ${esc(firstName(d.instructor_name))}</h1>
			<p>${num(d.schedule.length)} ${esc(t("Periods today").toLowerCase())}${unmarked.length ? ` · ${num(unmarked.length)} ${esc(t("Attendance to mark").toLowerCase())}` : ""}</p>
			<div class="chips">${chip("Absent today", num(d.absent_today.length))}${chip("Marks pending", num(d.pending_marks.length), d.pending_marks.length)}${chip("Attendance to mark", num(unmarked.length), unmarked.length)}</div>`, nowCard)}
		<div class="wrap lift">
			<div class="tiles">
				${tile("Periods today", num(d.schedule.length), d.schedule[0] ? `${fmtTime(d.schedule[0].from_time)} – ${fmtTime(d.schedule[d.schedule.length - 1].to_time)}` : "&nbsp;")}
				${tile("Attendance to mark", num(unmarked.length), unmarked.map((g) => esc(g.student_group.replace(/\s*\(.*\)$/, ""))).join(", ") || "&nbsp;")}
				${tile("Absent today", num(d.absent_today.length), d.absent_today.slice(0, 2).map((s) => esc(firstName(s.student_name))).join(", ") || "&nbsp;")}
				${tile("Marks pending", num(d.pending_marks.length), "&nbsp;", "")}
			</div>
			<div class="grid">
				${card(t("Today's timetable"), timeline(d.schedule))}
				${card(t("My classes today"), `<ul class="list">${d.groups_today.map((g) => `<li><div class="person">${ring(g.marked ? g.percentage : null, 44, 5)}<div><b>${esc(g.student_group.replace(/\s*\(.*\)$/, ""))}</b>
					<div class="meta">${num(g.strength)} ${esc(t("Student").toLowerCase())}${g.marked ? ` · ${num(g.absent || 0)} ${esc(t("Absent").toLowerCase())}` : ""}</div></div></div>
					${g.marked ? `<span class="pill good">✓</span>` : `<a class="btn primary" href="/desk/student-attendance-tool">${esc(t("Take attendance"))}</a>`}</li>`).join("")}</ul>`, { cls: "span2" })}
				${opts && opts.groups.length ? card(t("Post homework or a note"), homeworkForm(opts), { cls: "span2" }) : ""}
				${card(t("My recent posts"), homeworkList(d.recent_posts || [], true))}
				${card(t("Marks to enter"), d.pending_marks.length ? `<ul class="list">${d.pending_marks.map((p) => {
					const done = p.strength ? (p.entered / p.strength) * 100 : 0;
					return `<li><div style="min-width:0;flex:1"><b>${esc(p.assessment_name || p.course)}</b><div class="meta">${esc(p.student_group.replace(/\s*\(.*\)$/, ""))} · ${num(p.entered)}/${num(p.strength)}</div>
						<div class="bars" style="margin-top:6px"><div class="track"><div class="fill" style="width:${done}%;background:var(--brand)"></div></div></div></div></li>`;
				}).join("")}</ul><div class="actions"><a class="btn" href="/desk/assessment-result-tool">${esc(t("Enter marks"))}</a></div>` : empty("Nothing to show"))}
				${card(t("Needs attention"), people(d.low_attendance, th), { sub: `${t("below")} ${th}%` })}
				${card(`${t("Attendance, last")} ${d.trend.length} ${t("school days")}`, area(d.trend, 90), { sub: t("my classes") })}
			</div>
		</div>`;
	}

	function homeworkForm(opts) {
		const g0 = opts.groups[0];
		const courseOptions = (g) => [`<option value="">${t("Any subject")}</option>`].concat((opts.courses[g] || []).map((c) => `<option>${esc(c)}</option>`)).join("");
		window.__schoolosCourses = opts.courses;
		return `<form id="hw-form" class="form">
			<div class="row2"><label>${t("Section")}<select name="student_group" required>${opts.groups.map((g) => `<option value="${esc(g)}">${esc(g.replace(/\s*\(.*\)$/, ""))}</option>`).join("")}</select></label>
			<label>${t("Subject")}<select name="course">${courseOptions(g0)}</select></label></div>
			<div class="row2"><label>${t("Type")}<select name="entry_type">${opts.types.map((x) => `<option value="${esc(x)}">${esc(t(x))}</option>`).join("")}</select></label>
			<label>${t("Due date")}<input type="date" name="due_date" min="${todayISO()}"></label></div>
			<label>${t("Title")}<input name="title" required maxlength="140" placeholder="e.g. Exercise 4.2, Q1–10"></label>
			<label>${t("Details (optional)")}<textarea name="details" rows="2"></textarea></label>
			${opts.whatsapp_allowed ? `<label class="check"><input type="checkbox" name="send_whatsapp" value="1"> ${t("Also send on WhatsApp")}</label>` : ""}
			<div class="actions" style="margin-top:0;align-items:center"><button class="btn primary" type="submit">${t("Post and notify parents")}</button><span class="form-msg" aria-live="polite"></span></div>
		</form>`;
	}

	async function studentView(studentId, back) {
		const d = await call("student", studentId ? { student: studentId } : {});
		const a = d.attendance;
		const due = (d.homework || []).filter((h) => h.due_date && !h.overdue);
		const title = studentId ? esc(d.student.student_name) : `${esc(greeting())}, ${esc(firstName(d.student.student_name))}`;
		const results = (d.results || []).map((r) => ({ ...r, label: r.course }));
		return `
		${hero(`${back ? `<button class="linkbtn" style="margin:0 0 10px" data-back="${back}">← ${esc(t("Back"))}</button>` : ""}
			<div class="eyebrow">${esc(longDate())}</div><h1>${title}</h1>
			<p>${d.enrollment ? `${esc(d.enrollment.program)} · ${esc(d.enrollment.academic_year)}` : ""}</p>
			<div class="chips">${chip("Homework due", num(due.length), due.some((h) => h.due_today))}${chip("Absent", num(a.absent), a.absent)}</div>
			${(d.report_cards || []).length ? `<div class="actions">${reportButtons(d.report_cards)}</div>` : ""}`,
			gauge(a.percentage, `${t("Attendance")} · ${num(a.present)} ${esc(t("of"))} ${num(a.working_days)} ${esc(t("days"))}`))}
		<div class="wrap lift">
			<div class="grid">
				${card(t("Homework & diary"), homeworkList(d.homework), { cls: "span2" })}
				${card(t("Today's timetable"), timeline(d.today_schedule))}
				${card(t("Results"), `<div class="bars">${results.map((r) => `<div class="row"><span class="name">${subj(r.course)}</span>
					<span class="track"><span class="fill" style="width:${r.percentage || 0}%;background:hsl(${hue(r.course)} 60% 48%)"></span></span>
					<span class="val">${esc(r.grade || pct(r.percentage))}</span></div>`).join("") || empty("No data yet")}</div>`, { cls: "span2", sub: (d.results[0] || {}).assessment_group || "" })}
				${card(t("Attendance, last 30 days"), calendar(d.calendar), { sub: pct(a.percentage) })}
				${card(t("Circulars"), circulars(d.circulars), { cls: "span3" })}
			</div>
		</div>`;
	}

	async function parentView() {
		const d = await call("parent");
		if (!d.children.length) return `<div class="wrap">${empty("No children linked to your account yet. Please contact the school office.")}</div>`;
		const absentToday = d.children.filter((c) => (c.absent_recently || []).includes(todayISO()));
		const summary = absentToday.length ? `${absentToday.map((c) => firstName(c.student_name)).join(", ")} ${t("was absent today.")}` : t("All present today.");
		const kids = d.children.map((c) => `<section class="card">
			<div class="kid-head">${initial(c.student_name)}<div style="min-width:0;flex:1"><h3 style="margin:0">${esc(c.student_name)}</h3>
				<div class="meta">${c.enrollment ? esc(c.enrollment.program) : ""}${c.latest_result ? ` · ${esc(t("Latest result"))}: ${esc(c.latest_result.course)} ${num(c.latest_result.total_score)}/${num(c.latest_result.maximum_score)}` : ""}</div></div>
				<button class="btn" data-student="${esc(c.student)}">${esc(t("Details"))} →</button></div>
			<div class="kid-stats">${ring(c.attendance.percentage, 86, 9)}<div style="min-width:0"><div class="meta" style="margin-bottom:6px">${esc(t("Attendance, last 30 days"))} · ${num(c.attendance.present)}/${num(c.attendance.working_days)}</div>${calendar(c.calendar)}</div></div>
			${(c.homework_due || []).length ? `<div class="due">${c.homework_due.map((h) => `<div><span style="min-width:0;display:flex;gap:8px;align-items:center">${subj(h.course)}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.title)}</span></span>
				<span class="pill ${h.due_today ? "warn" : "good"}" style="flex:none">${esc(h.due_today ? t("Due today") : fmtDate(h.due_date))}</span></div>`).join("")}</div>` : ""}
			${(c.report_cards || []).length ? `<div class="actions">${reportButtons(c.report_cards)}</div>` : ""}
		</section>`).join("");
		return `
		${hero(`<div class="eyebrow">${esc(longDate())}</div><h1>${esc(greeting())}, ${esc(firstName(ctx.full_name))}</h1><p>${esc(summary)}</p>
			<div class="avatars">${d.children.map((c) => initial(c.student_name)).join("")}</div>`)}
		<div class="wrap lift">
			<div class="grid" style="margin-top:0;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))">${kids}</div>
			<div class="grid">${card(t("Circulars"), circulars(d.circulars), { cls: "span3" })}</div>
		</div>`;
	}

	// ---------- shell
	const VIEWS = {
		principal: { label: "Principal", render: principalView },
		teacher: { label: "My classes", render: teacherView },
		parent: { label: "My children", render: parentView },
		student: { label: "My dashboard", render: () => studentView() },
	};

	async function show(view, arg) {
		current = { view, arg };
		[...tabs.children].forEach((b) => b.dataset.view && b.setAttribute("aria-selected", String(b.dataset.view === view)));
		app.innerHTML = `<div class="loading">${t("Loading…")}</div>`;
		try {
			app.innerHTML = arg ? await studentView(arg, view) : await VIEWS[view].render();
			if (!navigator.onLine) app.insertAdjacentHTML("afterbegin", `<div class="offline">${t("You're offline. Showing the last saved data.")}</div>`);
		} catch (e) {
			app.innerHTML = `<div class="error">${esc(e.message || t("Something went wrong"))}</div>`;
		}
		try { localStorage.setItem("schoolos:view", view); } catch (e) {}
	}

	app.addEventListener("click", (e) => {
		const s = e.target.closest("[data-student]");
		if (s) return show("parent", s.dataset.student);
		const b = e.target.closest("[data-back]");
		if (b) return show(b.dataset.back);
	});

	app.addEventListener("change", (e) => {
		if (e.target.name === "student_group" && e.target.form && e.target.form.id === "hw-form") {
			const sel = e.target.form.querySelector('select[name="course"]');
			const list = (window.__schoolosCourses || {})[e.target.value] || [];
			sel.innerHTML = [`<option value="">${t("Any subject")}</option>`].concat(list.map((c) => `<option>${esc(c)}</option>`)).join("");
		}
	});

	app.addEventListener("submit", async (e) => {
		if (e.target.id !== "hw-form") return;
		e.preventDefault();
		const f = e.target;
		const msg = f.querySelector(".form-msg");
		const btn = f.querySelector('button[type="submit"]');
		const v = Object.fromEntries(new FormData(f).entries());
		v.send_whatsapp = v.send_whatsapp ? 1 : 0;
		btn.disabled = true;
		msg.textContent = "…";
		try {
			const r = await post("schoolos.api.homework.post", v);
			msg.textContent = `${t("Posted")} · ${r.students} ${t("students notified")}`;
			setTimeout(() => show(current.view), 900);
		} catch (err) {
			msg.textContent = err.message;
			btn.disabled = false;
		}
	});

	// ---------- install as app (PWA)
	let installEvent = null;
	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		installEvent = e;
		const b = document.getElementById("install-btn");
		if (b) b.classList.remove("hidden");
	});
	if ("serviceWorker" in navigator && navigator.serviceWorker) {
		navigator.serviceWorker.register("/api/method/schoolos.api.pwa.service_worker", { scope: "/school" }).catch(() => {});
	}

	function topbarControls() {
		const user = document.querySelector(".topbar .user");
		user.insertAdjacentHTML("afterbegin",
			`<button id="install-btn" class="linkbtn hidden">${t("Install app")}</button>
			 <button id="lang-btn" class="linkbtn" title="Language">${lang === "mr" ? "EN" : "मराठी"}</button>`);
		document.getElementById("lang-btn").onclick = () => {
			lang = lang === "mr" ? "en" : "mr";
			try { localStorage.setItem("schoolos:lang", lang); } catch (e) {}
			location.reload();
		};
		document.getElementById("install-btn").onclick = async () => {
			if (!installEvent) return;
			installEvent.prompt();
			await installEvent.userChoice;
			installEvent = null;
			document.getElementById("install-btn").classList.add("hidden");
		};
		const lo = document.querySelector('.topbar a[href="/logout"]');
		if (lo) lo.textContent = t("Log out");
		const dl = document.getElementById("desk-link");
		if (dl) dl.textContent = t("Admin");
	}

	async function init() {
		topbarControls();
		try {
			ctx = await call("get_context");
		} catch (e) {
			app.innerHTML = `<div class="error">${esc(e.message)}</div>`;
			return;
		}
		document.getElementById("user-name").textContent = ctx.full_name || ctx.user;
		const staff = ctx.roles.some((r) => !["Guardian", "Student"].includes(r));
		if (staff) document.getElementById("desk-link").classList.remove("hidden");
		if (!ctx.views.length) {
			app.innerHTML = `<div class="wrap">${empty("Your account isn't linked to a student, guardian or teacher record yet. Please contact the school office.")}</div>`;
			return;
		}
		tabs.innerHTML = ctx.views.map((v) => `<button class="tab" role="tab" data-view="${v}">${esc(t(VIEWS[v].label))}</button>`).join("");
		tabs.addEventListener("click", (e) => {
			const b = e.target.closest("[data-view]");
			if (b) show(b.dataset.view);
		});
		if (ctx.views.length < 2) tabs.classList.add("hidden");
		let start = ctx.views[0];
		try {
			const saved = localStorage.getItem("schoolos:view");
			if (saved && ctx.views.includes(saved)) start = saved;
		} catch (e) {}
		show(start);
	}
	init();
})();
