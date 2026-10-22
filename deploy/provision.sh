#!/usr/bin/env bash
# One-shot production install of SchoolOS on a fresh Ubuntu 24.04 server (the school's own VPS).
#
#   sudo DOMAIN=app.sunriseschool.in SCHOOL="Sunrise Public School" ABBR=SPS \
#        ADMIN_EMAIL=office@sunriseschool.in bash provision.sh
#
# Before running: point DOMAIN's DNS (an A record) at this server's IP, so HTTPS can be issued.
# Takes 30-45 minutes. Safe to re-run: finished steps are skipped.
# At the end it prints the Administrator password. Store it in the school's password manager.
set -euo pipefail

: "${DOMAIN:?set DOMAIN, e.g. app.sunriseschool.in}"
: "${SCHOOL:?set SCHOOL, the school name}"
: "${ABBR:?set ABBR, a 2-5 letter short form, e.g. SPS}"
: "${ADMIN_EMAIL:?set ADMIN_EMAIL, the school office email}"
BRANCH="${BRANCH:-version-16}"
SCHOOLOS_REPO="${SCHOOLOS_REPO:-https://github.com/pusyc74-prog/SchoolOS}"
SCHOOLOS_REF="${SCHOOLOS_REF:-main}"
FRAPPE_USER="${FRAPPE_USER:-frappe}"
SWAP_GB="${SWAP_GB:-4}"
SECRETS=/root/schoolos-secrets.txt

[ "$(id -u)" = 0 ] || { echo "Run with sudo"; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] || echo "WARNING: tested on Ubuntu 24.04 only (this is $PRETTY_NAME)"

log() { echo -e "\n\033[1;34m==> $*\033[0m"; }
secret() {  # secret NAME -> stable random value stored in $SECRETS
  touch "$SECRETS"; chmod 600 "$SECRETS"
  local v; v=$(grep "^$1=" "$SECRETS" | cut -d= -f2- || true)
  if [ -z "$v" ]; then v=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20); echo "$1=$v" >> "$SECRETS"; fi
  echo "$v"
}
DB_ROOT_PW=$(secret DB_ROOT_PASSWORD)
ADMIN_PW=$(secret ADMIN_PASSWORD)

# ---------------------------------------------------------------- system
log "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl wget ca-certificates build-essential pkg-config cron \
  mariadb-server mariadb-client libmariadb-dev redis-server nginx supervisor \
  xvfb libfontconfig fontconfig xfonts-75dpi xfonts-base fonts-noto-core fonts-noto-ui-core fonts-lohit-deva \
  ufw fail2ban unattended-upgrades certbot python3-certbot-nginx rclone

if [ ! -f /swapfile ]; then
  log "Swap ${SWAP_GB} GB (keeps small servers from running out of memory)"
  fallocate -l "${SWAP_GB}G" /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  sysctl -w vm.swappiness=10 && echo "vm.swappiness=10" > /etc/sysctl.d/90-swap.conf
fi

if ! command -v wkhtmltopdf >/dev/null; then
  log "wkhtmltopdf (report card and receipt PDFs)"
  wget -q -O /tmp/wkhtmltox.deb https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.jammy_amd64.deb
  apt-get install -y -q /tmp/wkhtmltox.deb
fi

if ! node --version 2>/dev/null | grep -q '^v24'; then
  log "Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
  npm install -g yarn
fi

log "Firewall: only SSH, HTTP, HTTPS"
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
systemctl enable --now fail2ban unattended-upgrades

log "MariaDB settings"
cat > /etc/mysql/mariadb.conf.d/90-frappe.cnf <<'EOF'
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
innodb_buffer_pool_size = 1G
max_allowed_packet = 256M
[mysql]
default-character-set = utf8mb4
EOF
systemctl restart mariadb
if mariadb -uroot -e "select 1" >/dev/null 2>&1; then
  mariadb -uroot -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_ROOT_PW}'; FLUSH PRIVILEGES;"
fi

# ---------------------------------------------------------------- frappe user, python, bench
id "$FRAPPE_USER" >/dev/null 2>&1 || { log "User $FRAPPE_USER"; adduser --disabled-password --gecos "" "$FRAPPE_USER"; }
chmod 755 "/home/$FRAPPE_USER"
as_frappe() {
  sudo -u "$FRAPPE_USER" -H env SCHOOL="$SCHOOL" ABBR="$ABBR" ADMIN_EMAIL="$ADMIN_EMAIL" DOMAIN="$DOMAIN" \
    bash -lc "export PATH=\$HOME/.local/bin:\$PATH; $*"
}

log "Python 3.14 + bench (via uv)"
as_frappe "command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh"
as_frappe "uv python install 3.14 && (command -v bench >/dev/null || uv tool install frappe-bench)"
PY=$(as_frappe "uv python find 3.14")

BENCH="/home/$FRAPPE_USER/frappe-bench"
if [ ! -d "$BENCH" ]; then
  log "Frappe $BRANCH"
  as_frappe "cd ~ && bench init --frappe-branch $BRANCH --python $PY frappe-bench"
fi
for app in erpnext hrms education; do
  [ -d "$BENCH/apps/$app" ] || { log "Get $app"; as_frappe "cd $BENCH && bench get-app --branch $BRANCH $app"; }
done
[ -d "$BENCH/apps/schoolos" ] || { log "Get SchoolOS"; as_frappe "cd $BENCH && bench get-app --branch $SCHOOLOS_REF $SCHOOLOS_REPO"; }

# ---------------------------------------------------------------- site
if [ ! -d "$BENCH/sites/$DOMAIN" ]; then
  log "Site $DOMAIN"
  as_frappe "cd $BENCH && bench new-site $DOMAIN --db-root-password '$DB_ROOT_PW' --admin-password '$ADMIN_PW'"
  for app in erpnext hrms education schoolos; do
    as_frappe "cd $BENCH && bench --site $DOMAIN install-app $app"
  done
fi
as_frappe "cd $BENCH && bench use $DOMAIN"
log "Company, financial year (Apr-Mar), INR"
as_frappe "cd $BENCH && bench --site $DOMAIN execute schoolos.setup_site.complete_from_env"
as_frappe "cd $BENCH && bench --site $DOMAIN set-config host_name https://$DOMAIN"

# ---------------------------------------------------------------- production
log "Production mode (nginx + supervisor), scheduler on"
as_frappe "cd $BENCH && bench build --production"
(cd "$BENCH" && "/home/$FRAPPE_USER/.local/bin/bench" setup production "$FRAPPE_USER" --yes)
as_frappe "cd $BENCH && bench --site $DOMAIN enable-scheduler && bench --site $DOMAIN set-maintenance-mode off"

log "HTTPS certificate (Let's Encrypt, free, auto-renews)"
if certbot --nginx -d "$DOMAIN" -m "$ADMIN_EMAIL" --agree-tos -n --redirect; then
  echo "HTTPS ready."
else
  echo "Could not get a certificate. Check that $DOMAIN points to this server, then run:"
  echo "  sudo certbot --nginx -d $DOMAIN -m $ADMIN_EMAIL --agree-tos --redirect"
fi

log "Nightly backups (02:30), 14 days kept on the server"
install -m 755 "$(dirname "$0")/backup.sh" /usr/local/bin/schoolos-backup 2>/dev/null || \
  install -m 755 "$BENCH/apps/schoolos/deploy/backup.sh" /usr/local/bin/schoolos-backup
echo "30 2 * * * $FRAPPE_USER BENCH=$BENCH SITE=$DOMAIN /usr/local/bin/schoolos-backup >> /home/$FRAPPE_USER/backup.log 2>&1" \
  > /etc/cron.d/schoolos-backup

log "Health check"
as_frappe "cd $BENCH && bench --site $DOMAIN execute schoolos.setup_site.check" || true

grep -q "^ENCRYPTION_KEY=" "$SECRETS" || python3 -c "import json,sys; print('ENCRYPTION_KEY=' + json.load(open(sys.argv[1]))['encryption_key'])" "$BENCH/sites/$DOMAIN/site_config.json" >> "$SECRETS"
cat <<EOF

=====================================================================
 SchoolOS is installed:  https://$DOMAIN        app: https://$DOMAIN/school
 Administrator password and DB root password: $SECRETS
 Copy that file into the school's password manager, then delete it from the server.
 (The encryption key in it is needed to restore backups on a new server.)

 Next: docs/GO_LIVE.md, from "Day -10: configure the school".
=====================================================================
EOF
