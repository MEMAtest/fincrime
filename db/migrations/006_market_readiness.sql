-- FinCrime Control Lab: Entity and Market Readiness migration (Round 3, Phase 4)
-- Turns the KYC/CDD Matrix (data/kyc/*, 152 cited profiles) into a go/no-go
-- module: an obligation register generated from a real CddProfile for a
-- chosen entity type, jurisdiction and product, mapped to the controls that
-- satisfy it, with gaps classified and launch blockers tracked, closed out by
-- a local and a global approval.
--
-- Decisions, conditions, actions, evidence and comments are REUSED
-- polymorphically (subject_type = 'readiness_assessment', and for evidence
-- attached to a single obligation, 'readiness_obligation') from migration
-- 001; no parallel tables are created for them here.
--
-- entity_type and jurisdiction are NOT constrained by a DB CHECK: that enum
-- lives in TypeScript (data/kyc/types.ts EntityType / Jurisdiction) and is
-- validated in code (lib/readiness/validation.ts) against the real,
-- currently-authored list, which can grow over time. A DB CHECK here would
-- have to be kept in lockstep with that file by hand and would silently drift.
--
-- Conventions match 001/004/005:
--   - UUID primary keys via gen_random_uuid() (pgcrypto, already enabled)
--   - workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now()
--   - CHECK constraints on enumerated values that ARE fixed in code here (not KYC-sourced)
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- ============================================================================
-- readiness_assessments: one go/no-go journey for an (entity type x
-- jurisdiction x product) combination. current_step tracks progress through
-- the assumed 6-step journey (profile -> generate register -> map controls ->
-- classify gaps -> residual/blockers -> approval), mirroring pra_assessments'
-- current_step pattern in 001 and incidents' in 005.
-- ============================================================================
CREATE TABLE IF NOT EXISTS readiness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- validated in code against data/kyc/types.ts EntityType, not a DB CHECK (see header comment)
  entity_type TEXT NOT NULL,
  -- validated in code against data/kyc/types.ts Jurisdiction, not a DB CHECK (see header comment)
  jurisdiction TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved_local', 'approved_global', 'rejected', 'cancelled')),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  target_launch_date DATE,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_assessments_workspace ON readiness_assessments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_readiness_assessments_status ON readiness_assessments(status);
CREATE INDEX IF NOT EXISTS idx_readiness_assessments_product ON readiness_assessments(product_id);
CREATE INDEX IF NOT EXISTS idx_readiness_assessments_owner ON readiness_assessments(owner_person_id);

-- ============================================================================
-- readiness_obligations: the generated register. One row per CddRequirement
-- returned by data/kyc/requirements.ts buildRequirements(profile) for the
-- assessment's (entity_type, jurisdiction). requirement_key is the stable
-- `${category}::${title}` key that data/kyc/merge.ts already uses to
-- de-duplicate across scenarios, reused here as the natural key so
-- generateObligations can be re-run (e.g. after the KYC library adds a new
-- requirement) with ON CONFLICT DO NOTHING - a user's control mapping,
-- gap classification, evidence and notes on an existing obligation are never
-- overwritten by a re-generation. legal_basis/applies_at_risk are copied onto
-- the row (not just referenced) so the register stays self-contained and
-- auditable even if the source library's content changes later.
-- ============================================================================
CREATE TABLE IF NOT EXISTS readiness_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES readiness_assessments(id) ON DELETE CASCADE,
  requirement_key TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  rule_summary TEXT,
  legal_basis JSONB NOT NULL DEFAULT '[]',
  applies_at_risk JSONB NOT NULL DEFAULT '[]',
  workspace_control_id UUID REFERENCES workspace_controls(id) ON DELETE SET NULL,
  control_note TEXT,
  gap TEXT NOT NULL DEFAULT 'not_assessed' CHECK (gap IN ('not_assessed', 'none', 'partial', 'full')),
  blocker BOOLEAN NOT NULL DEFAULT false,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, requirement_key)
);

CREATE INDEX IF NOT EXISTS idx_readiness_obligations_workspace ON readiness_obligations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_readiness_obligations_assessment ON readiness_obligations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_readiness_obligations_gap ON readiness_obligations(gap);
CREATE INDEX IF NOT EXISTS idx_readiness_obligations_blocker ON readiness_obligations(blocker);
