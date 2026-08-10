/**
 * Client-side mirrors of the lib/repo/*.ts row shapes used by the Control
 * Change Lab journey. Deliberately NOT imported from lib/repo/** (those
 * modules pull in lib/db.ts / the `pg` driver, which must never end up in a
 * client bundle) - these are plain, duplicated type declarations kept in
 * lockstep with the DB rows returned by app/api/control-changes/**.
 *
 * PersonDTO / DecisionDTO / ConditionDTO / ActionDTO / EvidenceDTO are
 * identical shapes to components/pra/types.ts (decisions/conditions/actions/
 * evidence/people are reused polymorphically across both journeys), so they
 * are re-exported from there rather than redeclared.
 */

export type {
  PersonDTO,
  PersonRole,
  DecisionDTO,
  DecisionOutcome,
  ConditionDTO,
  ConditionStatus,
  ActionDTO,
  ActionPriority,
  ActionStatus,
  EvidenceDTO,
} from "@/components/pra/types";

import type {
  ActionPriority,
  ConditionStatus,
  DecisionOutcome,
} from "@/components/pra/types";
import type { ControlRating } from "@/data/controls/types";

export type ControlChangeType =
  | "threshold"
  | "rule_logic"
  | "scope"
  | "ownership"
  | "frequency"
  | "system"
  | "decommission"
  | "other";

export type ControlChangeStatus = "draft" | "in_review" | "approved" | "rejected" | "implemented" | "rolled_back";

/** Reuses data/controls/types.ts ControlRating: same union used by the workspace_controls effectiveness_rating column. */
export type ControlEffectivenessRating = ControlRating;

/** Client-side mirror of lib/repo/control-changes.ts's CONTROL_FIELD_WHITELIST values. */
export interface ControlFieldValues {
  objective?: string;
  threshold?: string | null;
  operatingFrequency?: string | null;
  systems?: string[];
  dataInputs?: string[];
  status?: string;
  effectivenessRating?: ControlEffectivenessRating | null;
  ownerPersonId?: string | null;
  approverPersonId?: string | null;
  productApplicability?: string[];
  typologySlugs?: string[];
}

/** Client-side mirror of lib/repo/controls.ts's WorkspaceControlRow. */
export interface WorkspaceControlDTO {
  id: string;
  workspace_id: string;
  objective: string;
  control_slug: string | null;
  name: string;
  category: string | null;
  typology_slugs: string[];
  product_applicability: string[];
  version: number;
  owner_person_id: string | null;
  approver_person_id: string | null;
  systems: string[];
  data_inputs: string[];
  threshold: string | null;
  operating_frequency: string | null;
  status: string;
  effectiveness_rating: ControlEffectivenessRating | null;
  last_tested_at: string | null;
  next_test_due: string | null;
  monitoring_metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/control-changes.ts's ControlChangeRow. */
export interface ControlChangeDTO {
  id: string;
  workspace_id: string;
  workspace_control_id: string;
  title: string;
  rationale: string | null;
  change_type: ControlChangeType | null;
  status: ControlChangeStatus;
  current_step: number;
  baseline: ControlFieldValues;
  proposed: ControlFieldValues;
  supporting_data: Record<string, unknown>;
  impact: Record<string, unknown>;
  pilot: boolean;
  pilot_notes: string | null;
  monitoring: Record<string, unknown>;
  rollback_criteria: string | null;
  implemented_at: string | null;
  rolled_back_at: string | null;
  applied_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface ControlChangeListItem {
  id: string;
  title: string;
  status: ControlChangeStatus;
  currentStep: number;
  changeType: ControlChangeType | null;
  controlName: string;
  updatedAt: string;
}

export const CONTROL_CHANGE_STATUS_LABEL: Record<ControlChangeStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
  rolled_back: "Rolled Back",
};

export const CONTROL_CHANGE_TYPE_LABEL: Record<ControlChangeType, string> = {
  threshold: "Threshold",
  rule_logic: "Rule logic",
  scope: "Scope",
  ownership: "Ownership",
  frequency: "Frequency",
  system: "System",
  decommission: "Decommission",
  other: "Other",
};

export const JOURNEY_STEP_LABELS = [
  "Control",
  "Proposed change",
  "Supporting data",
  "Impact",
  "Approval",
  "Monitoring",
  "Implement",
] as const;

/** All 7 steps are built. */
export const LAST_UNLOCKED_STEP = 7;

/**
 * Step 7's on-screen/PDF change pack payload, assembled client-side by
 * StepImplement.tsx and sent as-is to POST /api/export/pdf (module
 * "control_change"). This is the ONE canonical shape for that payload:
 * lib/pdf/change-pdf.ts (server-only, pulls in jsPDF) imports these same
 * types rather than redeclaring them, so the two sides can never drift.
 * Safe for a server file to import from here because this module has no
 * "use client" directive and no server-only dependencies of its own.
 */
export interface ChangeExportFieldDiff {
  field: string;
  label: string;
  current: string;
  proposed: string;
  changed: boolean;
}

export interface ChangeExportCondition {
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  status: ConditionStatus;
}

export interface ChangeExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: string;
}

export interface ChangeExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
  /** Whether this evidence item has a file attached (migration 009) - "we hold the document" vs "we linked to it" is a material distinction on a pack, per the Phase 7 brief. */
  fileName: string | null;
  fileSizeBytes: number | null;
}

export interface ChangeExportDecision {
  outcome: DecisionOutcome;
  decidedByName: string;
  decidedAt: string;
  rationale: string | null;
}

export interface ChangeExportMonitoringRow {
  metric: string;
  target: string;
  owner: string;
  reviewDate: string;
}

export interface ChangeExportPayload {
  changeTitle: string;
  controlName: string;
  changeType: ControlChangeType | null;
  status: ControlChangeStatus;
  rationale: string | null;
  fieldDiffs: ChangeExportFieldDiff[];
  changedFieldCount: number;
  supportingData: {
    baselineAlertVolume: number | null;
    truePositives: number | null;
    falsePositives: number | null;
    expectedVolume: number | null;
    testingNotes: string | null;
  };
  evidence: ChangeExportEvidence[];
  impact: {
    beforeAnalystHoursPerMonth: number | null;
    afterAnalystHoursPerMonth: number | null;
    beforeFte: number | null;
    afterFte: number | null;
    beforeMonthlyCostGbp: number | null;
    afterMonthlyCostGbp: number | null;
    customerFrictionNotes: string | null;
    riskImpactNotes: string | null;
  };
  pilot: boolean;
  pilotNotes: string | null;
  decision: ChangeExportDecision | null;
  conditions: ChangeExportCondition[];
  actions: ChangeExportAction[];
  monitoring: ChangeExportMonitoringRow[];
  rollbackCriteria: string | null;
  implementedAt: string | null;
  rolledBackAt: string | null;
  appliedVersion: number | null;
  narrative?: string | null;
}
