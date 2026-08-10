-- FinCrime Control Lab: Regulatory Response Workspace migration (Round 3, Phase 5)
--
-- Firms answer regulator requests (s165 letters, portal questionnaires,
-- onsite follow-ups) in Word documents, and the commitments made in those
-- responses ("we will implement X by Q3") die there. This module logs the
-- request, drafts a response per question substantiated by controls and
-- evidence, records exceptions honestly (reg_questions.exception_note - the
-- honest "we do not do this / not yet" answer), and turns every commitment
-- into a TRACKED action (reused from migration 001) with a due date and an
-- owner, so a promise made to the regulator shows up in overdue work instead
-- of being forgotten.
--
-- Decisions, conditions, actions, evidence and comments are REUSED
-- polymorphically (subject_type = 'reg_request', and 'reg_commitment' for
-- commitment-scoped actions) from migration 001; no parallel tables are
-- created for them here.
--
-- Conventions match 001/004/005/006:
--   - UUID primary keys via gen_random_uuid() (pgcrypto, already enabled)
--   - workspace_id UUID NOT NULL, ON DELETE CASCADE
--   - created_at / updated_at TIMESTAMPTZ DEFAULT now()
--   - CHECK constraints on enumerated values that are fixed in code
--   - safe to re-run: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
--
-- Apply with: npm run db:migrate (scripts/db-migrate.mjs)

-- ============================================================================
-- reg_requests: one regulator request/correspondence thread. `regulator` is
-- free text (not a CHECK) since a firm may be answering the FCA, PRA, a
-- local regulator in another jurisdiction, or a self-regulatory body -
-- common values in practice are 'FCA', 'PRA', 'FCA (S165)', but nothing here
-- constrains that. current_step tracks progress through an assumed 6-step
-- journey (log request -> draft answers -> substantiate/link evidence ->
-- record commitments -> approve -> submit/close), mirroring
-- readiness_assessments' and incidents' current_step pattern.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reg_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reference TEXT,
  title TEXT NOT NULL,
  -- Free text; common values 'FCA', 'PRA', 'FCA (S165)', not DB-constrained.
  regulator TEXT NOT NULL DEFAULT 'FCA',
  channel TEXT CHECK (channel IN ('email', 'portal', 'letter', 'meeting', 's165', 'other')),
  received_at DATE,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'in_review', 'approved', 'submitted', 'closed', 'cancelled')),
  submitted_at TIMESTAMPTZ,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  summary TEXT,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_requests_workspace ON reg_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON reg_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_deadline ON reg_requests(deadline);

-- ============================================================================
-- reg_questions: the individual questions/requests within a reg_request,
-- ordered by `position` (1-based). exception_note is where the honest
-- answer is "we do not do this / not yet" rather than pretending full
-- coverage - kept separate from `response` so a drafted answer and an
-- acknowledged gap are never conflated in one free-text field.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reg_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES reg_requests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  response TEXT,
  exception_note TEXT,
  status TEXT NOT NULL DEFAULT 'unanswered' CHECK (status IN ('unanswered', 'drafted', 'reviewed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, position)
);

CREATE INDEX IF NOT EXISTS idx_reg_questions_workspace ON reg_questions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reg_questions_request ON reg_questions(request_id);

-- ============================================================================
-- reg_question_links: substantiation. Links a question to the control,
-- control test, control change, incident, readiness assessment, PRA
-- assessment, or evidence row that backs the drafted response. target_id is
-- always a workspace-owned row (verified against the workspace AND against
-- the table link_type claims by the application layer in
-- lib/repo/reg-requests.ts - a control_test id passed as 'incident' must be
-- rejected there); unlike incident_links there is no target_ref/library
-- fallback here because every link_type in this table names a table that
-- has a live, workspace-scoped row.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reg_question_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES reg_questions(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL
    CHECK (link_type IN ('workspace_control', 'control_test', 'control_change', 'incident', 'readiness_assessment', 'pra_assessment', 'evidence')),
  target_id UUID NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_question_links_workspace ON reg_question_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reg_question_links_question ON reg_question_links(question_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_question_links_target ON reg_question_links(question_id, link_type, target_id);

-- ============================================================================
-- reg_commitments: the point of the module. Every promise made to the
-- regulator ("we will implement X by Q3") is recorded here, and
-- createCommitment (lib/repo/reg-requests.ts) creates a TRACKED action
-- (subject_type 'reg_commitment', subject_id = this row's id) in the SAME
-- transaction whenever a due_date is supplied, storing the resulting id
-- back onto action_id - so a commitment with a date is never just prose,
-- it is live overdue work. A commitment with no due_date gets no action
-- (there is nothing to be overdue against yet). question_id is nullable and
-- ON DELETE SET NULL because a commitment can be made in the round-up
-- (e.g. the covering letter) rather than against one specific question, and
-- deleting a question must never take down the commitment it prompted.
-- ============================================================================
CREATE TABLE IF NOT EXISTS reg_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES reg_requests(id) ON DELETE CASCADE,
  question_id UUID REFERENCES reg_questions(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  due_date DATE,
  owner_person_id UUID REFERENCES workspace_people(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'met', 'missed', 'withdrawn')),
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  met_at DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_commitments_workspace ON reg_commitments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reg_commitments_request ON reg_commitments(request_id);
CREATE INDEX IF NOT EXISTS idx_reg_commitments_status ON reg_commitments(status);
CREATE INDEX IF NOT EXISTS idx_reg_commitments_due_date ON reg_commitments(due_date);
