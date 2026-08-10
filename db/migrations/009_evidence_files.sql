-- FinCrime Control Lab: Phase 7 - file-backed evidence.
--
-- Adds file storage columns to the existing `evidence` table (no parallel
-- table). A row with all five columns NULL is exactly today's link-only
-- evidence; a row with file_url set has a file attached ALONGSIDE (not
-- instead of) any link_url/description it already carries.
--
-- Idempotent: every column uses ADD COLUMN IF NOT EXISTS, so this file can be
-- (and, per the migration runner's own schema_migrations tracking, normally
-- would not need to be, but safely CAN be) applied more than once.
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_content_type TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
