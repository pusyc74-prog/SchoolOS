/* SchoolOS dashboard: one page, one tab per role the user has.
   Talks only to schoolos.api.dashboard.* so the mobile app can reuse the same API. */
(function () {
	const API = "/api/method/schoolos.api.dashboard.";
	const app = document.getElementById("app");
	const tabs = document.getElementById("tabs");
	let ctx = null;

	// ---------- utils
	const esc = (v) =>
		String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10}%`);
	const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString("en-IN"));
	const tone = (p, threshold = 75) => (p === null || p === undefined ? "" : p >= 90 ? "good" : p >= threshold ? "warn" : "bad");
	const pill = (p, threshold) => `<span class="pill ${tone(p, threshold)}">${pct(p)}</span>`;
	const fmtDate = (d) => {
		if (!d) return "";
		const x = new Date(String(d).slice(0, 10) + "T00:00:00");
		return x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
	};
	const fmtTime = (t) => (t ? String(t).slice(0, 5).replace(/^(\d):/, "0$1:") : "");
	const stripHtml = (h) => {
		const d = document.createElement("div");
		d.innerHTML = h || "";
		return (d.textContent || "").trim();
	};

	async function call(method, args = {}) {
		const qs = new URLSearchParams(Object.entries(args).filter(([, v]) => v !== undefined && v !== null));
		const r = await fetch(`${API}${method}?${qs}`, { headers: { Accept: "application/json" }, credentials: "same-origin" });
		const data = await r.json().catch(() => ({}));
		if (!r.ok) {
			let msg = data.exception || data.exc_type || r.statusText;
			try {
				const m = JSON.parse(data._server_messages || "[]")[0];
				if (m) msg = JSON.parse(m).message || msg;
			} catch (e) {}
			throw new Error(stripHtml(msg));
		}
		return data.message;
	}

	const kpi = (label, value, note = "") =>
		`<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;

	const card = (title, body, sub = "") => `<section class="card"><h3>${esc(title)} ${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</h3>${body}</section>`;

	const empty = (text) => `<div class="empty">${esc(text)}</div>`;

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
		return `<div class="trend"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Attendance trend">
			<line class="axis" x1="${P}" y1="${y(100)}" x2="${W - P}" y2="${y(100)}"/>
			<line class="axis" x1="${P}" y1="${y(lo)}" x2="${W - P}" y2="${y(lo)}"/>
			<text x="2" y="${y(100) + 4}">100%</text><text x="2" y="${y(lo) + 4}">${lo}%</text>
			<path class="line" d="${d}"/>${dots}
			<text x="${P}" y="${H - 4}">${fmtDate(first)}</text><text x="${W - P}" y="${H - 4}" text-anchor="end">${fmtDate(last)}</text>
		</svg></div>`;
	}

	function table(cols, rows) {
		if (!rows || !rows.length) return empty("Nothing to show");
		return `<div class="scroll"><table><thead><tr>${cols.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead>
			<tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? "num" : ""}">${c.html ? c.html(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
	}

	function circulars(list) {
		if (!list || !list.length) return empty("No circulars yet");
		return `<ul class="list">${list
			.map((c) => `<li><div><div><b>${esc(c.title)}</b></div><div class="circular-body">${esc(stripHtml(c.message).slice(0, 140))}</div></div>
				<span class="meta">${fmtDate(c.publish_date)}</span></li>`)
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
		<h2>Today <span class="sub">${fmtDate(d.date)}${d.academic_term ? " · " + esc(d.academic_term) : ""}</span></h2>
		<div class="kpis">
			${kpi("Active students", num(d.students.active), d.students.enrolled_this_year ? `${num(d.students.enrolled_this_year)} enrolled this year` : "")}
			${kpi("Present today", a.total ? pct(a.percentage) : "–", a.total ? `${num(a.present)} of ${num(a.total)} marked` : "Attendance not marked yet")}
			${kpi("Absent today", num(a.absent), a.leave ? `${num(a.leave)} on leave` : "")}
			${kpi("Classes not marked", num(d.groups_unmarked.length), d.groups_unmarked.slice(0, 3).map(esc).join(", "))}
			${staff ? kpi("Staff present", num((staff.present || 0) + (staff.work_from_home || 0) + (staff.half_day || 0)), `${num(staff.checked_in)} checked in · ${num(staff.active_staff)} staff`) : ""}
			${kpi("Parent alerts today", num(sent), d.alerts_today["Failed"] ? `<span style="color:var(--bad)">${num(d.alerts_today["Failed"])} failed</span>` : "")}
		</div>
		<div class="grid">
			${card("Attendance trend", trend(d.trend), `last ${d.trend.length} school days`)}
			${card("Classes today", table([
				{ label: "Class", key: "student_group" },
				{ label: "Strength", key: "strength", num: true },
				{ label: "Absent", num: true, html: (r) => (r.marked ? num(r.absent) : "–") },
				{ label: "Present", num: true, html: (r) => (r.marked ? pill(r.percentage, th) : '<span class="pill warn">Not marked</span>') },
			], d.groups_today))}
			${card("Students below " + th + "% attendance", lowAttendance(d.low_attendance, th), `${fmtDate(d.window.start)} – ${fmtDate(d.window.end)}`)}
			${card("Subject averages", bars(d.subject_performance, "course", "average"), d.academic_term ? esc(d.academic_term) : "this year")}
			${card("Upcoming exams", d.upcoming_exams.length ? `<ul class="list">${d.upcoming_exams.map((e) => `<li><div><b>${esc(e.assessment_name || e.course)}</b><div class="meta">${esc(e.student_group)}</div></div><span class="meta">${fmtDate(e.schedule_date)} ${fmtTime(e.from_time)}</span></li>`).join("")}</ul>` : empty("No exams in the next 2 weeks"), "next 14 days")}
			${card("Recent circulars", circulars(d.circulars) + `<p><a class="btn" href="/desk/schoolos-circular/new">New circular</a></p>`)}
		</div>`;
	}

	async function teacherView() {
		const d = await call("teacher");
		const th = d.window.threshold;
		const unmarked = d.groups_today.filter((g) => !g.marked);
		return `
		<h2>${esc(d.instructor_name)} <span class="sub">${fmtDate(d.date)}</span></h2>
		<div class="kpis">
			${kpi("Classes today", num(d.schedule.length))}
			${kpi("Attendance to mark", num(unmarked.length), unmarked.map((g) => esc(g.student_group)).join(", "))}
			${kpi("Absent in my classes", num(d.absent_today.length))}
			${kpi("Marks pending", num(d.pending_marks.length), "assessments with missing results")}
		</div>
		<div class="grid">
			${card("Today's timetable", d.schedule.length ? `<ul class="list">${d.schedule.map((s) => `<li class="${s.now ? "now" : ""}"><div><b>${esc(s.course)}</b><div class="meta">${esc(s.student_group)}${s.room ? " · " + esc(s.room) : ""}</div></div><span class="meta">${fmtTime(s.from_time)}–${fmtTime(s.to_time)}</span></li>`).join("")}</ul>` : empty("No classes scheduled today"))}
			${card("My classes today", table([
				{ label: "Class", key: "student_group" },
				{ label: "Strength", key: "strength", num: true },
				{ label: "Present", num: true, html: (r) => (r.marked ? pill(r.percentage, th) : '<span class="pill warn">Not marked</span>') },
			], d.groups_today) + `<p><a class="btn" href="/desk/student-attendance-tool">Mark attendance</a></p>`)}
			${card("Absent today", table([{ label: "Student", key: "student_name" }, { label: "Class", key: "student_group" }], d.absent_today))}
			${card("Marks to enter", table([
				{ label: "Assessment", html: (r) => esc(r.assessment_name || r.course) },
				{ label: "Class", key: "student_group" },
				{ label: "Entered", num: true, html: (r) => `${num(r.entered)}/${num(r.strength)}` },
			], d.pending_marks) + `<p><a class="btn" href="/desk/assessment-result-tool">Enter marks</a></p>`)}
			${card("Attendance trend", trend(d.trend), "my classes")}
			${card("Needs attention", lowAttendance(d.low_attendance, th), `below ${th}%`)}
		</div>`;
	}

	function studentBlock(s, compact) {
		const a = s.attendance;
		const cards = (s.report_cards || [])
			.map((c) => `<a class="btn" href="/api/method/schoolos.api.report_card.download?name=${encodeURIComponent(c.name)}">Report card: ${esc(c.template)}${c.overall_grade ? " (" + esc(c.overall_grade) + ")" : ""}</a>`)
			.join(" ");
		return `
		<div class="kpis">
			${kpi("Attendance", pct(a.percentage), `${num(a.present)} of ${num(a.working_days)} days`)}
			${kpi("Absent", num(a.absent), (s.recent_absences || s.absent_recently || []).map(fmtDate).join(", "))}
			${!compact && s.enrollment ? kpi("Class", esc(s.enrollment.program), esc(s.enrollment.academic_year)) : ""}
		</div>
		${cards ? `<p class="toolbar">${cards}</p>` : ""}`;
	}

	async function studentView(studentId) {
		const d = await call("student", studentId ? { student: studentId } : {});
		return `
		<h2>${esc(d.student.student_name)} <span class="sub">${fmtDate(d.window.start)} – ${fmtDate(d.window.end)}</span></h2>
		${studentBlock(d)}
		<div class="grid">
			${card("Today's timetable", d.today_schedule.length ? `<ul class="list">${d.today_schedule.map((s) => `<li><div><b>${esc(s.course)}</b><div class="meta">${esc(s.instructor_name || "")}${s.room ? " · " + esc(s.room) : ""}</div></div><span class="meta">${fmtTime(s.from_time)}–${fmtTime(s.to_time)}</span></li>`).join("")}</ul>` : empty("No classes today"))}
			${card("Recent results", table([
				{ label: "Subject", key: "course" },
				{ label: "Exam", html: (r) => esc(r.assessment_name || r.assessment_group) },
				{ label: "Marks", num: true, html: (r) => `${num(r.total_score)}/${num(r.maximum_score)}` },
				{ label: "Grade", num: true, html: (r) => `<span class="pill ${tone(r.percentage, 33)}">${esc(r.grade || pct(r.percentage))}</span>` },
			], d.results))}
			${card("Circulars", circulars(d.circulars))}
		</div>`;
	}

	async function parentView() {
		const d = await call("parent");
		if (!d.children.length) return empty("No children linked to your account yet. Please contact the school office.");
		const kids = d.children
			.map((c) => `<section class="card">
				<div class="child">${c.image ? `<img class="avatar" src="${esc(c.image)}" alt="">` : `<div class="avatar">${esc(c.student_name[0] || "?")}</div>`}
					<div><b>${esc(c.student_name)}</b>${c.latest_result ? `<div class="meta">Latest: ${esc(c.latest_result.course)} ${num(c.latest_result.total_score)}/${num(c.latest_result.maximum_score)}</div>` : ""}</div>
					<button class="btn" style="margin-left:auto" data-student="${esc(c.student)}">Details</button>
				</div>
				${studentBlock(c, true)}
			</section>`)
			.join("");
		return `<h2>My children</h2><div class="grid">${kids}</div>
			<div class="grid">${card("Circulars", circulars(d.circulars))}</div>`;
	}

	// ---------- shell
	const VIEWS = {
		principal: { label: "Principal", render: principalView },
		teacher: { label: "My classes", render: teacherView },
		parent: { label: "My children", render: parentView },
		student: { label: "My dashboard", render: () => studentView() },
	};

	async function show(view, arg) {
		[...tabs.children].forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
		app.innerHTML = '<div class="loading">Loading…</div>';
		try {
			app.innerHTML = arg ? await studentView(arg) : await VIEWS[view].render();
			if (arg) app.insertAdjacentHTML("afterbegin", `<p><button class="btn" data-back="${view}">← Back</button></p>`);
		} catch (e) {
			app.innerHTML = `<div class="error">${esc(e.message || "Something went wrong")}</div>`;
		}
		try { localStorage.setItem("schoolos:view", view); } catch (e) {}
	}

	app.addEventListener("click", (e) => {
		const s = e.target.closest("[data-student]");
		if (s) return show("parent", s.dataset.student);
		const b = e.target.closest("[data-back]");
		if (b) return show(b.dataset.back);
	});

	async function init() {
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
		tabs.innerHTML = ctx.views.map((v) => `<button class="tab" role="tab" data-view="${v}">${VIEWS[v].label}</button>`).join("");
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
