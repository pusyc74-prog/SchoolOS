#!/usr/bin/env bash
# Safe update of a school's server (run as the frappe user, after school hours):
#   SITE=app.sunriseschool.in bash ~/frappe-bench/apps/schoolos/deploy/update.sh
#
# 1. fresh backup  2. maintenance page on  3. pull SchoolOS (and Frappe/ERPNext/HR/Education
# patch releases on the same major version)  4. migrate + build  5. smoke check  6. back online.
# If anything fails it stops with the maintenance page still up and prints the rollback command.
set -euo pipefail
BENCH="${BENCH:-$HOME/frappe-bench}"
SITE="${SITE:?set SITE}"
APPS_TOO="${APPS_TOO:-1}"   # 0 = update SchoolOS only
export PATH="$HOME/.local/bin:$PATH"
cd "$BENCH"

echo "==> Backup"
bench --site "$SITE" backup --with-files --compress
dir="sites/$SITE/private/backups"
sql=$(ls -t "$dir"/*-database.sql.gz | head -1)
echo "    $sql"
rollback() {
  cat <<EOF

UPDATE FAILED. The site is in maintenance mode. To go back to the state before the update:
  cd $BENCH
  for a in apps/*; do git -C \$a reset --hard ORIG_HEAD 2>/dev/null || true; done
  bench --site $SITE restore $sql --with-public-files $(ls -t "$dir"/*-files.tar* | grep -v private | head -1) --with-private-files $(ls -t "$dir"/*-private-files.tar* | head -1)
  bench build && sudo supervisorctl restart all
  bench --site $SITE set-maintenance-mode off
EOF
}
trap rollback ERR

bench --site "$SITE" set-maintenance-mode on
echo "==> Pull"
git -C apps/schoolos pull --ff-only
if [ "$APPS_TOO" = 1 ]; then
  for a in frappe erpnext hrms education; do git -C "apps/$a" pull --ff-only; done
fi
echo "==> Requirements, migrate, build"
bench setup requirements
bench --site "$SITE" migrate
bench build --production
sudo supervisorctl restart all
sleep 10
echo "==> Check"
bench --site "$SITE" execute schoolos.setup_site.check
bench --site "$SITE" set-maintenance-mode off
trap - ERR
echo "Updated. $(git -C apps/schoolos log --oneline -1)"
