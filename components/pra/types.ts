/**
 * Client-side mirrors of the lib/repo/*.ts row shapes used by the PRA journey.
 * Deliberately NOT imported from lib/repo/** (those modules pull in lib/db.ts
 * / the `pg` driver, which must never end up in a client bundle) - these are
 * plain, duplicated type declarations kept in lockstep with the DB rows
 * returned by app/api/pra/**.
 */

import type { CustomerType } from "@/data/typologies/types";
import type { Jurisdiction } from "@/data/kyc/types";
import type { ControlRating } from "@/data/controls/types";

export type AssessmentStatus = "draft" | "in_review" | "approved" | "rejected" | "conditions_applied";
export type AppetiteResult = "within" | "tolerated" | "outside";
export type ControlCoverage = "full" | "partial" | "gap";

/** Reuses data/controls/types.ts ControlRating: same "strong | adequate | weak | not_assessed" union used by both the register and the residual-risk scoring module. */
export type ControlEffectivenessRating = ControlRating;

export type PersonRole = "owner" | "reviewer" | "approver";

export interface PersonDTO {
  id: string;
  workspace_id: string;
  name: string;
  role: PersonRole;
  email: string | null;
  created_at: string;
  updated_at: string;
}

/** Client-side mirror of lib/repo/controls.ts's WorkspaceControlRow, trimmed to what the journey UI needs. */
export interface WorkspaceControlDTO {
  id: string;
  workspace_id: string;
  name: string;
  control_slug: string | null;
  category: string | null;
  status: string;
  effectiveness_rating: ControlEffectivenessRating | null;
  created_at: string;
  updated_at: string;
}

export type DecisionOutcome = "approve" | "approve_with_conditions" | "reject";

export interface DecisionDTO {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  outcome: DecisionOutcome;
  rationale: string | null;
  decided_by_person_id: string;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export type ConditionStatus = "open" | "met" | "breached";

export interface ConditionDTO {
  id: string;
  workspace_id: string;
  decision_id: string;
  description: string;
  due_date: string | null;
  status: ConditionStatus;
  owner_person_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ActionPriority = "high" | "medium" | "low";
export type ActionStatus = "open" | "in_progress" | "done" | "cancelled";

export interface ActionDTO {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  title: string;
  owner_person_id: string | null;
  due_date: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  created_at: string;
  updated_at: string;
}

export interface EvidenceDTO {
  id: string;
  workspace_id: string;
  subject_type: string;
  subject_id: string;
  type: string;
  title: string;
  description: string | null;
  link_url: string | null;
  evidence_date: string | null;
  added_by_person_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A decision plus its conditions and the assessment's follow-up actions, as returned by GET /api/pra/assessments/[id]/decision. */
export interface DecisionRecord {
  decision: DecisionDTO | null;
  conditions: ConditionDTO[];
  actions: ActionDTO[];
}

export interface AssessmentDTO {
  id: string;
  workspace_id: string;
  product_id: string;
  status: AssessmentStatus;
  recommendation: string | null;
  residual_summary: Record<string, unknown>;
  appetite_result: AppetiteResult | null;
  current_step: number;
  created_at: string;
  updated_at: string;
}

/** One ordered leg of the product's payment/data flow: from actor to actor. */
export interface FlowLeg {
  id: string;
  from: string;
  to: string;
  note?: string;
}

export interface ProductDTO {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  flows: FlowLeg[];
  customers: string[];
  jurisdictions: string[];
  channels: string[];
  created_at: string;
  updated_at: string;
}

export interface AssessmentRiskDTO {
  id: string;
  workspace_id: string;
  assessment_id: string;
  typology_slug: string | null;
  title: string;
  inherent_score: number | null;
  inherent_rationale: string | null;
  residual_score: number | null;
  residual_rationale: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentControlDTO {
  id: string;
  workspace_id: string;
  assessment_id: string;
  risk_id: string;
  workspace_control_id: string | null;
  control_slug: string | null;
  coverage: ControlCoverage;
  op_load: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AssessmentListItem {
  id: string;
  productId: string;
  productName: string;
  status: AssessmentStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  conditions_applied: "Conditions Applied",
};

export const JOURNEY_STEP_LABELS = [
  "Product profile",
  "Flows",
  "Inherent risks",
  "Control mapping",
  "Gaps & op-load",
  "Residual vs appetite",
  "Recommendation & decision",
  "Committee pack",
] as const;

/** All 8 journey steps are built. */
export const LAST_UNLOCKED_STEP = 8;

/** Step 1's locally-edited draft, flushed to the product row on step change. */
export interface ProfileDraft {
  name: string;
  description: string;
  customers: CustomerType[];
  jurisdictions: Jurisdiction[];
  channels: string[];
}

export function productToProfileDraft(product: ProductDTO): ProfileDraft {
  return {
    name: product.name,
    description: product.description ?? "",
    customers: (product.customers ?? []) as CustomerType[],
    jurisdictions: (product.jurisdictions ?? []) as Jurisdiction[],
    channels: (product.channels ?? []) as string[],
  };
}

/**
 * Step 8's committee-pack export payload, assembled client-side by
 * StepPack.tsx and sent as-is to POST /api/export/pdf (module
 * "pra_assessment"). This is the ONE canonical shape for that payload:
 * lib/pdf/pra-pdf.ts (server-only, pulls in jsPDF) imports these same types
 * rather than redeclaring them, so the two sides can never drift. Safe for
 * a server file to import from here because this module has no "use client"
 * directive and no server-only dependencies of its own.
 */
export interface PraExportControl {
  label: string;
  coverage: ControlCoverage;
  effectiveness: ControlEffectivenessRating;
  instantiated: boolean;
}

export interface PraExportRisk {
  title: string;
  typologySlug: string | null;
  inherentScore: number | null;
  residualScore: number | null;
  residualRationale: string | null;
  controls: PraExportControl[];
}

export interface PraExportGap {
  riskTitle: string;
  kind: "no_controls" | "gap_coverage";
  controlLabel?: string;
}

export interface PraExportOpLoad {
  alertsPerMonth: number;
  analystHoursPerMonth: number;
  fte: number;
  monthlyCostGbp: number;
}

export interface PraExportCondition {
  description: string;
  dueDate: string | null;
  ownerName: string | null;
  status: ConditionStatus;
}

export interface PraExportAction {
  title: string;
  ownerName: string | null;
  dueDate: string | null;
  priority: ActionPriority;
  status: ActionStatus;
}

export interface PraExportEvidence {
  title: string;
  type: string;
  description: string | null;
  linkUrl: string | null;
}

export interface PraExportDecision {
  outcome: DecisionOutcome;
  decidedByName: string;
  decidedAt: string;
  rationale: string | null;
}

export interface PraExportPayload {
  productName: string;
  productDescription: string | null;
  customers: string[];
  jurisdictions: string[];
  channels: string[];
  flows: FlowLeg[];
  risks: PraExportRisk[];
  gaps: PraExportGap[];
  opLoad: PraExportOpLoad;
  overallResidualScore: number | null;
  overallResidualRating: string | null;
  appetiteResult: AppetiteResult | null;
  recommendation: string | null;
  decision: PraExportDecision | null;
  conditions: PraExportCondition[];
  actions: PraExportAction[];
  evidence: PraExportEvidence[];
  narrative?: string | null;
}
