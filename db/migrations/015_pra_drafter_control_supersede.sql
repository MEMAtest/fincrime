-- PRA Drafter - fix duplicate controls on re-import (prod walkthrough item
-- 1). Root cause: buildControlsFromRegisterVersion always INSERTed a new
-- drafter_controls row per register row, with no lookup by req_id, so
-- accepting a second register version (or re-importing the same register)
-- produced a second, independent control for the same requirement. Both
-- were "current" as far as candidate selection and drafting were
-- concerned, so a single REQ could reach a PRA twice.
--
-- Fix: one CURRENT control per req_id, enforced in application code
-- (lib/repo/drafter-controls.ts buildControlsFromRegisterVersion). This
-- table keeps the pre-update snapshot each time a control is superseded by
-- a later register version, so history is not lost even though the
-- control row itself is updated in place.

CREATE TABLE IF NOT EXISTS drafter_control_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID NOT NULL REFERENCES drafter_controls(id),
  snapshot JSONB NOT NULL,
  superseded_by_register_version_id UUID NOT NULL REFERENCES drafter_register_versions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafter_control_history_control ON drafter_control_history(control_id);
