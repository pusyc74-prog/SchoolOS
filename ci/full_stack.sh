#!/usr/bin/env bash
# Full-stack test: real MariaDB + Redis + Frappe/ERPNext/HR/Education v16 + SchoolOS.
# Runs in GitHub Actions (see .github/workflows/ci.yml); also works on any Ubuntu 24.04 box
# with MariaDB on 127.0.0.1 (root password in DB_ROOT_PASSWORD).
#
# Every step's output goes to $LOGS/<nn>-<step>.log and a pass/fail line to $LOGS/RESULT.md.
# Install steps stop the run on failure; test steps carry on so one run shows every problem.
set -uo pipefail

BRANCH="${BRANCH:-version-16}"
SITE="${SITE:-test_site}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-root}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BENCH="${BENCH:-$HOME/frappe-bench}"
LOGS="${LOGS:-$HOME/ci-logs}"
mkdir -p "$LOGS"
: > "$LOGS/RESULT.md"
n=0
failed=0

step() {  # step <must|test> <name> <command...>
  local kind="$1" name="$2"; shift 2
  n=$((n + 1))
  local log
  log="$LOGS/$(printf '%02d' "$n")-${name// /_}.log"
  local t0=$SECONDS
  echo "::group::$name"
  if "$@" > >(tee "$log") 2>&1; then
    echo "| PASS | $name | $((SECONDS - t0))s |" >> "$LOGS/RESULT.md"
    echo "::endgroup::"
  else
    echo "| FAIL | $name | $((SECONDS - t0))s |" >> "$LOGS/RESULT.md"
    echo "::endgroup::"
    echo "::error title=$name failed::see $(basename "$log")"
    failed=$((failed + 1))
    if [ "$kind" = must ]; then
      echo "Stopping: $name is required for the rest." | tee -a "$LOGS/RESULT.md"
      exit 1
    fi
  fi
}

b() { (cd "$BENCH" && bench "$@"); }

# ---------------------------------------------------------------- install
step must "bench init" bash -c "
  pip install -q frappe-bench &&
  cd \$(dirname '$BENCH') &&
  bench init --skip-assets --frappe-branch '$BRANCH' --python \"\$(which python)\" \$(basename '$BENCH') &&
  cd '$BENCH' &&
  sed -i 's/^watch:/# watch:/' Procfile &&
  bench set-config -g db_host 127.0.0.1 &&
  bench set-config -g root_password '$DB_ROOT_PASSWORD'"
step must "get apps" bash -c "
  cd '$BENCH' &&
  bench get-app --branch '$BRANCH' erpnext &&
  bench get-app --branch '$BRANCH' hrms &&
  bench get-app --branch '$BRANCH' education &&
  bench get-app '$APP_DIR' &&
  bench setup requirements --dev --python"
step must "new site" bash -c "
  cd '$BENCH' &&
  bench new-site '$SITE' --db-root-password '$DB_ROOT_PASSWORD' --admin-password admin --mariadb-user-host-login-scope='%' &&
  bench --site '$SITE' set-config allow_tests true &&
  bench --site '$SITE' set-config host_name 'http://$SITE:8000' &&
  bench use '$SITE'"
step must "start redis + web" bash -c "
  cd '$BENCH' && (nohup bench start > '$LOGS/bench-start.log' 2>&1 &) &&
  for i in \$(seq 1 120); do (exec 3<>/dev/tcp/127.0.0.1/13000) 2>/dev/null && (exec 3<>/dev/tcp/127.0.0.1/11000) 2>/dev/null && exit 0; sleep 1; done; exit 1"
step must "install erpnext" b --site "$SITE" install-app erpnext
step must "install hrms" b --site "$SITE" install-app hrms
step must "install education" b --site "$SITE" install-app education
step must "install schoolos" b --site "$SITE" install-app schoolos
step must "setup wizard (headless)" b --site "$SITE" execute schoolos.setup_site.complete \
  --kwargs "{'school': 'Demo Public School', 'abbr': 'DPS', 'email': 'admin@example.com', 'password': 'admin'}"
step must "demo school" b --site "$SITE" execute schoolos.demo.make_demo --kwargs "{'strict': 1}"
step test "migrate (twice, must be repeatable)" bash -c "cd '$BENCH' && bench --site '$SITE' migrate && bench --site '$SITE' migrate"
step test "build assets" b build

# ---------------------------------------------------------------- tests
step test "integration tests" b --site "$SITE" run-tests --app schoolos
step test "wait for web server" bash -c "
  for i in \$(seq 1 90); do curl -sf -o /dev/null http://127.0.0.1:8000/api/method/ping -H 'Host: $SITE' && exit 0; sleep 2; done; exit 1"
step test "HTTP smoke test (every role)" "$BENCH/env/bin/python" "$APP_DIR/ci/smoke.py" "http://127.0.0.1:8000" "$SITE"
step test "go-live health check (informational)" bash -c "cd '$BENCH' && bench --site '$SITE' execute schoolos.setup_site.check || true"

# ---------------------------------------------------------------- backup / restore drill
step test "backup + restore drill" bash -c "
  set -e
  cd '$BENCH'
  bench --site '$SITE' backup --with-files
  dir=sites/$SITE/private/backups
  sql=\$(ls -t \$dir/*-database.sql.gz | head -1)
  pub=\$(ls -t \$dir/*-files.tar | grep -v private | head -1)
  priv=\$(ls -t \$dir/*-private-files.tar | head -1)
  before=\$(bench --site '$SITE' execute frappe.db.count --args \"['Student']\")
  bench new-site restore_check --db-root-password '$DB_ROOT_PASSWORD' --admin-password admin --mariadb-user-host-login-scope='%'
  bench --site restore_check restore \"\$sql\" --with-public-files \"\$pub\" --with-private-files \"\$priv\" --db-root-password '$DB_ROOT_PASSWORD'
  bench --site restore_check migrate
  after=\$(bench --site restore_check execute frappe.db.count --args \"['Student']\")
  echo \"students before: \$before  after restore: \$after\"
  test \"\$before\" = \"\$after\"
  bench drop-site restore_check --db-root-password '$DB_ROOT_PASSWORD' --force"

echo
cat "$LOGS/RESULT.md"
[ "$failed" -eq 0 ]
