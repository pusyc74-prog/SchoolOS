app_name = "schoolos"
app_title = "SchoolOS"
app_publisher = "Alacrity Solutions"
app_description = "School dashboards, parent alerts and board-format report cards on Frappe Education"
app_email = "hello@example.com"
app_license = "GNU GPL v3"

required_apps = ["frappe/erpnext", "frappe/education"]

add_to_apps_screen = [
    {
        "name": "schoolos",
        "logo": "/assets/schoolos/images/logo.svg",
        "title": "SchoolOS",
        "route": "/school",
    }
]

# Install / migrate
after_install = "schoolos.install.after_install"
after_migrate = "schoolos.install.after_migrate"

# Our dashboard page lives at /school (schoolos/www/school.py)
website_route_rules = [
    {"from_route": "/school/<path:app_path>", "to_route": "school"},
]

# Alerts
doc_events = {
    "Student Attendance": {
        "on_submit": "schoolos.alerts.events.on_student_attendance_submit",
    },
}

scheduler_events = {
    "hourly": [
        "schoolos.alerts.engine.retry_failed",
    ],
    "daily": [
        "schoolos.api.fees.send_scheduled_reminders",
    ],
}

# Keep the alert log from growing forever
default_log_clearing_doctypes = {
    "SchoolOS Alert Log": 180,
}
