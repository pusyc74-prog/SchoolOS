(function () {
	"use strict";
	// ------------------------------------------------------------------ helpers
	const $ = (s, r = document) => r.querySelector(s);
	const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const pad = (n) => String(n).padStart(2, "0");
	const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
	const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
	const T = iso(TODAY);
	const fmt = (d, opts = { day: "numeric", month: "short" }) => new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", opts);
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const yearStart = TODAY.getMonth() >= 5 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
	const AY = `${yearStart}-${String(yearStart + 1).slice(2)}`;
	const TERM = TODAY <= new Date(yearStart, 9, 31) ? `${AY} (Term 1)` : `${AY} (Term 2)`;
	let rnd = 42;
	const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);

	function toast(msg) {
		const t = $("#toast");
		t.textContent = msg;
		t.classList.add("show");
		clearTimeout(toast._t);
		toast._t = setTimeout(() => t.classList.remove("show"), 2600);
	}

	// ------------------------------------------------------------------ state
	const S = {
		brand: { name: "Demo Public School", color: "#1F3A5F", address: "Vishrambag, Sangli, Maharashtra" },
		settings: { testMode: true, alerts: true, absence: true, homework: true, homeworkWA: false, circular: true,
			reportCard: true, whatsapp: true, email: true, lang: "en", waLang: "en", threshold: 75 },
		device: {},
		current: null,
		alerts: [],
	};
	const initials = (n) => n.split(/\s+/).filter((w) => /^[A-Za-zऀ-ॿ]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "S";
	const logo = () => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${S.brand.color}"/><text x="32" y="41" font-family="Arial" font-weight="700" font-size="26" fill="#fff" text-anchor="middle">${initials(S.brand.name)}</text></svg>`)}`;

	const FIRST = ["Aarav", "Riya", "Vihaan", "Ananya", "Arjun", "Diya", "Kabir", "Isha", "Reyansh", "Saanvi", "Aditya", "Myra", "Krishna", "Anika", "Shaurya", "Kiara", "Atharv", "Pari", "Ishaan", "Navya", "Vivaan", "Aadhya", "Om", "Siya", "Rudra", "Tara", "Yash", "Mira", "Dev", "Avni"];
	const LAST = ["Patil", "Patil", "Kulkarni", "Deshmukh", "Joshi", "Pawar", "Shinde", "Jadhav", "More", "Kale", "Gaikwad"];
	const STUDENTS = FIRST.map((f, i) => ({ id: `EDU-STU-${yearStart}-${pad(i + 1)}`, name: `${f} ${i < 2 ? "Patil" : LAST[2 + (i % 9)]}`, roll: i + 1 }));
	const SUBJECTS = ["English", "Mathematics", "Science", "Social Studies", "Marathi", "Hindi"];
	const TEACHERS = ["Sunita Kulkarni", "Rajesh Patil", "Meera Deshpande", "Anil Jadhav", "Kavita Joshi", "Prakash More"];
	const SECTION = `Class 5 - A (${AY})`;

	// school days in the last 30 days
	const days = [];
	for (let i = 29; i >= 0; i--) {
		const d = addDays(TODAY, -i);
		if (d.getDay() === 0) continue;
		const pctv = 88 + Math.round(rand() * 9 * 10) / 10 - (d.getDay() === 6 ? 4 : 0);
		days.push({ date: iso(d), present: Math.round(19.84 * pctv), absent: Math.round(19.84 * (100 - pctv)), leave: 6, percentage: Math.round(pctv * 10) / 10 });
	}

	const HW = [
		{ name: "HW-0004", entry_type: "Note", title: "Bring an atlas tomorrow", course: "Social Studies", student_group: SECTION, instructor_name: "Anil Jadhav", date: iso(addDays(TODAY, -1)), due_date: T, details: "", recipients_count: 30 },
		{ name: "HW-0003", entry_type: "Homework", title: "Exercise 4.2, questions 1–10", course: "Mathematics", student_group: SECTION, instructor_name: "Rajesh Patil", date: T, due_date: iso(addDays(TODAY, 2)), details: "<p>Show all working in the notebook.</p>", recipients_count: 30 },
		{ name: "HW-0002", entry_type: "Homework", title: "Learn the poem 'Trees' (first two stanzas)", course: "English", student_group: SECTION, instructor_name: "Sunita Kulkarni", date: iso(addDays(TODAY, -1)), due_date: iso(addDays(TODAY, 2)), details: "", recipients_count: 30 },
		{ name: "HW-0001", entry_type: "Project", title: "Make a model of the water cycle", course: "Science", student_group: SECTION, instructor_name: "Meera Deshpande", date: iso(addDays(TODAY, -2)), due_date: iso(addDays(TODAY, 7)), details: "<p>Use waste material. Groups of 3.</p>", recipients_count: 30 },
	];
	const hwView = () => HW.map((h) => ({ ...h, overdue: h.due_date < T, due_today: h.due_date === T }));

	const CIRCULARS = [
		{ title: "Parent-Teacher Meeting on Saturday", message: "<p>Dear parents, the Half Yearly PTM is on Saturday from 9 am to 12 pm. Please collect your child's report card from the class teacher.</p>", publish_date: T },
		{ title: "Diwali vacation dates", message: "<p>School stays closed for Diwali vacation. Classes resume on the Monday after.</p>", publish_date: iso(addDays(TODAY, -6)) },
	];

	const RESULTS = (seed) => SUBJECTS.map((c, i) => {
		const pctv = Math.round(55 + ((seed * 7 + i * 13) % 40));
		const g = grade(pctv);
		return { name: `R-${i}`, course: c, assessment_name: `Half Yearly - ${c}`, assessment_group: "Half Yearly", total_score: pctv, maximum_score: 100, grade: g, percentage: pctv };
	});
	function grade(p) {
		return [[91, "A1"], [81, "A2"], [71, "B1"], [61, "B2"], [51, "C1"], [41, "C2"], [33, "D"], [0, "E"]].find(([t]) => p >= t)[1];
	}

	function studentData(id) {
		const i = Math.max(0, STUDENTS.findIndex((s) => s.id === id));
		const s = STUDENTS[i];
		const absent = i === 0 ? [T, iso(addDays(TODAY, -9))] : [];
		const wd = days.length;
		return {
			student: { name: s.id, student_name: s.name },
			enrollment: { program: "Class 5", academic_year: AY },
			attendance: { working_days: wd, present: wd - absent.length, absent: absent.length, leave: 0, percentage: Math.round(((wd - absent.length) / wd) * 1000) / 10 },
			recent_absences: absent,
			calendar: days.map((x) => ({ date: x.date, status: absent.includes(x.date) ? "Absent" : (i === 1 && x.date === days[4].date) ? "Leave" : "Present" })),
			today_schedule: SUBJECTS.slice(0, 6).map((c, k) => ({ course: c, instructor_name: TEACHERS[k], room: "Room 5A", from_time: ["8:30:00", "9:15:00", "10:15:00", "11:00:00", "12:30:00", "13:15:00"][k], to_time: ["9:15:00", "10:00:00", "11:00:00", "11:45:00", "13:15:00", "14:00:00"][k] })),
			results: RESULTS(i + 3),
			report_cards: S.rcPublished ? [{ name: `RC-${i}`, template: "Class 5 Term 1 (CBSE)", overall_grade: grade(70 + ((i * 7) % 20)) }] : [],
			circulars: CIRCULARS.slice(0, 3),
			homework: hwView(),
			window: { start: iso(addDays(TODAY, -29)), end: T },
		};
	}
	S.rcPublished = true;

	const GROUPS = [];
	for (let c = 1; c <= 10; c++) for (const sec of ["A", "B"]) GROUPS.push(`Class ${c} - ${sec}`);
	function principalData() {
		const today = days[days.length - 1];
		const groups = GROUPS.map((g, i) => {
			const marked = !["Class 6 - B", "Class 9 - A"].includes(g);
			const strength = 96 + (i % 5);
			const absent = marked ? 2 + ((i * 3) % 6) : 0;
			return { student_group: g, strength, marked, present: strength - absent, absent, leave: marked ? i % 2 : 0, total: marked ? strength : 0, percentage: marked ? Math.round(((strength - absent) / strength) * 1000) / 10 : null };
		}).sort((a, b) => a.marked - b.marked);
		const counts = { Sent: 0, "Dry Run": 0, Failed: 0 };
		S.alerts.filter((a) => a.date === T).forEach((a) => (counts[a.status] = (counts[a.status] || 0) + 1));
		return {
			date: T, academic_year: AY, academic_term: TERM,
			students: { active: 1984, enrolled_this_year: 1984 },
			attendance_today: { present: today.present, absent: today.absent, leave: today.leave, total: today.present + today.absent + today.leave, percentage: today.percentage },
			groups_today: groups, groups_unmarked: groups.filter((g) => !g.marked).map((g) => g.student_group),
			trend: days,
			low_attendance: [
				{ student_name: "Kabir Pawar", days: 26, absent: 10, percentage: 61.5 }, { student_name: "Om Jadhav", days: 26, absent: 9, percentage: 65.4 },
				{ student_name: "Diya Shinde", days: 26, absent: 8, percentage: 69.2 }, { student_name: "Tara Kale", days: 25, absent: 7, percentage: 72.0 },
			],
			staff_today: { present: 104, work_from_home: 0, half_day: 2, on_leave: 6, absent: 3, active_staff: 118, checked_in: 101 },
			subject_performance: [
				{ course: "Marathi", average: 58.2 }, { course: "Hindi", average: 63.0 }, { course: "Science", average: 66.4 },
				{ course: "Social Studies", average: 69.9 }, { course: "English", average: 72.1 }, { course: "Mathematics", average: 74.8 },
			],
			alerts_today: { "Dry Run": counts["Dry Run"] + 92, Sent: counts.Sent, Failed: counts.Failed + 2 },
			upcoming_exams: [
				{ assessment_name: "Unit Test 2 - Mathematics", student_group: "Class 5 - A", schedule_date: iso(addDays(TODAY, 5)), from_time: "9:00:00" },
				{ assessment_name: "Unit Test 2 - Science", student_group: "Class 7 - B", schedule_date: iso(addDays(TODAY, 8)), from_time: "10:00:00" },
			],
			circulars: CIRCULARS.slice(0, 5),
			window: { start: iso(addDays(TODAY, -29)), end: T, threshold: S.settings.threshold },
		};
	}

	function teacherData() {
		const sched = [
			{ course: "English", student_group: SECTION, room: "Room 5A", from_time: "8:30:00", to_time: "9:15:00" },
			{ course: "English", student_group: `Class 6 - B (${AY})`, room: "Room 6B", from_time: "10:15:00", to_time: "11:00:00" },
			{ course: "English", student_group: `Class 7 - A (${AY})`, room: "Room 7A", from_time: "12:30:00", to_time: "13:15:00" },
		];
		const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes();
		const toM = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
		sched.forEach((s) => (s.now = mins >= toM(s.from_time) && mins <= toM(s.to_time)));
		return {
			date: T, instructor: "EDU-INS-0001", instructor_name: "Sunita Kulkarni", schedule: sched,
			groups_today: [
				{ student_group: SECTION, strength: 30, marked: !!S.attMarked, present: 28, absent: 2, leave: 0, total: S.attMarked ? 30 : 0, percentage: S.attMarked ? 93.3 : null },
				{ student_group: `Class 6 - B (${AY})`, strength: 38, marked: true, present: 36, absent: 2, leave: 0, total: 38, percentage: 94.7 },
				{ student_group: `Class 7 - A (${AY})`, strength: 35, marked: false, total: 0 },
			],
			absent_today: S.attMarked ? [{ student_name: "Aarav Patil", student_group: SECTION }, { student_name: "Kabir Pawar", student_group: SECTION }] : [{ student_name: "Om Jadhav", student_group: `Class 6 - B (${AY})` }, { student_name: "Siya Kale", student_group: `Class 6 - B (${AY})` }],
			pending_marks: [
				{ assessment_name: "Half Yearly - English", student_group: `Class 7 - A (${AY})`, entered: 12, strength: 35 },
				{ assessment_name: "Unit Test 1 - English", student_group: `Class 6 - B (${AY})`, entered: 36, strength: 38 },
			],
			recent_posts: hwView().filter((h) => h.instructor_name === "Sunita Kulkarni" || h.mine),
			trend: days.map((d) => ({ ...d, percentage: Math.min(100, d.percentage + 1.5) })),
			low_attendance: [{ student_name: "Kabir Pawar", days: 26, absent: 10, percentage: 61.5 }],
			window: { start: iso(addDays(TODAY, -29)), end: T, threshold: S.settings.threshold },
		};
	}

	function parentData() {
		return {
			children: STUDENTS.slice(0, 2).map((s) => {
				const d = studentData(s.id);
				return { student: s.id, student_name: s.name, image: null, attendance: d.attendance, absent_recently: d.recent_absences.slice(0, 3),
					latest_result: d.results[1], report_cards: d.report_cards, homework_due: d.homework.filter((h) => h.due_date >= T).slice(0, 3),
					fees: (({ outstanding, overdue, paid, total, next_due, currency, pay_online }) => ({ outstanding, overdue, paid, total, next_due, currency, pay_online }))(feesFor(s.id)),
					calendar: d.calendar, enrollment: d.enrollment };
			}),
			circulars: CIRCULARS.slice(0, 5),
		};
	}

	// ------------------------------------------------------------------ fees & learning demo data
	const Q = [new Date(yearStart, 5, 10), new Date(yearStart, 8, 10), new Date(yearStart, 11, 10)].map(iso);
	const FEES = {};
	STUDENTS.forEach((s, i) => {
		const invs = Q.map((due, q) => {
			const heads = [{ head: "Tuition Fee", amount: 12000 }].concat(i % 3 === 0 ? [{ head: "Transport Fee", amount: 3000 }] : []).concat(q === 0 ? [{ head: "Activity Fee", amount: 1500 }] : []);
			const total = heads.reduce((a, h) => a + h.amount, 0);
			let out = total;
			if (due <= T && ![5, 12, 21].includes(i)) out = q === 1 && i % 4 === 1 ? total : q === 1 && (i === 3 || i === 17) ? total / 2 : 0;
			if (i === 0 && q === 1) out = total; // the demo parent has one fee to pay
			return { invoice: `ACC-SINV-${yearStart}-${pad(i * 3 + q + 1).padStart(5, "0")}`, posting_date: iso(addDays(new Date(due), -25)), due_date: due, total, outstanding: out, heads, currency: "INR" };
		});
		const pays = invs.filter((v) => v.outstanding < v.total).map((v, k) => ({ date: iso(addDays(new Date(v.due_date), -3 + k)), amount: v.total - v.outstanding, mode: k % 3 === 2 ? "Cash" : "UPI", invoice: v.invoice, reference: `UPI${4021 + i * 7 + k}88213` }));
		FEES[s.id] = { invs, pays };
	});
	function feesFor(id) {
		const f = FEES[id] || FEES[STUDENTS[0].id];
		const invoices = f.invs.map((v) => ({ ...v, overdue: v.outstanding > 0 && v.due_date < T, status: v.outstanding <= 0 ? "Paid" : v.outstanding < v.total ? "Partly Paid" : v.due_date < T ? "Overdue" : "Unpaid" }));
		const total = invoices.reduce((a, v) => a + v.total, 0), out = invoices.reduce((a, v) => a + v.outstanding, 0);
		const unpaid = invoices.filter((v) => v.outstanding > 0).sort((a, b) => a.due_date.localeCompare(b.due_date));
		const over = unpaid.find((v) => v.overdue);
		const nd = over || unpaid[0];
		return { invoices, payments: [...f.pays].sort((a, b) => b.date.localeCompare(a.date)), total, paid: total - out, outstanding: out,
			overdue: invoices.filter((v) => v.overdue).reduce((a, v) => a + v.outstanding, 0),
			next_due: nd ? { date: nd.due_date, amount: nd.outstanding, overdue: !!nd.overdue } : null, currency: "INR", pay_online: true };
	}
	function feeSummary() {
		// scale the 30 demo students up to a 2,000-student school
		const k = 1984 / 30;
		let billed = 0, out = 0, overdue = 0, soon = 0;
		const age = [0, 0, 0, 0];
		const def = [];
		STUDENTS.forEach((s) => {
			const f = feesFor(s.id);
			billed += f.total; out += f.outstanding; overdue += f.overdue;
			f.invoices.forEach((v) => {
				if (v.outstanding > 0 && !v.overdue && (new Date(v.due_date) - TODAY) / 864e5 <= 30) soon += v.outstanding;
				if (v.overdue) { const late = Math.round((TODAY - new Date(v.due_date)) / 864e5); age[late <= 30 ? 0 : late <= 60 ? 1 : late <= 90 ? 2 : 3] += v.outstanding; }
			});
			if (f.outstanding > 0) {
				const oldest = f.invoices.filter((v) => v.overdue).map((v) => v.due_date).sort()[0];
				def.push({ student: s.id, student_name: s.name, group: SECTION, outstanding: f.outstanding, overdue: f.overdue, days_overdue: oldest ? Math.round((TODAY - new Date(oldest)) / 864e5) : 0,
					oldest_due: oldest || null, guardian: `${s.name.split(" ")[0] === "Aarav" || s.name.startsWith("Riya") ? "Suresh" : "Mr"} ${s.name.split(" ")[1]}`, mobile: `+91 98${pad(20 + s.roll)}0 4${pad(s.roll)}17`,
					last_reminder: S.reminded && S.reminded[s.id] ? S.reminded[s.id] : f.overdue ? iso(addDays(TODAY, -((s.roll * 3) % 9) - 1)) : null });
			}
		});
		def.sort((a, b) => b.overdue - a.overdue || b.days_overdue - a.days_overdue || b.outstanding - a.outstanding);
		const groups = GROUPS.map((g, i) => {
			const b = Math.round((billed / 30) * (96 + (i % 5)) / 1000) * 1000;
			const pctv = 58 + ((i * 17) % 38);
			return { group: g, billed: b, outstanding: Math.round(b * (1 - pctv / 100) / 100) * 100, collected: Math.round(b * pctv / 100), collection_pct: pctv, students: 96 + (i % 5), with_dues: Math.round((96 + (i % 5)) * (1 - pctv / 100) * 1.6) };
		}).sort((a, b) => b.outstanding - a.outstanding);
		const months = [];
		for (let m = 0; m < 11; m++) {
			const d = new Date(yearStart, 5 + m, 1);
			const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
			const amt = d > TODAY ? 0 : [6.2, 2.1, 1.3, 5.4, 2.6, 1.1, 5.9, 2.0, 1.2, 1.0, 0.6][m] * 1e6 * (d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear() ? Math.min(1, TODAY.getDate() / 30) : 1);
			months.push({ key, amount: Math.round(amt / 1000) * 1000 });
		}
		const collectedK = Math.round((billed - out) * k);
		return {
			academic_year: AY, billed: Math.round(billed * k), collected: collectedK, outstanding: Math.round(out * k), overdue: Math.round(overdue * k), due_soon: Math.round(soon * k),
			collection_pct: Math.round(((billed - out) / billed) * 1000) / 10, students_with_dues: Math.round(def.length * k), students_overdue: Math.round(def.filter((d) => d.overdue).length * k),
			ageing: ["0–30 days", "31–60 days", "61–90 days", "90+ days"].map((l, j) => ({ label: l, amount: Math.round(age[j] * k), students: Math.round((age[j] / 12000) * k) })),
			groups, defaulters: def, collected_today: 182500 + (S.paidToday || 0), collected_month: 1846000 + (S.paidToday || 0), payments_today: 23 + (S.paidToday ? 1 : 0),
			daily: days.map((d, i) => ({ key: d.date, amount: 40000 + ((i * 37) % 11) * 15000 })), monthly: months,
			modes: [{ label: "UPI", amount: Math.round(collectedK * 0.62) }, { label: "Cash", amount: Math.round(collectedK * 0.24) }, { label: "Cheque", amount: Math.round(collectedK * 0.09) }, { label: "Card", amount: Math.round(collectedK * 0.05) }],
			heads: [{ label: "Tuition Fee", amount: Math.round(collectedK * 1.05) }, { label: "Transport Fee", amount: Math.round(collectedK * 0.16) }, { label: "Activity Fee", amount: Math.round(collectedK * 0.06) }],
			recent_payments: [...(S.paidToday ? [{ date: T, amount: S.paidToday, mode: "UPI", student_name: STUDENTS[0].name }] : []),
				{ date: T, amount: 15000, mode: "UPI", student_name: "Ananya Kulkarni" }, { date: T, amount: 12000, mode: "Cash", student_name: "Krishna More" },
				{ date: T, amount: 12000, mode: "UPI", student_name: "Navya Jadhav" }, { date: iso(addDays(TODAY, -1)), amount: 6000, mode: "UPI", student_name: "Arjun Joshi" }],
			reminders_this_month: 412 + (S.remindedCount || 0), currency: "INR",
		};
	}

	const SYL = {
		English: ["Nouns", "Pronouns", "Verbs", "Adjectives", "Tenses", "Poem: Trees", "Story: The Lost Kite", "Letter Writing", "Comprehension", "Articles", "Prepositions", "Essay Writing"],
		Mathematics: ["Large Numbers", "Addition & Subtraction", "Multiplication", "Division", "Factors & Multiples", "Fractions", "Decimals", "Measurement", "Area & Perimeter", "Geometry: Angles", "Data Handling", "Patterns"],
		Science: ["Living & Non-living", "Plants: Photosynthesis", "Animals & Habitats", "Food & Nutrition", "Water Cycle", "Air & Weather", "Our Body", "Health & Hygiene", "Light & Shadows", "Simple Machines", "Soil", "Natural Resources"],
		"Social Studies": ["Our Country", "Maps & Directions", "Maharashtra", "Rivers of India", "Our Government", "Festivals", "Transport & Communication", "Early Humans", "Indus Valley", "Climate Zones", "Agriculture", "Industries"],
		Marathi: ["वर्णमाला", "शब्द व वाक्य", "कविता: पाऊस", "गोष्ट: चतुर कावळा", "नाम", "सर्वनाम", "क्रियापद", "पत्रलेखन", "निबंध", "म्हणी", "समानार्थी शब्द", "वाचन"],
		Hindi: ["वर्णमाला", "संज्ञा", "सर्वनाम", "कविता: चिड़िया", "क्रिया", "विशेषण", "कहानी: ईमानदार लकड़हारा", "पत्र लेखन", "निबंध", "मुहावरे", "विलोम शब्द", "पठन"],
	};
	const DONE = { English: 6, Mathematics: 3, Science: 6, "Social Studies": 5, Marathi: 5, Hindi: 7 };
	const LESSON_NOTES = { Nouns: "Common and proper nouns with examples from the classroom. Worksheet page 12.", "Large Numbers": "Place value up to crores using the Indian system. Practise reading numbers aloud.",
		"Plants: Photosynthesis": "Leaf experiment with iodine. Students drew the process in their notebooks.", "Maps & Directions": "Used the school map to learn the four directions. Homework: draw your route home." };
	const LESSONS = [];
	SUBJECTS.forEach((c, ci) => SYL[c].slice(0, DONE[c] + 1).forEach((tp, k) => LESSONS.push({ name: `L${ci}${k}`, date: iso(addDays(TODAY, -(DONE[c] - k) * 9 - 1)), student_group: SECTION, course: c, topic: tp,
		completed: k < DONE[c] ? 1 : 0, instructor_name: TEACHERS[ci], notes: `<p>${LESSON_NOTES[tp] || `Covered ${tp}. Revise the textbook exercise at home.`}</p>` })));
	const ys = new Date(yearStart, 5, 1), ye = new Date(yearStart + 1, 3, 30);
	const expected = Math.round(Math.max(0, Math.min(1, (TODAY - ys) / (ye - ys))) * 1000) / 10;
	function syllabusFor(course) {
		const topics = SYL[course] || [];
		const done = new Set(LESSONS.filter((l) => l.course === course && l.completed && l.topic).map((l) => l.topic));
		const started = new Set(LESSONS.filter((l) => l.course === course && l.topic).map((l) => l.topic));
		const covered = topics.filter((x) => done.has(x)).length;
		const p = topics.length ? Math.round((covered / topics.length) * 1000) / 10 : null;
		const last = LESSONS.filter((l) => l.course === course).map((l) => l.date).sort().pop() || null;
		return { course, total: topics.length, covered, percentage: p, expected, status: p === null ? null : p >= expected + 10 ? "ahead" : p < expected - 10 ? "behind" : "on track", last_lesson: last,
			topics: topics.map((x) => ({ topic: x, name: x, state: done.has(x) ? "done" : started.has(x) ? "started" : "todo" })) };
	}
	const NOTES = {
		[STUDENTS[0].id]: [
			{ date: iso(addDays(TODAY, -3)), type: "Achievement", log: "Won second place in the inter-school spelling bee. Very proud of him!", author: "Sunita Kulkarni" },
			{ date: iso(addDays(TODAY, -8)), type: "Academic", log: "Needs more practice with long division; please revise exercise 4.2 at home.", author: "Rajesh Patil" },
		],
		[STUDENTS[1].id]: [{ date: iso(addDays(TODAY, -5)), type: "General", log: "Helpful and kind to classmates; volunteered to lead the morning assembly.", author: "Sunita Kulkarni" }],
	};
	function progressFor(id) {
		const i = Math.max(0, STUDENTS.findIndex((s) => s.id === id));
		return {
			group: SECTION,
			subjects: SUBJECTS.map((c, ci) => {
				const base = 55 + ((i * 7 + ci * 13) % 35);
				const scores = [{ exam: `Unit Test 1 - ${c}`, percentage: Math.min(98, base - 6 + (ci % 3) * 4), grade: "" }, { exam: `Half Yearly - ${c}`, percentage: Math.min(99, base), grade: "" }].map((x) => ({ ...x, grade: grade(x.percentage) }));
				const s = syllabusFor(c);
				return { course: c, syllabus: { total: s.total, covered: s.covered, percentage: s.percentage, expected: s.expected, status: s.status, last_lesson: s.last_lesson }, topics: s.topics,
					scores, average: Math.round(((scores[0].percentage + scores[1].percentage) / 2) * 10) / 10, latest: scores[1], homework_30d: [5, 7, 4, 3, 4, 3][ci] + HW.filter((h) => h.course === c && h.mine).length };
			}),
			class_notes: [...LESSONS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
			teacher_notes: NOTES[id] || [],
		};
	}
	function activityFor(id) {
		const d = studentData(id);
		const items = [];
		d.recent_absences.forEach((x) => items.push({ date: x, kind: "attendance", status: "Absent", order: 1 }));
		HW.forEach((h) => items.push({ date: h.date + " 10:00:00", kind: "homework", title: h.title, course: h.course, entry_type: h.entry_type, due_date: h.due_date, order: 2 }));
		LESSONS.filter((l) => l.date >= iso(addDays(TODAY, -45))).forEach((l) => items.push({ date: l.date, kind: "lesson", title: l.topic, course: l.course, completed: l.completed, notes: l.notes.replace(/<[^>]+>/g, ""), order: 3 }));
		progressFor(id).subjects.forEach((s, k) => items.push({ date: iso(addDays(TODAY, -18 + k)) + " 15:00:00", kind: "marks", course: s.course, title: s.latest.exam, score: s.latest.percentage, max: 100, grade: s.latest.grade, order: 4 }));
		(NOTES[id] || []).forEach((n) => items.push({ date: n.date, kind: "note", title: n.type, text: n.log, author: n.author, order: 5 }));
		feesFor(id).payments.filter((p) => p.date >= iso(addDays(TODAY, -45))).forEach((p) => items.push({ date: p.date + " 12:00:00", kind: "payment", title: p.mode, amount: p.amount, order: 6 }));
		if (S.rcPublished) items.push({ date: iso(addDays(TODAY, -1)) + " 17:00:00", kind: "report_card", title: "Class 5 Term 1 (CBSE)", grade: "A2", order: 7 });
		if (S.modules.leave) LEAVES.filter((l) => l.student === id).forEach((l) => items.push({ date: iso(addDays(new Date(l.from_date), -3)) + " 08:00:00", kind: "leave", title: l.status, from_date: l.from_date, to_date: l.to_date, order: 8 }));
		return items.sort((a, b) => (b.date + b.order).localeCompare(a.date + a.order)).slice(0, 80);
	}
	function syllabusOverview() {
		let behind = 0;
		const rows = GROUPS.map((g, gi) => {
			const cells = {};
			SUBJECTS.forEach((c, ci) => {
				const p = gi === 8 ? syllabusFor(c).percentage : Math.round(Math.max(8, Math.min(90, expected + ((gi * 11 + ci * 17) % 41) - 22)) * 10) / 10;
				const st = p >= expected + 10 ? "ahead" : p < expected - 10 ? "behind" : "on track";
				if (st === "behind") behind++;
				cells[c] = { percentage: p, expected, status: st, covered: Math.round((p / 100) * 12), total: 12 };
			});
			return { group: g, cells };
		});
		return { courses: SUBJECTS, rows, behind };
	}

	// fake Razorpay checkout, drawn inside the device frame
	window.Razorpay = function (opts) {
		this.open = () => {
			const scr = document.getElementById("screen");
			const ov = document.createElement("div");
			ov.className = "rzp";
			ov.style.top = scr.scrollTop + "px";
			ov.style.height = scr.clientHeight + "px";
			const amt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(opts.amount / 100);
			ov.innerHTML = `<div class="rzp-card"><div class="rzp-head"><b>${esc(S.brand.name)}</b><span>${esc(opts.description || "")}</span><div class="rzp-amt">${amt}</div></div>
				<div class="rzp-body"><div class="rzp-k">UPI</div><button type="button" class="rzp-opt" data-m="upi"><b>Pay by any UPI app</b><span>Google Pay, PhonePe, Paytm, BHIM</span></button>
				<div class="rzp-k">Cards &amp; netbanking</div><button type="button" class="rzp-opt" data-m="card"><b>Card</b><span>Visa, Mastercard, RuPay</span></button><button type="button" class="rzp-opt" data-m="nb"><b>Netbanking</b><span>All major Indian banks</span></button>
				<button type="button" class="rzp-x">Cancel</button><p class="rzp-note">Demo checkout. No money moves.</p></div></div>`;
			scr.appendChild(ov);
			ov.querySelector(".rzp-x").onclick = () => { ov.remove(); opts.modal && opts.modal.ondismiss && opts.modal.ondismiss(); };
			ov.querySelectorAll(".rzp-opt").forEach((b) => (b.onclick = async () => {
				b.innerHTML = "<b>Processing…</b>";
				await sleep(900);
				ov.innerHTML = `<div class="rzp-card"><div class="rzp-done">✓</div><p style="text-align:center"><b>Payment successful</b><br>${amt}</p></div>`;
				await sleep(900);
				ov.remove();
				opts.handler({ razorpay_payment_id: "pay_DEMO" + Date.now(), razorpay_order_id: opts.order_id, razorpay_signature: "demo" });
			}));
		};
	};

	// ------------------------------------------------------------------ v0.5 demo data: modules, accounts, calendar, leave
	S.modules = { fees: true, accounts: true, homework: true, learning: true, report_cards: true, circulars: true, leave: true, calendar: true, staff: true };
	S.accountsMode = "full";
	const MOD_LABELS = {
		fees: "Fees & online payment", accounts: "Accounts dashboard & Tally export", homework: "Homework & diary",
		learning: "Lessons, syllabus & teacher notes", report_cards: "Report cards", circulars: "Circulars",
		leave: "Leave requests from parents", calendar: "Calendar & photo gallery", staff: "Staff attendance on dashboard",
	};

	// financial year April–March
	const fyStart = new Date(TODAY.getMonth() >= 3 ? TODAY.getFullYear() : TODAY.getFullYear() - 1, 3, 1);
	const FY = `${fyStart.getFullYear()}-${fyStart.getFullYear() + 1}`;
	const L = 1e5;
	function accountsMonthly() {
		const out = [];
		for (let m = 0; m < 12; m++) {
			const d = new Date(fyStart.getFullYear(), 3 + m, 1);
			const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
			let income = 0, expense = 0;
			if (d <= TODAY) {
				const frac = d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear() ? Math.min(1, TODAY.getDate() / 30) : 1;
				const big = [4, 7, 10, 1].includes(d.getMonth());
				income = Math.round(((big ? 228 + (m % 3) * 6 : 9 + ((m * 7) % 9)) * L) * frac);
				expense = Math.round(((33 + ((m * 5) % 6)) * L + (d.getMonth() === 5 ? 18 * L : 0)) * frac);
			}
			out.push({ key, income, expense, surplus: income - expense });
		}
		return out;
	}
	S.approvals = [
		{ doctype: "Purchase Invoice", name: "ACC-PINV-2026-00041", who: "Sai Stationers", amount: 38500, date: iso(addDays(TODAY, -2)), what: "Notebooks and chart paper for October", by: "Meena (Accounts)" },
		{ doctype: "Purchase Invoice", name: "ACC-PINV-2026-00042", who: "MSEDCL", amount: 42150, date: iso(addDays(TODAY, -1)), what: "Electricity bill, September", by: "Meena (Accounts)" },
		{ doctype: "Expense Claim", name: "HR-EXP-2026-00017", who: "Anil Jadhav", amount: 1840, date: iso(addDays(TODAY, -1)), what: "Diesel for school bus 2", by: "Anil Jadhav" },
		{ doctype: "Expense Claim", name: "HR-EXP-2026-00018", who: "Kavita Joshi", amount: 650, date: T, what: "Science lab chemicals (local purchase)", by: "Kavita Joshi" },
	];
	function accountsSummary() {
		if (S.accountsMode === "tally") {
			const recs = Object.values(FEES).flatMap((f) => f.pays).filter((p) => p.date.slice(0, 7) === T.slice(0, 7));
			return { mode: "tally", company: S.brand.name, fiscal_year: FY, currency: "INR", can_approve: true, tally_company: S.brand.name,
				last_export: S.lastExport || { on: iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)), range: `Previous month · 412 vouchers · Meena (Accounts)` },
				month_invoices: 120, month_receipts: 380 + recs.length, month_received: 1846000 + (S.paidToday || 0),
				cfg: { party_mode: "student", income_ledger: "", cash_ledger: "Cash", bank_ledger: "HDFC Bank", debtors_group: "Sundry Debtors" } };
		}
		const monthly = accountsMonthly();
		const cur = T.slice(0, 7);
		const upto = monthly.filter((r) => r.key <= cur);
		const inc = upto.reduce((a, r) => a + r.income, 0), exp = upto.reduce((a, r) => a + r.expense, 0);
		const salary = Math.round(exp * 0.71);
		return {
			mode: "full", company: S.brand.name, fiscal_year: FY, currency: "INR", can_approve: true, monthly,
			year: { income: inc, expense: exp, surplus: inc - exp, margin_pct: inc ? Math.round(((inc - exp) / inc) * 1000) / 10 : null },
			this_month: monthly.find((r) => r.key === cur) || { income: 0, expense: 0, surplus: 0 },
			expense_heads: [
				{ label: "Salaries", amount: salary }, { label: "Transport (fuel & upkeep)", amount: Math.round(exp * 0.08) },
				{ label: "Electricity & water", amount: Math.round(exp * 0.05) }, { label: "Building maintenance", amount: Math.round(exp * 0.05) },
				{ label: "Stationery & printing", amount: Math.round(exp * 0.04) }, { label: "Events & sports", amount: Math.round(exp * 0.03) },
				{ label: "Other", amount: Math.round(exp * 0.04) },
			],
			income_heads: [{ label: "Tuition Fees", amount: Math.round(inc * 0.84) }, { label: "Transport Fees", amount: Math.round(inc * 0.11) },
				{ label: "Activity Fees", amount: Math.round(inc * 0.04) }, { label: "Bank interest", amount: Math.round(inc * 0.01) }],
			salary: { amount: salary, share_of_income: inc ? Math.round((salary / inc) * 1000) / 10 : null },
			balances: [{ account: "HDFC Bank – Main", type: "Bank", balance: 4210500 + (S.paidToday || 0) }, { account: "SBI – Fee Collection", type: "Bank", balance: 1862300 },
				{ account: "Cash in hand", type: "Cash", balance: 86200 }, { account: "Petty cash", type: "Cash", balance: 9450 }],
			cash_today: { received: 182500 + (S.paidToday || 0), paid: 44650 },
			payables: { total: 612400, overdue: 121800, due_this_week: 90650, bills: [
				{ name: "ACC-PINV-2026-00031", supplier: "Kolhapur Bus Services", outstanding: 121800, due_date: iso(addDays(TODAY, -11)), overdue: true, days: -11, bill_no: "KBS/0921" },
				{ name: "ACC-PINV-2026-00036", supplier: "Bright Uniforms", outstanding: 90650, due_date: iso(addDays(TODAY, 4)), overdue: false, days: 4, bill_no: "BU-2210" },
				{ name: "ACC-PINV-2026-00038", supplier: "Sangli Cleaning Co.", outstanding: 48000, due_date: iso(addDays(TODAY, 12)), overdue: false, days: 12, bill_no: "SCC-118" },
				{ name: "ACC-PINV-2026-00039", supplier: "Navneet Publications", outstanding: 351950, due_date: iso(addDays(TODAY, 24)), overdue: false, days: 24, bill_no: "NP/OCT/77" }] },
			approvals: S.approvals,
			recent: [
				...(S.paidToday ? [{ date: T, type: "Receive", party: STUDENTS[0].name, mode: "UPI", amount: S.paidToday }] : []),
				{ date: T, type: "Receive", party: "Ananya Kulkarni", mode: "UPI", amount: 15000 }, { date: T, type: "Pay", party: "MSEDCL", mode: "Bank transfer", amount: 39800 },
				{ date: T, type: "Receive", party: "Krishna More", mode: "Cash", amount: 12000 }, { date: iso(addDays(TODAY, -1)), type: "Pay", party: "Staff salaries (advance)", mode: "Bank transfer", amount: 120000 },
				{ date: iso(addDays(TODAY, -1)), type: "Receive", party: "Navya Jadhav", mode: "UPI", amount: 12000 },
			],
		};
	}

	// Tally (mirrors schoolos/api/compute_accounts.py)
	function tallyData(from, to) {
		const invoices = [], payments = [];
		STUDENTS.forEach((s) => {
			FEES[s.id].invs.forEach((v) => { if (v.posting_date >= from && v.posting_date <= to) invoices.push({ name: v.invoice, date: v.posting_date, student_name: s.name, heads: v.heads }); });
			FEES[s.id].pays.forEach((p, k) => { if (p.date >= from && p.date <= to) payments.push({ name: `ACC-PAY-${p.date.slice(0, 4)}-${pad(s.roll)}${k}`, date: p.date, student_name: s.name, amount: p.amount, cash: p.mode === "Cash", reference: p.reference }); });
		});
		const vouchers = [], ledgers = [], seen = new Set();
		const need = (n, parent) => { if (!seen.has(n)) { seen.add(n); ledgers.push({ name: n, parent }); } };
		invoices.forEach((i) => {
			need(i.student_name, "Sundry Debtors");
			const total = i.heads.reduce((a, h) => a + h.amount, 0);
			i.heads.forEach((h) => need(h.head, "Direct Incomes"));
			vouchers.push({ type: "Sales", number: i.name, date: i.date, party: i.student_name, narration: `Fees: ${i.student_name}`,
				entries: [{ ledger: i.student_name, amount: total }, ...i.heads.map((h) => ({ ledger: h.head, amount: -h.amount }))] });
		});
		payments.forEach((p) => {
			need(p.student_name, "Sundry Debtors");
			vouchers.push({ type: "Receipt", number: p.name, date: p.date, party: p.student_name, narration: `Fee received: ${p.student_name}${p.reference ? ` (${p.reference})` : ""}`,
				entries: [{ ledger: p.cash ? "Cash" : "HDFC Bank", amount: p.amount }, { ledger: p.student_name, amount: -p.amount }] });
		});
		vouchers.sort((a, b) => a.date.localeCompare(b.date));
		return { invoices, payments, vouchers, ledgers };
	}
	const xe = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
	function tallyXml(part, from, to) {
		const d = tallyData(from, to);
		const head = `<ENVELOPE>\n<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n<BODY><IMPORTDATA>\n<REQUESTDESC><REPORTNAME>${part === "masters" ? "All Masters" : "Vouchers"}</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xe(S.brand.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>\n<REQUESTDATA>`;
		const body = part === "masters"
			? d.ledgers.map((l) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${xe(l.name)}" ACTION="Create"><NAME.LIST><NAME>${xe(l.name)}</NAME></NAME.LIST><PARENT>${xe(l.parent)}</PARENT></LEDGER></TALLYMESSAGE>`)
			: d.vouchers.map((v) => `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${v.type}" ACTION="Create"><DATE>${v.date.replace(/-/g, "")}</DATE><VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME><VOUCHERNUMBER>${xe(v.number)}</VOUCHERNUMBER><PARTYLEDGERNAME>${xe(v.party)}</PARTYLEDGERNAME><NARRATION>${xe(v.narration)}</NARRATION>${v.entries.map((e) => `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xe(e.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${e.amount > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${(-e.amount).toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`).join("")}</VOUCHER></TALLYMESSAGE>`);
		return { xml: `${head}\n${body.join("\n")}\n</REQUESTDATA>\n</IMPORTDATA></BODY>\n</ENVELOPE>`, count: part === "masters" ? d.ledgers.length : d.vouchers.length };
	}
	window.__schoolosDownload = (url, q) => {
		const scr = document.getElementById("screen");
		const ov = document.createElement("div");
		ov.className = "rzp";
		ov.style.top = scr.scrollTop + "px";
		ov.style.height = scr.clientHeight + "px";
		let title, content;
		if (q.fmt === "xlsx") {
			const d = tallyData(q.from_date, q.to_date);
			title = `Fees for Tally ${q.from_date} – ${q.to_date}.xlsx`;
			content = `<div class="scrollx"><table class="dtable"><thead><tr><th>Date</th><th>Type</th><th>No.</th><th>Ledger</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead><tbody>${d.vouchers.slice(0, 12).flatMap((v) => v.entries.map((e, i) => `<tr><td>${i ? "" : v.date}</td><td>${i ? "" : v.type}</td><td>${i ? "" : esc(v.number)}</td><td>${esc(e.ledger)}</td><td class="num">${e.amount > 0 ? e.amount.toFixed(2) : ""}</td><td class="num">${e.amount < 0 ? (-e.amount).toFixed(2) : ""}</td></tr>`)).join("")}</tbody></table></div>`;
		} else {
			const x = tallyXml(q.part, q.from_date, q.to_date);
			title = `${q.part === "masters" ? "1 Tally ledgers" : "2 Tally vouchers"} ${q.from_date} – ${q.to_date}.xml · ${x.count} ${q.part === "masters" ? "ledgers" : "vouchers"}`;
			content = `<pre class="xmlpre">${esc(x.xml.split("\n").slice(0, 16).join("\n").replace(/></g, ">\n<").split("\n").slice(0, 60).join("\n"))}\n…</pre>`;
			if (q.part !== "masters") S.lastExport = { on: T, range: `${fmt(q.from_date)} – ${fmt(q.to_date)} · ${x.count} vouchers · Demo` };
		}
		ov.innerHTML = `<div class="dl-card"><div class="dl-head"><b>Download</b><span>${esc(title)}</span></div><div class="dl-body">${content}
			<p class="rzp-note">In the real tool this file downloads to the computer. Browsers block downloads inside this preview, so here is what it contains.</p>
			<button type="button" class="dbtn primary" id="dl-close">Close</button></div></div>`;
		scr.appendChild(ov);
		ov.querySelector("#dl-close").onclick = () => ov.remove();
	};

	// calendar
	const NATIONAL = [["01-26", "Republic Day"], ["05-01", "Maharashtra Day"], ["08-15", "Independence Day"], ["10-02", "Gandhi Jayanti"], ["12-25", "Christmas"]];
	const EVENTS = [
		["Parent-Teacher Meeting", "PTM", 3, 0, "09:00", "Classrooms", "All"],
		["Unit Test 2 begins", "Exam", 6, 4, null, null, "All"],
		["Diwali vacation", "Holiday", 9, 6, null, null, "All"],
		["Annual Sports Day", "Sports", 14, 0, "08:00", "School ground", "All"],
		["Class 5 trip to Panhala Fort", "Trip", 18, 0, "07:00", "Panhala", "Group"],
		["Science Exhibition", "Event", 21, 1, "10:00", "School hall", "All"],
		["Children's Day celebration", "Celebration", 26, 0, "11:00", "Assembly hall", "All"],
		["Independence Day flag hoisting", "Celebration", -67, 0, "07:30", "Ground", "All"],
		["Teachers' Day", "Celebration", -46, 0, "10:00", "Hall", "All"],
	].map(([title, type, off, len, time, place, aud]) => ({ title, type, date: iso(addDays(TODAY, off)), end_date: iso(addDays(TODAY, off + len)), time, place, aud,
		details: type === "Trip" ? "Students should carry water, cap and a packed lunch. Return by 5 pm." : type === "PTM" ? "Report cards will be shared by class teachers." : "" }));
	function calendarMonth(year, month, student) {
		const ym = `${year}-${pad(month)}`;
		const items = [];
		EVENTS.forEach((e) => { if (e.date.slice(0, 7) <= ym && e.end_date.slice(0, 7) >= ym && (e.aud === "All" || S.role !== "principal")) items.push({ ...e }); });
		NATIONAL.forEach(([md, name]) => { const d = `${year}-${md}`; if (d.slice(0, 7) === ym) items.push({ date: d, end_date: d, type: "Holiday", title: name }); });
		SUBJECTS.slice(0, 5).forEach((c, k) => { const d = iso(addDays(TODAY, 6 + k)); if (d.slice(0, 7) === ym && new Date(d).getDay() !== 0) items.push({ date: d, end_date: d, type: "Exam", title: `Unit Test 2 – ${c}`, time: "09:00", place: "Class 5 - A" }); });
		if (student && S.modules.fees) FEES[student] && FEES[student].invs.forEach((v) => { if (v.outstanding > 0 && v.due_date.slice(0, 7) === ym) items.push({ date: v.due_date, end_date: v.due_date, type: "Fee due", title: "Fee due", amount: v.outstanding }); });
		items.sort((a, b) => a.date.localeCompare(b.date));
		const to = iso(addDays(TODAY, 30));
		return { year, month, items, upcoming: items.filter((x) => x.end_date >= T && x.date <= to).slice(0, 12) };
	}
	function makePhoto(seed, label, c1, c2) {
		const cv = document.createElement("canvas");
		cv.width = 640; cv.height = 440;
		const g = cv.getContext("2d");
		const sky = g.createLinearGradient(0, 0, 0, 440);
		sky.addColorStop(0, c1); sky.addColorStop(1, c2);
		g.fillStyle = sky; g.fillRect(0, 0, 640, 440);
		g.fillStyle = "rgba(255,255,255,.18)";
		for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((seed * 97 + i * 131) % 640, 60 + ((seed * 31 + i * 53) % 140), 30 + ((i * 17) % 40), 0, Math.PI * 2); g.fill(); }
		g.fillStyle = "#3f7d3a"; g.fillRect(0, 330, 640, 110);
		g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 3;
		for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, 350 + i * 22); g.lineTo(640, 350 + i * 22); g.stroke(); }
		for (let i = 0; i < 7; i++) {
			const x = 50 + i * 85 + ((seed * 13 + i * 7) % 20), y = 300 - ((seed + i) % 3) * 6;
			g.fillStyle = ["#e94f37", "#f3a63a", "#2a6fdb", "#ffffff", "#8b6fd6", "#1f9e89", "#d65f8b"][(seed + i) % 7];
			g.fillRect(x - 10, y, 20, 38); g.beginPath(); g.arc(x, y - 12, 11, 0, Math.PI * 2); g.fillStyle = "#c58c5e"; g.fill();
		}
		g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 400, 640, 40);
		g.fillStyle = "#fff"; g.font = "bold 20px system-ui, sans-serif"; g.fillText(label, 16, 427);
		try { return cv.toDataURL("image/jpeg", 0.8); } catch (e) { return ""; }
	}
	let ALBUMS = null;
	function albums() {
		if (!ALBUMS) {
			const mk = (name, title, off, n, c1, c2, caps) => ({ name, title, date: iso(addDays(TODAY, off)),
				photos: [...Array(n)].map((_, i) => ({ image: makePhoto(i + name.length * 3, caps[i % caps.length], c1, c2), caption: caps[i % caps.length] })) });
			ALBUMS = [
				mk("AL-3", "Independence Day", -67, 6, "#ff9933", "#ffd9a8", ["Flag hoisting", "March past", "Patriotic songs", "Prize giving", "Class 5 group", "Sweets distribution"]),
				mk("AL-2", "Inter-house Sports Week", -30, 8, "#3d8bd9", "#bfe0ff", ["100 m race", "Relay finals", "Kho-kho", "Tug of war", "House captains", "Medal winners", "Long jump", "Closing ceremony"]),
				mk("AL-1", "Teachers' Day", -46, 5, "#8b6fd6", "#e5dcff", ["Students as teachers", "Cards for teachers", "Assembly", "Skit", "Thank-you song"]),
			];
		}
		return ALBUMS;
	}

	// leave
	const LEAVES = [
		{ name: "EDU-SLA-2026-00031", student: STUDENTS[0].id, student_name: STUDENTS[0].name, student_group: SECTION, from_date: iso(addDays(TODAY, 2)), to_date: iso(addDays(TODAY, 3)), reason: "Family function in Kolhapur.", total_leave_days: 2, status: "Pending" },
		{ name: "EDU-SLA-2026-00027", student: STUDENTS[0].id, student_name: STUDENTS[0].name, student_group: SECTION, from_date: iso(addDays(TODAY, -9)), to_date: iso(addDays(TODAY, -9)), reason: "Fever, doctor advised rest.", total_leave_days: 1, status: "Approved", schoolos_decision_note: "Get well soon.", decided_by: "Sunita Kulkarni" },
		{ name: "EDU-SLA-2026-00033", student: STUDENTS[8].id, student_name: STUDENTS[8].name, student_group: SECTION, from_date: iso(addDays(TODAY, 1)), to_date: iso(addDays(TODAY, 1)), reason: "Dental appointment in the morning.", total_leave_days: 1, status: "Pending" },
		{ name: "EDU-SLA-2026-00034", student: STUDENTS[14].id, student_name: STUDENTS[14].name, student_group: SECTION, from_date: iso(addDays(TODAY, 4)), to_date: iso(addDays(TODAY, 8)), reason: "Travelling to native place for a wedding.", total_leave_days: 5, status: "Pending" },
	];

	const CONTEXT = {
		principal: { user: "principal@demo.school", full_name: "Priya Deshmukh", views: ["principal", "fees", "accounts"], roles: ["School Principal"] },
		teacher: { user: "teacher@demo.school", full_name: "Sunita Kulkarni", views: ["teacher"], roles: ["Instructor"] },
		parent: { user: "parent@demo.school", full_name: "Suresh Patil", views: ["parent"], roles: ["Guardian"] },
		student: { user: "student1@demo.school", full_name: "Aarav Patil", views: ["student"], roles: ["Student"], student: STUDENTS[0].id },
	};

	// ------------------------------------------------------------------ fake server for the real dashboard code
	function route(method, args) {
		switch (method) {
			case "schoolos.api.dashboard.get_context": {
				const c = CONTEXT[S.role];
				const m = S.modules;
				const views = c.views.filter((v) => (v !== "fees" || m.fees) && (v !== "accounts" || m.accounts)).concat(m.calendar ? ["calendar"] : []);
				return { ...c, views, modules: { ...m }, accounts_mode: S.accountsMode, children: [], branding: {}, today: T };
			}
			case "schoolos.api.dashboard.principal": return principalData();
			case "schoolos.api.dashboard.teacher": return teacherData();
			case "schoolos.api.dashboard.parent": return parentData();
			case "schoolos.api.dashboard.student": return studentData(args.student || CONTEXT.student.student);
			case "schoolos.api.homework.post_options":
				return { groups: [SECTION, `Class 6 - B (${AY})`, `Class 7 - A (${AY})`], courses: { [SECTION]: SUBJECTS, [`Class 6 - B (${AY})`]: SUBJECTS, [`Class 7 - A (${AY})`]: SUBJECTS },
					types: ["Homework", "Classwork", "Project", "Note"], whatsapp_allowed: S.settings.homeworkWA };
			case "schoolos.api.homework.post": {
				const n = `HW-${pad(HW.length + 1).padStart(4, "0")}`;
				HW.unshift({ name: n, entry_type: args.entry_type || "Homework", title: args.title, course: args.course || "", student_group: args.student_group,
					instructor_name: "Sunita Kulkarni", date: T, due_date: args.due_date || "", details: esc(args.details || ""), recipients_count: 30, mine: true });
				if (S.settings.homework) addAlerts("Homework", STUDENTS.slice(0, 30), args.send_whatsapp ? ["WhatsApp", "Email"] : ["Email"], args.title);
				return { name: n, students: 30 };
			}
		}
		const gate = { "schoolos.api.fees": "fees", "schoolos.api.accounts": "accounts", "schoolos.api.homework": "homework", "schoolos.api.learning": "learning",
			"schoolos.api.leave": "leave", "schoolos.api.school_calendar": "calendar" }[method.split(".").slice(0, 3).join(".")];
		if (gate && !S.modules[gate]) throw new Error(`${MOD_LABELS[gate]} is turned off for this school`);
		switch (method) {
			case "schoolos.api.accounts.summary": return accountsSummary();
			case "schoolos.api.accounts.decide": {
				const i = S.approvals.findIndex((x) => x.name === args.name);
				const x = S.approvals.splice(i, 1)[0];
				return { name: args.name, status: Number(args.approve) ? "Approved" : "Rejected", who: x && x.who };
			}
			case "schoolos.api.accounts.tally_preview": {
				const d = tallyData(args.from_date, args.to_date);
				return { invoices: d.invoices.length, receipts: d.payments.length, ledgers: d.ledgers.length,
					billed: d.invoices.reduce((a, i) => a + i.heads.reduce((b, h) => b + h.amount, 0), 0), received: d.payments.reduce((a, p) => a + p.amount, 0), sample: d.vouchers.slice(0, 4) };
			}
			case "schoolos.api.school_calendar.month": {
				const st = S.role === "parent" ? STUDENTS[0].id : S.role === "student" ? STUDENTS[0].id : null;
				return calendarMonth(Number(args.year), Number(args.month), st);
			}
			case "schoolos.api.school_calendar.albums": return albums().map((a) => ({ name: a.name, title: a.title, date: a.date, cover: a.photos[0].image, count: a.photos.length, photos: a.photos.slice(0, 4) }));
			case "schoolos.api.school_calendar.album": return albums().find((a) => a.name === args.name);
			case "schoolos.api.leave.for_student": return LEAVES.filter((l) => l.student === args.student);
			case "schoolos.api.leave.pending": return LEAVES.filter((l) => l.status === "Pending");
			case "schoolos.api.leave.apply": {
				const days = Math.round((new Date(args.to_date) - new Date(args.from_date)) / 864e5) + 1;
				if (days < 1) throw new Error("The end date is before the start date");
				if (!String(args.reason || "").trim()) throw new Error("Please give a reason");
				const st = STUDENTS.find((x) => x.id === args.student);
				LEAVES.unshift({ name: `EDU-SLA-2026-000${40 + LEAVES.length}`, student: args.student, student_name: st.name, student_group: SECTION, from_date: args.from_date, to_date: args.to_date, reason: esc(args.reason), total_leave_days: days, status: "Pending" });
				return LEAVES[0];
			}
			case "schoolos.api.leave.withdraw": { const i = LEAVES.findIndex((l) => l.name === args.name); LEAVES.splice(i, 1); return "ok"; }
			case "schoolos.api.leave.decide": {
				const l = LEAVES.find((x) => x.name === args.name);
				l.status = Number(args.approve) ? "Approved" : "Rejected";
				l.schoolos_decision_note = esc(args.note || "");
				l.decided_by = "Sunita Kulkarni";
				addAlerts("Leave", [STUDENTS.find((x) => x.id === l.student)], ["Email"], `Leave ${l.status.toLowerCase()}`);
				return l;
			}
			case "schoolos.api.fees.summary": return feeSummary();
			case "schoolos.api.fees.for_student": return feesFor(args.student);
			case "schoolos.api.fees.remind": {
				const ids = args.students ? JSON.parse(args.students) : STUDENTS.filter((x) => feesFor(x.id).overdue > 0).map((x) => x.id);
				S.reminded = S.reminded || {};
				ids.forEach((id) => (S.reminded[id] = T));
				addAlerts("Fee Reminder", STUDENTS.filter((x) => ids.includes(x.id)), ["WhatsApp", "Email"], "Fee reminder");
				const fam = args.students ? ids.length : 212;
				S.remindedCount = (S.remindedCount || 0) + fam;
				return { students: fam, messages: fam * 2 };
			}
			case "schoolos.api.learning.syllabus_overview": return syllabusOverview();
			case "schoolos.api.learning.student_progress": return progressFor(args.student);
			case "schoolos.api.learning.activity": return activityFor(args.student);
			case "schoolos.api.learning.lesson_options": return { groups: [SECTION], courses: { [SECTION]: SUBJECTS.map((c) => syllabusFor(c)) } };
			case "schoolos.api.learning.group_students": return STUDENTS.map((x) => ({ student: x.id, student_name: x.name, group_roll_number: x.roll }));
			case "schoolos.api.learning.post_lesson": {
				LESSONS.unshift({ name: "L" + Date.now(), date: T, student_group: args.student_group, course: args.course, topic: args.topic || "", completed: Number(args.completed) ? 1 : 0,
					instructor_name: "Sunita Kulkarni", notes: `<p>${esc(args.notes || "")}</p>` });
				const c = syllabusFor(args.course);
				return { name: "L", coverage: { percentage: c.percentage, expected: c.expected, status: c.status, covered: c.covered, total: c.total } };
			}
			case "schoolos.api.learning.post_note": {
				if (Number(args.share)) (NOTES[args.student] = NOTES[args.student] || []).unshift({ date: T, type: args.type, log: args.log, author: "Sunita Kulkarni" });
				return { name: "N" };
			}
			case "education.education.billing.get_payment_options": {
				const inv = Object.values(FEES).flatMap((f) => f.invs).find((v) => v.invoice === args.docname);
				return { key_id: "rzp_test_demo", order_id: "order_DEMO" + Date.now(), amount: (inv ? inv.outstanding : 0) * 100, currency: "INR", name: S.brand.name,
					description: `Fees · ${args.docname}`, prefill: { contact: args.phone } };
			}
			case "education.education.billing.handle_payment_success": {
				for (const f of Object.values(FEES)) {
					const v = f.invs.find((x) => x.invoice === args.against_invoice);
					if (v) { f.pays.push({ date: T, amount: v.outstanding, mode: "UPI", invoice: v.invoice, reference: args.response.razorpay_payment_id }); S.paidToday = (S.paidToday || 0) + v.outstanding; v.outstanding = 0; }
				}
				return null;
			}
		}
		throw new Error("Not in this prototype");
	}
	const realFetch = window.fetch ? window.fetch.bind(window) : null;
	window.fetch = async (url, opts = {}) => {
		const u = String(url);
		if (!u.startsWith("/api/method/")) return realFetch ? realFetch(url, opts) : Promise.reject(new Error("offline"));
		const [p, q] = u.replace("/api/method/", "").split("?");
		const args = Object.fromEntries(new URLSearchParams(q || ""));
		if (opts.body) Object.assign(args, JSON.parse(opts.body));
		await sleep(220);
		try {
			const message = route(p, args);
			return { ok: true, status: 200, statusText: "OK", json: async () => ({ message }) };
		} catch (e) {
			return { ok: false, status: 417, statusText: "Error", json: async () => ({ exception: e.message }) };
		}
	};
	try { if (navigator.serviceWorker) Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true }); } catch (e) {}

	// ------------------------------------------------------------------ alerts log
	function addAlerts(type, students, channels, ref) {
		const status = S.settings.testMode ? "Dry Run" : "Sent";
		const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
		students.forEach((s, i) => channels.forEach((ch) => {
			if (ch === "WhatsApp" && !S.settings.whatsapp) return;
			if (ch === "Email" && !S.settings.email) return;
			S.alerts.unshift({ type, channel: ch, status: ch === "WhatsApp" && i === 7 && status === "Sent" ? "Failed" : status, to: ch === "WhatsApp" ? `91 98${pad(10 + i)}5 4${pad(i)}21` : `guardian${i + 1}@example.com`,
				name: `Parent of ${s.name.split(" ")[0]}`, student: s.name, ref, date: T, time });
		}));
	}
	addAlerts("Absence", [STUDENTS[0]], ["WhatsApp", "Email"], "Attendance " + fmt(T));
	addAlerts("Circular", STUDENTS.slice(2, 6), ["WhatsApp", "Email"], "Parent-Teacher Meeting on Saturday");
	addAlerts("Report Card", STUDENTS.slice(0, 2), ["WhatsApp", "Email"], "Term 1 Progress Report");
	S.alerts.push({ type: "Absence", channel: "WhatsApp", status: "Failed", to: "91 7020 11 2233", name: "Parent of Kabir", student: "Kabir Pawar", ref: "Attendance", date: iso(addDays(TODAY, -1)), time: "09:42", error: "Recipient phone number not on WhatsApp" });

	// ------------------------------------------------------------------ screens
	const SCREENS = [
		{ group: "Parent", items: [
			{ id: "parent", name: "Parent app", kind: "app", role: "parent", dev: "phone", who: "Parent · Suresh Patil", desc: "Both children on one login: attendance, absences, homework due, latest marks and report card. Tap Details for one child. Try the मराठी switch in the top bar." },
			{ id: "progress", name: "Child progress", kind: "app", role: "parent", dev: "phone", steps: ["child", "progress"], who: "Parent · Aarav's progress", desc: "Every subject: chapters finished against where the class should be by now (the orange marker), average and trend, class notes from each lesson and notes from teachers." },
			{ id: "childfees", name: "Fees & pay", kind: "app", role: "parent", dev: "phone", steps: ["child", "fees"], who: "Parent · Aarav's fees", desc: "Dues, invoices by fee head and payment history. Tap Pay, enter a mobile number, and pay through the (demo) Razorpay checkout; the fee moves to paid with a receipt." },
			{ id: "activity", name: "Activity timeline", kind: "app", role: "parent", dev: "phone", steps: ["child", "activity"], who: "Parent · everything about Aarav", desc: "Everything that happened, day by day: absences, homework, lessons taught, marks, teacher notes, fee payments and report cards." },
			{ id: "leave", name: "Leave request", kind: "app", role: "parent", dev: "phone", steps: ["child", "leave"], who: "Parent · apply for leave", desc: "Apply for leave in two taps. The class teacher approves or rejects it from their app; approved days show as leave instead of absent and no absence alert goes out." },
			{ id: "calendar", name: "Calendar & gallery", kind: "app", role: "parent", start: "calendar", dev: "phone", who: "Parent · school calendar", desc: "Holidays, exams, PTMs, trips and your own fee due dates in one month view. Tap a day for details, use Next/Previous, and open a photo album." },
			{ id: "home", name: "Install on phone", kind: "phone", who: "Parent", desc: "The dashboard installs on the home screen with the school's own name and logo. No app store needed. Tap the school icon to open it." },
			{ id: "whatsapp", name: "WhatsApp alerts", kind: "phone", who: "Parent", desc: "What parents receive on WhatsApp, from the school's own business number. Switch the language to see the Marathi templates." },
			{ id: "email", name: "Alert emails", kind: "desk", who: "Parent", desc: "The same alerts by email. Language follows Settings → Alert language." },
		] },
		{ group: "Student", items: [
			{ id: "student", name: "Student app", kind: "app", role: "student", dev: "phone", who: "Student · Aarav Patil", desc: "Homework and diary, today's timetable, results and notices. Use the Progress, Fees and Activity tabs." },
		] },
		{ group: "Teacher", items: [
			{ id: "teacher", name: "Teacher app", kind: "app", role: "teacher", dev: "phone", who: "Teacher · Sunita Kulkarni", desc: "Today's periods (current one highlighted), leave requests to approve, attendance still to take, absentees and marks to enter. Post homework, log today's lesson against the syllabus, or write a note about a student; all of it shows up in the parent app." },
			{ id: "attendance", name: "Mark attendance", kind: "desk", who: "Teacher · Frappe tool", desc: "Frappe Education's attendance tool. Submitting sends an absence alert to each absent child's parents." },
			{ id: "marks", name: "Enter marks", kind: "desk", who: "Teacher · Frappe tool", desc: "Marks entry with the CBSE components. Totals and grades update as you type." },
		] },
		{ group: "Principal", items: [
			{ id: "accounts", name: "Accounts dashboard", kind: "app", role: "principal", start: "accounts", mode: "full", dev: "desktop", who: "Principal / trustee · full accounting", desc: "The school's books at a glance: surplus for the financial year, income vs expenses by month, cash and bank balances, salaries as a share of income, where the money goes and bills to pay. Approve or reject supplier bills and staff expense claims right here." },
			{ id: "tally", name: "Tally export", kind: "app", role: "principal", start: "accounts", mode: "tally", dev: "desktop", who: "Accounts · school keeps books in Tally", desc: "For schools whose CA uses Tally. Pick dates, check what will be exported, then download the ledgers (first time) and the fee vouchers to import into Tally. Each fee bill becomes a Sales voucher and each payment a Receipt voucher." },
			{ id: "fees", name: "Fees dashboard", kind: "app", role: "principal", start: "fees", dev: "desktop", who: "Principal / accounts", desc: "Collection for a 2,000-student school: collected vs billed, overdue ageing, pending by class and fee head, how parents pay, and every family with dues. Tick students and send reminders, or remind everyone overdue at once." },
			{ id: "principal", name: "Principal dashboard", kind: "app", role: "principal", dev: "desktop", who: "Principal · Priya Deshmukh", desc: "The whole school at a glance for a 2,000-student school: today's attendance, fee collection, classes not yet marked, staff present, students at risk, subject averages and the syllabus coverage matrix." },
		] },
		{ group: "School office", items: [
			{ id: "import", name: "Import students", kind: "desk", who: "Office · admin", desc: "Onboard a school from one Excel sheet. Validate first, then import in the background." },
			{ id: "rctemplate", name: "Report card setup", kind: "desk", who: "Office · admin", desc: "One template per class and year. Generate a whole section's report cards in one click." },
			{ id: "reportcard", name: "Report card PDF", kind: "desk", who: "Office · parents download it", desc: "The printed report card, generated from submitted marks and attendance. CBSE and Maharashtra board layouts." },
			{ id: "circular", name: "Send a circular", kind: "desk", who: "Office · principal", desc: "Notices to the whole school, a class or one section, on WhatsApp and email." },
			{ id: "modules", name: "Modules on / off", kind: "desk", who: "Office · admin", desc: "Everything is on by default. Switch off what a school doesn't use and it disappears from every app screen, menu and alert. Data is kept. Try turning off Fees, then open the Parent app." },
			{ id: "branding", name: "Settings & branding", kind: "desk", who: "Office · admin", desc: "Each school's own name and colour, alert switches, language and WhatsApp number. Changes here show up in every app screen." },
			{ id: "alertlog", name: "Alert log", kind: "desk", who: "Office · admin", desc: "Every WhatsApp and email the system sent or tried, with failures and reasons." },
		] },
	];
	const ALL = SCREENS.flatMap((g) => g.items);

	function renderIndex() {
		$("#groups").innerHTML = SCREENS.map((g) => `<div class="group"><h4>${g.group}</h4><div class="nav">${g.items
			.map((it) => `<button type="button" data-go="${it.id}" aria-current="${S.current && S.current.id === it.id}"><span>${it.name}</span><span class="kind">${it.kind === "app" ? "App" : it.kind === "phone" ? "Phone" : "Desk"}</span></button>`)
			.join("")}</div></div>`).join("");
		$("#wm").innerHTML = `${esc(S.brand.name)}<small>SchoolOS · working prototype</small>`;
	}

	function frame(kind, url) {
		const f = $("#frame");
		if (kind === "phone") {
			f.innerHTML = `<div class="phone"><div class="screen" id="screen" style="--brand-shell:${S.brand.color}"></div></div>`;
		} else {
			f.innerHTML = `<div class="desktop"><div class="chrome"><i></i><i></i><i></i><div class="url">${esc(url)}</div></div><div class="screen" id="screen"></div></div>`;
		}
		return $("#screen");
	}

	function go(id) {
		let sc = ALL.find((s) => s.id === id) || ALL[0];
		if (sc.id === "accounts" && S.chosenMode === "tally") sc = { ...sc, mode: "tally" };
		S.current = sc;
		renderIndex();
		$("#who").textContent = sc.who;
		$("#title").textContent = sc.name;
		$("#desc").textContent = sc.desc;
		const seg = $("#devseg");
		seg.hidden = sc.kind !== "app";
		try { history.replaceState(null, "", "#" + id); } catch (e) {}
		if (sc.kind === "app") {
			const dev = S.device[id] || sc.dev;
			[...seg.children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dev === dev)));
			mountApp(sc.role, frame(dev, "school.example.com/school"), sc);
		} else if (sc.kind === "phone") {
			const scr = frame("phone");
			(id === "home" ? renderHome : renderWhatsApp)(scr);
		} else {
			const scr = frame("desktop", ({ modules: "school.example.com/desk/schoolos-settings#modules", email: "mail.example.com/inbox", reportcard: "school.example.com/api/method/schoolos.api.report_card.download" })[id] || `school.example.com/desk/${({ attendance: "student-attendance-tool", marks: "assessment-result-tool", import: "schoolos-student-import/IMP-0001", rctemplate: "report-card-template/Class 5 Term 1 (CBSE)", circular: "schoolos-circular/new", branding: "schoolos-settings", alertlog: "schoolos-alert-log" })[id]}`);
			DESK[id](scr);
		}
		$("#screen").scrollTop = 0;
	}

	document.addEventListener("click", (e) => {
		const b = e.target.closest("[data-go]");
		if (b) { go(b.dataset.go); window.scrollTo({ top: 0 }); }
		const d = e.target.closest("[data-dev]");
		if (d && S.current) { S.device[S.current.id] = d.dataset.dev; go(S.current.id); }
	});

	// ------------------------------------------------------------------ real app mount
	function mountApp(role, screen, sc) {
		S.role = role;
		if (sc && sc.mode) S.accountsMode = sc.mode === "full" ? (S.chosenMode || "full") : sc.mode;
		try { localStorage.setItem("schoolos:view", (sc && sc.start) || CONTEXT[role].views[0]); } catch (e) {}
		screen.innerHTML = `<div id="sos-root" class="sos lightbox-host" style="--brand:${S.brand.color};--lbh:${screen.clientHeight}px"></div><div class="sos" style="--brand:${S.brand.color};min-height:100%">
			<header class="topbar"><div class="brand"><img src="${logo()}" alt="" class="logo"><span class="school-name">${esc(S.brand.name)}</span></div>
			<div class="user"><span id="user-name"></span><a href="/desk" id="desk-link" class="hidden">Admin</a><a href="/logout">Log out</a></div></header>
			<nav id="tabs" class="tabs" role="tablist"></nav><main id="app"><div class="loading">Loading…</div></main></div>`;
		screen.addEventListener("click", (e) => {
			const a = e.target.closest("a[href]");
			if (!a) return;
			const href = a.getAttribute("href");
			if (!href.startsWith("/")) return;
			e.preventDefault();
			e.stopPropagation();
			if (href.includes("report_card.download")) go("reportcard");
			else if (href.includes("fees.receipt")) toast("Downloads the fee receipt PDF");
			else if (href.includes("student-attendance-tool")) go("attendance");
			else if (href.includes("assessment-result-tool")) go("marks");
			else if (href.includes("schoolos-circular")) go("circular");
			else if (href === "/desk") go("branding");
			else if (href === "/logout") toast("Logs out and returns to the login page");
			else toast("Opens " + href);
		}, true);
		window.bootSchoolOS();
		if (sc && sc.steps) runSteps(screen, sc.steps);
	}
	async function waitFor(root, sel, ms = 4000) {
		const t0 = Date.now();
		while (Date.now() - t0 < ms) { const el = root.querySelector(sel); if (el) return el; await sleep(60); }
		return null;
	}
	async function runSteps(screen, steps) {
		for (const st of steps) {
			const sel = st === "child" ? `[data-student="${STUDENTS[0].id}"]:not([data-sub])` : `[data-sv="${st}"]`;
			const el = await waitFor(screen, sel);
			if (!el) return;
			el.click();
			await sleep(120);
			if (st !== "child") await waitFor(screen, `[data-sv="${st}"][aria-selected="true"]`);
		}
	}
	window.__rebootSchoolOS = () => S.current && go(S.current.id);

	// ------------------------------------------------------------------ messages
	const WA = {
		en: {
			Absence: (c) => `Dear ${c.g}, ${c.s} was marked absent today (${c.d}). If this is unexpected, please contact the school. – ${c.school}`,
			Homework: (c) => `Dear ${c.g}, new homework for ${c.s}: "${c.t}", due ${c.due}. – ${c.school}`,
			Circular: (c) => `Dear ${c.g}, a new notice from ${c.school}: "${c.t}". Read it here: ${c.url}`,
			"Report Card": (c) => `Dear ${c.g}, ${c.s}'s report card for ${c.t} has been published by ${c.school}. View or download it: ${c.url}`,
			"Fee Reminder": (c) => `Dear ${c.g}, a fee of ₹12,000 is due for ${c.s} (due date ${c.due}). Pay online or see details: ${c.url} – ${c.school}`,
		},
		mr: {
			Absence: (c) => `प्रिय ${c.g}, ${c.s} यांची आज (${c.d}) गैरहजेरी नोंदवली आहे. हे अनपेक्षित असल्यास कृपया शाळेशी संपर्क साधा. – ${c.school}`,
			Homework: (c) => `प्रिय ${c.g}, ${c.s} साठी नवीन गृहपाठ: "${c.t}", मुदत ${c.due}. – ${c.school}`,
			Circular: (c) => `प्रिय ${c.g}, ${c.school} कडून नवीन सूचना: "${c.t}". येथे वाचा: ${c.url}`,
			"Report Card": (c) => `प्रिय ${c.g}, ${c.s} यांचे ${c.t} प्रगतीपत्रक ${c.school} ने प्रसिद्ध केले आहे. येथे पहा किंवा डाउनलोड करा: ${c.url}`,
			"Fee Reminder": (c) => `प्रिय ${c.g}, ${c.s} यांचे ₹12,000 शुल्क बाकी आहे (देय तारीख ${c.due}). ऑनलाइन भरा किंवा तपशील पहा: ${c.url} – ${c.school}`,
		},
	};
	const MAIL = {
		en: {
			Absence: (c) => [`${c.s} was marked absent on ${c.d}`, `Dear ${c.g},<br><br>${c.s} was marked <b>absent</b> on ${c.d}.<br>If this is unexpected, please contact the school.<br><br>${c.school}`],
			Homework: (c) => [`Homework for ${c.s}: ${c.t}`, `Dear ${c.g},<br><br><b>Homework</b> for ${c.s} (${c.subj}): <b>${c.t}</b><br>Due: ${c.due}<br><br>Show all working in the notebook.<br><br>See all homework on the school portal: <a>${c.url}</a><br><br>${c.school}`],
			Circular: (c) => [`${c.school}: ${c.t}`, `Dear ${c.g},<br><br>${c.body}<br><br>View on the school portal: <a>${c.url}</a><br><br>${c.school}`],
			"Report Card": (c) => [`${c.s}'s report card for ${c.t} is ready`, `Dear ${c.g},<br><br>The report card for ${c.s} (${c.t}) has been published. View or download it here: <a>${c.url}</a><br><br>${c.school}`],
		},
		mr: {
			Absence: (c) => [`${c.s} यांची ${c.d} रोजी गैरहजेरी`, `प्रिय ${c.g},<br><br>${c.s} यांची ${c.d} रोजी <b>गैरहजेरी</b> नोंदवली आहे.<br>हे अनपेक्षित असल्यास कृपया शाळेशी संपर्क साधा.<br><br>${c.school}`],
			Homework: (c) => [`${c.s} साठी गृहपाठ: ${c.t}`, `प्रिय ${c.g},<br><br>${c.s} साठी <b>गृहपाठ</b> (${c.subj}): <b>${c.t}</b><br>मुदत: ${c.due}<br><br>सर्व गृहपाठ शाळेच्या पोर्टलवर पहा: <a>${c.url}</a><br><br>${c.school}`],
			Circular: (c) => [`${c.school}: ${c.t}`, `प्रिय ${c.g},<br><br>${c.body}<br><br>शाळेच्या पोर्टलवर पहा: <a>${c.url}</a><br><br>${c.school}`],
			"Report Card": (c) => [`${c.s} यांचे ${c.t} प्रगतीपत्रक तयार आहे`, `प्रिय ${c.g},<br><br>${c.s} (${c.t}) यांचे प्रगतीपत्रक प्रसिद्ध झाले आहे. येथे पहा किंवा डाउनलोड करा: <a>${c.url}</a><br><br>${c.school}`],
		},
	};
	const msgCtx = (lang, over = {}) => ({ g: lang === "mr" ? "सुरेश पाटील" : "Suresh Patil", s: lang === "mr" ? "आरव पाटील" : "Aarav Patil", d: fmt(T, { day: "2-digit", month: "short", year: "numeric" }),
		school: S.brand.name, url: "https://school.example.com/school", due: fmt(addDays(TODAY, 2), { day: "2-digit", month: "short" }), t: "", subj: "Mathematics", body: "", ...over });

	function renderWhatsApp(scr) {
		const lang = S.settings.waLang;
		const now = new Date();
		const tm = (m) => new Date(now.getTime() - m * 60000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
		const items = [
			["Report Card", msgCtx(lang, { t: lang === "mr" ? "सत्र १" : "Term 1" }), 300],
			["Circular", msgCtx(lang, { t: lang === "mr" ? "शनिवारी पालक-शिक्षक सभा" : "Parent-Teacher Meeting on Saturday" }), 140],
			["Absence", msgCtx(lang), 95],
			["Fee Reminder", msgCtx(lang), 45],
		];
		if (S.settings.homeworkWA) items.push(["Homework", msgCtx(lang, { t: "Exercise 4.2, questions 1–10" }), 20]);
		scr.innerHTML = `<div class="wa">
			<div class="wa-head"><span class="wa-av" style="background:${S.brand.color}">${initials(S.brand.name)}</span><div><b>${esc(S.brand.name)}</b><small>Business account</small></div>
				<div style="margin-left:auto" class="toggle"><button type="button" id="wa-en" class="${lang === "en" ? "p" : ""}">EN</button><button type="button" id="wa-mr" class="${lang === "mr" ? "p" : ""}">मराठी</button></div></div>
			<div class="wa-body"><span class="wa-day">${lang === "mr" ? "आज" : "Today"}</span>
				${items.map(([type, c, m]) => `<div class="wa-msg"><span class="tag">${type}</span><div>${esc(WA[lang][type](c)).replace(/(https:\/\/\S+)/, '<a>$1</a>')}</div><div class="meta">${tm(m)}</div></div>`).join("")}
				${S.settings.homeworkWA ? "" : `<span class="wa-day">${lang === "mr" ? "गृहपाठ ईमेलने जातो (सेटिंग्ज)" : "Homework goes by email (turn on WhatsApp in Settings)"}</span>`}
			</div></div>`;
		$("#wa-en", scr).onclick = () => { S.settings.waLang = "en"; renderWhatsApp(scr); };
		$("#wa-mr", scr).onclick = () => { S.settings.waLang = "mr"; renderWhatsApp(scr); };
	}

	function renderHome(scr) {
		const t = new Date();
		const apps = ["Phone", "Messages", "Camera", "Photos", "WhatsApp", "Maps", "Clock", "Settings"];
		scr.innerHTML = `<div class="home"><div class="time">${t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
			<div class="date">${t.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
			<div class="icons">${apps.slice(0, 7).map((a) => `<span class="icon"><i>${a[0]}</i>${a}</span>`).join("")}
				<button type="button" class="icon school" data-go="parent"><i style="background:${S.brand.color}">${initials(S.brand.name)}</i>${esc(S.brand.name.split(" ")[0])}</button></div>
			<div class="note"><b>Add to Home Screen</b><br>Android: open the school link in Chrome and tap <b>Install app</b> (or ⋮ → Install).<br>iPhone: open it in Safari, tap Share → <b>Add to Home Screen</b>.<br>The icon, name and colour come from Settings &amp; branding.</div></div>`;
	}

	// ------------------------------------------------------------------ desk screens
	const deskTop = (crumb, actions = "") => `<div class="desk-top"><span class="crumb">${crumb}</span><div class="actions">${actions}</div></div>`;
	const pillFor = (st) => `<span class="st ${({ Sent: "good", "Dry Run": "info", Failed: "bad", Queued: "warn", Completed: "good", "Completed with Errors": "warn", Validated: "info", Draft: "warn" })[st] || "info"}">${esc(st)}</span>`;

	const DESK = {};

	DESK.email = (scr) => {
		const lang = S.settings.lang;
		const list = [
			["Absence", msgCtx(lang)],
			["Homework", msgCtx(lang, { t: "Exercise 4.2, questions 1–10" })],
			["Circular", msgCtx(lang, { t: lang === "mr" ? "शनिवारी पालक-शिक्षक सभा" : "Parent-Teacher Meeting on Saturday", body: lang === "mr" ? "प्रिय पालक, सहामाही पालक-शिक्षक सभा शनिवारी सकाळी ९ ते १२ या वेळेत आहे." : CIRCULARS[0].message.replace(/<\/?p>/g, "") })],
			["Report Card", msgCtx(lang, { t: lang === "mr" ? "सत्र १" : "Term 1 Progress Report" })],
		].map(([type, c]) => [type, ...MAIL[lang][type](c)]);
		let sel = 0;
		const draw = () => {
			scr.innerHTML = `<div class="mail"><div class="mail-list">${list.map(([type, subj], i) => `<button type="button" data-i="${i}" aria-current="${i === sel}"><b>${esc(S.brand.name)}</b><span>${esc(subj)}</span></button>`).join("")}</div>
				<div class="mail-view"><h3>${esc(list[sel][1])}</h3><div class="from">${esc(S.brand.name)} &lt;school@example.com&gt; · to suresh@example.com</div><div class="bodytext">${list[sel][2]}</div>
				<p class="from" style="margin-top:22px">Language: ${lang === "mr" ? "Marathi" : "English"} (change in Settings &amp; branding)</p></div></div>`;
			scr.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { sel = +b.dataset.i; draw(); }));
		};
		draw();
	};

	DESK.attendance = (scr) => {
		const st = STUDENTS.map((s, i) => (i === 0 || i === 6 ? "a" : "p"));
		const draw = (done) => {
			scr.innerHTML = `<div class="desk">${deskTop(`Education › <b>Student Attendance Tool</b>`)}
			<div class="desk-body">
				<div class="dcard"><div class="fields">
					<div class="field"><label for="att-grp">Student Group</label><select id="att-grp"><option>${SECTION}</option></select></div>
					<div class="field"><label for="att-date">Date</label><input id="att-date" type="date" value="${T}"></div>
					<div class="field"><label>Summary</label><div class="row"><span class="st good">${st.filter((x) => x === "p").length} present</span><span class="st bad">${st.filter((x) => x === "a").length} absent</span><span class="st warn">${st.filter((x) => x === "l").length} leave</span></div></div>
				</div></div>
				${done ? `<div class="dcard"><h3>Attendance submitted</h3><p>${done.length} absence alert${done.length === 1 ? "" : "s"} queued for parents of ${done.map(esc).join(", ")}${S.settings.testMode ? " (Test Mode: logged, not sent)" : ""}.</p><div class="row"><button class="dbtn" data-go="whatsapp">See the WhatsApp message</button><button class="dbtn" data-go="alertlog">Open alert log</button></div></div>` : ""}
				<div class="dcard"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Students</h3><div class="row"><button class="dbtn" id="att-all">Mark all present</button><button class="dbtn primary" id="att-submit" ${done ? "disabled" : ""}>Submit attendance</button></div></div>
				<div class="scrollx"><table class="dtable"><thead><tr><th class="num">Roll</th><th>Student</th><th>Status</th></tr></thead><tbody>
				${STUDENTS.map((s, i) => `<tr><td class="num">${s.roll}</td><td>${esc(s.name)}</td><td><div class="toggle">${["p", "a", "l"].map((k) => `<button type="button" data-row="${i}" data-k="${k}" class="${st[i] === k ? k : ""}" ${done ? "disabled" : ""}>${({ p: "P", a: "A", l: "L" })[k]}</button>`).join("")}</div></td></tr>`).join("")}
				</tbody></table></div></div>
			</div></div>`;
			scr.querySelectorAll("[data-row]").forEach((b) => (b.onclick = () => { st[+b.dataset.row] = b.dataset.k; const y = scr.scrollTop; draw(); scr.scrollTop = y; }));
			const all = $("#att-all", scr);
			if (all) all.onclick = () => { st.fill("p"); draw(); };
			const sub = $("#att-submit", scr);
			if (sub) sub.onclick = () => {
				const absent = STUDENTS.filter((s, i) => st[i] === "a");
				if (S.settings.alerts && S.settings.absence) addAlerts("Absence", absent, ["WhatsApp", "Email"], "Attendance " + fmt(T));
				S.attMarked = true;
				toast(`Attendance saved for ${STUDENTS.length} students`);
				draw(absent.map((s) => s.name));
				scr.scrollTop = 0;
			};
		};
		draw();
	};

	DESK.marks = (scr) => {
		const crit = [["PT", 10], ["NB", 5], ["SE", 5], ["Exam", 80]];
		const marks = STUDENTS.slice(0, 12).map((s, i) => { const b = 0.45 + ((i * 37) % 50) / 100; return crit.map(([, m]) => Math.round(m * b)); });
		const draw = () => {
			scr.innerHTML = `<div class="desk">${deskTop(`Education › <b>Assessment Result Tool</b>`, `<button class="dbtn primary" id="mk-submit">Submit results</button>`)}
			<div class="desk-body">
				<div class="dcard"><div class="fields">
					<div class="field"><label for="mk-plan">Assessment Plan</label><select id="mk-plan"><option>Half Yearly - Mathematics</option></select></div>
					<div class="field"><label>Class</label><input value="${SECTION}" readonly></div>
					<div class="field"><label>Grading scale</label><input value="CBSE 8-Point" readonly></div>
				</div></div>
				<div class="dcard"><div class="scrollx"><table class="dtable"><thead><tr><th class="num">Roll</th><th>Student</th>${crit.map(([c, m]) => `<th class="num">${c} / ${m}</th>`).join("")}<th class="num">Total / 100</th><th class="num">Grade</th></tr></thead><tbody>
				${marks.map((r, i) => { const tot = r.reduce((a, b) => a + b, 0); return `<tr><td class="num">${STUDENTS[i].roll}</td><td>${esc(STUDENTS[i].name)}</td>${r.map((v, j) => `<td class="num"><input aria-label="${crit[j][0]} for ${esc(STUDENTS[i].name)}" type="number" min="0" max="${crit[j][1]}" value="${v}" data-r="${i}" data-c="${j}"></td>`).join("")}<td class="num" id="tot-${i}"><b>${tot}</b></td><td class="num" id="gr-${i}">${pillGrade(tot)}</td></tr>`; }).join("")}
				</tbody></table></div><p style="color:var(--muted);font-size:12px;margin:10px 0 0">PT periodic test · NB notebook · SE subject enrichment. Components come from the assessment plan, so each school can use its own.</p></div>
			</div></div>`;
			scr.querySelectorAll("input[data-r]").forEach((inp) => (inp.oninput = () => {
				const i = +inp.dataset.r, j = +inp.dataset.c;
				const v = Math.max(0, Math.min(crit[j][1], Number(inp.value) || 0));
				marks[i][j] = v;
				if (Number(inp.value) > crit[j][1]) inp.value = v;
				const tot = marks[i].reduce((a, b) => a + b, 0);
				$("#tot-" + i, scr).innerHTML = `<b>${tot}</b>`;
				$("#gr-" + i, scr).innerHTML = pillGrade(tot);
			}));
			$("#mk-submit", scr).onclick = () => toast(`Results submitted for ${marks.length} students`);
		};
		draw();
	};
	const pillGrade = (p) => `<span class="st ${p >= 71 ? "good" : p >= 33 ? "warn" : "bad"}">${grade(p)}</span>`;

	DESK.import = (scr) => {
		let state = "draft", progress = 0;
		const COLS = ["Class *", "Section *", "Roll No", "Admission / GR No", "First Name *", "Middle Name", "Last Name", "Gender *", "Date of Birth *", "Joining Date", "Student Mobile", "Student Email", "Blood Group", "Address", "City", "Pincode", "Father Name", "Father Mobile", "Father Email", "Mother Name", "Mother Mobile", "Mother Email"];
		const SAMPLE = [
			["Class 5", "A", 1, "GR-2019-0412", "Aarav", "", "Patil", "M", "14-05-2016", "", "", "", "B+", "12, Vishrambag", "Sangli", "416415", "Suresh Patil", "98765 43210", "suresh@example.com", "Anita Patil", "98765 01234", ""],
			["Class 5", "A", 2, "GR-2019-0413", "Riya", "", "Patil", "F", "02-11-2016", "", "", "", "", "12, Vishrambag", "Sangli", "416415", "Suresh Patil", "98765 43210", "suresh@example.com", "", "", ""],
			["Class 5", "A", 3, "GR-2019-0420", "Vihaan", "", "Kulkarni", "Male", "3/7/2016", "", "", "", "O +ve", "", "Miraj", "", "Amit Kulkarni", "+91-90110-22334", "", "", "", ""],
			["Class 5", "B", 3, "GR-2019-0477", "Diya", "", "Shinde", "F", "31-13-2016", "", "", "", "", "", "Sangli", "", "", "", "", "Neha Shinde", "12345", "", ""],
		];
		const draw = () => {
			scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › Student Import › <b>IMP-${yearStart}-0001</b> ${pillFor(state === "draft" ? "Draft" : state === "validated" ? "Validated" : state === "running" ? "Queued" : "Completed with Errors")}`,
				`<button class="dbtn" id="im-tpl">Download Template</button>${state !== "running" ? `<button class="dbtn" id="im-val">Validate</button>` : ""}${state === "validated" ? `<button class="dbtn primary" id="im-go">Start Import</button>` : ""}`)}
			<div class="desk-body">
				<div class="dcard"><div class="fields">
					<div class="field"><label for="im-year">Academic Year</label><select id="im-year"><option>${AY}</option></select></div>
					<div class="field"><label>Filled-in Template (.xlsx)</label><input value="students-class1-10.xlsx (1,984 rows)" readonly><span class="hint">Sample file attached for the demo.</span></div>
					<div class="field"><label class="check"><input type="checkbox" checked> Create missing classes</label><label class="check"><input type="checkbox"> Create student logins</label></div>
				</div></div>
				<div class="dcard" id="im-tpl-card" hidden><h3>Template: one row per student (red = required)</h3><div class="scrollx"><table class="dtable"><thead><tr>${COLS.map((c) => `<th style="${c.endsWith("*") ? "color:var(--bad)" : ""}">${esc(c)}</th>`).join("")}</tr></thead><tbody>${SAMPLE.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="hint" style="color:var(--muted);font-size:12px">The real file also has a "How to fill" sheet, dropdowns for Gender and Blood Group, and text-formatted mobile and date columns.</p></div>
				${state === "draft" ? `<div class="dcard"><h3>Next</h3><p>Click <b>Validate</b> to check every row before anything is created.</p></div>` : ""}
				${state !== "draft" ? `<div class="dcard"><h3>Result</h3><div class="kv"><div><b>1,984</b><span>Rows</span></div><div><b>${state === "done" ? "1,981" : "1,982"}</b><span>${state === "done" ? "Imported" : "Ready"}</span></div><div><b>${state === "done" ? 3 : 2}</b><span>${state === "done" ? "Failed / skipped" : "With errors"}</span></div><div><b>1,212</b><span>Parents (siblings merged)</span></div><div><b>20</b><span>Sections created</span></div></div>
					${state === "running" ? `<div style="margin-top:12px"><div class="bar"><span id="im-bar" style="width:${progress}%"></span></div><p class="hint" style="color:var(--muted);font-size:12px">Importing in the background · ${Math.round(progress)}%</p></div>` : ""}
					<div class="log" style="margin-top:12px">${state === "done" ? [
						`Row 2: created EDU-STU-${yearStart}-00001 · Class 5 - A (${AY})`, `Row 3: created EDU-STU-${yearStart}-00002 · Class 5 - A (${AY}) · linked to existing parent Suresh Patil`, `Row 4: updated EDU-STU-${yearStart}-00003 · Class 5 - A (${AY})`, "…",
						`<span class="e">Row 5: SKIPPED Date of Birth: '31-13-2016' is not a date (use DD-MM-YYYY)</span>`, `<span class="e">Row 5: SKIPPED Mother Mobile '12345' is not a valid mobile number</span>`, `<span class="e">Row 1,206: FAILED Student Group Class 8 - C is full (max 40)</span>`].join("\n")
						: [`1,984 rows · 1,982 ready · 2 with errors · 37 will update existing students`, `<span class="e">Row 5: ERROR Date of Birth: '31-13-2016' is not a date (use DD-MM-YYYY)</span>`, `<span class="e">Row 5: ERROR Mother Mobile '12345' is not a valid mobile number</span>`, `<span class="e">Row 918: ERROR Roll No 14 repeats row 917 in Class 7 B</span>`, `<span class="n">Row 4: note: Blood Group 'O +ve' read as O+</span>`, `<span class="n">Row 63: note: No parent mobile or email: this family won't get alerts</span>`].join("\n")}</div></div>` : ""}
			</div></div>`;
			$("#im-tpl", scr).onclick = () => { $("#im-tpl-card", scr).hidden = false; toast("Template preview shown below (downloads an .xlsx in the real tool)"); };
			const v = $("#im-val", scr);
			if (v) v.onclick = () => { state = "validated"; draw(); toast("1,982 of 1,984 rows ready"); };
			const g = $("#im-go", scr);
			if (g) g.onclick = () => {
				state = "running"; progress = 0; draw();
				const tick = setInterval(() => {
					progress += 9 + Math.random() * 8;
					const bar = $("#im-bar", scr);
					if (progress >= 100 || !bar) { clearInterval(tick); state = "done"; if (S.current.id === "import") { draw(); toast("Import finished: 1,981 students"); } return; }
					bar.style.width = progress + "%";
					bar.parentElement.nextElementSibling.textContent = `Importing in the background · ${Math.round(progress)}%`;
				}, 350);
			};
		};
		draw();
	};

	DESK.rctemplate = (scr) => {
		let modal = false, result = null;
		const draw = () => {
			scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › Report Card Template › <b>Class 5 Term 1 (CBSE)</b>`, `<button class="dbtn primary" id="rc-gen">Generate Report Cards</button>`)}
			<div class="desk-body">
				${modal ? `<div class="modal"><h3 style="margin-top:0">Generate Report Cards</h3><div class="fields"><div class="field"><label for="rc-grp">Student Group (Class / Section)</label><select id="rc-grp"><option>${SECTION}</option><option>Class 5 - B (${AY})</option></select></div>
					<div class="field"><label class="check"><input type="checkbox" id="rc-pub"> Publish immediately (notifies parents)</label><span class="hint">Leave unticked to review drafts first.</span></div></div>
					<div class="row" style="margin-top:12px"><button class="dbtn primary" id="rc-run">Generate</button><button class="dbtn" id="rc-cancel">Cancel</button></div></div>` : ""}
				${result ? `<div class="dcard"><h3>Done</h3><p>Created ${result.n}, refreshed 0, already published 0.${result.pub ? ` Parents of ${result.n} students notified${S.settings.testMode ? " (Test Mode)" : ""}.` : " Drafts are ready for the class teacher's remarks."}</p><button class="dbtn" data-go="reportcard">Open a report card</button></div>` : ""}
				<div class="dcard"><div class="fields">
					<div class="field"><label>Template Name</label><input value="Class 5 Term 1 (CBSE)"></div>
					<div class="field"><label>Board / Format</label><select><option>CBSE</option><option>Maharashtra State Board</option><option>Other</option></select></div>
					<div class="field"><label>Academic Year</label><input value="${AY}"></div>
					<div class="field"><label>Program (Class)</label><input value="Class 5"></div>
					<div class="field"><label>Grading Scale</label><select><option>CBSE 8-Point</option><option>Maharashtra 9-Point</option></select></div>
					<div class="field"><label>Pass Percentage</label><input value="33"></div>
				</div><label class="check" style="margin-top:12px"><input type="checkbox" checked> Show marks breakdown (PT / NB / SE / Exam)</label></div>
				<div class="dcard"><h3>Exam columns</h3><table class="dtable"><thead><tr><th>Column label</th><th>Assessment group</th><th class="num">Weightage</th></tr></thead><tbody>
					<tr><td>Unit Test 1</td><td>Unit Test 1</td><td class="num">0%</td></tr><tr><td>Half Yearly</td><td>Half Yearly</td><td class="num">0%</td></tr></tbody></table>
					<p style="color:var(--muted);font-size:12px">All weightages 0 = add marks plainly. Set e.g. 40 / 60 to weight exams.</p></div>
				<div class="dcard"><h3>Co-scholastic areas</h3><div class="row">${["Work Education", "Art Education", "Health & Physical Education", "Discipline"].map((a) => `<span class="st info">${a}</span>`).join("")}</div></div>
			</div></div>`;
			$("#rc-gen", scr).onclick = () => { modal = true; result = null; draw(); };
			if (modal) {
				$("#rc-cancel", scr).onclick = () => { modal = false; draw(); };
				$("#rc-run", scr).onclick = async () => {
					const pub = $("#rc-pub", scr).checked;
					$("#rc-run", scr).disabled = true; $("#rc-run", scr).textContent = "Calculating marks…";
					await sleep(900);
					modal = false; result = { n: 30, pub };
					if (pub) { S.rcPublished = true; if (S.settings.reportCard) addAlerts("Report Card", STUDENTS, ["WhatsApp", "Email"], "Term 1 Progress Report"); }
					draw();
				};
			}
		};
		draw();
	};

	DESK.reportcard = (scr) => {
		let board = "cbse";
		const draw = () => {
			scr.innerHTML = `<div class="desk">${deskTop(`Student Report Card › <b>RC-${yearStart}-00001 · Riya Patil</b> ${pillFor("Sent")}`, `<div class="toggle"><button type="button" id="b-cbse" class="${board === "cbse" ? "p" : ""}">CBSE</button><button type="button" id="b-mh" class="${board === "mh" ? "p" : ""}">Maharashtra</button></div>`)}
			<div class="paper-wrap"><div class="paper">${(board === "cbse" ? RC_CBSE : RC_MH).replace(/DEMO PUBLIC SCHOOL, SANGLI|Demo Public School, Sangli/g, esc(S.brand.name))}</div></div></div>`;
			$("#b-cbse", scr).onclick = () => { board = "cbse"; draw(); };
			$("#b-mh", scr).onclick = () => { board = "mh"; draw(); };
		};
		draw();
	};

	DESK.circular = (scr) => {
		let sent = null;
		const draw = () => {
			scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › Circular › <b>${sent ? sent.name : "New"}</b> ${sent ? pillFor("Sent") : ""}`, sent ? `<button class="dbtn" id="ci-new">New circular</button>` : `<button class="dbtn primary" id="ci-send">Submit &amp; send</button>`)}
			<div class="desk-body">
				${sent ? `<div class="dcard"><h3>Sent</h3><div class="kv"><div><b>${sent.students.toLocaleString("en-IN")}</b><span>Students reached</span></div><div><b>${sent.alerts.toLocaleString("en-IN")}</b><span>Parent messages queued</span></div><div><b>${S.settings.testMode ? "On" : "Off"}</b><span>Test Mode</span></div></div>
					<div class="row" style="margin-top:12px"><button class="dbtn" data-go="parent">See it in the parent app</button><button class="dbtn" data-go="whatsapp">See the WhatsApp</button></div></div>` : ""}
				<div class="dcard"><div class="fields">
					<div class="field"><label for="ci-title">Title</label><input id="ci-title" value="Annual Sports Day on 14 November"></div>
					<div class="field"><label for="ci-aud">Send To</label><select id="ci-aud"><option>All Students</option><option>Program</option><option>Student Group</option></select></div>
					<div class="field"><label for="ci-date">Publish Date</label><input id="ci-date" type="date" value="${T}"></div>
				</div>
				<div class="field" style="margin-top:12px"><label for="ci-msg">Message</label><textarea id="ci-msg" rows="5">Dear parents, Annual Sports Day is on 14 November at the school ground from 8 am. Students should come in their house T-shirts. Parents are welcome.</textarea></div>
				<div class="row" style="margin-top:12px"><label class="check"><input type="checkbox" id="ci-wa" checked> Send on WhatsApp</label><label class="check"><input type="checkbox" id="ci-em" checked> Send email</label></div></div>
			</div></div>`;
			const send = $("#ci-send", scr);
			if (send) send.onclick = () => {
				const title = $("#ci-title", scr).value.trim() || "Notice";
				const aud = $("#ci-aud", scr).value;
				const n = aud === "All Students" ? 1984 : aud === "Program" ? 196 : 30;
				const ch = [$("#ci-wa", scr).checked && "WhatsApp", $("#ci-em", scr).checked && "Email"].filter(Boolean);
				CIRCULARS.unshift({ title, message: `<p>${esc($("#ci-msg", scr).value)}</p>`, publish_date: $("#ci-date", scr).value || T });
				if (S.settings.circular) addAlerts("Circular", STUDENTS.slice(0, 6), ch, title);
				sent = { name: `CIR-${yearStart}-00003`, students: n, alerts: Math.round(n * 0.94) * ch.length };
				toast("Circular sent");
				draw();
			};
			const nw = $("#ci-new", scr);
			if (nw) nw.onclick = () => { sent = null; draw(); };
		};
		draw();
	};

	DESK.modules = (scr) => {
		const draw = (saved) => {
			scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › SchoolOS Settings › <b>Modules</b>`, `<button class="dbtn primary" id="md-save">Save</button>`)}
			<div class="desk-body">
				${saved ? `<div class="dcard"><b>Saved.</b> Open any app screen on the left to see the change.</div>` : ""}
				<div class="dcard"><h3>Modules</h3><p style="color:var(--muted);margin:0 0 12px">Everything is on by default. Turn off what this school doesn't use; its screens, alerts and menus disappear. Data is kept, so turning a module back on restores it.</p>
					<div class="modgrid">${Object.entries(MOD_LABELS).map(([k, label]) => `<label class="modsw"><input type="checkbox" data-mod="${k}" ${S.modules[k] ? "checked" : ""}><span class="sw" aria-hidden="true"></span><span>${esc(label)}</span></label>`).join("")}</div>
					<p style="color:var(--muted);font-size:12px;margin:12px 0 0">Always on: students & classes, attendance, dashboards, Excel import, absence alerts.</p></div>
				<div class="dcard"><h3>Accounts</h3><div class="fields"><div class="field"><label for="md-mode">How this school keeps its books</label>
					<select id="md-mode"><option value="full" ${(S.chosenMode || "full") === "full" ? "selected" : ""}>Full accounting in SchoolOS</option><option value="tally" ${S.chosenMode === "tally" ? "selected" : ""}>Tally (export fees to Tally)</option></select>
					<span class="hint">Full: the accountant works in SchoolOS and the principal sees income, expenses and balances. Tally: SchoolOS handles fees and exports them for the CA.</span></div>
					<div class="field"><label>Tally ledger names</label><input value="Cash · HDFC Bank · one ledger per fee head" readonly><span class="hint">Must match the ledger names in Tally exactly.</span></div></div></div>
			</div></div>`;
			$("#md-save", scr).onclick = () => {
				scr.querySelectorAll("[data-mod]").forEach((c) => (S.modules[c.dataset.mod] = c.checked));
				S.chosenMode = $("#md-mode", scr).value;
				toast("Saved. Every app screen now follows these switches.");
				draw(true);
			};
		};
		draw(false);
	};

	DESK.branding = (scr) => {
		const s = S.settings;
		const chk = (id, label, on, hint = "") => `<label class="check"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span>${label}${hint ? `<br><span style="color:var(--muted);font-size:12px">${hint}</span>` : ""}</span></label>`;
		scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › <b>SchoolOS Settings</b>`, `<button class="dbtn" id="se-test">Send Test Alert</button><button class="dbtn" data-go="parent">Open Dashboard</button><button class="dbtn primary" id="se-save">Save</button>`)}
		<div class="desk-body">
			<div class="dcard"><h3>Branding</h3><div class="fields">
				<div class="field"><label for="se-name">School Name (app, alerts, report cards)</label><input id="se-name" value="${esc(S.brand.name)}"></div>
				<div class="field"><label for="se-color">Brand Colour</label><div class="row"><input id="se-color" class="swatch" type="color" value="${S.brand.color}"><span id="se-hex" style="font-family:var(--f-mono);font-size:13px">${S.brand.color}</span></div></div>
				<div class="field"><label>School Logo</label><div class="row"><img src="${logo()}" alt="" width="34" height="34" id="se-logo"><span class="hint">Upload replaces the initials icon</span></div></div>
				<div class="field"><label for="se-addr">Address (report cards)</label><input id="se-addr" value="${esc(S.brand.address)}"></div>
			</div></div>
			<div class="dcard"><h3>Alerts</h3><div class="fields">
				<div style="display:grid;gap:10px">${chk("se-alerts", "Enable alerts", s.alerts)}${chk("se-test-mode", "Test Mode (log alerts, don't send)", s.testMode, "Keep on while testing. Alerts go to the log only.")}${chk("se-email", "Send email", s.email)}</div>
				<div style="display:grid;gap:10px">${chk("se-abs", "Absence alerts", s.absence, "Once per child per day, only for today's attendance")}${chk("se-circ", "Circular alerts", s.circular)}${chk("se-rc", "Report card alerts", s.reportCard)}${chk("se-hw", "Homework alerts (email)", s.homework)}${chk("se-hwwa", "Allow homework on WhatsApp", s.homeworkWA, "Off by default: daily homework adds up in Meta charges")}</div>
				<div class="field"><label for="se-lang">Alert Language</label><select id="se-lang"><option value="en" ${s.lang === "en" ? "selected" : ""}>en: English</option><option value="mr" ${s.lang === "mr" ? "selected" : ""}>mr: Marathi</option></select><span class="hint">Applies to emails; WhatsApp uses the template language.</span></div>
			</div></div>
			<div class="dcard"><h3>WhatsApp (Meta Cloud API)</h3><div class="fields">
				<div style="display:grid;gap:10px">${chk("se-wa", "Enable WhatsApp", s.whatsapp)}</div>
				<div class="field"><label>Phone Number ID</label><input value="10958 22746 31190" readonly></div>
				<div class="field"><label>Access Token</label><input value="••••••••••••••••••••" readonly></div>
				<div class="field"><label>Template Language Code</label><input value="${s.waLang}" readonly></div>
				<div class="field"><label>Absence Template</label><input value="school_absence_alert" readonly><span class="hint">1 guardian, 2 student, 3 date, 4 school</span></div>
				<div class="field"><label>Homework Template</label><input value="school_homework" readonly><span class="hint">1 guardian, 2 student, 3 title, 4 due, 5 school</span></div>
			</div></div>
			<div class="dcard"><h3>Dashboards</h3><div class="fields"><div class="field"><label for="se-th">Low Attendance Threshold</label><input id="se-th" type="number" value="${s.threshold}" min="50" max="95"></div><div class="field"><label>Trend Window (days)</label><input value="30" readonly></div></div></div>
		</div></div>`;
		$("#se-color", scr).oninput = (e) => { $("#se-hex", scr).textContent = e.target.value; };
		$("#se-save", scr).onclick = () => {
			S.brand.name = $("#se-name", scr).value.trim() || S.brand.name;
			S.brand.color = $("#se-color", scr).value;
			S.brand.address = $("#se-addr", scr).value;
			Object.assign(s, { alerts: $("#se-alerts", scr).checked, testMode: $("#se-test-mode", scr).checked, email: $("#se-email", scr).checked,
				absence: $("#se-abs", scr).checked, circular: $("#se-circ", scr).checked, reportCard: $("#se-rc", scr).checked, homework: $("#se-hw", scr).checked,
				homeworkWA: $("#se-hwwa", scr).checked, lang: $("#se-lang", scr).value, whatsapp: $("#se-wa", scr).checked,
				threshold: Math.max(50, Math.min(95, Number($("#se-th", scr).value) || 75)) });
			renderIndex();
			$("#se-logo", scr).src = logo();
			toast("Saved. Open any app screen to see the new branding.");
		};
		$("#se-test", scr).onclick = () => {
			S.alerts.unshift({ type: "Test", channel: "WhatsApp", status: s.testMode ? "Dry Run" : "Sent", to: "91 98765 43210", name: "Test", student: "", ref: "Settings", date: T, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) });
			toast(`WhatsApp: ${s.testMode ? "Dry Run (Test Mode is on)" : "Sent"}`);
		};
	};

	DESK.alertlog = (scr) => {
		let filter = "All";
		const draw = () => {
			const rows = S.alerts.filter((a) => filter === "All" || a.status === filter);
			const counts = ["Sent", "Dry Run", "Failed"].map((k) => [k, S.alerts.filter((a) => a.status === k).length]);
			scr.innerHTML = `<div class="desk">${deskTop(`SchoolOS › <b>SchoolOS Alert Log</b>`, `<div class="toggle">${["All", "Sent", "Dry Run", "Failed"].map((f) => `<button type="button" data-f="${f}" class="${filter === f ? "p" : ""}">${f}</button>`).join("")}</div>`)}
			<div class="desk-body">
				<div class="kv">${counts.map(([k, n]) => `<div><b>${n}</b><span>${k}</span></div>`).join("")}<div><b>${S.settings.testMode ? "On" : "Off"}</b><span>Test Mode</span></div></div>
				<div class="dcard"><div class="scrollx"><table class="dtable"><thead><tr><th>When</th><th>Type</th><th>Channel</th><th>To</th><th>Student</th><th>About</th><th>Status</th></tr></thead><tbody>
				${rows.slice(0, 80).map((a) => `<tr><td style="white-space:nowrap">${a.date === T ? "Today" : fmt(a.date)} ${a.time}</td><td>${a.type}</td><td>${a.channel}</td><td style="font-family:var(--f-mono);font-size:12px">${esc(a.to)}</td><td>${esc(a.student)}</td><td>${esc(a.ref)}${a.error ? `<br><span style="color:var(--bad);font-size:12px">${esc(a.error)}</span>` : ""}</td><td>${pillFor(a.status)}</td></tr>`).join("") || `<tr><td colspan="7" style="color:var(--muted)">No alerts with this status</td></tr>`}
				</tbody></table></div><p style="color:var(--muted);font-size:12px;margin:10px 0 0">Failed messages retry every hour (up to 3 times). The same parent never gets the same alert twice.</p></div>
			</div></div>`;
			scr.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { filter = b.dataset.f; draw(); }));
		};
		draw();
	};

	// ------------------------------------------------------------------ boot
	const start = (location.hash || "").replace("#", "");
	go(ALL.some((s) => s.id === start) ? start : "parent");
})();
