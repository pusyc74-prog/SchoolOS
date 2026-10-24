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
		"Fees": "शुल्क", "collected": "जमा", "billed this year": "या वर्षी आकारले", "still to collect": "जमा करायचे बाकी", "Overdue": "थकबाकी",
		"Students with dues": "शुल्क बाकी असलेले विद्यार्थी", "Reminders this month": "या महिन्यातील स्मरणपत्रे", "Collected today": "आज जमा", "payments": "भरणा",
		"This month": "हा महिना", "students": "विद्यार्थी", "Due in 30 days": "३० दिवसांत देय", "Collection by month": "महिनावार जमा", "How parents pay": "पालक कसे भरतात",
		"No payments yet": "अजून भरणा नाही", "Pending by class": "वर्गनिहाय बाकी", "Billed": "आकारले", "Collected": "जमा", "Pending": "बाकी", "Students": "विद्यार्थी",
		"Overdue by age": "थकबाकीचा कालावधी", "0–30 days": "०–३० दिवस", "31–60 days": "३१–६० दिवस", "61–90 days": "६१–९० दिवस", "90+ days": "९०+ दिवस",
		"Remind all overdue": "सर्व थकबाकीदारांना आठवण करा", "Remind selected": "निवडलेल्यांना आठवण करा", "Total due": "एकूण बाकी", "Late by": "उशीर",
		"Parent": "पालक", "Last reminder": "शेवटचे स्मरण", "Not due yet": "अजून देय नाही", "Everyone has paid": "सर्वांनी भरले", "Billed by fee head": "शुल्क प्रकारानुसार",
		"Recent payments": "अलीकडील भरणा", "Reminders sent to": "स्मरणपत्रे पाठवली:", "families": "कुटुंबे", "messages": "संदेश", "Open fees": "शुल्क पहा",
		"Syllabus coverage": "अभ्यासक्रम पूर्णता", "expected": "अपेक्षित", "Ahead": "पुढे", "On track": "वेळेवर", "Behind": "मागे", "subjects behind schedule": "विषय वेळापत्रकापेक्षा मागे",
		"topics finished vs where the class should be by now": "पूर्ण झालेले धडे विरुद्ध अपेक्षित", "No syllabus set": "अभ्यासक्रम नोंदवलेला नाही", "topics": "धडे",
		"Average": "सरासरी", "Latest": "नवीनतम", "Homework, 30 days": "गृहपाठ, ३० दिवस", "Chapters": "धडे", "continues": "पुढे चालू", "Notes file": "नोट्स फाइल",
		"No class notes yet": "अजून वर्गातील नोट्स नाहीत", "No notes from teachers yet": "शिक्षकांकडून अजून नोंदी नाहीत", "Subjects": "विषय", "Class notes": "वर्गातील नोट्स",
		"what was taught, by subject": "विषयनिहाय काय शिकवले", "Teacher's notes": "शिक्षकांच्या नोंदी", "Activity": "घडामोडी", "Nothing in the last 45 days": "मागील ४५ दिवसांत काही नाही",
		"Lesson": "धडा", "Fee paid": "शुल्क भरले", "last 45 days": "मागील ४५ दिवस", "part paid": "अंशतः भरले", "Pay": "भरा", "Receipt": "पावती",
		"Overdue since": "थकबाकी पासून", "Next due": "पुढील देय", "All fees paid": "सर्व शुल्क भरले", "Paid this year": "या वर्षी भरले", "Payments": "भरणा", "Last": "शेवटचा",
		"To pay": "भरायचे", "Online payment isn't set up yet. Please pay at the school office.": "ऑनलाइन भरणा अजून सुरू नाही. कृपया शाळेच्या कार्यालयात भरा.",
		"Payment history": "भरणा इतिहास", "Paid invoices": "भरलेली बिले", "Mobile number for the payment receipt": "पावतीसाठी मोबाइल क्रमांक", "Continue to pay": "भरण्यासाठी पुढे",
		"Payment received. Updating…": "भरणा मिळाला. अपडेट होत आहे…", "Payment cancelled": "भरणा रद्द", "Topic / chapter taught": "शिकवलेला धडा",
		"Topic finished": "धडा पूर्ण", "Class notes for parents and students": "पालक व विद्यार्थ्यांसाठी नोट्स", "Save lesson": "धडा जतन करा",
		"Revision / test (no topic)": "उजळणी / चाचणी", "Note": "नोंद", "Parents can see this": "पालकांना दिसेल", "Save note": "नोंद जतन करा",
		"General": "सामान्य", "Academic": "शैक्षणिक", "Achievement": "यश", "Medical": "वैद्यकीय", "Log today's lesson": "आजचा धडा नोंदवा",
		"Syllabus progress": "अभ्यासक्रम प्रगती", "Note about a student": "विद्यार्थ्याबद्दल नोंद", "Saved": "जतन केले", "Overview": "आढावा", "Progress": "प्रगती",
		"Fee due": "शुल्क बाकी", "Collection": "जमा",
		"Accounts": "हिशेब", "Financial year": "आर्थिक वर्ष", "surplus": "शिल्लक", "deficit": "तूट", "Income": "उत्पन्न", "Expenses": "खर्च",
		"Cash & bank": "रोख व बँक", "Bills to pay": "देय बिले", "Waiting for approval": "मंजुरीसाठी", "of income spent": "उत्पन्नापैकी खर्च",
		"Income this month": "या महिन्याचे उत्पन्न", "Expenses this month": "या महिन्याचा खर्च", "Salaries this year": "या वर्षीचे पगार", "of income": "उत्पन्नाच्या",
		"Income vs expenses by month": "महिनावार उत्पन्न व खर्च", "Income vs expenses": "उत्पन्न व खर्च", "Number above = surplus": "वरील आकडा = शिल्लक",
		"Cash": "रोख", "Bank": "बँक", "No cash or bank accounts yet": "अजून रोख किंवा बँक खाते नाही", "Waiting for your approval": "तुमच्या मंजुरीसाठी",
		"Staff expense": "कर्मचारी खर्च", "Bill": "बिल", "by": "", "Approve": "मंजूर करा", "Reject": "नामंजूर करा", "Nothing waiting": "काहीही प्रलंबित नाही",
		"Where the money goes": "पैसा कुठे जातो", "this year": "हे वर्ष", "Total": "एकूण", "Due this week": "या आठवड्यात देय", "days late": "दिवस उशीर",
		"No unpaid bills": "बाकी बिले नाहीत", "Income by head": "उत्पन्नाचे स्रोत", "Recent payments in and out": "अलीकडील जमा व खर्च",
		"Reason for rejecting": "नामंजुरीचे कारण", "Approved": "मंजूर", "Rejected": "नामंजूर", "Pending": "प्रलंबित",
		"Figures come straight from the school's books. Full reports (balance sheet, ledgers, trial balance) are in Admin → Accounting.": "आकडे थेट शाळेच्या हिशेबातून. पूर्ण अहवाल प्रशासन → हिशेब येथे.",
		"From": "पासून", "To": "पर्यंत", "Check what will be exported": "निर्यात तपासा", "1. Ledgers (first time only)": "१. खाती (फक्त पहिल्यांदा)",
		"2. Vouchers for Tally": "२. टॅलीसाठी व्हाउचर", "Excel copy": "एक्सेल प्रत", "Fees ready for Tally": "टॅलीसाठी शुल्क तयार",
		"Fee bills this month": "या महिन्याची शुल्क बिले", "Receipts this month": "या महिन्याच्या पावत्या", "Received": "जमा", "Last export": "शेवटची निर्यात",
		"Never": "कधीच नाही", "Export for Tally": "टॅलीसाठी निर्यात", "How it maps": "कसे जुळते", "School calendar": "शाळेचे दिनदर्शिका",
		"dates this month": "या महिन्यातील तारखा", "holidays": "सुट्ट्या", "Previous": "मागील", "This month": "हा महिना", "Next": "पुढील",
		"Coming up": "आगामी", "next 30 days": "पुढील ३० दिवस", "Nothing on this day": "या दिवशी काही नाही", "Nothing in the next 30 days": "पुढील ३० दिवसांत काही नाही",
		"Photo gallery": "फोटो गॅलरी", "photos": "फोटो", "Close": "बंद", "Holiday": "सुट्टी", "Exam": "परीक्षा", "PTM": "पालक सभा", "Event": "कार्यक्रम",
		"Celebration": "उत्सव", "Sports": "क्रीडा", "Trip": "सहल", "Other": "इतर", "Apply for leave": "रजेसाठी अर्ज", "Reason": "कारण",
		"Send to class teacher": "वर्गशिक्षकांना पाठवा", "Leave requests": "रजेचे अर्ज", "No leave requests yet": "अजून रजेचे अर्ज नाहीत", "Withdraw": "मागे घ्या",
		"Once approved, these days show as leave, not absent, and you won't get an absence alert.": "मंजूर झाल्यावर हे दिवस गैरहजर नव्हे तर रजा म्हणून दिसतील.",
		"No requests waiting": "कोणतेही अर्ज प्रलंबित नाहीत", "Reason (the parent will see this)": "कारण (पालकांना दिसेल)", "Leave": "रजा", "Calendar": "दिनदर्शिका",
		"Sent": "पाठवले", "Leave request": "रजेचा अर्ज",
	};
	let lang = "en";
	try {
		lang = localStorage.getItem("schoolos:lang") || ((navigator.language || "").startsWith("mr") ? "mr" : "en");
	} catch (e) {}
	Object.assign(MR, {
		"Today": "आज", "Overview": "सारांश", "Attendance": "हजेरी", "Academics": "अभ्यास", "Staff": "कर्मचारी", "Notices": "सूचना",
		"Homework": "गृहपाठ", "Progress": "प्रगती", "Fees": "फी", "Leave": "रजा", "Timeline": "घडामोडी", "Lessons": "धडे", "Marks": "गुण",
		"Calendar": "दिनदर्शिका", "Photos": "फोटो", "Photo albums": "फोटो अल्बम", "Students with dues": "थकबाकी असलेले विद्यार्थी", "Classes": "वर्ग", "Payments": "भरणा",
		"Approvals": "मंजुरी", "Bills to pay": "देय बिले", "Cash & bank": "रोख व बँक", "Children": "मुले",
		"Needs attention": "लक्ष द्यावे", "Nothing needs your attention right now.": "सध्या काहीही प्रलंबित नाही.",
		"Attendance today": "आजची हजेरी", "Students": "विद्यार्थी", "Fees collected": "फी जमा", "to collect": "जमा करायचे", "Not marked yet": "अजून नोंद नाही",
		"sections haven't marked attendance": "तुकड्यांनी हजेरी घेतलेली नाही", "students below": "विद्यार्थी", "attendance": "हजेरीपेक्षा कमी",
		"subjects behind the syllabus plan": "विषय अभ्यासक्रमात मागे", "parent messages failed today": "पालक संदेश आज अयशस्वी", "in overdue fees": "थकीत फी",
		"Exams in the next 2 weeks": "पुढील २ आठवड्यांतील परीक्षा", "Present today": "आज उपस्थित", "Sections marked": "हजेरी घेतलेल्या तुकड्या", "marked": "नोंद",
		"Students below the attendance limit": "कमी हजेरी असलेले विद्यार्थी", "Average marks by subject": "विषयवार सरासरी गुण", "Syllabus by class": "वर्गवार अभ्यासक्रम",
		"On track or ahead": "वेळेवर किंवा पुढे", "Behind plan": "नियोजनापेक्षा मागे", "subjects behind": "विषय मागे", "Checked in": "चेक-इन",
		"staff are in school today.": "कर्मचारी आज शाळेत आहेत.", "Messages to parents today": "आज पालकांना संदेश", "Failed": "अयशस्वी",
		"To do": "करायचे", "Now": "आता", "Next": "पुढील", "Ends at": "संपेल", "at": "वाजता", "No more periods today.": "आज आणखी तासिका नाहीत.",
		"leave requests to decide": "रजा अर्जांवर निर्णय द्यायचा", "tests with marks to enter": "चाचण्यांचे गुण भरायचे", "Marked": "नोंद झाली",
		"Nobody is absent today": "आज कोणीही गैरहजर नाही", "entered": "भरले", "All marks are entered": "सर्व गुण भरले आहेत",
		"Absent today": "आज गैरहजर", "On leave today": "आज रजेवर", "Present today": "आज उपस्थित", "Homework due": "बाकी गृहपाठ", "Some due today": "काही आज देय",
		"Fees due": "देय फी", "By": "पर्यंत", "All paid": "सर्व भरले", "From the school": "शाळेकडून", "Homework and diary": "गृहपाठ व दैनंदिनी",
		"Last 30 school days": "मागील ३० शाळेचे दिवस", "Recent absences": "अलीकडील गैरहजेरी", "No absences": "गैरहजेरी नाही",
		"collected so far": "आतापर्यंत जमा", "Collected": "जमा", "Still to collect": "अजून जमा करायचे", "Overdue by how late": "किती उशीर झाला",
		"Recent payments": "अलीकडील भरणा", "How parents pay": "पालक कसे भरतात",
		"Subjects": "विषय", "Latest grade on the right": "उजवीकडे नवीनतम श्रेणी", "See chapters": "धडे पहा", "chapters done": "धडे पूर्ण",
		"chapter behind": "धडा मागे", "chapters behind": "धडे मागे", "Ahead of plan": "नियोजनापेक्षा पुढे", "On track": "वेळेवर",
		"Done": "पूर्ण", "In progress": "सुरू आहे", "Not started": "सुरू नाही", "Notes from teachers": "शिक्षकांच्या नोंदी",
		"What was taught in class": "वर्गात काय शिकवले", "Note from": "यांची नोंद", "lesson": "धडा", "To pay": "भरायचे", "Paid this year": "या वर्षी भरले",
		"Payments made": "केलेला भरणा", "Paid fees": "भरलेली फी", "Surplus this year": "या वर्षी शिल्लक", "Deficit this year": "या वर्षी तूट",
		"Income": "उत्पन्न", "Expenses": "खर्च", "Waiting for approval": "मंजुरीसाठी प्रलंबित", "bills and claims to approve": "बिले व दावे मंजूर करायचे",
		"overdue": "थकीत", "due this week": "या आठवड्यात देय", "Income and expenses by month": "महिनावार उत्पन्न व खर्च", "School accounts": "शाळेचे हिशोब",
		"Total to pay": "एकूण देय", "Unpaid bills": "न भरलेली बिले", "Received": "मिळाले", "Paid out": "दिले", "Entered by": "नोंद करणारे",
		"financial year": "आर्थिक वर्ष", "days absent out of": "दिवस गैरहजर, एकूण", "No students below the limit": "मर्यादेखाली कोणी नाही",
		"Dashed line": "तुटक रेषा", "target": "लक्ष्य", "to": "ते", "Attachment": "जोडलेली फाईल", "Coming up": "येणारे",
	});
	const t = (s) => (lang === "mr" && MR[s] !== undefined ? MR[s] : s);
	const loc = () => (lang === "mr" ? "mr-IN" : "en-IN");

	// ---------- utils
	const esc = (v) =>
		String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
	const pct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10}%`);
	const num = (v) => (v === null || v === undefined ? "–" : Number(v).toLocaleString(loc()));
	const tone = (p, threshold = 75) => (p === null || p === undefined ? "" : p >= 90 ? "good" : p >= threshold ? "warn" : "bad");
	const toneColor = (p, th) => ({ good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" })[tone(p, th)] || "var(--faint)";
	const pill = (p, threshold) => `<span class="status ${tone(p, threshold)}">${pct(p)}</span>`;
	const day = (d) => new Date(String(d).slice(0, 10) + "T00:00:00");
	const fmtDate = (d) => (d ? day(d).toLocaleDateString(loc(), { day: "numeric", month: "short" }) : "");
	const fmtTime = (tm) => {
		const m = /^(\d{1,2}):(\d{2})/.exec(String(tm || ""));  // Frappe sends "9:15:00" or "09:15:00"
		return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
	};
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
	// Layout: page title, a row of section tabs, then plain panels. One topic per tab.
	const short = (g) => String(g || "").replace(/\s*\(.*\)$/, "");
	const panel = (title, body, { note = "", cls = "", action = "" } = {}) =>
		`<section class="panel ${cls}">${title ? `<div class="panel-head"><h2>${esc(title)}</h2>${note ? `<span class="note">${esc(note)}</span>` : ""}${action}</div>` : ""}${body}</section>`;
	const card = (title, body, opts = {}) => panel(title, body, opts);
	const empty = (text) => `<div class="empty">${esc(t(text))}</div>`;
	const status = (tone, text) => `<span class="status ${tone}">${esc(text)}</span>`;
	const sections = (list, active) => list.length < 2 ? "" :
		`<nav class="sections" role="tablist">${list.map(([k, l, badge]) =>
			`<button type="button" role="tab" data-sv="${k}" aria-selected="${k === active}">${esc(t(l))}${badge ? `<span class="count">${badge}</span>` : ""}</button>`).join("")}</nav>`;
	const screen = ({ title, kicker = "", subs = [], active = "", body = "", lead = "", actions = "" }) =>
		`<div class="wrap">${lead}<header class="page-head"><div>${kicker ? `<p class="kicker">${kicker}</p>` : ""}<h1>${title}</h1></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>
		${sections(subs, active)}<div class="content">${body}</div></div>`;
	// a row of 2–4 numbers, each with a plain label; tapping one opens its tab
	const stats = (items) => `<div class="stats">${items.filter(Boolean).map((s) =>
		`<div class="stat ${s.go ? "go" : ""}" ${s.go ? `data-sv="${s.go}" role="button" tabindex="0"` : ""}>
			<span class="stat-label">${esc(t(s.label))}</span><span class="stat-value ${s.tone || ""}">${s.value}</span>${s.note ? `<span class="stat-note">${s.note}</span>` : ""}</div>`).join("")}</div>`;
	// things that need someone's attention, each opening the right tab
	const todo = (items) => {
		const list = items.filter(Boolean);
		if (!list.length) return `<div class="empty ok">${esc(t("Nothing needs your attention right now."))}</div>`;
		return `<ul class="todo">${list.map((i) => `<li ${i.go ? `data-sv="${i.go}" role="button" tabindex="0"` : ""} class="${i.tone || ""}"><span class="dot"></span>
			<span class="todo-text"><b>${i.text}</b>${i.note ? `<span class="meta">${i.note}</span>` : ""}</span>${i.go ? `<span class="chev" aria-hidden="true">›</span>` : ""}</li>`).join("")}</ul>`;
	};
	const tonePct = (p, th = 75) => tone(p, th);
	const reportButtons = (cards) => (cards || []).map((c) =>
		`<a class="btn" href="/api/method/schoolos.api.report_card.download?name=${encodeURIComponent(c.name)}">${esc(t("Report card"))}: ${esc(c.template)}${c.overall_grade ? ` (${esc(c.overall_grade)})` : ""}</a>`).join("");
	const bar = (p, color) => `<span class="bar"><span style="width:${Math.max(0, Math.min(100, p || 0))}%${color ? `;background:${color}` : ""}"></span></span>`;

	// line chart for attendance; one line, a dashed target, three date labels
	function area(points, target) {
		if (!points || points.length < 2) return empty("Not enough attendance days yet");
		const W = 640, H = 180, L = 36, R = 12, T = 12, B = 24;
		const ys = points.map((p) => p.percentage ?? 0);
		const lo = Math.max(0, Math.min(Math.floor((Math.min(...ys) - 4) / 5) * 5, (target || 100) - 10));
		const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
		const y = (v) => T + (1 - (v - lo) / (100 - lo || 1)) * (H - T - B);
		const d = ys.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
		const ticks = [lo, Math.round((lo + 100) / 2), 100];
		const xl = [0, Math.floor((points.length - 1) / 2), points.length - 1];
		return `<div class="area"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("Attendance"))}">
			${ticks.map((v) => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`).join("")}
			${target ? `<line class="threshold" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/>` : ""}
			<path class="line" d="${d}"/>
			${xl.map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}">${fmtDate(points[i].date)}</text>`).join("")}
		</svg>${target ? `<p class="meta">${esc(t("Dashed line"))}: ${esc(t("target"))} ${target}%</p>` : ""}</div>`;
	}

	function bars(rows, nameKey, valKey, { max = 100, suffix = "%", color = null, fmt = null, tone = false } = {}) {
		if (!rows || !rows.length) return empty("No data yet");
		return `<div class="bars">${rows.map((r) => {
			const v = Number(r[valKey]) || 0;
			const col = color || (tone ? toneColor(v, 60) : "var(--brand)");
			return `<div class="row"><span class="name" title="${esc(r[nameKey])}">${esc(r[nameKey])}</span>
				${bar((v / max) * 100, col)}<span class="val">${fmt ? esc(fmt(v)) : Math.round(v * 10) / 10 + suffix}</span></div>`;
		}).join("")}</div>`;
	}

	function heat(groups) {
		if (!groups || !groups.length) return empty("Nothing to show");
		const sorted = [...groups].sort((a, b) => a.student_group.localeCompare(b.student_group, undefined, { numeric: true }));
		const cls = (g) => (!g.marked ? "un" : g.percentage >= 90 ? "good" : g.percentage >= 80 ? "warn" : "bad");
		return `<div class="heat">${sorted.map((g) => `<div class="cell ${cls(g)}" title="${esc(g.student_group)}">
			<span class="n">${esc(short(g.student_group))}</span>
			<span class="p">${g.marked ? pct(g.percentage) : esc(t("Not marked"))}</span></div>`).join("")}</div>`;
	}

	function calendar(daysList) {
		if (!daysList || !daysList.length) return empty("Not enough attendance days yet");
		const today = todayISO();
		return `<div class="cal">${daysList.map((d) => `<span class="${esc(d.status)} ${d.date === today ? "today" : ""}" title="${fmtDate(d.date)}: ${esc(t(d.status))}"></span>`).join("")}</div>
			<div class="legend"><span><i class="Present"></i>${t("Present")}</span><span><i class="Absent"></i>${t("Absent")}</span><span><i class="Leave"></i>${t("Leave")}</span></div>`;
	}

	function timeline(schedule) {
		if (!schedule || !schedule.length) return empty("No classes scheduled today");
		const n = nowMins();
		return `<ol class="periods">${schedule.map((s) => {
			const st = n > mins(s.to_time) ? "done" : n >= mins(s.from_time) ? "now" : "";
			return `<li class="${st}"><span class="t">${fmtTime(s.from_time)}</span><div><b>${esc(s.course)}</b>
				<span class="meta">${esc(short(s.student_group || s.instructor_name || ""))}${s.room ? `, ${esc(s.room)}` : ""}</span></div>${st === "now" ? status("info", t("Now")) : ""}</li>`;
		}).join("")}</ol>`;
	}

	function homeworkList(list, showGroup) {
		if (!list || !list.length) return empty("No homework posted");
		return `<ul class="list">${list.map((h) => {
			const due = h.due_date ? status(h.overdue ? "bad" : h.due_today ? "warn" : "", h.overdue ? t("Overdue") : h.due_today ? t("Due today") : `${t("Due")} ${fmtDate(h.due_date)}`) : "";
			const body = stripHtml(h.details);
			return `<li><div class="grow"><span class="meta">${esc(h.course || t(h.entry_type || "Homework"))}${showGroup ? `, ${esc(short(h.student_group))}` : ""}</span>
				<b>${esc(h.title)}</b>${body ? `<p class="body">${esc(body.slice(0, 200))}</p>` : ""}
				${h.attachment ? `<a href="${esc(h.attachment)}" target="_blank" rel="noopener">${esc(t("Attachment"))}</a>` : ""}</div>
				<div class="side">${due}${h.recipients_count ? `<span class="meta">${num(h.recipients_count)} ${esc(t("students"))}</span>` : ""}</div></li>`;
		}).join("")}</ul>`;
	}

	function circulars(list) {
		if (!list || !list.length) return empty("No circulars yet");
		return `<ul class="list">${list.map((c) => `<li><div class="grow"><b>${esc(c.title)}</b><p class="body">${esc(stripHtml(c.message).slice(0, 180))}</p></div>
			<span class="meta side">${fmtDate(c.publish_date)}</span></li>`).join("")}</ul>`;
	}

	function people(list, threshold) {
		if (!list || !list.length) return empty("No students below the limit");
		return `<ul class="list">${list.map((r) => `<li><div class="grow"><b>${esc(r.student_name)}</b>
			<span class="meta">${num(r.absent)} ${esc(t("days absent out of"))} ${num(r.days)}</span></div>
			<div class="side">${pill(r.percentage, threshold)}</div></li>`).join("")}</ul>`;
	}

	// ---------- principal
	async function principalView(sub = "overview") {
		const [d, fees, syl] = await Promise.all([
			call("principal"),
			ctx.views.includes("fees") ? call("schoolos.api.fees.summary").catch(() => null) : null,
			on("learning") ? call("schoolos.api.learning.syllabus_overview").catch(() => null) : null,
		]);
		const a = d.attendance_today, th = d.window.threshold, staff = d.staff_today;
		const groups = d.groups_today || [];
		const marked = groups.filter((g) => g.marked).length;
		const staffIn = staff ? (staff.present || 0) + (staff.work_from_home || 0) + (staff.half_day || 0) : 0;
		const subs = [["overview", "Overview"], ["attendance", "Attendance"], ["academics", "Academics"],
			staff ? ["staff", "Staff"] : null, ["notices", "Notices"]].filter(Boolean);
		if (!subs.some(([k]) => k === sub)) sub = "overview";
		let body = "";
		if (sub === "overview") {
			body = stats([
				{ label: "Attendance today", value: a.total ? pct(a.percentage) : "–", note: a.total ? `${num(a.absent)} ${esc(t("absent"))}` : esc(t("Not marked yet")), go: "attendance", tone: tonePct(a.percentage, 90) },
				{ label: "Students", value: num(d.students.active) },
				staff ? { label: "Staff present", value: `${num(staffIn)}`, note: `${esc(t("of"))} ${num(staff.active_staff)}`, go: "staff" } : null,
				fees ? { label: "Fees collected", value: pct(fees.collection_pct), note: esc(inrShort(fees.outstanding)) + " " + esc(t("to collect")), go: null } : null,
			]) + `<div class="cols2">${panel(t("Needs attention"), todo([
				d.groups_unmarked.length ? { text: `${num(d.groups_unmarked.length)} ${esc(t("sections haven't marked attendance"))}`, note: esc(d.groups_unmarked.slice(0, 4).map(short).join(", ")), go: "attendance", tone: "warn" } : null,
				d.low_attendance.length ? { text: `${num(d.low_attendance.length)} ${esc(t("students below"))} ${th}% ${esc(t("attendance"))}`, go: "attendance", tone: "bad" } : null,
				syl && syl.behind ? { text: `${num(syl.behind)} ${esc(t("subjects behind the syllabus plan"))}`, go: "academics", tone: "warn" } : null,
				d.alerts_today["Failed"] ? { text: `${num(d.alerts_today["Failed"])} ${esc(t("parent messages failed today"))}`, go: "notices", tone: "bad" } : null,
				fees && fees.overdue ? { text: `${esc(inrShort(fees.overdue))} ${esc(t("in overdue fees"))}`, note: `${num(fees.students_overdue)} ${esc(t("students"))}`, tone: "bad" } : null,
			]))}
			${panel(t("Exams in the next 2 weeks"), upcomingExams(d.upcoming_exams.slice(0, 4)))}</div>`;
		} else if (sub === "attendance") {
			body = stats([
				{ label: "Present today", value: num(a.present), tone: "good" }, { label: "Absent", value: num(a.absent), tone: a.absent ? "bad" : "" },
				{ label: "On leave", value: num(a.leave) }, { label: "Sections marked", value: `${num(marked)}/${num(groups.length)}` },
			]) + panel(`${t("Attendance, last")} ${d.trend.length} ${t("school days")}`, area(d.trend, 90))
				+ panel(t("Sections today"), heat(groups), { note: `${num(marked)} ${t("of")} ${num(groups.length)} ${t("marked")}` })
				+ panel(t("Students below the attendance limit"), people(d.low_attendance, th), { note: `${t("below")} ${th}%` });
		} else if (sub === "academics") {
			body = panel(t("Average marks by subject"), bars(d.subject_performance, "course", "average", { tone: true }), { note: d.academic_term || "" })
				+ syllabusMatrix(syl) + panel(t("Exams in the next 2 weeks"), upcomingExams(d.upcoming_exams));
		} else if (sub === "staff") {
			body = stats([
				{ label: "Present", value: num(staffIn), tone: "good" }, { label: "On leave", value: num(staff.on_leave) },
				{ label: "Absent", value: num(staff.absent), tone: staff.absent ? "bad" : "" }, { label: "Checked in", value: num(staff.checked_in) },
			]) + panel(t("Staff today"), `<p class="body">${num(staffIn)} ${esc(t("of"))} ${num(staff.active_staff)} ${esc(t("staff are in school today."))}</p>`);
		} else {
			const sent = (d.alerts_today["Sent"] || 0) + (d.alerts_today["Dry Run"] || 0);
			body = stats([{ label: "Messages to parents today", value: num(sent) }, { label: "Failed", value: num(d.alerts_today["Failed"] || 0), tone: d.alerts_today["Failed"] ? "bad" : "" }])
				+ panel(t("Circulars"), circulars(d.circulars), { action: `<a class="btn primary" href="/desk/schoolos-circular/new">${esc(t("New circular"))}</a>` });
		}
		return screen({ kicker: esc(longDate()) + (d.academic_term ? `, ${esc(d.academic_term)}` : ""), title: `${esc(greeting())}, ${esc(firstName(ctx.full_name))}`, subs, active: sub, body });
	}

	function upcomingExams(list) {
		if (!list.length) return empty("No exams in the next 2 weeks");
		return `<ul class="list">${list.map((e) => {
			const n = daysUntil(e.schedule_date);
			return `<li><div class="grow"><b>${esc(e.assessment_name || e.course)}</b><span class="meta">${esc(short(e.student_group))}, ${fmtDate(e.schedule_date)} ${fmtTime(e.from_time)}</span></div>
				<span class="side">${status(n <= 2 ? "warn" : "", n <= 0 ? t("Today") : n === 1 ? t("Tomorrow") : `${t("in")} ${n} ${t("days")}`)}</span></li>`;
		}).join("")}</ul>`;
	}

	// ---------- teacher
	async function teacherView(sub = "overview") {
		const [d, opts, lessons, leaves] = await Promise.all([
			call("teacher"),
			on("homework") ? call("schoolos.api.homework.post_options").catch(() => null) : null,
			on("learning") ? call("schoolos.api.learning.lesson_options").catch(() => null) : null,
			on("leave") ? call("schoolos.api.leave.pending").catch(() => null) : null,
		]);
		const th = d.window.threshold;
		const unmarked = d.groups_today.filter((g) => !g.marked);
		const subs = [["overview", "Today"], ["attendance", "Attendance"], opts ? ["homework", "Homework"] : null,
			lessons && lessons.groups.length ? ["lessons", "Lessons"] : null, leaves ? ["leave", "Leave", leaves.length || ""] : null,
			["marks", "Marks", d.pending_marks.length || ""]].filter(Boolean);
		if (!subs.some(([k]) => k === sub)) sub = "overview";
		const n = nowMins();
		const nowP = d.schedule.find((s) => n >= mins(s.from_time) && n <= mins(s.to_time));
		const nextP = d.schedule.find((s) => mins(s.from_time) > n);
		let body = "";
		if (sub === "overview") {
			const nowLine = nowP ? `<p class="lead-line"><b>${esc(t("Now"))}:</b> ${esc(nowP.course)}, ${esc(short(nowP.student_group))}. ${esc(t("Ends at"))} ${fmtTime(nowP.to_time)}.</p>`
				: nextP ? `<p class="lead-line"><b>${esc(t("Next"))}:</b> ${esc(nextP.course)}, ${esc(short(nextP.student_group))} ${esc(t("at"))} ${fmtTime(nextP.from_time)}.</p>`
				: `<p class="lead-line">${esc(t("No more periods today."))}</p>`;
			body = nowLine + `<div class="cols2">${panel(t("To do"), todo([
				...unmarked.map((g) => ({ text: `${esc(t("Take attendance"))}: ${esc(short(g.student_group))}`, go: "attendance", tone: "warn" })),
				leaves && leaves.length ? { text: `${num(leaves.length)} ${esc(t("leave requests to decide"))}`, go: "leave", tone: "warn" } : null,
				d.pending_marks.length ? { text: `${num(d.pending_marks.length)} ${esc(t("tests with marks to enter"))}`, go: "marks" } : null,
			]))}${panel(t("Today's timetable"), timeline(d.schedule))}</div>`;
		} else if (sub === "attendance") {
			body = panel(t("My classes today"), `<ul class="list">${d.groups_today.map((g) => `<li><div class="grow"><b>${esc(short(g.student_group))}</b>
				<span class="meta">${num(g.strength)} ${esc(t("students"))}${g.marked ? `, ${num(g.absent || 0)} ${esc(t("absent"))}` : ""}</span></div>
				<div class="side">${g.marked ? status("good", t("Marked")) : `<a class="btn primary" href="/desk/student-attendance-tool">${esc(t("Take attendance"))}</a>`}</div></li>`).join("")}</ul>`)
				+ panel(t("Absent today"), d.absent_today.length ? `<ul class="list">${d.absent_today.map((s) => `<li><b>${esc(s.student_name)}</b><span class="meta side">${esc(short(s.student_group))}</span></li>`).join("")}</ul>` : empty("Nobody is absent today"))
				+ panel(t("Students below the attendance limit"), people(d.low_attendance, th), { note: `${t("below")} ${th}%` });
		} else if (sub === "homework") {
			body = `<div class="cols2">${panel(t("Post homework or a note"), homeworkForm(opts))}${panel(t("My recent posts"), homeworkList(d.recent_posts || [], true))}</div>`;
		} else if (sub === "lessons") {
			body = `<div class="cols2">${panel(t("Log today's lesson"), lessonForm(lessons))}${panel(t("Syllabus progress"), syllabusList(lessons))}</div>`
				+ panel(t("Note about a student"), noteForm(lessons));
		} else if (sub === "leave") {
			body = panel(t("Leave requests"), leaveRequests(leaves));
		} else {
			body = panel(t("Marks to enter"), d.pending_marks.length ? `<ul class="list">${d.pending_marks.map((p) => `<li><div class="grow"><b>${esc(p.assessment_name || p.course)}</b>
				<span class="meta">${esc(short(p.student_group))}: ${num(p.entered)} ${esc(t("of"))} ${num(p.strength)} ${esc(t("entered"))}</span>${bar(p.strength ? (p.entered / p.strength) * 100 : 0)}</div></li>`).join("")}</ul>
				<div class="actions"><a class="btn primary" href="/desk/assessment-result-tool">${esc(t("Enter marks"))}</a></div>` : empty("All marks are entered"));
		}
		return screen({ kicker: esc(longDate()), title: `${esc(greeting())}, ${esc(firstName(d.instructor_name))}`, subs, active: sub, body });
	}

	function homeworkForm(opts) {
		const g0 = opts.groups[0];
		const courseOptions = (g) => [`<option value="">${t("Any subject")}</option>`].concat((opts.courses[g] || []).map((c) => `<option>${esc(c)}</option>`)).join("");
		window.__schoolosCourses = opts.courses;
		return `<form id="hw-form" class="form">
			<div class="row2"><label>${t("Section")}<select name="student_group" required>${opts.groups.map((g) => `<option value="${esc(g)}">${esc(short(g))}</option>`).join("")}</select></label>
			<label>${t("Subject")}<select name="course">${courseOptions(g0)}</select></label></div>
			<div class="row2"><label>${t("Type")}<select name="entry_type">${opts.types.map((x) => `<option value="${esc(x)}">${esc(t(x))}</option>`).join("")}</select></label>
			<label>${t("Due date")}<input type="date" name="due_date" min="${todayISO()}"></label></div>
			<label>${t("Title")}<input name="title" required maxlength="140" placeholder="${esc(t("e.g. Exercise 4.2, questions 1 to 10"))}"></label>
			<label>${t("Details (optional)")}<textarea name="details" rows="2"></textarea></label>
			${opts.whatsapp_allowed ? `<label class="check"><input type="checkbox" name="send_whatsapp" value="1"> ${t("Also send on WhatsApp")}</label>` : ""}
			<div class="actions"><button class="btn primary" type="submit">${t("Post and notify parents")}</button><span class="form-msg" aria-live="polite"></span></div>
		</form>`;
	}

	// ---------- one student (parent / student)
	let kidsCache = null;
	async function studentView(studentId, back, sub = "overview") {
		const d = await call("student", studentId ? { student: studentId } : {});
		const sid = studentId || d.student.name;
		const kid = (kidsCache || []).find((k) => k.student === sid);
		const subs = [["overview", "Today"], on("homework") ? ["homework", "Homework"] : null, ["attendance", "Attendance"],
			on("learning") ? ["progress", "Progress"] : null, on("fees") ? ["fees", "Fees"] : null, on("leave") ? ["leave", "Leave"] : null,
			["activity", "Timeline"]].filter(Boolean);
		if (!subs.some(([k]) => k === sub)) sub = "overview";
		const a = d.attendance;
		let body = "";
		if (sub === "overview") {
			const todayStatus = (d.calendar || []).find((x) => x.date === todayISO());
			const st = todayStatus ? todayStatus.status : null;
			const due = (d.homework || []).filter((h) => h.due_date && !h.overdue);
			const fee = kid && kid.fees;
			body = `<p class="lead-line">${st === "Absent" ? status("bad", t("Absent today")) : st === "Leave" ? status("warn", t("On leave today")) : st === "Present" ? status("good", t("Present today")) : status("", t("Attendance not marked yet"))}</p>`
				+ stats([
					{ label: "Attendance", value: pct(a.percentage), note: `${num(a.present)} ${esc(t("of"))} ${num(a.working_days)} ${esc(t("days"))}`, go: "attendance", tone: tonePct(a.percentage, 90) },
					on("homework") ? { label: "Homework due", value: num(due.length), note: due.some((h) => h.due_today) ? esc(t("Some due today")) : "", go: "homework" } : null,
					fee ? { label: "Fees due", value: esc(inrShort(fee.outstanding)), note: fee.outstanding > 0 && fee.next_due ? `${esc(t(fee.next_due.overdue ? "Overdue since" : "By"))} ${fmtDate(fee.next_due.date)}` : esc(t("All paid")), go: "fees", tone: fee.overdue > 0 ? "bad" : "" } : null,
				])
				+ `<div class="cols2">${panel(t("Today's timetable"), timeline(d.today_schedule))}
				${panel(t("From the school"), circulars((d.circulars || []).slice(0, 2)))}</div>`
				+ ((d.report_cards || []).length ? `<div class="actions">${reportButtons(d.report_cards)}</div>` : "");
		} else if (sub === "homework") {
			body = panel(t("Homework and diary"), homeworkList(d.homework));
		} else if (sub === "attendance") {
			body = stats([
				{ label: "Attendance", value: pct(a.percentage), tone: tonePct(a.percentage, 90) }, { label: "Present", value: num(a.present) },
				{ label: "Absent", value: num(a.absent), tone: a.absent ? "bad" : "" }, { label: "Leave", value: num(a.leave) },
			]) + panel(t("Last 30 school days"), calendar(d.calendar))
				+ panel(t("Recent absences"), (d.recent_absences || []).length ? `<ul class="list">${d.recent_absences.map((x) => `<li><b>${esc(day(x).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" }))}</b></li>`).join("")}</ul>` : empty("No absences"));
		} else if (sub === "progress") body = await progressPanel(sid, d);
		else if (sub === "fees") body = await feesPanel(sid);
		else if (sub === "leave") body = await leavePanel(sid);
		else body = await activityPanel(sid);
		const switcher = kidsCache && kidsCache.length > 1 && back === "parent"
			? `<nav class="kids" aria-label="${esc(t("Children"))}">${kidsCache.map((k) => `<button type="button" data-student="${esc(k.student)}" aria-pressed="${k.student === sid}">${esc(firstName(k.student_name))}</button>`).join("")}</nav>` : "";
		return screen({ lead: switcher, kicker: d.enrollment ? `${esc(d.enrollment.program)}, ${esc(d.enrollment.academic_year)}` : "",
			title: studentId ? esc(d.student.student_name) : `${esc(greeting())}, ${esc(firstName(d.student.student_name))}`, subs, active: sub, body });
	}

	async function parentView(sub) {
		const d = await call("parent");
		kidsCache = d.children;
		if (!d.children.length) return `<div class="wrap">${empty("No children linked to your account yet. Please contact the school office.")}</div>`;
		const pick = current && current.view === "parent" && current.arg && d.children.some((c) => c.student === current.arg) ? current.arg : d.children[0].student;
		current = { ...(current || {}), view: "parent", arg: pick };
		return studentView(pick, "parent", sub || "overview");
	}

	// ---------- money (Indian grouping, lakh / crore for big figures)
	const inr = (v, cur = "INR") => (v === null || v === undefined ? "–" : new Intl.NumberFormat(loc(), { style: "currency", currency: cur || "INR", maximumFractionDigits: 0 }).format(v));
	const inrShort = (v) => {
		if (v === null || v === undefined) return "–";
		const a = Math.abs(v);
		if (a >= 1e7) return `₹${(v / 1e7).toFixed(a >= 1e8 ? 1 : 2)} Cr`;
		if (a >= 1e5) return `₹${(v / 1e5).toFixed(a >= 1e6 ? 1 : 2)} L`;
		if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
		return inr(v);
	};
	const monthLabel = (k) => new Date(k + "-01T00:00:00").toLocaleDateString(loc(), { month: "short" });

	function columns(series, { labelOf = (r) => r.key, highlightLast = true, fmtVal = inrShort } = {}) {
		if (!series || !series.length) return empty("No data yet");
		const max = Math.max(...series.map((s) => s.amount), 1);
		return `<div class="cols" role="img" aria-label="${esc(t("Collection"))}">${series.map((s, i) => `<div class="col ${highlightLast && i === series.length - 1 ? "last" : ""}" title="${esc(labelOf(s))}: ${esc(inr(s.amount))}">
			<span class="v">${s.amount ? esc(fmtVal(s.amount)) : ""}</span><span class="b" style="height:${Math.max(2, (s.amount / max) * 100)}%"></span><span class="k">${esc(labelOf(s))}</span></div>`).join("")}</div>`;
	}

	// ---------- fees: principal / accounts
	async function feesView(sub = "overview") {
		const f = await call("schoolos.api.fees.summary");
		const sel = new Set();
		const subs = [["overview", "Overview"], ["dues", "Students with dues", num(f.students_with_dues)], ["classes", "Classes"], ["payments", "Payments"]];
		if (!subs.some(([k]) => k === sub)) sub = "overview";
		let body = "";
		if (sub === "overview") {
			body = stats([
				{ label: "Collected", value: esc(inrShort(f.collected)), note: `${pct(f.collection_pct)} ${esc(t("of"))} ${esc(inrShort(f.billed))}`, tone: "good" },
				{ label: "Still to collect", value: esc(inrShort(f.outstanding)), go: "dues" },
				{ label: "Overdue", value: esc(inrShort(f.overdue)), note: `${num(f.students_overdue)} ${esc(t("students"))}`, go: "dues", tone: f.overdue ? "bad" : "" },
				{ label: "Collected today", value: esc(inrShort(f.collected_today)), note: `${num(f.payments_today)} ${esc(t("payments"))}`, go: "payments" },
			]) + panel(t("Collection by month"), columns(f.monthly, { labelOf: (r) => monthLabel(r.key) }), { note: f.academic_year || "" })
				+ panel(t("Overdue by how late"), bars(f.ageing.map((a) => ({ ...a, label: t(a.label) })), "label", "amount", { color: "var(--bad)", max: Math.max(...f.ageing.map((a) => a.amount), 1), fmt: inrShort }));
		} else if (sub === "dues") {
			body = panel(t("Students with dues"), `<div class="actions top"><button class="btn primary" data-remind="all">${esc(t("Remind all overdue"))}</button>
				<button class="btn" data-remind="selected" disabled>${esc(t("Remind selected"))}</button><span class="form-msg" id="remind-msg"></span></div>
				<div class="scroll"><table><thead><tr><th></th><th>${esc(t("Student"))}</th><th>${esc(t("Class"))}</th><th class="num">${esc(t("Overdue"))}</th><th class="num">${esc(t("Total due"))}</th><th>${esc(t("Late by"))}</th><th>${esc(t("Parent"))}</th><th>${esc(t("Last reminder"))}</th></tr></thead><tbody>
				${f.defaulters.map((d) => `<tr><td><input type="checkbox" data-pick="${esc(d.student)}" aria-label="${esc(d.student_name)}"></td>
					<td><b>${esc(d.student_name)}</b></td><td>${esc(short(d.group))}</td>
					<td class="num">${d.overdue ? `<b class="bad-text">${esc(inr(d.overdue))}</b>` : "–"}</td><td class="num">${esc(inr(d.outstanding))}</td>
					<td>${d.days_overdue ? status(d.days_overdue > 60 ? "bad" : d.days_overdue > 30 ? "warn" : "", `${num(d.days_overdue)} ${t("days")}`) : `<span class="meta">${esc(t("Not due yet"))}</span>`}</td>
					<td>${esc(d.guardian || "")}<div class="meta">${esc(d.mobile || "")}</div></td><td class="meta">${d.last_reminder ? fmtDate(d.last_reminder) : "–"}</td></tr>`).join("") || `<tr><td colspan="8">${empty("Everyone has paid")}</td></tr>`}
				</tbody></table></div>`);
		} else if (sub === "classes") {
			body = panel(t("Pending by class"), `<div class="scroll"><table><thead><tr><th>${esc(t("Class"))}</th><th class="num">${esc(t("Billed"))}</th><th>${esc(t("Collected"))}</th><th class="num">${esc(t("Pending"))}</th><th class="num">${esc(t("Students with dues"))}</th></tr></thead><tbody>
				${f.groups.map((g) => `<tr><td><b>${esc(short(g.group))}</b></td><td class="num">${esc(inrShort(g.billed))}</td>
					<td><div class="inline">${bar(g.collection_pct, toneColor(g.collection_pct, 70))}<span class="meta">${pct(g.collection_pct)}</span></div></td>
					<td class="num">${g.outstanding > 0 ? `<b class="bad-text">${esc(inrShort(g.outstanding))}</b>` : "–"}</td><td class="num">${num(g.with_dues)} ${esc(t("of"))} ${num(g.students)}</td></tr>`).join("")}
				</tbody></table></div>`) + panel(t("Billed by fee head"), bars(f.heads, "label", "amount", { max: Math.max(...f.heads.map((h) => h.amount), 1), fmt: inrShort }));
		} else {
			const total = f.modes.reduce((s, m) => s + m.amount, 0) || 1;
			body = `<div class="cols2">${panel(t("How parents pay"), bars(f.modes.map((m) => ({ ...m, share: (m.amount / total) * 100 })), "label", "share", { fmt: (v) => `${Math.round(v)}%` }))}
				${panel(t("Recent payments"), f.recent_payments.length ? `<ul class="list">${f.recent_payments.map((p) => `<li><div class="grow"><b>${esc(p.student_name)}</b><span class="meta">${esc(p.mode || "")}, ${fmtDate(p.date)}</span></div><b class="side good-text">${esc(inr(p.amount))}</b></li>`).join("")}</ul>` : empty("No payments yet"))}</div>`;
		}
		setTimeout(() => {
			app.querySelectorAll("[data-pick]").forEach((c) => (c.onchange = () => {
				c.checked ? sel.add(c.dataset.pick) : sel.delete(c.dataset.pick);
				const b = app.querySelector('[data-remind="selected"]');
				if (b) { b.disabled = !sel.size; b.textContent = `${t("Remind selected")}${sel.size ? ` (${sel.size})` : ""}`; }
			}));
			app.querySelectorAll("[data-remind]").forEach((b) => (b.onclick = async () => {
				const msg = document.getElementById("remind-msg");
				b.disabled = true;
				msg.textContent = "…";
				try {
					const r = await post("schoolos.api.fees.remind", b.dataset.remind === "all" ? { overdue_only: 1 } : { students: JSON.stringify([...sel]), overdue_only: 0 });
					msg.textContent = `${t("Reminders sent to")} ${r.students} ${t("families")} (${r.messages} ${t("messages")})`;
				} catch (e) { msg.textContent = e.message; }
				b.disabled = false;
			}));
		}, 0);
		return screen({ kicker: `${esc(t("Fees"))}${f.academic_year ? `, ${esc(f.academic_year)}` : ""}`, title: `${esc(inrShort(f.collected))} ${esc(t("collected so far"))}`, subs, active: sub, body });
	}

	function syllabusMatrix(s) {
		if (!s || !s.rows || !s.rows.length) return "";
		const cls = (c) => (!c || c.percentage === null || c.percentage === undefined ? "un" : c.status === "behind" ? "bad" : "good");
		return panel(t("Syllabus by class"), `<div class="scroll"><table class="matrix"><thead><tr><th>${esc(t("Class"))}</th>${s.courses.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
			${s.rows.map((r) => `<tr><td><b>${esc(short(r.group))}</b></td>${s.courses.map((c) => {
				const v = r.cells[c];
				return `<td><span class="cell ${cls(v)}" title="${v ? `${v.covered} ${t("of")} ${v.total}` : ""}">${v && v.percentage !== null ? pct(v.percentage) : "–"}</span></td>`;
			}).join("")}</tr>`).join("")}</tbody></table></div>
			<div class="legend"><span><i class="good"></i>${esc(t("On track or ahead"))}</span><span><i class="bad"></i>${esc(t("Behind plan"))}</span></div>`, { note: `${num(s.behind)} ${t("subjects behind")}` });
	}

	// ---------- progress / activity / fees for one student
	// Plain words instead of a marker: "6 of 12 chapters done", "On track" or "2 chapters behind".
	function syllabusWords(s) {
		if (!s || !s.total) return { text: t("No syllabus set"), tone: "" };
		const expected = s.expected === null || s.expected === undefined ? null : Math.round((s.expected / 100) * s.total);
		const diff = expected === null ? 0 : s.covered - expected;
		if (s.status === "behind" && diff < 0) return { text: `${-diff} ${t(-diff === 1 ? "chapter behind" : "chapters behind")}`, tone: "bad" };
		if (s.status === "ahead") return { text: t("Ahead of plan"), tone: "good" };
		return { text: t("On track"), tone: "good" };
	}
	function syllabusRow(name, s, extra = "") {
		const w = syllabusWords(s);
		return `<div class="subject"><div class="subject-top"><b>${esc(name)}</b>${extra}</div>
			${s && s.total ? `${bar((s.covered / s.total) * 100)}<div class="subject-meta"><span>${num(s.covered)} ${esc(t("of"))} ${num(s.total)} ${esc(t("chapters done"))}</span>${status(w.tone, w.text)}</div>` : `<div class="subject-meta"><span>${esc(w.text)}</span></div>`}</div>`;
	}

	async function progressPanel(student) {
		const p = await call("schoolos.api.learning.student_progress", { student });
		const subjects = p.subjects.length ? `<ul class="list subjects">${p.subjects.map((s) => `<li>${syllabusRow(s.course, s.syllabus,
			s.latest ? `<span class="grade" title="${esc(s.latest.exam)}">${esc(s.latest.grade || pct(s.latest.percentage))}</span>` : "")}
			${s.topics.length ? `<details><summary>${esc(t("See chapters"))}</summary><ul class="chapters">${s.topics.map((tp) => `<li class="${tp.state}">${esc(tp.name)}<span class="meta">${esc(t(tp.state === "done" ? "Done" : tp.state === "started" ? "In progress" : "Not started"))}</span></li>`).join("")}</ul></details>` : ""}</li>`).join("")}</ul>` : empty("No data yet");
		const tnotes = p.teacher_notes.length ? `<ul class="list">${p.teacher_notes.map((n) => `<li><div class="grow"><span class="meta">${esc(n.author)}, ${fmtDate(n.date)}</span><p class="body ink">${esc(stripHtml(n.log))}</p></div></li>`).join("")}</ul>` : empty("No notes from teachers yet");
		const notes = p.class_notes.length ? `<ul class="list">${p.class_notes.slice(0, 8).map((n) => `<li><div class="grow"><span class="meta">${esc(n.course)}, ${fmtDate(n.date)}</span><b>${esc(n.topic || t("Lesson"))}</b>
			${n.notes ? `<p class="body">${esc(stripHtml(n.notes))}</p>` : ""}${n.attachment ? `<a href="${esc(n.attachment)}" target="_blank" rel="noopener">${esc(t("Notes file"))}</a>` : ""}</div></li>`).join("")}</ul>` : empty("No class notes yet");
		return panel(t("Subjects"), subjects, { note: t("Latest grade on the right") })
			+ `<div class="cols2">${panel(t("Notes from teachers"), tnotes)}${panel(t("What was taught in class"), notes)}</div>`;
	}

	const ACT = { attendance: "bad", homework: "info", lesson: "info", marks: "warn", note: "info", payment: "good", report_card: "info", leave: "warn" };
	async function activityPanel(student) {
		const items = await call("schoolos.api.learning.activity", { student, days: 45 });
		if (!items.length) return panel(t("Timeline"), empty("Nothing in the last 45 days"));
		const groups = {};
		items.forEach((i) => (groups[String(i.date).slice(0, 10)] = groups[String(i.date).slice(0, 10)] || []).push(i));
		const line = (i) => {
			let text = "";
			if (i.kind === "attendance") text = `${esc(t("Marked"))} <b>${esc(t(i.status).toLowerCase())}</b>`;
			else if (i.kind === "homework") text = `${esc(t(i.entry_type || "Homework"))}, ${esc(i.course || "")}: <b>${esc(i.title)}</b>`;
			else if (i.kind === "lesson") text = `${esc(i.course || "")} ${esc(t("lesson"))}: <b>${esc(i.title)}</b>`;
			else if (i.kind === "marks") text = `${esc(i.course || "")}, ${esc(i.title)}: <b>${num(i.score)}/${num(i.max)}</b>${i.grade ? ` (${esc(i.grade)})` : ""}`;
			else if (i.kind === "note") text = `${esc(t("Note from"))} ${esc(i.author)}: ${esc(i.text)}`;
			else if (i.kind === "payment") text = `${esc(t("Fee paid"))}: <b>${esc(inr(i.amount))}</b>`;
			else if (i.kind === "report_card") text = `${esc(t("Report card"))}: <b>${esc(i.title)}</b>${i.grade ? ` (${esc(i.grade)})` : ""}`;
			else if (i.kind === "leave") text = `${esc(t("Leave request"))} ${fmtDate(i.from_date)}${i.to_date !== i.from_date ? ` ${t("to")} ${fmtDate(i.to_date)}` : ""}: <b>${esc(t(i.title))}</b>`;
			return `<li class="${ACT[i.kind] || ""}"><span class="dot"></span><span>${text}</span></li>`;
		};
		return panel(t("Timeline"), Object.entries(groups).map(([dd, list]) => `<div class="act-day"><h3>${esc(new Date(dd + "T00:00:00").toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" }))}</h3><ul class="act">${list.map(line).join("")}</ul></div>`).join(""), { note: t("last 45 days") });
	}

	async function feesPanel(student) {
		const f = await call("schoolos.api.fees.for_student", { student });
		const cur = f.currency;
		const unpaid = f.invoices.filter((i) => i.outstanding > 0.005);
		const paid = f.invoices.filter((i) => i.outstanding <= 0.005);
		const inv = (i) => `<li><div class="grow"><b>${i.heads.map((h) => esc(h.head)).join(", ") || esc(i.invoice)}</b>
			<span class="meta">${esc(t("Due"))} ${fmtDate(i.due_date)}${i.outstanding > 0.005 && i.outstanding < i.total ? `, ${esc(t("part paid"))}` : ""}</span></div>
			<div class="side"><b class="${i.overdue ? "bad-text" : ""}">${esc(inr(i.outstanding > 0.005 ? i.outstanding : i.total, cur))}</b>
			${i.outstanding > 0.005 ? `${i.overdue ? status("bad", t("Overdue")) : ""}<button class="btn primary small" data-pay="${esc(i.invoice)}" data-amt="${i.outstanding}" data-student="${esc(student)}">${esc(t("Pay"))}</button>`
				: `<a class="btn small" href="/api/method/schoolos.api.fees.receipt?invoice=${encodeURIComponent(i.invoice)}">${esc(t("Receipt"))}</a>`}</div></li>`;
		return stats([
			{ label: "To pay", value: esc(inr(f.outstanding, cur)), note: f.next_due ? `${esc(t(f.next_due.overdue ? "Overdue since" : "By"))} ${fmtDate(f.next_due.date)}` : esc(t("All fees paid")), tone: f.overdue ? "bad" : f.outstanding ? "" : "good" },
			{ label: "Paid this year", value: esc(inr(f.paid, cur)), note: `${esc(t("of"))} ${esc(inr(f.total, cur))}` },
		]) + panel(t("To pay"), unpaid.length ? `<ul class="list">${unpaid.map(inv).join("")}</ul>${f.pay_online ? "" : `<p class="meta">${esc(t("Online payment isn't set up yet. Please pay at the school office."))}</p>`}` : `<div class="empty ok">${esc(t("All fees paid"))}</div>`)
			+ `<div class="cols2">${panel(t("Payments made"), f.payments.length ? `<ul class="list">${f.payments.map((p) => `<li><div class="grow"><b>${esc(inr(p.amount, cur))}</b><span class="meta">${esc(p.mode || "")}${p.reference ? `, ${esc(p.reference)}` : ""}</span></div><span class="meta side">${fmtDate(p.date)}</span></li>`).join("")}</ul>` : empty("No payments yet"))}
			${paid.length ? panel(t("Paid fees"), `<ul class="list">${paid.map(inv).join("")}</ul>`) : ""}</div>`;
	}
	// pay a fee invoice with Frappe Education's built-in Razorpay checkout
	function loadScript(src) {
		return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
	}
	function openPay(btn) {
		const li = btn.closest("li");
		if (li.querySelector(".paybox")) return;
		li.insertAdjacentHTML("afterend", `<li class="paybox-row"><form class="paybox form" data-invoice="${esc(btn.dataset.pay)}" data-student="${esc(btn.dataset.student)}">
			<label>${t("Mobile number for the payment receipt")}<input type="tel" name="phone" required pattern="[0-9 +]{10,15}" placeholder="98765 43210"></label>
			<div class="actions" style="margin-top:0;align-items:center"><button class="btn primary" type="submit">${t("Continue to pay")} ${esc(inr(Number(btn.dataset.amt)))}</button><span class="form-msg" aria-live="polite"></span></div></form></li>`);
		const f = li.nextElementSibling.querySelector("input");
		if (f) f.focus();
	}
	async function pay(form) {
		const invoice = form.dataset.invoice, student = form.dataset.student;
		const phone = form.phone.value.trim();
		const msg = form.querySelector(".form-msg");
		const btn = form.querySelector("button");
		btn.disabled = true;
		msg.textContent = "…";
		try {
			const opts = await post("education.education.billing.get_payment_options", { doctype: "Sales Invoice", docname: invoice, phone });
			if (!window.Razorpay) await loadScript("https://checkout.razorpay.com/v1/checkout.js");
			const rz = new window.Razorpay({
				key: opts.key_id, order_id: opts.order_id, amount: opts.amount, currency: opts.currency, name: opts.name,
				description: opts.description, prefill: opts.prefill,
				theme: { color: getComputedStyle(app).getPropertyValue("--brand").trim() || "#1f3a5f" },
				handler: async (response) => {
					msg.textContent = t("Payment received. Updating…");
					await post("education.education.billing.handle_payment_success", { response, against_invoice: invoice, billing_details: { id: student, mobile_number: phone, email: ctx.user } });
					show(current.view, current.arg, "fees");
				},
				modal: { ondismiss: () => { msg.textContent = t("Payment cancelled"); btn.disabled = false; } },
			});
			rz.open();
			msg.textContent = "";
		} catch (e) {
			msg.textContent = e.message;
			btn.disabled = false;
		}
	}

	// ---------- teacher: lesson log + note about a student
	function lessonForm(opts) {
		window.__schoolosLessons = opts.courses;
		const g0 = opts.groups[0];
		const courses = (g) => (opts.courses[g] || []).map((c) => `<option value="${esc(c.course)}">${esc(c.course)}${c.percentage !== null && c.percentage !== undefined ? ` · ${pct(c.percentage)}` : ""}</option>`).join("");
		const c0 = (opts.courses[g0] || [])[0];
		return `<form id="lesson-form" class="form">
			<div class="row2"><label>${t("Section")}<select name="student_group">${opts.groups.map((g) => `<option value="${esc(g)}">${esc(g.replace(/\s*\(.*\)$/, ""))}</option>`).join("")}</select></label>
			<label>${t("Subject")}<select name="course">${courses(g0)}</select></label></div>
			<label>${t("Topic / chapter taught")}<select name="topic">${topicOptions(c0)}</select></label>
			<label class="check"><input type="checkbox" name="completed" value="1" checked> ${t("Topic finished")}</label>
			<label>${t("Class notes for parents and students")}<textarea name="notes" rows="3" placeholder="${esc(t("e.g. Explained photosynthesis with a leaf experiment. Revise page 42."))}"></textarea></label>
			<div class="actions" style="margin-top:0;align-items:center"><button class="btn primary" type="submit">${t("Save lesson")}</button><span class="form-msg" aria-live="polite"></span></div>
		</form>`;
	}
	function topicOptions(c) {
		const topics = (c && c.topics) || [];
		return [`<option value="">${t("Revision / test (no topic)")}</option>`].concat(topics.map((tp) => `<option value="${esc(tp.topic)}">${tp.state === "done" ? "✓ " : tp.state === "started" ? "◐ " : ""}${esc(tp.name)}</option>`)).join("");
	}
	function syllabusList(opts) {
		const rows = [];
		opts.groups.forEach((g) => (opts.courses[g] || []).forEach((c) => rows.push({ g, ...c })));
		if (!rows.length) return empty("No syllabus set");
		return `<ul class="list subjects">${rows.map((r) => `<li>${syllabusRow(`${r.course}, ${short(r.g)}`, { ...r, covered: (r.topics || []).filter((x) => x.state === "done").length, total: (r.topics || []).length })}</li>`).join("")}</ul>`;
	}
	function noteForm(opts) {
		return `<form id="note-form" class="form">
			<div class="row2"><label>${t("Section")}<select name="student_group" data-note-group>${opts.groups.map((g) => `<option value="${esc(g)}">${esc(g.replace(/\s*\(.*\)$/, ""))}</option>`).join("")}</select></label>
			<label>${t("Student")}<select name="student" required><option value="">…</option></select></label></div>
			<div class="row2"><label>${t("Type")}<select name="type">${["General", "Academic", "Achievement", "Medical"].map((x) => `<option value="${x}">${esc(t(x))}</option>`).join("")}</select></label>
			<label class="check" style="align-self:end"><input type="checkbox" name="share" value="1" checked> ${t("Parents can see this")}</label></div>
			<label>${t("Note")}<textarea name="log" rows="2" required placeholder="${esc(t("e.g. Answered every question in the science quiz today."))}"></textarea></label>
			<div class="actions" style="margin-top:0;align-items:center"><button class="btn primary" type="submit">${t("Save note")}</button><span class="form-msg" aria-live="polite"></span></div>
		</form>`;
	}
	async function fillNoteStudents(form) {
		const g = form.querySelector("[data-note-group]").value;
		const sel = form.querySelector('select[name="student"]');
		try {
			const list = await call("schoolos.api.learning.group_students", { student_group: g });
			sel.innerHTML = list.map((s) => `<option value="${esc(s.student)}">${num(s.group_roll_number)}. ${esc(s.student_name)}</option>`).join("");
		} catch (e) { sel.innerHTML = `<option value="">${esc(e.message)}</option>`; }
	}
	// ---------- modules
	const on = (m) => !ctx || !ctx.modules || ctx.modules[m] !== false;

	// ---------- accounts
	function pairCols(series) {
		if (!series || !series.length) return empty("No data yet");
		const max = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
		const cur = new Date().toISOString().slice(0, 7);
		return `<div class="cols pair" role="img" aria-label="${esc(t("Income vs expenses"))}">${series.map((s) => `<div class="col ${s.key === cur ? "last" : ""}" title="${esc(monthLabel(s.key))}: ${esc(t("Income"))} ${esc(inr(s.income))} · ${esc(t("Expenses"))} ${esc(inr(s.expense))}">
			<span class="v">${s.income || s.expense ? esc(inrShort(s.income - s.expense)) : ""}</span>
			<span class="bb"><span class="b in" style="height:${Math.max(1, (s.income / max) * 100)}%"></span><span class="b ex" style="height:${Math.max(1, (s.expense / max) * 100)}%"></span></span>
			<span class="k">${esc(monthLabel(s.key))}</span></div>`).join("")}</div>
			<div class="legend"><span><i style="background:var(--good)"></i>${esc(t("Income"))}</span><span><i style="background:var(--bad)"></i>${esc(t("Expenses"))}</span><span>${esc(t("Number above = surplus"))}</span></div>`;
	}
	async function accountsView(sub = "overview") {
		const a = await call("schoolos.api.accounts.summary");
		if (a.mode === "tally") return tallyView(a);
		const y = a.year, cur = a.currency;
		const cash = a.balances.filter((b) => b.type === "Cash").reduce((s, b) => s + b.balance, 0);
		const bank = a.balances.filter((b) => b.type === "Bank").reduce((s, b) => s + b.balance, 0);
		const subs = [["overview", "Overview"], ["approvals", "Approvals", a.approvals.length || ""], ["bills", "Bills to pay"], ["cash", "Cash & bank"]];
		if (!subs.some(([k]) => k === sub)) sub = "overview";
		let body = "";
		if (sub === "overview") {
			body = stats([
				{ label: y.surplus >= 0 ? "Surplus this year" : "Deficit this year", value: esc(inrShort(Math.abs(y.surplus))), tone: y.surplus >= 0 ? "good" : "bad" },
				{ label: "Income", value: esc(inrShort(y.income)) }, { label: "Expenses", value: esc(inrShort(y.expense)) },
				{ label: "Cash & bank", value: esc(inrShort(cash + bank)), go: "cash" },
			]) + `<div class="cols2">${panel(t("Waiting for approval"), a.approvals.length ? todo([{ text: `${num(a.approvals.length)} ${esc(t("bills and claims to approve"))}`, go: "approvals", tone: "warn" }]) : empty("Nothing waiting"))}
				${panel(t("Bills to pay"), todo([a.payables.overdue ? { text: `${esc(inrShort(a.payables.overdue))} ${esc(t("overdue"))}`, go: "bills", tone: "bad" } : null,
					a.payables.due_this_week ? { text: `${esc(inrShort(a.payables.due_this_week))} ${esc(t("due this week"))}`, go: "bills" } : null]))}</div>`
				+ panel(t("Income and expenses by month"), pairCols(a.monthly), { note: a.fiscal_year })
				+ panel(t("Where the money goes"), bars(a.expense_heads, "label", "amount", { max: Math.max(...a.expense_heads.map((h) => h.amount), 1), fmt: inrShort }), { note: t("this year") });
		} else if (sub === "approvals") {
			body = panel(t("Waiting for your approval"), a.approvals.length ? `<ul class="list">${a.approvals.map((x) => `<li class="stack" data-approval="${esc(x.doctype)}|${esc(x.name)}">
				<div class="row-between"><div class="grow"><span class="meta">${esc(t(x.doctype === "Expense Claim" ? "Staff expense" : "Bill"))}, ${fmtDate(x.date)}</span><b>${esc(x.who)}</b><p class="body">${esc(x.what)}${x.by ? `. ${esc(t("Entered by"))} ${esc(x.by)}` : ""}</p></div><b class="side">${esc(inr(x.amount, cur))}</b></div>
				${a.can_approve ? `<div class="actions"><button class="btn primary" data-decide="1">${esc(t("Approve"))}</button><button class="btn" data-decide="0">${esc(t("Reject"))}</button><span class="form-msg"></span></div>` : ""}</li>`).join("")}</ul>` : `<div class="empty ok">${esc(t("Nothing waiting"))}</div>`);
		} else if (sub === "bills") {
			body = stats([{ label: "Total to pay", value: esc(inrShort(a.payables.total)) }, { label: "Overdue", value: esc(inrShort(a.payables.overdue)), tone: a.payables.overdue ? "bad" : "" }, { label: "Due this week", value: esc(inrShort(a.payables.due_this_week)) }])
				+ panel(t("Unpaid bills"), a.payables.bills.length ? `<ul class="list">${a.payables.bills.map((b) => `<li><div class="grow"><b>${esc(b.supplier)}</b><span class="meta">${esc(b.bill_no || b.name)}, ${esc(t("due"))} ${fmtDate(b.due_date)}</span></div>
					<div class="side"><b>${esc(inr(b.outstanding, cur))}</b>${b.overdue ? status("bad", `${num(-b.days)} ${t("days late")}`) : b.days !== null && b.days <= 7 ? status("warn", b.days === 0 ? t("Today") : `${t("in")} ${num(b.days)} ${t("days")}`) : ""}</div></li>`).join("")}</ul>` : empty("No unpaid bills"));
		} else {
			body = `<div class="cols2">${panel(t("Cash & bank"), a.balances.length ? `<ul class="list">${a.balances.map((b) => `<li><div class="grow"><b>${esc(b.account)}</b><span class="meta">${esc(t(b.type))}</span></div><b class="side">${esc(inr(b.balance, cur))}</b></li>`).join("")}</ul>` : empty("No cash or bank accounts yet"))}
				${panel(t("Today"), `<ul class="list"><li><span>${esc(t("Received"))}</span><b class="side good-text">${esc(inr(a.cash_today.received, cur))}</b></li><li><span>${esc(t("Paid out"))}</span><b class="side bad-text">${esc(inr(a.cash_today.paid, cur))}</b></li></ul>`)}</div>`
				+ panel(t("Recent payments in and out"), a.recent.length ? `<ul class="list">${a.recent.map((r) => `<li><div class="grow"><b>${esc(r.party || "")}</b><span class="meta">${esc(r.mode || "")}, ${fmtDate(r.date)}</span></div>
					<b class="side ${r.type === "Pay" ? "bad-text" : "good-text"}">${r.type === "Pay" ? "−" : "+"}${esc(inr(r.amount, cur))}</b></li>`).join("")}</ul>` : empty("No payments yet"));
		}
		setTimeout(() => wireApprovals(), 0);
		return screen({ kicker: `${esc(t("Accounts"))}, ${esc(t("financial year"))} ${esc(a.fiscal_year)}`, title: esc(t("School accounts")), subs, active: sub,
			body: body + `<p class="meta foot">${esc(t("Figures come straight from the school's books. Full reports (balance sheet, ledgers, trial balance) are in Admin, Accounting."))}</p>` });
	}
	function wireApprovals() {
		app.querySelectorAll("[data-approval] [data-decide]").forEach((b) => (b.onclick = async () => {
			const li = b.closest("[data-approval]");
			const [doctype, name] = li.dataset.approval.split("|");
			const msg = li.querySelector(".form-msg");
			let note = "";
			if (b.dataset.decide === "0") {
				let box = li.querySelector("input.reject-note");
				if (!box) {
					li.querySelector(".actions").insertAdjacentHTML("beforebegin", `<div class="form" style="margin-top:8px"><input class="reject-note" placeholder="${esc(t("Reason for rejecting"))}"></div>`);
					li.querySelector("input.reject-note").focus();
					return;
				}
				note = box.value.trim();
				if (!note) { box.focus(); return; }
			}
			li.querySelectorAll("button").forEach((x) => (x.disabled = true));
			msg.textContent = "…";
			try {
				const r = await post("schoolos.api.accounts.decide", { doctype, name, approve: b.dataset.decide, note });
				li.innerHTML = `<div class="meta">${esc(t(r.status))}: ${esc(name)}</div>`;
			} catch (e) {
				msg.textContent = e.message;
				li.querySelectorAll("button").forEach((x) => (x.disabled = false));
			}
		}));
	}

	function tallyCard(defaultFrom, defaultTo) {
		return `<form id="tally-form" class="form">
			<div class="row2"><label>${t("From")}<input type="date" name="from_date" value="${defaultFrom}" required></label><label>${t("To")}<input type="date" name="to_date" value="${defaultTo}" required></label></div>
			<div class="actions" style="margin-top:0"><button class="btn" type="button" data-tally="preview">${esc(t("Check what will be exported"))}</button></div>
			<div class="tally-preview"></div>
			<div class="actions" style="margin-top:0">
				<a class="btn" data-tally="masters" href="#">${esc(t("1. Ledgers (first time only)"))}</a>
				<a class="btn primary" data-tally="vouchers" href="#">${esc(t("2. Vouchers for Tally"))}</a>
				<a class="btn" data-tally="xlsx" href="#">${esc(t("Excel copy"))}</a></div>
			<p class="meta">${esc(t("In Tally: Gateway → Import → Masters (file 1, once), then Import → Transactions (file 2). Import into a test company first the first time."))}</p>
		</form>`;
	}
	function tallyView(a) {
		const now = todayISO();
		const first = now.slice(0, 8) + "01";
		return screen({ kicker: esc(t("Accounts")), title: esc(t("Fees ready for Tally")), body:
			stats([{ label: "Fee bills this month", value: num(a.month_invoices) }, { label: "Receipts this month", value: num(a.month_receipts) },
				{ label: "Received", value: esc(inrShort(a.month_received)) },
				{ label: "Last export", value: a.last_export ? esc(fmtDate(a.last_export.on)) : esc(t("Never")) }])
			+ `<div class="cols2">${panel(t("Export for Tally"), tallyCard(first, now))}
			${panel(t("How it maps"), `<p class="body">${esc(t("Books are kept in Tally by the school's accountant. Export fee bills and receipts here and import them into"))} <b>${esc(a.tally_company)}</b>.</p><ul class="list">
				<li><span>${esc(t("Each fee bill"))}</span><b class="side">${esc(t("Sales voucher"))}</b></li>
				<li><span>${esc(t("Each payment"))}</span><b class="side">${esc(t("Receipt voucher"))}</b></li>
				<li><span>${esc(t("Students"))}</span><b class="side">${esc(a.cfg.party_mode === "single" ? a.cfg.party_ledger || "Student Fees Receivable" : t("One ledger each, under") + " " + (a.cfg.debtors_group || "Sundry Debtors"))}</b></li>
				<li><span>${esc(t("Fee income"))}</span><b class="side">${esc(a.cfg.income_ledger || t("One ledger per fee head"))}</b></li>
				<li><span>${esc(t("Cash / bank"))}</span><b class="side">${esc(a.cfg.cash_ledger || "Cash")} / ${esc(a.cfg.bank_ledger || "Bank")}</b></li></ul>
				<p class="meta">${esc(t("Change these in Settings, Accounts to match the ledger names in Tally."))}</p>`)}</div>` });
	}
	async function tallyAction(btn) {
		const f = app.querySelector("#tally-form");
		const from_date = f.from_date.value, to_date = f.to_date.value;
		const what = btn.dataset.tally;
		if (what === "preview") {
			const box = f.querySelector(".tally-preview");
			box.innerHTML = `<div class="meta">…</div>`;
			try {
				const p = await call("schoolos.api.accounts.tally_preview", { from_date, to_date });
				box.innerHTML = `<div class="kv3"><div><span>${esc(t("Fee bills"))}</span><b>${num(p.invoices)}</b></div><div><span>${esc(t("Receipts"))}</span><b>${num(p.receipts)}</b></div><div><span>${esc(t("Ledgers"))}</span><b>${num(p.ledgers)}</b></div></div>
					<div class="meta">${esc(t("Billed"))} ${esc(inr(p.billed))} · ${esc(t("Received"))} ${esc(inr(p.received))}</div>
					${p.sample.length ? `<div class="scroll"><table><thead><tr><th>${esc(t("Date"))}</th><th>${esc(t("Type"))}</th><th>${esc(t("No."))}</th><th>${esc(t("Ledger"))}</th><th class="num">Dr</th><th class="num">Cr</th></tr></thead><tbody>
					${p.sample.flatMap((v) => v.entries.map((e, i) => `<tr><td>${i ? "" : fmtDate(v.date)}</td><td>${i ? "" : esc(v.type)}</td><td>${i ? "" : esc(v.number)}</td><td>${esc(e.ledger)}</td><td class="num">${e.amount > 0 ? esc(inr(e.amount)) : ""}</td><td class="num">${e.amount < 0 ? esc(inr(-e.amount)) : ""}</td></tr>`)).join("")}</tbody></table></div>` : ""}`;
			} catch (e) { box.innerHTML = `<div class="error" style="margin:0">${esc(e.message)}</div>`; }
			return;
		}
		const qs = new URLSearchParams({ from_date, to_date, part: what === "masters" ? "masters" : "vouchers", fmt: what === "xlsx" ? "xlsx" : "xml" });
		const url = `/api/method/schoolos.api.accounts.tally_export?${qs}`;
		if (window.__schoolosDownload) window.__schoolosDownload(url, Object.fromEntries(qs));
		else window.location.href = url;
	}

	// ---------- calendar & gallery
	const EV = { Holiday: "var(--bad)", Exam: "var(--marigold)", PTM: "#8b6fd6", Event: "var(--brand)", Celebration: "#d65f8b", Sports: "var(--good)", Trip: "#3aa6b9", "Fee due": "var(--warn)", Other: "var(--faint)" };
	let calState = null;
	function monthGrid(year, month, items) {
		const first = new Date(year, month - 1, 1);
		const days = new Date(year, month, 0).getDate();
		const pad = (first.getDay() + 6) % 7;
		const byDay = {};
		items.forEach((it) => {
			let d = day(it.date), end = day(it.end_date || it.date);
			while (d <= end) {
				if (d.getMonth() === month - 1) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(it);
				d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
			}
		});
		const today = todayISO();
		const names = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc(), { weekday: "short" }));
		let cells = "";
		for (let i = 0; i < pad; i++) cells += `<span class="cd blank"></span>`;
		for (let d = 1; d <= days; d++) {
			const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
			const list = byDay[d] || [];
			const hol = list.some((x) => x.type === "Holiday");
			cells += `<button type="button" class="cd ${iso === today ? "today" : ""} ${hol ? "hol" : ""} ${list.length ? "has" : ""}" data-day="${iso}" aria-label="${esc(iso)} ${list.map((x) => esc(x.title)).join(", ")}">
				<span class="n">${d}</span><span class="dots">${list.slice(0, 3).map((x) => `<i style="background:${EV[x.type] || EV.Other}"></i>`).join("")}</span>
				<span class="lbl">${list[0] ? esc(list[0].title) : ""}</span></button>`;
		}
		return `<div class="calgrid">${names.map((n) => `<span class="cw">${esc(n)}</span>`).join("")}${cells}</div>`;
	}
	const evRow = (x) => `<li><span class="evbar" style="background:${EV[x.type] || EV.Other}"></span><div style="min-width:0;flex:1"><b>${esc(x.title)}</b>
		<div class="meta">${esc(t(x.type))}${x.time ? " · " + esc(x.time) : ""}${x.place ? " · " + esc(x.place) : ""}${x.amount ? " · " + esc(inr(x.amount)) : ""}</div>${x.details ? `<div class="circular-body">${esc(x.details)}</div>` : ""}</div>
		<span class="meta" style="flex:none;text-align:right">${fmtDate(x.date)}${x.end_date && x.end_date !== x.date ? ` – ${fmtDate(x.end_date)}` : ""}</span></li>`;
	async function calendarView(sub = "calendar") {
		const now = new Date();
		calState = calState || { year: now.getFullYear(), month: now.getMonth() + 1, day: null };
		const [c, albums] = await Promise.all([
			call("schoolos.api.school_calendar.month", { year: calState.year, month: calState.month }),
			call("schoolos.api.school_calendar.albums", { limit: 12 }).catch(() => []),
		]);
		const subs = [["calendar", "Calendar"], albums.length ? ["photos", "Photos"] : null].filter(Boolean);
		if (!subs.some(([k]) => k === sub)) sub = "calendar";
		const label = new Date(c.year, c.month - 1, 1).toLocaleDateString(loc(), { month: "long", year: "numeric" });
		const dayItems = calState.day ? c.items.filter((x) => x.date <= calState.day && (x.end_date || x.date) >= calState.day) : null;
		const body = sub === "photos"
			? panel(t("Photo albums"), `<div class="albums">${albums.map((al) => `<button type="button" class="album" data-album="${esc(al.name)}">
				<span class="cover" style="background-image:url('${esc(al.cover)}')"></span><b>${esc(al.title)}</b><span class="meta">${fmtDate(al.date)}, ${num(al.count)} ${esc(t("photos"))}</span></button>`).join("")}</div>`)
			: `<div class="cols2 wide-left">${panel(label, monthGrid(c.year, c.month, c.items) + `<div class="legend">${Object.entries(EV).filter(([k]) => c.items.some((x) => x.type === k)).map(([k, col]) => `<span><i style="background:${col}"></i>${esc(t(k))}</span>`).join("")}</div>`,
				{ action: `<div class="month-nav"><button class="btn small" data-cal="-1" aria-label="${esc(t("Previous"))}">‹</button><button class="btn small" data-cal="0">${esc(t("This month"))}</button><button class="btn small" data-cal="1" aria-label="${esc(t("Next"))}">›</button></div>` })}
				${panel(dayItems ? new Date(calState.day + "T00:00:00").toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" }) : t("Coming up"),
					(dayItems || c.upcoming).length ? `<ul class="list ev">${(dayItems || c.upcoming).map(evRow).join("")}</ul>` : empty(dayItems ? "Nothing on this day" : "Nothing in the next 30 days"),
					{ note: dayItems ? "" : t("next 30 days") })}</div>`;
		return screen({ kicker: esc(t("School calendar")), title: esc(label), subs, active: sub, body });
	}
	async function openAlbum(name) {
		const a = await call("schoolos.api.school_calendar.album", { name });
		let i = 0;
		const ov = document.createElement("div");
		ov.className = "lightbox";
		ov.setAttribute("role", "dialog");
		ov.setAttribute("aria-label", a.title);
		const draw = () => {
			const p = a.photos[i] || {};
			ov.innerHTML = `<div class="lb-top"><b>${esc(a.title)}</b><span>${i + 1} / ${a.photos.length}</span><button type="button" class="lb-x" aria-label="${esc(t("Close"))}">×</button></div>
				<div class="lb-img"><button type="button" class="lb-nav" data-d="-1" aria-label="${esc(t("Previous"))}">‹</button><img src="${esc(p.image)}" alt="${esc(p.caption || a.title)}"><button type="button" class="lb-nav" data-d="1" aria-label="${esc(t("Next"))}">›</button></div>
				<div class="lb-cap">${esc(p.caption || "")}</div>
				<div class="lb-strip">${a.photos.map((x, k) => `<button type="button" data-k="${k}" class="${k === i ? "on" : ""}" style="background-image:url('${esc(x.image)}')" aria-label="${k + 1}"></button>`).join("")}</div>`;
			ov.querySelector(".lb-x").onclick = () => ov.remove();
			ov.querySelectorAll(".lb-nav").forEach((b) => (b.onclick = () => { i = (i + Number(b.dataset.d) + a.photos.length) % a.photos.length; draw(); }));
			ov.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { i = Number(b.dataset.k); draw(); }));
		};
		draw();
		ov.addEventListener("keydown", (e) => {
			if (e.key === "Escape") ov.remove();
			if (e.key === "ArrowRight" || e.key === "ArrowLeft") { i = (i + (e.key === "ArrowRight" ? 1 : -1) + a.photos.length) % a.photos.length; draw(); }
		});
		(document.getElementById("sos-root") || document.body).appendChild(ov);
		ov.tabIndex = -1;
		ov.focus();
	}
	// ---------- leave (parent / student side)
	async function leavePanel(student) {
		const rows = await call("schoolos.api.leave.for_student", { student });
		const now = todayISO();
		const tone2 = (s) => (s === "Approved" ? "good" : s === "Rejected" ? "bad" : "warn");
		return `<div class="cols2">${panel(t("Apply for leave"), `<form id="leave-form" class="form" data-student="${esc(student)}">
				<div class="row2"><label>${t("From")}<input type="date" name="from_date" value="${now}" required></label><label>${t("To")}<input type="date" name="to_date" value="${now}" required></label></div>
				<label>${t("Reason")}<textarea name="reason" rows="2" required placeholder="${esc(t("e.g. Fever, doctor advised two days' rest."))}"></textarea></label>
				<div class="actions"><button class="btn primary" type="submit">${t("Send to class teacher")}</button><span class="form-msg" aria-live="polite"></span></div>
				<p class="meta">${esc(t("Once approved, these days show as leave, not absent, and you won't get an absence alert."))}</p></form>`)}
			${panel(t("Leave requests"), rows.length ? `<ul class="list">${rows.map((r) => `<li><div class="grow"><b>${fmtDate(r.from_date)}${r.to_date !== r.from_date ? ` ${t("to")} ${fmtDate(r.to_date)}` : ""}</b>
				<p class="body">${esc(stripHtml(r.reason))}</p>${r.schoolos_decision_note ? `<span class="meta">${esc(r.decided_by || "")}: ${esc(stripHtml(r.schoolos_decision_note))}</span>` : ""}</div>
				<div class="side">${status(tone2(r.status), t(r.status))}${r.status === "Pending" ? `<button class="btn small" data-withdraw="${esc(r.name)}">${esc(t("Withdraw"))}</button>` : ""}</div></li>`).join("")}</ul>` : empty("No leave requests yet"))}</div>`;
	}

	// ---------- leave (teacher side)
	function leaveRequests(list) {
		if (!list || !list.length) return `<div class="empty ok">${esc(t("No requests waiting"))}</div>`;
		return `<ul class="list">${list.map((r) => `<li class="stack" data-leave="${esc(r.name)}">
			<div class="grow"><b>${esc(r.student_name)}</b><span class="meta">${esc(short(r.student_group))}, ${fmtDate(r.from_date)}${r.to_date !== r.from_date ? ` ${t("to")} ${fmtDate(r.to_date)}` : ""} (${num(r.total_leave_days || 1)} ${esc(t("days"))})</span>
			<p class="body">${esc(stripHtml(r.reason))}</p></div>
			<div class="actions"><button class="btn primary" data-leave-ok="1">${esc(t("Approve"))}</button><button class="btn" data-leave-ok="0">${esc(t("Reject"))}</button><span class="form-msg"></span></div></li>`).join("")}</ul>`;
	}
	async function decideLeave(btn) {
		const li = btn.closest("[data-leave]");
		const msg = li.querySelector(".form-msg");
		let note = "";
		if (btn.dataset.leaveOk === "0") {
			let box = li.querySelector("input.reject-note");
			if (!box) {
				li.querySelector(".actions").insertAdjacentHTML("beforebegin", `<div class="form" style="margin:8px 0 0 44px"><input class="reject-note" placeholder="${esc(t("Reason (the parent will see this)"))}"></div>`);
				li.querySelector("input.reject-note").focus();
				return;
			}
			note = box.value.trim();
			if (!note) { box.focus(); return; }
		}
		li.querySelectorAll("button").forEach((x) => (x.disabled = true));
		msg.textContent = "…";
		try {
			const r = await post("schoolos.api.leave.decide", { name: li.dataset.leave, approve: btn.dataset.leaveOk, note });
			li.innerHTML = `<div class="meta"><b>${esc(r.student_name)}</b>: ${esc(t(r.status))}</div>`;
		} catch (e) {
			msg.textContent = e.message;
			li.querySelectorAll("button").forEach((x) => (x.disabled = false));
		}
	}

	// ---------- shell
	const VIEWS = {
		principal: { label: "Principal", render: principalView },
		teacher: { label: "My classes", render: teacherView },
		fees: { label: "Fees", render: feesView },
		accounts: { label: "Accounts", render: accountsView },
		parent: { label: "My children", render: parentView },
		student: { label: "My dashboard", render: (sub) => studentView(null, null, sub || "overview") },
		calendar: { label: "Calendar", render: calendarView },
	};

	async function show(view, arg, sub) {
		current = { view, arg, sub };
		[...tabs.children].forEach((b) => b.dataset && b.dataset.view && b.setAttribute("aria-selected", String(b.dataset.view === view)));
		app.innerHTML = `<div class="loading">${t("Loading…")}</div>`;
		try {
			app.innerHTML = arg ? await studentView(arg, view, sub || "overview") : await VIEWS[view].render(sub);
			const nf = app.querySelector("#note-form");
			if (nf) fillNoteStudents(nf);
			if (!navigator.onLine) app.insertAdjacentHTML("afterbegin", `<div class="offline">${t("You're offline. Showing the last saved data.")}</div>`);
		} catch (e) {
			app.innerHTML = `<div class="error">${esc(e.message || t("Something went wrong"))}</div>`;
		}
		try { localStorage.setItem("schoolos:view", view); } catch (e) {}
	}

	app.addEventListener("click", (e) => {
		const tl = e.target.closest("[data-tally]");
		if (tl) { e.preventDefault(); return tallyAction(tl); }
		const cm = e.target.closest("[data-cal]");
		if (cm) {
			const n = Number(cm.dataset.cal), d = new Date();
			if (n === 0) calState = { year: d.getFullYear(), month: d.getMonth() + 1, day: null };
			else { const m = new Date(calState.year, calState.month - 1 + n, 1); calState = { year: m.getFullYear(), month: m.getMonth() + 1, day: null }; }
			return show("calendar");
		}
		const cd = e.target.closest("[data-day]");
		if (cd) { calState.day = calState.day === cd.dataset.day ? null : cd.dataset.day; return show("calendar"); }
		const al = e.target.closest("[data-album]");
		if (al) return openAlbum(al.dataset.album).catch((err) => alert(err.message));
		const lo = e.target.closest("[data-leave-ok]");
		if (lo) return decideLeave(lo);
		const wd = e.target.closest("[data-withdraw]");
		if (wd) {
			wd.disabled = true;
			return post("schoolos.api.leave.withdraw", { name: wd.dataset.withdraw }).then(() => show(current.view, current.arg, "leave")).catch((err) => { wd.disabled = false; alert(err.message); });
		}
		const pb = e.target.closest("[data-pay]");
		if (pb) return openPay(pb);
		const sv = e.target.closest("[data-sv]");
		if (sv) return show(current.view, current.arg, sv.dataset.sv);
		const vg = e.target.closest("[data-view-go]");
		if (vg) return show(vg.dataset.viewGo);
		// forms (leave, pay) also carry data-student; clicks inside them must not navigate away
		const s = e.target.closest("[data-student]");
		if (s && s.tagName !== "FORM" && !s.closest("form")) return show("parent", s.dataset.student, s.dataset.sub || (current && current.view === "parent" && current.sub) || "overview");
		const b = e.target.closest("[data-back]");
		if (b) return show(b.dataset.back);
	});

	app.addEventListener("change", (e) => {
		const lf = e.target.form && e.target.form.id === "lesson-form" ? e.target.form : null;
		if (lf && (e.target.name === "student_group" || e.target.name === "course")) {
			const data = window.__schoolosLessons || {};
			const g = lf.student_group.value;
			if (e.target.name === "student_group") {
				lf.course.innerHTML = (data[g] || []).map((c) => `<option value="${esc(c.course)}">${esc(c.course)}${c.percentage !== null && c.percentage !== undefined ? ` · ${pct(c.percentage)}` : ""}</option>`).join("");
			}
			const c = (data[g] || []).find((x) => x.course === lf.course.value);
			lf.topic.innerHTML = topicOptions(c);
			return;
		}
		if (e.target.matches && e.target.matches("[data-note-group]")) return fillNoteStudents(e.target.form);
		if (e.target.name === "student_group" && e.target.form && e.target.form.id === "hw-form") {
			const sel = e.target.form.querySelector('select[name="course"]');
			const list = (window.__schoolosCourses || {})[e.target.value] || [];
			sel.innerHTML = [`<option value="">${t("Any subject")}</option>`].concat(list.map((c) => `<option>${esc(c)}</option>`)).join("");
		}
	});

	app.addEventListener("submit", async (e) => {
		if (e.target.classList.contains("paybox")) { e.preventDefault(); return pay(e.target); }
		if (e.target.id === "tally-form") { e.preventDefault(); return; }
		if (e.target.id === "leave-form") {
			e.preventDefault();
			const f = e.target, msg = f.querySelector(".form-msg"), btn = f.querySelector('button[type="submit"]');
			btn.disabled = true;
			msg.textContent = "…";
			try {
				await post("schoolos.api.leave.apply", { student: f.dataset.student, from_date: f.from_date.value, to_date: f.to_date.value, reason: f.reason.value });
				msg.textContent = t("Sent");
				setTimeout(() => show(current.view, current.arg, "leave"), 700);
			} catch (err) { msg.textContent = err.message; btn.disabled = false; }
			return;
		}
		if (e.target.id === "lesson-form" || e.target.id === "note-form") {
			e.preventDefault();
			const f = e.target, msg = f.querySelector(".form-msg"), btn = f.querySelector('button[type="submit"]');
			const v = Object.fromEntries(new FormData(f).entries());
			btn.disabled = true;
			msg.textContent = "…";
			try {
				if (f.id === "lesson-form") {
					v.completed = v.completed ? 1 : 0;
					const r = await post("schoolos.api.learning.post_lesson", v);
					msg.textContent = `${t("Saved")}${r.coverage && r.coverage.percentage !== null ? ` · ${t("Syllabus coverage")} ${pct(r.coverage.percentage)}` : ""}`;
				} else {
					v.share = v.share ? 1 : 0;
					await post("schoolos.api.learning.post_note", { student: v.student, log: v.log, type: v.type, share: v.share });
					msg.textContent = t("Saved");
				}
				setTimeout(() => show(current.view, current.arg, current.sub), 1100);
			} catch (err) {
				msg.textContent = err.message;
				btn.disabled = false;
			}
			return;
		}
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
			setTimeout(() => show(current.view, current.arg, current.sub), 900);
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
