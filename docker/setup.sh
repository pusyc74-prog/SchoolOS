#!/usr/bin/env bash
# One-time setup inside the frappe container:
#   docker compose -f docker/compose.yml exec frappe bash /workspace/schoolos/docker/setup.sh
# Takes 15-30 minutes the first time (downloads Frappe, ERPNext, HR, Education).
set -euo pipefail

SITE="${SITE:-school.localhost}"
BRANCH="${BRANCH:-version-16}"
BENCH=/home/frappe/frappe-bench

if [ ! -d "$BENCH" ]; then
  echo "==> Creating bench ($BRANCH)"
  cd /home/frappe
  bench init --skip-redis-config-generation --frappe-branch "$BRANCH" frappe-bench
fi
cd "$BENCH"

echo "==> Pointing bench at the Docker services"
bench set-config -g db_host mariadb
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379
bench set-config -g developer_mode 1

for app in erpnext hrms education; do
  if [ ! -d "apps/$app" ]; then
    echo "==> Getting $app"
    bench get-app --branch "$BRANCH" "$app"
  fi
done

if [ ! -e apps/schoolos ]; then
  echo "==> Linking SchoolOS from /workspace/schoolos (your edits on the Mac show up live)"
  ln -s /workspace/schoolos apps/schoolos
  ./env/bin/pip install -e apps/schoolos
  grep -qx schoolos sites/apps.txt || echo schoolos >> sites/apps.txt
fi

if [ ! -d "sites/$SITE" ]; then
  echo "==> Creating site $SITE"
  bench new-site "$SITE" --db-root-password 123 --admin-password admin --mariadb-user-host-login-scope=%
  bench --site "$SITE" install-app erpnext
  bench --site "$SITE" install-app hrms
  bench --site "$SITE" install-app education
  bench --site "$SITE" install-app schoolos
fi
bench use "$SITE"

echo "==> Sending outgoing email to Mailpit (http://localhost:8025)"
bench --site "$SITE" execute frappe.client.insert --kwargs '{"doc": {"doctype": "Email Account", "email_account_name": "Mailpit", "email_id": "school@demo.local", "smtp_server": "mailpit", "smtp_port": 1025, "use_tls": 0, "use_ssl": 0, "no_smtp_authentication": 1, "enable_outgoing": 1, "default_outgoing": 1, "awaiting_password": 0}}' >/dev/null 2>&1 || true

bench build --app schoolos

cat <<EOF

Done. Next:
  1. bench start                      (keep this running)
  2. Open http://$SITE:8000 , log in as Administrator / admin and finish the setup wizard
     (country India, currency INR; any company name).
  3. In a second terminal (same container):
       cd $BENCH && bench --site $SITE execute schoolos.demo.make_demo
  4. Open http://$SITE:8000/school and log in with the demo users it prints.
EOF
