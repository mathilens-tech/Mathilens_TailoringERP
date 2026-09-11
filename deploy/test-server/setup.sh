#!/usr/bin/env bash
#
# One-time provisioning of the test server (Ubuntu 24.04 LTS).
#
# Stands up everything the test environment needs on a single box: Postgres, the .NET SDK, nginx
# and the systemd unit that runs the API. Replaces three Azure resources — api-radhafabric-test,
# swa-radhafabric-test, and the test database on pg-mathilens-55e31706 — none of which the test
# environment needs to be separate.
#
# Run once, as root:
#
#   sudo ./setup.sh
#
# Idempotent: safe to re-run. Anything already present is left alone rather than recreated, so a
# second run after a failed first one picks up where it stopped.
set -euo pipefail

# ---------------------------------------------------------------------------------------------
# Settings. PG_MAJOR must match the production server's major version — check it with:
#   az postgres flexible-server show -n pg-mathilens-55e31706 -g rg-mathilens-prod --query version
# A test box on a different major version is a test box that can disagree with production about
# collation, planner behaviour and the exact wording of constraint violations.
# ---------------------------------------------------------------------------------------------
PG_MAJOR="${PG_MAJOR:-16}"
SITE_HOST="${SITE_HOST:-www.test-radhafabric.mathilens.com}"
DB_NAME="${DB_NAME:-mathilens_radhafabric_test}"
DB_ROLE="${DB_ROLE:-mathilens_test_app}"
SERVICE_USER="${SERVICE_USER:-mathilens}"
WEB_ROOT="/var/www/mathilens-test"
API_ROOT="/opt/mathilens-api"
ENV_FILE="/etc/mathilens/test.env"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

# ---------------------------------------------------------------------------------------------
log "Base packages"
# ---------------------------------------------------------------------------------------------
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release ufw rsync

# ---------------------------------------------------------------------------------------------
log "PostgreSQL ${PG_MAJOR} (PGDG repo — Ubuntu ships only one major, and it may not be prod's)"
# ---------------------------------------------------------------------------------------------
if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
fi
# The client package matters as much as the server: pg_dump must be at least the version of the
# server it reads, and the Azure source server is what the one-time copy pulls from.
apt-get install -y -qq "postgresql-${PG_MAJOR}" "postgresql-client-${PG_MAJOR}"

# Loopback only. Nothing outside this box has any reason to reach the database, and not listening
# is a stronger guarantee than a firewall rule that someone can widen later.
PG_CONF="/etc/postgresql/${PG_MAJOR}/main/postgresql.conf"
sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$PG_CONF"
systemctl enable --now "postgresql@${PG_MAJOR}-main" >/dev/null 2>&1 || systemctl enable --now postgresql
systemctl restart postgresql

# ---------------------------------------------------------------------------------------------
log "Database role and database"
# ---------------------------------------------------------------------------------------------
# Created OWNED BY the application role, which is the whole point.
#
# On Azure the database is created by mathilensadmin and the app role cannot ALTER what it does
# not own, so the API's startup migration dies with `42501 permission denied for table
# __EFMigrationsHistory` and App Service serves 503. That is what the two ownership scripts under
# scripts/database exist to repair. Getting ownership right at creation means the failure has no
# way to occur here, and neither script has a test-side equivalent to maintain.
DB_PASSWORD="$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_ROLE}'" | grep -q 1; then
  sudo -u postgres psql -qc "CREATE ROLE ${DB_ROLE} LOGIN PASSWORD '${DB_PASSWORD}';"
  echo "Created role ${DB_ROLE}"
else
  echo "Role ${DB_ROLE} already exists — leaving its password alone"
  DB_PASSWORD=""
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -qc "CREATE DATABASE ${DB_NAME} OWNER ${DB_ROLE};"
  sudo -u postgres psql -d "${DB_NAME}" -qc "ALTER SCHEMA public OWNER TO ${DB_ROLE};"
  echo "Created database ${DB_NAME} owned by ${DB_ROLE}"
fi

# ---------------------------------------------------------------------------------------------
log ".NET SDK 10 (the SDK, not just the runtime — the self-hosted runner builds on this box)"
# ---------------------------------------------------------------------------------------------
if ! command -v dotnet >/dev/null; then
  curl -fsSL "https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb" -o /tmp/pmp.deb
  dpkg -i /tmp/pmp.deb >/dev/null
  rm -f /tmp/pmp.deb
  apt-get update -qq
fi
apt-get install -y -qq dotnet-sdk-10.0

# ---------------------------------------------------------------------------------------------
log "Node.js 22 (builds the Next.js static export)"
# ---------------------------------------------------------------------------------------------
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
fi
apt-get install -y -qq nodejs

# ---------------------------------------------------------------------------------------------
log "nginx and certbot"
# ---------------------------------------------------------------------------------------------
apt-get install -y -qq nginx certbot python3-certbot-nginx

# ---------------------------------------------------------------------------------------------
log "Service account and directories"
# ---------------------------------------------------------------------------------------------
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# The group the GitHub runner joins. It is what lets a deploy write these two directories without
# sudo, so the only privileged steps are restarting the service and reloading nginx.
groupadd -f mathilens-deploy

# setgid (2775) so every file rsync creates inherits the group rather than the runner's own —
# without it, the second deploy cannot overwrite what the first one wrote. The trailing "others"
# read bit is what lets the service account read the API and www-data read the site.
install -d -o "$SERVICE_USER" -g mathilens-deploy -m 2775 "$API_ROOT"
install -d -o www-data       -g mathilens-deploy -m 2775 "$WEB_ROOT"
install -d -m 750 /etc/mathilens

# ---------------------------------------------------------------------------------------------
log "Environment file"
# ---------------------------------------------------------------------------------------------
# Secrets live here, readable only by the service account — never in the repo, and never in the
# systemd unit, which is world-readable.
if [[ ! -f "$ENV_FILE" ]]; then
  JWT_KEY="$(openssl rand -base64 64 | tr -d '\n')"
  cat > "$ENV_FILE" <<EOF
# Test environment. Its own signing key and its own database credential — nothing here is shared
# with production, which is the reason this box exists.
ConnectionStrings__Default=Host=localhost;Port=5432;Database=${DB_NAME};Username=${DB_ROLE};Password=${DB_PASSWORD}
Jwt__SigningKey=${JWT_KEY}
Jwt__Issuer=MathilensERP.Api.Test
Jwt__Audience=MathilensERP.Client.Test
Jwt__AccessTokenExpiryMinutes=15
Jwt__RefreshTokenExpiryDays=30
Cors__FrontendOrigin=https://${SITE_HOST}
WhatsApp__AccessToken=
WhatsApp__PhoneNumberId=
EOF
  chmod 600 "$ENV_FILE"
  chown root:"$SERVICE_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
  echo "Wrote $ENV_FILE"
else
  echo "$ENV_FILE already exists — left untouched"
fi

# ---------------------------------------------------------------------------------------------
log "systemd unit"
# ---------------------------------------------------------------------------------------------
install -m 644 "$(dirname "$0")/mathilens-api.service" /etc/systemd/system/mathilens-api.service
systemctl daemon-reload
systemctl enable mathilens-api >/dev/null

# ---------------------------------------------------------------------------------------------
log "nginx site"
# ---------------------------------------------------------------------------------------------
sed "s/__SITE_HOST__/${SITE_HOST}/g" "$(dirname "$0")/nginx-site.conf" \
  > /etc/nginx/sites-available/mathilens-test
ln -sf /etc/nginx/sites-available/mathilens-test /etc/nginx/sites-enabled/mathilens-test
rm -f /etc/nginx/sites-enabled/default

# The generated route rules are written by the deploy workflow. An empty file lets nginx start
# before the first deploy rather than failing on a missing include.
touch /etc/nginx/mathilens-routes.conf
nginx -t
systemctl reload nginx

# ---------------------------------------------------------------------------------------------
log "Deploy permissions for the GitHub runner"
# ---------------------------------------------------------------------------------------------
# The runner owns the two directories it writes, so a deploy needs no sudo for file copying. The
# only privileged actions are restarting the service and reloading nginx, which are enumerated
# rather than granted wholesale.
cat > /etc/sudoers.d/mathilens-deploy <<'EOF'
%mathilens-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart mathilens-api, \
  /usr/bin/systemctl stop mathilens-api, \
  /usr/bin/systemctl start mathilens-api, \
  /usr/bin/systemctl status mathilens-api, \
  /usr/sbin/nginx -t, \
  /usr/bin/systemctl reload nginx, \
  /usr/bin/install -m 644 /tmp/mathilens-routes.conf /etc/nginx/mathilens-routes.conf
EOF
chmod 440 /etc/sudoers.d/mathilens-deploy
# Syntax-check before anyone relies on it — a malformed drop-in breaks sudo for everyone.
visudo -cf /etc/sudoers.d/mathilens-deploy

# ---------------------------------------------------------------------------------------------
log "Firewall"
# ---------------------------------------------------------------------------------------------
# 5432 is deliberately absent: Postgres listens on loopback only, and the runner polls outbound.
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# ---------------------------------------------------------------------------------------------
log "Done"
# ---------------------------------------------------------------------------------------------
cat <<EOF

Next steps, in order:

  1. Point ${SITE_HOST} at this server's public IP, and wait for it to resolve.
  2. sudo certbot --nginx -d ${SITE_HOST}
  3. Copy the test database:  ./copy-test-database.sh
  4. Install the GitHub self-hosted runner, add it to the 'mathilens-deploy' group,
     and label it: self-hosted, linux, mathilens-test
  5. Push to dev, or run the "Deploy test" workflow by hand.

EOF

if [[ -n "$DB_PASSWORD" ]]; then
  echo "Database password was generated and written to ${ENV_FILE}."
else
  echo "NOTE: the role already existed, so ${ENV_FILE} may hold a stale password. Check it."
fi
