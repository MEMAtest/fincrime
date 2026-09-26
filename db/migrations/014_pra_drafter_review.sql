-- PRA Drafter - review/export/calibration phase (coder 4). See
-- docs/pra-drafter/SPEC.md "Reviewer", "Page viewer and editing",
-- "Word export", calibration, and HANDOFF-3.md "Known limits".
--
-- Apply with: npm run db:migrate (against the LOCAL fincrime_dev DB only).

-- Style brief text/document attached to a StylePack version (HANDOFF-3
-- "Known limits" #1 / BUILD-DECISIONS "Skeleton extraction"): the brief's
-- own text is included in the writer prompt from here on.
ALTER TABLE drafter_stylepack_versions
  ADD COLUMN IF NOT EXISTS style_brief_document_id UUID REFERENCES drafter_documents(id),
  ADD COLUMN IF NOT EXISTS style_brief_text TEXT;

-- PRA status must advance through the full lifecycle regardless of stub vs
-- paid model calls (HANDOFF-3 "Known limits" #3): draft -> drafted ->
-- in_review -> ready_to_export -> exported.
ALTER TABLE drafter_pras DROP CONSTRAINT IF EXISTS drafter_pras_status_check;
ALTER TABLE drafter_pras
  ADD CONSTRAINT drafter_pras_status_check
  CHECK (status IN ('draft', 'drafting', 'drafted', 'in_review', 'ready_to_export', 'exported'));

-- Export history: every export attempt (blocked/overridden/succeeded) is
-- recorded for audit, per SPEC.md "Word export" gate + override.
CREATE TABLE IF NOT EXISTS drafter_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pra_id UUID NOT NULL REFERENCES drafter_pras(id),
  filename TEXT NOT NULL,
  overridden BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  blocking_reasons JSONB NOT NULL DEFAULT '[]',
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_export_log_pra ON drafter_export_log(pra_id);

-- Calibration run history, keyed by model + prompt version (HANDOFF-3
-- "Known limits" #4: "the drafter_calibration_items table is still unused").
-- One row per run over the whole labelled set at that moment.
CREATE TABLE IF NOT EXISTS drafter_calibration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  agreement_by_criterion JSONB NOT NULL, -- {criterion: {agree, total, pct}}
  overall_agreement_pct NUMERIC NOT NULL,
  threshold_pct NUMERIC NOT NULL,
  passed_threshold BOOLEAN NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_calibration_runs_model ON drafter_calibration_runs(model_name, prompt_version);
