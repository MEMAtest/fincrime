#!/usr/bin/env bash
# One-shot production DB bootstrap for the workspace foundation (Round 1).
# ALREADY EXECUTED 2026-08-06 (role + DB created, schema + migration 001
# applied, DATABASE_URL installed in Vercel production and as the GitHub
# Actions secret). Kept for reference and disaster recovery.
#
#   bash scripts/prod-bootstrap-once.sh              # migrate + seed only (idempotent)
#   ROTATE_PW=1 bash scripts/prod-bootstrap-once.sh  # also rotate the fincrime_app password
#
# Steps 1, 2 and 4 are idempotent and safe to re-run. Step 3 (password
# rotation) is NOT idempotent - it invalidates the DATABASE_URL already
# installed in Vercel and GitHub - so it only runs with ROTATE_PW=1, and the
# ALTER USER travels over stdin so the password never appears in the remote
# host's process table or (if log_statement were enabled) the Postgres log.
set -euo pipefail

HOST="root@89.167.95.173"
CONTAINER="postgres-migration"
DB="fincrime_lab"
APP_USER="fincrime_app"
MIGRATION_FILE="$(cd "$(dirname "$0")/.." && pwd)/db/migrations/001_workflow_foundation.sql"

echo "==> 1/4 Applying migration as ${APP_USER} (idempotent)"
ssh "$HOST" "docker exec -i '$CONTAINER' psql -U '$APP_USER' -d '$DB' -v ON_ERROR_STOP=1" < "$MIGRATION_FILE"

echo "==> 2/4 Seeding schema_migrations (idempotent)"
ssh "$HOST" "docker exec -i '$CONTAINER' psql -U '$APP_USER' -d '$DB' -v ON_ERROR_STOP=1" << 'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
INSERT INTO schema_migrations (filename) VALUES ('001_workflow_foundation.sql') ON CONFLICT DO NOTHING;
SQL

if [ "${ROTATE_PW:-0}" = "1" ]; then
  echo "==> 3/4 Rotating ${APP_USER} password (ROTATE_PW=1)"
  NEWPW="$(openssl rand -hex 16)"
  ssh "$HOST" "docker exec -i '$CONTAINER' psql -U postgres -d '$DB' -v ON_ERROR_STOP=1" << SQL
SET log_statement = 'none';
ALTER USER ${APP_USER} WITH PASSWORD '${NEWPW}';
SQL
else
  echo "==> 3/4 Skipping password rotation (set ROTATE_PW=1 to rotate; doing so invalidates the DATABASE_URL in Vercel + GitHub until both are updated)"
  NEWPW=""
fi

echo "==> 4/4 Verifying table count"
TABLES="$(ssh "$HOST" "docker exec '$CONTAINER' psql -U '$APP_USER' -d '$DB' -t -A -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" | tr -d '[:space:]')"
echo "    tables: $TABLES"
if [ "$TABLES" -lt 19 ]; then
  echo "ERROR: expected at least 19 tables, found $TABLES" >&2
  exit 1
fi

if [ -n "$NEWPW" ]; then
  echo
  echo "DATABASE_URL=postgresql://${APP_USER}:${NEWPW}@89.167.95.173:5432/${DB}?sslmode=no-verify"
  echo
  echo "Update BOTH consumers or prod breaks:"
  echo "  printf '%s' '<url>' | vercel env add DATABASE_URL production   (rm the old one first)"
  echo "  gh secret set DATABASE_URL -R MEMAtest/fincrime -b '<url>'"
fi
