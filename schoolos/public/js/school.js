/* SchoolOS dashboard: one page, one tab per role the user has.
   Talks only to schoolos.api.* so the mobile app can reuse the same API. */
(function () {
	const app = document.getElementById("app");
	const tabs = document.getElementById("tabs");
	let ctx = null;
	let current = null;

	// ---------- language (English / Marathi)
	const MR = {
		"Principal": "मुख्याध्यापक", "My classes": "माझे वर्ग", "My children": "माझी मुले", "My dashboard": "माझा डॅशबोर्ड",
		"Today": "आज", "Loading…": "लोड होत आहे…", "Log out": "बाहेर पडा", "Admin": "प्रशासन",
		"Active students": "सक्रिय विद्यार्थी", "enrolled this year": "या वर्षी प्रवेश", "Present today": "आज उपस्थित",
		"of": "पैकी", "marked": "नोंद", "Attendance not marked yet": "अजून हजेरी घेतलेली नाही",
		"Absent today": "आज गैरहजर", "on leave": "रजेवर", "Classes not marked": "हजेरी न घेतलेले वर्ग",
		"Staff present": "उपस्थित कर्मचारी", "checked in": "चेक-इन", "staff": "कर्मचारी",
		"Parent alerts today": "आज पालकांना सूचना", "failed": "अयशस्वी",
		"Attendance trend": "हजेरीचा कल", "school days": "शाळेचे दिवस", "last": "मागील",
		"Classes today": "आजचे वर्ग", "Class": "वर्ग", "Strength": "पटसंख्या", "Absent": "गैरहजर", "Present": "उपस्थित",
		"Not marked": "नोंद नाही", "Students below": "खालील विद्यार्थी", "attendance": "हजेरी",
		"Subject averages": "विषयनिहाय सरासरी", "this year": "हे वर्ष", "Upcoming exams": "आगामी परीक्षा",
		"next 14 days": "पुढील १४ दिवस", "No exams in the next 2 weeks": "पुढील २ आठवड्यांत परीक्षा नाही",
		"Recent circulars": "अलीकडील परिपत्रके", "New circular": "नवीन परिपत्रक", "Circulars": "परिपत्रके",
		"No circulars yet": "अजून परिपत्रके नाहीत", "Student": "विद्यार्थी", "Days": "दिवस", "Attendance": "हजेरी",
		"Classes today ": "आजचे तास", "Attendance to mark": "हजेरी घ्यायची आहे", "Absent in my classes": "माझ्या वर्गात गैरहजर",
		"Marks pending": "गुण बाकी", "assessments with missing results": "निकाल बाकी असलेल्या परीक्षा",
		"Today's timetable": "आजचे वेळापत्रक", "No classes scheduled today": "आज तास नाहीत", "No classes today": "आज तास नाहीत",
		"My classes today": "आज माझे वर्ग", "Mark attendance": "हजेरी घ्या", "Marks to enter": "भरायचे गुण",
		"Assessment": "परीक्षा", "Entered": "भरलेले", "Enter marks": "गुण भरा", "Needs attention": "लक्ष द्या",
		"below": "पेक्षा कमी", "my classes": "माझे वर्ग", "days": "दिवस", "Report card": "प्रगतीपत्रक",
		"Recent results": "अलीकडील निकाल", "Subject": "विषय", "Exam": "परीक्षा", "Marks": "गुण", "Grade": "श्रेणी",
		"Latest": "नवीनतम", "Details": "तपशील", "Back": "मागे", "Homework": "गृहपाठ", "Classwork": "वर्गकार्य",
		"Project": "प्रकल्प", "Note": "सूचना", "Homework & diary": "गृहपाठ व दैनंदिनी", "No homework posted": "गृहपाठ दिलेला नाही",
		"Due": "मुदत", "Due today": "आज मुदत", "Overdue": "मुदत संपली", "Post homework / note": "गृहपाठ / सूचना द्या",
		"Section": "तुकडी", "Type": "प्रकार", "Title": "शीर्षक", "Details (optional)": "तपशील (ऐच्छिक)",
		"Due date": "मुदत तारीख", "Also send on WhatsApp": "व्हॉट्सॲपवरही पाठवा", "Post and notify parents": "पाठवा व पालकांना कळवा",
		"Posted": "पाठवले", "students notified": "विद्यार्थ्यांच्या पालकांना कळवले", "My recent posts": "मी अलीकडे दिलेले",
		"Install app": "ॲप इंस्टॉल करा", "Something went wrong": "काहीतरी चुकले", "Nothing to show": "दाखवण्यासारखे काही नाही",
		"No data yet": "अजून माहिती नाही", "Not enough attendance days yet": "अजून पुरेसे हजेरीचे दिवस नाहीत",
		"Any subject": "कोणताही विषय", "Homework due": "मुदत असलेला गृहपाठ",
		"No children linked to your account yet. Please contact the school office.": "तुमच्या खात्याशी अजून मुले जोडलेली नाहीत. कृपया शाळेच्या कार्यालयाशी संपर्क साधा.",
		"Your account isn't linked to a student, guardian or teacher record yet. Please contact the school office.": "तुमचे खाते अजून विद्यार्थी, पालक किंवा शिक्षक नोंदीशी जोडलेले नाही. कृपया शाळेच्या कार्यालयाशी संपर्क साधा.",
		"You're offline. Showing the last saved data.": "इंटरनेट नाही. शेवटची जतन केलेली माहिती दाखवत आहे.",
	};
	let lang = "en";
	try {
		lang = localStorage.getItem("schoolos:lang") || ((navigator.language || "").startsWith("mr") ? "mr" : "en");
	} catch (e) {}
	const t = (s) => (lang === "mr" && MR[s]) || s;

	// ---------- utils
	const esc = (v) =>
		String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10}%`);
	const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(lang === "mr" ? "mr-IN" : "en-IN"));
	const tone = (p, threshold = 75) => (p === null || p === undefined ? "" : p >= 90 ? "good" : p >= threshold ? "warn" : "bad");
	const pill = (p, threshold) => `<span class="pill ${tone(p, threshold)}">${pct(p)}</span>`;
	const fmtDate = (d) => {
		if (!d) return "";
		const x = new Date(String(d).slice(0, 10) + "T00:00:00");
		return x.toLocaleDateString(lang === "mr" ? "mr-IN" : "en-IN", { day: "numeric", month: "short" });
	};
	const fmtTime = (tm) => (tm ? String(tm).slice(0, 5).replace(/^(\d):/, "0$1:") : "");
	const stripHtml = (h) => {
		const d = document.createElement("div");
		d.innerHTML = h || "";
		return (d.textContent || "").trim();
	};
	const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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
			method: "POST",
			credentials: "same-origin",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"X-Frappe-CSRF-Token": (window.frappe && window.frappe.csrf_token) || "",
			},
			body: JSON.stringify(args),
		});
		const data = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(errorMessage(data, r));
		return data.message;
	}

	const kpi = (label, value, note = "") =>
		`<div class="kpi"><div class="label">${esc(t(label))}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;

	const card = (title, body, sub = "") =>
		`<section class="card"><h3>${esc(title)} ${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</h3>${body}</section>`;

	const empty = (text) => `<div class="empty">${esc(t(text))}</div>`;

	function bars(rows, nameKey, valKey, max = 100, suffix = "%") {
		if (!rows || !rows.length) return empty("No data yet");
		return `<div class="bars">${rows
			.map((r) => {
				const v = Number(r[valKey]) || 0;
				const w = Math.max(0, Math.min(100, (v / max) * 100));
				return `<div class="row"><span class="name" title="${esc(r[nameKey])}">${esc(r[nameKey])}</span>
					<span class="track"><span class="fill" style="width:${w}%"></span></span>
					<span class="val">${Math.round(v * 10) / 10}${suffix}</span></div>`;
			})
			.join("")}</div>`;
	}

	function trend(points) {
		if (!points || points.length < 2) return empty("Not enough attendance days yet");
		const W = 600, H = 150, P = 26;
		const ys = points.map((p) => p.percentage ?? 0);
		const lo = Math.max(0, Math.floor(Math.min(...ys) / 10) * 10 - 10);
		const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
		const y = (v) => H - P - ((v - lo) / (100 - lo || 1)) * (H - 2 * P);
		const d = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
		const dots = ys.map((v, i) => `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="2.5"><title>${fmtDate(points[i].date)}: ${pct(v)}</title></circle>`).join("");
		const first = points[0].date, last = points[points.length - 1].date;
		return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t("Attendance trend"))}">
			<line class="axis" x1="${P}" y1="${y(100)}" x2="${W - P}" y2="${y(100)}"/>
			<line class="axis" x1="${P}" y1="${y(lo)}" x2="${W - P}" y2="${y(lo)}"/>
			<text x="2" y="${y(100) + 4}">100%</text><text x="2" y="${y(lo) + 4}">${lo}%</text>
			<path class="line" d="${d}"/>${dots}
			<text x="${P}" y="${H - 4}">${fmtDate(first)}</text><text x="${W - P}" y="${H - 4}" text-anchor="end">${fmtDate(last)}</text>
		</svg></div>`;
	}

	function table(cols, rows) {
		if (!rows || !rows.length) return empty("Nothing to show");
		return `<div class="scroll"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? "num" : ""}">${esc(t(c.label))}</th>`).join("")}</tr></thead>
			<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.html ? c.html(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
	}

	function circulars(list) {
		if (!list || !list.length) return empty("No circulars yet");
		return `<ul class="list">${list
			.map((c) => `<li><div><div><b>${esc(c.title)}</b></div><div class="circular-body">${esc(stripHtml(c.message).slice(0, 140))}</div></div>
				<span class="meta">${fmtDate(c.publish_date)}</span></li>`)
			.join("")}</ul>`;
	}

	function homeworkList(list, showGroup) {
		if (!list || !list.length) return empty("No homework posted");
		return `<ul class="list">${list
			.map((h) => {
				const due = h.due_date
					? `<span class="pill ${h.overdue ? "bad" : h.due_today ? "warn" : "good"}">${esc(h.overdue ? t("Overdue") : h.due_today ? t("Due today") : t("Due") + " " + fmtDate(h.due_date))}</span>`
					: "";
				const body = stripHtml(h.details);
				return `<li><div>
					<div><span class="tag">${esc(t(h.entry_type || "Homework"))}</span> <b>${esc(h.title)}</b></div>
					<div class="meta">${esc(h.course || "")}${showGroup ? " · " + esc(h.student_group) : ""}${h.instructor_name ? " · " + esc(h.instructor_name) : ""}</div>
					${body ? `<div class="circular-body">${esc(body.slice(0, 200))}</div>` : ""}
					${h.attachment ? `<div><a href="${esc(h.attachment)}" target="_blank" rel="noopener">📎</a></div>` : ""}
				</div><div style="text-align:right"><div class="meta">${fmtDate(h.date)}</div>${due}${h.recipients_count ? `<div class="meta">${num(h.recipients_count)} ✓</div>` : ""}</div></li>`;
			})
			.join("")}</ul>`;
	}

	function lowAttendance(list, threshold) {
		return table(
			[
				{ label: "Student", key: "student_name" },
				{ label: "Days", key: "days", num: true },
				{ label: "Absent", key: "absent", num: true },
				{ label: "Attendance", num: true, html: (r) => pill(r.percentage, threshold) },
			],
			list
		);
	}

	// ---------- views
	async function principalView() {
		const d = await call("principal");
		const a = d.attendance_today, th = d.window.threshold;
		const staff = d.staff_today;
		const sent = (d.alerts_today["Sent"] || 0) + (d.alerts_today["Dry Run"] || 0);
		return `
		<h2>${t("Today")} <span class="sub">${fmtDate(d.date)}${d.academic_term ? " · " + esc(d.academic_term) : ""}</span></h2>
		<div class="kpis">
			${kpi("Active students", num(d.students.active), d.students.enrolled_this_year ? `${num(d.students.enrolled_this_year)} ${t("enrolled this year")}` : "")}
			${kpi("Present today", a.total ? pct(a.percentage) : "–", a.total ? `${num(a.present)} ${t("of")} ${num(a.total)} ${t("marked")}` : t("Attendance not marked yet"))}
			${kpi("Absent today", num(a.absent), a.leave ? `${num(a.leave)} ${t("on leave")}` : "")}
			${kpi("Classes not marked", num(d.groups_unmarked.length), d.groups_unmarked.slice(0, 3).map(esc).join(", "))}
			${staff ? kpi("Staff present", num((staff.present || 0) + (staff.work_from_home || 0) + (staff.half_day || 0)), `${num(staff.checked_in)} ${t("checked in")} · ${num(staff.active_staff)} ${t("staff")}`) : ""}
			${kpi("Parent alerts today", num(sent), d.alerts_today["Failed"] ? `<span style="color:var(--bad)">${num(d.alerts_today["Failed"])} ${t("failed")}</span>` : "")}
		</div>
		<div class="grid">
			${card(t("Attendance trend"), trend(d.trend), `${t("last")} ${d.trend.length} ${t("school days")}`)}
			${card(t("Classes today"), table([
				{ label: "Class", key: "student_group" },
				{ label: "Strength", key: "strength", num: true },
				{ label: "Absent", num: true, html: (r) => (r.marked ? num(r.absent) : "–") },
				{ label: "Present", num: true, html: (r) => (r.marked ? pill(r.percentage, th) : `<span class="pill warn">${t("Not marked")}</span>`) },
			], d.groups_today))}
			${card(`${t("Students below")} ${th}% ${t("attendance")}`, lowAttendance(d.low_attendance, th), `${fmtDate(d.window.start)} – ${fmtDate(d.window.end)}`)}
			${card(t("Subject averages"), bars(d.subject_performance, "course", "average"), d.academic_term ? d.academic_term : t("this year"))}
			${card(t("Upcoming exams"), d.upcoming_exams.length ? `<ul class="list">${d.upcoming_exams.map((e) => `<li><div><b>${esc(e.assessment_name || e.course)}</b><div class="meta">${esc(e.student_group)}</div></div><span class="meta">${fmtDate(e.schedule_date)} ${fmtTime(e.from_time)}</span></li>`).join("")}</ul>` : empty("No exams in the next 2 weeks"), t("next 14 days"))}
			${card(t("Recent circulars"), circulars(d.circulars) + `<p><a class="btn" href="/desk/schoolos-circular/new">${t("New circular")}</a></p>`)}
		</div>`;
	}

	async function teacherView() {
		const [d, opts] = await Promise.all([call("teacher"), call("schoolos.api.homework.post_options").catch(() => null)]);
		const th = d.window.threshold;
		const unmarked = d.groups_today.filter((g) => !g.marked);
		return `
		<h2>${esc(d.instructor_name)} <span class="sub">${fmtDate(d.date)}</span></h2>
		<div class="kpis">
			${kpi("Classes today ", num(d.schedule.length))}
			${kpi("Attendance to mark", num(unmarked.length), unmarked.map((g) => esc(g.student_group)).join(", "))}
			${kpi("Absent in my classes", num(d.absent_today.length))}
			${kpi("Marks pending", num(d.pending_marks.length), t("assessments with missing results"))}
		</div>
		<div class="grid">
			${card(t("Today's timetable"), d.schedule.length ? `<ul class="list">${d.schedule.map((s) => `<li class="${s.now ? "now" : ""}"><div><b>${esc(s.course)}</b><div class="meta">${esc(s.student_group)}${s.room ? " · " + esc(s.room) : ""}</div></div><span class="meta">${fmtTime(s.from_time)}–${fmtTime(s.to_time)}</span></li>`).join("")}</ul>` : empty("No classes scheduled today"))}
			${opts && opts.groups.length ? card(t("Post homework / note"), homeworkForm(opts)) : ""}
			${card(t("My classes today"), table([
				{ label: "Class", key: "student_group" },
				{ label: "Strength", key: "strength", num: true },
				{ label: "Present", num: true, html: (r) => (r.marked ? pill(r.percentage, th) : `<span class="pill warn">${t("Not marked")}</span>`) },
			], d.groups_today) + `<p><a class="btn" href="/desk/student-attendance-tool">${t("Mark attendance")}</a></p>`)}
			${card(t("Absent today"), table([{ label: "Student", key: "student_name" }, { label: "Class", key: "student_group" }], d.absent_today))}
			${card(t("Marks to enter"), table([
				{ label: "Assessment", html: (r) => esc(r.assessment_name || r.course) },
				{ label: "Class", key: "student_group" },
				{ label: "Entered", num: true, html: (r) => `${num(r.entered)}/${num(r.strength)}` },
			], d.pending_marks) + `<p><a class="btn" href="/desk/assessment-result-tool">${t("Enter marks")}</a></p>`)}
			${card(t("My recent posts"), homeworkList(d.recent_posts || [], true))}
			${card(t("Attendance trend"), trend(d.trend), t("my classes"))}
			${card(t("Needs attention"), lowAttendance(d.low_attendance, th), `${t("below")} ${th}%`)}
		</div>`;
	}

	function homeworkForm(opts) {
		const g0 = opts.groups[0];
		const courseOptions = (g) => [`<option value="">${t("Any subject")}</option>`]
			.concat((opts.courses[g] || []).map((c) => `<option>${esc(c)}</option>`)).join("");
		window.__schoolosCourses = opts.courses;
		return `<form id="hw-form" class="form">
			<label>${t("Section")}<select name="student_group" required>${opts.groups.map((g) => `<option>${esc(g)}</option>`).join("")}</select></label>
			<div class="row2">
				<label>${t("Subject")}<select name="course">${courseOptions(g0)}</select></label>
				<label>${t("Type")}<select name="entry_type">${opts.types.map((x) => `<option value="${esc(x)}">${esc(t(x))}</option>`).join("")}</select></label>
			</div>
			<label>${t("Title")}<input name="title" required maxlength="140" placeholder="e.g. Exercise 4.2, Q1–10"></label>
			<label>${t("Details (optional)")}<textarea name="details" rows="3"></textarea></label>
			<label>${t("Due date")}<input type="date" name="due_date" min="${todayISO()}"></label>
			${opts.whatsapp_allowed ? `<label class="check"><input type="checkbox" name="send_whatsapp" value="1"> ${t("Also send on WhatsApp")}</label>` : ""}
			<button class="btn primary" type="submit">${t("Post and notify parents")}</button>
			<div class="form-msg" aria-live="polite"></div>
		</form>`;
	}

	function studentBlock(s, compact) {
		const a = s.attendance;
		const cards = (s.report_cards || [])
			.map((c) => `<a class="btn" href="/api/method/schoolos.api.report_card.download?name=${encodeURIComponent(c.name)}">${t("Report card")}: ${esc(c.template)}${c.overall_grade ? " (" + esc(c.overall_grade) + ")" : ""}</a>`)
			.join(" ");
		const due = (s.homework_due || [])
			.map((h) => `<div class="meta">📘 ${esc(h.course ? h.course + ": " : "")}${esc(h.title)} · ${t("Due")} ${fmtDate(h.due_date)}</div>`)
			.join("");
		return `
		<div class="kpis">
			${kpi("Attendance", pct(a.percentage), `${num(a.present)} ${t("of")} ${num(a.working_days)} ${t("days")}`)}
			${kpi("Absent", num(a.absent), (s.recent_absences || s.absent_recently || []).map(fmtDate).join(", "))}
			${!compact && s.enrollment ? kpi("Class", esc(s.enrollment.program), esc(s.enrollment.academic_year)) : ""}
		</div>
		${compact && due ? `<div style="margin-top:10px"><b>${t("Homework due")}</b>${due}</div>` : ""}
		${cards ? `<p class="toolbar">${cards}</p>` : ""}`;
	}

	async function studentView(studentId) {
		const d = await call("student", studentId ? { student: studentId } : {});
		return `
		<h2>${esc(d.student.student_name)} <span class="sub">${fmtDate(d.window.start)} – ${fmtDate(d.window.end)}</span></h2>
		${studentBlock(d)}
		<div class="grid">
			${card(t("Homework & diary"), homeworkList(d.homework))}
			${card(t("Today's timetable"), d.today_schedule.length ? `<ul class="list">${d.today_schedule.map((s) => `<li><div><b>${esc(s.course)}</b><div class="meta">${esc(s.instructor_name || "")}${s.room ? " · " + esc(s.room) : ""}</div></div><span class="meta">${fmtTime(s.from_time)}–${fmtTime(s.to_time)}</span></li>`).join("")}</ul>` : empty("No classes today"))}
			${card(t("Recent results"), table([
				{ label: "Subject", key: "course" },
				{ label: "Exam", html: (r) => esc(r.assessment_name || r.assessment_group) },
				{ label: "Marks", num: true, html: (r) => `${num(r.total_score)}/${num(r.maximum_score)}` },
				{ label: "Grade", num: true, html: (r) => `<span class="pill ${tone(r.percentage, 33)}">${esc(r.grade || pct(r.percentage))}</span>` },
			], d.results))}
			${card(t("Circulars"), circulars(d.circulars))}
		</div>`;
	}

	async function parentView() {
		const d = await call("parent");
		if (!d.children.length) return empty("No children linked to your account yet. Please contact the school office.");
		const kids = d.children
			.map((c) => `<section class="card">
				<div class="child">${c.image ? `<img class="avatar" src="${esc(c.image)}" alt="">` : `<div class="avatar">${esc(c.student_name[0] || "?")}</div>`}
					<div><b>${esc(c.student_name)}</b>${c.latest_result ? `<div class="meta">${t("Latest")}: ${esc(c.latest_result.course)} ${num(c.latest_result.total_score)}/${num(c.latest_result.maximum_score)}</div>` : ""}</div>
					<button class="btn" style="margin-left:auto" data-student="${esc(c.student)}">${t("Details")}</button>
				</div>
				${studentBlock(c, true)}
			</section>`)
			.join("");
		return `<h2>${t("My children")}</h2><div class="grid">${kids}</div>
			<div class="grid">${card(t("Circulars"), circulars(d.circulars))}</div>`;
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
			app.innerHTML = arg ? await studentView(arg) : await VIEWS[view].render();
			if (arg) app.insertAdjacentHTML("afterbegin", `<p><button class="btn" data-back="${view}">← ${t("Back")}</button></p>`);
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
	if ("serviceWorker" in navigator) {
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
			app.innerHTML = empty("Your account isn't linked to a student, guardian or teacher record yet. Please contact the school office.");
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
