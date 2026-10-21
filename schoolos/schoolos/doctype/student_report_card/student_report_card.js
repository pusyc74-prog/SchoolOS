frappe.ui.form.on("Student Report Card", {
	refresh(frm) {
		if (frm.doc.docstatus === 0 && !frm.is_new()) {
			frm.add_custom_button(__("Refresh Marks"), () => {
				frm.call("refresh_marks").then(() => frm.save());
			});
		}
	},
});
