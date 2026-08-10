-- FinCrime Control Lab: Control Testing migration (Round 3, Phase 1)
-- Adds the two new tables needed for the test lifecycle: control_tests and
-- control_test_findings. Evidence, actions, decisions and comments are
-- REUSED polymorphically (subject_type = 'control_test') from migration 001;
-- no parallel tables are created for them here.
--
-- Conventions match 001/002/003:
--   - UUID primary keys via gen_random_uuid() (pgcrypto, already enabled)
--   - workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now()
--   - CHECK constraints on enumerated values
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- ============================================================================
-- control_tests: a test cycle run against a single live workspace_controls
-- row. Sample counts (sample_size / samples_passed / samples_failed /
-- samples_partial) and findings are recorded while status is 'planned' or
-- 'in_progress'; completeControlTest (lib/repo/control-tests.ts) recomputes
-- result + a rating from those counts using data/scoring/test-effectiveness.ts
-- (never trusting a client-supplied rating) and writes it back onto the
-- underlying workspace_control's effectiveness_rating via
-- updateWorkspaceControlWithClient, so that write still version-bumps and
-- snapshots to object_versions exactly like the Control Change Lab apply
-- path. applied_rating / applied_version / tested_at / next_test_due mirror
-- what was written onto the control at completion time, so the test row
-- stays a readable historical record even if the control changes again
-- later.
-- ============================================================================
CREATE TABLE IF NOT EXISTS control_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_control_id UUID NOT NULL REFERENCES workspace_controls(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  method TEXT
    CHECK (method IN ('sample', 'walkthrough', 'reperformance', 'data_analysis', 'other')),
  period_start DATE,
  period_end DATE,
  tester_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  sample_size INTEGER CHECK (sample_size IS NULL OR sample_size >= 0),
  samples_passed INTEGER CHECK (samples_passed IS NULL OR samples_passed >= 0),
  samples_failed INTEGER CHECK (samples_failed IS NULL OR samples_failed >= 0),
  samples_partial INTEGER CHECK (samples_partial IS NULL OR samples_partial >= 0),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'complete', 'cancelled')),
  result TEXT CHECK (result IN ('pass', 'pass_with_findings', 'fail')),
  conclusion TEXT,
  applied_rating TEXT CHECK (applied_rating IN ('strong', 'adequate', 'weak', 'not_assessed')),
  applied_version INTEGER,
  tested_at TIMESTAMPTZ,
  next_test_due DATE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_tests_workspace ON control_tests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_tests_workspace_control ON control_tests(workspace_control_id);
CREATE INDEX IF NOT EXISTS idx_control_tests_status ON control_tests(status);

-- ============================================================================
-- control_test_findings: individual issues raised during a test. `action_id`
-- optionally links to an `actions` row (subject_type 'control_test',
-- subject_id = test id) created alongside the finding to track remediation.
-- ============================================================================
CREATE TABLE IF NOT EXISTS control_test_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES control_tests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  sample_ref TEXT,
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_test_findings_workspace ON control_test_findings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_test_findings_test ON control_test_findings(test_id);
