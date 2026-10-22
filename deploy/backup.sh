#!/usr/bin/env bash
# Nightly backup of the school's site: database + uploaded files.
# Installed by provision.sh as /usr/local/bin/schoolos-backup and run by cron at 02:30.
#
# Keeps 14 days on the server. If an rclone remote called "offsite" exists (for example the
# school's own Google Drive, set up once with `rclone config`), each backup is also copied there
# and kept for 60 days. A server can die; a copy somewhere else is what saves the school's data.
set -euo pipefail
BENCH="${BENCH:-$HOME/frappe-bench}"
SITE="${SITE:?set SITE}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OFFSITE_KEEP="${OFFSITE_KEEP:-60d}"
export PATH="$HOME/.local/bin:$PATH"

cd "$BENCH"
echo "$(date -Is) backup start"
bench --site "$SITE" backup --with-files --compress
dir="sites/$SITE/private/backups"
find "$dir" -type f -mtime +"$KEEP_DAYS" -delete

if rclone listremotes 2>/dev/null | grep -qx "offsite:"; then
  rclone copy "$dir" "offsite:schoolos-backups/$SITE" --max-age 26h
  rclone delete "offsite:schoolos-backups/$SITE" --min-age "$OFFSITE_KEEP"
  echo "$(date -Is) copied to offsite"
else
  echo "$(date -Is) WARNING: no offsite copy (run 'rclone config' and create a remote named offsite)"
fi
ls -lh "$dir" | tail -4
echo "$(date -Is) backup done"
