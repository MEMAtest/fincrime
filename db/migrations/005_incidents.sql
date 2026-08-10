-- FinCrime Control Lab: Incident and Assurance Workspace migration (Round 3, Phase 2)
-- Adds the two new tables needed for the incident lifecycle: incidents and
-- incident_links. Decisions, conditions, actions, evidence and comments are
-- REUSED polymorphically (subject_type = 'incident') from migration 001; no
-- parallel tables are created for them here.
--
-- Conventions match 001/002/004:
--   - UUID primary keys via gen_random_uuid() (pgcrypto, already enabled)
--   - workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now()
--   - CHECK constraints on enumerated values
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- ============================================================================
-- incidents: an event that happened (as opposed to control_tests, which is a
-- planned exercise). affected_population is a free-shape JSONB summarising
-- scale/impact ({customersAffected, transactionsAffected, valueGbp,
-- identificationMethod, notes}) rather than a normalised table, since the
-- fields recorded vary hugely by incident type and none of them need to be
-- individually queried yet. closeIncident (lib/repo/incidents.ts) is the only
-- path that may set status 'closed'; see that function's doc comment for the
-- governance guards it enforces before allowing that write.
-- ============================================================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reference TEXT,
  title TEXT NOT NULL,
  source TEXT
    CHECK (source IN ('internal_detection', 'customer_complaint', 'regulator', 'third_party', 'audit', 'control_test', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'contained', 'investigating', 'remediating', 'closed', 'cancelled')),
  occurred_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ,
  contained_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  summary TEXT,
  containment TEXT,
  affected_population JSONB NOT NULL DEFAULT '{}',
  root_cause TEXT,
  root_cause_category TEXT
    CHECK (root_cause_category IN ('control_design', 'control_operation', 'data_quality', 'system_failure', 'human_error', 'third_party', 'process_gap', 'other')),
  reportable BOOLEAN NOT NULL DEFAULT false,
  reported_at TIMESTAMPTZ,
  regulator_reference TEXT,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 7),
  closure_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_workspace ON incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_owner_person ON incidents(owner_person_id);

-- ============================================================================
-- incident_links: the traceability spine. Links an incident to the other
-- objects that make up the regulator-facing chain (a failed workspace_control,
-- the control_change that fixed it, the control_test that caught or proved
-- it, a pra_assessment, or a library enforcement case). target_id is used for
-- workspace-owned rows (verified against the workspace by the route, not by
-- this table); target_ref is used for static library references that have no
-- workspace-scoped row of their own (e.g. an enforcement case slug). A link
-- with neither target_id nor target_ref is rejected at the application
-- layer. The uniqueness guard against recording the same link twice is the
-- expression index below rather than a plain UNIQUE constraint on
-- (incident_id, link_type, target_id, target_ref): Postgres treats NULL <>
-- NULL for uniqueness purposes, so a plain UNIQUE constraint would let two
-- target_ref-only links (target_id NULL both times) or two target_id-only
-- links (target_ref NULL both times) collide silently. COALESCE-ing each
-- nullable column to a fixed sentinel makes two NULLs compare equal here.
-- ============================================================================
CREATE TABLE IF NOT EXISTS incident_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL
    CHECK (link_type IN ('failed_control', 'control_change', 'control_test', 'pra_assessment', 'enforcement_case')),
  target_id UUID,
  target_ref TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_links_workspace ON incident_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_incident ON incident_links(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_links_type_target ON incident_links(link_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_links_target ON incident_links(
  incident_id,
  link_type,
  COALESCE(target_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(target_ref, '')
);
