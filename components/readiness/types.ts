/**
 * Client-side mirrors of the lib/repo/readiness.ts row shapes used by the
 * Entity and Market Readiness journey. Deliberately NOT imported from
 * lib/repo/** (those modules pull in lib/db.ts / the `pg` driver, which must
 * never end up in a client bundle) - these are plain, duplicated type
 * declarations kept in lockstep with the DB rows returned by
 * app/api/readiness/**.
 *
 * PersonDTO/ActionDTO/EvidenceDTO/DecisionDTO/ConditionDTO are identical
 * shapes to components/change-lab/types.ts (people/actions/evidence/
 * decisions/conditions are reused polymorphically across every journey in
 * this repo), so they are re-exported from there rather than redeclared.
 */

export type {
  PersonDTO,
  PersonRole,
  ActionDTO,
  ActionPriority,
  ActionStatus,
  EvidenceDTO,
  DecisionDTO,
  DecisionOutcome,
  ConditionDTO,
  ConditionStatus,
  WorkspaceControlDTO,
} from "@/components/change-lab/types";

import type { ActionPriority, ActionStatus } from "@/components/change-lab/types";
import type { EntityType, Jurisdiction, RiskLevel } from "@/data/kyc/types";
import type { Source } from "@/data/typologies/types";

export type { EntityType, Jurisdiction, RiskLevel, Source };

export type ReadinessStatus = "draft" | "in_review" | "approved_local" | "approved_global" | "rejected" | "cancelled";
export type ReadinessGap = "not_assessed" | "none" | "partial" | "full";

/** Client-side mirror of lib/repo/readiness.ts's ReadinessAssessmentRow. */
export interface ReadinessAssessmentDTO {
  id: string;
  workspace_id: string;
  title: string;
  entity_type: EntityType;
  jurisdiction: Jurisdiction;
  risk_level: RiskLevel;
  product_id: string | null;
  product_note: string | null;
  status: ReadinessStatus;
  current_step: number;
  target_launch_date: string | null;
  owner_person_id: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/readiness.ts's ReadinessObligationRow. */
export interface ReadinessObligationDTO {
  id: string;
  workspace_id: string;
  assessment_id: string;
  requirement_key: string;
  category: string;
  title: string;
  rule_summary: string | null;
  legal_basis: Source[];
  applies_at_risk: string[];
  workspace_control_id: string | null;
  control_note: string | null;
  gap: ReadinessGap;
  blocker: boolean;
  owner_person_id: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/readiness/summary.ts's ReadinessSummary. */
export interface ReadinessSummaryDTO {
  total: number;
  byGap: Record<ReadinessGap, number>;
  blockerCount: number;
  unresolvedBlockerCount: number;
  noControlCount: number;
  coveragePct: number;
}

/** GET /api/readiness's list item shape. */
export interface ReadinessListItem {
  id: string;
  title: string;
  entityType: EntityType;
  jurisdiction: Jurisdiction;
  status: ReadinessStatus;
  blockerCount: number;
  unresolvedBlockers: number;
  coveragePct: number;
  targetLaunchDate: string | null;
  updatedAt: string;
}

export const READINESS_STATUS_LABEL: Record<ReadinessStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved_local: "Approved (Local)",
  approved_global: "Approved (Global)",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const READINESS_GAP_LABEL: Record<ReadinessGap, string> = {
  not_assessed: "Not assessed",
  none: "No gap",
  partial: "Partially met",
  full: "Fully met",
};

/** Plain-English "what this means" for each gap classification, shown next to the picker in StepControls. */
export const READINESS_GAP_MEANING: Record<ReadinessGap, string> = {
  not_assessed: "No one has looked at this obligation against the mapped control yet.",
  none: "The mapped control does not meet this obligation at all.",
  partial: "The mapped control partly meets this obligation; work remains.",
  full: "The mapped control fully meets this obligation.",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const JOURNEY_STEP_LABELS = ["Scope", "Obligations", "Controls", "Gaps", "Evidence", "Approval"] as const;

/** All 6 steps are built. */
export const LAST_UNLOCKED_STEP = 6;

/**
 * Step 6's on-screen/PDF launch-readiness pack payload, assembled
 * client-side by StepApproval.tsx and sent as-is to POST /api/export/pdf
 * (module "readiness"). This is the ONE canonical shape for that payload:
 * lib/pdf/readiness-pdf.ts (server-only, pulls in jsPDF) imports these same
 * types rather than redeclaring them, so the two sides can never drift. Safe
 * for a server file to import from here because this module has no
 * "use client" directive and no server-only dependencies of its own.
 */
export interface ReadinessExportSource {
  org: string;
  reference: string;
  title: string;
  url: string;
}

export interface ReadinessExportObligation {
  category: string;
  title: string;
  ruleSummary: string | null;
  controlName: string | null;
  gap: ReadinessGap;
  blocker: boolean;
  ownerName: string | null;
  dueDate: string | null;
  legalBasis: ReadinessExportSource[];
}

export interface ReadinessExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
}

export interface ReadinessExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

export interface ReadinessExportCondition {
  description: string;
  dueDate: string | null;
  ownerName: string | null;
}

export interface ReadinessExportDecision {
  outcome: "approve" | "reject";
  level: "local" | "global" | "rejection";
  decidedByName: string;
  decidedAt: string;
  rationale: string | null;
}

export interface ReadinessExportPayload {
  title: string;
  entityType: string;
  jurisdiction: string;
  riskLevel: string;
  status: ReadinessStatus;
  targetLaunchDate: string | null;
  productName: string | null;
  ownerName: string | null;
  summary: ReadinessSummaryDTO;
  obligations: ReadinessExportObligation[];
  evidence: ReadinessExportEvidence[];
  actions: ReadinessExportAction[];
  conditions: ReadinessExportCondition[];
  decisions: ReadinessExportDecision[];
  narrative?: string | null;
}
