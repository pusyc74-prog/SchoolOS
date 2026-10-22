// Renders every SchoolOS screen with the real school.js and fake data, in Node (no browser).
// node ci/ui_harness.js [en|mr]    env: TALLY=1 (Tally mode), OFF=1 (some modules off), OUT=dir (save HTML)
// Harness v2: runs the real school.js with fake API data and clicks through every view and sub-tab.
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "schoolos", "public", "js", "school.js"), "utf8");
const LANG = process.argv[2] || "en";
Object.defineProperty(globalThis, "navigator", { value: { onLine: true, language: LANG }, configurable: true });
function el(id) {
	return { id, innerHTML: "", textContent: "", children: [], dataset: {}, classList: { add() {}, remove() {} },
		_hs: {}, addEventListener(t, fn) { this._hs[t] = fn; }, insertAdjacentHTML(p, h) { this.innerHTML = h + this.innerHTML; },
		setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] };
}
const els = { app: el("app"), tabs: el("tabs"), "user-name": el("user-name"), "desk-link": el("desk-link"), "install-btn": el("install-btn"), "lang-btn": el("lang-btn") };
global.document = { getElementById: (id) => els[id], querySelector: (q) => (q.includes(".user") ? { insertAdjacentHTML() {} } : { set textContent(v) {} }),
	querySelectorAll: () => [], createElement: () => ({ set innerHTML(v) { this._t = String(v).replace(/<[^>]+>/g, ""); }, get textContent() { return this._t; } }), head: { appendChild() {} } };
global.window = { addEventListener() {}, frappe: {} };
global.localStorage = { getItem: () => null, setItem() {} };
global.location = { reload() {} };
global.getComputedStyle = () => ({ getPropertyValue: () => "" });

const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(2026, 9, 21 - i); if (d.getDay()) days.push({ date: d.toISOString().slice(0, 10), present: 1800, absent: 100, leave: 10, percentage: 90 + (i % 5) }); }
const cal = days.map((d, i) => ({ date: d.date, status: i % 9 === 4 ? "Absent" : "Present" }));
const hw = [{ name: "H1", entry_type: "Homework", title: "Ex 4.2", course: "Mathematics", student_group: "Class 5 - A (2026-27)", date: "2026-10-21", due_date: "2026-10-23", instructor_name: "R", details: "" }];
const D = {
	get_context: { user: "p@x", full_name: "Priya Deshmukh", views: ["principal", "fees", "accounts", "teacher", "parent", "student", "calendar"], roles: ["School Principal"], children: [],
		modules: { fees: true, accounts: true, homework: true, learning: !process.env.OFF, report_cards: true, circulars: true, leave: true, calendar: true, staff: true } },
	principal: { date: "2026-10-21", academic_term: "T1", students: { active: 1984, enrolled_this_year: 1984 }, attendance_today: { present: 1800, absent: 90, leave: 10, total: 1900, percentage: 94.7 },
		groups_today: [{ student_group: "Class 5 - A", strength: 30, marked: true, absent: 2, percentage: 93 }, { student_group: "Class 6 - B", strength: 30, marked: false }], groups_unmarked: ["Class 6 - B"],
		trend: days, low_attendance: [{ student_name: "Kabir", days: 26, absent: 9, percentage: 65 }], staff_today: { present: 100, on_leave: 5, absent: 3, active_staff: 110, checked_in: 98 },
		subject_performance: [{ course: "Maths", average: 70 }], alerts_today: { "Dry Run": 3 }, upcoming_exams: [], circulars: [], window: { start: "2026-09-22", end: "2026-10-21", threshold: 75 } },
	summary: { academic_year: "2026-27", billed: 23808000, collected: 17262000, outstanding: 6546000, overdue: 2410000, due_soon: 1200000, collection_pct: 72.5, students_with_dues: 640, students_overdue: 212,
		ageing: [{ label: "0–30 days", amount: 900000, students: 80 }, { label: "31–60 days", amount: 700000, students: 60 }, { label: "61–90 days", amount: 500000, students: 40 }, { label: "90+ days", amount: 310000, students: 32 }],
		groups: [{ group: "Class 5 - A (2026-27)", billed: 1440000, outstanding: 360000, collected: 1080000, collection_pct: 75, students: 40, with_dues: 12 }],
		defaulters: [{ student: "S1", student_name: "Kabir Pawar", group: "Class 5 - A (2026-27)", outstanding: 24000, overdue: 18000, days_overdue: 72, guardian: "Mr Pawar", mobile: "919876543210", last_reminder: "2026-10-14" }],
		collected_today: 182000, collected_month: 2140000, payments_today: 23, daily: days.map((d, i) => ({ key: d.date, amount: 50000 + i * 1000 })), monthly: [{ key: "2026-06", amount: 6200000 }, { key: "2026-07", amount: 3100000 }],
		modes: [{ label: "UPI", amount: 9100000 }, { label: "Cash", amount: 5200000 }], heads: [{ label: "Tuition Fee", amount: 18000000 }, { label: "Transport", amount: 3800000 }],
		recent_payments: [{ date: "2026-10-21", amount: 12000, mode: "UPI", student_name: "Riya Patil" }], reminders_this_month: 412, currency: "INR" },
	syllabus_overview: { courses: ["English", "Maths"], rows: [{ group: "Class 5 - A (2026-27)", cells: { English: { percentage: 45, expected: 42, status: "on track", covered: 9, total: 20 }, Maths: { percentage: 20, expected: 42, status: "behind", covered: 4, total: 20 } } }], behind: 1 },
	teacher: { date: "2026-10-21", instructor: "I1", instructor_name: "Sunita Kulkarni", schedule: [{ course: "English", student_group: "Class 5 - A (2026-27)", room: "5A", from_time: "8:30:00", to_time: "9:15:00" }],
		groups_today: [{ student_group: "Class 5 - A (2026-27)", strength: 30, marked: true, absent: 2, percentage: 93 }], absent_today: [], pending_marks: [], recent_posts: hw, trend: days, low_attendance: [], window: { threshold: 75 } },
	post_options: { groups: ["Class 5 - A (2026-27)"], courses: { "Class 5 - A (2026-27)": ["English"] }, types: ["Homework"], whatsapp_allowed: false },
	lesson_options: { groups: ["Class 5 - A (2026-27)"], courses: { "Class 5 - A (2026-27)": [{ course: "English", percentage: 45, expected: 42, status: "on track", topics: [{ topic: "T1", name: "Nouns", state: "done" }, { topic: "T2", name: "Verbs", state: "started" }, { topic: "T3", name: "Tenses", state: "todo" }] }] } },
	group_students: [{ student: "S1", student_name: "Aarav", group_roll_number: 1 }],
	parent: { children: [{ student: "S1", student_name: "Aarav Patil", attendance: { percentage: 96, present: 25, working_days: 26, absent: 1 }, absent_recently: [], calendar: cal, enrollment: { program: "Class 5" },
		latest_result: { course: "Maths", total_score: 88, maximum_score: 100 }, report_cards: [], homework_due: hw, fees: { outstanding: 12000, overdue: 0, paid: 24000, total: 36000, next_due: { date: "2026-11-10", amount: 12000, overdue: false }, currency: "INR", pay_online: true } }], circulars: [] },
	student: { student: { name: "S1", student_name: "Aarav Patil" }, enrollment: { program: "Class 5", academic_year: "2026-27" }, attendance: { percentage: 96, present: 25, working_days: 26, absent: 1 },
		recent_absences: [], calendar: cal, today_schedule: [], results: [{ course: "Maths", percentage: 88, grade: "A2", assessment_group: "HY" }], report_cards: [], circulars: [], homework: hw, window: { start: "2026-09-22", end: "2026-10-21" } },
	student_progress: { group: "G", subjects: [{ course: "English", syllabus: { total: 20, covered: 9, percentage: 45, expected: 42, status: "on track", last_lesson: "2026-10-20" }, topics: [{ topic: "T1", name: "Nouns", state: "done" }], scores: [{ exam: "UT1", percentage: 70, grade: "B1" }, { exam: "HY", percentage: 82, grade: "A2" }], average: 76, latest: { exam: "HY", percentage: 82, grade: "A2" }, homework_30d: 6 }],
		class_notes: [{ date: "2026-10-20", course: "English", topic: "Nouns", completed: 1, notes: "<p>Common and proper nouns.</p>", instructor_name: "Sunita" }], teacher_notes: [{ date: "2026-10-19", type: "Achievement", log: "Won the spelling bee", author: "Sunita" }] },
	activity: [{ date: "2026-10-21", kind: "attendance", status: "Absent" }, { date: "2026-10-21 09:00:00", kind: "homework", title: "Ex 4.2", course: "Maths", entry_type: "Homework", due_date: "2026-10-23" },
		{ date: "2026-10-20", kind: "lesson", title: "Nouns", course: "English", completed: 1, notes: "x" }, { date: "2026-10-19", kind: "marks", title: "HY - Maths", course: "Maths", score: 82, max: 100, grade: "A2" },
		{ date: "2026-10-19", kind: "note", title: "Achievement", text: "Won", author: "Sunita" }, { date: "2026-10-18", kind: "payment", title: "UPI", amount: 12000 }, { date: "2026-10-17", kind: "report_card", title: "Term 1", grade: "A2" }],
	accounts_summary: { mode: process.env.TALLY ? "tally" : "full", company: "Demo", fiscal_year: "2026-2027", currency: "INR", can_approve: true,
		monthly: [{ key: "2026-04", income: 4200000, expense: 2900000, surplus: 1300000 }, { key: "2026-05", income: 900000, expense: 2700000, surplus: -1800000 }],
		year: { income: 17262000, expense: 14100000, surplus: 3162000, margin_pct: 18.3 }, this_month: { income: 1846000, expense: 1510000, surplus: 336000 },
		expense_heads: [{ label: "Salary", amount: 9800000 }, { label: "Electricity", amount: 420000 }], income_heads: [{ label: "Tuition Fees", amount: 15000000 }],
		salary: { amount: 9800000, share_of_income: 56.8 }, balances: [{ account: "HDFC Bank", type: "Bank", balance: 4210000 }, { account: "Cash", type: "Cash", balance: 86000 }],
		cash_today: { received: 182000, paid: 45000 }, payables: { total: 610000, overdue: 120000, due_this_week: 90000, bills: [{ name: "PINV-1", supplier: "Sai Stationers", outstanding: 120000, due_date: "2026-10-10", overdue: true, days: -11 }] },
		approvals: [{ doctype: "Purchase Invoice", name: "PINV-9", who: "Sai Stationers", amount: 38500, date: "2026-10-20", what: "Notebooks", by: "Accounts" }, { doctype: "Expense Claim", name: "EC-1", who: "Anil Jadhav", amount: 1800, date: "2026-10-19", what: "Bus fuel", by: "Anil Jadhav" }],
		recent: [{ date: "2026-10-21", type: "Receive", party: "Riya Patil", mode: "UPI", amount: 12000 }, { date: "2026-10-20", type: "Pay", party: "MSEDCL", mode: "Bank", amount: 42000 }],
		tally_company: "Demo Public School", last_export: { on: "2026-10-01", range: "01 Sep 2026 – 30 Sep 2026 · 412 vouchers · Accounts" }, month_invoices: 120, month_receipts: 380, month_received: 1846000,
		cfg: { party_mode: "student", income_ledger: "", cash_ledger: "Cash", bank_ledger: "HDFC Bank", debtors_group: "Sundry Debtors" } },
	month: { year: 2026, month: 10, items: [{ date: "2026-10-02", end_date: "2026-10-02", type: "Holiday", title: "Gandhi Jayanti" }, { date: "2026-10-24", end_date: "2026-10-24", type: "PTM", title: "Parent-Teacher Meeting", time: "09:00" },
		{ date: "2026-10-27", end_date: "2026-10-27", type: "Exam", title: "Unit Test 2 - Maths" }, { date: "2026-10-30", end_date: "2026-11-04", type: "Holiday", title: "Diwali vacation" }], upcoming: [{ date: "2026-10-24", end_date: "2026-10-24", type: "PTM", title: "PTM" }] },
	albums: [{ name: "A1", title: "Sports Day", date: "2026-10-10", cover: "/x.jpg", count: 24, photos: [] }],
	leave_for_student: [{ name: "L1", from_date: "2026-10-22", to_date: "2026-10-23", reason: "Fever", total_leave_days: 2, status: "Pending" }, { name: "L0", from_date: "2026-09-02", to_date: "2026-09-02", reason: "Wedding", total_leave_days: 1, status: "Rejected", schoolos_decision_note: "Exam day", decided_by: "Sunita" }],
	pending: [{ name: "L1", student_name: "Aarav Patil", student_group: "Class 5 - A (2026-27)", from_date: "2026-10-22", to_date: "2026-10-23", reason: "Fever", total_leave_days: 2 }],
	for_student: { invoices: [{ invoice: "SINV-1", due_date: "2026-11-10", total: 12000, outstanding: 12000, overdue: false, heads: [{ head: "Tuition Fee", amount: 12000 }], currency: "INR" }, { invoice: "SINV-0", due_date: "2026-06-10", total: 12000, outstanding: 0, overdue: false, heads: [], currency: "INR" }],
		payments: [{ date: "2026-06-05", amount: 12000, mode: "UPI", reference: "pay_X" }], total: 24000, paid: 12000, outstanding: 12000, overdue: 0, next_due: { date: "2026-11-10", amount: 12000, overdue: false }, currency: "INR", pay_online: true },
};
global.fetch = async (url) => { let m = url.split("?")[0].split(".").pop();
	if (url.includes("accounts.summary")) m = "accounts_summary";
	if (url.includes("leave.for_student")) m = "leave_for_student"; if (!(m in D)) throw new Error("no mock " + m); return { ok: true, json: async () => ({ message: D[m] }) }; };
const wait = () => new Promise((r) => setTimeout(r, 30));
const click = (attrs) => els.app._hs.click({ target: { closest: (sel) => { const k = sel.replace(/^\[data-|\]$/g, ""); return attrs[k] !== undefined ? { dataset: attrs.dataset || attrs } : null; } } });
(async () => {
	eval(src);
	await wait();
	const out = {};
	for (const v of ["principal", "fees", "accounts", "teacher", "parent", "calendar", "student"]) {
		els.tabs._hs.click({ target: { closest: () => ({ dataset: { view: v } }) } });
		await wait();
		out[v] = els.app.innerHTML;
	}
	for (const sub of ["progress", "fees", "activity", "leave", "overview"]) {
		click({ sv: sub, dataset: { sv: sub } });
		await wait();
		out["student-" + sub] = els.app.innerHTML;
	}
	let bad = 0;
	for (const [k, h] of Object.entries(out)) {
		const err = h.includes('class="error"');
		if (err || h.length < 500) { bad++; console.log("PROBLEM", k, h.slice(0, 300)); }
		else console.log(k.padEnd(18), h.length, ((h.match(/undefined|NaN/g) || []).length ? (bad++, "contains undefined/NaN!") : ""));
		process.env.OUT && fs.writeFileSync(require("path").join(process.env.OUT, `dash_${k}_${LANG}${process.env.TALLY ? "_tally" : ""}${process.env.OFF ? "_off" : ""}.html`), h);
	}
	console.log(bad ? "FAILED" : "ALL OK"); process.exitCode = bad ? 1 : 0;
})();
