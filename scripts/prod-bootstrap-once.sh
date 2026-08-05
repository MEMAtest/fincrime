#!/usr/bin/env bash
# One-shot production DB bootstrap for the workspace foundation (Round 1).
# Run this FROM A MACHINE WITH SSH ACCESS to the Hetzner box (it cannot run
# from the Claude sandbox, which is the reason this script exists):
#
#   bash scripts/prod-bootstrap-once.sh
#
# It does four things, all idempotent:
#   1. Applies db/migrations/001_workflow_foundation.sql to fincrime_lab as fincrime_app
#   2. Seeds the schema_migrations tracking row so npm run db:migrate agrees
#   3. Rotates the fincrime_app password to a fresh random value
#      (safe: no deployed environment currently holds the old one - Vercel
#      has never had DATABASE_URL set for this project)
#   4. Prints the ready-to-use DATABASE_URL for Vercel + the GitHub secret
set -euo pipefail

HOST="root@89.167.95.173"
CONTAINER="postgres-migration"
DB="fincrime_lab"
APP_USER="fincrime_app"
MIGRATION_FILE="$(cd "$(dirname "$0")/.." && pwd)/db/migrations/001_workflow_foundation.sql"

echo "==> 1/4 Applying migration as ${APP_USER}"
ssh "$HOST" "docker exec -i $CONTAINER psql -U $APP_USER -d $DB -v ON_ERROR_STOP=1" < "$MIGRATION_FILE"

echo "==> 2/4 Seeding schema_migrations"
ssh "$HOST" "docker exec $CONTAINER psql -U $APP_USER -d $DB -v ON_ERROR_STOP=1 -c \"CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()); INSERT INTO schema_migrations (filename) VALUES ('001_workflow_foundation.sql') ON CONFLICT DO NOTHING;\""

echo "==> 3/4 Rotating ${APP_USER} password"
NEWPW="$(openssl rand -hex 16)"
ssh "$HOST" "docker exec $CONTAINER psql -U postgres -d $DB -v ON_ERROR_STOP=1 -c \"ALTER USER $APP_USER WITH PASSWORD '$NEWPW'\""

echo "==> 4/4 Done. Table count check:"
ssh "$HOST" "docker exec $CONTAINER psql -U $APP_USER -d $DB -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\""

echo
echo "DATABASE_URL=postgresql://${APP_USER}:${NEWPW}@89.167.95.173:5432/${DB}?sslmode=no-verify"
echo
echo "Next: hand the DATABASE_URL line above back to the session (or run:"
echo "  printf '%s' 'postgresql://...' | vercel env add DATABASE_URL production"
echo "  gh secret set DATABASE_URL -R MEMAtest/fincrime -b 'postgresql://...')"
