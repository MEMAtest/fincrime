-- PRA Drafter (private module). See docs/pra-drafter/SPEC.md and
-- BUILD-DECISIONS.md. All tables are prefixed drafter_. Data is shared by
-- all allowlisted users (single-purpose tool, no per-client workspaces), so
-- there is no workspace_id scoping here - every mutation instead records the
-- actor email in drafter_audit_log.
--
-- Apply with: npm run db:migrate (against the LOCAL fincrime_dev DB only).

-- ---------------------------------------------------------------------------
-- Documents: every upload (PRA, register, policy, style brief).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('pra', 'register', 'policy', 'style_brief')),
  confirmed_doc_type TEXT CHECK (confirmed_doc_type IN ('pra', 'register', 'policy', 'style_brief')),
  filename TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('docx', 'md', 'html', 'xlsx')),
  content_hash TEXT NOT NULL,
  blob_url TEXT,
  blob_pathname TEXT,
  fallback_bytes BYTEA,
  size_bytes INTEGER,
  parsed_content JSONB,
  parse_error TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_documents_type ON drafter_documents(doc_type);

-- ---------------------------------------------------------------------------
-- Templates (skeleton from an approved PRA) + versions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID REFERENCES drafter_documents(id),
  name TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafter_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES drafter_templates(id),
  version INTEGER NOT NULL,
  sections JSONB NOT NULL, -- [{number, title, customer_type, standard_wording, empty_section_wording, backoffice_control_map}]
  field_labels JSONB NOT NULL, -- {control_enhancement, control_enhancement_rationale, backoffice_control_impacted, evidence_of_delivery}
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

-- ---------------------------------------------------------------------------
-- StylePacks (house style) + versions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_stylepacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafter_stylepack_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylepack_id UUID NOT NULL REFERENCES drafter_stylepacks(id),
  version INTEGER NOT NULL,
  rules JSONB NOT NULL, -- the numbered style rules (see SPEC ss "Style rules")
  banned_phrases JSONB NOT NULL DEFAULT '[]', -- [{phrase, replacement}]
  tense_rule TEXT,
  length_limits JSONB NOT NULL DEFAULT '{"min_words":60,"max_words":150}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stylepack_id, version)
);

-- ---------------------------------------------------------------------------
-- Exemplars (approved control enhancements, tagged by section type).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_exemplars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylepack_version_id UUID REFERENCES drafter_stylepack_versions(id),
  section_type TEXT NOT NULL,
  control_text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('template', 'user_approved')),
  source_document_id UUID REFERENCES drafter_documents(id),
  source_pra_id UUID, -- FK added below once drafter_pras exists
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Register imports + versions + rows.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_register_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES drafter_documents(id),
  sheet_name TEXT NOT NULL,
  header_row_index INTEGER NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafter_register_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_import_id UUID NOT NULL REFERENCES drafter_register_imports(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'validating' CHECK (status IN ('validating', 'blocked', 'accepted')),
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (register_import_id, version)
);

-- Column mappings: one role per column, saved & editable per register_import.
CREATE TABLE IF NOT EXISTS drafter_column_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_import_id UUID NOT NULL REFERENCES drafter_register_imports(id),
  source_header TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'filter', 'section_and_tags', 'reuse_adapt_new', 'draft_input',
    'evidence', 'reference_only', 'unused'
  )),
  field_key TEXT NOT NULL, -- e.g. 'applicability', 'req_id', 'control_review_notes'
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (register_import_id, source_header)
);

CREATE TABLE IF NOT EXISTS drafter_register_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_version_id UUID NOT NULL REFERENCES drafter_register_versions(id),
  req_id TEXT,
  row_index INTEGER NOT NULL,
  fields JSONB NOT NULL, -- {field_key: raw_value | {error: '#REF!'}}
  validation_issues JSONB NOT NULL DEFAULT '[]', -- [{check, severity, message}]
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_register_rows_version ON drafter_register_rows(register_version_id);
CREATE INDEX IF NOT EXISTS idx_drafter_register_rows_req_id ON drafter_register_rows(register_version_id, req_id);

-- Validation issue overrides (blocking issue resolved/overridden by a user).
CREATE TABLE IF NOT EXISTS drafter_validation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_row_id UUID NOT NULL REFERENCES drafter_register_rows(id),
  check_name TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('resolved', 'overridden')),
  note TEXT,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Controls library.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  req_ids TEXT[] NOT NULL DEFAULT '{}',
  register_row_ids UUID[] NOT NULL DEFAULT '{}',
  backoffice_control TEXT,
  coverage TEXT CHECK (coverage IN ('yes', 'partial', 'no', 'unassessed')),
  agreed_wording TEXT,
  used_in_pra_ids UUID[] NOT NULL DEFAULT '{}',
  merge_group_id UUID, -- FK added below once drafter_merge_groups exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tags: code tags (deterministic, from register columns) and suggested tags
-- (model, controlled-list only, must be confirmed before use).
CREATE TABLE IF NOT EXISTS drafter_control_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID NOT NULL REFERENCES drafter_controls(id),
  tag_type TEXT NOT NULL CHECK (tag_type IN (
    'backoffice_control', 'fincrime_area', 'jurisdiction', 'regulation_reference',
    'coverage', 'products_used_in', 'risk_addressed', 'customer_type', 'lifecycle_stage'
  )),
  value TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('code', 'suggested')),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  evidence_phrase TEXT, -- phrase the model based the suggestion on, e.g. "before onboarding"
  model_name TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_control_tags_control ON drafter_control_tags(control_id);
CREATE INDEX IF NOT EXISTS idx_drafter_control_tags_lookup ON drafter_control_tags(tag_type, value) WHERE confirmed = true;

-- Merge groups: candidate/confirmed merges (same backoffice control + same
-- CONFIRMED risk tag).
CREATE TABLE IF NOT EXISTS drafter_merge_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backoffice_control TEXT NOT NULL,
  risk_tag_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'confirmed', 'split', 'rejected')),
  member_control_ids UUID[] NOT NULL DEFAULT '{}',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drafter_controls
  ADD CONSTRAINT fk_drafter_controls_merge_group
  FOREIGN KEY (merge_group_id) REFERENCES drafter_merge_groups(id);

-- ---------------------------------------------------------------------------
-- Settings (single-row-per-key store: controlled lists, filter defaults,
-- contradiction rules, cost cap, prices, judge threshold).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PRA drafts, sections, enhancements, edit history, open items.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_pras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  description TEXT,
  legal_entity TEXT,
  customer_types TEXT[] NOT NULL DEFAULT '{}', -- natural_person, legal_person
  template_version_id UUID NOT NULL REFERENCES drafter_template_versions(id),
  stylepack_version_id UUID NOT NULL REFERENCES drafter_stylepack_versions(id),
  register_version_id UUID REFERENCES drafter_register_versions(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'drafting', 'in_review', 'exported')),
  cost_cap_pence INTEGER,
  spend_pence INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE drafter_exemplars
  ADD CONSTRAINT fk_drafter_exemplars_source_pra
  FOREIGN KEY (source_pra_id) REFERENCES drafter_pras(id);

CREATE TABLE IF NOT EXISTS drafter_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pra_id UUID NOT NULL REFERENCES drafter_pras(id),
  section_number TEXT NOT NULL,
  title TEXT NOT NULL,
  customer_type TEXT,
  sort_order INTEGER NOT NULL,
  is_empty BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_sections_pra ON drafter_sections(pra_id);

CREATE TABLE IF NOT EXISTS drafter_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES drafter_sections(id),
  pra_id UUID NOT NULL REFERENCES drafter_pras(id),
  sort_order INTEGER NOT NULL,
  control_ids UUID[] NOT NULL DEFAULT '{}',
  control_text TEXT,
  rationale TEXT,
  backoffice_control_label TEXT,
  evidence_refs JSONB NOT NULL DEFAULT '[]',
  placeholders JSONB NOT NULL DEFAULT '[]',
  review_result JSONB, -- {lint: [...], judge: {...}, status: 'pass'|'minor'|'critical'|'not_reviewed'}
  is_gap BOOLEAN NOT NULL DEFAULT false,
  model_name TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_enhancements_section ON drafter_enhancements(section_id);
CREATE INDEX IF NOT EXISTS idx_drafter_enhancements_pra ON drafter_enhancements(pra_id);

CREATE TABLE IF NOT EXISTS drafter_enhancement_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enhancement_id UUID NOT NULL REFERENCES drafter_enhancements(id),
  field TEXT NOT NULL CHECK (field IN ('control_text', 'rationale')),
  previous_value TEXT,
  new_value TEXT,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('manual', 'apply_fix')),
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafter_open_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pra_id UUID NOT NULL REFERENCES drafter_pras(id),
  enhancement_id UUID REFERENCES drafter_enhancements(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('placeholder', 'unsupported_term', 'gap', 'export_override')),
  description TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_open_items_pra ON drafter_open_items(pra_id);

-- ---------------------------------------------------------------------------
-- Model call log + calibration set.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_model_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('writer', 'judge', 'tagger')),
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output JSONB,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_estimate_pence INTEGER,
  latency_ms INTEGER,
  pra_id UUID REFERENCES drafter_pras(id),
  enhancement_id UUID REFERENCES drafter_enhancements(id),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_model_calls_pra ON drafter_model_calls(pra_id);

CREATE TABLE IF NOT EXISTS drafter_calibration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enhancement_text TEXT NOT NULL,
  rationale_text TEXT NOT NULL,
  section_type TEXT NOT NULL,
  human_labels JSONB NOT NULL DEFAULT '{}', -- {criterion: pass|fail}
  judge_output JSONB, -- last run's judge result, for agreement measurement
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Audit log (every mutation records the actor email).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_audit_log_entity ON drafter_audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Seed settings defaults (per SPEC "Default inclusion filter" and
-- "Controls library and tagging"). Editable afterwards via the settings page.
-- ---------------------------------------------------------------------------
INSERT INTO drafter_settings (key, value, updated_by) VALUES
  ('filter_defaults', '{
    "applicability": "Applicable to Revolut",
    "obligation_vs_guidance_prefix": "Obligation",
    "include_guidance": false,
    "group_2lod_status": "Revision Complete",
    "complete_for_pra_procedures_valid_only": true
  }', 'system'),
  ('banned_phrases', '[
    {"phrase": "non-negotiable", "replacement": "required"},
    {"phrase": "severe", "replacement": "significant"},
    {"phrase": "contagion", "replacement": "spread"},
    {"phrase": "immediate", "replacement": "prompt"},
    {"phrase": "rails", "replacement": "channels"}
  ]', 'system'),
  ('controlled_tags_risk_addressed', '[
    "shell banks", "nesting", "source of wealth", "source of funds", "sanctions",
    "payment transparency", "PEPs", "high-risk jurisdictions", "beneficial ownership",
    "transaction monitoring", "correspondent due diligence", "fraud"
  ]', 'system'),
  ('controlled_tags_customer_type', '["natural person", "legal person", "both"]', 'system'),
  ('controlled_tags_lifecycle_stage', '["onboarding", "ongoing monitoring", "periodic review", "exit"]', 'system'),
  ('contradiction_rules', '[
    {
      "id": "applicability_vs_backoffice_out_of_scope",
      "column_a": "applicability",
      "value_a": "Applicable to Revolut",
      "column_b": "backoffice_reconciliation_comment",
      "value_b_contains": "Marked Out of Scope",
      "severity": "blocking"
    }
  ]', 'system'),
  ('cost_cap_pence_per_pra', '2000', 'system'),
  -- Judge default changed 2026-09-26 to qwen/qwen3-30b-a3b after a real-call
  -- bake-off (docs/pra-drafter/JUDGE-BAKEOFF.md) - see lib/drafter/llm.ts.
  ('model_prices_per_million_tokens_usd_cents', '{
    "writer": {"model": "openai/gpt-5.6-luna", "in": 20, "out": 120},
    "judge": {"model": "qwen/qwen3-30b-a3b", "in": 10, "out": 30}
  }', 'system'),
  ('judge_agreement_threshold_pct', '80', 'system'),
  ('control_text_word_limits', '{"min": 60, "max": 150}', 'system')
ON CONFLICT (key) DO NOTHING;
