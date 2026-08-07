-- FinCrime Control Lab: dedup workspace_controls by (workspace_id, control_slug)
-- and enforce uniqueness, closing the check-then-insert race in
-- app/api/workspace/controls/route.ts (concurrent "save to workspace" POSTs
-- of the same slug could both pass the "does this exist yet" check and both
-- insert, producing two rows for one library control).
--
-- Safe to re-run: the DELETE only ever removes rows that are true duplicates
-- of an earlier-created row (a second run finds none left), and
-- CREATE UNIQUE INDEX IF NOT EXISTS is a no-op once the index exists.
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- Remove duplicate rows, keeping the earliest (by created_at, then id) per
-- (workspace_id, control_slug). Custom controls (control_slug IS NULL) are
-- never deduped or constrained - a workspace can have many unslugged
-- custom controls.
DELETE FROM workspace_controls wc
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY workspace_id, control_slug
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM workspace_controls
  WHERE control_slug IS NOT NULL
) dupes
WHERE wc.id = dupes.id AND dupes.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_controls_workspace_slug_unique
  ON workspace_controls (workspace_id, control_slug)
  WHERE control_slug IS NOT NULL;
