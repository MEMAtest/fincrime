-- FinCrime Control Lab: Control Change Lab migration (Round 2)
-- Adds the single new table needed for the change lifecycle:
-- control_changes. Decisions, conditions, actions, evidence and comments are
-- REUSED polymorphically (subject_type = 'control_change') from migration
-- 001; no parallel tables are created for them here.
--
-- Conventions match 001:
--   - UUID primary keys via gen_random_uuid() (pgcrypto, already enabled)
--   - workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now()
--   - CHECK constraints on enumerated values
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- ============================================================================
-- control_changes: the Control Change Lab journey against a single live
-- workspace_controls row. `baseline` snapshots the control's current
-- whitelisted field values at creation time (the "before" side of the
-- comparison); `proposed` carries the same whitelist of values the change
-- wants to move to. Both are applied back onto workspace_controls via the
-- existing updateWorkspaceControl (never by writing to workspace_controls
-- directly), so every apply/rollback still version-bumps and snapshots to
-- object_versions. See lib/repo/control-changes.ts CONTROL_FIELD_WHITELIST.
-- ============================================================================
CREATE TABLE IF NOT EXISTS control_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_control_id UUID NOT NULL REFERENCES workspace_controls(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT,
  change_type TEXT
    CHECK (change_type IN ('threshold', 'rule_logic', 'scope', 'ownership', 'frequency', 'system', 'decommission', 'other')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'implemented', 'rolled_back')),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 7),
  -- whitelisted subset of workspace_controls fields, snapshotted at creation
  -- time (baseline) and proposed by the change (proposed); see the repo
  -- module for the exact key list and validation.
  baseline JSONB NOT NULL DEFAULT '{}',
  proposed JSONB NOT NULL DEFAULT '{}',
  supporting_data JSONB NOT NULL DEFAULT '{}',
  impact JSONB NOT NULL DEFAULT '{}',
  pilot BOOLEAN NOT NULL DEFAULT false,
  pilot_notes TEXT,
  monitoring JSONB NOT NULL DEFAULT '{}',
  rollback_criteria TEXT,
  implemented_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  applied_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_changes_workspace ON control_changes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_changes_workspace_control ON control_changes(workspace_control_id);
CREATE INDEX IF NOT EXISTS idx_control_changes_status ON control_changes(status);
