#!/usr/bin/env bash
#
# One-time copy of the test database off Azure and onto this box.
#
# Source: the test database on pg-mathilens-55e31706, in the iammurali.mng@gmail.com account.
# Target: the local Postgres this server now runs, in the admin@mathilens.com account.
#
# The two accounts share no network, so this runs over the public internet and needs a temporary
# firewall rule on the Azure server. BEFORE running:
#
#   1. Find this box's public IP:  curl -s https://ifconfig.me
#   2. In the iammurali.mng@gmail.com account, add a firewall rule for it:
#
#      az postgres flexible-server firewall-rule create \
#        -g rg-mathilens-prod -n pg-mathilens-55e31706 \
#        --rule-name test-vm-migration \
#        --start-ip-address <ip> --end-ip-address <ip>
#
#   3. Run this script.
#   4. DELETE the rule again — it is the only thing letting a machine outside that subscription
#      reach a server holding six products' production data:
#
#      az postgres flexible-server firewall-rule delete \
#        -g rg-mathilens-prod -n pg-mathilens-55e31706 --rule-name test-vm-migration --yes
#
# Confirm the source database name first. The repo names two candidates and only the deployed app
# knows which is real:
#
#   az webapp config appsettings list -g rg-mathilens-prod -n api-radhafabric-test -o table
set -euo pipefail

SRC_HOST="${SRC_HOST:-pg-mathilens-55e31706.postgres.database.azure.com}"
SRC_DB="${SRC_DB:-mathilens_radhafabric_test}"
SRC_USER="${SRC_USER:-mathilens_ecommerce_app}"

DEST_DB="${DEST_DB:-mathilens_radhafabric_test}"
DEST_ROLE="${DEST_ROLE:-mathilens_test_app}"

DUMP_FILE="${DUMP_FILE:-/tmp/mathilens-test-$(date +%Y%m%d-%H%M%S).dump}"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

read -rsp "Password for ${SRC_USER}@${SRC_HOST}: " SRC_PASSWORD
echo

log "Dumping ${SRC_DB} from Azure"
# --no-owner and --no-acl strip every reference to mathilens_ecommerce_app and azure_pg_admin.
# Without them the restore tries to reassign objects to roles that do not exist here, and — worse
# — would carry Azure's ownership arrangement onto a box that deliberately does not reproduce it.
PGPASSWORD="$SRC_PASSWORD" pg_dump \
  --host="$SRC_HOST" \
  --username="$SRC_USER" \
  --dbname="$SRC_DB" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$DUMP_FILE" \
  --verbose 2>&1 | tail -5

echo "Dump written to ${DUMP_FILE} ($(du -h "$DUMP_FILE" | cut -f1))"

log "Restoring into local ${DEST_DB} as ${DEST_ROLE}"
# Restoring AS the app role is what leaves every table owned by it, so the API can ALTER its own
# schema when it applies migrations on the next boot.
sudo -u postgres pg_restore \
  --dbname="$DEST_DB" \
  --role="$DEST_ROLE" \
  --no-owner \
  --exit-on-error \
  "$DUMP_FILE"

log "Verifying ownership"
# Every row should read mathilens_test_app. Anything else means the API will fail its startup
# migration with 42501, which is precisely the failure this whole arrangement avoids.
sudo -u postgres psql -d "$DEST_DB" -c \
  "SELECT tableowner, COUNT(*) AS tables FROM pg_tables WHERE schemaname='public' GROUP BY tableowner;"

log "Done"
cat <<EOF

Now:
  1. Delete the Azure firewall rule (see the header of this script).
  2. rm ${DUMP_FILE}
  3. systemctl restart mathilens-api  — it will apply any migrations the dump predates.

EOF
