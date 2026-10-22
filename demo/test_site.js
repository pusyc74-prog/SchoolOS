// Browser test of the demo site: every app loads without errors, is installable, and the
// cross-app flows work (attendance -> parent, leave -> teacher -> parent, homework, payment).
const { chromium } = require(process.env.PW || "/opt/npm-tools/node_modules/playwright");
const BASE = process.env.BASE || "http://localhost:8765";
const SHOTS = process.env.SHOTS || ".";
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
	const browser = await chromium.launch();
	const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
	const desk = { viewport: { width: 1366, height: 860 } };
	const ctx = await browser.newContext(phone);   // one context = one device: apps share saved state
	const errors = [];
	ctx.on("weberror", (e) => errors.push(String(e.error())));
	const open = async (path, opts = {}) => {
		const p = await (opts.ctx || ctx).newPage();
		p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|favicon|ERR_/.test(m.text())) errors.push(path + ": " + m.text()); });
		p.on("pageerror", (e) => errors.push(path + ": " + e.message));
		await p.goto(BASE + path, { waitUntil: "load" });
		await sleep(900);
		return p;
	};

	// launcher
	let p = await open("/");
	ok((await p.locator(".app").count()) === 5, "launcher lists 5 apps");
	ok((await p.textContent("title")).includes("Infant Jesus School"), "launcher title");
	await p.screenshot({ path: `${SHOTS}/launcher-phone.png`, fullPage: true });
	await p.close();

	// each app: loads, branded, installable
	const apps = { parents: "phone", teachers: "phone", students: "phone", principal: "desktop", office: "desktop" };
	const dctx = await browser.newContext(desk);
	dctx.on("weberror", (e) => errors.push(String(e.error())));
	for (const [key, dev] of Object.entries(apps)) {
		p = await open(`/${key}/`, { ctx: dev === "phone" ? ctx : dctx });
		await p.waitForSelector("#app .card, #app section, #app .grid, #app h2", { timeout: 8000 }).catch(() => {});
		const txt = await p.locator("#screen").innerText();
		ok(txt.includes("Infant Jesus School"), `${key}: school name shown`);
		ok(!/undefined|NaN|Not in this prototype|class="error"/.test(await p.locator("#screen").innerHTML()), `${key}: no undefined/NaN/errors on screen`);
		const man = await p.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
		ok(man.short_name && man.icons.length === 3 && man.display === "standalone", `${key}: manifest ${man.short_name}`);
		await sleep(1200);
		const sw = await p.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("ijs-")));
		ok(sw, `${key}: offline worker registered`);
		const cdp = await (dev === "phone" ? ctx : dctx).newCDPSession(p);
		const inst = await cdp.send("Page.getInstallabilityErrors").catch((e) => ({ installabilityErrors: [{ errorId: String(e) }] }));
		ok(inst.installabilityErrors.length === 0, `${key}: installable ${JSON.stringify(inst.installabilityErrors.map((e) => e.errorId))}`);
		await p.screenshot({ path: `${SHOTS}/${key}-${dev}.png` });
		// every tab of the app opens
		for (const b of await p.locator("#appnav button[data-go]").all()) {
			const label = await b.innerText();
			await b.click(); await sleep(700);
			const h = await p.locator("#screen").innerHTML();
			ok(h.length > 800 && !/class="error"|Not in this prototype/.test(h), `${key} → ${label}`);
		}
		await p.close();
	}

	// ---- flow 1: teacher marks two absent -> parent sees absence today
	p = await open("/teachers/#attendance");
	await p.click("#att-all"); await sleep(200);
	await p.locator('[data-row="1"][data-k="a"]').click(); await sleep(150);    // Riya (2nd child of demo parent)
	await p.locator('[data-row="4"][data-k="a"]').click(); await sleep(150);
	await p.click("#att-submit"); await sleep(600);
	ok((await p.locator("#screen").innerText()).includes("Attendance submitted"), "teacher submits attendance");
	await p.close();
	p = await open("/parents/");
	const parentTxt = await p.locator("#screen").innerText();
	await p.screenshot({ path: `${SHOTS}/parents-after-attendance.png` });
	const state = await p.evaluate(() => JSON.parse(localStorage.getItem("ijs-demo-state")));
	ok(state.s.todayAbsent && state.s.todayAbsent.length === 2, "absences saved for other apps");
	await p.close();

	// ---- flow 2: parent applies for leave -> teacher approves -> parent sees Approved
	p = await open("/parents/");
	await p.locator("[data-student]:not([data-sub])").first().click(); await sleep(700);
	const leaveTab = p.locator('[data-sv="leave"]');
	ok(await leaveTab.count() > 0, "parent: leave tab");
	await leaveTab.click(); await sleep(700);
	const d = new Date(); d.setDate(d.getDate() + 12);
	const iso = d.toISOString().slice(0, 10);
	await p.fill('#leave-form input[name="from_date"]', iso);
	await p.fill('#leave-form input[name="to_date"]', iso);
	await p.fill('#leave-form textarea[name="reason"]', "Cousin's wedding (demo)");
	await p.click('#leave-form button[type="submit"]'); await sleep(1400);
	ok((await p.locator("#screen").innerText()).includes("Cousin's wedding"), "parent: leave request listed");
	await p.close();
	p = await open("/teachers/");
	const tTxt = await p.locator("#screen").innerText();
	ok(tTxt.includes("Cousin's wedding"), "teacher: sees the new leave request");
	const li = p.locator("li[data-leave]", { hasText: "Cousin's wedding" });
	ok(await li.count() === 1, "teacher: leave card with approve button");
	await li.locator('[data-leave-ok="1"]').click(); await sleep(900);
	await p.close();
	p = await open("/parents/");
	await p.locator("[data-student]:not([data-sub])").first().click(); await sleep(600);
	await p.locator('[data-sv="leave"]').click(); await sleep(700);
	const lv = await p.locator("#screen").innerText();
	ok(/Approved/.test(lv.split("Cousin's wedding")[0].slice(-400) + lv.split("Cousin's wedding")[1]?.slice(0, 400)), "parent: sees leave approved");
	await p.screenshot({ path: `${SHOTS}/parents-leave.png` });
	await p.close();

	// ---- flow 3: teacher posts homework -> parent & student see it
	p = await open("/teachers/");
	const hwBtn = p.locator("#screen button", { hasText: /homework/i }).first();
	if (await hwBtn.count()) { await hwBtn.click(); await sleep(600); }
	await p.fill('#hw-form input[name="title"]', "Learn the 12 times table (demo)");
	await p.click('#hw-form button[type="submit"]'); await sleep(1200);
	await p.close();
	for (const app of ["parents", "students"]) {
		p = await open(`/${app}/`);
		if (app === "parents") { await p.locator("[data-student]:not([data-sub])").first().click(); await sleep(700); }
		ok((await p.locator("#screen").innerText()).includes("12 times table"), `${app}: sees the new homework`);
		await p.close();
	}

	// ---- flow 4: parent pays fee -> office collected today goes up
	p = await open("/parents/");
	await p.locator("[data-student]:not([data-sub])").first().click(); await sleep(600);
	await p.locator('[data-sv="fees"]').click(); await sleep(700);
	const pay = p.locator("#screen button", { hasText: /^Pay/ }).first();
	ok(await pay.count() > 0, "parent: pay button");
	if (await pay.count()) {
		await pay.click(); await sleep(500);
		await p.fill('form.paybox input[name="phone"]', "9876543210");
		await p.click('form.paybox button[type="submit"]'); await sleep(900);
		await p.locator(".rzp .rzp-opt").first().click(); await sleep(2800);
	}
	await p.screenshot({ path: `${SHOTS}/parents-paid.png` });
	const paid = await p.evaluate(() => JSON.parse(localStorage.getItem("ijs-demo-state")).s.paidToday || 0);
	ok(paid > 0, `parent payment recorded (₹${paid})`);
	await p.close();

	// ---- reset
	p = await open("/");
	await p.click("#reset"); await sleep(300);
	ok(await p.evaluate(() => localStorage.getItem("ijs-demo-state") === null), "reset clears demo data");
	await p.close();

	// tour still works
	p = await open("/tour/", { ctx: dctx });
	ok((await p.locator("#groups button").count()) > 20, "guided tour lists every screen");
	await p.screenshot({ path: `${SHOTS}/tour.png` });
	await p.close();

	const uniq = [...new Set(errors)];
	ok(uniq.length === 0, `no JavaScript errors${uniq.length ? ":\n  " + uniq.join("\n  ") : ""}`);
	await browser.close();
	console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
	process.exit(fails ? 1 : 0);
})();
