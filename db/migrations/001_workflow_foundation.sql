-- FinCrime Control Lab: workflow foundation migration
-- Adds the anonymous-workspace layer described in the "Workflow Foundation +
-- PRA Workspace" plan: workspaces, people, products, and the generic
-- decision/condition/action/evidence/comment/version/audit tables shared by
-- every workspace journey (Round 1: Product Risk Assessment).
--
-- Conventions:
--   - UUID primary keys via gen_random_uuid() (pgcrypto)
--   - every scoped table carries workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now() on every table
--   - CHECK constraints on the enumerated status/role/coverage/outcome values
--     named in the plan (plus a few directly implied by referenced TS types,
--     called out inline below)
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- workspaces: the anonymous tenant. Client keeps {id, token} in localStorage;
-- only token_hash (sha256 of the plaintext token) is ever persisted server
-- side. owner_email is nullable and filled in later from lead capture/export.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  name TEXT,
  owner_email TEXT,
  -- Residual-risk banding used by data/scoring/residual-risk.ts: residual
  -- score >= outsideFrom is "outside appetite", >= toleratedFrom is
  -- "tolerated", below that is "within". Shape matches AppetiteThresholds /
  -- DEFAULT_APPETITE_THRESHOLDS in that module.
  appetite_thresholds JSONB NOT NULL DEFAULT '{"toleratedFrom": 40, "outsideFrom": 60}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_token_hash ON workspaces(token_hash);

-- ============================================================================
-- workspace_people: named people without logins. Approvals/decisions record a
-- person, not a session, so "reviewers and approvers" work with no auth.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'reviewer', 'approver')),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_people_workspace ON workspace_people(workspace_id);

-- ============================================================================
-- products: the thing being assessed in a Product Risk Assessment.
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  flows JSONB NOT NULL DEFAULT '[]',
  customers JSONB NOT NULL DEFAULT '[]',
  jurisdictions JSONB NOT NULL DEFAULT '[]',
  channels JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);

-- ============================================================================
-- workspace_controls: live control objects (instances of a library
-- control_slug, or fully custom). Field shape mirrors ControlOverride /
-- Control in data/controls/types.ts (status -> ControlStatus, effectiveness
-- rating -> ControlRating) so the Control Builder can adopt these later.
-- Created before assessment_controls, which references it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  control_slug TEXT,
  name TEXT NOT NULL,
  category TEXT,
  typology_slugs JSONB NOT NULL DEFAULT '[]',
  product_applicability JSONB NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  approver_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  systems JSONB NOT NULL DEFAULT '[]',
  data_inputs JSONB NOT NULL DEFAULT '[]',
  threshold TEXT,
  operating_frequency TEXT,
  -- mirrors data/controls/types.ts ControlStatus
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'needs_review', 'gaps', 'implemented')),
  -- mirrors data/controls/types.ts ControlRating
  effectiveness_rating TEXT DEFAULT 'not_assessed'
    CHECK (effectiveness_rating IN ('strong', 'adequate', 'weak', 'not_assessed')),
  last_tested_at TIMESTAMPTZ,
  next_test_due DATE,
  monitoring_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_controls_workspace ON workspace_controls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_controls_slug ON workspace_controls(control_slug);
CREATE INDEX IF NOT EXISTS idx_workspace_controls_owner ON workspace_controls(owner_person_id);

-- ============================================================================
-- pra_assessments: one Product Risk Assessment journey against a product.
-- current_step tracks progress through the 8-step journey.
-- ============================================================================
CREATE TABLE IF NOT EXISTS pra_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'conditions_applied')),
  recommendation TEXT,
  residual_summary JSONB NOT NULL DEFAULT '{}',
  appetite_result TEXT CHECK (appetite_result IN ('within', 'tolerated', 'outside')),
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pra_assessments_workspace ON pra_assessments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pra_assessments_product ON pra_assessments(product_id);
CREATE INDEX IF NOT EXISTS idx_pra_assessments_status ON pra_assessments(status);

-- ============================================================================
-- assessment_risks: the inherent/residual risk register for an assessment.
-- typology_slug references the static data/typologies/*.ts library, not a
-- DB row, so it stays nullable text (manual risks may have none).
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES pra_assessments(id) ON DELETE CASCADE,
  typology_slug TEXT,
  title TEXT NOT NULL,
  inherent_score INTEGER CHECK (inherent_score IS NULL OR inherent_score BETWEEN 0 AND 100),
  inherent_rationale TEXT,
  residual_score INTEGER CHECK (residual_score IS NULL OR residual_score BETWEEN 0 AND 100),
  residual_rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_risks_workspace ON assessment_risks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assessment_risks_assessment ON assessment_risks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_risks_typology ON assessment_risks(typology_slug);

-- ============================================================================
-- assessment_controls: per-risk control mapping (library control_slug and/or
-- a live workspace_controls instance), with a coverage judgement and the
-- operational-load calculator inputs (data/scoring/operational-load.ts).
-- ============================================================================
CREATE TABLE IF NOT EXISTS assessment_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES pra_assessments(id) ON DELETE CASCADE,
  risk_id UUID NOT NULL REFERENCES assessment_risks(id) ON DELETE CASCADE,
  workspace_control_id UUID REFERENCES workspace_controls(id) ON DELETE SET NULL,
  control_slug TEXT,
  coverage TEXT NOT NULL CHECK (coverage IN ('full', 'partial', 'gap')),
  op_load JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_controls_workspace ON assessment_controls(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assessment_controls_assessment ON assessment_controls(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_controls_risk ON assessment_controls(risk_id);
CREATE INDEX IF NOT EXISTS idx_assessment_controls_workspace_control ON assessment_controls(workspace_control_id);

-- ============================================================================
-- decisions: polymorphic decision record (subject_type + subject_id), signed
-- by a named person from workspace_people. Round 1 subject is a pra_assessment
-- (recommendation + decision, journey step 7); the shape is generic so later
-- rounds (e.g. Control Change Lab) can attach decisions to other subjects.
-- ============================================================================
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  -- journey step 7: "approve / approve with conditions / reject"
  outcome TEXT NOT NULL CHECK (outcome IN ('approve', 'approve_with_conditions', 'reject')),
  rationale TEXT,
  decided_by_person_id UUID NOT NULL REFERENCES workspace_people(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decisions_workspace ON decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_decisions_subject ON decisions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_decisions_decided_by ON decisions(decided_by_person_id);

-- ============================================================================
-- conditions: attached to a decision (e.g. "approve with conditions"), each
-- with a due date and owner so they can be tracked to closure.
-- ============================================================================
CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'met', 'breached')),
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conditions_workspace ON conditions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conditions_decision ON conditions(decision_id);
CREATE INDEX IF NOT EXISTS idx_conditions_due_date ON conditions(due_date);

-- ============================================================================
-- actions: polymorphic follow-up items (e.g. remediation for a control gap),
-- with an owner, due date, status and priority. No notifications in Round 1;
-- the workspace home reads overdue actions directly (due_date < now(),
-- status = 'open').
-- ============================================================================
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  title TEXT NOT NULL,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  due_date DATE,
  -- status/priority values are not spelled out verbatim in the plan; this is
  -- a sensible default set (priority reuses data/controls/types.ts ControlPriority).
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_workspace ON actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_actions_subject ON actions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- ============================================================================
-- evidence: Round 1 is metadata only (type, title, description, link, date,
-- added-by person). Binary file upload is deferred (needs S3/blob infra).
-- ============================================================================
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link_url TEXT,
  evidence_date DATE,
  added_by_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_workspace ON evidence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence(subject_type, subject_id);

-- ============================================================================
-- comments: polymorphic discussion thread on any subject.
-- ============================================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  body TEXT NOT NULL,
  author_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_workspace ON comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_subject ON comments(subject_type, subject_id);

-- ============================================================================
-- object_versions: generic change history. workspace_controls writes a
-- snapshot here on every version bump; other subjects can adopt the same
-- pattern later. changed_by is free text (a person's name, or a system
-- actor) rather than a hard FK, so history survives a person being removed.
-- ============================================================================
CREATE TABLE IF NOT EXISTS object_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}',
  changed_by TEXT,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_object_versions_workspace ON object_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_object_versions_subject ON object_versions(subject_type, subject_id);

-- ============================================================================
-- audit_log: append-only record of every mutation. subject_type/subject_id
-- are nullable for workspace-level events (e.g. "workspace created") that
-- have no single subject. actor is free text (a person's name, or "system")
-- rather than a hard FK, for the same reason as object_versions.changed_by.
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  verb TEXT NOT NULL,
  subject_type TEXT,
  subject_id UUID,
  detail JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace ON audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject ON audit_log(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
