-- PRA Drafter - judge calibration machinery fixes (SPEC.md "Acceptance
-- criteria and calibration"). See docs/pra-drafter/SPEC.md:
--   "Tune the prompt until agreement on critical criteria reaches an
--    agreed threshold (setting)."
--
-- Apply with: npm run db:migrate (against the LOCAL fincrime_dev DB only).

-- Calibration items are now judged one at a time (per-item route), so each
-- item's cached judge_output must be tagged with the model + prompt version
-- it was judged under - finalise only ever summarises items tagged with the
-- CURRENT judge model + prompt version, never a stale cached result from an
-- older model.
ALTER TABLE drafter_calibration_items
  ADD COLUMN IF NOT EXISTS judge_model_name TEXT,
  ADD COLUMN IF NOT EXISTS judge_prompt_version TEXT;

CREATE INDEX IF NOT EXISTS idx_drafter_calibration_items_judge
  ON drafter_calibration_items(judge_model_name, judge_prompt_version);

-- Run history now also records the invalid/missing-verdict count and the
-- min-items setting a run was checked against, so an old run's pass/fail can
-- still be understood after the settings change later.
ALTER TABLE drafter_calibration_runs
  ADD COLUMN IF NOT EXISTS invalid_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_items INTEGER NOT NULL DEFAULT 20;

-- New setting: minimum number of labelled+judged items a calibration run
-- must cover before it can pass, regardless of how high the agreement
-- percentage is (SPEC.md "Label 20 to 30 enhancements by hand").
INSERT INTO drafter_settings (key, value, updated_by)
VALUES ('judge_calibration_min_items', '20', 'system')
ON CONFLICT (key) DO NOTHING;

-- Raise the agreement threshold seed from 80 to 85, but only where nobody
-- has already edited it away from the original seed value.
UPDATE drafter_settings
   SET value = '85'
 WHERE key = 'judge_agreement_threshold_pct'
   AND value = '80';
