frappe.ui.form.on("SchoolOS Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Send Test Alert"), () => {
			frappe.prompt(
				[
					{ fieldname: "mobile", fieldtype: "Data", label: __("Mobile (WhatsApp)") },
					{ fieldname: "email", fieldtype: "Data", label: __("Email"), options: "Email" },
				],
				(v) => {
					frappe.call({
						method: "schoolos.alerts.engine.send_test",
						args: v,
						callback(r) {
							const rows = (r.message || []).map((x) => `${x.channel}: ${x.status}${x.error ? " - " + x.error : ""}`);
							frappe.msgprint(rows.join("<br>") || __("Nothing sent. Enter a mobile or email."));
						},
					});
				},
				__("Send Test Alert"),
				__("Send")
			);
		});
		frm.add_custom_button(__("Open Dashboard"), () => window.open("/school", "_blank"));
	},
});
