frappe.ui.form.on("SchoolOS Student Import", {
	onload(frm) {
		if (frm.is_new() && !frm.doc.academic_year) {
			frappe.db.get_single_value("Education Settings", "current_academic_year").then((y) => y && frm.set_value("academic_year", y));
		}
	},
	refresh(frm) {
		frm.add_custom_button(__("Download Template"), () => {
			const y = encodeURIComponent(frm.doc.academic_year || "");
			window.open(`/api/method/schoolos.schoolos.doctype.schoolos_student_import.schoolos_student_import.download_template?academic_year=${y}`);
		});
		if (frm.is_new()) return;
		if (frm.doc.import_file && !["Queued", "Importing"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Validate"), () =>
				frm.call({ doc: frm.doc, method: "check_file", freeze: true, freeze_message: __("Checking rows...") })
					.then((r) => {
						frm.reload_doc();
						const m = r.message || {};
						frappe.show_alert({ message: __("{0} of {1} rows ready", [m.ready, m.total]), indicator: m.ready ? "green" : "red" });
					})
			);
		}
		if (["Validated", "Completed with Errors"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Start Import"), () =>
				frappe.confirm(__("Import {0} students into {1}?", [frm.doc.valid_rows, frm.doc.academic_year]), () =>
					frm.call({ doc: frm.doc, method: "start_import" }).then(() => {
						frappe.show_alert(__("Import started. This page updates when it finishes."));
						frm.reload_doc();
					})
				)
			).addClass("btn-primary");
		}
		frappe.realtime.off("progress");
		frappe.realtime.on("progress", (d) => {
			if (d && d.title === __("Importing students")) frm.dashboard.show_progress(__("Importing"), d.percent);
			if (d && d.percent >= 100) setTimeout(() => frm.reload_doc(), 1500);
		});
	},
});
