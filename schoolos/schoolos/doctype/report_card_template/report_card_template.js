frappe.ui.form.on("Report Card Template", {
	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("Generate Report Cards"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Generate Report Cards"),
				fields: [
					{
						fieldname: "student_group",
						fieldtype: "Link",
						options: "Student Group",
						label: __("Student Group (Class / Section)"),
						reqd: 1,
						get_query: () => ({ filters: { academic_year: frm.doc.academic_year, disabled: 0 } }),
					},
					{
						fieldname: "submit",
						fieldtype: "Check",
						label: __("Publish immediately (notifies parents)"),
						description: __("Leave unticked to review drafts first."),
					},
				],
				primary_action_label: __("Generate"),
				primary_action(values) {
					frappe.call({
						method: "schoolos.api.report_card.generate",
						args: { template: frm.doc.name, student_group: values.student_group, submit: values.submit ? 1 : 0 },
						freeze: true,
						freeze_message: __("Calculating marks..."),
						callback(r) {
							d.hide();
							const m = r.message || {};
							frappe.msgprint(
								__("Created {0}, refreshed {1}, already published {2}.", [m.created, m.refreshed, m.already_published])
							);
							frappe.set_route("List", "Student Report Card", { template: frm.doc.name, student_group: values.student_group });
						},
					});
				},
			});
			d.show();
		});
	},
});
